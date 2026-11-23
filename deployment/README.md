# Manifest platform JournalFit

Manifest ini mengadaptasi template dosen sesuai
[baseline sementara integrasi](INTEGRATION_CONTRACT.md). Status: render lokal dan
server dry-run lulus pada cluster capstone. Setelah pengguna mengizinkan inisialisasi
lokal dari schema.sql Anggota 1, database siap dan deployment manual awal berhasil:
dua replica Ready, PVC Bound, health HTTP 200, upload DOCX HTTP 201 dan laporan HTTP 200.

Source Dockerfile terbaru di branch adalah Node 22 Alpine, sudah diuji kandidat
secara terpisah; artifact Kubernetes yang direkam tetap 3bdf305 (Node 24).
Lihat [ringkasan versi dan kontribusi](../evidence/platform/RINGKASAN_M3_ANGGOTA_2.md).

## Fungsi file

| File | Fungsi |
| --- | --- |
| `configmap.yaml` | Konfigurasi non-rahasia backend; `ENABLE_DOCS` default `false`. |
| `pvc.yaml` | Penyimpanan DOCX local-path RWO, request 1Gi. |
| `deployment.yaml` | Workload non-root, resource baseline, health probes dan rollout; replica dikelola HPA. |
| `service.yaml` | ClusterIP port 80 menuju port container bernama http (8000). |
| `ingress.yaml` | Routing Traefik untuk host journalfit.localhost. |
| `kustomization.yaml` | Satu entry point manifest dan override tag image. |
| `hpa.yaml` | HPA CPU 70%, minimum dua dan maksimum tiga replica. |
| `worker-format.yaml` | Worker pg-boss untuk format check; memakai PVC dan node storage yang sama. |
| `db-setup-job.yaml` | Job migrate 001+002 (initContainer) lalu seed default rules. |
| `keycloak/deployment.yaml` | Keycloak production mode (`start --import-realm`), probes 9000, limit 1 CPU/1Gi. |
| `keycloak/service.yaml` | ClusterIP `keycloak:80` menuju container 8080. |
| `keycloak/ingress.yaml` | Traefik host `keycloak.localhost`. |
| `keycloak/configmap.yaml` | Konfigurasi non-rahasia Keycloak (DB, hostname, health, proxy). |
| `keycloak/kustomization.yaml` | ConfigMap realm dari `realm-journalfit.json`. |
| `keycloak/secret.example.yaml` | Bentuk Secret; nilai nyata dibuat imperatif. |
| `keycloak/realm-journalfit.json` | Realm `journalfit` (satu-satunya salinan kanonik). |

## Keycloak (auth)

Backend sekarang memakai `AUTH_MODE=jwt` dengan issuer
`http://keycloak.localhost:8088/realms/journalfit` dan JWKS internal
`http://keycloak.default.svc.cluster.local/realms/journalfit/protocol/openid-connect/certs`.
Keycloak berjalan sebagai Deployment satu replica dengan database terpisah `keycloak`
di PostgreSQL bersama (tanpa PVC; state ada di Postgres).

Prasyarat sebelum apply:

1. Database `keycloak` dan Secret runtime:
   ```bash
   bash automation/scripts/setup-keycloak.sh
   ```
   Script membuat database (via Compose Postgres atau `psql` host) serta Secret
   `keycloak-db-secret` (`KC_DB_PASSWORD`) dan `keycloak-admin-secret`
   (`KC_BOOTSTRAP_ADMIN_PASSWORD`) di namespace `default`. Tidak ada nilai rahasia di Git.
2. PostgreSQL dapat dijangkau dari pod melalui `host.k3d.internal:5432` (lihat A.2).
3. Realm diimpor otomatis saat start pertama. Strategi import adalah
   `IGNORE_EXISTING`, jadi perubahan realm pada DB yang sudah ada tidak menimpa
   user/role secara otomatis.

Konfigurasi penting:

- `KC_HOSTNAME=http://keycloak.localhost:8088` harus sama dengan `KEYCLOAK_ISSUER`
  backend; issuer adalah URL eksternal, sedangkan JWKS diambil lewat Service internal.
- Health check Keycloak ada di port manajemen **9000** (`KC_HEALTH_ENABLED=true`):
  `/health/started`, `/health/live`, `/health/ready`.
- Image resmi berjalan sebagai UID/GID **1000**. Memaksa UID 10001 gagal karena
  `start` melakukan augmentasi Quarkus yang menulis ke `/opt/keycloak/lib`.
  Container tetap non-root, `allowPrivilegeEscalation: false`, dan `drop: ALL`.
