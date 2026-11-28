# Format Check Foundation (JournalFit)

Pipeline ini mengubah upload naskah menjadi pemeriksaan format asinkron:

```
POST /api/manuscripts
  -> validasi DOCX
  -> simpan objek (adapter lokal)
  -> transaksi DB: manuscripts + check_results(format, scope) + job pg-boss
  -> 202 { manuscript_id, revision_no, status }

worker-format
  -> ambil job format-check
  -> parse DOCX (jszip + fast-xml-parser)
  -> jalankan rule Tier 1
  -> simpan findings + outcome
  -> GET /api/manuscripts/{id}/report menampilkan hasil
```

## Modul

| Path | Fungsi |
|---|---|
| `src/modules/parser/` | Baca DOCX: ZIP safety, `document.xml`, `styles.xml`, theme, section, paragraf, tabel, abstrak/keywords, resolusi style |
| `src/modules/rules/` | Katalog FMT-001..009, engine, `default-rules.json` |
| `src/modules/queue/` | pg-boss: queue `format-check`, retry, DLQ, enqueue atomik |
| `src/modules/suggester/` | Turunkan `generated_rules` dari DOCX template; dipakai CLI dan API tenant admin |
| `src/modules/tenant/` | API tenant admin: rule draft/review/aktivasi, aim-scope, summary, ai-usage |
| `src/modules/ai/` | Cek scope Groq + mode mock, validasi output JSON, hitung token/biaya |
| `src/modules/storage/` | Adapter penyimpanan lokal (`UPLOAD_DIR`, default `uploads`) |
| `src/modules/workers/format.worker.js` | Handler worker format; enqueue scope jika abstrak terekstrak |
| `src/modules/workers/scope.worker.js` | Handler worker scope: kuota, AI, retry, delayed/DLQ |
| `src/worker.js` | Entry worker + endpoint metrik worker |
| `scripts/derive-template-rules.js` | Turunkan `default-rules.json` dari template DOCX |
| `scripts/seed-demo-data.js` | Seed tenant/user + satu rule aktif per tenant |
| `scripts/run-migrations.js` | Jalankan migrasi 001 + 002 (idempoten) untuk Compose dan K8s Job |

## Rule Tier 1

| ID | Aturan | Severity default |
|---|---|---|
| FMT-001 | Ukuran kertas A4 exact twips | error |
| FMT-002 | Margin body exact twips | error |
| FMT-003 | Jumlah kolom body | error |
| FMT-004 | Font dan ukuran per peran | error |
| FMT-005 | Alignment dan spasi per peran | warning |
| FMT-006 | Heading memakai style Word Heading 1–5 | warning |
| FMT-007 | Section wajib dan urutannya | error |
| FMT-008 | Abstrak ada dan 100–200 kata | error |
| FMT-009 | Keywords ada dan 3–5 | error |

FMT-005 dan FMT-006 sengaja `warning` pada default agar template nyata tidak menghasilkan error palsu; admin dapat mengubahnya nanti.

## Default rules dari template Informatik

Template asli **tidak di-commit** (`source/.gitignore` meng-ignore `/Copy of Template Journal Informatik.docx`). Untuk menghasilkan defaults:

```bash
cd source
npm run derive:rules -- "Copy of Template Journal Informatik.docx" --write
```

Script membaca template, mengekstrak ukuran kertas, margin body, jumlah kolom, style per peran, rentang abstrak, dan jumlah keywords, lalu menulis `src/modules/rules/default-rules.json`. Gate yang dipakai: template asli harus menghasilkan **0 finding error**.

`tests/golden-template.test.js` menjalankan gate yang sama bila file template tersedia. Di CI file itu tidak ada, jadi tes di-skip dan diganti fixture sintetis.

## Migrasi database

Skema awal (`schema.sql` v1) tetap dipertahankan. Migrasi aditif:

```bash
# Docker Compose: satu service one-shot `db-setup` menjalankan
# `run-migrations.js` (001 + 002, idempoten) lalu `seed-demo-data.js`.
# `app` dan `worker-format` menunggu service ini selesai.
docker compose up -d postgres db-setup app worker-format

# Manual untuk DB lama / di luar Compose:
cd source
node scripts/run-migrations.js
```

Migrasi berurutan: `001_add_keycloak_auth.sql`, `002_prd_format_foundation.sql`,
`003_tenant_admin.sql`. Setelah migrasi, seed rule default:

```bash
cd source
npm run seed
# Untuk menimpa rule yang sudah ada dengan defaults:
npm run seed -- --force
```

`db-setup` hanya mengisi rule aktif yang belum punya `rules`, sehingga perubahan admin tidak tertimpa saat `docker compose up` berikutnya. Init script `docker-entrypoint-initdb.d` di service `postgres` tetap ada sebagai fast path untuk volume kosong, tetapi tidak berjalan pada volume lama.

Catatan deviasi:
- ID tetap `VARCHAR` (`tenant-a`, `ms-001`) agar data demo dan claim Keycloak tidak rusak.
- `check_results` memakai satu baris per `(manuscript_id, check_type)`.
- `format_score`, `status`, `rule_type`, dan `file_path` lama dipertahankan untuk kompatibilitas.

## Menjalankan

Docker Compose:

```bash
docker compose up -d postgres keycloak db-setup app worker-format worker-scope
```

