# Evidence 04: Platform & Kubernetes

Ruang lingkup: Bukti orkestrasi kontainer, konfigurasi deklaratif beban kerja, eksposur layanan via Ingress, probe kesehatan, dan alokasi sumber daya komputasi.

Penanggung jawab: Anggota 2  
Platform: Kluster k3d atau k3s pada Docker lokal  
Sumber: repositori JournalFit direktori deployment cabang milestone-per-week  

---

## 1. Ringkasan Bukti Komponen Kluster

Bukti gambar pada folder ini memvalidasi operasional workload di dalam kluster Kubernetes:

1. Beban kerja berjalan dalam status Ready dengan 2 replika pod backend aktif.
2. Keamanan runtime kontainer menggunakan pengguna non-root dengan drop seluruh kapabilitas berlebih.
3. Alokasi sumber daya CPU dan memori dibatasi secara tegas melalui batas request dan limit pada setiap pod.
4. Mekanisme probe memeriksa kesehatan aplikasi secara berkelanjutan:
   - Liveness probe melalui path `/health/live` untuk memeriksa keaktifan proses.
   - Readiness probe melalui path `/health/ready` untuk memverifikasi koneksi ke basis data PostgreSQL sebelum menerima traffic.
5. Penyimpanan berkas naskah terpasang ke Persistent Volume Claim lokal dengan mode akses ReadWriteOnce pada node penyimpanan terlabel.
6. Akses eksternal diekspos melalui Traefik Ingress Controller menuju nama host lokal.

---

## 2. Struktur Objek Manifes

Manifes dikelola terpadu menggunakan Kustomize:
- `deployment.yaml`: deklarasi pod, probe, keamanan non-root, dan volume mount.
- `service.yaml`: abstraksi jaringan internal kluster port 80 menuju port target kontainer 8000.
- `configmap.yaml`: konfigurasi environment variabel non-rahasia seperti host dan nama database.
- `pvc.yaml`: klaim penyimpanan persisten untuk direktori berkas naskah.
- `ingress.yaml`: aturan perutean domain lokal menuju service backend.
- `hpa.yaml`: penskalaan horizontal otomatis pod berbasis ambang batas beban CPU.

---

## 3. Catatan Standar Bukti

- Pengamatan: Seluruh pod berjalan stabil tanpa restart mendadak, endpoint HTTP mengembalikan status 200 OK, dan PVC terikat sempurna.
- Interpretasi: Platform cloud native telah memenuhi kriteria isolasi komputasi, elastisitas awal, dan deklarasi infrastruktur yang dapat direproduksi.
- Batasan: Pengujian dijalankan pada kluster k3d lokal laptop sebelum dipindahkan ke infrastruktur IaaS privat atau publik.
- Keputusan yang didukung: Memisahkan konfigurasi dinamis ke ConfigMap dan Secret serta mempertahankan replika minimal 2 untuk menjaga ketersediaan layanan.
