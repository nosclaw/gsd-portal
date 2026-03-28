#!/usr/bin/env sh
set -eu

BASE_URL="${1:-http://localhost:29000}"

curl -fsSL "${BASE_URL}/api/health/live" >/dev/null
curl -fsSL "${BASE_URL}/api/health/ready" >/dev/null

echo "Health checks passed for ${BASE_URL}"

