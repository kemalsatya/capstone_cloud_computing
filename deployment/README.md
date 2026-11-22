# Manifest platform JournalFit

**Status per 2026-11-21: review formal Tahap 4 lulus 26 check; persistensi dan
rollout diukur pada Tahap 6.** Render, server dry-run, drift, environment/probes,
routing, dan izin volume tercatat pada
[evidence Tahap 4](../evidence/platform/tahap-4/README.md). Image baru, dua pod
Ready, Service/Ingress, PVC, transaksi DOCX, penggantian pod, dan rolling update
dibuktikan melalui [verifikasi langsung](../evidence/platform/m3-live-20261117/README.md)
serta [evidence Tahap 6](../evidence/platform/tahap-6/README.md).
Urutan command ada pada [panduan M3](PANDUAN_M3.md).

Rekaman pengujian lama berada dalam
[arsip platform](../evidence/_archive/platform-unverified-2026-11-17/ARCHIVE_STATUS.md).
Status pemeriksaan baru dicatat pada [indeks aktif](../evidence/platform/README.md).
Container yang lulus [pengujian Docker Tahap 2](../evidence/platform/tahap-2/README.md)
sudah dipublikasikan dan dipakai manifest dengan tag stage2-20261117t055120z-d9ab35a.

## Peta file yang tersedia

| File | Hasil review Tahap 4 | Batas/tindak lanjut |
| --- | --- | --- |
| `configmap.yaml` | Enam key non-secret cocok dengan environment kedua pod | Perubahan env memerlukan pembaruan pod terkontrol |
| `pvc.yaml` | Bound, local-path RWO 1Gi, folder writable | Satu node, mode 2777, reclaim Delete; bukan backup/HA |
| `deployment.yaml` | Image teruji, UID/GID 10001, probes/resource/rollout konsisten | Resource baseline dan draining perlu pengujian lanjutan |
| `service.yaml` | Port 80 -> named port http/8000; EndpointSlice cocok dengan pod Ready | Pertahankan selector/port saat perubahan |
| `ingress.yaml` | Traefik host journalfit.localhost berhasil mengakses health | Akses lokal; lingkungan lain perlu validasi |
| `kustomization.yaml` | Entry point manifest; tag stage2-20261117t055120z-d9ab35a | Pertahankan traceability saat handoff M4 |
| `hpa.yaml` | Pemilik replica, target CPU 70% dari request, min 2/max 3 | Load scale-up/down belum diuji formal |

## Keputusan dan batas yang dicatat

- Dockerfile baru memakai base Node 22 yang dipin dan UID/GID 10001, sesuai angka
  pada Deployment. Izin tulis PVC dan checksum DOCX sesudah penggantian satu pod
  sudah diperiksa pada lab; batas storage satu node tetap berlaku.
- ConfigMap host.docker.internal sesuai jalur lab yang diuji. Environment kedua
  pod cocok; perubahan ConfigMap tidak otomatis mengganti environment proses.
- Readiness aplikasi memakai `SELECT 1`; schema dan transaksi diperiksa terpisah.
- Semua replica diarahkan ke satu node berlabel `journalfit-storage=uploads` dan
  berbagi PVC lokal. Tahap 6 mengukur persistensi dan rollout pada rancangan ini;
  batas satu node tetap berlaku.
- HPA mengelola replica; Deployment sengaja tidak menulis spec.replicas. Server
  dry-run mempertahankan 2 replica saat review. Integrasi dengan Argo diuji di M4.
- Registry, imageID pod, namespace, dan context sudah diperiksa pada verifikasi
  langsung. Tidak ada Argo Application aktif yang mengelola workload; handoff M4
  tetap memerlukan pembuktian delivery tersendiri.

## Urutan penggunaan

1. Pahami [kontrak aplikasi M2](INTEGRATION_CONTRACT.md) melalui source.
2. Tinjau dan uji image aplikasi.
3. Inventarisasi lingkungan dan data yang sudah tersedia.
4. Tinjau manifest, lalu lakukan validasi dan deployment bertahap.
5. Catat hasil baru, termasuk kegagalan dan batas kesimpulannya.

Command dijadikan satu di [PANDUAN_M3.md](PANDUAN_M3.md) saat tahap terkait selesai
ditinjau dan diuji. Rincian integrasi terdahulu tetap tersedia pada bagian riwayat
kontrak; seluruh klaim runtime di sana berstatus belum diverifikasi ulang.
