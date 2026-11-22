# Tahap 4 — review manifest Kubernetes

**Status: review terstruktur lulus, 26 check bernilai true.** Manifest saat ini
konsisten dengan kebutuhan backend dan kondisi cluster pada waktu pemeriksaan.
Berikutnya adalah Tahap 5: pengujian transaksi DOCX secara terstruktur.

## Identitas dan metode

- Scope: tujuh file YAML menjadi enam resource Kubernetes; ConfigMap dan Secret
  reference, Deployment/probes/resource, Service/Ingress, PVC, dan HPA.
- Pelaksana: agen coding atas instruksi pemilik M3; penjelasan menjadi bahan
  pembelajaran dan review tim.
- Waktu: `2026-11-17T21:07:54.162538+07:00` sampai
  `2026-11-17T21:08:07.820622+07:00`.
- HEAD baseline: `d9ab35a10eab8e9c67e45bc53f8a22522846b038`, dengan perubahan lokal.
- [Script review](../../../automation/scripts/review-stage4-manifests.py), SHA-256:
  `6331ce2fd65eaea86a155c9bda6e9f0d468d7d8a36adf9e4a6cf89905b233db4`.
- [review.json](run-20261117T140754Z-181811b1/review.json) mencatat fingerprint ketujuh
  manifest, hasil check, lingkungan proses, endpoint, serta referensi Secret.
- Metode: render, client/server dry-run, diff terhadap live, baca objek/EndpointSlice,
  inspeksi proses/izin folder tanpa menulis file, dan GET health dari Service/Ingress.

Pemeriksaan ini tidak melakukan apply, restart, upload, perubahan data, atau
penghapusan resource. Server dry-run memvalidasi perubahan tanpa menyimpannya.

## 1. Render, server dry-run, dan drift

| Pemeriksaan | Hasil | Artifact |
| --- | --- | --- |
| Kustomize | Tujuh YAML menghasilkan enam resource; tidak ada Secret berisi nilai | [rendered.yaml](run-20261117T140754Z-181811b1/rendered.yaml) |
| Client dry-run | ConfigMap, Deployment, Service, Ingress, PVC, HPA terbaca | [desired-client.json](run-20261117T140754Z-181811b1/desired-client.json) |
| Server dry-run | Enam resource diterima | [server-dry-run.json](run-20261117T140754Z-181811b1/server-dry-run.json) |
| Diff desired/live | Exit 0; tidak ada drift konfigurasi | [kubectl-diff.txt](run-20261117T140754Z-181811b1/kubectl-diff.txt), field diff pada review.json |
| Runtime | Dua pod Ready, imageID sesuai artifact teruji | [pods.json](run-20261117T140754Z-181811b1/pods.json) |

Pada percobaan awal, `kubectl diff` gagal karena executable diff tidak ada di PATH
Windows. Percobaan external Git juga gagal pada pemanggilan argumennya. Validasi
akhir memakai GNU diff di `C:\Program Files\Git\usr\bin\diff.exe`, dengan PATH
hanya untuk child process. PATH dan konfigurasi Git pengguna tidak diubah.

## 2. Review tiap manifest

| File | Fungsi | Hasil dan alasan |
| --- | --- | --- |
| configmap.yaml | Konfigurasi non-secret | Enam key sesuai kontrak; nilai aktual kedua pod sama dengan ConfigMap |
| deployment.yaml | Cara menjalankan aplikasi | Port 8000, label/selector sesuai, UID/GID 10001, token service account tidak dimount, capability ALL di-drop |
| service.yaml | Alamat stabil untuk pod | Port 80 menuju named port http/8000; dua Ready EndpointSlice cocok dengan pod |
| ingress.yaml | Akses dari laptop | Host journalfit.localhost, Traefik, prefix / menuju Service port 80 |
| pvc.yaml | Klaim penyimpanan DOCX | Bound, local-path 1Gi RWO, mount /app/uploads; kedua pod dapat mengakses folder |
| hpa.yaml | Pengelolaan jumlah replica | Min 2/max 3, CPU target 70%; metrics tersedia dan controller aktif |
| kustomization.yaml | Satu entry point render/apply | Menggabungkan enam resource dan menetapkan tag image yang dipakai workload |

Semua resource namespaced menggunakan **default**, sesuai lokasi ConfigMap,
Secret, PVC, dan workload lab yang ada. Kustomize sendiri bukan object workload
ketujuh yang dipasang ke Kubernetes.

### ConfigMap dan Secret

- Key public: PORT, NODE_ENV, DB_HOST, DB_PORT, DB_USER, DB_NAME.
- DB_PASSWORD memakai `secretKeyRef` ke journalfit-backend-secret, key DB_PASSWORD,
  pada namespace yang sama. Nilai password tidak disimpan dalam evidence.
- Secret tersedia sebagai object runtime di luar render manifest proyek.
- Environment dari ConfigMap dibaca saat pod dibuat. Perubahan ConfigMap saja
  tidak memperbarui environment proses yang sudah berjalan; jalur deployment
  perlu menyertakan pembaruan pod yang terkontrol.

### Deployment, probes, dan resource

