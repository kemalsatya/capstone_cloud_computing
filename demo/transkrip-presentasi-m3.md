# Transkrip Presentasi M3 JournalFit

**Pembicara:** Anggota 2 — Platform & Kubernetes Engineer.

**Durasi:** sekitar 6–8 menit termasuk perpindahan file dan demo singkat.

Teks dalam tanda kutip adalah narasi yang bisa dibacakan. Instruksi dalam kurung
siku tidak dibacakan. Angka berasal dari pengujian lokal yang sudah direkam;
bukan hasil pemeriksaan live pada saat transkrip ini dibuat. Source Dockerfile
terbaru telah berubah ke Node 22 Alpine; artifact cluster yang diuji tetap
3bdf305 (Node 24). Perbedaan versi dijelaskan pada bagian Docker, bukan disamarkan.

## 1. Pembukaan dan batas pekerjaan

[Tampilkan gambaran alur atau arahkan ke folder deployment/.]

> “Saya akan menjelaskan M3, yaitu Cloud-Native Platform. Fokus bagian ini adalah
> bagaimana backend JournalFit dikemas, dijalankan di Kubernetes, dan dibuktikan
> dapat melayani request.
>
> Backend dan skema database berasal dari Anggota 1. Pada bagian platform, kami
> menyiapkan Dockerfile, konfigurasi Kubernetes, serta pengujian operasionalnya.
> Lingkungan pengujian masih lokal menggunakan Docker Desktop dan k3d, bukan
> deployment pada cloud publik.
>
> Alur aksesnya adalah request masuk melalui Ingress, diteruskan ke Service, lalu
> ke pod JournalFit. Aplikasi menggunakan PostgreSQL untuk metadata dan laporan,
> sedangkan file DOCX disimpan pada volume persisten.”

```text
Request → Ingress → Service → Pod JournalFit
                                ├── PostgreSQL: metadata dan laporan
                                └── PVC: berkas DOCX
```

## 2. Mengemas backend dengan Docker

[Buka source/Dockerfile. Sorot FROM, npm ci, USER, EXPOSE dan CMD.]

> “Dockerfile ini adalah resep untuk membuat image aplikasi. Image merupakan
> paket aplikasi dan dependencies yang kemudian dijalankan sebagai container.
>
> Source Dockerfile terbaru memakai Node.js 22 Alpine mengikuti pembaruan kelompok,
> dengan dumb-init untuk meneruskan sinyal ke proses aplikasi. Backend tetap Express.
> Dependencies dipasang menggunakan npm ci berdasarkan lockfile, sehingga
> pemasangannya mengikuti versi yang tercatat. Dependencies pengembangan tidak
> disertakan pada image runtime.
>
> Dockerfile baru menggunakan user node dengan UID 1000, bukan root. Manifest
> Kubernetes secara eksplisit menggunakan UID 10001 dan mount upload yang dapat
> ditulis group terkait. Keduanya diuji terpisah. Artifact yang sudah berjalan
> di cluster masih versi Node 24 sebelumnya; image kandidat baru belum menggantikannya.
>
> Aplikasi berjalan pada port 8000 melalui node src/index.js. EXPOSE menunjukkan
> port container, tetapi akses dari luar tetap diatur melalui Docker atau Kubernetes.”

[Buka evidence/platform/final-source-validation-20261110.txt. Tunjukkan build sukses,
UID 1000 default image, 10 tes lulus, serta pengujian UID 10001 dengan mount sementara.]

> “Bukti ini menunjukkan proses benar-benar berjalan sebagai user non-root dan
> direktori upload dapat ditulis. Jadi, kami tidak hanya menuliskan konfigurasi
> tersebut, tetapi juga memeriksa hasilnya.”

## 3. Menjalankan aplikasi di Kubernetes

[Buka deployment/deployment.yaml. Sorot image, labels/selector dan securityContext.]

