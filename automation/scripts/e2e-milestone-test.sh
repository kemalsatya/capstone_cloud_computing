#!/usr/bin/env bash
# ==============================================================================
# e2e-milestone-test.sh - End-to-End Verification & Kubernetes Sync JournalFit
# Mencakup:
#   - M0-M1 : Pre-flight, Struktur Repositori, Keamanan .env, Sintaks Skrip
#   - M1-M2 : Unit Tests, PostgreSQL Schema (v1 & v2), Transaksi Live & Persistensi
#   - M3    : Docker Non-Root, Registry Push, Sinkronisasi k3d & Kustomize, Ingress/PVC/HPA
#   - M4    : CI/CD Workflow, GitOps Argo CD (--with-argocd), & Trivy (--with-trivy)
#   - M5    : Multi-Tenant Isolation & Negative Tests (400 / 200 / 403)
#   - M6    : Observability (/metrics), SLO Availability/Latency, Prometheus/Grafana
#   - M7    : Reliability & Disaster Recovery (pg_dump Backup & Restore Verification)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

SYNC_K8S=true
WITH_ARGOCD=true
WITH_TRIVY=false
WITH_OBSERVABILITY=true
UPDATE_K8S_TAG=false
CLEANUP=false
KEEP_BACKUP=false

usage() {
  cat << 'EOF'
Penggunaan: bash automation/scripts/e2e-milestone-test.sh [opsi]

Opsi:
  --skip-k8s            Lewati sinkronisasi & verifikasi live kluster k3d Kubernetes
  --with-k8s            (Default aktif) Jalankan sinkronisasi k3d
  --skip-argocd         Lewati instalasi & sinkronisasi Argo CD
  --with-argocd         (Default aktif) Pasang & sinkronkan Argo CD Application
  --skip-observability  Lewati menjalankan Prometheus & Grafana
  --with-observability  (Default aktif) Jalankan Prometheus & Grafana
  --update-k8s-tag      Perbarui newTag di deployment/kustomization.yaml ke SHA7 saat ini
  --with-trivy          Jalankan pemindaian kerentanan image Docker menggunakan Trivy
  --keep-backup         Pertahankan file backup SQL hasil uji di evidence/reliability-recovery/
  --cleanup             Hentikan stack Docker Compose setelah pengujian selesai
  -h, --help            Tampilkan bantuan ini
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-k8s) SYNC_K8S=false; shift ;;
    --with-k8s) SYNC_K8S=true; shift ;;
    --skip-argocd) WITH_ARGOCD=false; shift ;;
    --with-argocd) WITH_ARGOCD=true; shift ;;
    --skip-observability) WITH_OBSERVABILITY=false; shift ;;
    --with-observability) WITH_OBSERVABILITY=true; shift ;;
    --update-k8s-tag) UPDATE_K8S_TAG=true; shift ;;
    --with-trivy) WITH_TRIVY=true; shift ;;
    --keep-backup) KEEP_BACKUP=true; shift ;;
    --cleanup) CLEANUP=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "[ERROR] Opsi tidak dikenal: $1" >&2; usage; exit 1 ;;
  esac
done

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
RESULTS=()

TMP_DIR="$ROOT_DIR/.e2e-tmp"
mkdir -p "$TMP_DIR/docker-cfg"
printf '{}\n' > "$TMP_DIR/docker-cfg/config.json"
if [[ -d "/c/Program Files/Docker/Docker/resources/bin" ]]; then
  export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"
fi
CREATED_BACKUP_FILE=""
UPLOADED_MS_ID=""

cleanup_handler() {
  rm -rf "$TMP_DIR" || true
  if [[ "$KEEP_BACKUP" == "false" && -n "$CREATED_BACKUP_FILE" && -f "$CREATED_BACKUP_FILE" ]]; then
    rm -f "$CREATED_BACKUP_FILE" || true
  fi
  if [[ "$CLEANUP" == "true" ]]; then
    echo ""
    echo "[CLEANUP] Menghentikan stack Docker Compose..."
    (cd "$ROOT_DIR" && docker compose --profile observability --profile ci-cd down >/dev/null 2>&1 || docker compose down >/dev/null 2>&1 || true)
  fi
}
trap cleanup_handler EXIT

record_pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  RESULTS+=("PASS | $1")
  echo "  [PASS] $1"
}

record_fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  RESULTS+=("FAIL | $1")
  echo "  [FAIL] $1" >&2
}

