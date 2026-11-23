#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_banner "[M04] Cloud-Native Platform & Kubernetes k3d (LIVE)"

print_step "1. Validasi Dockerfile non-root & render Kustomize (kubectl kustomize deployment/)"
if grep -q "node:22-alpine" "$ROOT_DIR/source/Dockerfile" && grep -q "USER node" "$ROOT_DIR/source/Dockerfile"; then
  record_pass "M04-01 | Dockerfile memakai node:22-alpine & non-root USER node"
else
  record_fail "M04-01 | Dockerfile tidak memenuhi standar non-root node:22-alpine"
fi

if command -v kubectl >/dev/null 2>&1 && kubectl kustomize "$ROOT_DIR/deployment" >/dev/null 2>&1; then
  record_pass "M04-02 | kubectl kustomize deployment/ berhasil dirender tanpa error"
else
  record_fail "M04-02 | kubectl kustomize deployment/ gagal"
fi

print_step "2. Inspeksi live Kubernetes workloads (k3d-capstone, namespace default)"
if command -v kubectl >/dev/null 2>&1 && kubectl get nodes >/dev/null 2>&1; then
  kubectl -n default get deploy,pods,svc,ingress,pvc,hpa -o wide || true

  READY_PODS=$(kubectl -n default get pods -l app=journalfit --no-headers 2>/dev/null | grep -c "Running" || echo "0")
  [[ "$READY_PODS" -ge 2 ]] && record_pass "M04-03 | Live K8s: $READY_PODS pod app=journalfit Running" || record_fail "M04-03 | Pod app=journalfit Running < 2 ($READY_PODS)"

  PVC_PHASE=$(kubectl -n default get pvc journalfit-uploads -o jsonpath='{.status.phase}' 2>/dev/null || echo "Missing")
  [[ "$PVC_PHASE" == "Bound" ]] && record_pass "M04-04 | Live K8s: PVC journalfit-uploads Bound" || record_fail "M04-04 | PVC status=$PVC_PHASE"

  kubectl -n default get hpa journalfit-backend >/dev/null 2>&1 && record_pass "M04-05 | Live K8s: HPA journalfit-backend aktif" || record_fail "M04-05 | HPA tidak ditemukan"

  print_step "3. Uji live Traefik Ingress ($K8S_INGRESS_URL)"
  ING_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: journalfit.localhost" "$K8S_INGRESS_URL/health/ready" 2>/dev/null || echo "000")
  echo "  GET $K8S_INGRESS_URL/health/ready (Host: journalfit.localhost) -> HTTP $ING_CODE"
  [[ "$ING_CODE" == "200" ]] && record_pass "M04-06 | Live K8s Ingress /health/ready HTTP 200" || record_fail "M04-06 | K8s Ingress HTTP $ING_CODE"
else
  record_skip "M04-03..06 | Kluster k3d belum aktif / kubectl tidak terhubung"
fi

print_step "4. Verifikasi securityContext manifest & evidence platform"
if grep -q "runAsUser: 10001" "$ROOT_DIR/deployment/deployment.yaml" && grep -q "allowPrivilegeEscalation: false" "$ROOT_DIR/deployment/deployment.yaml"; then
  record_pass "M04-07 | Deployment hardened (UID 10001, allowPrivilegeEscalation: false)"
else
  record_fail "M04-07 | Hardening securityContext belum lengkap"
fi

if [[ -f "$ROOT_DIR/evidence/platform/04_evidence.jpg" && -f "$ROOT_DIR/evidence/platform/README.md" ]]; then
  record_pass "M04-08 | Evidence 04 (04_evidence.jpg & README.md) tersedia"
else
  record_fail "M04-08 | Evidence 04 belum lengkap"
fi

finish_milestone "M04"
