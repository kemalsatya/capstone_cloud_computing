# 09 — Capacity Planning, FinOps & Roadmap

**Owner:** RafaelKyKy · **Tim:** 7 / JournalFit · **Rubrik:** Capacity & FinOps 5%

**Checkpoint tim:** Progress Milestone 2 · **Pemetaan guideline:** M8, §7, §9, §13, §14, §15.1

**Status:** lima sampel live berhasil direkam; analisis cloud/volume merupakan proyeksi, bukan deployment cloud atau hasil stress test.

## 1. Evidence Standard — sembilan field (§9)

| Field | Isi |
|---|---|
| **Scope** | CPU/RAM seluruh stack lab, requests/limits backend + worker format + Keycloak, kapasitas host/node, HPA/rollout headroom, mapping IaaS/CloudStack, unit-cost pemeriksaan format, residual risks dan roadmap. |
| **Owner** | RafaelKyKy, pemegang Paket C; persiapan, collector, analisis dan dokumentasi dikerjakan dengan bantuan AI. |
| **Source / Version** | Branch `feat/m2-paket-c-capacity-finops`, base/source aplikasi `be509cd230f7ffa153adce01657923f1a32b582c` (main sesudah PR #17). Manifest lokal memakai tag `be509cd`; perubahan belum menjadi commit baru saat capture. Hash berkas konfigurasi/collector ada di `capture.json`. Kubernetes `v1.35.5+k3s1`, Keycloak `26.8.2`, PostgreSQL `17-alpine`, Prometheus `v3.1.0`, Grafana `11.4.0`. |
| **Timestamp** | Capture **2026-11-23 14:20:42–14:23:22 UTC**, yaitu **21:20:42–21:23:22 WIB**. Lima sampel mulai 14:21:01, 14:21:36, 14:22:10, 14:22:44, 14:23:18 UTC. Harga referensi diakses 2026-11-23. |
| **Method** | `capture-evidence-06-08-09-10.sh 09` menjalankan collector Python dengan context eksplisit `k3d-capstone`; lima sampel, jeda 30 detik setelah masing-masing sampel. `kubectl top` nodes/pods, `describe hpa`, `docker stats`, `/proc/meminfo` dan delta `/proc/stat`; inventaris resources/image/status serta HTTP/JWT probes. `analyze-capacity-finops.py` menghasilkan kalkulasi offline dari capture dan asumsi eksplisit. |
| **Observation** | Backend 2/2, worker 1/1, Keycloak 1/1 Ready; PVC Bound. RAM Keycloak **568–570 MiB**, backend gabungan **77–81 MiB**, worker **29–30 MiB**. HPA CPU **6–17% / target 70%**, tetap 2 replika. MemAvailable VM **4.087,06–4.270,79 MiB** (**54,05–56,48%**). Semua command collector exit 0; readiness/JWT valid 200, tanpa token 401. |
| **Interpretation** | Request RAM Keycloak 512Mi berada di bawah working set terukur; backend/worker memiliki spare reservation pada idle. Headroom host dan ruang penjadwalan node dibedakan; node k3d berbagi satu VM. Model pilot cloud menghasilkan estimasi **USD 141,80/bulan**, atau **USD 0,002836/cek** pada asumsi 50.000 pemeriksaan selesai/bulan. |
| **Limitation** | Jendela pendek dan tanpa load generator; satu login JWT preflight dapat memicu kerja JIT/background Keycloak. Tidak mengukur throughput, peak DOCX, scale-out, cold start baru, throttling, SLO produksi atau tagihan. Harga, volume, token dan layout cloud adalah asumsi. Controller Argo hidup tetapi **tidak ada Application** pada lab ini; runtime diselaraskan manual. Scope/AI dan object storage belum diimplementasikan. |
| **Decision Supported** | Mempertahankan minimum 2 backend, batas HPA 3, non-root/JWT/probes; mengusulkan request RAM Keycloak 768Mi untuk divalidasi; memprioritaskan migrasi storage, resource budgets dan recovery; memakai rule engine deterministik tanpa biaya API AI. Mendukung ADR-001, ADR-003, ADR-005, ADR-007, ADR-008 dan ADR-009, dengan batas implementasi yang tercatat. |

## 2. Artefak dan reproduksi

| Berkas | Fungsi |
|---|---|
| [live-metrics.txt](live-metrics.txt) | Output command asli, timestamp, exit code dan hasil probe; JSON inventaris diproyeksikan ke field resource/image/status. |
| [capture.json](capture.json) | Snapshot machine-readable yang sama, termasuk metadata, image digest dan hash konfigurasi. |
| [analysis.json](analysis.json) / [calculation-tables.md](calculation-tables.md) | Rentang pengukuran, aritmetika resources/node, dan unit-cost yang dihitung ulang otomatis. |
| [finops-assumptions.json](finops-assumptions.json) | Harga referensi, URL sumber, volume, token, retensi dan biaya yang tidak dimasukkan. |
| [runtime-preparation.md](runtime-preparation.md) | Penyesuaian lab lama menjadi runtime pasca-Keycloak/worker sebelum capture. |
| [09_evidence.jpg](09_evidence.jpg) | Ringkasan tiga panel yang dihasilkan dari data, bukan tangkapan layar terminal buatan. |
| [report-chapters-10-12.md](report-chapters-10-12.md) | Draft kontribusi laporan akhir Bab 10–12. |
| [../../individual-reflections/rafaelkyky.md](../../individual-reflections/rafaelkyky.md) | Draft refleksi dan log kontribusi untuk ditinjau Owner. |

Dari root repo, Git Bash:

```bash
# Folder baru menjaga capture yang sudah diserahkan tetap utuh.
EVIDENCE_OWNER=RafaelKyKy CAPACITY_OUTPUT_DIR=evidence/capacity-finops/run-baru \
  bash automation/scripts/capture-evidence-06-08-09-10.sh 09

# Hitung ulang dan periksa artefak capture terlampir secara offline.
python automation/scripts/analyze-capacity-finops.py --check
python automation/scripts/render-capacity-finops.py
bash -n automation/scripts/capture-evidence-06-08-09-10.sh
git diff --check
```

Python 3.10+ diperlukan untuk capture/analisis; Pillow untuk gambar. PowerShell dapat menjalankan collector langsung dengan `python automation/scripts/capture-capacity-finops.py --owner RafaelKyKy --output-dir evidence/capacity-finops/run-baru`. Untuk run baru gunakan `analyze-capacity-finops.py --directory evidence/capacity-finops/run-baru`; harga default tetap berasal dari `finops-assumptions.json` utama, atau tentukan `--assumptions`. Collector menolak menimpa capture yang sudah ada. Nama database container dapat diubah melalui `CAPACITY_POSTGRES_CONTAINER` (lab ini: `capstone-postgres`, bukan `journalfit-postgres`).

## 3. Capacity & Headroom Worksheet

### 3.1 Definisi dan baseline konfigurasi — CONFIGURED

`1000m CPU = 1 core`; `1024 MiB = 1 GiB`. Request adalah masukan penjadwalan/reservasi, bukan pemakaian; limit adalah batas container, bukan peak yang telah terukur.

| Komponen | Replika baseline | CPU request / limit per pod | RAM request / limit per pod | Penempatan runtime |
|---|---:|---:|---:|---|
| Backend | 2; HPA 2–3 | 100m / 250m | 128Mi / 256Mi | `k3d-capstone-agent-0`, storage-pinned |
| Worker format `pg-boss` | 1 | 100m / 250m | 128Mi / 256Mi | agent yang sama, berbagi PVC |
| Keycloak | 1, `Recreate` | 250m / 1000m | 512Mi / 1024Mi | `k3d-capstone-server-0` |
| PostgreSQL, Prometheus, Grafana, registry | masing-masing 1 Docker container | tidak ada cap CPU | tidak ada cap RAM | di luar K8s, tetap berbagi VM Docker |
| Argo CD, kube-system, smoke | 7 + 6 + 1 pod Running | bervariasi; sebagian tanpa request | bervariasi; sebagian tanpa request | termasuk pengukuran semua namespace |

Sumber: manifest, inventaris live terproyeksi, dan `docker_limits` pada capture. Nilai Docker `memory_limit_bytes=0` dan `nano_cpus=0` berarti tidak ada batas per-container; bukan tidak mengonsumsi resource.

| Skenario aplikasi: backend + 1 worker + 1 Keycloak | CPU request total | RAM request total | CPU limit total | RAM limit total |
|---|---:|---:|---:|---:|
| Baseline, **2 backend** | **550m** | **896Mi** | **1750m** | **1792Mi** |
| HPA maksimum, **3 backend** | **650m** | **1024Mi** | **2000m** | **2048Mi** |
| HPA maksimum + `maxSurge: 1`, **4 backend sementara** | **750m** | **1152Mi** | **2250m** | **2304Mi** |

Contoh baseline: `(2 × 100) + 100 + 250 = 550m`; RAM `(2 × 128) + 128 + 512 = 896Mi`. Baris HPA/rollout adalah **skenario configured**, bukan hasil scale-out/rolling-update baru. Tabel tidak menjumlahkan baseline dan HPA maksimum sebagai workload terpisah. Job migrasi/seed selesai sebelum sampling, sehingga tidak termasuk workload aktif; untuk deployment bersamaan, budget efektif Job adalah request 50m/64Mi dan limit 200m/192Mi (init dan seed berurutan, bukan dijumlahkan). Rollout worker sendiri juga memerlukan budget surge terpisah; tabel di atas mengasumsikan hanya backend yang rollout.

### 3.2 Utilisasi lima sampel — MEASURED

Kondisi: idle dengan probes, polling queue, monitoring/background platform; ada preflight login JWT, tanpa generator beban. Angka `kubectl top` dibulatkan dan window Metrics API/HPA tidak selalu sama.

| Kelompok | CPU min–max | RAM min–max | Catatan |
|---|---:|---:|---|
| Backend, **gabungan dua pod** | 11–57m | 77–81Mi | Bandingkan dengan request gabungan 200m/256Mi. |
| Worker format | 5–12m | 29–30Mi | Idle/polling; belum mewakili parsing DOCX paralel. |
| Keycloak | 4–593m | 568–570Mi | CPU burst melewati request 250m, masih di bawah limit 1000m pada sampel; RAM konsisten di atas request. |
| Argo CD, gabungan 7 pod | 18–108m | 173–175Mi | Controller Ready; tidak ada Application yang dikelola pada lab ini. |
| kube-system, gabungan 6 pod | 15–77m | 143–144Mi | Termasuk DNS, metrics-server, Traefik, local-path dan ServiceLB; bukan seluruh overhead proses host k3s. |
| Smoke workload lama | 0m terbulatkan | 12Mi | Tetap dimasukkan ke footprint lab. |

| Container Docker di luar pod aplikasi | RAM min–max (MiB) |
|---|---:|
| PostgreSQL 17 (`capstone-postgres`) | 88,97–89,56 |
| Prometheus | 31,84–32,57 |
| Grafana | 56,50–56,54 |
| Registry | 24,37–24,51 |
| k3d server load balancer | 23,07–23,18 |
| k3d tools | 2,887 |

Node container agent memakai **774,60–776,40 MiB** menurut Docker; node container server **1599,49–1606,66 MiB**. Di dalamnya sudah tercakup pod, containerd dan proses platform. **Jangan menjumlahkan angka node container dengan RAM pod lagi.** Total working-set Docker seluruh container **2602,79–2612,05 MiB** adalah satu tampilan footprint, bukan RAM bebas VM.

### 3.3 Headroom host dan node

Host Docker melaporkan **12 CPU / 7,384 GiB (7561,20 MiB)**. Kedua node k3d masing-masing melihat 12 CPU/7561,20MiB dari VM yang sama; **bukan kapasitas fisik 24 CPU/14,77GiB**.

| Tampilan | Hasil terukur / terhitung | Makna |
|---|---|---|
| VM `MemAvailable / MemTotal` | **4087,06–4270,79 / 7561,20 MiB = 54,05–56,48%** | Headroom RAM VM yang bisa digunakan, termasuk memori reclaimable. |
| VM `MemTotal - MemAvailable` | **3290,42–3474,14 MiB** | Footprint VM; sudah termasuk stack, kernel dan overhead bersama. |
| Delta `/proc/stat`, 4 interval | busy **16,24–21,37%**, idle **78,63–83,76%** | Aktivitas seluruh Linux VM; tidak sama dengan CPU aplikasi saja. `guest` tidak dihitung dua kali; idle memasukkan iowait. |
| Docker CPU dinormalisasi ke 12 CPU | **2,07–2,58%** | Hanya container yang disampling dengan window berbeda; tidak menggantikan pengukuran CPU VM. |
| Kubernetes node agent | **117–194m / 774–778Mi** | Tampilan node Metrics API. |
| Kubernetes node server | **146–797m / 1597–1608Mi** | Tampilan node Metrics API; window berbeda dari Docker. |

Headroom scheduler dihitung sebagai `allocatable - requests semua pod non-terminal pada node`. Ini bukan headroom utilisasi:

| Node | Request CPU/RAM saat baseline, semua namespace | Unreserved CPU/RAM | Request saat 4 backend sementara |
|---|---:|---:|---:|
| agent (storage) | 500m / 524Mi | 11500m / 7037,20Mi | 700m / 780Mi |
| server | 250m / 512Mi | 11750m / 7049,20Mi | 250m / 512Mi |

Agent memiliki **12 container tanpa request CPU/RAM**, server **2**. Karena itu angka unreserved yang besar tidak berarti beban tersebut gratis atau dijamin aman dipadatkan. Tidak ada hard budget peak seluruh host di bawah total VM karena komponen Docker dan sebagian workload platform uncapped; yang dapat dipertanggungjawabkan adalah pengukuran baseline serta batas aplikasi dan asumsi skenario di atas.

PVC `journalfit-uploads` adalah **1Gi local-path RWO**. `df` di `/app/uploads` memperlihatkan filesystem host yang jauh lebih besar: request 1Gi **bukan bukti quota filesystem 1Gi**. Kapasitas virtual tersebut juga tidak membuktikan sisa disk fisik Windows. Backend/worker tetap terikat satu node; dua backend tidak memberi node-level HA.

### 3.4 Over-/under-provisioning dan keputusan

| Komponen | Penilaian berbasis bukti | Keputusan / validasi berikutnya |
|---|---|---|
| Keycloak RAM | **Under-reserved**: 568–570Mi melebihi request 512Mi sekitar 10,94–11,33%; maksimum teramati ~55,7% dari limit 1Gi. | Kandidat request **768Mi**, limit tetap 1Gi; validasi login burst, cold start, GC dan p95 working set sebelum mengubah manifest resource. Referensi lama 596Mi/72s adalah run historis, bukan pengukuran cold start sesi ini. |
| Backend | Reservation RAM 256Mi gabungan sekitar 3,2× pemakaian idle; CPU HPA 6–17% di bawah target 70%. | **Kandidat rightsizing pada idle**, bukan bukti over-provisioned untuk beban puncak. Pertahankan request 100m/128Mi dan min 2 sampai ada profiling parsing/upload/queue serta SLO. |
| Worker format | RAM idle 29–30Mi dibanding request 128Mi, CPU idle 5–12m dibanding request 100m. | Pertahankan budget untuk parsing OOXML; ukur file mendekati 10MB, concurrency, backlog dan CPU throttling sebelum pengurangan. |
| Storage & platform | Budget PVC nominal 1Gi kecil terhadap proyeksi puluhan GiB/bulan; banyak proses tanpa request/cap. | Prioritaskan object storage/retensi dan resource budgets; jangan menyimpulkan peak host dari penjumlahan limit aplikasi saja. |

## 4. Cloud IaaS / CloudStack Mapping — ASSUMED

Target berikut adalah **pilot single-region, belum HA penuh**. CloudStack menyediakan compute/disk/network offerings yang tarifnya ditentukan operator; harga DigitalOcean hanya pembanding IaaS publik, bukan tarif bawaan CloudStack atau tagihan nyata.

| Komponen lokal | Padanan cloud / CloudStack | Sizing dan asumsi penempatan | USD/bulan |
|---|---|---|---:|
| k3s server + Argo CD | 1 Linux VM / compute offering | 2 vCPU, 4Gi RAM, 80Gi SSD; control plane + Argo. | 24,00 |
| Backend, worker, Keycloak, monitoring | 2 worker VM / compute offerings | Masing-masing 2 vCPU, **4Gi RAM**, 80Gi SSD; ada budget OS/kubelet dan monitoring. | 48,00 |
| Postgres `journalfit` + `keycloak` | 1 VM DB privat, **self-managed**, bukan managed PostgreSQL | 2 vCPU, 4Gi RAM, 80Gi SSD; koneksi DNS privat mengganti alias host k3d `host.k3d.internal`. | 24,00 |
| Ingress | Regional LB / network offering + Traefik | 1 regional LB; TLS dan aturan jaringan ke worker. | 12,00 |
| PVC upload + logical backup | S3-compatible object service | Referensi Spaces: 250Gi storage + 1Ti transfer termasuk; adapter/retensi masih roadmap. | 5,00 |
| Backup VM harian | Backup offering / snapshot service | 30% × USD 96 compute; snapshot bukan bukti backup DB application-consistent. | 28,80 |
| **Total estimasi** | | **96 + 12 + 5 + 28,80** | **141,80** |

Ukuran 4Gi/worker menggantikan contoh lama 2GB agar Keycloak dan overhead mendapat ruang. **Prasyarat distribusi:** migrasi file ke object storage dan ganti storage pinning dengan penempatan/topology yang sesuai. Pada surge 4 API, contoh budget worker A: 2 backend + worker = limit 750m/768Mi; worker B: 2 backend + Keycloak = limit 1500m/1536Mi. Sisa untuk OS/platform tetap perlu divalidasi di VM asli. Menambah VM saja tidak menghilangkan SPOF PVC, database, control plane atau Keycloak tunggal.

Harga Basic Regular (2 vCPU/4Gi/80Gi, USD 24), LB mulai USD 12, Spaces USD 5 dan backup harian 30% bersumber dari halaman resmi pada §8. SSD boot sudah termasuk harga VM, bukan dihitung lagi sebagai volume terpisah. Transfer object storage diasumsikan tidak melewati kuota 1TiB/bulan; hal ini belum diukur. Biaya pajak, kurs, tenaga operasional, domain, overage dan HA tambahan dikecualikan. Pada CloudStack, operator juga perlu mengalokasikan biaya host fisik, system/management VMs, jaringan dan storage bersama; lisensi aplikasi open-source tidak membuat IaaS gratis.

## 5. FinOps Unit-Cost — ASSUMED

### 5.1 Pemeriksaan format deterministik saat ini

Versi aktif memakai **OOXML (`jszip` + `fast-xml-parser`) → rule engine → worker `pg-boss`**, bukan parser `mammoth` lama. Biaya API AI eksternal untuk jalur format ini **USD 0**. CPU, storage, database dan operator tetap memiliki biaya; biaya aktual laptop tidak diukur di sini.

```text
unit_cost_infrastruktur = biaya_infrastruktur_bulanan / pemeriksaan_format_selesai_bulanan
USD 141,80 / 50.000 = USD 0,002836 per pemeriksaan
```

| Asumsi selesai/bulan | Infrastruktur/cek | Infrastruktur/1.000 cek | Proyeksi LLM abstract/bulan | Total v2/bulan |
|---:|---:|---:|---:|---:|
| 10.000 | USD 0,014180 | USD 14,180 | USD 1,35 | USD 143,15 |
| 50.000 | USD 0,002836 | USD 2,836 | USD 6,75 | USD 148,55 |
| 100.000 | USD 0,001418 | USD 1,418 | USD 13,50 | USD 155,30 |

Volume adalah **skenario pembagi biaya**, bukan throughput yang dibuktikan. Pembagi menghitung pemeriksaan format selesai, bukan semua HTTP request atau scope yang masih queued. Dengan asumsi rata-rata upload 1MiB, retensi 30 hari, 50.000 upload baru memerlukan **48,83GiB**, ditambah budget logical backup 10GiB menjadi **58,83GiB**. Pada 100.000, total asumsi 107,66GiB masih di bawah bucket 250GiB; retensi tersebut belum diimplementasikan. Ukuran file 10MB maksimum tidak disamakan dengan rata-rata. Jika rata-rata/retensi/egress naik, hitung ulang overage dan unit-cost.

### 5.2 Proyeksi abstract-only LLM v2

Sumber harga saat akses: **Groq `openai/gpt-oss-20b`**, USD **0,075 input / 0,30 output per satu juta token**. Model Llama 3.1 8B kini menampilkan Contact Sales; harga murah lama tidak diperlakukan sebagai quote mutakhir.

| Skenario model yang sama | Input/output diasumsikan | API cost/cek | API cost/50.000 |
|---|---:|---:|---:|
| Full text | 8000 / 1000 token | USD 0,000900 | USD 45,00 |
| Judul + abstrak | 600 / 300 token | USD 0,000135 | USD 6,75 |
| Format deterministik aktif | tanpa panggilan LLM | **USD 0** | **USD 0** |

Pengurangan biaya token **85%** berlaku hanya untuk asumsi tersebut, bukan janji kualitas/latensi atau penghematan >95%. Anggaran output harus mencakup reasoning tokens. Prompt, model dan token aktual, retry/error, caching serta fraksi naskah yang dikirim belum diukur. Perhitungan memakai 100% naskah memanggil LLM sekali, cache hit 0 dan retry 0. Jika filter/cache diaktifkan kelak:

```text
biaya_LLM = N × fraksi_panggilan × (1 - cache_hit) × (1 + retry_fraction)
            × (token_input × harga_input + token_output × harga_output) / 1.000.000
```

Format pre-filter sudah tersedia; cross-submission hash cache, Groq scope worker, dan rule-template suggester masih roadmap. Idempotensi job yang sama tidak otomatis berarti cache naskah identik lintas unggahan. Tidak ada panggilan API LLM berbayar pada pekerjaan ini.

### 5.3 Optimization Without Harming Controls

- Pertahankan minimum dua backend, readiness/startup/liveness probes, HPA 2–3 dan ruang surge; idle bukan alasan menghapus replika minimum.
- Pertahankan non-root (`UID 10001` API/worker, `1000` Keycloak), Secret references, `drop ALL`, serta validasi JWT/JWKS dan tenant dari token.
- Gunakan image Node 22 Alpine dan dependensi production; ukuran image lokal terlampir di capture, tanpa membandingkan angka image Debian yang belum diukur.
- Retensi Prometheus `3d` membatasi histori monitoring lab; sesuaikan retensi cloud dengan kebutuhan SLO, jangan mematikan telemetry/recovery untuk mengejar biaya.
- Utamakan deterministic checks; abstract-only, kuota/budget, dedup cache dan batas retry LLM menjadi desain v2 yang perlu validasi mutu serta perlindungan data.
- Rightsizing baru diterapkan setelah data beban representatif dan service objective menunjukkan kontrol tetap terpenuhi. Modul ini memberi rekomendasi; konfigurasi request/limit tetap menjadi baseline pengukuran.

## 6. Residual Risks & Prioritized Improvement Roadmap

| ID / prioritas | Kondisi aktual dan dampak | Perbaikan terurut | Bukti penerimaan yang diperlukan |
|---|---|---|---|
| **R1 / P1** | PVC RWO `local-path`, API + worker pada satu node; gagal node mengganggu semua pemrosesan/file. Nominal 1Gi tidak cukup untuk proyeksi retensi bulanan dan bukan quota. | Implementasikan adapter Garage/S3, migrasi dan validasi file, lifecycle/backup, lalu hilangkan storage pinning dan atur sebaran replika. | File/hasil tetap dapat diakses setelah pod pindah node; isolasi tenant dan restore objek diuji. |
| **R2 / P1** | Keycloak OIDC/JWKS aktif; direct access grant dan akun demo masih ada. Satu replica `Recreate` memberi jeda login saat restart. | Authorization Code + PKCE, ganti/hapus akun demo pada lingkungan produksi, kelola/rotasi Secret, evaluasi IAM HA. | Login PKCE dan pengujian negatif JWT/role/tenant; prosedur rotasi serta perilaku restart terukur. |
| **R3 / P1** | Postgres di host Docker melalui alias host k3d `host.k3d.internal` (koreksi 2026-11-23; `host.docker.internal` hanya Docker Desktop); backup masih manual. Bukti Paket B historis bukan restore ulang pada DB sesudah migrasi 002 sesi ini. | DB privat dengan DNS stabil; backup journalfit + keycloak terjadwal/encrypted/off-site; recovery drill untuk schema dan data terbaru. | Jadwal/artefak backup, restore terisolasi dan integritas data + RTO/RPO aktual versi baru. |
| **R4 / P1 sebelum cloud** | Registry lab memakai HTTP tanpa auth/TLS; image di localhost tidak otomatis tersedia di IaaS. | Registry privat TLS/auth, immutable digest dan scan/risk review untuk image `be509cd`; selaraskan ke release pipeline. | Pull autentik dari node cloud, hasil scan image yang sama dan trace source → digest → runtime. |
| **R5 / P1** | Keycloak RAM di atas request; 14 container K8s tanpa request, Docker pendukung uncapped. Reservasi scheduler terlalu optimistis. | Validasi kandidat Keycloak request 768Mi; load-test DOCX/login/queue; tetapkan resource budgets, alert RAM/throttling/backlog dan retensi yang memadai. | p95/puncak di bawah budget yang disepakati, tanpa OOM dan acceptance target terpenuhi saat beban representatif. |
| **R6 / P1 integrasi** | Argo CD Ready tetapi tidak ada Application di lab; rollout sesi ini manual. Bukti ini tidak membuktikan GitOps sinkron. | Koordinasikan tag/digest baru dan manifest dengan pemegang delivery; pasang/sinkronkan Application setelah sumber/artifact tersedia. | Revision source, artifact, Healthy/Synced, drift reconciliation dan ownership HPA terbukti pada versi yang sama. |
| **R7 / P2** | Worker format `pg-boss` **sudah berjalan**; adapter storage masih lokal. `scope` dibuat queued tetapi worker scope/Groq belum ada; suggester/cache belum tersedia. | Selesaikan S3 lebih dulu; lanjutkan scope worker dengan timeout/retry/DLQ, quality evaluation dan cost metering; suggester kemudian. | Format/scope selesai dengan status eksplisit, pengujian mutu dan unit-cost terukur; fitur tidak diklaim selesai hanya dari status queued. |

Urutan praktis: **resource/observability + release/IAM readiness → storage/DB recovery lintas node → fitur AI tambahan**. RLS merupakan pertahanan tambahan yang perlu evaluasi, bukan syarat untuk menyatakan verifikasi JWT Keycloak yang sudah aktif.

## 7. Gambar tiga panel dan technical defense

Renderer mengambil data dari `capture.json`, `analysis.json` dan asumsi harga; angka tidak diketik ulang sebagai output terminal. Panel 1 memuat kutipan `kubectl top` asli + worksheet/headroom; Panel 2 mapping/unit-cost + kontrol; Panel 3 risiko/roadmap. Simpan di `evidence/capacity-finops/09_evidence.jpg` mengikuti pola repo; saat pengumpulan petakan ke `cloud-capstone-team-7/09-capacity-finops/09_evidence.jpg`. Gambar adalah ringkasan; log dan penjelasan sembilan field tetap disertakan.

**Q: Which resource is currently over- or under-provisioned?**

“Pada lima sampel idle, Keycloak under-reserved di RAM: 568–570Mi terhadap request 512Mi, walau masih di bawah limit 1Gi. Saya mengusulkan 768Mi untuk diuji. Dua backend hanya memakai 77–81Mi gabungan terhadap request 256Mi dan worker 29–30Mi terhadap 128Mi, sehingga ada kandidat rightsizing pada idle. Saya mempertahankan budget dan dua replika sampai profiling DOCX/login/queue membuktikan service objective tetap terpenuhi.”

**Q: What would change when the workload moves from k3d to real IaaS/CloudStack?**

“Saat ini node k3d berbagi satu VM Docker. Di IaaS, node menjadi VM dengan kapasitas, biaya dan failure boundary tersendiri. Saya harus menyiapkan compute/disk/network offerings, DB privat dengan DNS, registry TLS/auth, ingress TLS, secrets, serta monitoring/backup. PVC lokal harus dimigrasikan sebelum backend/worker dapat tersebar lintas node. Pilot memetakan 1 control-plane VM, 2 worker 4Gi, dan 1 DB VM; estimasi USD 141,80/bulan dari harga pembanding, bukan tagihan CloudStack. HA dan throughput tetap harus diuji.”

## 8. Referensi

- `Cloud_Computing_Final_Capstone_Project_Guideline.pdf`: §7 Capacity/FinOps + Roadmap, §9 Evidence Standard, §10 M8, §13 langkah 12–13, §14 rubrik 5%, §15.1 Bab 10–12, §17 migrasi IaaS/CloudStack.
- [DigitalOcean Droplets + backup harian](https://www.digitalocean.com/pricing/droplets), [Regional LB](https://www.digitalocean.com/pricing/load-balancers), [Spaces](https://www.digitalocean.com/pricing/spaces-object-storage), diakses 2026-11-23.
- [Groq Supported Models dan tarif](https://console.groq.com/docs/models), diakses 2026-11-23.
- [CloudStack compute/disk/network offerings](https://docs.cloudstack.apache.org/en/latest/adminguide/service_offerings.html), diakses 2026-11-23.
- Implementasi: [source/FORMAT.md](../../source/FORMAT.md), [source/AUTH.md](../../source/AUTH.md), manifest `deployment/`, [bukti recovery Paket B](../reliability-recovery/README.md), [ADR](../../decisions/README.md). Catatan historis lintas modul tidak menggantikan pengukuran versi sesi ini.
