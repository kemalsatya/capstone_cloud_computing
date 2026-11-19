# Evidence platform JournalFit

Pemilik pekerjaan: Anggota 2, Platform & Kubernetes Engineer. Pengujian berlangsung
pada 2026-11-09 dan 2026-11-10 (Asia/Jakarta). Source aplikasi awal `747c958`,
artifact bertag source `3bdf305`, dan perubahan platform ditelusuri melalui branch
`feat/k8s-manifests`. Timestamp serta revisi setiap pengujian dicatat pada log terkait.

## Dokumen pengantar F

- [Ringkasan capaian M3 dan versi source/runtime](RINGKASAN_M3_ANGGOTA_2.md)
- [Panduan demo dan screenshot](../../demo/panduan-demo-m3.md)
- [Draft deskripsi PR, belum diterbitkan](../../demo/draft-deskripsi-pr-platform.md)

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
| `manifest-validation.txt` | Kustomize merender enam resource; pemeriksaan statis selector, port, konfigurasi, referensi Secret/volume dan baseline resource lulus. | Belum ada validasi API server, apply atau pengujian runtime Kubernetes. |
| `cluster-setup.txt` / `cluster-api.txt` | Cluster capstone baru terbentuk; endpoint API Windows dikoreksi ke localhost; dua node Ready. | Percobaan endpoint awal gagal dan dihentikan; hanya cluster baru yang dikoreksi. |
| `deployment-prerequisites.txt` | Namespace, label node storage dan Secret runtime dibuat; server dry-run enam resource lulus. | Nilai Secret tidak dicetak; workload aplikasi belum diterapkan. |
| `registry-image.txt` | Build/push tag 3bdf305d106c berhasil, digest dan OCI revision tercatat. | Percobaan format metadata awal gagal; verifikasi ulang melalui parsing JSON berhasil. |
| `registry-smoke-test.txt` | Smoke image paket dosen dipublikasikan, ditarik cluster dan melayani Ingress HTTP 200. | Request awal belum siap; hasil pengulangan tercatat. Tidak membuktikan kesehatan JournalFit. |
| `cluster-image-network.txt` | Probe non-root UID 10001 menarik image aplikasi dengan digest cocok dan berhasil koneksi TCP PostgreSQL. | Tidak autentikasi/SQL; bukan health probe atau transaksi backend. |
| `database-gate.txt` | Snapshot sebelum inisialisasi: journalfit belum tersedia dan pengguna saat itu meminta menunggu Anggota 1. | Status historis; lihat database-initialization.txt dan application-deployment.txt untuk kondisi berikutnya. |
| `database-initialization.txt` | Setelah pengguna mengizinkan, journalfit dibuat dan schema.sql diterapkan dalam transaksi; enam tabel/seed terverifikasi, hash SQL sama. | Menggantikan status tertunda pada database-gate.txt; bukan perubahan desain skema. |
| `application-deployment.txt` | Apply Kustomize dan rollout berhasil; dua pod Ready, PVC Bound, Service/Ingress tersedia. | Deployment manual awal, belum melalui Argo CD. |
| `application-transaction.txt` / `.json` | Health 200, upload DOCX referensi asli 201 dan report 200 melalui Ingress; ID/path/checksum tersimpan. | Fixture panduan lokal, bukan bukti seluruh variasi DOCX atau authorization lengkap. |
| `pod-replacement-persistence.txt` | Dua replica memiliki checksum DOCX sama; satu pod diganti normal, UID baru, dua Ready, report tetap 200; observasi 32.5 detik. | Termasuk overhead polling, tanpa pengukuran trafik kontinu, node failure atau backup/restore. |
| `member3-alignment.txt` | Namespace default, tag SHA7 dan sumber GitHub diselaraskan; DOCX disalin dengan checksum cocok dan health/report tetap 200. | PVC lama dipertahankan, replica lama nol; kegagalan metadata tar awal tercatat. Belum aktivasi Argo. |
| `member3-node20-compatibility.txt` | npm test Node 20 gagal menemukan glob; 10 tes lulus dengan path eksplisit. | Ini diagnosis lokal, bukan run CI sukses; package.json/pipeline tidak diubah. |
| `rolling-update-image.txt` / `.json` | Artifact metadata-only bertag uji dibangun dan dipush sebelum rollout. | Backend tidak berubah; bukan rilis fitur baru atau tag SHA source baru. |
| `rolling-update-requests.csv` / `rolling-update-result.json` | 777 request, 0 gagal teramati, durasi 31.58s; rollout 22.53s, p95 latensi 26.73ms. | Sampling readiness/report satu run lokal; tidak menjamin tanpa downtime universal. |
| `metrics-api-preflight.txt` / `hpa-setup.txt` | Metrics API tersedia, metrik pod terbaca, HPA CPU 70% min 2/max 3 diaktifkan. | Baseline lab, belum hasil rightsizing atau optimasi. |
| `hpa-replica-ownership.txt` | Reapply Kustomize saat tiga replica tetap mempertahankan tiga. | Manual apply saja; integrasi Argo CD belum diuji. |
| `hpa-timeline.jsonl` / `hpa-result.json` / `hpa-load-generator.txt` | Beban 64 worker membaca report; 19.865 request selesai tanpa kegagalan; HPA 2->3->2. | Scale dibatasi 3, CPU sempat 249% dari request; bukan bukti target CPU/SLO terpenuhi pada beban tersebut. |
| `stage-e-final-state.txt` | Catatan pengembalian artifact ke SHA7 normal dan pemeriksaan akhir. | Cleanup lab, bukan bukti rollback pipeline Anggota 3. |
| `argocd-installation.txt` | Argo CD v3.5.6 dari manifest resmi pinned dipasang; controller dan komponen utama Ready. | Instalasi controller saja, bukan sync aplikasi. |
| `delivery-preflight.txt` | Application server dry-run lulus, branch belum dipublikasikan; helper menerima tag valid dan menolak tag invalid tanpa perubahan. | Application belum diterapkan; tidak ada credential atau push. |
| `delivery-validation.txt` | Patch CI cf78b0d dapat diterapkan pada salinan terisolasi; YAML/shell dan konfigurasi Application/HPA/PVC konsisten. | Static checks, bukan run CI atau delivery end-to-end. |
| `readiness-dns-recovery-20261110.txt` | Diagnosis readiness 503 ENOTFOUND setelah restart; DB_HOST disesuaikan ke host.docker.internal yang terbukti terhubung ke database. | Perbaikan rute Docker Desktop Windows, bukan migrasi database atau uji DR. Lihat hasil akhir pada log yang sama. |

