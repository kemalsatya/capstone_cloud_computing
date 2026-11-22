# ADR-009: Centralized Keycloak OIDC Authentication, Tenant Claims & Cross-Tenant Response Policy

- **Status:** Accepted
- **Tanggal:** 2026-11-20
- **Penanggung Jawab:** Anggota 1 (Auth Middleware & Schema), Anggota 2 (Keycloak K8s Deployment), Anggota 3 (E2E & CI Integration)

## Context
Pada tahap awal MVP, autentikasi mengandalkan header `X-Tenant-ID` dan endpoint mock token (`/api/auth/token`). Pendekatan ini rentan terhadap *spoofing* header di lingkungan produksi publik, tidak memvalidasi tanda tangan kriptografis, dan tidak memisahkan siklus hidup identitas pengguna dari aplikasi bisnis. Sistem membutuhkan Identity Provider (IdP) terpusat berbasis OpenID Connect (OIDC) yang mampu membawa identitas tenant dan role pengguna secara aman tanpa membebani basis data aplikasi dengan manajemen password.

## Decision
1. **Adopsi Keycloak sebagai OIDC Identity Provider:**
   - Menjalankan Keycloak dengan realm `journalfit`, client `journalfit-app` (public client, password grant untuk demo/testing), dan audience `journalfit-api`.
   - Menggunakan database terpisah `keycloak` pada PostgreSQL bersama untuk menjaga konsistensi state IdP.
2. **Kriptografi & Verifikasi JWT Berbasis JWKS Ter-cache:**
   - Backend Express (`AUTH_MODE=jwt`) memvalidasi access token JWT menggunakan algoritma RS256 dan JWKS publik yang di-cache di memori aplikasi (`KEYCLOAK_JWKS_URI`).
   - Memisahkan konfigurasi `KEYCLOAK_ISSUER` (URL eksternal `http://keycloak.localhost:8088/...`) dan `KEYCLOAK_JWKS_URI` (URL internal kluster `http://keycloak.default.svc.cluster.local/...`) untuk menjamin resolusi DNS antar-pod di Kubernetes.
3. **Ekstraksi Tenant & Role dari Token:**
   - Tenant diambil secara eksklusif dari claim `tenant_id` pada JWT (dipetakan lewat Keycloak Protocol Mapper).
   - Header `X-Tenant-ID` diabaikan sepenuhnya pada mode `jwt` untuk mencegah pemalsuan konteks organisasi.
   - Role dibaca dari claim `realm_access.roles` (`author`, `editor`, `tenant_admin`).
4. **Kebijakan Respons Keamanan (PRD A-03):**
   - Akses lintas-tenant atau naskah milik author lain di tenant yang sama dijawab **`404 NOT_FOUND`** (mencegah *information leakage* mengenai eksistensi naskah).
   - Akses dengan role yang tidak memiliki wewenang dijawab **`403 FORBIDDEN`**.
   - Request tanpa token atau token tidak valid/kedaluwarsa dijawab **`401 UNAUTHENTICATED`**.
5. **Just-In-Time (JIT) User Provisioning:**
   - User pertama kali yang login secara otomatis di-provision ke tabel `users` berdasarkan claim `sub` dan `tenant_id`. Konflik tenant pada `keycloak_sub` yang sama ditolak dengan HTTP `403`.

## Alternatives Considered
1. **Header-only / Mock Auth (`X-Tenant-ID`):** Sangat ringan tetapi tidak memiliki bukti verifikasi kriptografis dan tidak memenuhi standar keamanan cloud modern.
2. **SaaS IdP Eksternal (Auth0 / AWS Cognito):** Memerlukan akses internet publik keluar dari kluster lab lokal k3d dan menimbulkan biaya operasional berbayar.
3. **Merespons `403 Forbidden` untuk Akses Lintas-Tenant:** Standar umum, namun membocorkan fakta bahwa ID naskah tersebut benar-benar ada di dalam sistem (ancaman *resource enumeration*).

## Consequences / Trade-Offs
- **Positif:**
  - Isolasi tenant terbukti secara kriptografis melalui token yang ditandatangani RS256.
  - Zero-trust: header manual yang dipalsukan diabaikan secara deterministik.
  - Sesuai dengan rujukan arsitektur resmi perkuliahan Cloud Computing.
- **Negatif / Batasan:**
  - Pod Keycloak membutuhkan alokasi memori tambahan (reservasi `512Mi`, limit `1Gi`, utilisasi terukur `~596 MiB`) dan waktu *cold-start* sekitar 72 detik.
  - Manifest deployment Keycloak diatur ke mode `Recreate` (1 replika) untuk menghindari konflik penulisan konkuren ke database `keycloak`.
