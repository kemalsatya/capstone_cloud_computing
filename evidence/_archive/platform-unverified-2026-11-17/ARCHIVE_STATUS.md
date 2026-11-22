# Status arsip platform: belum diverifikasi ulang

**Tanggal pengarsipan:** 2026-11-17. Tanggal ini adalah tanggal penataan arsip,
bukan tanggal pengujian aplikasi atau Kubernetes.

## Asal dan cakupan

- Asal: seluruh isi lama `evidence/platform/`, termasuk README, ringkasan,
  log, JSON, JSONL, CSV, `.gitkeep`, dan subfolder `scripts/`.
- Baseline Git saat pengarsipan: branch `feat/k8s-manifests`, HEAD
  `d9ab35a10eab8e9c67e45bc53f8a22522846b038`.
- Inventaris: **48 file asli**, total **273.265 byte**. Angka ini tidak termasuk
  `ARCHIVE_STATUS.md` dan `SHA256SUMS.txt` yang ditambahkan sebagai metadata arsip.
- Penataan dilakukan atas permintaan pemilik pekerjaan M3, dibantu agen coding.

## Arti status

Keabsahan hasil, metode, kesimpulan, dan kesesuaiannya dengan kondisi sekarang
belum diverifikasi ulang. Pernyataan seperti "lulus", "Ready", "terverifikasi",
atau "selesai" di dalam file asli tetap merupakan isi rekaman lama, bukan status
aktif M3. Status ini tidak menyatakan bahwa semua rekaman tersebut salah.

README dan script asli dipertahankan sebagai bagian arsip. Path serta tautan di
dalamnya dapat mengacu pada lokasi dan lingkungan lama. Script tersebut perlu
ditinjau sebelum digunakan kembali.

## Pemeriksaan integritas pengarsipan

1. Inventaris diambil dari file tracked dan untracked yang tidak diabaikan Git
   pada path sumber, lalu dicocokkan dengan daftar file sebelum pemindahan.
2. SHA-256, ukuran, dan waktu modifikasi setiap file dicatat sebelum folder
   dipindahkan.
3. Folder dipindahkan melalui rename direktori pada filesystem yang sama.
4. Setelah pemindahan, seluruh 48 file memiliki SHA-256, ukuran, dan waktu
   modifikasi yang sama dengan sebelum pemindahan.
5. [SHA256SUMS.txt](SHA256SUMS.txt) menyimpan checksum sebelum pemindahan, dengan
   path relatif terhadap folder arsip ini.

Aturan `.gitattributes` menonaktifkan konversi line ending khusus pada
`evidence/_archive/`. Ini menjaga byte arsip saat nanti disimpan dan di-checkout
melalui Git, termasuk pada laptop dengan `core.autocrlf=true`.

Hasil pemeriksaan tersebut membuktikan integritas pemindahan file. Hasilnya tidak
membuktikan kebenaran pengujian aplikasi, kondisi cluster, autentikasi, persistensi,
rollout, scaling, CI/CD, atau recovery yang disebut dalam rekaman lama.

## Penggunaan berikutnya

Gunakan arsip sebagai bahan penelusuran. Pengujian baru menggunakan source,
konfigurasi, versi image, lingkungan, dan waktu aktual, kemudian dicatat melalui
[indeks platform aktif](../../platform/README.md). Isi serta timestamp rekaman lama
tidak diubah menjadi hasil pengujian baru.
