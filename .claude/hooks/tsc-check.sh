#!/bin/bash
# Run tsc --noEmit but skip if it ran within the last 30 seconds
# This prevents multiple consecutive edits from each triggering a full type check

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
LOCKFILE="/tmp/lostcity-tsc-last-run"

# Check if tsc ran within the last 30 seconds
if [ -f "$LOCKFILE" ]; then
    LAST_RUN=$(cat "$LOCKFILE")
    NOW=$(date +%s)
    ELAPSED=$((NOW - LAST_RUN))
    if [ "$ELAPSED" -lt 30 ]; then
        exit 0
    fi
fi

# Record this run
date +%s > "$LOCKFILE"

# Run tsc from the web directory
cd "$PROJECT_DIR/web" && npx tsc --noEmit --pretty 2>&1 | head -30

# Exit with tsc's exit code so Claude sees errors
exit ${PIPESTATUS[0]}
