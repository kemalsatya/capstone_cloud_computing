# Tahap 7 — panduan operasi, rehearsal demo, dan handoff

**Status: paket M3 siap direview; rehearsal lokal lulus.** Setup penuh dari
kondisi kosong pada laptop kedua dan penerimaan oleh pemilik M4 belum dilakukan.

## Ruang lingkup, pelaksana, dan versi

- Pelaksana: agen coding atas instruksi pemilik platform M3. Peninjau yang dituju:
  pemilik M3 dan M4 / Anggota 3.
- Waktu: 22 November 2026, zona `+07:00`. Rehearsal sukses sekitar 10:50 WIB;
  [observasi](observasi-rehearsal.json) memakai timestamp UTC dari API/build.
- Checkout `feat/k8s-manifests`, HEAD `d9ab35a10eab8e9c67e45bc53f8a22522846b038`
  dengan perubahan packaging lokal yang telah didokumentasikan.
- Engine 29.7.2 (`linux/x86_64`), Compose v5.5.0, k3d v5.9.0,
  kubectl v1.36.1 / Kustomize v5.8.1, k3s v1.35.5+k3s1.
- Uji live memakai image baseline Tahap 6. Rebuild dari runbook menghasilkan
  artifact terpisah; daftar tag, digest, fixture, serta checksum runner ada di
  [observasi-rehearsal.json](observasi-rehearsal.json).

## Metode dan hasil

| Pemeriksaan | Metode | Observasi |
| --- | --- | --- |
| Resume lab | Nyalakan Docker Desktop, tunggu agent k3d mendaftar kembali, lalu jalankan starter. | Pada pemeriksaan awal API Docker tidak merespons; sesudah Engine aktif, backend sempat 0/2 Ready. Kedua node akhirnya Ready, Deployment 2/2, PVC Bound. |
| Demo dengan data baru | `powershell -NoProfile -File ./start-presentasi.ps1 -UploadFixture` | Readiness **200**, upload **201**, report **200**, `ms-1f8ebbf7`, `COMPLETED`, skor **100**; Word count 3.500. |
| File fixture demo | Bandingkan SHA-256 fixture lokal (`hashlib.sha256`) dengan `sha256sum` untuk path laporan melalui `kubectl exec` pada tiap pod Ready. | Kedua pod membaca SHA-256 yang sama dengan fixture 1.127 byte, dan keduanya memakai digest baseline. |
| Mode demo lama | `powershell -NoProfile -File ./start-presentasi.ps1` | Readiness **200**, report `ms-519b3203` **200**, `COMPLETED`, skor **50**. |
| Inisialisasi schema baru | Jalankan bagian impor runbook pada container `postgres:17-alpine` sementara tanpa port/jaringan eksternal, kemudian query nama tabel. | Impor dan seed selesai; enam tabel `check_results`, `findings`, `format_rule_templates`, `manuscripts`, `tenants`, `users`. Container uji dihentikan setelah pemeriksaan. |
| Artifact dan manifest lokal | Jalankan bagian build/push, cocokkan digest manifest di registry, lalu render tag melalui salinan temp dan `apply --dry-run=server` di lab. | Build berbantuan cache dan push tag baru lulus; digest cocok, enam resource lolos dry-run. Deployment live tetap memakai digest baseline. |

Fixture didistribusikan bersama repo. Mode upload menambah satu naskah di tenant
QA baru, sehingga tidak perlu mengambil ID lama atau memakai DOCX dari paket dosen.
Pemeriksaan 104 target tautan lokal, 31 blok/script PowerShell, fingerprint
runner/fixture, serta `git diff --check` juga lulus.

### Temuan aplikasi saat rehearsal

Percobaan awal menerima HTTP 500 untuk DOCX valid: log backend menunjukkan
SQLSTATE `22001` (`value too long for type character varying(50)`) pada
`ensureDefaultRuleTemplate`. Tenant demo awal panjangnya 40 karakter, sedangkan
ID template (`tpl-` + tenant + `-default`) menjadi 52 karakter. Kolom ID template
berbatas 50. Starter kini memakai prefix lebih pendek: tenant 35 karakter, ID
template 47; rehearsal setelah perubahan berhasil. M2 dapat menindaklanjuti
kontrak panjang tenant dan pembuatan template otomatis. Dua temuan input dari
[Tahap 5](../tahap-5/README.md) juga tetap terbuka.

## Interpretasi dan keputusan

- [Panduan operator](../../../deployment/PANDUAN_M3.md#tahap-7-panduan-operator-demo-dan-handoff)
  menautkan [setup laptop](../../../deployment/SETUP_LAPTOP_M3.md),
  [materi demo](../../../demo/PRESENTASI_PROGRESS_M3.md), dan
  [handoff M3 → M4](../../../automation/handoff/M3_TO_M4.md).
- Demo bisa diulang pada lab yang sudah diprovisikan, termasuk ketika belum ada
  naskah demo lama. Setup Windows baru punya prosedur dengan bagian schema,
  publikasi artifact, dan render yang telah diujikan secara terpisah.
- **Gate berikutnya:** jalankan setup dari kondisi kosong di laptop kedua dan
  rekam smoke; minta pemilik M4 mereview handoff, lalu bukti artefak/revision dan
  sync `Synced`/`Healthy` dikumpulkan ketika delivery benar-benar dijalankan.

## Batas pemeriksaan

- Pembuatan cluster baru dari paket, koneksi workload ke DB yang baru dibuat,
  serta rollout rebuild belum dijalankan sebagai satu alur end-to-end. Dry-run
  hanya memeriksa render dan penerimaan API cluster yang sudah ada.
- Rehearsal dilakukan melalui terminal tanpa membuka browser. Skenario rollout,
  PVC, dan probe diambil dari [Tahap 6](../tahap-6/README.md), dengan batas satu
  node penyimpanan. Gitea/runner/Argo belum divalidasi ulang sebagai jalur delivery.