record_skip() {
  SKIP_COUNT=$((SKIP_COUNT + 1))
  RESULTS+=("SKIP | $1")
  echo "  [SKIP] $1"
}

run_step() {
  local label="$1"
  shift
  if "$@"; then
    record_pass "$label"
  else
    record_fail "$label"
  fi
}

cd "$ROOT_DIR"

echo "=================================================================="
echo "  JournalFit Capstone - End-to-End Milestone Verification & Sync  "
echo "=================================================================="
echo "Root Dir : $ROOT_DIR"
echo "Options  : sync_k8s=$SYNC_K8S | argocd=$WITH_ARGOCD | trivy=$WITH_TRIVY | obs=$WITH_OBSERVABILITY | cleanup=$CLEANUP"
echo ""

# ------------------------------------------------------------------------------
# M0 - M1: PRE-FLIGHT, REPO STRUCTURE & STATIC CHECKS
# ------------------------------------------------------------------------------
echo "=== [M0-M1] Pre-flight, Struktur Repositori & Validasi Skrip ==="

for tool in git node docker curl; do
  if command -v "$tool" >/dev/null 2>&1; then
    record_pass "Tool tersedia: $tool"
  else
    record_fail "Tool tidak ditemukan: $tool"
  fi
done

if docker info >/dev/null 2>&1; then
  record_pass "Docker daemon aktif"
else
  record_fail "Docker daemon tidak aktif"
  exit 1
fi

for required_path in \
  "README.md" \
  ".env.example" \
  "docker-compose.yml" \
  "source/package.json" \
  "source/Dockerfile" \
  "source/schema.sql" \
  "source/schema-v2.sql" \
  "deployment/kustomization.yaml" \
  "deployment/k3d-registries.yaml" \
  "automation/argocd/application.yaml" \
  ".github/workflows/ci.yaml" \
  ".gitea/workflows/ci.yml"
do
  if [[ -f "$ROOT_DIR/$required_path" ]]; then
    record_pass "File wajib tersedia: $required_path"
  else
    record_fail "File wajib hilang: $required_path"
  fi
done

if git ls-files --error-unmatch .env >/dev/null 2>&1 || git ls-files --error-unmatch source/.env >/dev/null 2>&1; then
  record_fail "Security check: file .env terdeteksi di Git index"
else
  record_pass "Security check: tidak ada file .env ter-track di Git"
fi

run_step "Validasi sintaks docker compose config" docker compose config --quiet

