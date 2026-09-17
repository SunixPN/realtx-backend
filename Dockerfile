# syntax=docker/dockerfile:1.6

FROM node:22-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock* package-lock.json* ./
RUN npm ci --legacy-peer-deps

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build \
    && npm prune --omit=dev --legacy-peer-deps


FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN groupadd --system --gid 1001 nodejs \
    && useradd  --system --uid 1001 --gid nodejs nodejs

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

USER nodejs

EXPOSE 3000
CMD ["node", "dist/main.js"]
