# HelpATL Civic Breadth Phase 2 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining civic data sources identified in Phase 1: IQM2 City Council (163 meetings/yr), Georgia Elections (6-8 events/yr), Clayton + Cherokee school boards, and production writes for all new crawlers.

**Architecture:** Four independent tasks plus one production activation task. IQM2 is the highest ROI — a single RSS feed delivering 163 structured meetings/year for Atlanta City Council and its 7 committees. Elections is low-volume but high civic signal. Clayton + Cherokee reuse the proven DeKalb Finalsite parser. Production writes activate everything built in Phase 1.

**Tech Stack:** Python crawlers (BeautifulSoup, `feedparser` for RSS), Supabase/PostgreSQL, existing CityPulse pipeline.

**Phase 1 Recap — What's Already Built:**
- Feed source diversity cap (40% max per source)
- Fulton + DeKalb school board crawlers (10 meetings)
- Cobb + Gwinnett school board crawlers (36 meetings)
- Mobilize.us expansion (60+ events from 20 org IDs)
- Eventbrite civic source (68 events)
- PADV, LaAmistad, NAP, CASA crawlers fixed
- News retention extended to 30 days

---

## Task 1: IQM2 Atlanta City Council Crawler

**Files:**
- Create: `crawlers/sources/atlanta_city_council.py`
- Create: `crawlers/tests/test_atlanta_city_council.py`
- Create: `supabase/migrations/20260322200000_atlanta_city_council_source.sql`

**Context:** Atlanta City Council uses IQM2 (`atlantacityga.iqm2.com`). The calendar RSS feed is at `https://atlantacityga.iqm2.com/Services/RSS.aspx?Feed=Calendar`. It covers City Council + 7 standing committees: City Utilities, Committee on Council, Community Development/Human Services, Finance/Executive, Public Safety & Legal Administration, Transportation, Zoning Committee. ~163 meetings/year. This replaces the broken source 1251 (Atlanta Boards & Commissions) which targeted an Akamai WAF-blocked page.

The existing source 1084 (`atlanta-city-meetings`) already crawls City Council via a different method (Playwright on atlantaga.gov) and produces 122 events. This new crawler targets the IQM2 system which may have different/additional meetings (committee meetings that the atlantaga.gov crawler misses). Deduplication by content_hash will prevent duplicates.

- [ ] **Step 1: Test the IQM2 RSS feed**

```bash
curl -s "https://atlantacityga.iqm2.com/Services/RSS.aspx?Feed=Calendar" | python3 -c "
import feedparser, sys
feed = feedparser.parse(sys.stdin.read())
print(f'Entries: {len(feed.entries)}')
for e in feed.entries[:10]:
    print(f'  {e.get(\"title\", \"?\")[:60]} | {e.get(\"published\", \"?\")}')
"
```

- [ ] **Step 2: Write failing test for RSS parsing**

```python
# tests/test_atlanta_city_council.py
def test_parse_iqm2_rss_entry():
    """Parse an IQM2 RSS entry into an event dict."""
    entry = {
        "title": "City Council - Regular Meeting",
        "published": "Mon, 07 Apr 2026 14:00:00 GMT",
        "link": "https://atlantacityga.iqm2.com/Citizens/Detail_Meeting.aspx?ID=1234",
        "summary": "Regular meeting of the Atlanta City Council"
    }
    result = parse_iqm2_entry(entry)
    assert result["title"] == "Atlanta City Council Regular Meeting"
    assert result["start_date"] == "2026-04-07"
    assert result["start_time"] == "14:00"
    assert result["source_url"] == entry["link"]
    assert result["category"] == "community"
```

- [ ] **Step 3: Run test, verify it fails**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -m pytest tests/test_atlanta_city_council.py -v
```

- [ ] **Step 4: Implement the crawler**

```python
# crawlers/sources/atlanta_city_council.py
"""
Atlanta City Council meetings via IQM2 RSS feed.
Covers City Council + 7 standing committees (~163 meetings/year).
Source: https://atlantacityga.iqm2.com/Services/RSS.aspx?Feed=Calendar
"""

import feedparser
# ... standard crawler pattern

