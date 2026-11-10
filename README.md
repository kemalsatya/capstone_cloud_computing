# JournalFit - Capstone Cloud Computing

JournalFit membantu memeriksa format naskah DOCX sebelum submission jurnal.
Backend modular monolith menggunakan Express/Node.js dan PostgreSQL. Repository
ini memuat pekerjaan kelompok; branch feat/k8s-manifests berfokus pada platform M3.

## Mulai membaca

- [Ringkasan capaian dan batas M3](evidence/platform/RINGKASAN_M3_ANGGOTA_2.md)
- [Panduan manifest dan prasyarat deployment](deployment/README.md)
- [Kontrak integrasi dan riwayat penyesuaian](deployment/INTEGRATION_CONTRACT.md)
- [Indeks evidence aktual](evidence/platform/README.md)
- [Demo read-only dan rencana screenshot 04](demo/panduan-demo-m3.md)
- [Transkrip presentasi](demo/transkrip-presentasi-m3.md)
- [Roadmap dan status yang belum selesai](roadmap.md)

## Versi source dan artifact pengujian

| Bagian | Versi/status |
| --- | --- |
| Dockerfile source terbaru | Node 22 Alpine, USER node, dumb-init; berasal dari pembaruan kelompok 3ffb92f yang masuk feature branch melalui 2bd8428. |
| Validasi source terbaru | Build, non-root, uploads writable dan 10 tes lulus pada Node 22; UID 10001 dengan mount sementara dan health database juga diuji. |
| Artifact yang sudah diuji di Kubernetes | registry:5000/journalfit-backend:3bdf305, Node 24, runtime UID 10001. |
| Konfigurasi saat ini | Context k3d-capstone, namespace default, DB_HOST host.docker.internal pada Docker Desktop Windows. |
| Delivery M4 | Controller Argo terpasang; Application sync/Healthy/revision belum dibuktikan. Patch CI masih bahan handoff. |

Fetch terakhir menemukan main 280a866 dengan perbaikan YAML Argo dan perintah tes.
Perubahan itu direview read-only; feature branch belum menggabungkan main tersebut.

Validasi image kandidat Node 22 tidak sama dengan mengganti image cluster.
Evidence lama tetap berisi versi yang benar pada saat pengujian dilakukan.

## Menjalankan platform lokal

Gunakan Windows/PowerShell dengan Docker Desktop Linux Engine, Git, kubectl dan
k3d. Infrastruktur lab diekstrak di luar repository, misalnya C:\cloud-capstone.
Paket menyediakan PostgreSQL, registry, Gitea dan Keycloak; jangan menjalankan
bootstrap-project terhadap repository yang sudah ada karena memuat force push.

Prasyarat sebelum menerapkan manifest:

1. Cluster capstone tersedia, context k3d-capstone dapat diakses, node Ready,
   Metrics API, Traefik dan storage class local-path tersedia.
2. Node k3d-capstone-agent-0 dipilih sebagai storage node dan memiliki label
   journalfit-storage=uploads. Replica berbagi PVC pada node itu.
3. Database journalfit tersedia dengan enam tabel dari source/schema.sql.
   Jangan menghapus atau menginisialisasi ulang database yang sudah berisi data.
4. Secret journalfit-backend-secret dengan key DB_PASSWORD disediakan lokal pada
   namespace default. Nilai sebenarnya tidak disimpan di Git, log atau image.
5. Artifact image telah dipublikasikan ke registry. Push host memakai localhost:5001;
   cluster menarik image dari registry:5000. Tag Kustomize harus menunjuk artifact yang ada.

Contoh build artifact baru dari root repository:

```powershell
$tag = (git rev-parse --short=7 HEAD).Trim()
docker build -t "localhost:5001/journalfit-backend:$tag" ./source
docker push "localhost:5001/journalfit-backend:$tag"
```

Sesuaikan images[].newTag pada deployment/kustomization.yaml melalui perubahan
yang direview. Build/push tidak otomatis mengganti tag manifest atau workload.
Perintah berikut untuk deployment manual awal; setelah Argo mengelola aplikasi,
perubahan mengikuti satu sumber Git yang disepakati bersama Anggota 3.

```powershell
kubectl --context k3d-capstone apply --dry-run=server -k ./deployment
kubectl --context k3d-capstone apply -k ./deployment
kubectl --context k3d-capstone -n default get deployment,pods,service,ingress,pvc,hpa
curl.exe -sS -H "Host: journalfit.localhost" http://127.0.0.1:8088/health/ready
```

Ini prosedur yang dirangkai dari langkah yang sudah diuji, bukan klaim bahwa seluruh
setup telah diulang dari nol pada laptop lain. Resource adalah baseline awal;
storage lokal satu node bukan high availability lintas node. PDF latihan presentasi,
reference-docs, .env dan file QA sementara bukan bagian source runtime.

## Kolaborasi

Tidak ada direct commit ke main atau force push. Gunakan feature branch, review,
dan izin pengguna sebelum publikasi. Saat ini pengguna mengizinkan commit/push
feature branch, tetapi belum mengizinkan pembuatan PR. Dokumentasi draft PR tidak
berarti PR sudah dibuat atau perubahan sudah diterima anggota lain.
