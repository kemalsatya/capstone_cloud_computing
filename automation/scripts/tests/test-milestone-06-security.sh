#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_banner "[M06] Security, Keycloak OIDC JWT, RBAC & Cross-Tenant Isolation (LIVE)"

print_step "1. Audit Git secret hygiene (.env tidak ter-track) & konfigurasi AUTH_MODE=jwt"
if git -C "$ROOT_DIR" ls-files --error-unmatch .env >/dev/null 2>&1 || git -C "$ROOT_DIR" ls-files --error-unmatch source/.env >/dev/null 2>&1; then
  record_fail "M06-01 | File .env terdeteksi di Git index!"
else
  record_pass "M06-01 | Tidak ada file .env / source/.env ter-track di Git"
fi

if grep -qE 'AUTH_MODE:[[:space:]]*"?jwt"?' "$ROOT_DIR/deployment/configmap.yaml" && grep -q "KEYCLOAK_JWKS_URI" "$ROOT_DIR/deployment/configmap.yaml"; then
  record_pass "M06-02 | ConfigMap mengaktifkan AUTH_MODE=jwt + KEYCLOAK_JWKS_URI"
else
  record_fail "M06-02 | ConfigMap belum mengaktifkan AUTH_MODE=jwt"
fi

print_step "2. Live Security Test: Keycloak JWT, Negative Auth, Cross-Tenant & RBAC ($APP_URL)"
if curl -fsS "$KEYCLOAK_URL/realms/journalfit" >/dev/null 2>&1 && curl -fsS "$APP_URL/health/ready" >/dev/null 2>&1; then
  TOK_AUTH_A=$(fetch_kc_token "author.a" "author.a")
  TOK_EDIT_A=$(fetch_kc_token "editor.a" "editor.a")
  TOK_AUTH_B=$(fetch_kc_token "author.b" "author.b")

  NO_TOK=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/api/auth/me")
  BAD_TOK=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer invalid.jwt.token" "$APP_URL/api/auth/me")
  OWN_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOK_EDIT_A" "$APP_URL/api/manuscripts/ms-001/report")
  CROSS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOK_AUTH_B" "$APP_URL/api/manuscripts/ms-001/report")
  RBAC_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $TOK_EDIT_A" "$APP_URL/api/manuscripts/upload")
  SPOOF_BODY=$(curl -s -H "Authorization: Bearer $TOK_AUTH_A" -H "X-Tenant-ID: tenant-b" "$APP_URL/api/auth/me")

  echo "  Tanpa token              -> HTTP $NO_TOK (expect 401)"
  echo "  Token rusak              -> HTTP $BAD_TOK (expect 401)"
  echo "  editor.a -> ms-001       -> HTTP $OWN_CODE (expect 200)"
  echo "  author.b -> ms-001       -> HTTP $CROSS_CODE (expect 404 cross-tenant isolation)"
  echo "  editor.a -> POST upload  -> HTTP $RBAC_CODE (expect 403 RBAC)"
  echo "  Header spoof tenant-b    -> $SPOOF_BODY"

  [[ "$NO_TOK" == "401" && "$BAD_TOK" == "401" ]] && record_pass "M06-03 | Live Negative Auth (tanpa/rusak token -> HTTP 401)" || record_fail "M06-03 | Negative Auth gagal ($NO_TOK/$BAD_TOK)"
  [[ "$OWN_CODE" == "200" ]] && record_pass "M06-04 | Live Positive Auth (editor.a tenant-a -> ms-001 HTTP 200)" || record_fail "M06-04 | Positive Auth gagal ($OWN_CODE)"
  [[ "$CROSS_CODE" == "404" ]] && record_pass "M06-05 | Live Cross-Tenant Isolation (author.b -> ms-001 HTTP 404)" || record_fail "M06-05 | Cross-Tenant bocor ($CROSS_CODE)"
  [[ "$RBAC_CODE" == "403" ]] && record_pass "M06-06 | Live RBAC Enforcement (editor.a upload -> HTTP 403)" || record_fail "M06-06 | RBAC gagal ($RBAC_CODE)"
  echo "$SPOOF_BODY" | grep -q "tenant-a" && record_pass "M06-07 | Live Header Spoofing X-Tenant-ID: tenant-b diabaikan (tetap tenant-a)" || record_fail "M06-07 | Header spoofing tidak terblokir"
else
  record_skip "M06-03..07 | Keycloak ($KEYCLOAK_URL) atau Backend ($APP_URL) belum aktif"
fi

print_step "3. Live Trivy Vulnerability Scan (opsional: --with-trivy) & verifikasi evidence/security/"
if [[ "$WITH_TRIVY" == "true" ]]; then
  K_TAG=$(sed -n 's/^[[:space:]]*newTag:[[:space:]]*//p' "$ROOT_DIR/deployment/kustomization.yaml" | head -n 1 | tr -d '\r ')
  SCAN_IMG="localhost:${REGISTRY_PORT}/journalfit-backend:${K_TAG}"
  echo "  Menjalankan Trivy scan pada $SCAN_IMG..."
  if MSYS_NO_PATHCONV=1 docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL --exit-code 0 "$SCAN_IMG"; then
    record_pass "M06-08 | Live Trivy scan selesai pada $SCAN_IMG"
  else
    record_fail "M06-08 | Live Trivy scan gagal"
  fi
else
  record_skip "M06-08 | Live Trivy scan dilewati (tambahkan --with-trivy untuk menjalankan)"
fi

if [[ -f "$ROOT_DIR/evidence/security/06_evidence.jpg" && -f "$ROOT_DIR/evidence/security/trivy-scan.txt" && -f "$ROOT_DIR/evidence/security/README.md" ]]; then
  record_pass "M06-09 | Evidence 06 (06_evidence.jpg, trivy-scan.txt, README.md) tersedia"
else
  record_fail "M06-09 | Evidence 06 belum lengkap"
fi

finish_milestone "M06"
