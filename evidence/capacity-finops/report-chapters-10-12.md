# Draft Laporan Akhir — Bab 10–12

**Proyek:** JournalFit, Tim 7 · **Kontributor:** RafaelKyKy / Paket C

**Status:** draft untuk diintegrasikan ke `final-report.pdf` tim.

**Versi:** source `be509cd230f7ffa153adce01657923f1a32b582c`, tag runtime `be509cd`, konfigurasi lokal sesuai hash pada [capture](capture.json).

**Evidence utama:** [README sembilan field](README.md), [log asli](live-metrics.txt), [tabel kalkulasi](calculation-tables.md), [gambar](09_evidence.jpg).

## 10. Capacity & FinOps

### 10.1 Metode dan cakupan

Analisis dilakukan pada 23 November 2026, 21:20:42–21:23:22 WIB, di `k3d-capstone`. Lima sampel berurutan diambil menggunakan `kubectl top nodes`, `kubectl top pods` (namespace default dan seluruh namespace), `kubectl describe hpa journalfit-backend`, serta `docker stats --no-stream`. Jeda antar-sampel adalah 30 detik setelah command sampel selesai. Informasi `/proc/meminfo` dan delta `/proc/stat` melengkapi tampilan utilisasi seluruh Linux VM.

Runtime terdiri dari dua pod backend, satu worker format `pg-boss`, satu Keycloak, PostgreSQL Docker, registry, Prometheus/Grafana, Argo CD dan komponen sistem Kubernetes. Job migrasi/seed telah selesai dan PVC tetap Bound. Readiness, discovery Keycloak dan telemetry sehat; JWT valid diterima 200 dan akses tanpa token ditolak 401. Nilai token/Secret tidak disimpan dalam evidence. Beban adalah idle/background probes, polling dan scrapes, ditambah satu login JWT preflight; tidak ada load generator.

Data dibedakan sebagai **configured** (manifest), **measured** (pengukuran), dan **assumed/projected** (perkiraan cloud, volume dan token). Semua command capture berhasil. Calculator offline menghasilkan `analysis.json` dan `calculation-tables.md`, sehingga aritmetika dapat direproduksi.

### 10.2 Resource baseline dan skenario pertumbuhan

Backend memiliki request 100m CPU/128Mi RAM serta limit 250m/256Mi per pod. Worker format memakai alokasi yang sama. Keycloak memiliki request 250m/512Mi dan limit 1000m/1Gi. HPA backend mempertahankan minimum dua, maksimum tiga replika, dengan target CPU 70% dari request. Rolling update memakai `maxSurge: 1`.

| Skenario configured, termasuk worker dan Keycloak | CPU request / limit | RAM request / limit |
|---|---:|---:|
| 2 backend baseline | 550m / 1750m | 896Mi / 1792Mi |
| 3 backend HPA maksimum | 650m / 2000m | 1024Mi / 2048Mi |
| 4 backend sementara saat surge | 750m / 2250m | 1152Mi / 2304Mi |

Database dan komponen platform adalah tambahan di luar tabel aplikasi tersebut. Sebagian tidak memiliki request/limit, sehingga batas aplikasi tidak boleh dipakai sebagai klaim finite peak seluruh host. Jika migrasi dan seed berjalan bersamaan dengan rollout, Job juga memerlukan budget efektif request 50m/64Mi, limit 200m/192Mi; fase init dan seed bersifat berurutan.

### 10.3 Hasil pengukuran dan headroom

| Kelompok | CPU terukur min–max | RAM terukur min–max |
|---|---:|---:|
| Backend, dua pod gabungan | 11–57m | 77–81Mi |
| Worker format | 5–12m | 29–30Mi |
| Keycloak | 4–593m | 568–570Mi |
| Argo CD | 18–108m | 173–175Mi |
| kube-system | 15–77m | 143–144Mi |

PostgreSQL memakai 88,97–89,56MiB, Prometheus 31,84–32,57MiB, Grafana 56,50–56,54MiB, dan registry 24,37–24,51MiB. Smoke workload lama 12Mi juga termasuk inventaris. Nilai ini berasal dari window pendek dan tidak menggambarkan batas penggunaan komponen tersebut.

Docker memiliki 12 CPU dan sekitar 7,384GiB RAM. Kedua node k3d melihat resource VM yang sama; kapasitasnya tidak dijumlahkan sebagai 24 CPU atau 14,77GiB fisik. Headroom RAM VM dihitung menggunakan `MemAvailable / MemTotal` dan berada pada **54,05–56,48%**, atau 4087,06–4270,79MiB tersedia. Penggunaan ekuivalen `MemTotal - MemAvailable` berada pada 3290,42–3474,14MiB. CPU Linux VM busy 16,24–21,37% pada empat interval, sementara tampilan container Docker yang dinormalisasi ke 12 CPU hanya 2,07–2,58%; cakupan dan window kedua metrik berbeda.

