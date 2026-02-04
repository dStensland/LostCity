# DATA QUALITY DIAGNOSTIC: ALL-DAY EVENTS & TIME EXTRACTION FAILURES

**Report Date:** February 3, 2026  
**Database:** LostCity Supabase Production  
**Scope:** Events from February 1, 2026 onwards  

---

## EXECUTIVE SUMMARY

**Total upcoming events:** 8,810  
**Events with specific times:** 7,269 (82.5%)  
**Events marked all-day:** 1,199 (13.6%)  
**Events with null start_time:** 1,541 (17.5%)  

### Critical Findings

1. **77 sources** are producing all-day events — many are music venues and bars where times should ALWAYS be available
2. **Eddie's Attic shows times in raw_text but fails to extract them** — found "7pm", "9:15pm", "5:30pm" in raw data but start_time is NULL
3. **19 film events from Plaza Theatre are marked all-day** — cinema showtimes should NEVER be all-day
4. **289 events have "TBA" in titles** — primarily from sports sources (Georgia Tech, GSU, Ticketmaster)
5. **Nashville music venues (Basement East, Brooklyn Bowl, Exit/In) have 100% all-day rates** — complete extraction failure

---

## 1. ALL-DAY EVENTS BY SOURCE

Top 15 sources producing all-day events:

| Source | Count | Category | All-Day % |
|--------|-------|----------|-----------|
| georgia-tech-athletics | 115 | Sports | ~93% |
| basement-east | 88 | Music (Nashville) | 100% |
| brooklyn-bowl-nashville | 67 | Music (Nashville) | 100% |
| gwcc | 51 | Convention/Sports | ~93% |
| exit-in | 49 | Music (Nashville) | 100% |
| eddies-attic | 46 | Music (Atlanta) | 92% |
| zoo-atlanta | 32 | Family | 97% |
| 529 | 31 | Music (Atlanta) | 40% |
| moda | 31 | Mixed | ~100% |
| ferst-center | 26 | Community | ~87% |
| district-atlanta | 24 | Nightlife (Atlanta) | 100% |
| krog-street-market | 24 | Community | 100% |
| atlanta-motor-speedway | 24 | Sports | ~77% |
| piedmont-healthcare | 24 | Learning | ~86% |
| helium-comedy | 23 | Comedy | ~82% |

### Pattern Analysis

**Music Venues (Should have specific times):**
- Basement East (Nashville): 88 all-day / 88 total (100%)
- Brooklyn Bowl Nashville: 67 all-day / 67 total (100%)
- Exit/In (Nashville): 49 all-day / 49 total (100%)
- Eddie's Attic (Decatur): 46 all-day / 50 total (92%)
- 529 (Atlanta): 20 all-day / 50 total (40%)
- District Atlanta (Nightlife): 24 all-day / 24 total (100%)

**Sports (Expected all-day for game dates):**
- Georgia Tech Athletics: 115 all-day (reasonable for sports — game times often TBA)
- Atlanta Motor Speedway: 24 all-day (multi-day racing events)

**Cinemas (SHOULD NEVER BE ALL-DAY):**
- Plaza Theatre: 19 all-day films ⚠️ **CRITICAL ISSUE**
- AJFF: 5 all-day films
- Atlanta Film Society: 4 all-day films

---

## 2. EVENTS WITH NULL START_TIME

Top sources missing start times:

| Source | Null Times | Total Events |
|--------|------------|--------------|
| georgia-tech-athletics | 123 | ~131 |
| eventbrite | 89 | ~150+ |
| tabernacle | 61 | ~70 |
| gwcc | 55 | ~60 |
| eddies-attic | 46 | 50 |
| coca-cola-roxy | 42 | ~50 |
| 529 | 40 | 50 |
| zoo-atlanta | 33 | 33 |
| civil-rights-center | 33 | ~40 |
| atlanta-motor-speedway | 31 | ~35 |

