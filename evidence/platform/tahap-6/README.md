# Pengujian persistensi dan rollout Tahap 6 — 2026-11-21

**Status: lulus 13/13 check.** Satu pod diganti dan seluruh replica menjalani
rolling update. Laporan, record PostgreSQL, dan byte file tetap sama; 117 probe
layanan selama rollout semuanya berhasil.

## Scope, owner, source, dan waktu

- Scope: persistensi data/file pada PVC bersama, reconciliation setelah satu pod
  dihapus, dan perilaku layanan selama rolling update Deployment.
- Pelaksana: agen coding atas instruksi pemilik M3.
- Run utama: [results.json](run-20261121t123048z-438991/results.json).
- Waktu: `2026-11-21T19:30:48.428858+07:00` sampai
  `2026-11-21T19:31:59.823076+07:00`.
- Baseline HEAD: d9ab35a10eab8e9c67e45bc53f8a22522846b038, dengan perubahan
  packaging yang dicatat pada tahap sebelumnya. Fingerprint 15 file JS ada pada
  results.json.
- Image: `registry:5000/journalfit-backend:stage2-20261117t055120z-d9ab35a`,
  digest `sha256:9aa3893aa1a763fb818af769e98db305c4afcbd34e5685231e571783e4d91557`.
- [Runner](../../../automation/scripts/test-stage6-persistence-rollout.py), SHA-256:
  `2c217e644b0414253f958e3077b5103479bd066b9e2b79f02a08775306b02d24`.
- Tenant QA: `s6-20261121t123048z-438991`; fixture 1.127 byte, SHA-256
  `5407d163f6ce28641df03097fd575ac162a7580e416014b711dec284c166dc72`.
- Cluster/context: capstone / k3d-capstone; namespace default; k3s v1.35.5+k3s1.

## Method

1. Tunggu Deployment dan HPA stabil: `observedGeneration == generation`,
   `readyReplicas == replicas`, dan HPA `currentReplicas == desiredReplicas ==
   replicas` selama 15 detik.
2. Baca laporan dan file demo lama sebagai observasi tambahan setelah lab
   dihentikan dan dinyalakan kembali.
3. Upload DOCX valid 3.500 kata melalui Ingress (manuscript `ms-d124d319`, 1.127
   byte); periksa laporan, record PostgreSQL, dan byte file pada setiap pod Ready.
4. Skenario A: hapus satu pod Ready dengan grace period 30 detik. Poll sampai pod
   pengganti Ready dan pod lama benar-benar hilang; periksa laporan, database, dan
   file kembali.
5. Skenario B: jalankan `kubectl rollout restart`. Selama `kubectl rollout status`
   menunggu, probe `/health/ready` empat kali per detik dan endpoint report satu
   kali per detik melalui Ingress. Sesudah rollout, periksa laporan, database,
   file, UID pod, restart count, PVC, dan node.
6. Verifikasi SQL memakai transaksi READ ONLY dan hanya membaca tenant QA run ini.
   Runner tidak menghapus atau mengganti data yang sudah ada.

## Baseline

| Item | Hasil aktual |
| --- | --- |
| Deployment | generation 20, observed 20; 2/2 Ready dan available |
| Strategi | RollingUpdate, `maxSurge: 1`, `maxUnavailable: 0`, `minReadySeconds: 5` |
| HPA | 2/2 replica, target CPU 70%, stabil setelah 17,18 detik |
| Node | 2 Ready, k3s v1.35.5+k3s1 |
| PVC | `journalfit-uploads` Bound, 1Gi RWO, local-path |
| Pod awal | `7496d44d87-stdss` dan `7496d44d87-s68jp`, restart 0 |

Pod awal run ini dibuat oleh rollout percobaan runner sebelumnya pada 12:29–12:30Z.
Riwayat restart dari lab yang berhenti 18–21 November tercatat pada pod lama
`b84c65dd-*` di [percobaan pertama](run-20261121t122744z-3d898d/results.json):
container dimulai `2026-11-21T12:20:41Z`, berhenti `2026-11-18T13:22:35Z`, dan
restart count 5.

## Observasi resume lab

- Manuscript demo `ms-519b3203` (tenant `tenant-m3-demo`) masih dapat dibaca:
  HTTP 200, status COMPLETED, skor 50, tiga warning.
- `upload_time` record: `2026-11-17T06:38:19.608Z`.
- File `/uploads/ms-519b3203-M3_Demo_JournalFit.docx` masih ada: 273.068 byte,
  mtime `2026-11-17T06:38:13.811Z`, UID/GID 10001, mode 0644.
- Pod lama menunjukkan container berhenti `2026-11-18T13:22:35Z` dan mulai lagi
  `2026-11-21T12:20:41Z`; data 17 November tetap dapat dibaca setelah jeda itu.

Ini observasi, bukan uji shutdown terkontrol: penghentian Docker Desktop/lab tidak
diprogram oleh runner, dan tidak ada backup/restore yang diuji.

## Skenario A: satu pod dihapus

| Item | Hasil aktual |
| --- | --- |
| Pod target | `journalfit-backend-7496d44d87-s68jp` |
| Pod pengganti | `journalfit-backend-7496d44d87-45bmt`, UID baru |
| Waktu sampai pengganti Ready | **13,226 detik** |
| Waktu sampai pod lama hilang | **13,226 detik** |
| Pod lama | UID tidak ada lagi pada snapshot sesudah |
| Report | HTTP 200; ID, tenant, skor 100, status, dan findings sama |
| Database | Snapshot READ ONLY sebelum/sesudah identik |
| File | 1.127 byte, SHA-256 `5407d163...` cocok pada kedua pod; mode 0644, UID 10001 |
| Restart | Pod baru tidak menambah restart |

