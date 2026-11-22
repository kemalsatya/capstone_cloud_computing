"""Read-only audit of the existing capstone environment; no service/bootstrap changes."""
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
PARENT = ROOT / 'evidence/platform/tahap-3'
if not PARENT.is_dir():
    raise SystemExit('Evidence parent does not exist')
RUN = PARENT / ('run-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8])
RUN.mkdir()
CONTEXT = 'k3d-capstone'
CORE = ['capstone-postgres', 'capstone-registry', 'capstone-gitea', 'capstone-keycloak']
OPTIONAL = ['capstone-gitea-runner', 'capstone-prometheus', 'capstone-grafana']
NODES = ['k3d-capstone-server-0', 'k3d-capstone-agent-0', 'k3d-capstone-serverlb']
report = {'startedAt': datetime.datetime.now().astimezone().isoformat(), 'status': 'running',
          'auditCompleted': False}


def command(*arguments, optional=False, stdin=None, timeout=30):
    process = subprocess.run(arguments, cwd=ROOT, input=stdin, text=True,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if process.returncode and not optional:
        raise RuntimeError('Command failed: ' + arguments[0] + ' ' + arguments[1] + ': ' + process.stderr.strip())
    return {'exitCode': process.returncode, 'stdout': process.stdout.strip(), 'stderr': process.stderr.strip()}


def kube(*arguments, optional=False):
    return command('kubectl', '--context', CONTEXT, '--request-timeout=10s', *arguments, optional=optional)


def kube_json(*arguments):
    return json.loads(kube(*arguments, '-o', 'json')['stdout'])


def http_json(url, headers=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=8) as response:
            raw = response.read()
            return {'httpStatus': response.status, 'body': json.loads(raw),
                    'digestHeader': response.headers.get('Docker-Content-Digest'),
                    'bodySha256': hashlib.sha256(raw).hexdigest()}
    except urllib.error.HTTPError as error:
        return {'httpStatus': error.code, 'error': str(error)}
    except (urllib.error.URLError, ValueError) as error:
        return {'httpStatus': None, 'error': str(error)}


def page_identity(url):
    # Only retain the page title; installation HTML can contain session/CSRF data.
    with urllib.request.urlopen(url, timeout=8) as response:
        body = response.read().decode('utf-8', errors='replace')
        title = re.search(r'<title>(.*?)</title>', body, re.S)
        return {'httpStatus': response.status, 'url': response.url,
                'title': title.group(1).strip() if title else None,
                'installationFormPresent': '/install' in body}


def save(name, value):
    (RUN / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


try:
    report['source'] = {
        'head': command('git', 'rev-parse', 'HEAD')['stdout'],
        'branch': command('git', 'branch', '--show-current')['stdout'],
        'auditScriptSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
        'schemaSha256': hashlib.sha256((ROOT / 'source/schema.sql').read_bytes()).hexdigest(),
    }
    package_path = ROOT / 'reference-docs/Cloud_Computing_Common_Capstone_Infrastructure_Package.zip'
    prefix = 'Cloud_Computing_Common_Capstone_Infrastructure_Package/'
    with zipfile.ZipFile(package_path) as package:
        matrix = package.read(prefix + 'VERSION_MATRIX.md').decode('utf-8-sig')
        registry_reference = package.read(prefix + 'infrastructure/k3d/registries.yaml').decode('utf-8-sig')
        monitoring_reference = package.read(prefix + 'infrastructure/prometheus/prometheus.yml').decode('utf-8-sig')
    report['reference'] = {'package': str(package_path.relative_to(ROOT)),
                           'sha256': hashlib.sha256(package_path.read_bytes()).hexdigest(),
                           'versionMatrix': matrix, 'registryConfiguration': registry_reference,
                           'metricsConfiguration': monitoring_reference}

    report['tools'] = {
        'docker': json.loads(command('docker', 'version', '--format', '{{json .}}')['stdout']),
        'compose': command('docker', 'compose', 'version', '--short')['stdout'],
        'git': command('git', '--version')['stdout'],
        'k3d': command('k3d', 'version')['stdout'],
        'kubernetes': json.loads(kube('version', '-o', 'json')['stdout']),
    }
    containers = {}
    for name in CORE + OPTIONAL + NODES:
        inspected = command('docker', 'inspect', name, optional=True)
        if inspected['exitCode']:
            containers[name] = {'exists': False}
            continue
        value = json.loads(inspected['stdout'])[0]
        # Do not serialize Docker Config.Env, which can contain credentials.
        containers[name] = {'exists': True, 'running': value['State']['Running'],
                            'health': value['State'].get('Health', {}).get('Status'),
                            'image': value['Config']['Image'], 'imageId': value['Image'],
                            'startedAt': value['State']['StartedAt'],
                            'ports': value['NetworkSettings']['Ports'],
                            'networks': {key: {'ip': item['IPAddress'], 'aliases': item.get('Aliases')}
                                         for key, item in value['NetworkSettings']['Networks'].items()},
                            'volumes': [{'type': item['Type'], 'name': item.get('Name'),
                                         'destination': item['Destination']} for item in value['Mounts']]}
    report['services'] = containers
    report['serviceEndpoints'] = {
        'gitea': http_json('http://127.0.0.1:3001/api/v1/version'),
        'keycloakDiscovery': http_json('http://127.0.0.1:8081/realms/capstone/.well-known/openid-configuration'),
        'registry': http_json('http://127.0.0.1:5001/v2/'),
        'application': http_json('http://127.0.0.1:8088/health/ready', {'Host': 'journalfit.localhost'}),
    }
    report['serviceVersions'] = {
        'gitea': command('docker', 'exec', '--user', 'git', 'capstone-gitea', 'gitea', '--version')['stdout'],
        'registry': command('docker', 'exec', 'capstone-registry', '/bin/registry', '--version')['stdout'],
        'keycloak': command('docker', 'exec', 'capstone-keycloak', '/opt/keycloak/bin/kc.sh', '--version')['stdout'],
    }
    report['optionalScannerImage'] = command('docker', 'image', 'inspect', 'aquasec/trivy:0.76.0',
                                            '--format', '{{.Id}}', optional=True)
    if report['optionalScannerImage']['exitCode'] == 0:
        report['serviceVersions']['trivy'] = command('docker', 'run', '--rm', '--network', 'none',
                                                     'aquasec/trivy:0.76.0', '--version')['stdout']
    report['giteaWeb'] = page_identity('http://127.0.0.1:3001/')
    report['applicationMetricsRoutes'] = {
        path: http_json('http://127.0.0.1:8088' + path, {'Host': 'journalfit.localhost'})
        for path in ['/metrics', '/q/metrics']}

    docker_network = json.loads(command('docker', 'network', 'inspect', 'capstone-net')['stdout'])[0]
    report['dockerNetwork'] = {'name': docker_network['Name'], 'driver': docker_network['Driver'],
                               'ipam': docker_network['IPAM']['Config'],
                               'containers': [{'name': item['Name'], 'ipv4': item['IPv4Address']}
                                              for item in docker_network['Containers'].values()]}
    report['k3dClusters'] = command('k3d', 'cluster', 'list')['stdout']

    nodes = kube_json('get', 'nodes')['items']
    report['nodes'] = [{'name': item['metadata']['name'],
                        'storageLabel': item['metadata'].get('labels', {}).get('journalfit-storage'),
                        'ready': any(c['type'] == 'Ready' and c['status'] == 'True' for c in item['status']['conditions']),
                        'nodeInfo': item['status']['nodeInfo'], 'addresses': item['status']['addresses'],
                        'capacity': item['status']['capacity'], 'allocatable': item['status']['allocatable']}
                       for item in nodes]
    pods = kube_json('get', 'pods', '-A')['items']
    report['pods'] = [{'name': item['metadata']['name'], 'namespace': item['metadata']['namespace'],
                       'phase': item['status']['phase'], 'node': item['spec'].get('nodeName'),
                       'deleting': bool(item['metadata'].get('deletionTimestamp')),
                       'ready': any(c['type'] == 'Ready' and c['status'] == 'True' for c in item['status'].get('conditions', [])),
                       'containers': [{'image': c['image'], 'imageID': c.get('imageID'),
                                       'restarts': c['restartCount']} for c in item['status'].get('containerStatuses', [])]}
                      for item in pods]
    application_pods = [p for p in report['pods'] if p['namespace'] == 'default' and
                        p['name'].startswith('journalfit-backend-') and p['ready'] and not p['deleting']]
    if not application_pods:
        raise RuntimeError('No Ready application pod available for database/network inspection')
    pod = application_pods[0]['name']
    report['deployment'] = kube_json('-n', 'default', 'get', 'deployment', 'journalfit-backend')
    config = kube_json('-n', 'default', 'get', 'configmap', 'journalfit-backend-config')['data']
    report['configMap'] = {key: config.get(key) for key in
                            ['PORT', 'NODE_ENV', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER']}
    secret = kube_json('-n', 'default', 'get', 'secret', 'journalfit-backend-secret')
    report['secretReference'] = {'name': secret['metadata']['name'], 'type': secret['type'],
                                  'keys': sorted(secret.get('data', {}))}
    del secret  # Never save Secret data or decoded values.
    report['service'] = kube_json('-n', 'default', 'get', 'service', 'journalfit-backend')
    report['ingress'] = kube_json('-n', 'default', 'get', 'ingress', 'journalfit-backend')
    report['pvc'] = kube_json('-n', 'default', 'get', 'pvc', 'journalfit-uploads')
    pv = kube_json('get', 'pv', report['pvc']['spec']['volumeName'])
    report['pv'] = {'name': pv['metadata']['name'], 'capacity': pv['spec']['capacity'],
                     'reclaimPolicy': pv['spec']['persistentVolumeReclaimPolicy'],
                     'nodeAffinity': pv['spec'].get('nodeAffinity'), 'hostPath': pv['spec'].get('hostPath')}
    report['storageClasses'] = [{'name': c['metadata']['name'], 'provisioner': c['provisioner']}
                               for c in kube_json('get', 'storageclasses')['items']]
    report['ingressClasses'] = [c['metadata']['name'] for c in kube_json('get', 'ingressclasses')['items']]
    argocd = kube_json('-n', 'argocd', 'get', 'deployments')['items']
    report['argocd'] = [{'name': d['metadata']['name'], 'ready': d['status'].get('readyReplicas', 0),
                         'images': [c['image'] for c in d['spec']['template']['spec']['containers']]}
                        for d in argocd]
    report['argocdStatefulsets'] = [{'name': d['metadata']['name'], 'ready': d['status'].get('readyReplicas', 0),
                                    'images': [c['image'] for c in d['spec']['template']['spec']['containers']]}
                                   for d in kube_json('-n', 'argocd', 'get', 'statefulsets')['items']]
    report['argoApplications'] = [a['metadata']['name'] for a in
                                   kube_json('-n', 'argocd', 'get', 'applications.argoproj.io')['items']]
    report['metrics'] = {'nodes': kube('top', 'nodes', optional=True),
                         'applicationPods': kube('-n', 'default', 'top', 'pods', '-l', 'app=journalfit', optional=True)}

    schema = (ROOT / 'source/schema.sql').read_text(encoding='utf-8')
    expected = {}
    for table, body in re.findall(r'CREATE TABLE IF NOT EXISTS (\w+)\s*\((.*?)\);', schema, re.S):
        expected[table] = [line.strip().split()[0] for line in body.splitlines() if line.strip() and
                           line.strip().split()[0].upper() not in {'PRIMARY', 'FOREIGN', 'UNIQUE', 'CHECK', 'CONSTRAINT'}]
    if len(expected) != 6:
        raise RuntimeError('Source schema parser expected six application tables')
    database_script = """
import dns from 'node:dns/promises';
import pg from 'pg';
const client = new pg.Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),
 user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,
 connectionTimeoutMillis:5000,statement_timeout:10000});
const tables = TABLES;
try {
 const addresses=await dns.lookup(process.env.DB_HOST,{all:true});
 await client.connect();
 await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const identity=(await client.query("SELECT current_database() AS database, current_user AS role, current_schema() AS schema, current_setting('server_version') AS version, current_setting('search_path') AS search_path")).rows[0];
 const role=(await client.query('SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
 const columns=(await client.query("SELECT table_name,column_name,data_type,character_maximum_length,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[]) ORDER BY table_name,ordinal_position",[tables])).rows;
 const constraints=(await client.query("SELECT t.relname AS table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname=ANY($1::text[]) ORDER BY t.relname,c.conname",[tables])).rows;
 const counts={};
 for (const table of tables) {counts[table]=Number((await client.query('SELECT count(*) AS count FROM public."'+table+'"')).rows[0].count);}
 await client.query('ROLLBACK');
 console.log(JSON.stringify({pod:process.env.HOSTNAME,nodeVersion:process.version,dbHost:process.env.DB_HOST,dbPort:process.env.DB_PORT,dns:addresses,identity,role,columns,constraints,rowCounts:counts}));
} catch(error) {console.error(error.message);process.exitCode=1;} finally {await client.end();}
""".replace('TABLES', json.dumps(list(expected)))
    database = command('kubectl', '--context', CONTEXT, '-n', 'default', 'exec', '-i', pod,
                       '--', 'node', '--input-type=module', '-', stdin=database_script, timeout=30)
    report['database'] = json.loads(database['stdout'])
    actual = {}
    for column in report['database']['columns']:
        actual.setdefault(column['table_name'], []).append(column['column_name'])
    report['schemaCompatibility'] = {
        'expectedColumns': expected,
        'missingTables': sorted(set(expected) - set(actual)),
        'missingColumns': {table: sorted(set(columns) - set(actual.get(table, [])))
                           for table, columns in expected.items() if set(columns) - set(actual.get(table, []))},
    }

    image = report['deployment']['spec']['template']['spec']['containers'][0]['image']
    repository, tag = image.removeprefix('registry:5000/').rsplit(':', 1)
    manifest = http_json('http://127.0.0.1:5001/v2/' + repository + '/manifests/' + tag,
                         {'Accept': 'application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json'})
    metadata = json.loads((ROOT / 'evidence/platform/tahap-2/build-metadata.json').read_text())
    report['registryArtifact'] = {'pushReference': 'localhost:5001/' + repository + ':' + tag,
                                   'pullReference': image, 'manifest': manifest,
                                   'buildDigest': metadata['containerimage.digest'],
                                   'podImageIds': [c['imageID'] for p in application_pods for c in p['containers']]}
    registries = command('docker', 'exec', 'k3d-capstone-agent-0', 'cat', '/etc/rancher/k3s/registries.yaml')['stdout']
    report['nodeRegistryConfiguration'] = {'registryMirrorPresent': 'registry:5000' in registries,
                                           'httpEndpointPresent': 'http://registry:5000' in registries}
    available = command('docker', 'exec', 'k3d-capstone-agent-0', 'sh', '-c', 'command -v wget', optional=True)
    if available['exitCode'] == 0:
        probe = command('docker', 'exec', 'k3d-capstone-agent-0', 'wget', '-q', '-T', '5', '-O', '-', 'http://registry:5000/v2/')
        method = 'wget inside existing agent node'
    else:
        probe = command('docker', 'run', '--rm', '--network', 'container:k3d-capstone-agent-0', '--entrypoint', 'wget',
                        'docker:29-cli@sha256:34507eb5069d8be82c95dd3b6987d4250fd5fee49b82e2509b7d7a7030740d6d',
                        '-q', '-T', '5', '-O', '-', 'http://registry:5000/v2/')
        method = 'temporary CLI container sharing the agent network namespace'
    report['nodeToRegistry'] = {'method': method, 'exitCode': probe['exitCode'], 'body': json.loads(probe['stdout'])}

    versions = report['tools']['kubernetes']
    client_minor = int(re.match(r'\d+', versions['clientVersion']['minor']).group())
    server_minor = int(re.match(r'\d+', versions['serverVersion']['minor']).group())
    digest = manifest.get('digestHeader')
    report['checks'] = {
        'm3ContainersRunning': all(containers[name].get('running') for name in ['capstone-postgres', 'capstone-registry', *NODES]),
        'coreContainersRunning': all(containers[name].get('running') for name in CORE),
        'postgresHealthy': containers['capstone-postgres'].get('health') == 'healthy',
        'coreHttpEndpoints': all(value.get('httpStatus') == 200 for value in report['serviceEndpoints'].values()),
        'applicationHttp': report['serviceEndpoints']['application'].get('httpStatus') == 200,
        'registryHttp': report['serviceEndpoints']['registry'].get('httpStatus') == 200,
        'schemaTablesAndColumns': not report['schemaCompatibility']['missingTables'] and not report['schemaCompatibility']['missingColumns'],
        'registryContentDigest': bool(digest and digest == 'sha256:' + manifest.get('bodySha256', '')),
        'registryMatchesBuild': digest == metadata['containerimage.digest'],
        'podsMatchRegistry': bool(digest and all(digest in c['imageID'] for p in application_pods for c in p['containers'])),
        'nodeRegistryRoute': probe['exitCode'] == 0,
        'twoNodesReady': len(report['nodes']) == 2 and all(node['ready'] for node in report['nodes']),
        'applicationReady': len(application_pods) >= 2,
        'pvcBound': report['pvc']['status']['phase'] == 'Bound',
        'storageAndIngressClasses': 'local-path' in [c['name'] for c in report['storageClasses']] and 'traefik' in report['ingressClasses'],
        'runtimeSecretKeyPresent': 'DB_PASSWORD' in report['secretReference']['keys'],
        'kubectlVersionSkew': versions['clientVersion']['major'] == versions['serverVersion']['major'] and abs(client_minor-server_minor) <= 1,
    }
    required = ['m3ContainersRunning', 'postgresHealthy', 'applicationHttp', 'registryHttp',
                'schemaTablesAndColumns', 'registryContentDigest', 'registryMatchesBuild',
                'podsMatchRegistry', 'nodeRegistryRoute', 'twoNodesReady', 'applicationReady',
                'pvcBound', 'storageAndIngressClasses', 'runtimeSecretKeyPresent', 'kubectlVersionSkew']
    report['readyForManifestReview'] = all(report['checks'][key] for key in required)
    report['findings'] = []
    if report['serviceEndpoints']['gitea'].get('httpStatus') != 200:
        report['findings'].append({'id': 'gitea-api-not-ready', 'milestone': 'M4 delivery',
                                   'observation': report['giteaWeb'],
                                   'action': 'Complete/review Gitea installation before bootstrapping users and runner.'})
    if report['database']['role']['rolsuper']:
        report['findings'].append({'id': 'lab-db-role-privileged', 'milestone': 'M6 security',
                                   'action': 'Review a least-privilege application role; current lab role is superuser.'})
    if all(value.get('httpStatus') == 404 for value in report['applicationMetricsRoutes'].values()):
        report['findings'].append({'id': 'application-metrics-not-instrumented', 'milestone': 'M5 operations',
                                   'action': 'Instrument the Express application and adapt the reference scrape path/routing.'})
    report['auditCompleted'] = True
    report['status'] = 'passed' if all(report['checks'].values()) else 'needs_attention'
except Exception as error:
    report['status'] = 'failed'
    report['error'] = str(error)
finally:
    report['finishedAt'] = datetime.datetime.now().astimezone().isoformat()
    save('audit.json', report)
    print(json.dumps({'status': report['status'], 'evidence': str(RUN.relative_to(ROOT)),
                      'auditCompleted': report['auditCompleted'],
                      'readyForManifestReview': report.get('readyForManifestReview'),
                      'checks': report.get('checks'), 'error': report.get('error')}, indent=2))

if report['status'] == 'failed':
    raise SystemExit('Stage 3 audit requires review; see the saved report')
if report['status'] == 'needs_attention':
    raise SystemExit(2)
