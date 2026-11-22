# Serah terima platform JournalFit: M3 → M4

**Status:** paket handoff siap direview. Penerimaan oleh pemilik M4 dan bukti
CI/CD end-to-end masih terbuka. Baseline M3 adalah deployment manual di lab Windows.

## Yang diserahkan

| Komponen | Kontrak yang dipakai M4 |
| --- | --- |
| Source dan build | `source/` sebagai konteks build; gunakan [Dockerfile](../../source/Dockerfile), Node 22, `npm ci`, dan tes aplikasi. Catat commit yang benar-benar dibuild. Runtime backend UID/GID 10001, port 8000. |
| Artifact baseline | Tag `stage2-20261117t055120z-d9ab35a`, digest `sha256:9aa3893aa1a763fb818af769e98db305c4afcbd34e5685231e571783e4d91557`. Source baseline `d9ab35a10eab8e9c67e45bc53f8a22522846b038` ditambah perubahan packaging; [metadata build](../../evidence/platform/tahap-2/build-metadata.json) mencatatnya. |
| Registry | Runner lab push ke `localhost:5001`; cluster pull dari `registry:5000`. Tag baru dibuat per revision/build dan digest registry dibandingkan dengan imageID pod. Runner hosted tidak dapat memakai `localhost` laptop. |
| Desired state | [Kustomize `deployment/`](../../deployment/kustomization.yaml) menghasilkan enam resource di `default`. Update `images[].newTag` dalam perubahan Git yang direview; nilai efektif adalah hasil render. |
| Dependency | PostgreSQL `journalfit` dengan enam tabel, Secret `journalfit-backend-secret` key `DB_PASSWORD`, label node `journalfit-storage=uploads`, PVC `journalfit-uploads` RWO local-path. Secret disediakan di luar Git. |
| Verifikasi | [Setup dan smoke](../../deployment/SETUP_LAPTOP_M3.md), [kontrak aplikasi](../../deployment/INTEGRATION_CONTRACT.md), [transaksi Tahap 5](../../evidence/platform/tahap-5/README.md), dan [rollout Tahap 6](../../evidence/platform/tahap-6/README.md). |

## Kriteria penerimaan pertama oleh M4

1. **Source dan runner:** pastikan Gitea selesai diinisialisasi, runner lokal
   terdaftar/online, dan runner mengakses registry. Sepakati sumber Git untuk CI
   dan Argo, serta cara penyelarasan revision sebelum menguji delivery.
2. **Build dan publikasi:** rekam job test/build/scan/push yang benar-benar berjalan,
   source revision, tag, dan digest. Update `newTag` dengan tag yang sudah dipush,
   lalu periksa render pada revision desired state yang akan disinkronkan.
3. **Sync pertama:** pakai revision yang sudah direview/dapat diakses. Tinjau
   [contoh Application](../argocd/application.yaml): contoh saat ini menunjuk
   `HEAD` dan memuat auto-sync, prune, serta selfHeal. Untuk sync pertama, siapkan
   konfigurasi manual dengan revision eksplisit dan tanpa auto-sync/prune;
   periksa diff sebelum sync dan hindari dua Application yang mengelola objek
   yang sama. Rekam revision serta status `Synced`/`Healthy`.
4. **Verifikasi hasil:** cocokkan digest pod dengan manifest registry; pastikan
   readiness HTTP 200, upload DOCX sintetis HTTP 201 dan report HTTP 200 dengan ID
   yang sama, serta cocokkan checksum file pada pod dengan fixture. Simpan waktu,
   output aktual, dan batas pengujian tanpa Secret/token.
5. **Kepemilikan:** biarkan HPA mengelola replica (min 2, max 3). Uji bahwa sync
   tidak menimpa replica dan tidak menghapus PVC. PVC memiliki `Prune=false,Delete=false`,
   tetapi masih bergantung pada storage lokal; untuk rollback GitOps, revisi tag
   kembali ke artifact yang tercatat di Git, lalu sync revision rollback.

## Tindak lanjut tim

| Pemilik | Gate yang masih terbuka |
| --- | --- |
| M3 + operator laptop kedua | Jalankan setup dari kondisi kosong dan simpan versi, output, serta hasil smoke portabilitas. |
| M4 / Anggota 3 | Validasi Gitea/runner dan GitOps live. Audit Tahap 3 menemukan Gitea masih pada Installation, runner belum tersedia, dan belum ada Argo Application; periksa ulang di awal M4. |
| M2 | [Dua temuan input Tahap 5](STAGE5_APPLICATION_FINDINGS.md) masih terbuka. Rehearsal Tahap 7 juga menemukan batas ID template otomatis; rincian ada di [evidence Tahap 7](../../evidence/platform/tahap-7/README.md). |
| M5/M6 | Metrik aplikasi, role DB least-privilege, dan penguatan izin storage sesuai [audit lab](../../evidence/platform/tahap-3/README.md). Load/HA dan backup/restore mempunyai uji terpisah. |

[D.8](D8_INTEGRATION.md) tetap tersedia untuk riwayat usulan integrasi; cocokkan
dengan checkout aktual sebelum mengambil perubahan workflow dari catatan lama.
