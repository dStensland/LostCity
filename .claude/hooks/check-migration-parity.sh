#!/bin/bash
# Advisory check: when a migration is edited in one directory,
# remind the agent to update the other directory and schema.sql
#
# Claude Code hooks receive tool input via stdin as JSON.
# The edited file path is at .tool_input.file_path

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# Read file path from stdin JSON (Claude Code hook contract)
FILE=$(cat | jq -r '.tool_input.file_path // empty' 2>/dev/null)

# If we couldn't extract a file path, exit silently
if [ -z "$FILE" ]; then
    exit 0
fi

if [[ "$FILE" == *"database/migrations/"* ]]; then
    BASENAME=$(basename "$FILE" | sed 's/^[0-9]*_//')
    MATCH=$(find "$PROJECT_DIR/supabase/migrations" -name "*$BASENAME" 2>/dev/null | head -1)
    if [ -z "$MATCH" ]; then
        echo "⚠️  Migration parity: No matching file found in supabase/migrations/ for $BASENAME"
        echo "   Every schema migration needs files in BOTH database/migrations/ AND supabase/migrations/"
        echo "   Also update database/schema.sql"
    fi
elif [[ "$FILE" == *"supabase/migrations/"* ]]; then
    BASENAME=$(basename "$FILE" | sed 's/^[0-9]*_//')
    MATCH=$(find "$PROJECT_DIR/database/migrations" -name "*$BASENAME" 2>/dev/null | head -1)
    if [ -z "$MATCH" ]; then
        echo "⚠️  Migration parity: No matching file found in database/migrations/ for $BASENAME"
        echo "   Every schema migration needs files in BOTH database/migrations/ AND supabase/migrations/"
        echo "   Also update database/schema.sql"
    fi
fi

# Always exit 0 — this is advisory, not blocking
exit 0
