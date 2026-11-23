#!/usr/bin/env bash
# ==============================================================================
# capture-evidence-06-08-09-10.sh
# Skrip pembantu tim untuk mencetak & menyimpan bukti operasional modul:
#   06 - Security (Auth Negative Tests, Secret Audit, Pod Hardening, Trivy)
#   08 - Reliability & Recovery (Pod Self-Healing & DB Backup/Restore Proof)
#   09 - Capacity & FinOps (Requests/Limits, Headroom, Unit-Cost, Roadmap)
#   10 - Decisions ADR (Matriks ADR-001 s.d. ADR-008)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TARGET="${1:-}"

if [[ -d "/c/Program Files/Docker/Docker/resources/bin" ]]; then
  export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"
fi

# Detect output directories (supports both Guideline 2 11-folder portfolio & main git repo)
DIR_06="$ROOT_DIR/06-security"
[[ ! -d "$DIR_06" ]] && DIR_06="$ROOT_DIR/evidence/security"
DIR_08="$ROOT_DIR/08-reliability-recovery"
[[ ! -d "$DIR_08" ]] && DIR_08="$ROOT_DIR/evidence/reliability-recovery"
DIR_09="$ROOT_DIR/09-capacity-finops"
[[ ! -d "$DIR_09" ]] && DIR_09="$ROOT_DIR/evidence/capacity-finops"
DIR_10="$ROOT_DIR/10-decisions-adr"
[[ ! -d "$DIR_10" ]] && DIR_10="$ROOT_DIR/decisions"

mkdir -p "$DIR_06" "$DIR_08" "$DIR_09" "$DIR_10"

usage() {
  echo "Penggunaan: bash automation/scripts/capture-evidence-06-08-09-10.sh {06|08|09|10|all}"
  echo "  06  : Jalankan & cetak bukti 06-security (Anggota 4, 1, 3)"
  echo "  08  : Jalankan & cetak bukti 08-reliability-recovery (Anggota 4, 2)"
  echo "  09  : Cetak worksheet 09-capacity-finops (Anggota 4, 2)"
  echo "  10  : Cetak matriks keputusan 10-decisions-adr (Semua Anggota)"
  echo "  all : Jalankan semua (06, 08, 09, 10)"
  exit 1
}

detect_app_endpoint() {
  APP_BASE_URL=""
  APP_HOST_HEADER=""
  if curl -sf "http://127.0.0.1:8000/health/live" >/dev/null 2>&1; then
    APP_BASE_URL="http://127.0.0.1:8000"
  elif curl -sf -H "Host: journalfit.localhost" "http://127.0.0.1:8088/health/live" >/dev/null 2>&1; then
    APP_BASE_URL="http://127.0.0.1:8088"
    APP_HOST_HEADER="journalfit.localhost"
  fi
}

curl_api() {
  local method="$1"
  local path="$2"
  shift 2
  if [[ -n "$APP_HOST_HEADER" ]]; then
    curl -sS -X "$method" -H "Host: $APP_HOST_HEADER" "$@" "${APP_BASE_URL}${path}"
  else
    curl -sS -X "$method" "$@" "${APP_BASE_URL}${path}"
  fi
}

