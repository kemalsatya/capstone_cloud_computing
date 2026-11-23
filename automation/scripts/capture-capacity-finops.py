#!/usr/bin/env python3
"""Capture read-only Modul 09 evidence. Python 3.10+, kubectl, Docker, Git.

No secrets, tokens, full ConfigMaps, or container environments are recorded.
Existing captures are never overwritten; use --output-dir for a new run.
"""

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shlex
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parents[2]


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def container_spec(container):
    return {key: container.get(key) for key in
            ("name", "image", "resources", "securityContext")}


def project_nodes(data):
    return [{"name": n["metadata"]["name"],
             "storage_label": n["metadata"].get("labels", {}).get("journalfit-storage"),
             "capacity": n["status"]["capacity"],
             "allocatable": n["status"]["allocatable"],
             "conditions": n["status"].get("conditions", [])}
            for n in data["items"]]


def project_pods(data):
    return [{"namespace": p["metadata"]["namespace"], "name": p["metadata"]["name"],
             "node": p["spec"].get("nodeName"), "phase": p["status"].get("phase"),
             "qos": p["status"].get("qosClass"),
             "pod_security_context": p["spec"].get("securityContext", {}),
             "containers": [container_spec(c) for c in p["spec"]["containers"]],
             "init_containers": [container_spec(c) for c in p["spec"].get("initContainers", [])],
             "container_statuses": [{k: c.get(k) for k in
                                     ("name", "ready", "restartCount", "imageID", "state")}
                                    for c in p["status"].get("containerStatuses", [])]}
            for p in data["items"]]


def project_deployments(data):
    result = []
    for d in data["items"]:
        spec = d["spec"]["template"]["spec"]
        result.append({"name": d["metadata"]["name"], "replicas": d["spec"].get("replicas", 1),
                       "ready_replicas": d["status"].get("readyReplicas", 0),
                       "strategy": d["spec"].get("strategy"),
                       "node_selector": spec.get("nodeSelector", {}),
                       "containers": [container_spec(c) for c in spec["containers"]]})
    return result


