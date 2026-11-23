#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_banner "[M07] Observability, Prometheus /metrics, Grafana & SLO (LIVE)"

print_step "1. Live scrape GET $APP_URL/metrics"
METRICS_TMP=$(mktemp)
trap 'rm -f "$METRICS_TMP"' EXIT
M_CODE=$(curl -s -o "$METRICS_TMP" -w "%{http_code}" "$APP_URL/metrics" 2>/dev/null || echo "000")
if [[ "$M_CODE" == "200" ]]; then
  grep -E "^(http_requests_total|http_request_duration_seconds_count|process_resident_memory_bytes)" "$METRICS_TMP" | head -n 10 || true
  if grep -q "http_requests_total" "$METRICS_TMP" && grep -q "http_request_duration_seconds_bucket" "$METRICS_TMP"; then
    record_pass "M07-01 | Live GET /metrics HTTP 200 dengan metrik Prometheus valid"
  else
    record_fail "M07-01 | /metrics tidak memuat metrik HTTP yang diharapkan"
  fi
else
  record_skip "M07-01 | Backend $APP_URL belum aktif (HTTP $M_CODE)"
fi

print_step "2. Live SLO latency probe (10 request ke /health/ready)"
if [[ "$M_CODE" == "200" ]]; then
  SLO_OK=0
  for i in $(seq 1 10); do
    RES=$(curl -s -o /dev/null -w "%{http_code} %{time_total}s" "$APP_URL/health/ready")
    CODE="${RES%% *}"
    [[ "$CODE" == "200" ]] && SLO_OK=$((SLO_OK + 1))
    echo "  Req #$i -> HTTP $RES"
  done
  [[ "$SLO_OK" -eq 10 ]] && record_pass "M07-02 | Live SLO probe: 10/10 HTTP 200" || record_fail "M07-02 | Live SLO probe: $SLO_OK/10"
else
  record_skip "M07-02 | Live SLO probe dilewati (backend tidak aktif)"
fi

print_step "3. Cek live Prometheus (:$PROMETHEUS_PORT) & Grafana (:$GRAFANA_PORT)"
PROM_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PROMETHEUS_PORT}/-/ready" 2>/dev/null || echo "000")
GRAF_BODY=$(curl -s "http://127.0.0.1:${GRAFANA_PORT}/api/health" 2>/dev/null || echo "")
GRAF_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${GRAFANA_PORT}/api/health" 2>/dev/null || echo "000")
echo "  Prometheus /-/ready   -> HTTP $PROM_CODE"
echo "  Grafana /api/health   -> HTTP $GRAF_CODE ($GRAF_BODY)"

[[ "$PROM_CODE" == "200" ]] && record_pass "M07-03 | Live Prometheus ready (:$PROMETHEUS_PORT)" || record_skip "M07-03 | Prometheus belum menyala (jalankan: docker compose --profile observability up -d)"
[[ "$GRAF_CODE" == "200" ]] && record_pass "M07-04 | Live Grafana healthy (:$GRAFANA_PORT)" || record_skip "M07-04 | Grafana belum menyala"

print_step "4. Verifikasi konfigurasi SLO/SLI, Prometheus, Grafana & evidence"
if [[ -f "$ROOT_DIR/evidence/observability/prometheus.yml" && -f "$ROOT_DIR/evidence/observability/slo-sli.md" && -f "$ROOT_DIR/evidence/observability/07_evidence.jpg" ]]; then
  record_pass "M07-05 | Artefak Observability (prometheus.yml, slo-sli.md, 07_evidence.jpg) lengkap"
else
  record_fail "M07-05 | Artefak Observability belum lengkap"
fi

finish_milestone "M07"
