# Menyiapkan JournalFit M3 dari lab kosong (Windows)

Gunakan prosedur ini pada laptop Windows untuk lab M3 baru. Jika lima container
dan workload sudah tersedia, gunakan [starter demo](PANDUAN_M3.md#demo-langsung-m3).
Status pengujian prosedur ada di [evidence Tahap 7](../evidence/platform/tahap-7/README.md).

## 1. Siapkan tools dan paket dosen

- Docker Desktop mode Linux containers (baseline `linux/amd64`), Docker Compose,
  k3d, kubectl, Git, dan `curl.exe`. [Versi lab yang teruji](../evidence/platform/tahap-3/README.md#1-layanan-dan-versi).
- Checkout revision tim yang sudah memuat Dockerfile, manifest, starter, dan
  fixture sintetis repo. Gunakan PowerShell dari root checkout dan session baru.
- Ekstrak `Cloud_Computing_Common_Capstone_Infrastructure_Package.zip` dari dosen
  di luar repo. `infrastructure/docker-compose.yml`, `infrastructure/k3d/registries.yaml`
  dan `scripts/create-cluster.ps1` harus tersedia dalam folder hasil ekstrak.
- Pakai lab kosong. Pastikan nama container/cluster di bawah dan port 5432,
  5001, 6550, 8088 dan 8443 bebas. Jika sudah dipakai lab lain, diagnosis dulu;
  jangan menimpa atau mereset data lab yang sudah ada.

```powershell
$repo = (Get-Location).Path
$packagePath = Read-Host 'Path folder paket infrastruktur yang sudah diekstrak'
$package = (Resolve-Path -LiteralPath $packagePath -ErrorAction Stop).Path
$infra = Join-Path $package 'infrastructure'
$envFile = Join-Path $infra '.env'
if (Test-Path -LiteralPath $envFile) { throw 'File .env sudah ada; periksa konfigurasi lab ini.' }
Copy-Item -LiteralPath (Join-Path $infra '.env.example') -Destination $envFile -ErrorAction Stop
notepad.exe $envFile
```

Simpan nilai berikut di `.env` sebelum lanjut: `POSTGRES_DB=journalfit`,
`POSTGRES_USER=capstone`, `POSTGRES_PORT=5432`, `REGISTRY_PORT=5001`,
`K3D_CLUSTER_NAME=capstone`, `K3D_HTTP_PORT=8088`, `K3D_HTTPS_PORT=8443`. Isi
`POSTGRES_PASSWORD` dengan password lab baru yang kuat (misalnya string hex
acak), dan gunakan nilai yang sama saat membuat Secret. Nama dan port ini
harus konsisten dengan [ConfigMap](configmap.yaml), starter, dan manifest.
Simpan file `.env` di paket lokal dan jangan salin password ke evidence.

## 2. Nyalakan dependency, inisialisasi schema, dan buat cluster

Untuk M3 cukup PostgreSQL dan registry dari paket. Cluster memakai network
`capstone-net` dan registry mirror dari `infrastructure/k3d/registries.yaml`.

```powershell
$engine = docker info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0 -or $engine -ne 'linux') { throw 'Docker Linux Engine belum siap.' }
docker compose --env-file $envFile -f (Join-Path $infra 'docker-compose.yml') up -d --wait --wait-timeout 120 postgres registry
if ($LASTEXITCODE -ne 0) { throw 'Dependency lab belum siap.' }
curl.exe --noproxy '*' --fail --show-error --silent --max-time 10 'http://127.0.0.1:5001/v2/'
if ($LASTEXITCODE -ne 0) { throw 'Registry lab belum siap.' }

Get-Content -LiteralPath (Join-Path $repo 'source/schema.sql') -Raw -ErrorAction Stop |
    docker exec -i capstone-postgres psql -X -U capstone -d journalfit -v ON_ERROR_STOP=1 --single-transaction -f -
if ($LASTEXITCODE -ne 0) { throw 'Inisialisasi schema journalfit gagal.' }
docker exec capstone-postgres psql -X -U capstone -d journalfit -c '\dt public.*'
if ($LASTEXITCODE -ne 0) { throw 'Schema journalfit belum dapat diperiksa.' }

powershell -NoProfile -File (Join-Path $package 'scripts/create-cluster.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Script pembuatan cluster gagal.' }
kubectl --context k3d-capstone wait --for=condition=Ready node/k3d-capstone-server-0 node/k3d-capstone-agent-0 --timeout=120s
if ($LASTEXITCODE -ne 0) { throw 'Node cluster capstone belum siap.' }
kubectl --context k3d-capstone label node k3d-capstone-agent-0 journalfit-storage=uploads
if ($LASTEXITCODE -ne 0) { throw 'Label node upload belum terpasang.' }
kubectl --context k3d-capstone get storageclass local-path
if ($LASTEXITCODE -ne 0) { throw 'StorageClass local-path belum tersedia.' }
```

Expected: enam tabel dari `schema.sql`, dua node Ready, satu node berlabel
`journalfit-storage=uploads`, dan StorageClass `local-path`. Schema berisi seed
uji database; seed tersebut tidak memasang file DOCX atau laporan demo `ms-519b3203`.

## 3. Buat Secret di cluster baru

Masukkan password yang sama dengan `POSTGRES_PASSWORD`. Command di bawah hanya
membuat Secret jika belum ada; untuk perubahan password pada lab yang dipakai,
koordinasikan pembaruan database dan workload dengan pemilik lingkungan.

```powershell
$password = Read-Host 'POSTGRES_PASSWORD untuk lab ini' -AsSecureString
$buffer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
try {
    @{
        apiVersion = 'v1'
        kind = 'Secret'
        metadata = @{ name = 'journalfit-backend-secret'; namespace = 'default' }
        type = 'Opaque'
        stringData = @{ DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($buffer) }
    } | ConvertTo-Json -Depth 5 -Compress | kubectl --context k3d-capstone -n default create -f -
    if ($LASTEXITCODE -ne 0) { throw 'Secret gagal dibuat.' }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($buffer)
    $password.Dispose()
}
```

## 4. Build versi lokal, render, dan deploy

Build baru memiliki identitas artifact sendiri. `localhost:5001` dipakai untuk
push dari Windows; `registry:5000` dipakai oleh node k3d. Prosedur ini menyalin
manifest ke direktori temp agar tag lokal tidak mengganti baseline Git.

```powershell
$revision = git rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'Revision checkout belum tersedia.' }
$localTag = 'local-' + $revision.Substring(0, 7) + '-' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmssfff')
$pushImage = "localhost:5001/journalfit-backend:$localTag"
docker build --platform linux/amd64 --provenance=false --sbom=false `
    --label "org.opencontainers.image.revision=$revision" --tag $pushImage (Join-Path $repo 'source')
if ($LASTEXITCODE -ne 0) { throw 'Build image gagal.' }
docker push $pushImage
if ($LASTEXITCODE -ne 0) { throw 'Push image ke registry lab gagal.' }
```

Catat revision, tag, dan digest manifest dari output push. Jika build memakai
perubahan lokal, catat juga perubahannya agar revision checkout tidak disalahartikan
sebagai satu-satunya identitas source.

```powershell
$localManifests = Join-Path ([IO.Path]::GetTempPath()) "journalfit-m3-$localTag"
New-Item -ItemType Directory -Path $localManifests -ErrorAction Stop | Out-Null
Get-ChildItem -LiteralPath (Join-Path $repo 'deployment') -Filter '*.yaml' -File |
    Copy-Item -Destination $localManifests -ErrorAction Stop
$kustomization = Join-Path $localManifests 'kustomization.yaml'
$base = Get-Content -LiteralPath $kustomization -Raw -ErrorAction Stop
$tagLine = '(?m)^([ \t]*newTag:)[ \t]*[a-zA-Z0-9_.-]+[ \t]*\r?$'
if ([regex]::Matches($base, $tagLine).Count -ne 1) { throw 'Diharapkan tepat satu newTag.' }
$base -replace $tagLine, ('${1} ' + $localTag) | Set-Content -LiteralPath $kustomization -Encoding ASCII -ErrorAction Stop

$render = kubectl kustomize $localManifests
if ($LASTEXITCODE -ne 0 -or -not ($render -match "^\s*image: registry:5000/journalfit-backend:$localTag$")) {
    throw 'Render gagal atau tag image hasil render salah.'
}
kubectl --context k3d-capstone -n default apply --dry-run=server -k $localManifests
if ($LASTEXITCODE -ne 0) { throw 'Server dry-run menolak manifest.' }
```

Periksa enam resource yang ditampilkan dry-run. Kemudian terapkan render yang
sama dan tunggu rollout:

```powershell
kubectl --context k3d-capstone -n default apply -k $localManifests
if ($LASTEXITCODE -ne 0) { throw 'Apply manifest gagal.' }
kubectl --context k3d-capstone -n default rollout status deployment/journalfit-backend --timeout=180s
if ($LASTEXITCODE -ne 0) { throw 'Rollout belum selesai; gunakan tabel diagnosis.' }
kubectl --context k3d-capstone -n default get pods -l app=journalfit `
    -o 'custom-columns=NAME:.metadata.name,NODE:.spec.nodeName,IMAGE_ID:.status.containerStatuses[0].imageID'
kubectl --context k3d-capstone -n default get pvc journalfit-uploads
```

Expected: Deployment tersedia, PVC `Bound`, kedua pod memakai digest image
yang dipublikasikan dan berjalan di node storage. HPA akan mengatur jumlah
replica sesuai batasnya. Simpan `$localManifests` untuk reapply manual versi ini.

## 5. Smoke test dan evidence portabilitas

```powershell
& (Join-Path $repo 'start-presentasi.ps1') -UploadFixture
```

Expected: readiness 200/database connected, upload 201, report 200 dengan ID
yang baru dibuat, status COMPLETED, skor 100 untuk tiga aturan MVP. Catat versi
tools, revision/tag/digest, waktu, output status workload/PVC, serta ID dan hasil
request sintetis. Untuk bukti portabilitas lintas laptop, ulangi dari kondisi
kosong pada laptop kedua dan sertakan rekamannya di evidence Tahap 7. Runner
Tahap 5/6 terikat pada baseline digest tertentu; Tahap 6 juga membaca demo lama.
Jangan memakai hasil run historis itu untuk menyatakan rebuild baru sudah diuji.

## Diagnosis cepat

| Gejala | Yang diperiksa |
| --- | --- |
| Docker daemon tidak merespons | Buka Docker Desktop, tunggu Linux Engine, lalu cek `docker info`. |
| Node `NotReady` sesudah resume | Cek `kubectl --context k3d-capstone get nodes -o wide` dan `docker logs --tail 40 k3d-capstone-agent-0`; tunggu register ulang sebelum menghapus pod. |
| `ImagePullBackOff` | Cocokkan image hasil render, tag yang dipush, serta registry mirror `registry:5000`; baca event pod. |
| Pod atau PVC `Pending` | Cek label `journalfit-storage=uploads`, StorageClass dan event scheduling/provisioning. Local-path mengikat storage pada node tertentu. |
| Readiness 503 | Cek keadaan `capstone-postgres`, jalur `host.docker.internal:5432` dari pod, nama DB dan kesesuaian Secret. Readiness 200 masih perlu smoke upload untuk membuktikan schema/file dapat dipakai. |
| Health 200, upload gagal | Cek enam tabel, logs backend dan hak tulis `/app/uploads` untuk UID/GID 10001. Jangan mereset volume untuk diagnosis. |
| HTTP 404 untuk demo lama | Gunakan `-UploadFixture`; ID lama hanya tersedia pada lab yang menyimpan record demo. |