Lokal:

```bash
cd source
npm start                              # API
npm run worker                         # worker format (WORKER_TYPE=format)
WORKER_TYPE=scope npm run worker       # worker scope
```

Environment penting: `DB_*`/`DATABASE_URL`, `PG_BOSS_SCHEMA`, `FORMAT_QUEUE`, `SCOPE_QUEUE`, `UPLOAD_DIR`, `MAX_UPLOAD_MB`, `WORKER_METRICS_PORT`, `AI_MODE`, `GROQ_API_KEY`, `GROQ_MODEL`, `AI_TIMEOUT_MS`, `AI_PRICE_IN_PER_1M`, `AI_PRICE_OUT_PER_1M`.

## Endpoint

| Metode | Path | Status | Keterangan |
|---|---|---|---|
| POST | `/api/manuscripts` | 202 | Route PRD, validasi DOCX ketat |
| POST | `/api/manuscripts/upload` | 201 | Alias legacy untuk skrip evidence; validasi longgar |
| GET | `/api/manuscripts` | 200 | Daftar naskah; author hanya miliknya, editor/admin seluruh tenant; cursor pagination |
| GET | `/api/manuscripts/{id}` | 200 | Metadata + status format/scope terpisah |
| GET | `/api/manuscripts/{id}/history` | 200 | Rantai revisi berurutan |
| GET | `/api/manuscripts/{id}/report` | 200 | Laporan gabungan; envelope `success/data` dipertahankan |

Route legacy sengaja menerima file non-DOCX agar e2e lama tetap hijau; worker akan menandainya `failed` dengan `error_code=INVALID_FILE`. Demo baru sebaiknya memakai `/api/manuscripts`.

## Queue dan reliability

- Queue `format-check`: policy `exclusive`, `singletonKey=manuscript_id`, retry 2, delay 5 dtk, expire 120 dtk.
- Queue `scope-check`: `singletonKey=manuscript_id`, retry 3, backoff eksponensial, expire 180 dtk.
- DLQ: `format-check-dlq` dan `scope-check-dlq`.
- Enqueue memakai `db: { executeSql }` di dalam transaksi `pg`, sehingga job ikut rollback bila insert gagal.
- Worker idempoten: bila `check_results.format.status = completed`, job dilewati.
- DOCX korup ditandai `failed` + `INVALID_FILE` tanpa retry.
- Error transien di-retry; setelah batas retry, status format `failed` dan job masuk DLQ.

## Observability

- API: `GET /health/live`, `GET /health/ready` (PostgreSQL + queue), `GET /metrics`.
- Worker: `GET /metrics`, `/health/live`, `/health/ready` pada `WORKER_METRICS_PORT` (default 9101).
- Metrik pipeline: `journalfit_jobs_total{queue,result}` dan `journalfit_check_e2e_seconds{check_type}`.

## Tes

```bash
cd source
npm test
```

Tes tidak membutuhkan PostgreSQL. Fixture DOCX dibuat dengan `tests/fixtures/docx-builder.js` (jszip). Suite mencakup parser, ZIP safety, resolusi style, semua rule Tier 1, service submission, worker, golden template lokal, validasi OpenAPI, dan matriks tenant restrictions.

## OpenAPI / Swagger UI

Spesifikasi ada di `src/docs/openapi.yaml`; Swagger UI disajikan di `/docs` dan
spec mentah di `/openapi.yaml`. Keduanya hanya aktif jika `ENABLE_DOCS=true`.

```bash
ENABLE_DOCS=true npm start
# http://localhost:8000/docs
```

Demo K8s memakai issuer publik
`http://keycloak.localhost:8088/realms/journalfit`. Langkah lengkap, token,
matriks tenant, worker, dan PVC ada di [DEMO.md](./DEMO.md).

## Scope AI

Format worker men-enqueue `scope-check` dalam transaksi yang sama bila abstrak berhasil
diekstrak. Jika tidak ada abstrak, scope langsung `skipped` dengan `error_code=NO_ABSTRACT`.

Worker scope:

- Idempoten: `completed`/`skipped` dilewati.
- Cek kuota token bulan berjalan sebelum memanggil AI; habis → `skipped` `QUOTA_EXCEEDED`.
- `AI_MODE=mock` (default) tidak memanggil jaringan; `AI_MODE=groq` memakai Groq dengan
  timeout 30 dtk dan validasi output JSON.
- Output tidak valid atau error transien di-retry 3x dengan backoff; setelah itu scope
  `delayed` dan job masuk DLQ. Laporan format tidak terpengaruh.
- Token, model, dan estimasi biaya disimpan di `check_results` dan tersedia lewat
  `GET /api/tenant/ai-usage`.

Variabel: `AI_MODE`, `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_BASE_URL`, `AI_TIMEOUT_MS`,
`AI_PRICE_IN_PER_1M`, `AI_PRICE_OUT_PER_1M`.

## Batasan saat ini

- Penyimpanan masih lokal; adapter Garage S3 menyusul.
- Route legacy `/upload` menerima file non-DOCX demi kompatibilitas evidence.
- Manifest K8s `worker-format`, `worker-scope`, dan Job `db-setup` sudah ada; image/tag tetap harus dibangun ulang dan `deployment/kustomization.yaml` diperbarui sebelum demo.
