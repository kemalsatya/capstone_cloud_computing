# Setup Lokal dengan Docker Compose

Panduan ini menjalankan JournalFit sepenuhnya di satu mesin memakai Docker Compose:
PostgreSQL, Keycloak, Garage, API, worker format, dan worker scope.

> **Status branch:** panduan ini ditulis untuk working tree yang berisi perubahan
> Must terbaru (seed, JSON Schema, NT suite, Garage, queue depth, backup/restore).
> Jangan `git checkout main` atau `git pull` sebelum perubahan tersebut di-commit,
> karena perubahan belum tersimpan di Git.

## 1. Prasyarat

- Docker Desktop + Docker Compose
- Node.js 22+
- Git Bash (untuk script `.sh`)
- Port bebas: `8000`, `8081`, `3900`, `5432`, `9100`, `9101`, `9102`

## 2. Environment

Edit `.env` di root repo. Gunakan nilai berikut untuk demo penuh dengan Garage:

```env
DB_USER=capstone
DB_PASSWORD=capstone
DB_NAME=journalfit
KEYCLOAK_DB_NAME=keycloak

AUTH_MODE=jwt
KEYCLOAK_ISSUER=http://localhost:8081/realms/journalfit
KEYCLOAK_AUDIENCE=journalfit-api

AI_MODE=mock
GROQ_MODEL=openai/gpt-oss-20b
AI_TIMEOUT_MS=30000
AI_PRICE_IN_PER_1M=0
AI_PRICE_OUT_PER_1M=0

STORAGE_DRIVER=s3
S3_ENDPOINT=http://garage:3900
S3_BUCKET=journalfit-manuscripts
S3_REGION=garage
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY=journalfit
S3_SECRET_KEY=journalfit-secret

API_METRICS_PORT=9100
METRICS_PUBLIC=true
```

Untuk mode paling sederhana tanpa Garage:

```env
STORAGE_DRIVER=local
```

## 3. Mulai dari kondisi bersih (destruktif)

```powershell
docker compose down -v
```

Perintah ini menghapus volume PostgreSQL, Keycloak, dan Garage. Lewati jika data lama
ingin dipertahankan.

## 4. Jalankan stack

```powershell
docker compose up --build -d postgres keycloak garage db-setup app worker-format worker-scope
```

`--build` penting setelah perubahan script/image. `db-setup` sekarang juga membuat
database PostgreSQL `keycloak` sebelum container Keycloak dijalankan.

Cek:

```powershell
docker compose ps
docker compose logs --tail 80 db-setup
docker compose logs --tail 30 garage
```

`db-setup` harus selesai dengan exit code `0`. Log seed menampilkan `tenant-a` dan
`tenant-b`.

## 5. Health check

```powershell
curl.exe -i http://localhost:8000/health/live
curl.exe -i http://localhost:8000/health/ready
curl.exe -i http://localhost:8081/realms/journalfit
```

Yang diharapkan:

- `/health/live` → `200`
- `/health/ready` → `200`, database `connected`, queue `ready`
- realm Keycloak → `200`

## 6. Ambil token Keycloak

PowerShell:

```powershell
function Get-JfToken($username) {
  (Invoke-RestMethod -Method Post `
    -Uri 'http://localhost:8081/realms/journalfit/protocol/openid-connect/token' `
    -Body @{
      grant_type = 'password'
      client_id  = 'journalfit-app'
      username   = $username
      password   = $username
      scope      = 'openid profile email'
    }).access_token
}

$AUTHOR_A = Get-JfToken 'author.a'
$EDITOR_A = Get-JfToken 'editor.a'
$ADMIN_A  = Get-JfToken 'tenant_admin.a'
$AUTHOR_B = Get-JfToken 'author.b'
```

## 7. Demo checklist

### 7.1 Tenant admin

