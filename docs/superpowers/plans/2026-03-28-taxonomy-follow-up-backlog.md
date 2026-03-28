# Taxonomy v2 Follow-Up Backlog

Prioritized by business value. Each item is an independent workstream.

---

## Priority 1: Derived Attribute Badges on Event Cards

**Business value:** Immediate consumer + B2B improvement. Cost tier, duration, and booking_required are already in the DB from the classification pipeline. Surfacing them on event cards answers the three questions every user has: "How much?", "How long?", "Do I need to book?"

**Scope:**
- Add `cost_tier` badge to EventCard (free / $ / $$ / $$$)
- Add `duration` label (short / medium / half-day / full-day / multi-day)
- Add `booking_required` indicator (RSVP/tickets icon)
- Surface these in the FORTH portal event cards for B2B demo value
- Add `indoor_outdoor` to event detail page metadata

**Files:** `web/components/cards/EventCard.tsx`, `web/components/detail/MetadataGrid.tsx`, FORTH portal card variant

**Estimate:** 1 session, low risk

---

## Priority 2: Programs Entity Type

**Business value:** The Family portal's competitive moat. 2,000 summer camps and 1,400 gymnastics sessions are events masquerading as programs. Until these become first-class program entities with sessions, age ranges, and registration links, the Family portal is a filtered event feed — not a content pillar.

**Scope:**
- Create programs table migration (if not already done — check `database/schema.sql` for programs table)
- Build program conversion script: identify events that are really programs (camps, class sessions, rec programs) by source + title pattern
- Convert to program entities with proper session/enrollment metadata
- Deactivate Georgia Gymnastics Academy source (internal class codes, zero consumer value)
- Surface programs in Family portal with age-band filtering

**Dependencies:** Programs table schema, Family portal feed route

**Estimate:** 2-3 sessions, medium risk (schema change + data migration)

---

## Priority 3: Per-Portal Scoring Layer

**Business value:** The thing that makes FORTH's concierge product actually smart. Significance signals (touring, large_venue, festival, limited_run, etc.) are in the DB but nothing consumes them. A hotel concierge needs the top 3-5 events per day, not a raw list of 200.

**Scope:**
- Design scoring function per portal type (hotel prioritizes significance + cost_tier + duration; consumer prioritizes variety + recency)
- Build `score_event_for_portal(event, portal_type)` function
- Wire into feed queries as a sort/rank signal
- Add editorial pin/boost override capability
- Validate with FORTH portal: "Top 5 tonight" should surface the right events

**Dependencies:** None (significance signals already populated)

**Estimate:** 2 sessions, medium risk

---

## Priority 4: Library Crawler Category Pass-Through

**Business value:** Prevents recurrence of the biggest data quality issue found during the backfill. 5 library crawlers were fixed with expanded category maps, but the root cause is that library event sources have their own category tags that we're not extracting.

**Scope:**
- Audit Gwinnett, Fulton, Cobb, DeKalb library crawlers for source-level category fields in the API/HTML
- Extract source category tags and pass them to `insert_event()` as category hints
- Update `_step_infer_category` to respect source-provided hints at higher confidence
- Backfill library events that are still miscategorized

**Dependencies:** None

**Estimate:** 1 session, low risk

---

## Priority 5: Sports Watch Party Fix

**Business value:** Launch dependency for Sports portal. Sports bar sources (watch parties) currently default to Film when the subject is ambiguous. A Sports portal that can't surface Super Bowl watch parties is broken.

**Scope:**
- Add `venue_type = "sports_bar"` → Sports fallback in classify_rules
- Add title patterns for common watch party subjects ("game day", "watch party", "viewing party" + sport keywords)
- Test with golden set events from sports bars

**Dependencies:** None

**Estimate:** 30 minutes, low risk

---

## Priority 6: Phase 5 Cleanup (after 2026-04-28)

**Business value:** Tech debt reduction. No user-facing impact.

**Scope:**
- Drop `legacy_category_id` column from events table (after 30-day soak)
- Remove dissolved category rows from `categories` table
- Prune dead entries from `category-config.ts` (nightlife, community, etc.)
- Update test fixtures with v2 category values
- Remove dissolved categories from CityPulse exclusion lists (once no events have them)
- Clean up `vertical-templates.ts` seed data references

**Dependencies:** 30-day soak period (no rollback needed after 2026-04-28)

**Estimate:** 1 session, low risk

---

## Priority 7: ACTIVENet Crawler Audience Filter

**Business value:** Fixes the family→fitness overflow at the source. County parks & rec crawlers (Atlanta DPR, Gwinnett, Cobb, DeKalb) pull adult programs into family-tagged events because they don't filter by audience at ingestion.

**Scope:**
- Add ACTIVENet API audience/age filter parameter to county parks crawlers
- Set `age_min`/`age_max` on events from source data
- Use age fields to populate `audience_tags` at ingestion
- Backfill existing events with age-range data

**Dependencies:** ACTIVENet API documentation for each county system

**Estimate:** 1-2 sessions, medium risk (API research needed)

---

## Priority 8: Confidence Threshold Tuning

**Business value:** Improves classification accuracy over time. The 0.7 threshold was set based on initial golden set, but real-world data may need adjustment.

**Scope:**
- After 2 weeks of CLASSIFY_V2_ENABLED, pull confidence score distribution from logs
- Sample accuracy at 0.6, 0.7, 0.8 thresholds
- Adjust threshold to minimize total error (rules misclassification + LLM cost)
- Expand golden test set with edge cases found in production

**Dependencies:** 2 weeks of production data with CLASSIFY_V2_ENABLED=1

**Estimate:** 1 session, low risk

---

## DEV_PLAN.md Updates Needed

Add these to the active dev plan:
1. Programs entity type → Family portal dependency (P2 remaining work)
2. Per-portal scoring layer → FORTH/B2B dependency (new phase)
3. Family portal query migration → already done in 3b but verify in P2 list
4. Sports watch party fix → Sports portal launch dependency
