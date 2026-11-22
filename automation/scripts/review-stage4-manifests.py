"""Review desired/live Kubernetes configuration without applying or restarting it."""
import datetime
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import urllib.request
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
PARENT = ROOT / 'evidence/platform/tahap-4'
if not PARENT.is_dir():
    raise SystemExit('Evidence parent does not exist')
RUN = PARENT / ('run-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8])
RUN.mkdir()
CONTEXT = 'k3d-capstone'
report = {'startedAt': datetime.datetime.now().astimezone().isoformat(), 'status': 'running'}


def command(*arguments, env=None, optional=False, stdin=None, timeout=45):
    completed = subprocess.run(arguments, cwd=ROOT, env=env, input=stdin, text=True,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    result = {'exitCode': completed.returncode, 'stdout': completed.stdout.strip(),
              'stderr': completed.stderr.strip()}
    if completed.returncode and not optional:
        raise RuntimeError(arguments[0] + ' failed: ' + result['stderr'])
    return result


def kube(*arguments, **kwargs):
    return command('kubectl', '--context', CONTEXT, '--request-timeout=15s', *arguments, **kwargs)


def kube_json(*arguments):
    return json.loads(kube(*arguments, '-o', 'json')['stdout'])


def json_stream(text):
    decoder = json.JSONDecoder()
    objects = []
    while text.strip():
        text = text.lstrip()
        value, end = decoder.raw_decode(text)
        objects.extend(value['items'] if value.get('kind') == 'List' else [value])
        text = text[end:]
    return {value['kind']: value for value in objects}


def save(name, value):
    (RUN / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def cpu(value):
    return float(value[:-1]) if value.endswith('m') else float(value) * 1000


def memory(value):
    for suffix, factor in [('Gi', 1024**3), ('Mi', 1024**2), ('Ki', 1024), ('G', 10**9), ('M', 10**6), ('K', 1000)]:
        if value.endswith(suffix):
            return float(value[:-len(suffix)]) * factor
    return float(value)


try:
    paths = sorted((ROOT / 'deployment').glob('*.yaml'))
    report['source'] = {'head': command('git', 'rev-parse', 'HEAD')['stdout'],
                         'scriptSha256': hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),
                         'manifestSha256': {str(p.relative_to(ROOT)).replace('\\', '/'): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}
    rendered = kube('kustomize', './deployment')['stdout']
    client = kube('create', '--dry-run=client', '-k', './deployment', '-o', 'json')
    desired = json_stream(client['stdout'])
    expected_kinds = {'ConfigMap', 'Deployment', 'Service', 'Ingress', 'PersistentVolumeClaim', 'HorizontalPodAutoscaler'}
    if set(desired) != expected_kinds:
        raise RuntimeError('Unexpected rendered resource kinds; review before storing artifacts')
    allowed_config = {'PORT', 'NODE_ENV', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME'}
    if set(desired['ConfigMap']['data']) != allowed_config:
        raise RuntimeError('ConfigMap keys differ from the reviewed non-secret contract')
    container = desired['Deployment']['spec']['template']['spec']['containers'][0]
    password = next(item for item in container['env'] if item['name'] == 'DB_PASSWORD')
    if 'value' in password or 'secretKeyRef' not in password.get('valueFrom', {}):
        raise RuntimeError('DB_PASSWORD must use an external Secret reference')
    (RUN / 'rendered.yaml').write_text(rendered + '\n', encoding='utf-8')
    save('desired-client.json', desired)

    dry = kube('apply', '--dry-run=server', '-k', './deployment', '-o', 'json')
    normalized = json_stream(dry['stdout'])
    save('server-dry-run.json', normalized)
    report['serverDryRun'] = {'exitCode': dry['exitCode'], 'resourceCount': len(normalized)}

    # kubectl's default diff needs a native diff executable on Windows.
    child_env = os.environ.copy()
    child_env.pop('KUBECTL_EXTERNAL_DIFF', None)
    diff_executable = shutil.which('diff')
    if not diff_executable and os.name == 'nt':
        git_executable = shutil.which('git')
        candidate = pathlib.Path(git_executable).parents[1] / 'usr/bin/diff.exe' if git_executable else None
        if candidate and candidate.is_file():
            diff_executable = str(candidate)
    if not diff_executable:
        raise RuntimeError('Native diff is unavailable; install/provide it before checking drift')
    child_env['PATH'] = str(pathlib.Path(diff_executable).parent) + os.pathsep + child_env.get('PATH', '')
    diff = kube('diff', '-k', './deployment', env=child_env, optional=True)
    report['diff'] = {**diff, 'executable': diff_executable, 'scope': 'child process PATH only'}
    (RUN / 'kubectl-diff.txt').write_text(diff['stdout'] + '\n' + diff['stderr'] + '\n', encoding='utf-8')
    if diff['exitCode'] > 1:
        raise RuntimeError('kubectl diff failed; exit code is not configuration drift')

    live = {}
    for kind, resource in [('Deployment', 'deployment'), ('Service', 'service'), ('Ingress', 'ingress'),
                           ('PersistentVolumeClaim', 'pvc'), ('HorizontalPodAutoscaler', 'hpa'), ('ConfigMap', 'configmap')]:
        name = desired[kind]['metadata']['name']
        namespace = desired[kind]['metadata']['namespace']
        live[kind] = kube_json('-n', namespace, 'get', resource, name)
    save('live-resources.json', live)
    pod_spec = desired['Deployment']['spec']['template']['spec']
    namespace = desired['Deployment']['metadata']['namespace']
    secret_ref = password['valueFrom']['secretKeyRef']
    secret = kube_json('-n', namespace, 'get', 'secret', secret_ref['name'])
    report['secretReference'] = {'name': secret['metadata']['name'], 'namespace': secret['metadata']['namespace'],
                                  'keys': sorted(secret.get('data', {}))}
    del secret

    pods = kube_json('-n', namespace, 'get', 'pods', '-l', 'app=journalfit')['items']
    save('pods.json', pods)
    ready = [p for p in pods if not p['metadata'].get('deletionTimestamp') and
             any(c['type'] == 'Ready' and c['status'] == 'True' for c in p['status'].get('conditions', []))]
    if not ready:
        raise RuntimeError('No Ready application pod available for runtime checks')
    endpoint_slices = kube_json('-n', namespace, 'get', 'endpointslices', '-l', 'kubernetes.io/service-name=journalfit-backend')
    save('endpointslices.json', endpoint_slices)
    endpoints = [e for item in endpoint_slices['items'] for e in item.get('endpoints', []) if e.get('conditions', {}).get('ready')]
    report['readyEndpointPods'] = [e.get('targetRef', {}).get('name') for e in endpoints]

    pvc = live['PersistentVolumeClaim']
    pv = kube_json('get', 'pv', pvc['spec']['volumeName'])
    report['storage'] = {'pvcStatus': pvc['status']['phase'], 'pvName': pv['metadata']['name'],
                           'reclaimPolicy': pv['spec']['persistentVolumeReclaimPolicy'],
                           'local': pv['spec'].get('local'), 'hostPath': pv['spec'].get('hostPath'),
                           'nodeAffinity': pv['spec'].get('nodeAffinity')}
    node = kube_json('get', 'node', ready[0]['spec']['nodeName'])
    report['storageNode'] = {'name': node['metadata']['name'], 'labels': {'journalfit-storage': node['metadata']['labels'].get('journalfit-storage')}}
    service_port = desired['Service']['spec']['ports'][0]
    service_url = 'http://' + desired['Service']['metadata']['name'] + '.' + namespace + '.svc.cluster.local:' + str(service_port['port']) + container['readinessProbe']['httpGet']['path']
    runtime_script = """
import fs from 'node:fs';
const dir=fs.statSync('/app/uploads');
let writable=true; try {fs.accessSync('/app/uploads',fs.constants.W_OK);} catch {writable=false;}
const response=await fetch(process.argv[2],{signal:AbortSignal.timeout(5000)});
console.log(JSON.stringify({uid:process.getuid(),gid:process.getgid(),groups:process.getgroups(),
 cwd:process.cwd(),port:process.env.PORT,
 environment:Object.fromEntries(['PORT','NODE_ENV','DB_HOST','DB_PORT','DB_USER','DB_NAME'].map(k=>[k,process.env[k]])),
 uploads:{uid:dir.uid,gid:dir.gid,mode:(dir.mode&0o7777).toString(8),writable},
 serviceRequest:{url:process.argv[2],status:response.status,body:await response.json()}}));
"""
    report['runtimes'] = {}
    for pod in ready:
        runtime = command('kubectl', '--context', CONTEXT, '-n', namespace, 'exec', '-i', pod['metadata']['name'],
                          '--', 'node', '--input-type=module', '-', service_url, stdin=runtime_script)
        report['runtimes'][pod['metadata']['name']] = json.loads(runtime['stdout'])
    report['runtime'] = report['runtimes'][ready[0]['metadata']['name']]
    report['podRestarts'] = [{'pod': p['metadata']['name'], 'restarts': c['restartCount'], 'lastState': c.get('lastState', {})}
                              for p in ready for c in p['status']['containerStatuses']]

    host = desired['Ingress']['spec']['rules'][0]['host']
    report['ingressRequests'] = {}
    for path in sorted({container[k]['httpGet']['path'] for k in ['startupProbe', 'livenessProbe', 'readinessProbe']}):
        request = urllib.request.Request('http://127.0.0.1:8088' + path, headers={'Host': host})
        with urllib.request.urlopen(request, timeout=10) as response:
            report['ingressRequests'][path] = {'status': response.status, 'body': json.load(response)}
    api_service = kube_json('get', 'apiservice', 'v1beta1.metrics.k8s.io')
    report['metricsApiAvailable'] = any(c['type'] == 'Available' and c['status'] == 'True' for c in api_service['status']['conditions'])
    report['argoApplications'] = [x['metadata']['name'] for x in kube_json('-n', 'argocd', 'get', 'applications.argoproj.io')['items']]
    build = json.loads((ROOT / 'evidence/platform/tahap-2/build-metadata.json').read_text())
    digest = build['containerimage.digest']
    report['artifactDigest'] = digest
    source_labels = desired['Deployment']['spec']['template']['metadata']['labels']
    selector = desired['Deployment']['spec']['selector']['matchLabels']
    hpa = desired['HorizontalPodAutoscaler']['spec']
    hpa_conditions = {c['type']: c['status'] for c in live['HorizontalPodAutoscaler']['status'].get('conditions', [])}
    report['replicaOwnership'] = {'sourceHasReplicas': 'replicas' in desired['Deployment']['spec'],
                                   'liveReplicas': live['Deployment']['spec']['replicas'],
                                   'dryRunReplicas': normalized['Deployment']['spec'].get('replicas'),
                                   'hpaConditions': hpa_conditions}
    request_resources = container['resources']['requests']
    limits = container['resources']['limits']
    ingress_backend = desired['Ingress']['spec']['rules'][0]['http']['paths'][0]['backend']['service']
    report['checks'] = {
        'sixExpectedResources': set(desired) == expected_kinds,
        'serverDryRunAccepted': dry['exitCode'] == 0 and len(normalized) == 6,
        'noConfigurationDrift': diff['exitCode'] == 0,
        'consistentNamespaces': all(r['metadata']['namespace'] == namespace for r in desired.values()),
        'configMapMatchesContract': desired['ConfigMap']['data']['PORT'] == str(container['ports'][0]['containerPort']) == report['runtime']['port'],
        'configMapReference': container['envFrom'][0]['configMapRef']['name'] == desired['ConfigMap']['metadata']['name'],
        'runtimeEnvironmentMatchesConfigMap': all(r['environment'] == desired['ConfigMap']['data'] for r in report['runtimes'].values()),
        'externalSecretReference': secret_ref['key'] in report['secretReference']['keys'] and 'value' not in password,
        'deploymentLabelsMatch': all(source_labels.get(k) == v for k, v in selector.items()),
        'serviceSelectsWorkload': all(source_labels.get(k) == v for k, v in desired['Service']['spec']['selector'].items()),
        'serviceTargetsNamedPort': service_port['targetPort'] == container['ports'][0]['name'] and
                                  all(port['port'] == container['ports'][0]['containerPort'] for item in endpoint_slices['items'] for port in item.get('ports', [])),
        'readyEndpointsMatchPods': bool(endpoints) and set(report['readyEndpointPods']) == {p['metadata']['name'] for p in ready},
        'ingressTargetsService': ingress_backend['name'] == desired['Service']['metadata']['name'] and ingress_backend['port']['number'] == service_port['port'],
        'serviceHttpReady': report['runtime']['serviceRequest']['status'] == 200,
        'ingressHealthReady': all(r['status'] == 200 for r in report['ingressRequests'].values()),
        'nonRootIdentity': pod_spec['securityContext']['runAsNonRoot'] and report['runtime']['uid'] == pod_spec['securityContext']['runAsUser'] != 0 and report['runtime']['gid'] == pod_spec['securityContext']['runAsGroup'],
        'restrictedCapabilities': container['securityContext']['allowPrivilegeEscalation'] is False and 'ALL' in container['securityContext']['capabilities']['drop'],
        'serviceAccountTokenNotMounted': pod_spec['automountServiceAccountToken'] is False,
        'uploadMountAndPermissions': container['volumeMounts'][0]['mountPath'] == '/app/uploads' and report['runtime']['uploads']['writable'] and pod_spec['securityContext']['fsGroup'] in report['runtime']['groups'],
        'pvcReferenceAndBinding': pod_spec['volumes'][0]['persistentVolumeClaim']['claimName'] == desired['PersistentVolumeClaim']['metadata']['name'] and pvc['status']['phase'] == 'Bound',
        'singleStorageNodePlacement': len({p['spec']['nodeName'] for p in ready}) == 1 and node['metadata']['labels'].get('journalfit-storage') == pod_spec['nodeSelector']['journalfit-storage'],
        'positiveResourceBounds': 0 < cpu(request_resources['cpu']) <= cpu(limits['cpu']) and 0 < memory(request_resources['memory']) <= memory(limits['memory']),
        'rollingUpdateConfigured': desired['Deployment']['spec']['strategy']['type'] == 'RollingUpdate' and desired['Deployment']['spec']['strategy']['rollingUpdate'] == {'maxUnavailable': 0, 'maxSurge': 1},
        'hpaOwnsReplicas': 'replicas' not in desired['Deployment']['spec'] and hpa['scaleTargetRef']['name'] == desired['Deployment']['metadata']['name'],
        'hpaBoundsAndMetricsAvailable': 1 <= hpa['minReplicas'] <= hpa['maxReplicas'] and report['metricsApiAvailable'] and hpa_conditions.get('AbleToScale') == 'True' and hpa_conditions.get('ScalingActive') == 'True',
        'podArtifactMatchesBuild': all(digest in c['imageID'] for p in ready for c in p['status']['containerStatuses']),
    }
    report['status'] = 'passed' if all(report['checks'].values()) else 'needs_attention'
except Exception as error:
    report['status'] = 'failed'
    report['error'] = str(error)
finally:
    report['finishedAt'] = datetime.datetime.now().astimezone().isoformat()
    save('review.json', report)
    print(json.dumps({'status': report['status'], 'evidence': str(RUN.relative_to(ROOT)),
                      'checks': report.get('checks'), 'error': report.get('error')}, indent=2))

if report['status'] == 'failed':
    raise SystemExit(1)
if report['status'] == 'needs_attention':
    raise SystemExit(2)
