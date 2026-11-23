# 02 - System Architecture & Trust Boundaries

**Milestone:** M1 — Architecture Baseline (Bobot Rubrik: 15% terpadu bersama ADR)  
**Penanggung Jawab:** Anggota 1 & Anggota 2 (Ditinjau oleh Seluruh Tim)  
**Berkas Bukti Target:** `02_evidence.jpg`

---

## 1. Standar Evidence (Guideline 2 Section 9)

| Field | Detail |
| :--- | :--- |
| **Scope** | Desain arsitektur end-to-end cloud-native sistem JournalFit: integrasi Identity Provider (Keycloak OIDC), API Gateway (Traefik Ingress), beban kerja komputasi (Express 5 backend pod ber-HPA), penyimpanan persisten (PVC RWO + PostgreSQL 17 multi-tenant), observabilitas (Prometheus & Grafana), serta jalur pengiriman otomatis (CI GitHub Actions & GitOps Argo CD). |
| **Owner** | Anggota 1 (Implementasi modular monolith & integrasi JWKS), Anggota 2 (Topologi k3d, Ingress Traefik, manifest K8s, & boundaries), didukung Anggota 3 (Argo CD & CI/CD) dan Anggota 4 (Audit security context & isolasi tenant). |
| **Source / Version** | `architecture/index.md`, `deployment/*.yaml`, `deployment/keycloak/*.yaml`, `source/src/app.js`, `source/src/common/middlewares/auth.js`, commit `1d7f827` (Keycloak OIDC baseline). |
| **Timestamp** | Baseline arsitektur awal: 2026-11-09 \| Sinkronisasi Keycloak OIDC: 2026-11-22 |
| **Method** | Analisis dekomposisi komponen C4 Container Level, pemetaan batas kepercayaan (*trust boundaries*), analisis batas kegagalan (*failure boundaries*), serta verifikasi runtime kluster k3d. |
| **Observation** | Sistem memisahkan secara tegas antara Control Plane (CI/CD GitOps) dan Data Plane (Ingress, App, Keycloak, DB); seluruh trafik aplikasi diotentikasi via token RS256 terverifikasi JWKS; container berjalan dengan least-privilege (`UID 10001`, `drop ALL`); dependensi disk stateful dipusatkan pada PVC 1Gi dan DB relasional. |
| **Interpretation** | Arsitektur modular monolith cloud-native berhasil menyeimbangkan efisiensi sumber daya (hemat RAM di lab lokal) dengan kesiapan skalabilitas produksi (*cloud-ready*) tanpa adanya tight coupling antar-modul. |
| **Limitation** | PVC `ReadWriteOnce` (RWO) mengikat replika pod backend pada node worker tunggal (`k3d-capstone-agent-0`); Keycloak dev client masih menggunakan *Direct Access Grants* (password flow); dan koneksi DB antar-pod masih mengandalkan jaringan internal k3d/Docker tanpa mTLS. |
| **Decision Supported** | Mendukung **ADR-001** (Modular Monolith), **ADR-002** (PostgreSQL Multi-Tenancy), **ADR-003** (Non-root `UID 10001`), **ADR-004** (GitOps Argo CD), **ADR-005** (PVC Storage Pinning), dan **ADR-009** (Keycloak OIDC SSO). |

---

## 2. Diagram Arsitektur Visual & Aliran Data (Provider-Neutral)

