# ADR-006: Runtime Secret Separation & Trivy Vulnerability Scan Gate

- **Status:** Accepted
- **Tanggal:** 2026-11-10
- **Penanggung Jawab:** Anggota 4 (Security, Ops & Recovery) & Anggota 3 (CI/CD)

## Context
Kredensial database (`DB_PASSWORD`), token akses, dan artefak build berisiko bocor jika ditanam di Git atau manifest Deployment, serta image base OS dapat memiliki kerentanan CVE kritis.

## Decision
1. **Pemisahan Konfigurasi & Secret:** Parameter non-sensitif diletakkan di `deployment/configmap.yaml`, sedangkan `DB_PASSWORD` disuntikkan melalui Kubernetes Secret (`secretKeyRef: journalfit-backend-secret`) dan `.env` lokal di-block oleh `.gitignore` (hanya `.env.example` yang masuk ke Git).
2. **Pemindaian Otomatis:** Pipeline CI menjalankan `aquasecurity/trivy-action` (`vuln-type: os,library`, `severity: CRITICAL,HIGH`) dan hasilnya ditinjau dengan interpretasi berbasis risiko.

## Alternatives Considered
1. Menyimpan nilai default `DB_PASSWORD` langsung di `configmap.yaml` atau `deployment.yaml`.
2. Menggunakan External Secrets Operator / HashiCorp Vault di lingkungan lokal laptop.

## Consequences / Trade-Offs
- **Positif:**
  - Nol kredensial produksi di repositori Git; audit repo dengan `git grep` bersih dari kebocoran password nyata.
- **Negatif / Batasan:**
  - Secret di kluster `k3d` saat ini masih dibuat secara imperatif pada tahap inisialisasi (`create-cluster.sh` / preflight).
  - Endpoint `/api/auth/token` saat ini menghasilkan mock JWT ringan untuk keperluan demo alur role (`author`/`editor`/`admin`) dan isolasi `X-Tenant-ID`, belum terintegrasi dengan Keycloak/OIDC penuh.