RSS_URL = "https://atlantacityga.iqm2.com/Services/RSS.aspx?Feed=Calendar"

VENUE_DATA = {
    "name": "Atlanta City Hall",
    "slug": "atlanta-city-hall",
    "address": "55 Trinity Ave SW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303",
    "lat": 33.7490,
    "lng": -84.3904,
    "venue_type": "government",
    "website": "https://www.atlantaga.gov",
}

# Parse RSS with feedparser
# Title format: "Committee Name - Meeting Type"
# Extract committee name, create series_hint per committee
# Tags: ["government", "city-council", "public-meeting"]
# Category: "community"
# is_free: True
```

Key implementation details:
- Use `feedparser` to parse the RSS feed (no Playwright needed)
- Parse `published` field for date/time
- Extract committee name from title prefix (before " - ")
- Create `series_hint` per committee: `"series_title": "Atlanta City Council"`, `"series_title": "Zoning Committee"`, etc.
- Tags should include `government`, `city-council`, `public-meeting`, and the specific committee slug
- The `link` field is the meeting detail URL — use as `source_url`

- [ ] **Step 5: Run test, verify it passes**
- [ ] **Step 6: Write migration to register source**

```sql
-- Register IQM2 City Council source with HelpATL ownership
INSERT INTO sources (name, slug, url, is_active, owner_portal_id)
VALUES (
  'Atlanta City Council (IQM2)',
  'atlanta-city-council-iqm2',
  'https://atlantacityga.iqm2.com/Services/RSS.aspx?Feed=Calendar',
  true,
  (SELECT id FROM portals WHERE slug = 'helpatl')
);

-- Share with Atlanta portal
INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
SELECT s.id, s.owner_portal_id, 'all'
FROM sources s WHERE s.slug = 'atlanta-city-council-iqm2';

INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
SELECT
  (SELECT id FROM portals WHERE slug = 'atlanta'),
  s.id, 'all', true
FROM sources s WHERE s.slug = 'atlanta-city-council-iqm2';
```

- [ ] **Step 7: Run with --dry-run**

```bash
python3 main.py --source atlanta-city-council-iqm2 --dry-run
```

- [ ] **Step 8: Commit**

```bash
git add crawlers/sources/atlanta_city_council.py crawlers/tests/test_atlanta_city_council.py supabase/migrations/20260322200000_atlanta_city_council_source.sql
git commit -m "feat: add Atlanta City Council IQM2 crawler (RSS, 163 meetings/yr)"
```

---

## Task 2: Georgia Elections Crawler

**Files:**
- Create: `crawlers/sources/georgia_elections.py`
- Create: `crawlers/tests/test_georgia_elections.py`
- Create: `supabase/migrations/20260322200001_georgia_elections_source.sql`

**Context:** From B3 research: Cobb County has the cleanest HTML elections calendar at `https://www.cobbcounty.gov/elections/voting/elections-calendar`. It lists 6-8 elections per year with dates, registration deadlines, and early voting windows. These dates are the same statewide for statewide races, making one source sufficient for all 4 metro counties.

The 4 existing county election sources (Fulton, DeKalb, Cobb, Gwinnett) should be deactivated in favor of this one unified source.

- [ ] **Step 1: Write failing test for election date parsing**

```python
def test_parse_election_row():
    """Parse a Cobb elections table row into events."""
    # Each election row produces 2-3 events: registration deadline, early voting start, election day
    html_row = '<tr><td>General Primary / Nonpartisan</td><td>May 19, 2026</td><td>April 20, 2026</td><td>April 20, 2026</td></tr>'
    events = parse_election_row(html_row)
    assert len(events) >= 2
    assert events[0]["title"] == "Voter Registration Deadline — General Primary"
    assert events[0]["start_date"] == "2026-04-20"
    assert events[1]["title"] == "General Primary / Nonpartisan Election"
    assert events[1]["start_date"] == "2026-05-19"
```

- [ ] **Step 2: Run test, verify it fails**
- [ ] **Step 3: Implement the crawler**

