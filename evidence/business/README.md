# 01 - Business Case & Cloud Rationale

**Milestone:** M0 — Case Proposal (Bobot Rubrik: 10%)  
**Penanggung Jawab:** Anggota 1 & Seluruh Tim (Tim 7)  
**Berkas Bukti Target:** `01_evidence.jpg`

---

## 1. Standar Evidence (Guideline 2 Section 9)

| Field | Detail |
| :--- | :--- |
| **Scope** | Justifikasi masalah bisnis akademik (*desk rejection* dan inefisiensi editorial), analisis pemangku kepentingan (*Authors*, *Journal Editors*, *Publishers*), alur transaksi utama (*core business workflow*), justifikasi adopsi karakteristik komputasi awan, evaluasi alternatif solusi yang ditolak, serta penetapan indikator keberhasilan (*success criteria*). |
| **Owner** | Anggota 1 (Penyusunan use-case, entity model, & alur bisnis naskah) didukung seluruh anggota Tim 7 (Penilaian kelaikan cloud-native & keselarasan rubrik capstone). |
| **Source / Version** | `JournalFit_Konsep_Proyek_M0_M1.docx`, `PRD_JournalFit_v0.1.md`, `source/src/modules/manuscripts/`, `decisions/ADR-001` s.d. `ADR-009`. |
| **Timestamp** | Proposal M0: 2026-11-09 \| Pemutakhiran baseline M2: 2026-11-22 |
| **Method** | Analisis kebutuhan domain penerbitan ilmiah, pemodelan proses bisnis (*BPMN/flow chart*), studi komparasi kelayakan platform (*SaaS vs Single-Tenant VM vs Cloud-Native Multi-Tenant*), serta pengujian transaksi naskah nyata pada lingkungan k3d. |
| **Observation** | Lebih dari 30% naskah jurnal mengalami *desk rejection* hanya karena format administratif yang tidak sesuai panduan; editor membuang waktu 20–40 menit per naskah untuk cek manual; lonjakan naskah terjadi secara ekstrem (puncak beban hingga 10x) menjelang *deadline call-for-papers*. Solusi cloud multi-tenant memangkas waktu verifikasi menjadi `< 50 ms` dengan biaya operasional `$0.001125 / pemeriksaan` tanpa lisensi AI berbayar di v1. |
| **Interpretation** | Beban kerja JournalFit sangat memenuhi kriteria *cloud-suitable* (bukan sekadar *hosted*) karena membutuhkan elastisitas penskalaan instan (*HPA autoscaling*), persistensi berkas terisolasi antar-organisasi jurnal (*multi-tenancy*), dan model biaya berbasis penggunaan yang efisien (*FinOps*). |
| **Limitation** | Pada v1 (Milestone 2 baseline), analisis naskah difokuskan pada pemeriksaan aturan deterministik berbasis kode (`WORD_COUNT`, `ABSTRACT_CHECK`, `KEYWORDS_CHECK`) via library `mammoth`. Fitur AI Scope Recommender dan antrean asynchronous (`pg-boss`) dicatat secara jujur sebagai *roadmap v2* untuk menjaga keandalan pengujian baseline lab. |
| **Decision Supported** | Mendukung **ADR-001** (Modular Monolith Express 5), **ADR-002** (Multi-Tenancy PostgreSQL), **ADR-008** (Deterministic Rule Engine pre-check), dan **ADR-009** (Keycloak OIDC Single Sign-On). |

---

## 2. Masalah Bisnis, Pemangku Kepentingan & Solusi

### A. Masalah Bisnis (The Core Problem)
Dalam ekosistem publikasi ilmiah, proses peer-review sering terhambat oleh masalah administratif:
1. **Tingginya Angka Desk Rejection Administratif:** Penulis sering ditolak langsung (*desk-rejected*) oleh pengelola jurnal hanya karena naskah tidak mematuhi panduan format baku (*Author Guidelines*), seperti jumlah kata melampaui batas, format abstrak tidak lengkap, atau kata kunci tidak sesuai standar.
2. **Beban Kerja Editor yang Tidak Efisien:** Editor jurnal menghabiskan 20–40 menit per naskah hanya untuk memeriksa kepatuhan tata letak secara manual sebelum mengirimkannya ke reviewer substansi.
3. **Siklus Umpan Balik yang Lambat:** Penulis baru mengetahui kesalahan format setelah berminggu-minggu naskah mengantre di meja editorial jurnal.

### B. Pemangku Kepentingan (Stakeholders)
- **Penulis (Author):** Mengunggah naskah awal berbentuk `.docx` untuk mendapatkan audit kepatuhan format instan, skor kesiapan (*readiness score*), serta daftar perbaikan spesifik sebelum submit resmi ke sistem jurnal.
- **Pengelola / Editor Jurnal (Editor):** Mendapatkan naskah yang sudah tersaring rapi dan dapat mengonfigurasi aturan format unik untuk jurnal masing-masing (*format rule templates*).
- **Admin Tenant / Institusi:** Mengelola hak akses tim editorial dan memantau volume naskah di bawah lembaganya.
- **Admin Platform:** Mengawasi kesehatan operasional kluster, SLO performa, dan efisiensi biaya infrastruktur.

