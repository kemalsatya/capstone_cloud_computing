# Persiapan runtime untuk capture Modul 09

**Owner:** RafaelKyKy · **Tanggal:** 2026-11-23 · **Context:** `k3d-capstone`

**Baseline aplikasi:** `be509cd230f7ffa153adce01657923f1a32b582c` · **Jendela capture final:** 14:20:42–14:23:22 UTC.

Catatan ini menjelaskan penyesuaian sebelum pengukuran; output pengukuran final ada pada `live-metrics.txt` dan `capture.json`.

## Kondisi awal yang diperiksa

- Branch `feat/m2-paket-c-capacity-finops` sudah dibuat dan identik dengan `origin/main` setelah `git fetch origin` (main sudah mencakup PR #17).
- Semua container berhenti. Lingkungan yang memiliki data adalah paket dosen: `capstone-postgres` dan `capstone-registry`, di network `capstone-net`; bukan database baru `journalfit-postgres`.
- Cluster menyimpan dua backend lama image `stage2-20261117t055120z-d9ab35a`, belum memiliki Keycloak atau worker format. Database `journalfit` memiliki enam tabel publik; database `keycloak` belum ada.
- Tag `0c2cf92` dari Kustomize tidak ada di registry, dan tidak ditemukan sebagai objek Git pada repo setelah fetch.

## Tindakan dan hasil

1. `docker start capstone-postgres capstone-registry`; PostgreSQL accepting connections.
2. `k3d cluster start capstone`. Proses awal melaporkan kegagalan post-start `/etc/hosts` ketika agent masih restart. Setelah rekonsiliasi, kedua node Ready dan IP normal (server .5, agent .6); endpoint Service/Ingress, DNS DB dan Metrics API kemudian diverifikasi. Tidak dilakukan reset cluster atau penghapusan volume.
3. `docker compose -f docker-compose.yml --profile observability up -d prometheus grafana`. Compose menggunakan network `capstone-net` yang sudah ada; kedua service sehat. Monitoring memakai konfigurasi repo dan retensi Prometheus 3 hari.
4. Membuat database `keycloak` pada PostgreSQL yang sama. Secret password DB Keycloak berasal dari Secret backend yang sudah bekerja; password bootstrap admin dibuat acak di memori dan dimasukkan melalui stdin API Kubernetes. Nilai Secret tidak ditulis ke artefak evidence.
5. Membangun `localhost:5001/journalfit-backend:be509cd` dari `source/` main terbaru, dengan label `org.opencontainers.image.revision` berisi SHA penuh. Mengganti hanya override image tag di `deployment/kustomization.yaml`, lalu push ke registry lokal.
6. `kubectl --context k3d-capstone apply -k deployment`. Job migrasi/seed selesai: migrasi `001_add_keycloak_auth.sql` dan `002_prd_format_foundation.sql` berhasil; database menjadi enam tabel publik dan schema `pgboss` 13 tabel. API dua replika, worker satu replika dan Keycloak satu replika Ready; PVC lama tetap Bound.
7. Semua tujuh pod Argo CD pulih Ready setelah retry image pull yang sempat mengalami TLS timeout. `get applications -n argocd` menghasilkan kosong; **tidak diklaim GitOps sync** untuk deployment manual ini.
8. Setelah workload berjalan sekitar 17 menit, collector final mengambil lima sampel. Selain background probes/scrapes, ada satu login JWT preflight dan pembacaan `/api/auth/me`; tidak ada generator beban atau uji cold-start yang ditiming pada window ini.

## Identitas image dan verifikasi

- Registry index digest hasil push: `sha256:6d8955735c54e3cb9077d3f4c2901c3c03a7730bcfad33cb5ae99a53dee4a6a1`.
- Image ID lokal: `sha256:221b9b21ebd5a25ba7b9092803446baa75c4594c19ca9d59e62d930dc875a7f3`.
- Platform manifest digest: `sha256:f16c96120925db81d09ffb139666f03c0d789c363b9a09888220f882c3f536f2`; imageID pod ada pada snapshot. Index, platform manifest dan image config adalah objek OCI berbeda, sehingga digest tersebut tidak dipaksa sama.
- Image dasar build Node 22 Alpine: `sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a` menurut output build. Ini bukan klaim base image dipin dalam Dockerfile.
- Probe readiness API, discovery Keycloak, Prometheus dan Grafana HTTP 200; tanpa token 401; token demo diperoleh dan JWT sah diterima 200. Token/password tidak dicatat. Isolasi lintas-tenant dan scan image baru tidak diuji ulang oleh capture kapasitas ini.
- Resource requests/limits, minimum HPA, probes dan securityContext tetap menjadi baseline yang dianalisis. Backup/restore Paket B sebelumnya bukan validasi restore ulang untuk database yang telah menerima migrasi sesi ini.

Collector hanya merekam allowlist `name/image/status/ports` dari Docker, serta proyeksi resource/status pod/node; label internal k3d, lingkungan container dan Secret tidak dimasukkan. Source saat capture adalah commit dasar ditambah perubahan kerja yang hash-nya tercatat; evidence tidak mengklaim perubahan tersebut sudah di-commit atau dikirim ke remote.
