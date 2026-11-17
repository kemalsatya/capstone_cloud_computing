#!/usr/bin/env bash
# ==============================================================================
# create-cluster.sh - Membuat cluster k3d terintegrasi untuk JournalFit
# Digunakan oleh: Anggota 2 (Platform & K8s)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

CLUSTER_NAME="${K3D_CLUSTER_NAME:-capstone}"
HTTP_PORT="${K3D_HTTP_PORT:-8088}"
HTTPS_PORT="${K3D_HTTPS_PORT:-8443}"
REGISTRY_CONFIG="$ROOT_DIR/deployment/k3d-registries.yaml"

echo "=== MEMBUAT CLUSTER K3D JOURNALFIT ==="
echo "Nama Cluster: $CLUSTER_NAME"
echo "HTTP Port:    $HTTP_PORT"
echo "HTTPS Port:   $HTTPS_PORT"

# Pastikan network bridge docker compose capstone-net sudah tersedia
if ! docker network inspect capstone-net >/dev/null 2>&1; then
  echo "[INFO] Membuat docker network 'capstone-net'..."
  docker network create capstone-net
fi

if k3d cluster list --no-headers 2>/dev/null | awk '{print $1}' | grep -qx "$CLUSTER_NAME"; then
  echo "[INFO] Cluster $CLUSTER_NAME sudah ada."
else
  echo "[INFO] Membuat cluster k3d baru..."
  k3d cluster create "$CLUSTER_NAME" \
    --servers 1 \
    --agents 1 \
    --network capstone-net \
    --api-port 6550 \
    -p "${HTTP_PORT}:80@loadbalancer" \
    -p "${HTTPS_PORT}:443@loadbalancer" \
    --registry-config "$REGISTRY_CONFIG" \
    --wait
fi

echo "[INFO] Mengambil status node..."
kubectl get nodes -o wide

echo "[INFO] Memberikan label storage pada node agent sesuai INTEGRATION_CONTRACT..."
# Labeling node agent agar PVC local-path & Pod backend terschedul sesuai nodeSelector
AGENT_NODE=$(kubectl get nodes --no-headers -l '!node-role.kubernetes.io/control-plane' -o custom-columns=":metadata.name" | head -n 1)
if [ -n "$AGENT_NODE" ]; then
  kubectl label node "$AGENT_NODE" journalfit-storage=uploads --overwrite
  echo "[SUCCESS] Node $AGENT_NODE berhasil dilabeli 'journalfit-storage=uploads'."
else
  # Fallback jika single node control-plane
  CONTROL_NODE=$(kubectl get nodes --no-headers -o custom-columns=":metadata.name" | head -n 1)
  kubectl label node "$CONTROL_NODE" journalfit-storage=uploads --overwrite
  echo "[NOTICE] Node $CONTROL_NODE dilabeli 'journalfit-storage=uploads'."
fi

echo "[SUCCESS] Cluster k3d siap digunakan!"
