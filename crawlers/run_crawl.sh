#!/bin/bash
# Daily event crawler script
# Runs all active crawlers and logs output

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/crawl_$(date +%Y%m%d_%H%M%S).log"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Activate virtual environment and run crawlers
cd "$SCRIPT_DIR"
source venv/bin/activate

echo "Starting crawl at $(date)" >> "$LOG_FILE"

DB_TARGET="${CRAWLER_DB_TARGET:-production}"
ARGS=(--db-target "$DB_TARGET")

# Scheduled production runs must opt in explicitly.
if [[ "$DB_TARGET" == "production" ]]; then
  ARGS+=(--allow-production-writes)
fi

python main.py "${ARGS[@]}" >> "$LOG_FILE" 2>&1
EXIT_CODE=$?
echo "Crawl finished at $(date) with exit code $EXIT_CODE" >> "$LOG_FILE"

# Run formal content health audit (read-only) after crawl.
# Set RUN_CONTENT_HEALTH_AUDIT=0 to skip.
RUN_CONTENT_HEALTH_AUDIT="${RUN_CONTENT_HEALTH_AUDIT:-1}"
if [[ "$RUN_CONTENT_HEALTH_AUDIT" == "1" ]]; then
  AUDIT_AS_OF="${CONTENT_HEALTH_AS_OF:-$(date +%F)}"
  echo "Starting content health audit for ${AUDIT_AS_OF} at $(date)" >> "$LOG_FILE"
  python scripts/content_health_audit.py --as-of "$AUDIT_AS_OF" >> "$LOG_FILE" 2>&1
  AUDIT_EXIT_CODE=$?
  echo "Content health audit finished at $(date) with exit code $AUDIT_EXIT_CODE" >> "$LOG_FILE"
else
  echo "Skipping content health audit (RUN_CONTENT_HEALTH_AUDIT=${RUN_CONTENT_HEALTH_AUDIT})" >> "$LOG_FILE"
fi

# Keep only last 14 days of logs
find "$LOG_DIR" -name "crawl_*.log" -mtime +14 -delete

exit $EXIT_CODE
