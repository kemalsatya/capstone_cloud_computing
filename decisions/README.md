# 10 - Decisions & Architecture Decision Records (ADR)

**Milestone:** M1 — Architecture Baseline (bobot terpadu dengan Architecture: 15%)  
**Penanggung Jawab:** Anggota 1 & Anggota 2 (Koordinator) bersama seluruh Anggota Tim (3 & 4)  
**Berkas Bukti Target:** `10_evidence.jpg`

---

## 1. Standar Evidence (Guideline 2 Section 9)

| Field | Detail |
| :--- | :--- |
| **Scope** | Keputusan arsitektur fundamental sistem **JournalFit** (aplikasi, data & multi-tenancy, platform Kubernetes, GitOps CI/CD, keamanan, observabilitas, dan recovery). |
| **Owner** | Anggota 1 (Aplikasi/Data), Anggota 2 (Platform/K8s), Anggota 3 (CI/CD & GitOps), Anggota 4 (Security, Observability, Recovery, FinOps). |
| **Source / Version** | Repositori `capstone_cloud_computing` (Commit `7e8607b` / image tag `0c2cf92`, Express `5.3.0`, `pg-boss` `12.39.0`, `jszip` + `fast-xml-parser`, Node `22-alpine`, Keycloak `26.8.2`, PostgreSQL `17`, k3d/k3s, Argo CD). |
| **Timestamp** | Disusun awal: 2026-11-18 \| Sinkronisasi PR #15/#16 (pg-boss, OOXML, 06 & 08): 2026-11-23 |
| **Method** | Evaluasi trade-off MADR (Context, Options, Decision, Consequences) terhadap batasan laptop lokal (8 GB RAM) dan kesiapan migrasi cloud. |
| **Observation** | Seluruh 9 keputusan arsitektural kunci (ADR-001 s.d. ADR-009) telah diterapkan secara nyata dalam kode, manifest K8s, skrip CI/CD, Keycloak realm, dan skema DB. |
| **Interpretation** | Tidak ada komponen yang dipilih secara asal; setiap pilihan teknologi menyeimbangkan isolasi tenant, keamanan kriptografis, portabilitas cloud, dan efisiensi sumber daya lokal. |
| **Limitation** | Sebagian implementasi saat ini disesuaikan untuk single-host k3d (seperti `local-path` RWO PVC dan client demo Keycloak direct-grant) dan memerlukan penyesuaian saat pindah ke cloud multi-node. |
| **Decision Supported** | Menjadi rujukan utama saat Technical Defense (Q&A) dan peta jalan peningkatan ke produksi (`v2`). |

---

## 2. Matriks Keputusan Arsitektur (Ringkasan untuk `10_evidence.jpg`)

