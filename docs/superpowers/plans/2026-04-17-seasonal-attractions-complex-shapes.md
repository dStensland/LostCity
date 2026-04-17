# Seasonal Attractions — Complex Shapes Plan (Plan 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert three complex-shape crawlers — Stone Mountain Park (Shape B + E, persistent venue + multi-seasonal overlays), Southern Belle Farm (Shape E, 4 non-overlapping seasons at one place), and North Georgia State Fair (Shape D, fairgrounds with dense dated programming) — from pseudo-event season windows to the exhibitions-as-season-carrier model.

**Architecture:** Each crawler applies the seasonal-exhibition pattern established in Plans 1 and 2, with shape-specific nuances:
- Stone Mountain: per-slug triage (exhibition vs. event), `is_seasonal_only: False` (park is year-round)
- Southern Belle: N seasonal exhibitions at one place, dated sub-events link via `events.exhibition_id`
- State Fair: 1 seasonal exhibition + threaded `exhibition_id` on all daily programming events

**Tech Stack:** Python crawlers (Playwright/BeautifulSoup/Supabase-JS), existing `crawlers/db/exhibitions.py` helpers, `events.exhibition_id` FK (already live).

**Spec:** `docs/superpowers/specs/2026-04-17-seasonal-attractions-design.md`
**Parent plans:** Plan 1 foundation (PR #31), Plan 2 Shape A crawlers (PR #32)
**Reference implementations:** `crawlers/sources/georgia_ren_fest.py` (Shape C), `crawlers/sources/netherworld.py` (Shape A)

**Dependencies:** This plan needs Plan 1's schema (`series.exhibition_id`, `exhibitions.operating_schedule`, `places.is_seasonal_only`) and `_EXHIBITION_COLUMNS` update. It does NOT depend on Plan 2's crawlers. Branch from `feat/seasonal-attractions-foundation` (Plan 1 branch). If both Plan 1 and Plan 2 have merged to main, branch from main instead.

---

## File Structure

### Modify
- `crawlers/sources/stone_mountain_park.py` (889 lines) — 10-slug triage + exhibition emission for 5 long-window seasonals
- `crawlers/sources/southern_belle_farm.py` (1099 lines) — 4 season exhibitions; sub-events link via `exhibition_id`
- `crawlers/sources/north_georgia_state_fair.py` (344 lines) — 1 exhibition + dense events with `exhibition_id`
- `crawlers/CLAUDE.md` — reference implementations list expanded

### Do NOT touch
- Plans 1/2 crawlers — already converted
- Recurring Stone Mountain Christmas rituals (parade/fireworks/light show as series via `series.exhibition_id`) — **deferred to Plan 4** (they're additive programming, not covered by current crawler)

---

## Phase 1: Southern Belle Farm (Shape E — simplest complex shape)

Starting with Southern Belle because it has the cleanest existing structure: `SEASON_DEFAULTS` dict with 4 seasons already keyed by name. Each season converts to one exhibition call.

### Task 1: Convert `southern_belle_farm.py` to Shape E

**Files:**
- Modify: `crawlers/sources/southern_belle_farm.py`

**Current behavior**: Emits 4 long-span events (Spring Strawberry, Summer, Fall, Christmas) — each is a multi-month pseudo-event. Plus dated sub-events (Donut Breakfast with Santa, Sunflower Weekend, Columbus Day).

**Target behavior**: 4 `exhibitions` rows (one per season) + dated sub-events linked via `events.exhibition_id` to the relevant parent season.

- [ ] **Step 1: Read the crawler**

```bash
cat crawlers/sources/southern_belle_farm.py
```

Focus on:
- `SEASON_DEFAULTS` dict (around line 85) — 4 seasons with titles, descriptions, source_urls, date ranges
- `SEASON_URLS` dict (around line 58) — site URLs per season
- The main `crawl()` loop — identify where per-season events are emitted
- Sub-event emission (Donut Breakfast with Santa, etc.) — how/where these are created

- [ ] **Step 2: Update `PLACE_DATA`**

Find `PLACE_DATA` around line 66. Add `"is_seasonal_only": True` — the farm only exists as a destination during its seasonal windows.

- [ ] **Step 3: Add `insert_exhibition` import**

```python
from db.exhibitions import insert_exhibition
```

- [ ] **Step 4: Add `create_season_exhibition()` helper**

One function, called 4 times (once per season). Parameters: `(source_id, venue_id, season_key: str, season_data: dict) -> Optional[str]`.

```python
def create_season_exhibition(
    source_id: int,
    venue_id: int,
    season_key: str,
    season_data: dict,
) -> Optional[str]:
    """
    Upsert one seasonal exhibition for Southern Belle. Returns exhibition UUID
    or None on failure.

    `season_key` is one of "spring", "summer", "fall", "christmas".
    `season_data` is an entry from SEASON_DEFAULTS (has title, description,
    date range, operating_schedule, tags).
    """
    year = season_data["start_date"][:4]
    slug = f"southern-belle-farm-{season_key}-{year}"
    exhibition_data = {
        "slug": slug,
        "place_id": venue_id,
        "source_id": source_id,
        "title": season_data["title"],
        "description": season_data["description"],
        "opening_date": season_data["start_date"],
        "closing_date": season_data["end_date"],
        "exhibition_type": "seasonal",
        "admission_type": "ticketed",  # or "free" for flower/u-pick — verify per season
        "admission_url": season_data.get("ticket_url"),
        "source_url": season_data["source_url"],
        "operating_schedule": season_data["operating_schedule"],
        "tags": season_data.get("tags", ["seasonal", "farm"]),
    }
    return insert_exhibition(exhibition_data)
```

The existing `SEASON_DEFAULTS` dict doesn't yet have `operating_schedule` keys — you'll need to add them. Operating hours for a u-pick farm / pumpkin patch / Christmas market are usually Tue-Sun 9am-5pm or similar; extract from the site for each season if different.

- [ ] **Step 5: Extend `SEASON_DEFAULTS` with `operating_schedule`**

For each season entry in `SEASON_DEFAULTS`, add an `operating_schedule` key with the hours pattern for that season. Example Fall:

```python
"operating_schedule": {
    "default_hours": {"open": "10:00", "close": "18:00"},
    "days": {
        "monday": None,
        "tuesday": {"open": "10:00", "close": "18:00"},
        "wednesday": {"open": "10:00", "close": "18:00"},
        "thursday": {"open": "10:00", "close": "18:00"},
        "friday": {"open": "10:00", "close": "18:00"},
        "saturday": {"open": "9:00", "close": "19:00"},
        "sunday": {"open": "11:00", "close": "18:00"},
    },
    "overrides": {},
},
```

**Ground in actual site data** per season. Christmas may be weekend-only late Nov — early Dec; Spring is usually open every day except Monday, etc. Don't hallucinate — if uncertain for a given season, extract from existing events' `start_time`/`end_time` fields (already parsed by the crawler) or copy from source HTML.

- [ ] **Step 6: Rewrite main loop**

The existing `crawl()` iterates `SEASON_DEFAULTS` to emit 4 big pseudo-events. Rewrite to iterate `SEASON_DEFAULTS` and emit 4 exhibitions. Store returned exhibition IDs in a dict keyed by season:

```python
exhibition_ids: dict[str, Optional[str]] = {}
for season_key, season_data in SEASON_DEFAULTS.items():
    ex_id = create_season_exhibition(source_id, venue_id, season_key, season_data)
    exhibition_ids[season_key] = ex_id
```

- [ ] **Step 7: Link sub-events via `events.exhibition_id`**

The crawler currently emits sub-events (Donut Breakfast with Santa → Christmas season, Sunflower Weekend → Fall season, Columbus Day → Fall season). For each sub-event `event_record`, set `"exhibition_id": exhibition_ids[<matching_season>]`.

The mapping from sub-event to season needs to be explicit. Look at the existing sub-event emission logic and add the `exhibition_id` linkage. If a sub-event's date range overlaps with a specific season, link it to that season's exhibition.

- [ ] **Step 8: Delete the per-season pseudo-events**

After the exhibition-based emission is in, remove the old code that emitted the 4 big season-window events. Those are now represented by the exhibitions.

- [ ] **Step 9: Dry-run**

```bash
cd crawlers && python3 main.py --source southern-belle-farm --dry-run --force 2>&1 | tail -30
```

Expected: 4 exhibition upsert lines, then a handful of sub-event upserts (each with `exhibition_id` populated), no season-window pseudo-event lines. Crawler completes cleanly.

- [ ] **Step 10: Regression test**

```bash
python3 -m pytest tests/ -k "southern_belle or southern-belle" -v 2>&1 | tail -5
```

- [ ] **Step 11: Commit**

```bash
git add crawlers/sources/southern_belle_farm.py
git commit -m "feat(crawlers): Southern Belle Shape E — 4 seasonal exhibitions + exhibition_id-linked sub-events"
```

---

## Phase 2: North Georgia State Fair (Shape D — high-density dated programming)

### Task 2: Convert `north_georgia_state_fair.py` to Shape D

**Files:**
- Modify: `crawlers/sources/north_georgia_state_fair.py`

**Current behavior**: Emits a season-window pseudo-event with `is_all_day=True` spanning the 11-day fair, plus (possibly) individual dated events for headline programming. The pseudo-event is exactly the anti-pattern the spec deprecates.

**Target behavior**: 1 seasonal exhibition covering the 11-day window + N dated child events (concerts, rodeo nights, motor drome, midway) linked via `events.exhibition_id`.

- [ ] **Step 1: Read the crawler**

```bash
cat crawlers/sources/north_georgia_state_fair.py
```

Focus on:
- `PLACE_DATA` (around line 25) — verify the fairgrounds place info
- `crawl()` (around line 95) — identify the pseudo-event emission AND any dated sub-event emission
- Whether `is_all_day=True` is currently used for the season-window event

- [ ] **Step 2: Update `PLACE_DATA`**

Add `"is_seasonal_only": True` — the fairgrounds as an event destination only exists during the 11-day fair window. (If the fairgrounds host other events year-round — agricultural shows, gun shows — verify this and set `False` with a comment explaining. Reading the current crawler should clarify.)

- [ ] **Step 3: Add `insert_exhibition` import**

```python
from db.exhibitions import insert_exhibition
```

- [ ] **Step 4: Add `create_fair_exhibition()` helper**

```python
def create_fair_exhibition(
    source_id: int,
    venue_id: int,
    fair_start: str,       # e.g. "2026-09-18"
    fair_end: str,         # e.g. "2026-09-28"
    year: str,
) -> Optional[str]:
    slug = f"north-georgia-state-fair-{year}"
    exhibition_data = {
        "slug": slug,
        "place_id": venue_id,
        "source_id": source_id,
        "title": f"North Georgia State Fair {year}",
        "description": (
            # Use existing crawler's fair description — usually includes
            # midway, livestock, concerts, demolition derby, fried food
        ),
        "opening_date": fair_start,
        "closing_date": fair_end,
        "exhibition_type": "seasonal",
        "admission_type": "ticketed",
        "admission_url": TICKETS_URL,  # if defined in the crawler
        "source_url": SCHEDULE_URL,
        "operating_schedule": {
            # State fair hours vary by day. Typical pattern:
            # Weeknights: gates 4pm, close 11pm
            # Weekends: gates 10am, close midnight
            "default_hours": {"open": "16:00", "close": "23:00"},
            "days": {
                "monday": {"open": "16:00", "close": "22:00"},
                "tuesday": {"open": "16:00", "close": "22:00"},
                "wednesday": {"open": "16:00", "close": "22:00"},
                "thursday": {"open": "16:00", "close": "22:00"},
                "friday": {"open": "16:00", "close": "00:00"},
                "saturday": {"open": "10:00", "close": "00:00"},
                "sunday": {"open": "10:00", "close": "23:00"},
            },
            "overrides": {},  # date-specific closures, extended hours
        },
        "tags": ["seasonal", "fairgrounds", "family-friendly", "ticketed"],
    }
    return insert_exhibition(exhibition_data)
```

**Ground operating hours in what the source publishes.** Marietta NG State Fair page has the calendar — use those exact hours. The defaults above are illustrative only.

- [ ] **Step 5: Rewrite `crawl()` to create the exhibition first, then events**

```python
def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    try:
        # 1. Parse schedule from site: fair_start, fair_end, events_list
        fair_start, fair_end, events_list = _parse_fair_schedule(...)
    except Exception as e:
        logger.error(f"NG State Fair: parse failed: {e}")
        return 0, 0, 0

    # 2. Upsert place
    venue_id = get_or_create_place(PLACE_DATA)

    # 3. Create seasonal exhibition (carries the 11-day window)
    year = fair_start[:4]
    exhibition_id = create_fair_exhibition(source_id, venue_id, fair_start, fair_end, year)

    # 4. Emit dated child events (Motor Drome, Circus, nightly concerts),
    #    each linked to the exhibition via exhibition_id.
    events_found = 0
    events_new = 0
    events_updated = 0
    for event_data in events_list:
        event_record = {
            "source_id": source_id,
            "place_id": venue_id,
            "exhibition_id": exhibition_id,  # CRITICAL linkage
            # ... existing fields from the crawler's current event construction ...
        }
        # Existing insert_event / smart_update_existing_event logic
        # but with exhibition_id attached
        ...

    return events_found, events_new, events_updated
```

- [ ] **Step 6: Remove the season-window pseudo-event**

Find and delete the code that currently emits one event spanning the full 11-day fair window with `is_all_day=True`. The exhibition now represents that window.

- [ ] **Step 7: Verify `is_all_day` usage is gone for the season event**

Individual dated sub-events (nightly concerts, daytime livestock shows) should have proper `start_time`/`end_time` — NOT `is_all_day=True`. The spec and `crawlers/CLAUDE.md` both call this out: `is_all_day` should only be True when the event is genuinely all-day (rare for fair programming).

- [ ] **Step 8: Dry-run**

```bash
cd crawlers && python3 main.py --source north-georgia-state-fair --dry-run --force 2>&1 | tail -30
```

Expected: 1 exhibition upsert + N child event upserts (each with `exhibition_id` in the record), NO pseudo-event with 11-day span.

- [ ] **Step 9: Regression test**

```bash
python3 -m pytest tests/ -k "state_fair or north_georgia" -v 2>&1 | tail -5
```

- [ ] **Step 10: Commit**

```bash
git add crawlers/sources/north_georgia_state_fair.py
git commit -m "feat(crawlers): NG State Fair Shape D — 1 seasonal exhibition + exhibition_id-linked daily events"
```

---

## Phase 3: Stone Mountain Park (Shape B + E + per-slug triage)

### Task 3: Convert `stone_mountain_park.py` with per-slug triage

**Files:**
- Modify: `crawlers/sources/stone_mountain_park.py`

**Current behavior**: Emits ~10 seasonal events from a `_FESTIVAL_META` dict. Each event is keyed by a slug like `stone-mountain-christmas`, `stone-mountain-yellow-daisy`, etc. Some are legitimate multi-week exhibitions (Christmas runs 2 months); others are short-weekend events that shouldn't be exhibitions.

**Target behavior**: 5 long-window slugs become seasonal exhibitions; 5 short-window slugs stay as events. Stone Mountain Park's `is_seasonal_only` stays `False` — it's a year-round venue with seasonal overlays (Shape F, the persistent-place-with-overlay case).

### Per-slug decision matrix (from spec)

| Slug | Current | Target | Reason |
|---|---|---|---|
| `stone-mountain-christmas` | Event | **Seasonal exhibition** | Shape B — ~2-month run with recurring rituals (parade/fireworks/light show deferred to Plan 4) |
| `stone-mountain-yellow-daisy` | Event | **Seasonal exhibition** | Shape E — multi-day seasonal festival, no dated sub-programming in crawler |
| `stone-mountain-pumpkin` | Event | **Seasonal exhibition** | Shape E — Oct-weekend overlay |
| `stone-mountain-dino-fest` | Event | **Seasonal exhibition** | Shape E — multi-day |
| `stone-mountain-summer-at-the-rock` | Event | **Seasonal exhibition** | Shape E — summer overlay |
| `stone-mountain-easter-sunrise` | Event | **Stay as event** | Single-day religious observance |
| `stone-mountain-memorial-day-weekend` | Event | **Stay as event** | 3-day holiday weekend |
| `stone-mountain-fantastic-fourth` | Event | **Stay as event** | Single-day fireworks |
| `stone-mountain-labor-day-weekend` | Event | **Stay as event** | 3-day holiday weekend |
| `stone-mountain-kids-early-nye` | Event | **Stay as event** | Single-day kids NYE |

If `_FESTIVAL_META` has slugs not in this table, default to **stay as event** and flag in commit message — conservative default.

- [ ] **Step 1: Read the crawler**

```bash
cat crawlers/sources/stone_mountain_park.py
```

Understand:
- `_FESTIVAL_META` structure (around line 100-200 typically) — titles, descriptions, date ranges per slug
- `PLACE_DATA` (around line ~50) — should be `place_type: "park"` (persistent venue)
- `crawl()` loop that emits events from `_FESTIVAL_META`

- [ ] **Step 2: Update `PLACE_DATA`**

Add `"is_seasonal_only": False` explicitly (not just default) — this documents the intent. The park is year-round; the exhibitions are overlays.

Keep `place_type: "park"` (or whatever the current correct type is — do not change).

- [ ] **Step 3: Add `insert_exhibition` import**

```python
from db.exhibitions import insert_exhibition
```

- [ ] **Step 4: Classify each slug**

Add a module-level constant that captures the triage decision. This makes the classification explicit in code:

```python
# Per-slug classification (see plan: 2026-04-17-seasonal-attractions-complex-shapes.md)
# True = seasonal exhibition (multi-week run); False = stay as event (short window).
_SLUG_IS_SEASONAL_EXHIBITION: dict[str, bool] = {
    "stone-mountain-christmas": True,
    "stone-mountain-yellow-daisy": True,
    "stone-mountain-pumpkin": True,
    "stone-mountain-dino-fest": True,
    "stone-mountain-summer-at-the-rock": True,
    "stone-mountain-easter-sunrise": False,
    "stone-mountain-memorial-day-weekend": False,
    "stone-mountain-fantastic-fourth": False,
    "stone-mountain-labor-day-weekend": False,
    "stone-mountain-kids-early-nye": False,
}
```

- [ ] **Step 5: Add `create_sm_exhibition()` helper**

```python
def create_sm_exhibition(
    source_id: int,
    venue_id: int,
    slug: str,
    festival_meta: dict,
) -> Optional[str]:
    """
    Upsert one seasonal exhibition for a Stone Mountain overlay.

    `slug` is the _FESTIVAL_META key (e.g. "stone-mountain-christmas").
    `festival_meta` is the value dict (title, description, date range).
    """
    start_date = festival_meta["start_date"]
    year = start_date[:4]
    exhibition_slug = f"{slug}-{year}"  # year-scoped
    exhibition_data = {
        "slug": exhibition_slug,
        "place_id": venue_id,
        "source_id": source_id,
        "title": festival_meta["title"],
        "description": festival_meta.get("description", ""),
        "opening_date": start_date,
        "closing_date": festival_meta["end_date"],
        "exhibition_type": "seasonal",
        "admission_type": festival_meta.get("admission_type", "ticketed"),
        "admission_url": festival_meta.get("ticket_url"),
        "source_url": festival_meta.get("source_url"),
        "operating_schedule": festival_meta.get("operating_schedule") or _default_park_hours(),
        "tags": festival_meta.get("tags", ["seasonal", "stone-mountain"]),
    }
    return insert_exhibition(exhibition_data)


def _default_park_hours() -> dict:
    """Fallback operating schedule for Stone Mountain overlays without per-slug hours."""
    return {
        "default_hours": {"open": "10:00", "close": "21:00"},
        "days": {
            "monday": {"open": "10:00", "close": "21:00"},
            "tuesday": {"open": "10:00", "close": "21:00"},
            "wednesday": {"open": "10:00", "close": "21:00"},
            "thursday": {"open": "10:00", "close": "21:00"},
            "friday": {"open": "10:00", "close": "22:00"},
            "saturday": {"open": "10:00", "close": "22:00"},
            "sunday": {"open": "10:00", "close": "21:00"},
        },
        "overrides": {},
    }
```

**Operating schedule**: Stone Mountain's main park hours are published. Use site-sourced hours if available in `_FESTIVAL_META` per slug, otherwise the default. Christmas in particular has different hours (evening-focused, 4pm-10pm) — use Christmas-specific hours if the crawler already captures them.

- [ ] **Step 6: Rewrite the emission loop**

Find the loop in `crawl()` that iterates `_FESTIVAL_META` and emits events. Replace with:

```python
for slug, meta in _FESTIVAL_META.items():
    if _SLUG_IS_SEASONAL_EXHIBITION.get(slug, False):
        ex_id = create_sm_exhibition(source_id, venue_id, slug, meta)
        if ex_id:
            events_new += 1  # counted as a successful "item"
            events_found += 1
    else:
        # Short-window slugs stay as events — existing insert_event logic
        event_record = {
            # ... existing event construction using meta ...
            # Do NOT add exhibition_id for stay-as-event slugs
        }
        # Existing insert_event / smart_update flow
```

- [ ] **Step 7: Dry-run**

```bash
cd crawlers && python3 main.py --source stone-mountain-park --dry-run --force 2>&1 | tail -30
```

Expected output: 5 exhibition upsert lines (for the True slugs) + 5 event upserts (for the False slugs). No errors.

- [ ] **Step 8: Regression test**

```bash
python3 -m pytest tests/ -k "stone_mountain or stone-mountain" -v 2>&1 | tail -5
```

- [ ] **Step 9: Commit**

```bash
git add crawlers/sources/stone_mountain_park.py
git commit -m "feat(crawlers): Stone Mountain per-slug triage — 5 seasonal exhibitions + 5 events retained"
```

---

## Phase 4: Documentation

### Task 4: Update `crawlers/CLAUDE.md` with new reference implementations

- [ ] **Step 1: Find the reference implementations list**

In `crawlers/CLAUDE.md`, search for "Reference implementations:". Plan 2 updated this to mention Shape A (4 haunted attractions) and Shape C (Ren Fest). This step expands it with Shape B+E (Stone Mountain), Shape D (state fair), and Shape E (Southern Belle).

- [ ] **Step 2: Replace the reference implementations block**

```markdown
Reference implementations:
- Shape A (continuous nightly): `crawlers/sources/netherworld.py`, `folklore_haunted.py`, `paranoia_haunted.py`, `nightmares_gate.py`
- Shape C (themed weekends): `crawlers/sources/georgia_ren_fest.py`
- Shape D (fairgrounds): `crawlers/sources/north_georgia_state_fair.py`
- Shape E (multi-season single place): `crawlers/sources/southern_belle_farm.py`
- Shape F (persistent place + seasonal overlays): `crawlers/sources/stone_mountain_park.py`
- Shape B (season + recurring rituals): **pending — Plan 4 will add Stone Mountain Christmas parade/fireworks/light-show series**

Reference spec: `docs/superpowers/specs/2026-04-17-seasonal-attractions-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add crawlers/CLAUDE.md
git commit -m "docs(crawlers): reference implementations for Shapes B, D, E, F"
```

---

## Launch Readiness Check

- [ ] Southern Belle emits 4 exhibitions + sub-events linked via `exhibition_id`
- [ ] NG State Fair emits 1 exhibition + N dated events with `exhibition_id`, no `is_all_day` pseudo-event
- [ ] Stone Mountain emits 5 exhibitions + 5 events per the triage matrix
- [ ] All 3 crawlers' dry-runs clean
- [ ] Docs reference Shapes B/D/E/F implementations
- [ ] Branch ready for PR

---

## Out of Scope

- **Stone Mountain Christmas recurring rituals** (parade, fireworks, light show) as `series.exhibition_id`-linked series — **Plan 4**. The current crawler doesn't emit these, so we defer until someone builds the data capture.
- **Georgia National Fair** (Perry) — separate crawler that doesn't exist yet. Follow-on.
- **Six Flags** (Fright Fest, Holiday in the Park) — Shape F like Stone Mountain. Deferred (lower impact).
- **Callaway Fantasy in Lights, Lake Lanier Magical Nights of Lights, Burt's Pumpkin Farm, Yule Forest, Buford Corn Maze** — no crawlers yet. Pattern documented; ship as time permits.
- **Place data corrections** on any of these three crawlers — if addresses/lat-lng drift is found, note as follow-on, do not fix in scope.

---

## Parallelizability

All 3 crawler conversions are **independent** once Plan 1's schema is merged — no cross-crawler dependencies. They could be dispatched in parallel by separate subagents, but per the subagent-driven-development skill: never dispatch multiple implementation subagents in parallel on the same branch. Execute sequentially.

Recommended order: Southern Belle → NG State Fair → Stone Mountain. Rationale: Southern Belle is most structurally similar to reference implementations; Stone Mountain is most complex (per-slug triage). Starting simple builds confidence in the pattern.
