# ADR-002: PostgreSQL 17 & Logical Multi-Tenancy (`tenant_id` Isolation)

- **Status:** Accepted
- **Tanggal:** 2026-11-09
- **Penanggung Jawab:** Anggota 1 (Application & Data)

## Context
Guideline mewajibkan aplikasi bersifat *multi-tenant* atau memiliki isolasi penyewa yang terbukti melalui *negative isolation test* (Section 7.1). JournalFit melayani lebih dari satu pengelola jurnal (`tenant-a`, `tenant-b`) dengan template aturan format dan daftar naskah masing-masing.

## Decision
Mengimplementasikan **Option A (Implemented Tenancy)** dengan pola *Shared Database, Shared Schema, Logical Isolation* pada **PostgreSQL 17**. Setiap entitas inti (`users`, `format_rule_templates`, `manuscripts`) memiliki foreign key `tenant_id` merujuk ke `tenants(id)` (`source/schema.sql`), serta ditegakkan oleh middleware `requireTenant` dan pengecekan kepemilikan `manuscript.tenant_id !== tenantId` yang mengembalikan **HTTP 403 Forbidden**.

## Alternatives Considered
1. **Database per Tenant** (satu instance DB/schema terpisah untuk setiap jurnal).
2. **PostgreSQL Row-Level Security (RLS)** tingkat basis data.

## Consequences / Trade-Offs
- **Positif:**
  - Migrasi skema cukup dilakukan sekali untuk seluruh tenant dan sangat hemat memori dibandingkan membuat banyak pool koneksi database.
  - Pembuktian isolasi (`200 OK` vs `403 Forbidden` vs `400 Bad Request`) mudah diuji secara otomatis di level API.
- **Negatif / Batasan:**
  - Keamanan isolasi sangat bergantung pada disiplin kode di `manuscript.service.js` dan repository SQL (risiko *missing WHERE clause* jika ada developer baru lalai). Direkomendasikan mengaktifkan PostgreSQL RLS pada roadmap v2.