```text
       +-----------------------------------------------------------------------------------+
       |                               CLIENT & INGRESS LAYER                              |
       +-----------------------------------------------------------------------------------+
       |  [Author / Editor Client]                                                         |
       |       |                                                                           |
       |       | 1. POST /token (grant_type=password)                                      |
       |       +------------------------------------+                                      |
       |       | 2. HTTP (:8088) + Bearer JWT       |                                      |
       |       v                                    v                                      |
       |  +-----------------------------------------------------------------------------+  |
       |  |                       Traefik Ingress Controller (:8088)                     |  |
       |  |   - Host: journalfit.localhost  --> Service: journalfit-backend (:80->8000) |  |
       |  |   - Host: keycloak.localhost    --> Service: keycloak (:80->8080)           |  |
       |  +-----------------------------------------------------------------------------+  |
       +---------------------------------------|-------------------------------------------+
                                               |
       +---------------------------------------v-------------------------------------------+
       |                  KUBERNETES DATA PLANE (k3d Cluster: k3d-capstone)                |
       +-----------------------------------------------------------------------------------+
       |                                                                                   |
       |   +---------------------------------------------------------------------------+   |
       |   | Keycloak OIDC Workload (1 Pod - Recreate)                                 |   |
       |   | - Image: quay.io/keycloak/keycloak:26.8.2 (Quarkus JVM, UID 1000)         |   |
       |   | - Endpoint: /realms/journalfit/.well-known/openid-configuration           |   |
       |   | - JWKS Keys: /realms/journalfit/protocol/openid-connect/certs (RS256)     |   |
       |   +---------------------------------------------------------------------------+   |
       |                                     ^                                             |
       |                                     | 3. Internal JWKS Key Verification           |
       |                                     |    (http://keycloak.default.svc.cluster.local)|
       |                                     |                                             |
       |   +---------------------------------+-----------------------------------------+   |
       |   | JournalFit Modular Monolith Backend (HPA Min: 2, Max: 3 Pods @ CPU 70%)   |   |
       |   | - Image: journalfit-backend:latest (node:22-alpine, UID 10001, drop ALL) |   |
       |   | - Probes: Liveness (/health/live) & Readiness (/health/ready)             |   |
       |   | - Auth Middleware: jose RS256 JWKS Cache + Tenant Claim + RBAC Enforcement|   |
       |   | - Secret Injection: DB_PASSWORD via K8s Secret (journalfit-backend-secret)|   |
       |   |                                                                           |   |
       |   |    [Pod 1 (UID: ...pjtkd)]           [Pod 2 (UID: ...tkpbl)]              |   |
       |   +------------------+------------------------------+-------------------------+   |
       |                      |                              |                             |
       |                      +--------------+---------------+                             |
       |                                     |                                             |
       |        +----------------------------+-----------------------------+               |
       |        | (Shared Volume Mount)                                    | (Scrape)      |
       |        v                                                          v               |
       |   +----------------------------------+            +---------------------------+   |
       |   | PVC: journalfit-uploads          |            | Prometheus (:9090)        |   |
       |   | - 1Gi local-path (RWO)           |            | -> TSDB 3-Day Retention   |   |
       |   | - Mount: /app/uploads (.docx)    |            | -> Grafana Dashboard(:3000|   |
       |   +----------------------------------+            +---------------------------+   |
       +-------------------------------------|---------------------------------------------+
                                             | TCP :5432
                                             v
       +-----------------------------------------------------------------------------------+
       |                       PERSISTENT DATABASE LAYER (PostgreSQL 17)                   |
       +-----------------------------------------------------------------------------------+
       |  PostgreSQL 17 Alpine Container (Docker Compose / host.docker.internal)           |
       |  ├── Database 'journalfit': 6 Tabel Relasional Terisolasi (tenants, users,        |
       |  │   format_rule_templates, manuscripts, check_results, findings)                 |
       |  └── Database 'keycloak': Konfigurasi realm journalfit, users, clients, claims    |
       +-----------------------------------------------------------------------------------+

       +-----------------------------------------------------------------------------------+
       |                          CI/CD CONTROL PLANE (Out-of-Band)                        |
       +-----------------------------------------------------------------------------------+
       |  Developer Commit -> GitHub PR -> GitHub Actions CI (Test + Trivy Scan Gate)     |
       |  -> Immutable OCI Image (:5001/journalfit-backend:<SHA-7>)                        |
       |  -> Argo CD GitOps Operator (Polls Git Manifest -> Auto-Sync / Self-Heal k3d)    |
       +-----------------------------------------------------------------------------------+
```

---

## 3. Analisis Batas Kepercayaan & Batas Kegagalan

