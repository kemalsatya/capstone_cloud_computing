# Modul 09 — tabel kalkulasi turunan

Dihasilkan dari capture.json dan finops-assumptions.json; bukan pengukuran tambahan.

## Pemakaian terukur (rentang lima sampel)

| Kelompok | CPU min–max (m) | RAM min–max (MiB) |
|---|---:|---:|
| argocd | 18–108 | 173–175 |
| backend | 11–57 | 77–81 |
| capstone-smoke | 0–0 | 12–12 |
| keycloak | 4–593 | 568–570 |
| kube-system | 15–77 | 143–144 |
| worker-format | 5–12 | 29–30 |

## Skenario aplikasi (configured; backend + worker + Keycloak)

| Skenario | Backend | CPU request/limit (m) | RAM request/limit (MiB) |
|---|---:|---:|---:|
| baseline | 2 | 550 / 1750 | 896 / 1792 |
| hpa_max | 3 | 650 / 2000 | 1024 / 2048 |
| hpa_max_rolling_surge | 4 | 750 / 2250 | 1152 / 2304 |

## Reservasi node (semua namespace; bukan pemakaian)

| Node | Request CPU (m) | Request RAM (MiB) | Allocatable CPU (m) | Allocatable RAM (MiB) | Container tanpa request CPU/RAM |
|---|---:|---:|---:|---:|---:|
| k3d-capstone-agent-0 | 500 | 524 | 12000 | 7561.2 | 12 / 12 |
| k3d-capstone-server-0 | 250 | 512 | 12000 | 7561.2 | 2 / 2 |

## Unit-cost (assumed; USD)

| Selesai/bulan | Infrastruktur/cek | Infrastruktur/1.000 | LLM abstract/bulan | Total v2/bulan | Upload + backup (GiB) |
|---:|---:|---:|---:|---:|---:|
| 10000 | 0.014180 | 14.180 | 1.35 | 143.15 | 19.77 |
| 50000 | 0.002836 | 2.836 | 6.75 | 148.55 | 58.83 |
| 100000 | 0.001418 | 1.418 | 13.50 | 155.30 | 107.66 |
