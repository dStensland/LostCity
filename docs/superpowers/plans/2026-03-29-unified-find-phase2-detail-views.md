# Unified Find — Phase 2: Detail View Refreshes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh all entity detail views to surface the rich data from `place_profile`, `place_vertical_details`, and existing-but-unsurfaced fields (artist profiles, producer/org, significance).

**Architecture:** Modify existing detail view components to conditionally render vertical-specific sections based on `place_type` and available data. Each detail view refresh is independent and can be done in any order. The key pattern: use the new `placeProfile` and `placeVerticalDetails` fields added to `SpotDetailPayload` in Phase 0.

**Tech Stack:** Next.js 16, React, Tailwind v4, existing DetailShell layout

**Spec:** `docs/superpowers/specs/2026-03-29-unified-find-and-detail-redesign.md` — Section 4

**Depends on:** Phase 0 (data layer) must be complete — `placeProfile` and `placeVerticalDetails` must be in `SpotDetailPayload`.

---

### Task 1: Place Detail — Gallery hero + Google rating

**Files:**
- Modify: `web/components/views/PlaceDetailView.tsx` (hero section, identity block)
- Create: `web/components/detail/HeroGallery.tsx`

**What changes:**
- Replace single hero image with swipeable gallery using `gallery_urls` from `placeProfile`. Falls back to single `image_url` if no gallery.
- Add Google rating + review count from `placeVerticalDetails.google` to identity block (after name, before neighborhood).
- Lazy-load gallery images beyond first 2.

**Design reference:** Pencil frame `ETwWX` (Museum mobile), `qNEWf` (Restaurant mobile)

- [ ] **Step 1: Create HeroGallery component**

Accepts `images: string[]`, renders horizontal swipeable gallery with dot indicators. Uses IntersectionObserver for lazy loading. Falls back to single image or category-colored gradient.

- [ ] **Step 2: Wire gallery_urls and google rating into PlaceDetailView**

Read `placeProfile?.gallery_urls` and `placeVerticalDetails?.google?.rating` from the data payload. Render `HeroGallery` instead of `DetailHeroImage`. Add rating/review count badge to the identity block.

- [ ] **Step 3: Test with dev server**

Navigate to a museum venue with gallery data. Verify gallery swipes, dots update, lazy loading works. Verify Google rating renders.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(detail): add photo gallery hero + Google rating to PlaceDetailView"
```

---

### Task 2: Place Detail — Museum/Gallery variant sections

**Files:**
- Create: `web/components/detail/PlanYourVisitSection.tsx`
- Create: `web/components/detail/AccessibilitySection.tsx`
- Modify: `web/components/views/PlaceDetailView.tsx` (add sections conditionally)

**What changes:**
- "Plan Your Visit" section: admission/duration info cards, powered by `placeProfile` (planning_notes) and `placeVerticalDetails.google` (price_level).
- "Accessibility" section: wheelchair badge, family-friendly badge, age range, sensory notes, accessibility notes. Powered by `placeProfile` fields (wheelchair, family_suitability, age_min/max, sensory_notes, accessibility_notes).
- Verified date footer: "Last verified [date]" from `placeProfile.planning_last_verified_at`.
- These sections render ONLY for `isFeatureHeavyType` place types (museum, gallery, park, historic_site).

**Design reference:** Pencil frame `ETwWX` (Museum mobile)

- [ ] **Step 1–4: Build PlanYourVisitSection, AccessibilitySection, wire into PlaceDetailView conditionally**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(detail): add Plan Your Visit + Accessibility sections for museum/gallery places"
```

---

### Task 3: Place Detail — Restaurant/Dining variant sections

**Files:**
- Create: `web/components/detail/DiningDetailsSection.tsx`
- Modify: `web/components/views/PlaceDetailView.tsx`

**What changes:**
- "Dining Details" section: meal duration + reservation status cards, cuisine chips, service pills (dine-in/takeout/outdoor seating), dietary options (vegetarian/vegan/GF), menu highlights prose, capacity.
- All powered by `placeVerticalDetails.dining`.
- **Data gate:** Only render if `placeVerticalDetails?.dining` exists and has at least cuisine or accepts_reservations populated. Otherwise, fall back to standard layout.
- Quick actions adapts: "Reserve" button (primary, filled) replaces generic "Website" when `dining.reservation_url` exists. "Menu" button when `dining.menu_url` exists.

**Design reference:** Pencil frame `qNEWf` (Restaurant mobile)

