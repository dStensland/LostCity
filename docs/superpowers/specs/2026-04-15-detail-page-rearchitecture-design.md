# Detail Page Rearchitecture — Design Spec

**Date:** 2026-04-15
**Goal:** Replace 5 monolithic detail views (~4,200 LOC) with a composable, modular architecture that enables venue-type-specific templates and surfaces the interconnected data network
**Approach:** Type Shell + Section Slots with hybrid ordering (type-specific manifests + trait-based inclusion)

---

## 1. Architecture Overview

Three layers:

### Layer 1 — Section Modules (~50-150 lines each)
Self-contained, shared components. Each module renders one content block (showtimes, dining details, lineup, etc.). Sections don't know their position on the page — they receive data, render content, and nothing else. The layout handles headers, spacing, and dividers.

### Layer 2 — DetailLayout (shared)
Takes a hero config, identity zone (ReactNode), action config, and a section manifest. Renders the sidebar skeleton (hero → identity → actions) and runs the section pipeline: iterates the manifest, checks each section's trait function against the entity data, and renders matching sections with consistent `SectionWrapper` chrome.

### Layer 3 — Entity Orchestrators (~50-80 lines each)
Thin per-type files that compose DetailLayout. Each orchestrator defines:
- Hero config (aspect ratio, fallback mode, gallery support)
- Identity zone (ReactNode — the per-type sidebar content)
- Action config (primary CTA, secondary actions, sticky bar rules)
- Section manifest (ordered list of section IDs)

---

## 2. Section Module System

### 2.1 Section Module Interface

Every section module exports a `SectionModule` object:

```typescript
type SectionId =
  | 'about' | 'lineup' | 'showtimes' | 'dining' | 'exhibitions'
  | 'schedule' | 'upcomingDates' | 'eventsAtVenue' | 'features'
  | 'connections' | 'socialProof' | 'gettingThere' | 'nearby'
  | 'planYourVisit' | 'specials' | 'occasions' | 'accolades'
  | 'showSignals' | 'volunteer' | 'producer'

type EntityType = 'event' | 'place' | 'series' | 'festival' | 'org'

// Discriminated union — each variant wraps its API response type
type EntityData =
  | { entityType: 'event'; payload: EventApiResponse }
  | { entityType: 'place'; payload: SpotApiResponse }
  | { entityType: 'series'; payload: SeriesApiResponse }
  | { entityType: 'festival'; payload: FestivalResponse }
  | { entityType: 'org'; payload: OrgApiResponse }

interface SectionModule {
  id: SectionId                              // unique registry key
  component: React.FC<SectionProps>          // the section content
  trait: (data: EntityData) => boolean       // does the data support this section?
  label: string                              // "Now Playing", "On View", "Lineup"
  icon?: React.FC                            // Phosphor duotone icon for section header
  allowedEntityTypes: EntityType[]           // runtime guard — enforces the "never mounts" column
  getCount?: (data: EntityData) => number | null  // count badge for SectionHeader
}

interface SectionProps {
  data: EntityData                           // discriminated union — section narrows via entityType
  portalSlug: string
  accentColor: string                        // inherited from entity category
  entityType: EntityType
}
```

**Type safety:** The `EntityData` discriminated union enables narrowing inside sections via `if (data.entityType === 'event') { data.payload.event.venue... }`. The `allowedEntityTypes` field provides runtime enforcement — DetailLayout checks it before calling `trait()`, turning the matrix's "never mounts" column into enforced behavior. `SectionId` is a string literal union so manifest arrays get compile-time typo checking.

### 2.2 Section Registry

`web/components/detail/sections/index.ts` exports a `Map<SectionId, SectionModule>`. DetailLayout looks up modules by ID from the manifest.

### 2.3 Section Manifest

Each orchestrator declares an ordered `SectionId[]`. DetailLayout iterates this list, checks each section's `trait(data)`, and renders matching sections in order. Sections that fail their trait check are silently skipped.

```typescript
// Example: cinema manifest
const cinemaSections: SectionId[] = [
  'showtimes',      // type-priority: leads the page
  'about',
  'connections',
  'features',
  'planYourVisit',
  'nearby',
]
```

### 2.4 Hybrid Ordering

- **Type-specific ordering:** The manifest controls what position each section occupies. A cinema leads with showtimes. A restaurant leads with dining. A museum leads with exhibitions.
- **Trait-based inclusion:** Sections only render if their data supports it. If a cinema has no festival connections, `ConnectionsSection` silently drops out. During ATLFF, when the data has festival links, it appears automatically at its manifest position.

---

## 3. Section Inventory

### 3.1 Full Section List (20 modules)

