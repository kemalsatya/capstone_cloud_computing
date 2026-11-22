#!/usr/bin/env bash
# ==============================================================================
# doctor.sh - Diagnosa Kesiapan Lingkungan Laptop Anggota Kelompok JournalFit
# ==============================================================================
set -u

printf '%s\n' '==================================================='
printf '%s\n' '   JournalFit Capstone Infrastructure Doctor Check   '
printf '%s\n' '==================================================='
fail=0

check() {
  local label="$1"; shift
  printf '%-20s' "$label"
  if "$@" >/tmp/journalfit-doctor.out 2>/tmp/journalfit-doctor.err; then
    echo "OK"
    head -n 1 /tmp/journalfit-doctor.out | sed 's/^/  /'
  else
    echo "MISSING / FAILED"
    fail=1
  fi
}

echo "[1/4] Pengecekan Tool Dasar (Semua Anggota):"
check "Git" git --version
check "Docker" docker --version
check "Docker Compose" docker compose version
check "Node.js" node --version
check "NPM" npm --version
check "cURL" curl --version

echo
echo "[2/4] Pengecekan Tool K8s & GitOps (Anggota 2 & 3):"
check "kubectl" kubectl version --client
check "k3d" k3d version

echo
echo "[3/4] Status Docker Engine Daemon:"
if docker info >/dev/null 2>&1; then
  echo '  Docker engine: RUNNING'
else
  echo '  Docker engine: NOT RUNNING (Pastikan Docker Desktop / service docker aktif)'
  fail=1
fi

echo
echo "[4/4] Ketersediaan Port Penting di Host:"
ports=(8000 5432 3001 2222 5001 8088 8443 9090 3000)
for port in "${ports[@]}"; do
  if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ":$port "; then
    echo "  Port $port: SEDANG DIGUNAKAN (In Use)"
  else
    echo "  Port $port: Tersedia (Available)"
  fi
done

echo
printf '%s\n' '==================================================='
if [ "$fail" -eq 0 ]; then
  echo 'Status Laptop: SIAP UNTUK MENJALANKAN JOURNALFIT (READY)'
else
  echo 'Status Laptop: ADA TOOL YANG BELUM TERSEDIA (ACTION REQUIRED)'
fi
printf '%s\n' '==================================================='
exit "$fail"
