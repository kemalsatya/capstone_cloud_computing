"""Run a manual lab rollout with sampled HTTP traffic; no backend edits."""
import csv
import json
import math
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "evidence/platform"
CONTEXT = ["kubectl", "--context", "k3d-capstone"]
transaction = json.loads((OUT / "application-transaction.json").read_text(encoding="utf-8-sig"))
artifact = json.loads((OUT / "rolling-update-image.json").read_text(encoding="utf-8-sig"))
rows = []
stop = threading.Event()


def pod_inventory():
    result = subprocess.run(CONTEXT + ["-n", "default", "get", "pods", "-l", "app=journalfit", "-o", "json"], capture_output=True, text=True, check=True)
    return [{"name": p["metadata"]["name"], "uid": p["metadata"]["uid"],
             "image": p["spec"]["containers"][0]["image"],
             "image_id": p["status"].get("containerStatuses", [{}])[0].get("imageID")}
            for p in json.loads(result.stdout)["items"]]


def worker():
    paths = ["/health/ready", "/api/manuscripts/" + transaction["manuscript_id"] + "/report"]
    i = 0
    while not stop.is_set():
        path = paths[i % 2]
        i += 1
        started = time.perf_counter()
        status, error = 0, ""
        try:
            request = Request("http://127.0.0.1:8088" + path,
                              headers={"Host": "journalfit.localhost", "X-Tenant-ID": "tenant-a"})
            with urlopen(request, timeout=3) as response:
                status = response.status
                payload = json.load(response)
            if path.endswith("/report") and payload["data"]["manuscript"]["id"] != transaction["manuscript_id"]:
                error = "unexpected manuscript ID"
        except HTTPError as exc:
            status, error = exc.code, str(exc)
        except Exception as exc:
            error = str(exc)
        rows.append({"timestamp": datetime.now().astimezone().isoformat(), "path": path,
                     "status": status, "elapsed_ms": round((time.perf_counter() - started) * 1000, 2),
                     "error": error})
        stop.wait(0.1)


summary = {"timestamp": datetime.now().astimezone().isoformat(), "method": "3 HTTP workers, 100ms pause per worker, Ingress, readiness and real report endpoint",
           "old_pods": pod_inventory(), "replacement": artifact,
           "limitation": "Sampled requests in one local run; not proof of universal zero downtime. Image differs in build metadata, backend unchanged. No Argo CD active."}
threads = [threading.Thread(target=worker) for _ in range(3)]
started = time.perf_counter()
for thread in threads:
    thread.start()
try:
    time.sleep(3)
    manifest = ROOT / "deployment/deployment.yaml"
    text = manifest.read_text(encoding="utf-8")
    image_line = next(line for line in text.splitlines() if line.strip().startswith("image:"))
    manifest.write_text(text.replace(image_line, "          image: " + artifact["image"]), encoding="utf-8")
    kustomization = ROOT / "deployment/kustomization.yaml"
    text = kustomization.read_text(encoding="utf-8")
    tag_line = next(line for line in text.splitlines() if line.strip().startswith("newTag:"))
    kustomization.write_text(text.replace(tag_line, "    newTag: " + artifact["tag"]), encoding="utf-8")
    apply = subprocess.run(CONTEXT + ["apply", "-k", str(ROOT / "deployment")], capture_output=True, text=True)
    summary["apply"] = {"exit_code": apply.returncode, "stdout": apply.stdout, "stderr": apply.stderr}
    if apply.returncode:
        raise RuntimeError("apply failed")
    rollout_start = time.perf_counter()
    rollout = subprocess.run(CONTEXT + ["-n", "default", "rollout", "status", "deployment/journalfit-backend", "--timeout=150s"], capture_output=True, text=True)
    summary["rollout"] = {"exit_code": rollout.returncode, "seconds": round(time.perf_counter() - rollout_start, 2), "stdout": rollout.stdout, "stderr": rollout.stderr}
    time.sleep(5)
    summary["new_pods"] = pod_inventory()
    if rollout.returncode:
        raise RuntimeError("rollout failed")
finally:
    stop.set()
    for thread in threads:
        thread.join(timeout=5)
    summary["traffic_seconds"] = round(time.perf_counter() - started, 2)
    summary["requests"] = len(rows)
    summary["failed_requests"] = sum(r["status"] != 200 or bool(r["error"]) for r in rows)
    latency = sorted(r["elapsed_ms"] for r in rows)
    summary["latency_p95_ms"] = latency[max(0, math.ceil(len(latency) * .95) - 1)] if latency else None
    with (OUT / "rolling-update-requests.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=["timestamp", "path", "status", "elapsed_ms", "error"])
        writer.writeheader()
        writer.writerows(rows)
    (OUT / "rolling-update-result.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
