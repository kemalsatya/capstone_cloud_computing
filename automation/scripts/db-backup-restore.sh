#!/usr/bin/env bash
# ==============================================================================
# db-backup-restore.sh - Backup, restore, dan verifikasi JournalFit
# Mencakup PostgreSQL aplikasi (termasuk skema pgboss), DB Keycloak, dan
# objek Garage beserta manifest sha256.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load .env only for variables that are not already set, so explicit exports
# (for example from Kubernetes Secrets) win.
if [ -f "$ROOT_DIR/.env" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      ''|'#'*) continue ;;
    esac
    key="${line%%=*}"
    value="${line#*=}"
    key="$(printf '%s' "$key" | xargs)"
    value="${value%$'\r'}"
    value="${value#\"}"
    value="${value%\"}"
    value="${value#\'}"
    value="${value%\'}"
    if [ -n "$key" ] && [ -z "${!key-}" ]; then
      export "$key=$value"
    fi
  done < "$ROOT_DIR/.env"
fi

MODE="${1:-}"
CONTAINER_NAME="${DB_CONTAINER:-journalfit-postgres}"
DB_USER="${DB_USER:-capstone}"
DB_PASSWORD="${DB_PASSWORD:-capstone}"
DB_HOST_FOR_VERIFY="${DB_HOST_FOR_VERIFY:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-journalfit}"
KEYCLOAK_DB_NAME="${KEYCLOAK_DB_NAME:-keycloak}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/evidence/reliability-recovery}"
GARAGE_ENDPOINT_HOST="${GARAGE_ENDPOINT_HOST:-http://127.0.0.1:3900}"

usage() {
  echo "Penggunaan: $0 {backup|restore <direktori_backup|file.sql>|verify <direktori_backup>}"
  exit 1
}

if [ -z "$MODE" ]; then
  usage
fi

mkdir -p "$BACKUP_DIR"

check_database_connection() {
  local database="$1"
  if ! docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$database" -c 'SELECT 1' >/dev/null 2>&1; then
    echo "[ERROR] Gagal konek ke database '$database' sebagai user '$DB_USER'." >&2
    echo "[HINT] Cek DB_USER/DB_PASSWORD. Variabel environment yang sudah di-export mengalahkan .env." >&2
    echo "[HINT] Contoh: unset DB_USER DB_PASSWORD, lalu jalankan ulang." >&2
    exit 1
  fi
}

printf '[INFO] DB_CONTAINER=%s DB_USER=%s DB_NAME=%s\n' \
  "$CONTAINER_NAME" "$DB_USER" "$DB_NAME"

verify_database() {
  local backup_path="$1"
  DB_HOST="$DB_HOST_FOR_VERIFY" \
  DB_PORT="$DB_PORT" \
  DB_USER="$DB_USER" \
  DB_PASSWORD="$DB_PASSWORD" \
  DB_NAME="$DB_NAME" \
    node "$ROOT_DIR/source/scripts/verify-restore.js" "$backup_path"
}

backup_garage() {
  local output_dir="$1"
  if [ "${SKIP_GARAGE:-0}" = "1" ]; then
    echo "[INFO] Backup Garage dilewati karena SKIP_GARAGE=1."
    return
  fi

  BACKUP_DIR="$output_dir/garage" \
  S3_ENDPOINT="$GARAGE_ENDPOINT_HOST" \
    node "$ROOT_DIR/source/scripts/garage-backup.js"
}

restore_garage() {
  local backup_dir="$1"
  if [ "${SKIP_GARAGE:-0}" = "1" ] || [ ! -f "$backup_dir/garage/manifest.json" ]; then
    echo "[INFO] Manifest Garage tidak ada atau SKIP_GARAGE=1; restore objek dilewati."
    return
  fi

  BACKUP_DIR="$backup_dir/garage" \
  S3_ENDPOINT="$GARAGE_ENDPOINT_HOST" \
    node "$ROOT_DIR/source/scripts/garage-restore.js"
}

