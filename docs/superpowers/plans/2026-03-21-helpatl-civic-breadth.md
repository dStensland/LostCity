# HelpATL Civic Breadth Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform HelpATL from a volunteer shift board (81% HOA) to a production-ready civic portal with government meetings, civic organizing, school boards, and civic news alongside volunteer opportunities.

**Architecture:** Five parallel workstreams — each independently shippable, each makes the portal measurably better. Government meetings (fix dark crawlers), civic organizing (expand Mobilize.us + Eventbrite), school boards (new crawlers for Simbli eBoard), civic news (configure existing RSS pipeline), and feed diversity (break HOA visual dominance). All work is crawler/data-layer — no new web infrastructure needed.

**Tech Stack:** Python crawlers (BeautifulSoup + Playwright), Supabase/PostgreSQL, Mobilize.us public API, Simbli eBoard, RSS feeds, existing CityPulse pipeline.

**Current State (2026-03-21):**
| Content Type | Volume (30d) | Sources | Concentration |
|-------------|-------------|---------|---------------|
| Volunteer shifts | 736 | HOA 467, Food Bank 175, Open Hand 94 | 81% of total |
| Government meetings | 449 | City 122, Planning 249, MARTA 52+17, APS 8, Fulton Health 1 | Working but invisible |
| Civic organizing | 13 | Mobilize.us only | Underdeveloped |
| Elections | 0 | 4 sources, all dark | Broken |
| School boards | 0 | DeKalb + Fulton crawlers exist, both return 0 | Broken |
| Civic news | ~20 articles | 6 RSS sources with civic tags | Working but filtered |
| Volunteer opps (entity) | 61 rows | United Way, IRC | Not surfaced in feed |

**Target State:**
| Content Type | Target (30d) | How |
|-------------|-------------|-----|
| Volunteer shifts | 800+ | Keep flowing, group into series |
| Government meetings | 500+ (already 449!) | Surface existing data, fix dark sources |
| Civic organizing | 60+ | Mobilize.us org expansion + Eventbrite civic |
| School boards | 30+ | Fix Simbli crawlers + add Cobb/Gwinnett |
| Civic news | 40+ articles | Already have 6 civic RSS sources active |
| HOA concentration | <50% | Series grouping + diversity rules |

**Critical Realization:** Government meetings are NOT a gap — we already have 449 (City 122, Planning 249, MARTA 69, APS 8, Health 1). The problem is they're invisible in the feed because HOA's 467 volunteer shifts drown them out. The biggest win is feed-level, not crawler-level.

---

## Workstream A: Surface Existing Government Data (Highest ROI)

The portal already has 449 government meeting events from working crawlers. They're just buried under volunteer shifts in the timeline. This workstream makes them visible.

### Task A1: Audit Government Meeting Visibility in Feed

**Files:**
- Read: `web/components/feed/CivicFeedShell.tsx`
- Read: `web/lib/city-pulse/pipeline/build-sections.ts`
- Read: `web/lib/city-pulse/pipeline/fetch-events.ts`

**Context:** The CityPulse pipeline builds timeline sections (right_now, tonight, this_week, etc.) from portal-scoped events. Government meetings should appear alongside volunteer shifts, but HOA's volume (467 vs 122 city meetings) means meetings get pushed below the fold.

- [ ] **Step 1: Query the feed API and count government vs volunteer events**

```bash
cd /Users/coach/Projects/LostCity/web
curl -s "http://localhost:3000/api/portals/helpatl/city-pulse" | python3 -c "
import json, sys
data = json.load(sys.stdin)
sections = data.get('sections', [])
for s in sections:
    items = s.get('items', [])
    print(f\"{s.get('id','?'):20s} | {len(items)} items\")
    # Check source diversity
    sources = {}
    for item in items:
        e = item.get('event', {})
        vid = e.get('venue', {}).get('name', 'unknown')
        sources[vid] = sources.get(vid, 0) + 1
    for src, count in sorted(sources.items(), key=lambda x: -x[1])[:3]:
        print(f\"  {src}: {count}\")
"
```

