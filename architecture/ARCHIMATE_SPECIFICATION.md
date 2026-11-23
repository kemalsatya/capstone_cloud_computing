# Spesifikasi Arsitektur ArchiMate 3.2 — JournalFit Platform (Tim 7)

**Milestone:** M1 — Architecture Baseline  
**Penanggung Jawab:** Anggota 1 & Anggota 2 (Ditinjau oleh Seluruh Tim)  
**Berkas Model & Capture ArchiMate 3.2 (Pure Archi 5.0):**
- 📐 Native Archi Model: [journalfit-architecture.archimate](file:///C:/Users/liaur/Documents/Tugas-Tugas%20Kuliah/Semester%20Ganjil/Semester%205/CloudComputing/Project%20CloudComputing/capstone_cloud_computing/architecture/journalfit-architecture.archimate)
- 🖼️ View 1 — Motivation View: [images/01-motivation-view.png](file:///C:/Users/liaur/Documents/Tugas-Tugas%20Kuliah/Semester%20Ganjil/Semester%205/CloudComputing/Project%20CloudComputing/capstone_cloud_computing/architecture/images/01-motivation-view.png)
- 🖼️ View 2 — Layered View: [images/02-layered-view.png](file:///C:/Users/liaur/Documents/Tugas-Tugas%20Kuliah/Semester%20Ganjil/Semester%205/CloudComputing/Project%20CloudComputing/capstone_cloud_computing/architecture/images/02-layered-view.png)
- 🖼️ View 3 — Application Cooperation View: [images/03-application-cooperation-view.png](file:///C:/Users/liaur/Documents/Tugas-Tugas%20Kuliah/Semester%20Ganjil/Semester%205/CloudComputing/Project%20CloudComputing/capstone_cloud_computing/architecture/images/03-application-cooperation-view.png)
- 🖼️ View 4 — Technology & Trust Boundaries View: [images/04-technology-trust-boundaries.png](file:///C:/Users/liaur/Documents/Tugas-Tugas%20Kuliah/Semester%20Ganjil/Semester%205/CloudComputing/Project%20CloudComputing/capstone_cloud_computing/architecture/images/04-technology-trust-boundaries.png)

---

## 1. Konsep & Notasi Standar ArchiMate 3.2

Diagram arsitektur JournalFit disusun mengikuti standar resmi **The Open Group ArchiMate 3.2 Specification** dengan pembagian 3 layer hierarkis dan skema warna standar industri:

```text
+---------------------------------------------------------------------------------------+
|  1. BUSINESS ARCHITECTURE LAYER (Kuning #FFFDE7 / #FFF2B2)                            |
|     Actors: Author, Journal Editor                                                    |
|     Services: SSO Login, Manuscript Pre-Check, Rule Management                        |
|     Process: Authenticate -> Upload -> Deterministic Audit -> Report                  |
+---------------------------------------------------------------------------------------+
|  2. APPLICATION ARCHITECTURE LAYER (Biru #EBF5FB / #BBE0F2)                           |
|     Interface: Traefik Ingress Gateway (:8088 / IngressRoute)                         |
|     Components: Keycloak OIDC Provider (Quarkus JVM, Realm 'journalfit')              |
|                 JournalFit Modular Monolith Backend (Express 5, Auth/Rules/Mammoth)   |
|     Data Objects: Bearer JWT Token, .docx Manuscript, Rule Template, Audit Report     |
+---------------------------------------------------------------------------------------+
|  3. TECHNOLOGY & INFRASTRUCTURE LAYER (Hijau #E8F8F5 / #C8E6C9)                       |
|     Kubernetes Cluster (k3d-capstone):                                                |
|       - Worker Node (k3d-capstone-agent-0)                                            |
|       - Pods: journalfit-backend (2-3 pods HPA CPU 70%, UID 10001, drop ALL)          |
|       - Pod: keycloak (1 pod Recreate, UID 1000)                                      |
|       - Volume: journalfit-uploads PVC (1Gi local-path, RWO)                          |
|     Host Node (Docker Engine):                                                        |
|       - PostgreSQL 17 Alpine Container (:5432, DB 'journalfit' & 'keycloak')          |
|       - Prometheus TSDB Container (:9090, retensi 3d) & Grafana Dashboard (:3000)     |
|     CI/CD Delivery Control Plane:                                                     |
|       - GitHub Actions CI (Test + Trivy Gate) -> Local Registry (:5001) -> Argo CD   |
+---------------------------------------------------------------------------------------+
```

---

## 2. Pemetaan Elemen ArchiMate ke Artefak Kode Nyata

| Layer ArchiMate | Elemen Model | Tipe ArchiMate | Representasi Kode / Manifest Nyata |
| :--- | :--- | :--- | :--- |
| **Business** | Author (Penulis) | `Business Actor` | Pengguna yang mengunggah naskah (user `author.a`, `author.b`). |
| **Business** | Journal Editor | `Business Actor` | Pengelola jurnal yang meninjau laporan & mengonfigurasi aturan (`editor.a`). |
| **Business** | Pre-Submission Compliance Lifecycle | `Business Process` | Alur bisnis 4 langkah dari login hingga unduh laporan perbaikan naskah. |
| **Application** | Traefik Ingress Gateway | `Application Interface` | [deployment/ingress.yaml](file:///C:/Users/liaur/Documents/Tugas-Tugas%20Kuliah/Semester%20Ganjil/Semester%205/CloudComputing/Project%20CloudComputing/capstone_cloud_computing/deployment/ingress.yaml) (Host: `journalfit.localhost` & `keycloak.localhost`). |
| **Application** | Keycloak OIDC Provider | `Application Component` | [deployment/keycloak/deployment.yaml](file:///C:/Users/liaur/Documents/Tugas-Tugas%20Kuliah/Semester%20Ganjil/Semester%205/CloudComputing/Project%20CloudComputing/capstone_cloud_computing/deployment/keycloak/deployment.yaml) (Realm `journalfit`, client `journalfit-app`). |
| **Application** | Auth & Claims Middleware | `Application Component` | [source/src/common/middlewares/auth.js](file:///C:/Users/liaur/Documents/Tugas-Tugas%20Kuliah/Semester%20Ganjil/Semester%205/CloudComputing/Project%20CloudComputing/capstone_cloud_computing/source/src/common/middlewares/auth.js) (Validasi RS256 JWKS & klaim `tenant_id`). |
| **Application** | DOCX Parser & Rule Engine | `Application Component` | [source/src/modules/manuscripts/services/manuscript.service.js](file:///C:/Users/liaur/Documents/Tugas-Tugas%20Kuliah/Semester%20Ganjil/Semester%205/CloudComputing/Project%20CloudComputing/capstone_cloud_computing/source/src/modules/manuscripts/services/manuscript.service.js) (Parser `mammoth`, cek batas kata/abstrak). |
| **Application** | Bearer JWT Access Token | `Data Object` | Token bertanda tangan digital RS256 berisi klaim identitas resmi. |
| **Application** | Format Rule Template | `Data Object` | Tabel PostgreSQL `format_rule_templates` (aturan spesifik per tenant). |
| **Technology** | `k3d-capstone-agent-0` | `Node` | Worker node k3d berbasis containerd tempat pod dijalankan. |
| **Technology** | Pod `journalfit-backend` | `System Software` | 2–3 pod HPA ([deployment/deployment.yaml](file:///C:/Users/liaur/Documents/Tugas-Tugas%20Kuliah/Semester%20Ganjil/Semester%205/CloudComputing/Project%20CloudComputing/capstone_cloud_computing/deployment/deployment.yaml)), `UID 10001`, `drop ALL`. |
| **Technology** | Pod `keycloak` | `System Software` | 1 pod Recreate ([deployment/keycloak/deployment.yaml](file:///C:/Users/liaur/Documents/Tugas-Tugas%20Kuliah/Semester%20Ganjil/Semester%205/CloudComputing/Project%20CloudComputing/capstone_cloud_computing/deployment/keycloak/deployment.yaml)), `UID 1000`. |
| **Technology** | PVC `journalfit-uploads` | `Artifact (Storage)` | 1Gi `local-path` RWO ([deployment/pvc.yaml](file:///C:/Users/liaur/Documents/Tugas-Tugas%20Kuliah/Semester%20Ganjil/Semester%205/CloudComputing/Project%20CloudComputing/capstone_cloud_computing/deployment/pvc.yaml)) dimount ke `/app/uploads`. |
| **Technology** | PostgreSQL 17 Container | `System Software` | [docker-compose.yml](file:///C:/Users/liaur/Documents/Tugas-Tugas%20Kuliah/Semester%20Ganjil/Semester%205/CloudComputing/Project%20CloudComputing/capstone_cloud_computing/docker-compose.yml) melayani database `journalfit` dan `keycloak`. |
| **Technology** | Argo CD Controller | `System Software` | Operator GitOps mengawasi perubahan manifest di Git dan melakukan auto-sync ke kluster. |

---

## 3. Batas Kepercayaan (*Trust Boundaries*) & Batas Kegagalan (*Failure Boundaries*)

### A. Batas Kepercayaan (TB)
- **[TB-1] Perimeter Boundary:** Klien publik hanya berinteraksi melalui Traefik Ingress `:8088`. Tidak ada port database atau container backend yang terekspos langsung ke luar.
- **[TB-2] Identity & Cryptographic Boundary:** Otentikasi ditegakkan via Keycloak OIDC (`quay.io/keycloak/keycloak:26.8.2`). Backend memvalidasi signature RS256 menggunakan public keys yang diambil dari internal JWKS endpoint (`http://keycloak.default.svc.cluster.local/realms/journalfit/protocol/openid-connect/certs`). Header `X-Tenant-ID` klien diabaikan saat `AUTH_MODE=jwt`.
- **[TB-3] Multi-Tenant Boundary:** Penegakan isolasi tenant dilakukan di lapis query DB & middleware: upaya akses naskah lintas-tenant mengembalikan `HTTP 404 Not Found` (mencegah enumerasi ID naskah antar-tenant).
- **[TB-4] Container Hardening Boundary:** Pod backend berjalan dengan pengguna non-root `UID 10001`, `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`, dan `automountServiceAccountToken: false`.

### B. Batas Kegagalan (FB)
- **[FB-1] Pod Failure Self-Healing:** Jika satu pod backend mati/dihapus, ReplicaSet Kubernetes otomatis menumbuhkan pod baru dalam waktu ~32.5 detik. Uji rolling update dengan 777 request mencatat `0 failed requests`.
- **[FB-2] Storage Pinning Boundary:** PVC `1Gi local-path` RWO mengikat pod pada node `k3d-capstone-agent-0`. Pada roadmap v2, penyimpanan akan dipindahkan ke Object Storage (MinIO / S3) untuk mendukung skalabilitas multi-node.
- **[FB-3] Database Disaster Recovery:** Prosedur restore terisolasi membuktikan pemulihan 6 tabel relasional dalam **1.41 detik** (RTO target `< 5 menit`).

---

## 4. Cara Meninjau & Menggunakan Model ArchiMate

1. **Buka di Aplikasi Archi:** Buka berkas [journalfit-architecture.archimate](file:///C:/Users/liaur/Documents/Tugas-Tugas%20Kuliah/Semester%20Ganjil/Semester%205/CloudComputing/Project%20CloudComputing/capstone_cloud_computing/architecture/journalfit-architecture.archimate) menggunakan Archi 5.0 (`File -> Open...`), lalu buka keempat diagram pada folder `Views`.
2. **Gambar Capture Langsung:** Hasil ekspor langsung dari Archi tersedia di folder `architecture/images/` dan tergabung pada `02_evidence.jpg`.
