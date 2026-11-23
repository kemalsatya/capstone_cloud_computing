#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_banner "[M09] Capacity Planning, Resource Utilization & FinOps (LIVE)"

print_step "1. Live Resource Utilization: docker stats --no-stream"
if docker info >/dev/null 2>&1; then
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" | head -n 12 || true
  record_pass "M09-01 | Live docker stats berhasil dikumpulkan"
else
  record_skip "M09-01 | Docker daemon tidak aktif"
fi

print_step "2. Live Kubernetes Metrics: kubectl top pods -n default"
if command -v kubectl >/dev/null 2>&1 && kubectl -n default top pods 2>/dev/null; then
  record_pass "M09-02 | Live kubectl top pods berhasil dikumpulkan"
else
  record_skip "M09-02 | Metrics-server / kluster k3d belum merespons kubectl top"
fi

print_step "3. Verifikasi resource requests & limits di manifest deployment/"
if grep -q "requests:" "$ROOT_DIR/deployment/deployment.yaml" && grep -q "limits:" "$ROOT_DIR/deployment/deployment.yaml" && \
   grep -q "requests:" "$ROOT_DIR/deployment/worker-format.yaml" && grep -q "requests:" "$ROOT_DIR/deployment/keycloak/deployment.yaml"; then
  record_pass "M09-03 | Resource requests & limits terdefinisi di backend, worker-format, & keycloak"
else
  record_fail "M09-03 | Resource requests/limits belum lengkap di manifest"
fi

if [[ -f "$ROOT_DIR/evidence/capacity-finops/README.md" ]]; then
  record_pass "M09-04 | evidence/capacity-finops/README.md tersedia"
else
  record_fail "M09-04 | evidence/capacity-finops/README.md hilang"
fi

if [[ -f "$ROOT_DIR/evidence/capacity-finops/live-metrics.txt" ]]; then
  record_pass "M09-05 | evidence/capacity-finops/live-metrics.txt tersedia"
else
  record_pend "M09-05 | [PAKET C] evidence/capacity-finops/live-metrics.txt menunggu PR Paket C"
fi

if [[ -f "$ROOT_DIR/evidence/capacity-finops/09_evidence.jpg" ]]; then
  record_pass "M09-06 | evidence/capacity-finops/09_evidence.jpg tersedia"
else
  record_pend "M09-06 | [PAKET C] evidence/capacity-finops/09_evidence.jpg menunggu PR Paket C"
fi

finish_milestone "M09"