- Request `250m`/`512Mi`, limit `1000m`/`1Gi`. Cold start terukur **72 detik**
  dan **596MiB** pada batas tersebut; startup probe memberi ruang sampai 180 detik.
- Strategi `Recreate` + satu replica untuk menghindari dua writer ke DB Keycloak.
- Realm diekspor ke `deployment/keycloak/realm-journalfit.json` dan dirender menjadi
  ConfigMap oleh Kustomize. Salinan di `evidence/security/` tidak dipakai runtime.

Deploy:

```bash
kubectl --context k3d-capstone apply -k deployment
kubectl --context k3d-capstone -n default rollout status deployment/keycloak
curl -i http://keycloak.localhost:8088/realms/journalfit
```

Catatan migrasi: backend image baru memakai `AUTH_MODE=jwt`. Script/bukti lama yang
masih mengirim `X-Tenant-ID` akan mendapat 401/400 dan harus meminta token Keycloak
(lihat `source/AUTH.md`).

Image backend juga harus dibangun ulang dari commit yang memuat `jose` dan middleware
auth, lalu `images[].newTag` di `kustomization.yaml` diperbarui. Tag `3bdf305` yang
tercatat sekarang belum memuat integrasi Keycloak, sehingga ConfigMap `AUTH_MODE` belum
berpengaruh sampai image baru dipublikasikan.

## OpenAPI / Swagger UI (demo)

`ENABLE_DOCS` default `false`. Untuk demo, set `ENABLE_DOCS: "true"` pada
`journalfit-backend-config` atau:

```bash
kubectl -n default set env deployment/journalfit-backend ENABLE_DOCS=true
```

Setelah rollout:

- Swagger UI: `http://journalfit.localhost:8088/docs`
- Spec: `http://journalfit.localhost:8088/openapi.yaml`

Issuer tetap opsi B: `http://keycloak.localhost:8088/realms/journalfit`.
Panduan demo lengkap, token, matriks tenant, dan worker/PVC ada di
[`source/DEMO.md`](../source/DEMO.md).

## Validasi lokal

Jalankan dari root repository:

```powershell
kubectl kustomize ./deployment
```

Perintah ini merender konfigurasi tanpa menghubungi cluster. Hasil render tidak
memuat Secret password. Validasi API/server dry-run sudah lulus pada tahap D;
hasil ini belum membuktikan workload aplikasi bisa berjalan.

## Prasyarat deployment tahap D

- Context harus `k3d-capstone`; namespace aplikasi `default`, mengikuti Anggota 3.
  Namespace default bawaan cluster tidak dikelola atau dihapus melalui manifest.
  Cluster baru sudah
  tersedia dan kedua node Ready. Kubeconfig khusus cluster ini memakai
  https://127.0.0.1:6550 setelah endpoint host.docker.internal tidak terjangkau.
  Jangan memakai
  context praktikum lama. Cluster, storage class local-path dan Traefik harus siap.
- Beri label `journalfit-storage=uploads` pada tepat satu node yang dipilih untuk
  penyimpanan. Semua replica dijadwalkan di node tersebut untuk berbagi PVC lokal.
  Tanpa label, pod akan Pending. Izin tulis volume harus dibuktikan dengan UID 10001.
- Buat database journalfit dan enam tabel melalui koordinasi Anggota 1. Buktikan
  koneksi dari pod ke host.k3d.internal:5432. Readiness SELECT 1 tidak memeriksa tabel.
  Langkah ini sudah dilakukan menggunakan schema.sql tanpa perubahan pada 2026-11-10;
  jangan menginisialisasi ulang atau menimpa database yang sudah berisi data uji.
- Jika pod Running tetapi tidak Ready setelah restart lingkungan, periksa pesan
  /health/ready dari dalam pod. Default manifest kini memakai `host.k3d.internal`,
  alias host bawaan k3d yang tersedia lintas platform. `host.docker.internal` hanya
  ada di Docker Desktop; di k3d di atas Docker Linux alias itu tidak resolve dan
  memunculkan `ENOTFOUND`, seperti yang terjadi pada worker `CrashLoopBackOff`.
  Untuk Docker Desktop Windows yang kehilangan alias k3d setelah restart, tukar ke
  `host.docker.internal` lalu restart pod. Jangan membuat ulang database/PVC untuk
  memperbaiki kegagalan DNS.
- Siapkan Secret runtime `journalfit-backend-secret`, key `DB_PASSWORD`, dalam
  namespace default. Tidak ada Secret berisi credential dalam konfigurasi ini.
