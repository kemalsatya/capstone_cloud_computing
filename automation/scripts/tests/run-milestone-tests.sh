#!/usr/bin/env bash
# ==============================================================================
# run-milestone-tests.sh — Master Live-Operational & Verification Runner (01–11)
# Penggunaan:
#   bash automation/scripts/tests/run-milestone-tests.sh all
#   bash automation/scripts/tests/run-milestone-tests.sh all --allow-pending
#   bash automation/scripts/tests/run-milestone-tests.sh 03 06 08 --with-trivy
# ==============================================================================
set -uo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TARGETS=()
FLAGS=()

for arg in "$@"; do
  case "$arg" in
    --allow-pending|--with-trivy)
      FLAGS+=("$arg")
      ;;
    -h|--help)
      echo "Penggunaan: bash automation/scripts/tests/run-milestone-tests.sh [all | 01 02 ... 11] [--allow-pending] [--with-trivy]"
      exit 0
      ;;
    all)
      TARGETS=(01 02 03 04 05 06 07 08 09 10 11)
      ;;
    *)
      TARGETS+=("$arg")
      ;;
  esac
done

if [[ "${#TARGETS[@]}" -eq 0 ]]; then
  TARGETS=(01 02 03 04 05 06 07 08 09 10 11)
fi

script_for() {
  case "$1" in
    01|1) echo "$TESTS_DIR/test-milestone-01-business.sh" ;;
    02|2) echo "$TESTS_DIR/test-milestone-02-architecture.sh" ;;
    03|3) echo "$TESTS_DIR/test-milestone-03-application-data.sh" ;;
    04|4) echo "$TESTS_DIR/test-milestone-04-platform-k8s.sh" ;;
    05|5) echo "$TESTS_DIR/test-milestone-05-cicd-gitops.sh" ;;
    06|6) echo "$TESTS_DIR/test-milestone-06-security.sh" ;;
    07|7) echo "$TESTS_DIR/test-milestone-07-observability.sh" ;;
    08|8) echo "$TESTS_DIR/test-milestone-08-reliability.sh" ;;
    09|9) echo "$TESTS_DIR/test-milestone-09-capacity-finops.sh" ;;
    10)   echo "$TESTS_DIR/test-milestone-10-adr.sh" ;;
    11)   echo "$TESTS_DIR/test-milestone-11-demo.sh" ;;
    *)    echo "" ;;
  esac
}

echo "=================================================================="
echo "  JOURNALFIT — LIVE OPERATIONAL & MILESTONE TEST RUNNER (01–11)"
echo "=================================================================="
echo "Targets : ${TARGETS[*]}"
echo "Flags   : ${FLAGS[*]:-(none)}"

FAILED=()
PASSED=()

for t in "${TARGETS[@]}"; do
  s="$(script_for "$t")"
  if [[ -z "$s" || ! -f "$s" ]]; then
    echo "[ERROR] Milestone tidak dikenal: $t" >&2
    FAILED+=("$t")
    continue
  fi
  if bash "$s" "${FLAGS[@]}"; then
    PASSED+=("$t")
  else
    FAILED+=("$t")
  fi
done

echo ""
echo "=================================================================="
echo "  OVERALL MILESTONE RUNNER SUMMARY"
echo "=================================================================="
echo "  PASSED : ${#PASSED[@]} (${PASSED[*]:-none})"
echo "  FAILED : ${#FAILED[@]} (${FAILED[*]:-none})"
echo "=================================================================="

if [[ "${#FAILED[@]}" -gt 0 ]]; then
  exit 1
fi
exit 0
