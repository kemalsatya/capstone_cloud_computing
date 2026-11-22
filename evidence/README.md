# Ringkasan Bukti Capstone - Milestone Current Week

Dokumen ini mengintegrasikan seluruh artefak bukti operasional sistem JournalFit untuk evaluasi capaian milestone berjalan yang mencakup empat area prioritas utama.

---

## 1. Bukti 03: Application & Data

Ruang lingkup: Pembuktian alur kerja bisnis utama, pemrosesan berkas naskah jurnal, evaluasi aturan format, dan persistensi data multi-tenant pada basis data relasional.

Penanggung jawab: Anggota 1  
Basis data: PostgreSQL 17  
Berkas bukti: `application-data/03_evidence.jpg`

### Poin Verifikasi Transaksi
1. Permintaan unggah naskah format DOCX melalui endpoint HTTP POST `/api/manuscripts/upload` dengan menyertakan header tenant.
2. Pemrosesan ekstraksi teks dan kalkulasi skor kelayakan format terhadap aturan jumlah kata, ketersediaan abstrak, serta kata kunci.
3. Penyimpanan seluruh data transaksi pada enam tabel basis data terisolasi: `tenants`, `users`, `format_rule_templates`, `manuscripts`, `check_results`, dan `findings`.
4. Pengambilan laporan hasil evaluasi melalui endpoint HTTP GET `/api/manuscripts/:id/report` menghasilkan status 200 OK beserta skor format dan daftar temuan perbaikan.

---

## 2. Bukti 04: Platform & Kubernetes

Ruang lingkup: Orkestrasi kontainer, deklarasi manifes beban kerja, eksposur layanan melalui Ingress, probe kesehatan, dan pembatasan sumber daya komputasi.

Penanggung jawab: Anggota 2  
Platform: Kluster k3d atau k3s pada Docker lokal  
Berkas bukti: `platform/04_evidence.jpg`

### Poin Verifikasi Infrastruktur
1. Beban kerja berjalan stabil dengan dua replika pod backend aktif berstatus Ready.
2. Pengamanan runtime kontainer menggunakan pengguna non-root UID 10001 dan pelepasan seluruh kapabilitas sistem operasi yang tidak dibutuhkan.
3. Pembatasan kuota CPU 100 millicores request hingga 250 millicores limit serta memori 128 MiB request hingga 256 MiB limit pada tiap pod.
4. Mekanisme pemeriksaan kesehatan berkala:
   - Liveness probe melalui path `/health/live` untuk memeriksa status proses aplikasi.
   - Readiness probe melalui path `/health/ready` untuk menguji konektivitas ke basis data sebelum menerima beban kerja.
5. Penyimpanan berkas naskah terhubung ke Persistent Volume Claim lokal dengan mode ReadWriteOnce pada node penyimpanan berlabel khusus.
6. Akses eksternal dikelola oleh Traefik Ingress Controller menuju nama domain lokal.

---

## 3. Bukti 05: CI/CD & GitOps Delivery

Ruang lingkup: Otomasi pengujian kode sumber, penerbitan artefak kontainer berlabel hash commit pendek, rekonsiliasi deklaratif GitOps, dan pembuktian pemulihan rilis.

Penanggung jawab: Anggota 3  
Alat: GitHub Actions, Registry OCI lokal, Argo CD v3.5.6  
Berkas bukti: `delivery/05_evidence.jpg`

### Poin Verifikasi Pengiriman
1. Alur kerja GitHub Actions berjalan otomatis memvalidasi seluruh unit test logika evaluasi aturan dan isolasi tenant serta pemindaian keamanan Trivy dengan status sukses.
2. Pembangunan image kontainer menghasilkan tag commit SHA 7 karakter unik yang terdaftar pada registry lokal port 5001.
3. Dasbor Argo CD merekonsiliasi seluruh manifes beban kerja secara otomatis dengan status Synced dan Healthy tanpa intervensi perintah manual pada kluster.
4. Eksekusi skrip pemulihan rilis memvalidasi riwayat revisi dan kesiapan pod tetap stabil melayani permintaan saat terjadi simulasi rollback.

---

## 4. Bukti 07: Observability & SLO

Ruang lingkup: Telemetri metrik operasional beban kerja, dasbor pemantauan visual, serta penetapan indikator dan target keandalan layanan.

Penanggung jawab: Anggota 4  
Alat: Prometheus, Grafana  
Berkas bukti: `observability/07_evidence.jpg`

### Poin Verifikasi Operasional
1. Pengumpulan metrik telemetri oleh Prometheus mencakup utilisasi CPU, konsumsi memori, laju permintaan transaksi HTTP, dan latensi pemrosesan naskah.
2. Dasbor Grafana menyajikan grafik visual laju permintaan per detik, rasio respons sukses dan error, serta beban kerja pod.
3. Penerapan Service Level Objective dan Service Level Indicator:
   - Target Ketersediaan: Rasio respons HTTP sukses mencapai minimal 99.0% pada kondisi operasional normal.
   - Target Latensi: 95% permintaan evaluasi naskah selesai dalam durasi di bawah 2 detik untuk ukuran dokumen standar.

---

## 5. Ringkasan Interpretasi Kelompok

- Observasi: Seluruh komponen dari kode aplikasi, orkestrasi kontainer, pengiriman otomatis GitOps, hingga telemetri metrik telah terpasang dan beroperasi secara terintegrasi.
- Interpretasi: Sistem JournalFit memenuhi standar arsitekture cloud native terdistribusi yang dapat direproduksi, terlacak dari repositori Git, dan memiliki batasan kegagalan yang jelas.
- Batasan: Pengujian tahap ini berjalan pada lingkungan kluster k3d lokal laptop mahasiswa sebelum tahapan migrasi ke infrastruktur komputasi awan privat atau publik.
