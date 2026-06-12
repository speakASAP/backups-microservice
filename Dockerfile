FROM node:24-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-slim

WORKDIR /app

# Install WAL-G 3.0.3 pgbackup (logical dump mode — no PGDATA required)
RUN apt-get update && apt-get install -y curl ca-certificates --no-install-recommends \
  && curl -fsSL https://github.com/wal-g/wal-g/releases/download/v3.0.3/wal-g-pg-ubuntu-20.04-amd64 \
       -o /usr/local/bin/wal-g \
  && chmod +x /usr/local/bin/wal-g \
  && apt-get purge -y curl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY web ./web
COPY scripts ./scripts

EXPOSE ${PORT:-3398}

CMD ["node", "dist/src/main"]
