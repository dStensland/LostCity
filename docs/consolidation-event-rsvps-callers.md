# event_rsvps Consumer Sweep

Generated: 2026-04-18. Source command:
```bash
grep -rn "event_rsvps" web/ --include='*.ts' --include='*.tsx'
grep -rn "event_rsvps" crawlers/ 2>/dev/null | grep -v __pycache__
```

Total lines: 112. Total unique files: 42.

Each consumer is categorized by disposition:
- **REWRITE** — must switch to `/api/plans` or direct `plans`/`plan_invitees` query before Phase 1 ships
- **VERIFY** — reads through the compat view are safe IF the code only checks `status = 'going'` (the one enum value that survives the semantic mapping)
- **DELETE** — dead code; remove with its parent module

---

## API Routes

- [x] REWRITE `web/app/api/rsvp/route.ts` — primary write path for RSVPs; POST upsert + DELETE operations, must migrate to `/api/plans`
- [x] REWRITE `web/app/api/events/friends-going/route.ts` — reads event_rsvps with `.eq("status", "going")` to fetch friend-circle attendees; safe pattern but must migrate to plans table
- [x] REWRITE `web/app/api/events/live/route.ts` — counts going RSVPs on event; reads `status = 'going'` only, safe compat read but must migrate
- [x] REWRITE `web/app/api/find-friends/suggestions/route.ts` — matches users who've RSVPed to same events; two queries for status filtering; must migrate to plans
- [x] REWRITE `web/app/api/series/[slug]/subscribe/route.ts` — manages series subscriptions; reads/writes event_rsvps with status logic; must migrate
- [x] REWRITE `web/app/api/preferences/profile/route.ts` — reads going/interested counts for profile; must migrate to plans
- [x] REWRITE `web/app/api/user/calendar/route.ts` — fetches user's going/interested events; status filter logic; must migrate
- [x] REWRITE `web/app/api/user/calendar/feed/route.ts` — feed variant of calendar; status filters; must migrate
- [x] REWRITE `web/app/api/user/calendar/friends/route.ts` — friend calendar; status filters; must migrate
- [x] REWRITE `web/app/api/dashboard/crew-this-week/route.ts` — crew activity; reads going RSVPs; must migrate
- [x] REWRITE `web/app/api/dashboard/activity/route.ts` — user activity feed; reads going/interested status; must migrate
- [x] REWRITE `web/app/api/tonight/route.ts` — "tonight" section; checks status filtering; must migrate
- [x] REWRITE `web/app/api/feed/route.ts` — curated feed; two event_rsvps queries for social proof counts; must migrate
- [x] REWRITE `web/app/api/your-people/friend-signal-events/route.ts` — friend activity; reads going status; must migrate
- [x] REWRITE `web/app/api/your-people/crew-board/route.ts` — crew board; reads going RSVPs; must migrate
- [x] REWRITE `web/app/[portal]/api/search/unified/personalize/route.ts` — documentation comment + query on event_rsvps for personalization signals; must migrate
- [x] REWRITE `web/app/api/trending/route.ts` — reads recent RSVPs and going counts from event_rsvps; filters by status; must migrate

---

## Admin Routes

- [x] REWRITE `web/app/admin/page.tsx` — count query for analytics dashboard; may stay as-is if tracking legacy data only, but verify
- [x] REWRITE `web/app/api/admin/analytics/route.ts` — aggregates event_rsvps counts from daily_analytics table (not direct table read); column schema in query; must verify aggregation logic
- [x] REWRITE `web/app/api/admin/analytics/webhook/route.ts` — receives daily_analytics rows with event_rsvps metric; type definition + mapping; likely safe but must audit
- [x] REWRITE `web/app/api/admin/analytics/portal/[id]/route.ts` — queries daily_analytics for event_rsvps metric; aggregates; likely safe but verify
- [x] REWRITE `web/app/api/admin/analytics/export/route.ts` — exports daily_analytics including event_rsvps column; likely safe but verify
- [x] REWRITE `web/app/api/admin/users/route.ts` — count query on event_rsvps for user analytics; must migrate

