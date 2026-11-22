# Tahap 3 — pemeriksaan lingkungan paket dosen

**Status: audit lima area selesai, dengan temuan terbuka.** Lingkungan aplikasi M3
siap untuk review manifest Tahap 4. Gitea belum selesai diinisialisasi untuk
delivery M4. Bukti demo yang dibuat sebelumnya tetap tersedia; audit ini menjadi
dasar pembahasan terstruktur lingkungan saat ini.

## Identitas evidence

- Scope: layanan/versi, database/schema, registry/image, network, dan cluster.
- Pelaksana: agen coding atas instruksi pemilik M3; hasil menjadi bahan belajar
  serta review tim.
- Run utama: [audit.json](run-20261117T100148Z-f40e9a93/audit.json).
- Waktu: `2026-11-17T17:01:48.572739+07:00` sampai
  `2026-11-17T17:02:16.675987+07:00`.
- Branch/HEAD: feat/k8s-manifests /
  `d9ab35a10eab8e9c67e45bc53f8a22522846b038`, dengan perubahan lokal terdokumentasi.
- [Script audit](../../../automation/scripts/audit-stage3-environment.py), SHA-256:
  `874d1c007db2e589b730490ad861a383ed5f0567c7fdfdd5dec37a490917a996`.
- SHA-256 `source/schema.sql`:
  `73a75f57e37fa7e0ed4e45a9775daa86976367d40a13d05b4fc7499e6097d499`.
- SHA-256 ZIP paket dosen:
  `6afa9ca6d7807e878071588fda1c0d9206f089c4f36dcc91094d6ec9ea06ee71`.
- Run awal [tetap disimpan](run-20261117T095607Z-f7f0ec36/audit.json): mendeteksi
  kegagalan probe API Gitea, lalu dilanjutkan diagnosis halaman Installation.

## Metode dan arti status

Audit membaca metadata Docker/Kubernetes, HTTP endpoint, versi binary, konfigurasi
registry node, serta metadata dan jumlah baris PostgreSQL dari dalam pod. Query
database berada dalam transaksi `REPEATABLE READ READ ONLY` yang diakhiri rollback.
Secret hanya dicatat nama dan key-nya; password/token serta HTML sesi tidak disimpan.

Nilai `auditCompleted=true` menyatakan lima pemeriksaan selesai. Nilai
`readyForManifestReview=true` menyatakan dependency M3 siap untuk Tahap 4.
Status keseluruhan tetap **needs_attention**, karena API Gitea belum siap; hasil ini
tidak disamarkan sebagai semua layanan lulus. Script keluar dengan kode 2 untuk
temuan yang perlu ditindaklanjuti, atau kode 1 untuk kegagalan pengumpulan audit.

## 1. Layanan dan versi

Baseline dibandingkan dengan `VERSION_MATRIX.md` di dalam ZIP dosen.

| Komponen | Referensi dosen | Aktual dan kondisi |
| --- | --- | --- |
| Docker Desktop / Engine | Dicatat sesuai host | Desktop 4.89.0, Engine/CLI 29.7.2, Linux/amd64 |
| Compose | Dicatat sesuai host | 5.5.0 |
| k3d | 5.9.0 recommended | 5.9.0 |
| Kubernetes/k3s | Default k3d, catat aktual | v1.35.5+k3s1 |
| kubectl | Client kompatibel | v1.36.1; selisih satu minor dari server |
| PostgreSQL | 17-alpine | Server 17.11; container healthy |
| Registry | 2 | Binary 2.8.3; `/v2/` HTTP 200 |
| Keycloak | 26.8.1 | 26.8.1; discovery realm capstone HTTP 200 |
| Gitea | 28.2.0 | Binary 28.2.0; web Installation 200, API version 404 |
| Gitea Runner | 5.1.1 | Container capstone-gitea-runner belum tersedia |
| Argo CD | 3.5.6 | Controller 3.5.6 terpasang/Ready; belum ada Application |
| Prometheus / Grafana | 3.15.1 / 13.2.4 | Profil container capstone belum dijalankan |
| Trivy | 0.76.0 | Image referensi aquasec/trivy:0.76.0 belum tersedia di cache |

Container berjalan tidak selalu berarti layanan sudah siap digunakan. Gitea
adalah contohnya: proses aktif, tetapi instalasi awal belum selesai. Keycloak
tersedia sebagai layanan identitas; source M2 masih memakai auth mock.

## 2. Database dan schema

Pod memakai database **journalfit**, schema **public**, dan role **capstone**.
Koneksi dari pod berhasil, bukan hanya koneksi dari dalam container PostgreSQL.
Kolom wajib dibandingkan dengan deklarasi enam tabel pada source SQL.

| Tabel | Baris saat audit |
| --- | ---: |
| tenants | 3 |
| users | 2 |
| format_rule_templates | 3 |
| manuscripts | 3 |
| check_results | 3 |
| findings | 8 |

Seluruh tabel dan kolom wajib ditemukan: **34 kolom, enam primary key, dan enam
foreign key**. Definisi tipe/default/constraint aktual tersedia dalam JSON untuk
review; pemeriksaan otomatis kompatibilitas menilai keberadaan tabel dan kolom,
bukan membuktikan riwayat migrasi atau kualitas seluruh desain database.

