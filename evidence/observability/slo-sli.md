# SLI/SLO JournalFit

| SLI | SLO (target) | Hasil terukur | Sumber |
|---|---|---|---|
| Ketersediaan app | >= 99% | 100% (jendela 15 menit) | Prometheus `up` |
| Latensi p95 | < 500 ms | < 50 ms | Histogram `http_request_duration_seconds` |
| Error server (5xx) | 0 | 0 | Counter status 5xx |
| Waktu restore DB | < 5 menit | 1,41 detik | Skrip `restore-postgres-validation.sh` |

## Catatan
- Traffic uji: sekitar 3 request/detik dari satu klien (loop curl), bukan beban produksi.
- Nilai p95 mendekati 48 ms adalah artefak bucket histogram terkecil (50 ms), jadi dilaporkan sebagai "< 50 ms".
- Prometheus lab men-scrape app yang berjalan di host (`host.docker.internal:8088/metrics`), bukan pod di k3d.
- Target SLO adalah usulan tim, bukan ketentuan dosen.
- Ketersediaan sempat 0 di awal karena path scrape belum diperbaiki dan karena laptop sempat tertutup, bukan karena kegagalan layanan.