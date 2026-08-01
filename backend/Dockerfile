# CodeBook backend — Node 22 + Express + Prisma, deployed via Coolify on the Hetzner VPS.
# Follows docs/DOCKER_VPS_BACKEND_PLAYBOOK.md conventions: dependency layer cached first,
# non-root user, HEALTHCHECK, PORT env. Parent: REQ-1210.

FROM node:22-slim

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Prisma needs openssl at runtime on Debian slim images
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Dependency layer cached separately from source (layer cache — only reinstalls on lockfile change)
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev \
    && npx prisma generate

COPY . .

# Writable dirs + non-root user
RUN groupadd --system --gid 10001 appgroup \
    && useradd --system --uid 10001 --gid appgroup --home-dir /app --no-create-home appuser \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
