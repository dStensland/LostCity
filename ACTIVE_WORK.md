# Active Work — Multi-Agent Coordination

This file tracks which Claude Code sessions are working on what. Every agent reads this before starting to avoid conflicts.

**How to use:**
- Before starting work, check this file for claimed files/directories.
- Add your assignment when you start. Remove it when you finish.
- If you need a file another agent claims, stop and tell the user.
- For database migrations, always `ls database/migrations/ | tail -5` to get the next number.

---

## Active Sessions

<!-- Add entries below when starting a session. Remove when done. -->
<!-- Format: ### Session Name (started YYYY-MM-DD) -->

### Session E — Entity Graph Rollout (started 2026-03-15)
**Scope:** `crawlers/sources/`, `crawlers/tests/`, `ACTIVE_WORK.md`, `WORKSTREAM.md`
**Backlog items:**
- Workstream Track B: typed-lane crawler conversions
- Workstream Track D: production schema and attribution validation
- Workstream Track C prep: backfill planning inputs

**Claimed paths:**
- `crawlers/sources/atlanta_family_programs.py`
- `crawlers/sources/clark_atlanta_art_museum.py`
- `crawlers/sources/dolls_head_trail.py`
- `crawlers/tests/test_atlanta_family_programs.py` (if created)
- `crawlers/tests/test_clark_atlanta_art_museum.py` (if created)
- `crawlers/tests/test_dolls_head_trail.py` (if created)
- `WORKSTREAM.md`

---

## Recommended Session Split

Based on `BACKLOG.md` tiers, here are natural parallel workstreams:

### Session A — Data Quality & Crawlers (Tier 0)
**Scope:** `crawlers/`, `database/migrations/`
**Backlog items:**
- 0.2 Data quality: run health audit, identify/fix top 20 degraded crawlers
- 0.3 Crawler staging pipeline: staging credentials, dry-run, validation checklist
- ~~0.4 Venue specials: backfill scraper run~~ — Done (2026-03-05). Source 1177 migrated, specials infrastructure complete. Not an active initiative.

**Claimed paths:**
- `crawlers/main.py`
- `crawlers/sources/`
- `crawlers/data_health.py`

### Session B — Attribution Hardening (Tier 0)
**Scope:** `database/migrations/`, `web/app/api/`
**Backlog items:**
- 0.1 Portal attribution: add portal_id to activities/inferred_preferences writes
- 0.1 Attribution guardrails: DB constraints, app-level validation
- 0.1 Attribution audit: daily report query

**Claimed paths:**
- `web/app/api/activities/`
- `web/app/api/personalization/`
- `web/app/api/signals/`
- `web/lib/attribution*` (if created)
- New migration files for attribution constraints

### Session C — Atlanta Feed & UX (Tier 1)
**Scope:** `web/app/[portal]/`, `web/components/`
**Backlog items:**
- 1.1 Feed ranking: dead-content suppression, tonight/weekend relevance
- 1.1 Conversion loops: RSVP/save/follow visibility
- 1.4 Time-of-day sections, weather banner (after 0.4 specials data exists)

**Claimed paths:**
- `web/app/[portal]/page.tsx` (feed page)
- `web/components/feed/`
- `web/components/event-card/`
- `web/app/api/portals/[slug]/feed/`

### Session D — FORTH Demo Polish (Tier 1)
**Scope:** `web/app/[portal]/concierge/`, FORTH-specific paths
**Backlog items:**
- 1.2 Concierge experience polish
- 1.2 Attribution verification for FORTH
- 1.2 Demo storyline and QA checklist

**Claimed paths:**
- `web/app/[portal]/concierge/`
- `web/app/api/portals/[slug]/concierge/`
- `web/components/concierge/`

---

## Conflict Zones (coordinate before touching)

These files are shared across multiple workstreams. If you need to modify them, check with the user first:

| File | Why it's shared |
|------|----------------|
| `database/migrations/*` | Multiple sessions create migrations — always check latest number |
| `web/app/api/portals/[slug]/feed/route.ts` | Feed logic touches ranking (C) and attribution (B) |
| `web/middleware.ts` | Portal routing — rarely changes but affects everything |
| `crawlers/main.py` | Orchestrator — Session A owns this |
| `web/lib/supabase/` | Shared DB clients — changes affect all API routes |
