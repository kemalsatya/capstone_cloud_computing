# 02 - System Architecture & Trust Boundaries

**Milestone:** M1 — Architecture Baseline (Bobot Rubrik: 15% bersama ADR)  
**Penanggung Jawab:** Anggota 1 & Anggota 2  
**Berkas Bukti Target:** `02_evidence.jpg`

---

## 1. Diagram Arsitektur & Aliran Data (Provider-Neutral)

```text
  [Author / Editor Client]
            |
            | HTTP (:8088) + Host: journalfit.localhost + X-Tenant-ID
            v
  +-------------------------------------------------------------------+
  |  Kubernetes Cluster (k3d Control Plane + Worker Node)             |
  |                                                                   |
  |  [Traefik Ingress Controller]                                     |
  |            |                                                      |
  |            v                                                      |
  |  [Service: journalfit-backend (ClusterIP :80 -> :8000)]           |
  |            |                                                      |
  |     +------+------+          (HPA CPU Target 70%: 2-3 Pods)       |
  |     v             v                                               |
  |  [Pod 1]       [Pod 2]   <-- node:22-alpine (UID 10001, drop ALL) |
  |   |               |      <-- Liveness /health/live                |
  |   |               |      <-- Readiness /health/ready              |
  |   +-------+-------+                                               |
  |           |                                                       |
  |           +---> [PVC: journalfit-uploads (1Gi RWO /app/uploads)]  |
  |           +---> [GET /metrics] ---> [Prometheus :9090] -> [Grafana :3000]
  +-----------|-------------------------------------------------------+
              | TCP :5432 (DB_PASSWORD via K8s Secret)
              v
  [PostgreSQL 17 Database (journalfit)]
   └── 6 Tabel Relasional Terisolasi Tenant (tenants, users, templates,
       manuscripts, check_results, findings)

  [CI/CD Control Plane (Terpisah dari Data Plane)]
   GitHub Push/PR -> GitHub Actions (Test + Trivy) -> Local Registry (:5001) -> Argo CD (GitOps)
```

## 2. Trust & Failure Boundaries
1. **Control Plane vs Data Plane:** GitHub Actions, Registry OCI (`:5001`), dan Argo CD berada di jalur kontrol rilis; kluster Kubernetes & PostgreSQL melayani request pengguna di data plane.
2. **External Trust Boundary (Ingress + Tenant Middleware):** Trafik publik masuk hanya melalui port Ingress menuju Service internal; endpoint bisnis mewajibkan `X-Tenant-ID` (`400` jika kosong) dan memverifikasi kepemilikan record (`403` jika lintas tenant).
3. **Secret Boundary:** ConfigMap hanya menyimpan variabel non-rahasia, sedangkan `DB_PASSWORD` disuntikkan via Kubernetes Secret (`secretKeyRef`).
4. **Failure Boundary:** Jika 1 pod gagal, Kubernetes Readiness Probe menghentikan routing dan mengganti pod dalam ~32 detik tanpa kehilangan berkas `.docx` berkat PVC `ReadWriteOnce`.

## 3. Panduan Pengambilan `02_evidence.jpg`
- Buat/ekspor diagram arsitektur (termasuk batas kepercayaan / *trust boundary*, *failure boundary*, dan atribut kualitas) ke format `.jpg` dengan nama `02_evidence.jpg` di folder ini.