```powershell
$hAdmin = @{ Authorization = "Bearer $ADMIN_A" }

Invoke-RestMethod -Headers $hAdmin -Uri 'http://localhost:8000/api/tenant/aim-scope'
Invoke-RestMethod -Headers $hAdmin -Uri 'http://localhost:8000/api/tenant/rule-templates'
Invoke-RestMethod -Headers $hAdmin -Uri 'http://localhost:8000/api/tenant/summary'
Invoke-RestMethod -Headers $hAdmin -Uri 'http://localhost:8000/api/tenant/ai-usage'
```

Ubah aim-scope:

```powershell
$aim = @{
  aim_scope = 'Cloud computing, information systems, distributed systems, observability, dan reliability untuk sistem cloud-native.'
} | ConvertTo-Json

Invoke-RestMethod -Method Put -Headers $hAdmin -ContentType 'application/json' `
  -Body $aim -Uri 'http://localhost:8000/api/tenant/aim-scope'
```

Opsional — upload template jurnal sebagai rule draft:

```powershell
$draft = curl.exe -s -X POST `
  -H "Authorization: Bearer $ADMIN_A" `
  -F "file=@C:\path\template-jurnal.docx" `
  http://localhost:8000/api/tenant/rule-templates | ConvertFrom-Json

$templateId = $draft.data.id
$draft.data.generated_rules | ConvertTo-Json -Depth 20 | Set-Content rules.json

curl.exe -X PUT `
  -H "Authorization: Bearer $ADMIN_A" `
  -H "Content-Type: application/json" `
  --data-binary "@rules.json" `
  "http://localhost:8000/api/tenant/rule-templates/$templateId/rules"

curl.exe -X POST `
  -H "Authorization: Bearer $ADMIN_A" `
  "http://localhost:8000/api/tenant/rule-templates/$templateId/activate"
```

Catatan: seed sudah membuat rule aktif default. Upload template hanya untuk
mendemonstrasikan alur draft → review → activate.

### 7.2 Author upload naskah

Gunakan naskah/manuscript DOCX yang sudah diisi, bukan template kosong.

```powershell
$upload = curl.exe -s -X POST `
  -H "Authorization: Bearer $AUTHOR_A" `
  -F "file=@C:\path\manuscript.docx" `
  http://localhost:8000/api/manuscripts | ConvertFrom-Json

$id = $upload.manuscript_id
$id
```

Poll report:

```powershell
curl.exe -s -H "Authorization: Bearer $AUTHOR_A" `
  "http://localhost:8000/api/manuscripts/$id/report" | ConvertFrom-Json | ConvertTo-Json -Depth 8
```

Yang diharapkan:

- `format.status` menjadi `completed`
- `format.outcome` `passed` atau `failed` sesuai temuan
- `scope.status` menjadi `completed` (mock AI)
- `scope.disclaimer` ada

List/detail/history:

```powershell
$hAuthor = @{ Authorization = "Bearer $AUTHOR_A" }

Invoke-RestMethod -Headers $hAuthor -Uri 'http://localhost:8000/api/manuscripts'
Invoke-RestMethod -Headers $hAuthor -Uri "http://localhost:8000/api/manuscripts/$id"
Invoke-RestMethod -Headers $hAuthor -Uri "http://localhost:8000/api/manuscripts/$id/history"
```

### 7.3 Editor

```powershell
$hEditor = @{ Authorization = "Bearer $EDITOR_A" }

Invoke-RestMethod -Headers $hEditor -Uri 'http://localhost:8000/api/manuscripts'
Invoke-RestMethod -Headers $hEditor -Uri "http://localhost:8000/api/manuscripts/$id"
Invoke-RestMethod -Headers $hEditor -Uri "http://localhost:8000/api/manuscripts/$id/history"
Invoke-RestMethod -Headers $hEditor -Uri "http://localhost:8000/api/manuscripts/$id/report"
```

### 7.4 Isolasi tenant

Author tenant B mencoba membaca naskah tenant A:

```powershell
curl.exe -i -H "Authorization: Bearer $AUTHOR_B" `
  "http://localhost:8000/api/manuscripts/$id/report"