| Section | ID | Trait | Label |
|---------|----|-------|-------|
| AboutSection | `about` | `hasDescription` | About |
| LineupSection | `lineup` | `hasArtists` | Lineup |
| ShowtimesSection | `showtimes` | `hasScreenings` | Now Playing / Showtimes |
| DiningSection | `dining` | `hasDiningProfile` | Dining |
| ExhibitionsSection | `exhibitions` | `hasExhibitions` | On View |
| ScheduleSection | `schedule` | `hasPrograms` | Schedule |
| UpcomingDatesSection | `upcomingDates` | `hasUpcomingEvents && isRecurring` | Upcoming Dates |
| EventsAtVenueSection | `eventsAtVenue` | `hasUpcomingEvents` (non-screening) | Upcoming Events |
| FeaturesSection | `features` | `hasFeatures` (attractions, not amenities) | What's Here |
| ConnectionsSection | `connections` | `hasConnections` | Connections |
| SocialProofSection | `socialProof` | `hasSocialData` | Who's Going |
| GettingThereSection | `gettingThere` | `hasLocation` | Getting There |
| NearbySection | `nearby` | `hasCoordinates` | Nearby |
| PlanYourVisitSection | `planYourVisit` | `hasAdmission || hasAccessibility` | Plan Your Visit |
| SpecialsSection | `specials` | `hasSpecials` | Specials |
| OccasionsSection | `occasions` | `hasOccasions` | Good For |
| AccoladesSection | `accolades` | `hasEditorialMentions` | In the Press |
| ShowSignalsSection | `showSignals` | `hasShowSignals` | Know Before You Go |
| VolunteerSection | `volunteer` | `hasVolunteerOpportunities` | Get Involved |
| ProducerSection | `producer` | `hasProducer` | Presented By |

### 3.2 Entity Type × Section Matrix

| Section | Event | Place | Series | Festival | Org |
|---------|-------|-------|--------|----------|-----|
| about | ● | ● | ● | ● | ● |
| lineup | ★ | — | — | — | — |
| showtimes | — | ★ cinema | ★ film | ● | — |
| dining | — | ★ restaurant | — | — | — |
| exhibitions | — | ★ museum | — | ● | — |
| schedule | — | — | — | ★ | — |
| upcomingDates | — | — | ★ non-film | — | — |
| eventsAtVenue | — | ● | — | — | ● |
| features | — | ★ park/zoo | — | — | — |
| connections | ● | ● | ● | ● | ● |
| socialProof | ● | ● | — | — | — |
| gettingThere | ● | ● | ● | ● | — |
| nearby | ● | ● | — | — | — |
| planYourVisit | — | ● | — | — | — |
| specials | — | ● | — | — | — |
| occasions | — | ● | — | — | — |
| accolades | — | ● | — | — | — |
| showSignals | ● | — | — | — | — |
| volunteer | — | — | — | — | ★ |
| producer | ● | — | — | ● | — |

**Legend:** ★ = type-priority (leads content for this type), ● = trait-included (renders if data exists), — = never mounts

### 3.3 Event Manifest

1. `about`
2. `lineup` (type-priority for music/comedy/theater)
3. `showSignals`
4. `connections`
5. `socialProof`
6. `gettingThere`
7. `producer`
8. `nearby`

### 3.4 Place Subtype Manifests

Place manifests are resolved via `getPlaceManifest(placeType: string)`. The mapping from `spot_type` DB values to manifest groups:

| Manifest | spot_type values |
|----------|-----------------|
| Cinema | `movie_theater`, `cinema`, `drive_in_theater` |
| Restaurant | `restaurant`, `cafe`, `bakery`, `food_hall`, `food_truck` |
| Museum / Gallery | `museum`, `gallery`, `arts_center`, `historic_site`, `science_center` |
| Bar / Nightclub | `bar`, `nightclub`, `lounge`, `sports_bar`, `wine_bar`, `brewery`, `distillery` |
| Park / Garden | `park`, `garden`, `nature_preserve`, `recreation`, `trail` |
| Music Venue | `music_venue`, `amphitheater`, `stadium`, `theater`, `event_space` |
| Default | All other types — uses the Music Venue manifest as fallback |

**Cinema:**
1. `showtimes` (type-priority)
2. `about`
3. `connections`
4. `eventsAtVenue`
5. `features`
6. `planYourVisit`
7. `nearby`

**Restaurant:**
1. `dining` (type-priority)
2. `about`
3. `occasions`
4. `specials`
5. `eventsAtVenue`
6. `accolades`
7. `connections`
8. `nearby`

