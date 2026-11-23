#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_banner "[M02] System Architecture & Pure ArchiMate 3.2"

print_step "Inspeksi isi direktori architecture/ & architecture/images/"
ls -lh "$ROOT_DIR/architecture/" 2>/dev/null || true
ls -lh "$ROOT_DIR/architecture/images/" 2>/dev/null || true

ARCHI_FILE="$ROOT_DIR/architecture/journalfit-architecture.archimate"
README_02="$ROOT_DIR/evidence/architecture/README.md"
IMG_02="$ROOT_DIR/evidence/architecture/02_evidence.jpg"

print_step "Inspeksi daftar ArchiMate Views di journalfit-architecture.archimate"
if [[ -f "$ARCHI_FILE" ]]; then
  grep -oE 'xsi:type="archimate:ArchimateDiagramModel"[^>]*name="[^"]+"' "$ARCHI_FILE" | sed 's/.*name="/  - View: /; s/"$//' || true
fi

print_step "Verifikasi akhir M02"
if [[ -f "$README_02" ]] && check_9_fields "$README_02"; then
  record_pass "M02-01 | evidence/architecture/README.md lengkap 9-field Evidence Standard (§9)"
else
  record_fail "M02-01 | evidence/architecture/README.md hilang atau 9-field tidak lengkap"
fi

SZ_02=$(file_size_bytes "$IMG_02")
[[ "$SZ_02" -gt 100000 ]] && record_pass "M02-02 | 02_evidence.jpg ter-render (${SZ_02} bytes)" || record_fail "M02-02 | 02_evidence.jpg hilang/terlalu kecil (${SZ_02} bytes)"

VIEW_COUNT=$(grep -c 'xsi:type="archimate:ArchimateDiagramModel"' "$ARCHI_FILE" 2>/dev/null || echo "0")
PNG_COUNT=$(find "$ROOT_DIR/architecture/images" -maxdepth 1 -name '*.png' 2>/dev/null | wc -l | tr -d ' ')
BAD_HTML=$(find "$ROOT_DIR/architecture" -maxdepth 1 \( -name '*.html' -o -name '*.svg' -o -name '*.puml' \) 2>/dev/null | wc -l | tr -d ' ')
if [[ -f "$ARCHI_FILE" && "$VIEW_COUNT" -ge 4 && "$PNG_COUNT" -ge 4 && "$BAD_HTML" -eq 0 ]]; then
  record_pass "M02-03 | Pure ArchiMate valid (${VIEW_COUNT} views, ${PNG_COUNT} PNG captures, 0 HTML/SVG)"
else
  record_fail "M02-03 | ArchiMate tidak sesuai (views=${VIEW_COUNT}, png=${PNG_COUNT}, non-archi=${BAD_HTML})"
fi

if grep -q "Keycloak" "$ARCHI_FILE" && grep -q "pg-boss" "$ARCHI_FILE" && grep -q "0c2cf92" "$ARCHI_FILE"; then
  record_pass "M02-04 | Model ArchiMate sinkron dengan stack terbaru (Keycloak, pg-boss, 0c2cf92)"
else
  record_fail "M02-04 | Model ArchiMate belum sinkron dengan stack terbaru"
fi

if grep -q "TB-1" "$ARCHI_FILE" && grep -qE "FB-[123]" "$ARCHI_FILE"; then
  record_pass "M02-05 | Trust Boundaries (TB-1..TB-4) & Failure Boundaries (FB-2..FB-3) terdokumentasi"
else
  record_fail "M02-05 | Trust/Failure Boundaries tidak ditemukan di model"
fi

if grep -q "7.1" "$ARCHI_FILE" && grep -q "0.78" "$ARCHI_FILE"; then
  record_pass "M02-06 | Metrik realisasi 08_evidence (7.1s & 0.78s) sinkron di model"
else
  record_fail "M02-06 | Metrik realisasi 08_evidence belum sinkron di model"
fi

finish_milestone "M02"
