# Crawler Description Fixes — Replace Templates with Real Extraction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace template-assembled descriptions in 17 source crawlers with real descriptions extracted from source pages/APIs. Remove `build_*_description()` template functions.

**Architecture:** For each crawler, replace the template builder with one of: (a) use the description already available from the API, (b) add `enrich_from_detail()` or OG/JSON-LD extraction from detail pages, or (c) for sources with no real descriptions available, rewrite templates to avoid SYNTHETIC_MARKERS patterns. Each crawler is an independent task.

**Tech Stack:** Python 3, BeautifulSoup, `pipeline.detail_enrich.enrich_from_detail()`, `extractors.structured.extract_jsonld_event_fields()`, `extractors.structured.extract_open_graph_fields()`

**Context:**
- The SYNTHETIC_MARKERS patterns in `crawlers/description_quality.py` match descriptions produced by these crawlers
- The markers are currently NOT in the insertion quality gate (reverted to avoid blocking crawls)
- Goal: produce descriptions that are real content, not template assembly, so we can eventually re-enable the gate
- Existing extraction infrastructure: `enrich_from_detail(html, url, source_name, DetailConfig) -> dict` in `pipeline/detail_enrich.py`
- Structured extractors: `extract_jsonld_event_fields(html)`, `extract_open_graph_fields(html)` in `extractors/structured.py`
- Page fetching: `fetch_html(url, FetchConfig) -> (html, error)` in `pipeline/fetch.py`
- HTML text extraction: `extract_visible_text(html, max_chars)` in `enrich_festivals.py`

**General pattern for each fix:**

```python
# BEFORE (template builder):
def build_foo_description(event, venue):
    return f"{title} is a live event at {venue}. Scheduled on {date}. Check {url} for details."

# AFTER (real extraction):
# Option A: API already provides description — just use it
description = api_response.get("description", "").strip() or None

# Option B: Fetch detail page and extract
from pipeline.detail_enrich import enrich_from_detail
from pipeline.models import DetailConfig
detail_cfg = DetailConfig(use_jsonld=True, use_open_graph=True, use_heuristic=True, use_llm=False)
enriched = enrich_from_detail(html, source_url, source_name, detail_cfg)
description = enriched.get("description") or None

# Option C: Source has no real description — use a short, natural sentence (no structured data)
description = f"Live comedy at Laughing Skull Lounge in Midtown."  # Static, human-readable, no dates/prices
```

**Key rules:**
- Never include dates, times, prices, or URLs in descriptions — those are displayed separately in the UI
- Never use patterns matching SYNTHETIC_MARKERS (no "Scheduled on", "Location:", "Check X for", "Format:", etc.)
- If no real description is available, use `None` — NULL is better than template boilerplate
- Keep existing crawler behavior (events found, series linking, etc.) — only change description handling

---

## Tier 1: API/Source Already Has Descriptions (use them)

### Task 1: ticketmaster.py — remove template fallback

**Files:** `crawlers/sources/ticketmaster.py`

This crawler already fetches descriptions from the API and detail pages. It has a template fallback `_build_description()` that fires when extraction fails. Remove the fallback.

- [ ] **Step 1: Find and read `_build_description()` in ticketmaster.py**

Read the function to understand what it does and where it's called.

- [ ] **Step 2: Remove `_build_description()` function and its invocations**

Wherever the fallback is called, replace with `None`. The event should use whatever description the API or detail page provided, or NULL if neither had one.

- [ ] **Step 3: Verify crawler runs**

Run: `cd /Users/coach/Projects/LostCity/crawlers && python3 main.py --source ticketmaster --dry-run 2>&1 | tail -20`

Expected: Runs without import errors. Events may have NULL descriptions where the template used to fill them — that's correct.

- [ ] **Step 4: Commit**

```bash
git add crawlers/sources/ticketmaster.py
git commit -m "fix(ticketmaster): remove template description fallback

Uses API and detail page descriptions only. NULL when no real
description is available — better than template-assembled boilerplate."
```

---

### Task 2: terminal_west.py — remove template fallback

**Files:** `crawlers/sources/terminal_west.py`

Already uses `enrich_from_detail()` for detail page extraction. Has `build_terminal_west_description()` as fallback. Remove it.

