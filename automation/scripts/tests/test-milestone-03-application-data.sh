#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_banner "[M03] Application, Data, OOXML Engine & Async Worker (LIVE)"

print_step "1. Menjalankan unit & integration test aplikasi (cd source && node --test)"
if (cd "$ROOT_DIR/source" && node --test); then
  record_pass "M03-01 | Application, OOXML, Worker, OpenAPI & JWT test suite (node --test) lulus"
else
  record_fail "M03-01 | node --test di source/ gagal"
fi

print_step "2. Cek live endpoint aplikasi Docker Compose ($APP_URL)"
LIVE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/health/live" 2>/dev/null || echo "000")
READY_BODY=$(curl -s "$APP_URL/health/ready" 2>/dev/null || echo "")
READY_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/health/ready" 2>/dev/null || echo "000")
OAS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/openapi.yaml" 2>/dev/null || echo "000")
echo "  GET /health/live   -> HTTP $LIVE_CODE"
echo "  GET /health/ready  -> HTTP $READY_CODE ($READY_BODY)"
echo "  GET /openapi.yaml  -> HTTP $OAS_CODE"

if [[ "$LIVE_CODE" == "200" && "$READY_CODE" == "200" ]]; then
  record_pass "M03-02 | Live backend /health/live & /health/ready HTTP 200"
else
  record_skip "M03-02 | Live backend belum jalan di $APP_URL (HTTP live=$LIVE_CODE, ready=$READY_CODE; jalankan: docker compose up -d)"
fi

print_step "3. Cek live skema PostgreSQL (6 tabel inti & jumlah baris)"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^journalfit-postgres$'; then
  docker exec journalfit-postgres psql -U "$DB_USER" -d "$DB_NAME" -c "\dt public.*" || true
  TBL_CNT=$(docker exec journalfit-postgres psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('tenants','users','format_rule_templates','manuscripts','check_results','findings');" 2>/dev/null | tr -d ' \r\n')
  [[ "$TBL_CNT" == "6" ]] && record_pass "M03-03 | PostgreSQL live: 6 tabel inti terverifikasi" || record_fail "M03-03 | Jumlah tabel inti tidak sesuai ($TBL_CNT)"
else
  record_skip "M03-03 | Container journalfit-postgres belum berjalan"
fi

print_step "4. Verifikasi migrasi, OpenAPI spec, worker & evidence"
if [[ -f "$ROOT_DIR/source/migrations/001_add_keycloak_auth.sql" && -f "$ROOT_DIR/source/migrations/002_prd_format_foundation.sql" ]]; then
  record_pass "M03-04 | Migrasi aditif 001 (Keycloak) & 002 (PRD Format/pg-boss) tersedia"
else
  record_fail "M03-04 | File migrasi 001/002 hilang"
fi

if [[ -f "$ROOT_DIR/source/src/docs/openapi.yaml" && -f "$ROOT_DIR/source/src/worker.js" ]]; then
  record_pass "M03-05 | OpenAPI spec & async worker (source/src/worker.js) tersedia"
else
  record_fail "M03-05 | OpenAPI spec atau worker.js hilang"
fi

if [[ -f "$ROOT_DIR/evidence/application-data/README.md" && -f "$ROOT_DIR/evidence/application-data/03_evidence.jpg" ]]; then
  record_pass "M03-06 | Evidence 03 (README.md & 03_evidence.jpg) tersedia"
else
  record_fail "M03-06 | Evidence 03 belum lengkap"
fi

finish_milestone "M03"
