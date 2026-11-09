# Manifest platform JournalFit

Manifest ini mengadaptasi template dosen sesuai
[baseline sementara integrasi](INTEGRATION_CONTRACT.md). Status: draft tervalidasi
secara lokal setelah pemeriksaan tahap C, belum dideploy ke Kubernetes.

## Fungsi file

| File | Fungsi |
| --- | --- |
| `namespace.yaml` | Namespace aplikasi capstone. |
| `configmap.yaml` | Konfigurasi non-rahasia sesuai environment variable backend. |
| `pvc.yaml` | Penyimpanan DOCX local-path RWO, request 1Gi. |
| `deployment.yaml` | Dua replica non-root, resource baseline, health probes dan rollout. |
| `service.yaml` | ClusterIP port 80 menuju port container bernama http (8000). |
| `ingress.yaml` | Routing Traefik untuk host journalfit.localhost. |
| `kustomization.yaml` | Satu entry point manifest dan override tag image. |

## Validasi lokal

Jalankan dari root repository:

```powershell
kubectl kustomize ./deployment
```

Perintah ini merender konfigurasi tanpa menghubungi cluster. Hasil render tidak
memuat Secret password. Validasi schema API dan server dry-run dilakukan setelah
cluster capstone tersedia; render yang berhasil belum membuktikan pod bisa berjalan.

## Prasyarat deployment tahap D

- Context harus `k3d-capstone`; namespace aplikasi `capstone`. Jangan memakai
  context praktikum lama. Cluster, storage class local-path dan Traefik harus siap.
- Beri label `journalfit-storage=uploads` pada tepat satu node yang dipilih untuk
  penyimpanan. Semua replica dijadwalkan di node tersebut untuk berbagi PVC lokal.
  Tanpa label, pod akan Pending. Izin tulis volume harus dibuktikan dengan UID 10001.
- Buat database journalfit dan enam tabel melalui koordinasi Anggota 1. Buktikan
  koneksi dari pod ke host.k3d.internal:5432. Readiness SELECT 1 tidak memeriksa tabel.
- Siapkan Secret runtime `journalfit-backend-secret`, key `DB_PASSWORD`, dalam
  namespace capstone. Tidak ada Secret berisi credential dalam konfigurasi ini.
- Build dan publish artifact bertag SHA aktual. Ubah `images[].newTag` dalam
  kustomization.yaml sebelum deployment rilis. `platform-dev` adalah tag image
  pengujian lokal yang sudah dibangun; belum dipublikasikan ke registry.
- Satu sumber aktif deployment: gunakan Kustomize; jangan menerapkan setiap file
  secara terpisah dengan konfigurasi berbeda. Handoff GitOps mengikuti kontrak A.4.

Setelah seluruh prasyarat terpenuhi, entry point deployment manual awal adalah:

```powershell
kubectl --context k3d-capstone apply -k ./deployment
```

Perintah apply di atas belum dijalankan pada tahap C. Setelah Argo CD aktif,
perubahan runtime mengikuti repository GitOps; CI tidak menjalankan kubectl apply.
Nama repository/path/namespace/tag masih perlu diselaraskan dengan Anggota 3.

Dengan port HTTP k3d 8088 sesuai baseline dosen, alamat rencana layanan adalah
`http://journalfit.localhost:8088/`. Alamat ini belum diuji. Akses localhost port
8000 dari pengujian Docker tidak otomatis tersedia sebagai endpoint Kubernetes.

## HPA dan batas reliability

HPA belum dimasukkan ke entry point ini. Pada tahap E, periksa Metrics API dan
metrics pod terlebih dahulu, baru buat hpa.yaml dan integrasikan sesuai hasil.
Ketika HPA aktif, kepemilikan replicas harus diselaraskan dengan Argo CD.

RollingUpdate maxUnavailable 0 dan maxSurge 1 adalah konfigurasi, bukan bukti tanpa
downtime. Uji request selama rollout tetap diperlukan. Replica berbagi satu node
storage; rancangan ini tidak menyediakan ketahanan terhadap kegagalan node tersebut.
PVC 1Gi bukan bukti kuota disk atau keberhasilan backup/restore.
