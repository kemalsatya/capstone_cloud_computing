# ADR-001: Arsitektur Modular Monolith (Node.js / Express) vs Microservices

- **Status:** Accepted
- **Tanggal:** 2026-11-09
- **Penanggung Jawab:** Anggota 1 (Application & Data)

## Context
Sistem **JournalFit** menangani manajemen pengguna/tenant, unggah naskah `.docx`, ekstraksi teks (`mammoth`), evaluasi aturan format, dan pelaporan temuan. Tim beranggotakan 4 mahasiswa dengan target pengembangan cepat yang harus berjalan mulus di kluster lokal (`k3d`) dengan batas memori laptop 7.4 GiB.

## Decision
Menggunakan arsitektur **Modular Monolith** menggunakan Node.js 22 (`Express 5.3.0`) yang dipisahkan secara logis di dalam `source/src/modules/` (`auth`, `manuscripts`, `health`).

## Alternatives Considered
1. **Microservices Penuh** (memisah Auth Service, Parser Service, Rule Engine Service, Notification Service sebagai container terpisah).
2. **Serverless Functions** untuk tiap endpoint API.

## Consequences / Trade-Offs
- **Positif:**
  - Konsumsi memori sangat rendah (request `128Mi`, limit `256Mi` per pod), memungkinkan kluster menjalankan 2 replika + PostgreSQL + Prometheus + Grafana + Argo CD sekaligus di laptop.
  - Tidak ada latensi jaringan antar-service (*inter-service RPC overhead*) dan transaksi database tetap bersifat ACID dalam satu koneksi `pg`.
  - Mempermudah pipeline CI/CD (satu Dockerfile, satu `npm test`, satu image artifact).
- **Negatif / Batasan:**
  - Penskalaan horizontal (HPA) menskalakan seluruh modul aplikasi sekaligus, tidak bisa menskalakan modul parser `.docx` secara independen tanpa memisah worker di versi berikutnya (`v2`).