**Museum / Gallery:**
1. `exhibitions` (type-priority)
2. `about`
3. `features`
4. `planYourVisit`
5. `eventsAtVenue`
6. `socialProof`
7. `accolades`
8. `connections`
9. `nearby`

**Bar / Nightclub:**
1. `eventsAtVenue` (type-priority)
2. `about`
3. `occasions`
4. `specials`
5. `accolades`
6. `connections`
7. `nearby`

**Park / Garden:**
1. `features` (type-priority)
2. `about`
3. `eventsAtVenue`
4. `planYourVisit`
5. `accolades`
6. `connections`
7. `nearby`

**Music Venue:**
1. `eventsAtVenue` (type-priority)
2. `about`
3. `occasions`
4. `specials`
5. `features`
6. `connections`
7. `nearby`

### 3.5 Series Manifests

**Film series** (`getSeriesManifest(isFilm: true)`):
1. `showtimes` (type-priority)
2. `about`
3. `connections`
4. `gettingThere`

**Non-film recurring series** (`getSeriesManifest(isFilm: false)`):
1. `upcomingDates` (type-priority)
2. `about`
3. `connections`
4. `gettingThere`

### 3.6 Festival Manifest

1. `schedule` (type-priority)
2. `about`
3. `showtimes`
4. `exhibitions`
5. `connections`
6. `gettingThere`
7. `producer`

### 3.7 Org Manifest

1. `about`
2. `volunteer` (type-priority)
3. `eventsAtVenue`
4. `connections`

---

## 4. ConnectionsSection — Data Graph Hub

### 4.1 Purpose

Every entity is a node in LostCity's data graph. ConnectionsSection reveals the edges — making each detail page a gateway to deeper exploration. This is the key differentiator: LostCity doesn't just list things, it shows how everything connects.

### 4.2 Connection Types & Resolvers

Five per-type resolver functions in `web/lib/detail/connections.ts`, each returning `ConnectionRow[]`:

```typescript
resolveEventConnections(data: EventApiResponse): ConnectionRow[]
resolvePlaceConnections(data: SpotApiResponse): ConnectionRow[]
resolveSeriesConnections(data: SeriesApiResponse): ConnectionRow[]
resolveFestivalConnections(data: FestivalResponse): ConnectionRow[]
resolveOrgConnections(data: OrgApiResponse): ConnectionRow[]
```

The orchestrator calls the right resolver based on entity type. The `ConnectionRow` output type is shared — this is the adapter pattern (different inputs, common output).

**Connection types by entity:**
- **Event:** venue link, tour/series, festival (via series), producer, friends going
- **Place:** operating org, active festival screenings, recurring series at this venue, nearby pre-show spots
- **Series:** parent festival, screening theaters, director's other films
- **Festival:** presenting org, festival venues, film count, friends attending
- **Org:** venues they operate, festivals they present

**Dependency:** ATLFF `festival_id` linkage must be wired in the crawler before ConnectionsSection can surface festival connections. This is a P0 crawler fix independent of this rearchitecture.

### 4.3 Connection Row Design

Each connection renders as a tappable row:
- 36px icon thumbnail (entity type icon or image) in `bg-[var(--twilight)]` rounded-lg
- Entity name in `text-sm font-medium text-[var(--cream)]`
- Context line in `text-xs text-[var(--muted)]` — relationship-first, not quantity-first. Lead with *why this connection matters now*: "hosting 3 ATLFF screenings this week", "Official Selection", "2 friends attending". Fall back to counts ("14 upcoming events") only when no temporal or social signal exists
- Arrow indicator on the right

**Accent treatment:**
- Festival connections: gold border + `bg-[var(--gold)]/5` background (time-sensitive, promotional)
- Social connections: coral border + friend avatar stack instead of icon thumbnail
- All other connections: standard `bg-[var(--night)]` treatment

### 4.4 Per-Entity Connection Examples

**Event** (concert): venue link, tour/series, promoter, friends going
**Place** (cinema during ATLFF): active festival with gold accent, operating org, recurring series here, nearby pre-show spots
**Series** (film): parent festival, screening theaters, director's other films
**Festival**: presenting org, festival venues, film count, friends attending
**Org**: venues they operate, festivals they present, upcoming events

---

## 5. Sidebar Architecture

### 5.1 Shared Sidebar Structure

Every detail page sidebar has three zones, rendered by DetailLayout:

1. **HeroZone** — configured via `HeroConfig` (aspect ratio, fallback mode, gallery support)
2. **IdentityZone** — a ReactNode slot, filled by per-type identity components
3. **ActionZone** — configured via `ActionConfig` (primary CTA, secondary action buttons)