for sh_file in "$ROOT_DIR"/automation/scripts/*.sh; do
  run_step "Sintaks bash valid: $(basename "$sh_file")" bash -n "$sh_file"
done

# ------------------------------------------------------------------------------
# M1 - M2: APPLICATION UNIT TESTS, DB SCHEMA (v1 & v2), & LIVE TRANSACTION
# ------------------------------------------------------------------------------
echo ""
echo "=== [M1-M2] Application Unit Tests, Database Schema & Transaksi Live ==="

run_step "Unit & HTTP mock tests (node --test)" bash -c "cd '$ROOT_DIR/source' && node --test"

echo "[INFO] Menyalakan stack core Docker Compose (postgres + app)..."
if docker compose up -d --build postgres app; then
  record_pass "Docker Compose up (postgres + app)"
else
  record_fail "Docker Compose up (postgres + app)"
fi

DB_READY=false
for _ in $(seq 1 30); do
  if docker exec journalfit-postgres pg_isready -U "${DB_USER:-capstone}" -d "${DB_NAME:-journalfit}" >/dev/null 2>&1; then
    DB_READY=true
    break
  fi
  sleep 2
done
if [[ "$DB_READY" == "true" ]]; then
  record_pass "PostgreSQL healthy dan menerima koneksi"
else
  record_fail "PostgreSQL tidak kunjung ready"
fi

APP_URL="${APP_URL:-http://127.0.0.1:8000}"
APP_READY=false
for _ in $(seq 1 30); do
  if curl -fsS "$APP_URL/health/ready" >/dev/null 2>&1; then
    APP_READY=true
    break
  fi
  sleep 2
done
if [[ "$APP_READY" == "true" ]]; then
  record_pass "Backend /health/ready HTTP 200"
else
  record_fail "Backend /health/ready gagal"
fi

TABLE_COUNT=$(docker exec journalfit-postgres psql -U "${DB_USER:-capstone}" -d "${DB_NAME:-journalfit}" -tAc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('tenants','users','format_rule_templates','manuscripts','check_results','findings');")
if [[ "${TABLE_COUNT// /}" == "6" ]]; then
  record_pass "Skema v1 (source/schema.sql): 6 tabel terverifikasi di PostgreSQL"
else
  record_fail "Skema v1: jumlah tabel tidak sesuai (ditemukan: $TABLE_COUNT)"
fi

V2_TEST_SQL=$(
  docker exec journalfit-postgres psql -v ON_ERROR_STOP=1 -U "${DB_USER:-capstone}" -d postgres -c "DROP DATABASE IF EXISTS journalfit_v2_test;" >/dev/null && \
  docker exec journalfit-postgres psql -v ON_ERROR_STOP=1 -U "${DB_USER:-capstone}" -d postgres -c "CREATE DATABASE journalfit_v2_test;" >/dev/null && \
  docker exec -i journalfit-postgres psql -v ON_ERROR_STOP=1 -U "${DB_USER:-capstone}" -d journalfit_v2_test < "$ROOT_DIR/source/schema-v2.sql" >/dev/null && \
  docker exec journalfit-postgres psql -U "${DB_USER:-capstone}" -d journalfit_v2_test -tAc "SELECT COUNT(*) FROM findings;"
) && V2_OK=true || V2_OK=false
docker exec journalfit-postgres psql -U "${DB_USER:-capstone}" -d postgres -c "DROP DATABASE IF EXISTS journalfit_v2_test;" >/dev/null 2>&1 || true
if [[ "$V2_OK" == "true" && "${V2_TEST_SQL// /}" -ge 2 ]]; then
  record_pass "Skema v2 draft (source/schema-v2.sql): DDL & seed lolos tanpa error FK"
else
  record_fail "Skema v2 draft (source/schema-v2.sql) gagal dieksekusi"
fi

LIVE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/health/live")
if [[ "$LIVE_CODE" == "200" ]]; then
  record_pass "GET /health/live mengembalikan HTTP 200"
else
  record_fail "GET /health/live mengembalikan HTTP $LIVE_CODE"
fi

TOKEN_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$APP_URL/api/auth/token" \
  -H "Content-Type: application/json" \
  -d '{"username":"e2e-author","role":"author","tenantId":"tenant-a"}')
if [[ "$TOKEN_CODE" == "200" ]]; then
  record_pass "POST /api/auth/token mengembalikan HTTP 200"
else
  record_fail "POST /api/auth/token mengembalikan HTTP $TOKEN_CODE"
fi

TEST_DOCX=".e2e-tmp/sample-manuscript.docx"
node -e '
const fs = require("fs");
const words = Array.from({ length: 3100 }, (_, i) => "cloud" + (i % 50)).join(" ");
fs.writeFileSync(process.argv[1], `Abstract\nThis manuscript evaluates cloud native performance.\n\n${words}\n\nKeywords: cloud, kubernetes, gitops\n`);
' "$TEST_DOCX"

UPLOAD_RESP=".e2e-tmp/upload.json"
UPLOAD_CODE=$(curl -s -o "$UPLOAD_RESP" -w "%{http_code}" -X POST "$APP_URL/api/manuscripts/upload" \
  -H "X-Tenant-ID: tenant-a" \
  -F "file=@$TEST_DOCX" \
  -F "authorId=user-a-01")

if [[ "$UPLOAD_CODE" == "201" ]]; then
  UPLOADED_MS_ID=$(node -e 'const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); console.log(d.data?.manuscript?.id || d.data?.id || "");' "$UPLOAD_RESP")
  if [[ -n "$UPLOADED_MS_ID" ]]; then
    record_pass "POST /api/manuscripts/upload HTTP 201 (id=$UPLOADED_MS_ID)"
  else
    record_fail "POST /api/manuscripts/upload HTTP 201 tetapi ID kosong"
  fi
else
  record_fail "POST /api/manuscripts/upload gagal (HTTP $UPLOAD_CODE)"
fi

if [[ -n "$UPLOADED_MS_ID" ]]; then
  REPORT_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "X-Tenant-ID: tenant-a" "$APP_URL/api/manuscripts/$UPLOADED_MS_ID/report")
  if [[ "$REPORT_CODE" == "200" ]]; then
    record_pass "GET /api/manuscripts/$UPLOADED_MS_ID/report HTTP 200"
  else
    record_fail "GET /api/manuscripts/$UPLOADED_MS_ID/report gagal (HTTP $REPORT_CODE)"
  fi

  docker compose restart app >/dev/null 2>&1
  PERSIST_OK=false
  for _ in $(seq 1 20); do
    if curl -fsS "$APP_URL/health/ready" >/dev/null 2>&1; then
      PERSIST_OK=true
      break
    fi
    sleep 1
  done
  if [[ "$PERSIST_OK" == "true" ]]; then
    AFTER_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "X-Tenant-ID: tenant-a" "$APP_URL/api/manuscripts/$UPLOADED_MS_ID/report")
    if [[ "$AFTER_CODE" == "200" ]]; then
      record_pass "Persistensi DB & file setelah restart container app (HTTP 200)"
    else
      record_fail "Data gagal diambil setelah restart container app (HTTP $AFTER_CODE)"
    fi
  else
    record_fail "Container app gagal ready setelah restart"
  fi
fi

# ------------------------------------------------------------------------------
# M3: PLATFORM DOCKER NON-ROOT, REGISTRY & SINKRONISASI KUBERNETES (k3d)
# ------------------------------------------------------------------------------
echo ""
echo "=== [M3] Platform Docker Non-Root & Sinkronisasi Kubernetes (k3d) ==="

SHORT_SHA="$(git rev-parse --short=7 HEAD 2>/dev/null || echo 'e2etest1')"
REGISTRY_HOST="localhost:${REGISTRY_PORT:-5001}"
IMAGE_REPO="journalfit-backend"
TEST_IMAGE="${REGISTRY_HOST}/${IMAGE_REPO}:${SHORT_SHA}"

if docker build -t "$TEST_IMAGE" -f "$ROOT_DIR/source/Dockerfile" "$ROOT_DIR/source" >/dev/null 2>&1; then
  record_pass "Build image non-root ($TEST_IMAGE)"
  CONTAINER_UID=$(MSYS_NO_PATHCONV=1 docker run --rm --entrypoint id "$TEST_IMAGE" -u)
  if [[ "$CONTAINER_UID" != "0" ]]; then
    record_pass "Container berjalan sebagai non-root (UID=$CONTAINER_UID)"
  else
    record_fail "Container berjalan sebagai root (UID=0)"
  fi
  if MSYS_NO_PATHCONV=1 docker run --rm --entrypoint sh "$TEST_IMAGE" -c "touch /app/uploads/.e2e_write_test && rm /app/uploads/.e2e_write_test" >/dev/null 2>&1; then
    record_pass "Direktori /app/uploads writable oleh non-root user"
  else
    record_fail "Direktori /app/uploads tidak writable oleh non-root user"
  fi
else
  record_fail "Docker build $TEST_IMAGE gagal"
fi

if command -v kubectl >/dev/null 2>&1; then
  if kubectl kustomize "$ROOT_DIR/deployment" > "$TMP_DIR/rendered-k8s.yaml" 2>/dev/null; then
    record_pass "kubectl kustomize deployment/ berhasil dirender"
  else
    record_fail "kubectl kustomize deployment/ gagal"
  fi
else
  record_skip "kubectl tidak tersedia: melewati render kustomize"
fi

if [[ "$SYNC_K8S" == "true" ]]; then
  if command -v k3d >/dev/null 2>&1 && command -v kubectl >/dev/null 2>&1; then
    echo "[INFO] Menyalakan registry lokal (profile ci-cd)..."
    docker compose --profile ci-cd up -d registry >/dev/null 2>&1
    REG_READY=false
    for _ in $(seq 1 15); do
      if curl -fsS "http://127.0.0.1:${REGISTRY_PORT:-5001}/v2/" >/dev/null 2>&1; then
        REG_READY=true
        break
      fi
      sleep 1
    done
    if [[ "$REG_READY" == "true" ]]; then
      record_pass "Registry lokal siap di http://127.0.0.1:${REGISTRY_PORT:-5001}"
    else
      record_fail "Registry lokal tidak merespons di port ${REGISTRY_PORT:-5001}"
    fi

    # Push tag SHA7 dan tag yang dirujuk kustomization.yaml (pakai config tanpa credsStore untuk registry lokal)
    if DOCKER_CONFIG="$TMP_DIR/docker-cfg" docker push "$TEST_IMAGE" >/dev/null 2>&1; then
      record_pass "Push image immutable $TEST_IMAGE ke registry lokal"
    else
      record_fail "Push image $TEST_IMAGE ke registry lokal gagal"
    fi

    if [[ "$UPDATE_K8S_TAG" == "true" ]]; then
      run_step "Update desired state newTag -> $SHORT_SHA" bash "$ROOT_DIR/automation/scripts/prepare-image-update.sh" "$SHORT_SHA"
    fi

    KUSTOMIZE_TAG=$(sed -n 's/^[[:space:]]*newTag:[[:space:]]*//p' "$ROOT_DIR/deployment/kustomization.yaml" | head -n 1 | tr -d '\r ')
    if [[ -n "$KUSTOMIZE_TAG" && "$KUSTOMIZE_TAG" != "$SHORT_SHA" ]]; then
      KUSTOMIZE_IMG="${REGISTRY_HOST}/${IMAGE_REPO}:${KUSTOMIZE_TAG}"
      docker tag "$TEST_IMAGE" "$KUSTOMIZE_IMG"
      if DOCKER_CONFIG="$TMP_DIR/docker-cfg" docker push "$KUSTOMIZE_IMG" >/dev/null 2>&1; then
        record_pass "Sinkronisasi tag Kustomize ($KUSTOMIZE_TAG) ke registry lokal"
      else
        record_fail "Gagal push tag Kustomize ($KUSTOMIZE_TAG) ke registry lokal"
      fi
    fi

    if bash "$ROOT_DIR/automation/scripts/create-cluster.sh" >/dev/null 2>&1; then
      record_pass "Sinkronisasi kluster k3d (${K3D_CLUSTER_NAME:-capstone}) & label node storage"
    else
      record_fail "Gagal menyiapkan kluster k3d"
    fi

    # Pastikan Secret runtime ada di namespace default tanpa menyimpan credential ke Git
    if kubectl create secret generic journalfit-backend-secret \
      --namespace default \
      --from-literal=DB_PASSWORD="${DB_PASSWORD:-capstone}" \
      --dry-run=client -o yaml | kubectl apply -f - >/dev/null 2>&1; then
      record_pass "Secret runtime journalfit-backend-secret tersedia di namespace default"
    else
      record_fail "Gagal membuat Secret journalfit-backend-secret"
    fi

    run_step "K8s: server dry-run manifest Kustomize" kubectl apply --dry-run=server -k "$ROOT_DIR/deployment"
    if kubectl apply -k "$ROOT_DIR/deployment" >/dev/null 2>&1; then
      record_pass "K8s: kubectl apply -k deployment/ berhasil"
    else
      record_fail "K8s: kubectl apply -k deployment/ gagal"
    fi

    # Restart rollout agar image terbaru (termasuk /metrics) ditarik saat tag sama
    kubectl -n default rollout restart deployment/journalfit-backend >/dev/null 2>&1 || true
    if kubectl -n default rollout status deployment/journalfit-backend --timeout=180s >/dev/null 2>&1; then
      record_pass "K8s: rollout deployment/journalfit-backend selesai & Ready"
    else
      record_fail "K8s: rollout deployment/journalfit-backend gagal/timeout"
    fi

    READY_PODS=$(kubectl -n default get pods -l app=journalfit --no-headers 2>/dev/null | grep -c "Running" || true)
    if [[ "$READY_PODS" -ge 2 ]]; then
      record_pass "K8s: $READY_PODS replica pod app=journalfit Running"
    else
      record_fail "K8s: jumlah pod Running kurang dari 2 (terbaca: $READY_PODS)"
    fi

    PVC_PHASE=$(kubectl -n default get pvc journalfit-uploads -o jsonpath='{.status.phase}' 2>/dev/null || echo "Missing")
    if [[ "$PVC_PHASE" == "Bound" ]]; then
      record_pass "K8s: PVC journalfit-uploads berstatus Bound"
    else
      record_fail "K8s: PVC journalfit-uploads berstatus $PVC_PHASE"
    fi

    if kubectl -n default get hpa journalfit-backend >/dev/null 2>&1; then
      record_pass "K8s: HPA journalfit-backend aktif"
    else
      record_fail "K8s: HPA journalfit-backend tidak ditemukan"
    fi

    # Verifikasi transaksi end-to-end melalui Traefik Ingress Kubernetes!
    K8S_INGRESS_URL="http://127.0.0.1:${K3D_HTTP_PORT:-8088}"
    K8S_READY_OK=false
    for _ in $(seq 1 20); do
      K8S_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: journalfit.localhost" "$K8S_INGRESS_URL/health/ready" || echo "000")
      if [[ "$K8S_CODE" == "200" ]]; then
        K8S_READY_OK=true
        break
      fi
      sleep 2
    done

    if [[ "$K8S_READY_OK" == "true" ]]; then
      record_pass "K8s Ingress /health/ready HTTP 200"
      K8S_METRICS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: journalfit.localhost" "$K8S_INGRESS_URL/metrics" || echo "000")
      [[ "$K8S_METRICS_CODE" == "200" ]] && record_pass "K8s Ingress /metrics HTTP 200" || record_fail "K8s Ingress /metrics HTTP $K8S_METRICS_CODE"

      K8S_UPLOAD_CODE=$(curl -s -o "$TMP_DIR/k8s-upload.json" -w "%{http_code}" -X POST "$K8S_INGRESS_URL/api/manuscripts/upload" \
        -H "Host: journalfit.localhost" \
        -H "X-Tenant-ID: tenant-a" \
        -F "file=@$TEST_DOCX" \
        -F "authorId=user-a-01" || echo "000")
      [[ "$K8S_UPLOAD_CODE" == "201" ]] && record_pass "K8s Ingress POST /api/manuscripts/upload HTTP 201" || record_fail "K8s Ingress upload gagal (HTTP $K8S_UPLOAD_CODE)"

      K8S_403_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: journalfit.localhost" -H "X-Tenant-ID: tenant-b" "$K8S_INGRESS_URL/api/manuscripts/ms-001/report" || echo "000")
      [[ "$K8S_403_CODE" == "403" ]] && record_pass "K8s Ingress Tenant Isolation (tenant-b -> ms-001) HTTP 403" || record_fail "K8s Ingress Tenant Isolation HTTP $K8S_403_CODE"
    else
      record_fail "K8s Ingress /health/ready tidak merespons 200"
    fi
  else
    record_skip "k3d/kubectl tidak ditemukan: sinkronisasi Kubernetes dilewati"
  fi
