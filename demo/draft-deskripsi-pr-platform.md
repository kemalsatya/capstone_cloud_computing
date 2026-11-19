# Draft deskripsi PR platform

Status: draft lokal untuk review kelompok. Pengguna belum mengizinkan pembuatan PR.
Dokumen ini tidak membuat PR atau menyatakan perubahan sudah digabung ke main.

**Usulan judul:** Finalize M3 platform evidence and repair database readiness

## Summary

JournalFit memerlukan deployment lokal yang dapat diperiksa dan ditelusuri.
Platform dasar sudah masuk main melalui PR #5 yang digabung oleh tim.
Perubahan lanjutan memperbaiki DB_HOST setelah restart Docker Desktop dan
melengkapi portofolio M3 dengan indeks evidence, panduan demo serta batas klaim.

## Changes Included

- DB_HOST host.docker.internal untuk rute Windows yang sudah diuji.
- Artifact runtime3bdf305, indeks evidence dan batas klaim M3/M4.
- Source Dockerfile Node 22 dari pembaruan kelompok dipertahankan dan diuji kandidat;
  tidak diam-diam mengganti artifact cluster yang masih Node 24.
- Patch CI handoff diselaraskan ke Node 22; Application feature branch tetap manual.
- Ringkasan kontribusi, panduan demo, transkrip dan roadmap yang membedakan tugas selesai/tertunda.

## Verification

- Build/runtime non-root, upload writable; 10 tes aplikasi lulus pada kandidat Node 22.
- Server dry-run dan deployment manual, transaksi DOCX 201/report 200.
- Rolling update: 777 request, 0 gagal teramati;22.53 detik.
- Persistensi setelah satu pod diganti: checksum tetap sama, report 200.
- HPA 2->3->2, request pembacaan 19.865 selesai tanpa kegagalan tercatat.
- Pemulihan DNS: diagnosis503 ENOTFOUND, perbaikan ConfigMap, dua pod Ready,
  health/report 200 dan checksum DOCX tetap cocok.

## Batas dan handoff

Belum ada sinkronisasi Argo/CI end-to-end. Prefix invalid sudah diperbaiki pada
main 280a866; perintah tes main juga menjadi node --test. CI Node 20, promosi image,
rollback dan perbedaan Application manual feature branch versus auto-sync main
tetap memerlukan penyelarasan Anggota 3 sebelum penerapan.
Storage satu node bukan HA; baseline resource bukan hasil optimasi. Bukti lama
mengacu artifact Node 24, sedangkan build kandidat Node 22 belum mengganti cluster.
Reference-docs, .env, nilai Secret dan file QA sementara dikecualikan dari publikasi.
