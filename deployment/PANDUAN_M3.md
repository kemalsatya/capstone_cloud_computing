# Panduan dan roadmap M3 JournalFit

**Target utama:** Windows dengan PowerShell dan Docker Desktop Linux containers.
**Urutan formal per 2026-11-22:** Tahap 7 menghasilkan panduan operasi/demo dan
paket handoff M4; rehearsal lokal lulus. Uji dari kosong di laptop kedua dan
penerimaan M4 masih terbuka. Persistensi dan rollout terukur pada Tahap 6;
temuan aplikasi tetap dicatat untuk M2.

## Target akhir

1. Image dapat dibangun ulang dari source yang dapat ditelusuri.
2. Kubernetes menjalankan aplikasi dengan konfigurasi, probes, resource, dan
   penyimpanan yang sesuai.
3. Upload DOCX, laporan, persistensi, dan rollout memiliki evidence baru.
4. Pemilik M3 memahami prosedur, hasil, diagnosis, dan batasannya.
5. Prosedur persiapan lingkungan baru tersedia. Klaim lintas laptop memerlukan
   pengujian nyata pada laptop lain.

## Roadmap dan kriteria selesai

| Tahap | Pekerjaan | Kriteria selesai | Status |
| --- | --- | --- | --- |
| 0 | Arsipkan evidence lama; rapikan status dan tautan | Arsip utuh, checksum cocok, indeks aktif dan dokumentasi konsisten | Selesai |
| 1 | Telusuri kontrak aplikasi M2 | Entrypoint, port, konfigurasi, database, file, dan endpoint dapat dijelaskan | Selesai: penelusuran source dan dokumentasi |
| 2 | Tinjau Dockerfile dan uji container | Build berulang serta proses, koneksi, health, dan izin upload terbukti | Selesai: build dan skenario Docker lulus |
| 3 | Inventarisasi dan periksa infrastruktur dosen | Versi, layanan, data, cluster, dan jalur jaringan yang diperlukan diketahui | Audit selesai; temuan Gitea/M4, metrik/M5, dan role DB/M6 dicatat |
| 4 | Tinjau manifest Kubernetes | Konfigurasi konsisten dengan kontrak aplikasi dan image | Selesai: 26 check, server dry-run, drift, dan runtime sesuai |
| 5 | Deploy dan uji transaksi | DOCX nyata menghasilkan laporan melalui Kubernetes; data dan file diperiksa | Pengujian selesai: core lulus, TXT diterima dan error ukuran masih temuan M2 |
| 6 | Uji persistensi dan rollout | File, data, dan perilaku layanan terukur dalam skenario yang dinyatakan | Selesai: 13/13 check; pod delete 13,23 dtk, rollout 22,44 dtk, 117/117 probe |
| 7 | Lengkapi panduan, evidence, demo, dan handoff | Prosedur dapat diulang dan hasil beserta batasannya dapat dijelaskan | Paket siap direview; rehearsal lokal lulus, uji laptop kedua dan penerimaan M4 terbuka |

HPA dibahas sebagai tambahan setelah deployment dasar stabil. Keberadaannya dalam
manifest lama tetap perlu ditinjau sebelum penggunaan manifest.

Pola setiap tahap: pahami tujuan, tinjau konfigurasi, uji, jelaskan hasil, simpan
evidence, lalu perbarui status. Kegagalan menjadi bahan diagnosis dan dicatat
bersama hasil akhirnya.

## Tahap 0: memeriksa hasil pengarsipan

### Tujuan dan konteks

Isi lama `evidence/platform/` dipindahkan ke
`evidence/_archive/platform-unverified-2026-11-17/`. Folder aktif sekarang berisi
indeks pemeriksaan baru. Catatan lengkap ada di
[ARCHIVE_STATUS.md](../evidence/_archive/platform-unverified-2026-11-17/ARCHIVE_STATUS.md).

Command di bawah memeriksa file repository; tidak memerlukan layanan Docker atau
cluster. Jalankan PowerShell dari **root repository**, yaitu folder yang berisi
`README.md`, `source/`, `deployment/`, dan `evidence/`.

### A. Periksa branch dan perubahan lokal

```powershell
git branch --show-current
git status --short
```

Hasil yang diharapkan: branch kerja dan perubahan pengarsipan/dokumentasi terlihat.
Git dapat menampilkan path lama sebagai deleted dan arsip sebagai untracked sebelum
perubahan distage. Keberadaan path baru serta pemeriksaan checksum menentukan
apakah file lama benar-benar tersimpan di arsip.

### B. Periksa integritas isi arsip

```powershell
$archive = Join-Path (Get-Location).Path "evidence/_archive/platform-unverified-2026-11-17"
$entries = @(Get-Content -LiteralPath (Join-Path $archive "SHA256SUMS.txt"))
$bytes = 0L

foreach ($entry in $entries) {
    $parts = $entry -split '  ', 2
    $file = Join-Path $archive $parts[1]
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        throw "File arsip tidak ditemukan: $($parts[1])"
    }
    $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $parts[0]) {
        throw "Checksum tidak cocok: $($parts[1])"
    }
    $bytes += (Get-Item -LiteralPath $file).Length
}

if ($entries.Count -ne 48 -or $bytes -ne 273265) {
    throw "Jumlah file atau ukuran arsip berbeda dari inventaris awal."
}
"PASS: $($entries.Count) file; $bytes byte; seluruh SHA-256 cocok."
```

Hasil yang diharapkan:

```text
PASS: 48 file; 273265 byte; seluruh SHA-256 cocok.
```

**Arti hasil:** 48 file asli sesuai dengan checksum yang dicatat sebelum
pemindahan. Metadata arsip yang baru ditambahkan tidak termasuk hitungan tersebut.
Aturan `.gitattributes` menjaga format byte arsip saat Git melakukan checkout.
Hasil ini tidak menilai kebenaran log pengujian lama.

**Jika gagal:** periksa root repository dan path arsip. Cocokkan file yang disebut
error dengan inventaris; telusuri penyebab perbedaannya sebelum mengubah checksum.