### 5.2 Mobile Layout

On mobile, the sidebar stacks above content. Without intervention, hero (~211px) + identity zone (~200px) + actions (~80px) = ~500px of chrome before the first content section. This defeats the purpose of type-priority manifests.

**Mobile-specific behavior in DetailLayout:**

1. **Compact identity strip on mobile:** On `< lg`, the identity zone renders a compact variant: title + one-line metadata (venue, date/time or type/neighborhood) + primary CTA button inline. Genre pills, taxonomy badges, show signals, hours summary, and quick action grids collapse behind a "More details" expandable. This gets the first content section visible by ~280px scroll.

2. **Film poster height constraint:** Series (film) hero uses `max-h-[280px] object-cover` on mobile instead of the full 2:3 aspect ratio (which would be 563px on a 375px viewport). Desktop keeps the full portrait poster. Tap to expand to full poster.

3. **Sticky identity bar:** After scrolling past the identity zone, a slim sticky bar locks at the top: entity name + primary CTA. `h-[48px] bg-[var(--night)] border-b border-[var(--twilight)]`. Appears on scroll > identity zone bottom edge.

Each identity component (`EventIdentity.tsx`, etc.) must export both a full and compact variant, or accept a `compact: boolean` prop. DetailLayout switches based on viewport.

### 5.3 Hero Config

```typescript
interface HeroConfig {
  aspectClass: string            // "aspect-video lg:aspect-[16/10]", "aspect-[2/3]", etc.
  fallbackMode: 'category-icon' | 'type-icon' | 'logo' | 'banner'
  galleryEnabled: boolean        // multi-image support
  overlaySlot?: ReactNode        // live badge, source attribution
}
```

Per-type defaults:
- **Event:** aspect 16/10, category-icon fallback, no gallery
- **Place:** aspect 16/10, type-icon fallback, gallery enabled
- **Series (film):** aspect 2/3 (poster) on desktop, `max-h-[280px] object-cover` on mobile, category-icon fallback, no gallery
- **Series (non-film):** aspect 16/10, banner fallback (h-[120px] with type color + icon), no gallery
- **Festival:** fixed h-[240px], gradient overlay, no gallery
- **Org:** logo mode (small centered), no gallery

### 5.4 Identity Zones (per-type)

Each identity component is a standalone file in `web/components/detail/identity/`. Each exports both a full variant (desktop) and a compact variant (mobile — see 5.2).

**EventIdentity:** Title, venue link + address inline, date + time + price, genre pills, taxonomy badges (cost_tier, duration, indoor_outdoor, booking_required), show signals (doors, age, reentry). *Compact:* Title, venue + date/time, price.

**PlaceIdentity:** Name, type badge with category color, neighborhood, price level + rating, quick actions grid (reserve/website, menu, phone, directions), hours summary. *Compact:* Name, type, neighborhood.

**SeriesIdentity:** Title, type badge (Film/Recurring), recurrence label, venue link, film metadata (year, rating, runtime), director + trailer (film only), genre pills. *Compact:* Title, type, next date.

**FestivalIdentity:** Name, type badge, date range, location, temporal status banner (states: upcoming/happening-first/happening-mid/happening-last/ended — each with distinct color), experience tags, price/duration metadata. *Compact:* Name, date range, status.

**OrgIdentity:** Logo, name, org type, location, primary activity summary (next event or "Presents N+ events annually"), category tags, links (website, Instagram, email). *Compact:* Logo, name, type.

### 5.5 DetailIdentity Wrapper

`web/components/detail/core/DetailIdentity.tsx` wraps the identity ReactNode with consistent sidebar chrome:
- Padding: `px-5 py-4`
- Bottom divider: `border-b border-[var(--twilight)]/40`
- Handles the full/compact switch based on viewport (`useMediaQuery` or Tailwind responsive)

Individual identity components do NOT manage their own padding or dividers.

### 5.6 Action Config

```typescript
interface ActionConfig {
  primaryCTA: {
    label: string                // "Get Tickets", "Reserve", "Get Showtimes"
    href?: string
    onClick?: () => void
    variant: 'filled' | 'outlined'
  } | null
  secondaryActions: ActionButton[]  // Save, Share, Invite, Calendar, Follow, etc.
  stickyBar: {
    enabled: boolean
    scrollThreshold?: number      // default 300px
  }
}
```

Per-type defaults:

| Type | Primary CTA | Secondaries | Sticky Bar |
|------|------------|-------------|------------|
| Event | Get Tickets / RSVP | Save, Invite, Calendar, Share | Yes (if ticket_url) |
| Place | Reserve / Website / Directions | Save, Follow, Share | Yes (if reservation_url) |
| Series | Get Showtimes / Next Date | Save, Share | Yes (if ticket_url) |
| Festival | Get Passes / Website | Save, Share, Calendar | Yes (temporal CTA) |
| Org | Follow / Website | Recommend, Share | No |

