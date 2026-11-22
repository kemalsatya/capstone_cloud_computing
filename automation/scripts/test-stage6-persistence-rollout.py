"""Measure data/file persistence and service behavior across pod replacement and rolling update."""
import datetime
import hashlib
import io
import json
import pathlib
import subprocess
import threading
import time
import urllib.error
import urllib.request
import uuid
import zipfile
from xml.sax.saxutils import escape

ROOT = pathlib.Path(__file__).resolve().parents[2]
PARENT = ROOT / 'evidence/platform/tahap-6'
if not PARENT.is_dir():
    raise SystemExit('Evidence parent does not exist')
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ').lower()
token = stamp + '-' + uuid.uuid4().hex[:6]
RUN = PARENT / ('run-' + token)
RUN.mkdir()
(RUN / 'fixtures').mkdir()
TENANT = 's6-' + token
PREFIX = 'stage6-' + token + '-'
DEMO_ID = 'ms-519b3203'
DEMO_TENANT = 'tenant-m3-demo'
report = {'startedAt': datetime.datetime.now().astimezone().isoformat(), 'status': 'running',
          'testExecutionCompleted': False, 'tenant': TENANT, 'cases': [], 'checks': {}, 'findings': []}


def command(*arguments, stdin=None, timeout=45):
    result = subprocess.run(arguments, cwd=ROOT, input=stdin, text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=timeout)
    if result.returncode:
        raise RuntimeError(arguments[0] + ' failed: ' + result.stderr.strip())
    return result.stdout.strip()


def kube(*arguments, stdin=None, timeout=45):
    return command('kubectl', '--context', 'k3d-capstone', '--request-timeout=15s',
                   '-n', 'default', *arguments, stdin=stdin, timeout=timeout)


