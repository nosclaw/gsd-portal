# ── Stage 1: Install dependencies ──
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# ── Stage 2: Build application ──
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG AUTH_SECRET="build-time-placeholder"
ENV AUTH_SECRET=${AUTH_SECRET}
RUN bun run build

# ── Stage 3: Runtime base (system packages + GSD) ──
# This stage runs IN PARALLEL with Stage 2 — no dependency between them.
# Heavy installs cached here, only rebuilds when GSD version or system deps change.
FROM node:22-slim AS runtime-base
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
      git curl tini ca-certificates && \
    rm -rf /var/lib/apt/lists/* /usr/share/doc/* /usr/share/man/*
COPY docker/scripts/install-gsd.sh /tmp/install-gsd.sh
RUN chmod +x /tmp/install-gsd.sh && /tmp/install-gsd.sh && rm /tmp/install-gsd.sh

# ── Stage 4: Final image ──
# Only COPY layers here — rebuilds in seconds on code changes.
FROM runtime-base AS runner
WORKDIR /app
ENV HOSTNAME=0.0.0.0 PORT=3000

# Startup script (checks node-pty on boot in case GSD was updated)
COPY docker/scripts/rebuild-pty.sh /usr/local/bin/rebuild-pty
RUN printf '#!/bin/sh\nrebuild-pty 2>/dev/null || true\nif [ -f /app/ws-proxy.js ]; then node /app/ws-proxy.js & fi\nexec node server.js\n' > /app/start.sh && chmod +x /app/start.sh

# External node_modules (changes on dependency updates)
COPY --from=builder /app/node_modules/@libsql ./node_modules/@libsql
COPY --from=builder /app/node_modules/libsql ./node_modules/libsql
COPY --from=builder /app/node_modules/ws ./node_modules/ws
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Static assets (changes on UI updates)
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Application code (changes most frequently — always last)
COPY --from=builder /app/.next/standalone ./

EXPOSE 3000 3001

ENTRYPOINT ["tini", "-g", "--"]
CMD ["/app/start.sh"]