### A. Batas Kepercayaan (*Trust Boundaries*)
1. **External to Ingress Boundary (Perimeter):**
   - Klien luar hanya dapat mengakses sistem melalui Ingress Traefik pada port `:8088` dengan routing berbasis domain `Host` (`journalfit.localhost` dan `keycloak.localhost`).
   - Tidak ada pod backend atau database yang diekspos langsung ke jaringan publik (*zero direct container exposure*).
2. **Authentication & Token Boundary (Keycloak OIDC / RS256):**
   - Klien memperoleh token JWT bertanda tangan digital RS256 dari Keycloak.
   - Backend memverifikasi tanda tangan JWT secara kriptografis menggunakan public keys dari endpoint JWKS internal (`http://keycloak:8080/.../certs`).
   - Header mentah `X-Tenant-ID` dari klien **diabaikan sepenuhnya** saat `AUTH_MODE=jwt`. Identitas tenant wajib dibaca dari klaim resmi `tenant_id` di dalam JWT yang telah divalidasi.
3. **Multi-Tenant Isolation Boundary:**
   - Akses lintas-tenant atau terhadap naskah milik tenant lain ditolak secara deterministik dengan `HTTP 404 Not Found` (mencegah *tenant enumeration*).
   - Hak akses peran (RBAC) ditegakkan di middleware: `author` hanya berhak mengunggah dan membaca naskah miliknya, sedangkan `editor` hanya berhak mereview naskah dalam tenant yang sama (aksi tidak sah menghasilkan `HTTP 403 Forbidden`).
4. **Secret Boundary:**
   - Berkas `.env` dan password riil diblokir oleh `.gitignore`.
   - Manifest `configmap.yaml` hanya menyimpan konfigurasi non-sensitif (`PORT`, `DB_HOST`, `DB_NAME`, `AUTH_MODE`). Kredensial rahasia (`DB_PASSWORD`) disuntikkan secara dinamis melalui Kubernetes Secret (`secretKeyRef`).
5. **Least Privilege Container Boundary:**
   - Pod backend berjalan sebagai pengguna non-root `UID 10001` (`runAsNonRoot: true`, `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`, `automountServiceAccountToken: false`).
   - Pod Keycloak berjalan sebagai pengguna non-root `UID 1000`.

### B. Batas Kegagalan (*Failure Boundaries*)
1. **Backend Pod Failure Boundary:**
   - Dikelola oleh Kubernetes ReplicaSet dengan target minimum 2 replika (`deployment.yaml`).
   - Strategi rolling update `maxUnavailable: 0` dan `maxSurge: 1` menjamin tidak ada penurunan kapasitas selama deployment.
   - Jika satu pod mengalami crash atau dihapus (`kubectl delete pod`), traffic dialihkan ke pod sehat yang lolos `readinessProbe (/health/ready)`, sementara pod pengganti dipulihkan otomatis dalam ~32.5 detik tanpa request gagal (0 failure).
2. **Storage Failure Boundary (PVC local-path):**
   - Volume unggahan `.docx` menggunakan PersistentVolumeClaim 1Gi `ReadWriteOnce` (RWO). Berkas tetap aman saat pod crash/restart.
   - *Residual Risk:* Karena menggunakan driver `local-path`, replika terkunci pada 1 node (`k3d-capstone-agent-0`). Pada roadmap v2, penyimpanan berkas akan dipindahkan ke Object Storage multi-AZ (MinIO / Garage S3).
3. **Database Failure Boundary (RPO & RTO):**
   - Database PostgreSQL berjalan mandiri di luar lifecycle pod aplikasi.
   - Prosedur disaster recovery menggunakan `db-backup-restore.sh` membuktikan RTO aktual **1.41 detik** (jauh di bawah target SLO `< 5 menit`) dengan data 6 tabel terverifikasi cocok 100%.

---

## 4. Panduan Visual `02_evidence.jpg`
Simpan diagram visual arsitektur lengkap di atas (dapat diekspor dari Mermaid, Draw.io, atau hasil capture teks terformat rapi) sebagai file `02_evidence.jpg` di folder ini.