| ID | Keputusan Arsitektur | Kategori | Status | Alternatif Ditolak | Trade-Off Utama | Pemilik |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **[ADR-001](./ADR-001-modular-monolith.md)** | Modular Monolith (`Node.js / Express 5`) | Aplikasi | Accepted | Microservices penuh | Deploy sederhana & hemat RAM (~128Mi); scaling tetap di level replika pod penuh. | Anggota 1 |
| **[ADR-002](./ADR-002-postgresql-multitenancy.md)** | PostgreSQL 17 + Logical Multi-Tenancy (`tenant_id`) | Data & Tenancy | Accepted | Database terpisah per tenant / NoSQL | Query relasional kuat & hemat resource; isolasi bergantung pada konsistensi filter `tenant_id` di layer service. | Anggota 1 |
| **[ADR-003](./ADR-003-k3d-nonroot-container.md)** | Kluster `k3d` & Hardened Container Non-Root (`UID 10001`) | Platform | Accepted | Docker Compose saja / Full kubeadm VM | Ringan di laptop & deklaratif standar K8s; host-dependent (`host.docker.internal`) untuk DB lokal. | Anggota 2 |
| **[ADR-004](./ADR-004-gitops-argocd-sha7.md)** | Declarative GitOps (Argo CD) + Immutable Tag SHA-7 | Delivery | Accepted | Push manual via `kubectl apply` dari CI | Audit trail Git jelas & anti drift (`selfHeal`); butuh 1 langkah sinkronisasi manifest di `deployment/`. | Anggota 3 |
| **[ADR-005](./ADR-005-pvc-rwo-storage-pinning.md)** | PVC `local-path` RWO (1Gi) + `nodeSelector` Storage Pinning | Storage | Accepted | S3/MinIO Object Storage di v1 | Bebas komponen ekstra untuk file `.docx`; multi-replika terkunci pada node yang sama (tidak multi-AZ). | Anggota 2 |
| **[ADR-006](./ADR-006-secrets-trivy-security.md)** | Pemisahan Secret Runtime + Trivy Scan Gate + `drop ALL` Cap | Security | Accepted | Hardcoded env di YAML / Secret plain di Git | Nol kredensial di Git & surface attack pod minimal. | Anggota 4 |
| **[ADR-007](./ADR-007-prometheus-grafana-slo.md)** | Pull Telemetry (`GET /metrics`) + Prometheus & Grafana SLO | Observability | Accepted | Agent-based SaaS APM berbayar | Ringan & vendor-neutral; metrik terbatas pada HTTP/runtime, belum ada distributed tracing (OTel). | Anggota 4 |
| **[ADR-008](./ADR-008-backup-restore-rule-engine.md)** | `pg_dump` Isolated Validation Restore & Rule-Based Checker | Reliability & FinOps | Accepted | Paid LLM API untuk setiap pengecekan dasar | RTO cepat (~1.41s) & biaya token AI $0 pada v1; aturan format bersifat statis (regex/word-count). | Anggota 4 |
| **[ADR-009](./ADR-009-keycloak-oidc-tenant-claim.md)** | Keycloak OIDC Auth, RS256/JWKS, Claim `tenant_id` & Policy 404 | Security & IAM | Accepted | Header-only spoofable auth / SaaS IdP | Validasi kriptografis kuat & anti-leakage; overhead RAM pod Keycloak (~596MiB) & cold start ~72s. | Anggota 1 & 2 |

---

## 3. Kasus Pengujian (Test Case) — Automated ADR Conformance & Fitness Test

Untuk membuktikan bahwa `ADR-001` s.d. `ADR-009` bukan sekadar dokumen teks melainkan benar-benar dipatuhi oleh kode sumber, manifest Kubernetes, dan pipeline CI/CD, dijalankan pengujian otomatis **Architecture Fitness Functions** melalui [`automation/scripts/tests/test_milestone_10_adr.py`](../automation/scripts/tests/test_milestone_10_adr.py) (log hasil tersimpan di [`adr-conformance-test.txt`](./adr-conformance-test.txt)):

```bash
python automation/scripts/tests/test_milestone_10_adr.py
cd source && npm test
```

- **Hasil Automated ADR Conformance Test:** **9/9 ADR LULUS (`[PASS]` 100% compliant)** terhadap `source/`, `deployment/`, dan `.github/workflows/ci.yaml`.
- **Hasil Full Test Suite (Auth, OOXML Parser, Worker, OpenAPI):** **63/64 tests LULUS (`11 suites, 0 fail, 1 skipped local golden template`)**.

---

## 4. Cara Mengambil Bukti `10_evidence.jpg`

Untuk menghasilkan gambar `10_evidence.jpg` yang bersih dan terbaca jelas saat penilaian:
1. Buka terminal di root repositori `capstone_cloud_computing`, lalu jalankan:
   ```bash
   bash automation/scripts/capture-evidence-06-08-09-10.sh 10
   python automation/scripts/tests/test_milestone_10_adr.py
   ```
2. Skrip akan mencetak **Matriks ADR-001 s.d. ADR-009** beserta hasil **Automated ADR Conformance Test (9/9 PASS)** secara rapi di terminal.
3. Ambil tangkapan layar (screenshot) penuh dari matriks dan hasil tes tersebut, lalu simpan sebagai:
   `cloud-capstone-team-7/10-decisions-adr/10_evidence.jpg`.
