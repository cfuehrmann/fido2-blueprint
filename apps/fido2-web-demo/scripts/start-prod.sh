#!/bin/sh
# Production start script that reads configuration from environment variables
# Usage: PORT=3001 HOSTNAME=127.0.0.1 ./scripts/start-prod.sh

NEXT_PORT="${PORT:-3000}"
NEXT_HOSTNAME="${HOSTNAME:-0.0.0.0}"

exec npx next start --hostname "$NEXT_HOSTNAME" --port "$NEXT_PORT"
