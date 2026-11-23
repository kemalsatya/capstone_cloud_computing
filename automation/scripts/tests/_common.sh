#!/usr/bin/env bash
# Shared helper for JournalFit live-operational + verification milestone scripts
set -uo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$TESTS_DIR/../../.." && pwd)"

# Ensure Docker Desktop binaries are in PATH on Windows Git Bash
for dbin in \
  "/c/Program Files/Docker/Docker/resources/bin" \
  "${USERPROFILE:+$(cygpath -u "$USERPROFILE" 2>/dev/null || true)/AppData/Local/Programs/DockerDesktop/resources/bin}" \
  "${HOME}/AppData/Local/Programs/DockerDesktop/resources/bin"
do
  if [[ -n "$dbin" && -d "$dbin" ]]; then
    export PATH="$dbin:$PATH"
  fi
done

# WSL fallback: map Windows .exe tools when native Linux binaries are absent
if ! command -v node >/dev/null 2>&1 && command -v node.exe >/dev/null 2>&1; then
  node() { node.exe "$@"; }
fi
if ! command -v docker >/dev/null 2>&1 && command -v docker.exe >/dev/null 2>&1; then
  docker() { docker.exe "$@"; }
fi
if ! command -v kubectl >/dev/null 2>&1 && command -v kubectl.exe >/dev/null 2>&1; then
  kubectl() { kubectl.exe "$@"; }
fi

APP_URL="${APP_URL:-http://127.0.0.1:8000}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://127.0.0.1:${KEYCLOAK_PORT:-8081}}"
K8S_INGRESS_URL="${K8S_INGRESS_URL:-http://127.0.0.1:${K3D_HTTP_PORT:-8088}}"
REGISTRY_PORT="${REGISTRY_PORT:-5001}"
PROMETHEUS_PORT="${PROMETHEUS_PORT:-9090}"
GRAFANA_PORT="${GRAFANA_PORT:-3000}"
DB_USER="${DB_USER:-capstone}"
DB_NAME="${DB_NAME:-journalfit}"

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
PEND_COUNT=0
ALLOW_PENDING="${ALLOW_PENDING:-false}"
WITH_TRIVY="${WITH_TRIVY:-false}"
WITH_LOAD_TEST="${WITH_LOAD_TEST:-false}"
WITH_DRIFT_TEST="${WITH_DRIFT_TEST:-false}"

for arg in "$@"; do
  case "$arg" in
    --allow-pending) ALLOW_PENDING=true ;;
    --with-trivy) WITH_TRIVY=true ;;
    --with-load-test) WITH_LOAD_TEST=true ;;
    --with-drift-test) WITH_DRIFT_TEST=true ;;
  esac
done

record_pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "  [PASS] $1"
}

record_fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "  [FAIL] $1" >&2
}

record_skip() {
  SKIP_COUNT=$((SKIP_COUNT + 1))
  echo "  [SKIP] $1"
}

record_pend() {
  PEND_COUNT=$((PEND_COUNT + 1))
  echo "  [PEND] $1"
}

print_banner() {
  echo ""
  echo "=================================================================="
  echo "  $1"
  echo "=================================================================="
}

print_step() {
  echo ""
  echo ">>> $1"
}

file_size_bytes() {
  local f="$1"
  if [[ -f "$f" ]]; then
    wc -c < "$f" | tr -d ' \r\n'
  else
    echo "0"
  fi
}

check_9_fields() {
  local md_file="$1"
  local missing=0
  for field in "Scope" "Owner" "Source" "Timestamp" "Method" "Observation" "Interpretation" "Limitation" "Decision"; do
    if ! grep -qi "$field" "$md_file" 2>/dev/null; then
      missing=$((missing + 1))
    fi
  done
  [[ "$missing" -eq 0 ]]
}

fetch_kc_token() {
  local username="$1"
  local password="$2"
  local token_url="${3:-$KEYCLOAK_URL/realms/journalfit/protocol/openid-connect/token}"
  local host_hdr="${4:-}"
  local resp
  if [[ -n "$host_hdr" ]]; then
    resp=$(curl -sS -X POST -H "Host: $host_hdr" "$token_url" \
      -d "grant_type=password&client_id=journalfit-app&username=${username}&password=${password}&scope=openid profile email" 2>/dev/null || echo "{}")
  else
    resp=$(curl -sS -X POST "$token_url" \
      -d "grant_type=password&client_id=journalfit-app&username=${username}&password=${password}&scope=openid profile email" 2>/dev/null || echo "{}")
  fi
  printf '%s' "$resp" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p'
}

finish_milestone() {
  local title="$1"
  echo ""
  echo "------------------------------------------------------------------"
  echo "  SUMMARY $title: PASS=$PASS_COUNT | FAIL=$FAIL_COUNT | SKIP=$SKIP_COUNT | PEND=$PEND_COUNT"
  echo "------------------------------------------------------------------"
  if [[ "$FAIL_COUNT" -gt 0 ]]; then
    exit 1
  fi
  if [[ "$PEND_COUNT" -gt 0 && "$ALLOW_PENDING" != "true" ]]; then
    exit 2
  fi
  exit 0
}