- [ ] **Step 1: Find and read `build_terminal_west_description()` and where it's called**
- [ ] **Step 2: Remove the function and replace invocations with `None`**
- [ ] **Step 3: Verify:** `python3 main.py --source terminal-west --dry-run 2>&1 | tail -20`
- [ ] **Step 4: Commit**

```bash
git add crawlers/sources/terminal_west.py
git commit -m "fix(terminal-west): remove template description fallback

Uses enrich_from_detail() for real extraction. NULL when extraction
fails — no more 'live music performance at Terminal West' boilerplate."
```

---

### Task 3: emory_healthcare_community.py — use API description directly

**Files:** `crawlers/sources/emory_healthcare_community.py`

Blackthorn.io API returns event descriptions. The crawler has `_build_emory_description()` that templates from API fields. Replace with direct use of API description field.

- [ ] **Step 1: Read the crawler to find where API data is processed and where `_build_emory_description()` is called**
- [ ] **Step 2: Replace `_build_emory_description()` calls with the API's description field**

Look for the API response field that contains the event description (likely `description` or `body` or `summary` in the Blackthorn response). Use that directly. If the API doesn't provide a real description, use `None`.

- [ ] **Step 3: Delete `_build_emory_description()` function**
- [ ] **Step 4: Verify:** `python3 main.py --source emory-healthcare-community --dry-run 2>&1 | tail -20`
- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/emory_healthcare_community.py
git commit -m "fix(emory): use API description instead of template builder

Removes _build_emory_description() template. Uses description from
Blackthorn.io API response directly."
```

---

### Task 4: meetup.py — use API description directly

**Files:** `crawlers/sources/meetup.py`

Meetup API returns event descriptions. The crawler has `_build_meetup_description()` that templates from multiple fields. Replace with the API's `description` field.

- [ ] **Step 1: Read how the Meetup API response is processed**
- [ ] **Step 2: Replace `_build_meetup_description()` with direct API description**

The Meetup API likely returns an HTML description. Strip HTML tags to get plain text. If the API description is empty, use `None`.

- [ ] **Step 3: Delete `_build_meetup_description()` function**
- [ ] **Step 4: Verify:** `python3 main.py --source meetup --dry-run 2>&1 | tail -20`
- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/meetup.py
git commit -m "fix(meetup): use API description instead of template builder

Removes _build_meetup_description() template. Uses description from
Meetup API response directly."
```

---

### Task 5: fulton_library.py — use API description directly

**Files:** `crawlers/sources/fulton_library.py`

BiblioCommons API returns event descriptions. The crawler has `build_library_description()` that templates from API fields.

- [ ] **Step 1: Read how the BiblioCommons API response is processed**
- [ ] **Step 2: Replace `build_library_description()` with the API's description field**
- [ ] **Step 3: Delete `build_library_description()` function**
- [ ] **Step 4: Verify:** `python3 main.py --source fulton-library --dry-run 2>&1 | tail -20`
- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/fulton_library.py
git commit -m "fix(fulton-library): use API description instead of template builder

Removes build_library_description() template. Uses description from
BiblioCommons API response directly."
```

---

### Task 6: painting_with_a_twist.py — use detail page description

**Files:** `crawlers/sources/painting_with_a_twist.py`

Already has `fetch_description_from_url()` for real extraction. Has `build_painting_description()` as fallback. Remove the fallback.

- [ ] **Step 1: Read `build_painting_description()` and where it's called**
- [ ] **Step 2: Remove the template function and its invocations. Keep `fetch_description_from_url()`.**
- [ ] **Step 3: Verify:** `python3 main.py --source painting-with-a-twist --dry-run 2>&1 | tail -20`
- [ ] **Step 4: Commit**

```bash
git add crawlers/sources/painting_with_a_twist.py
git commit -m "fix(painting-with-a-twist): remove template description fallback

Uses detail page extraction only. NULL when no real description
available — no more 'paint-and-sip class at' boilerplate."
```

---

## Tier 2: Add Detail Page Extraction

### Task 7: laughing_skull.py — extract from detail pages

**Files:** `crawlers/sources/laughing_skull.py`

Has `build_comedy_description()` template. The venue website has event detail pages with real descriptions.

- [ ] **Step 1: Read the crawler to understand how events are scraped**
- [ ] **Step 2: Add OG/JSON-LD extraction from event detail pages**

If the crawler already fetches detail page HTML, add extraction:

```python
from extractors.structured import extract_jsonld_event_fields, extract_open_graph_fields

