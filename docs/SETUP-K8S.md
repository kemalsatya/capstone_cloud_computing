# Setup Kubernetes (k3d) — JournalFit

Panduan ini menjalankan JournalFit di cluster **k3d** dengan manifest di `deployment/`.
Gunakan setelah demo lokal Compose berhasil.

> **Status branch:** panduan ini ditulis untuk working tree yang berisi perubahan
> Must terbaru. Jangan `git checkout main` atau `git pull` sebelum perubahan
> di-commit. Untuk demo K8s dengan kode yang belum di-commit, build image dengan
> tag manual (bukan SHA commit).

## 1. Prasyarat

- Docker Desktop
- `k3d`
- `kubectl`
- Git Bash
- Node.js 22+ (untuk script backup/verifikasi)
- Port bebas: `8088`, `8443`, `6550`, `5001`, `5432`

## 2. Perbedaan penting dari Compose

| Hal | Compose | K8s |
|---|---|---|
| PostgreSQL | container Compose | **host/shared PostgreSQL** di `host.k3d.internal:5432` |
| Registry | image lokal | `localhost:5001` push → `registry:5000` pull |
| Konfigurasi | `.env` | ConfigMap + Secret |
| Ingress | port host `:8000` | `http://journalfit.localhost:8088` |
| Metrics | `localhost:9100` | internal `journalfit-backend:9100` |
| Garage | container Compose | StatefulSet + PVC + Secret |
| Migrasi/seed | service `db-setup` | Job `journalfit-db-setup` |

## 3. Siapkan PostgreSQL yang bisa diakses cluster

Manifest memakai:

```text
DB_HOST=host.k3d.internal
DB_PORT=5432
DB_USER=capstone
DB_NAME=journalfit
```

Karena itu PostgreSQL harus listen di interface yang bisa dijangkau gateway Docker.
Untuk lab lokal, opsi paling sederhana adalah container Postgres yang dipublish ke
semua interface (bukan hanya `127.0.0.1`). Hentikan dulu Postgres Compose agar port
`5432` tidak bentrok:

```powershell
docker compose stop postgres
docker rm -f journalfit-k8s-postgres 2>$null

docker run -d --name journalfit-k8s-postgres `
  -e POSTGRES_USER=capstone `
  -e POSTGRES_PASSWORD=capstone `
  -e POSTGRES_DB=journalfit `
  -p 5432:5432 `
  postgres:17-alpine
```

Buat database Keycloak:

```powershell
docker exec journalfit-k8s-postgres psql -U capstone -d postgres `
  -c "CREATE DATABASE keycloak OWNER capstone;"
```

Verifikasi dari dalam cluster setelah cluster dibuat:

```powershell
kubectl -n default run pg-check --rm -it --image=busybox:1.36 --restart=Never `
  -- sh -c "nc -zv host.k3d.internal 5432"
```

Jika gagal, jangan lanjut. Perbaiki `DB_HOST`/`DB_PORT` di
`deployment/configmap.yaml` dan `deployment/keycloak/configmap.yaml`, atau jalankan:

```bash
bash automation/scripts/fix-k3d-host-alias.sh
```

## 4. Registry lokal

```powershell
docker compose --profile ci-cd up -d registry
docker ps --filter name=capstone-registry
```

Push dilakukan ke `localhost:5001`; pod menarik dari alias `registry:5000` yang
diatur `deployment/k3d-registries.yaml`.

## 5. Buat cluster k3d

Jalankan dari Git Bash:

```bash
bash automation/scripts/create-cluster.sh
```

Script ini:

- membuat cluster `k3d-capstone`
- memakai network `capstone-net`
- memetakan Ingress ke port host `8088`
- memberi label node `journalfit-storage=uploads`
- memastikan `host.k3d.internal` tersedia di CoreDNS

Cek:

```powershell
kubectl config use-context k3d-capstone
kubectl get nodes -o wide
kubectl get storageclass
```

## 6. Secret

### 6.1 Database backend dan Keycloak

```powershell
kubectl -n default create secret generic journalfit-backend-secret `
  --from-literal=DB_PASSWORD=capstone `
  --dry-run=client -o yaml | kubectl apply -f -
