# 01 - Business Case & Cloud Rationale

**Milestone:** M0 — Case Proposal (Bobot Rubrik: 10%)  
**Penanggung Jawab:** Anggota 1 & Seluruh Tim (Tim 7)  
**Berkas Bukti Target:** `01_evidence.jpg`

---

## 1. Masalah Bisnis & Pemangku Kepentingan
Peneliti/penulis (*Authors*) sering mengalami penolakan awal (*desk rejection*) dari pengelola jurnal (*Journal Editors*) akibat kesalahan format administratif (jumlah kata tidak sesuai standar, abstrak atau kata kunci hilang). Pengecekan manual oleh editor memakan waktu tinggi dan tidak konsisten.

**Solusi JournalFit:** Layanan *Multi-Tenant Journal Manuscript Pre-Submission Checker* di mana setiap organisasi jurnal (`tenant-a`, `tenant-b`, dst.) dapat mendefinisikan templat aturan formatnya sendiri (`format_rule_templates`), dan penulis mengunggah naskah `.docx` untuk mendapatkan skor kelayakan dan temuan format instan sebelum dikirim ke sistem review.

## 2. Mengapa Harus Arsitektur Cloud-Native?
1. **Multi-Tenancy Terisolasi:** Satu platform melayani banyak pengelola jurnal sekaligus dengan batas isolasi data per tenant (`X-Tenant-ID` & foreign key DB).
2. **Lonjakan Trafik (Burst Scalability):** Mendekati tenggat waktu publikasi jurnal (*call for papers*), volume unggahan naskah melonjak drastis; HPA Kubernetes (`min: 2, max: 3` replika) mengadaptasi kapasitas komputasi tanpa mengubah konfigurasi manual.
3. **Portabilitas Provider-Neutral:** Beban kerja dikemas sebagai container non-root standar OCI & manifest Kustomize yang dapat dipindahkan dari `k3d` lokal ke CloudStack / AWS EKS / GCP GKE tanpa ubah kode aplikasi.

## 3. Standar Evidence & Cara Mengambil `01_evidence.jpg`
- **Isi `01_evidence.jpg`:** Tangkapan layar *Lean Canvas / Problem-Solution Summary*, alur proses bisnis utama (*Upload -> Extract -> Evaluate Rules -> Report*), dan justifikasi Cloud Rationale (dapat dibuat dari ringkasan proposal di dokumen `JournalFit_Konsep_Proyek_M0_M1.docx` atau diagram alur bisnis).
