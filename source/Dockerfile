# ==============================================================================
# Dockerfile for JournalFit Backend (Modular Monolith)
# Runtime: Node 22, non-root UID/GID aligned with the Kubernetes manifest
# Port: 8000
# ==============================================================================

FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS base

# Forward signals through PID 1; application request draining is a separate concern.
RUN apk add --no-cache dumb-init \
    && addgroup -S -g 10001 journalfit \
    && adduser -S -D -u 10001 -G journalfit journalfit

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=8000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations
RUN mkdir -p /app/uploads && chown journalfit:journalfit /app/uploads

USER 10001:10001
EXPOSE 8000

# Keep the application command visible; dumb-init forwards termination signals.
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["node", "src/index.js"]
