FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG AUTH_SECRET="build-time-placeholder"
ENV AUTH_SECRET=${AUTH_SECRET}
RUN bun run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Install runtime dependencies and GSD CLI
RUN apk add --no-cache git bash curl && npm install -g gsd-pi

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# External packages excluded from webpack bundle
COPY --from=builder /app/node_modules/@libsql ./node_modules/@libsql
COPY --from=builder /app/node_modules/libsql ./node_modules/libsql
COPY --from=builder /app/node_modules/ws ./node_modules/ws
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

EXPOSE 3000

CMD ["node", "server.js"]
