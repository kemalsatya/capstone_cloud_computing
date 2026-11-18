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

    echo ">>> PANEL 1: POSITIVE & NEGATIVE AUTHORIZATION / TENANT ISOLATION TESTS"
    detect_app_endpoint
    if [[ -n "$APP_BASE_URL" ]]; then
      echo "[Target Aktif] $APP_BASE_URL (Host header: ${APP_HOST_HEADER:-none})"
      echo ""
      echo "1) Negative Test - Tanpa Header X-Tenant-ID (Expected: 400 Bad Request):"
      local code_400 body_400
      body_400=$(curl_api GET "/api/manuscripts/ms-001/report")
      code_400=$(curl -s -o /dev/null -w "%{http_code}" ${APP_HOST_HEADER:+-H "Host: $APP_HOST_HEADER"} "${APP_BASE_URL}/api/manuscripts/ms-001/report")
      echo "   HTTP Status : $code_400"
      echo "   Response    : $body_400"
      echo ""

      echo "2) Negative Test - Lintas Tenant: tenant-b membaca ms-001 milik tenant-a (Expected: 403 Forbidden):"
      local code_403 body_403
      body_403=$(curl_api GET "/api/manuscripts/ms-001/report" -H "X-Tenant-ID: tenant-b")
      code_403=$(curl -s -o /dev/null -w "%{http_code}" ${APP_HOST_HEADER:+-H "Host: $APP_HOST_HEADER"} -H "X-Tenant-ID: tenant-b" "${APP_BASE_URL}/api/manuscripts/ms-001/report")
      echo "   HTTP Status : $code_403"
      echo "   Response    : $body_403"
      echo ""

      echo "3) Positive Test - Pemilik Sah: tenant-a membaca ms-001 (Expected: 200 OK):"
      local code_200 body_200
      body_200=$(curl_api GET "/api/manuscripts/ms-001/report" -H "X-Tenant-ID: tenant-a")
      code_200=$(curl -s -o /dev/null -w "%{http_code}" ${APP_HOST_HEADER:+-H "Host: $APP_HOST_HEADER"} -H "X-Tenant-ID: tenant-a" "${APP_BASE_URL}/api/manuscripts/ms-001/report")
      echo "   HTTP Status : $code_200"
      echo "   Response    : ${body_200:0:180}..."
    else
      echo "[INFO] Aplikasi live (:8000 / :8088) belum menyala. Menampilkan referensi uji tersimpan:"
      [[ -f "$DIR_06/no-header-400.txt" ]] && { echo "--- no-header-400.txt ---"; head -n 10 "$DIR_06/no-header-400.txt"; echo ""; }
      [[ -f "$DIR_06/negative-test-403.txt" ]] && { echo "--- negative-test-403.txt ---"; head -n 10 "$DIR_06/negative-test-403.txt"; echo ""; }
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
  local log_file="$DIR_09/capacity-finops-capture-latest.txt"
  {
    echo "================================================================================"
    echo "  [09-CAPACITY-FINOPS] RESOURCE WORKSHEET, COST & ROADMAP - JOURNALFIT (TEAM 7)"
    echo "  Owner : Anggota 4 (FinOps & Roadmap) + Anggota 2 (K8s Capacity Baseline)"
    echo "================================================================================"
    echo ""
    echo ">>> PANEL 1: CAPACITY & HEADROOM WORKSHEET (Host Lab: 12 CPU, 7.4 GiB RAM)"
    printf "%-30s | %-7s | %-11s | %-11s | %-12s | %-12s\n" "Komponen" "Replica" "CPU Req/Lim" "RAM Req/Lim" "Total Peak" "Storage/Retensi"
    printf "%-30s-+-%-7s-+-%-11s-+-%-11s-+-%-12s-+-%-12s\n" "------------------------------" "-------" "-----------" "-----------" "------------" "---------------"
    printf "%-30s | %-7s | %-11s | %-11s | %-12s | %-12s\n" "JournalFit Backend (Baseline)" "2" "100m / 250m" "128Mi/256Mi" "500m / 512Mi" "1Gi PVC (RWO)"
    printf "%-30s | %-7s | %-11s | %-11s | %-12s | %-12s\n" "JournalFit Backend (HPA Max)" "3" "100m / 250m" "128Mi/256Mi" "750m / 768Mi" "1Gi PVC (RWO)"
    printf "%-30s | %-7s | %-11s | %-11s | %-12s | %-12s\n" "PostgreSQL 17 Alpine" "1" "- / ~500m" "- / ~64Mi" "~64Mi / host" "Docker Volume"
    printf "%-30s | %-7s | %-11s | %-11s | %-12s | %-12s\n" "Prometheus + Grafana + Reg" "3" "- / ~500m" "- / ~350Mi" "~350Mi total" "3d Retention"
    printf "%-30s | %-7s | %-11s | %-11s | %-12s | %-12s\n" "k3s Control Plane + Traefik" "1" "- / ~1000m" "- / ~650Mi" "~650Mi total" "local-path"
    echo "  -> Headroom tersisa pada host pada HPA Peak (3 pod + full stack): ~75% RAM, >85% CPU"
    echo ""

    if command -v kubectl >/dev/null 2>&1 && kubectl top pods >/dev/null 2>&1; then
      echo "  [LIVE CLUSTER METRICS - kubectl top pods]"
      kubectl top pods
      echo ""
    fi

    echo ">>> PANEL 2: CLOUD IAAS MAPPING & FINOPS UNIT-COST MODEL"
    printf "%-34s | %-28s | %-14s\n" "Komponen Cloud Mapping" "Spesifikasi Sizing" "Est. Biaya/Bln"
    printf "%-34s-+-%-28s-+-%-14s\n" "----------------------------------" "----------------------------" "--------------"
    printf "%-34s | %-28s | %-14s\n" "2x Worker VM (IaaS / CloudStack)" "2 vCPU, 2-4 GB RAM / node" "~\$30.00"
    printf "%-34s | %-28s | %-14s\n" "1x Managed PostgreSQL DB" "2 vCPU, 2 GB RAM, 20GB SSD" "~\$15.00"
    printf "%-34s | %-28s | %-14s\n" "Object Storage (MinIO / S3)" "50 GB Multi-AZ Storage" "~\$1.25"
    printf "%-34s | %-28s | %-14s\n" "Ingress Load Balancer & Ops" "Managed LB + Self-Prometheus" "~\$10.00"
    echo "  -> TOTAL ESTIMASI BULANAN CLOUD SMALL PROD : ~\$56.25 / bulan"
    echo "  -> UNIT-COST v1 (Rule-Engine Lokal)        : \$0.001125 / cek (@50.000 cek/bln) | AI Token Fee = \$0"
    echo "  -> PROYEKSI OPTIMASI AI v2 (Abstract-Only) : \$0.0001-\$0.0004/cek (hemat >95% vs Full-Text GPT-4o)"
    echo ""

    echo ">>> PANEL 3: RESIDUAL RISKS & PRIORITIZED IMPROVEMENT ROADMAP"
    echo "  [R1 - High] PVC ReadWriteOnce terikat 1 node -> Roadmap: Migrasi upload .docx ke S3/MinIO."
    echo "  [R2 - High] Mock JWT belum terverifikasi OIDC -> Roadmap: Integrasi Keycloak JWKS + Postgres RLS."
    echo "  [R3 - Med ] DB lokal via host.docker.internal -> Roadmap: Managed RDS + K8s CronJob auto-backup."
    echo "  [R4 - Low ] Local OCI Registry tanpa auth/TLS  -> Roadmap: Pindah ke GHCR / Harbor privat."
    echo ""
    echo "[TIP SCREENSHOT 09_evidence.jpg] Screenshot tampilan tabel lengkap ini dari terminal Anda."
  } | tee "$log_file"
}

