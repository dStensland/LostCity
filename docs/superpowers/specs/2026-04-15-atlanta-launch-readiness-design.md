# Atlanta Launch Readiness — Design Spec

**Date:** 2026-04-15
**Target:** Marketing push for Atlanta portal
**Timeline:** Atlanta Film Festival starts April 24 (9 days)
**Strategy:** Tiered — quality floor across all verticals, showcase depth in Film, Music, Food & Drink, Arts

The story is "sign up, explore Atlanta's cultural scene." First impression must make someone say "these people know Atlanta." Light social hooks provide the viral loop — not deep social networking, just enough to intrigue.

---

## 0. Launch Gate: Data Quality Verification

Before any code ships, verify the data foundation. If the data is thin, nothing else matters.

**Run ATLFF crawler immediately (April 15):**
- Count events. Verify screenings have venue + time + image.
- Open the Atlanta feed as a logged-out user. Count events in first three sections. Verify images load and venue links resolve.
- Click one ATLFF event. Verify: image, venue, time, ticket link all present.
- Select film interest chip. Verify Now Showing populates with ATLFF content.

**Pass/fail criteria:**
- ATLFF: 100+ film entries with images, 200+ scheduled screenings with venue+time
- General feed: 50+ events visible in first three sections for April 24 week
- Image coverage: 80%+ of events in The Lineup have images
- Venue links: 95%+ resolve to a real place detail page

If any criterion fails, fix the data before shipping code changes.

---

## 0.1 Shared Implementation Rules

All agents follow these conventions to ensure the result feels like one product:

**Animation:** `transition-colors duration-300` for color changes. `duration-200` for opacity. `ease-out` for entrances, `ease-in` for exits.

**Touch targets:** All interactive elements `min-h-[44px]` on mobile. No exceptions.

**Text floor:** `text-sm` (14px) minimum for body text. `text-xs` (12px) for labels/badges only. `text-2xs` (10px) for monospace status indicators only.

**Icons:** Phosphor `duotone` weight exclusively. No inline SVGs for standard icons (clock, pin, calendar, star). Import from `@phosphor-icons/react`.

**Empty states:** Use the pattern: icon at 48px opacity 0.2, heading in `text-base font-semibold text-[var(--cream)]`, description in `text-sm text-[var(--muted)]`. No dismissive copy ("Boring", "Nothing here"). Aspirational tone.

**Loading states:** Skeleton with `bg-[var(--twilight)] animate-pulse rounded-lg`. Match the final layout dimensions to avoid reflow.

**Cards:** Use `bg-[var(--night)] rounded-xl border border-[var(--twilight)]` for new card surfaces. No `font-serif`. No `backdrop-blur` (cinematic minimalism: `glass_enabled: false`).

**Portal scope:** All changes apply to all portals unless explicitly noted. Do not hardcode Atlanta-specific behavior.

**Post-onboarding banner coordination:** The onboarding agent adds `?onboarded=true` to the redirect URL. The feed agent reads this param in the portal page component and renders a dismissible `--night` card banner. The banner auto-dismisses after 8 seconds or on X click. Sits below the header, above CityBriefing, `z-10`.

---

## 0.2 Workstream Boundaries & File Ownership

Agents work in parallel. Each workstream owns specific files — no agent touches another's files.

| Workstream | Agent | Owned Files |
|------------|-------|-------------|
| **A: Feed** | feed agent | `CityPulseShell.tsx`, `fetch-events.ts`, `interests.ts`, `CityBriefing.tsx`, `FestivalsSection.tsx`, `section-builders.ts`, `types.ts` (city-pulse), portal page `?onboarded` banner |
| **B: Detail Pages** | detail agent | `EventDetailView.tsx`, `PlaceDetailView.tsx`, `SeriesDetailView.tsx`, `DetailHeroImage.tsx`, `PlaceFeaturesSection.tsx`, `spot-detail.ts`, `place-features.ts`, `ShowtimesTheaterCard.tsx`, `RSVPButton.tsx` (idle state fix), `AccessibilitySection.tsx`, `DiningDetailsSection.tsx`, `SectionHeader.tsx`, `HeroGallery.tsx`, `PlanYourVisitSection.tsx` |
| **C: Onboarding** | onboarding agent | `web/app/onboarding/`, `web/app/auth/signup/page.tsx`, `AuthHeroPhoto.tsx`, `AuthLayout.tsx` |
| **D: Calendar** | calendar agent | `web/components/calendar/*`, `web/lib/calendar/*`, `web/app/calendar/`, `web/app/[portal]/calendar/` |
| **E: Social** | social agent | `PostRsvpSharePrompt.tsx`, `EventCardActions.tsx`, `DashboardPlanning.tsx`, `SavedPageClient.tsx`, `PlanCreator.tsx`, `ProfileHeader.tsx`, `InviteToEventButton.tsx`, `web/app/your-people/`, `web/app/plans/` |
| **F: Crawlers** | crawler agent | `crawlers/sources/atlanta_film_festival.py`, `crawlers/sources/joystick_gamebar.py`, `crawlers/sources/church_bar.py` |

**Conflict notes:**
- `EventDetailView.tsx` is owned by Detail Pages agent. Social's "Add to Plan" (5.4) is queued for Detail Pages agent.
- `RSVPButton.tsx` idle state fix (5.6) is owned by Detail Pages agent since it renders in event detail context.
- Feed agent owns the `?onboarded=true` banner rendering. Onboarding agent owns adding the param to the redirect.

---

## 1. Feed Architecture

### 1.1 Section Reorder

The feed's biggest problem is sequence, not missing sections. Most components already exist — they're just buried or mis-ordered. The current order puts NowShowing and LiveMusic below PlacesToGo as lazy-loaded blocks. Film is hard-excluded from the main event pool entirely.

**New section order in `CityPulseShell.tsx`:**