### C. Alur Kerja Inti (Core Business Transaction Workflow)
```text
  [Penulis] -> 1. Login Keycloak (OIDC) -> Ambil Bearer JWT (claim: tenant_id, role: author)
            -> 2. POST /api/manuscripts/upload (.docx + header Authorization)
                 ├── Simpan berkas ke PVC /app/uploads
                 ├── Parser mammoth mengekstrak teks, kata, & metadata
                 ├── Evaluasi aturan format terhadap database template tenant
                 └── Hitung format_score (0-100) & simpan daftar temuan (findings)
            -> 3. GET /api/manuscripts/{id}/report -> Laporan audit format instan (< 50 ms)
            -> 4. Unduh temuan -> Penulis memperbaiki dokumen -> Unggah ulang (revisi)
```

---

## 3. Mengapa Harus Komputasi Awan (Cloud-Native Rationale)?

Sesuai rubrik Capstone, JournalFit bukan sekadar aplikasi web biasa yang di-*hosting*, melainkan memanfaatkan atribut komputasi awan esensial:

1. **Elastisitas & Penskalaan Otomatis (Rapid Elasticity via HPA):**
   - Beban kerja jurnal bersifat *bursty*: trafik sangat tenang di awal bulan, lalu melonjak drastis (hingga 10x) pada 48 jam menjelang *submission deadline* konferensi/jurnal.
   - Menggunakan Kubernetes Horizontal Pod Autoscaler (HPA `min: 2, max: 3` pods @ CPU 70%), sistem menambah kapasitas komputasi secara dinamis saat konversi `.docx` memuncak dan merampingkan kembali saat sepi tanpa intervensi manual admin.
2. **Multi-Tenancy Terisolasi (Resource Pooling & Tenant Isolation):**
   - Melayani banyak pengelola jurnal independen (`tenant-a`, `tenant-b`) di atas satu kluster bersama.
   - Efisiensi biaya tercapai melalui *pooled compute & database*, sementara keamanan data terjamin secara kriptografis melalui claim `tenant_id` Keycloak JWT dan validasi query PostgreSQL (`404` lintas-tenant).
3. **Portabilitas Provider-Neutral (No Cloud Lock-In):**
   - Aplikasi dikemas sebagai container OCI non-root (`UID 10001`) dan dideploy menggunakan manifest Kustomize deklaratif standar.
   - Dapat dijalankan secara identik di kluster `k3d` lokal, Apache CloudStack internal kampus, maupun public cloud managed K8s (AWS EKS, GCP GKE) tanpa mengubah baris kode aplikasi.
4. **Keandalan & Self-Healing Tanpa Henti (Fault Tolerance):**
   - Pod yang crash otomatis digantikan oleh Kubernetes ReplicaSet dalam ~32 detik dengan *zero-downtime rolling update* (`maxUnavailable: 0`), sementara berkas naskah tetap utuh pada PersistentVolumeClaim (PVC).
5. **Ekonomi FinOps yang Terukur (Measured Service):**
   - Pada v1, evaluasi format berbasis *rule engine* deterministik lokal memangkas biaya API eksternal menjadi **$0** (Rp 0).
   - Biaya infrastruktur per pemeriksaan sangat rendah (**$0.001125 / naskah**), memungkinkan layanan disediakan secara gratis atau terjangkau bagi sivitas akademika.

---

## 4. Evaluasi Solusi Alternatif yang Ditolak

| Solusi yang Dipertimbangkan | Alasan Ditolak | Keputusan Terpilih |
| :--- | :--- | :--- |
| **Microservices Terpisah (Auth, Upload, Rule, Report Services)** | Menghabiskan RAM berlebih (>1.5 GB hanya untuk service overhead) dan memperumit tracing jaringan di kluster lab. | **Modular Monolith Express 5 (ADR-001):** 1 service terstruktur rapi, hemat RAM (~128 MiB per pod), tetap siap diekstraksi jika skala bertambah. |
| **Kirim Seluruh Teks DOCX ke LLM (GPT-4o)** | Biaya API sangat mahal (~$0.05 per cek = $2.500/bulan) dan latensi tinggi (5–15 detik) hanya untuk mengecek batas kata dan keberadaan heading. | **Hybrid Deterministic Pre-Check (ADR-008):** Evaluasi format 100% lokal via kode (latensi <50 ms, $0 AI cost). LLM hanya direncanakan pada v2 untuk analisis abstrak terbatas. |
| **Dedicated Database per Tenant** | Biaya infrastruktur membengkak (puluhan instance DB) dan pemeliharaan migrasi skema lambat. | **Shared PostgreSQL with Discriminator Column (ADR-002):** 1 database terpadu dengan isolasi kolom `tenant_id` dan indexing teroptimasi. |

---

## 5. Ringkasan Visual untuk `01_evidence.jpg`
Tata letak panel gambar bukti `01_evidence.jpg`:
- **Panel 1 (Atas/Kiri):** Ringkasan Masalah Bisnis (*Problem & Solution Overview*) + Profil Pengguna (*Authors vs Editors*).
- **Panel 2 (Tengah):** Diagram Alur Transaksi Naskah (*Core Transaction Lifecycle: Auth -> Upload -> Extract -> Rule Check -> Report*).
- **Panel 3 (Bawah/Kanan):** 5 Pilar Cloud Rationale (Elastisitas HPA, Multi-Tenancy, Portabilitas OCI, Fault Tolerance, FinOps $0 AI).