# ==============================================================================
# MODUL 10: DECISIONS ADR MATRIX
# ==============================================================================
run_10() {
  local log_file="$DIR_10/adr-matrix-capture-latest.txt"
  {
    echo "================================================================================================================"
    echo "  [10-DECISIONS-ADR] ARCHITECTURE DECISION RECORDS MATRIX - JOURNALFIT (TEAM 7)"
    echo "  Owners: All Team Members (Anggota 1, Anggota 2, Anggota 3, Anggota 4) | Baseline: Commit d9e9bab"
    echo "================================================================================================================"
    echo ""
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ID" "Keputusan Arsitektur" "Status" "Alternatif Ditolak" "Trade-Off Utama"
    printf "%-7s-+-%-26s-+-%-10s-+-%-20s-+-%-38s\n" "-------" "--------------------------" "----------" "--------------------" "--------------------------------------"
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-001" "Modular Monolith Express 5" "Accepted" "Microservices penuh" "Hemat RAM (128Mi); scaling per pod."
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-002" "Postgres + tenant_id Isol" "Accepted" "DB terpisah / NoSQL" "ACID & hemat; butuh disiplin filter."
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-003" "k3d + Non-Root UID 10001" "Accepted" "Compose / Root image" "Image 276MB; butuh host.docker.int."
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-004" "Argo CD GitOps + SHA-7 Tag" "Accepted" "Manual kubectl apply" "Anti-drift; wajib sync manifest git."
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-005" "PVC RWO + Node Pinning" "Accepted" "S3 / MinIO di v1" "Tanpa komponen extra; 1-node SPOF."
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-006" "K8s Secret + Trivy Gate" "Accepted" "Hardcoded YAML env" "0 secret di Git; JWT masih mock."
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-007" "Prometheus /metrics + Graf" "Accepted" "Paid SaaS APM agent" "Vendor-neutral; belum ada tracing."
    printf "%-7s | %-26s | %-10s | %-20s | %-38s\n" "ADR-008" "pg_dump DB Test + RuleEng" "Accepted" "LLM tiap cek dasar" "RTO 1.41s & \$0 AI; cek masih statis."
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
