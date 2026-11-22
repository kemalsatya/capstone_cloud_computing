"""Test live DOCX transactions, PostgreSQL records and volume bytes using unique QA tenants."""
import datetime
import hashlib
import io
import json
import pathlib
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from xml.sax.saxutils import escape

ROOT = pathlib.Path(__file__).resolve().parents[2]
PARENT = ROOT / 'evidence/platform/tahap-5'
if not PARENT.is_dir():
    raise SystemExit('Evidence parent does not exist')
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ').lower()
token = stamp + '-' + uuid.uuid4().hex[:6]
RUN = PARENT / ('run-' + token)
RUN.mkdir()
(RUN / 'fixtures').mkdir()
TENANTS = ['s5-a-' + token, 's5-b-' + token]
PREFIX = 'stage5-' + token + '-'
report = {'startedAt': datetime.datetime.now().astimezone().isoformat(), 'status': 'running',
          'testExecutionCompleted': False, 'tenants': TENANTS, 'cases': [], 'uploads': [], 'findings': []}
payloads = {}


def command(*arguments, stdin=None):
    result = subprocess.run(arguments, cwd=ROOT, input=stdin, text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=45)
    if result.returncode:
        raise RuntimeError(arguments[0] + ' failed: ' + result.stderr.strip())
    return result.stdout.strip()


def kube(*arguments, stdin=None):
    return command('kubectl', '--context', 'k3d-capstone', '--request-timeout=15s',
                   '-n', 'default', *arguments, stdin=stdin)


def save(name, value):
    (RUN / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def pods_snapshot():
    pods = json.loads(kube('get', 'pods', '-l', 'app=journalfit', '-o', 'json'))['items']
    return [{'name': p['metadata']['name'], 'uid': p['metadata']['uid'], 'node': p['spec'].get('nodeName'),
             'ready': not p['metadata'].get('deletionTimestamp') and any(c['type'] == 'Ready' and c['status'] == 'True'
                      for c in p['status'].get('conditions', [])),
             'containers': [{'imageID': c.get('imageID'), 'restarts': c['restartCount'],
                             'lastState': c.get('lastState', {})} for c in p['status'].get('containerStatuses', [])]}
            for p in pods]


def request(name, path, tenant, expected_status, body=None, content_type=None):
    headers = {'Host': 'journalfit.localhost'}
    if tenant is not None:
        headers['X-Tenant-ID'] = tenant
    if content_type:
        headers['Content-Type'] = content_type
    started = time.monotonic()
    req = urllib.request.Request('http://127.0.0.1:8088' + path, data=body, headers=headers)
    try:
        response = urllib.request.urlopen(req, timeout=60)
    except urllib.error.HTTPError as error:
        response = error
    except (urllib.error.URLError, OSError) as error:
        case = {'name': name, 'method': 'POST' if body is not None else 'GET', 'path': path,
                'tenant': tenant, 'expectedHttp': expected_status, 'actualHttp': None,
                'expectationMet': False, 'elapsedSeconds': round(time.monotonic()-started, 3),
                'response': {'transportError': str(error)}}
        report['cases'].append(case)
        return case
    with response:
        raw = response.read()
        try:
            value = json.loads(raw)
        except ValueError:
            value = {'bodyText': raw.decode('utf-8', errors='replace')}
        case = {'name': name, 'method': 'POST' if body is not None else 'GET', 'path': path,
                'tenant': tenant, 'expectedHttp': expected_status, 'actualHttp': response.code,
                'expectationMet': response.code in expected_status,
                'elapsedSeconds': round(time.monotonic() - started, 3), 'response': value}
        report['cases'].append(case)
        return case


def multipart(blob=None, filename=None, mime=None):
    boundary = 'journalfit-' + uuid.uuid4().hex
    if blob is None:
        data = (f'--{boundary}\r\nContent-Disposition: form-data; name="note"\r\n\r\nno file\r\n').encode()
    else:
        data = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\n'
                f'Content-Type: {mime}\r\n\r\n').encode() + blob + b'\r\n'
    return data + f'--{boundary}--\r\n'.encode(), 'multipart/form-data; boundary=' + boundary


def docx(words, sections):
    vocabulary = 'cloud computing research evaluates reproducible deployment storage workflow service reliability'.split()
    middle_count = words - (3 if sections else 0)
    tokens = (['Abstract'] if sections else []) + [vocabulary[i % len(vocabulary)] for i in range(middle_count)]
    if sections:
        tokens += ['Keywords', 'cloud']
    assert len(tokens) == words
    document = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
                '<w:body><w:p><w:r><w:t xml:space="preserve">' + escape(' '.join(tokens)) +
                '</w:t></w:r></w:p><w:sectPr/></w:body></w:document>')
    parts = {
        '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        'word/document.xml': document,
    }
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as archive:
        for name, text in parts.items():
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, text.encode('utf-8'))
    return buffer.getvalue()


