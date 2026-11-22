# Tahap 5 — pengujian transaksi DOCX end-to-end

**Status: pengujian selesai dengan dua temuan aplikasi.** Empat skenario DOCX
utama lulus, tetapi validasi non-DOCX dan pemetaan error ukuran belum sesuai.
Status run dipertahankan sebagai **needs_attention**, bukan semua lulus.

## Scope, owner, source, dan waktu

- Scope: upload lewat Ingress -> parsing/evaluasi -> laporan -> PostgreSQL -> byte
  file pada volume, termasuk input negatif.
- Pelaksana: agen coding atas instruksi pemilik M3. Tindak lanjut fungsi aplikasi
  berada pada pemilik Application & Data/M2.
- Run: [results.json](run-20261118t124752z-08162c/results.json).
- Waktu: `2026-11-18T19:47:52.642518+07:00` sampai
  `2026-11-18T19:48:02.454715+07:00`.
- Baseline HEAD: d9ab35a10eab8e9c67e45bc53f8a22522846b038, dengan perubahan packaging
  yang dicatat pada tahap sebelumnya. Fingerprint 15 file JS ada pada results.json.
- [Script pengujian](../../../automation/scripts/test-stage5-transaction.py), SHA-256:
  `2ce226132f9be3e438cb3baf41459c2291be3d127109249cd0c0b64d95269f06`.
- Digest aplikasi: sha256:9aa3893aa1a763fb818af769e98db305c4afcbd34e5685231e571783e4d91557.

## Metode

1. Aktifkan lab yang sebelumnya berhenti, pastikan readiness dan rollout stabil.
   [Catatan startup](startup-observation.json) merekam observasi terminal: kelima
   container lama dinyalakan, data demo lama kembali dapat diambil.
2. Buat dua tenant QA unik per run melalui perilaku API yang tersedia. Snapshot
   awal membuktikan cohort belum mempunyai tenant/record.
3. Generate paket DOCX minimal yang valid melalui ZIP/OOXML dengan jumlah kata
   diketahui. Fixture disimpan agar bisa diperiksa ulang.
4. Kirim request HTTP nyata ke Ingress melalui 127.0.0.1:8088 dengan Host
   journalfit.localhost; source tidak dimock dan query aplikasi tidak distub.
5. Baca record PostgreSQL dari pod melalui transaksi READ ONLY, khusus tenant QA.
6. Cocokkan metadata, result, findings, ukuran, serta SHA-256 file pada kedua pod.
7. Jalankan kasus negatif dan pertahankan respons yang tidak sesuai sebagai temuan.

Pengujian menambahkan data QA melalui API. Tidak ada SQL penghapusan/reset atau
penggantian pod yang dilakukan oleh runner Tahap 5. File oversized dibuat di
memory; payload 20 MiB tidak disimpan sebagai fixture Git.

## Hasil skenario DOCX utama

| Skenario | Input | Expected / actual | ID naskah |
| --- | --- | --- | --- |
| Compliant tenant A | 3.500 kata, Abstract dan Keywords | HTTP 201, skor 100 / sesuai | ms-b9ba066e |
| Pendek tenant A | 100 kata, tanpa kedua penanda | HTTP 201, skor 50, tiga warning / sesuai | ms-b4a0f832 |
| Melebihi batas kata tenant A | 8.500 kata, kedua penanda ada | HTTP 201, skor 85, warning word count / sesuai | ms-826a5294 |
| Compliant tenant B | 3.500 kata | HTTP 201, skor 100 / sesuai | ms-556f34cf |

HTTP 201 berarti transaksi pemeriksaan berhasil dibuat. Dokumen DOCX yang kurang
sesuai aturan menghasilkan warning/skor rendah, bukan otomatis request gagal.
Skor 100 hanya menunjukkan tiga aturan MVP yang tersedia, bukan seluruh layout
atau kualitas naskah jurnal.

Fixture dapat diperiksa pada [compliant.docx](run-20261118t124752z-08162c/fixtures/compliant.docx),
[short.docx](run-20261118t124752z-08162c/fixtures/short.docx), dan
[long.docx](run-20261118t124752z-08162c/fixtures/long.docx). Dokumen bersifat sintetis,
bukan naskah penelitian pengguna.

## Laporan, database, dan file

- Semua upload yang diterima dapat dibaca kembali melalui report HTTP 200.
- [Database sebelum](run-20261118t124752z-08162c/database-before.json): cohort kosong.
- [Database sesudah](run-20261118t124752z-08162c/database-after.json): dua tenant,
  dua template, **lima manuscript, lima check result, 15 findings**.