---

## 6. Core Infrastructure

### 6.1 DetailLayout Component

`web/components/detail/core/DetailLayout.tsx`

Takes:
- `heroConfig: HeroConfig`
- `identity: ReactNode`
- `actionConfig: ActionConfig`
- `manifest: SectionId[]`
- `data: EntityData`
- `portalSlug: string`
- `accentColor: string`
- `entityType: EntityType`
- `onClose?: () => void`

Renders DetailShell (kept as-is) with:
- **topBar:** NeonBackButton + share/save icons
- **sidebar:** HeroZone (via DetailHero) → IdentityZone (identity prop) → ActionZone (via DetailActions)
- **content:** manifest.filter(id => registry.get(id).trait(data)).map(id => <SectionWrapper><Section /></SectionWrapper>)
- **bottomBar:** DetailStickyBar (conditional on actionConfig.stickyBar.enabled)

### 6.2 SectionWrapper

Wraps each section with:
- `SectionHeader` (mono label + count badge + Phosphor icon)
- Consistent padding: `px-4 lg:px-8` content, `py-5` vertical
- Top border divider: `border-t border-[var(--twilight)]`

Sections never render their own headers or manage their own spacing.

### 6.3 DetailHero

Unified hero component replacing both `DetailHeroImage` and `HeroGallery`:
- **Image mode:** single image with skeleton loading + brightness adjustment
- **Gallery mode:** multi-image carousel with prev/next, dot indicators with backdrop pill
- **Poster mode:** 2:3 aspect ratio for film series
- **Logo mode:** small centered logo for orgs
- **Fallback mode:** gradient background + category/type icon at 35% opacity + label text

All modes support: live ring overlay, custom overlay slot, configurable aspect ratio.

### 6.4 Unified Data Hook

`web/lib/detail/use-detail-data.ts`

```typescript
function useDetailData<T extends EntityData>(config: {
  entityType: EntityType
  identifier: string | number
  portalSlug: string
  initialData?: T
}): { data: T | null, status: 'loading' | 'ready' | 'error', error: Error | null }
```

- If `initialData` provided (SSR), skips fetch
- Otherwise fetches from `/api/{entityType}/{identifier}`
- Shared retry logic, cancellation, error handling
- API routes unchanged — no backend modifications needed

### 6.5 Shared Formatters

`web/lib/detail/format.ts` — extracted from inline logic currently scattered across views:
- `formatEventTime(isAllDay, startTime, endTime)` → display string
- `formatPriceRange(isFree, priceMin, priceMax)` → display string
- `formatDateRange(start, end)` → display string
- `formatRecurrence(frequency, dayOfWeek)` → display string
- `formatDuration(minutes)` → display string or null (no fabricated defaults)

### 6.6 Trait Functions

`web/lib/detail/traits.ts` — centralized data presence checks. Each trait receives the full `EntityData` discriminated union and narrows internally:
- `hasDescription(data)`, `hasArtists(data)`, `hasScreenings(data)`, `hasDiningProfile(data)`, `hasExhibitions(data)`, `hasPrograms(data)`, `hasUpcomingEvents(data)`, `hasFeatures(data)`, `hasConnections(data)`, `hasSocialData(data)`, `hasLocation(data)`, `hasCoordinates(data)`, `hasAdmission(data)`, `hasAccessibility(data)`, `hasSpecials(data)`, `hasOccasions(data)`, `hasEditorialMentions(data)`, `hasShowSignals(data)`, `hasVolunteerOpportunities(data)`, `hasProducer(data)`

Traits evaluate at the orchestrator level before props are passed to sections. This ensures compound traits (e.g., `hasUpcomingEvents && isRecurring` for UpcomingDatesSection) have access to the full API response.

### 6.7 Accent Color Plumbing

DetailLayout renders a single `<ScopedStyles>` element that sets `--detail-accent` from the `accentColor` prop (derived from `getCategoryColor()` in the orchestrator). Sections use `text-[var(--detail-accent)]` and `bg-[var(--detail-accent)]/10` etc. No section renders its own ScopedStyles.

For multi-accent scenarios (e.g., an event with both a category color and a festival color), DetailLayout sets:
- `--detail-accent` — primary accent (category color)
- `--detail-accent-secondary` — secondary accent (series/festival color, if present)

The orchestrator derives both from its entity data and passes them to DetailLayout.