| `final-source-validation-20261110.txt` | Source Node 22 baru dibangun; non-root default 1000, 10 tes, serta UID 10001/mount sementara dan health 200 lulus. | Kandidat Docker lokal, belum mengganti artifact Kubernetes Node 24. |
| `final-integration-review-20261110.txt` | Review refs terbaru, temuan YAML Argo, serta keberadaan evidence anggota lain. | Review teknis, bukan persetujuan pemilik branch atau pengujian ulang security/restore. |
| `final-platform-snapshot-20261110.txt` | Kondisi workload dan health/laporan akhir untuk penutupan dokumentasi F. | Snapshot bertimestamp, bukan jaminan kondisi selamanya atau sync GitOps. |

## Interpretasi dan keputusan

Tahap persiapan dan pengujian dasar Docker sudah selesai. Pengguna menyetujui
Node.js/Express sebagai runtime. Uji awal memakai Dockerfile node:24-bookworm-slim.
Source terbaru dari kelompok memakai Node 22 Alpine; build/tes kandidat dilakukan
terpisah dan tidak dipakai untuk melabeli ulang evidence lama. Direktori uploads dimiliki
appuser, sedangkan konfigurasi database diberikan saat runtime. Build context
pada awal hanya memasukkan package.json, package-lock.json dan src. Tambahan
aturan dari kelompok mengizinkan .env.example sebagai contoh; .env aktual tetap
dikecualikan dan Dockerfile tidak menyalinnya ke image.

CI Anggota 3 perlu menggunakan build context `source/`, misalnya
`docker build -t <image>:<commit-sha> ./source`. Tag `platform-dev` hanya untuk
pengujian lokal, bukan tag rilis. Pemilihan database aplikasi, penyimpanan DOCX,
repository GitOps dan konfigurasi deployment ditetapkan sementara di
`deployment/INTEGRATION_CONTRACT.md` sesuai instruksi pengguna. Perbedaan branch
CI/CD `cf78b0d` dicatat untuk penyelarasan sebelum integrasi; baseline sementara
bukan persetujuan seluruh kelompok atau bukti database/storage/GitOps siap.

Container uji Docker menggunakan `--rm` dan sudah dihentikan. Empat layanan inti
lab masih berjalan. Cluster capstone baru dan smoke workload tersedia; probe pod
platform berstatus Completed. Database aplikasi telah diinisialisasi atas izin pengguna;
Deployment JournalFit memiliki dua pod Ready dan PVC Bound. Satu penggantian pod
normal sudah diuji beserta persistensi file dan akses laporan. Workload aktif sekarang
di default; workload capstone lama nol replica dengan PVC tetap disimpan. Rolling
update artifact metadata dan HPA sudah diuji. Controller Argo CD sudah dipasang,
tetapi Application belum disinkronkan. Pada preflight D.8 branch source masih lokal; tidak ada klaim
perubahan fitur aplikasi, high availability lintas node atau tanpa downtime universal.

Log awal PowerShell memiliki campuran encoding UTF-8/UTF-16LE dari Tee-Object.
Encoding telah dinormalisasi ke UTF-8 tanpa mengubah observasi. Pesan progress
Docker pada stderr dapat dibungkus sebagai NativeCommandError oleh PowerShell;
nilai exit code dan hasil verifikasi layanan dicatat terpisah.
