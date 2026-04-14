#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: ./run-pgtap.sh <test-file>"
  exit 1
fi

: "${DATABASE_URL:?DATABASE_URL env var required}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$1"
