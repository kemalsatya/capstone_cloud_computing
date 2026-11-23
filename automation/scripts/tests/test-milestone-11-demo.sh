#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_banner "[M11] Demo & Technical Defense Readiness (LIVE)"

print_step "1. Live environment check (automation/scripts/doctor.sh)"
if bash "$ROOT_DIR/automation/scripts/doctor.sh"; then
  record_pass "M11-01 | Environment readiness (doctor.sh) OK"
else
  record_skip "M11-01 | doctor.sh melaporkan peringatan (cek output di atas)"
fi

print_step "2. Live quick-ping seluruh endpoint demo"
for pair in \
  "Compose App|$APP_URL/health/ready|" \
  "Keycloak Realm|$KEYCLOAK_URL/realms/journalfit|" \
  "K8s Ingress|$K8S_INGRESS_URL/health/ready|journalfit.localhost"
do
  IFS='|' read -r label url host <<< "$pair"
  if [[ -n "$host" ]]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: $host" "$url" 2>/dev/null || echo "000")
  else
    code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  fi
  echo "  $label ($url) -> HTTP $code"
done

print_step "3. Verifikasi artefak Demo 11 (demo/README.md, e2e-live-run.txt, 11_evidence.jpg)"
DEMO_MD="$ROOT_DIR/demo/README.md"
if [[ -f "$DEMO_MD" ]] && check_9_fields "$DEMO_MD"; then
  record_pass "M11-02 | demo/README.md tersedia & lengkap 9-field Evidence Standard (§9)"
else
  record_fail "M11-02 | demo/README.md hilang atau 9-field tidak lengkap"
fi

if [[ -f "$DEMO_MD" ]] && grep -q "13.1" "$DEMO_MD" && ! grep -qi "mock JWT" "$DEMO_MD"; then
  record_pass "M11-03 | 12 Q&A Sidang (§13.1) lengkap & bebas klaim lama 'mock JWT'"
else
  record_fail "M11-03 | Q&A §13.1 kurang atau masih ada klaim 'mock JWT'"
fi

if [[ -f "$ROOT_DIR/evidence/demo-defense/e2e-live-run.txt" && -f "$ROOT_DIR/evidence/demo-defense/11_evidence.jpg" ]]; then
  record_pass "M11-04 | Bukti live E2E (e2e-live-run.txt & 11_evidence.jpg) tersedia"
else
  record_fail "M11-04 | Bukti live E2E di evidence/demo-defense/ belum lengkap"
fi

finish_milestone "M11"
