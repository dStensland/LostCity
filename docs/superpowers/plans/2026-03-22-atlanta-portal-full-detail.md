# Atlanta Portal Full Detail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Atlanta portal design system with all major page types — desktop + mobile for each.

**Architecture:** Extends existing Pencil design system (`docs/design-system.pen`) with 33 components. All new pages compose from existing component library using Atlanta theme (default).

**Tech Stack:** Pencil MCP (`batch_design`, `get_screenshot`)

---

## Task 1: Event Detail Page

The most important missing page. Shows a single event with full detail.

**Reference:** `web/app/events/[id]/page.tsx`, `web/components/detail/*.tsx`

**Layout (desktop 768px content, 1440px frame):**
- Header
- DetailHero (image mode — event poster/photo, gradient overlay)
- Quick info pills: category Badge + genre Badges
- DescriptionTeaser: pull-quote with accent left border, Quotes icon
- SocialProofStrip: "12 going" (coral) + "28 interested" (gold) pills
- InfoCard: "DETAILS" — MetadataGrid (Date & Time, Location, Price, Duration)
- InfoCard: "ABOUT" — event description paragraph
- InfoCard: "VENUE" — VenueCard instance linking to venue
- Related events: "MORE AT THIS VENUE" + EventCard list
- Related events: "SIMILAR EVENTS" + EventCard list
- DetailStickyBar: event title + "Get Tickets" / "RSVP" button
- Footer

**New component needed: DescriptionTeaser**
- Left accent border (3px, accent color)
- Quotes icon (top-left, muted)
- Pull-quote text: font-body, 15px, italic, cream
- Compact, editorial feel

**New component needed: SocialProofStrip**
- Horizontal layout: friend avatars + "12 going" pill (coral bg) + "28 interested" pill (gold bg)
- Pills: mono text, tiny, rounded-full

- [ ] Build DescriptionTeaser component (reusable)
- [ ] Build SocialProofStrip component (reusable)
- [ ] Compose Event Detail — Desktop (1440px)
- [ ] Compose Event Detail — Mobile (375px)
- [ ] Screenshot and verify

---

## Task 2: Series Detail Page

Recurring events (weekly trivia, open mics, etc.) have a different detail layout.

**Reference:** `web/app/series/[slug]/page.tsx`

**Layout:**
- Header
- DetailHero (poster mode — series artwork left, info right)
- Series info: name, venue, schedule ("Every Tuesday · 8pm"), category badges
- InfoCard: "SCHEDULE" — upcoming occurrences as a compact calendar-like list
  - Each row: date (Mon Mar 25), time (8:00 PM), status badge (TONIGHT / UPCOMING)
- InfoCard: "ABOUT" — series description
- InfoCard: "VENUE" — VenueCard
- "MORE REGULARS AT THIS VENUE" — EventCard list
- Footer

**New component needed: ScheduleRow**
- Horizontal: date text (mono, muted) + time text (display, cream) + status Badge
- Compact row for listing upcoming occurrences

- [ ] Build ScheduleRow component (reusable)
- [ ] Compose Series Detail — Desktop (1440px)
- [ ] Compose Series Detail — Mobile (375px)
- [ ] Screenshot and verify

---

## Task 3: Regulars Tab

The recurring events view — different from the main events timeline.

**Reference:** `web/components/regulars/*.tsx`

