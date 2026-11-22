# Menjalankan ulang pengujian platform

Jalankan dari root repository menggunakan Python dengan akses Docker/kubeconfig.
Script memutasi workload lab context k3d-capstone, namespace default; jangan
menjalankannya pada cluster lain. Tidak ada credential dalam script.

## Rolling update

`python -B evidence/platform/scripts/test_rolling_update.py`

Prasyarat: registry dan aplikasi sehat, artifact pengganti pada
rolling-update-image.json sudah dibangun/dipublikasikan, serta ID transaksi pada
application-transaction.json valid. Script mengubah referensi image pada manifest,
apply Kustomize dan mengirim tiga worker HTTP dengan jeda 100ms. CSV mencatat status,
latensi dan error setiap request; JSON mencatat perintah rollout dan identitas pod.
Perubahan script/parameter atau pengulangan harus memakai nama output baru agar
evidence run sebelumnya tidak tertimpa. Script default menulis ulang output run.

Pada run pertama HPA belum aktif. Jika mengulang setelah HPA aktif, catat bahwa
jumlah replica ikut dipengaruhi HPA dan jangan membandingkan hasil tanpa konteks.
Pod yang sedang terminating dapat masih muncul pada snapshot sesaat setelah rollout.

## HPA

`python -B evidence/platform/scripts/test_hpa.py`

Prasyarat: HPA aktif, Metrics API tersedia, aplikasi baseline dua replica, tidak ada
controller Argo yang berkonflik. Script membuat pod beban terpisah pada node server
dan 64 worker melakukan GET report pada Service aplikasi. Tidak ada upload/SQL tulis.
Beban berhenti otomatis maksimum 180 detik, atau dihentikan setelah tiga replica Ready
teramati dan setidaknya 60 detik observasi beban. Statistik menghitung request yang
selesai; request masih in-flight saat proses berhenti tidak dihitung.

Snapshot HPA, metrik CPU, jumlah pod dan kondisi controller dicatat tiap sekitar
10 detik. Setelah beban berhenti, script mengamati scale-down maksimum 180 detik dan
menyimpan log sebelum menghapus pod beban miliknya. Durasi scale_up_seconds pada
hasil run pertama mencakup masa observasi minimum, bukan latensi reaksi HPA murni.
Gunakan timeline untuk melihat kapan perubahan replica pertama kali teramati.

Script gagal jika scale-up dan scale-down tidak teramati; keberadaan objek HPA saja
bukan bukti autoscaling. Jika gagal, periksa evidence sebelum mengubah target/beban.