- [ ] **Step 1–4: Build DiningDetailsSection, wire into PlaceDetailView conditionally**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(detail): add Dining Details section for restaurant places"
```

---

### Task 4: Event Detail — Rich artist profiles + producer

**Files:**
- Modify: `web/components/views/EventDetailView.tsx` (lineup section, add producer section)
- Create: `web/components/detail/RichArtistCard.tsx`
- Create: `web/components/detail/ProducerSection.tsx`
- Modify: `web/components/detail/LineupSection.tsx` (use RichArtistCard)

**What changes:**
- Lineup section: Replace current artist display with `RichArtistCard` showing circular photo, HEADLINER/SUPPORT badge, hometown, genre chips, Spotify/Instagram/website links. The data is already fetched by `getEventArtists()` — this is UI-only.
- New "Presented by" section below lineup: producer logo, name, tappable to org detail (`?org=`). Producer data is already in the API response.
- Rich venue context card: Replace the current thin location card with one showing hero image, name, Google rating, capacity, type, parking/transit. Requires `place_profile` join in the event detail API.
- Surface `significance` / `significance_signals` as a badge or highlight when present.

**Design reference:** Pencil frame `rT2N8` (Event Detail mobile)

- [ ] **Step 1–6: Build RichArtistCard, ProducerSection, update LineupSection, update venue card, wire significance**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(detail): add rich artist profiles, producer section, and enhanced venue context to EventDetailView"
```

---

### Task 5: Series Detail — Film showtimes refresh

**Files:**
- Modify: `web/components/views/SeriesDetailView.tsx`
- Create: `web/components/detail/ShowtimesTheaterCard.tsx`

**What changes:**
- Film metadata row: year, rating, runtime (already available in series data).
- "Watch Trailer" link using `series.trailer_url`.
- Festival parent link ("Part of [Festival Name]") — already linked but could be more prominent.
- Showtimes section: date pill strip (reuse existing pattern), theater cards with venue name + neighborhood + parking/transit info + tappable showtime chips. Requires batch-fetching `place_profile` for all showtime venues.

**Design reference:** Pencil frames `w6UtO` (mobile), `cYevy` (desktop)

- [ ] **Step 1–4: Build ShowtimesTheaterCard, update SeriesDetailView for film variant**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(detail): refresh film series detail with theater cards and venue transit info"
```

---

### Task 6: Festival Detail — Schedule grid + experience tags

**Files:**
- Modify: `web/components/views/FestivalDetailView.tsx`
- Create: `web/components/detail/FestivalScheduleGrid.tsx`
- Create: `web/components/detail/ExperienceTagStrip.tsx`

**What changes:**
- Experience tags strip: emoji + color-coded pills (Live Music, Outdoor, Craft Beer, etc.) from `festival.experience_tags`.
- Stats pills: stage count, artist count, age policy.
- Surface `audience`, `size_tier`, `indoor_outdoor`, `price_tier`.
- Schedule grid: day tab switcher, stage columns (desktop: parallel, mobile: stacked), color-coded stage dots, set rows with time + artist + HEADLINER badge + genre + hometown.
- **Data gate:** Only render schedule grid if festival has `programs` with `sessions`.

**Design reference:** Pencil frames `PrbnT` (mobile), `r0wy1` (desktop — 3-stage parallel grid)

- [ ] **Step 1–5: Build ExperienceTagStrip, FestivalScheduleGrid, update FestivalDetailView**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(detail): refresh festival detail with experience tags and multi-stage schedule grid"
```

---

### Task 7: Exhibition Detail — Rich refresh

**Files:**
- Modify: `web/app/[portal]/exhibitions/[slug]/page.tsx`

**What changes:**
- "Curated by" with linked curator name (from exhibition artists with role = curator).
- Closing countdown badge ("Closes in N days") when closing_date is within 30 days.
- Details grid: admission type, medium, works count (if available).
- Related events section: opening receptions and other events at the same venue around the exhibition dates.
- "Plan My Visit" CTA linking to the venue detail with the exhibition pre-selected.

**Design reference:** Pencil frames `eRiGG` (mobile), `vmXfY` (desktop)

- [ ] **Step 1–4: Add curator link, closing countdown, details grid, related events**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(detail): refresh exhibition detail with curator, closing countdown, and related events"
```

---

### Task 8: Artist Detail — NEW entity view (conditional)

**Gate:** Only proceed if Phase 0 Task 5 data audit showed 60%+ artist record completeness.

**Files:**
- Create: `web/components/views/ArtistDetailView.tsx`
- Create: `web/app/api/artists/[slug]/route.ts`
- Modify: `web/components/views/DetailViewRouter.tsx` (wire artist branch)

**What changes:**
- New API route fetching artist by slug with upcoming events in the portal's city.
- New detail view component with: hero image, ARTIST badge (magenta), name, hometown, genre chips, Spotify/Instagram/Website pill links, bio, "Upcoming in Atlanta" event cards.
- Wire into DetailViewRouter (the `?artist=` param was already added in Phase 1 Task 7).

**Design reference:** Pencil frames `gNP14` (mobile), `B844Q` (desktop)

- [ ] **Step 1–6: Build API route, ArtistDetailView, wire into DetailViewRouter**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(detail): add ArtistDetailView — new entity type with bio, genres, and upcoming shows"
```