### 6.8 Loading & Error States

**Loading:** DetailLayout renders a per-type skeleton when `status === 'loading'`. The skeleton matches the expected layout structure:
- Sidebar: hero skeleton (matching aspect ratio from heroConfig) + identity skeleton (3-4 shimmer lines) + action skeleton (button placeholders)
- Content: 2-3 section skeletons with SectionHeader shimmer + content placeholders

The skeleton is driven by `entityType` — a place skeleton shows a quick-actions grid placeholder, an event skeleton shows a lineup placeholder. Each orchestrator can optionally provide a `skeletonHint` to customize the content skeleton count/shapes.

**Error:** DetailLayout renders a centered error state via DetailShell's `singleColumn` mode: Phosphor `Warning` icon at 48px, heading "Something went wrong", retry button. Consistent across all entity types.

### 6.9 SocialProof vs Connections Boundary

These sections have distinct purposes and do not overlap:
- **SocialProofSection** — detailed attendance view: friend avatars with names, "N people going" count, "Who's Going" tab. Renders on events and places. This is the full social detail.
- **ConnectionsSection** — entity-level graph links: "3 friends going" as a single connection row with avatar stack. This is the summary signal pointing to the social layer.

When both sections render on the same page (e.g., an event), ConnectionsSection shows the friend count as a tappable row. SocialProofSection shows the full list with names. No duplication — one is a summary link, the other is the detail.

For logged-out users, SocialProofSection shows aggregate count only ("12 people going") without friend names. ConnectionsSection omits the social row entirely for logged-out users.

### 6.10 Empty / Thin State Handling

When fewer than 3 sections pass their trait checks, the page risks feeling empty. DetailLayout handles this:

1. If 0 content sections render: show a single centered block — category/type icon at 48px opacity 0.2, "We're still learning about this place" in `text-base font-semibold text-[var(--cream)]`, "Check back soon — or help us out by suggesting details" in `text-sm text-[var(--muted)]`. Plus a `NearbySection` injected as fallback content if coordinates exist.

2. If 1-2 content sections render: render normally but inject `NearbySection` and/or `ConnectionsSection` at the end if not already in the manifest and the traits pass. This fills the page with discovery content.

The thin state is a data quality signal, not a design failure. The page should feel honest ("we're building this out") not broken.

---

## 7. File Structure

```
web/components/detail/
├── core/
│   ├── DetailLayout.tsx          — sidebar skeleton + section pipeline
│   ├── DetailHero.tsx            — unified hero (image, gallery, poster, logo, fallback)
│   ├── DetailIdentity.tsx        — sidebar identity wrapper (padding, dividers, full/compact switch)
│   ├── DetailActions.tsx         — action zone (primary CTA + secondaries)
│   ├── DetailStickyBar.tsx       — mobile sticky bar (cleaned up from existing)
│   ├── SectionWrapper.tsx        — wraps each section with SectionHeader + spacing
│   └── SectionHeader.tsx         — mono label + count badge (single variant)
│
├── sections/
│   ├── AboutSection.tsx
│   ├── LineupSection.tsx
│   ├── ShowtimesSection.tsx
│   ├── DiningSection.tsx
│   ├── ExhibitionsSection.tsx
│   ├── ScheduleSection.tsx
│   ├── UpcomingDatesSection.tsx
│   ├── EventsAtVenueSection.tsx
│   ├── FeaturesSection.tsx
│   ├── ConnectionsSection.tsx
│   ├── SocialProofSection.tsx
│   ├── GettingThereSection.tsx
│   ├── NearbySection.tsx
│   ├── PlanYourVisitSection.tsx
│   ├── SpecialsSection.tsx
│   ├── OccasionsSection.tsx
│   ├── AccoladesSection.tsx
│   ├── ShowSignalsSection.tsx
│   ├── VolunteerSection.tsx
│   ├── ProducerSection.tsx
│   └── index.ts                  — section registry (SectionId → SectionModule)
│
├── manifests/
│   ├── event.ts                  — event section order
│   ├── place.ts                  — getPlaceManifest(placeType) → SectionId[] by subtype
│   ├── series.ts                 — getSeriesManifest(isFilm) → SectionId[]
│   ├── festival.ts               — festival section order
│   └── org.ts                    — org section order
│
├── identity/
│   ├── EventIdentity.tsx
│   ├── PlaceIdentity.tsx
│   ├── SeriesIdentity.tsx
│   ├── FestivalIdentity.tsx
│   └── OrgIdentity.tsx
│
├── (kept existing)
│   ├── DetailShell.tsx           — kept as-is, wrapped by DetailLayout
│   ├── RichArtistCard.tsx        — used by LineupSection
│   ├── ShowtimesTheaterCard.tsx  — used by ShowtimesSection
│   ├── NeonBackButton.tsx        — used by DetailLayout top bar
│   ├── ExperienceTagStrip.tsx    — used by FestivalIdentity
│   ├── CollapsibleSection.tsx    — general utility
│   └── QuickActionLink.tsx       — used by PlaceIdentity

web/components/views/               (rewritten — thin orchestrators)
├── EventDetailView.tsx             — ~60 lines
├── PlaceDetailView.tsx             — ~80 lines
├── SeriesDetailView.tsx            — ~60 lines
├── FestivalDetailView.tsx          — ~60 lines
└── OrgDetailView.tsx               — ~50 lines

web/lib/detail/                     (new — unified data layer)
├── types.ts                        — EntityData discriminated union, SectionId literal union, configs
├── traits.ts                       — trait functions (operate on EntityData union)
├── connections.ts                  — per-type resolvers + shared ConnectionRow type
├── use-detail-data.ts              — unified data hook
└── format.ts                       — shared formatters
```

