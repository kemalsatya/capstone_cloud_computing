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
API_PORT="${K3D_API_PORT:-6550}"
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

NETWORK_GATEWAY="$(docker network inspect capstone-net \
  --format '{{(index .IPAM.Config 0).Gateway}}')"
if [[ -z "$NETWORK_GATEWAY" ]]; then
  echo "[ERROR] Gateway network capstone-net tidak ditemukan." >&2
  exit 1
fi

if k3d cluster list --no-headers 2>/dev/null | awk '{print $1}' | grep -qx "$CLUSTER_NAME"; then
  echo "[INFO] Cluster $CLUSTER_NAME sudah ada."
  k3d kubeconfig merge "$CLUSTER_NAME" --kubeconfig-switch-context >/dev/null 2>&1 || true
else
  echo "[INFO] Membuat cluster k3d baru..."
  k3d cluster create "$CLUSTER_NAME" \
    --servers 1 \
    --agents 1 \
    --network capstone-net \
    --host-alias "${NETWORK_GATEWAY}:host.k3d.internal" \
    --api-port "$API_PORT" \
    -p "${HTTP_PORT}:80@loadbalancer" \
    -p "${HTTPS_PORT}:443@loadbalancer" \
    --registry-config "$REGISTRY_CONFIG" \
    --wait
fi

# Fallback untuk Docker Desktop Windows bila host.docker.internal tidak terjangkau di kubeconfig
if ! kubectl get nodes >/dev/null 2>&1; then
  echo "[WARN] Kubeconfig default tidak terjangkau, mengarahkan server ke https://127.0.0.1:${API_PORT}..."
  kubectl config set-cluster "k3d-${CLUSTER_NAME}" --server="https://127.0.0.1:${API_PORT}" >/dev/null
fi

echo "[INFO] Mengambil status node..."
kubectl get nodes -o wide

echo "[INFO] Memberikan label storage pada node agent sesuai INTEGRATION_CONTRACT..."
AGENT_NODE=$(kubectl get nodes --no-headers -l '!node-role.kubernetes.io/control-plane' -o custom-columns=":metadata.name" | head -n 1)
if [ -n "$AGENT_NODE" ]; then
  kubectl label node "$AGENT_NODE" journalfit-storage=uploads --overwrite
  echo "[SUCCESS] Node $AGENT_NODE berhasil dilabeli 'journalfit-storage=uploads'."
else
  CONTROL_NODE=$(kubectl get nodes --no-headers -o custom-columns=":metadata.name" | head -n 1)
  kubectl label node "$CONTROL_NODE" journalfit-storage=uploads --overwrite
  echo "[NOTICE] Node $CONTROL_NODE dilabeli 'journalfit-storage=uploads'."
fi

# k3d v5.9 tidak selalu menginjeksi host.k3d.internal ke CoreDNS saat cluster
# dibuat tanpa --host-alias. Pastikan alias tersedia juga untuk cluster existing.
KUBE_CONTEXT="k3d-${CLUSTER_NAME}" K3D_NETWORK="capstone-net" \
  bash "$SCRIPT_DIR/fix-k3d-host-alias.sh"

echo "[SUCCESS] Cluster k3d siap digunakan!"
