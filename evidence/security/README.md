# 06 - Security (JWT Keycloak, Tenant Isolation, Secret & Trivy)

**Milestone:** M6 — Security (Bobot Rubrik: 10%)
**Penanggung Jawab Utama (Lead):** Anggota 4
**Pendukung Teknis:** Anggota 1 (Auth/Tenant), Anggota 3 (CI Trivy)
**Berkas Bukti:** `06_evidence.jpg`, `negative-authorization-test.txt`,
`negative-authorization-test-k8s.txt`, `trivy-scan.txt`

---

## 1. Standar Evidence (Guideline 2 Section 9)

| Field | Detail |
| :--- | :--- |
| **Scope** | Uji JWT Keycloak live (`401`/`404`/`403`/`200`), isolasi tenant, RBAC, pengabaian `X-Tenant-ID` palsu, audit secret, hardening container, dan Trivy scan image demo `localhost:5001/journalfit-backend:0c2cf92`. |
| **Owner** | Anggota 4 (eksekusi Paket A, audit secret/Trivy), Anggota 1 (middleware auth/tenant), Anggota 3 (CI Trivy). |
| **Source / Version** | Branch `feat/m2-paket-a-kemalsatya` commit `6fa1bcc`; image `localhost:5001/journalfit-backend:0c2cf92`; realm `deployment/keycloak/realm-journalfit.json`; tests `source/tests/auth.test.js`, `source/tests/openapi-tenant-restrictions.test.js`. |
| **Timestamp** | 2026-11-23. Capture Compose `08:53 WIB`; capture K8s `10:20 WIB`; Trivy scan `10:36 WIB`. |
| **Method** | (1) `curl` JWT live ke Compose dan K8s: tanpa token, token rusak, cross-tenant, RBAC, header spoof, dan akses sah. (2) `git check-ignore`/`git ls-files` + inspeksi `securityContext`. (3) `kubectl exec ... -- id`. (4) Trivy image scan `HIGH,CRITICAL`. |
| **Observation** | Tanpa token dan token rusak `401`; `author.b` ke `ms-001` tenant-a `404`; `editor.a` upload `403`; `author.a` + `X-Tenant-ID: tenant-b` tetap `200` dengan `tenant_id=tenant-a`; `author.a`/`editor.a` membaca report `200`. Runtime backend/worker/job `UID 10001`, Keycloak `UID 1000`. Trivy: OS Alpine `0`, Node.js `10 HIGH / 0 CRITICAL`, semuanya di npm CLI (`/usr/local/lib/node_modules/npm/...`); `/app/node_modules` bersih. |
| **Interpretation** | Isolasi tenant, RBAC, dan validasi JWT bekerja. Secret runtime terpisah dari ConfigMap dan container berjalan non-root. Temuan Trivy berasal dari tooling npm di base image, bukan dependency runtime aplikasi, sehingga dapat dihilangkan dengan menghapus npm dari runtime image. |
| **Limitation** | 10 HIGH npm CLI masih terbuka; CI Trivy memakai `exit-code: 0` sehingga **melaporkan, bukan memblokir**. Secret K8s masih dibuat imperatif (belum External Secrets). Realm memuat kredensial demo lokal. Belum ada penetration test penuh. Log lama `400/403` adalah snapshot pre-Keycloak dan tidak dipakai sebagai bukti JWT saat ini. |
| **Decision Supported** | **ADR-002** (isolasi tenant), **ADR-003** (non-root `UID 10001`), **ADR-006** (secret separation + Trivy scan), **ADR-009** (Keycloak OIDC/JWT). |

---

## 2. Pembagian Tugas & Checklist