Target: `https://www.cobbcounty.gov/elections/voting/elections-calendar`
Parse the HTML `<table>` for election rows. For each election, create 2-3 events:
1. **Voter Registration Deadline** (from registration deadline column)
2. **Election Day** (from election date column)
3. **Early Voting Opens** (if early voting dates are available — may need to check Cobb's advance voting schedule page)

```python
VENUE_DATA = {
    "name": "Georgia Elections",
    "slug": "georgia-elections",
    "address": "2 Martin Luther King Jr Dr SE",  # Georgia Capitol
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30334",
    "venue_type": "government",
    "website": "https://sos.ga.gov",
}
```

Tags: `["election", "government", "voter-registration", "civic-deadline"]`
Category: `community`
Each election should get a series: `series_title = "2026 Georgia Elections"`

- [ ] **Step 4: Run test, verify it passes**
- [ ] **Step 5: Write migration**

Register the source with HelpATL ownership. Deactivate the 4 per-county election sources:
```sql
-- Deactivate redundant county election sources
UPDATE sources SET is_active = false
WHERE slug IN ('fulton-county-elections', 'dekalb-county-elections', 'cobb-county-elections', 'gwinnett-county-elections');

-- Register unified Georgia Elections source
INSERT INTO sources (name, slug, url, is_active, owner_portal_id)
VALUES (
  'Georgia Elections Calendar',
  'georgia-elections-calendar',
  'https://www.cobbcounty.gov/elections/voting/elections-calendar',
  true,
  (SELECT id FROM portals WHERE slug = 'helpatl')
);
```

- [ ] **Step 6: Run with --dry-run**
- [ ] **Step 7: Commit**

---

## Task 3: Clayton + Cherokee School Board Crawlers

**Files:**
- Create: `crawlers/sources/clayton_county_schools_board.py`
- Create: `crawlers/sources/cherokee_county_schools_board.py`
- Create: `supabase/migrations/20260322200002_clayton_cherokee_school_board_sources.sql`

**Context:** From D1 research: both districts use Finalsite CMS with the same `<article>` + `<time class="fsDate" datetime="ISO8601">` pattern as DeKalb. The DeKalb crawler's `_parse_board_events_from_html()` function is the template.

- Clayton: Homepage calendar (`data-calendar-ids=353`), 6 meetings visible (Mar–Jun 2026). Filter by "Board" keyword from district-wide calendar.
- Cherokee: Homepage calendar (`data-calendar-ids=364`). Filter by "Board" keyword. `/board-of-education/board-meetings` only shows past meetings.

- [ ] **Step 1: Write Clayton County Schools Board crawler**

```python
# crawlers/sources/clayton_county_schools_board.py
"""
Clayton County Schools Board of Education meetings.
Source: https://www.clayton.k12.ga.us (Finalsite district calendar, IDs=353)
Reuses DeKalb's Finalsite article parsing pattern.
"""

SCHEDULE_URL = "https://www.clayton.k12.ga.us"  # Homepage has the calendar
BOARD_KEYWORDS = ["board meeting", "board work session", "board of education"]

VENUE_DATA = {
    "name": "Clayton County Public Schools Central Office",
    "slug": "clayton-county-schools-central",
    "address": "1058 Fifth Ave",
    "city": "Jonesboro",
    "state": "GA",
    "zip": "30236",
    "venue_type": "organization",
    "website": "https://www.clayton.k12.ga.us",
}
```

Parse `<article>` elements from homepage. Filter titles containing board keywords. Extract `<time class="fsDate" datetime="...">` for dates.

- [ ] **Step 2: Write Cherokee County Schools Board crawler**

```python
# crawlers/sources/cherokee_county_schools_board.py
"""
Cherokee County Schools Board of Education meetings.
Source: https://www.cherokeek12.net (Finalsite district calendar, IDs=364)
"""

SCHEDULE_URL = "https://www.cherokeek12.net"  # Homepage calendar
BOARD_KEYWORDS = ["board meeting", "board work session", "board of education"]

VENUE_DATA = {
    "name": "Cherokee County School District Office",
    "slug": "cherokee-county-schools-office",
    "address": "110 Academy St",
    "city": "Canton",
    "state": "GA",
    "zip": "30114",
    "venue_type": "organization",
    "website": "https://www.cherokeek12.net",
}
```

Same Finalsite article pattern as Clayton.

- [ ] **Step 3: Run both with --dry-run**
- [ ] **Step 4: Write migration to register sources with HelpATL ownership**
- [ ] **Step 5: Run tests**
- [ ] **Step 6: Commit**

---

## Task 4: Production Writes — Activate All Phase 1+2 Crawlers

**Context:** All crawlers from both phases have been built and dry-run tested. This task runs them all with `--allow-production-writes` to populate the database with real events.

- [ ] **Step 1: Run school board crawlers**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source fulton-county-schools-board --allow-production-writes --skip-run-lock
python3 main.py --source dekalb-county-schools-board --allow-production-writes --skip-run-lock
python3 main.py --source cobb-county-schools-board --allow-production-writes --skip-run-lock
python3 main.py --source gwinnett-county-schools-board --allow-production-writes --skip-run-lock
python3 main.py --source clayton-county-schools-board --allow-production-writes --skip-run-lock
python3 main.py --source cherokee-county-schools-board --allow-production-writes --skip-run-lock
```

- [ ] **Step 2: Run civic org crawlers**

```bash
python3 main.py --source partnership-against-domestic-violence --allow-production-writes --skip-run-lock
python3 main.py --source laamistad --allow-production-writes --skip-run-lock
python3 main.py --source new-american-pathways --allow-production-writes --skip-run-lock
python3 main.py --source atlanta-casa --allow-production-writes --skip-run-lock
```

- [ ] **Step 3: Run Mobilize.us with org expansion**

```bash
python3 main.py --source mobilize-us --allow-production-writes --skip-run-lock
```

- [ ] **Step 4: Run Eventbrite civic**

```bash
python3 main.py --source eventbrite-civic --allow-production-writes --skip-run-lock
```

- [ ] **Step 5: Run IQM2 City Council (if Task 1 complete)**

```bash
python3 main.py --source atlanta-city-council-iqm2 --allow-production-writes --skip-run-lock
```

- [ ] **Step 6: Run Georgia Elections (if Task 2 complete)**

```bash
python3 main.py --source georgia-elections-calendar --allow-production-writes --skip-run-lock
```

- [ ] **Step 7: Verify final counts**

```bash
python3 -c "
from db.client import get_client
s = get_client()

portal_id = '8d479b53-bab7-433f-8df6-b26cf412cd1d'
r = s.table('events').select('source_id', count='exact').eq('portal_id', portal_id).eq('is_active', True).gte('start_date', '2026-03-22').execute()
print(f'Total HelpATL future events: {r.count}')

# Source breakdown
from collections import Counter
sources = Counter(e['source_id'] for e in r.data)
for sid, count in sources.most_common(20):
    src = s.table('sources').select('name').eq('id', sid).limit(1).execute()
    name = src.data[0]['name'] if src.data else f'source_{sid}'
    pct = round(100 * count / r.count, 1)
    print(f'  {count:4d} ({pct:5.1f}%) | {name}')
"
```

- [ ] **Step 8: Verify production readiness checklist**

```
- [ ] Government meetings: 400+ events from 5+ jurisdictions
- [ ] Volunteer opportunities: 500+ from 10+ organizations
- [ ] HOA concentration < 50% of feed items
- [ ] School boards: 6 metro districts (Fulton, DeKalb, Cobb, Gwinnett, Clayton, Cherokee)
- [ ] Civic organizing: 100+ events (Mobilize 60+ Eventbrite 68)
- [ ] Civic news: 30+ filtered articles from 4+ sources
- [ ] A stranger landing on the URL finds useful civic information within 10 seconds
```

- [ ] **Step 9: Commit verification results**

---

## Sequencing

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| **Now** | Task 1: IQM2 City Council | Medium | 163 meetings/yr — biggest single source addition |
| **Now** | Task 2: Georgia Elections | Low | 6-8 events/yr but high civic signal |
| **Now** | Task 3: Clayton + Cherokee | Low | Reuse proven pattern, 2 more districts |
| **After 1-3** | Task 4: Production writes | Low | Activates everything |