```

Buat database Keycloak + Secret Keycloak:

```bash
bash automation/scripts/setup-keycloak.sh
```

Script memakai `DB_USER`, `DB_PASSWORD`, `KC_DB_PASSWORD`, dan
`KC_BOOTSTRAP_ADMIN_PASSWORD` dari environment/`.env`.

### 6.2 Garage

Jalankan di Git Bash:

```bash
export GARAGE_ACCESS_KEY="journalfit"
export GARAGE_SECRET_KEY="$(openssl rand -hex 32)"
export GARAGE_RPC_SECRET="$(openssl rand -hex 32)"

kubectl -n default create secret generic garage-rpc-secret \
  --from-literal=rpc_secret="$GARAGE_RPC_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n default create secret generic garage-s3-credentials \
  --from-literal=GARAGE_DEFAULT_ACCESS_KEY="$GARAGE_ACCESS_KEY" \
  --from-literal=GARAGE_DEFAULT_SECRET_KEY="$GARAGE_SECRET_KEY" \
  --from-literal=GARAGE_DEFAULT_BUCKET="journalfit-manuscripts" \
  --dry-run=client -o yaml | kubectl apply -f -
```

Catat `GARAGE_ACCESS_KEY` dan `GARAGE_SECRET_KEY`; dipakai untuk backup/restore
dari host.

### 6.3 AI (opsional)

`AI_MODE=mock` di ConfigMap tidak butuh Groq. Jika ingin `AI_MODE=groq`:

```powershell
kubectl -n default create secret generic journalfit-ai-secret `
  --from-literal=GROQ_API_KEY='<isi-token-groq>' `
  --dry-run=client -o yaml | kubectl apply -f -
```

Secret ini `optional: true` di `worker-scope`, jadi mode mock tetap jalan tanpanya.

## 7. Build dan push image

Untuk working tree yang belum di-commit, gunakan tag manual:

```powershell
$tag = "localdemo-" + (Get-Date -Format "yyyyMMddHHmm")
docker build -t "localhost:5001/journalfit-backend:$tag" -f source/Dockerfile source
docker push "localhost:5001/journalfit-backend:$tag"
$tag
```

Edit `deployment/kustomization.yaml`:

```yaml
images:
  - name: registry:5000/journalfit-backend
    newTag: "localdemo-YYYYMMDDHHMM"
```

Verifikasi render:

```powershell
kubectl kustomize deployment | Select-String "image:"
```

Jika kode sudah di-commit dan di-push, gunakan alur immutable:

```bash
bash automation/scripts/build-and-tag.sh --push
bash automation/scripts/prepare-image-update.sh <sha7>
```

## 8. Siapkan schema dasar dan apply manifest

Berbeda dari Compose, database eksternal tidak menjalankan `source/schema.sql`
otomatis. Terapkan schema dasar dulu:

```powershell
Get-Content source/schema.sql -Raw | docker exec -i journalfit-k8s-postgres `
  psql -U capstone -d journalfit
```

Atau dari Git Bash:

```bash
docker exec -i journalfit-k8s-postgres psql -U capstone -d journalfit < source/schema.sql
```

Job `db-setup` kemudian menjalankan migrasi `001`–`003` dan seed.

Job bersifat immutable. Hapus dulu jika pernah ada:

```powershell
kubectl -n default delete job journalfit-db-setup --ignore-not-found
```

Apply:

```powershell
kubectl apply -k deployment
```

Tunggu resource penting:

```powershell
kubectl -n default rollout status statefulset/garage --timeout=300s
kubectl -n default rollout status deployment/keycloak --timeout=600s
kubectl -n default wait --for=condition=complete job/journalfit-db-setup --timeout=600s
kubectl -n default rollout status deployment/journalfit-backend --timeout=300s
kubectl -n default rollout status deployment/journalfit-worker-format --timeout=300s
kubectl -n default rollout status deployment/journalfit-worker-scope --timeout=300s
```

Cek:

```powershell
kubectl -n default get pods,svc,ingress,hpa,pvc
kubectl -n default logs job/journalfit-db-setup
```

## 9. Hosts file

Tambahkan ke `C:\Windows\System32\drivers\etc\hosts` (butuh akses administrator):

```text
127.0.0.1 journalfit.localhost keycloak.localhost
```

## 10. Verifikasi dasar

```powershell
curl.exe -i http://journalfit.localhost:8088/health/live
curl.exe -i http://journalfit.localhost:8088/health/ready
curl.exe -i http://keycloak.localhost:8088/realms/journalfit
```

