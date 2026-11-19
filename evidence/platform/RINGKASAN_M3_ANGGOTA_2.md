# Ringkasan Kontribusi M3 Anggota 2

**Pemilik domain:** Anggota 2, Platform & Kubernetes Engineer.

**Lingkungan:** Windows 11, Docker Desktop/WSL2, k3d/k3s lokal. Pengujian direkam
2026-11-09 dan 2026-11-10 dengan bantuan Codex; file, perintah dan output aktual
disimpan agar dapat dipelajari dan diperiksa. Pemahaman serta refleksi individu
tetap perlu dilengkapi mahasiswa berdasarkan pengalamannya sendiri.

## Target dan capaian

Guideline halaman 8 menyebut target M3: container, Kubernetes, konfigurasi, probes
dan resource, dengan pertanyaan apakah workload dapat dideploy berulang dan diperiksa.
Halaman 5 meminta Dockerfile/build/version evidence serta manifest, running workload
dan service proof. Rubrik halaman 10 memberi bobot 15% pada deployment/Kubernetes.

| Target | Hasil terverifikasi | Evidence utama |
| --- | --- | --- |
| Container | Image dapat dibangun; non-root dan izin upload diperiksa. | docker-build.txt, docker-runtime.txt, final-source-validation-20261110.txt |
| Kubernetes | Cluster capstone 1 server/1 agent; workload dua pod Ready. | cluster-api.txt, application-deployment.txt, readiness-dns-recovery-20261110.txt |
| Service exposure | Service/Ingress bekerja; health dan laporan HTTP 200. | application-transaction.txt, readiness-dns-recovery-20261110.txt |
| Config/probes/resources | ConfigMap, referensi Secret, startup/liveness/readiness, requests 100m/128Mi dan limits 250m/256Mi. | deployment/*.yaml, deployment-prerequisites.txt |
| Rollout/scaling | 777 request, 0 gagal teramati; rollout 22.53s. HPA 2->3->2 pada beban baca. | rolling-update-result.json, hpa-result.json, hpa-timeline.jsonl |
| Persistensi/pod recovery | UID pod berganti, SHA256 DOCX tetap sama, report 200; observasi 32.5s. | pod-replacement-persistence.txt |
| Troubleshooting | DNS host.k3d.internal hilang setelah restart, readiness 503; DB_HOST diganti setelah koneksi dan data diverifikasi. | readiness-dns-recovery-20261110.txt |

Angka pada log bertimestamp adalah hasil pengujian saat itu. Foto pengumpulan perlu
menunjukkan apakah output live atau rekaman lama, bukan mengganti timestamp evidence.

## Source terbaru berbeda dari artifact runtime

| Aspek | Source yang baru diterima | Artifact Kubernetes yang sudah diuji |
| --- | --- | --- |
| Asal | 3ffb92f, tersinkron melalui merge remote 2bd8428 | commit source 3bdf305 |
| Base/runtime | node:22-alpine; Node 22.23.4 pada validasi kandidat | Node 24.22.2 pada pengujian runtime |
| User image | node, UID/GID 1000 | appuser, UID/GID 10001 |
| User Kubernetes | Manifest tetap runAsUser/runAsGroup/fsGroup10001 | UID 10001 telah diverifikasi pada pod |
| Status | Build dan 10 tes lulus; health serta mount sementara dengan UID 10001 lulus | Sudah deploy, transaksi, rollout, HPA dan persistensi diuji |

Candidate Node 22 tidak dipublikasikan sebagai tag3bdf305 dan tidak mengganti workload.
Tag lama tidak ditimpa untuk artifact berbeda. Uji kandidat menutup pemeriksaan
Dockerfile yang berubah, bukan mengulang seluruh evidence Kubernetes pada Node 22.
Jika image Node 22 nanti dipromosikan, gunakan tag source yang benar dan uji rollout/
probes/volume terdampak; jangan mengubah label versi pada evidence lama.

## Keputusan dan batas

- Resource mengikuti panduan eksekusi; belum dibuktikan optimal melalui rightsizing.
- PVC local-path RWO dipakai replica pada satu node storage; bukan HA lintas node.
- CPU HPA 70% dihitung dari request; beban sempat 249% dan dibatasi maksimum 3 replica.
  Keberhasilan scaling tidak berarti target CPU/SLO selalu terpenuhi.
- Artifact rolling update berbeda metadata build, tanpa perubahan fitur backend.
  Nol kegagalan hanya berlaku pada 777 request yang disampling pada run tersebut.
- Readiness memakai SELECT 1; skema dan transaksi diverifikasi secara terpisah.
- Secret runtime tidak masuk Git. Review security lengkap, tenant tests dan restore
  tetap domain Anggota 4; hasil mereka tidak diklaim sebagai hasil pengujian Anggota 2.
- Pemakaian repo aplikasi sebagai sumber Argo mengikuti keputusan pengguna/Anggota 3,
  berbeda dari pemisahan repo pada Infrastructure Guide; tetap perlu review kelompok.

## Handoff yang belum selesai

Controller Argo terpasang, tetapi belum ada Application sync/revision/Healthy yang
diverifikasi. D.8.4/D.8.5 dan delivery end-to-end tetap terbuka sebagai pekerjaan M4.
Temuan prefix YAML Argo pada commit Anggota 3 5b63bc1 telah diperbaiki oleh tim
melalui a9d5993, masuk main 280a866. YAML main berhasil diparse saat review akhir;
perintah tes main juga diperbaiki menjadi node --test melalui a8923ea.
Feature branch ini belum menggabungkan main terbaru; workflow dan patch perlu
penyelarasan saat handoff. Tidak ada perubahan pada branch anggota lain.

Branch security menyediakan rekaman tenant 403 dan restore. Dokumen ini hanya
mereview keberadaan/isinya; tidak memvalidasi ulang run tersebut atau menyatakan
backup dokumen lengkap. Lihat final-integration-review-20261110.txt.

## Penyelesaian F dan pengumpulan

Indeks evidence, ringkasan kontribusi, panduan demo dan draft deskripsi PR telah
disiapkan. Draft PR tidak diterbitkan. Ambil screenshot 04_evidence.jpg dari output
asli mengikuti panduan demo; foto belum dibuat atau dikumpulkan oleh tahap ini.
M3 platform lokal terverifikasi; keseluruhan roadmap tidak ditandai SELESAI SEMUA
selama handoff M4/Argo dan review lintas anggota masih terbuka.
