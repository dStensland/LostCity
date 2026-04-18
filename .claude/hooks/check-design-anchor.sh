#!/bin/bash
# PreToolUse hook: blocks Task tool dispatches for UI work that lack
# docs/design-truth.md + a Pencil/node anchor in the prompt.
#
# Design: anchor-or-stop. UI work without a registry reference produces
# the Plan-2-style SaaS slop we're trying to prevent. Non-UI Task dispatches
# pass through unchanged.
#
# Exit 0 always; block decisions are returned via hookSpecificOutput JSON.

set -u

INPUT="$(cat)"
TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')"

# Only gate the Task tool.
[ "$TOOL" != "Task" ] && exit 0

PROMPT="$(printf '%s' "$INPUT" | jq -r '.tool_input.prompt // ""')"
[ -z "$PROMPT" ] && exit 0

# UI detection: if none of these signals fire, this isn't UI work — pass.
if ! printf '%s' "$PROMPT" | grep -qE 'web/components/|web/app/|component:| UI |visual review|design review'; then
  exit 0
fi

# UI-touching: require BOTH a design-truth reference AND a Pencil/node anchor.
HAS_DT=0
HAS_PENCIL=0
printf '%s' "$PROMPT" | grep -q 'design-truth' && HAS_DT=1
printf '%s' "$PROMPT" | grep -qiE 'pencil|node ?id' && HAS_PENCIL=1

if [ "$HAS_DT" -eq 1 ] && [ "$HAS_PENCIL" -eq 1 ]; then
  exit 0
fi

MISSING=""
[ "$HAS_DT" -eq 0 ] && MISSING="${MISSING}docs/design-truth.md reference, "
[ "$HAS_PENCIL" -eq 0 ] && MISSING="${MISSING}Pencil node ID (e.g., ViqPG for EventCard), "
MISSING="${MISSING%, }"

jq -n --arg reason "UI subagent dispatch missing design anchor: ${MISSING}. Include docs/design-truth.md + a Pencil node ID from the registry in the prompt. See docs/design-truth.md § Component Registry. If this is NOT UI work, rephrase to avoid triggers: 'web/components/', 'web/app/', 'component:', ' UI ', 'visual review', 'design review'." '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $reason
  }
}'
exit 0
