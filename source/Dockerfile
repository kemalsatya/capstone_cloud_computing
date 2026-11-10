# ==============================================================================
# Dockerfile for JournalFit Backend (Modular Monolith)
# Standard: Non-root user, lightweight base, hardened for Trivy scanning
# Port: 8000
# ==============================================================================

FROM node:22-alpine AS base

# Install dumb-init for proper signal handling (PID 1) in container runtime
RUN apk add --no-cache dumb-init

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=8000


COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node
EXPOSE 8000

# Use dumb-init as entrypoint to properly handle graceful shutdown signals (SIGTERM/SIGINT) in Kubernetes
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "src/index.js"]
