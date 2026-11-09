# Evidence platform JournalFit

Pemilik pekerjaan: Anggota 2, Platform & Kubernetes Engineer. Pengujian dilakukan
pada 2026-11-09 (Asia/Jakarta), dari commit aplikasi `747c958` dan perubahan platform
yang belum di-commit pada branch `feat/k8s-manifests`. Timestamp aktual ada di log.

## Pengujian yang sudah dilakukan

| File | Metode dan hasil | Batas bukti |
| --- | --- | --- |
| `lab-preflight.txt` | Doctor paket dosen exit 0, inventaris container dan context lama. | Doctor tidak memeriksa seluruh konflik port. |
| `legacy-lab-stop.txt` | 15 container lab lama dihentikan, restart policy `no`; port yang bentrok tidak lagi memiliki listener. | Container/volume tidak dihapus; restart Docker Desktop belum diuji. |
| `compose-validation.txt` | `.env` lokal dibuat di luar Git; `docker compose config --quiet` exit 0. | Validasi konfigurasi saja. |
| `core-services.txt` | Compose menyalakan Gitea, PostgreSQL, Keycloak dan registry, exit 0. | Log unduhan/startup; bukan bukti kesiapan seluruh layanan. |
| `core-health.txt` | PostgreSQL healthy dan pg_isready exit 0; registry, Gitea dan OIDC realm Keycloak HTTP 200. | Keycloak perlu waktu startup; percobaan awal gagal dan pengulangan tercatat. |
| `docker-build.txt` | Build `journalfit-backend:platform-dev` exit 0; digest hasil build tercatat. | Build lokal, belum dipublikasikan ke registry atau dideploy ke Kubernetes. |
| `docker-runtime.txt` | UID/GID 10001, uploads writable, liveness dan readiness HTTP 200. | Memakai database lab yang ada tanpa perubahan skema. Bukan pengujian transaksi atau persistensi file. |
| `application-tests-container.txt` | `npm test` dalam image, 10 lulus dan 0 gagal; tests dipasang read-only. | Sebagian pengujian memakai mock. Tidak menggantikan uji tenant dengan database nyata. |
| `integration-audit.txt` | Inventaris database read-only: journalfit belum tersedia, keenam tabel belum ada pada database lab. | Bukan migrasi atau bukti kesiapan skema aplikasi. |

## Interpretasi dan keputusan

Tahap persiapan dan pengujian dasar Docker sudah selesai. Pengguna menyetujui
Node.js/Express yang ada di main sebagai runtime; Dockerfile menggunakan
`node:24-bookworm-slim` dan dependencies dari lockfile. Direktori uploads dimiliki
appuser, sedangkan konfigurasi database diberikan saat runtime. Build context
hanya memasukkan package.json, package-lock.json dan src; .env tidak dikirim.

CI Anggota 3 perlu menggunakan build context `source/`, misalnya
`docker build -t <image>:<commit-sha> ./source`. Tag `platform-dev` hanya untuk
pengujian lokal, bukan tag rilis. Pemilihan database aplikasi, penyimpanan DOCX,
repository GitOps dan konfigurasi deployment ditetapkan sementara di
`deployment/INTEGRATION_CONTRACT.md` sesuai instruksi pengguna. Perbedaan branch
CI/CD `cf78b0d` dicatat untuk penyelarasan sebelum integrasi; baseline sementara
bukan persetujuan seluruh kelompok atau bukti database/storage/GitOps siap.

Container uji runtime menggunakan `--rm` dan sudah dihentikan. Empat layanan inti
lab masih berjalan. Belum ada cluster capstone baru, pengujian HPA, rolling update,
self-healing JournalFit, atau klaim tanpa downtime.

Log awal PowerShell memiliki campuran encoding UTF-8/UTF-16LE dari Tee-Object.
Encoding telah dinormalisasi ke UTF-8 tanpa mengubah observasi. Pesan progress
Docker pada stderr dapat dibungkus sebagai NativeCommandError oleh PowerShell;
nilai exit code dan hasil verifikasi layanan dicatat terpisah.