**Key Observations:**
- **Eddie's Attic:** Times exist in raw_text ("7pm", "9:15pm") but extraction fails
- **Eventbrite:** API likely provides times, need to check response parsing
- **Tabernacle/Coca-Cola Roxy:** Large venues — times should be on sale pages

---

## 3. "TBA" / "TO BE ANNOUNCED" IN TITLES

**Total events with TBA/TBD:** 289

### By Source:
- **gsu-athletics:** 74 events (e.g., "GSU Panthers Softball: Vs Drexel")
- **georgia-tech-athletics:** 73 events (e.g., "GT Football: vs Gardner-Webb")
- **ticketmaster-nashville:** 65 events (e.g., "SEC Men's Basketball Session 6")
- **ticketmaster:** 41 events (e.g., "Women's Basketball vs Marshall")
- **ksu-athletics:** 29 events (e.g., "KSU Softball: vs Sam Houston")

**Assessment:** TBA in sports is expected (opponents/times announced later), but these events should still have game dates, not be marked all-day.

---

## 4. SUSPICIOUS TITLES

### Very Short Titles (< 5 characters):
- **basement-east:** "Cold"
- **landmark-midtown:** "ARCO"

Both appear to be legitimate band/artist names.

### Generic Titles:
Found **0 events** with purely generic titles ("Event", "Show", "Concert" with no context).

**Assessment:** Title validation is working well — db.py's `validate_event_title()` is catching junk.

---

## 5. SPOT-CHECK: TOP OFFENDER DETAILS

### Eddie's Attic (92% all-day) — EXTRACTION FAILURE ⚠️

**Critical Finding:** Raw text contains showtime, but extraction fails.

Example from database query:
```
Event: VINNIE D AND CO: NIGHT OF THE CRUSADERS
Times found in raw_text: 7pm
Extracted start_time: None

Event: SHADES OF JADEEE
Times found in raw_text: 9:15pm
Extracted start_time: None

Event: VALENTOUR OF 2026
Times found in raw_text: 9pm
Extracted start_time: None
```

**Root Cause:** The Playwright crawler (`sources/eddies_attic.py`) uses `parse_time_text()` which looks for specific formats, but the site's JavaScript-rendered elements may not match the regex patterns.

**Recommended Fix:**
1. Add regex fallback for formats like "7pm" (no colon)
2. Store full `element_text` in `raw_text` field for debugging
3. Check if time is in a separate DOM element not being queried

---

### Basement East (100% all-day) — EXTRACTION FAILURE ⚠️

**Source:** Nashville music venue  
**Crawler:** `sources/basement_east.py` (Playwright)  
**Finding:** Looks for `.tw-calendar-event-time` class but extraction returns None for all events

Example events:
```
Space Prom: To Dream or Not to Dream — 2026-02-06 — NULL — ALL-DAY
Caroline Jones — 2026-02-17 — NULL — ALL-DAY
Sudan Archives: THE BPM Tour — 2026-02-03 — NULL — ALL-DAY
```

**Code Analysis:**
```python
# Line 136-142 in basement_east.py
time_elem = container.find(["div", "span"], class_="tw-calendar-event-time")
if time_elem:
    time_text = time_elem.get_text(strip=True)
    time_match = re.search(r"(\d{1,2}:\d{2}\s*[AP]M)", time_text, re.IGNORECASE)
    if time_match:
        start_time = parse_time(time_match.group(1))
```

**Hypothesis:** The `.tw-calendar-event-time` class may not exist, or event times are rendered differently on the live site.

**Recommended Fix:**
1. Log the full HTML of one `.tw-cal-event` container to see actual structure
2. Fallback: scrape event detail pages for times if listing doesn't have them
3. Add time extraction from event URLs if they encode showtimes

---

### Plaza Theatre (19 all-day films) — PARTIAL FAILURE ⚠️

**Source:** Historic Atlanta cinema  
**Crawler:** `sources/plaza_theatre.py` (Playwright)  
**Finding:** Most showtimes extract correctly, but 19/735 films (2.6%) are all-day

