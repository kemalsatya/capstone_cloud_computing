FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    PORT=8000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force \
    && groupadd --gid 10001 appuser \
    && useradd --uid 10001 --gid appuser --no-create-home --shell /usr/sbin/nologin appuser \
    && install -d -o appuser -g appuser /app/uploads

COPY src/ ./src/

USER 10001:10001
EXPOSE 8000

CMD ["node", "src/index.js"]