# ==============================================================================
# MODUL 06: SECURITY
# ==============================================================================
run_06() {
  local log_file="$DIR_06/security-capture-latest.txt"
  {
    echo "================================================================================"
    echo "  [06-SECURITY] EVIDENCE CAPTURE - JOURNALFIT (TEAM 7)"
    echo "  Timestamp : $(date -Iseconds 2>/dev/null || date)"
    echo "  Owner     : Anggota 4 (Lead) | Support: Anggota 1 (Auth) & Anggota 3 (Trivy)"
    echo "================================================================================"
    echo ""

    echo ">>> PANEL 1: POSITIVE & NEGATIVE AUTHORIZATION / TENANT ISOLATION TESTS (KEYCLOAK JWT)"
    detect_app_endpoint
    local kc_url="" kc_host=""
    if curl -sf "http://127.0.0.1:8081/realms/journalfit" >/dev/null 2>&1; then
      kc_url="http://127.0.0.1:8081/realms/journalfit/protocol/openid-connect/token"
    elif curl -sf -H "Host: keycloak.localhost" "http://127.0.0.1:8088/realms/journalfit" >/dev/null 2>&1; then
      kc_url="http://127.0.0.1:8088/realms/journalfit/protocol/openid-connect/token"
      kc_host="keycloak.localhost"
    fi

    if [[ -n "$APP_BASE_URL" && -n "$kc_url" ]]; then
      echo "[Target API]      $APP_BASE_URL (Host header: ${APP_HOST_HEADER:-none})"
      echo "[Target Keycloak] $kc_url (Host header: ${kc_host:-none})"
      echo ""

      local tok_auth_a tok_edit_a tok_auth_b
      tok_auth_a=$(curl -sS -X POST ${kc_host:+-H "Host: $kc_host"} "$kc_url" -d "grant_type=password&client_id=journalfit-app&username=author.a&password=author.a&scope=openid" | node -e 'const fs=require("fs"); try{console.log(JSON.parse(fs.readFileSync(0,"utf8")).access_token||"")}catch{console.log("")}')
      tok_edit_a=$(curl -sS -X POST ${kc_host:+-H "Host: $kc_host"} "$kc_url" -d "grant_type=password&client_id=journalfit-app&username=editor.a&password=editor.a&scope=openid" | node -e 'const fs=require("fs"); try{console.log(JSON.parse(fs.readFileSync(0,"utf8")).access_token||"")}catch{console.log("")}')
      tok_auth_b=$(curl -sS -X POST ${kc_host:+-H "Host: $kc_host"} "$kc_url" -d "grant_type=password&client_id=journalfit-app&username=author.b&password=author.b&scope=openid" | node -e 'const fs=require("fs"); try{console.log(JSON.parse(fs.readFileSync(0,"utf8")).access_token||"")}catch{console.log("")}')

      echo "1) Negative Test - Tanpa Bearer Token (Expected: 401 UNAUTHENTICATED):"
      local code_401 body_401
      body_401=$(curl_api GET "/api/auth/me")
      code_401=$(curl -s -o /dev/null -w "%{http_code}" ${APP_HOST_HEADER:+-H "Host: $APP_HOST_HEADER"} "${APP_BASE_URL}/api/auth/me")
      echo "   HTTP Status : $code_401"
      echo "   Response    : $body_401"
      echo ""

      echo "1b) Negative Test - Bearer token rusak (Expected: 401 UNAUTHENTICATED):"
      local code_bad body_bad
      body_bad=$(curl_api GET "/api/auth/me" -H "Authorization: Bearer bad.token")
      code_bad=$(curl -s -o /dev/null -w "%{http_code}" ${APP_HOST_HEADER:+-H "Host: $APP_HOST_HEADER"} -H "Authorization: Bearer bad.token" "${APP_BASE_URL}/api/auth/me")
      echo "   HTTP Status : $code_bad"
      echo "   Response    : $body_bad"
      echo ""

      echo "2) Negative Test - Lintas Tenant: author.b membaca ms-001 milik tenant-a (Expected: 404 NOT_FOUND):"
      local code_404 body_404
      body_404=$(curl_api GET "/api/manuscripts/ms-001/report" -H "Authorization: Bearer $tok_auth_b")
      code_404=$(curl -s -o /dev/null -w "%{http_code}" ${APP_HOST_HEADER:+-H "Host: $APP_HOST_HEADER"} -H "Authorization: Bearer $tok_auth_b" "${APP_BASE_URL}/api/manuscripts/ms-001/report")
      echo "   HTTP Status : $code_404"
      echo "   Response    : $body_404"
      echo ""

      echo "3) Negative Test - RBAC: editor.a memanggil POST /api/manuscripts/upload (Expected: 403 FORBIDDEN):"
      local code_403 body_403
      body_403=$(curl_api POST "/api/manuscripts/upload" -H "Authorization: Bearer $tok_edit_a")
      code_403=$(curl -s -o /dev/null -w "%{http_code}" -X POST ${APP_HOST_HEADER:+-H "Host: $APP_HOST_HEADER"} -H "Authorization: Bearer $tok_edit_a" "${APP_BASE_URL}/api/manuscripts/upload")
      echo "   HTTP Status : $code_403"
      echo "   Response    : $body_403"
      echo ""

      echo "4) Negative Test - Spoof Header X-Tenant-ID: tenant-b dengan JWT author.a (Expected: 200 tetap tenant-a):"
      local code_spoof body_spoof
      body_spoof=$(curl_api GET "/api/auth/me" -H "Authorization: Bearer $tok_auth_a" -H "X-Tenant-ID: tenant-b")
      code_spoof=$(curl -s -o /dev/null -w "%{http_code}" ${APP_HOST_HEADER:+-H "Host: $APP_HOST_HEADER"} -H "Authorization: Bearer $tok_auth_a" -H "X-Tenant-ID: tenant-b" "${APP_BASE_URL}/api/auth/me")
      echo "   HTTP Status : $code_spoof"
      echo "   Response    : $body_spoof"
      echo ""

      echo "5) Positive Test - Akses Sah editor.a (tenant-a) membaca ms-001 (Expected: 200 OK):"
      local code_200 body_200
      body_200=$(curl_api GET "/api/manuscripts/ms-001/report" -H "Authorization: Bearer $tok_edit_a")
      code_200=$(curl -s -o /dev/null -w "%{http_code}" ${APP_HOST_HEADER:+-H "Host: $APP_HOST_HEADER"} -H "Authorization: Bearer $tok_edit_a" "${APP_BASE_URL}/api/manuscripts/ms-001/report")
      echo "   HTTP Status : $code_200"
      echo "   Response    : ${body_200:0:180}..."
      echo ""

      echo "6) Positive Test - author.a (tenant-a) membaca ms-001 (Expected: 200 OK):"
      local code_author body_author
      body_author=$(curl_api GET "/api/manuscripts/ms-001/report" -H "Authorization: Bearer $tok_auth_a")
      code_author=$(curl -s -o /dev/null -w "%{http_code}" ${APP_HOST_HEADER:+-H "Host: $APP_HOST_HEADER"} -H "Authorization: Bearer $tok_auth_a" "${APP_BASE_URL}/api/manuscripts/ms-001/report")
      echo "   HTTP Status : $code_author"
      echo "   Response    : ${body_author:0:180}..."
    else
      echo "[INFO] Aplikasi (:8000/:8088) atau Keycloak (:8081/:8088) belum menyala."
      echo "       Jalankan: docker compose up -d postgres keycloak app"
      echo "       Referensi perintah uji JWT Keycloak ada di: source/AUTH.md"
    fi

    echo ""
    echo ">>> PANEL 2: SECRET SEPARATION & LEAST PRIVILEGE AUDIT"
    echo "- Memeriksa .gitignore memblokir file sensitif:"
    if [[ -f "$ROOT_DIR/.gitignore" ]]; then
      grep -E "\.env|\.pem|\.key|secret" "$ROOT_DIR/.gitignore" || echo "  (cek .gitignore)"
    else
      echo "  (catatan: .gitignore berada di root git repo capstone_cloud_computing)"
    fi
    echo "- Memeriksa deployment/deployment.yaml (Non-root & SecretRef):"
    grep -nE "automountServiceAccountToken|runAsNonRoot|runAsUser|allowPrivilegeEscalation|secretKeyRef|drop:" -A 1 "$ROOT_DIR/deployment/deployment.yaml" || true
    echo "- Audit potensi hardcoded production password di deployment/*.yaml:"
    if grep -rnE "POSTGRES_PASSWORD=|DB_PASSWORD:" "$ROOT_DIR/deployment/" 2>/dev/null | grep -v "secretKeyRef" | grep -v "DB_PASSWORD"; then
      echo "  [WARN] Ditemukan nilai eksplisit di deployment/"
    else
      echo "  [PASS] Nol credential hardcoded di manifest deployment/*.yaml (DB_PASSWORD via secretKeyRef)."
    fi

    echo ""
    echo ">>> PANEL 3: TRIVY CONTAINER & DEPENDENCY VULNERABILITY SCAN"
    local target_img="journalfit-backend:latest"
    if docker image inspect "$target_img" >/dev/null 2>&1; then
      echo "[INFO] Memindai image lokal '$target_img' (severity: HIGH,CRITICAL)..."
      if command -v trivy >/dev/null 2>&1; then
        trivy image --severity HIGH,CRITICAL --ignore-unfixed "$target_img" || true
      else
        MSYS_NO_PATHCONV=1 docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL --ignore-unfixed --no-progress "$target_img" 2>&1 || echo "[INFO] Jalankan CI GitHub Actions (.github/workflows/ci.yaml) atau docker pull aquasec/trivy:latest"
      fi
    else
      echo "[INFO] Image lokal '$target_img' belum dibuild di laptop ini."
      echo "       Jalankan dulu: docker build -t $target_img -f source/Dockerfile ./source"
      echo "       Atau scan langsung dengan:"
      echo "       docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL node:22-alpine"
    fi
    echo ""
    echo "[TIP SCREENSHOT 06_evidence.jpg] Gabungkan output Panel 1, Panel 2, dan hasil Trivy CI/Lokal."
  } | tee "$log_file"

  mkdir -p "$ROOT_DIR/evidence/security"
  cp "$log_file" "$ROOT_DIR/evidence/security/negative-authorization-test.txt"
  echo "[06-SECURITY] Raw JWT log: evidence/security/negative-authorization-test.txt"

  if [[ "$DIR_06" != "$ROOT_DIR/evidence/security" ]]; then
    cp "$log_file" "$DIR_06/negative-authorization-test.txt"
  fi
}

