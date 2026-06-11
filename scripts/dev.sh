#!/bin/bash
# Development startup script for Creator Hub
set -e

echo "=== Starting Creator Hub Dev Environment ==="

# 1. Start infrastructure
echo "[1/5] Starting Docker services..."
docker compose up -d
sleep 2

# 2. Install deps
echo "[2/5] Installing dependencies..."
pnpm install

# 3. Generate Prisma client
echo "[3/5] Generating Prisma client..."
DATABASE_URL="postgresql://creatorhub:creatorhub@localhost:5433/creatorhub" \
  pnpm --filter @creator-hub/database exec prisma generate

# 4. Push schema and seed
echo "[4/5] Pushing database schema..."
DATABASE_URL="postgresql://creatorhub:creatorhub@localhost:5433/creatorhub" \
  pnpm --filter @creator-hub/database exec prisma db push --skip-generate
DATABASE_URL="postgresql://creatorhub:creatorhub@localhost:5433/creatorhub" \
  pnpm --filter @creator-hub/database exec tsx src/seed.ts

# 5. Start dev servers
echo "[5/5] Starting development servers..."
echo "  API:  http://localhost:3001"
echo "  Web:  http://localhost:3000"

# Start API in background
DATABASE_URL="postgresql://creatorhub:creatorhub@localhost:5433/creatorhub" \
  JWT_SECRET="dev-secret" \
  REDIS_HOST="localhost" \
  REDIS_PORT="6379" \
  cd apps/api && npx nest start --watch &
API_PID=$!

# Start Web in background
cd ../web && npx next dev -p 3000 &
WEB_PID=$!

# Handle cleanup
cleanup() {
  echo "Shutting down..."
  kill $API_PID $WEB_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

wait
