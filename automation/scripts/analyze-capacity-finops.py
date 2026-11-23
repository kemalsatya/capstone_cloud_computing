#!/usr/bin/env python3
"""Derive Modul 09 calculations from capture.json and explicit FinOps assumptions.

--check compares committed analysis/tables with a fresh offline calculation.
No cluster commands or network access; standard library only.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import statistics
import sys


ROOT = Path(__file__).resolve().parents[2]


def cpu_m(value):
    value = str(value or "0")
    for suffix, factor in (("n", 0.000001), ("u", 0.001), ("m", 1)):
        if value.endswith(suffix):
            return float(value[:-1]) * factor
    return float(value) * 1000


def memory_mib(value):
    match = re.fullmatch(r"([\d.]+)\s*([A-Za-z]*)", str(value or "0").strip())
    if not match:
        raise ValueError(f"Unrecognized memory quantity: {value}")
    number, suffix = float(match[1]), match[2]
    factors = {"": 1, "B": 1, "Ki": 1024, "Mi": 1024**2, "Gi": 1024**3,
               "KiB": 1024, "MiB": 1024**2, "GiB": 1024**3,
               "kB": 1000, "MB": 1000**2, "GB": 1000**3}
    return number * factors[suffix] / 1024**2


def spread(values):
    return {"min": round(min(values), 6), "max": round(max(values), 6),
            "mean": round(statistics.mean(values), 6)}


def resource(container, kind):
    values = (container.get("resources") or {}).get(kind, {})
    return {"cpu_m": cpu_m(values.get("cpu")), "ram_mib": memory_mib(values.get("memory"))}


def totals(parts):
    return {key: round(sum(p[key] for p in parts), 6) for key in ("cpu_m", "ram_mib")}


def workload(namespace, name):
    if namespace != "default":
        return namespace
    for prefix, label in (("journalfit-backend-", "backend"),
                          ("journalfit-worker-format-", "worker-format"), ("keycloak-", "keycloak")):
        if name.startswith(prefix):
            return label
    return "default-other"


def derive(capture, assumptions, directory):
    if capture["metadata"]["failed_commands"]:
        raise ValueError("Capture contains failed commands; inspect live-metrics.txt.")
    samples = capture["samples"]
    if len(samples) != capture["metadata"]["sample_count"] or len(samples) < 2:
        raise ValueError("Sample count is incomplete.")
    inventory = capture["inventory"]
    nodes = {n["name"]: n for n in inventory["nodes"]}
    deployments = {d["name"]: d for d in inventory["deployments"]}
    for name in ("journalfit-backend", "journalfit-worker-format", "keycloak"):
        d = deployments[name]
        if d["ready_replicas"] != d["replicas"]:
            raise ValueError(f"Deployment not Ready: {name}")
    for filename, expected in capture["metadata"]["file_sha256"].items():
        if hashlib.sha256((ROOT / filename).read_bytes()).hexdigest() != expected:
            raise ValueError(f"Capture source changed: {filename}; retain the original version or recapture.")
    workload_samples, namespace_samples, node_samples, docker_samples = {}, {}, {}, {}
    vm_available, vm_used, vm_headroom, vm_cpu, docker_cpu, docker_memory = [], [], [], [], [], []
    previous_stat = None
    hpa_actual = []
    for sample in samples:
        grouped, namespaces = {}, {}
        for line in sample["top_pods_all"].splitlines()[1:]:
            ns, name, cpu, memory = line.split()[:4]
            for mapping, key in ((grouped, workload(ns, name)), (namespaces, ns)):
                pair = mapping.setdefault(key, {"cpu_m": 0, "ram_mib": 0})
                pair["cpu_m"] += cpu_m(cpu)
                pair["ram_mib"] += memory_mib(memory)
        for mapping, destination in ((grouped, workload_samples), (namespaces, namespace_samples)):
            for name, pair in mapping.items():
                destination.setdefault(name, []).append(pair)
        for line in sample["top_nodes"].splitlines()[1:]:
            fields = line.split()
            node_samples.setdefault(fields[0], []).append(
                {"cpu_m": cpu_m(fields[1]), "ram_mib": memory_mib(fields[3])})
        cpu_sum, ram_sum = 0, 0
        for line in sample["docker_stats"].splitlines():
            row = json.loads(line)
            cpu = float(row["CPUPerc"].rstrip("%"))
            memory = memory_mib(row["MemUsage"].split("/")[0])
            docker_samples.setdefault(row["Name"], []).append({"cpu_percent": cpu, "ram_mib": memory})
            cpu_sum += cpu
            ram_sum += memory
        docker_cpu.append(cpu_sum)
        docker_memory.append(ram_sum)
        mem = {line.split(":", 1)[0]: int(line.split()[1])
               for line in sample["vm_meminfo"].splitlines()}
        vm_available.append(mem["MemAvailable"] / 1024)
        vm_used.append((mem["MemTotal"] - mem["MemAvailable"]) / 1024)
        vm_headroom.append(100 * mem["MemAvailable"] / mem["MemTotal"])
        values = list(map(int, sample["vm_cpu_stat"].splitlines()[0].split()[1:]))
        current = (sum(values[:8]), values[3] + values[4])  # guest is already included in user/nice
        if previous_stat:
            total_delta = current[0] - previous_stat[0]
            idle_delta = current[1] - previous_stat[1]
            if total_delta <= 0:
                raise ValueError("Invalid /proc/stat interval.")
            vm_cpu.append(100 * (total_delta - idle_delta) / total_delta)
        previous_stat = current
        match = re.search(r"\(as a percentage of request\):\s+(\d+)%", sample["hpa_description"])
        if not match:
            raise ValueError("HPA CPU percentage was not observed.")
        hpa_actual.append(int(match[1]))

    def group_spreads(groups):
        return {name: {key: spread([row[key] for row in rows]) for key in rows[0]}
                for name, rows in sorted(groups.items())}

    reservations = {}
    for name, node in nodes.items():
        pods = [p for p in inventory["pods"] if p["node"] == name and p["phase"] not in ("Succeeded", "Failed")]
        requested = []
        for pod in pods:
            regular = totals([resource(c, "requests") for c in pod["containers"]])
            initial = [resource(c, "requests") for c in pod["init_containers"]]
            requested.append({key: max([regular[key]] + [r[key] for r in initial]) for key in regular})
        allocated = totals(requested)
        capacity = {"cpu_m": cpu_m(node["allocatable"]["cpu"]),
                    "ram_mib": memory_mib(node["allocatable"]["memory"])}
        reservations[name] = {"pod_count": len(pods), "requests": allocated, "allocatable": capacity,
                              "unreserved": {key: capacity[key] - allocated[key] for key in capacity},
                              "containers_without_cpu_request": sum(not (c.get("resources") or {}).get("requests", {}).get("cpu") for p in pods for c in p["containers"]),
                              "containers_without_memory_request": sum(not (c.get("resources") or {}).get("requests", {}).get("memory") for p in pods for c in p["containers"])}
    backend = deployments["journalfit-backend"]
    hpa = inventory["hpa"]["spec"]
    surge = backend["strategy"]["rollingUpdate"]["maxSurge"]
    surge = math.ceil(hpa["maxReplicas"] * float(surge[:-1]) / 100) if isinstance(surge, str) and surge.endswith("%") else int(surge)
    scenarios = {}
    for label, replicas in (("baseline", hpa["minReplicas"]), ("hpa_max", hpa["maxReplicas"]),
                            ("hpa_max_rolling_surge", hpa["maxReplicas"] + surge)):
        scenario = {"backend_replicas": replicas}
        for kind in ("requests", "limits"):
            parts = [resource(c, kind) for c in backend["containers"] for _ in range(replicas)]
            for name in ("journalfit-worker-format", "keycloak"):
                d = deployments[name]
                parts.extend(resource(c, kind) for c in d["containers"] for _ in range(d["replicas"]))
            scenario[kind] = totals(parts)
        scenarios[label] = scenario
    node_surge = {name: {key: row["requests"][key] for key in row["requests"]} for name, row in reservations.items()}
    selectors = backend["node_selector"]
    storage_nodes = [n["name"] for n in inventory["nodes"] if n["storage_label"] == selectors.get("journalfit-storage")]
    if len(storage_nodes) != 1:
        raise ValueError("Expected exactly one backend storage node.")
    extra = hpa["maxReplicas"] + surge - backend["replicas"]
    for key in ("cpu_m", "ram_mib"):
        node_surge[storage_nodes[0]][key] += sum(resource(c, "requests")[key] for c in backend["containers"]) * extra
    compute = sum(row["count"] * row["usd_each_month"] for row in assumptions["compute"])
    backup = compute * assumptions["daily_vm_backup_fraction"]
    monthly = round(compute + backup + assumptions["regional_load_balancer_usd_month"] + assumptions["object_storage_usd_month"], 6)
    llm = assumptions["llm"]

    def llm_price(prefix):
        return (llm[prefix + "_input_tokens"] * llm["input_usd_per_million"] +
                llm[prefix + "_output_tokens"] * llm["output_usd_per_million"]) / 1_000_000

    abstract, full = llm_price("abstract"), llm_price("full_text")
    billable = llm["billable_call_fraction"] * (1 - llm["cache_hit_fraction"]) * (1 + llm["retry_fraction"])
    volumes = []
    for count in assumptions["completed_checks_per_month"]:
        storage = count * assumptions["average_upload_mib"] / 1024 * assumptions["upload_retention_days"] / assumptions["month_days"]
        volumes.append({"completed_checks": count, "infra_usd_per_check": round(monthly / count, 8),
                        "infra_usd_per_1000": round(monthly / count * 1000, 6),
                        "abstract_llm_usd_month": round(count * abstract * billable, 6),
                        "v2_total_usd_month": round(monthly + count * abstract * billable, 6),
                        "v2_usd_per_check": round(monthly / count + abstract * billable, 8),
                        "upload_gib": round(storage, 6),
                        "storage_with_backups_gib": round(storage + assumptions["logical_backup_budget_gib"], 6)})
    docker_cpus = int(inventory["docker_engine"].split()[0])
    return {
        "source": {"commit": inventory["git_commit"], "branch": inventory["git_branch"],
                   "owner": capture["metadata"]["owner"], "started_at": capture["metadata"]["started_at"],
                   "finished_at": capture["metadata"]["finished_at"], "sample_count": len(samples),
                   "capture_sha256": hashlib.sha256((directory / "capture.json").read_bytes()).hexdigest(),
                   "live_metrics_sha256": hashlib.sha256((directory / "live-metrics.txt").read_bytes()).hexdigest(),
                   "assumptions_sha256": hashlib.sha256(json.dumps(assumptions, sort_keys=True).encode()).hexdigest()},
        "docker_host": {"cpu_count": docker_cpus, "ram_mib": int(inventory["docker_engine"].split()[1]) / 1024**2},
        "measured_workloads": group_spreads(workload_samples),
        "measured_namespaces": group_spreads(namespace_samples), "measured_nodes": group_spreads(node_samples),
        "measured_docker": group_spreads(docker_samples),
        "vm": {"available_ram_mib": spread(vm_available), "used_ram_mib": spread(vm_used),
               "ram_headroom_percent": spread(vm_headroom), "cpu_busy_percent": spread(vm_cpu),
               "cpu_idle_percent": spread([100 - value for value in vm_cpu]),
               "docker_container_memory_sum_mib": spread(docker_memory),
               "docker_cpu_normalized_percent": spread([value / docker_cpus for value in docker_cpu])},
        "hpa_cpu_request_percent": spread(hpa_actual), "node_reservations": reservations,
        "application_configured_scenarios": scenarios, "node_requests_at_hpa_max_surge": node_surge,
        "finops": {"classification": "ASSUMED volumes/deployment; reference prices, not a bill",
                   "compute_usd_month": compute, "daily_vm_backup_usd_month": round(backup, 6),
                   "infra_usd_month": monthly, "abstract_llm_usd_per_call": round(abstract, 8),
                   "full_text_llm_usd_per_call": round(full, 8),
                   "llm_token_cost_reduction_percent": round(100 * (1 - abstract / full), 6), "volume_scenarios": volumes},
    }


def tables(analysis):
    a = analysis
    lines = ["# Modul 09 — tabel kalkulasi turunan", "", "Dihasilkan dari capture.json dan finops-assumptions.json; bukan pengukuran tambahan.", "",
             "## Pemakaian terukur (rentang lima sampel)", "", "| Kelompok | CPU min–max (m) | RAM min–max (MiB) |", "|---|---:|---:|"]
    for name, row in a["measured_workloads"].items():
        lines.append(f"| {name} | {row['cpu_m']['min']:g}–{row['cpu_m']['max']:g} | {row['ram_mib']['min']:g}–{row['ram_mib']['max']:g} |")
    lines += ["", "## Skenario aplikasi (configured; backend + worker + Keycloak)", "",
              "| Skenario | Backend | CPU request/limit (m) | RAM request/limit (MiB) |", "|---|---:|---:|---:|"]
    for name, row in a["application_configured_scenarios"].items():
        lines.append(f"| {name} | {row['backend_replicas']} | {row['requests']['cpu_m']:g} / {row['limits']['cpu_m']:g} | {row['requests']['ram_mib']:g} / {row['limits']['ram_mib']:g} |")
    lines += ["", "## Reservasi node (semua namespace; bukan pemakaian)", "",
              "| Node | Request CPU (m) | Request RAM (MiB) | Allocatable CPU (m) | Allocatable RAM (MiB) | Container tanpa request CPU/RAM |", "|---|---:|---:|---:|---:|---:|"]
    for name, row in a["node_reservations"].items():
        lines.append(f"| {name} | {row['requests']['cpu_m']:g} | {row['requests']['ram_mib']:g} | {row['allocatable']['cpu_m']:g} | {row['allocatable']['ram_mib']:g} | {row['containers_without_cpu_request']} / {row['containers_without_memory_request']} |")
    lines += ["", "## Unit-cost (assumed; USD)", "", "| Selesai/bulan | Infrastruktur/cek | Infrastruktur/1.000 | LLM abstract/bulan | Total v2/bulan | Upload + backup (GiB) |", "|---:|---:|---:|---:|---:|---:|"]
    for row in a["finops"]["volume_scenarios"]:
        lines.append(f"| {row['completed_checks']} | {row['infra_usd_per_check']:.6f} | {row['infra_usd_per_1000']:.3f} | {row['abstract_llm_usd_month']:.2f} | {row['v2_total_usd_month']:.2f} | {row['storage_with_backups_gib']:.2f} |")
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=ROOT / "evidence/capacity-finops")
    parser.add_argument("--assumptions", type=Path, default=ROOT / "evidence/capacity-finops/finops-assumptions.json")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    directory = args.directory.resolve()
    capture = json.loads((directory / "capture.json").read_text(encoding="utf-8"))
    assumptions = json.loads(args.assumptions.read_text(encoding="utf-8"))
    analysis = derive(capture, assumptions, directory)
    outputs = {"analysis.json": json.dumps(analysis, indent=2, ensure_ascii=False) + "\n",
               "calculation-tables.md": tables(analysis)}
    for name, content in outputs.items():
        path = directory / name
        if args.check:
            if path.read_text(encoding="utf-8") != content:
                raise ValueError(f"Derived evidence differs: {name}")
        else:
            path.write_text(content, encoding="utf-8")
    if args.check:
        verify_portfolio(directory, capture)
        print("PASS: complete capture, source/assumption hashes, arithmetic, tables, nine evidence fields, local links, JPEG and credential-output checks")
    else:
        print(f"Wrote analysis.json and calculation-tables.md in {directory}")
        print(f"Keycloak RAM: {analysis['measured_workloads']['keycloak']['ram_mib']}")
        print(f"VM RAM headroom (%): {analysis['vm']['ram_headroom_percent']}")
        print(f"Assumed infrastructure: USD {analysis['finops']['infra_usd_month']:.2f}/month")


def verify_portfolio(directory, capture):
    readme = (directory / "README.md").read_text(encoding="utf-8")
    for field in ("Scope", "Owner", "Source / Version", "Timestamp", "Method", "Observation", "Interpretation", "Limitation", "Decision Supported"):
        if f"**{field}**" not in readme:
            raise ValueError(f"Missing evidence field: {field}")
    jpeg = directory / "09_evidence.jpg"
    if not jpeg.read_bytes().startswith(b"\xff\xd8\xff") or jpeg.stat().st_size < 10000:
        raise ValueError("Missing/invalid evidence JPEG.")
    for path in list(directory.glob("*.md")) + [ROOT / "individual-reflections/rafaelkyky.md"]:
        content = path.read_text(encoding="utf-8")
        if any(line != line.rstrip() for line in content.splitlines()):
            raise ValueError(f"Trailing whitespace in {path.name}")
        for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", content):
            if "://" not in target and not target.startswith("#"):
                if not (path.parent / target.split("#", 1)[0]).exists():
                    raise ValueError(f"Broken local link in {path.name}: {target}")
    forbidden = re.compile(r'k3d\.cluster\.token|"(?:access_token|refresh_token)"\s*:\s*"|Bearer\s+eyJ')
    for path in list(directory.glob("*.json")) + list(directory.glob("*.txt")):
        if forbidden.search(path.read_text(encoding="utf-8")):
            raise ValueError(f"Credential-shaped output in {path.name}; redact before submission.")
    log = (directory / "live-metrics.txt").read_text(encoding="utf-8")
    for command in capture["commands"]:
        if command["exit_code"] != 0 or command["stdout"] not in log:
            raise ValueError(f"Snapshot/log mismatch or command failure: {command['label']}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError) as exc:
        sys.exit(f"FAIL: {exc}")
