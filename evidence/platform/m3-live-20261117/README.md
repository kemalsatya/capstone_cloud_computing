# Verifikasi langsung M3 — 2026-11-17

**Hasil: baseline deployment M3 lulus pada lingkungan lokal.** Hasil ini merupakan
pengujian baru, terpisah dari arsip lama dan dari pengujian Docker Tahap 2.

## Scope, owner, dan versi

- Scope: registry -> Kubernetes -> Service/Ingress -> transaksi DOCX -> penggantian
  satu pod dan pemeriksaan file/laporan.
- Pelaksana: agen coding atas permintaan pemilik M3 untuk menyiapkan demonstrasi.
- Image: `registry:5000/journalfit-backend:stage2-20261117t055120z-d9ab35a`.
- Digest registry dan imageID kedua pod:
  `sha256:9aa3893aa1a763fb818af769e98db305c4afcbd34e5685231e571783e4d91557`.
- Runtime pod: Node v22.23.5, UID/GID 10001.
- Cluster/context: capstone / k3d-capstone; namespace default; k3s v1.35.5+k3s1.
- Waktu transaksi dan penggantian pod:
  `2026-11-17T13:38:03.225512+07:00` sampai `2026-11-17T13:38:36.831696+07:00`.

## Method

1. Inventarisasi container, node, schema enam tabel, Secret runtime berdasarkan
   nama saja, label storage, dan PVC yang sudah ada.
2. Mulai cluster capstone yang sebelumnya berhenti. Command k3d start mencapai
   timeout terminal 180 detik saat inisialisasi; pemeriksaan berikutnya membuktikan
   kedua node Ready dan API dapat diakses. Cluster/data tidak dibuat ulang.
3. Tag/push artifact teruji ke registry lokal, lalu perbarui referensi image di
   Deployment dan Kustomize. Server dry-run lulus sebelum apply/rollout.
4. Pastikan tidak ada Argo Application yang merekonsiliasi workload. Deployment
   ini manual untuk M3, bukan bukti jalur CI/CD M4.
5. Jalankan [script uji langsung](../../../automation/scripts/test-m3-live.py)
   dengan fixture DOCX panduan infrastruktur dosen dan tenant khusus tenant-m3-demo.
6. Upload, ambil laporan, cocokkan checksum dengan file sumber, ganti satu pod
   secara normal, lalu periksa checksum pada kedua pod dan ambil laporan lagi.

Command reproduksi dan demo ada pada [panduan utama](../../../deployment/PANDUAN_M3.md).
Node snapshot hanya menyimpan field yang dibutuhkan, tanpa annotation lingkungan.
Nilai Secret tidak diambil atau disimpan sebagai evidence.

## Observation

| Kemampuan | Hasil aktual | Bukti |
| --- | --- | --- |
| Cluster | Dua node Ready | [nodes.json](run-20261117T063803Z/nodes.json) |
| Workload | Dua replica Ready, image baru, non-root | [deployment.json](run-20261117T063803Z/deployment.json), [pods sesudah](run-20261117T063803Z/pods-after.json) |
| Konfigurasi | ConfigMap/Secret reference, tiga jenis probes, requests/limits, dan mount upload tercantum di workload | [deployment.json](run-20261117T063803Z/deployment.json) |
| Akses | Root, liveness, readiness HTTP 200 melalui Ingress | [results.json](run-20261117T063803Z/results.json), [service](run-20261117T063803Z/service.json), [ingress](run-20261117T063803Z/ingress.json) |
| Storage | PVC 1Gi RWO Bound, node local-path | [pvc.json](run-20261117T063803Z/pvc.json) |
| Transaksi | Upload 201; report sebelum/sesudah penggantian pod 200 | [results.json](run-20261117T063803Z/results.json) |
| Data demo | Manuscript ms-519b3203; tenant tenant-m3-demo; hasil COMPLETED | [results.json](run-20261117T063803Z/results.json) |
| Persistensi | Checksum DOCX sebelum/sesudah sama dengan fixture pada kedua pod | [results.json](run-20261117T063803Z/results.json) |
| Reconciliation | Satu UID pod diganti; dua pod Ready kembali dalam observasi 13,36 detik | [pods sebelum](run-20261117T063803Z/pods-before.json), [pods sesudah](run-20261117T063803Z/pods-after.json), [results.json](run-20261117T063803Z/results.json) |

Fixture adalah panduan infrastruktur DOCX, bukan artikel jurnal. Evaluator
menghasilkan 2.143 kata, skor 50, dan warning jumlah kata/abstract/keywords. Ini
adalah keluaran pemeriksaan terhadap fixture tersebut; HTTP sukses tidak berarti
dokumen memenuhi aturan format jurnal.

## Interpretation dan keputusan

Artifact hasil build benar-benar ditarik dan dijalankan di Kubernetes. Jalur
Service/Ingress dapat digunakan, dan data/file demo tetap dapat diambil setelah
penggantian satu pod. Kemampuan inti M3 memiliki bukti aktual: container,
declarative workload, exposure, configuration, probes, resource, serta persistensi.

Lanjutkan pengembangan melalui kontrak yang sama. Snapshot ini menjadi dasar
presentasi progress dan handoff M4; pengujian lengkap berikutnya tetap dicatat
sesuai cakupannya.

## Limitation

- Dua replica berbagi PVC pada satu node; bukan bukti HA terhadap node failure.
- Satu penggantian pod bukan backup/restore atau disaster recovery.
- Waktu 13,36 detik mencakup polling dan bukan SLO produksi.
- Rollout berhasil, tetapi trafik kontinu dan jaminan tanpa downtime tidak diuji.
- HPA tersedia, tetapi load test scaling baru belum dilakukan.
- Resource adalah baseline; rightsizing dan kapasitas maksimal belum dievaluasi.
- CI/CD/Argo end-to-end, IAM penuh, scan, backup/restore, dan laptop lain tetap
  memerlukan milestone/pengujian tersendiri.

## Starter presentasi Compose

[compose.yaml](../../../compose.yaml) ditambahkan untuk menyalakan lingkungan M3
yang sudah tersedia melalui satu job Docker CLI. [Rekaman uji](compose-starter.json)
mencatat Compose config yang valid, invocation yang berhasil, readiness/laporan
200, serta timestamp container yang tetap sama pada uji saat semuanya sudah aktif.
Cold restart seluruh lab dan provisioning laptop baru belum diuji oleh starter ini.