# After fetching event detail page HTML:
jsonld = extract_jsonld_event_fields(detail_html)
description = jsonld.get("description")
if not description:
    og = extract_open_graph_fields(detail_html)
    description = og.get("description")
```

If it doesn't fetch detail pages, add a fetch step for the event's source_url.

- [ ] **Step 3: Remove `build_comedy_description()` function**
- [ ] **Step 4: Verify:** `python3 main.py --source laughing-skull --dry-run 2>&1 | tail -20`
- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/laughing_skull.py
git commit -m "fix(laughing-skull): extract descriptions from detail pages

Replaces build_comedy_description() template with JSON-LD/OG
extraction from event detail pages."
```

---

### Task 8: aisle5.py — extract from detail pages

**Files:** `crawlers/sources/aisle5.py`

Same pattern as laughing_skull. Has `build_aisle5_description()` template.

- [ ] **Step 1: Read how events are scraped**
- [ ] **Step 2: Add JSON-LD/OG extraction from event detail pages**
- [ ] **Step 3: Remove `build_aisle5_description()`**
- [ ] **Step 4: Verify:** `python3 main.py --source aisle5 --dry-run 2>&1 | tail -20`
- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/aisle5.py
git commit -m "fix(aisle5): extract descriptions from detail pages

Replaces build_aisle5_description() template with JSON-LD/OG extraction."
```

---

### Task 9: cooks_warehouse.py — extract from class detail pages

**Files:** `crawlers/sources/cooks_warehouse.py`

Has `build_class_description()` template. Class pages likely have descriptions.

- [ ] **Step 1: Read how classes are scraped, find event detail URLs**
- [ ] **Step 2: Add extraction from class detail pages**
- [ ] **Step 3: Remove `build_class_description()`**
- [ ] **Step 4: Verify:** `python3 main.py --source cooks-warehouse --dry-run 2>&1 | tail -20`
- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/cooks_warehouse.py
git commit -m "fix(cooks-warehouse): extract descriptions from class detail pages

Replaces build_class_description() template with real page extraction."
```

---

### Task 10: gsu_athletics.py — extract from event pages

**Files:** `crawlers/sources/gsu_athletics.py`

Has `_build_event_description()` template. GSU athletics pages have JSON-LD SportsEvent data.

- [ ] **Step 1: Read how events are fetched (likely API or JSON-LD on pages)**
- [ ] **Step 2: Use JSON-LD description from the event data if available. Otherwise `None`.**
- [ ] **Step 3: Remove `_build_event_description()`**
- [ ] **Step 4: Verify:** `python3 main.py --source gsu-athletics --dry-run 2>&1 | tail -20`
- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/gsu_athletics.py
git commit -m "fix(gsu-athletics): use JSON-LD description instead of template

Replaces _build_event_description() template with real description
from SportsEvent JSON-LD data."
```

---

### Task 11: ksu_athletics.py — extract from event pages

**Files:** `crawlers/sources/ksu_athletics.py`

Same as GSU. Has `build_ksu_description()`.

- [ ] **Step 1: Read how events are fetched**
- [ ] **Step 2: Use real description from source data. Otherwise `None`.**
- [ ] **Step 3: Remove `build_ksu_description()`**
- [ ] **Step 4: Verify:** `python3 main.py --source ksu-athletics --dry-run 2>&1 | tail -20`
- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/ksu_athletics.py
git commit -m "fix(ksu-athletics): use real description instead of template

Replaces build_ksu_description() template with description from source data."
```

---

### Task 12: amc_atlanta.py — use movie descriptions

**Files:** `crawlers/sources/amc_atlanta.py`

Has `_build_showtime_description()` template. AMC movie data may include synopsis. If not, movies can get descriptions from OMDB/TMDB (existing `posters.py` already fetches from TMDB).

- [ ] **Step 1: Read how showtime data is fetched**
- [ ] **Step 2: Check if the AMC API/page provides movie synopsis. If yes, use it.**
- [ ] **Step 3: If no synopsis available, set description to `None` (movie poster/title is enough context)**
- [ ] **Step 4: Remove `_build_showtime_description()`**
- [ ] **Step 5: Verify:** `python3 main.py --source amc-atlanta --dry-run 2>&1 | tail -20`
- [ ] **Step 6: Commit**

