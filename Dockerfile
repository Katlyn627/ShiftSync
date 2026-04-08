# ─── Stage 1: Build React client ─────────────────────────────────────────────
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --include=dev
COPY client/ ./
RUN npm run build

# ─── Stage 2: Build Express/TypeScript server ─────────────────────────────────
FROM node:20-alpine AS server-builder
WORKDIR /app/server
# better-sqlite3 requires native compilation tools
RUN apk add --no-cache python3 make g++
COPY server/package*.json ./
RUN npm ci --include=dev
COPY server/ ./
# Compile TypeScript then strip devDependencies
RUN npm run build && npm prune --omit=dev

# ─── Stage 3: Lean production image ───────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Non-root user required by Cloud Run
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Server compiled output + production node_modules
COPY --from=server-builder /app/server/dist      ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY server/package.json                          ./server/package.json

# Built React frontend (served as static files by Express)
COPY --from=client-builder /app/client/dist      ./client/dist

# Writable directory for the SQLite database
RUN mkdir -p /app/data && chown appuser:appgroup /app/data

USER appuser

ENV NODE_ENV=production
ENV DB_PATH=/app/data/shiftsync.db

# Cloud Run injects PORT at runtime; default to 3001 for local Docker runs
EXPOSE 3001

CMD ["node", "server/dist/index.js"]