## Tahap 1: memahami kontrak aplikasi M2

### A. Tujuan dan peta belajar

Tujuannya adalah menjelaskan kebutuhan aplikasi sebelum mengatur container dan
Kubernetes. Gunakan [kontrak integrasi](INTEGRATION_CONTRACT.md) sebagai penjelasan
rinci, dengan urutan membaca berikut:

| Urutan | File | Pertanyaan yang dijawab |
| --- | --- | --- |
| 1 | [package.json](../source/package.json) dan [index.js](../source/src/index.js) | Command apa yang memulai proses? |
| 2 | [env.js](../source/src/config/env.js) dan [database.js](../source/src/config/database.js) | Dari mana port dan koneksi database berasal? |
| 3 | [app.js](../source/src/app.js) | Endpoint apa yang dipasang? |
| 4 | [router naskah](../source/src/modules/manuscripts/index.js) dan [controller](../source/src/modules/manuscripts/controllers/manuscript.controller.js) | Bagaimana file dan tenant diterima? |
| 5 | [service](../source/src/modules/manuscripts/services/manuscript.service.js) | Bagaimana file diproses dan skor dihitung? |
| 6 | [repository](../source/src/modules/manuscripts/repositories/manuscript.repository.js) dan [schema.sql](../source/schema.sql) | Apa yang dibaca/disimpan pada PostgreSQL? |
| 7 | [health controller](../source/src/modules/health/controllers/health.controller.js) | Apa arti alive dan ready? |

### B. Alur yang perlu dipahami

```text
API menerima DOCX
    -> tenant diperiksa dari header
    -> file disimpan di uploads
    -> teks diekstrak dan aturan sederhana dievaluasi
    -> metadata, hasil, dan findings disimpan di PostgreSQL
    -> laporan dikembalikan kepada pengguna
```

Proses upload selesai dalam satu request. Source belum mempunyai antrean, worker,
atau AI. Startup yang tertulis adalah `npm start` dari folder `source/`; command
tersebut menjalankan `node src/index.js`. Ini penjelasan package script, bukan
catatan bahwa aplikasi telah dijalankan pada Tahap 1.

### C. Command pemeriksaan baseline source

Jalankan dari **root repository**. Command berikut membaca metadata Git dan
mendeteksi perubahan source yang perlu ditelusuri kembali.

```powershell
$reviewedRevision = "d9ab35a10eab8e9c67e45bc53f8a22522846b038"
$applicationPaths = @('source/src', 'source/tests', 'source/schema.sql', 'source/package.json', 'source/package-lock.json', 'source/.env.example')
$revision = git rev-parse HEAD
if ($LASTEXITCODE -ne 0) {
    throw "Folder saat ini bukan repository Git yang dapat dibaca."
}
git diff --exit-code $reviewedRevision -- @applicationPaths
if ($LASTEXITCODE -ne 0) {
    throw "Source berbeda dari baseline yang ditelusuri atau revision tidak tersedia; tinjau kontrak."
}
$untracked = @(git ls-files --others --exclude-standard -- @applicationPaths)
if ($LASTEXITCODE -ne 0 -or $untracked.Count -gt 0) {
    throw "Ada source yang belum tercatat atau pemeriksaan Git gagal; tinjau inventaris source."
}
"PASS: aplikasi M2 sesuai baseline $reviewedRevision; HEAD saat ini $($revision.Trim()); tidak ada source aplikasi untracked non-ignored."
```

Hasil yang diharapkan pada baseline yang diperiksa:

```text
PASS: aplikasi M2 sesuai baseline d9ab35a10eab8e9c67e45bc53f8a22522846b038; HEAD saat ini d9ab35a10eab8e9c67e45bc53f8a22522846b038; tidak ada source aplikasi untracked non-ignored.
```

**Arti hasil:** source tracked sesuai dengan revision yang sudah ditelusuri, bukan
hanya sesuai dengan commit terbaru. HEAD dapat berubah karena commit dokumentasi
sementara source tetap sama. Perubahan pada dokumentasi di luar `source/` tetap
dapat ada. File lokal yang diabaikan Git, seperti environment dan dependency
terinstal, tidak termasuk pemeriksaan ini. Mulai Tahap 2, Dockerfile dan
.dockerignore dipisahkan dari scope aplikasi M2 karena keduanya diubah untuk
packaging; checksum keduanya dicatat pada metadata build.

**Jika hasil berbeda:** periksa revision dan perubahan source, lalu perbarui kontrak
serta catatan pemeriksaan. Jangan menafsirkan perbedaan revision sebagai kegagalan
aplikasi; belum ada aplikasi yang dijalankan oleh command ini.

### D. Implikasi praktis untuk M3

- Aplikasi mendengarkan port 8000 secara default.
- PostgreSQL harus memiliki enam tabel; backend tidak menjalankan schema otomatis.
- DOCX disimpan terpisah dari database. Pada Dockerfile sekarang lokasinya
  `/app/uploads`, sehingga mount volume harus sesuai dan dapat ditulis.
- Readiness `SELECT 1` belum memeriksa schema atau kemampuan menulis file.
- Upload dibuffer di memory dengan batas 20 MiB; kebutuhan memory perlu diukur.
- Auth masih mock dan header tenant belum diikat ke identitas terpercaya.
- Pengujian positif readiness/transaksi memerlukan database yang tersedia;
  build dan pemeriksaan proses saja belum menutup dependensi tersebut.

### E. Pertanyaan untuk memeriksa pemahaman

1. Jika readiness 200, mengapa upload masih mungkin gagal?
2. Mengapa backup database saja belum menyimpan seluruh naskah DOCX?
3. Apakah status COMPLETED berarti semua aturan format lolos?
4. Mengapa memasang Keycloak belum otomatis mengamankan route upload?

Jawaban dapat ditelusuri pada bagian startup, storage, aturan, dan identitas dalam
kontrak integrasi. Catatan hasil pembacaan source ada di
[evidence Tahap 1](../evidence/platform/tahap-1-kontrak-m2.md).