> “Deployment menyatakan kondisi aplikasi yang diinginkan di Kubernetes. Di sini
> kami menentukan image JournalFit, identitas container non-root, health probes,
> resource, dan penyimpanan.
>
> Image ditarik dari registry lokal menggunakan tag yang dapat ditelusuri ke commit
> source saat image dibangun. Label app journalfit menghubungkan pod dengan selector
> Deployment dan Service.
>
> Service menyediakan alamat internal yang tetap ketika pod diganti. Ingress
> menyediakan jalur akses melalui host journalfit.localhost, kemudian meneruskan
> request ke Service port 80 dan akhirnya ke container port 8000.”

[Tunjukkan deployment/service.yaml dan deployment/ingress.yaml secara singkat.]

## 4. Konfigurasi, kesehatan dan resource

[Buka deployment/configmap.yaml, lalu kembali ke bagian env dan probes pada Deployment.]

> “Pengaturan seperti host database, nama database dan port dipisahkan dari image
> menggunakan ConfigMap. Password diberikan melalui Secret saat runtime dan tidak
> dimasukkan ke manifest atau Git.
>
> Startup probe memberi kesempatan aplikasi menyelesaikan startup. Liveness
> memeriksa apakah proses aplikasi hidup. Readiness memeriksa apakah aplikasi siap
> menerima trafik. Pada backend ini, readiness menjalankan SELECT 1 ke PostgreSQL.
> Pemeriksaan itu membuktikan koneksi database, sedangkan kesiapan tabel dan proses
> bisnis dibuktikan melalui pengujian transaksi terpisah.
>
> Resource request ditetapkan 100 millicore CPU dan 128 mebibyte memori. Limit-nya
> 250 millicore dan 256 mebibyte. Nilai tersebut mengikuti baseline panduan eksekusi,
> belum kami klaim sebagai hasil optimasi. Request menjadi dasar penjadwalan dan
> alokasi resource, sedangkan limit membatasi pemakaian container.”

## 5. Menjaga berkas ketika pod diganti

[Buka deployment/pvc.yaml dan volumeMounts pada Deployment.]

> “File DOCX tidak cukup disimpan di filesystem sementara container. Jika pod
> diganti, file tersebut berisiko tidak tersedia pada pod baru. Karena itu, folder
> /app/uploads dihubungkan ke PVC.
>
> Kami memakai storage class local-path dengan request 1Gi. Replica berbagi volume
> pada satu node penyimpanan yang dipilih. Ini sesuai kebutuhan lab, tetapi belum
> menyediakan ketahanan terhadap kegagalan node penyimpanan.
>
> Pada uji penggantian satu pod, pod baru terbentuk dengan UID berbeda. Checksum
> DOCX sebelum dan sesudah penggantian tetap sama, dan laporan tetap dapat diambil.
> Observasi pemulihan tercatat 32,5 detik, termasuk overhead perintah pemeriksaan.
> Hasil ini membuktikan pemulihan pod dan persistensi pada skenario uji tersebut,
> bukan disaster recovery atau keberhasilan backup dan restore.”

[Tunjukkan evidence/platform/pod-replacement-persistence.txt: UID, checksum dan HTTP 200.]

## 6. Bukti aplikasi benar-benar berjalan

[Jika lingkungan sudah aktif, jalankan perintah read-only berikut dari terminal.]

```powershell
kubectl --context k3d-capstone -n default get deployment,pods,service,ingress,pvc,hpa
```

> “Di sini kita memeriksa kesiapan Deployment dan pod, jalur Service dan Ingress,
> serta status volume. Dua pod ditampilkan masing-masing satu container Ready;
> READY 1/1 per pod berbeda dari dua replica Deployment.
>
> Kami juga melakukan upload DOCX nyata sebagai fixture pengujian. Upload mendapat
> HTTP 201, kemudian laporan untuk ID naskah hasil upload mendapat HTTP 200.
> Jadi, buktinya tidak berhenti pada pod Running, tetapi sampai transaksi melalui
> Ingress dan penyimpanan data aplikasi.”

[Buka evidence/platform/application-transaction.txt dan stage-e-final-state.txt.]

Jika memilih demo health singkat:

```powershell
curl.exe -s -H "Host: journalfit.localhost" http://127.0.0.1:8088/health/ready
```

Jelaskan hasil sesuai output live. Jika lingkungan tidak aktif, gunakan evidence
bertimestamp dan sebutkan bahwa itu rekaman pengujian, bukan hasil live.

