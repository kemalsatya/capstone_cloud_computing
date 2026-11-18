# Evidence 03: Application & Data

Ruang lingkup: Bukti alur kerja bisnis utama, pemrosesan berkas naskah jurnal, evaluasi aturan format, dan persistensi data multi-tenant pada basis data relasional.

Penanggung jawab: Anggota 1  
Basis data: PostgreSQL 17  
Sumber: repositori JournalFit cabang milestone-per-week  

---

## 1. Ringkasan Bukti Transaksi

Bukti gambar pada folder ini membuktikan transaksi end-to-end melalui endpoint API:

1. Transaksi unggah berkas DOCX via HTTP POST `/api/manuscripts/upload` dengan header tenant.
2. Ekstraksi teks naskah dan evaluasi otomatis terhadap templat aturan format:
   - Penghitungan jumlah kata naskah.
   - Pemeriksaan keberadaan bagian abstrak.
   - Pemeriksaan keberadaan kata kunci.
3. Penyimpanan metadata naskah pada tabel `manuscripts`, hasil skor pada tabel `check_results`, dan detail temuan pada tabel `findings`.
4. Pengambilan laporan hasil evaluasi melalui HTTP GET `/api/manuscripts/:id/report` menghasilkan status kode 200 OK beserta skor format dan rincian saran perbaikan.

---

## 2. Struktur Data Persisten

Skema basis data terdiri dari 6 entitas relasional terisolasi tenant:
- `tenants`: data identitas organisasi jurnal.
- `users`: data akun pengguna dan peran.
- `format_rule_templates`: konfigurasi batas kata dan syarat naskah per tenant.
- `manuscripts`: rekam jejak berkas dan pemilik naskah.
- `check_results`: ringkasan status pemeriksaan dan skor kelayakan.
- `findings`: rincian pelanggaran format dan tingkat keparahan.

---

## 3. Catatan Standar Bukti

- Pengamatan: Berkas naskah berhasil diproses, skor dihitung deterministik, dan seluruh entitas tersimpan di PostgreSQL.
- Interpretasi: Sistem memenuhi fungsi perangkat lunak berbasis cloud dengan data persisten dan isolasi data tingkat aplikasi.
- Batasan: Pengujian tahap ini menggunakan berkas uji format DOCX standar pada lingkungan penyimpanan lokal kontainer sebelum migrasi ke penyimpanan objek cloud.
- Keputusan yang didukung: Menetapkan model modular monolith dengan pemisahan tabel relasional per tenant tanpa memerlukan skema terpisah untuk skala awal.
