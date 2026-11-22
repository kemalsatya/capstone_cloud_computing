# Handoff temuan aplikasi dari pengujian Tahap 5

**Tanggal:** 2026-11-18. **Pemilik tindak lanjut:** Application & Data/M2.
Pengujian platform menemukan dua ketidaksesuaian input pada artifact yang aktif.

## Versi dan bukti

- Baseline source M2: d9ab35a10eab8e9c67e45bc53f8a22522846b038.
- Image aktif: registry:5000/journalfit-backend:stage2-20261117t055120z-d9ab35a.
- Digest: sha256:9aa3893aa1a763fb818af769e98db305c4afcbd34e5685231e571783e4d91557.
- [Ringkasan pengujian](../../evidence/platform/tahap-5/README.md).
- [Respons dan verifikasi aktual](../../evidence/platform/tahap-5/run-20261118t124752z-08162c/results.json).
- Command reproduksi berada pada bagian Tahap 5 di
  [panduan utama](../../deployment/PANDUAN_M3.md).

## F-01: file non-DOCX diterima

- Input: file `.txt`, MIME text/plain, 45 byte, bukan ZIP/DOCX.
- Expected: ditolak sebagai input tidak valid dengan 4xx, misalnya 400/415/422.
- Actual: HTTP 201, manuscript **ms-9e217e9d**, laporan COMPLETED; file dan record
  benar-benar tersimpan pada tenant QA.
- Rujukan source: router tidak memasang validasi tipe file; service
  `extractTextFromDocx` menangkap kegagalan Mammoth dan mengubah buffer menjadi
  teks UTF-8 tanpa membatasi fallback ke environment test.
- Lokasi: [router](../../source/src/modules/manuscripts/index.js#L7),
  [service](../../source/src/modules/manuscripts/services/manuscript.service.js#L9).

Kriteria perbaikan yang disarankan: validasi DOCX secara server-side, termasuk
paket ZIP/OOXML dan hasil parsing. Ekstensi/MIME saja dapat dipalsukan. Parsing
gagal harus menjadi respons input yang jelas; fallback raw text dibatasi pada
test atau dihilangkan dari jalur produksi. Tambahkan regression case untuk
teks yang diberi nama `.docx`, selain kasus `.txt` yang sudah diuji.

## F-02: error ukuran file dipetakan sebagai server error

- Input: 20 MiB + 1 byte, yaitu **20.971.521 byte**.
- Expected: client error yang sesuai, terutama HTTP 413 (atau kontrak 4xx yang
  disepakati).
- Actual: HTTP 500, message `File too large`.
- [Log diagnostik](../../evidence/platform/tahap-5/run-20261118t124752z-08162c/oversize-diagnostic.log)
  menunjukkan MulterError dengan code **LIMIT_FILE_SIZE**.
- File oversized tidak tersimpan dan tidak menambah record. Batas ukuran bekerja;
  temuan ini adalah pemetaan error HTTP.
- Lokasi: [error handler](../../source/src/common/middlewares/errorHandler.js#L11).

Kriteria perbaikan yang disarankan: petakan LIMIT_FILE_SIZE secara eksplisit ke
413. Pertahankan 5xx untuk kegagalan internal sebenarnya; jangan mengubah semua
exception menjadi 4xx.

## Regression dan traceability

Empat skenario DOCX utama sudah lulus dengan skor 100/50/85/100. Setelah aplikasi
diperbaiki, bangun dan publikasikan artifact baru, catat source/tag/digest serta
metadata build-nya, lalu gunakan referensi artifact itu untuk validasi berikutnya.
Runner saat ini memeriksa metadata artifact baseline Tahap 2; referensinya perlu
diselaraskan saat menguji release baru. Evidence dan tag lama tetap menjadi
rekaman versi yang diuji, bukan dilabeli ulang menjadi hasil perbaikan.

Uji ulang core DOCX, penolakan tipe/ukuran, pemetaan HTTP, dan konsistensi
API/database/file. Source aplikasi belum diubah oleh pengujian ini.