Role capstone memiliki superuser/createdb/createrole sebagai akun lab. Evaluasi
role aplikasi least-privilege dicatat sebagai tindak lanjut security M6. Audit
tidak membuat akun, menjalankan schema ulang, atau mengubah privilege.

## 3. Registry dan jalur image

```text
Build di laptop
  -> push localhost:5001/journalfit-backend:<tag>
  -> container registry port 5000 pada capstone-net
  -> node k3d pull registry:5000/journalfit-backend:<tag>
  -> container aplikasi di Pod
```

Tag aktif: `stage2-20261117t055120z-d9ab35a`.
Digest build, digest manifest registry, dan imageID pod sesuai:
`sha256:9aa3893aa1a763fb818af769e98db305c4afcbd34e5685231e571783e4d91557`.
Hash byte manifest juga cocok dengan header digest registry.

Mirror HTTP registry:5000 tersedia pada konfigurasi node. GET `/v2/` dari node
agent berhasil. Perbedaan localhost:5001 dan registry:5000 adalah perbedaan jalur
host versus Docker network menuju registry yang sama.

## 4. Network antarlayanan

- Docker bridge: **capstone-net**, subnet **172.28.0.0/16**, gateway 172.28.0.1.
- Core ports: Gitea 3001, PostgreSQL 5432, Keycloak 8081, registry 5001 dipublish
  pada 127.0.0.1.
- Load balancer k3d: 8088/8443 dan API 6550 tercatat bind 0.0.0.0; boundary lab
  perlu mempertimbangkan binding aktual tersebut, bukan menyamakan dengan core ports.
- Pod memakai DB_HOST **host.docker.internal**, ter-resolve ke **192.168.65.254**
  pada Docker Desktop Windows ini, lalu PostgreSQL port 5432.

```text
Browser / curl -> journalfit.localhost:8088
  -> k3d load balancer -> Traefik Ingress
  -> Service journalfit-backend:80 -> Pod backend:8000
       -> host.docker.internal:5432 -> PostgreSQL journalfit/public
       -> /app/uploads -> PVC -> local storage pada agent-0
```

Alamat localhost pada laptop, container, dan pod menunjuk lingkungan yang berbeda.
Karena itu DB_HOST tidak diganti menjadi localhost di pod. Alamat IP di atas
merupakan observasi run ini, bukan nilai yang harus disalin ke laptop lain.

## 5. Kondisi cluster

- Context k3d-capstone; satu server dan satu agent, **keduanya Ready**.
- Dua pod JournalFit Ready dengan image/digest yang benar.
- ConfigMap dan referensi Secret sesuai; key DB_PASSWORD tersedia tanpa mengambil
  nilainya ke evidence.
- Service/Ingress tersedia, readiness aplikasi HTTP 200.
- PVC journalfit-uploads **Bound**, kapasitas 1Gi RWO, storage class local-path.
- PV memiliki affinity ke k3d-capstone-agent-0 dan reclaim policy Delete.
- Dua replica berbagi satu node storage. RWO berarti satu node read/write, bukan
  selalu satu pod; kondisi ini tidak membuktikan HA lintas node.
- Metrics API berjalan: snapshot pod sekitar 26-27Mi memory. Ini bukan load test
  atau hasil rightsizing.
- Argo Application controller Ready, tetapi jumlah Application **0**. Belum ada
  bukti GitOps reconciliation aplikasi.

## Temuan dan tindak lanjut

| Temuan | Dampak | Tindak lanjut |
| --- | --- | --- |
| Gitea masih Installation; API 404 | Persiapan repository/runner belum siap | Selesaikan konfigurasi Gitea bersama pemilik M4 sebelum bootstrap |
| Role DB lab superuser | Least privilege belum dipenuhi oleh akun aplikasi | Review role/privilege bersama pemilik security M6 |
| `/metrics` dan `/q/metrics` HTTP 404 | Template Prometheus Quarkus belum sesuai backend Express | Instrumentasi serta adaptasi scrape path/routing pada M5 |
| Profil runner/Prometheus/Grafana belum aktif | Komponen milestone berikutnya belum dioperasikan | Aktifkan bertahap sesuai milestone dan kapasitas laptop |

## Keputusan yang didukung dan batas pemeriksaan

**Lanjut ke Tahap 4: review manifest Kubernetes.** Database/schema, jalur image,
network, node, dan storage cukup untuk melanjutkan review tersebut. Temuan Gitea
tetap terbuka untuk delivery M4 dan tidak dinyatakan sudah diperbaiki.

Audit ini tidak melakukan bootstrap, scan vulnerability, perubahan data bisnis,
reapply workload, restart layanan, cold start, setup laptop baru, atau pemulihan
data. Snapshot mendeskripsikan kondisi pada waktunya, bukan jaminan kondisi terus
tetap sama. Bukti demo sebelumnya tetap menjadi bukti skenario masing-masing.

## Verifikasi catatan audit

- Fingerprint script, schema, dan ZIP sesuai dengan file yang diperiksa.
- Enam belas dari 17 check bernilai true; check HTTP agregat tetap false karena
  API Gitea 404. Status needs_attention dipertahankan.
- Sintaks script Python dan blok command PowerShell Tahap 3 diperiksa.
- Sebanyak 74 tautan lokal pada lima dokumen terkait memiliki target yang tersedia.
- `git diff --check` lulus; source aplikasi M2 tetap sesuai baseline yang ditelusuri.
