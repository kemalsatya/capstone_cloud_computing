#!/usr/bin/env bash
# ==============================================================================
# install-argocd.sh - Memasang Argo CD dan menghubungkan repositori GitOps
# Digunakan oleh: Anggota 2 & Anggota 3
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

ARGOCD_VERSION="${ARGOCD_VERSION:-v2.11.0}"
APP_MANIFEST="$ROOT_DIR/automation/argocd/application.yaml"

echo "=== MEMASANG OPERATOR ARGO CD KE K3D ==="

# 1. Pastikan namespace argocd ada
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -

# 2. Pasang manifest resmi Argo CD
echo "[INFO] Menerapkan manifest instalasi Argo CD ($ARGOCD_VERSION)..."
kubectl apply -n argocd --server-side --force-conflicts \
  -f "https://raw.githubusercontent.com/argoproj/argo-cd/${ARGOCD_VERSION}/manifests/install.yaml"

echo "[INFO] Menunggu argo-cd server siap..."
kubectl -n argocd rollout status deployment/argocd-server --timeout=180s

# 3. Buat secret DB password jika belum ada di namespace default agar pod tidak CrashLoop
echo "[INFO] Memastikan Secret 'journalfit-backend-secret' tersedia di namespace default..."
kubectl create secret generic journalfit-backend-secret \
  --namespace default \
  --from-literal=DB_PASSWORD="${DB_PASSWORD:-capstone}" \
  --dry-run=client -o yaml | kubectl apply -f -

# 4. Secret Keycloak agar pod tidak Pending saat Argo menyinkronkan manifest.
#    Database `keycloak` tetap harus dibuat lebih dulu:
#    bash automation/scripts/setup-keycloak.sh
echo "[INFO] Memastikan Secret Keycloak tersedia di namespace default..."
kubectl create secret generic keycloak-db-secret \
  --namespace default \
  --from-literal=KC_DB_PASSWORD="${KC_DB_PASSWORD:-${DB_PASSWORD:-capstone}}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic keycloak-admin-secret \
  --namespace default \
  --from-literal=KC_BOOTSTRAP_ADMIN_PASSWORD="${KC_BOOTSTRAP_ADMIN_PASSWORD:-admin}" \
  --dry-run=client -o yaml | kubectl apply -f -

# 5. Terapkan Application manifest
if [ -f "$APP_MANIFEST" ]; then
  echo "[INFO] Menerapkan Argo CD Application dari $APP_MANIFEST..."
  kubectl apply -f "$APP_MANIFEST"
  kubectl -n argocd get applications.argoproj.io
fi

echo "[SUCCESS] Instalasi Argo CD selesai!"
echo "Untuk membuka Argo CD UI lokal, jalankan port-forward:"
echo "  kubectl port-forward svc/argocd-server -n argocd 8082:443"
echo "Buka: https://localhost:8082"
echo "Password admin awal dapat diambil dengan:"
echo "  kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath=\"{.data.password}\" | base64 -d && echo"