---

## Components

- [x] REWRITE `web/components/WhosGoing.tsx` — client component that directly queries event_rsvps with Supabase; reads status = 'going' | 'interested'; unsafe client-side Supabase; must wrap behind API route

---

## Library & Utilities

- [x] VERIFY `web/lib/portal-attribution.test.ts` — test file that references event_rsvps in a test assertion list; no actual code logic; verify test assumptions after migration
- [x] VERIFY `web/lib/city-pulse/counts.ts` — reads going count from event_rsvps for social proof metrics; status = 'going' filter; safe compat read but must migrate
- [x] VERIFY `web/lib/analytics/attributed-metrics.ts` — reads event_rsvps to count portal-attributed RSVPs; joins event table; analyzes created_at; must audit schema after migration
- [x] VERIFY `web/lib/portal-feed-loader.ts` — single query on event_rsvps; checks status; must audit context

---

## Scripts & Seeding

- [x] REWRITE `web/scripts/seed-rsvps.ts` — direct insert + delete on event_rsvps; dev seeding only but must update schema
- [x] REWRITE `web/scripts/seed-personas.ts` — deletes + inserts event_rsvps; dev seeding; must update
- [x] REWRITE `web/scripts/seed-activity.ts` — deletes + inserts event_rsvps; activity simulation; must update
- [x] REWRITE `web/scripts/seed-social-proof.ts` — comprehensive seeding of event_rsvps with batch insert; cleans table; must update to plans table
- [x] REWRITE `web/scripts/seed-staging.ts` — deletes + inserts event_rsvps on user setup; must update
- [x] REWRITE `web/scripts/seed-elevation-data.ts` — reads event_rsvps three times to compute social signals; must migrate
- [x] REWRITE `web/scripts/fix-social-visibility.ts` — script to fix visibility='friends' RSVPs; reads + updates event_rsvps; must migrate to plans
- [x] REWRITE `web/scripts/debug-tonight.ts` — debugging script; reads event_rsvps; can ignore or update

---

## Python Crawlers

- [x] REWRITE `crawlers/seed_engagement.py` — seeds event_rsvps with Supabase client; batch upsert + delete; must update to plans table
- [x] REWRITE `crawlers/db/notifications.py` — reads event_rsvps in notification logic; must verify schema + migrate
- [x] REWRITE `crawlers/db/screenings.py` — deletes event_rsvps in cleanup logic; cinema data context; must migrate
- [x] REWRITE `crawlers/canonicalize_festival_duplicates.py` — deletes event_rsvps alongside other tables in dedup operation; must migrate

---

## Auto-Generated Types (No Manual Changes Needed)

- `web/lib/types.ts` — TypeScript exports include EventRSVP type; regenerated post-schema-migration; will update auto-post-migration
- `web/lib/supabase/database.types.ts` — Auto-generated Supabase types; regenerated via `supabase gen types` post-migration; do not edit by hand

---

## Summary

**File count by disposition:**
- REWRITE: 37 files
- VERIFY: 4 files
- DELETE: 0 files (no dead code found)
- Auto-generated (not counted): 2 files

**Semantic mismatch risk:**

The old enum `{going, interested, not_going}` survives in compat view reads only where code explicitly checks `status = 'going'`. Any code that:
- Reads `status IN ('going', 'interested')` → must migrate (two-value filter breaks)
- Writes any status → must migrate (old enum doesn't exist in new table)
- Uses `status` in aggregations → must migrate (semantic mapping uncertain)

Files marked VERIFY have status filters that match the compat mapping but are NOT safe: the compat view is read-only and semantic migration is lossy. Phase 1 deployment will break these.

All 37 REWRITE entries must resolve before Phase 1 merges.

Note: Files `web/lib/types.ts` and `web/lib/supabase/database.types.ts` are auto-generated and not counted above; they will be regenerated post-migration.
