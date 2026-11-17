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
| `configmap.yaml` | Konfigurasi non-rahasia sesuai environment variable backend. |
| `pvc.yaml` | Penyimpanan DOCX local-path RWO, request 1Gi. |
| `deployment.yaml` | Workload non-root, resource baseline, health probes dan rollout; replica dikelola HPA. |
| `service.yaml` | ClusterIP port 80 menuju port container bernama http (8000). |
| `ingress.yaml` | Routing Traefik untuk host journalfit.localhost. |
| `kustomization.yaml` | Satu entry point manifest dan override tag image. |
| `hpa.yaml` | HPA CPU 70%, minimum dua dan maksimum tiga replica. |

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
  koneksi dari pod ke host.docker.internal:5432. Readiness SELECT 1 tidak memeriksa tabel.
  Langkah ini sudah dilakukan menggunakan schema.sql tanpa perubahan pada 2026-11-10;
  jangan menginisialisasi ulang atau menimpa database yang sudah berisi data uji.
- Jika pod Running tetapi tidak Ready setelah restart lingkungan, periksa pesan
  /health/ready dari dalam pod. Alias host.k3d.internal pernah hilang dari DNS k3d;
  ConfigMap kini memakai host.docker.internal yang diuji pada Docker Desktop Windows.
  Jangan membuat ulang database/PVC untuk memperbaiki kegagalan DNS.
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
