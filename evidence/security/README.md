# 06 - Security (IAM, Negative Auth, Secrets & Vulnerability Scan)

**Milestone:** M6 — Security (Bobot Rubrik: 10%)  
**Penanggung Jawab Utama (Lead):** Anggota 4  
**Pendukung Teknis:** Anggota 1 (Middleware/Tenant Enforcement), Anggota 3 (CI/CD Trivy Pipeline)  
**Berkas Bukti Target:** `06_evidence.jpg`

---

## 1. Standar Evidence (Guideline 2 Section 9)

| Field | Detail |
| :--- | :--- |
| **Scope** | Kontrol keamanan lapis aplikasi (validasi `X-Tenant-ID` & isolasi multi-tenant, mock token endpoint), manajemen konfigurasi/secret, hardening container (`UID 10001`, `drop ALL` capability), serta pemindaian kerentanan image & dependensi dengan Trivy. |
| **Owner** | Anggota 4 (Eksekusi audit, curl negative test, analisis risiko Trivy), Anggota 1 (Implementasi `requireTenant` & ownership check), Anggota 3 (Integrasi Trivy pada `.github/workflows/ci.yaml`). |
| **Source / Version** | `source/src/common/middlewares/tenant.js`, `source/src/modules/manuscripts/`, `source/src/modules/auth/`, `deployment/deployment.yaml`, `.github/workflows/ci.yaml`, `source/Dockerfile`. |
| **Timestamp** | Log awal: 2026-11-10 \| Verifikasi sinkronisasi: 2026-11-18 |
| **Method** | (1) Negative HTTP tests dengan `curl` tanpa header (`400`) dan lintas-tenant (`403`), plus positive test (`200`); (2) Audit secret Git (`git grep`) & inspeksi `securityContext` pod; (3) Trivy image scan (`CRITICAL,HIGH`). |
| **Observation** | Request tanpa `X-Tenant-ID` ditolak (`400`), akses `tenant-b` terhadap naskah `ms-001` milik `tenant-a` ditolak (`403 Forbidden`), image berjalan dengan user non-root `UID 10001` tanpa `CAP_*`, dan tidak ada password riil di Git. |
| **Interpretation** | Batas kepercayaan (*trust boundary*) antar-tenant dan pemisahan secret runtime dari kode sumber berjalan sesuai prinsip *least privilege* dan *defense in depth*. |
| **Limitation** | (1) Implementasi JWT+JWKS Keycloak sudah tersedia (`AUTH_MODE=jwt`, lihat pembaruan §5), tetapi artefak uji 400/403 di bawah belum diregenerasi memakai token Keycloak; (2) Secret K8s dibuat imperatif saat inisialisasi kluster, belum memakai External Secrets Operator. |
| **Decision Supported** | Mendukung **ADR-002** (isolasi tenant tingkat aplikasi), **ADR-003** (non-root `UID 10001`), dan **ADR-006** (pemisahan secret & gate Trivy CI). |

---

## 2. Pembagian Tugas Anggota & Checklist Eksekusi

| Sub-Tugas | Pemilik | Perintah / Verifikasi Nyata |
| :--- | :--- | :--- |
| **6.1 Positive & Negative Auth Test** | Anggota 4 (dibantu Anggota 1) | Menguji akses `ms-001` milik `tenant-a`: tanpa header -> `400`, header `tenant-b` -> `403 Forbidden`, header `tenant-a` -> `200 OK`, rute tidak ada -> `404`. Bukti tersimpan di `no-header-400.txt`, `negative-test-403.txt`, `tenant-access-test.txt`. |
| **6.2 Secret & Container Hardening Audit** | Anggota 4 (dibantu Anggota 2) | Membuktikan `.env` diabaikan `.gitignore`, tidak ada secret produksi di Git, `deployment/deployment.yaml` memakai `secretKeyRef: journalfit-backend-secret`, `runAsNonRoot: true`, `runAsUser: 10001`, `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`. |
| **6.3 Trivy Scan & Risk Interpretation** | Anggota 4 (dibantu Anggota 3) | Menjalankan `trivy image --severity HIGH,CRITICAL` (di CI `.github/workflows/ci.yaml` atau via Docker lokal `aquasec/trivy`) dan membuat tabel prioritas remediasi risiko. |

---

## 3. Ringkasan Hasil Uji Keamanan

### A. Pengujian Isolasi Tenant & Negative Authorization (`curl`)
1. **Tanpa Header `X-Tenant-ID` (Negative Test -> `400 Bad Request`):**
   - Request: `GET http://localhost:8088/api/manuscripts/ms-001/report` (Header `Host: journalfit.localhost`, tanpa `X-Tenant-ID`)
   - Respons aktual (`no-header-400.txt`):
     `HTTP/1.1 400 Bad Request` -> `{"success":false,"message":"Header X-Tenant-ID is required for tenant-scoped operations."}`
2. **Akses Lintas-Tenant (Negative Isolation Test -> `403 Forbidden`):**
   - Request: `GET /api/manuscripts/ms-001/report` dengan `X-Tenant-ID: tenant-b` (padahal `ms-001` dimiliki `tenant-a`)
   - Respons aktual (`negative-test-403.txt`):
     `HTTP/1.1 403 Forbidden` -> `{"success":false,"status":403,"message":"Access forbidden: Tenant 'tenant-b' is not authorized to access manuscript 'ms-001' owned by 'tenant-a'"}`
