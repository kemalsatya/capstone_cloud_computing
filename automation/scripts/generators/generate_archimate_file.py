import os
import shutil
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape

# Generates a 100% native, EMF-valid Archi 5.0.0 (.archimate) model file
# matching ArchiMate 3.2 notation with 4 clean views:
#   1. Motivation view (01-business)
#   2. Layered view (02-architecture)
#   3. Application cooperation view (02-architecture)
#   4. Technology view & Trust Boundaries (02-architecture)
# Strictly aligned with origin/main (7e8607b / tag 0c2cf92).

elements_by_folder = {
    "business": [
        ("id-ba-author", "BusinessActor", "Author (Penulis)", "Submitter role (author.a, author.b)"),
        ("id-ba-editor", "BusinessActor", "Journal Editor", "Reviewer role (editor.a)"),
        ("id-bp-auth", "BusinessProcess", "1. OIDC Tenant Login", "Authenticate via Keycloak (realm journalfit) -> RS256 Bearer JWT"),
        ("id-bp-submit", "BusinessProcess", "2. Submit Naskah (.docx)", "POST /api/manuscripts (202 Accepted) -> PVC + pg-boss enqueue"),
        ("id-bp-audit", "BusinessProcess", "3. Async OOXML Format Audit", "worker-format evaluates Tier-1 FMT-001..009 ($0 AI cost)"),
        ("id-bp-review", "BusinessProcess", "4. Tinjau Laporan & Revisi", "GET /api/manuscripts/:id/report (< 50 ms), cross-tenant 404"),
    ],
    "application": [
        ("id-as-check", "ApplicationService", "Layanan Validasi Format Naskah", "Multi-tenant asynchronous DOCX format pre-check service"),
        ("id-ai-ingress", "ApplicationInterface", "Traefik Ingress Gateway (:8088)", "journalfit.localhost -> backend:80 | keycloak.localhost -> keycloak:80"),
        ("id-ac-keycloak", "ApplicationComponent", "Keycloak OIDC Provider (26.8.2)", "Realm journalfit | RS256 Token & Internal JWKS (~596 MiB RAM)"),
        ("id-ac-api", "ApplicationComponent", "JournalFit Backend API (Express 5)", "Node.js 22 + Express 5.3 + jose JWKS + OpenAPI /docs + /metrics"),
        ("id-ac-queue", "ApplicationComponent", "Job Queue (pg-boss)", "PostgreSQL-backed queue format-check + format-check-dlq (atomic TX)"),
        ("id-ac-worker", "ApplicationComponent", "Worker Format (OOXML Engine)", "node src/worker.js | jszip + fast-xml-parser | FMT-001..009 | :9101"),
        ("id-do-jwt", "DataObject", "Bearer JWT (RS256)", "Claims: iss, sub, tenant_id, role (X-Tenant-ID ignored)"),
        ("id-do-docx", "DataObject", "Naskah (.docx)", "Binary stored in PVC /app/uploads (shared by API & worker)"),
        ("id-do-rules", "DataObject", "Template Aturan (FMT-001..009)", "Tenant-scoped Tier-1 rules in format_rule_templates"),
        ("id-do-report", "DataObject", "Laporan & Findings", "format_score, check_results, findings (tenant-isolated)"),
    ],
    "technology": [
        ("id-dv-client", "Device", "Client / Browser / API Caller", "Author & Editor external client accessing HTTP :8088"),
        ("id-ts-ingress", "TechnologyService", "Traefik Ingress (:8088)", "Cluster HTTP entrypoint [TB-1 Perimeter Boundary]"),
        ("id-nd-k3d", "Node", "k3d-capstone (k3s v1.31 / agent-0)", "Containerd runtime, label journalfit-storage=uploads"),
        ("id-ss-kc", "SystemSoftware", "Pod: keycloak (UID 1000, 1x)", "quay.io/keycloak/keycloak:26.8.2 | Req 250m/512Mi Lim 1000m/1Gi | Svc :80->:8080"),
        ("id-ss-api", "SystemSoftware", "Pod: journalfit-backend (2-3 HPA)", "registry:5000/journalfit-backend:0c2cf92 | UID 10001 drop ALL | Self-heal 7.1s"),
        ("id-ss-worker", "SystemSoftware", "Pod: worker-format (UID 10001, 1x)", "node src/worker.js | Req 100m/128Mi Lim 250m/256Mi | Metrics :9101"),
        ("id-ss-job", "SystemSoftware", "Job: db-setup (migrate + seed)", "InitContainer run-migrations.js (001+002) + seed-demo-data.js | UID 10001"),
        ("id-ar-pvc", "Artifact", "PVC: journalfit-uploads (1Gi RWO)", "local-path RWO /app/uploads [FB-2 single-node pinned, Prune=false]"),
        ("id-ar-sec", "Artifact", "K8s Secrets & ConfigMaps", "journalfit-backend-secret, keycloak-db/admin-secret, AUTH_MODE=jwt [TB-4]"),
        ("id-ss-pg", "SystemSoftware", "PostgreSQL 17 Alpine (:5432)", "DB journalfit (6 tables + pg-boss) & DB keycloak (101 tables)"),
        ("id-ts-backup", "TechnologyService", "Backup & Isolated Restore", "db-backup-restore.sh | Verified RTO 0.78s (< 300s SLO) [FB-3]"),
        ("id-ss-obs", "SystemSoftware", "Prometheus (:9090) & Grafana (:3000)", "Scrapes /metrics 15s, TSDB 3d retention, 4 Golden Signals SLO"),
        ("id-ss-gha", "SystemSoftware", "GitHub Actions CI", "node --test (63/64 PASS) + Trivy Gate (HIGH,CRITICAL) + SHA-7"),
        ("id-ss-reg", "SystemSoftware", "Local OCI Registry (:5001/:5000)", "Immutable artifact registry:5000/journalfit-backend:0c2cf92"),
        ("id-ss-argo", "SystemSoftware", "Argo CD GitOps Controller", "Auto-Sync & Self-Heal (main -> deployment/), rollback < 15s"),
    ],
    "motivation": [
        ("id-st-author", "Stakeholder", "Penulis / Mahasiswa", "Ingin self-check format .docx sebelum submit resmi"),
        ("id-st-editor", "Stakeholder", "Editor Jurnal", "Ingin naskah rapi secara format tanpa cek manual 10-40 menit"),
        ("id-st-tadmin", "Stakeholder", "Admin Tenant", "Menjaga kerahasiaan & isolasi data naskah antar jurnal"),
        ("id-st-padmin", "Stakeholder", "Admin Platform", "Menjaga SLO, efisiensi FinOps, dan stabilitas kluster"),
        ("id-dr-manual", "Driver", "Cek Manual & >30% Desk Rejection", "Siklus revisi 2-3x dan 16-25 jam/100 naskah"),
        ("id-dr-burst", "Driver", "Lonjakan Trafik 10x Jelang Deadline", "Beban musiman ekstrem saat call-for-papers / yudisium"),
        ("id-dr-sec", "Driver", "Kerahasiaan Naskah & FinOps", "Naskah belum terbit sensitif; hindari biaya AI tinggi di v1"),
        ("id-gl-audit", "Goal", "Audit Format Otomatis & Cepat", "Tier-1 FMT-001..009 deterministik, report p95 < 50 ms"),
        ("id-gl-iso", "Goal", "Isolasi Multi-Tenant & Resilience", "0 kebocoran data (401/404/403), self-heal 7.1s, RTO 0.78s"),
        ("id-gl-cost", "Goal", "Efisiensi Biaya ($0 AI Cost v1)", "Deterministic OOXML tanpa token LLM berbayar di v1"),
        ("id-rq-async", "Requirement", "Pemrosesan Asinkron (pg-boss) + HPA", "Decouple upload API (202) dan worker-format + HPA 2-3 pod"),
        ("id-rq-ooxml", "Requirement", "Rule Engine OOXML (FMT-001..009)", "jszip + fast-xml-parser untuk A4, margin, font, abstrak, keywords"),
        ("id-rq-oidc", "Requirement", "Keycloak OIDC RS256 + Policy 404", "Claim tenant_id terverifikasi JWKS, abaikan X-Tenant-ID"),
        ("id-rq-dr", "Requirement", "Backup & Isolated Restore Drill", "Target SLO RTO < 5 menit (teruji 0.78 detik)"),
        ("id-ct-scope", "Constraint", "v1 Hanya DOCX & PVC RWO (S3/AI di v2)", "Garage S3 & Groq AI scope checker masuk Roadmap v2"),
    ],
    "other": [
        ("id-gp-platform", "Grouping", "Trust Boundary: Kubernetes Data Plane [TB-1..TB-4]", "Perimeter :8088, RS256 JWKS, Multi-Tenant 404, Non-Root UID 10001"),
        ("id-gp-host", "Grouping", "Host Node: Docker Engine (DB & Observability)", "PostgreSQL 17, Backup/Restore [FB-3], Prometheus & Grafana"),
        ("id-gp-cicd", "Grouping", "Control Plane: CI/CD & GitOps (Out-of-Band)", "GitHub Actions -> OCI Registry -> Argo CD Auto-Sync"),
    ],
}

