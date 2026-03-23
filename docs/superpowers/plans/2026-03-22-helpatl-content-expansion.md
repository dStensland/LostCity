# HelpATL Content Expansion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand HelpATL from ~1,577 events (59% from 3 sources) to ~2,500+ events across all civic categories by subscribing to existing sources, fixing broken crawlers, and deactivating dead ones.

**Architecture:** Three tiers — (1) SQL-only subscription inserts for sources that already produce events, (2) crawler fixes for sources that exist but produce 0, (3) deactivation of sources that will never produce events. No new crawlers in this plan — those are tracked separately.

**Tech Stack:** PostgreSQL migrations, Python crawlers (BeautifulSoup + Playwright), Mobilize.us API (`mobilize_api.py`)

**Relationship to other plans:**
- Phase 2 crawlers (IQM2, Elections, School Boards) → `2026-03-21-helpatl-civic-breadth-phase2.md` (separate)
- Feed redesign → `2026-03-22-helpatl-civic-feed-redesign.md` (separate)
- Root cause fixes → `2026-03-22-helpatl-root-cause-fixes.md` (separate)
- Existing deactivation batch → `supabase/migrations/20260322400000_deactivate_dead_helpatl_sources.sql` (11 sources already deactivated — this plan covers a DIFFERENT set)
- This plan covers the **data layer gaps** those plans don't address

**Task dependencies:**
- Tasks 1 and 2 are independent — can run in parallel
- Tasks 3–6 should run AFTER Task 2 — verify your target source wasn't already deactivated
- Task 7 is independent (read-only verification)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260322700000_helpatl_subscribe_civic_sources.sql` | Subscribe HelpATL to existing civic sources from atlanta-support and atlanta portals |
| `supabase/migrations/20260322700001_deactivate_dead_helpatl_sources.sql` | Deactivate sources that will never produce events |
| `crawlers/sources/mobilize_api.py` | Add IRC/NGP org IDs to CIVIC_ORG_IDS (if they're on Mobilize.us) |
| `crawlers/sources/irc_atlanta.py` | Deactivate or rewrite depending on Mobilize.us findings |
| `crawlers/sources/hope_atlanta.py` | Rewrite: fix selectors after live site inspection |
| `crawlers/sources/new_georgia_project.py` | Deactivate or rewrite depending on Mobilize.us findings |
| `crawlers/sources/georgia_stand_up.py` | Fix: update Wix selectors after live site inspection |

---

## Task 1: Subscribe HelpATL to Existing Civic Sources

This is the highest-ROI task. Sources already produce events — we just need subscription rows and sharing rules.

**Files:**
- Create: `supabase/migrations/20260322700000_helpatl_subscribe_civic_sources.sql`

- [ ] **Step 1: Write the migration**

This migration subscribes HelpATL to civic-relevant sources from `atlanta-support` and `atlanta` portals. It creates sharing rules where missing, then subscriptions.

```sql
-- Subscribe HelpATL to existing civic sources from atlanta-support and atlanta portals
-- These sources already produce events; HelpATL just needs subscriptions.

DO $$
DECLARE
  helpatl_id UUID;
  src RECORD;
  civic_slugs TEXT[] := ARRAY[
    -- From atlanta-support portal: mental health & peer support
    'griefshare-atlanta',
    'dbsa-atlanta',
    'cancer-support-community-atl',
    'divorcecare-atlanta',
    'mha-georgia',
    'nami-georgia',
    -- From atlanta-support portal: community services
    'food-well-alliance',
    'city-of-refuge',
    'wrcdv',
    'empowerline',
    'vetlanta',
    'dekalb-public-health',
    -- From atlanta portal: libraries (highest single-source ROI)
    'fulton-library',
    -- From atlanta portal: community programs
    'ymca-atlanta',
    -- From atlanta portal: youth volunteering
    'pebble-tossers'
  ];
