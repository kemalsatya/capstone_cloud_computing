#!/usr/bin/env python3
"""Render a three-panel evidence summary from captured data (requires Pillow).

This is a labeled data visualization, not a fabricated terminal screenshot.
"""

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import sys

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
INK, MUTED, TEAL, AMBER = "#183238", "#50646A", "#11665F", "#985315"
PAPER, LINE, TINT = "#F2F4F1", "#CFDAD5", "#EAF3EF"


def font(size, bold=False, mono=False):
    candidates = (["C:/Windows/Fonts/consola.ttf", "DejaVuSansMono.ttf"] if mono else
                  ["C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
                   "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"])
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    raise RuntimeError("Install Segoe UI or DejaVu Sans fonts to render readable evidence.")


class Panel:
    def __init__(self, draw, x, width, y):
        self.draw, self.x, self.width, self.y = draw, x, width, y
        self.left, self.inner = x + 35, width - 70

    def wrap(self, text, face, width):
        lines = []
        for paragraph in str(text).split("\n"):
            line = ""
            for word in paragraph.split():
                candidate = (line + " " + word).strip()
                if line and self.draw.textlength(candidate, font=face) > width:
                    lines.append(line)
                    line = word
                else:
                    line = candidate
            lines.append(line)
        return lines

    def text(self, text, size=25, color=INK, bold=False, gap=14):
        face = font(size, bold)
        for line in self.wrap(text, face, self.inner):
            self.draw.text((self.left, self.y), line, font=face, fill=color)
            self.y += size + 10
        self.y += gap

    def section(self, title):
        self.y += 12
        self.draw.line((self.left, self.y, self.left + self.inner, self.y), fill=LINE, width=2)
        self.y += 22
        self.text(title, 27, TEAL, True, 12)

    def table(self, headers, rows, fractions):
        widths = [int(self.inner * part) for part in fractions]
        for index, row in enumerate([headers] + rows):
            face = font(23, index == 0)
            cells = [self.wrap(cell, face, width - 16) for cell, width in zip(row, widths)]
            height = max(map(len, cells)) * 32 + 20
            if index == 0:
                self.draw.rectangle((self.left, self.y, self.left + self.inner, self.y + height), fill=TINT)
            x = self.left + 8
            for cell, width in zip(cells, widths):
                for offset, line in enumerate(cell):
                    self.draw.text((x, self.y + 8 + offset * 32), line, font=face, fill=TEAL if index == 0 else INK)
                x += width
            self.y += height
            self.draw.line((self.left, self.y, self.left + self.inner, self.y), fill=LINE, width=1)
        self.y += 18

    def raw(self, title, text):
        self.text(title, 21, MUTED, True, 6)
        lines = [line.rstrip() for line in text.strip().splitlines()]
        size = 19
        while max(self.draw.textlength(line, font=font(size, mono=True)) for line in lines) > self.inner - 26:
            size -= 1
            if size < 14:
                raise ValueError("Raw output is too wide to render without unreadable text.")
        height = len(lines) * (size + 9) + 26
        self.draw.rectangle((self.left, self.y, self.left + self.inner, self.y + height), fill="#F4F6F5")
        for i, line in enumerate(lines):
            self.draw.text((self.left + 13, self.y + 12 + i * (size + 9)), line, font=font(size, mono=True), fill=INK)
        self.y += height + 22


def span(data, digits=0):
    return f"{data['min']:.{digits}f}–{data['max']:.{digits}f}"