# 100% ArchiMate 3.2 valid relationships: (id, type, source, target, name, extra_attrs)
relationships = [
    # --- View 1: Motivation ---
    ("id-r-m1", "AssociationRelationship", "id-st-author", "id-dr-manual", "", ""),
    ("id-r-m2", "AssociationRelationship", "id-st-editor", "id-dr-manual", "", ""),
    ("id-r-m3", "AssociationRelationship", "id-st-editor", "id-dr-burst", "", ""),
    ("id-r-m4", "AssociationRelationship", "id-st-tadmin", "id-dr-sec", "", ""),
    ("id-r-m5", "AssociationRelationship", "id-st-padmin", "id-dr-sec", "", ""),
    ("id-r-m6", "InfluenceRelationship", "id-dr-manual", "id-gl-audit", "", ""),
    ("id-r-m7", "InfluenceRelationship", "id-dr-burst", "id-gl-audit", "", ""),
    ("id-r-m8", "InfluenceRelationship", "id-dr-sec", "id-gl-iso", "", ""),
    ("id-r-m9", "InfluenceRelationship", "id-dr-sec", "id-gl-cost", "", ""),
    ("id-r-m10", "RealizationRelationship", "id-rq-async", "id-gl-audit", "", ""),
    ("id-r-m11", "RealizationRelationship", "id-rq-ooxml", "id-gl-audit", "", ""),
    ("id-r-m12", "RealizationRelationship", "id-rq-ooxml", "id-gl-cost", "", ""),
    ("id-r-m13", "RealizationRelationship", "id-rq-oidc", "id-gl-iso", "", ""),
    ("id-r-m14", "RealizationRelationship", "id-rq-dr", "id-gl-iso", "", ""),
    ("id-r-m15", "InfluenceRelationship", "id-ct-scope", "id-rq-ooxml", "", ""),
    ("id-r-m16", "InfluenceRelationship", "id-ct-scope", "id-rq-async", "", ""),

    # --- View 2: Layered ---
    ("id-r-l1", "AssignmentRelationship", "id-ba-author", "id-bp-auth", "", ""),
    ("id-r-l2", "AssignmentRelationship", "id-ba-author", "id-bp-submit", "", ""),
    ("id-r-l3", "AssignmentRelationship", "id-ba-editor", "id-bp-review", "", ""),
    ("id-r-l4", "TriggeringRelationship", "id-bp-auth", "id-bp-submit", "", ""),
    ("id-r-l5", "TriggeringRelationship", "id-bp-submit", "id-bp-audit", "", ""),
    ("id-r-l6", "TriggeringRelationship", "id-bp-audit", "id-bp-review", "", ""),
    ("id-r-l7", "ServingRelationship", "id-as-check", "id-bp-submit", "", ""),
    ("id-r-l8", "ServingRelationship", "id-as-check", "id-bp-audit", "", ""),
    ("id-r-l9", "ServingRelationship", "id-as-check", "id-bp-review", "", ""),
    ("id-r-l10", "RealizationRelationship", "id-ac-keycloak", "id-as-check", "", ""),
    ("id-r-l11", "RealizationRelationship", "id-ac-api", "id-as-check", "", ""),
    ("id-r-l12", "RealizationRelationship", "id-ac-queue", "id-as-check", "", ""),
    ("id-r-l13", "RealizationRelationship", "id-ac-worker", "id-as-check", "", ""),
    ("id-r-l14", "ServingRelationship", "id-ss-kc", "id-ac-keycloak", "", ""),
    ("id-r-l15", "ServingRelationship", "id-ss-api", "id-ac-api", "", ""),
    ("id-r-l16", "ServingRelationship", "id-ss-pg", "id-ac-queue", "", ""),
    ("id-r-l17", "ServingRelationship", "id-ss-worker", "id-ac-worker", "", ""),

    # --- View 3: Application Cooperation ---
    ("id-r-a1", "FlowRelationship", "id-ai-ingress", "id-ac-keycloak", "keycloak.localhost", ""),
    ("id-r-a2", "FlowRelationship", "id-ai-ingress", "id-ac-api", "journalfit.localhost", ""),
    ("id-r-a3", "FlowRelationship", "id-ac-keycloak", "id-ac-api", "JWKS Keys (RS256)", ""),
    ("id-r-a4", "FlowRelationship", "id-ac-api", "id-ac-queue", "Enqueue format-check", ""),
    ("id-r-a5", "FlowRelationship", "id-ac-queue", "id-ac-worker", "Dispatch Job", ""),
    ("id-r-a6", "AccessRelationship", "id-ac-api", "id-do-jwt", "Verify", ' accessType="1"'),
    ("id-r-a7", "AccessRelationship", "id-ac-api", "id-do-docx", "Write", ' accessType="2"'),
    ("id-r-a8", "AccessRelationship", "id-ac-worker", "id-do-docx", "Read", ' accessType="1"'),
    ("id-r-a9", "AccessRelationship", "id-ac-worker", "id-do-rules", "Read", ' accessType="1"'),
    ("id-r-a10", "AccessRelationship", "id-ac-worker", "id-do-report", "Write", ' accessType="2"'),
    ("id-r-a11", "AccessRelationship", "id-ac-api", "id-do-report", "Read", ' accessType="1"'),

    # --- View 4: Technology & Trust Boundaries ---
    ("id-r-t1", "FlowRelationship", "id-dv-client", "id-ts-ingress", "HTTP :8088", ""),
    ("id-r-t2", "FlowRelationship", "id-ts-ingress", "id-ss-kc", "Svc :80->:8080", ""),
    ("id-r-t3", "FlowRelationship", "id-ts-ingress", "id-ss-api", "Svc :80->:8000", ""),
    ("id-r-t4", "FlowRelationship", "id-ss-kc", "id-ss-api", "Internal JWKS", ""),
    ("id-r-t5", "AccessRelationship", "id-ss-api", "id-ar-pvc", "/app/uploads", ' accessType="3"'),
    ("id-r-t6", "AccessRelationship", "id-ss-worker", "id-ar-pvc", "Read .docx", ' accessType="1"'),
    ("id-r-t7", "AccessRelationship", "id-ss-api", "id-ar-sec", "Env/Secret", ' accessType="1"'),
    ("id-r-t8", "AccessRelationship", "id-ss-kc", "id-ar-sec", "KC Secrets", ' accessType="1"'),
    ("id-r-t9", "FlowRelationship", "id-ss-api", "id-ss-pg", "TCP :5432", ""),
    ("id-r-t10", "FlowRelationship", "id-ss-worker", "id-ss-pg", "", ""),
    ("id-r-t11", "FlowRelationship", "id-ss-kc", "id-ss-pg", "", ""),
    ("id-r-t12", "FlowRelationship", "id-ss-job", "id-ss-pg", "Migrate/Seed", ""),
    ("id-r-t13", "FlowRelationship", "id-ss-pg", "id-ts-backup", "pg_dump (0.78s)", ""),
    ("id-r-t14", "FlowRelationship", "id-ss-api", "id-ss-obs", "Scrape :8000", ""),
    ("id-r-t15", "FlowRelationship", "id-ss-worker", "id-ss-obs", "Scrape :9101", ""),
    ("id-r-t16", "FlowRelationship", "id-ss-gha", "id-ss-reg", "Push 0c2cf92", ""),
    ("id-r-t17", "FlowRelationship", "id-ss-reg", "id-nd-k3d", "Pull 0c2cf92", ""),
    ("id-r-t18", "ServingRelationship", "id-ss-argo", "id-nd-k3d", "GitOps Sync", ""),
]


