#!/usr/bin/env bash
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

print_banner "[M01] Business Case, Cloud Rationale & Scope Boundary"

print_step "Inspeksi artefak evidence/business/"
ls -lh "$ROOT_DIR/evidence/business/" 2>/dev/null || true

print_step "Verifikasi akhir M01"
README_01="$ROOT_DIR/evidence/business/README.md"
IMG_01="$ROOT_DIR/evidence/business/01_evidence.jpg"
SVG_01="$ROOT_DIR/evidence/business/business-archimate.svg"

[[ -f "$README_01" ]] && record_pass "M01-01 | evidence/business/README.md tersedia" || record_fail "M01-01 | evidence/business/README.md hilang"
if [[ -f "$README_01" ]] && check_9_fields "$README_01"; then
  record_pass "M01-02 | 9-field Evidence Standard (§9) lengkap di README"
else
  record_fail "M01-02 | 9-field Evidence Standard (§9) belum lengkap"
fi

SZ_01=$(file_size_bytes "$IMG_01")
[[ "$SZ_01" -gt 50000 ]] && record_pass "M01-03 | 01_evidence.jpg ter-render (${SZ_01} bytes)" || record_fail "M01-03 | 01_evidence.jpg hilang/terlalu kecil (${SZ_01} bytes)"
[[ -f "$SVG_01" ]] && record_pass "M01-04 | business-archimate.svg tersedia" || record_fail "M01-04 | business-archimate.svg hilang"

if [[ -f "$README_01" ]] && grep -qi "Cloud-Native" "$README_01" && grep -qiE "alternatif|ditolak|rejected" "$README_01"; then
  record_pass "M01-05 | 5 Pilar Cloud-Native & Alternatif Ditolak terdokumentasi"
else
  record_fail "M01-05 | 5 Pilar / Alternatif Ditolak belum terdokumentasi"
fi

if [[ -f "$README_01" ]] && grep -qiE "roadmap v2|v2" "$README_01" && grep -qiE "LLM|AI|Groq" "$README_01"; then
  record_pass "M01-06 | Kejujuran Scope (§14.2): batas v1 vs Roadmap v2 (AI/LLM) dicatat eksplisit"
else
  record_fail "M01-06 | Batasan v1 vs Roadmap v2 belum dicatat"
fi

finish_milestone "M01"