### 7.1 Deleted Files

| File | Reason |
|------|--------|
| `detail/RelatedCard.tsx` | Never imported |
| `detail/RelatedSection.tsx` | Never imported |
| `detail/PlaceEventsSection.tsx` | Never imported |
| `detail/DescriptionTeaser.tsx` | Never used |
| `detail/SocialProofStrip.tsx` | Reimplemented inline; replaced by SocialProofSection |
| `detail/MetadataGrid.tsx` | Never exported |
| `detail/DetailHero.tsx` | Superseded by new DetailHero in core/ |
| `detail/InfoCard.tsx` | Org-only; absorbed into OrgIdentity |
| `detail/DetailHeroImage.tsx` | Superseded by new DetailHero in core/ |
| `detail/DiningDetailsSection.tsx` | Superseded by sections/DiningSection |
| `detail/PlaceFeaturesSection.tsx` | Superseded by sections/FeaturesSection |
| `detail/PlaceSpecialsSection.tsx` | Superseded by sections/SpecialsSection |
| `detail/AccessibilitySection.tsx` | Absorbed into PlanYourVisitSection |
| `detail/PlaceScreeningsSection.tsx` | Superseded by sections/ShowtimesSection |
| `detail/FestivalScheduleGrid.tsx` | Absorbed into sections/ScheduleSection |
| `detail/AroundHereSection.tsx` | Superseded by sections/NearbySection |
| `detail/DogNearbySection.tsx` | Absorbed into NearbySection (portal-aware) |
| `detail/AccoladesSection.tsx` | Superseded by sections/AccoladesSection |
| `detail/HeroGallery.tsx` | Absorbed into new DetailHero gallery mode |
| `detail/PlanYourVisitSection.tsx` | Superseded by sections/PlanYourVisitSection |
| `detail/ProducerSection.tsx` | Superseded by sections/ProducerSection |
| `detail/SectionHeader.tsx` | Superseded by core/SectionHeader (single variant) |
| `detail/YonderAdventureSnapshot.tsx` | Absorbed into FeaturesSection |

---

## 8. Design System Compliance

All new components follow the design system tokens from `web/CLAUDE.md`:

**Surfaces:** `--void`, `--night`, `--dusk`, `--twilight` only. No `backdrop-blur` (cinematic minimalism: `glass_enabled: false`).

**Text:** `--cream` (primary), `--soft` (secondary), `--muted` (tertiary) only. No hardcoded hex colors.

**Accents:** `--coral` (CTA), `--gold` (featured/dates), `--neon-green` (success/free). Category colors via `getCategoryColor()`.

**Typography:** `font-mono text-xs uppercase tracking-[0.14em]` for section headers. `text-sm` (13px) minimum for body. `text-2xs` (10px) for monospace status indicators only.

**Icons:** Phosphor `duotone` weight exclusively. No inline SVGs.

**Touch targets:** `min-h-[44px]` on all interactive elements.

**Animation:** `transition-colors duration-300` for color. `duration-200` for opacity. `ease-out` entrances, `ease-in` exits.

**Cards:** `bg-[var(--night)] rounded-xl border border-[var(--twilight)]`. No `font-serif`. No `backdrop-blur`.

---

## 9. Pencil Design Comp Plan

Full-page comps for web (desktop) and mobile before any code is written.

### 9.1 Comp List

