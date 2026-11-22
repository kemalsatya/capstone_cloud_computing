# JournalFit - Capstone Cloud Computing

JournalFit membantu memeriksa naskah DOCX sebelum submission jurnal. Source backend
menggunakan Express/Node.js dan PostgreSQL. Pekerjaan platform M3 ditinjau ulang
dengan target utama Windows dan Docker Desktop Linux containers.

## Status M3 per 2026-11-22

**Baseline M3 telah diverifikasi pada lingkungan lokal:** image baru berjalan pada
dua pod, transaksi DOCX berhasil, dan data/file tetap tersedia setelah penggantian
pod serta rolling update. [Bukti pengujian langsung](evidence/platform/m3-live-20261117/README.md)
dan [pengukuran Tahap 6](evidence/platform/tahap-6/README.md).
Endpoint demo: **http://journalfit.localhost:8088/**. Evidence lama dipisahkan ke
[arsip belum terverifikasi](evidence/_archive/platform-unverified-2026-11-17/ARCHIVE_STATUS.md).
Isi rekaman lama tidak menjadi dasar untuk menyatakan aplikasi, cluster, rollout,
scaling, atau persistensi saat ini sudah benar.

Tahap 0 menata arsip, Tahap 1 menelusuri source M2, Tahap 2 menguji container, dan
Tahap 3-6 memeriksa lingkungan, manifest, transaksi, serta persistensi/rollout.
Cakupan dan langkah selanjutnya tersedia pada
[roadmap dan panduan M3](deployment/PANDUAN_M3.md).

**Urutan formal saat ini:** [Tahap 7](evidence/platform/tahap-7/README.md) menyiapkan
panduan operator, demo, dan [handoff M4](automation/handoff/M3_TO_M4.md). Rehearsal
lokal lulus: upload DOCX 201, report 200 dengan skor 100, checksum cocok di kedua
pod. Setup di laptop kedua dan penerimaan M4 masih terbuka. [Tahap 6](evidence/platform/tahap-6/README.md)
lulus 13/13 check, dengan rollout 22,44 detik dan 117/117 probe berhasil.
[Temuan input Tahap 5](automation/handoff/STAGE5_APPLICATION_FINDINGS.md) tetap
menjadi tindak lanjut M2.

## Mulai presentasi dengan Compose

Jalankan dari root repository dengan PowerShell:

```powershell
.\start-presentasi.ps1 -UploadFixture -BukaBrowser
```

Script [start-presentasi.ps1](start-presentasi.ps1) menjalankan Compose, menunggu
pesan `[M3 SIAP]`, menampilkan node/workload/PVC dan readiness, mengunggah satu
DOCX QA dari repo, lalu menampilkan laporannya. `-BukaBrowser` membuka
**http://journalfit.localhost:8088/**. Tanpa `-UploadFixture`, starter membaca
laporan demo lama jika tersedia di lab.
[compose.yaml](compose.yaml) menyalakan lima container lab yang sudah ada dan
menunggu registry serta readiness API. Backend tetap dikelola Kubernetes.
Untuk lab kosong, ikuti [panduan setup Windows](deployment/SETUP_LAPTOP_M3.md)
sebelum menjalankan starter.

## Mulai membaca

1. [Roadmap dan panduan command M3](deployment/PANDUAN_M3.md).
2. [Indeks pemeriksaan dan evidence platform aktif](evidence/platform/README.md).
3. [Peta manifest yang akan ditinjau](deployment/README.md).
4. [Kontrak integrasi M2 ke M3](deployment/INTEGRATION_CONTRACT.md).
5. [Asal, status, dan integritas arsip](evidence/_archive/platform-unverified-2026-11-17/ARCHIVE_STATUS.md).

## Source, konfigurasi, dan runtime

| Bagian | Yang tersedia di repository | Status |
| --- | --- | --- |
| Aplikasi M2 | Backend, schema SQL, dan source test di `source/` | Core E2E Tahap 5 lulus; validasi non-DOCX dan status ukuran masih perlu perbaikan |
| Container | Base Node 22 dipin, UID/GID 10001 | Build ulang dan skenario Docker lulus; [evidence Tahap 2](evidence/platform/tahap-2/README.md) |
| Kubernetes | Manifest memakai image stage2-20261117t055120z-d9ab35a | Dua pod Ready, Service/Ingress, PVC, probes/resource, persistensi, dan rollout telah diukur |
| Infrastruktur lokal | Paket dosen dan environment yang ada | Lima area telah diaudit pada Tahap 3; detail versi dan temuan tercatat |
| Delivery M4 | Gitea/Argo dan bahan handoff | Gitea masih Installation, runner belum tersedia, Argo belum mempunyai Application |

Nilai yang tertulis di file tidak membuktikan nilai yang sedang digunakan oleh
container atau cluster. Versi source, image hasil build, dan image runtime akan
dicatat terpisah saat pengujian baru.

## Target akhir M3

- Image dapat dibangun ulang dari source yang dapat ditelusuri.
- Konfigurasi Kubernetes sesuai kebutuhan aplikasi, database, dan file DOCX.
- Akses layanan, probes, resource, storage, dan persistensi memiliki bukti baru.
- Satu panduan command menjelaskan tujuan, hasil yang diharapkan, dan diagnosis.
- Pemilik M3 dapat menjalankan serta menjelaskan prosedurnya.
- Penggunaan di laptop lain dinyatakan teruji setelah benar-benar dicoba di sana.

Command dikumpulkan di panduan utama, termasuk bagian **Demo langsung M3** untuk
menunjukkan workload, endpoint, laporan, dan upload. CI/CD penuh, security,
observability, backup/restore, dan portabilitas tetap memiliki bukti tersendiri.