- Record kelima adalah TXT yang seharusnya ditolak; keberadaannya merupakan bukti
  temuan F-01, bukan tambahan keberhasilan validasi tipe.
- Field API sesuai dengan record DB, termasuk ID/tenant/title/path, skor, status,
  dan setiap finding. Template tenant benar-benar min 3000/max 8000, dengan dua
  penanda diwajibkan.
- Lima file diterima ditemukan pada kedua pod, ukuran dan SHA-256 cocok dengan
  payload masing-masing. Tidak ada file yatim untuk prefix QA run ini.
- Readiness sesudah test tetap 200; tidak ada penambahan restart pada pod yang
  diamati selama pengujian.

## Kasus negatif dan temuan

| Kasus | Expected | Actual | Penilaian |
| --- | --- | --- | --- |
| Header tenant tidak ada | 400 | 400 | Sesuai |
| File tidak ada | 400 | 400 | Sesuai |
| ID laporan tidak ada | 404 | 404 | Sesuai |
| Tenant B membaca A dan A membaca B | 403 | 403 dua arah | Sesuai logika header yang tersedia |
| File .txt/text/plain, 45 byte | Client error 4xx | **201 dan tersimpan** | F-01: validasi tipe belum ketat |
| File 20 MiB + 1 byte | Client error, misalnya 413 | **500, File too large** | F-02: pemetaan error ukuran |

F-01 menghasilkan manuscript **ms-9e217e9d**, record, dan file nyata. Router belum
memvalidasi tipe file dan kegagalan Mammoth difallback ke UTF-8 pada jalur produksi.

Untuk F-02, file/record oversized tidak tersimpan: batas ukuran bekerja.
[Log diagnostik](run-20261118t124752z-08162c/oversize-diagnostic.log) menunjukkan
MulterError code LIMIT_FILE_SIZE, yang belum dipetakan ke respons client yang
sesuai oleh error handler. Log diambil menggunakan kubectl logs dengan since-time
2026-11-18T12:47:52Z, tail=-1, dan prefix pod.

## Interpretasi dan tindak lanjut

`testExecutionCompleted=true` dan `coreWorkflowPassed=true` berarti pengujian
selesai dan transaksi DOCX yang diharapkan bekerja beserta penyimpanannya lulus.
Dua check input bernilai false tetap membuat status **needs_attention**, exit 2.

[Handoff M2](../../../automation/handoff/STAGE5_APPLICATION_FINDINGS.md) menjelaskan
respons aktual, lokasi source, dan kriteria perbaikan. Setelah ada perubahan
aplikasi, gunakan artifact/source metadata baru dan run baru untuk regression;
evidence lama tidak dilabeli ulang.

Tahap 6 dapat menggunakan fixture DOCX valid untuk uji persistensi/reconciliation
yang terkontrol. Kedua temuan aplikasi tetap terbuka dan harus diverifikasi ulang
pada versi perbaikannya sebelum menyatakan validasi input lengkap.

## Limitation

- Auth masih mock; 403 dua arah membuktikan mismatch header, bukan identitas
  tenant terpercaya atau RBAC/OIDC penuh.
- Empat DOCX sintetis menguji tiga aturan MVP. Tidak menguji font/margin, AI,
  dokumen kompleks/gambar, atau seluruh variasi Word.
- Satu request oversized bukan load test atau bukti kapasitas maksimal/SLO.
- Tidak ada failure injection di tengah upload, restart pod, node failure, atau
  backup/restore pada run ini. Konsistensi normal bukan bukti atomicity file+SQL.
- Pemeriksaan file yatim dibatasi prefix QA run ini; data lama tidak dinilai ulang.
- Resume lab sebelum test menggunakan container/data yang sudah ada, bukan setup
  laptop baru atau disaster recovery.

## Verifikasi akhir evidence

- Fingerprint runner dan 15 file source JS sesuai dengan hasil run.
- ZIP/OOXML dan teks fixture diperiksa independen: 3500/100/8500 kata sesuai.
- Empat skenario utama lulus; dari 17 request HTTP terdapat dua expectation input
  yang tidak sesuai dan tetap tercatat sebagai temuan.
- Dua tenant QA, lima manuscript/result, 15 findings, dan byte kelima file pada
  kedua pod sesuai dengan snapshot serta respons yang tercatat.
- File oversized tidak tersimpan; log memuat code LIMIT_FILE_SIZE.
- Sintaks Python, blok PowerShell Tahap 5, dan JSON observasi startup diperiksa.
- Sebanyak 100 tautan lokal pada enam dokumen terkait memiliki target tersedia.
- `git diff --check` lulus; source aplikasi tetap sesuai baseline M2.
