#!/usr/bin/env bash
set -euo pipefail

# Skrip simulasi rollback rilis (Anggota 3)
APP_NAME="journalfit-backend"
NAMESPACE="${NAMESPACE:-default}"

echo "=== SIMULASI ROLLBACK KUBERNETES & ARGO CD ==="

echo "[1/4] Status rollout saat ini:"
kubectl rollout status deployment/${APP_NAME} -n ${NAMESPACE} || echo "[NOTICE] Deployment belum aktif di kluster."

echo "[2/4] Riwayat revisi deployment:"
kubectl rollout history deployment/${APP_NAME} -n ${NAMESPACE} || true

echo "[3/4] Menjalankan perintah undo rollback ke revisi sebelumnya:"
kubectl rollout undo deployment/${APP_NAME} -n ${NAMESPACE} || echo "[NOTICE] Belum ada revisi sebelumnya."

echo "[4/4] Memeriksa status pod setelah perintah rollback:"
kubectl get pods -l app=journalfit -n ${NAMESPACE} -o wide || true

echo "[SUCCESS] Verifikasi logika skrip rollback selesai."
