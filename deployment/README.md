# Manifest platform JournalFit

**Status per 2026-11-22: review formal Tahap 4 lulus 26 check; persistensi, rollout, dan integrasi Keycloak telah terpasang.** Render, server dry-run, drift, environment/probes,
routing, dan izin volume tercatat pada
[evidence Tahap 4](../evidence/platform/tahap-4/README.md). Dua pod
Ready, Service/Ingress, PVC, transaksi DOCX, penggantian pod, dan rolling update
dibuktikan melalui [verifikasi langsung](../evidence/platform/m3-live-20261117/README.md)
serta [evidence Tahap 6](../evidence/platform/tahap-6/README.md).
Urutan command ada pada [panduan M3](PANDUAN_M3.md).

Rekaman pengujian lama berada dalam
[arsip platform](../evidence/_archive/platform-unverified-2026-11-17/ARCHIVE_STATUS.md).
Status pemeriksaan baru dicatat pada [indeks aktif](../evidence/platform/README.md).

## Peta file yang tersedia

| File | Fungsi & Hasil Review | Batas / Tindak Lanjut |
| :--- | :--- | :--- |
| `configmap.yaml` | Konfigurasi non-rahasia backend (`PORT`, `DB_HOST`, `AUTH_MODE: jwt`). | Perubahan ConfigMap membutuhkan restart pod terkontrol. |
| `pvc.yaml` | Penyimpanan berkas `.docx` `local-path` RWO (1Gi), mode 2777. | Terikat pada 1 node k3d; roadmap migrasi ke S3/MinIO. |
| `deployment.yaml` | Backend modular monolith, non-root `UID 10001`, probes `/health/live` & `/health/ready`. | Replica (2-3) dikendalikan secara dinamis oleh HPA. |
| `service.yaml` | ClusterIP port 80 menuju port container named `http` (8000). | EndpointSlice sinkron dengan pod status Ready. |
| `ingress.yaml` | Traefik routing untuk domain `journalfit.localhost`. | Akses via port Ingress kluster (:8088). |
| `kustomization.yaml` | Entry point deklaratif Kustomize & override tag image immutable. | Mengorkestrasi seluruh resource K8s + subdirektori `keycloak`. |
| `hpa.yaml` | Horizontal Pod Autoscaler target CPU 70%, minimum 2, maksimum 3 pod. | Mengadaptasi lonjakan trafik saat deadline submission jurnal. |
| `keycloak/deployment.yaml` | Keycloak IAM production mode (`start --import-realm`), limit 1 CPU / 1Gi RAM. | Recreate stateful, cold-start ~72 detik, RAM ~596 MiB. |
| `keycloak/service.yaml` | ClusterIP `keycloak:80` menuju container 8080. | Endpoint internal JWKS untuk verifikasi JWT backend. |
| `keycloak/ingress.yaml` | Traefik routing untuk domain `keycloak.localhost`. | Akses login & admin console Keycloak (:8088). |
| `keycloak/configmap.yaml` | Konfigurasi non-rahasia Keycloak (DB, hostname, health, proxy). | Hostname diselaraskan dengan issuer eksternal. |
| `keycloak/kustomization.yaml` | ConfigMap realm dari `realm-journalfit.json`. | Realm di-load otomatis saat container pertama kali start. |
| `keycloak/secret.example.yaml` | Template Secret kredensial admin dan database Keycloak. | Nilai rahasia nyata dibuat imperatif di kluster. |
| `keycloak/realm-journalfit.json` | Konfigurasi realm `journalfit` (client, role, dan user seed). | Satu-satunya salinan kanonik realm di platform. |

## Keycloak (Auth & Identity Management)

Backend sekarang memakai `AUTH_MODE=jwt` dengan issuer
`http://keycloak.localhost:8088/realms/journalfit` dan JWKS internal
`http://keycloak.default.svc.cluster.local/realms/journalfit/protocol/openid-connect/certs`.
Keycloak berjalan sebagai Deployment satu replica dengan database terpisah `keycloak`
di PostgreSQL bersama (tanpa PVC; state tersimpan di PostgreSQL).

Prasyarat sebelum apply:

1. Database `keycloak` dan Secret runtime:
   ```bash
   bash automation/scripts/setup-keycloak.sh
   ```
   Script membuat database (via Compose Postgres atau `psql` host) serta Secret
   `keycloak-db-secret` (`KC_DB_PASSWORD`) dan `keycloak-admin-secret`
   (`KC_BOOTSTRAP_ADMIN_PASSWORD`) di namespace `default`. Tidak ada nilai rahasia di Git.
2. PostgreSQL dapat dijangkau dari pod melalui `host.docker.internal:5432`.
3. Realm diimpor otomatis saat start pertama dengan strategi `IGNORE_EXISTING`.

Deploy manifest lengkap:

```bash
kubectl --context k3d-capstone apply -k deployment
kubectl --context k3d-capstone -n default rollout status deployment/keycloak
curl -i http://keycloak.localhost:8088/realms/journalfit
```

## Keputusan dan batas yang dicatat

- Dockerfile baru memakai base Node 22 yang dipin dan UID/GID 10001, sesuai angka
  pada Deployment. Izin tulis PVC dan checksum DOCX sesudah penggantian satu pod
  sudah diperiksa pada lab; batas storage satu node tetap berlaku.
- ConfigMap host.docker.internal sesuai jalur lab yang diuji. Environment kedua
  pod cocok; perubahan ConfigMap tidak otomatis mengganti environment proses.
- Readiness aplikasi memakai `SELECT 1`; schema dan transaksi diperiksa terpisah.
