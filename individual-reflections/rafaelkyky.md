# Refleksi Individu — RafaelKyKy

**Tim/proyek:** Tim 7 / JournalFit

**Paket:** C — Modul 09, Capacity Planning, FinOps & Roadmap

**Tanggal:** 2026-11-23

**Branch:** `feat/m2-paket-c-capacity-finops`

**Status:** draft berdasarkan aktivitas dan evidence aktual; Owner perlu meninjau rumusan pembelajaran sebelum pengumpulan. Penyusunan dibantu AI.

## 1. Kontribusi dan bukti

- Menetapkan baseline Paket C pada main `be509cd`; menyelaraskan runtime lama dengan image source tersebut setelah tag manifest sebelumnya tidak tersedia di registry.
- Memulihkan dependensi dan cluster yang berhenti; menyiapkan Keycloak dan worker format, menjalankan Job migrasi/seed, serta memeriksa readiness, PVC, HPA dan telemetry.
- Menyusun collector dengan context eksplisit, metadata versi dan allowlist field; mencatat lima sampel CPU/RAM asli pada **21:20:42–21:23:22 WIB**, tanpa menyimpan token/Secret.
- Membuat worksheet yang memasukkan Keycloak, worker, platform dan rollout surge; menghitung ulang berdasarkan snapshot machine-readable.
- Menyusun model biaya dengan harga referensi resmi, asumsi volume/token/retensi, serta membedakan API AI USD 0 dari biaya infrastruktur.
- Memperbarui risiko/roadmap, evidence tiga panel dan draft Bab 10–12 laporan akhir.

Artefak utama: `evidence/capacity-finops/{live-metrics.txt,capture.json,analysis.json,README.md,09_evidence.jpg,report-chapters-10-12.md}`. Perubahan collector dan konfigurasi image dapat ditelusuri melalui diff branch; belum ada klaim commit/push atau kontribusi pada paket anggota lain.

## 2. Pembelajaran teknis yang didukung pekerjaan

- Request, limit dan utilisasi memiliki fungsi berbeda. RAM Keycloak 568–570Mi berada di atas request 512Mi, sehingga reservasi dapat terlalu kecil walaupun limit 1Gi belum tercapai pada sampel.
- Dua node k3d berbagi VM yang sama. Menjumlahkan kapasitas keduanya, atau menambahkan pemakaian pod di atas container node, akan menghasilkan kapasitas/footprint yang keliru.
- MemAvailable VM 54,05–56,48% lebih berguna untuk headroom host daripada angka unreserved scheduler, terutama ketika 14 container tidak memiliki request.
- Unit-cost memerlukan definisi pembagi yang benar: pemeriksaan format selesai, bukan seluruh HTTP request atau scope yang masih queued. Harga resmi pun tetap memerlukan asumsi layout/volume dan batas cakupan biaya.
- Status pg-boss telah berubah menjadi implementasi worker format; roadmap harus mengikuti kode/runtime aktual. Controller Argo yang hidup juga belum membuktikan GitOps jika Application belum ada.

## 3. Satu keputusan/trade-off desain

Keputusan yang dipertahankan adalah **tidak menurunkan request backend/worker atau jumlah replika hanya dari hasil idle**. Backend dua pod memakai 77–81Mi gabungan dan worker 29–30Mi, tetapi belum ada profil beban DOCX puncak pada run ini. Penghematan agresif dapat mengurangi ruang parsing, rollout dan kemampuan memenuhi service objective. Sebaliknya, Keycloak menjadi kandidat kenaikan request RAM ke 768Mi untuk divalidasi; angka rekomendasi tidak dinyatakan sudah diterapkan.

Model cloud memakai VM PostgreSQL self-managed dengan biaya yang transparan, alih-alih memberi label managed DB pada estimasi VM. Pilot tersebut lebih mudah dipetakan ke CloudStack, tetapi biaya operasional dan risiko DB/control-plane/Keycloak tunggal tetap harus dijelaskan.

## 4. Rencana perbaikan

Langkah berikutnya adalah profiling DOCX/login/queue dengan SLO dan metering completed jobs, resource budgets platform, migrasi storage sebelum sebaran lintas node, serta restore ulang sesudah migrasi schema. Setelah baseline stabil, scope worker abstract-only dan caching dievaluasi dari kualitas serta token aktual. Harga/volume proyeksi diganti dengan penggunaan dan biaya yang benar-benar teramati ketika lingkungan cloud tersedia.

## 5. Log kontribusi ringkas

| Waktu / tahap | Aktivitas terverifikasi | Bukti |
|---|---|---|
| 2026-11-23, sebelum capture | Pemeriksaan branch, dependensi, build/push dan penyelarasan runtime | `runtime-preparation.md`, konfigurasi tag image, snapshot resources/image |
| 2026-11-23 21:20:42–21:23:22 WIB | Capture final lima sampel dan probe runtime | `live-metrics.txt`, `capture.json` |
| 2026-11-23, setelah capture | Kalkulasi offline, model biaya, risiko dan materi laporan | `analysis.json`, `calculation-tables.md`, `finops-assumptions.json`, README dan draft laporan |
