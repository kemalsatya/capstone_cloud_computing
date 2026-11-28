# Autentikasi Keycloak (JournalFit Backend)

Backend memvalidasi access token Keycloak (JWT) menggunakan JWKS yang di-cache.
Identitas, role, dan tenant **selalu** berasal dari token — bukan body, query, atau header.

- Realm: `journalfit` (`deployment/keycloak/realm-journalfit.json`)
- Client: `journalfit-app` (public, password grant aktif untuk demo)
- Audience: `journalfit-api`
- Claim tenant: `tenant_id` (user attribute, dipetakan lewat protocol mapper)
- Role realm: `author`, `editor`, `tenant_admin`

## Mode autentikasi (`AUTH_MODE`)

| Mode | Perilaku | Penggunaan |
|---|---|---|
| `jwt` (default) | Wajib `Authorization: Bearer <JWT>`; `X-Tenant-ID` diabaikan total | Produksi, demo Keycloak |
| `header` | Tenant dari `X-Tenant-ID`, role default `author` | Kompatibilitas demo lama |
| `mock` | Menerima token legacy `mock.jwt.<payload>` tanpa signature | Lokal/uji saja |

`header` dan `mock` ditolak saat `NODE_ENV=production`.

## Konfigurasi

| Variable | Default | Keterangan |
|---|---|---|
| `AUTH_MODE` | `jwt` | `jwt`, `header`, atau `mock` |
| `KEYCLOAK_ISSUER` | `http://localhost:8081/realms/journalfit` | Dicek terhadap claim `iss` |
| `KEYCLOAK_JWKS_URI` | `http://localhost:8081/realms/journalfit/protocol/openid-connect/certs` | Dipakai untuk fetch JWKS |
| `KEYCLOAK_AUDIENCE` | `journalfit-api` | Dicek terhadap claim `aud` |

Issuer dan JWKS sengaja dipisah: issuer mengikuti URL eksternal (`localhost:8081`),
sedangkan container aplikasi mengambil JWKS dari `http://keycloak:8080/...`.

## User demo

| Username | Password (dev) | Tenant | Role |
|---|---|---|---|
| `author.a` | `author.a` | `tenant-a` | `author` |
| `editor.a` | `editor.a` | `tenant-a` | `editor` |
| `tenant_admin.a` | `tenant_admin.a` | `tenant-a` | `tenant_admin` |
| `author.b` | `author.b` | `tenant-b` | `author` |
| `editor.b` | `editor.b` | `tenant-b` | `editor` |
| `tenant_admin.b` | `tenant_admin.b` | `tenant-b` | `tenant_admin` |

Password hanya untuk pengembangan lokal. Jangan dipakai di produksi.

## Mengambil token

```bash
TOKEN=$(curl -s -X POST \
  "http://localhost:8081/realms/journalfit/protocol/openid-connect/token" \
  -d "grant_type=password" \
  -d "client_id=journalfit-app" \
  -d "username=author.a" \
  -d "password=author.a" \
  -d "scope=openid profile email" \
  | jq -r .access_token)

echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq
# harapan: sub, tenant_id=tenant-a, realm_access.roles=[author], aud memuat journalfit-api
```

## Endpoint

| Metode | Path | Role | Keterangan |
|---|---|---|---|
| GET | `/api/auth/me` | semua token valid | Menampilkan `user_id`, `sub`, `tenant_id`, role |
| POST | `/api/manuscripts` | `author` | Upload naskah (route PRD, validasi DOCX ketat, `202`) |
| POST | `/api/manuscripts/upload` | `author` | Alias legacy (`201`) untuk skrip evidence yang sudah ada |
| GET | `/api/manuscripts` | `author`, `editor`, `tenant_admin` | Author hanya miliknya; editor/admin seluruh tenant |
| GET | `/api/manuscripts/:id` | `author`, `editor`, `tenant_admin` | Metadata + status format/scope |
| GET | `/api/manuscripts/:id/history` | `author`, `editor`, `tenant_admin` | Rantai revisi |
| GET | `/api/manuscripts/:id/report` | `author`, `editor`, `tenant_admin` | Author hanya naskah miliknya |
| POST | `/api/tenant/rule-templates` | `tenant_admin` | Unggah template DOCX → rule draft |
| GET | `/api/tenant/rule-templates` | `tenant_admin` | Daftar versi rule |
| GET | `/api/tenant/rule-templates/:id` | `tenant_admin` | Detail rule draft/aktif |
| PUT | `/api/tenant/rule-templates/:id/rules` | `tenant_admin` | Simpan hasil review |
| POST | `/api/tenant/rule-templates/:id/activate` | `tenant_admin` | Aktivasi rule (arsipkan yang lama) |
| GET/PUT | `/api/tenant/aim-scope` | `tenant_admin` | Baca/ubah aim and scope |
| GET | `/api/tenant/summary` | `tenant_admin` | Statistik tenant |
| GET | `/api/tenant/ai-usage` | `tenant_admin` | Token, biaya, kuota AI |

Upload sekarang **asinkron**: API menyimpan naskah, membuat dua `check_results`
(`format` dan `scope`), lalu memasukkan job `format-check` ke pg-boss dalam satu
transaksi. Worker terpisah (`npm run worker`) memproses parser + rule engine.
`GET .../report` tetap `200` selama naskah ditemukan; klien membaca
`format.status` (`queued|running|completed|failed`). Detail pipeline ada di
[FORMAT.md](./FORMAT.md).

Error autentikasi memakai envelope PRD:

```json
{ "error": { "code": "UNAUTHENTICATED", "message": "…", "request_id": "…" } }
```

Kode: `UNAUTHENTICATED` (401), `TENANT_CLAIM_MISSING` (403), `FORBIDDEN` (403),
`NOT_FOUND` (404).

## Migrasi database

Kolom `users.keycloak_sub` ditambahkan oleh `source/migrations/001_add_keycloak_auth.sql`.
Volume Postgres baru menjalankannya otomatis sebagai `02-auth.sql`. Untuk database
yang sudah ada:

```bash
docker compose exec -T postgres psql -U capstone -d journalfit \
  < source/migrations/001_add_keycloak_auth.sql
```

User pertama yang login di-provision otomatis ke tabel `users` berdasarkan claim `sub`.
Jika `keycloak_sub` sudah terdaftar dengan `tenant_id` berbeda dari token, request
ditolak `403 FORBIDDEN` (AC-AUTH-06).

## Uji negatif

```bash
# 401 tanpa token
curl -i http://localhost:8000/api/auth/me

# 401 token rusak
curl -i -H "Authorization: Bearer bad.token" http://localhost:8000/api/auth/me

# 404 lintas tenant (author.b membuka ms-001 milik tenant-a)
# 403 editor memanggil endpoint upload (author-only)
# X-Tenant-ID palsu diabaikan saat AUTH_MODE=jwt
```

## Catatan operasional

- `--import-realm` hanya mengimpor realm yang belum ada. Jika `keycloak_data` sudah
  berisi realm lama, hapus volume di lingkungan dev (`docker compose down -v`) atau
  impor ulang lewat admin console.
- Compose memakai `start-dev` dengan database H2 bawaan Keycloak. Keycloak di
  PostgreSQL bersama dan manifest Kubernetes belum termasuk dalam perubahan ini.
