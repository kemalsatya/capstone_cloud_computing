# Integrasi delivery JournalFit

Status: persiapan D.8 untuk review. Bukti sinkronisasi dari GitHub belum direkam;
publikasi branch platform adalah prasyarat sebelum sync diuji. Tidak ada push/PR/merge otomatis oleh dokumen ini.

## Dasar dan kepemilikan

Anggota 3 memiliki workflow dan delivery. File Application di automation/argocd/
diadaptasi dari branch chore/cicd-gitops-pipeline commit cf78b0d. Penyesuaian memakai
namespace default, sumber GitHub aplikasi, path deployment/ dan tag SHA7. Tidak
melakukan merge branch tersebut atau mengganti workflow aktif anggota lain.

Patch member3-ci-compatibility.patch ditujukan pada dua workflow dalam branch itu.
Perubahan: Node24 sesuai runtime yang sudah diuji, npm ci tanpa fallback, build
strict memakai source/Dockerfile yang sekarang tersedia. Workflow Gitea hanya
publish saat push main; push/scan failure tidak disamarkan sebagai sukses. Scan
vulnerability tetap reporting gate exit0, terpisah dari kegagalan alat.

Patch diuji terhadap salinan file pada commit cf78b0d, bukan dianggap CI run sukses.
Patch baru diterapkan anggota terkait setelah branch workflow tersedia dalam checkout
yang sesuai. Backend dan package.json tidak diubah.

## Sumber Git dan urutan handoff

1. Review dan commit perubahan lokal platform/evidence. Reference-docs dan .env tidak masuk.
2. Setelah izin pengguna, push feat/k8s-manifests. Application sementara membaca branch
   itu agar dapat diuji sebelum PR digabung. Repository dan path sama dengan Anggota 3.
3. Setelah branch benar-benar tersedia di GitHub, apply Application dengan auto-sync
   tetap disabled. Periksa status comparison dan revision yang dibaca.
4. Sinkronkan revision yang telah direview, tanpa prune awal. Buktikan Synced/Healthy,
   revision Git, image/digest runtime, readiness, report dan checksum DOCX.
5. Uji drift yang aman, misalnya annotation Deployment, lalu kembalikan lewat sync.
   Jangan memakai penghapusan PVC/namespace untuk menguji self-healing Argo.
6. Setelah PR disetujui dan digabung, ubah targetRevision ke main/HEAD. Anggota 3
   mengaktifkan automated selfHeal setelah desired state cocok dan evidence tersedia.

Application tidak berada dalam deployment/kustomization.yaml: Application dipasang
oleh operator, sedangkan Argo hanya merekonsiliasi enam resource workload. Tidak
membuat dua Application/sumber Git yang mengelola objek yang sama.

## HPA, data dan rollback

Deployment tidak menyatakan spec.replicas. Application mengabaikan /spec/replicas
dengan RespectIgnoreDifferences=true. Ini masih harus diuji bersama Argo yang aktif;
hasil reapply kubectl sebelumnya bukan bukti integrasi Argo/HPA.

PVC diberi Prune=false,Delete=false agar penghapusan resource oleh Argo tidak
memusnahkan dokumen uji. Ini tidak menggantikan backup/restore. Auto-sync/prune
belum diaktifkan selama source branch belum tersedia dan belum direview.

Rollback GitOps mengubah referensi image di Git melalui feature branch/PR, lalu sync
revision tersebut. Skrip rollout undo Anggota 3 tidak dipakai sebagai rollback
permanen saat selfHeal aktif, karena controller akan kembali mengikuti Git.

## Pembaruan image dan batas pipeline

Workflow GitHub hosted runner hanya test/build/scan. Registry localhost laptop
tidak dapat dipush dari runner hosted tersebut. Publication dilakukan runner Gitea
lokal yang mempunyai akses ke registry.

Sesudah publish berhasil, prepare-image-update.sh memverifikasi manifest image ada
di registry dan menyiapkan perubahan newTag. Script tidak melakukan commit/push
atau mengubah Kubernetes. Anggota 3 memasukkan perubahan melalui feature branch/PR
sesuai aturan kelompok, lalu Argo membaca revision yang sudah direview.

Membuat image di registry saja tidak mengubah desired state. Source Gitea yang
berbeda dari GitHub juga tidak otomatis tersinkron. Tim perlu menetapkan mirror atau
handoff source; jangan mengklaim delivery end-to-end sebelum revision dan artifact
yang sama terbukti dari CI sampai pod.

Pemakaian repo aplikasi sebagai sumber Argo mengikuti instruksi pengguna/Anggota 3,
namun berbeda dari pemisahan app/GitOps repo pada Infrastructure Guide. Perbedaan
ini tetap perlu direview kelompok; tidak diklaim sudah memenuhi pemisahan tersebut.

Referensi: [Argo CD sync options](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-options/)
dan [getting started](https://argo-cd.readthedocs.io/en/stable/getting_started/).
