# Demo K8s: OpenAPI, Swagger UI, dan Tenant Restrictions

Dokumen ini memakai **opsi B**: issuer Keycloak publik
`http://keycloak.localhost:8088/realms/journalfit`, dengan JWKS internal.
Jangan memakai token dari Docker Compose (`localhost:8081`) untuk app K8s.

## 1. Prasyarat

- Cluster `k3d-capstone`, Ingress Traefik, dan port host `8088`.
- Image backend baru yang memuat:
  - parser/worker/rule engine,
  - `src/docs/openapi.yaml`,
  - `migrations/` + `scripts/run-migrations.js`,
  - dependency `swagger-ui-express` dan `yaml`.
- Secret `journalfit-backend-secret` (key `DB_PASSWORD`).
- PVC `journalfit-uploads` dan node berlabel `journalfit-storage=uploads`.
- Realm Keycloak `journalfit` dengan client `journalfit-app` dan user
  `author.a`, `author.b`, `editor.a`.
- `/etc/hosts` di laptop demo:

```
127.0.0.1 journalfit.localhost keycloak.localhost
```

## 2. Build dan push image

```bash
cd /path/to/capstone_cloud_computing
TAG="$(date +%Y%m%d%H%M)"   # atau SHA commit
docker build -t "localhost:5001/journalfit-backend:${TAG}" -f source/Dockerfile source
docker push "localhost:5001/journalfit-backend:${TAG}"
```

Kemudian set tag yang sama di `deployment/kustomization.yaml`:

```yaml
images:
  - name: registry:5000/journalfit-backend
    newTag: "202611221800"
```

Alasan: registry di-push lewat `localhost:5001`, sedangkan pod menarik dari
`registry:5000` di dalam jaringan k3d. Untuk konvensi Argo, gunakan SHA7 +
suffix (mis. `$(git rev-parse --short HEAD)-openapi`) bila working tree belum
di-commit, lalu set `newTag` persis sama.

## 3. Apply dan tunggu DB setup

```bash
kubectl --context k3d-capstone -n default delete job journalfit-db-setup --ignore-not-found
kubectl --context k3d-capstone apply -k deployment
kubectl --context k3d-capstone -n default wait \
  --for=condition=complete job/journalfit-db-setup --timeout=600s
kubectl --context k3d-capstone -n default rollout status \
  deployment/journalfit-backend --timeout=300s
kubectl --context k3d-capstone -n default rollout status \
  deployment/journalfit-worker-format --timeout=300s
```

`journalfit-db-setup` menjalankan initContainer `migrate`
(`scripts/run-migrations.js`, 001 + 002) lalu container `seed`
(`scripts/seed-demo-data.js`). Urutannya deterministik.

Catatan:
- Hapus Job sebelum apply ulang jika image/tag berubah, karena pod template Job
  bersifat immutable.
- Seed tidak menimpa rule tenant yang sudah punya `rules`, kecuali dijalankan
  dengan `--force`.
- Worker wajib berada di node storage yang sama dengan backend karena PVC RWO.

## 4. Aktifkan Swagger UI

`ENABLE_DOCS` default `false` di ConfigMap. Untuk demo:

```bash
kubectl --context k3d-capstone -n default \
  set env deployment/journalfit-backend ENABLE_DOCS=true
kubectl --context k3d-capstone -n default rollout status \
  deployment/journalfit-backend
```

Buka:

- Swagger UI: `http://journalfit.localhost:8088/docs`
- Spec: `http://journalfit.localhost:8088/openapi.yaml`

Ingress existing memakai `path: /` dengan `pathType: Prefix`, jadi `/docs`
dan `/openapi.yaml` tidak perlu rule tambahan. Swagger UI memakai
`persistAuthorization`, yang menyimpan token di browser; bersihkan Authorize
atau browser storage setelah demo di mesin bersama.

Setelah demo, matikan lagi:

```bash
kubectl --context k3d-capstone -n default \
  set env deployment/journalfit-backend ENABLE_DOCS=false
```

## 5. Ambil token

Realm memakai client publik `journalfit-app` dengan direct access grant.