def save(name, value):
    (RUN / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def pods_snapshot():
    pods = json.loads(kube('get', 'pods', '-l', 'app=journalfit', '-o', 'json'))['items']
    return [{'name': p['metadata']['name'], 'uid': p['metadata']['uid'], 'node': p['spec'].get('nodeName'),
             'createdAt': p['metadata'].get('creationTimestamp'),
             'ready': not p['metadata'].get('deletionTimestamp') and any(c['type'] == 'Ready' and c['status'] == 'True'
                      for c in p['status'].get('conditions', [])),
             'containers': [{'imageID': c.get('imageID'), 'restarts': c['restartCount'],
                             'startedAt': c.get('state', {}).get('running', {}).get('startedAt'),
                             'lastState': c.get('lastState', {})} for c in p['status'].get('containerStatuses', [])]}
            for p in pods]


def deployment_snapshot():
    deployment = json.loads(kube('get', 'deployment', 'journalfit-backend', '-o', 'json'))
    spec, status = deployment['spec'], deployment['status']
    return {'generation': deployment['metadata']['generation'],
            'observedGeneration': status.get('observedGeneration'),
            'replicas': status.get('replicas', 0),
            'updatedReplicas': status.get('updatedReplicas', 0),
            'readyReplicas': status.get('readyReplicas', 0),
            'availableReplicas': status.get('availableReplicas', 0),
            'unavailableReplicas': status.get('unavailableReplicas', 0),
            'strategy': spec.get('strategy'),
            'minReadySeconds': spec.get('minReadySeconds'),
            'image': spec['template']['spec']['containers'][0]['image'],
            'restartedAt': spec['template']['metadata'].get('annotations', {}).get('kubectl.kubernetes.io/restartedAt'),
            'conditions': status.get('conditions', [])}


def hpa_snapshot():
    hpa = json.loads(kube('get', 'hpa', 'journalfit-backend', '-o', 'json'))
    return {'minReplicas': hpa['spec']['minReplicas'], 'maxReplicas': hpa['spec']['maxReplicas'],
            'currentReplicas': hpa['status'].get('currentReplicas'),
            'desiredReplicas': hpa['status'].get('desiredReplicas'),
            'metrics': [{'name': m['resource']['name'],
                         'currentUtilization': m['resource'].get('current', {}).get('averageUtilization')}
                        for m in hpa['status'].get('currentMetrics', [])]}


def pvc_snapshot():
    pvc = json.loads(kube('get', 'pvc', 'journalfit-uploads', '-o', 'json'))
    return {'name': pvc['metadata']['name'], 'phase': pvc['status'].get('phase'),
            'volumeName': pvc['spec'].get('volumeName'),
            'capacity': pvc['status'].get('capacity', {}).get('storage'),
            'accessModes': pvc['spec'].get('accessModes'),
            'storageClass': pvc['spec'].get('storageClassName')}


def nodes_snapshot():
    nodes = json.loads(kube('get', 'nodes', '-o', 'json'))['items']
    return [{'name': n['metadata']['name'], 'ready': any(c['type'] == 'Ready' and c['status'] == 'True'
             for c in n['status'].get('conditions', [])), 'version': n['status']['nodeInfo'].get('kubeletVersion')}
            for n in nodes]


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
        case = {'name': name, 'method': 'POST' if body is not None else 'GET', 'path': path, 'tenant': tenant,
                'expectedHttp': expected_status, 'actualHttp': None, 'expectationMet': False,
                'elapsedSeconds': round(time.monotonic() - started, 3),
                'response': {'transportError': str(error)}}
        report['cases'].append(case)
        return case
    with response:
        raw = response.read()
        try:
            value = json.loads(raw)
        except ValueError:
            value = {'bodyText': raw.decode('utf-8', errors='replace')}
        case = {'name': name, 'method': 'POST' if body is not None else 'GET', 'path': path, 'tenant': tenant,
                'expectedHttp': expected_status, 'actualHttp': response.code,
                'expectationMet': response.code in expected_status,
                'elapsedSeconds': round(time.monotonic() - started, 3), 'response': value}
        report['cases'].append(case)
        return case


def multipart(blob, filename, mime):
    boundary = 'journalfit-' + uuid.uuid4().hex
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


def database_snapshot(pod):
    script = """
import pg from 'pg';
const client=new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,
 password:process.env.DB_PASSWORD,database:process.env.DB_NAME,connectionTimeoutMillis:5000,statement_timeout:10000});
const tenants=QA_TENANTS_JSON;
const demoId=DEMO_ID_JSON;
try {
 await client.connect();
 await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const identity=(await client.query("SELECT current_database() AS database,current_user AS role,current_setting('transaction_read_only') AS read_only")).rows[0];
 const tenantRows=(await client.query('SELECT id,name FROM tenants WHERE id=ANY($1::text[]) ORDER BY id',[tenants])).rows;
 const templates=(await client.query('SELECT * FROM format_rule_templates WHERE tenant_id=ANY($1::text[]) ORDER BY tenant_id',[tenants])).rows;
 const manuscripts=(await client.query('SELECT * FROM manuscripts WHERE tenant_id=ANY($1::text[]) ORDER BY id',[tenants])).rows;
 const results=(await client.query('SELECT c.* FROM check_results c JOIN manuscripts m ON m.id=c.manuscript_id WHERE m.tenant_id=ANY($1::text[]) ORDER BY c.id',[tenants])).rows;
 const findings=(await client.query('SELECT f.* FROM findings f JOIN check_results c ON c.id=f.check_result_id JOIN manuscripts m ON m.id=c.manuscript_id WHERE m.tenant_id=ANY($1::text[]) ORDER BY f.id',[tenants])).rows;
 const demo=(await client.query('SELECT id,tenant_id,title,file_path,upload_time FROM manuscripts WHERE id=$1',[demoId])).rows;
 await client.query('ROLLBACK');
 console.log(JSON.stringify({identity,tenants:tenantRows,templates,manuscripts,results,findings,demo}));
} catch(error) {console.error(error.message);process.exitCode=1;} finally {await client.end();}
""".replace('QA_TENANTS_JSON', json.dumps([TENANT])).replace('DEMO_ID_JSON', json.dumps(DEMO_ID))
    return json.loads(kube('exec', '-i', pod, '--', 'node', '--input-type=module', '-', stdin=script))


def cohort(snapshot):
    return {key: snapshot[key] for key in ['tenants', 'templates', 'manuscripts', 'results', 'findings']}


def file_stat(pod, file_path):
    script = """
import fs from 'node:fs';
const stat=fs.statSync('/app'+FILE_PATH_JSON);
console.log(JSON.stringify({bytes:stat.size,mode:stat.mode,uid:stat.uid,gid:stat.gid,mtime:stat.mtime.toISOString()}));
""".replace('FILE_PATH_JSON', json.dumps(file_path))
    state = json.loads(kube('exec', '-i', pod, '--', 'node', '--input-type=module', '-', stdin=script))
    state['modeOctal'] = oct(state['mode'] & 0o777)
    return state


def file_check(pod, file_path, expected_sha256, expected_bytes):
    script = """
import fs from 'node:fs'; import crypto from 'node:crypto';
const spec=FILE_SPEC_JSON;
const path='/app'+spec.filePath;
const bytes=fs.readFileSync(path);
const stat=fs.statSync(path);
const matching=fs.readdirSync('/app/uploads').filter(name=>name.includes(spec.prefix));
console.log(JSON.stringify({uid:process.getuid(),path,bytes:bytes.length,
 sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
 mode:stat.mode,fileUid:stat.uid,fileGid:stat.gid,matching}));
""".replace('FILE_SPEC_JSON', json.dumps({'filePath': file_path, 'prefix': PREFIX}))
    state = json.loads(kube('exec', '-i', pod, '--', 'node', '--input-type=module', '-', stdin=script))
    state['modeOctal'] = oct(state['mode'] & 0o777)
    state['matchesExpected'] = state['sha256'] == expected_sha256 and state['bytes'] == expected_bytes
    state['noOrphans'] = state['matching'] == [file_path.split('/')[-1]]
    return state


def file_checks(pods, file_path, expected_sha256, expected_bytes):
    return {pod['name']: file_check(pod['name'], file_path, expected_sha256, expected_bytes)
            for pod in pods if pod['ready']}


def report_signature(case):
    data = case['response'].get('data', {}) if isinstance(case.get('response'), dict) else {}
    manuscript = data.get('manuscript', {})
    result = data.get('checkResult', {})
    return {'http': case['actualHttp'], 'id': manuscript.get('id'), 'tenant': manuscript.get('tenant_id'),
            'score': result.get('format_score'), 'status': result.get('status'),
            'findings': sorted(f.get('rule_type') for f in data.get('findings', []))}


def wait_for_stable_deployment(timeout, require_all_pods_ready=True):
    started = time.monotonic()
    last = None
    while time.monotonic() - started < timeout:
        deployment = deployment_snapshot()
        pods = pods_snapshot()
        ready_pods = [pod for pod in pods if pod['ready']]
        stable = (deployment['observedGeneration'] == deployment['generation']
                  and deployment['readyReplicas'] == deployment['replicas']
                  and deployment['availableReplicas'] == deployment['replicas']
                  and deployment['replicas'] >= 2
                  and (not require_all_pods_ready or len(ready_pods) == len(pods)))
        last = {'deployment': deployment, 'pods': pods, 'stable': stable}
        if stable:
            return {'seconds': round(time.monotonic() - started, 3), **last}
        time.sleep(1)
    raise TimeoutError('Deployment did not become stable: ' + json.dumps(last))


class AvailabilityProbe(threading.Thread):
    def __init__(self, report_path, tenant):
        super().__init__(daemon=True)
        self.stop_event = threading.Event()
        self.entries = []
        self.report_path = report_path
        self.tenant = tenant
        self.sequence = 0

    def stop(self):
        self.stop_event.set()

    def run(self):
        while not self.stop_event.is_set():
            self.sequence += 1
            self.probe('readiness', '/health/ready', None)
            if self.sequence % 4 == 0:
                self.probe('report', self.report_path, self.tenant)
            self.stop_event.wait(0.25)

    def probe(self, name, path, tenant):
        headers = {'Host': 'journalfit.localhost'}
        if tenant:
            headers['X-Tenant-ID'] = tenant
        started = time.monotonic()
        entry = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'probe': name, 'path': path}
        try:
            with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8088' + path,
                                                               headers=headers), timeout=3) as response:
                entry.update(http=response.code)
                response.read(64)
        except urllib.error.HTTPError as error:
            entry.update(http=error.code)
            error.read(64)
        except (urllib.error.URLError, OSError) as error:
            entry.update(http=None, error=str(error))
        entry['elapsedMs'] = round((time.monotonic() - started) * 1000, 1)
        self.entries.append(entry)


