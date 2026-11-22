#!/usr/bin/env bash
set -euo pipefail

# Skrip pembantu build, tag, dan (opsional) push immutable image (Anggota 3)
PUSH_IMAGE=false
if [[ "${1:-}" == "--push" ]]; then
  PUSH_IMAGE=true
fi

COMMIT_SHA=$(git rev-parse --short=7 HEAD 2>/dev/null || echo "manual01")
REGISTRY="${REGISTRY:-localhost:5001}"
IMAGE_NAME="journalfit-backend"
IMAGE_TAG="${REGISTRY}/${IMAGE_NAME}:${COMMIT_SHA}"

echo "[INFO] Menyiapkan immutable container artifact: ${IMAGE_TAG}"

if [ -f "source/Dockerfile" ]; then
  docker build -t "${IMAGE_TAG}" -f source/Dockerfile ./source
elif [ -f "deployment/Dockerfile" ]; then
  docker build -t "${IMAGE_TAG}" -f deployment/Dockerfile .
else
  echo "[NOTICE] Dockerfile asli belum dibuat."
  echo "[NOTICE] Menggunakan base stub Node.js 22 sementara agar build image tetap lolos uji..."
  docker build -t "${IMAGE_TAG}" - << 'EOF'
FROM node:22-alpine
WORKDIR /app
COPY source/package*.json ./
RUN npm ci --omit=dev
COPY source/src ./src
USER node
EXPOSE 8000
CMD ["node", "src/index.js"]
EOF
fi

docker tag "${IMAGE_TAG}" "${REGISTRY}/${IMAGE_NAME}:latest"

if [[ "$PUSH_IMAGE" == "true" ]]; then
  echo "[INFO] Mendorong image ke registry lokal (${IMAGE_TAG})..."
  docker push "${IMAGE_TAG}"
fi

echo "[SUCCESS] Build selesai:"
echo "  - Immutable Tag: ${IMAGE_TAG}"
echo "  - Mutable Tag:   ${REGISTRY}/${IMAGE_NAME}:latest"
echo "  - Langkah GitOps berikutnya (setelah push):"
echo "    bash automation/scripts/prepare-image-update.sh ${COMMIT_SHA}"
