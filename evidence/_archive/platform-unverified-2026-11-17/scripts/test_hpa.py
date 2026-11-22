"""Observe actual HPA decisions under read-only report traffic in the local lab."""
import json
import subprocess
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "evidence/platform"
K = ["kubectl", "--context", "k3d-capstone", "-n", "default"]
LOAD = "journalfit-hpa-load"
transaction = json.loads((OUT / "application-transaction.json").read_text(encoding="utf-8-sig"))
artifact = json.loads((OUT / "rolling-update-image.json").read_text(encoding="utf-8-sig"))
timeline = []
summary = {"timestamp": datetime.now().astimezone().isoformat(),
           "method": "64 concurrent read-only report requests from a separate pod, CPU target 70%, replica limits 2-3",
           "limitation": "Local workload on one storage node; not a production capacity or multi-node HA result. Argo CD absent."}


def run(args, data=None, check=True):
    result = subprocess.run(K + args, input=data, capture_output=True, text=True)
    if check and result.returncode:
        raise RuntimeError("kubectl failed: " + " ".join(args[:4]) + " " + result.stderr)
    return result


def snapshot(phase):
    hpa = json.loads(run(["get", "hpa", "journalfit-backend", "-o", "json"]).stdout)
    dep = json.loads(run(["get", "deployment", "journalfit-backend", "-o", "json"]).stdout)
    sample = {"timestamp": datetime.now().astimezone().isoformat(), "phase": phase,
              "deployment_replicas": dep["spec"].get("replicas"),
              "ready_replicas": dep.get("status", {}).get("readyReplicas", 0),
              "hpa_status": hpa.get("status", {}),
              "pod_metrics": run(["top", "pods", "-l", "app=journalfit"], check=False).stdout}
    timeline.append(sample)
    with (OUT / "hpa-timeline.jsonl").open("a", encoding="utf-8") as file:
        file.write(json.dumps(sample) + "\n")
    cpu = sample["hpa_status"].get("currentMetrics", [])
    print(json.dumps({"phase": phase, "replicas": sample["deployment_replicas"],
                      "ready": sample["ready_replicas"], "metrics": cpu}), flush=True)
    return sample


load_script = r"""
const concurrency = 64;
let stopping = false, total = 0, ok = 0, failed = 0;
const start = Date.now();
function report(final=false) { console.log(JSON.stringify({timestamp:new Date().toISOString(), final, seconds:(Date.now()-start)/1000, concurrency, total, ok, failed})); }
function finish() { if(stopping)return; stopping=true; report(true); process.exit(0); }
process.on('SIGTERM',finish);
setTimeout(finish,180000);
setInterval(()=>report(),10000);
async function worker() {
  while(!stopping) {
    try {
      const r = await fetch(process.env.REPORT_URL,{headers:{'X-Tenant-ID':'tenant-a'},signal:AbortSignal.timeout(3000)});
      await r.arrayBuffer(); total++; if(r.status===200)ok++; else failed++;
    } catch(e) { total++; failed++; }
  }
}
for(let i=0;i<concurrency;i++)worker();
"""
pod = {"apiVersion": "v1", "kind": "Pod", "metadata": {"name": LOAD, "namespace": "default", "labels": {"app": "journalfit-load-generator"}},
       "spec": {"restartPolicy": "Never", "activeDeadlineSeconds": 210, "terminationGracePeriodSeconds": 5,
                "automountServiceAccountToken": False,
                "nodeSelector": {"kubernetes.io/hostname": "k3d-capstone-server-0"},
                "securityContext": {"runAsNonRoot": True, "runAsUser": 10001, "runAsGroup": 10001},
                "containers": [{"name": "load", "image": artifact["image"], "command": ["node", "-e", load_script],
                                "env": [{"name": "REPORT_URL", "value": "http://journalfit-backend.default.svc.cluster.local/api/manuscripts/" + transaction["manuscript_id"] + "/report"}],
                                "resources": {"requests": {"cpu": "100m", "memory": "64Mi"}, "limits": {"cpu": "500m", "memory": "256Mi"}}}]}}

if run(["get", "pod", LOAD], check=False).returncode == 0:
    raise RuntimeError("Existing load pod found; do not overwrite")
(OUT / "hpa-timeline.jsonl").write_text("", encoding="utf-8")
summary["baseline"] = snapshot("baseline")
if summary["baseline"]["deployment_replicas"] != 2:
    raise RuntimeError("Expected baseline of two replicas")
created = False
try:
    run(["apply", "-f", "-"], json.dumps(pod))
    created = True
    run(["wait", "--for=condition=Ready", "pod/" + LOAD, "--timeout=60s"])
    started = time.monotonic()
    while time.monotonic() - started < 180:
        current = snapshot("load")
        if current["deployment_replicas"] >= 3 and current["ready_replicas"] >= 3 and time.monotonic() - started >= 60:
            summary["scale_up_seconds"] = round(time.monotonic() - started, 2)
            break
        time.sleep(10)
finally:
    if created:
        state = json.loads(run(["get", "pod", LOAD, "-o", "json"]).stdout)
        if state["status"].get("phase") == "Running":
            run(["exec", LOAD, "--", "node", "-e", "process.kill(1,'SIGTERM')"], check=False)
        run(["wait", "--for=jsonpath={.status.phase}=Succeeded", "pod/" + LOAD, "--timeout=20s"], check=False)
        logs = run(["logs", LOAD], check=False)
        (OUT / "hpa-load-generator.txt").write_text(logs.stdout + logs.stderr, encoding="utf-8")
        summary["load_samples"] = [json.loads(line) for line in logs.stdout.splitlines() if line.startswith("{")]
    cooldown = time.monotonic()
    while time.monotonic() - cooldown < 180:
        current = snapshot("cooldown")
        if current["deployment_replicas"] == 2 and current["ready_replicas"] == 2:
            summary["scale_down_seconds_after_load_stop"] = round(time.monotonic() - cooldown, 2)
            break
        time.sleep(10)
    summary["observed_scale_up"] = any(s["phase"] == "load" and s["deployment_replicas"] == 3 and s["ready_replicas"] >= 3 for s in timeline)
    summary["observed_scale_down"] = summary["observed_scale_up"] and timeline[-1]["deployment_replicas"] == 2 and timeline[-1]["ready_replicas"] == 2
    summary["hpa_events"] = run(["describe", "hpa", "journalfit-backend"], check=False).stdout
    summary["final_pods"] = run(["get", "pods", "-l", "app=journalfit", "-o", "wide"], check=False).stdout
    (OUT / "hpa-result.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"scale_up": summary["observed_scale_up"], "scale_down": summary["observed_scale_down"]}), flush=True)
    if created:
        run(["delete", "pod", LOAD, "--wait=false"], check=False)

if not (summary["observed_scale_up"] and summary["observed_scale_down"]):
    raise RuntimeError("Full scale-up/down not demonstrated; inspect evidence, do not mark success")