| Sub-Tugas | Pemilik | Verifikasi |
| :--- | :--- | :--- |
| **6.1 JWT Positive & Negative Auth** | Anggota 4, dibantu Anggota 1 | Enam kasus live: `401` tanpa token, `401` token rusak, `404` cross-tenant, `403` RBAC, `200` header spoof/akses sah. Log: `negative-authorization-test.txt` dan `negative-authorization-test-k8s.txt`. |
| **6.2 Secret & Container Hardening** | Anggota 4, dibantu Anggota 2 | `.gitignore` memblokir `.env`/key/secret manifest; `deployment/secret.example.yaml` tersedia; `secretKeyRef`; `runAsNonRoot`, UID 10001/1000, `allowPrivilegeEscalation: false`, `drop: ALL`, `automountServiceAccountToken: false`. |
| **6.3 Trivy Scan & Risk Interpretation** | Anggota 4, dibantu Anggota 3 | Scan image demo `0c2cf92`; output di `trivy-scan.txt`; tabel remediasi di bawah. |

---

## 3. Hasil Uji

### A. JWT Keycloak dan Isolasi Tenant

| Kasus | Request | Hasil |
| :--- | :--- | :--- |
| Tanpa token | `GET /api/auth/me` | `401 UNAUTHENTICATED` |
| Token rusak | `GET /api/auth/me` + `Bearer bad.token` | `401 UNAUTHENTICATED` |
| Cross-tenant | `author.b` → `GET /api/manuscripts/ms-001/report` | `404 NOT_FOUND` |
| RBAC | `editor.a` → `POST /api/manuscripts/upload` | `403 FORBIDDEN` |
| Header spoof | `author.a` + `X-Tenant-ID: tenant-b` → `/api/auth/me` | `200`, `tenant_id=tenant-a` |
| Positive | `editor.a` / `author.a` → `ms-001/report` | `200 OK` |

`ms-001` dimiliki `tenant-a`/`user-a-01`. Cross-tenant sengaja `404` untuk mencegah enumerasi ID.

Bukti mentah:

- Compose/local: `evidence/security/negative-authorization-test.txt`
- K8s Ingress: `evidence/security/negative-authorization-test-k8s.txt`
- Screenshot: `evidence/security/06_evidence.jpg`

Catatan: `no-header-400.txt`, `negative-test-403.txt`, dan `tenant-access-test.txt`
adalah snapshot **pre-Keycloak** (header-only). Jangan dipakai sebagai bukti JWT
terbaru.

### B. Secret & Container Hardening

- `.gitignore` memblokir `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`,
  `deployment/secret.yaml`, `deployment/*-secret.yaml`, dan secret Keycloak nyata.
- `deployment/secret.example.yaml` dan `deployment/keycloak/secret.example.yaml`
  hanya placeholder; Secret nyata dibuat imperatif.
- Tidak ada `.env` atau secret nyata yang tracked di Git.
- Backend/worker/db-setup: `runAsNonRoot: true`, `runAsUser: 10001`,
  `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`,
  `automountServiceAccountToken: false`.
- Keycloak: `runAsUser: 1000`, `allowPrivilegeEscalation: false`, `drop: ALL`,
  `automountServiceAccountToken: false`.
- `DB_PASSWORD` masuk lewat `secretKeyRef: journalfit-backend-secret`.
- Catatan: `source/src/config/env.js` masih punya fallback dev `'postgres'`; itu
  bukan kredensial produksi. Realm Keycloak memuat user demo lokal
  (`author.a`, `editor.a`, `author.b`) untuk demo.

### C. Trivy Scan

Command yang dijalankan:

```bash
docker run --rm -e NO_COLOR=1 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image \
  --severity HIGH,CRITICAL --no-progress \
  localhost:5001/journalfit-backend:0c2cf92
```

Hasil:

| Target | Hasil |
| :--- | :--- |
| Alpine 3.24.4 | 0 vulnerability |
| Node.js packages | 10 HIGH, 0 CRITICAL |
| `/app/node_modules` | 0 temuan |

Semua 10 temuan berada di npm CLI bawaan image:
`/usr/local/lib/node_modules/npm/...`, bukan dependency runtime aplikasi.