All-day films by type:
- **Special events:** "Plazamania: Phantom of the Mall", "Orson Welles Double Feature"
- **Film festivals:** "ATLANTA SHORTSFEST", "Buried Alive Film Festival 2026"
- **Workshops:** "Documentary for Beginners" (online course)
- **Fundraising:** "AJFF: Donate Now" (not a screening)

**Code Analysis:**
```python
# Line 554 in plaza_theatre.py (special events extraction)
"is_all_day": time_str is None,
```

**Assessment:** This is partially correct behavior:
- Film festivals without specific times: OK to be all-day
- Film workshops/courses: Should be categorized as "learning", not "film"
- Non-screening events (donations): Should not be imported as film events

**Recommended Fixes:**
1. Add keyword filter: Skip events with "donate", "field trip", "membership" in title
2. Reclassify "course" events as category=learning
3. For festivals, check if specific screening times exist on detail pages

---

### District Atlanta (100% all-day) — NO TIME EXTRACTION ⚠️

**Source:** Nightlife venue (electronic music)  
**Crawler:** Likely using LLM extraction or basic scraper  
**Finding:** All events have generic date titles ("Apr 17", "Mar 27")

Example events:
```
Apr 17 — 2026-04-17 — NULL — ALL-DAY
Mar 27 — 2026-03-27 — NULL — ALL-DAY
May 08 — 2026-05-08 — NULL — ALL-DAY
```

**Assessment:** Titles are date strings, not event names. Extraction completely failed.

**Recommended Fix:**
1. Review District Atlanta's site structure
2. If calendar-based, implement day-by-day crawl with event detail extraction
3. Consider marking this source inactive until fixed

---

## 6. FILM EVENTS ANALYSIS

**Total film events:** 735  
**All-day films:** 33 (4.5%)  
**Null start_time films:** 54 (7.3%)

### All-Day Films by Source:
| Source | All-Day Films | Notes |
|--------|---------------|-------|
| plaza-theatre | 19 | Special events/festivals |
| ajff | 5 | Festival events |
| atlanta-film-society | 4 | Workshops/courses |
| atlanta-film-series | 3 | Festival blocks |
| out-on-film | 1 | Special screening |
| buried-alive | 1 | Festival event |

**Assessment:**
- **Expected:** Film festivals and multi-day events may not have specific showtimes
- **Unexpected:** Regular cinema showtimes should always have times
- **Action:** Validate that Plaza Theatre's regular screenings (non-festival) all have times

---

## ROOT CAUSE ANALYSIS

### 1. Playwright Extraction Issues (Most Common)

**Affected Sources:** Eddie's Attic, Basement East, Brooklyn Bowl Nashville, Exit/In, District Atlanta

**Problem:** BeautifulSoup parsing after Playwright render doesn't match actual DOM structure.

**Evidence:**
- Eddie's Attic: Times found in `element.inner_text()` but not in queried selectors
- Basement East: `.tw-calendar-event-time` class not found despite being in code

**Why This Happens:**
- Site uses lazy-loaded components that render after initial page load
- JavaScript frameworks (Vue, React) rename classes dynamically
- Event data may be in JSON embedded in page, not DOM elements

**Solutions:**
1. Use Playwright's `page.locator()` instead of BeautifulSoup (stays in sync with live DOM)
2. Add explicit wait for time elements: `page.wait_for_selector(".time-class")`
3. Extract from `<script>` tags containing JSON event data
4. Log full `element.inner_text()` to raw_text for manual debugging

---

### 2. LLM Extraction Missing Time Fields

**Affected Sources:** Likely District Atlanta, some Eventbrite events

**Problem:** LLM extraction prompt may not explicitly request event times.

**Check File:** `crawlers/extract.py` — review the extraction prompt template.