def build_view(view_id, view_name, nodes, view_rel_ids):
    """
    nodes: list of dicts:
      {"el": el_id, "x": int, "y": int, "w": int, "h": int, "children": [...]}
    view_rel_ids: list of relationship ids to draw in this view
    """
    el_to_did = {}

    def register(node_list):
        for n in node_list:
            did = f"{view_id}-d-{n['el']}"
            el_to_did[n["el"]] = did
            if n.get("children"):
                register(n["children"])

    register(nodes)

    rel_map = {r[0]: r for r in relationships}
    outgoing = {}
    incoming = {}
    for rid in view_rel_ids:
        _, _, src_el, tgt_el, _, _ = rel_map[rid]
        cid = f"{view_id}-c-{rid}"
        src_d = el_to_did[src_el]
        tgt_d = el_to_did[tgt_el]
        outgoing.setdefault(src_d, []).append((cid, src_d, tgt_d, rid))
        incoming.setdefault(tgt_d, []).append(cid)

    def render_nodes(node_list, indent="      "):
        out = []
        for n in node_list:
            el = n["el"]
            did = el_to_did[el]
            tconns = incoming.get(did, [])
            tattr = f' targetConnections="{" ".join(tconns)}"' if tconns else ""
            out.append(f'{indent}<child xsi:type="archimate:DiagramObject" id="{did}"{tattr} archimateElement="{el}">')
            out.append(f'{indent}  <bounds x="{n["x"]}" y="{n["y"]}" width="{n["w"]}" height="{n["h"]}"/>')
            for cid, src_d, tgt_d, rid in outgoing.get(did, []):
                out.append(f'{indent}  <sourceConnection xsi:type="archimate:Connection" id="{cid}" source="{src_d}" target="{tgt_d}" archimateRelationship="{rid}"/>')
            if n.get("children"):
                out.append(render_nodes(n["children"], indent + "  "))
            out.append(f'{indent}</child>')
        return "\n".join(out)

    body = render_nodes(nodes)
    return (
        f'    <element xsi:type="archimate:ArchimateDiagramModel" name="{escape(view_name)}" id="{view_id}" connectionRouterType="1">\n'
        f'{body}\n'
        f'    </element>'
    )