BEGIN
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';
  IF helpatl_id IS NULL THEN
    RAISE EXCEPTION 'HelpATL portal not found';
  END IF;

  FOR src IN
    SELECT s.id, s.slug, s.owner_portal_id
    FROM sources s
    WHERE s.slug = ANY(civic_slugs)
      AND s.is_active = true
  LOOP
    -- Ensure sharing rule exists (owner shares with scope 'all')
    -- ON CONFLICT only updates share_scope, never changes owner_portal_id
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    VALUES (src.id, src.owner_portal_id, 'all')
    ON CONFLICT (source_id) DO UPDATE SET
      share_scope = 'all';

    -- Subscribe HelpATL
    INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
    VALUES (helpatl_id, src.id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
      subscription_scope = 'all',
      is_active = true;

    RAISE NOTICE 'Subscribed HelpATL to source: % (id: %)', src.slug, src.id;
  END LOOP;
END $$;

-- Refresh the materialized view so queries pick up new subscriptions
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
```

- [ ] **Step 2: Verify source slugs exist**

Before applying the migration, confirm these slugs exist in the database. Start local Supabase if needed:

```bash
cd /Users/coach/Projects/LostCity
npx supabase start
```

Then verify:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
SELECT slug, name, is_active,
  (SELECT COUNT(*) FROM events e WHERE e.source_id = s.id AND e.is_active = true AND e.start_date >= NOW()) as future_events
FROM sources s
WHERE slug IN (
  'griefshare-atlanta', 'dbsa-atlanta', 'cancer-support-community-atl',
  'divorcecare-atlanta', 'mha-georgia', 'nami-georgia',
  'food-well-alliance', 'city-of-refuge', 'wrcdv', 'empowerline',
  'vetlanta', 'dekalb-public-health', 'fulton-library',
  'ymca-atlanta', 'pebble-tossers'
)
ORDER BY future_events DESC;
"
```

Expected: All 15 slugs found, all `is_active = true`, most with future events > 0.

**If any slug is missing or inactive**, remove it from the migration array and note it for Task 2 (deactivation review).

- [ ] **Step 3: Apply the migration locally**

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/migrations/20260322700000_helpatl_subscribe_civic_sources.sql
```

Expected: `NOTICE: Subscribed HelpATL to source: ...` for each source.

- [ ] **Step 4: Verify subscriptions landed via materialized view**

The `portal_source_access` materialized view is the authoritative check — it's what the app queries.

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
SELECT psa.source_name, psa.access_type,
  (SELECT COUNT(*) FROM events e WHERE e.source_id = psa.source_id AND e.is_active = true AND e.start_date >= NOW()) as future_events
FROM portal_source_access psa
WHERE psa.portal_id = (SELECT id FROM portals WHERE slug = 'helpatl')
ORDER BY future_events DESC;
"
```

Expected: New sources appear with `access_type = 'subscription'`. Total future events accessible to HelpATL should increase by ~900.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260322700000_helpatl_subscribe_civic_sources.sql
git commit -m "feat(helpatl): subscribe to 15 civic sources from atlanta-support and atlanta portals

Adds subscriptions for mental health support (GriefShare, DBSA, NAMI, MHA-GA),
community services (Food Well Alliance, City of Refuge, Empowerline, VETLANTA),
domestic violence resources (WRCDV), public health (DeKalb), library programming
(Fulton Library - 528 events), community programs (YMCA), and youth volunteering
(Pebble Tossers). ~900 additional civic events now visible in HelpATL feed."
```

---

## Task 2: Deactivate Dead Sources & Fix Broken URLs

Several HelpATL sources have never produced a single event and never will with their current configuration. Deactivate them to stop silent failures and clean up the health dashboard.

**Files:**
- Create: `supabase/migrations/20260322700001_deactivate_dead_helpatl_sources.sql`

- [ ] **Step 1: Verify actual source slugs in the database**

**IMPORTANT:** The `padv` slug may actually be `partnership-against-domestic-violence` in the DB. The `SOURCE_OVERRIDES` mapping in `main.py` shows `"partnership-against-domestic-violence": "sources.padv"` — meaning the DB slug is the long form while the crawler file is `padv.py`. Check all slugs before writing the migration:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
SELECT slug, name, is_active,
  (SELECT COUNT(*) FROM events e WHERE e.source_id = s.id AND e.is_active = true AND e.start_date >= NOW()) as future_events,
  (SELECT COUNT(*) FROM events e WHERE e.source_id = s.id) as total_events_ever
FROM sources s
WHERE slug IN (
  'atlanta-boards-commissions', 'fair-fight', 'padv', 'partnership-against-domestic-violence',
  'avlf', 'atlanta-volunteer-lawyers-foundation',
  'everybody-wins-atlanta', 'atlanta-mission', 'new-american-pathways'
)
ORDER BY slug;
"
```

Use the ACTUAL slugs returned by this query in the migration below. If a slug doesn't exist at all, remove it from the migration.

- [ ] **Step 2: Write the migration**

Follow the established pattern from `20260322400000_deactivate_dead_helpatl_sources.sql`: use `health_tags` annotation AND deactivate orphaned future events.

```sql
-- Deactivate HelpATL sources that will never produce events in their current form.
-- These are either pointed at wrong URLs, use generic selectors that don't match,
-- or the org simply doesn't have a public events calendar.
-- Pattern: matches 20260322400000 (health_tags + event deactivation).

-- NOTE: Verify exact slugs against DB before applying. padv may be
-- 'partnership-against-domestic-violence'; avlf may be
-- 'atlanta-volunteer-lawyers-foundation'. Use Step 1 query output.

-- Sources with no crawlable event calendar
UPDATE sources SET is_active = false,
  health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:no_calendar')
WHERE slug IN (
  'atlanta-boards-commissions',   -- Superseded by IQM2 crawler, never produced events
  'fair-fight',                   -- Volunteer signup page, not events calendar
  'padv',                         -- No public events calendar (VERIFY SLUG)
  'avlf',                         -- Volunteer signup, not events (VERIFY SLUG)
  'everybody-wins-atlanta',       -- Genuinely sparse calendar, 0 events ever
  'atlanta-mission',              -- Site structure changed, 0 future events
  'new-american-pathways'         -- Volunteer signup page, not events calendar
) AND is_active = true;

-- Deactivate future events from these sources so they don't appear in feeds
UPDATE events SET is_active = false
WHERE source_id IN (
  SELECT id FROM sources WHERE slug IN (
    'atlanta-boards-commissions', 'fair-fight', 'padv', 'avlf',
    'everybody-wins-atlanta', 'atlanta-mission', 'new-american-pathways'
  )
) AND start_date >= CURRENT_DATE AND is_active = true;

-- Refresh so deactivated sources drop from portal access
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
```

**IMPORTANT:** Replace any slug placeholders (e.g., `'padv'`) with the actual DB slugs confirmed in Step 1.

- [ ] **Step 3: Apply the migration locally**

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/migrations/20260322700001_deactivate_dead_helpatl_sources.sql
```

- [ ] **Step 4: Verify deactivation**

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
SELECT slug, is_active, health_tags FROM sources
WHERE slug IN (
  'atlanta-boards-commissions', 'fair-fight', 'padv', 'avlf',
  'everybody-wins-atlanta', 'atlanta-mission', 'new-american-pathways'
);
"
```

Expected: All `is_active = false`, all have `'deactivated:no_calendar'` in `health_tags`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260322700001_deactivate_dead_helpatl_sources.sql
git commit -m "chore(helpatl): deactivate 7 sources that never produced events

atlanta-boards-commissions (superseded by IQM2), fair-fight, padv, avlf,
everybody-wins-atlanta, atlanta-mission, new-american-pathways — all pointed
at signup pages or orgs without public event calendars. Includes health_tags
annotation and future event deactivation per established pattern."
```

---

## Task 3: Fix IRC Atlanta & New Georgia Project — Mobilize.us Strategy

Both IRC Atlanta and New Georgia Project are likely on Mobilize.us. The existing `mobilize_api.py` already crawls Atlanta-area Mobilize events via geo query + org-specific pass using `CIVIC_ORG_IDS`. The correct fix is to **add their org IDs to `CIVIC_ORG_IDS`** rather than maintaining separate crawler files.

**Important context:** `mobilize_api.py` uses the Mobilize public API (no auth). It does a geo query (30-mile radius from Atlanta) plus an org-specific pass for IDs in `CIVIC_ORG_IDS`. The `mobilize.py` file is a separate Playwright-based scraper — do NOT delegate to it.

**Files:**
- Modify: `crawlers/sources/mobilize_api.py` (add org IDs to `CIVIC_ORG_IDS`)
- Modify: `crawlers/sources/irc_atlanta.py` (deactivate)
- Modify: `crawlers/sources/new_georgia_project.py` (deactivate)
- Create: `supabase/migrations/20260322700002_deactivate_mobilize_redirected_sources.sql`

- [ ] **Step 1: Find IRC and NGP org IDs on Mobilize.us**

Search the Mobilize API for these orgs:

```bash
# Search for IRC Atlanta
curl -s "https://api.mobilize.us/v1/organizations?name=international+rescue+committee" | python3 -m json.tool | head -40

# Search for New Georgia Project
curl -s "https://api.mobilize.us/v1/organizations?name=new+georgia+project" | python3 -m json.tool | head -40
```

If the name search returns nothing, try slug variations:

```bash
curl -s "https://api.mobilize.us/v1/organizations/irc" | python3 -m json.tool | head -20
curl -s "https://api.mobilize.us/v1/organizations/newgeorgiaproject" | python3 -m json.tool | head -20
```

Record the numeric `id` field for each org. If an org is NOT on Mobilize.us, skip it in Step 2 and handle it in Step 4.

- [ ] **Step 2: Check if these orgs already have Atlanta events in the geo query**

```bash
# Check if IRC events already appear in geo results (they may already be captured)
curl -s "https://api.mobilize.us/v1/events?organization_id=<IRC_ORG_ID>&timeslot_start=gte_now" | python3 -m json.tool | grep -c '"id"'
```

If events already appear in the geo query results (because they have Atlanta geocoordinates), adding to `CIVIC_ORG_IDS` is still correct — it captures events that may lack geocoordinates.

- [ ] **Step 3: Add org IDs to CIVIC_ORG_IDS in mobilize_api.py**

Edit `crawlers/sources/mobilize_api.py` around line 77-100, adding to the `CIVIC_ORG_IDS` dict:

```python
    # Immigration & refugee services
    <IRC_ORG_ID>: "irc",                       # International Rescue Committee (Atlanta office)
    # Civic organizing / voter registration
    <NGP_ORG_ID>: "newgeorgiaproject",          # New Georgia Project
```

Replace `<IRC_ORG_ID>` and `<NGP_ORG_ID>` with the actual numeric IDs from Step 1.

- [ ] **Step 4: Deactivate the individual crawler sources**

Since `mobilize_api.py` (source slug: `mobilize-us`) will now capture these events, the individual sources should be deactivated to prevent duplicates.

Write the migration:

```sql
-- Deactivate IRC Atlanta and New Georgia Project individual sources.
-- Their events are now captured by mobilize_api.py via CIVIC_ORG_IDS.

UPDATE sources SET is_active = false,
  health_tags = array_append(COALESCE(health_tags, '{}'), 'deactivated:covered_by_mobilize_api')
WHERE slug IN ('irc-atlanta', 'new-georgia-project') AND is_active = true;

-- Deactivate any future events from these sources
UPDATE events SET is_active = false
WHERE source_id IN (
  SELECT id FROM sources WHERE slug IN ('irc-atlanta', 'new-georgia-project')
) AND start_date >= CURRENT_DATE AND is_active = true;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
```

- [ ] **Step 5: Handle the case where they're NOT on Mobilize.us**

If IRC is not on Mobilize.us: inspect their actual events page (`rescue.org/united-states/atlanta-ga`) and build a proper crawler with correct selectors based on real HTML structure. Do NOT use generic regex selectors.

If NGP is not on Mobilize.us: inspect their events page and build a proper crawler. Check if they use Eventbrite, WordPress Events Calendar, or another platform.

- [ ] **Step 6: Test mobilize_api.py with the new org IDs**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source mobilize-us --dry-run
```

Expected: Events from IRC and/or NGP appear in the output alongside existing Mobilize events.

- [ ] **Step 7: Commit**

```bash
git add crawlers/sources/mobilize_api.py supabase/migrations/20260322700002_deactivate_mobilize_redirected_sources.sql
git commit -m "fix(crawlers): add IRC Atlanta + New Georgia Project to Mobilize API org pass

Both orgs post events on Mobilize.us. Adding their org IDs to CIVIC_ORG_IDS
in mobilize_api.py captures their events via the public API. Individual
crawler sources deactivated to prevent duplicates."
```

---

## Task 4: Fix Hope Atlanta Crawler

Hope Atlanta's crawler uses generic selectors against their news page. Need to inspect the actual site and either find their events page or an API.

**Files:**
- Modify: `crawlers/sources/hope_atlanta.py`

- [ ] **Step 1: Inspect the live site**

Use browser automation to visit `hopeatlanta.org/events` and `hopeatlanta.org/news-and-events/`:

```bash
curl -s "https://hopeatlanta.org/events/" -o /tmp/hope_events.html
curl -s "https://hopeatlanta.org/news-and-events/" -o /tmp/hope_news.html
```

Look for:
1. Does the page have actual event cards with dates?
2. Is there an Eventbrite widget or iframe?
3. Is there a Mobilize.us link?
4. Do they use a WordPress events plugin (The Events Calendar, etc.)?

```bash
grep -i "eventbrite\|mobilize\|tribe-events\|wp-json.*events\|ical\|calendar" /tmp/hope_events.html /tmp/hope_news.html | head -20
```

- [ ] **Step 2: Rewrite based on findings**

**If they use Eventbrite:** Extract the organizer ID and use the Eventbrite crawler pattern.
**If they use WordPress Events Calendar:** Use the Tribe Events REST API pattern (`/wp-json/tribe/events/v1/events`).
**If they use Mobilize.us:** Add their org ID to `CIVIC_ORG_IDS` in `mobilize_api.py` (same as Task 3).
**If they have no parseable events:** Deactivate the source and add to Task 2's migration.

Implement the appropriate pattern. Do NOT use generic regex selectors.

- [ ] **Step 3: Test the rewritten crawler**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source hope-atlanta --dry-run
```

Expected: Either events found > 0, or the source is deactivated with a clear note.

- [ ] **Step 4: Commit**

```bash
git add crawlers/sources/hope_atlanta.py
git commit -m "fix(crawlers): rewrite Hope Atlanta with correct extraction method

Previous crawler used generic regex selectors that never matched real HTML."
```

---

## Task 5: Fix Georgia STAND-UP Crawler

The Wix-based crawler has data-hook selectors that may have changed in a site redesign.

**Files:**
- Modify: `crawlers/sources/georgia_stand_up.py`

- [ ] **Step 1: Inspect the live Wix site**

```bash
curl -s "https://www.georgiastandup.org/event-list" -o /tmp/ga_standup.html
```

Check if it's still Wix:
```bash
grep -i "wix\|data-hook" /tmp/ga_standup.html | head -20
```

If the page uses client-side JS rendering (common with Wix), use Playwright to inspect:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('https://www.georgiastandup.org/event-list', wait_until='networkidle')
    page.wait_for_timeout(3000)
    # Check for event containers
    containers = page.query_selector_all('[data-hook]')
    for c in containers[:20]:
        hook = c.get_attribute('data-hook')
        text = c.inner_text()[:80]
        print(f'{hook}: {text}')
    browser.close()
"
```

- [ ] **Step 2: Update selectors based on findings**

If the site is still Wix but hooks changed, update `CARD_SELECTORS` in the crawler with the correct data-hook values.

If the site has moved off Wix entirely, rewrite using the appropriate pattern.

If the org has no current public events (genuinely sparse calendar), deactivate the source.

- [ ] **Step 3: Test the updated crawler**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source georgia-stand-up --dry-run
```

- [ ] **Step 4: Commit**

```bash
git add crawlers/sources/georgia_stand_up.py
git commit -m "fix(crawlers): update Georgia STAND-UP selectors for current site structure"
```

---

## Task 6: Verify United Way Atlanta Behavior

The United Way crawler deliberately filters to "Happens On" dated opportunities only. This is correct behavior — ongoing/rolling opportunities aren't calendar events. But verify it's actually running and producing what it can.

**Files:**
- Read-only: `crawlers/sources/united_way_atlanta.py`

- [ ] **Step 1: Run the crawler in dry-run mode**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source united-way-atlanta --dry-run
```

- [ ] **Step 2: Assess output**

If events_found > 0: The crawler works. The low volume is because United Way's board is mostly ongoing opportunities. No fix needed.

If events_found == 0: The VolunteerHub API may have changed. Check:
- Is the API endpoint still responding?
- Has the response format changed?
- Are there any "Happens On" opportunities currently listed?

- [ ] **Step 3: Decision**

If the crawler finds 0 events AND the org genuinely has no dated events on their board, deactivate the source. United Way's value to HelpATL may come through other channels (Eventbrite civic events, Mobilize.us, etc.) rather than their volunteer portal.

No commit needed unless changes are made.

---

## Verification

After all tasks are complete:

- [ ] **Check total HelpATL event coverage via portal_source_access**

Use the materialized view — this is what the app actually queries:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
SELECT
  COUNT(*) as total_future_events,
  COUNT(DISTINCT e.source_id) as active_sources,
  COUNT(DISTINCT date_trunc('week', e.start_date)) as weeks_with_events
FROM events e
JOIN portal_source_access psa ON psa.source_id = e.source_id
  AND psa.portal_id = (SELECT id FROM portals WHERE slug = 'helpatl')
WHERE e.is_active = true
  AND e.start_date >= NOW();
"
```

Target: ~2,500+ total future events, 40+ active sources.

- [ ] **Check category diversity**

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
SELECT e.category, COUNT(*) as event_count
FROM events e
JOIN portal_source_access psa ON psa.source_id = e.source_id
  AND psa.portal_id = (SELECT id FROM portals WHERE slug = 'helpatl')
WHERE e.is_active = true AND e.start_date >= NOW()
GROUP BY e.category
ORDER BY event_count DESC;
"
```

Target: At least 5 distinct categories with events. Mental health, support groups, and library programming should now appear.

- [ ] **Check access breakdown (owned vs subscribed)**

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "
SELECT psa.access_type, COUNT(DISTINCT psa.source_id) as sources,
  (SELECT COUNT(*) FROM events e WHERE e.source_id = psa.source_id AND e.is_active = true AND e.start_date >= NOW()) as future_events
FROM portal_source_access psa
WHERE psa.portal_id = (SELECT id FROM portals WHERE slug = 'helpatl')
GROUP BY psa.access_type;
"
```

Expected: `subscription` type should now show 15+ sources.

- [ ] **Run the HelpATL feed in browser to visually verify**

Navigate to the HelpATL portal and confirm new content categories appear in the feed.
