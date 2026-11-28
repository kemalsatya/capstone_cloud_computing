# Garage Backup & Restore

Skrip terkait:

| File | Fungsi |
|---|---|
| `source/scripts/garage-backup.js` | Unduh semua objek bucket ke direktori backup + `manifest.json` sha256 |
| `source/scripts/garage-restore.js` | Unggah ulang objek dari manifest |
| `source/scripts/verify-restore.js` | Bandingkan sha256 manifest dengan `manuscripts.sha256` dan `template_sha256` |
| `automation/scripts/db-backup-restore.sh` | Orkestrasi PostgreSQL `journalfit` + `keycloak` + Garage |

## Menjalankan

```bash
# Backup lengkap
bash automation/scripts/db-backup-restore.sh backup

# Restore dari direktori backup + verifikasi
bash automation/scripts/db-backup-restore.sh restore evidence/reliability-recovery/backup_YYYYMMDD_HHMMSS

# Verifikasi saja
bash automation/scripts/db-backup-restore.sh verify evidence/reliability-recovery/backup_YYYYMMDD_HHMMSS
```

Variabel penting:

- `DB_CONTAINER`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `KEYCLOAK_DB_NAME`
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- `GARAGE_ENDPOINT_HOST` (default `http://127.0.0.1:3900` untuk Compose)
- `SKIP_GARAGE=1` bila hanya ingin backup/restore PostgreSQL

## Batasan

- Bukti restore harus dijalankan pada lingkungan nyata; file ini hanya menjelaskan prosedur.
- Garage saat ini single-node; backup ini tidak membuktikan ketahanan multi-node.
- Target waktu restore PRD (30 menit) harus dicatat dari eksekusi aktual.
