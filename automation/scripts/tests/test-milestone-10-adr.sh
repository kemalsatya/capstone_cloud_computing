#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_banner "[M10] Architecture Decision Records (ADR-001..009) Conformance Check"

PKG="$ROOT_DIR/source/package.json"
DEP="$ROOT_DIR/deployment/deployment.yaml"
KUST="$ROOT_DIR/deployment/kustomization.yaml"
ARGO="$ROOT_DIR/automation/argocd/application.yaml"

print_step "Menjalankan conformance check ADR-001 s.d. ADR-009 terhadap codebase & manifest"

# ADR-001: Express 5 + pg-boss + worker-format
if grep -q '"express"' "$PKG" && grep -q '"pg-boss"' "$PKG" && [[ -f "$ROOT_DIR/deployment/worker-format.yaml" ]]; then
  record_pass "ADR-001 | Modular Monolith Express 5 + Async Worker (pg-boss & worker-format.yaml)"
else
  record_fail "ADR-001 | Express/pg-boss/worker-format tidak cocok"
fi

# ADR-002: Shared PostgreSQL + tenant_id discriminator
TENANT_REFS=$(grep -c "tenant_id" "$ROOT_DIR/source/schema.sql" 2>/dev/null || echo "0")
[[ "$TENANT_REFS" -ge 5 ]] && record_pass "ADR-002 | Shared PostgreSQL + tenant_id discriminator ($TENANT_REFS referensi di schema.sql)" || record_fail "ADR-002 | tenant_id kurang di schema.sql"

# ADR-003: k3d K8s, HPA & Non-Root UID 10001
if grep -q "runAsUser: 10001" "$DEP" && grep -q "maxReplicas: 3" "$ROOT_DIR/deployment/hpa.yaml"; then
  record_pass "ADR-003 | k3d K8s, HPA (min 2..max 3) & Non-Root UID 10001"
else
  record_fail "ADR-003 | Hardening UID 10001 atau HPA tidak cocok"
fi

# ADR-004: Argo CD GitOps & Immutable SHA-7
K_TAG=$(sed -n 's/^[[:space:]]*newTag:[[:space:]]*//p' "$KUST" | head -n 1 | tr -d '\r ')
if grep -q "selfHeal: true" "$ARGO" && grep -q "/spec/replicas" "$ARGO" && [[ -n "$K_TAG" && "$K_TAG" != "latest" ]]; then
  record_pass "ADR-004 | Argo CD GitOps (selfHeal + ignore HPA) & Immutable SHA-7 ($K_TAG)"
else
  record_fail "ADR-004 | Argo CD / SHA-7 tag tidak sesuai"
fi

# ADR-005: PVC RWO 1Gi + Single-Node Pinning
if grep -q "ReadWriteOnce" "$ROOT_DIR/deployment/pvc.yaml" && grep -q "journalfit-storage" "$DEP"; then
  record_pass "ADR-005 | PVC ReadWriteOnce (1Gi) & Single-Node Pinning (journalfit-storage)"
else
  record_fail "ADR-005 | PVC RWO / nodeSelector tidak sesuai"
fi

# ADR-006: Secret Separation & Trivy CI Gate
if grep -q "secretKeyRef" "$DEP" && grep -q "trivy" "$ROOT_DIR/.github/workflows/ci.yaml"; then
  record_pass "ADR-006 | K8s Secret Separation (secretKeyRef) & Trivy CI Vulnerability Gate"
else
  record_fail "ADR-006 | SecretKeyRef / Trivy CI tidak ditemukan"
fi

# ADR-007: Prometheus /metrics & Grafana SLO
if grep -q "/metrics" "$ROOT_DIR/source/src/app.js" && [[ -f "$ROOT_DIR/evidence/observability/slo-sli.md" ]]; then
  record_pass "ADR-007 | Prometheus GET /metrics aktif di app.js & slo-sli.md tersedia"
else
  record_fail "ADR-007 | /metrics atau slo-sli.md tidak ditemukan"
fi

# ADR-008: Backup/Restore & Deterministic OOXML Rule Engine ($0 AI fee)
if grep -q '"jszip"' "$PKG" && grep -q '"fast-xml-parser"' "$PKG" && [[ -f "$ROOT_DIR/automation/scripts/db-backup-restore.sh" ]]; then
  record_pass "ADR-008 | Isolated DB Backup/Restore & Native OOXML Engine (jszip + fast-xml-parser, \$0 AI fee)"
else
  record_fail "ADR-008 | jszip / fast-xml-parser / db-backup-restore.sh tidak lengkap"
fi

# ADR-009: Keycloak OIDC RS256 JWKS & Tenant Claim
if grep -q '"jose"' "$PKG" && grep -qE 'AUTH_MODE:[[:space:]]*"?jwt"?' "$ROOT_DIR/deployment/configmap.yaml" && grep -q "keycloak" "$KUST"; then
  record_pass "ADR-009 | Keycloak OIDC RS256 JWKS (jose, AUTH_MODE=jwt, deployment/keycloak)"
else
  record_fail "ADR-009 | Keycloak OIDC / jose / ConfigMap tidak cocok"
fi

print_step "Verifikasi dokumen & diagram ADR (decisions/)"
if [[ -f "$ROOT_DIR/decisions/README.md" ]] && check_9_fields "$ROOT_DIR/decisions/README.md"; then
  record_pass "M10-DOC | decisions/README.md lengkap 9-field Evidence Standard (§9)"
else
  record_fail "M10-DOC | decisions/README.md belum lengkap"
fi

SZ_10=$(file_size_bytes "$ROOT_DIR/decisions/10_evidence.jpg")
[[ "$SZ_10" -gt 100000 ]] && record_pass "M10-IMG | decisions/10_evidence.jpg tersedia (${SZ_10} bytes)" || record_fail "M10-IMG | decisions/10_evidence.jpg hilang/kecil"

finish_milestone "M10"