**Recommended Fix:**
```python
# In extract.py prompt:
"Extract the following from each event:
- title (required)
- start_date (required, YYYY-MM-DD)
- start_time (required if available, HH:MM in 24-hour format)
  ⚠️ CRITICAL: Look for door times, show times, event start times
- ..."
```

---

### 3. API Response Parsing Gaps

**Affected Sources:** Eventbrite, Ticketmaster

**Problem:** API returns time data but crawler doesn't parse it.

**Check:** Review API response logging for these sources.

**Recommended Fix:**
- Eventbrite: Check if `start.local` field in API contains time
- Ticketmaster: Check if event time is in `dates.start.dateTime` field

---

### 4. Special Event Categorization

**Affected Sources:** Plaza Theatre, film festivals

**Problem:** Non-screening events (courses, donations, memberships) imported as film events.

**Recommended Fix:** Add title filtering:
```python
SKIP_PATTERNS = [
    "donate", "donation", "membership", "field trip",
    "workshop", "course", "class", "lesson"
]
if any(pattern in title.lower() for pattern in SKIP_PATTERNS):
    continue
```

---

## RECOMMENDED FIXES (PRIORITY ORDER)

### CRITICAL (Fix This Week)

1. **Eddie's Attic Time Extraction**
   - File: `/Users/coach/Projects/LostCity/crawlers/sources/eddies_attic.py`
   - Issue: Times in raw_text not being extracted
   - Fix: Add fallback regex for "7pm", "9:30pm" formats without colon
   - Impact: 46 events will get proper times

2. **Basement East Time Extraction**
   - File: `/Users/coach/Projects/LostCity/crawlers/sources/basement_east.py`
   - Issue: `.tw-calendar-event-time` selector not finding elements
   - Fix: Log full container HTML, update selector, or scrape detail pages
   - Impact: 88 Nashville events will get proper times

3. **Plaza Theatre Non-Screening Filter**
   - File: `/Users/coach/Projects/LostCity/crawlers/sources/plaza_theatre.py`
   - Issue: Importing donation pages, workshops as film events
   - Fix: Add title blacklist for non-screening events
   - Impact: Remove ~10 invalid "film" events

### HIGH (Fix This Month)

4. **Brooklyn Bowl Nashville & Exit/In**
   - Files: `sources/brooklyn_bowl_nashville.py`, `sources/exit_in.py`
   - Issue: 100% all-day event rate
   - Fix: Same Playwright selector debugging as Basement East
   - Impact: 116 Nashville music events will get times

5. **District Atlanta Title Extraction**
   - File: `sources/district_atlanta.py` (need to locate)
   - Issue: Extracting date strings as titles
   - Fix: Re-implement crawler to extract actual event names
   - Impact: 24 nightlife events will get real titles + times

6. **LLM Extraction Prompt Enhancement**
   - File: `/Users/coach/Projects/LostCity/crawlers/extract.py`
   - Issue: Not explicitly requesting event times
   - Fix: Add "start_time (REQUIRED if visible)" to prompt
   - Impact: All LLM-extracted events will include times

### MEDIUM (Ongoing Monitoring)

7. **Add Validation Rule: Film Events Must Have Times**
   - File: `/Users/coach/Projects/LostCity/crawlers/db.py`
   - Fix: In `insert_event()`, reject `category="film"` if `start_time is None`
   - Exception: Allow for `tags` containing "festival" or "special-event"

8. **Source Health Tags for High All-Day Rates**
   - Database: Update sources table
   - Action: Flag sources with >50% all-day rate for manual review
   - Query:
     ```sql
     SELECT s.slug, s.name,
            COUNT(*) as total,
            SUM(CASE WHEN e.is_all_day THEN 1 ELSE 0 END) as all_day,
            ROUND(100.0 * SUM(CASE WHEN e.is_all_day THEN 1 ELSE 0 END) / COUNT(*), 1) as pct
     FROM sources s
     JOIN events e ON e.source_id = s.id
     WHERE e.start_date >= '2026-02-01'
     GROUP BY s.id
     HAVING SUM(CASE WHEN e.is_all_day THEN 1 ELSE 0 END)::float / COUNT(*) > 0.5
     ORDER BY pct DESC;
     ```