```bash
TOKEN_A=$(curl -s -X POST \
  http://keycloak.localhost:8088/realms/journalfit/protocol/openid-connect/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=password' \
  -d 'client_id=journalfit-app' \
  -d 'username=author.a' \
  -d 'password=author.a' | jq -r .access_token)

TOKEN_B=$(curl -s -X POST \
  http://keycloak.localhost:8088/realms/journalfit/protocol/openid-connect/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=password' \
  -d 'client_id=journalfit-app' \
  -d 'username=author.b' \
  -d 'password=author.b' | jq -r .access_token)
```

Jika tidak ada `jq`, ganti dengan:

```bash
... | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).access_token))"
```

Verifikasi claim:

```bash
node -e "
const token = process.argv[1].split('.')[1];
const claims = JSON.parse(Buffer.from(token, 'base64url'));
console.log(JSON.stringify({
  iss: claims.iss,
  aud: claims.aud,
  tenant_id: claims.tenant_id,
  roles: claims.realm_access?.roles
}, null, 2));
" "$TOKEN_A"
```

Yang diharapkan:

- `iss`: `http://keycloak.localhost:8088/realms/journalfit`
- `aud`: `journalfit-api`
- `tenant_id`: `tenant-a`
- `roles`: `["author"]`

## 6. Matriks tenant restrictions

Jalankan script:

```bash
cd source
BASE_URL=http://journalfit.localhost:8088 \
KEYCLOAK_URL=http://keycloak.localhost:8088 \
./scripts/demo-tenant-restrictions.sh
```

Script memeriksa:

| Skenario | Harapan |
|---|---|
| `author.a` membaca `ms-001` | `200` |
| `author.b` membaca `ms-001` | `404` |
| `editor.a` membaca `ms-001` | `200` |
| tanpa token | `401` |
| `editor.a` upload | `403` |
| `author.a` + `X-Tenant-ID: tenant-b` palsu | tetap `200` |
| `author.a` memanggil `/api/auth/me` | `200` |

Di Swagger UI:
1. Klik **Authorize**, paste `TOKEN_A`.
2. Coba `GET /api/manuscripts/ms-001/report` → `200`.
3. Ganti token ke `TOKEN_B`, coba ID yang sama → `404`.

## 7. Demo format check (opsional)

Setelah worker Ready:

```bash
curl -i -X POST \
  -H "Authorization: Bearer $TOKEN_A" \
  -F "file=@Copy of Template Journal Informatik.docx" \
  http://journalfit.localhost:8088/api/manuscripts
```

Respons `202` berisi `manuscript_id`. Poll report:

```bash
curl -s -H "Authorization: Bearer $TOKEN_A" \
  "http://journalfit.localhost:8088/api/manuscripts/<id>/report"
```

Contoh hasil template Informatik: `format.status=completed`,
`format.outcome=passed`, `counts.error=0`.

## 8. Troubleshooting

| Gejala | Penyebab umum |
|---|---|
| Semua request `401` | `iss` token ≠ `KEYCLOAK_ISSUER`; cek `KC_HOSTNAME` dan ConfigMap |
| Report tetap `queued` | Worker tidak jalan, queue belum ready, atau PVC tidak shared |
| Upload `409 NO_ACTIVE_RULE` | Job seed belum selesai |
| Upload `500` / kolom tidak ada | Migrasi 002 belum diterapkan |
| Worker `ENOENT` | PVC/nodeSelector worker berbeda dari backend |
| `/docs` 404 | `ENABLE_DOCS` masih `false` atau deployment belum rollout |
| Author mendapat `404` untuk naskahnya | `author_id` atau `tenant_id` tidak cocok |

## 9. Checklist singkat

- [ ] Image baru dipush dan `newTag` diperbarui.
- [ ] `journalfit-db-setup` completed.
- [ ] `journalfit-backend` dan `journalfit-worker-format` Ready.
- [ ] `/etc/hosts` berisi kedua host.
- [ ] `ENABLE_DOCS=true` untuk demo.
- [ ] Token `author.a` dan `author.b` berasal dari Keycloak K8s.
- [ ] `demo-tenant-restrictions.sh` lulus.
- [ ] `ENABLE_DOCS=false` setelah demo.