## 7. Rolling update dan scaling tambahan

[Buka evidence/platform/rolling-update-result.json: requests, failed_requests dan rollout.]

> “Untuk rolling update, kami menggunakan maxUnavailable nol dan maxSurge satu.
> Tujuannya menjaga pod tersedia saat pod pengganti mulai siap.
>
> Kami menguji pergantian ke artifact dengan metadata build berbeda, tanpa mengubah
> fitur backend. Selama pengujian, tiga worker mengirim request readiness dan laporan.
> Tercatat 777 request tanpa kegagalan yang teramati selama sekitar 31,58 detik.
> Waktu rollout tercatat 22,53 detik. Ini hasil sampling lokal, bukan jaminan tanpa
> downtime untuk setiap kondisi.”

[Buka deployment/hpa.yaml dan evidence/platform/hpa-result.json.]

> “Sebagai pengujian scaling tambahan, kami menggunakan HPA dengan target CPU
> 70 persen dari request, minimum dua dan maksimum tiga replica. Karena HPA mengatur
> jumlah pod, Deployment tidak lagi memaksakan jumlah replica tetap.
>
> Metrics API diperiksa terlebih dahulu. Setelah beban pembacaan laporan diberikan,
> replica bertambah dari dua menjadi tiga, lalu kembali dua setelah beban dihentikan.
> Jadi, bukti autoscaling berasal dari perubahan yang benar-benar diamati, bukan
> hanya keberadaan file atau objek HPA.”

## 8. Penutup dan penghubung ke M4

> “Hasil M3 adalah image aplikasi, manifest Kubernetes dan evidence pengujiannya.
> Pengujian menunjukkan aplikasi dapat dijalankan, diakses, diganti pod-nya, dan
> diskalakan pada lingkungan lab yang ditetapkan.
>
> Batasnya, penyimpanan masih pada satu node dan resource masih baseline awal.
> Deployment yang dibuktikan pada bagian ini adalah deployment manual. Konfigurasi
> ini selanjutnya menjadi dasar M4 untuk CI/CD dan GitOps yang ditangani Anggota 3.
> Instalasi Argo CD belum kami samakan dengan bukti sinkronisasi aplikasi.”

## File yang disiapkan sebelum presentasi

| Urutan | File | Fokus yang diperlihatkan |
| --- | --- | --- |
| 1 | [Dockerfile](../source/Dockerfile) | FROM, npm ci, USER dan CMD. |
| 2 | [Validasi source terbaru](../evidence/platform/final-source-validation-20261110.txt) | Node 22, UID 1000 default, tes serta pemeriksaan UID 10001/mount sementara. |
| 3 | [Deployment](../deployment/deployment.yaml) | Image, probes, resource, rollout dan volume. |
| 4 | [Service](../deployment/service.yaml) / [Ingress](../deployment/ingress.yaml) | Selector dan jalur port. |
| 5 | [ConfigMap](../deployment/configmap.yaml) | Konfigurasi non-rahasia; Secret ditunjukkan sebagai referensi pada Deployment. |
| 6 | [PVC](../deployment/pvc.yaml) | local-path, RWO dan mount. |
| 7 | [Persistensi](../evidence/platform/pod-replacement-persistence.txt) | UID berubah, checksum tetap dan report 200. |
| 8 | [Transaksi](../evidence/platform/application-transaction.txt) / [keadaan akhir](../evidence/platform/stage-e-final-state.txt) | Upload 201, report 200, dua pod Ready dan PVC Bound. |
| 9 | [Rolling update](../evidence/platform/rolling-update-result.json) | 777 request, nol gagal, durasi rollout. |
| 10 | [HPA](../deployment/hpa.yaml) / [hasil HPA](../evidence/platform/hpa-result.json) | Target dan bukti scale-up/down. |

Evidence awal memakai namespace capstone; setelah penyelarasan Anggota 3, workload
aktif dipindah ke default. Ini riwayat dua tahap pengujian. Untuk keadaan akhir
pengujian gunakan stage-e-final-state.txt. Jangan menampilkan .env, nilai Secret,
token atau password ketika presentasi.

