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

if k3d cluster list --no-headers 2>/dev/null | awk '{print $1}' | grep -qx "$CLUSTER_NAME"; then
  echo "[INFO] Cluster $CLUSTER_NAME sudah ada."
  k3d kubeconfig merge "$CLUSTER_NAME" --kubeconfig-switch-context >/dev/null 2>&1 || true
else
  echo "[INFO] Membuat cluster k3d baru..."
  k3d cluster create "$CLUSTER_NAME" \
    --servers 1 \
    --agents 1 \
    --network capstone-net \
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

# Pastikan host.k3d.internal tersedia di CoreDNS NodeHosts (fallback untuk k3d di Docker Desktop Windows/macOS)
EXISTING_HOSTS=$(kubectl -n kube-system get configmap coredns -o jsonpath='{.data.NodeHosts}' 2>/dev/null || true)
if [ -n "$EXISTING_HOSTS" ] && ! printf '%s\n' "$EXISTING_HOSTS" | grep -q 'host\.k3d\.internal'; then
  HOST_GW_IP=$(docker exec "k3d-${CLUSTER_NAME}-server-0" sh -c "getent hosts host.docker.internal | awk '{print \$1}' | head -n 1" 2>/dev/null || true)
  if [ -n "$HOST_GW_IP" ]; then
    echo "[INFO] Menambahkan alias '$HOST_GW_IP host.k3d.internal' ke CoreDNS NodeHosts..."
    NEW_HOSTS=$(printf '%s\n%s host.k3d.internal\n' "${EXISTING_HOSTS%$'\n'}" "$HOST_GW_IP")
    kubectl -n kube-system create configmap coredns --from-literal="NodeHosts=$NEW_HOSTS" --dry-run=client -o json \
      | kubectl -n kube-system patch configmap coredns --type merge -p "$(cat)" >/dev/null 2>&1 || true
    kubectl -n kube-system rollout restart deployment/coredns >/dev/null 2>&1 || true
    kubectl -n kube-system rollout status deployment/coredns --timeout=60s >/dev/null 2>&1 || true
    echo "[SUCCESS] Alias host.k3d.internal ($HOST_GW_IP) aktif di CoreDNS."
  fi
fi

echo "[SUCCESS] Cluster k3d siap digunakan!"