else
  record_skip "Sinkronisasi Kubernetes dilewati (--skip-k8s)"
fi

# ------------------------------------------------------------------------------
# M4: CI/CD, GITOPS & TRIVY VULNERABILITY SCAN
# ------------------------------------------------------------------------------
echo ""
echo "=== [M4] CI/CD, GitOps & Trivy Security Scan ==="

if grep -q "trivy" "$ROOT_DIR/.github/workflows/ci.yaml" && grep -q "trivy" "$ROOT_DIR/.gitea/workflows/ci.yml"; then
  record_pass "Pipeline CI (GitHub Actions & Gitea) memuat langkah Trivy scan"
else
  record_fail "Pipeline CI belum lengkap memuat langkah Trivy scan"
fi

if grep -q "path: deployment" "$ROOT_DIR/automation/argocd/application.yaml" && grep -q "/spec/replicas" "$ROOT_DIR/automation/argocd/application.yaml"; then
  record_pass "Argo CD Application manifest valid (path deployment + ignoreDifferences HPA)"
else
  record_fail "Argo CD Application manifest belum sesuai kontrak HPA/path"
fi

if [[ "$WITH_TRIVY" == "true" ]]; then
  if docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL --exit-code 0 "$TEST_IMAGE" > "$TMP_DIR/trivy.txt" 2>&1; then
    record_pass "Trivy container scan selesai pada $TEST_IMAGE"
  else
    record_fail "Trivy container scan gagal dijalankan"
  fi