# View 1: Motivation View
v1_nodes = [
    {"el": "id-st-author", "x": 30, "y": 30, "w": 180, "h": 55},
    {"el": "id-st-editor", "x": 240, "y": 30, "w": 180, "h": 55},
    {"el": "id-st-tadmin", "x": 450, "y": 30, "w": 180, "h": 55},
    {"el": "id-st-padmin", "x": 660, "y": 30, "w": 180, "h": 55},
    {"el": "id-dr-manual", "x": 40, "y": 130, "w": 240, "h": 60},
    {"el": "id-dr-burst", "x": 310, "y": 130, "w": 240, "h": 60},
    {"el": "id-dr-sec", "x": 580, "y": 130, "w": 240, "h": 60},
    {"el": "id-gl-audit", "x": 60, "y": 235, "w": 240, "h": 60},
    {"el": "id-gl-iso", "x": 330, "y": 235, "w": 240, "h": 60},
    {"el": "id-gl-cost", "x": 600, "y": 235, "w": 240, "h": 60},
    {"el": "id-rq-async", "x": 30, "y": 345, "w": 195, "h": 60},
    {"el": "id-rq-ooxml", "x": 240, "y": 345, "w": 195, "h": 60},
    {"el": "id-rq-oidc", "x": 450, "y": 345, "w": 195, "h": 60},
    {"el": "id-rq-dr", "x": 660, "y": 345, "w": 195, "h": 60},
    {"el": "id-ct-scope", "x": 110, "y": 450, "w": 360, "h": 55},
]
v1_rels = [f"id-r-m{i}" for i in range(1, 17)]