| # | Page | Key Sections | Web | Mobile |
|---|------|-------------|-----|--------|
| 1 | Event — Concert | Lineup, social proof, show signals, connections | ● | ● |
| 2 | Event — Festival Screening | ATLFF connection, festival badge, no lineup | ● | ● |
| 3 | Event — Minimal (no image) | Fallback hero, connections only | — | ● |
| 4 | Place — Cinema | Showtimes lead, ATLFF connection, nearby food | ● | ● |
| 5 | Place — Restaurant | Dining leads, occasions, specials, reservation CTA | ● | ● |
| 6 | Place — Museum / Gallery | Exhibitions lead, features, plan your visit, gallery hero | ● | ● |
| 7 | Place — Bar / Music Venue | Events lead, occasions, specials, connections | ● | ● |
| 8 | Place — Park / Outdoor | Features lead, plan your visit, events | — | ● |
| 9 | Series — Film | Poster hero, showtimes by theater, festival connection, director | ● | ● |
| 10 | Series — Recurring | Upcoming dates, venue link, banner fallback hero | ● | ● |
| 11 | Festival — Multi-day (ATLFF) | Schedule grid, day tabs, screenings, temporal banner, connections | ● | ● |
| 12 | Org — Producer | Logo hero, events, volunteer, connection graph | ● | ● |
| 13 | Place — Thin State | Only about + gettingThere, fallback content injection | ● | ● |
| 14 | Event — Minimal (no image, desktop) | Fallback hero at desktop proportions | ● | — |

**Total: 14 page types × ~2 breakpoints = ~24 comps**

### 9.2 Design Process

**Phase 1 — Design:**
1. Establish design system tokens and spacing grid in Pencil
2. Design section modules as reusable component blocks
3. Design the SectionWrapper chrome (header, spacing, divider)
4. Design sidebar identity zones per entity type
5. Compose into full-page comps per entity type (web + mobile)
6. Review and iterate until approved

**Phase 2 — Build:**
1. Core infrastructure (DetailLayout, types, traits, registry)
2. Section modules (matching Pencil comps)
3. Identity zones (per entity type)
4. Orchestrators (wire everything together)
5. Delete old monoliths + dead code
6. Fix all existing launch-readiness spec items within new architecture

---

## 10. Launch Readiness Integration

The original launch readiness spec (2026-04-15-atlanta-launch-readiness-design.md) workstream B items are resolved by this rearchitecture:

| Spec Item | Resolution |
|-----------|-----------|
| 2.1 Mobile back button | DetailLayout top bar includes NeonBackButton on all pages |
| 2.2 Hero image fallback | DetailHero fallback mode: category icon at 35% + color tint + label |
| 2.3 Amenity/attraction filter | FeaturesSection filters to attractions; amenities render as text in PlanYourVisitSection |
| 2.4 Film poster aspect ratio | SeriesDetail heroConfig uses aspect-[2/3] when isFilm |
| 2.5 Dual Plan Your Visit | Single PlanYourVisitSection consolidates both data sources; no fabricated duration |
| 2.6 Location buried | GettingThereSection shared; EventIdentity includes address inline below venue name |
| 2.7 Recurring series visual identity | SeriesDetail heroConfig uses banner fallback (h-[120px] + type color + icon) |
| 2.8 ShowtimesTheaterCard URL | ShowtimesSection uses buildSpotUrl(..., 'page') |
| 2.9 Design system violations | All new sections use CSS vars only. No hardcoded hex. |
| 2.10 Sidebar info density | EventIdentity collapses taxonomy badges into genre pills row |
| 5.4 Add to Plan | DetailActions includes "Add to Plan" in secondary actions for events |
| 5.6 RSVP idle state | DetailActions renders RSVPButton with chevron indicator in idle state |

---

## 11. Data Fetching

### 11.1 Unified Hook

All orchestrators use `useDetailData<T>()` from `web/lib/detail/use-detail-data.ts`. The hook wraps the existing `useDetailFetch` pattern with a standard interface.

### 11.2 API Routes (unchanged)

No backend modifications. Existing API routes continue to serve data:
- `/api/events/[id]?portal_id={id}` → EventData
- `/api/places/by-slug/[slug]` → PlaceData
- `/api/series/by-slug/[slug]` → SeriesData
- `/api/festivals/by-slug/[slug]` → FestivalData
- `/api/producers/by-slug/[slug]` → OrgData

### 11.3 Server-Side Rendering

Event and Series pages have existing server-render routes that pass `initialData`. This pattern is preserved — orchestrators pass `initialData` to `useDetailData`, which skips the client fetch when SSR data is available.

---

## 12. Routing (unchanged)

DetailOverlayRouter continues to dispatch based on URL query params. The orchestrators maintain the same props interface (`slug/id`, `portalSlug`, `onClose`, `initialData`). No routing changes needed.