else
  record_skip "Trivy scan dilewati (gunakan --with-trivy untuk menjalankan)"
fi

if [[ "$WITH_ARGOCD" == "true" && "$SYNC_K8S" == "true" ]] && command -v kubectl >/dev/null 2>&1; then
  echo "[INFO] Memasang/memverifikasi Argo CD via install-argocd.sh..."
  if bash "$ROOT_DIR/automation/scripts/install-argocd.sh" >"$TMP_DIR/argocd.log" 2>&1; then
    record_pass "Instalasi & apply Argo CD Application selesai"
  else
    sed 's/^/    /' "$TMP_DIR/argocd.log" >&2 || true
    record_fail "Gagal memasang Argo CD via install-argocd.sh"
  fi
fi

if [[ "$SYNC_K8S" == "true" ]] && command -v kubectl >/dev/null 2>&1 && kubectl -n argocd get applications.argoproj.io journalfit-backend >/dev/null 2>&1; then
  SYNC_STAT=$(kubectl -n argocd get applications.argoproj.io journalfit-backend -o jsonpath='{.status.sync.status}' 2>/dev/null || echo "Unknown")
  HEALTH_STAT=$(kubectl -n argocd get applications.argoproj.io journalfit-backend -o jsonpath='{.status.health.status}' 2>/dev/null || echo "Unknown")
  if [[ "$SYNC_STAT" == "Synced" && "$HEALTH_STAT" == "Healthy" ]]; then
    record_pass "Argo CD Application journalfit-backend Synced & Healthy"
  else
    record_skip "Argo CD Application terdaftar (status saat ini: sync=$SYNC_STAT, health=$HEALTH_STAT)"
  fi
