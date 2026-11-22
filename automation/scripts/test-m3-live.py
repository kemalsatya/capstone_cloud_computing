"""Capture an actual DOCX transaction and optional one-pod replacement on the lab."""
import argparse
import datetime
import hashlib
import json
import pathlib
import subprocess
import time
import urllib.request
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--docx', required=True)
parser.add_argument('--replace-one-pod', action='store_true')
args = parser.parse_args()
document = (ROOT / args.docx).resolve()
parent = ROOT / 'evidence/platform/m3-live-20261117'
if not document.is_file() or not parent.is_dir():
    raise SystemExit('Document or evidence parent does not exist')
run = parent / ('run-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
run.mkdir(exist_ok=False)
result = {'startedAt': datetime.datetime.now().astimezone().isoformat(), 'status': 'running'}


def kubectl(*arguments):
    command = ['kubectl', '--context', 'k3d-capstone', '--request-timeout=15s', '-n', 'default', *arguments]
    process = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if process.returncode:
        raise RuntimeError('kubectl failed: ' + process.stderr.strip())
    return process.stdout.strip()


def snapshot(name, *arguments):
    value = json.loads(kubectl(*arguments, '-o', 'json'))
    if name == 'nodes.json':
        value = {'items': [{'name': node['metadata']['name'],
                            'storageLabel': node['metadata'].get('labels', {}).get('journalfit-storage'),
                            'nodeInfo': node['status']['nodeInfo'],
                            'conditions': node['status']['conditions']}
                           for node in value['items']]}
    (run / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
    return value


def ready_pods():
    pods = json.loads(kubectl('get', 'pods', '-l', 'app=journalfit', '-o', 'json'))['items']
    return [pod for pod in pods if not pod['metadata'].get('deletionTimestamp') and
            any(c['type'] == 'Ready' and c['status'] == 'True' for c in pod['status'].get('conditions', []))]


def request(path, body=None, headers=None):
    supplied = {'Host': 'journalfit.localhost', 'X-Tenant-ID': 'tenant-m3-demo'}
    supplied.update(headers or {})
    req = urllib.request.Request('http://127.0.0.1:8088' + path, data=body, headers=supplied)
    with urllib.request.urlopen(req, timeout=30) as response:
        return {'httpStatus': response.status, 'body': json.load(response)}


try:
    result['live'] = request('/health/live')
    result['ready'] = request('/health/ready')
    result['root'] = request('/')
    deployment = snapshot('deployment.json', 'get', 'deployment', 'journalfit-backend')
    snapshot('nodes.json', 'get', 'nodes')
    snapshot('service.json', 'get', 'service', 'journalfit-backend')
    snapshot('ingress.json', 'get', 'ingress', 'journalfit-backend')
    snapshot('pvc.json', 'get', 'pvc', 'journalfit-uploads')
    snapshot('pods-before.json', 'get', 'pods', '-l', 'app=journalfit')
    expected_image = 'registry:5000/journalfit-backend:stage2-20261117t055120z-d9ab35a'
    assert deployment['spec']['template']['spec']['containers'][0]['image'] == expected_image
    pods = ready_pods()
    assert len(pods) >= 2, 'Need at least two Ready application pods'
    assert all(p['spec']['containers'][0]['image'] == expected_image for p in pods)
    pod_name = pods[0]['metadata']['name']
    result['runtime'] = {'image': expected_image, 'uid': kubectl('exec', pod_name, '--', 'id'),
                         'nodeVersion': kubectl('exec', pod_name, '--', 'node', '--version')}

    content = document.read_bytes()
    digest = hashlib.sha256(content).hexdigest()
    boundary = 'journalfit-' + uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="M3_Demo_JournalFit.docx"\r\n'
            'Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n').encode()
    body += content + f'\r\n--{boundary}--\r\n'.encode()
    result['fixture'] = {'path': args.docx, 'bytes': len(content), 'sha256': digest}
    result['upload'] = request('/api/manuscripts/upload', body, {'Content-Type': 'multipart/form-data; boundary=' + boundary})
    assert result['upload']['httpStatus'] == 201
    manuscript = result['upload']['body']['data']['manuscript']
    assert manuscript['file_path'].startswith('/uploads/')
    physical_path = '/app' + manuscript['file_path']
    result['manuscriptId'] = manuscript['id']
    result['tenantId'] = 'tenant-m3-demo'
    result['reportBefore'] = request('/api/manuscripts/' + manuscript['id'] + '/report')
    result['checksumBefore'] = kubectl('exec', pod_name, '--', 'sha256sum', physical_path).split()[0]
    assert result['checksumBefore'] == digest

    if args.replace_one_pod:
        old_uid = pods[0]['metadata']['uid']
        started = time.monotonic()
        kubectl('delete', 'pod', pod_name, '--wait=false')
        for _ in range(60):
            after = ready_pods()
            if len(after) >= 2 and all(p['metadata']['uid'] != old_uid for p in after):
                break
            time.sleep(2)
        else:
            raise RuntimeError('Application did not return to two Ready pods after replacement')
        result['replacement'] = {'deletedPod': pod_name, 'deletedUid': old_uid,
                                 'observedSeconds': round(time.monotonic() - started, 2),
                                 'readyPodsAfter': [p['metadata']['name'] for p in after]}
    else:
        after = ready_pods()

    result['checksumsAfter'] = {p['metadata']['name']: kubectl('exec', p['metadata']['name'], '--', 'sha256sum', physical_path).split()[0] for p in after}
    assert all(value == digest for value in result['checksumsAfter'].values())
    result['reportAfter'] = request('/api/manuscripts/' + manuscript['id'] + '/report')
    assert result['reportAfter']['httpStatus'] == 200
    assert result['reportAfter']['body']['data']['manuscript']['id'] == manuscript['id']
    snapshot('pods-after.json', 'get', 'pods', '-l', 'app=journalfit')
    result['status'] = 'passed'
except Exception as error:
    result['status'] = 'failed'
    result['error'] = str(error)
finally:
    result['finishedAt'] = datetime.datetime.now().astimezone().isoformat()
    (run / 'results.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': result['status'], 'evidence': str(run.relative_to(ROOT)),
                      'manuscriptId': result.get('manuscriptId')}, indent=2))

if result['status'] != 'passed':
    raise SystemExit(result.get('error', 'Live verification failed'))