**Layout:**
- Header (What's On tab active)
- Sub-tabs: Events · **Regulars** · Showtimes (Regulars active)
- Day-of-week filter row: MON TUE WED THU FRI SAT SUN (FilterChip style, today highlighted)
- Activity filter chips: "All Activities", "Open Mic", "Trivia", "Live Music", "DJ Night", etc.
- List of recurring EventCards grouped by time-of-day:
  - "MORNING" section header
  - "AFTERNOON" section header
  - "EVENING" section header (most items here)
  - "LATE NIGHT" section header
- Footer

**New component needed: DayOfWeekFilter**
- 7-button horizontal row (MON-SUN)
- Each: compact square/rectangle with day abbreviation
- Active day: coral bg, void text
- Today indicator: dot below the day
- Shows event count per day

- [ ] Build DayOfWeekFilter component (reusable)
- [ ] Compose Regulars Tab — Desktop (1440px)
- [ ] Compose Regulars Tab — Mobile (375px)
- [ ] Screenshot and verify

---

## Task 4: Neighborhood Detail

Drill-in page from the neighborhoods directory.

**Reference:** `web/app/[portal]/neighborhoods/[slug]/page.tsx`

**Layout:**
- Header
- Neighborhood hero: name ("Midtown"), event/venue counts, maybe a map thumbnail
- Filter tabs: Events | Places (or combined view)
- Upcoming events in this neighborhood: EventCard list
- Popular venues in this neighborhood: VenueCard list
- Neighborhood stats: total venues, event density, top categories
- Adjacent neighborhoods: links to nearby neighborhoods
- Footer

- [ ] Compose Neighborhood Detail — Desktop (1440px)
- [ ] Compose Neighborhood Detail — Mobile (375px)
- [ ] Screenshot and verify

---

## Task 5: Search Results

Core interaction — full-text search with faceted results.

**Reference:** `web/components/search/*.tsx`

**Layout:**
- Header
- Search bar (prominent, full-width, with clear/submit)
- Active search: "live music" shown in search bar
- Result count: "47 results for 'live music'"
- Filter chips below: Category, Date, Price, Distance
- Results list: mixed EventCards and VenueCards
  - Each result shows relevance highlighting in title/description
  - Events and venues interleaved or tabbed
- "Load more" pagination
- Footer

- [ ] Compose Search Results — Desktop (1440px)
- [ ] Compose Search Results — Mobile (375px)
- [ ] Screenshot and verify

---

## Task 6: Calendar View

Alternative browse mode — month calendar with event dots.

**Reference:** `web/app/calendar/page.tsx`

**Layout:**
- Header
- Month navigation: ← March 2026 →
- Calendar grid: 7 columns (SUN-SAT), ~5 rows
  - Each day cell: number + colored dots indicating events (coral=featured, gold=tonight)
  - Today highlighted
  - Selected day: expanded to show events list below
- Below calendar: selected day's events as EventCard list
- Footer

**New component needed: CalendarGrid**
- 7x5 grid of day cells
- Day cell: number (mono), event dots, hover/selected state
- Month header with navigation arrows

**New component needed: CalendarDayCell**
- Number, up to 3-4 colored dots, today ring, selected fill

- [ ] Build CalendarGrid component (reusable)
- [ ] Build CalendarDayCell component (reusable)
- [ ] Compose Calendar View — Desktop (1440px)
- [ ] Compose Calendar View — Mobile (375px)
- [ ] Screenshot and verify

---

## Task 7: Map View

Spatial browse — venue pins on a map.

**Reference:** Places view with `display=map`

**Layout:**
- Header (Places tab active)
- Sub-tabs + filters (same as Places view)
- Split layout:
  - Left: VenueCard list (scrollable, ~400px wide)
  - Right: map area (fills remaining space) with pin markers
  - Selected pin highlights corresponding VenueCard
- Mobile: full-screen map with bottom sheet VenueCard drawer

**New component needed: MapPlaceholder**
- Rectangle representing the map area
- Scattered pin markers (small circles with category colors)
- "Map powered by Mapbox" attribution
- Stock map image or stylized placeholder

- [ ] Build MapPlaceholder component
- [ ] Compose Map View — Desktop (1440px, split layout)
- [ ] Compose Map View — Mobile (375px, full-screen map + drawer)
- [ ] Screenshot and verify

---

## Task 8: Profile Page

User identity — interests, regular spots, portal activity.

**Reference:** `web/app/profile/[username]/page.tsx`, `web/components/ProfileView.tsx`

**Layout:**
- Header (PlatformHeader, not portal nav)
- Profile hero: avatar (128px circle), display name, username, bio
- Stats row: "12 saved · 5 regular spots · 3 friends"
- Interests section: genre/category chips (from user preferences)
- Regular spots: horizontal scroll of small VenueCards (user's favorite venues)
- Recent activity: timeline of RSVPs, saves, check-ins
- Footer

- [ ] Compose Profile Page — Desktop (1440px)
- [ ] Compose Profile Page — Mobile (375px)
- [ ] Screenshot and verify

---

## Task 9: Saved / Bookmarks

Personal collection of saved events and venues.

**Reference:** `web/app/saved/page.tsx`

**Layout:**
- Header (PlatformHeader)
- Tab bar: Saved Events | Saved Venues
- Saved Events tab: EventCard list (with "saved" indicator)
- Saved Venues tab: VenueCard list
- Empty state: illustration + "Nothing saved yet" + "Explore events →" CTA
- Footer

- [ ] Compose Saved Page — Desktop (1440px)
- [ ] Compose Saved Page — Mobile (375px)
- [ ] Screenshot and verify

---

## Task 10: Community View

Social layer — groups, friends' activity.

**Reference:** `web/app/community/page.tsx`

**Layout:**
- Header (Your People tab active)
- Sub-tabs: Friends · Groups · Activity
- Friends tab: friend list with avatars, names, recent activity
- Groups tab: group cards (name, member count, last active)
- Activity tab: timeline of friends' RSVPs and check-ins
  - "Sarah is going to Atlanta Comedy Showcase tonight"
  - "Mike saved Sweetwater Creek State Park"
- Footer

- [ ] Compose Community View — Desktop (1440px)
- [ ] Compose Community View — Mobile (375px)
- [ ] Screenshot and verify

---

## Task 11: Update Rules + Commit

- [ ] Add all new component IDs to `web/.claude/rules/figma-design-system.md`
- [ ] Add all new page composition IDs to the Atlanta section
- [ ] Update memory file with final component count
- [ ] Commit: `git commit -m "docs: complete Atlanta portal design system — all pages"`