## Tahap 2: membangun dan menguji image Docker

### A. Apa yang dibangun?

Image adalah paket aplikasi beserta runtime/dependency-nya. Container adalah
proses yang dijalankan dari image itu. Volume adalah penyimpanan yang dapat tetap
ada setelah container dihapus.

| Bagian Dockerfile | Arti dan alasan |
| --- | --- |
| `FROM node:22-alpine@sha256:...` | Memilih snapshot base image melalui digest; runtime teramati v22.23.5 |
| `apk add dumb-init` | Menyediakan PID 1 yang meneruskan signal ke proses aplikasi |
| `addgroup` / `adduser` 10001 | Membuat identitas non-root yang sesuai UID/GID manifest Kubernetes |
| `WORKDIR /app` | Menetapkan lokasi kerja; upload relatif menjadi `/app/uploads` |
| `ENV NODE_ENV=production` dan `PORT=8000` | Default runtime, dapat diganti melalui environment |
| `COPY package.json package-lock.json` | Menyalin daftar dependency sebelum source untuk memanfaatkan cache build |
| `npm ci --omit=dev` | Memasang dependency terkunci tanpa nodemon/dev dependencies |
| `COPY src ./src` | Menyalin kode backend produksi |
| `mkdir uploads` / `chown` | Memberi user aplikasi hak tulis pada direktori upload |
| `USER 10001:10001` | Menjalankan proses sebagai user non-root, bukan root |
| `EXPOSE 8000` | Mendokumentasikan port; akses dari host tetap membutuhkan publish port |
| `ENTRYPOINT dumb-init` dan `CMD node src/index.js` | Menjalankan backend dengan pengelolaan PID 1; bukan bukti request draining |

`.dockerignore` membatasi build context ke package files dan source produksi.
File environment lokal, schema, tests, dan upload tidak menjadi isi image.

### B. Prasyarat dan pemeriksaan awal

Jalankan dari **root repository**. Docker Desktop harus menggunakan Linux
containers. Docker Buildx/BuildKit diperlukan untuk opsi metadata build. Untuk
pemeriksaan health positif, script membutuhkan PostgreSQL yang sudah berjalan,
database `journalfit`, dan network `capstone-net` dari paket dosen.

```powershell
docker version --format "{{json .}}"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

Hasil yang diharapkan: daemon Linux dapat diakses. Jika dependency database belum
tersedia, selesaikan inventarisasi infrastruktur pada Tahap 3 sebelum menjalankan
seluruh probe; build image sendiri tidak membutuhkan database.

### C. Build artifact dengan identitas baru

Jalankan pemeriksaan baseline aplikasi pada Tahap 1 terlebih dahulu. Command ini
memakai tag dan nama metadata bertimestamp agar hasil baru terpisah dari run lama.
Pada pengujian pertama, nama file metadata adalah `build-metadata.json`.

```powershell
if (-not (Test-Path -LiteralPath "source" -PathType Container) -or
    -not (Test-Path -LiteralPath "evidence/platform/tahap-2" -PathType Container)) {
    throw "Build context atau parent evidence belum tersedia."
}
$revision = (git rev-parse HEAD).Trim()
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ').ToLowerInvariant()
$image = "journalfit-backend:stage2-$stamp-$($revision.Substring(0, 7))"
$metadata = "evidence/platform/tahap-2/build-$stamp.json"
$existing = @(docker image ls --quiet $image)
if ($LASTEXITCODE -ne 0 -or $existing.Count -gt 0 -or (Test-Path -LiteralPath $metadata)) {
    throw "Tag/metadata sudah ada atau Docker tidak tersedia; gunakan identitas run baru."
}
$created = [DateTimeOffset]::Now.ToString('o')
$dockerfileHash = (Get-FileHash -LiteralPath "source/Dockerfile" -Algorithm SHA256).Hash.ToLowerInvariant()
$ignoreHash = (Get-FileHash -LiteralPath "source/.dockerignore" -Algorithm SHA256).Hash.ToLowerInvariant()
docker build --progress=plain --metadata-file $metadata `
    --label "org.opencontainers.image.revision=$revision" `
    --label "org.opencontainers.image.created=$created" `
    --label "io.journalfit.source.revision-state=working-tree" `
    --label "io.journalfit.dockerfile.sha256=$dockerfileHash" `
    --label "io.journalfit.dockerignore.sha256=$ignoreHash" `
    --tag $image "./source"