| Position | Section | Component | Change |
|----------|---------|-----------|--------|
| 1 | CityBriefing | `CityBriefing` | Enable `FlagshipHeroContent` for ATLFF |
| 2 | The Lineup | `LineupSection` | Move up. Expanded interest chips. |
| 3 | The Big Stuff | `FestivalsSection` | **Import and mount** — component exists but is NOT currently rendered in CityPulseShell. Add to hard-coded JSX tier. |
| 4 | Now Showing | `NowShowingSection` | Move above Places to Go in render order |
| 5 | Live Music | `LiveMusicSection` / `MusicTabContent` | Move above Places to Go in render order |
| 6 | Regular Hangs | `RegularHangsSection` | Keep as standalone section |
| 7 | Places to Go | `PlacesToGoSection` | No change |
| 8 | Your People | Existing social section | Hides when empty (safe for new users). Verify component name — may be `HangFeedSection` not `YourPeopleSection`. |
| 9 | Browse | Existing browse/category grid | No change. Verify component name in shell. |

**Implementation note:** CityPulseShell uses a two-tier render system — some sections are hard-coded in JSX order, others render dynamically via `middleSectionOrder.map(renderMiddleSection)` using `FeedBlockId`. The newly-promoted sections (Festivals, Now Showing, Live Music) should be added to the **hard-coded JSX tier** so user feed layout preferences cannot hide or reorder them. Update `DEFAULT_FEED_ORDER` in `types.ts` accordingly.

