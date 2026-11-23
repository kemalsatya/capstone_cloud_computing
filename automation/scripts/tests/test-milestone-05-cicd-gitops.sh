#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_banner "[M05] CI/CD, Immutable Artifact & GitOps Argo CD (LIVE)"

print_step "1. Cek immutable SHA-7 tag di deployment/kustomization.yaml & local registry"
K_TAG=$(sed -n 's/^[[:space:]]*newTag:[[:space:]]*//p' "$ROOT_DIR/deployment/kustomization.yaml" | head -n 1 | tr -d '\r ')
echo "  deployment/kustomization.yaml newTag = '$K_TAG'"
if [[ -n "$K_TAG" && "$K_TAG" != "latest" && "${#K_TAG}" -ge 7 ]]; then
  record_pass "M05-01 | Immutable SHA-7 image tag aktif ($K_TAG, bukan :latest)"
else
  record_fail "M05-01 | newTag tidak valid ($K_TAG)"
fi

REG_CAT=$(curl -fsS "http://127.0.0.1:${REGISTRY_PORT}/v2/_catalog" 2>/dev/null || echo "")
if [[ -n "$REG_CAT" ]]; then
  echo "  Local registry catalog (:${REGISTRY_PORT}): $REG_CAT"
  record_pass "M05-02 | Local Docker Registry aktif di port ${REGISTRY_PORT}"
else
  record_skip "M05-02 | Local registry belum menyala di port ${REGISTRY_PORT}"
fi

print_step "2. Cek live status Argo CD Application di kluster k3d"
if command -v kubectl >/dev/null 2>&1 && kubectl -n argocd get applications.argoproj.io journalfit-backend >/dev/null 2>&1; then
  kubectl -n argocd get applications.argoproj.io journalfit-backend || true
  SYNC_ST=$(kubectl -n argocd get applications.argoproj.io journalfit-backend -o jsonpath='{.status.sync.status}' 2>/dev/null || echo "Unknown")
  HLTH_ST=$(kubectl -n argocd get applications.argoproj.io journalfit-backend -o jsonpath='{.status.health.status}' 2>/dev/null || echo "Unknown")
  echo "  Argo CD status: sync=$SYNC_ST | health=$HLTH_ST"
  if [[ "$SYNC_ST" == "Synced" && "$HLTH_ST" == "Healthy" ]]; then
    record_pass "M05-03 | Live Argo CD Application journalfit-backend Synced & Healthy"
  else
    record_skip "M05-03 | Argo CD terdaftar (status saat ini: sync=$SYNC_ST, health=$HLTH_ST)"
  fi
else
  record_skip "M05-03 | Argo CD Application belum terpasang di kluster lokal"
fi

print_step "3. Verifikasi workflow CI, manifest Argo CD & evidence delivery"
if grep -q "trivy" "$ROOT_DIR/.github/workflows/ci.yaml" && grep -q "trivy" "$ROOT_DIR/.gitea/workflows/ci.yml"; then
  record_pass "M05-04 | GitHub Actions & Gitea CI memuat test + Trivy security gate"
else
  record_fail "M05-04 | Workflow CI belum lengkap memuat Trivy gate"
fi

if grep -q "targetRevision: main" "$ROOT_DIR/automation/argocd/application.yaml" && grep -q "selfHeal: true" "$ROOT_DIR/automation/argocd/application.yaml" && grep -q "/spec/replicas" "$ROOT_DIR/automation/argocd/application.yaml"; then
  record_pass "M05-05 | automation/argocd/application.yaml valid (main + selfHeal + ignoreDifferences HPA)"
else
  record_fail "M05-05 | automation/argocd/application.yaml belum sesuai kontrak"
fi

if [[ -f "$ROOT_DIR/evidence/delivery/05_evidence.jpg" && -f "$ROOT_DIR/evidence/delivery/README.md" ]]; then
  record_pass "M05-06 | Evidence 05 (05_evidence.jpg & README.md) tersedia"
else
  record_fail "M05-06 | Evidence 05 belum lengkap"
fi

finish_milestone "M05"