if ($LASTEXITCODE -ne 0) { throw "Build image gagal; periksa output build." }
"IMAGE=$image"
docker image inspect $image --format "{{.Id}}"
```

Hasil yang diharapkan: build exit 0, tag image baru, ID image, dan metadata JSON.
Label revision adalah baseline Git; label working-tree serta checksum menunjukkan
bahwa packaging dapat memuat perubahan lokal. Jangan menyamakan image lokal ini
dengan artifact lama bertag `3bdf305`.

### D. Jalankan pemeriksaan container

`$image` memakai hasil build bagian C. Untuk meninjau artifact pertama yang sudah
diuji, nilainya adalah `journalfit-backend:stage2-20261117t055120z-d9ab35a`.

```powershell
& "./automation/scripts/test-stage2-container.ps1" -Image $image
```

[Script pemeriksaan](../automation/scripts/test-stage2-container.ps1) menjalankan:

1. Pemeriksaan user, working directory, Node, dan filesystem image.
2. `npm test -- --test-reporter=tap` dengan tests dimount read-only dan network none.
3. Probe container melalui port host acak pada 127.0.0.1.
4. GET root/live/ready dengan database valid, lalu live/ready dengan nama database
   acak yang tidak tersedia; query hanya SELECT 1.
5. Penulisan marker volume oleh UID 10001 dan pembacaan dari container baru.
6. Penyimpanan log/JSON/TAP dalam subfolder `run-*` baru serta cleanup resource uji.

Password database diteruskan lewat environment proses; script tidak mencetak atau
menyimpan nilai tersebut. Script hanya menghapus container/volume unik yang dibuat
untuk run-nya. Image hasil build tetap tersedia untuk langkah platform berikutnya.

Hasil yang diharapkan adalah path evidence dan `Stage 2 verification: passed`.
Periksa `results.json`, bukan hanya baris ringkasan, untuk cakupan dan hasil cleanup.
Jika gagal, hasil run yang gagal tetap disimpan untuk diagnosis.

### E. Periksa build ulang berbantuan cache

Gunakan image baru dari bagian C. Command berikut mempertahankan label dan input
yang sama, membuat tag rebuild baru, lalu membandingkan layer serta konfigurasi.

```powershell
$original = @((docker image inspect $image | ConvertFrom-Json))[0]
if ($LASTEXITCODE -ne 0) { throw "Image awal tidak ditemukan." }
$rebuildImage = "$image-rebuild"
$rebuildMetadata = "evidence/platform/tahap-2/rebuild-$stamp.json"
if (@(docker image ls --quiet $rebuildImage).Count -gt 0 -or
    (Test-Path -LiteralPath $rebuildMetadata)) {
    throw "Artifact rebuild sudah ada; gunakan run build baru."
}
if ((Get-FileHash -LiteralPath "source/Dockerfile" -Algorithm SHA256).Hash.ToLowerInvariant() -ne
    $original.Config.Labels.'io.journalfit.dockerfile.sha256' -or
    (Get-FileHash -LiteralPath "source/.dockerignore" -Algorithm SHA256).Hash.ToLowerInvariant() -ne
    $original.Config.Labels.'io.journalfit.dockerignore.sha256') {
    throw "Packaging berubah setelah build awal; lakukan build baru."
}
$buildArguments = @('build', '--progress=plain', '--metadata-file', $rebuildMetadata, '--tag', $rebuildImage)
foreach ($property in $original.Config.Labels.PSObject.Properties) {
    $buildArguments += @('--label', "$($property.Name)=$($property.Value)")
}
$buildArguments += './source'
& docker @buildArguments
if ($LASTEXITCODE -ne 0) { throw "Build ulang gagal." }
$rebuilt = @((docker image inspect $rebuildImage | ConvertFrom-Json))[0]
$layersEqual = (($original.RootFS.Layers | ConvertTo-Json -Compress) -eq ($rebuilt.RootFS.Layers | ConvertTo-Json -Compress))
$configurationEqual = (($original.Config | ConvertTo-Json -Depth 10 -Compress) -eq ($rebuilt.Config | ConvertTo-Json -Depth 10 -Compress))
if (-not $layersEqual -or -not $configurationEqual) {
    throw "Layer atau konfigurasi runtime berbeda; periksa perubahan input/build."
}
"PASS: build ulang berhasil; rootfs layers dan konfigurasi runtime sama."
```

Metadata run pertama bernama `rebuild-metadata.json`. Pada hasil aktual, OCI index
berbeda karena attestation/provenance berubah meskipun layer dan konfigurasi sama.
Pengujian ini tidak menjanjikan byte identik pada seluruh build bersih/offline.

### F. Membaca hasil dan diagnosis

Hasil aktual ada di [evidence Tahap 2](../evidence/platform/tahap-2/README.md):
10 test lulus, UID/GID 10001, Node 22.23.5, health positif 200, health negatif
live 200/ready 503, serta marker volume bertahan setelah container diganti.

| Gejala | Pemeriksaan awal |
| --- | --- |
| Docker tidak dapat diakses | Periksa Docker Desktop Linux Engine dan context aktif |
| Build gagal pada dependency/APK | Baca output build, lockfile, dan koneksi registry/repository |
| Probe database gagal | Periksa container, network, database tujuan, dan hasil run; lanjutkan inventarisasi Tahap 3 |
| Izin tulis upload gagal | Cocokkan UID/GID, owner direktori, dan jenis mount |
| Test tidak ditemukan | Pastikan folder source/tests tersedia; tests tidak disalin ke image produksi |
| Tidak ada container API setelah script selesai | Probe memang sementara; lihat results.json dan log yang disimpan |

Volume Docker bukan PVC Kubernetes. Readiness SELECT 1 juga belum memeriksa tabel
atau transaksi. Pengujian DOCX nyata, resource limits, Kubernetes, dan laptop lain
tetap memiliki tahap pembuktian tersendiri.

## Tahap 3: memahami dan memeriksa lingkungan dosen

### A. Hasil dan cara membaca audit

[Evidence Tahap 3](../evidence/platform/tahap-3/README.md) mencakup lima bagian:
layanan/versi, database/schema, registry/image, network, dan cluster. Audit sudah
selesai; dependency aplikasi siap untuk review manifest Tahap 4.

Ada temuan nyata: Gitea 28.2.0 masih menampilkan Installation dan API version 404.
Karena itu status keseluruhan audit adalah `needs_attention`, sementara
`auditCompleted` dan `readyForManifestReview` bernilai true. Kesiapan manifest M3
berbeda dari kesiapan delivery M4.

### B. Command audit read-only

Prasyarat: Python 3.9+, Git, Docker, kubectl, k3d, lingkungan lab aktif, serta ZIP
paket dosen pada reference-docs. Jalankan dari root repository:

```powershell
python -B "./automation/scripts/audit-stage3-environment.py"
$auditExit = $LASTEXITCODE
if ($auditExit -eq 2) {
    "Audit selesai dengan temuan. Baca audit.json dan README evidence Tahap 3."
} elseif ($auditExit -ne 0) {
    throw "Pengumpulan audit gagal; periksa hasil run sebelum melanjutkan."
}
```

Kode 0 berarti seluruh check lulus; kode 2 berarti pengumpulan selesai dengan
temuan; kode 1 berarti audit berhenti karena error. Setiap pemanggilan membuat run
baru pada `evidence/platform/tahap-3/`. Script tidak menjalankan setup/migrasi,
restart workload, atau perubahan data bisnis. SQL dijalankan read-only, dan nilai
Secret tidak ditulis ke hasil.

### C. Ringkasan lingkungan yang perlu dipahami

| Bagian | Kondisi pada audit |
| --- | --- |
| Tools | Docker 29.7.2, Compose 5.5.0, k3d 5.9.0, server k3s 1.35.5, kubectl 1.36.1 |
| Database | PostgreSQL 17.11, database journalfit/public, enam tabel dan seluruh kolom wajib ada |
| Image | Build, registry, dan pod memakai digest yang sama |
| Docker network | capstone-net; jalur host dan jalur internal memakai alamat/port berbeda |
| Cluster | Dua node Ready, dua pod Ready, PVC Bound, Traefik/local-path tersedia |
| Delivery | Gitea butuh finalisasi instalasi; runner belum tersedia; Argo belum memiliki Application |
| Operasional | Resource metrics Kubernetes tersedia; metrik aplikasi dan profil dashboard belum siap |

Alur image: laptop push **localhost:5001**, node pull **registry:5000**. Keduanya
menuju registry yang sama. Alur data: pod mengakses PostgreSQL melalui
**host.docker.internal:5432** pada Docker Desktop Windows ini, sedangkan file DOCX
berada pada PVC melalui mount `/app/uploads`.

### D. Yang dikerjakan setelah ini

Lanjutkan **Tahap 4: review manifest satu per satu**, dimulai dari ConfigMap dan
referensi Secret, kemudian Deployment/probes/resource, Service, Ingress, serta
PVC/penempatan pod. Gunakan hasil audit ini untuk menjelaskan alasan nilainya.
Temuan Gitea tetap menjadi prasyarat delivery M4; least privilege dan instrumentasi
metrik ditindaklanjuti pada milestone yang sesuai.

## Tahap 4: memahami dan memvalidasi manifest Kubernetes

### A. Hasil review

[Evidence Tahap 4](../evidence/platform/tahap-4/README.md) mencatat 26 check lulus,
enam resource diterima server dry-run, dan tidak ada drift desired/live. File
Kustomize adalah entry point yang menyatukan resource; bukan resource workload
ketujuh yang dijalankan cluster.

| Bagian | Fungsi dan hasil yang perlu dipahami |
| --- | --- |
| ConfigMap | Enam nilai konfigurasi biasa; environment kedua pod cocok dengan nilainya |
| Secret reference | Password berasal dari object runtime journalfit-backend-secret, bukan nilai literal di manifest |
| Deployment | Menetapkan image, port, proses non-root, probes, resource, rollout, dan mount |
| Service | Alamat stabil port 80; selector memilih pod dan target named port http mengarah ke 8000 |
| Ingress | Host journalfit.localhost dan Traefik meneruskan request ke Service |
| PVC | Penyimpanan /app/uploads terpisah dari umur pod, terikat ke storage node agent |
| HPA | Mengelola replica 2-3; Deployment tidak menulis spec.replicas |

### B. Command pemeriksaan

Jalankan dari root repository saat cluster aktif. Dua command ini merender dan
memvalidasi tanpa menyimpan perubahan ke cluster:

```powershell
kubectl --context k3d-capstone kustomize ./deployment
kubectl --context k3d-capstone apply --dry-run=server -k ./deployment
```

Review lengkap yang merekam artifact baru:

```powershell
python -B "./automation/scripts/review-stage4-manifests.py"
$reviewExit = $LASTEXITCODE
if ($reviewExit -eq 2) {
    "Ada perbedaan/check yang perlu ditinjau. Baca review.json sebelum melanjutkan."
} elseif ($reviewExit -ne 0) {
    throw "Pengumpulan review gagal; periksa log dan tool yang diperlukan."
}
```

Prasyarat helper: Python 3.9+, Docker/lab yang sudah disiapkan, Git, kubectl,
cluster aktif, dan metadata build Tahap 2. Hasil disimpan di run baru pada
`evidence/platform/tahap-4/`. Kode 0 berarti check lulus; kode 2 berarti ada drift
atau check belum sesuai; kode 1 berarti proses review gagal.

Di Windows ini, native diff belum ada di PATH. Helper menemukan diff.exe pada
folder usr/bin instalasi Git lalu menambahkannya hanya ke PATH child process.
Pengaturan PATH atau Git pengguna tidak diubah. Exit 0 pada kubectl diff berarti
tidak ada perbedaan; kegagalan tool tidak boleh dianggap hasil no-drift.

### C. Probes dan resource

- Startup dan liveness memakai `/health/live`, yaitu proses HTTP.
- Readiness memakai `/health/ready`, yaitu query SELECT 1 ke database.
- Requests 100m CPU berarti 0,1 core; request RAM 128Mi. Ini baseline scheduling.
- Limits 250m CPU dan 256Mi RAM adalah batas container, bukan bukti sudah optimal.
- RollingUpdate maxUnavailable 0/maxSurge 1 membutuhkan kapasitas satu pod ekstra.

Kedua endpoint health terakses melalui Ingress, dan readiness juga terakses
melalui DNS Service dari masing-masing pod. Schema dan transaksi bisnis tetap
memerlukan pemeriksaan Tahap 5.

### D. Replica, konfigurasi, dan storage

HPA menjadi pemilik replica. Target CPU 70% dihitung dari request 100m, sekitar
70m rata-rata per pod. Source Deployment tidak menetapkan replica; live serta
server dry-run sama-sama menunjukkan 2. Kondisi ScalingLimited dapat True karena
min/max, tanpa berarti HPA gagal.

Environment ConfigMap adalah snapshot saat pod dibuat. Setelah perubahan
ConfigMap, jalur deployment perlu memperbarui pod secara terkontrol agar proses
membaca nilai baru. Apply ConfigMap saja bukan refresh environment proses.

Volume kedua pod teramati owner uid 0/gid 10001, mode 2777, dan writable oleh user
10001. Hak tulis dari Dockerfile tidak otomatis menjadi hak volume yang dimount.
Mode tersebut masih longgar; hardening permission adalah tindak lanjut security.

PVC RWO dipakai dua pod pada satu node agent. Ini mendukung penggantian pod,
bukan HA lintas node. PV reclaim policy Delete dan anotasi Argo mempunyai arti
berbeda: anotasi tidak melindungi dari penghapusan PVC manual atau kehilangan node.

### E. Handoff yang perlu dipertahankan

Namespace default dipakai konsisten untuk workload, konfigurasi, Secret, dan PVC.
Image bertag stage2 tetap diverifikasi dengan digest. Updater tim M4 menerima tag
SHA7; release pipeline berikutnya perlu konvensi versi yang selaras.

Argo Application yang disiapkan mempunyai auto-sync/prune/selfHeal, tetapi belum
aktif. Aktivasi harus memakai remote Git/revision yang benar-benar berisi desired
state yang disepakati. Review ini tidak mengaktifkan Argo atau mengubah pipeline.

Berikutnya adalah **Tahap 5: transaksi DOCX end-to-end** pada konfigurasi yang
sudah direview, dengan pemeriksaan metadata, hasil, dan file.

## Tahap 5: menguji transaksi DOCX end-to-end

### A. Hasil dan arti pengujian

[Evidence Tahap 5](../evidence/platform/tahap-5/README.md) mencatat request nyata
melalui Ingress, bukan mock. Empat DOCX menghasilkan skor sesuai 100/50/85/100.
Laporan cocok dengan record PostgreSQL, dan file yang diterima mempunyai ukuran
serta SHA-256 yang sesuai pada kedua pod.

Ada dua temuan: file TXT diterima 201 dan tersimpan, sedangkan file di atas 20 MiB
ditolak dengan 500. Karena itu status hasil tetap `needs_attention`; keberhasilan
core workflow tidak diartikan semua validasi lulus.

### B. Reproduksi

Prasyarat: Python 3.9+, Docker, kubectl, lab/schema yang tersedia, serta artifact
sesuai metadata build Tahap 2. Dari root repository:

```powershell
docker compose run --rm start-m3
if ($LASTEXITCODE -ne 0) { throw "Lingkungan M3 belum siap." }
kubectl --context k3d-capstone -n default rollout status deployment/journalfit-backend --timeout=90s
if ($LASTEXITCODE -ne 0) { throw "Workload belum stabil." }
python -B "./automation/scripts/test-stage5-transaction.py"
$testExit = $LASTEXITCODE
if ($testExit -eq 2) {
    "Pengujian selesai dengan ketidaksesuaian. Baca results.json dan handoff M2."
} elseif ($testExit -ne 0) {
    throw "Pengujian berhenti karena error; periksa hasil run sebelum melanjutkan."
}
```

Kode 0 berarti seluruh expectation lulus; kode 2 berarti test selesai dengan
ketidaksesuaian; kode 1 berarti pengujian berhenti karena error. Setiap run
menambahkan dua tenant QA unik dan data melalui API. Data tersebut dipertahankan
untuk pemeriksaan, bukan menghapus/mengganti data yang sudah ada.

Script membuat DOCX minimal valid dengan 3500, 100, dan 8500 kata. Fixture kecil
disimpan pada folder run; payload oversized 20 MiB+1 byte dibuat di memory. SQL
verifikasi menggunakan transaksi READ ONLY dan hanya membaca tenant QA run itu.

### C. Yang perlu dibuktikan

1. DOCX yang memenuhi tiga aturan MVP menghasilkan 201 dan skor 100.
2. DOCX yang kurang sesuai menghasilkan warning/skor yang benar; 201 tetap tepat
   karena transaksi pemeriksaan berhasil dibuat.
3. Report 200 mempunyai ID, tenant, skor, dan findings yang sesuai record DB.
4. File fisik berada pada path yang tercatat dan byte-nya cocok di kedua pod.
5. Input tidak lengkap/ID tidak ada/tenant mismatch memberi status yang sesuai.
6. File non-DOCX dan oversized ditolak sebagai input client yang tidak valid.

Pada run aktual, poin 1-5 lulus. Poin 6 belum lengkap: non-DOCX diterima dan error
ukuran masih 500. Batas ukuran sendiri bekerja; file oversized tidak tersimpan.

### D. Handoff dan pengujian berikutnya

[Handoff temuan aplikasi](../automation/handoff/STAGE5_APPLICATION_FINDINGS.md)
merinci F-01 validasi DOCX dan F-02 mapping LIMIT_FILE_SIZE ke respons seperti 413.
Perbaikan aplikasi memerlukan image/metadata baru dan regression run baru.
Tahap 6 kemudian menguji persistensi/reconciliation dengan fixture DOCX valid;
validasi input yang belum sesuai tetap dicatat terpisah sebagai pekerjaan M2.

## Tahap 6: persistensi dan perilaku rollout

### A. Hasil dan arti pengujian

[Evidence Tahap 6](../evidence/platform/tahap-6/README.md) mencatat 13/13 check.
Satu pod dihapus: pengganti Ready dalam 13,23 detik, pod lama hilang, dan laporan,
record PostgreSQL, serta byte file tidak berubah. Rolling update seluruh replica
selesai dalam 22,44 detik; 94 probe readiness dan 23 probe report semuanya HTTP 200.

Data demo 17 November juga masih dapat dibaca setelah lab berhenti 18 November dan
menyala lagi 21 November. Ini observasi tambahan, bukan uji shutdown atau backup
terkontrol.

### B. Reproduksi

Prasyarat sama dengan Tahap 5. Script akan menghapus satu pod dan memicu rolling
restart; jalankan hanya saat pengujian atau demonstrasi disetujui. Dari root
repository:

```powershell
docker compose run --rm start-m3
if ($LASTEXITCODE -ne 0) { throw "Lingkungan M3 belum siap." }
kubectl --context k3d-capstone -n default rollout status deployment/journalfit-backend --timeout=90s
if ($LASTEXITCODE -ne 0) { throw "Workload belum stabil." }
python -B "./automation/scripts/test-stage6-persistence-rollout.py"
$testExit = $LASTEXITCODE
if ($testExit -eq 2) {
    "Pengujian selesai dengan ketidaksesuaian. Baca results.json."
} elseif ($testExit -ne 0) {
    throw "Pengujian berhenti karena error; periksa hasil run sebelum melanjutkan."
}
```

Kode 0/2/1 sama dengan Tahap 5. Script menambahkan satu tenant QA dan fixture DOCX
baru, menghapus satu pod, lalu menjalankan `kubectl rollout restart`. Setelah
rollout, Deployment berada pada template dengan image yang sama dan annotation
`kubectl.kubernetes.io/restartedAt` baru di cluster. `kubectl apply -k` berikutnya
akan menghapus annotation itu; ini drift yang disengaja oleh skenario, bukan
perubahan manifest Git.

### C. Yang perlu dibuktikan

1. Pod pengganti menjadi Ready dan pod lama hilang tanpa intervensi manual.
2. Report, record DB, dan byte file tetap sama setelah satu pod diganti.
3. Rolling update mengganti semua UID pod dan selesai dalam batas waktu.
4. Selama rollout, request readiness/report tetap mendapat HTTP 200.
5. PVC tetap Bound dan pod baru tidak restart.

Pada run aktual, kelima poin lulus. Durasi 13,23 detik dan 22,44 detik adalah hasil
pengukuran, bukan SLO.

### D. Batasan dan langkah berikutnya

PVC RWO pada satu node belum membuktikan ketahanan node failure. Tidak ada
backup/restore, upload bersamaan selama rollout, atau penggantian image/schema.
Tahap 7 melengkapi panduan, demo, portabilitas, dan handoff. Temuan validasi input
Tahap 5 tetap terbuka untuk M2.

## Tahap 7: panduan operator, demo, dan handoff

| Kebutuhan | Jalur yang dipakai |
| --- | --- |
| Buka demo tanpa membuat naskah | `./start-presentasi.ps1` pada lab dengan laporan lama `ms-519b3203`. |
| Peragakan upload dan report | `./start-presentasi.ps1 -UploadFixture` pada lab siap; starter membuat satu naskah QA dari fixture repo, tanpa bergantung pada laporan lama. |
| Siapkan laptop Windows baru | Ikuti [prosedur setup, publikasi image, dan smoke](SETUP_LAPTOP_M3.md). |
| Siapkan presentasi | Gunakan [naskah lima menit dan tanya-jawab](../demo/PRESENTASI_PROGRESS_M3.md). |
| Serahkan ke M4 | Gunakan [kontrak artifact, dependency, dan kriteria sync pertama](../automation/handoff/M3_TO_M4.md). |

[Evidence Tahap 7](../evidence/platform/tahap-7/README.md) memuat rehearsal lokal:
readiness 200, upload 201, laporan baru 200/skor 100, dan SHA-256 cocok pada kedua
pod. Laporan lama juga terbaca. Impor schema diperiksa pada PostgreSQL terpisah;
rebuild/push serta server dry-run enam resource lulus dengan tag tersendiri.
Setup penuh pada laptop kedua dan penerimaan M4 tetap terbuka.

## Demo progress M3 (2 menit)

Bagian ini menampilkan artifact lokal dan hasil pengujian yang sudah tersimpan.
Jalankan dari root repository. Naskah penjelasannya tersedia di
[materi presentasi progress](../demo/PRESENTASI_PROGRESS_M3.md).

### 1. Inspeksi image lokal saat ini

```powershell
$image = "journalfit-backend:stage2-20261117t055120z-d9ab35a"
docker image inspect $image --format "{{.Id}} | user={{.Config.User}} | workdir={{.Config.WorkingDir}}"
```

Hasil yang diharapkan: ID sesuai evidence utama, user `10001:10001`, dan working
directory `/app`. Ini membaca konfigurasi image lokal, bukan menjalankan API.
Jika Docker belum tersedia, ringkasan rekaman pada langkah 2 dapat dibaca tanpa
daemon Docker.

### 2. Tampilkan rekaman pengujian beserta waktunya

```powershell
$run = "evidence/platform/tahap-2/run-20261117T055216Z-33df42db"
$record = Get-Content -LiteralPath (Join-Path $run "results.json") -Raw | ConvertFrom-Json
$record | Select-Object startedAt, finishedAt, status, image | Format-List
[pscustomobject]@{
    Node = $record.checks.nodeVersion
    User = $record.imageConfiguration.user
    LiveDatabaseValid = $record.checks.live.statusCode
    ReadyDatabaseValid = $record.checks.ready.statusCode
    LiveDatabaseTidakTersedia = $record.checks.liveWithoutDatabase.statusCode
    ReadyDatabaseTidakTersedia = $record.checks.unready.statusCode
    Volume = $record.checks.dockerVolume
} | Format-List
$tap = Get-Content -LiteralPath (Join-Path $run "application-tests.tap") -Raw
[regex]::Matches($tap, '(?m)^# (tests|pass|fail) \d+$') | ForEach-Object { $_.Value }
```

Hasil yang diharapkan: waktu pengujian asli 2026-11-17, status passed, Node 22.23.5,
health positif 200/200, negatif 200/503, marker volume lulus, dan 10 pass/0 fail.
Ini adalah rekaman hasil pengujian, bukan request HTTP baru saat presentasi.

## Demo langsung M3

### Starter Compose (satu command)

Dari root repository, gunakan wrapper PowerShell:

```powershell
.\start-presentasi.ps1 -BukaBrowser
```

[start-presentasi.ps1](../start-presentasi.ps1) memeriksa Docker Linux Engine,
menjalankan Compose, menampilkan node/workload/PVC, readiness, dan laporan demo,
lalu membuka browser jika `-BukaBrowser` diberikan. Tambahkan `-UploadFixture`
untuk memakai fixture yang disertakan di repo dan membuat laporan baru. Script
menemukan file Compose relatif terhadap lokasinya sendiri, sehingga juga dapat
dipanggil menggunakan path lengkap dari folder lain.

Command Compose langsung yang dipanggil wrapper adalah:

```powershell
docker compose run --rm start-m3
```

[compose.yaml](../compose.yaml) menjalankan job startup yang:

1. Memastikan lima container lab pada tabel di bawah sudah tersedia.
2. Menyalakan yang berhenti dan melewati yang sudah aktif.
3. Menunggu registry dan readiness API melalui Ingress.
4. Menampilkan `[M3 SIAP]` serta URL aplikasi.

Job menggunakan Docker CLI melalui socket daemon lokal. Network `capstone-net`,
database, dan cluster merupakan prasyarat dari setup lab. Di laptop baru, setup
tersebut perlu dilakukan terlebih dahulu. File ini memudahkan penyalaan lingkungan
yang sudah disiapkan, tanpa menyimpan kredensial database.

Exit code 0 berarti job startup selesai. Opsi `--rm` membersihkan helper; lima
container lab dan Pod tetap berjalan. Lifecycle cluster/storage dikelola melalui
prosedur lab, terpisah dari lifecycle helper Compose ini.

Pengujian saat lab sudah aktif pada 2026-11-17 lulus; timestamp lima container
tetap sama dan readiness/laporan 200. Pada 2026-11-18, sebelum Tahap 5, starter juga
berhasil menyalakan kembali kelima container yang berhenti dan membaca data demo
lama. Lihat [rekaman warm start](../evidence/platform/m3-live-20261117/compose-starter.json)
dan [observasi resume lab](../evidence/platform/tahap-5/startup-observation.json).
Ini bukan provisioning laptop baru atau restore dari backup.

Bagian ini mengacu pada [pengujian langsung baru](../evidence/platform/m3-live-20261117/README.md).
Endpoint saat ini: **http://journalfit.localhost:8088/**.

### Container yang diperlukan

| Nama container di Docker Desktop | Fungsi |
| --- | --- |
| capstone-postgres | Menyimpan metadata dan hasil pemeriksaan |
| capstone-registry | Menyediakan image yang ditarik Kubernetes |
| k3d-capstone-server-0 | Node control-plane Kubernetes |
| k3d-capstone-agent-0 | Node tempat pod aplikasi dan storage lokal berjalan |
| k3d-capstone-serverlb | Meneruskan akses host port 8088 ke Ingress |

Backend terlihat melalui `kubectl get pods`, bukan sebagai container Docker host
bernama journalfit. Container k3d-tools adalah helper. Gitea/runner, Keycloak,
Argo CD, Prometheus/Grafana memiliki peran milestone lain; bukan syarat demo API
M3 yang menggunakan source saat ini.

### 1. Perlihatkan workload dan storage

Jalankan dari root repository, saat Docker Desktop dan cluster sudah aktif.

```powershell
kubectl --context k3d-capstone get nodes
kubectl --context k3d-capstone -n default get deployment,pods,service,ingress,pvc
```

Hasil yang diharapkan: dua node Ready, deployment 2/2, pod Running/Ready, Service
dan Ingress tersedia, serta PVC Bound. Jumlah pod dapat berubah jika HPA aktif.

### 2. Buka aplikasi dan periksa readiness

Buka http://journalfit.localhost:8088/ di browser untuk identitas backend/API.
Command berikut mengirim request HTTP baru, bukan membaca rekaman.

```powershell
curl.exe --fail --silent --show-error "http://journalfit.localhost:8088/health/ready"
```

Hasil: status ready dan database connected. Antarmuka saat ini berupa API JSON.

### 3. Tampilkan laporan yang benar-benar tersimpan

```powershell
$report = curl.exe --fail --silent --show-error `
    -H "X-Tenant-ID: tenant-m3-demo" `
    "http://journalfit.localhost:8088/api/manuscripts/ms-519b3203/report" | ConvertFrom-Json