Headroom scheduler dihitung terpisah. Request pada agent adalah 500m/524Mi, dan pada server 250m/512Mi. Pada skenario backend HPA maksimum dengan surge, agent menjadi 700m/780Mi karena tambahan dua backend tetap storage-pinned. Namun 14 container K8s tidak memiliki request CPU/RAM, sehingga unreserved scheduler bukan jaminan memori bebas. Penggunaan pod tidak ditambahkan lagi ke penggunaan container node k3d yang sudah mencakupnya.

### 10.4 Evaluasi sizing dan optimasi

Keycloak adalah komponen aplikasi dengan RAM terbesar. Working set 568–570Mi melebihi request 512Mi sekitar 10,94–11,33%, walau maksimum sampel masih sekitar 55,7% dari limit 1Gi. Kandidat perbaikan adalah request 768Mi, untuk diuji pada login burst/cold start/GC sebelum diterapkan. Referensi 596Mi dan cold start 72 detik pada dokumentasi platform adalah pengukuran historis, bukan uji cold start baru dalam bab ini.

Backend dan worker menunjukkan spare reservation pada idle. Request RAM dua backend 256Mi dibanding pemakaian 77–81Mi dan worker 128Mi dibanding 29–30Mi menjadikannya kandidat rightsizing. Namun pengurangan resource belum dibenarkan untuk beban parsing dokumen puncak. Minimum dua replika, resource baseline, probes dan HPA tetap dipertahankan. CPU HPA 6–17% dari request berada di bawah target 70%; ini tidak membuktikan HPA scale-out baru atau throughput maksimum.

Optimasi yang mempertahankan kontrol meliputi image Node 22 Alpine dengan dependency production, rule engine deterministik, retensi Prometheus lab tiga hari, serta evaluasi request berdasarkan profil representatif. Non-root, verifikasi JWT/JWKS, tenant isolation, Secret separation dan backup/restore tidak dikurangi demi biaya.

### 10.5 Pemetaan IaaS/CloudStack dan model biaya

Target pilot memetakan satu VM control plane/Argo (2 vCPU, 4Gi RAM), dua worker VM (masing-masing 2 vCPU, 4Gi RAM), dan satu VM PostgreSQL privat/self-managed (2 vCPU, 4Gi RAM). Setiap VM memiliki 80Gi SSD dalam harga referensi. Pada CloudStack, kapasitas tersebut menjadi compute/disk/network offerings dengan tarif operator sendiri. Harga pembanding berasal dari DigitalOcean Basic Regular dan diakses 23 November 2026.

| Komponen assumed | USD/bulan |
|---|---:|
| 4 VM × USD 24 | 96,00 |
| Regional LB | 12,00 |
| Object storage, 250Gi termasuk | 5,00 |
| Backup VM harian, 30% compute | 28,80 |
| **Total** | **141,80** |

Layout ini belum HA penuh karena control plane, database dan Keycloak tetap tunggal. Distribusi backend/worker lintas node mensyaratkan migrasi penyimpanan lokal ke S3-compatible service serta kebijakan penempatan yang sesuai. Membeli dua VM saja tidak mengatasi SPOF PVC. Pada surge, contoh pembagian budget adalah worker A menampung dua backend dan worker format (limit 750m/768Mi), sedangkan worker B menampung dua backend dan Keycloak (1500m/1536Mi); overhead OS/platform dan SLO tetap harus diuji pada VM sungguhan.

Harga di atas bukan tagihan, bukan managed PostgreSQL, dan belum memasukkan pajak, kurs, labor, domain, overage, full HA, serta alokasi platform fisik/system VMs CloudStack. Snapshot VM harian juga bukan bukti konsistensi backup database; logical dumps dan restore verification tetap diperlukan.

### 10.6 Unit-cost dan proyeksi AI

Pemeriksaan format yang aktif menggunakan parser OOXML (`jszip`/`fast-xml-parser`), deterministic rules dan worker `pg-boss`. Biaya API AI eksternalnya USD 0, sementara infrastruktur tetap memiliki biaya.

`unit-cost = biaya operasional bulanan / jumlah pemeriksaan format selesai per bulan`.

| Volume assumed | Infrastruktur/cek | Infrastruktur/1.000 cek |
|---:|---:|---:|
| 10.000 | USD 0,014180 | USD 14,180 |
| 50.000 | USD 0,002836 | USD 2,836 |
| 100.000 | USD 0,001418 | USD 1,418 |

Volume tersebut adalah skenario FinOps, bukan hasil benchmark. Pada rata-rata assumed 1MiB/upload dan retensi 30 hari, 50.000 upload memerlukan 48,83GiB; ditambah 10GiB logical-backup budget menjadi 58,83GiB. Bucket referensi 250Gi dapat menampung asumsi tersebut, tetapi lifecycle dan adapter belum diimplementasikan. Jika rata-rata, retensi atau transfer meningkat, unit-cost wajib dihitung ulang.