`replacementSeconds` 0,317 detik pada results.json adalah durasi pemeriksaan
stabilitas setelah loop; metrik penggantian yang utama adalah
`replacementReadySeconds` 13,226 detik.

## Skenario B: rolling update

| Item | Hasil aktual |
| --- | --- |
| Pemicu | `kubectl rollout restart deployment/journalfit-backend` |
| Generation | 20 -> 21; ReplicaSet baru `6df66fd858` |
| Durasi sampai status sukses | **22,441 detik** |
| Pod sesudah | `6df66fd858-gklcz` dan `6df66fd858-hl95n`, restart 0 |
| Pod lama | Semua UID lama hilang; dua UID baru Ready |
| Probe readiness | **94/94 HTTP 200**, 0 gagal, streak gagal 0 |
| Probe report | **23/23 HTTP 200**, 0 gagal, streak gagal 0 |
| Report | HTTP 200; signature sama dengan sebelum disruption |
| Database | Snapshot READ ONLY sebelum/sesudah identik |
| File | Ukuran dan SHA-256 sama pada kedua pod baru |
| PVC/node | PVC tetap Bound; kedua node tetap Ready |

Probe berjalan dari 12:31:29,870Z sampai 12:31:55,156Z (sekitar 25,3 detik),
sedikit lebih lama dari durasi rollout karena runner menunggu ekor probe. Seluruh
117 request berhasil. Angka ini adalah hasil skenario ini, bukan jaminan SLO atau
bukti untuk semua jenis trafik.

## Checks

| Check | Hasil |
| --- | --- |
| `baselineStableAndHpaSettled` | Lulus |
| `demoDataReadableAfterResume` | Lulus |
| `uploadAccepted` | Lulus |
| `podDeleteReconciled` | Lulus |
| `dataUnchangedAfterPodDelete` | Lulus |
| `fileUnchangedAfterPodDelete` | Lulus |
| `rolloutCompleted` | Lulus |
| `rolloutReplacedAllPods` | Lulus |
| `serviceAvailableDuringRollout` | Lulus |
| `dataUnchangedAfterRollout` | Lulus |
| `fileUnchangedAfterRollout` | Lulus |
| `newPodsWithoutRestarts` | Lulus |
| `pvcStillBound` | Lulus |

## Interpretasi

Data PostgreSQL dan byte file berada pada storage yang tidak bergantung pada
proses pod: menghapus satu pod tidak menghilangkan laporan atau file, dan rolling
update seluruh replica tidak mengubah isi record maupun checksum file. Workload
juga direkonsiliasi kembali ke dua replica, dan layanan tetap menjawab 200 pada
probe yang dijalankan selama rollout.

Karena `maxUnavailable: 0` dan readiness probe aktif, rollout mempertahankan
kapasitas selama pod baru bertahap menjadi Ready. Hasil 117/117 mendukung
pernyataan "tidak ada kegagalan probe pada skenario ini", bukan pernyataan
zero-downtime tanpa syarat.

## Limitation

- Dua replica berada pada satu node dengan PVC RWO local-path; ini bukan bukti
  ketahanan terhadap node failure atau HA lintas node.
- Tidak ada backup/restore, node drain, atau disaster recovery pada run ini.
- Tidak ada upload/tulis baru selama rollout; yang diuji adalah pembacaan dan
  persistensi data yang sudah ada.
- Probe melalui Ingress dari host setiap 250 ms, bukan pengukuran SLO produksi
  atau seluruh jalur trafik.
- Rollout memakai image yang sama; belum menguji perubahan image/schema.
- HPA aktif selama pengujian dan sempat mencatat warning metrik ketika pod belum
  Ready pada percobaan sebelumnya; tidak ada scaling action pada run utama.
- Observasi resume lab tidak mengukur durasi atau integritas backup; ia hanya
  membaca data yang sudah ada setelah lab berhenti dan menyala kembali.
- Riwayat restart 5 pada pod lama berasal dari siklus berhenti/lanjut lab, bukan
  crash aplikasi yang terbukti dari run ini.

## Percobaan runner

Tiga percobaan awal berhenti karena bug runner, bukan kegagalan aplikasi/platform:

1. [run-20261121t122744z-3d898d](run-20261121t122744z-3d898d/results.json):
   berhenti sebelum upload karena objek pod dikirim ke fungsi yang memerlukan nama.
2. [run-20261121t122837z-c80bfc](run-20261121t122837z-c80bfc/results.json):
   berhenti pada query demo karena kolom `created_at` tidak ada; kolom yang benar
   adalah `upload_time`.
3. [run-20261121t122916z-cde83c](run-20261121t122916z-cde83c/results.json):
   menyelesaikan upload dan penggantian satu pod (12,73 detik, data utuh), memicu
   rollout yang selesai (generation 20, pod baru restart 0), lalu berhenti karena
   method `stop()` probe belum ada; log probe run itu tidak tersimpan.

Run utama `run-20261121t123048z-438991` memakai runner yang sudah diperbaiki dan
menjadi dasar status lulus. Folder percobaan dipertahankan sebagai jejak tooling;
tidak ada source aplikasi atau manifest yang diubah oleh pengujian.

## Decision supported

Tahap 6 selesai untuk skenario yang dinyatakan: persistensi data/file setelah
penggantian pod dan rolling update, serta layanan tetap tersedia selama rollout
yang diukur. Bukti demo lama tetap berlaku sesuai cakupannya. Berikutnya adalah
Tahap 7: melengkapi panduan, demo, reproduksi lingkungan, dan handoff; dua temuan
validasi input Tahap 5 tetap menjadi pekerjaan M2.
