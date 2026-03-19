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

log_phase() {
  echo "[$(date)] $1" >> "$LOG_FILE"
}

run_logged() {
  local label="$1"
  shift
  log_phase "START ${label}"
  "$@" >> "$LOG_FILE" 2>&1
  local rc=$?
  log_phase "END ${label} (exit=${rc})"
  return $rc
}

echo "Starting crawl at $(date)" >> "$LOG_FILE"

DB_TARGET="${CRAWLER_DB_TARGET:-production}"
BASE_ARGS=(--db-target "$DB_TARGET")

# Scheduled production runs must opt in explicitly.
if [[ "$DB_TARGET" == "production" ]]; then
  BASE_ARGS+=(--allow-production-writes)
fi

RUN_SOURCE_CRAWL="${RUN_SOURCE_CRAWL:-1}"
RUN_POST_CRAWL_GLOBALS="${RUN_POST_CRAWL_GLOBALS:-0}"
RUN_POST_CRAWL_MAINTENANCE="${RUN_POST_CRAWL_MAINTENANCE:-1}"
RUN_CONTENT_HEALTH_AUDIT="${RUN_CONTENT_HEALTH_AUDIT:-1}"
POST_CRAWL_TBA_LIMIT="${POST_CRAWL_TBA_LIMIT:-200}"
POST_CRAWL_SKIP_TBA="${POST_CRAWL_SKIP_TBA:-0}"
POST_CRAWL_CITY="${POST_CRAWL_CITY:-Atlanta}"
POST_CRAWL_PORTAL="${POST_CRAWL_PORTAL:-atlanta}"

EXIT_CODE=0

if [[ "$RUN_SOURCE_CRAWL" == "1" ]]; then
  CRAWL_ARGS=("${BASE_ARGS[@]}" --skip-launch-maintenance)
  run_logged "source crawl" python main.py "${CRAWL_ARGS[@]}"
  EXIT_CODE=$?
  log_phase "Source crawl finished with exit code ${EXIT_CODE}"
else
  log_phase "Skipping source crawl (RUN_SOURCE_CRAWL=${RUN_SOURCE_CRAWL})"
fi

if [[ "$EXIT_CODE" -eq 0 && "$RUN_POST_CRAWL_GLOBALS" == "1" ]]; then
  POST_ARGS=("${BASE_ARGS[@]}" --post-crawl-global-only --launch-maintenance-city "$POST_CRAWL_CITY" --launch-maintenance-portal "$POST_CRAWL_PORTAL" --tba-hydration-limit "$POST_CRAWL_TBA_LIMIT")
  if [[ "$POST_CRAWL_SKIP_TBA" == "1" ]]; then
    POST_ARGS+=(--skip-tba-hydration)
  fi
  run_logged "post-crawl globals" python main.py "${POST_ARGS[@]}"
  POST_CRAWL_EXIT_CODE=$?
  if [[ "$POST_CRAWL_EXIT_CODE" -ne 0 && "$EXIT_CODE" -eq 0 ]]; then
    EXIT_CODE=$POST_CRAWL_EXIT_CODE
  fi
elif [[ "$RUN_POST_CRAWL_GLOBALS" != "1" ]]; then
  log_phase "Skipping post-crawl globals (RUN_POST_CRAWL_GLOBALS=${RUN_POST_CRAWL_GLOBALS})"
fi

if [[ "$EXIT_CODE" -eq 0 && "$RUN_POST_CRAWL_MAINTENANCE" == "1" ]]; then
  run_logged "post-crawl maintenance" python scripts/post_crawl_maintenance.py --city "$POST_CRAWL_CITY" --portal "$POST_CRAWL_PORTAL" --continue-on-error
  MAINT_EXIT_CODE=$?
  if [[ "$MAINT_EXIT_CODE" -ne 0 && "$EXIT_CODE" -eq 0 ]]; then
    EXIT_CODE=$MAINT_EXIT_CODE
  fi
elif [[ "$RUN_POST_CRAWL_MAINTENANCE" != "1" ]]; then
  log_phase "Skipping post-crawl maintenance (RUN_POST_CRAWL_MAINTENANCE=${RUN_POST_CRAWL_MAINTENANCE})"
fi

# Run formal content health audit (read-only) after crawl.
if [[ "$RUN_CONTENT_HEALTH_AUDIT" == "1" ]]; then
  AUDIT_AS_OF="${CONTENT_HEALTH_AS_OF:-$(date +%F)}"
  log_phase "Starting content health audit for ${AUDIT_AS_OF}"
  python scripts/content_health_audit.py --as-of "$AUDIT_AS_OF" >> "$LOG_FILE" 2>&1
  AUDIT_EXIT_CODE=$?
  log_phase "Content health audit finished with exit code ${AUDIT_EXIT_CODE}"
else
  log_phase "Skipping content health audit (RUN_CONTENT_HEALTH_AUDIT=${RUN_CONTENT_HEALTH_AUDIT})"
fi

# Keep only last 14 days of logs
find "$LOG_DIR" -name "crawl_*.log" -mtime +14 -delete

exit $EXIT_CODE