def render(directory, assumptions_path):
    a = json.loads((directory / "analysis.json").read_text(encoding="utf-8"))
    capture = json.loads((directory / "capture.json").read_text(encoding="utf-8"))
    assumptions = json.loads(assumptions_path.read_text(encoding="utf-8"))
    if hashlib.sha256((directory / "capture.json").read_bytes()).hexdigest() != a["source"]["capture_sha256"]:
        raise ValueError("Analysis does not match capture; recalculate it first.")
    if hashlib.sha256(json.dumps(assumptions, sort_keys=True).encode()).hexdigest() != a["source"]["assumptions_sha256"]:
        raise ValueError("FinOps assumptions differ from analysis; use matching --assumptions.")
    wib = timezone(timedelta(hours=7))
    started = datetime.fromisoformat(a["source"]["started_at"]).astimezone(wib)
    finished = datetime.fromisoformat(a["source"]["finished_at"]).astimezone(wib)
    deployments = {d["name"]: d for d in capture["inventory"]["deployments"]}
    no_requests = sum(n["containers_without_memory_request"] for n in a["node_reservations"].values())
    storage_node = next(n["name"] for n in capture["inventory"]["nodes"] if n["storage_label"] == "uploads")
    reservation = a["node_reservations"][storage_node]["requests"]
    surge_request = a["node_requests_at_hpa_max_surge"][storage_node]
    typical = a["finops"]["volume_scenarios"][1]
    image = Image.new("RGB", (3300, 4200), PAPER)
    draw = ImageDraw.Draw(image)
    draw.text((60, 36), "JOURNALFIT  /  TEAM 7  /  PROGRESS MILESTONE 2", font=font(25, True), fill=TEAL)
    draw.text((60, 82), "09 — Capacity, FinOps & Roadmap", font=font(65, True), fill=INK)
    draw.text((63, 173), f"{started:%d %b %Y} · {started:%H:%M:%S}–{finished:%H:%M:%S} WIB · Owner: {a['source']['owner']} · Source: {a['source']['commit'][:7]} · {capture['metadata']['context']}", font=font(27), fill=MUTED)
    draw.text((63, 218), "MEASURED = live data    |    CONFIGURED = resource budgets    |    ASSUMED = cloud/volume/token projections", font=font(24), fill=MUTED)
    width, top = 1037, 282
    panels = [Panel(draw, 60 + i * 1071, width, top + 30) for i in range(3)]
    for panel in panels:
        draw.rectangle((panel.x, top, panel.x + width, 4040), fill="white")
    p = panels[0]
    p.text("01 / CAPACITY", 24, TEAL, True)
    p.text("Measured demand & headroom", 37, INK, True)
    p.text(f"{a['source']['sample_count']} idle samples · probes, polling and monitoring active; one JWT preflight. No load generator.", 24, MUTED)
    last = capture["samples"][-1]
    p.raw(f"ORIGINAL OUTPUT · kubectl top pods -n default · sample {last['index']}", last["top_pods_default"])
    p.raw(f"ORIGINAL OUTPUT · kubectl top nodes · sample {last['index']}", last["top_nodes"])
    p.section("MEASURED / full five-sample ranges")
    rows = []
    for key, label in (("backend", f"Backend ×{deployments['journalfit-backend']['replicas']} (combined)"), ("worker-format", "Format worker"), ("keycloak", "Keycloak")):
        row = a["measured_workloads"][key]
        rows.append([label, span(row["cpu_m"]) + "m", span(row["ram_mib"]) + " MiB"])
    p.table(["Workload", "CPU", "RAM"], rows, [.49, .21, .30])
    p.text("Keycloak RAM exceeds its 512Mi request. Candidate: 768Mi request; validate under load and retain 1Gi limit.", 25, AMBER, True)
    p.section("CONFIGURED / API + worker + Keycloak")
    rows = []
    for key, label in (("baseline", "2 API / baseline"), ("hpa_max", "3 API / HPA max"), ("hpa_max_rolling_surge", "4 API / +1 surge")):
        row = a["application_configured_scenarios"][key]
        rows.append([label, f"{row['requests']['cpu_m']:g}/{row['limits']['cpu_m']:g}", f"{row['requests']['ram_mib']:g}/{row['limits']['ram_mib']:g}"])
    p.table(["Scenario", "CPU req/lim (m)", "RAM req/lim (Mi)"], rows, [.38, .30, .32])
    p.text("Scale-out/surge rows are configuration scenarios, not newly measured peak demand. DB/platform are additional.", 22, MUTED)
    p.section("MEASURED / shared Docker Linux VM")
    p.text(span(a["vm"]["ram_headroom_percent"], 2) + "% RAM headroom", 46, TEAL, True)
    p.text(f"MemAvailable {span(a['vm']['available_ram_mib'], 2)} MiB of {a['docker_host']['ram_mib']:.2f} MiB / {a['docker_host']['cpu_count']} CPU.", 24)
    bar_y = p.y
    available = a["vm"]["ram_headroom_percent"]["min"] / 100
    draw.rectangle((p.left, bar_y, p.left + p.inner, bar_y + 24), fill="#B7C5BF")
    draw.rectangle((p.left + p.inner * (1 - available), bar_y, p.left + p.inner, bar_y + 24), fill=TEAL)
    p.y += 42
    p.text("VM CPU busy " + span(a["vm"]["cpu_busy_percent"], 2) + "% across four /proc/stat intervals.", 24)
    p.text(f"Storage node: requests {reservation['cpu_m']:g}m / {reservation['ram_mib']:g}Mi; at max API surge {surge_request['cpu_m']:g}m / {surge_request['ram_mib']:g}Mi, including other scheduled pods.", 24)
    p.text(f"HPA observed {span(a['hpa_cpu_request_percent'])}% / 70%, minimum 2 retained. {no_requests} K8s containers lack CPU/RAM requests.", 24)
    p.text("Do not add pod usage to k3d node-container usage. Both nodes share one VM; idle headroom is not production throughput or HA proof.", 23, MUTED)

    p = panels[1]
    p.text("02 / IAAS & FINOPS", 24, TEAL, True)
    p.text("A transparent cost model", 37, INK, True)
    p.text(f"ASSUMED pilot layout · USD / month · official reference prices retrieved {assumptions['retrieved_on']}; not a cloud invoice.", 24, MUTED)
    p.section("CloudStack mapping / public-IaaS price proxy")
    rows = [[row['role'], f"{row['count']} × {row['vcpu_each']} CPU / {row['ram_gib_each']}Gi", f"{row['count'] * row['usd_each_month']:.2f}"]
            for row in assumptions['compute']]
    rows += [["Regional load balancer", "1 unit", f"{assumptions['regional_load_balancer_usd_month']:.2f}"],
            ["S3-compatible storage", f"{assumptions['object_storage_included_gib']}Gi included", f"{assumptions['object_storage_usd_month']:.2f}"],
            ["Daily VM backups", "30% × compute", f"{a['finops']['daily_vm_backup_usd_month']:.2f}"]]
    p.table(["Resource", "Sizing", "USD"], rows, [.50, .32, .18])
    p.text(f"USD {a['finops']['infra_usd_month']:.2f} / month", 48, TEAL, True)
    p.text("80Gi boot SSD included per VM. Database is self-managed, not a managed service. Tax, overages, labor and full HA excluded.", 24, MUTED)
    p.section("Unit-cost / completed format checks")
    rows = [[f"{row['completed_checks']:,}", f"${row['infra_usd_per_check']:.6f}", f"${row['v2_total_usd_month']:.2f}"]
            for row in a["finops"]["volume_scenarios"]]
    p.table(["Assumed / month", "Infra / check", "v2 total / mo"], rows, [.37, .33, .30])
    p.text(f"{a['finops']['infra_usd_month']:.2f} ÷ {typical['completed_checks']:,} = ${typical['infra_usd_per_check']:.6f}/check. These volumes are cost scenarios, not measured processing capacity.", 25)
    p.section("AI fee / deterministic v1 vs projected v2")
    p.table(["Path", "Tokens in/out", "USD / call"],
            [["Current format engine", "No API call", "$0"],
             ["Full-text LLM (assumed)", "8,000 / 1,000", f"${a['finops']['full_text_llm_usd_per_call']:.6f}"],
             ["Abstract-only (assumed)", "600 / 300", f"${a['finops']['abstract_llm_usd_per_call']:.6f}"]], [.46, .29, .25])
    p.text(f"{a['finops']['llm_token_cost_reduction_percent']:g}% lower token cost at these assumptions. Groq gpt-oss-20b: $0.075 input / $0.30 output per million tokens.", 24)
    p.text("No paid LLM call made. Quality, reasoning-token usage, retries and cache hits remain unmeasured.", 23, MUTED)
    p.section("Optimization without harming controls")
    p.text("Keep non-root, JWT/JWKS tenant identity, Secrets, probes and minimum two backend replicas. Retain telemetry and restore controls.", 25, TEAL, True)
    p.text("Use deterministic checks first; bound future abstract-only requests, retries and budget. Prometheus lab retention remains 3 days.", 24)
    p.text("Multi-node placement requires S3 migration before removing storage pinning. Single control plane, DB and Keycloak remain pilot SPOFs.", 24)
    p.text("Price sources: digitalocean.com/pricing/{droplets, load-balancers, spaces-object-storage}; console.groq.com/docs/models. Full URLs and exclusions in README + finops-assumptions.json.", 21, MUTED)

    p = panels[2]
    p.text("03 / RISKS & ROADMAP", 24, TEAL, True)
    p.text("Prioritize what remains", 37, INK, True)
    p.text("Current implementation: Keycloak OIDC and pg-boss format worker active. Storage local; AI/scope worker pending.", 24, MUTED)
    risks = [
        ("R1 / P1 · STORAGE", "RWO local-path pins API + worker to one node; nominal 1Gi is not a filesystem quota.", "Next: Garage/S3, lifecycle + restore, then topology-aware placement."),
        ("R2 / P1 · IDENTITY", "Direct access grant/demo users and single Keycloak Recreate deployment remain.", "Next: PKCE, production identities, Secret rotation and measured IAM recovery."),
        ("R3 / P1 · DATABASE", "host.k3d.internal DB (host.docker.internal is Docker Desktop-only) + manual backup. Prior restore evidence predates this schema migration.", "Next: private DB DNS, scheduled off-site backups and a fresh isolated restore drill."),
        ("R4 / P1 · ARTIFACTS", "Local registry uses HTTP without authentication; laptop artifact is not a cloud release.", "Next: private TLS registry, same-digest scan and release traceability."),
        ("R5 / P1 · RESOURCE BUDGETS", f"Keycloak exceeds its RAM request; {no_requests} K8s containers have no CPU/RAM requests; Docker support is uncapped.", "Next: validate 768Mi Keycloak request, DOCX/login load profile, quotas and alerts."),
        ("R6 / P1 · DELIVERY", "Argo CD is Ready but has no Application in this lab. Capacity rollout was manual.", "Next: align source/tag/digest and prove Healthy/Synced, drift and HPA ownership."),
        ("R7 / P2 · PRODUCT ROADMAP", "pg-boss format worker exists; scope remains queued without Groq worker. S3/cache/suggester pending.", "Next: storage first, then bounded scope processing, quality checks and cost metering."),
    ]
    for title, finding, action in risks:
        p.section(title)
        p.text(finding, 25)
        p.text(action, 24, TEAL)
    p.section("Evidence trail / Guideline §9")
    p.text("Scope · Owner · Source/version · Timestamp · Method · Observation · Interpretation · Limitation · Decision supported", 22, MUTED)
    p.text("Scope and conclusions: README.md. Raw commands: live-metrics.txt + capture.json. Calculations: analysis.json. Report: chapters 10–12.", 23)
    p.text("Capture SHA-256: " + a["source"]["capture_sha256"][:24] + "…", 21, MUTED)
    bottom = max(panel.y for panel in panels) + 24
    if bottom > 3940:
        raise ValueError("Evidence content exceeds layout; shorten copy or increase canvas.")
    for panel in panels:
        draw.rectangle((panel.x, top, panel.x + width, bottom), outline=LINE, width=2)
    draw.rectangle((0, bottom + 1, 3300, 4200), fill=PAPER)
    draw.text((63, bottom + 30), "Compiled from original live outputs + explicit assumptions. The image summarizes evidence; it does not replace the raw logs or constitute a terminal screenshot.", font=font(23), fill=MUTED)
    draw.text((63, bottom + 72), "JournalFit / Modul 09 / Capacity & FinOps 5% / Nine-field evidence in README / Final-report contribution: Chapters 10–12", font=font(23, True), fill=TEAL)
    image = image.crop((0, 0, 3300, bottom + 132))
    destination = directory / "09_evidence.jpg"
    image.save(destination, quality=94, subsampling=0, dpi=(200, 200))
    print(f"Rendered {destination}: {image.width}x{image.height}, {destination.stat().st_size:,} bytes")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=ROOT / "evidence/capacity-finops")
    parser.add_argument("--assumptions", type=Path, default=ROOT / "evidence/capacity-finops/finops-assumptions.json")
    args = parser.parse_args()
    render(args.directory.resolve(), args.assumptions.resolve())


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, RuntimeError) as exc:
        sys.exit(f"FAIL: {exc}")
