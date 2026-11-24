#!/usr/bin/env bash
# ==============================================================================
# fix-k3d-host-alias.sh
# Ensure `host.k3d.internal` resolves inside pods on an existing k3d cluster.
#
# k3d v5.9 does not always inject this alias into CoreDNS when the cluster is
# created without --host-alias. The nodename/host-gateway is taken from the
# Docker network, not from `getent` inside the node (which is unavailable in
# the k3s image).
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

KUBE_CONTEXT="${KUBE_CONTEXT:-k3d-capstone}"
K3D_NETWORK="${K3D_NETWORK:-capstone-net}"
COREDNS_NAMESPACE="${COREDNS_NAMESPACE:-kube-system}"
COREDNS_CONFIGMAP="${COREDNS_CONFIGMAP:-coredns}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker tidak ditemukan." >&2
  exit 1
fi
if ! command -v kubectl >/dev/null 2>&1; then
  echo "[ERROR] kubectl tidak ditemukan." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] node dibutuhkan untuk membuat JSON patch." >&2
  exit 1
fi

if ! docker network inspect "$K3D_NETWORK" >/dev/null 2>&1; then
  echo "[ERROR] Docker network '$K3D_NETWORK' tidak ditemukan." >&2
  exit 1
fi

GATEWAY="$(docker network inspect "$K3D_NETWORK" \
  --format '{{(index .IPAM.Config 0).Gateway}}')"

if [[ -z "$GATEWAY" ]]; then
  echo "[ERROR] Gateway untuk network '$K3D_NETWORK' tidak ditemukan." >&2
  exit 1
fi

HOSTS="$(kubectl --context "$KUBE_CONTEXT" -n "$COREDNS_NAMESPACE" \
  get configmap "$COREDNS_CONFIGMAP" -o jsonpath='{.data.NodeHosts}' 2>/dev/null || true)"

if [[ -z "$HOSTS" ]]; then
  echo "[ERROR] CoreDNS NodeHosts tidak ditemukan di $COREDNS_NAMESPACE/$COREDNS_CONFIGMAP." >&2
  exit 1
fi

if printf '%s\n' "$HOSTS" | grep -q 'host\.k3d\.internal'; then
  echo "[INFO] host.k3d.internal sudah ada di CoreDNS:"
  printf '%s\n' "$HOSTS" | grep 'host\.k3d\.internal'
  exit 0
fi

echo "[INFO] Menambahkan '$GATEWAY host.k3d.internal' ke CoreDNS NodeHosts..."
NEW_HOSTS="$(printf '%s\n%s host.k3d.internal\n' "${HOSTS%$'\n'}" "$GATEWAY")"
PATCH="$(NEW_HOSTS="$NEW_HOSTS" node -e \
  'process.stdout.write(JSON.stringify({ data: { NodeHosts: process.env.NEW_HOSTS } }))')"

kubectl --context "$KUBE_CONTEXT" -n "$COREDNS_NAMESPACE" \
  patch configmap "$COREDNS_CONFIGMAP" --type merge -p "$PATCH"

kubectl --context "$KUBE_CONTEXT" -n "$COREDNS_NAMESPACE" \
  rollout restart deployment/coredns

kubectl --context "$KUBE_CONTEXT" -n "$COREDNS_NAMESPACE" \
  rollout status deployment/coredns --timeout=120s

echo "[SUCCESS] host.k3d.internal -> $GATEWAY"
echo "[INFO] Verifikasi dari pod, misalnya:"
echo "  kubectl --context $KUBE_CONTEXT -n default exec deploy/journalfit-backend -- sh -c 'nslookup host.k3d.internal && nc -zv host.k3d.internal 5433'"