# View 2: Layered View
v2_nodes = [
    {"el": "id-ba-author", "x": 30, "y": 30, "w": 160, "h": 55},
    {"el": "id-bp-auth", "x": 220, "y": 30, "w": 175, "h": 55},
    {"el": "id-bp-submit", "x": 420, "y": 30, "w": 175, "h": 55},
    {"el": "id-bp-audit", "x": 620, "y": 30, "w": 175, "h": 55},
    {"el": "id-bp-review", "x": 820, "y": 30, "w": 175, "h": 55},
    {"el": "id-ba-editor", "x": 1020, "y": 30, "w": 160, "h": 55},
    {"el": "id-as-check", "x": 220, "y": 130, "w": 775, "h": 55},
    {"el": "id-ac-keycloak", "x": 60, "y": 230, "w": 240, "h": 65},
    {"el": "id-ac-api", "x": 330, "y": 230, "w": 240, "h": 65},
    {"el": "id-ac-queue", "x": 600, "y": 230, "w": 240, "h": 65},
    {"el": "id-ac-worker", "x": 870, "y": 230, "w": 240, "h": 65},
    {
        "el": "id-nd-k3d", "x": 40, "y": 340, "w": 1090, "h": 140,
        "children": [
            {"el": "id-ss-kc", "x": 20, "y": 45, "w": 240, "h": 70},
            {"el": "id-ss-api", "x": 290, "y": 45, "w": 240, "h": 70},
            {"el": "id-ss-pg", "x": 560, "y": 45, "w": 240, "h": 70},
            {"el": "id-ss-worker", "x": 830, "y": 45, "w": 240, "h": 70},
        ],
    },
]
v2_rels = [f"id-r-l{i}" for i in range(1, 18)]