Expected: See whether government meeting events appear in any section, or are entirely absent.

- [ ] **Step 2: Check if government meetings have the right category for civic portal filters**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
from db.client import get_client
s = get_client()
# Check categories of government meeting events
for slug in ['atlanta-city-meetings', 'atlanta-city-planning', 'marta-board']:
    src = s.table('sources').select('id').eq('slug', slug).limit(1).execute()
    if src.data:
        cats = s.rpc('get_distinct_values', {'table_name': 'events', 'column_name': 'category_id'}).execute()
        ev = s.table('events').select('category_id').eq('source_id', src.data[0]['id']).eq('is_active', True).gte('start_date', '2026-03-21').limit(5).execute()
        print(f\"{slug}: {[e['category_id'] for e in ev.data]}\")
"
```

Check: Do government events have `category_id = 'community'`? The portal filter is `categories: [community, learning, family]`. If meetings have a different category (e.g., `government`), they'd be filtered OUT.

- [ ] **Step 3: Document findings and determine fix**

If government meetings are excluded by portal category filter:
- Option A: Add `government` to HelpATL's `categories` filter array
- Option B: Re-categorize government meeting events as `community`

If they're included but buried:
- Proceed to Task A2 (feed diversity)

- [ ] **Step 4: Commit findings doc**

```bash
git add docs/superpowers/plans/
git commit -m "docs: audit government meeting visibility in civic feed"
```

### Task A2: Feed Source Diversity Rules

**Files:**
- Modify: `web/lib/city-pulse/pipeline/build-sections.ts`
- Test: `web/lib/city-pulse/pipeline/__tests__/build-sections.test.ts` (create if needed)

**Context:** The CityPulse pipeline scores and sorts events for timeline sections. Currently, HOA events dominate because they outnumber everything else. We need diversity rules so government meetings, civic organizing, and volunteer shifts all get representation.

- [ ] **Step 1: Write failing test for source diversity**

```typescript
// Test that no single source_id accounts for more than 40% of items in a section
test("timeline section enforces source diversity", () => {
  const items = buildTimelineSection(mockEvents, context);
  const sourceCounts = new Map<number, number>();
  for (const item of items) {
    const sid = item.event?.source_id;
    if (sid) sourceCounts.set(sid, (sourceCounts.get(sid) || 0) + 1);
  }
  for (const [sid, count] of sourceCounts) {
    expect(count / items.length).toBeLessThanOrEqual(0.4);
  }
});
```

- [ ] **Step 2: Run test, verify it fails**
- [ ] **Step 3: Implement source diversity cap in section builder**

In the scoring/sorting step of `build-sections.ts`, after scoring events, apply a diversity cap:
- No single `source_id` can account for more than 40% of items in any timeline section
- Excess items from over-represented sources are moved to the end (not removed)
- This ensures government meetings (source_id != HOA) get surfaced even if HOA has 4x the volume

- [ ] **Step 4: Run test, verify it passes**
- [ ] **Step 5: Browser-verify the civic feed shows mixed content**
- [ ] **Step 6: Commit**

### Task A3: HOA Series Grouping

**Files:**
- Modify: `crawlers/sources/hands_on_atlanta.py` (or the HOA Golden API crawler)
- Read: `crawlers/db/events.py` (series_hint pattern)

**Context:** HOA produces 467 events where the same shift type (e.g., "Morning Warehouse Sort") repeats across 15+ dates. Each gets its own card in the feed. Grouping identical shifts into series would reduce 467 cards to ~30 series cards with "See all dates" — making room for other content types.

- [ ] **Step 1: Analyze HOA shift patterns**

```bash
python3 -c "
from db.client import get_client
s = get_client()
ev = s.table('events').select('title').eq('source_id', 13).eq('is_active', True).gte('start_date', '2026-03-21').execute()
from collections import Counter
titles = Counter(e['title'] for e in ev.data)
print(f'Total events: {len(ev.data)}')
print(f'Unique titles: {len(titles)}')
for title, count in titles.most_common(15):
    print(f'  {count:3d}x {title}')
"
```

- [ ] **Step 2: Add series_hint to HOA crawler**

For each shift type + venue combination, generate a `series_hint`:
```python
series_hint = {
    "series_type": "recurring_show",
    "series_title": shift_title,  # e.g., "Morning Warehouse Sort"
    "frequency": "weekly",
    "venue_id": venue_id,
}
insert_event(event_record, series_hint=series_hint)
```

- [ ] **Step 3: Run HOA crawler with --dry-run to verify series creation**
- [ ] **Step 4: Commit**

---

## Workstream B: Fix Dark Government Sources

### Task B1: Fix Simbli eBoard School Board Crawlers

**Files:**
- Debug: `crawlers/sources/fulton_county_schools_board.py`
- Debug: `crawlers/sources/dekalb_county_schools_board.py`

**Context:** Both crawlers exist and use Playwright to navigate Simbli eBoard (Incapsula WAF-protected). Both return 0 events despite being "success" status. Simbli eBoard is used by most Georgia school districts — fixing this pattern enables adding Cobb/Gwinnett later.

- [ ] **Step 1: Run Fulton County Schools crawler with debug logging**

```bash
LOG_LEVEL=DEBUG python3 main.py --source fulton-county-schools-board --dry-run 2>&1 | tail -40
```

- [ ] **Step 2: If Incapsula is blocking, check user-agent and cookie handling**

Common Simbli failure modes:
- Incapsula challenge page returned instead of meeting list
- JavaScript redirect not followed by Playwright
- Meeting dates are in a table that loads via AJAX after initial page render

- [ ] **Step 3: Manually navigate to the Simbli URL in a browser**

Visit `https://simbli.eboardsolutions.com/SB_Meetings/SB_MeetingListing.aspx?S=36031609` and verify:
- Does the page load meetings?
- How many future meetings are visible?
- What's the HTML structure? (inspect table/list elements)

- [ ] **Step 4: Fix the crawler based on findings**

Common fixes:
- Add `page.wait_for_selector("table.MeetingList")` before parsing
- Increase timeout for Incapsula challenge resolution
- Add cookie/session handling for WAF bypass

- [ ] **Step 5: Repeat for DeKalb County Schools**
- [ ] **Step 6: Run both with --dry-run and verify events found**
- [ ] **Step 7: Commit fixes**

### Task B2: Research + Build Atlanta Boards & Commissions Crawler

**Files:**
- Create (likely): `crawlers/sources/atlanta_boards_commissions.py`

**Context:** Source 1251 "City of Atlanta Boards and Commissions" has status=error with "Server disconnected". Has produced 0 events ever. **No crawler file exists for this source** — it's a registered DB record with no implementation. This is a high-value source — Atlanta has 40+ boards and commissions that hold public meetings.

- [ ] **Step 1: Research the data source**

Check: `https://www.atlantaga.gov/government/boards-and-commissions` — is there a meeting calendar? Use WebFetch or browser to inspect the page. Look for an embedded calendar, iCal feed, or structured meeting schedule.

- [ ] **Step 2: Determine if meetings are published in a crawlable format**

Options:
- City of Atlanta may use Legistar (many municipalities do) — check for `atlantaga.legistar.com`
- BoardDocs or Simbli (common for government boards)
- Static HTML calendar page
- PDF agendas only (not crawlable without LLM extraction)

- [ ] **Step 3: Build crawler based on findings**
- [ ] **Step 4: Run with --dry-run**
- [ ] **Step 5: Commit**

### Task B3: Research + Build Elections Crawlers

**Files:**
- Create: `crawlers/sources/fulton_county_elections.py` (or appropriate filename)
- Create: `crawlers/sources/dekalb_county_elections.py`
- Create: `crawlers/sources/cobb_county_elections.py`
- Create: `crawlers/sources/gwinnett_county_elections.py`

**Context:** 4 election sources are all registered in the DB and marked active but **no crawler files exist for any of them**. They produce 0 events. Election offices may legitimately have few events between cycles, but they should at minimum have voter registration deadlines, early voting dates, and election day info.

- [ ] **Step 1: Check each county elections website for crawlable event/calendar data**

Research each:
- Fulton County Registration & Elections: `https://www.fultoncountyga.gov/inside-fulton-county/fulton-county-departments/registration-and-elections`
- DeKalb County Voter Registration: `https://www.dekalbcountyga.gov/voter-registration-elections`
- Cobb County Elections: `https://www.cobbcounty.org/elections`
- Gwinnett County Elections: `https://www.gwinnettcounty.com/web/gwinnett/departments/elections`

- [ ] **Step 2: Check Georgia Secretary of State website for upcoming election dates**

The next election cycle dates (primaries, runoffs, generals) should be capturable as events. Check `sos.ga.gov` for the election calendar.

- [ ] **Step 3: For each county elections source, determine if the crawler is broken or the source is legitimately empty**
- [ ] **Step 4: Fix broken crawlers or deactivate legitimately empty sources with a note**
- [ ] **Step 5: Commit**

---

## Workstream C: Expand Civic Organizing Coverage

### Task C1: Mobilize.us Org Expansion

**Files:**
- Modify: `crawlers/sources/mobilize_api.py`
- Test: `crawlers/tests/test_mobilize_api.py` (create if needed)

**Context:** Mobilize.us currently returns 13 future events for Atlanta metro. The crawler filters to non-electoral events from a 30-mile radius around 30303. Several high-value civic orgs use Mobilize but may not be captured: Fair Fight, New Georgia Project, Georgia STAND-UP, Indivisible Georgia, ACLU Georgia chapters.

- [ ] **Step 1: Audit what Mobilize.us org_ids are currently captured**

```bash
python3 -c "
from db.client import get_client
s = get_client()
ev = s.table('events').select('title,description').eq('source_id', 1217).eq('is_active', True).gte('start_date', '2026-03-21').execute()
for e in ev.data:
    print(f\"{e['title'][:60]}\")
print(f'Total: {len(ev.data)}')
"
```

- [ ] **Step 2: Query Mobilize.us API for specific org slugs**

Test whether adding org-specific queries captures more events:
```bash
curl -s "https://api.mobilize.us/v1/organizations/fair-fight/events?timeslot_start=gte_now" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f\"Fair Fight events: {data.get('count', 0)}\")
for e in data.get('data', [])[:5]:
    print(f\"  {e['title'][:60]} | {e.get('location', {}).get('locality', '?')}\")
"
```

Repeat for: `new-georgia-project`, `georgia-stand-up`, `indivisible-georgia`, `aclu-georgia`, `common-cause-georgia`, `lwv-atlanta`, `fair-count`

- [ ] **Step 3: Add org-specific fetching to mobilize_api.py**

If the geo query misses org-specific events (some orgs post statewide events that don't geo-filter to Atlanta), add an `ORG_SLUGS` list that fetches directly by org:

```python
ORG_SLUGS = [
    "fair-fight",
    "new-georgia-project",
    "georgia-stand-up",
    "fair-count",
    # Add more as discovered
]
```

- [ ] **Step 4: Run with --dry-run, verify increased event count**
- [ ] **Step 5: Commit**

### Task C2: Eventbrite Civic Category Expansion

**Files:**
- Modify: `crawlers/sources/eventbrite.py`
- Read: Eventbrite API docs for category filtering

**Context:** Eventbrite has civic/nonprofit event categories (Community & Culture, Government & Politics, Charity & Causes). The existing Atlanta Eventbrite crawler may not be fetching these categories.

- [ ] **Step 1: Check current Eventbrite crawler category configuration**

```bash
grep -n "category" crawlers/sources/eventbrite.py | head -20
```

- [ ] **Step 2: Identify civic-relevant Eventbrite categories/subcategories**

Eventbrite category IDs for civic content:
- 113: Community & Culture
- 112: Government & Politics
- 111: Charity & Causes
- 199: Other (often used for civic events)

- [ ] **Step 3: Add civic category fetching**

Either add new category IDs to the existing fetcher, or create a separate `eventbrite_civic.py` crawler that feeds into the HelpATL portal with `owner_portal_id = helpatl_id`.

- [ ] **Step 4: Run with --dry-run to check yield**
- [ ] **Step 5: Commit**

### Task C3: Fix Dark Civic Org Crawlers + Write Missing Ones

**Files:**
- Debug: `crawlers/sources/padv.py` (exists — inactive source 940; active source 1264 has no crawler)
- Debug: `crawlers/sources/profiles/laamistad.yaml` (profile exists, no crawler module)
- Debug: `crawlers/sources/profiles/atlanta-casa.yaml` (profile exists, no crawler module)
- Create: `crawlers/sources/new_american_pathways.py` (genuinely missing)

**Context:** From the dark source audit, 4 civic orgs need attention. **3 already have crawler files or profiles** — they need debugging, not rewriting. Only New American Pathways needs a new crawler from scratch.

- PADV: `padv.py` exists but serves inactive source 940. Active source 1264 (`partnership-against-domestic-violence`) needs either a slug remap to use `padv.py` or a new file. PADV has a Sept 4 event at `padv.org/events/`.
- LaAmistad: Source profile exists at `profiles/laamistad.yaml`. Check if the generic venue crawler handles it. LaAmistad has a Sept 26 Fiesta at `laamistadinc.org/events/`.
- Atlanta CASA: Source profile exists at `profiles/atlanta-casa.yaml`. Check generic crawler handling. Currently 0 events on their site ("Nothing currently scheduled!").
- New American Pathways: No file at all. Has Tribe Events Calendar at `/nap-events/`.

- [ ] **Step 1: Fix PADV — remap active source to existing crawler**

Option A: Add `SOURCE_OVERRIDES` entry mapping `partnership-against-domestic-violence` → `padv`
Option B: Reactivate source 940 and deactivate source 1264
Option C: Copy `padv.py` → `partnership_against_domestic_violence.py`

Then run with --dry-run to verify it finds the Sept 4 event.

- [ ] **Step 2: Debug LaAmistad — check if profile-based crawling works**

```bash
python3 main.py --source laamistad --dry-run 2>&1 | tail -20
```

If the generic venue crawler handles the profile but finds 0 events, the page structure needs a custom parser. LaAmistad uses WordPress/Elementor — dates are in body text, not structured.

- [ ] **Step 3: Debug Atlanta CASA — verify profile works**

```bash
python3 main.py --source atlanta-casa --dry-run 2>&1 | tail -20
```

Currently 0 events on their site — confirm the crawler would work when they post events. Fix source URL if needed (should point to `/get-involved/event-calendar/public-events/`).

- [ ] **Step 4: Write New American Pathways crawler**

Target: `https://newamericanpathways.org/nap-events/` — Tribe Events Calendar. Hit `/wp-json/tribe/events/v1/events` API. Use `_tribe_events_base.py` if it exists, otherwise write a standalone Tribe API crawler.

- [ ] **Step 5: Run all 4 with --dry-run**
- [ ] **Step 6: Commit**

---

## Workstream D: School Board Coverage Expansion

### Task D1: Research Simbli eBoard Pattern

**Context:** Fulton and DeKalb school boards both use Simbli eBoard. Cobb County and Gwinnett County likely use the same platform (it's standard for GA school districts). Before building new crawlers, fix the Simbli pattern once.

- [ ] **Step 1: Research Cobb County Schools board meeting platform**

```bash
curl -s "https://www.cobbk12.org/page/2199/board-of-education" | grep -i "simbli\|boarddocs\|eboardsolutions\|meeting" | head -10
```

Or use WebFetch to check the page.

- [ ] **Step 2: Research Gwinnett County Schools board meeting platform**

Check: `https://www.gcpsk12.org` → Board of Education → Meeting Schedule

- [ ] **Step 3: Document platform for each district**

| District | Platform | URL | Simbli S= ID |
|----------|----------|-----|-------------|
| Fulton County | Simbli eBoard | S=36031609 | Existing |
| DeKalb County | Simbli eBoard | S=36030443 | Existing |
| Cobb County | ? | ? | Research |
| Gwinnett County | ? | ? | Research |
| Clayton County | ? | ? | Research |
| Cherokee County | ? | ? | Research |

- [ ] **Step 4: Commit research findings**

### Task D2: Build Simbli Base Crawler

**Files:**
- Create: `crawlers/sources/_simbli_base.py`
- Test: `crawlers/tests/test_simbli_base.py`

**Context:** If multiple school districts use Simbli, build a reusable base class rather than duplicating crawler logic. The existing Fulton/DeKalb crawlers can be refactored to use it.

- [ ] **Step 1: Write test for Simbli meeting parsing**

```python
def test_parse_simbli_meeting_row():
    """Parse a meeting row from Simbli HTML into an event dict."""
    html = '<tr class="rgRow"><td>Board Meeting</td><td>04/08/2026</td><td>6:00 PM</td></tr>'
    result = parse_simbli_row(html)
    assert result["title"] == "Board Meeting"
    assert result["start_date"] == "2026-04-08"
    assert result["start_time"] == "18:00"
```

- [ ] **Step 2: Implement base crawler class**

```python
class SimbliCrawler:
    def __init__(self, simbli_id: str, district_name: str, venue_data: dict):
        self.url = f"https://simbli.eboardsolutions.com/SB_Meetings/SB_MeetingListing.aspx?S={simbli_id}"
        ...

    def crawl(self, source: dict) -> tuple[int, int, int]:
        # Playwright navigation with Incapsula handling
        # Parse meeting table
        # Insert events with series grouping by meeting type
        ...
```

- [ ] **Step 3: Refactor Fulton County Schools to use base class**
- [ ] **Step 4: Refactor DeKalb County Schools to use base class**
- [ ] **Step 5: Run both with --dry-run, verify events found**
- [ ] **Step 6: Commit**

### Task D3: Add Cobb + Gwinnett School Board Crawlers

**Files:**
- Create: `crawlers/sources/cobb_county_schools_board.py`
- Create: `crawlers/sources/gwinnett_county_schools_board.py`

**Depends on:** Task D1 (research), Task D2 (base crawler)

- [ ] **Step 1: Create Cobb County Schools crawler using base class**
- [ ] **Step 2: Create Gwinnett County Schools crawler using base class**
- [ ] **Step 3: Register sources with owner_portal_id = helpatl**
- [ ] **Step 4: Run with --dry-run**
- [ ] **Step 5: Run with --allow-production-writes**
- [ ] **Step 6: Commit**

---

## Workstream E: Civic News Pipeline

### Task E1: Audit Existing Civic News Sources

**Context:** The `network_sources` table already has 6 sources with `civic` or `politics` categories: Georgia Recorder, Capitol Beat, Atlanta Civic Circle, GBPI, Saporta Report, Atlanta Objective. These are already active and feeding the NetworkFeedSection. The civic keyword filter we added today should be keeping non-civic articles out.

- [ ] **Step 1: Verify civic news sources are flowing into HelpATL feed**

```bash
curl -s "http://localhost:3000/api/portals/helpatl/city-pulse" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for s in data.get('sections', []):
    if 'news' in s.get('id', '').lower() or 'policy' in s.get('id', '').lower() or 'network' in s.get('id', '').lower():
        print(f\"Section: {s.get('title', s.get('id'))} — {len(s.get('items', []))} items\")
        for item in s.get('items', [])[:5]:
            post = item.get('post', {})
            print(f\"  {post.get('source_name', '?'):25s} | {post.get('title', '?')[:60]}\")
"
```

- [ ] **Step 2: Check article volume per civic source over last 30 days**

```bash
python3 -c "
from db.client import get_client
s = get_client()
r = s.table('network_posts').select('source_slug', count='exact').gte('published_at', '2026-02-21').execute()
# Group by source
from collections import Counter
slugs = Counter(p['source_slug'] for p in r.data)
for slug, count in slugs.most_common(30):
    print(f'{slug:30s} | {count}')
" 2>/dev/null || echo "network_posts table may not exist — check schema"
```

- [ ] **Step 3: Verify keyword filter is working**

Load the HelpATL feed in browser, check "CIVIC UPDATES" and "POLICY WATCH" sections. Confirm no restaurant reviews or sports content.

- [ ] **Step 4: Document findings — are 6 civic sources sufficient or do we need more?**

Potential additions if volume is thin:
- City of Atlanta press releases (official .gov RSS if available)
- AJC metro government beat (may be paywalled)
- Patch Atlanta neighborhoods (hyperlocal civic content)

- [ ] **Step 5: Commit findings**

### Task E2: Add City of Atlanta Press Releases (if RSS available)

**Files:**
- Modify: DB migration or direct insert to `network_sources`

- [ ] **Step 1: Check if City of Atlanta has an RSS feed**

```bash
curl -s "https://www.atlantaga.gov/Home/news" | grep -i "rss\|feed\|atom" | head -5
```

- [ ] **Step 2: If RSS exists, add to network_sources**

```sql
INSERT INTO network_sources (name, slug, feed_url, categories, is_active)
VALUES ('City of Atlanta', 'city-of-atlanta-news', '<RSS_URL>', '{news,civic,government}', true);
```

- [ ] **Step 3: Verify articles flow into feed**
- [ ] **Step 4: Commit**

---

## Verification & Launch Criteria

### Production Readiness Checklist

After all workstreams complete, verify these metrics:

- [ ] **Government meetings: 400+ events/month from 5+ jurisdictions** (currently 449 — verify they're surfaced)
- [ ] **Volunteer opportunities: 500+ from 10+ organizations** (currently 736 from 8 orgs)
- [ ] **HOA concentration < 50% of feed items** (currently 81% — series grouping + diversity rules)
- [ ] **Civic news: 30+ filtered articles from 4+ sources** (currently 6 sources active)
- [ ] **School boards: 4+ metro districts** (currently 2, both returning 0)
- [ ] **Civic organizing: 40+ events/month** (currently 13 from Mobilize)
- [ ] **No content surface bypasses portal scoping** (fixed in prior session)
- [ ] **All navigation paths maintain civic portal identity** (fixed in prior session)
- [ ] **Zero broken links, zero dark-mode artifacts, zero admin surfaces** (fixed in prior session)
- [ ] **A stranger landing on the URL finds useful civic information within 10 seconds**

### Sequencing

| Priority | Workstream | Effort | Impact |
|----------|-----------|--------|--------|
| **Week 1** | A1-A2: Surface government data + diversity rules | Medium | Highest — 449 events already exist |
| **Week 1** | A3: HOA series grouping | Medium | Breaks visual dominance |
| **Week 1** | E1: Verify civic news pipeline | Low | Quick confirmation |
| **Week 2** | B1: Fix Simbli school board crawlers | Medium | Enables D2-D3 |
| **Week 2** | C1: Mobilize.us org expansion | Low | 30-50 more events |
| **Week 2** | C3: Write 4 missing civic org crawlers | Medium | Long-tail coverage |
| **Week 3** | D1-D2: Simbli base + research | Medium | Foundation for all school boards |
| **Week 3** | B2-B3: Boards & Commissions + Elections | Medium | Government breadth |
| **Week 4** | D3: Cobb + Gwinnett school boards | Low (if base works) | Metro coverage |
| **Week 4** | C2: Eventbrite civic | Medium | Additional civic events |
| **Week 4** | E2: City press releases | Low | Official civic news |
