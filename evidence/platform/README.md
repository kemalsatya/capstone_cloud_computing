# Indeks pemeriksaan platform M3

**Status per 2026-11-22:** Tahap 7 menghasilkan paket panduan, demo, dan handoff;
rehearsal lokal lulus. Uji laptop kedua dan penerimaan M4 masih terbuka. Core
transaksi DOCX Tahap 5 lulus dengan temuan M2; persistensi dan rollout Tahap 6
lulus 13/13 check.
Seluruh isi platform terdahulu telah dipindahkan ke
[arsip belum terverifikasi](../_archive/platform-unverified-2026-11-17/ARCHIVE_STATUS.md).

## Hasil penataan Tahap 0

**Tahap 0 selesai.** Pemeriksaan baru pada tahap ini terbatas pada arsip dan
dokumentasi.

- 48 file asli, total 273.265 byte, telah diarsipkan.
- SHA-256, ukuran, dan waktu modifikasi cocok sebelum dan setelah pemindahan.
- [Manifest checksum](../_archive/platform-unverified-2026-11-17/SHA256SUMS.txt)
  cocok dengan seluruh file asli di arsip.
- Pemeriksaan ini membuktikan integritas pengarsipan, bukan kebenaran hasil
  pengujian aplikasi atau kondisi Docker/Kubernetes.
- Kedua blok command PowerShell Tahap 0 pada panduan telah dijalankan dan berhasil.
- Pemeriksaan 33 tautan lokal pada delapan dokumen aktif tidak menemukan target
  yang hilang. Tautan historis di dalam file arsip asli tidak termasuk cakupan.

## Penelusuran Tahap 1

[Catatan kontrak M2](tahap-1-kontrak-m2.md) menjelaskan temuan source beserta revision,
metode, rujukan baris, interpretasi, keterbatasan, dan keputusan yang didukung.
Pemeriksaan ini tidak menjalankan aplikasi atau test. Penelusuran source, command
metadata, dan dokumentasi Tahap 1 telah selesai diperiksa. Hasil runtime berikutnya
dicatat terpisah sesuai cakupannya.

## Pengujian Tahap 2

[Evidence image/container](tahap-2/README.md) mencatat build utama dan build ulang,
Node 22.23.5, UID/GID 10001, filesystem produksi, 10 test lulus, health positif/
negatif, serta marker volume Docker. Raw metadata, TAP, JSON, dan log baru tersedia
pada folder tersebut. Pengujian Kubernetes dan transaksi DOCX tetap terbuka.

## Daftar pemeriksaan

[Tahap 7](tahap-7/README.md) mencatat rehearsal demo (upload 201, report 200,
checksum cocok), impor schema pada PostgreSQL terpisah, serta build/push dan
server dry-run enam resource. [Handoff M4](../../automation/handoff/M3_TO_M4.md)
siap direview; bukti pipeline live dan uji laptop kedua masih terbuka.

[Pengujian Tahap 5](tahap-5/README.md) memakai tenant/fixture QA baru. Empat skenario
DOCX lulus, API/database/file cocok, tetapi TXT masih diterima dan error ukuran
masih 500. Status needs_attention serta [handoff M2](../../automation/handoff/STAGE5_APPLICATION_FINDINGS.md)
dipertahankan; hasil tidak dinyatakan semua lulus.

[Pengujian Tahap 6](tahap-6/README.md) mengukur satu penggantian pod dan rolling
update. Laporan, database, dan byte file tetap sama; 117/117 probe berhasil; PVC
tetap Bound. Batas PVC RWO satu node serta observasi resume lab dicatat.

[Review manifest Tahap 4](tahap-4/README.md) lulus 26 check dengan server dry-run,
diff exit 0, environment kedua pod sesuai, Service/Ingress dapat diakses, dan
folder upload writable. Batas resource, storage, serta handoff tetap dicatat.

[Audit lingkungan Tahap 3](tahap-3/README.md) memeriksa lima area secara terstruktur.
Status needs_attention mempertahankan temuan Gitea yang belum diinisialisasi;
dependency aplikasi tetap siap untuk review manifest. Metrik aplikasi dan role
database juga mempunyai tindak lanjut yang dicatat.

[Verifikasi langsung M3](m3-live-20261117/README.md) berisi snapshot workload dan
transaksi baru. Hasil ini menjadi dasar presentasi progress deployment.

| Tahap | Kemampuan yang akan diperiksa | Status baru |
| --- | --- | --- |
| 1 | Kontrak runtime dan alur aplikasi M2 berdasarkan source | Selesai: pembacaan source dan pemeriksaan dokumentasi |
| 2 | Build image, user container, izin upload, dan runtime Docker | Selesai: build ulang dan skenario Docker lulus |
| 3 | Tools, layanan inti, database, registry, jaringan, dan cluster | Audit selesai dengan temuan; siap review manifest |
| 4 | Konsistensi manifest, probes, resource, konfigurasi, dan volume | Selesai: 26 check dan no-drift pada waktu review |
| 5 | Transaksi DOCX nyata melalui endpoint Kubernetes | Pengujian selesai; core lulus, dua temuan input M2 terbuka |
| 6 | Persistensi setelah penggantian pod dan perilaku rollout | Selesai: 13/13 check; penggantian 13,23 dtk dan rollout 22,44 dtk |
| Tambahan | HPA setelah deployment dasar stabil | Belum dimulai |
| 7 | Panduan lengkap, demo, portabilitas, dan handoff ke M4 | Paket siap direview, rehearsal lokal lulus; laptop kedua dan penerimaan M4 terbuka |

Evidence runtime Docker baru tersedia pada Tahap 2. Daftar ini diperbarui setelah
pemeriksaan nyata selesai, termasuk jika hasilnya gagal atau perlu perbaikan.

## Format setiap evidence baru

1. **Scope:** komponen atau kemampuan yang diuji.
2. **Owner:** pelaksana dan peninjau.
3. **Source/version:** commit dan perubahan lokal, konfigurasi, versi tools, tag
   serta digest image yang relevan.
4. **Timestamp:** waktu aktual pengujian dengan zona waktu.
5. **Method:** command, prasyarat, fixture, dan skenario.
6. **Observation:** output, exit code, dan hasil yang benar-benar teramati.
7. **Interpretation:** arti hasil terhadap kemampuan yang diuji.
8. **Limitation:** batas kesimpulan dan kondisi yang belum diuji.
9. **Decision supported:** keputusan yang dipertahankan atau diperbaiki.

Hasil yang diharapkan pada panduan berbeda dari observasi aktual pada evidence.
Pengujian baru memakai waktu dan versi aktual; isi arsip tetap menjadi rekaman lama.

Urutan kerja dan command utama ada di [PANDUAN_M3.md](../../deployment/PANDUAN_M3.md).