## Jawaban singkat jika dosen bertanya

**Mengapa Express, bukan Python dalam baseline awal?**

Backend aktual Anggota 1 menggunakan Express; panduan v2 juga menyebut alternatif
Express. Container mengikuti runtime aplikasi yang tersedia. Kebutuhan non-root,
port, probes, resource dan evidence M3 tetap diterapkan.

**Mengapa perlu Kubernetes, bukan Docker saja?**

Docker menjalankan container. Kubernetes menambahkan deklarasi kondisi workload,
Service, probes, penggantian pod dan scaling. Pemilihannya juga mengikuti baseline
praktikum capstone; biaya kompleksitas dan keterbatasan lab tetap dicatat.

**Mengapa memakai dua replica? Apakah sudah high availability?**

Dua replica membantu menjaga ketersediaan saat satu pod diganti. Karena keduanya
berbagi satu node storage, belum dapat disebut high availability lintas node.

**Apa arti CPU 100m dan limit 250m?**

100m adalah 0,1 core dan 250m adalah 0,25 core CPU. Request menjadi dasar scheduler
dan alokasi saat terjadi perebutan resource; limit membatasi CPU container.
Kelebihan CPU dapat mengalami throttling, sedangkan pelampauan limit memori dapat
menyebabkan container dihentikan karena kehabisan memori.

**Mengapa memilih angka resource itu?**

Angka berasal dari baseline panduan eksekusi. Pengujian memberi data awal, tetapi
belum cukup untuk mengklaim konfigurasi paling efisien atau optimal.

**Mengapa target HPA 70 persen?**

Ini target awal lab untuk menyisakan ruang sebelum pemakaian meningkat. Persentase
dihitung terhadap request CPU 100m, sehingga 70 persen setara sekitar 70m per pod
pada perhitungan rata-rata. Belum merupakan target yang sudah dioptimasi.

**Apakah tiga replica cukup pada beban yang diuji?**

HPA terbukti melakukan scaling, tetapi CPU rata-rata sempat 249 persen dari request
dan jumlah replica dibatasi tiga. Karena itu, kami tidak menyimpulkan target CPU
atau SLO selalu terpenuhi. Pengujian kapasitas lanjutan masih diperlukan.

**Readiness 200 berarti database lengkap dan aplikasi pasti benar?**

Tidak. Endpoint sekarang menguji SELECT 1. Kelengkapan tabel dan transaksi diuji
terpisah dengan inisialisasi skema, upload DOCX dan pengambilan laporan.

**Mengapa tidak ada secret.yaml berisi password?**

Deployment hanya menyebut nama Secret dan key yang diperlukan. Nilainya disediakan
lokal saat runtime agar tidak masuk ke Git atau image. Kubernetes Secret sendiri
bukan alasan untuk mengklaim seluruh aspek keamanan sudah selesai.

**Apakah request PVC 1Gi menjamin kuota disk dan file aman selamanya?**

Tidak. Itu request storage. Batas kuota pada provisioner lokal belum dibuktikan.
PVC bertahan saat pod diganti pada skenario uji; kehilangan node atau penghapusan
storage memerlukan strategi backup/restore dan pengujian terpisah.

**Mengapa tag image 3bdf305 berbeda dari commit terbaru branch?**

Tag menelusuri commit source saat artifact dibangun. Commit berikutnya dapat berisi
manifest dan evidence tanpa mengubah backend. Revision konfigurasi dan identitas
artifact harus dicatat terpisah, bukan dianggap selalu sama.

**Apa arti nol gagal pada rolling update?**

Semua 777 request yang tercatat berhasil pada satu jendela pengujian lokal. Itu
bukan bukti bahwa tidak mungkin ada gangguan di luar request dan waktu yang diukur.
CSV tersedia sebagai rincian, dan artifact pengganti hanya berbeda metadata build.

**Apa bedanya pekerjaan Anda dan Anggota 3?**

Saya menyiapkan container, manifest dan bukti operasional Kubernetes. Anggota 3
menghubungkannya dengan pipeline dan GitOps. Menjalankan kubectl apply secara manual
bukan bukti bahwa CI/CD atau sinkronisasi Argo sudah berhasil.
