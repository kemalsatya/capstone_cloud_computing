# ADR-004: Declarative GitOps Delivery (Argo CD) & Immutable SHA-7 Image Tags

- **Status:** Accepted
- **Tanggal:** 2026-11-10
- **Penanggung Jawab:** Anggota 3 (CI/CD & GitOps Delivery)

## Context
Memisahkan tahap integrasi kode (CI) dan tahap pengiriman ke runtime kluster (CD) agar setiap perubahan di runtime terlacak ke commit Git spesifik dan bebas dari *configuration drift*.

## Decision
1. **CI (GitHub Actions - `.github/workflows/ci.yaml`)**: Menjalankan unit test, membangun image, memindai kerentanan dengan **Trivy**, dan menandai image dengan tag immutable 7-karakter commit SHA (`<registry>/journalfit-backend:<sha7>`).
2. **CD (Argo CD - `automation/argocd/application.yaml`)**: Menggunakan pola *pull-based GitOps* memantau direktori `deployment/` dengan kebijakan `automated: prune: true, selfHeal: true` dan `ignoreDifferences` untuk `/spec/replicas` agar tidak bentrok dengan HPA.

## Alternatives Considered
1. **Push-based CD** (CI pipeline langsung memanggil `kubectl apply` ke kluster).
2. Menggunakan tag mutabel `:latest` pada manifest produksi.

## Consequences / Trade-Offs
- **Positif:**
  - Kredensial kluster K8s tidak perlu disimpan di runner CI eksternal; Argo CD di dalam kluster otomatis mengoreksi perubahan manual (*self-healing*).
  - Tag SHA-7 menjamin rollback deterministik ke versi biner yang identik persis.
- **Negatif / Batasan:**
  - Membutuhkan registry OCI lokal (`localhost:5001` / `registry:5000`) dan port forwarding saat demo lokal.