```

Harus `404 NOT_FOUND`.

Header tenant palsu:

```powershell
curl.exe -i -H "Authorization: Bearer $AUTHOR_A" `
  -H "X-Tenant-ID: tenant-b" `
  "http://localhost:8000/api/manuscripts/$id/report"
```

Harus tetap `200` dengan data tenant A.

### 7.5 Metrics

```powershell
curl.exe -s http://localhost:9100/metrics | Select-String "journalfit_queue_depth|journalfit_ai_tokens_total|journalfit_ai_cost_usd_total"
```

Karena `METRICS_PUBLIC=true`, endpoint publik juga tersedia:

```powershell
curl.exe -s http://localhost:8000/metrics | Select-String "journalfit_queue_depth"
```

### 7.6 Garage

```powershell
docker exec journalfit-garage /garage -c /etc/garage.toml bucket info journalfit-manuscripts
```

### 7.7 Database

```powershell
docker exec journalfit-postgres psql -U capstone -d journalfit -c `
  "SELECT id, tenant_id, role FROM users ORDER BY tenant_id, role;"

docker exec journalfit-postgres psql -U capstone -d journalfit -c `
  "SELECT id, tenant_id, status FROM manuscripts ORDER BY created_at DESC LIMIT 5;"

docker exec journalfit-postgres psql -U capstone -d journalfit -c `
  "SELECT manuscript_id, check_type, status, outcome FROM check_results ORDER BY created_at DESC LIMIT 10;"
```

### 7.8 Worker

```powershell
docker compose logs --tail 50 worker-format
docker compose logs --tail 50 worker-scope
```

## 8. Backup dan restore

Jalankan dari Git Bash:

```bash
bash automation/scripts/db-backup-restore.sh backup
```

Hasil ada di:

```text
evidence/reliability-recovery/backup_YYYYMMDD_HHMMSS/
```

Restore (destruktif ke DB demo):

```bash
docker compose stop app worker-format worker-scope
bash automation/scripts/db-backup-restore.sh restore evidence/reliability-recovery/backup_YYYYMMDD_HHMMSS
docker compose start app worker-format worker-scope
```

Verifikasi saja:

```bash
bash automation/scripts/db-backup-restore.sh verify evidence/reliability-recovery/backup_YYYYMMDD_HHMMSS
```

## 9. Test

Unit + OpenAPI (tanpa DB):

```powershell
cd source
npm test
npm run test:openapi
```

Suite NT dengan PostgreSQL terpisah:

```powershell
docker run -d --name journalfit-test-pg `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=journalfit_test `
  -p 55432:5432 postgres:17-alpine

$env:TEST_DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:55432/journalfit_test'
node --test tests/integration/negative-authorization.test.js

docker rm -f journalfit-test-pg
```

> Jangan arahkan `TEST_DATABASE_URL` ke database demo. Helper integrasi melakukan
> `DROP SCHEMA public CASCADE` sebelum test.

## 10. Troubleshooting

| Gejala                             | Periksa                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `db-setup` gagal                 | `docker compose logs db-setup`; image/tag dan `DB_*`                          |
| `409 NO_ACTIVE_RULE` saat upload | seed belum selesai atau rule tenant belum aktif                                   |
| Report tetap `queued`            | worker tidak jalan, queue belum ready, atau `UPLOAD_DIR`/Garage tidak konsisten |
| `401` semua request              | issuer token tidak sama dengan `KEYCLOAK_ISSUER`                                |
| Garage tidak start                 | `docker compose logs garage`; secret mode world-readable                        |
| Metrics kosong                     | `METRICS_PUBLIC`, port `9100`, queue belum ready                              |
| Worker `ENOENT`                  | penyimpanan lokal vs `STORAGE_DRIVER=s3` tidak konsisten                        |

## 11. Bersihkan

```powershell
docker compose down
```

Hapus volume juga:

```powershell
docker compose down -v
```

Untuk Kubernetes, lanjut ke [SETUP-K8S.md](./SETUP-K8S.md).
