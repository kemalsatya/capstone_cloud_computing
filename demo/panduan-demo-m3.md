# Panduan Demo dan Screenshot M3

Jalankan dari root repository dengan Docker Desktop dan cluster capstone aktif.
Semua perintah berikut read-only. Tidak perlu menghapus pod atau menjalankan load
test lagi saat mengambil screenshot. Periksa hasil sebenarnya sebelum memberi caption.

## Workload dan jalur layanan

```powershell
Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'
kubectl --context k3d-capstone get nodes
kubectl --context k3d-capstone -n default get deployment,pods,service,ingress,pvc,hpa
```

Simpan screenshot yang terbaca sebagai 04_01_cluster-workload.jpg. Node harus Ready,
pod aplikasi Ready, dan PVC Bound. Running saja tidak berarti siap menerima trafik.

## Health melalui Ingress

```powershell
$headers = @{ Host = 'journalfit.localhost' }
foreach ($path in '/health/live', '/health/ready') {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8088$path" -Headers $headers
    "$path | HTTP $($r.StatusCode) | $($r.Content)"
}
```

Simpan sebagai 04_02_health.jpg. Endpoint ready memeriksa koneksi PostgreSQL; bukan
seluruh proses bisnis. Jika 503, baca pesan dan simpan kondisi gagal sebagai troubleshooting.

## Identitas dan resource

```powershell
$pod = kubectl --context k3d-capstone -n default get pods -l app=journalfit -o name | Select-Object -First 1
kubectl --context k3d-capstone -n default exec $pod -- id
$d = kubectl --context k3d-capstone -n default get deployment journalfit-backend -o json | ConvertFrom-Json
$c = $d.spec.template.spec.containers[0]
$c.resources | ConvertTo-Json -Depth 3
$c.livenessProbe.httpGet
$c.readinessProbe.httpGet
```

Simpan sebagai 04_03_nonroot-resources-probes.jpg, atau beberapa gambar jika satu
gambar terlalu padat. Jangan menampilkan isi Secret/.env atau token. UID pod10001
berasal dari manifest; Dockerfile source baru default-nya USER node/UID 1000.

## Bukti tersimpan

```powershell
$r = Get-Content evidence/platform/rolling-update-result.json -Raw | ConvertFrom-Json
$r | Select-Object timestamp, requests, failed_requests, traffic_seconds
$r.rollout | Select-Object exit_code, seconds
$h = Get-Content evidence/platform/hpa-result.json -Raw | ConvertFrom-Json
$h | Select-Object timestamp, observed_scale_up, observed_scale_down
```

Sebutkan bahwa ini rekaman pengujian, bukan pengulangan live. Bukti raw request ada
pada CSV dan timeline HPA. Untuk pemulihan DNS terbaru gunakan
evidence/platform/readiness-dns-recovery-20261110.txt; stage-e-final-state.txt
merekam kondisi sebelum masalah DNS setelah restart ditemukan.

## Paket 04-platform-kubernetes

Jika dosen hanya menerima 04_evidence.jpg, pilih panel workload, health dan
probes/resource yang tetap terbaca. Gabungkan hanya screenshot asli, bukan teks
keberhasilan buatan. Gunakan Save as JPEG; mengganti ekstensi PNG tidak mengubah format.
README pengumpulan menjelaskan scope, pemilik, timestamp, source/version, metode,
observasi, interpretasi dan keterbatasan. File foto pengumpulan tidak dibuat oleh
panduan ini dan belum dianggap sudah diserahkan.