def upload(name, tenant, blob, filename, expected_status, expected_score=None, expected_words=None, expected_warnings=None, mime=None):
    body, content_type = multipart(blob, filename, mime or 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    case = request(name, '/api/manuscripts/upload', tenant, expected_status, body, content_type)
    info = {'case': name, 'tenant': tenant, 'filename': filename, 'bytes': len(blob),
            'sha256': hashlib.sha256(blob).hexdigest(), 'expectedScore': expected_score,
            'expectedWords': expected_words, 'expectedWarnings': expected_warnings}
    case['fixture'] = info
    if case['actualHttp'] == 201 and case['response'].get('data', {}).get('manuscript'):
        info['apiData'] = case['response']['data']
        report['uploads'].append(info)
        payloads[info['apiData']['manuscript']['id']] = info
    return case


def database_snapshot(pod):
    script = """
import pg from 'pg';
const client=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,
 password:process.env.DB_PASSWORD,database:process.env.DB_NAME,connectionTimeoutMillis:5000,statement_timeout:10000});
const tenants=TENANTS;
try {
 await client.connect();
 await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const identity=(await client.query("SELECT current_database() AS database,current_user AS role,current_setting('transaction_read_only') AS read_only")).rows[0];
 const tenantRows=(await client.query('SELECT id,name FROM tenants WHERE id=ANY($1::text[]) ORDER BY id',[tenants])).rows;
 const templates=(await client.query('SELECT * FROM format_rule_templates WHERE tenant_id=ANY($1::text[]) ORDER BY tenant_id',[tenants])).rows;
 const manuscripts=(await client.query('SELECT * FROM manuscripts WHERE tenant_id=ANY($1::text[]) ORDER BY id',[tenants])).rows;
 const results=(await client.query('SELECT c.* FROM check_results c JOIN manuscripts m ON m.id=c.manuscript_id WHERE m.tenant_id=ANY($1::text[]) ORDER BY c.id',[tenants])).rows;
 const findings=(await client.query('SELECT f.* FROM findings f JOIN check_results c ON c.id=f.check_result_id JOIN manuscripts m ON m.id=c.manuscript_id WHERE m.tenant_id=ANY($1::text[]) ORDER BY f.id',[tenants])).rows;
 await client.query('ROLLBACK');
 console.log(JSON.stringify({identity,tenants:tenantRows,templates,manuscripts,results,findings}));
} catch(error) {console.error(error.message);process.exitCode=1;} finally {await client.end();}
""".replace('TENANTS', json.dumps(TENANTS))
    return json.loads(kube('exec', '-i', pod, '--', 'node', '--input-type=module', '-', stdin=script))


try:
    report['source'] = {'head': command('git', 'rev-parse', 'HEAD'),
                         'scriptSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
                         'applicationFiles': {str(p.relative_to(ROOT)).replace('\\', '/'): hashlib.sha256(p.read_bytes()).hexdigest()
                                              for p in sorted((ROOT / 'source/src').rglob('*.js'))}}
    report['podsBefore'] = pods_snapshot()
    before_ready = [p for p in report['podsBefore'] if p['ready']]
    assert len(before_ready) >= 2, 'Two Ready pods are required before testing'
    expected_digest = json.loads((ROOT / 'evidence/platform/tahap-2/build-metadata.json').read_text())['containerimage.digest']
    assert all(expected_digest in c['imageID'] for p in before_ready for c in p['containers']), 'Unexpected application artifact'
    report['imageDigest'] = expected_digest
    before_db = database_snapshot(before_ready[0]['name'])
    save('database-before.json', before_db)
    assert not before_db['tenants'] and not before_db['manuscripts'], 'QA tenant identifiers are not new'

    fixtures = {'compliant': docx(3500, True), 'short': docx(100, False), 'long': docx(8500, True)}
    for name, data in fixtures.items():
        (RUN / 'fixtures' / (name + '.docx')).write_bytes(data)
    (RUN / 'fixtures/not-docx.txt').write_bytes(b'plain text content that is not a DOCX archive')

    upload('upload_compliant_a', TENANTS[0], fixtures['compliant'], PREFIX+'compliant.docx', [201], 100, 3500, [])
    upload('upload_short_a', TENANTS[0], fixtures['short'], PREFIX+'short.docx', [201], 50, 100,
           ['WORD_COUNT', 'ABSTRACT_CHECK', 'KEYWORDS_CHECK'])
    upload('upload_long_a', TENANTS[0], fixtures['long'], PREFIX+'long.docx', [201], 85, 8500, ['WORD_COUNT'])
    upload('upload_compliant_b', TENANTS[1], fixtures['compliant'], PREFIX+'tenant-b.docx', [201], 100, 3500, [])
    assert len(report['uploads']) == 4, 'A core DOCX upload failed; inspect API cases'

    a_id = report['uploads'][0]['apiData']['manuscript']['id']
    b_id = report['uploads'][3]['apiData']['manuscript']['id']
    request('cross_tenant_b_reads_a', '/api/manuscripts/'+a_id+'/report', TENANTS[1], [403])
    request('cross_tenant_a_reads_b', '/api/manuscripts/'+b_id+'/report', TENANTS[0], [403])
    upload('missing_tenant', None, fixtures['compliant'], PREFIX+'no-tenant.docx', [400])
    body, content_type = multipart()
    request('missing_file', '/api/manuscripts/upload', TENANTS[0], [400], body, content_type)
    request('missing_report', '/api/manuscripts/ms-missing-'+uuid.uuid4().hex[:8]+'/report', TENANTS[0], [404])
    invalid = upload('reject_non_docx', TENANTS[0], (RUN/'fixtures/not-docx.txt').read_bytes(),
                     PREFIX+'not-docx.txt', [400, 415, 422], mime='text/plain')
    oversized = upload('reject_oversized', TENANTS[0], b'x'*(20*1024*1024+1),
                       PREFIX+'oversize.docx', [400, 413])

    core_results = []
    for info in report['uploads']:
        manuscript_id = info['apiData']['manuscript']['id']
        case = request('report_'+info['case'], '/api/manuscripts/'+urllib.parse.quote(manuscript_id, safe='')+'/report', info['tenant'], [200])
        assert case['actualHttp'] == 200, 'An accepted manuscript report cannot be retrieved'
        data = case['response']['data']
        info['reportData'] = data
        same = data['manuscript']['id'] == manuscript_id and data['checkResult']['id'] == info['apiData']['checkResult']['id']
        if info['expectedScore'] is not None:
            count_finding = next(f for f in data['findings'] if f['rule_type']=='WORD_COUNT')
            match = re.search(r'Word count(?: is |\s*\()(\d+)', count_finding['message'])
            warning_types = sorted(f['rule_type'] for f in data['findings'] if f['severity']=='WARNING')
            passed = same and data['checkResult']['status']=='COMPLETED' and data['checkResult']['format_score']==info['expectedScore'] and \
                     match is not None and int(match.group(1))==info['expectedWords'] and warning_types==sorted(info['expectedWarnings'])
            core_results.append({'case': info['case'], 'manuscriptId': manuscript_id, 'passed': passed,
                                  'expectedScore': info['expectedScore'], 'actualScore': data['checkResult']['format_score'],
                                  'expectedWords': info['expectedWords'], 'observedWords': int(match.group(1)) if match else None})
    report['coreResults'] = core_results

    report['podsAfter'] = pods_snapshot()
    ready = [p for p in report['podsAfter'] if p['ready']]
    assert len(ready) >= 2, 'The workload did not retain two Ready pods'
    after_db = database_snapshot(ready[0]['name'])
    save('database-after.json', after_db)
    records = {row['id']: row for row in after_db['manuscripts']}
    checks = {row['id']: row for row in after_db['results']}
    findings = {row['id']: row for row in after_db['findings']}
    database_matches = []
    for manuscript_id, info in payloads.items():
        api = info['reportData']
        row = records.get(manuscript_id, {})
        result = checks.get(api['checkResult']['id'], {})
        database_matches.append(all(row.get(k)==api['manuscript'][k] for k in ['id','tenant_id','author_id','title','file_path']) and
                                all(result.get(k)==api['checkResult'][k] for k in ['id','manuscript_id','status','format_score']) and
                                all(all(findings.get(f['id'],{}).get(k)==f[k] for k in ['id','check_result_id','rule_type','severity','message']) for f in api['findings']))
    report['databaseAgreement'] = dict(zip(payloads, database_matches))

    file_spec = [{'id': row['id'], 'file_path': row['file_path']} for row in after_db['manuscripts']]
    assert all(row['file_path'].startswith('/uploads/') and '..' not in row['file_path'] for row in file_spec)
    file_script = """
import fs from 'node:fs'; import crypto from 'node:crypto';
const spec=SPEC;
const files=spec.files.map(f=>{const path='/app'+f.file_path; const bytes=fs.readFileSync(path); const stat=fs.statSync(path);
 return {id:f.id,path,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),uid:stat.uid,gid:stat.gid};});
const matchingNames=fs.readdirSync('/app/uploads').filter(name=>name.includes(spec.prefix));
console.log(JSON.stringify({uid:process.getuid(),files,matchingNames}));
""".replace('SPEC', json.dumps({'files': file_spec, 'prefix': PREFIX}))
    report['fileChecks'] = {}
    for pod in ready:
        report['fileChecks'][pod['name']] = json.loads(kube('exec','-i',pod['name'],'--','node','--input-type=module','-',stdin=file_script))
    expected_names = {row['file_path'].split('/')[-1] for row in file_spec}
    file_matches = all(item['sha256']==payloads[item['id']]['sha256'] and item['bytes']==payloads[item['id']]['bytes']
                       for state in report['fileChecks'].values() for item in state['files'])
    no_orphans = all(set(state['matchingNames'])==expected_names for state in report['fileChecks'].values())
    templates_ok = len(after_db['templates'])==2 and all(t['min_words']==3000 and t['max_words']==8000 and
                    t['require_abstract'] and t['require_keywords'] for t in after_db['templates'])
    report['healthAfter'] = request('health_after', '/health/ready', None, [200])
    report['podsAfter'] = pods_snapshot()
    before_restarts = {p['uid']: sum(c['restarts'] for c in p['containers']) for p in report['podsBefore']}
    report['restartDeltas'] = {p['name']: sum(c['restarts'] for c in p['containers'])-before_restarts[p['uid']]
                               for p in report['podsAfter'] if p['uid'] in before_restarts}
    report['checks'] = {
        'fourCoreDocxScenarios': len(core_results)==4 and all(c['passed'] for c in core_results),
        'acceptedReportsMatchDatabase': all(database_matches),
        'noUnexpectedDatabaseRecords': set(records)==set(payloads) and len(checks)==len(payloads) and len(findings)==3*len(payloads),
        'fileBytesMatchAllPods': file_matches,
        'noOrphanFixtureFiles': no_orphans,
        'defaultTemplatesVerified': templates_ok,
        'tenantHeaderMismatchDenied': all(c['expectationMet'] for c in report['cases'] if c['name'].startswith('cross_tenant_')),
        'requiredInputAndMissingRecord': all(c['expectationMet'] for c in report['cases'] if c['name'] in ['missing_tenant','missing_file','missing_report']),
        'noObservedRestartDuringTests': all(delta==0 for delta in report['restartDeltas'].values()),
        'healthRemainsReady': report['healthAfter']['actualHttp']==200,
        'nonDocxRejected': invalid['expectationMet'],
        'oversizeClientError': oversized['expectationMet'],
        'oversizeNotPersisted': not any(row['title']==PREFIX+'oversize.docx' for row in records.values()),
    }
    report['coreWorkflowPassed'] = all(value for key,value in report['checks'].items() if key not in ['nonDocxRejected','oversizeClientError'])
    if not invalid['expectationMet']:
        report['findings'].append({'id':'non-docx-accepted','owner':'M2 application', 'actualHttp':invalid['actualHttp'],
                                   'action':'Add strict DOCX validation and remove/restrict the raw-text fallback in production.'})
    if not oversized['expectationMet']:
        report['findings'].append({'id':'oversize-error-mapping','owner':'M2 application', 'actualHttp':oversized['actualHttp'],
                                   'action':'Map the upload size error to a client response such as 413 instead of an unhandled server error.'})
    report['testExecutionCompleted'] = True
    report['status'] = 'passed' if all(report['checks'].values()) else 'needs_attention'
except Exception as error:
    report['status'] = 'failed'
    report['error'] = str(error)
finally:
    report['finishedAt'] = datetime.datetime.now().astimezone().isoformat()
    save('results.json', report)
    print(json.dumps({'status':report['status'], 'evidence':str(RUN.relative_to(ROOT)),
                      'testExecutionCompleted':report['testExecutionCompleted'], 'coreWorkflowPassed':report.get('coreWorkflowPassed'),
                      'checks':report.get('checks'), 'findings':report['findings'], 'error':report.get('error')},indent=2))

if report['status']=='failed':
    raise SystemExit(1)
if report['status']=='needs_attention':
    raise SystemExit(2)
