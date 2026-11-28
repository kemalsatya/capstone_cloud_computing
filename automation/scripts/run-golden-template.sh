#!/usr/bin/env bash
# ==============================================================================
# run-golden-template.sh - Bukti golden test template Informatik asli
# Jalankan dengan template asli tersedia. Script tidak membuat bukti palsu:
# jika template tidak ada, script berhenti dengan error.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
EVIDENCE_DIR="$ROOT_DIR/evidence/application-data"
TEMPLATE="${TEMPLATE_INFORMATIK_PATH:-$ROOT_DIR/Copy of Template Journal Informatik.docx}"

if [ ! -f "$TEMPLATE" ]; then
  echo "[ERROR] Template tidak ditemukan: $TEMPLATE" >&2
  echo "[ERROR] Set TEMPLATE_INFORMATIK_PATH ke template asli lalu jalankan ulang." >&2
  exit 1
fi

mkdir -p "$EVIDENCE_DIR"
OUT_FILE="$EVIDENCE_DIR/golden-template-$(date +%Y%m%d_%H%M%S).txt"

{
  echo "Template: $TEMPLATE"
  echo "Commit: $(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
  echo "Timestamp: $(date -Iseconds)"
  echo
} | tee "$OUT_FILE"

cd "$ROOT_DIR/source"
TEMPLATE_INFORMATIK_PATH="$TEMPLATE" npm test -- tests/golden-template.test.js 2>&1 | tee -a "$OUT_FILE"

echo "[SUCCESS] Evidence disimpan di: $OUT_FILE"