def probe_stats(entries):
    stats = {}
    for name in ['readiness', 'report']:
        subset = [entry for entry in entries if entry['probe'] == name]
        failures = [entry for entry in subset if entry.get('http') != 200]
        streak = longest = 0
        for entry in subset:
            if entry.get('http') == 200:
                streak = 0
            else:
                streak += 1
                longest = max(longest, streak)
        stats[name] = {'total': len(subset), 'success': len(subset) - len(failures), 'failed': len(failures),
                       'successPercent': round(100 * (len(subset) - len(failures)) / len(subset), 2) if subset else None,
                       'maxConsecutiveFailures': longest, 'failures': failures[:20]}
    return stats


def events_snapshot():
    items = json.loads(kube('get', 'events', '-o', 'json'))['items']
    selected = [{'time': item.get('eventTime') or item.get('lastTimestamp') or item.get('firstTimestamp'),
                 'type': item.get('type'), 'reason': item.get('reason'),
                 'object': item['involvedObject'].get('name'), 'message': item.get('message')}
                for item in items if item['involvedObject'].get('name', '').startswith('journalfit')]
    return sorted(selected, key=lambda item: item['time'] or '')


try:
    report['source'] = {'head': command('git', 'rev-parse', 'HEAD'),
                        'scriptSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
                        'applicationFiles': {str(p.relative_to(ROOT)).replace('\\', '/'):
                                             hashlib.sha256(p.read_bytes()).hexdigest()
                                             for p in sorted((ROOT / 'source/src').rglob('*.js'))}}
    expected_digest = json.loads((ROOT / 'evidence/platform/tahap-2/build-metadata.json')
                                 .read_text())['containerimage.digest']
    report['imageDigest'] = expected_digest

    baseline = {'deployment': deployment_snapshot(), 'hpa': hpa_snapshot(), 'pods': pods_snapshot(),
                'pvc': pvc_snapshot(), 'nodes': nodes_snapshot()}
    assert all(node['ready'] for node in baseline['nodes']), 'All cluster nodes must be Ready'
    assert baseline['deployment']['observedGeneration'] == baseline['deployment']['generation'], \
        'Deployment generation is not fully observed'
    assert baseline['deployment']['readyReplicas'] >= 2, 'Two Ready replicas are required before testing'
    assert all(expected_digest in container['imageID'] for pod in baseline['pods'] if pod['ready']
               for container in pod['containers']), 'Unexpected application artifact is running'
    assert baseline['pvc']['phase'] == 'Bound', 'Upload PVC must be Bound'

    settle_started = time.monotonic()
    settle_since = None
    hpa_settled = False
    while time.monotonic() - settle_started < 180:
        deployment = deployment_snapshot()
        hpa = hpa_snapshot()
        settled = (deployment['observedGeneration'] == deployment['generation']
                   and deployment['readyReplicas'] == deployment['replicas']
                   and hpa['currentReplicas'] == hpa['desiredReplicas'] == deployment['replicas'])
        if settled:
            settle_since = settle_since or time.monotonic()
            if time.monotonic() - settle_since >= 15:
                hpa_settled = True
                break
        else:
            settle_since = None
        time.sleep(3)
    baseline['hpaSettled'] = hpa_settled
    baseline['hpaSettleSeconds'] = round(time.monotonic() - settle_started, 3)
    baseline['deployment'] = deployment_snapshot()
    baseline['hpa'] = hpa_snapshot()
    baseline['pods'] = pods_snapshot()
    assert baseline['deployment']['readyReplicas'] == baseline['deployment']['replicas'] >= 2
    report['baseline'] = baseline
    for name, value in [('deployment-before.json', baseline['deployment']), ('hpa-before.json', baseline['hpa']),
                        ('pods-before.json', baseline['pods']), ('pvc-before.json', baseline['pvc']),
                        ('nodes-before.json', baseline['nodes'])]:
        save(name, value)

    baseline_pod = next(pod for pod in baseline['pods'] if pod['ready'])
    demo_case = request('demo_report_after_resume', '/api/manuscripts/' + DEMO_ID + '/report', DEMO_TENANT, [200])
    demo_snapshot = database_snapshot(baseline_pod['name'])
    save('database-before.json', demo_snapshot)
    try:
        demo_file = file_stat(baseline_pod['name'], demo_snapshot['demo'][0]['file_path']) if demo_snapshot['demo'] else None
    except RuntimeError as error:
        demo_file = {'error': str(error)}
    report['resumeObservation'] = {
        'note': 'Lab containers stopped 2026-11-18 and resumed 2026-11-21; the 2026-11-17 demo record is read after the gap.',
        'report': report_signature(demo_case), 'databaseRow': demo_snapshot['demo'][0] if demo_snapshot['demo'] else None,
        'file': demo_file,
        'podStartHistory': [{'name': pod['name'], 'startedAt': container.get('startedAt'),
                             'lastState': container.get('lastState')}
                            for pod in baseline['pods'] for container in pod['containers']]}
    assert demo_case['actualHttp'] == 200, 'Existing demo report is not readable after lab resume'

    blob = docx(3500, True)
    (RUN / 'fixtures' / (PREFIX + 'persistence.docx')).write_bytes(blob)
    body, content_type = multipart(blob, PREFIX + 'persistence.docx',
                                   'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    upload_case = request('upload_persistence_fixture', '/api/manuscripts/upload', TENANT, [201], body, content_type)
    upload_case['request'] = {'filename': PREFIX + 'persistence.docx', 'bytes': len(blob),
                              'sha256': hashlib.sha256(blob).hexdigest()}
    assert upload_case['actualHttp'] == 201, 'Persistence fixture upload failed'
    manuscript = upload_case['response']['data']['manuscript']
    manuscript_id = manuscript['id']
    file_path = manuscript['file_path']
    upload_case['request']['manuscriptId'] = manuscript_id
    upload_case['request']['filePath'] = file_path
    report['upload'] = upload_case

    report_before = request('report_before_disruption', '/api/manuscripts/' + manuscript_id + '/report', TENANT, [200])
    assert report_before['actualHttp'] == 200, 'Uploaded report is not readable before disruption'
    database_before = database_snapshot(baseline_pod['name'])
    save('database-after-upload.json', database_before)
    ready_pods = [pod for pod in pods_snapshot() if pod['ready']]
    files_before = file_checks(ready_pods, file_path, hashlib.sha256(blob).hexdigest(), len(blob))
    save('files-before.json', files_before)
    assert all(state['matchesExpected'] and state['noOrphans'] for state in files_before.values())
    baseline_signature = report_signature(report_before)

    pre_delete = pods_snapshot()
    pre_delete_uids = {pod['uid'] for pod in pre_delete}
    target = next(pod for pod in pre_delete if pod['ready'])
    report['podDelete'] = {'target': target['name'], 'targetUid': target['uid'], 'gracePeriodSeconds': 30}
    started = time.monotonic()
    kube('delete', 'pod', target['name'], '--wait=false', '--grace-period=30')
    replacement_ready = None
    old_pod_gone = None
    last_state = None
    while time.monotonic() - started < 150:
        pods = pods_snapshot()
        deployment = deployment_snapshot()
        names = {pod['name'] for pod in pods}
        last_state = {'deployment': deployment, 'pods': pods}
        new_ready = [pod for pod in pods if pod['uid'] not in pre_delete_uids and pod['ready']]
        if replacement_ready is None and new_ready and deployment['readyReplicas'] == deployment['replicas'] \
                and deployment['availableReplicas'] == deployment['replicas'] and deployment['replicas'] >= 2:
            replacement_ready = round(time.monotonic() - started, 3)
        if target['name'] not in names:
            old_pod_gone = round(time.monotonic() - started, 3)
        if replacement_ready is not None and old_pod_gone is not None:
            break
        time.sleep(1)
    report['podDelete']['replacementReadySeconds'] = replacement_ready
    report['podDelete']['oldPodGoneSeconds'] = old_pod_gone
    assert replacement_ready is not None and old_pod_gone is not None, \
        'Pod replacement did not reconcile in time: ' + json.dumps(last_state)

    stable_after_delete = wait_for_stable_deployment(90)
    pods_after_delete = stable_after_delete['pods']
    save('pods-after-pod-delete.json', pods_after_delete)
    save('deployment-after-pod-delete.json', stable_after_delete['deployment'])
    report['podDelete']['replacementSeconds'] = stable_after_delete['seconds']
    report['podDelete']['pods'] = pods_after_delete
    report['podDelete']['newUids'] = [pod['uid'] for pod in pods_after_delete if pod['uid'] not in pre_delete_uids]
    report['podDelete']['oldUidAbsent'] = all(pod['uid'] != target['uid'] for pod in pods_after_delete)

    report_after_delete = request('report_after_pod_delete', '/api/manuscripts/' + manuscript_id + '/report',
                                  TENANT, [200])
    database_after_delete = database_snapshot(next(pod for pod in pods_after_delete if pod['ready'])['name'])
    save('database-after-pod-delete.json', database_after_delete)
    files_after_delete = file_checks([pod for pod in pods_after_delete if pod['ready']], file_path,
                                     hashlib.sha256(blob).hexdigest(), len(blob))
    save('files-after-pod-delete.json', files_after_delete)
    report['podDelete']['report'] = report_signature(report_after_delete)
    report['podDelete']['databaseUnchanged'] = cohort(database_before) == cohort(database_after_delete)
    report['podDelete']['files'] = files_after_delete

    pre_rollout = pods_snapshot()
    pre_rollout_uids = {pod['uid'] for pod in pre_rollout}
    deployment_before_rollout = deployment_snapshot()
    probe = AvailabilityProbe('/api/manuscripts/' + manuscript_id + '/report', TENANT)
    probe.start()
    rollout_started = time.monotonic()
    kube('rollout', 'restart', 'deployment/journalfit-backend')
    rollout_ok = True
    try:
        rollout_output = kube('rollout', 'status', 'deployment/journalfit-backend', '--timeout=240s', timeout=260)
    except RuntimeError as error:
        rollout_ok = False
        rollout_output = str(error)
    rollout_seconds = round(time.monotonic() - rollout_started, 3)
    time.sleep(3)
    probe.stop()
    probe.join()
    save('rollout-probes.json', probe.entries)
    (RUN / 'rollout-status.txt').write_text(rollout_output + '\n', encoding='utf-8')
    stable_after_rollout = wait_for_stable_deployment(120)
    pods_after_rollout = stable_after_rollout['pods']
    deployment_after_rollout = stable_after_rollout['deployment']
    save('pods-after-rollout.json', pods_after_rollout)
    save('deployment-after-rollout.json', deployment_after_rollout)
    save('hpa-after.json', hpa_snapshot())
    save('pvc-after.json', pvc_snapshot())
    save('nodes-after.json', nodes_snapshot())
    save('events.json', events_snapshot())
    report['rollout'] = {
        'generationBefore': deployment_before_rollout['generation'],
        'generationAfter': deployment_after_rollout['generation'],
        'restartedAt': deployment_after_rollout['restartedAt'],
        'seconds': rollout_seconds, 'statusOutput': rollout_output, 'succeeded': rollout_ok,
        'podsBefore': pre_rollout, 'podsAfter': pods_after_rollout,
        'oldPodsAbsent': all(pod['uid'] not in pre_rollout_uids for pod in pods_after_rollout),
        'newUids': [pod['uid'] for pod in pods_after_rollout if pod['uid'] not in pre_rollout_uids],
        'probes': probe_stats(probe.entries), 'probeLog': 'rollout-probes.json'}

    report_after_rollout = request('report_after_rollout', '/api/manuscripts/' + manuscript_id + '/report',
                                   TENANT, [200])
    database_after_rollout = database_snapshot(next(pod for pod in pods_after_rollout if pod['ready'])['name'])
    save('database-after-rollout.json', database_after_rollout)
    files_after_rollout = file_checks([pod for pod in pods_after_rollout if pod['ready']], file_path,
                                      hashlib.sha256(blob).hexdigest(), len(blob))
    save('files-after-rollout.json', files_after_rollout)
    report['rollout']['report'] = report_signature(report_after_rollout)
    report['rollout']['databaseUnchanged'] = cohort(database_before) == cohort(database_after_rollout)
    report['rollout']['files'] = files_after_rollout

    data_after_delete = (report_after_delete['actualHttp'] == 200
                         and report['podDelete']['report'] == baseline_signature
                         and report['podDelete']['databaseUnchanged'])
    file_after_delete = all(state['matchesExpected'] and state['noOrphans']
                            for state in files_after_delete.values()) and bool(files_after_delete)
    data_after_rollout = (report_after_rollout['actualHttp'] == 200
                          and report['rollout']['report'] == baseline_signature
                          and report['rollout']['databaseUnchanged'])
    file_after_rollout = all(state['matchesExpected'] and state['noOrphans']
                             for state in files_after_rollout.values()) and bool(files_after_rollout)
    new_pods_no_restarts = all(container['restarts'] == 0 for pod in pods_after_rollout
                               for container in pod['containers'])
    readiness_stats = report['rollout']['probes']['readiness']
    report_stats = report['rollout']['probes']['report']

    report['checks'] = {
        'baselineStableAndHpaSettled': baseline['deployment']['readyReplicas'] == baseline['deployment']['replicas']
                                       and baseline['hpaSettled'],
        'demoDataReadableAfterResume': demo_case['actualHttp'] == 200 and bool(demo_snapshot['demo']),
        'uploadAccepted': upload_case['actualHttp'] == 201,
        'podDeleteReconciled': replacement_ready is not None and old_pod_gone is not None
                               and report['podDelete']['oldUidAbsent'],
        'dataUnchangedAfterPodDelete': data_after_delete,
        'fileUnchangedAfterPodDelete': file_after_delete,
        'rolloutCompleted': rollout_ok and deployment_after_rollout['generation'] > deployment_before_rollout['generation']
                            and deployment_after_rollout['observedGeneration'] == deployment_after_rollout['generation']
                            and deployment_after_rollout['readyReplicas'] == deployment_after_rollout['replicas'],
        'rolloutReplacedAllPods': report['rollout']['oldPodsAbsent'] and bool(report['rollout']['newUids'])
                                  and all(pod['ready'] for pod in pods_after_rollout),
        'serviceAvailableDuringRollout': readiness_stats['total'] > 0 and readiness_stats['failed'] == 0
                                         and report_stats['total'] > 0 and report_stats['failed'] == 0,
        'dataUnchangedAfterRollout': data_after_rollout,
        'fileUnchangedAfterRollout': file_after_rollout,
        'newPodsWithoutRestarts': new_pods_no_restarts,
        'pvcStillBound': pvc_snapshot()['phase'] == 'Bound'
    }
    if not report['checks']['serviceAvailableDuringRollout']:
        report['findings'].append({'id': 'rollout-availability-gap', 'owner': 'M3 platform',
                                   'detail': {'readiness': readiness_stats, 'report': report_stats},
                                   'action': 'Add graceful shutdown or a preStop drain and repeat the measured rollout.'})
    if not data_after_delete or not data_after_rollout:
        report['findings'].append({'id': 'persistence-data-mismatch', 'owner': 'M3 platform',
                                   'action': 'Inspect database state and the report read path after replacement.'})
    if not file_after_delete or not file_after_rollout:
        report['findings'].append({'id': 'persistence-file-mismatch', 'owner': 'M3 platform',
                                   'action': 'Inspect the shared PVC mount and file checksums after replacement.'})
    report['testExecutionCompleted'] = True
    report['status'] = 'passed' if all(report['checks'].values()) else 'needs_attention'
except Exception as error:
    report['status'] = 'failed'
    report['error'] = str(error)
finally:
    report['finishedAt'] = datetime.datetime.now().astimezone().isoformat()
    save('results.json', report)
    print(json.dumps({'status': report['status'], 'evidence': str(RUN.relative_to(ROOT)),
                      'testExecutionCompleted': report['testExecutionCompleted'],
                      'checks': report.get('checks'), 'podDelete': {key: report.get('podDelete', {}).get(key)
                      for key in ['target', 'replacementReadySeconds', 'oldPodGoneSeconds', 'databaseUnchanged']},
                      'rollout': {key: report.get('rollout', {}).get(key)
                                  for key in ['seconds', 'succeeded', 'oldPodsAbsent', 'databaseUnchanged']},
                      'probes': report.get('rollout', {}).get('probes'), 'findings': report['findings'],
                      'error': report.get('error')}, indent=2))

if report['status'] == 'failed':
    raise SystemExit(1)
if report['status'] == 'needs_attention':
    raise SystemExit(2)
