# ADR-003: Lightweight Kubernetes (`k3d`) & Hardened Non-Root Container (`UID 10001`)

- **Status:** Accepted
- **Tanggal:** 2026-11-10
- **Penanggung Jawab:** Anggota 2 (Platform & Kubernetes)

## Context
Aplikasi harus dideploy secara deklaratif di Kubernetes dengan kontrol keamanan kontainer yang ketat, namun harus mampu berjalan stabil bersama komponen observability & GitOps pada lingkungan Docker Desktop Windows.

## Decision
1. Menggunakan **`k3d` (k3s in Docker)** dengan Traefik Ingress bawaan dan Metrics Server untuk HPA.
2. Membangun container berbasis `node:22-alpine` dengan **`dumb-init`** sebagai PID 1 (graceful `SIGTERM` shutdown) dan berjalan sebagai non-root user (`USER node` / Kubernetes `runAsUser: 10001`, `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`, `automountServiceAccountToken: false`).

## Alternatives Considered
1. **Minikube / Kind** atau VM Kubernetes penuh.
2. **Container image standar Ubuntu/Debian (`node:22`) berjalan sebagai `root`**.

## Consequences / Trade-Offs
- **Positif:**
  - Startup kluster `k3d` di bawah 30 detik dan jejak image sangat kecil (~276 MB dengan Alpine), meminimalkan CVE OS pada hasil scan Trivy.
  - Apabila terjadi celah RCE di aplikasi Node.js, penyerang tidak memiliki hak `root` maupun kapabilitas kernel Linux (`CAP_SYS_ADMIN`, dll.).
- **Negatif / Batasan:**
  - Dalam mode lab lokal Windows, kluster `k3d` berkomunikasi ke database host Docker Compose lewat DNS `host.docker.internal` (tercatat pada `deployment/configmap.yaml`). Saat migrasi ke IaaS nyata, `DB_HOST` diganti ke service StatefulSet/Managed RDS.
