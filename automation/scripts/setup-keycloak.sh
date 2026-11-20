#!/usr/bin/env bash
# ==============================================================================
# setup-keycloak.sh - Prepare the shared PostgreSQL database and Kubernetes
# Secrets required by the Keycloak deployment.
# Owner: Anggota 2 (Platform) with Anggota 1 (Database) / Anggota 4 (Secrets)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

NAMESPACE="${NAMESPACE:-default}"
DB_USER="${DB_USER:-capstone}"
DB_PASSWORD="${DB_PASSWORD:-capstone}"
DB_NAME="${DB_NAME:-keycloak}"
KC_DB_PASSWORD="${KC_DB_PASSWORD:-$DB_PASSWORD}"
KC_BOOTSTRAP_ADMIN_PASSWORD="${KC_BOOTSTRAP_ADMIN_PASSWORD:-admin}"

echo "=== MENYIAPKAN DATABASE DAN SECRET KEYCLOAK ==="

# 1. Create the separate `keycloak` database on the shared PostgreSQL.
#    Prefer the local Compose Postgres; fall back to a host psql client.
if docker compose ps postgres --status running --quiet 2>/dev/null | grep -q .; then
  echo "[INFO] Database keycloak via container journalfit-postgres..."
  if docker compose exec -T postgres psql -U "$DB_USER" -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -qx 1; then
    echo "[INFO] Database $DB_NAME sudah ada."
  else
    docker compose exec -T postgres psql -U "$DB_USER" -d postgres \
      -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  fi
elif command -v psql >/dev/null 2>&1; then
  echo "[INFO] Database keycloak via host psql ${DB_HOST:-localhost}:${DB_PORT:-5432}..."
  if PGPASSWORD="$DB_PASSWORD" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" \
      -U "$DB_USER" -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -qx 1; then
    echo "[INFO] Database $DB_NAME sudah ada."
  else
    PGPASSWORD="$DB_PASSWORD" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" \
      -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  fi
else
  echo "[WARN] Compose Postgres tidak berjalan dan psql tidak tersedia."
  echo "[WARN] Buat database '$DB_NAME' secara manual sebelum deploy Keycloak."
fi

# 2. Create/update the runtime Secrets. Values are never written to Git.
echo "[INFO] Memastikan Secret 'keycloak-db-secret' dan 'keycloak-admin-secret'..."
kubectl -n "$NAMESPACE" create secret generic keycloak-db-secret \
  --from-literal=KC_DB_PASSWORD="$KC_DB_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "$NAMESPACE" create secret generic keycloak-admin-secret \
  --from-literal=KC_BOOTSTRAP_ADMIN_PASSWORD="$KC_BOOTSTRAP_ADMIN_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "[SUCCESS] Database dan Secret Keycloak siap."
echo "Lanjutkan dengan: kubectl --context k3d-capstone apply -k deployment"