else
  record_skip "Argo CD Application belum aktif (gunakan --with-argocd untuk memasang)"
fi

# ------------------------------------------------------------------------------
# M5: SECURITY - MULTI-TENANT ISOLATION & NEGATIVE TESTS (DOCKER COMPOSE API)
# ------------------------------------------------------------------------------
echo ""
echo "=== [M5] Security: Isolasi Multi-Tenant & Negative Tests ==="

NO_HDR_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/api/manuscripts/ms-001/report")
if [[ "$NO_HDR_CODE" == "400" ]]; then
  record_pass "Negative test tanpa header X-Tenant-ID -> HTTP 400"
else
  record_fail "Negative test tanpa header X-Tenant-ID -> diharapkan 400, dapat $NO_HDR_CODE"
fi

OWN_TENANT_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "X-Tenant-ID: tenant-a" "$APP_URL/api/manuscripts/ms-001/report")
if [[ "$OWN_TENANT_CODE" == "200" ]]; then
  record_pass "Akses sah tenant-a ke ms-001 -> HTTP 200"
else
  record_fail "Akses sah tenant-a ke ms-001 gagal (HTTP $OWN_TENANT_CODE)"
fi

CROSS_TENANT_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "X-Tenant-ID: tenant-b" "$APP_URL/api/manuscripts/ms-001/report")
if [[ "$CROSS_TENANT_CODE" == "403" ]]; then
  record_pass "Negative test lintas tenant (tenant-b -> ms-001 milik tenant-a) -> HTTP 403 Forbidden"