| Pengaturan | Nilai | Arti |
| --- | --- | --- |
| startupProbe | /health/live, period 5s, failure threshold 12 | Anggaran startup sekitar 60s sebelum dinilai gagal |
| livenessProbe | /health/live, period 10s | Memeriksa proses HTTP; tidak menjadikan DB sebagai alasan restart proses |
| readinessProbe | /health/ready, period 5s | Memeriksa SELECT 1; schema/transaksi tetap diuji terpisah |
| requests | 100m CPU, 128Mi RAM | Baseline untuk penjadwalan dan perhitungan HPA |
| limits | 250m CPU, 256Mi RAM | Batas container; bukan hasil optimasi kapasitas |
| RollingUpdate | maxUnavailable 0, maxSurge 1 | Memerlukan ruang untuk satu pod tambahan saat rollout |
| Security context | UID/GID/fsGroup 10001, non-root | Identitas proses sesuai kandidat image dan akses group volume |

GET live dan ready melalui Ingress memberikan 200. GET readiness melalui DNS
Service `journalfit-backend.default.svc.cluster.local:80` dari masing-masing pod
juga memberikan 200. Source readiness hanya menguji database connection/query,
bukan semua kemampuan bisnis.

### Storage dan izin

Direktori /app/uploads pada kedua pod teramati uid 0, gid 10001, mode **2777**,
dan writable oleh proses uid/gid 10001. Mount volume menggantikan direktori image;
karena itu izin volume harus diperiksa terpisah dari Dockerfile.

PVC RWO berbagi satu node agent berlabel journalfit-storage=uploads. PV memakai
local volume dengan node affinity ke agent-0. Reclaim policy **Delete** tercatat.
Annotations Prune=false/Delete=false mengatur perilaku Argo, bukan perlindungan
terhadap penghapusan PVC secara manual atau kehilangan node/cluster.

Mode 2777 masih mengizinkan akses write untuk others; pembatasan permission volume
menjadi tindak lanjut security. Audit ini membuktikan akses fungsional, bukan
menyatakan filesystem sudah least-privilege. Request 1Gi juga bukan bukti kuota
filesystem dipaksakan.

### HPA dan replica ownership

Deployment source sengaja tidak menuliskan spec.replicas; HPA menjadi pemilik
jumlah replica. Live dan server dry-run sama-sama menunjukkan 2 replica.
AbleToScale dan ScalingActive bernilai True. ScalingLimited dapat True ketika
perhitungan dibatasi min/max; itu tidak otomatis berarti controller rusak.

Target CPU 70% dihitung terhadap **request 100m**, sehingga sekitar **70m CPU
rata-rata per pod**, bukan 70% dari limit 250m. Pengujian load scale-up/down belum
dilakukan pada Tahap 4.

## 3. Traceability dan handoff M4

Tag yang dirender cocok dengan workload dan imageID pod:
`registry:5000/journalfit-backend:stage2-20261117t055120z-d9ab35a`, digest
`sha256:9aa3893aa1a763fb818af769e98db305c4afcbd34e5685231e571783e4d91557`.
Tag dipertahankan sesuai pola updater tim; digest dicatat/diverifikasi. Menambahkan
digest pin memerlukan penyesuaian updater yang saat ini mengubah newTag saja.

Temuan handoff yang perlu diketahui:

1. `prepare-image-update.sh` menerima SHA 7 karakter, sedangkan artifact manual
   M3 memakai tag stage2 bertimestamp. Release CI berikutnya perlu versi/metadata
   yang konsisten dengan konvensi tim; tag lama tidak ditimpa untuk isi berbeda.
2. File Argo Application sudah mempunyai auto-sync/prune/selfHeal, tetapi belum
   ada Application aktif. Sebelum aktivasi, remote Git/revision harus benar-benar
   berisi desired state yang disepakati; file lokal tidak otomatis dibaca Argo.
3. Source Argo mengabaikan spec.replicas dengan RespectIgnoreDifferences, sesuai
   kebutuhan HPA. Integrasi Argo/HPA tetap perlu uji M4.

## Interpretasi, batas, dan keputusan

Review formal Tahap 4 selesai: konfigurasi konsisten dan dapat diterima API server,
route mengarah ke pod yang benar, environment cocok, serta volume dapat diakses
dengan identitas yang dirancang. Lanjutkan **Tahap 5: transaksi DOCX end-to-end**.

Hasil ini tidak membuktikan kapasitas maksimal, load autoscaling, semua skenario
gagal, request draining, backup/restore, atau HA lintas node. Riwayat restart satu
kali per pod dicatat dengan last exit 143; saat review keduanya Ready. Penyebab
utama termination tersebut tidak ditentukan oleh review ini.

Command terpusat ada pada [panduan M3](../../../deployment/PANDUAN_M3.md).

## Verifikasi akhir evidence

- Fingerprint script dan ketujuh manifest cocok dengan file saat ini.
- Seluruh 26 check bernilai true; enam resource diterima dan diff exit 0.
- Environment dan request Service kedua pod diperiksa; Secret dicatat sebagai
  metadata/key saja.
- Sintaks Python dan dua blok PowerShell Tahap 4 lulus pemeriksaan.
- Sebanyak 91 tautan lokal pada enam dokumen terkait memiliki target yang tersedia.
- `git diff --check` lulus; kode/config aplikasi M2 tetap sesuai baseline.