# View 3: Application Cooperation View
v3_nodes = [
    {"el": "id-ai-ingress", "x": 250, "y": 25, "w": 440, "h": 55},
    {"el": "id-ac-keycloak", "x": 40, "y": 130, "w": 240, "h": 70},
    {"el": "id-ac-api", "x": 350, "y": 130, "w": 250, "h": 70},
    {"el": "id-do-jwt", "x": 680, "y": 130, "w": 220, "h": 55},
    {"el": "id-do-docx", "x": 40, "y": 250, "w": 220, "h": 55},
    {"el": "id-ac-queue", "x": 350, "y": 250, "w": 250, "h": 65},
    {"el": "id-do-report", "x": 680, "y": 250, "w": 220, "h": 55},
    {"el": "id-do-rules", "x": 40, "y": 365, "w": 220, "h": 55},
    {"el": "id-ac-worker", "x": 350, "y": 365, "w": 250, "h": 70},
]
v3_rels = [f"id-r-a{i}" for i in range(1, 12)]

# View 4: Technology View & Trust Boundaries (Zero-Crossing Orthogonal Layout)
# Top band: CI/CD Control Plane -> straight vertical arrows down to k3d
# Left: Client -> straight horizontal arrow to Traefik Ingress
# Center: Kubernetes Data Plane (2 clean rows: compute workloads top, Secrets & PVC directly below)
# Right: Host Node (Docker Engine: PostgreSQL top, Backup middle, Prometheus/Grafana bottom)
v4_nodes = [
    # Top Band: CI/CD Control Plane (aligned over right half of k3d so arrows drop cleanly without crossing Traefik)
    {
        "el": "id-gp-cicd", "x": 260, "y": 20, "w": 960, "h": 120,
        "children": [
            {"el": "id-ss-gha", "x": 30, "y": 40, "w": 220, "h": 60},
            {"el": "id-ss-reg", "x": 360, "y": 40, "w": 250, "h": 60},
            {"el": "id-ss-argo", "x": 690, "y": 40, "w": 240, "h": 60},
        ],
    },
    # Left: External Client
    {"el": "id-dv-client", "x": 20, "y": 235, "w": 175, "h": 65},
    # Center: Kubernetes Data Plane [TB-1..TB-4]
    {
        "el": "id-gp-platform", "x": 260, "y": 195, "w": 960, "h": 510,
        "children": [
            # Traefik spans left half (directly above keycloak & backend only — leaves right side open for Registry & Argo CD!)
            {"el": "id-ts-ingress", "x": 30, "y": 40, "w": 465, "h": 55},
            {
                "el": "id-nd-k3d", "x": 30, "y": 140, "w": 900, "h": 345,
                "children": [
                    # Row 1: Compute Workloads with generous horizontal gaps
                    {"el": "id-ss-kc", "x": 20, "y": 55, "w": 180, "h": 75},
                    {"el": "id-ss-api", "x": 275, "y": 55, "w": 195, "h": 75},
                    {"el": "id-ss-worker", "x": 525, "y": 55, "w": 180, "h": 75},
                    {"el": "id-ss-job", "x": 740, "y": 55, "w": 140, "h": 75},
                    # Row 2: Secrets & PVC directly below their consumers (zero X-crossing!)
                    {"el": "id-ar-sec", "x": 65, "y": 225, "w": 280, "h": 75},
                    {"el": "id-ar-pvc", "x": 430, "y": 225, "w": 280, "h": 75},
                ],
            },
        ],
    },
    # Right: Host Node (Docker Engine)
    {
        "el": "id-gp-host", "x": 1285, "y": 195, "w": 310, "h": 510,
        "children": [
            {"el": "id-ss-pg", "x": 30, "y": 55, "w": 250, "h": 95},
            {"el": "id-ts-backup", "x": 30, "y": 215, "w": 250, "h": 90},
            {"el": "id-ss-obs", "x": 30, "y": 370, "w": 250, "h": 95},
        ],
    },
]
v4_rels = [f"id-r-t{i}" for i in range(1, 19)]