---

## VALIDATION QUERIES

After fixes are deployed, run these queries to verify improvements:

### Check All-Day Event Rate by Source
```sql
SELECT s.slug, s.name,
       COUNT(*) as total_events,
       SUM(CASE WHEN e.is_all_day THEN 1 ELSE 0 END) as all_day_events,
       ROUND(100.0 * SUM(CASE WHEN e.is_all_day THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_all_day
FROM sources s
JOIN events e ON e.source_id = s.id
WHERE e.start_date >= CURRENT_DATE
  AND s.is_active = true
GROUP BY s.id
HAVING COUNT(*) > 10
ORDER BY pct_all_day DESC
LIMIT 20;
```

### Check Film Events Without Times
```sql
SELECT s.slug, e.title, e.start_date, e.start_time, e.tags
FROM events e
JOIN sources s ON s.id = e.source_id
WHERE e.category = 'film'
  AND e.start_date >= CURRENT_DATE
  AND (e.start_time IS NULL OR e.is_all_day = true)
ORDER BY e.start_date;
```

### Check Events with Times in Raw Text But Null start_time
```sql
SELECT s.slug, e.title, e.start_date,
       e.start_time,
       SUBSTRING(e.raw_text FROM '(\d{1,2}:?\d{0,2}\s*[ap]m)') as time_in_raw
FROM events e
JOIN sources s ON s.id = e.source_id
WHERE e.start_date >= CURRENT_DATE
  AND e.start_time IS NULL
  AND e.raw_text ~* '\d{1,2}:?\d{0,2}\s*[ap]m'
LIMIT 50;
```

---

## MONITORING DASHBOARDS

Create ongoing monitoring for:

1. **Source All-Day Rate Dashboard**
   - Track % of all-day events per source over time
   - Alert if source goes from <20% to >50% all-day (regression)

2. **Category Time Coverage**
   - % of events with times by category (film should be 95%+, music 90%+)

3. **Raw Text Time Match Analysis**
   - Flag events where `raw_text` contains time patterns but `start_time IS NULL`

---

## SUMMARY FOR CRAWLER-DEV

**Dear Crawler Team,**

We have **1,541 events (17.5%)** missing start times, with several patterns emerging:

### Immediate Action Items:
1. Fix Eddie's Attic — times exist in raw text but aren't extracted
2. Fix Nashville venues (Basement East, Brooklyn Bowl, Exit/In) — 100% all-day rate
3. Filter out Plaza Theatre non-screening events (courses, donations)

### Medium-Term Improvements:
4. Enhance LLM extraction prompt to explicitly request times
5. Review Playwright crawlers — switch from BeautifulSoup to Playwright locators for JS-heavy sites
6. Add validation: film category events must have start_time (except festivals)

### Code Files to Review:
- `/Users/coach/Projects/LostCity/crawlers/sources/eddies_attic.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/basement_east.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/brooklyn_bowl_nashville.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/exit_in.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/plaza_theatre.py`
- `/Users/coach/Projects/LostCity/crawlers/extract.py` (LLM prompt)

The underlying issue is **JavaScript-rendered sites where our Playwright → BeautifulSoup workflow breaks**. Sites change their DOM structure after initial render, and our static selectors no longer match.

**Recommended Pattern Going Forward:**
- Use Playwright's `page.locator()` API instead of `page.content()` → BeautifulSoup
- Wait for specific elements: `page.wait_for_selector(".event-time")`
- Extract structured data from `<script type="application/ld+json">` when available

Let me know if you need detailed crawl logs or database dumps for any of these sources.

— Data Quality Team

---

**Report Generated:** 2026-02-03  
**Next Review:** After fixes deployed (target: 2026-02-10)
