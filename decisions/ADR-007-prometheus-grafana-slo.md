# ADR-007: Pull-Based Observability (`GET /metrics`, Prometheus, Grafana) & SLO

- **Status:** Accepted
- **Tanggal:** 2026-11-17
- **Penanggung Jawab:** Anggota 4 (Security, Ops & Recovery)

## Context
Tim membutuhkan visibilitas terhadap ketersediaan layanan, error 5xx, dan latensi p95 tanpa menambah agen *monitoring* berat di dalam container aplikasi.

## Decision
Mengimplementasikan middleware ringan (`source/src/common/utils/metrics.js`) yang memaparkan endpoint standar OpenMetrics/Prometheus **`GET /metrics`** (menghitung `http_requests_total`, histogram `http_request_duration_seconds_bucket`, serta metrik runtime `process_*`), di-scrape oleh **Prometheus** setiap 15 detik dan divisualisasikan pada **Grafana** ter-provision (`journalfit-slo-dashboard.json`).

## Alternatives Considered
1. Agen APM komersial (Datadog / New Relic).
2. Logging ke stdout saja tanpa agregasi metrik time-series.

## Consequences / Trade-Offs
- **Positif:**
  - Zero vendor lock-in, konfigurasi dasbor bersifat *as-code* (auto-provisioned JSON), serta mampu membuktikan pencapaian SLO (Availability >= 99%, Latensi p95 < 500ms, Error 5xx = 0).
- **Negatif / Batasan:**
  - Ukuran bucket terkecil pada histogram diset 50 ms sehingga nilai sub-50ms dilaporkan sebagai `< 50 ms`. Belum menyertakan *distributed tracing* (OpenTelemetry) antar-komponen.