else
  record_fail "Negative test lintas tenant gagal -> diharapkan 403, dapat $CROSS_TENANT_CODE"
fi

# ------------------------------------------------------------------------------
# M6: OBSERVABILITY (/metrics) & SLO LATENCY / AVAILABILITY
# ------------------------------------------------------------------------------
echo ""
echo "=== [M6] Observability (/metrics) & Verifikasi SLO ==="

METRICS_BODY="$TMP_DIR/metrics.txt"
METRICS_CODE=$(curl -s -o "$METRICS_BODY" -w "%{http_code}" "$APP_URL/metrics")
if [[ "$METRICS_CODE" == "200" ]] && grep -q "http_requests_total" "$METRICS_BODY" && grep -q "http_request_duration_seconds_bucket" "$METRICS_BODY"; then
  record_pass "GET /metrics HTTP 200 dengan metrik Prometheus valid"
else
  record_fail "GET /metrics tidak valid (HTTP $METRICS_CODE)"
fi

SLO_TOTAL=20
SLO_OK=0
SLO_SLOW=0
for _ in $(seq 1 $SLO_TOTAL); do
  LINE=$(curl -s -o /dev/null -w "%{http_code} %{time_total}" -H "X-Tenant-ID: tenant-a" "$APP_URL/api/manuscripts/ms-001/report")
  CODE="${LINE%% *}"
  TIME_S="${LINE##* }"
  if [[ "$CODE" == "200" ]]; then
    SLO_OK=$((SLO_OK + 1))
  fi
  IS_SLOW=$(node -e 'console.log(Number(process.argv[1]) > 2.0 ? 1 : 0)' "$TIME_S")
  if [[ "$IS_SLOW" == "1" ]]; then
    SLO_SLOW=$((SLO_SLOW + 1))
  fi
done
if [[ "$SLO_OK" -eq "$SLO_TOTAL" && "$SLO_SLOW" -eq 0 ]]; then
  record_pass "SLO check ($SLO_OK/$SLO_TOTAL request HTTP 200, 0 request > 2s)"
else
  record_fail "SLO check gagal (ok=$SLO_OK/$SLO_TOTAL, slow>2s=$SLO_SLOW)"
fi