| Package | Versi | CVE | Dampak | Status |
| :--- | :--- | :--- | :--- | :--- |
| `brace-expansion` | 2.0.2 | CVE-2026-102276, -102278, -13149, -14257, -69152 | DoS / stack & memory exhaustion | Fixed tersedia |
| `ip-address` | 10.1.0 | CVE-2026-69192 | SSRF via parsing IP | Fixed tersedia |
| `pacote` | 19.0.2 / 20.0.1 | CVE-2026-9496 | DoS | Fixed tersedia |
| `picomatch` | 4.0.3 | CVE-2026-33671 | ReDoS | Fixed tersedia |
| `sigstore` | 3.1.0 | CVE-2026-48815 | Verifikasi certificate OID | Fixed tersedia |

**Prioritized Remediation Table**

| Prioritas | Tindakan | Status |
| :--- | :--- | :--- |
| **P1** | Hapus npm/npx dari runtime image setelah `npm ci` (atau multi-stage build) lalu rebuild + re-scan. | **Open** |
| **P1** | Pastikan `brace-expansion` tidak lagi ada di image final. | **Open** |
| **P2** | Hilangkan/upgrade `ip-address`, `pacote`, `picomatch`, `sigstore` (ikut hilang saat npm CLI dihapus). | **Open** |
| **P3** | Gunakan TLS/`sslmode=require` saat pindah ke Managed PostgreSQL. | Roadmap |

Catatan gate: `.github/workflows/ci.yaml` memakai `trivy-action` dengan
`exit-code: '0'`, dan `test-milestone-06-security.sh` memakai `--exit-code 0`.
Artinya Trivy saat ini **melaporkan**, bukan memblokir pipeline. Jika ingin gate
nyata, set `exit-code: 1` setelah remediasi npm CLI.

**Apa yang dibuktikan Trivy dan apa yang tidak:**

- Dibuktikan: CVE pada OS packages dan Node packages di image saat scan.
- Dibuktikan: tidak ada CRITICAL; 10 HIGH dengan fix tersedia.
- Tidak dibuktikan: kebenaran JWT/RBAC, isolasi tenant, tidak adanya secret di Git,
  eksploitabilitas runtime, atau konfigurasi cloud/IaC.

---

## 4. `06_evidence.jpg`

Screenshot berisi tiga panel:

1. Output `demo-tenant-restrictions.sh`: `200`, `404`, `401`, `403`, dan header palsu.
2. `kubectl exec ... -- id`: backend `uid=10001`, Keycloak `uid=1000`.
3. Tampilan `trivy-scan.txt` / report summary.

Rincian 10 temuan HIGH ada di `trivy-scan.txt`; jika ingin panel Trivy menampilkan
tabel temuan, scroll ke bagian `Node.js (node-pkg)` sebelum screenshot ulang.

Regenerate capture:

```bash
bash automation/scripts/capture-evidence-06-08-09-10.sh 06
```

Untuk K8s, set endpoint:

```bash
APP_URL=http://journalfit.localhost:8088 \
KEYCLOAK_URL=http://keycloak.localhost:8088 \
bash automation/scripts/tests/test-milestone-06-security.sh
```

---

## 5. Status Implementasi

- JWT Keycloak aktif (`AUTH_MODE=jwt`); `POST /api/auth/token` mock sudah dihapus.
- `GET /api/auth/me` mengembalikan `user_id`, `sub`, `tenant_id`, `role`, `roles`.
- `X-Tenant-ID` diabaikan saat JWT valid.
- Cross-tenant dan naskah milik author lain dijawab `404`; role salah `403`.
- Realm kanonik: `deployment/keycloak/realm-journalfit.json`.
- Panduan token: `source/AUTH.md`; runbook K8s: `source/instructions/RUNBOOK_DEMO_K8S_PAKET_A.md`.
- Test suite: `64/64` di mesin dengan template lokal; `63/64` + 1 skipped golden template di CI tanpa file template, 0 failure.
- Temuan Trivy npm CLI dan klaim “Trivy memblokir” di dokumen lama sudah dikoreksi.