Proyeksi v2 memakai harga referensi Groq `openai/gpt-oss-20b`, USD 0,075 input dan USD 0,30 output per satu juta token. Mengasumsikan 600 input/300 output token untuk judul+abstrak menghasilkan USD 0,000135/panggilan atau USD 6,75 untuk 50.000 panggilan. Full text 8000/1000 token pada model sama menghasilkan USD 0,000900 atau USD 45/bulan. Pengurangan token cost adalah 85% pada asumsi tersebut. Total cloud+abstract LLM menjadi USD 148,55/bulan atau USD 0,002971/cek pada 50.000 selesai/bulan.

Jumlah token, termasuk reasoning, kualitas scope-check, retry, cache hit dan fraksi pemanggilan belum diukur. Tidak ada panggilan LLM berbayar atau worker scope pada runtime evidence ini. Caching lintas unggahan dan rule-template suggester adalah rencana lanjutan, berbeda dari idempotensi job format yang telah diimplementasikan.

## 11. Limitations & Residual Risk

1. **Cakupan pengukuran:** lima sampel idle dalam satu jendela pendek. Tidak menguji peak DOCX, concurrent upload, sustained login burst, CPU throttling, kapasitas 50.000 transaksi, atau SLA produksi. Perbedaan rounding/window antar-tool harus dipertahankan dalam interpretasi.
2. **Failure boundary:** backend dan worker berbagi PVC `local-path` RWO pada satu node. Dua replika backend tidak membuktikan node/AZ HA. Request PVC 1Gi bukan quota disk, dan filesystem virtual bukan bukti disk fisik Windows tersedia.
3. **IAM:** Keycloak OIDC/JWKS sudah aktif, tetapi direct access grant/akun demo dan single-replica Recreate masih menjadi keterbatasan. Pengujian kapasitas tidak menggantikan matriks isolasi tenant/role Paket A.
4. **Data protection:** DB bergantung pada host Docker dan backup manual. Bukti restore Paket B dibuat sebelum migrasi 002 pada lab ini; schema/data terkini perlu recovery drill baru.
5. **Resource budgets:** Keycloak under-reserved pada RAM; 14 container K8s tanpa requests dan Docker pendukung tanpa caps membuat reservasi scheduler kurang mewakili demand sebenarnya.
6. **Artifact/delivery:** registry HTTP tanpa auth/TLS hanya sesuai lab. Image pengukuran `be509cd` dibangun manual. Argo CD Ready tetapi tidak ada Application; tidak ada klaim GitOps Healthy/Synced atau scan keamanan image baru dari capture ini.
7. **Fitur:** worker format `pg-boss` tersedia; storage masih lokal. Scope yang queued tidak berarti AI selesai. Garage/S3 adapter, Groq scope worker, cache lintas submission dan suggester belum terbukti.
8. **Biaya:** seluruh sizing, volume dan token cloud adalah proyeksi. Tidak ada tagihan provider, pengukuran energi/depresiasi laptop, validasi biaya CloudStack internal atau quality assessment model AI.

## 12. Improvement Roadmap

| Prioritas | Langkah | Kriteria penerimaan |
|---|---|---|
| P1 / resource | Profil beban DOCX, login dan queue; validasi request RAM Keycloak 768Mi serta budgets pod/Docker lainnya. | Data p95/peak dan service objective; tidak ada OOM/throttling yang melanggar target; headroom termasuk surge. |
| P1 / release & IAM | Registry TLS/auth, image scan dengan digest yang sama, sinkronkan artifact/source ke Argo Application; ganti direct grant dengan PKCE pada target produksi. | Pull cloud terautentikasi, source/digest traceability, Healthy/Synced/drift/HPA ownership serta uji negatif auth. |
| P1 / storage | Implementasikan adapter Garage/S3, lifecycle dan restore; hilangkan storage node pinning setelah migrasi tervalidasi. | File dan hasil tetap tersedia lintas node; isolasi tenant, checksum dan restore objek teruji. |
| P1 / database | DB privat, backup journalfit+keycloak terjadwal/off-site/encrypted dan isolated restore versi baru. | Integritas data/schema terbukti serta RTO/RPO aktual dicatat. |
| P2 / AI | Scope worker dengan abstract-only boundary, timeout/retry/DLQ, quality evaluation, budget dan per-tenant metering. | Status scope terminal yang benar, kualitas memenuhi target, token/biaya serta kegagalan dapat dijelaskan. |
| P2 / FinOps | Ukur volume nyata dan storage growth; uji cache/dedup dan rightsizing setelah SLO stabil. | Unit-cost memakai completed checks aktual; penghematan tidak mengurangi kontrol security/recovery. |

### Referensi sumber

- Guideline final capstone §7, §9, §10 M8, §13, §14, §15.1 dan §17.
- Harga resmi 2026-11-23: [Droplets/backup](https://www.digitalocean.com/pricing/droplets), [LB](https://www.digitalocean.com/pricing/load-balancers), [Spaces](https://www.digitalocean.com/pricing/spaces-object-storage), [Groq models](https://console.groq.com/docs/models).
- [CloudStack service offerings](https://docs.cloudstack.apache.org/en/latest/adminguide/service_offerings.html).
- Evidence dan semua asumsi rinci tercantum pada [README Modul 09](README.md) dan [finops-assumptions.json](finops-assumptions.json).