Metrics **tidak boleh** terekspos lewat Ingress:

```powershell
curl.exe -i http://journalfit.localhost:8088/metrics
```

Harus `404`.

Metrics internal:

```powershell
kubectl -n default port-forward svc/journalfit-backend 9100:9100
# terminal lain:
curl.exe -s http://localhost:9100/metrics | Select-String "journalfit_queue_depth|journalfit_ai_tokens_total"
```

Garage:

```powershell
kubectl -n default exec garage-0 -- /garage -c /etc/garage.toml bucket info journalfit-manuscripts
```

## 11. Token Keycloak

PowerShell:

```powershell
function Get-JfToken($username) {
  (Invoke-RestMethod -Method Post `
    -Uri 'http://keycloak.localhost:8088/realms/journalfit/protocol/openid-connect/token' `
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

## 12. Demo checklist

Gunakan base URL `http://journalfit.localhost:8088`.

### 12.1 Tenant admin

```powershell
$base = 'http://journalfit.localhost:8088'
$hAdmin = @{ Authorization = "Bearer $ADMIN_A" }

Invoke-RestMethod -Headers $hAdmin -Uri "$base/api/tenant/aim-scope"
Invoke-RestMethod -Headers $hAdmin -Uri "$base/api/tenant/rule-templates"
Invoke-RestMethod -Headers $hAdmin -Uri "$base/api/tenant/summary"
Invoke-RestMethod -Headers $hAdmin -Uri "$base/api/tenant/ai-usage"
```

Ubah aim-scope:

```powershell
$aim = @{
  aim_scope = 'Cloud computing, information systems, distributed systems, observability, dan reliability untuk sistem cloud-native.'
} | ConvertTo-Json

Invoke-RestMethod -Method Put -Headers $hAdmin -ContentType 'application/json' `
  -Body $aim -Uri "$base/api/tenant/aim-scope"
```

Opsional upload template:

```powershell
$draft = curl.exe -s -X POST `
  -H "Authorization: Bearer $ADMIN_A" `
  -F "file=@C:\path\template-jurnal.docx" `
  "$base/api/tenant/rule-templates" | ConvertFrom-Json

$templateId = $draft.data.id
$draft.data.generated_rules | ConvertTo-Json -Depth 20 | Set-Content rules.json

curl.exe -X PUT `
  -H "Authorization: Bearer $ADMIN_A" `
  -H "Content-Type: application/json" `
  --data-binary "@rules.json" `
  "$base/api/tenant/rule-templates/$templateId/rules"

curl.exe -X POST `
  -H "Authorization: Bearer $ADMIN_A" `
  "$base/api/tenant/rule-templates/$templateId/activate"
```

### 12.2 Author

```powershell
$upload = curl.exe -s -X POST `
  -H "Authorization: Bearer $AUTHOR_A" `
  -F "file=@C:\path\manuscript.docx" `
  "$base/api/manuscripts" | ConvertFrom-Json

$id = $upload.manuscript_id
$id
```

Poll report:

```powershell
curl.exe -s -H "Authorization: Bearer $AUTHOR_A" `
  "$base/api/manuscripts/$id/report" | ConvertFrom-Json | ConvertTo-Json -Depth 8
```

List/detail/history:

```powershell
$hAuthor = @{ Authorization = "Bearer $AUTHOR_A" }
Invoke-RestMethod -Headers $hAuthor -Uri "$base/api/manuscripts"
Invoke-RestMethod -Headers $hAuthor -Uri "$base/api/manuscripts/$id"
Invoke-RestMethod -Headers $hAuthor -Uri "$base/api/manuscripts/$id/history"
```

### 12.3 Editor

```powershell
$hEditor = @{ Authorization = "Bearer $EDITOR_A" }
Invoke-RestMethod -Headers $hEditor -Uri "$base/api/manuscripts"
Invoke-RestMethod -Headers $hEditor -Uri "$base/api/manuscripts/$id"
Invoke-RestMethod -Headers $hEditor -Uri "$base/api/manuscripts/$id/history"
Invoke-RestMethod -Headers $hEditor -Uri "$base/api/manuscripts/$id/report"
```

### 12.4 Isolasi tenant

```powershell
curl.exe -i -H "Authorization: Bearer $AUTHOR_B" `
  "$base/api/manuscripts/$id/report"