```bash
git add crawlers/sources/amc_atlanta.py
git commit -m "fix(amc-atlanta): remove showtime template description

Movie events use synopsis from source data when available, NULL otherwise.
Removes 'Movie showtime for X at Y' boilerplate."
```

---

### Task 13: truist_park.py — extract from event pages

**Files:** `crawlers/sources/truist_park.py`

Has `build_truist_description()` template (note: this was the ONE crawler the audit said didn't match SYNTHETIC_MARKERS — but it still uses template assembly).

- [ ] **Step 1: Read how events are fetched**
- [ ] **Step 2: Use real description from source if available, otherwise `None`**
- [ ] **Step 3: Remove `build_truist_description()`**
- [ ] **Step 4: Verify:** `python3 main.py --source truist-park --dry-run 2>&1 | tail -20`
- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/truist_park.py
git commit -m "fix(truist-park): use real description instead of template

Replaces build_truist_description() with source-provided description."
```

---

## Tier 3: Limited Source Data (rewrite templates or use NULL)

These sources have no real descriptions available via API or detail pages. The fix is either: rewrite the template to be a short natural sentence that doesn't match SYNTHETIC_MARKERS, or use NULL.

### Task 14: lore_atlanta.py — replace template with static natural descriptions

**Files:** `crawlers/sources/lore_atlanta.py`

Weekly recurring events with hardcoded descriptions. No detail pages.

- [ ] **Step 1: Read the WEEKLY_EVENTS list and `build_lore_description()`**
- [ ] **Step 2: Replace with short, natural static descriptions per event type**

Each weekly event in the hardcoded list should have a brief, human-written description that doesn't use template assembly or SYNTHETIC_MARKERS patterns. Example:

```python
# BEFORE:
"LGBTQ+ nightlife program at Lore Atlanta. Venue programming includes drag, karaoke..."

# AFTER (in the WEEKLY_EVENTS dict):
"description": "Weekly drag show featuring Atlanta's fiercest queens."
```

Write a natural 1-sentence description for each recurring event. These are static and that's fine — they're human-written, not template-assembled.

- [ ] **Step 3: Remove `build_lore_description()`**
- [ ] **Step 4: Verify:** `python3 main.py --source lore-atlanta --dry-run 2>&1 | tail -20`
- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/lore_atlanta.py
git commit -m "fix(lore-atlanta): replace template with natural static descriptions

Each weekly event gets a human-written description instead of
template-assembled boilerplate."
```

---

### Task 15: aa_atlanta.py — use NULL descriptions

**Files:** `crawlers/sources/aa_atlanta.py`

AA Meeting Guide API provides meeting format/type but no descriptions. Template builder assembles "Alcoholics Anonymous peer-support meeting..." boilerplate.

- [ ] **Step 1: Read `format_meeting_description()` and where it's called**
- [ ] **Step 2: Remove the template. Set description to `None`.**

For AA/NA meetings, the title + format + location provide all needed context. A template description adds no value.

- [ ] **Step 3: Remove `format_meeting_description()`**
- [ ] **Step 4: Verify:** `python3 main.py --source aa-atlanta --dry-run 2>&1 | tail -20`
- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/aa_atlanta.py
git commit -m "fix(aa-atlanta): remove template description, use NULL

Meeting title + format + location provide sufficient context.
Removes 'peer-support meeting' boilerplate."
```

---

### Task 16: na_georgia.py — use NULL descriptions

**Files:** `crawlers/sources/na_georgia.py`

Same as AA. BMLT API has no description field.

- [ ] **Step 1: Read `format_meeting_description()` and where it's called**
- [ ] **Step 2: Remove the template. Set description to `None`.**
- [ ] **Step 3: Remove `format_meeting_description()`**
- [ ] **Step 4: Verify:** `python3 main.py --source na-georgia --dry-run 2>&1 | tail -20`
- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/na_georgia.py
git commit -m "fix(na-georgia): remove template description, use NULL

Meeting title + format + location provide sufficient context.
Removes 'peer-support meeting' boilerplate."
```

---

### Task 17: big_peach_running.py — use NULL or short natural description

**Files:** `crawlers/sources/big_peach_running.py`

Hardcoded weekly group run schedule. No source pages with descriptions.

- [ ] **Step 1: Read `build_description()` and the event data structure**
- [ ] **Step 2: Remove template. Use a short static description per store location if desired, or `None`.**

```python
# Short, natural, non-template:
description = "Weekly group run from Big Peach Running Co."
# Or just:
description = None
```

- [ ] **Step 3: Remove `build_description()`**
- [ ] **Step 4: Verify:** `python3 main.py --source big-peach-running --dry-run 2>&1 | tail -20`
- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/big_peach_running.py
git commit -m "fix(big-peach-running): remove template description

Weekly group runs use a short natural description or NULL."
```

---

### Task 18: atlanta_city_meetings.py — use NULL

**Files:** `crawlers/sources/atlanta_city_meetings.py`

IQM2 portal provides meeting metadata (board, type, date) but no descriptions.

- [ ] **Step 1: Read how descriptions are assembled**
- [ ] **Step 2: Remove template assembly. Set description to `None`.**

The meeting title (e.g., "City Council Regular Meeting") is self-describing.

- [ ] **Step 3: Verify:** `python3 main.py --source atlanta-city-meetings --dry-run 2>&1 | tail -20`
- [ ] **Step 4: Commit**

```bash
git add crawlers/sources/atlanta_city_meetings.py
git commit -m "fix(atlanta-city-meetings): remove template description, use NULL

Meeting title (e.g. 'City Council Regular Meeting') is self-describing."
```

---

### Task 19: atlanta_recurring_social.py — replace templates with natural descriptions

**Files:** `crawlers/sources/recurring_social_events.py` (or `atlanta_recurring_social.py`)

Recurring social events (trivia, karaoke, etc.) with template descriptions.

- [ ] **Step 1: Read the crawler and find the description template(s)**
- [ ] **Step 2: Replace with short natural descriptions per event type, or `None`**

For recurring social events, write a brief human-style description for each event type in the hardcoded data. Don't include dates, times, or "Recurring weekly" markers.

- [ ] **Step 3: Remove template builder function if it exists**
- [ ] **Step 4: Verify the crawler runs:** `python3 main.py --source atlanta-recurring-social --dry-run 2>&1 | tail -20`
- [ ] **Step 5: Commit**

```bash
git add crawlers/sources/recurring_social_events.py
git commit -m "fix(recurring-social): replace template descriptions with natural text

Recurring events get short human-written descriptions without
template assembly patterns."
```

---

### Task 20: team_trivia.py — add natural descriptions

**Files:** `crawlers/sources/team_trivia.py`

No descriptions currently. Hardcoded venue list.

- [ ] **Step 1: Read the crawler data structure**
- [ ] **Step 2: Add a short natural description**

```python
description = "Free team trivia hosted by OutSpoken Entertainment. Prizes for top teams."
```

This is static, human-written, and applies to all Team Trivia events.

- [ ] **Step 3: Verify:** `python3 main.py --source team-trivia --dry-run 2>&1 | tail -20`
- [ ] **Step 4: Commit**

```bash
git add crawlers/sources/team_trivia.py
git commit -m "fix(team-trivia): add natural description to events

Adds a short human-written description for trivia nights."
```

---

## Final Verification

### Task 21: Verify no crawler descriptions match SYNTHETIC_MARKERS

- [ ] **Step 1: Run a sample of crawlers and check descriptions**

```bash
cd /Users/coach/Projects/LostCity/crawlers

# Run several crawlers in dry-run, capture descriptions
for source in ticketmaster terminal-west laughing-skull meetup emory-healthcare-community; do
    echo "=== $source ==="
    python3 main.py --source $source --dry-run 2>&1 | head -20
done
```

- [ ] **Step 2: Spot-check for synthetic patterns**

```python
python3 -c "
from description_quality import is_synthetic_description
# Test a few real descriptions from the crawlers
tests = [
    'Weekly drag show featuring Atlanta fiercest queens.',
    'Free team trivia hosted by OutSpoken Entertainment.',
    None,
]
for t in tests:
    print(f'{t!r}: synthetic={is_synthetic_description(t)}')
"
```

Expected: All return `False`.

- [ ] **Step 3: Commit any fixes**
