#!/usr/bin/env bash
set -euo pipefail

PORT="${PERF_PORT:-4010}"
BASE_URL="${BASE_URL:-http://127.0.0.1:${PORT}}"
HOST="${PERF_HOST:-127.0.0.1}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "Building web app..."
npm run build >/tmp/lostcity_perf_local_build.log 2>&1

echo "Starting server on ${HOST}:${PORT}..."
HOSTNAME="${HOST}" npm run start -- -p "${PORT}" >/tmp/lostcity_perf_local_server.log 2>&1 &
SERVER_PID=$!

for attempt in {1..40}; do
  if curl -fsS "${BASE_URL}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "${attempt}" -eq 40 ]]; then
    echo "Server did not become ready in time"
    exit 1
  fi
done

echo "Running perf:check against ${BASE_URL}"
BASE_URL="${BASE_URL}" npm run perf:check

echo "Local perf check passed"
