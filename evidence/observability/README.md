# Evidence 07: Observability & SLO

Ruang lingkup: Bukti pemantauan operasional beban kerja, telemetri kesehatan pod dan basis data, dasbor metrik visual, serta penetapan indikator dan target tingkat layanan.

Penanggung jawab: Anggota 4  
Alat: Prometheus, Grafana  
Sumber: repositori JournalFit cabang milestone-per-week  

---

## 1. Ringkasan Bukti Telemetri dan Dasbor

Bukti gambar pada folder ini menyajikan metrik operasional dan evaluasi target layanan:

1. Endpoint metrik Prometheus mengumpulkan data berkala dari pod backend dan infrastruktur pendukung:
   - Penggunaan CPU dan alokasi memori per pod kontainer.
   - Tingkat keberhasilan transaksi HTTP dan distribusi latensi pemrosesan naskah.
   - Status konektivitas dan pool koneksi basis data PostgreSQL.
2. Dasbor Grafana menyajikan visualisasi operasional terpadu:
   - Grafik tingkat lalu lintas request per detik.
   - Grafik rasio error respons 5xx dan 4xx.
   - Utilisasi CPU pod relatif terhadap batas permintaan 100 millicores.
3. Penetapan Service Level Objective dan Service Level Indicator:
   - SLI Ketersediaan: Rasio respons HTTP sukses per total request.
   - Target SLO Ketersediaan: Minimal 99.0% ketersediaan layanan pada kondisi operasional normal.
   - SLI Latensi: Durasi respons evaluasi aturan naskah pada persentil ke-95.
   - Target SLO Latensi: 95% request selesai di bawah 2 detik untuk dokumen standar.

---

## 2. Catatan Standar Bukti

- Pengamatan: Prometheus berhasil mencatat data metrik beban kerja secara stabil dan dasbor Grafana merefleksikan fluktuasi beban saat transaksi berlangsung.
- Interpretasi: Layanan terpantau transparan sehingga potensi degradasi performa atau kehabisan kuota memori dapat dideteksi sebelum menimbulkan insiden total.
- Batasan: Pengikisan metrik diuji pada lingkungan lokal dengan periode retensi data metrik singkat 3 hari untuk efisiensi penyimpanan laptop.
- Keputusan yang didukung: Menggunakan target utilisasi CPU 70% sebagai pemicu penskalaan horizontal otomatis agar pod tambahan aktif sebelum latensi melampaui batas SLO.