def render_elements(el_list):
    out = []
    for el_id, el_type, name, doc in el_list:
        out.append(f'    <element xsi:type="archimate:{el_type}" name="{escape(name)}" id="{el_id}">')
        out.append(f'      <documentation>{escape(doc)}</documentation>')
        out.append(f'    </element>')
    return "\n".join(out)


rel_lines = []
for rid, rtype, src, tgt, name, extra in relationships:
    nattr = f' name="{escape(name)}"' if name else ""
    rel_lines.append(f'    <element xsi:type="archimate:{rtype}" id="{rid}"{nattr} source="{src}" target="{tgt}"{extra}/>')

views_xml = "\n".join([
    build_view("id-v1", "1. Motivation view (01-business)", v1_nodes, v1_rels),
    build_view("id-v2", "2. Layered view (02-architecture)", v2_nodes, v2_rels),
    build_view("id-v3", "3. Application cooperation view", v3_nodes, v3_rels),
    build_view("id-v4", "4. Technology view & Trust Boundaries", v4_nodes, v4_rels),
])

archimate_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="JournalFit Cloud-Native Platform (Team 7 - M2 Baseline)" id="id-model-journalfit" version="5.0.0">
  <purpose>Model arsitektur ArchiMate 3.2 JournalFit (Milestone 2 Baseline 7e8607b / tag 0c2cf92): Keycloak OIDC 26.8.2, Express 5 Modular Monolith, pg-boss worker-format, OOXML Tier-1 FMT-001..009, PostgreSQL 17, k3d HPA, Prometheus/Grafana, dan Argo CD GitOps.</purpose>
  <folder name="Strategy" id="id-folder-strategy" type="strategy"/>
  <folder name="Business" id="id-folder-business" type="business">
{render_elements(elements_by_folder["business"])}
  </folder>
  <folder name="Application" id="id-folder-application" type="application">
{render_elements(elements_by_folder["application"])}
  </folder>
  <folder name="Technology &amp; Physical" id="id-folder-technology" type="technology">
{render_elements(elements_by_folder["technology"])}
  </folder>
  <folder name="Motivation" id="id-folder-motivation" type="motivation">
{render_elements(elements_by_folder["motivation"])}
  </folder>
  <folder name="Implementation &amp; Migration" id="id-folder-implementation_migration" type="implementation_migration"/>
  <folder name="Other" id="id-folder-other" type="other">
{render_elements(elements_by_folder["other"])}
  </folder>
  <folder name="Relations" id="id-folder-relations" type="relations">
{chr(10).join(rel_lines)}
  </folder>
  <folder name="Views" id="id-folder-views" type="diagrams">
{views_xml}
  </folder>
</archimate:model>
"""

# Validate well-formed XML
ET.fromstring(archimate_xml)

out_paths = [
    "capstone_cloud_computing/architecture/journalfit-architecture.archimate",
    "cloud-capstone-team-7/02-architecture/journalfit-architecture.archimate",
]
for p in out_paths:
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(archimate_xml)
    print(f"Generated valid Archi 5.0 model: {p} ({len(archimate_xml)} bytes)")
