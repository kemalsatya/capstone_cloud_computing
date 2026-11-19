# ADR-008: Isolated `pg_dump` Backup/Restore & Deterministic Rule Engine

- **Status:** Accepted
- **Tanggal:** 2026-11-17
- **Penanggung Jawab:** Anggota 4 (Ops) & Anggota 1 (Aplikasi)

## Context
Sistem harus mampu membuktikan perlindungan data (backup & actual restore verification) serta menjaga efisiensi biaya (FinOps) saat mengevaluasi format naskah ilmiah.

## Decision
1. **Data Protection:** Menggunakan skrip otomasi `automation/scripts/db-backup-restore.sh` berbasis `pg_dump --clean --if-exists` dan memvalidasi proses restore ke database terisolasi (`journalfit_restore_test`) agar tidak merusak database produksi yang sedang aktif, disertai pengukuran RTO riil.
2. **Evaluasi Naskah v1:** Menggunakan **Deterministic Rule Engine** berbasis Node.js (`mammoth` DOCX parser + aturan jumlah kata, abstrak, kata kunci) sebelum memanggil API LLM eksternal yang berbayar.

## Alternatives Considered
1. Mengandalkan snapshot volume Docker mentah tanpa verifikasi query SQL hasil restore.
2. Mengirim seluruh teks naskah ke external LLM API (OpenAI/Groq) pada setiap request pemeriksaan format dasar.

## Consequences / Trade-Offs
- **Positif:**
  - Proses restore teruji nyata dengan RTO terukur ~1,41 detik (jauh di bawah target SLO 5 menit) dengan jumlah baris tabel `manuscripts` identik.
  - Biaya operasional AI token pada v1 menjadi **$0 / pemeriksaan** dan latensi sangat cepat (< 50 ms p95) dibanding menunggu API LLM eksternal.
- **Negatif / Batasan:**
  - Pemeriksaan v1 terbatas pada aturan struktural/kuantitatif deterministik; analisis semantik berbasis AI/LLM dijadwalkan sebagai fitur v2 dengan abstrak saja yang dikirim untuk menekan token FinOps.