$report.data.manuscript | Format-List id, tenant_id, title, file_path
$report.data.checkResult | Format-List status, format_score
$report.data.findings | Format-Table rule_type, severity, message -Wrap
```

Ini mengambil data demo yang dibuat pada verifikasi baru. Skor 50 berasal dari
fixture panduan DOCX yang tidak memenuhi aturan jurnal; itu bukan error platform.

### 4. Jika diminta melakukan upload baru di depan dosen

Command berikut menambahkan satu naskah QA dengan DOCX sintetis 3.500 kata yang
tersedia di repo. Script membaca ID baru dari respons upload dan menampilkan
laporan yang sama. Tidak perlu menyalin file referensi dosen ke checkout.

```powershell
.\start-presentasi.ps1 -UploadFixture
```

### Reproduksi pengujian lengkap yang sudah dilakukan

Untuk merekam transaksi dan satu penggantian pod secara otomatis, helper berikut
membutuhkan Python 3. Ia menambahkan data demo, mengganti satu pod normal, dan
menyimpan hasil dalam run baru. Ini bukan command pembuka presentasi.

```powershell
python -B "./automation/scripts/test-m3-live.py" `
    --docx "reference-docs/Cloud_Computing_Common_Capstone_Infrastructure_Guide.docx" `
    --replace-one-pod
```

Hasil pertama ada pada `evidence/platform/m3-live-20261117/run-20261117T063803Z/`.
File dan laporan tetap tersedia setelah satu pod diganti; dua replica berbagi satu
node storage, sehingga hasil ini bukan ketahanan terhadap kegagalan node.
Pengukuran formal penggantian pod dan rolling update ada pada
[evidence Tahap 6](../evidence/platform/tahap-6/README.md).

## Tahap berikutnya

**Uji setup di laptop kedua dan review handoff bersama pemilik M4.** Rekam
hasil setup melalui prosedur Tahap 7. Pada M4, gunakan kriteria penerimaan agar
revision Git, digest image, dan sync dapat ditelusuri sampai pod yang melayani
request. Temuan aplikasi tetap dicatat untuk M2 pada
[indeks platform aktif](../evidence/platform/README.md).