- Artifact source commit `3bdf305d106c` sudah dibangun dan dipublikasikan dengan
  tag pendek `3bdf305`, mengikuti SHA 7 karakter Anggota 3.
  `images[].newTag` dalam kustomization.yaml kini merujuk tag itu. Digest registry
  dan image yang ditarik probe cluster sama:
  `sha256:a441538a80ffd8f2fad9e29b17ec9c3872f851bba8d8eb01c55674fdba9ccc95`.
  Ini verifikasi artifact/probe, bukan deployment aplikasi siap melayani transaksi.
- Satu sumber aktif deployment: gunakan Kustomize; jangan menerapkan setiap file
  secara terpisah dengan konfigurasi berbeda. Handoff GitOps mengikuti kontrak A.4.

Setelah seluruh prasyarat terpenuhi, entry point deployment manual awal adalah:

```powershell
kubectl --context k3d-capstone apply -k ./deployment
```

Perintah apply di atas dijalankan pada tahap D setelah database siap. Setelah Argo CD aktif,
perubahan runtime mengikuti repository GitOps; CI tidak menjalankan kubectl apply.
Namespace default, tag SHA7, dan sumber Argo GitHub repository aplikasi path
deployment/ sudah disesuaikan ke branch Anggota 3. Aktivasi Argo/CI belum diuji;
perintah npm test Node 20 dan pembaruan tag desired state memerlukan tindak lanjut
Anggota 1/3. Tidak ada push atau perubahan pipeline pada langkah penyelarasan ini.

Data DOCX disalin ke PVC namespace default dengan checksum yang cocok, dan layanan
di namespace default telah diverifikasi. Workload lama capstone diskalakan ke nol;
PVC lama tetap disimpan. Jangan menerapkan snapshot manifest capstone sebelumnya.

Dengan port HTTP k3d 8088 sesuai baseline dosen, alamat rencana layanan adalah
`http://journalfit.localhost:8088/`. Routing telah diuji melalui 127.0.0.1:8088 dengan
header Host journalfit.localhost. Resolusi nama di browser host diuji terpisah. Akses localhost port
8000 dari pengujian Docker tidak otomatis tersedia sebagai endpoint Kubernetes.

## HPA dan batas reliability

HPA sudah dimasukkan ke Kustomize setelah Metrics API dan metrik pod terbukti
tersedia. Target 70% dihitung terhadap CPU request 100m, bukan CPU limit 250m.
Scale-up dibatasi satu pod per 30 detik; scale-down memakai jendela stabilisasi
60 detik dan satu pod per 30 detik. Nilai ini untuk pengujian lab, bukan hasil
optimasi produksi. Jumlah replica awal/minimum dijaga HPA, sehingga spec.replicas
tidak ditulis dalam Deployment. Last-applied annotation diselaraskan sebelum
uji reapply agar apply tidak menghapus jumlah replica yang dikelola HPA.

Reapply manual sudah diperiksa ketika replica berjumlah tiga dan tidak meresetnya.
Uji beban 64 worker report menghasilkan scale 2->3 dan kembali 2 setelah beban berhenti;
19.865 request selesai tanpa kegagalan tercatat. CPU sempat 249% dari request dan
HPA mencapai batas maksimum 3; ini bukan bukti workload memenuhi target CPU atau SLO.
Controller Argo CD sudah dipasang pada D.8. Application dengan ignoreDifferences
/spec/replicas dan RespectIgnoreDifferences sudah disiapkan di automation/argocd/,
tetapi belum diterapkan/disinkronkan. Publikasi branch harus diverifikasi sebelum sync.
Integrasi Argo/HPA tetap harus dibuktikan. PVC diberi Prune=false,Delete=false
untuk mempertahankan dokumen bila terjadi penghapusan melalui Argo.
Dasar konfigurasi: [Horizontal Pod Autoscaling Kubernetes](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/).

Uji rolling update metadata artifact telah dilakukan dengan 777 request, nol gagal
teramati selama sekitar 31.58 detik; rollout 22.53 detik. Ini hasil sampling lokal,
bukan jaminan tanpa downtime untuk semua kondisi atau perubahan fitur aplikasi.
Replica berbagi satu node
storage; rancangan ini tidak menyediakan ketahanan terhadap kegagalan node tersebut.
PVC 1Gi bukan bukti kuota disk atau keberhasilan backup/restore.

Artifact rollout uji memakai suffix e1 dan metadata baru agar image/digest berubah
tanpa mengedit backend. Sesudah tes, referensi manifest dikembalikan ke 3bdf305.
Hasil run, CSV request dan script reproduksi ada di evidence/platform/.
