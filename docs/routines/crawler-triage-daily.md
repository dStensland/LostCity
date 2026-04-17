# Crawler Triage — Daily Routine

**Status**: Draft. Not yet deployed.
**Trigger**: Schedule, daily 14:00 UTC (9 hours after `crawl.yml` completes at 05:00 UTC).
**Runtime target**: Under 15 minutes.
**Cost**: ~1 Routine run/day out of Max's 15/day allowance.

---

## Routine prompt (paste this into the Routine config)

```
You are triaging event-crawler regressions for the LostCity pipeline.

REPOSITORY: this repo is already cloned.
ENV: SUPABASE_URL, SUPABASE_SERVICE_KEY, LINEAR_API_KEY are available.
CONNECTORS: Linear (workspace: LostCity, project: Crawler Regressions), Slack (channel: #crawler-health).

PROCEDURE:
1. Load the crawler-triage skill at .claude/skills/crawler-triage/SKILL.md and follow it exactly.
2. Work quietly — do not narrate steps. The only user-visible outputs are the Linear tickets and the single Slack digest.
3. When done, print a one-line status to stdout so the session log shows completion.

HARD RULES:
- Do NOT fix crawler code. Diagnose and file tickets only.
- Do NOT push commits or open PRs.
- Do NOT ticket a source that already has an open Linear issue labeled `crawler-regression` — add a comment on the existing ticket instead if the failure mode has changed.
- Do NOT post to Slack more than once per run.
- If you cannot reach Supabase or Linear, abort with a clear error and post nothing.
- Runtime ceiling: 15 minutes. If you hit 12 minutes, stop triaging new sources and finalize the digest with what you have.

SUCCESS CRITERIA:
- Every meaningful regression (see skill for definition) from the last 24 hours is either (a) ticketed or (b) linked to an existing open ticket.
- Exactly one Slack digest is posted, even if it reports "no new regressions."
- Zero code changes in the repo.
```

---

## Architecture notes

- **Why daily at 14:00 UTC**: `crawl.yml` runs at 05:00 UTC, typically completes in under 2 hours. 14:00 UTC gives it a 7-hour buffer and lands at 9am EST (near the start of our working day) so the digest is fresh.
- **Why a skill, not inline instructions**: the diagnostic playbook and ticket templates change more often than the Routine config. Keep the Routine prompt stable; iterate on the skill.
- **Dedup strategy**: the skill checks open Linear issues with label `crawler-regression` before filing. Without this, the Routine would re-ticket the same dead source every day.
- **Why we don't fix code from this Routine**: keeps the trust boundary tight. Auto-filed tickets are easy to trust; auto-pushed commits are not. A future Routine can handle fixes, triggered by PR labels.

## Pre-deployment checklist

- [ ] Linear workspace configured with a `Crawler Regressions` project and `crawler-regression` label
- [ ] Linear MCP connector enabled in the Routine config with scope to that project
- [ ] Slack connector enabled with `chat:write` scope for `#crawler-health`
- [ ] Secrets added to the Routine's cloud environment: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `LINEAR_API_KEY`
- [ ] Dry-run the skill locally once with `--dry-run` (see skill's Testing section) to confirm it reads schema correctly
- [ ] Confirm `sources` and `crawl_logs` column names match what the skill queries (schema drift between skill draft and production is the most likely failure)

## Post-deployment monitoring

- Watch the first 3 days of runs manually via `claude.ai/code/sessions`
- Calibrate the "meaningful regression" threshold in the skill based on ticket signal/noise ratio
- Once stable, revisit to decide whether to add Phase 2 (network source staleness triage) or Phase 3 (auto-fix PRs)