class Capture:
    def __init__(self, directory, metadata):
        self.data = {"metadata": metadata, "commands": [], "inventory": {}, "samples": []}
        self.directory = directory
        self.log = (directory / "live-metrics.txt").open("x", encoding="utf-8", newline="\n")
        self.log.write("JOURNALFIT / MODUL 09 / LIVE CAPACITY EVIDENCE\n")
        self.log.write(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n")
        self.failures = []

    def run(self, label, args, project=None):
        started = now()
        try:
            process = subprocess.run(args, cwd=ROOT, capture_output=True, text=True,
                                     encoding="utf-8", errors="replace", timeout=45)
            code, output, error = process.returncode, process.stdout, process.stderr
        except (OSError, subprocess.TimeoutExpired) as exc:
            code, output, error = 124, "", str(exc)
        if project is not None and code == 0:
            output = json.dumps(project(json.loads(output)), indent=2, ensure_ascii=False) + "\n"
        record = {"label": label, "timestamp": started, "command": shlex.join(args),
                  "exit_code": code, "stdout": output, "stderr": error,
                  "projection": "resource/image/status fields only; env/annotations omitted" if project else None}
        self.data["commands"].append(record)
        self.log.write(f"\n=== {label} | {started} ===\n$ {record['command']}\n")
        if project:
            self.log.write(f"Projection: {record['projection']}\n")
        self.log.write(output)
        if error:
            self.log.write("\n[stderr]\n" + error)
        self.log.write(f"\n[exit_code={code}]\n")
        self.log.flush()
        if code:
            self.failures.append(label)
        return output

    def finish(self):
        self.data["metadata"]["finished_at"] = now()
        self.data["metadata"]["failed_commands"] = self.failures
        self.log.write(f"\nFINISHED {now()} | failed_commands={self.failures}\n")
        self.log.close()
        (self.directory / "capture.json").write_text(
            json.dumps(self.data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def http_probe(url, host=None, data=None, token=None):
    headers = {}
    if host:
        headers["Host"] = host
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(url, data=data, headers=headers)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(request, timeout=15) as response:
            return response.status, response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--context", default="k3d-capstone")
    parser.add_argument("--owner", required=True)
    parser.add_argument("--samples", type=int, default=5)
    parser.add_argument("--interval", type=float, default=30)
    parser.add_argument("--postgres-container", default="capstone-postgres")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "evidence/capacity-finops")
    args = parser.parse_args()
    if args.samples < 2 or args.interval < 0 or not args.owner.strip():
        parser.error("Use at least two samples, a nonnegative interval, and an Owner.")
    directory = args.output_dir.resolve()
    if not directory.parent.is_dir():
        parser.error(f"Parent directory does not exist: {directory.parent}")
    if any((directory / name).exists() for name in ("live-metrics.txt", "capture.json")):
        parser.error("Capture already exists. Preserve it and choose a fresh --output-dir.")
    directory.mkdir(exist_ok=True)
    files = ["deployment/deployment.yaml", "deployment/worker-format.yaml",
             "deployment/keycloak/deployment.yaml", "deployment/hpa.yaml",
             "deployment/pvc.yaml", "deployment/kustomization.yaml", "source/Dockerfile",
             "docker-compose.yml", "evidence/observability/prometheus.yml",
             "automation/scripts/capture-capacity-finops.py"]
    capture = Capture(directory, {
        "started_at": now(), "owner": args.owner, "context": args.context,
        "load_condition": "Idle; health probes, pg-boss polling, Prometheus scrapes and platform background work. No load generator.",
        "sample_count": args.samples, "pause_between_samples_seconds": args.interval,
        "method_note": "kubectl top rounds CPU/memory. Samples are sequential, not simultaneous. /proc is the shared Docker Linux VM, not Windows host memory.",
        "file_sha256": {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in files},
    })
    k = ["kubectl", "--context", args.context, "--request-timeout=15s"]
    inventory = capture.data["inventory"]
    try:
        for label, command in (
            ("git_commit", ["git", "rev-parse", "HEAD"]),
            ("git_branch", ["git", "branch", "--show-current"]),
            ("git_status", ["git", "--no-optional-locks", "status", "--short"]),
            ("kubernetes_version", k + ["version", "-o", "json"]),
            ("docker_engine", ["docker", "info", "--format", "{{.NCPU}} {{.MemTotal}} {{.OperatingSystem}}"]),
            ("docker_containers", ["docker", "ps", "--format",
                                   '{"name":{{json .Names}},"image":{{json .Image}},"status":{{json .Status}},"ports":{{json .Ports}}}']),
            ("workload_status", k + ["get", "deployment,pods,pvc,hpa", "-n", "default", "-o", "wide"]),
            ("all_pods_status", k + ["get", "pods", "-A", "-o", "wide"]),
            ("argocd_applications", k + ["get", "applications", "-n", "argocd"]),
            ("database_sizes", ["docker", "exec", args.postgres_container, "psql", "-U", "capstone", "-d", "postgres", "-Atc",
                                "SELECT datname,pg_database_size(oid) FROM pg_database WHERE datname IN ('journalfit','keycloak') ORDER BY datname;"]),
            ("upload_filesystem", k + ["exec", "-n", "default", "deployment/journalfit-backend", "--", "df", "-Pk", "/app/uploads"]),
        ):
            inventory[label] = capture.run(label, command).strip()
        for label, command, project in (
            ("nodes", k + ["get", "nodes", "-o", "json"], project_nodes),
            ("pods", k + ["get", "pods", "-A", "-o", "json"], project_pods),
            ("deployments", k + ["get", "deployments", "-n", "default", "-o", "json"], project_deployments),
            ("hpa", k + ["get", "hpa", "journalfit-backend", "-n", "default", "-o", "json"],
             lambda d: {"spec": d["spec"], "status": d["status"]}),
            ("backend_config", k + ["get", "configmap", "journalfit-backend-config", "-n", "default", "-o", "json"],
             lambda d: {key: d["data"].get(key) for key in ("NODE_ENV", "AUTH_MODE", "DB_HOST", "KEYCLOAK_ISSUER", "KEYCLOAK_AUDIENCE")}),
        ):
            output = capture.run(label, command, project)
            inventory[label] = json.loads(output) if output else None
        image = next(d for d in inventory["deployments"] if d["name"] == "journalfit-backend")["containers"][0]["image"]
        local_image = image.replace("registry:5000/", "localhost:5001/")
        image_format = '{"id":{{json .Id}},"size_bytes":{{.Size}},"repo_digests":{{json .RepoDigests}},"labels":{{json .Config.Labels}}}'
        output = capture.run("backend_image", ["docker", "image", "inspect", local_image, "--format", image_format])
        inventory["backend_image"] = json.loads(output) if output else None
        inventory["docker_limits"] = []
        limit_format = '{"name":{{json .Name}},"memory_limit_bytes":{{.HostConfig.Memory}},"nano_cpus":{{.HostConfig.NanoCpus}}}'
        for line in inventory["docker_containers"].splitlines():
            name = json.loads(line)["name"]
            output = capture.run("docker_limits_" + name,
                                 ["docker", "inspect", name, "--format", limit_format])
            inventory["docker_limits"].append(json.loads(output) if output else None)
        probes = {}
        for label, url, host in (
            ("api_readiness", "http://127.0.0.1:8088/health/ready", "journalfit.localhost"),
            ("api_without_token", "http://127.0.0.1:8088/api/auth/me", "journalfit.localhost"),
            ("keycloak_discovery", "http://127.0.0.1:8088/realms/journalfit/.well-known/openid-configuration", "keycloak.localhost"),
            ("prometheus_ready", "http://127.0.0.1:9090/-/ready", None),
            ("grafana_health", "http://127.0.0.1:3000/api/health", None),
        ):
            status, body = http_probe(url, host)
            probes[label] = {"timestamp": now(), "url": url, "host": host, "http_status": status,
                             "body": {"issuer": json.loads(body).get("issuer")} if label == "keycloak_discovery" else body.strip()}
        realm = json.loads((ROOT / "deployment/keycloak/realm-journalfit.json").read_text(encoding="utf-8"))
        user = next(u for u in realm["users"] if u["username"] == "author.a")
        password = next(c["value"] for c in user["credentials"] if c["type"] == "password")
        form = urllib.parse.urlencode({"grant_type": "password", "client_id": "journalfit-app", "username": user["username"], "password": password, "scope": "openid"}).encode()
        status, body = http_probe("http://127.0.0.1:8088/realms/journalfit/protocol/openid-connect/token", "keycloak.localhost", form)
        token = json.loads(body).get("access_token") if status == 200 else None
        probes["demo_token_grant"] = {"http_status": status, "token_present": bool(token)}
        if token:
            status, body = http_probe("http://127.0.0.1:8088/api/auth/me", "journalfit.localhost", token=token)
            probes["api_valid_jwt"] = {"http_status": status, "body": json.loads(body)}
        status, body = http_probe("http://127.0.0.1:9090/api/v1/targets")
        probes["prometheus_targets"] = {"http_status": status, "data": json.loads(body)}
        capture.data["probes"] = probes
        capture.log.write("\n=== HTTP probes (credentials and tokens excluded) ===\n" + json.dumps(probes, indent=2) + "\n")
        expected = {"api_readiness": 200, "api_without_token": 401, "keycloak_discovery": 200,
                    "prometheus_ready": 200, "grafana_health": 200, "demo_token_grant": 200, "api_valid_jwt": 200}
        for label, status in expected.items():
            if probes.get(label, {}).get("http_status") != status:
                capture.failures.append(label)
        for index in range(args.samples):
            sample = {"index": index + 1, "timestamp": now()}
            for label, command in (
                ("top_nodes", k + ["top", "nodes"]),
                ("top_pods_default", k + ["top", "pods", "-n", "default"]),
                ("top_pods_all", k + ["top", "pods", "-A"]),
                ("hpa_description", k + ["describe", "hpa", "journalfit-backend", "-n", "default"]),
                ("docker_stats", ["docker", "stats", "--no-stream", "--format", "{{json .}}"]),
                ("vm_meminfo", ["docker", "exec", "k3d-capstone-server-0", "cat", "/proc/meminfo"]),
                ("vm_cpu_stat", ["docker", "exec", "k3d-capstone-server-0", "cat", "/proc/stat"]),
            ):
                sample[label] = capture.run(f"sample_{index + 1}_{label}", command)
            capture.data["samples"].append(sample)
            print(f"Recorded sample {index + 1}/{args.samples} at {sample['timestamp']}", flush=True)
            if index + 1 < args.samples:
                time.sleep(args.interval)
    except Exception as exc:
        capture.failures.append(f"capture_exception: {type(exc).__name__}: {exc}")
        print(f"Capture interrupted: {exc}", file=sys.stderr)
    finally:
        capture.finish()
    print(f"Evidence: {directory}")
    return 1 if capture.failures else 0


if __name__ == "__main__":
    sys.exit(main())
