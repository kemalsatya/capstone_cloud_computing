#!/usr/bin/env bash
# ==============================================================================
# db-backup-restore.sh - Backup & Disaster Recovery Database JournalFit
# Digunakan oleh: Anggota 4 (Security, Ops & Recovery) untuk bukti recovery
# ==============================================================================
set -euo pipefail

MODE="${1:-}"
CONTAINER_NAME="${DB_CONTAINER:-journalfit-postgres}"
DB_USER="${DB_USER:-capstone}"
DB_NAME="${DB_NAME:-journalfit}"
BACKUP_DIR="evidence/reliability-recovery"

usage() {
  echo "Penggunaan: $0 {backup|restore <file_backup.sql>}"
  exit 1
}

if [ -z "$MODE" ]; then
  usage
fi

mkdir -p "$BACKUP_DIR"

if [ "$MODE" = "backup" ]; then
  TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
  OUT_FILE="$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.sql"
  echo "[INFO] Melakukan backup PostgreSQL database '$DB_NAME' dari container '$CONTAINER_NAME'..."
  docker exec -t "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean > "$OUT_FILE"
  echo "[SUCCESS] Backup berhasil disimpan di: $OUT_FILE"
  echo "Ukuran file: $(wc -c < "$OUT_FILE") bytes"

elif [ "$MODE" = "restore" ]; then
  IN_FILE="${2:-}"
  if [ -z "$IN_FILE" ] || [ ! -f "$IN_FILE" ]; then
    echo "[ERROR] File backup tidak ditemukan: $IN_FILE" >&2
    usage
  fi

  echo "[INFO] Merestore PostgreSQL database '$DB_NAME' dari: $IN_FILE..."
  docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < "$IN_FILE"
  
  echo "[INFO] Memvalidasi tabel setelah restore..."
  docker exec -t "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
  "
  echo "[SUCCESS] Restore dan verifikasi berhasil diselesaikan!"
else
  usage
fi