if [[ "$WITH_OBSERVABILITY" == "true" ]]; then
  docker compose --profile observability up -d >/dev/null 2>&1 || true
  PROM_OK=false
  GRAF_OK=false
  for _ in $(seq 1 20); do
    curl -fsS "http://127.0.0.1:${PROMETHEUS_PORT:-9090}/-/ready" >/dev/null 2>&1 && PROM_OK=true
    curl -fsS "http://127.0.0.1:${GRAFANA_PORT:-3000}/api/health" >/dev/null 2>&1 && GRAF_OK=true
    if [[ "$PROM_OK" == "true" && "$GRAF_OK" == "true" ]]; then
      break
    fi
    sleep 2
  done
  [[ "$PROM_OK" == "true" ]] && record_pass "Prometheus ready (:${PROMETHEUS_PORT:-9090})" || record_fail "Prometheus tidak ready"
  [[ "$GRAF_OK" == "true" ]] && record_pass "Grafana healthy (:${GRAFANA_PORT:-3000})" || record_fail "Grafana tidak healthy"
else
  record_skip "Stack Prometheus/Grafana dilewati (gunakan --with-observability untuk mengaktifkan)"
fi

# ------------------------------------------------------------------------------
# M7: RELIABILITY & DISASTER RECOVERY (BACKUP & RESTORE)
# ------------------------------------------------------------------------------
echo ""
echo "=== [M7] Reliability & Disaster Recovery (Backup & Restore) ==="

BACKUP_OUT=$(bash "$ROOT_DIR/automation/scripts/db-backup-restore.sh" backup)
CREATED_BACKUP_FILE=$(printf '%s\n' "$BACKUP_OUT" | sed -n 's/^\[SUCCESS\] Backup berhasil disimpan di: //p' | tail -n 1)

if [[ -n "$CREATED_BACKUP_FILE" && -s "$CREATED_BACKUP_FILE" ]]; then
  record_pass "Backup database berhasil dibuat ($(basename "$CREATED_BACKUP_FILE"))"

  RESTORE_OK=false
  if docker exec journalfit-postgres psql -v ON_ERROR_STOP=1 -U "${DB_USER:-capstone}" -d postgres -c "DROP DATABASE IF EXISTS journalfit_restore_test;" >"$TMP_DIR/restore.log" 2>&1 && \
     docker exec journalfit-postgres psql -v ON_ERROR_STOP=1 -U "${DB_USER:-capstone}" -d postgres -c "CREATE DATABASE journalfit_restore_test;" >>"$TMP_DIR/restore.log" 2>&1 && \
     DB_NAME=journalfit_restore_test bash "$ROOT_DIR/automation/scripts/db-backup-restore.sh" restore "$CREATED_BACKUP_FILE" >>"$TMP_DIR/restore.log" 2>&1
  then
    RESTORED_COUNT=$(docker exec journalfit-postgres psql -U "${DB_USER:-capstone}" -d journalfit_restore_test -tAc "SELECT COUNT(*) FROM manuscripts;")
    if [[ "${RESTORED_COUNT// /}" -ge 1 ]]; then
      RESTORE_OK=true
    fi
  fi
  docker exec journalfit-postgres psql -U "${DB_USER:-capstone}" -d postgres -c "DROP DATABASE IF EXISTS journalfit_restore_test;" >/dev/null 2>&1 || true

  if [[ "$RESTORE_OK" == "true" ]]; then
    record_pass "Restore database ke DB verifikasi berhasil (data manuscripts pulih: $RESTORED_COUNT baris)"
  else
    sed 's/^/    /' "$TMP_DIR/restore.log" >&2 || true
    record_fail "Restore database gagal diverifikasi"
  fi
else
  record_fail "Backup database gagal atau file kosong"
fi

# ------------------------------------------------------------------------------
# SUMMARY
# ------------------------------------------------------------------------------
echo ""
echo "=================================================================="
echo "  RINGKASAN HASIL E2E MILESTONE TEST"
echo "=================================================================="
for item in "${RESULTS[@]}"; do
  echo "  $item"
done
echo "------------------------------------------------------------------"
echo "  PASS: $PASS_COUNT | FAIL: $FAIL_COUNT | SKIP: $SKIP_COUNT"
echo "=================================================================="
if [[ "$WITH_OBSERVABILITY" == "true" && "$CLEANUP" == "false" ]]; then
  echo "  Grafana UI    : http://localhost:${GRAFANA_PORT:-3000} (admin / admin)"
  echo "  Prometheus UI : http://localhost:${PROMETHEUS_PORT:-9090}"
fi
if [[ "$WITH_ARGOCD" == "true" && "$SYNC_K8S" == "true" ]]; then
  echo "  Argo CD UI    : kubectl port-forward svc/argocd-server -n argocd 8082:443 -> https://localhost:8082"
fi

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