```

Harus `404`.

```powershell
curl.exe -i -H "Authorization: Bearer $AUTHOR_A" `
  -H "X-Tenant-ID: tenant-b" `
  "$base/api/manuscripts/$id/report"
```

Harus tetap `200` dengan data tenant A.

### 12.5 Worker dan HPA

```powershell
kubectl -n default logs deployment/journalfit-worker-format --tail=50
kubectl -n default logs deployment/journalfit-worker-scope --tail=50
kubectl -n default get hpa
```

## 13. Backup dan restore

Port-forward Garage ke host:

```powershell
kubectl -n default port-forward svc/garage 3900:3900
```

Ambil kredensial S3 dari Secret (Git Bash):

```bash
export S3_ACCESS_KEY="$(kubectl -n default get secret garage-s3-credentials -o jsonpath='{.data.GARAGE_DEFAULT_ACCESS_KEY}' | base64 -d)"
export S3_SECRET_KEY="$(kubectl -n default get secret garage-s3-credentials -o jsonpath='{.data.GARAGE_DEFAULT_SECRET_KEY}' | base64 -d)"
```

Backup (Git Bash):

```bash
export DB_CONTAINER=journalfit-k8s-postgres
export DB_USER=capstone
export DB_PASSWORD=capstone
export DB_NAME=journalfit
export KEYCLOAK_DB_NAME=keycloak
export GARAGE_ENDPOINT_HOST=http://127.0.0.1:3900

bash automation/scripts/db-backup-restore.sh backup
```

Restore ke DB yang sama bersifat destruktif. Untuk demo yang bersih:

```bash
kubectl -n default delete hpa journalfit-backend --ignore-not-found
kubectl -n default scale deployment/journalfit-backend --replicas=0
kubectl -n default scale deployment/journalfit-worker-format --replicas=0
kubectl -n default scale deployment/journalfit-worker-scope --replicas=0

bash automation/scripts/db-backup-restore.sh restore evidence/reliability-recovery/backup_YYYYMMDD_HHMMSS

kubectl -n default delete job journalfit-db-setup --ignore-not-found
kubectl apply -k deployment
```

Catatan: restore memakai `pg_restore --clean` sehingga koneksi aplikasi harus dihentikan.
Untuk backup/verifikasi saja, tidak perlu scale down.

## 14. Argo CD (opsional, untuk bukti GitOps)

```bash
bash automation/scripts/install-argocd.sh
kubectl port-forward svc/argocd-server -n argocd 8082:443
```

Buka `https://localhost:8082`. Password awal:

```powershell
kubectl -n argocd get secret argocd-initial-admin-secret `
  -o jsonpath="{.data.password}" | %{ [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($_)) }
```

`automation/argocd/application.yaml` mengarah ke `targetRevision: main`. Untuk
demo GitOps, kode harus sudah di-merge ke `main`; untuk kode lokal yang belum
di-commit, gunakan `kubectl apply -k deployment` seperti langkah sebelumnya.

## 15. Troubleshooting

| Gejala | Periksa |
|---|---|
| Pod `Pending` | node label `journalfit-storage=uploads`, PVC, resource |
| `host.k3d.internal` gagal | `automation/scripts/fix-k3d-host-alias.sh`; `nc -zv host.k3d.internal 5432` |
| `db-setup` gagal | `kubectl logs job/journalfit-db-setup`; secret DB; image tag |
| `ErrImagePull` | registry `:5001` push, alias `registry:5000`, tag di kustomization |
| Keycloak `401`/issuer mismatch | `KC_HOSTNAME` harus sama dengan `KEYCLOAK_ISSUER` |
| Garage gagal start | Secret `garage-rpc-secret`, `defaultMode: 384` |
| `/metrics` 200 dari luar | `METRICS_PUBLIC=false`, Ingress hanya port 80 |
| Worker scope CrashLoop | `AI_MODE=groq` tanpa `GROQ_API_KEY`; gunakan `mock` |
| Job immutable saat re-apply | hapus job lalu `kubectl apply -k deployment` |
| `journalfit-backend` tidak ada replica | HPA min 2; cek `kubectl get hpa` |

## 16. Bersihkan

```powershell
k3d cluster delete capstone
docker rm -f journalfit-k8s-postgres
docker compose --profile ci-cd down
```

Hapus data bila perlu:

```powershell
docker volume rm journalfit-platform_registry_data
```
