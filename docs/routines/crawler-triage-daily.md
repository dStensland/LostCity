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
ENV: SUPABASE_URL, SUPABASE_SERVICE_KEY are available.
CONNECTORS: GitHub (scoped to this repo's issues), Slack (channel: #crawler-health).

PROCEDURE:
1. Load the crawler-triage skill at .claude/skills/crawler-triage/SKILL.md and follow it exactly.
2. Work quietly — do not narrate steps. The only user-visible outputs are the GitHub Issues and the single Slack digest.
3. When done, print a one-line status to stdout so the session log shows completion.

HARD RULES:
- Do NOT fix crawler code. Diagnose and file issues only.
- Do NOT push commits or open PRs.
- Do NOT open a new issue for a source that already has an open GitHub Issue labeled `crawler-regression` with the source slug in the title — comment on the existing issue instead if the failure mode has changed.
- Do NOT post to Slack more than once per run.
- If you cannot reach Supabase or GitHub, abort with a clear error and post nothing.
- Runtime ceiling: 15 minutes. If you hit 12 minutes, stop triaging new sources and finalize the digest with what you have.

SUCCESS CRITERIA:
- Every meaningful regression (see skill for definition) from the last 24 hours is either (a) filed as an issue or (b) linked to an existing open issue.
- Exactly one Slack digest is posted, even if it reports "no new regressions."
- Zero code changes in the repo.
```

---

## Architecture notes

- **Why daily at 14:00 UTC**: `crawl.yml` runs at 05:00 UTC, typically completes in under 2 hours. 14:00 UTC gives it a 7-hour buffer and lands at 9am EST (near the start of our working day) so the digest is fresh.
- **Why a skill, not inline instructions**: the diagnostic playbook and issue templates change more often than the Routine config. Keep the Routine prompt stable; iterate on the skill.
- **Dedup strategy**: the skill searches open GitHub Issues with label `crawler-regression` and matching source slug in the title before filing. Without this, the Routine would re-file the same dead source every day.
- **Why we don't fix code from this Routine**: keeps the trust boundary tight. Auto-filed issues are easy to trust; auto-pushed commits are not. A future Routine can handle fixes, triggered by issue labels.

## Pre-deployment checklist

- [ ] GitHub labels created in this repo: `crawler-regression` (required), plus pattern labels `bot-block`, `rate-limit`, `selector-drift`, `site-migration`, `ssl`, `dns`, `js-required`, `unknown`
- [ ] GitHub connector enabled in the Routine config, scoped to issues on this repo
- [ ] Slack connector enabled with `chat:write` scope for `#crawler-health`
- [ ] Secrets added to the Routine's cloud environment: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (the GitHub connector handles its own auth)
- [ ] Dry-run the skill locally once to confirm it reads schema correctly (see skill's Testing section)
- [ ] Confirm `sources` and `crawl_logs` column names match what the skill queries (schema drift between skill draft and production is the most likely failure)

## Post-deployment monitoring

- Watch the first 3 days of runs manually via `claude.ai/code/sessions`
- Calibrate the "meaningful regression" threshold in the skill based on issue signal/noise ratio
- Once stable, revisit to decide whether to add Phase 2 (network source staleness triage) or Phase 3 (auto-fix PRs)