**Dropped:** On the Horizon (was pulled for data quality reasons — don't restore without solving that).

### 1.2 Remove Film Hard-Exclusion (requires 1.6 dedup)

**File:** `web/lib/city-pulse/pipeline/fetch-events.ts:393`

Remove `.neq("category_id", "film")`. Film events route to Now Showing and are available via Lineup interest chips — they should not be excluded from the event pool entirely.

**DEPENDENCY:** Do NOT remove this exclusion without also implementing cross-section dedup (1.6). Without dedup, film events will appear in both The Lineup AND Now Showing simultaneously, creating visible duplicates. Implement 1.6 first or simultaneously.

### 1.3 Expand Interest Chips

**File:** `web/lib/city-pulse/interests.ts`

Add to the available interest chip catalog (not necessarily defaults):
- `film` — already exists at line ~141, verify it's accessible via "+" picker
- `outdoors` — already exists at line ~220, verify it's accessible via "+" picker
- `festivals` — NEW, needs chip definition + match function. Surfaces festival-tagged events in Lineup when selected.
- `conventions` — NEW, needs chip definition + match function. Currently invisible in all feed sections.

**Note:** `film` and `outdoors` may already be in the catalog but not in `DEFAULT_INTEREST_IDS`. Verify before adding duplicates.

### 1.4 CityBriefing ATLFF Hero

**File:** `web/components/feed/CityBriefing.tsx`

`FlagshipHeroContent` exists but is disabled. Enable it for ATLFF:
- Verify `context.active_festivals` will contain ATLFF during April 24+
- Full-bleed hero with festival name, dates, ticket link
- If the detection doesn't fire, ensure the ATLFF crawler output includes proper `festival_id` and `is_tentpole` flags

### 1.5 The Big Stuff — Hero Treatment During Active Festivals

**File:** `web/components/feed/sections/FestivalsSection.tsx`

Currently renders a 2x2 grid of festival cards with countdown badges. During an active flagship festival (ATLFF April 24 – May 3), the lead card should get hero treatment — single large-format card with countdown urgency, not a grid peer. Off-season the grid is fine.

### 1.6 Cross-Section Deduplication

Formalize dedup: events route to their highest-priority section only. Partially implemented via `suppressed_event_ids`. Make it systematic — an event in The Big Stuff doesn't also appear in The Lineup. A recurring event in Regular Hangs doesn't duplicate in The Lineup.

### 1.7 ATLFF Marquee Experience (revised 2026-04-15)

**File:** `crawlers/sources/atlanta_film_festival.py`

The original "crawler is healthy, just run it" framing was wrong. Audit found:
- **Datascape:** 165 films + 158 scheduled events (116 film screenings + **42 non-film events** including Opening Night Party, filmmaker lounges, RZA appearance, Sustainability Summit, book signings) across 16 venues, date range 2026-03-23 → 2026-05-04.
- **Festival row already exists** (`festivals.id='atlanta-film-festival'`, created 2026-02-27) with portal_id, announced_start/end, image_url, description, website, `primary_type='film_festival'`. **But the crawler hardcodes `festival_id: None` on every event** (lines 422, 517), so 285 active ATLFF rows in the DB are orphaned from their festival.
- **No downstream consumer can find ATLFF content** until this link exists.

Revised scope: four focused tasks (F1-F4) below. **Sections 1.8 crawler fixes are re-scoped separately** (see 1.9).

#### F1 — Festival linkage (P0, ~1h)

**F1a. Stamp `festival_id` on every event.**
- `atlanta_film_festival.py:422`: `"festival_id": None` → `"festival_id": "atlanta-film-festival"`
- `atlanta_film_festival.py:517`: same
- Pipeline verified: `crawlers/db/screenings.py` threads `festival_id` through `persist_screening_bundle` → `sync_run_events_from_screenings` (lines 49, 121, 151, 183, 217, 606). No pipeline changes needed.

**F1b. Upsert missing festival row fields on each run.**
Current row is missing: `location`, `ticket_url`, `categories`. Add an idempotent update at the start of `crawl()`:
```python
client.table("festivals").update({
    "location": "Multiple venues, Atlanta",
    "ticket_url": f"{FRONTEND_ORIGIN}/schedule",
    "categories": ["film", "festival"],
}).eq("id", "atlanta-film-festival").execute()
```

**F1c. DO NOT stamp `is_tentpole` on sub-events.**
Decision: the festival row is the tentpole. Individual screenings ride at standard importance and surface via normal feed paths. Avoid the noise of 258 events competing for flagship treatment. The "whole festival is a tentpole" principle means we elevate the festival card, not its sub-events.

**F1d. Backfill existing 285 rows.**
One-off UPDATE after F1a lands, before the next crawl run. Requires user approval (destructive DB write).

#### F2 — Non-film event handling (P0, ~2-3h)

**F2a. Drop operational "events".**
"Headquarters Open!" (9 instances), "Badge Pickup", "Merch" are operational wayfinding, not discoverable events. Add `_OPERATIONAL_TITLE_PATTERNS` to filter at crawl time. Deactivate existing rows in DB.

Capture operational info as **festival-level metadata**, not events:
- Add/reuse festival fields: `notes` (TEXT, already exists) or new JSONB `practical_info` for: HQ location + hours, badge pickup schedule, merch location. This renders on the festival detail page as a "Plan Your Visit" peer section — sibling to event description and parking info, not sibling to events themselves.
- Ensure "Headquarters" (535 Means St NW) gets created as a real `places` row with hours — the festival detail page links to it as a place.

**F2b. Relax the ancillary-window filter.**
`_is_ancillary_outside_window` currently drops everything outside 2026-04-23 → 2026-05-03. This rejects legit pre-festival hype: ATLFF Launch Party (Mar 23), FLASH Tattoo DAY (Apr 19), SEAT industry day (Apr 22).

Change: accept non-film events within `[FESTIVAL_START - 45 days, FESTIVAL_END + 14 days]`. Preserves the spurious-noise guard while keeping marketing content.

**F2c. Scannable tag taxonomy (replaces blanket `["film", "festival", "atlff"]`).**
Every ATLFF event gets: `["atlff", "festival-2026"]` as its base, plus a scannable tag set derived from the Eventive signal. Tags drive filterable chips in the festival detail page and The Lineup.

Detection → tags:
| Eventive signal / title pattern | Added tags |
|---|---|
| `films_linked` non-empty | `film`, `screening` |
| Eventive tag contains `Narrative Feature` | `narrative-feature` |
| Eventive tag contains `Documentary Feature` | `documentary` |
| Eventive tag contains `Shorts Block` | `shorts` |
| Eventive tag contains `Legacy Screening` | `legacy-screening` |
| Eventive tag contains `Special Presentation` | `special-presentation` |
| Eventive tag contains `Marquee` | `marquee` |
| Eventive tag contains `Talent in Attendance` | `talent-in-attendance`, `q-and-a` |
| Title contains "Party" / "Afterparty" | `party`, `social` |
| Title contains "Opening Night" | `opening-night`, `party` |
| Title contains "Happy Hour" | `happy-hour`, `social` |
| Title contains "Lounge" | `hangout`, `social` |
| Title contains "Networking" | `networking`, `social` |
| Title contains "Conversation", "Book Signing", "in Conversation" | `talk`, `author-event` |
| Eventive tag in {`Producing`, `Directing`, `Screenwriting`, `Acting`, `Budgeting`, `Financing`, `Creative Conference`, `Storytelling`} | `panel`, `industry`, `conference` |

Each ATLFF event ends up with 3-6 tags. The existing `events.tags` column handles this. The filter UI on the festival detail page consumes these as scannable chips. **Do not** hard-split non-film events into separate categories — they all live under ATLFF and are differentiated by tag.

**F2d. Series grouping for recurring non-film sessions.**
All 5 Filmmaker Lounge instances → 1 series. Same for Happy Hour (4), Creative Cocktails (2). Current pattern uses raw event name as series title, which breaks when sponsor suffixes vary (`"Happy Hour Sponsored by Television Academy"` ≠ `"Happy Hour"`). Normalize series title by stripping sponsor suffixes before passing to `series_hint`.

#### F3 — Venue metadata quality (P0, ~1-1.5h)

**F3a. Neighborhood + lat/lng map.**
Stop defaulting every venue to "Midtown" (line 168). Hardcode the known ATLFF venues:
```python
_ATLFF_VENUE_METADATA = {
    "Plaza Theatre":                {"neighborhood": "Poncey-Highland", "lat": 33.7718, "lng": -84.3527},
    "The Green Room @ The Plaza":   {"neighborhood": "Poncey-Highland", "lat": 33.7718, "lng": -84.3527},
    "Tara Theatre":                 {"neighborhood": "Buckhead",        "lat": 33.8104, "lng": -84.3462},
    "Headquarters":                 {"neighborhood": "Castleberry Hill","lat": 33.7706, "lng": -84.4110},
    "Oakland Cemetery":             {"neighborhood": "Old Fourth Ward", "lat": 33.7488, "lng": -84.3719},
    "Hotel Clermont":               {"neighborhood": "Poncey-Highland", "lat": 33.7737, "lng": -84.3535},
    "The Goat Farm":                {"neighborhood": "West Midtown",    "lat": 33.7806, "lng": -84.4158},
    "Assembly Atlanta":             {"neighborhood": "Doraville",       "lat": 33.9026, "lng": -84.2843},
}
```
(Coordinates need final verification — these are approximate.)

**F3b. Auditorium rollup.**
Currently creates 5 separate `places` rows for Tara (Eddie/Jack/Kenny/George/Lobby auditoriums) and 3 for Plaza (LeFont/Rej + Green Room). Strip the `" | <Auditorium>"` suffix before creating, and store the auditorium name in event metadata (use existing `events.raw_text` or add a note). Result: 1 Tara Theatre place, 1 Plaza Theatre place, 1 Green Room @ Plaza place.

**F3c. Use existing venue records when available.**
`plaza_theatre.py`, `tara_theatre.py`, `landmark_midtown.py` already exist and own those venue rows. ATLFF crawler should match by name/slug and attach, not create duplicates. `get_or_create_place` handles dedup by slug — ensure slugs are normalized (`plaza-theatre`, `tara-theatre`) to match what the venue crawlers use.

#### F4 — Venue crawler dedup during festival window (P1, ~30min)

During April 23 – May 3, Plaza/Tara/Landmark crawl their own calendars and will find ATLFF screenings listed there too. Two actions:
1. **Test content-hash dedup first.** The content hash is `(title, venue_name, start_date)`. Same-film same-theater same-date should collide across sources. Run both crawlers in dry-run, confirm dedup fires.
2. **If dedup doesn't catch it:** pause `plaza_theatre`, `tara_theatre`, `landmark_midtown` sources in the sources table (`is_active=false`) for the festival window. Cleanest. ~5 min change.

---

### 1.8 Cross-workstream callouts from F

F1a (stamping festival_id) triggers over-promotion in 4 downstream feed consumers. **These need coordinated changes in Workstream A (feed agent) or F1 will make The Lineup worse, not better.**

**Callout A1: `web/lib/city-pulse/tier-assignment.ts:57`**
Current logic:
```typescript
if (intrinsic >= 30 || event.is_tentpole || event.festival_id) return "hero";
```
With F1a stamping 258 ATLFF events, ALL of them render as hero tier in The Lineup — exactly the noise we're trying to avoid.

**Fix:** Change to `if (intrinsic >= 30 || event.is_tentpole) return "hero";` — drop the `event.festival_id` short-circuit. Also reduce the `computeIntrinsicScore` bonus at line 40 from `+30` → `+10`. Festival membership is a grouping signal, not automatic hero promotion.

**Callout A2: `web/lib/city-pulse/header-resolver.ts:219`**
Flagship binding currently treats any event with festival_id as a flagship hero candidate:
```typescript
(e.importance === "flagship" || e.is_tentpole || !!e.festival_id) &&
```
This is why `CityBriefing.tsx:716` is commented out (`const flagship = null;`) — the old auto-binding surfaced junk like "VIP Show Floor Early Access."

**Fix:** Narrow flagship candidacy to `(e.importance === "flagship" || e.is_tentpole)` — drop festival_id from the criteria. Then re-enable `CityBriefing.tsx:716` flagship binding. This is how spec 1.4 actually unblocks.

**Callout A3: `web/scripts/audit-elevation-readiness.ts:233-247`**
Contains an offline promotion script that sets `importance='flagship'` on any event with `festival_id` and `importance='standard'`. **DO NOT RUN after F1a.** Would blanket-promote 258 ATLFF events to flagship. Either disable the script or gate it with a source whitelist.

**Callout A4: `FestivalsSection` mounting (spec 1.5)**
Feed agent must mount `FestivalsSection` in `CityPulseShell.tsx` — blocked in original spec, unblocked now. The festival row has the data needed:
- `announced_start/end`: 2026-04-23 → 2026-05-03 (countdown badge)
- `image_url`: ATLFF branded hero image
- `description`: populated
- `slug`: `atlanta-film-festival` (for festival detail page link)

`/api/festivals/upcoming` already returns this row (tested — it's in the response). Section just needs to be imported and rendered.

**Callout A5: `CityBriefing` flagship hero (spec 1.4)**
After callout A2 narrows flagship candidacy, re-enable `CityBriefing.tsx:716`. Because ATLFF sub-events don't have is_tentpole set (F1c decision), the hero will only bind if the feed agent (or a future curation step) explicitly marks 1-3 events as `is_tentpole=true` or `importance='flagship'`. For the launch, recommend curating by hand:
- Opening Night film + party (Apr 24)
- Closing Night film (May 3)
- RZA "One Spoon of Chocolate" appearance (Apr 25)

Set via UPDATE on `events` after F1a lands. ~3 events, not 258.

**Callout A6: Section dedup (spec 1.6)**
Now urgent. Without F1c promoting sub-events, ATLFF film screenings will appear in **both** The Lineup AND Now Showing. Spec 1.6 must ship with F1 or users see duplicates.

**Callout A7: Festival detail page**
`buildFestivalUrl()` exists at `web/lib/entity-urls.ts`. `/api/festivals/[slug]/route.ts` exists. Feed agent should verify the festival detail page route renders for `/atlanta/festivals/atlanta-film-festival` and iterate if broken — this is the destination for the "Find out more" link on the FestivalsSection card.

---

### 1.9 Crawler Fixes for Regular Hangs (moved from 1.8)

**Joystick Gamebar** (`crawlers/sources/joystick_gamebar.py`): Scrapes events but marks them `is_recurring: False` with no `series_hint`. Weekly bingo/trivia nights are invisible to Regular Hangs. Fix: when detected genres contain `bingo`, `trivia`, or `karaoke`, set `is_recurring: True` and pass `series_hint`.

**Church Bar** (`crawlers/sources/church_bar.py`): Produces zero events. A nightclub running DJ nights 5 nights a week has nothing in the data layer. Add `WEEKLY_SCHEDULE` following the Mary's/Blake's pattern. **Blocked on user supplying the actual schedule** — not in the spec and too easy to fabricate wrong.

---

## 2. Detail Experience Pages

### 2.1 Mobile Back Button on Event Pages

**File:** `web/components/views/EventDetailView.tsx:931-937`

The event top bar is `justify-end` only — save/share buttons on the right, nothing on the left. No visible way to navigate back on mobile. `PlaceDetailView` does this correctly with `NeonBackButton` on the left.

**Fix:** Add `NeonBackButton` to the left side of the event top bar, matching the PlaceDetailView pattern.

### 2.2 Hero Image Fallback

**File:** `web/components/detail/DetailHeroImage.tsx:74-82`

When `imageUrl` is null, the fallback renders a 20% opacity category icon on a dark gradient — essentially invisible.

**Fix — specific visual spec:**
- Keep existing gradient (`from-[var(--dusk)] to-[var(--night)]`)
- Add category-color tinted wash: `bg-[categoryColor]/5` as an additional layer between gradient and icon
- Icon: `CategoryIcon` at `size={64}` with `opacity-[0.35]` (up from 20%)
- Below icon: category or venue type label in `text-2xs font-mono uppercase tracking-wider` at `text-[categoryColor]/40`, centered
- Both entity types (events and places) use the same pattern — differentiation comes from the category color tint

**Also (P2):** `HeroGallery.tsx:57-99` — multi-image scroll path has no gradient per frame (only on the outer container). Dot indicators float on raw image content without contrast backing. Move gradient inside each frame div; give dot indicators a `bg-black/30 backdrop-blur-sm rounded-full px-2 py-1` backdrop pill.

### 2.3 Amenity/Attraction Filter

**File:** `web/lib/spot-detail.ts:474-479`

The venue features query fetches all `feature_type` values unfiltered. Amenities (concessions, parking, WiFi) render alongside actual attractions in "What's Here."

**Fix:** Split features into two groups:
- **Attractions** (`attraction`, `exhibition`, `collection`, `experience`) → render in the main features section ("What's Here" / "Exhibits & Habitats") using existing image card treatment
- **Amenities** (`amenity`) → render in Plan Your Visit section as a horizontal comma-separated text list in `text-sm text-[var(--muted)]` below a `font-mono text-xs uppercase tracking-wider text-[var(--muted)]` label ("Amenities"). No cards, no borders, no images. Max 5 items before "+N more" overflow.

**Files:** 
- `web/lib/spot-detail.ts:474-479` — add `.in("feature_type", ["attraction","exhibition","collection","experience"])` to the features query, OR filter client-side in `PlaceFeaturesSection.tsx`
- `web/components/detail/PlaceFeaturesSection.tsx` — filter before rendering if not filtered at query level
- Amenities render inline within the existing `PlanYourVisitSection` or `renderPlanYourVisit()` block

### 2.4 Film Poster Aspect Ratio

**File:** `web/components/views/SeriesDetailView.tsx:274-279`

Film series with images use the default `aspect-video lg:aspect-[16/10]` (landscape). Movie posters are 2:3 (portrait). The fallback at lines 281-284 correctly uses `aspect-[2/3] max-h-[260px]` but the actual image path doesn't.

**Fix:** When `isFilm` is true, pass `aspectClass="aspect-[2/3] max-h-[260px]"` to `DetailHeroImage`.

### 2.5 Dual Plan Your Visit Sections

**File:** `web/components/views/PlaceDetailView.tsx:921-927`

Feature-heavy venues render both `renderPlanYourVisit()` (from spot-level data) and `PlanYourVisitSection` (from placeProfile). Two "Plan Your Visit" headers in a row, potentially with different admission prices.

**Fix:** Consolidate to one section. Prefer `placeProfile` data when available (more curated), fall back to `spot.*` fields.

**Also:** `PlanYourVisitSection.tsx:38` — `deriveDurationText` returns `"2-3 hours"` as default when there's no data. This is fabricated. Return `null` and don't render the Duration card.

### 2.6 Event Content Zone — Location Buried

**File:** `web/components/views/EventDetailView.tsx:735-786`

Content zone order: About → Location → Lineup. On mobile, users scroll past the entire description to find the address. The "where is this?" answer is split across sidebar (venue name only) and content zone (address).

**Fix:** Move address inline into the sidebar below the venue name. Keep the content-zone Location section for transit/parking detail only.

### 2.7 Recurring Series Visual Identity

**File:** `web/components/views/SeriesDetailView.tsx:273-287`

Non-film series without images render no hero at all — sidebar starts abruptly with a pill badge and title. Trivia nights, comedy shows, open mics have zero visual differentiation.

**Fix:** Give non-film series a consistent visual banner: `h-[120px]` with `bg-[typeColor]/8` and series-type icon at 48px opacity 0.3. Consistent with the film fallback pattern.

### 2.8 ShowtimesTheaterCard URL Context

**File:** `web/components/detail/ShowtimesTheaterCard.tsx:81`

Links use feed-context overlay URL (`?spot=slug`) from inside a detail page. Causes infinite overlay nesting.

**Fix:** Use `buildSpotUrl(theater.venue_slug, portalSlug, 'page')` from `entity-urls.ts`.

### 2.9 Design System Violations

- `AccessibilitySection.tsx:77-80` — hardcoded `#A78BFA` instead of `var(--vibe)`
- `DiningDetailsSection.tsx:260` — hardcoded `#00D9A0` instead of `var(--neon-green)`
- `SectionHeader.tsx:18-23` — count badge at `text-2xs` in `bg-[var(--twilight)]/75` is borderline readable. Increase to `text-xs` or opacity to `/100`.

### 2.10 Sidebar Information Density

**File:** `web/components/views/EventDetailView.tsx:523-546`

Seven distinct information layers in the sidebar before the CTA: Title, Venue, Date/Time/Price, Taxonomy badges, Genre pills, Exhibition/Recurring badge, Show Signals.

**Fix:** Collapse taxonomy badges (`cost_tier`, `duration`, `indoor_outdoor`, `booking_required`) into the genre pills row or fold into Show Signals panel.

---

## 3. Onboarding

### 3.1 Wire the Real Step Components

**File:** `web/app/onboarding/page.tsx`

The live `page.tsx` has a hardcoded 18-category grid with ad-hoc colors that don't match the design system. `CategoryPicker.tsx` in `steps/` has improvements: design system colors via `getCategoryColor()`, live category counts from `/api/filters`, selection animation with checkmark, and "Skip and show everything" copy.

**Fix:** Replace `page.tsx` with an orchestrator that:
1. Shows `OnboardingProgress` for step tracking
2. Step 1: `CategoryPicker` (replaces the hardcoded grid)
3. Step 2: `GenrePicker` (currently skipped entirely)
4. Saves both categories and genres via `/api/onboarding/complete`

**Preserve from current `page.tsx`:** The save-to-API logic, the skip handler, the redirect to portal. The current API call to `/api/onboarding/complete` works correctly — the issue is the UI, not the data flow. If `CategoryPicker.tsx` has different API call patterns, reconcile to use the existing working endpoint.

**Risk mitigation:** Keep the old `page.tsx` as `page.backup.tsx` during development. Test the new orchestrator end-to-end (select categories → select genres → save → redirect → feed reflects choices) before removing the backup.

### 3.2 Add Neighborhood Step

**Data layer fully wired, UI component needs to be built:**
- `PREFERENCE_NEIGHBORHOODS` exists in `web/lib/preferences.ts:84` — this is the source of neighborhood options
- `favorite_neighborhoods` exists in `user_preferences` table
- Feed route reads it at line 304

**No `NeighborhoodPicker.tsx` exists** — this is a new component, not just wiring.

**Design spec for NeighborhoodPicker:**
- Filterable chip list using `PREFERENCE_NEIGHBORHOODS` as the data source
- Multi-select (same interaction pattern as `CategoryPicker`)
- Step is **optional** — skip shows all neighborhoods. Skip copy: "Show me all of Atlanta"
- Single-column on mobile, two-column at `sm:`
- Saves to `favorite_neighborhoods` via `/api/onboarding/complete` with the existing `selectedNeighborhoods` key
- Appears as Step 3 (after categories and genres, before redirect to feed)

**Risk:** If neighborhood filtering produces thin feeds for some areas, this step hurts more than helps. Verify that the top 5 Atlanta neighborhoods each return 20+ events for the ATLFF week before shipping this step. If data is thin, defer to post-launch.

### 3.3 Post-Onboarding Confirmation

**File:** `web/app/onboarding/page.tsx:106-108`

After Continue, user is pushed to `/atlanta` with zero acknowledgement that preferences did anything. The API already returns `categoryCount` and `genreCount` in the response (line 165-170 of `complete/route.ts`) — this data is discarded client-side.

**Fix:** Pass `?onboarded=true` query param. On first feed load, display a slim dismissible bar: "Your Atlanta feed is ready — tuned to Music, Comedy, and Food." Use the category count from the onboarding API response.

### 3.4 Sign-Up Friction Reduction

**File:** `web/app/auth/signup/page.tsx`

- **DOB:** Three separate dropdowns (Month, Day, Year) with `appearance-none` but no custom dropdown arrow. Move DOB to a post-signup step or replace with single `type="date"` input. If required upfront for legal, say why.
- **Username check:** `checkUsername` calls Supabase directly from the browser client (lines 73-88). Move to an API route (`/api/auth/check-username`). This is the `web/CLAUDE.md` anti-pattern.
- **No browse-first option:** Add "Explore Atlanta first" link below Google OAuth on signup page. Link to `/atlanta`. The product IS the hook — let people see it.

### 3.5 Auth Hero Photo

**File:** `web/components/auth/AuthHeroPhoto.tsx:28-35`

Only two distinct photos in rotation. Morning, evening, and late night all use `jackson-st-bridge.jpg`. Midday and happy hour both use `skyline-candidate-1.jpg`. "Candidate" in the filename is a placeholder artifact.

**Fix:** Either add 3+ distinct time-of-day photos or simplify to one strong Atlanta photo and remove the time-slot machinery.

### 3.6 Copy and Tone

- `page.tsx:125` — "Make Lost City yours" is generic. "What's your Atlanta?" or "Tell us what moves you" is more specific.
- `page.tsx:177-180` — "Skip for now →" implies uncertainty. Change to "Show me everything" or "Skip — show me Atlanta."
- `signup/page.tsx:244` — "Discover your city's hidden gems" is the only value prop in the entire flow. Add one differentiating sentence: "LostCity crawls 1,000+ Atlanta sources so nothing gets missed."

---

## 4. Calendar

### 4.1 Current Time Indicator in Week View

**File:** `web/components/calendar/WeekView.tsx`

No current time line exists. Every serious calendar app has one.

**Fix:** Add a `useEffect` that updates `currentTimePosition` every minute. Render a coral line with dot in today's column, absolutely positioned at the computed time offset. Auto-scroll the time grid to this position on mount.

### 4.2 Month View Event Names in Cells

**File:** `web/components/calendar/DayCell.tsx:80-154`

Each cell shows a count badge and up to three 6px dots. `uniqueCategories` data is computed but wasted on dots.

**Fix:** On desktop (non-compact), show up to 2 event title chips as truncated text inside cells with category-tinted backgrounds. Keep "+N more" indicator. Keep dots for compact/mini-month.

### 4.3 Auto-Scroll to Current Time

**File:** `web/components/calendar/WeekView.tsx:262`

The time grid defaults to 6am at the top. On evening use, events are at 7pm and require significant scrolling.

**Fix:** Add a `useEffect` with a ref on the scrollable container. On mount, scroll to `(currentHour - 6) * HOUR_HEIGHT - 100px`. One function, high impact.

### 4.4 Mobile Header Density

**File:** `web/components/calendar/MobileCalendarView.tsx:258-319`

Header consumes ~150-160px before first event on a 375px viewport (~40% of screen).

**Fix:**
- Remove background fill from expand toggle, use inline text + bare chevron. Target 32px row height.
- Collapse "Today" button into WeekStrip (highlight today cell with ring, tap to navigate)
- Reduce WeekStrip cell height from ~60px to 52px

Target: first event visible at ~120px mark.

### 4.5 Today Button Visibility

**Files:** `MonthGrid.tsx:39-46`, `MobileCalendarView.tsx`

Today button hides when already viewing the current month/date. Google always shows it.

**Fix:** Always show Today button. Dim it (`opacity-50`) when already on today.

### 4.6 Wire HoverPreviewCard

**File:** `web/components/calendar/HoverPreviewCard.tsx`

Built and position-aware but not wired into month or week views. The most Google-like interaction is sitting unused.

**Fix:** Wire into `DayDetailView`'s event cards for hover preview on desktop. Add hover handlers to week view event blocks.

### 4.7 Design System Compliance

- `CalendarHeader.tsx:45` — `backdrop-blur-md` violates cinematic minimalism (`glass_enabled: false`). Remove.
- `WeekView.tsx:204` — Today highlight uses `text-[var(--neon-magenta)]` while everywhere else uses `text-[var(--gold)]`. Make consistent.
- `OpenTimeBlock.tsx:76` — Uses `sparkles` emoji. Replace with Phosphor `Sparkle` icon.
- Multiple files use inline `<svg>` paths for clock/pin/calendar. Replace with Phosphor `Clock`, `MapPin`, `CalendarBlank`.

### 4.8 Agenda View Friend Events

**File:** `web/components/calendar/AgendaView.tsx:404-465`

Friend-only events render with subtly different styling but no section label. Users don't know why dimmer cards with face thumbnails are appearing.

**Fix:** Add a sticky section header above friend events: `"Friends going"` in `text-2xs font-mono uppercase text-[var(--vibe)]`.

### 4.9 Skeleton Layout Mismatch

**File:** `web/components/calendar/CalendarSkeleton.tsx`

Skeleton shows event cards but default view is agenda (two-column layout). Causes layout reflow on load.

**Fix:** Skeleton should mirror agenda layout: two columns on xl, left with date-grouped event skeletons, right with mini-month grid skeleton.

---

## 5. Social Hooks

### 5.1 Post-RSVP Share for Users Without Friends

**File:** `web/components/PostRsvpSharePrompt.tsx`

Returns `null` when `friends.length === 0`. Every new user sees nothing after RSVPing.

**Fix:** When `friends.length === 0`, render a share-first variant instead of returning null.

**Visual spec:** `bg-[var(--night)] rounded-xl border border-[var(--twilight)] p-4`. Heading: `text-base font-semibold text-[var(--cream)]` — "You're in. Tell someone." Two icon buttons using the existing `w-10 h-10 rounded-xl border border-[var(--twilight)]` pattern: Copy Link (Phosphor `Link` icon) and Share (Phosphor `ShareNetwork` icon, triggers `navigator.share` with clipboard fallback). Below buttons: `text-xs text-[var(--muted)]` with coral-colored link text — "or find friends on Lost City →" linking to `/your-people`.

**Loading state:** While friends query runs (`isLoading`), render the share-first variant immediately — don't wait for friends data to decide. If friends load and `length > 0`, replace with the existing friends-list variant.

Native share / copy-link doesn't require friends and captures the highest-intent viral moment.

### 5.2 Save Button on Feed Cards

**File:** `web/components/event-card/EventCardActions.tsx`

Only renders `RSVPButton`. No bookmark-for-later action on the primary browsing surface.

**Fix:** Add `SaveButton` to `EventCardActions` as a second icon button. Use `size="md"` for adequate touch target (44px minimum). Match the existing `w-10 h-10 rounded-xl border border-[var(--twilight)]` pattern.

### 5.3 Saved Page Quality

**Files:** `web/app/saved/SavedPageClient.tsx`, `web/components/dashboard/DashboardPlanning.tsx`

Issues:
- Uses direct Supabase queries instead of `/api/saved/list` (CLAUDE.md anti-pattern)
- Bespoke `EventCard` with `font-serif` venue names (not in design system)
- Empty state says "Nothing stashed. Boring." — dismissive

**Fix:**
- Refactor to use API routes
- Use system card pattern (`find-row-card find-row-card-bg rounded-xl`)
- Empty state should be aspirational: "Save events you're curious about. Your stash builds your feed."

### 5.4 Add to Plan from Event Detail

**File:** `web/components/views/EventDetailView.tsx`

No plan-related action on event detail pages. The "find event → build a night around it" flow has no path.

**Fix:** Add "Add to a plan" action on the sticky bar or detail action row. Opens a bottom sheet with existing plans + "Create new plan" option. Calls `POST /api/plans/[id]/items`.

### 5.5 Profile Social Model Alignment

**File:** `web/components/profile/ProfileHeader.tsx:117-131`

Shows `followerCount` and `followingCount` with links to `/followers` and `/following`. Contradicts `docs/decisions/2026-03-12-follows-to-friendships.md`.

**Fix:** Show `friend_count` and `hang_count` matching `ProfileView.tsx`. Remove followers/following stats from primary profile header.

### 5.6 RSVP Button Default State

**File:** `web/components/RSVPButton.tsx:536-541`

Idle state shows "Show Interest" with no visible chevron indicating it's a menu. "I'm in" (going) is only accessible via dropdown. New users click "Show Interest" and never discover `going`.

**Fix:** Show chevron/caret in idle state to signal menu. Or use `primary` variant on detail pages consistently.

### 5.7 Plan Share Landing Page

**File:** `web/components/plans/PlanCreator.tsx:61`

Builds share URL to `/{portalSlug}/plans/share/${shareToken}`. Verify this frontend route exists. If not, create a public landing page that loads plan data via `GET /api/plans/share/:token` and renders a read-only plan view with "Join this plan" CTA.

### 5.8 Your People Discoverability

**File:** `web/app/your-people/page.tsx`

Substantially built (`CrewBoard`, `FriendRadarCarousel`, `FindFriendsSection`) but not linked from primary navigation. New users can't discover the social layer.

**Fix:** Surface prominently during marketing push — tab bar entry, or contextual "Find friends on Lost City" module injected into the feed below the first few sections.

### 5.9 Post-RSVP Prompt Cadence

Three sequential prompts after RSVP (`PostRsvpNeedsPrompt` → `PostRsvpSharePrompt` → `PostRsvpHangPrompt`) feels like spam on mobile. Cap at two max. Prefer share prompt first (network effect); hang prompt only if event is today.

---

## 6. Notifications / Digest

**Cut for marketing push.** Infrastructure is 80% there (settings, defaults, template) but actual email/push delivery is not wired. A broken email is worse than no email for first impressions. This is a post-launch engagement play.

---

## Priority Tiers

### P0 — First Impression Breakers (must ship before marketing push)

**Gate: Data Quality (Section 0)**
- Run ATLFF crawler immediately (April 15) and verify pass/fail criteria
- Run again April 20 and 22 for late additions

**Feed:**
- Section reorder in CityPulseShell (1.1) — including importing/mounting FestivalsSection
- Cross-section dedup (1.6) — MUST ship with or before film exclusion removal
- Remove film hard-exclusion from fetch-events.ts (1.2) — after dedup is in place
- Expand interest chips (1.3)
- Enable CityBriefing flagship hero for ATLFF (1.4)

**Onboarding:**
- Wire real CategoryPicker/GenrePicker step components (3.1)
- Post-onboarding confirmation banner (3.3)
- "Explore Atlanta first" browse option on signup (3.4) — promoted from P1, this is the marketing funnel entry

**Detail Pages:**
- Mobile back button on event pages (2.1)
- Amenity/attraction filter (2.3)
- Hero image fallback with identity (2.2)

**Social:**
- Post-RSVP share fallback for friendless users (5.1)
- Save button on feed event cards (5.2)

**Crawlers (revised — all P0 for marquee experience):**
- F1: ATLFF festival_id linkage + row enrichment (1.7 F1)
- F2: Non-film event handling (parties, panels, operational filter, tag taxonomy) (1.7 F2)
- F3: Venue metadata (neighborhoods, lat/lng, auditorium rollup) (1.7 F3)
- F4: Venue crawler dedup during festival window (1.7 F4)

**Cross-workstream dependencies (1.8):**
- A1 + A2: Tier-assignment + header-resolver narrowing (feed agent, unblocks 1.4 and 1.5)
- A3: Disable audit-elevation-readiness auto-promotion for ATLFF
- A5: Manual curation of 3 flagship events (Opening/Closing Night, RZA appearance)

### P1 — Quality Bar (should ship)

**Detail Pages:**
- Film poster aspect ratio (2.4)
- Dual Plan Your Visit consolidation (2.5)
- Location higher in event content zone (2.6)
- Recurring series visual identity (2.7)
- ShowtimesTheaterCard URL context fix (2.8)
- "Add to Plan" on event detail pages (5.4) — owned by Detail Pages agent
- RSVP button idle state clarity (5.6) — owned by Detail Pages agent

**Calendar (entire workstream is P1 for this push — not a first-impression surface):**
- Current time indicator in week view (4.1)
- Month view event name chips in cells (4.2)
- Auto-scroll to current time (4.3)
- Mobile header density reduction (4.4)
- Today button always visible (4.5)
- Wire HoverPreviewCard (4.6)
- Design system compliance (4.7)

**Social:**
- Saved page quality — refactor to API routes (5.3) — the direct Supabase calls are a CLAUDE.md anti-pattern that will hang under load
- Plan share landing page verification/creation (5.7)
- Profile followers→friends alignment (5.5)
- Your People discoverability (5.8)

**Onboarding:**
- Add neighborhood step (3.2) — contingent on data validation showing 20+ events per top-5 neighborhood
- Username check to API route (3.4) — CLAUDE.md anti-pattern, security risk
- Reduce sign-up friction — defer DOB (3.4)
- Auth hero photo library (3.5)
- Copy/tone improvements (3.6)

**Crawlers:**
- Joystick Gamebar recurring event fix (1.9)
- Church Bar event coverage (1.9) — blocked on user supplying actual schedule

**Feed:**
- The Big Stuff hero treatment during active festivals (1.5)

### P2 — Polish (if time permits)

**Detail Pages:**
- Design system token violations — hardcoded hex (2.9)
- Sidebar information density (2.10)
- HeroGallery gradient per frame (2.2 sub-item)
- SectionHeader count badge contrast (2.9 sub-item)
- Exhibition thumbnail fallback

**Calendar:**
- Skeleton layout match (4.9)
- Agenda view friend event section header (4.8)
- Inline SVG → Phosphor icon replacement (4.7 sub-item)

**Social:**
- Post-RSVP prompt cadence — cap at 2 (5.9)
- SaveButton loading skeleton layout shift
- Invite modal email option prominence

---

## Key Files Reference

### Feed
- `web/components/feed/CityPulseShell.tsx` — section order
- `web/lib/city-pulse/pipeline/fetch-events.ts:393` — film exclusion
- `web/lib/city-pulse/interests.ts` — interest chips
- `web/components/feed/CityBriefing.tsx` — flagship hero
- `web/components/feed/sections/FestivalsSection.tsx` — The Big Stuff
- `web/components/feed/sections/NowShowingSection.tsx` — film
- `web/components/feed/sections/RegularHangsSection.tsx` — recurring

### Detail Pages
- `web/components/views/EventDetailView.tsx` — event detail
- `web/components/views/PlaceDetailView.tsx` — venue detail
- `web/components/views/SeriesDetailView.tsx` — series detail
- `web/components/detail/DetailHeroImage.tsx` — hero fallback
- `web/components/detail/PlaceFeaturesSection.tsx` — features rendering
- `web/lib/spot-detail.ts` — venue data fetching
- `web/lib/place-features.ts` — feature types
- `web/components/detail/ShowtimesTheaterCard.tsx` — URL context

### Onboarding
- `web/app/onboarding/page.tsx` — live page (to replace)
- `web/app/onboarding/steps/CategoryPicker.tsx` — real component (to wire)
- `web/app/onboarding/steps/GenrePicker.tsx` — step 2 (to wire)
- `web/app/onboarding/components/OnboardingProgress.tsx` — progress bar (to wire)
- `web/app/auth/signup/page.tsx` — sign-up form
- `web/components/auth/AuthHeroPhoto.tsx` — hero photos

### Calendar
- `web/components/calendar/WeekView.tsx` — week view
- `web/components/calendar/DayCell.tsx` — month cells
- `web/components/calendar/MobileCalendarView.tsx` — mobile
- `web/components/calendar/MonthGrid.tsx` — month grid
- `web/components/calendar/HoverPreviewCard.tsx` — preview (unwired)
- `web/components/calendar/CalendarHeader.tsx` — header
- `web/lib/calendar/CalendarProvider.tsx` — state

### Social
- `web/components/PostRsvpSharePrompt.tsx` — share prompt
- `web/components/event-card/EventCardActions.tsx` — card actions
- `web/components/dashboard/DashboardPlanning.tsx` — saved page
- `web/components/RSVPButton.tsx` — RSVP
- `web/components/plans/PlanCreator.tsx` — plan creation
- `web/components/profile/ProfileHeader.tsx` — profile stats

### Crawlers
- `crawlers/sources/atlanta_film_festival.py` — ATLFF
- `crawlers/sources/joystick_gamebar.py` — recurring fix needed
- `crawlers/sources/church_bar.py` — events needed
