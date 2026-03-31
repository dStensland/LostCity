# Unified Find & Detail View Redesign

**Date:** 2026-03-29
**Status:** Approved for implementation (post expert review)
**Design file:** `docs/design-system.pen` (frames: "Unified Find — Stream View", "Unified Find — Lane View (Arts)", "Unified Find — Stream Desktop", "Place Detail — Museum", "Place Detail — Restaurant", "Event Detail — Refreshed", "Series Detail — Film", "Festival Detail — Refreshed", "Exhibition Detail — Rich", "Artist Detail — New", plus desktop counterparts for Series, Festival, Exhibition, and Artist)

---

## Problem

The current discovery experience splits events and places into separate tabs (Happening + Places), forcing users to decide "am I looking for a place or an event?" before browsing. Nobody thinks that way — they think "what should I go do?" Meanwhile, the new `place_profile` and `place_vertical_details` data model delivers rich vertical-specific data (dining details, outdoor conditions, exhibition info, accessibility, Google ratings) that the UI doesn't surface.

### Current state
- **4 top-level tabs**: Feed | Happening | Places | Going Out
- **Happening** sub-tabs: Events | Regulars | Showtimes (What's On)
- **Places** sub-tabs: Eat & Drink | Things to Do | Nightlife
- **6 navigational buckets** a user must discover and drill into
- **Detail views**: Place and Event are rich; Series, Festival, Exhibition are solid; Organization and Artist are thin or missing
- **Rich data unsurfaced**: `place_profile` (gallery, accessibility, planning notes), `place_vertical_details` (dining, outdoor, civic, google), artist profiles, producer/org info

## Solution

### 1. Unified "Find" Tab

Collapse Happening + Places into a single "Find" tab. The top-level nav becomes: **Feed | Find | Going Out**.

**Going Out vs Nightlife lane clarification:** Going Out is the **social layer** (RSVPs, friend activity, "who's going", plans). The Nightlife lane in Find is **discovery** (venues, events, what's happening). Different intent, different content. No redundancy.

#### Default view: Hybrid Time + Vertical Lanes

**"Right Now" section** (top) — time-driven, mixes all entity types by temporal relevance:
- Events starting soon, places that are open, exhibitions opening today
- Shifts with time of day: morning shows coffee + trails + museums, evening shows restaurants + music + comedy
- Interleaves events and places in the same stream — a gallery with an opening tonight sits next to a restaurant that's open now
- Shows up to 6 items in compact card format
- Includes a "See all →" link in the header (links to a time-filtered view of all currently relevant items)
- **Empty state**: When nothing is temporally urgent (e.g., 2am), section collapses and lanes take over as the top content. Label shifts to "Open Now" or "Coming Up" depending on what's available
- **Outdoor places** appear in "Right Now" only when `best_seasons` from `place_vertical_details.outdoor` includes the current season. Full weather/conditions integration is out of scope — `best_seasons` is the rough proxy for now.

**Vertical lane sections** (below) — category-driven:
- Default lane order: Arts & Culture, Eat & Drink, Nightlife, Outdoors, Music & Shows, Entertainment
- Order adjusted by portal identity (Arts portal puts Arts first)
- Each lane shows both events AND places relevant to that vertical (e.g., Arts & Culture shows museums + gallery openings + theater performances)
- Each shows 2-3 preview cards + count badge ("12 OPEN") + "See all →" link in header row only (no duplicate link at bottom)
- Lanes with 0 items for the current context are hidden, not shown empty
- "See all →" opens a focused lane view with expanded cards, filters, and sort options
- Lanes are **addressable destinations** — deep-linkable from feed sections, CityPulse, other portals
- Count badge text is uppercase mono per the typography scale ("12 OPEN" not "12 open")

#### Personalization

**Portal-level only (v1):** Portal identity sets base vertical weighting (Arts portal leads with arts). This is configuration, not infrastructure.

**User interest picker: DEFERRED.** Portal-level lane ordering covers 80% of the use case. A user interested in outdoors can see the Outdoors lane and tap "See all." The picker's value over that is marginal. Revisit when usage data shows users struggle to find their preferred lane.

#### Editorial, not algorithmic
- Groupings are legible — user can see WHY things are grouped ("Right Now" = temporal, lanes = category)
- Every section is a window into a full filterable set, not a curated cage
- "Access layer, not recommendation engine" philosophy preserved
- Scoring influences order within sections, never exclusion

#### Regulars

Recurring weekly events remain accessible via a **"Regulars" toggle** within the unified Find stream. When active, shows only recurring content with the existing day-of-week browsing pattern (day pills, day-grouped results). The `RegularsView` component and its API calls are reused — the toggle just routes to that existing component within the Find shell rather than as a separate sub-tab. URL: `?view=find&regulars=true`.

### 2. Context-Adaptive Cards

Cards render at **two fidelity levels** depending on context.

#### Architecture: DiscoveryCard component

A `DiscoveryCard` component accepts a discriminated union type (`{entity_type: 'event' | 'place' | 'series' | 'festival', ...}`) and delegates to vertical-specific sub-renderers. Adding a new vertical = adding one compact renderer and one expanded renderer. No shared component modifications needed. Compact cards MUST hold to ~72px height for virtualized list support.

All card types share: same `$shape/card-radius`, same `1px $surface/twilight` stroke border, same `$semantic/card-bg` fill. Event cards get these too — the accent border is additive, not a replacement for the shared container treatment.

#### Compact (in unified stream + lane previews)
- Consistent ~72px height, 40px icon box + content column + metadata row
- Icon box backgrounds derived from vertical accent at 10% opacity (`{accent}1A`), not hardcoded hex
- All card text uses design tokens (`$font/display` for titles, `$font/body` for metadata, `$font/mono` for labels) — not hardcoded `"Outfit"` / `"JetBrains Mono"`. Portal theme overrides must propagate to cards.
- **Dining**: cuisine · price · rating · open/close · neighborhood · distance
- **Arts**: name · rating · inline exhibition badge ("Picasso to Pollock — Opens today") · open/close
- **Outdoor**: name · rating (from Google) · commitment tier badge · `best_seasons` proxy · dog-friendly · distance
- **Music/Events**: shared container treatment + coral accent border + time block · title · venue · genre/price badges
- **Nightlife**: name · vibes · open late · tonight's events

#### Expanded (in lane "See all" views)
- Hero image with type badge overlay (MUSEUM, GALLERY, THEATER, etc.)
- Full exhibition/event inline blocks — color-coded per vertical (copper for arts, gold for time, green for outdoors)
- Description text (all expanded cards show description for consistency), accessibility badges, Google rating
- Variable height — the data earns its space

#### Desktop layout
- **Stream view**: Sidebar with lane navigation (persistent, shows counts, date/weather context) + main content shows the same "Right Now" + lane sections as mobile, but in a wider single-column. Clicking a lane in the sidebar switches the main content to that lane's expanded grid.
- **Lane view**: Sidebar nav (stays visible) + 3-column card grid with filter chips in the header bar, sort toggle, and map toggle
- Sidebar shows: search (44px height for touch target compliance), lane nav with active indicator + count badges, date/weather context block

#### Touch targets
- Search bar: 44px minimum (iOS HIG)
- Filter chips: minimum `[8px, 14px]` padding for ~32px touch target
- All tappable elements: minimum 44px touch target

### 3. "Right Now" API Strategy

The "Right Now" section requires a **dedicated Supabase RPC** (`get_right_now_feed`), not a client-side merge of separate APIs. This is a net-new query pattern.

The RPC should:
1. Query events with `start_date = today AND start_time > now - 1hr AND start_time < now + 3hr`, limit 10
2. Query places with `is_active = true AND has_good_hours(now)`, joined to `place_profile` for hero images and `place_vertical_details.google` for ratings, limit 10
3. Union into a discriminated result set (`{entity_type: 'event' | 'place', ...}`)
4. Score by temporal proximity, return top 6

Cache the RPC result for 5 minutes (matches existing spots cache TTL). The query cost is bounded and predictable (6 items max).

**Lane preview cards** use the existing separate APIs: `/api/spots` for place lanes, `/api/whats-on/*` for music/stage lanes. Each lane preview requires at most 2 API calls (events + places for that vertical). The existing What's On routes (`/api/whats-on/music`, `/api/whats-on/stage`) are **reused as-is** for the Music & Shows lane — they're well-tested and cached. No new API routes needed for lane previews.

**Lane "See all" views** also reuse existing APIs with the `?lane=` param mapped to appropriate filters.

### 4. Refreshed Detail Views

Every entity detail view gets vertical-aware richness from the new data model.

**Prerequisite: Wire `place_profile` and `place_vertical_details` into APIs.** This is Phase 0 — a data layer task that must complete before any UI work begins. Specifically:
- `getSpotDetail()` in `web/lib/spot-detail.ts` must add parallel fetches for `place_profile` and `place_vertical_details` (keyed by `place_id`) to its existing `Promise.all`
- `SpotDetailPayload` type needs `profile: PlaceProfile | null` and `verticalDetails: { dining?: PlaceDiningDetails, outdoor?: PlaceOutdoorDetails, google?: PlaceGoogleDetails } | null`
- `/api/spots` route needs a left join to `place_vertical_details.google` for `rating`/`rating_count` on compact cards
- Series detail showtime venues should batch-fetch `place_profile` with an `IN` clause (not N+1)

#### Place Detail — Vertical-Aware

Shared shell: hero gallery (swipeable, `gallery_urls` from `place_profile`, lazy-load beyond first 2-3 images), type badge, name, Google rating + review count, neighborhood, distance, open status bar, quick actions, vibes.

**Museum/Gallery variant** — "On View" exhibitions section (hero image, title, description, dates, reception badge, admission info), Plan Your Visit (admission/duration cards), Accessibility section (wheelchair, family-friendly, age range, sensory notes, ASL tours), verified date.

**Restaurant variant** — "Dining Details" section with meal duration + reservation status cards, cuisine chips, service chips (dinner/dine-in/outdoor seating), dietary options (vegetarian/vegan/GF), menu highlights prose, capacity. **Data gate:** audit `place_vertical_details.dining` completeness before shipping. If <30% of restaurants have cuisine/dietary/reservations populated, the variant ships mostly empty and looks worse than the current view. Fall back to standard layout for places with no dining data.

**Outdoor variant** — Trail info (commitment tier, difficulty, length, elevation), `best_seasons` + practical notes, getting there.

**New data wired from `place_profile`**: `hero_image_url`, `gallery_urls`, `capacity`, `wheelchair`, `family_suitability`, `age_min`/`age_max`, `sensory_notes`, `accessibility_notes`, `transit_notes`, `parking_type`, `planning_notes`, `planning_last_verified_at`.

**New data wired from `place_vertical_details.dining`**: `cuisine`, `service_style`, `meal_duration_min/max_minutes`, `accepts_reservations`, `reservation_recommended`, `menu_url`, `reservation_url`, `dietary_options`, `serves_vegetarian/vegan`, `outdoor_seating`, `delivery`, `dine_in`, `takeout`, `menu_highlights`, `payment_notes`.

**New data wired from `place_vertical_details.outdoor`**: `destination_type`, `commitment_tier`, `difficulty_level`, `trail_length_miles`, `elevation_gain_ft`, `surface_type`, `best_seasons`, `weather_fit_tags`, `dog_friendly`, `reservation_required`, `permit_required`, `fee_note`, `conditions_notes`, `practical_notes`.

**New data wired from `place_vertical_details.google`**: `rating`, `rating_count`, `price_level`, `google_maps_url`.

#### Event Detail — Refreshed

**Rich artist profiles**: circular photo, HEADLINER/SUPPORT badges, hometown, genre chips, Spotify/Instagram/website links. The artist data is already fetched via `getEventArtists()` in `web/lib/artists.ts` — this is a UI-only change, no new queries needed.

**Producer/organization section**: logo, "Presented by" label, org name. Currently fetched (`producer` field) but never rendered.

**Rich venue context card**: hero image, name, rating, capacity, type, parking + transit info (requires `place_profile` join for venue). Replaces the current thin venue card that only shows name + address.

**Surface `significance`/`significance_signals`**: currently fetched but silently dropped.

#### Series Detail — Film

Poster hero (aspect-ratio-aware), FILM type badge, title, year/rating/runtime metadata row, director, genre chips, "Watch Trailer" link, festival parent link ("Part of Atlanta Film Festival 2026").

**Showtimes section**: date pill strip, theater cards with venue name + neighborhood + parking/transit info (batch-fetch `place_profile` for all showtimes venues), tappable showtime chips.

**Desktop**: poster sidebar with full metadata, main content with spacious theater showtime cards + about section.

#### Festival Detail — Refreshed

Hero with festival type badge (color-coded by `festival_type`), title, date range + duration, location, experience tags (Live Music, Outdoor, Craft Beer — with emoji + color-coded), stats (stages, artists, age policy), "Get Festival Passes" CTA.

**Schedule section**: day tab switcher, stage cards with color-coded dot, set rows (time + artist name + HEADLINER badge + genre + hometown).

**Desktop**: sidebar with festival info + CTA, main content with **multi-stage parallel schedule grid** — the key desktop advantage. Day tabs in the header bar. **Data gate:** confirm structured lineup data (stage, time, artist, role) exists before building the grid component.

**Surface unsurfaced data**: `audience`, `size_tier`, `indoor_outdoor`, `price_tier` — all currently fetched but never rendered.

#### Exhibition Detail — Rich

Hero with EXHIBITION badge, title (multi-line), "Curated by" with linked curator name, date range with **closing countdown badge** ("Closes in 17 days"), venue link.

About section, details grid (admission, medium, works count), related events section (opening reception with time block + FREE badge).

**Desktop**: image sidebar with identity + CTA, main content with about + 3-column details grid.

#### Artist Detail — CONDITIONAL

**Gate:** Audit `artists` table completeness before committing. Need 60%+ of event-linked artist records with bio + photo + genres. If the data doesn't pass, build the routing infrastructure (`?artist=` param in DetailViewRouter + PortalSearchParams) but don't expose the page.

If approved: Hero image, ARTIST badge (magenta `#E855A0`), name, hometown, genre chips, social link pills (Spotify with green tint, Instagram, Website). About/bio section, "Upcoming in Atlanta" section with event cards.

**Desktop**: photo sidebar with identity + genres + social links, main content with extended bio + side-by-side show cards.

**Implementation requirements:**
- Add `artist` to `DetailViewRouter.tsx` param reading (alongside event, spot, series, festival, org)
- Add `artist` to `closeFallbackUrl` cleanup logic
- Add `artist` to `PortalSearchParams` type in `page.tsx`

### 5. URL Structure

```
/[portal]?view=find                    → Unified Find (stream default)
/[portal]?view=find&lane=arts          → Arts & Culture lane
/[portal]?view=find&lane=dining        → Eat & Drink lane
/[portal]?view=find&lane=nightlife     → Nightlife lane
/[portal]?view=find&lane=outdoors      → Outdoors lane
/[portal]?view=find&lane=music         → Music & Shows lane
/[portal]?view=find&lane=entertainment → Entertainment lane
/[portal]?view=find&regulars=true      → Regulars filter (day-of-week browsing)
```

Lane views support all existing filter params (venue_type, neighborhoods, vibes, cuisine, price_level, open_now, with_events, q).

Detail overlays unchanged: `?event=`, `?spot=`, `?series=`, `?festival=`, `?org=`. New: `?artist=` (conditional on data audit).

### 6. What Stays the Same

- **Feed tab** — untouched, remains the contextual home page
- **Going Out tab** — untouched, social layer (RSVPs, friend activity). Distinct from the Nightlife discovery lane.
- **Regulars** — reused via toggle within Find. `RegularsView` component and its API kept intact, day-of-week browsing preserved. Just rendered inside the Find shell instead of as a Happening sub-tab.
- **What's On API routes** (`/api/whats-on/music`, `/api/whats-on/stage`) — reused as data sources for the Music & Shows lane
- **Detail overlay system** (DetailViewRouter, AnimatedDetailWrapper) — reused for all entity types
- **DetailShell** sidebar+content layout — reused for desktop detail views
- **Map mode** — available within any lane view
- **Calendar mode** — available as a display toggle within Find

### 7. Migration Path

Build a `normalizeFinURLParams()` utility that handles all legacy patterns in one pass, with unit tests for every permutation. The current view resolution logic in `page.tsx` is 40+ lines of conditional branching — the migration must consolidate, not add more conditionals.

| Legacy URL | Redirect |
|---|---|
| `?view=happening` | `?view=find` |
| `?view=places` | `?view=find` |
| `?view=events` | `?view=find` |
| `?view=spots` | `?view=find` |
| `?view=find` (bare, legacy) | `?view=find` (no-op) |
| `?view=map` | `?view=find&display=map` |
| `?view=calendar` | `?view=find&display=calendar` |
| `?content=showtimes` | `?view=find&lane=music` |
| `?type=showtimes` / `?type=whats_on` | `?view=find&lane=music` |
| `?content=regulars` | `?view=find&regulars=true` |
| `?tab=eat-drink` | `?view=find&lane=dining` |
| `?tab=things-to-do` | `?view=find&lane=entertainment` |
| `?tab=nightlife` | `?view=find&lane=nightlife` |
| `?view=happening&venue_type=restaurant` | `?view=find&lane=dining&venue_type=restaurant` |
| `?view=places&type=destinations` | `?view=find&lane=outdoors` |

Filter params (search, categories, date, venue_type, neighborhoods, etc.) are preserved through redirects — not stripped.

### 8. Entity Type Color System

Each entity/vertical type has a consistent accent color. **Music/Events uses Vibe Purple to avoid collision with Dining Coral** (both were `#FF6B7A` in the original spec — fixed per architect review).

| Vertical/Entity | Color | Hex | Usage |
|---|---|---|---|
| Dining/Restaurant | Coral | `#FF6B7A` | Lane header, type badge, reservation badge |
| Arts & Culture | Copper | `#C9874F` | Exhibition blocks, type badges, lane header |
| Outdoors | Neon Green | `#00D9A0` | Conditions, commitment, open status |
| Music & Shows | Vibe Purple | `#A78BFA` | Accent borders, time blocks, headliner badges |
| Film | Vibe Purple | `#A78BFA` | Film badges, theater icons |
| Festival | Gold | `#FFD93D` | Festival badges, experience tags, CTA |
| Exhibition | Copper | `#C9874F` | Exhibition badge, curator link |
| Artist | Magenta | `#E855A0` | Artist badge |
| Nightlife | Coral | `#FF6B7A` | Venue-focused, shares dining accent |
| Accessibility | Vibe Purple | `#A78BFA` | Wheelchair, family, age badges |
| Time/Featured | Gold | `#FFD93D` | Tonight, reception, closing countdown |
| Success/Open | Neon Green | `#00D9A0` | Open now, free, distance |
| Urgency/Selling | Neon Red | `#FF5A5A` | Closes soon, selling fast |

### 9. Scope Boundaries

**In scope:**
- Phase 0: Wire `place_profile` and `place_vertical_details` into discovery + detail APIs
- Unified Find tab (stream + lane views, mobile + desktop)
- "Right Now" Supabase RPC
- Context-adaptive card system (compact + expanded, per-vertical, DiscoveryCard pattern)
- Place detail refresh (museum, restaurant, outdoor variants — restaurant gated on data completeness)
- Event detail refresh (artist profiles, producer, venue context)
- Series detail refresh (film with showtimes)
- Festival detail refresh (schedule grid — gated on structured lineup data)
- Exhibition detail refresh (curator, closing countdown, related events)
- URL migration with `normalizeFinURLParams()` utility + unit tests
- Wire `place_vertical_details.google` for ratings on all cards

**Conditional (gated on data audit):**
- Artist detail (new entity view) — need 60%+ artist record completeness
- Restaurant detail dining variant — need 30%+ dining JSONB populated
- Festival schedule grid — need structured stage/time/artist data

**Deferred (future work):**
- User interest picker (portal-level ordering covers 80%)
- Organization detail refresh
- Neighborhood detail refresh
- Program detail refresh (family portal specific)
- Weather/conditions integration for outdoor lane (using `best_seasons` proxy for now)
- Map-first discovery mode
- Social proof on discovery cards (going count, friend activity)
- Recurring show series detail variant (only film designed)

### 10. Review Log

**Expert review completed 2026-03-29. Three reviewers:**

**Architecture (code-review-ai:architect-review):** Sound design. Must-fix: dedicated RPC for Right Now, wire extension tables as Phase 0, add artist to DetailViewRouter, expand URL migration table, clarify What's On API reuse. Should-fix: DiscoveryCard extension contract, coral color collision (fixed), Nightlife vs Going Out clarification (added), Regulars day-of-week preservation (clarified).

**Business Strategy (business-strategist):** Core direction is right. "The right kind of product work: depth over breadth, finishing features that are half-built." Defer user interest picker (done). Artist Detail conditional on data (done). Validate restaurant dining + festival schedule data before committing (added as gates).

**Product Design (product-designer):** Stream view and lane view are strong (7-8/10). Find concept is correct information architecture. Arts lane is the strongest piece. Fixes needed: event card container treatment consistency (added), duplicate "See all" links (fixed), font tokens not hardcoded (specified), icon bg derived from accent (specified), touch target compliance (specified), outdoor card rating (added). "This looks like a product worth paying for."