restore_database() {
  local database="$1"
  local dump_file="$2"

  if [ ! -f "$dump_file" ]; then
    echo "[WARN] Dump '$dump_file' tidak ditemukan; dilewati."
    return
  fi

  if [ ! -s "$dump_file" ]; then
    echo "[ERROR] Dump '$dump_file' kosong. Backup sebelumnya kemungkinan gagal." >&2
    echo "[HINT] Hapus direktori backup tersebut lalu jalankan backup ulang." >&2
    exit 1
  fi

  if [ "$database" = "$KEYCLOAK_DB_NAME" ]; then
    local exists
    exists="$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='$KEYCLOAK_DB_NAME'")"
    if [ "$exists" != "1" ]; then
      docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c \
        "CREATE DATABASE \"$KEYCLOAK_DB_NAME\""
    fi
  fi

  echo "[INFO] Restore database '$database' dari $dump_file..."
  docker exec -i "$CONTAINER_NAME" pg_restore -U "$DB_USER" -d "$database" \
    --clean --if-exists --no-owner --no-privileges < "$dump_file"
}

if [ "$MODE" = "backup" ]; then
  check_database_connection "$DB_NAME"

  TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
  OUT_DIR="$BACKUP_DIR/backup_${TIMESTAMP}"
  mkdir -p "$OUT_DIR"

  echo "[INFO] Backup PostgreSQL '$DB_NAME'..."
  if ! docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc \
    > "$OUT_DIR/${DB_NAME}.dump"; then
    rm -f "$OUT_DIR/${DB_NAME}.dump"
    echo "[ERROR] Backup database '$DB_NAME' gagal; file dump kosong dihapus." >&2
    exit 1
  fi

  if docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='$KEYCLOAK_DB_NAME'" | grep -q 1; then
    echo "[INFO] Backup PostgreSQL '$KEYCLOAK_DB_NAME'..."
    if ! docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$KEYCLOAK_DB_NAME" -Fc \
      > "$OUT_DIR/${KEYCLOAK_DB_NAME}.dump"; then
      rm -f "$OUT_DIR/${KEYCLOAK_DB_NAME}.dump"
      echo "[ERROR] Backup database '$KEYCLOAK_DB_NAME' gagal; file dump kosong dihapus." >&2
      exit 1
    fi
  else
    echo "[WARN] Database '$KEYCLOAK_DB_NAME' tidak ditemukan; dilewati."
  fi

  backup_garage "$OUT_DIR"

  echo "[SUCCESS] Backup tersimpan di: $OUT_DIR"
  echo "Isi:"
  ls -1 "$OUT_DIR"
elif [ "$MODE" = "restore" ]; then
  IN_PATH="${2:-}"
  if [ -z "$IN_PATH" ]; then
    usage
  fi

  if [ -d "$IN_PATH" ]; then
    restore_database "$DB_NAME" "$IN_PATH/${DB_NAME}.dump"
    restore_database "$KEYCLOAK_DB_NAME" "$IN_PATH/${KEYCLOAK_DB_NAME}.dump"
    restore_garage "$IN_PATH"

    echo "[INFO] Verifikasi restore..."
    verify_database "$IN_PATH/garage"
    echo "[SUCCESS] Restore dan verifikasi selesai."
  elif [ -f "$IN_PATH" ]; then
    echo "[INFO] Restore legacy SQL ke '$DB_NAME' dari $IN_PATH..."
    docker exec -i "$CONTAINER_NAME" psql -v ON_ERROR_STOP=1 -U "$DB_USER" \
      -d "$DB_NAME" < "$IN_PATH"
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c \
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
    echo "[SUCCESS] Restore legacy selesai."
  else
    usage
  fi
elif [ "$MODE" = "verify" ]; then
  IN_PATH="${2:-}"
  if [ -z "$IN_PATH" ] || [ ! -f "$IN_PATH/garage/manifest.json" ]; then
    echo "[ERROR] Direktori backup atau manifest Garage tidak ditemukan: $IN_PATH/garage/manifest.json" >&2
    usage
  fi
  verify_database "$IN_PATH/garage"
else
  usage
fi