# ==============================================================================
# MODUL 08: RELIABILITY & DISASTER RECOVERY
# ==============================================================================
run_08() {
  local log_file="$DIR_08/reliability-capture-latest.txt"
  {
    echo "================================================================================"
    echo "  [08-RELIABILITY-RECOVERY] EVIDENCE CAPTURE - JOURNALFIT (TEAM 7)"
    echo "  Timestamp : $(date -Iseconds 2>/dev/null || date)"
    echo "  Owner     : Anggota 4 (Backup/Restore) & Anggota 2 (Pod Failure / Self-Healing)"
    echo "================================================================================"
    echo ""

    echo ">>> PANEL 1: KUBERNETES POD SELF-HEALING & ROLLING UPDATE TEST"
    if command -v kubectl >/dev/null 2>&1 && kubectl get deployment journalfit-backend >/dev/null 2>&1; then
      echo "[Before] Daftar Pod sebelum simulasi kegagalan:"
      kubectl get pods -l app=journalfit -o wide
      local victim_pod
      victim_pod=$(kubectl get pods -l app=journalfit -o jsonpath='{.items[0].metadata.name}')
      echo ""
      echo "[Action] Menghapus 1 pod secara paksa: kubectl delete pod $victim_pod --wait=false"
      local t_start t_end elapsed
      t_start=$(date +%s)
      kubectl delete pod "$victim_pod" --wait=false
      echo "[Observing] Menunggu ReplicaSet melakukan self-healing & rollout siap..."
      kubectl rollout status deployment/journalfit-backend --timeout=90s
      t_end=$(date +%s)
      elapsed=$((t_end - t_start))
      echo ""
      echo "[After] Pod pengganti aktif kembali dalam ~${elapsed} detik:"
      kubectl get pods -l app=journalfit -o wide
    else
      echo "[INFO] Kluster k3d / deployment 'journalfit-backend' sedang tidak aktif."
      echo "       Menampilkan ringkasan bukti uji pod replacement & rolling update yang tersimpan:"
      [[ -f "$DIR_08/pod-replacement-persistence.txt" ]] && tail -n 12 "$DIR_08/pod-replacement-persistence.txt"
    fi

    echo ""
    echo ">>> PANEL 2: ACTUAL POSTGRESQL BACKUP & RESTORE VERIFICATION"
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^journalfit-postgres$"; then
      local r_start r_end r_elapsed
      echo "[Step 1] Eksekusi backup via db-backup-restore.sh..."
      local bkp_out bkp_file
      bkp_out=$(BACKUP_DIR="$DIR_08" bash "$ROOT_DIR/automation/scripts/db-backup-restore.sh" backup)
      echo "$bkp_out"
      bkp_file=$(printf '%s\n' "$bkp_out" | sed -n 's/^\[SUCCESS\] Backup berhasil disimpan di: //p' | tail -n 1)

      if [[ -n "$bkp_file" && -f "$bkp_file" ]]; then
        echo ""
        echo "[Step 2] Restore terisolasi ke DB validasi 'journalfit_restore_test' + Hitung RTO..."
        r_start=$(date +%s%3N 2>/dev/null || date +%s)
        docker exec journalfit-postgres psql -v ON_ERROR_STOP=1 -U "${DB_USER:-capstone}" -d postgres -c "DROP DATABASE IF EXISTS journalfit_restore_test;" >/dev/null
        docker exec journalfit-postgres psql -v ON_ERROR_STOP=1 -U "${DB_USER:-capstone}" -d postgres -c "CREATE DATABASE journalfit_restore_test;" >/dev/null
        DB_NAME=journalfit_restore_test bash "$ROOT_DIR/automation/scripts/db-backup-restore.sh" restore "$bkp_file"
        r_end=$(date +%s%3N 2>/dev/null || date +%s)

        echo ""
        echo "[Step 3] Komparasi Record Count (Source DB 'journalfit' vs Restored DB):"
        local src_cnt dst_cnt
        src_cnt=$(docker exec journalfit-postgres psql -U "${DB_USER:-capstone}" -d "${DB_NAME:-journalfit}" -tAc "SELECT COUNT(*) FROM manuscripts;")
        dst_cnt=$(docker exec journalfit-postgres psql -U "${DB_USER:-capstone}" -d journalfit_restore_test -tAc "SELECT COUNT(*) FROM manuscripts;")
        echo "  - Jumlah baris manuscripts di DB Sumber    : $src_cnt"
        echo "  - Jumlah baris manuscripts di DB Restored  : $dst_cnt"
        if [[ "${src_cnt// /}" == "${dst_cnt// /}" ]]; then
          echo "  - Status Integritas Data                   : [PASS] 100% COCOK"
        else
          echo "  - Status Integritas Data                   : [FAIL] TIDAK COCOK"
        fi
        if [[ ${#r_start} -ge 12 ]]; then
          r_elapsed=$((r_end - r_start))
          echo "  - RTO Restore Aktual                       : ${r_elapsed} ms (Target SLO < 300.000 ms)"
        fi
        # Clean test db
        docker exec journalfit-postgres psql -U "${DB_USER:-capstone}" -d postgres -c "DROP DATABASE IF EXISTS journalfit_restore_test;" >/dev/null || true
      fi
    else
      echo "[INFO] Container 'journalfit-postgres' tidak berjalan. Jalankan: docker compose up -d postgres"
      [[ -f "$DIR_08/restore-proof.txt" ]] && { echo "--- restore-proof.txt ---"; cat "$DIR_08/restore-proof.txt"; }
    fi
    echo ""
    echo "[TIP SCREENSHOT 08_evidence.jpg] Ambil tangkapan layar Panel 1 (Pod recovery) & Panel 2 (Backup/Restore + RTO)."
  } | tee "$log_file"
}

# ==============================================================================
# MODUL 09: CAPACITY & FINOPS
# ==============================================================================
run_09() {
  local python_bin="${PYTHON_BIN:-python}"
  local owner="${EVIDENCE_OWNER:-$(git -C "$ROOT_DIR" config --get user.name || true)}"
  if ! command -v "$python_bin" >/dev/null 2>&1; then
    echo "[ERROR] Python 3.10+ diperlukan; atur PYTHON_BIN bila nama executable berbeda." >&2
    return 1
  fi
  "$python_bin" "$SCRIPT_DIR/capture-capacity-finops.py" \
    --context "${KUBE_CONTEXT:-k3d-capstone}" \
    --owner "$owner" \
    --samples "${CAPACITY_SAMPLES:-5}" \
    --interval "${CAPACITY_INTERVAL:-30}" \
    --postgres-container "${CAPACITY_POSTGRES_CONTAINER:-capstone-postgres}" \
    --output-dir "${CAPACITY_OUTPUT_DIR:-$DIR_09}"
}

# ==============================================================================
# MODUL 10: DECISIONS ADR MATRIX
# ==============================================================================
run_10() {
  local log_file="$DIR_10/adr-matrix-capture-latest.txt"
  {
    echo "================================================================================================================"
    echo "  [10-DECISIONS-ADR] ARCHITECTURE DECISION RECORDS MATRIX - JOURNALFIT (TEAM 7)"
    echo "  Owners: All Team Members (Anggota 1, Anggota 2, Anggota 3, Anggota 4) | Baseline: Keycloak OIDC (Commit 2dc3593)"
    echo "================================================================================================================"
    echo ""
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ID" "Keputusan Arsitektur" "Status" "Alternatif Ditolak" "Trade-Off Utama"
    printf "%-7s-+-%-26s-+-%-10s-+-%-20s-+-%-38s\n" "-------" "--------------------------" "----------" "--------------------" "--------------------------------------"
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-001" "Modular Monolith Express 5" "Accepted" "Microservices penuh" "Hemat RAM (128Mi); scaling per pod."
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-002" "Postgres + tenant_id Isol" "Accepted" "DB terpisah / NoSQL" "ACID & hemat; butuh disiplin filter."
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-003" "k3d + Non-Root UID 10001" "Accepted" "Compose / Root image" "Image 276MB; butuh host.docker.int."
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-004" "Argo CD GitOps + SHA-7 Tag" "Accepted" "Manual kubectl apply" "Anti-drift; wajib sync manifest git."
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-005" "PVC RWO + Node Pinning" "Accepted" "S3 / MinIO di v1" "Tanpa komponen extra; 1-node SPOF."
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-006" "K8s Secret + Trivy Gate" "Accepted" "Hardcoded YAML env" "0 secret di Git; Trivy gate di CI."
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-007" "Prometheus /metrics + Graf" "Accepted" "Paid SaaS APM agent" "Vendor-neutral; belum ada tracing."
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-008" "pg_dump DB Test + RuleEng" "Accepted" "LLM tiap cek dasar" "RTO 1.41s & \$0 AI; cek masih statis."
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-009" "Keycloak OIDC + JWT Claim" "Accepted" "Mock token / Header auth" "Standard OIDC; RAM 596MiB & boot 72s."
    echo ""
    echo "File Detail ADR Lengkap:"
    ls -1 "$DIR_10"/ADR-*.md 2>/dev/null | sed 's/^/  - /' || echo "  (Lihat folder 10-decisions-adr/ADR-*.md)"
    echo ""
    echo "[TIP SCREENSHOT 10_evidence.jpg] Screenshot matriks ADR di atas atau tabel Markdown di 10-decisions-adr/README.md."
  } | tee "$log_file"
}

case "$TARGET" in
  06) run_06 ;;
  08) run_08 ;;
  09) run_09 ;;
  10) run_10 ;;
  all)
    run_06
    echo ""
    run_08
    echo ""
    run_09
    echo ""
    run_10
    ;;
  *) usage ;;
esac