3. **Akses Sah Pemilik Tenant (Positive Test -> `200 OK`):**
   - Request: `GET /api/manuscripts/ms-001/report` dengan `X-Tenant-ID: tenant-a`
   - Respons aktual (`tenant-access-test.txt`): `HTTP/1.1 200 OK` mengembalikan detail `ms-001` & `format_score: 85`.

### B. Kontrol Konfigurasi, Secret & Container Hardening
- **Least Privilege Pod & Container (`deployment/deployment.yaml`):**
  - `automountServiceAccountToken: false` (mencegah pod mengakses API Kubernetes tanpa izin).
  - `runAsNonRoot: true`, `runAsUser: 10001`, `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`.
- **Secret Separation:**
  - `deployment/configmap.yaml` hanya memuat konfigurasi non-sensitif (`NODE_ENV`, `PORT`, `DB_HOST`, `DB_NAME`, `DB_USER`).
  - `DB_PASSWORD` disuntikkan melalui `secretKeyRef` -> `journalfit-backend-secret`.
  - `.gitignore` memblokir file `.env`, `*.pem`, `*.key`, `secret*.yaml` (hanya `.env.example` yang di-commit ke Git).

### C. Pemindaian Kerentanan (Trivy) & Interpretasi Berbasis Risiko
Pada pipeline CI (`.github/workflows/ci.yaml`), job `build-scan-artifact` menjalankan `aquasecurity/trivy-action` (`vuln-type: os,library`, `severity: CRITICAL,HIGH`, `ignore-unfixed: true`).

**Template Prioritas Remediasi (Diisi/Verifikasi saat Scan Terbaru Anggota 4):**

| Prioritas | Target / Komponen | Jenis Temuan | Dampak / Eksposur | Tindakan & Status Mitigasi |
| :--- | :--- | :--- | :--- | :--- |
| **P1 (Tinggi)** | Runtime Image & OS Packages (`node:22-alpine`) | CVE OS/npm `HIGH`/`CRITICAL` (jika muncul pada image base) | Potensi eksploitasi library jika container berhasil ditembus. | Gunakan base image minimal `node:22-alpine`, `npm ci --omit=dev`, dan jalankan `npm audit fix` / update tag minor Node.js secara berkala. |
| **P2 (Sedang)** | Autentikasi Endpoint (`/api/auth/token`) | Mock JWT token belum divalidasi cryptographic signature-nya oleh Keycloak/OIDC | Pada lingkungan produksi publik, header `X-Tenant-ID` perlu diikat ke claim JWT yang terverifikasi. | Terapkan middleware validasi JWT + JWKS Keycloak pada fase `v2` (tercatat sebagai Residual Risk di `09-capacity-finops`). |
| **P3 (Rendah)** | PostgreSQL Connection Mode | Koneksi DB lokal antar-container tanpa TLS | Hanya berjalan pada jaringan internal Docker/localhost pada lab k3d. | Wajibkan `sslmode=require` ketika bermigrasi ke Managed PostgreSQL / RDS cloud. |

---

## 4. Panduan Pengambilan Screenshot `06_evidence.jpg` (Tugas Anggota 4)

Jalankan perintah berikut pada terminal Git Bash / WSL Anda di root repositori `capstone_cloud_computing`:
```bash
bash automation/scripts/capture-evidence-06-08-09-10.sh 06
```
Atau jalankan scan Trivy lokal jika `trivy` / Docker tersedia:
```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL journalfit-backend:latest
```
**Susun menjadi 3 panel pada `06_evidence.jpg`:**
1. **Panel 1 (Auth & Negative Isolation):** Screenshot output terminal pengujian `400 Bad Request` (tanpa header), `403 Forbidden` (tenant-b akses data tenant-a), dan `200 OK` (tenant-a).
2. **Panel 2 (Secrets & K8s SecurityContext):** Screenshot hasil audit `.env` / `git grep` bersih & status pod non-root `uid=10001` (`kubectl exec ... -- id` atau inspect YAML).
3. **Panel 3 (Trivy Vulnerability Scan):** Screenshot output tabel Trivy dari GitHub Actions CI atau `aquasec/trivy` lokal beserta catatan singkat temuan prioritas tertinggi.

---

## 5. Pembaruan Implementasi 2026-11-19 (Keycloak JWT)

Status implementasi di branch `feat/app-to-keycloak`:

- `POST /api/auth/token` (mock) dihapus, diganti `GET /api/auth/me`.
- Middleware memvalidasi `iss`, `aud`, signature RS256 melalui JWKS yang di-cache, dan `exp`.
  Tenant dibaca dari claim `tenant_id`; role dari `realm_access.roles` (alias
  `user/operator/admin` tetap dinormalisasi).
- `X-Tenant-ID` diabaikan sepenuhnya saat `AUTH_MODE=jwt` (AC-AUTH-05).
- Akses lintas tenant dan naskah milik author lain dijawab `404` (PRD A-03); role
  tidak berhak dijawab `403`.
- Provisioning user otomatis ke tabel `users` berdasarkan claim `sub`; konflik tenant
  ditolak `403` (AC-AUTH-06).
- Realm: `deployment/keycloak/realm-journalfit.json`. Migrasi: `source/migrations/001_add_keycloak_auth.sql`.
- Panduan token, user demo, dan perintah uji negatif: `source/AUTH.md`.

**Catatan bukti:** hasil `curl` pada §3 (400 tanpa header, 403 lintas tenant) adalah
snapshot sebelum perubahan ini. Bukti baru harus diambil dengan token Keycloak dan
tidak boleh menyalin angka lama sebagai hasil pengujian terbaru.
