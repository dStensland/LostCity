# Dog Portal UX Design Document
**ROMP (`/atl-dogs`) - Detailed UX Specifications**

**Date:** 2026-02-14  
**Status:** Design locked for implementation  
**Designer:** Product Designer Agent

---

## Executive Summary

This document translates the PRD and design direction into specific UX decisions for the ROMP dog portal. The design prioritizes:

1. **Mobile-first discovery** - Most dog owners are out and about, checking their phone while at the park
2. **Shallow navigation hierarchy** - Deep pages are real routes for shareability and SEO
3. **Progressive disclosure** - Feed previews sections, deep pages show full data
4. **Community contribution friction** - Tag submission is easy enough to encourage usage, structured enough to maintain quality
5. **AllTrails-level utility** - Not just a list, but a genuinely useful tool

**Core principle:** Every deep page must answer "Can I go here with my dog RIGHT NOW?" with clarity and speed.

---

## 1. Navigation & Routing Architecture

### Decision: Real Next.js Routes (Not URL Params)

**Rationale:**
- Shareability: `/atl-dogs/parks` is clearer than `/atl-dogs?view=parks`
- SEO: Google indexes deep pages as distinct entities
- Browser back button behaves predictably
- Deep linking from external sources (social, email) works cleanly
- Follows existing LostCity pattern (see `/[portal]/events/[id]`, `/[portal]/spots/[slug]`)

### Route Structure

```
/atl-dogs                           → Portal home (feed)
/atl-dogs/parks                     → Parks & Trails hub
/atl-dogs/pup-cups                  → Pup cup directory
/atl-dogs/adopt                     → Adoption hub
/atl-dogs/training                  → Training classes
/atl-dogs/services                  → Vet & services directory
/atl-dogs/events/[id]               → Event detail (existing pattern)
/atl-dogs/spots/[slug]              → Venue detail (existing pattern)
```

**Implementation notes:**
- Create new route files: `app/[portal]/parks/page.tsx`, etc.
- Portal detection: Use `isDogPortal(portalSlug)` gate — only render dog-specific routes for `atl-dogs`
- For other portals, 404 these routes
- All routes get `revalidate = 60` for stale-while-revalidate caching

### Header Nav Evolution

**Desktop (pill nav):**
- Keep 3 tabs: **Explore** | **Map** | **Saved**
- Deep pages show back arrow in header, no nav pills (see `PortalHeader` with `hideNav` prop)
- Consistent with existing event/venue detail pattern

**Mobile (bottom nav):**
- Keep existing 3-tab bottom nav: **Explore** | **Map** | **Saved**
- Bottom nav persists on ALL pages within portal (including deep pages)
- Active state logic:
  - `/atl-dogs` → Explore active
  - `/atl-dogs/parks`, `/atl-dogs/pup-cups`, etc. → Explore active (user is still "exploring")
  - `/atl-dogs?view=find` → Map active
  - `/atl-dogs?view=community` → Saved active

**Why not add a 4th tab?** 
Mobile bottom nav real estate is precious. Testing shows 3 tabs is optimal for thumb reach. Deep pages are discoverable via feed sections → users don't need direct nav access to every page.

### Header on Deep Pages

```tsx
// Example: /atl-dogs/parks
<DogHeader portalSlug={portalSlug} activeTab="feed" showBackButton />
```

- Logo → left, tappable, returns to `/atl-dogs`
- Desktop: Back arrow + "Parks" breadcrumb → no nav pills
- Mobile: Same, bottom nav persists with "Explore" active

---

## 2. Feed Section Hierarchy

**Goal:** Prioritize by user intent, not data volume. Show 3-4 sections on initial viewport, rest on scroll.

### Section Priority Ranking (Top to Bottom)

| Rank | Section | Display | Rationale |
|------|---------|---------|-----------|
| 1 | **Hero** | Always visible | Portal identity, sets tone |
| 2 | **This Weekend** | Always visible, 4-6 cards | Highest intent: planning weekend activities |
| 3 | **Off-Leash Parks** | Always visible, horizontal scroll | #1 search query for new dog owners |
| 4 | **Pup Cup Spots** | Always visible, horizontal scroll | Fun, shareable, drives engagement |
| 5 | **Patios Near You** | Conditional (geolocation), 4-6 rows | Immediate utility, location-aware |
| 6 | **Adopt** | Always visible, 3-4 cards | High emotional value, low volume OK |
| 7 | **Training & Classes** | Conditional (if data exists), 3 cards | Seasonal, not always relevant |
| 8 | **Services Near You** | Conditional (geolocation), 4-6 rows | Utility, but not time-sensitive |
| 9 | **Trails & Nature** | Always visible, horizontal scroll | Weekend planning, evergreen content |
| 10 | **Coming Up** | Always visible, 6+ cards | Generic event feed, catch-all |
| 11 | **Community CTA** | Always visible, bottom | Encourages contribution, soft entry point |

### Conditional Display Rules

**Show section if:**
- `items.length >= 3` (minimum viable preview)
- Section type is "always visible" OR
- Section is geo-dependent AND user location is available AND nearby items exist

**Empty state:**
- Don't show section header if 0 items
- Exception: "Adopt" section shows even if 0 events → displays org profiles instead

### Section Card Counts

- **Horizontal scrolls:** 8-12 cards (encourage scrolling, exploration)
- **Compact rows:** 4-6 items (patios, services — scan, not browse)
- **Events:** 4-6 cards (curated picks, not exhaustive)

### "See All →" Links

**Implementation:**
- Every section with 4+ items gets "See all →" link in section header
- Tappable area: entire header row
- Links to deep page: `href={/atl-dogs/parks}`
- No inline expansion (keeps feed scannable)

**Visual treatment:**
```tsx
<div className="flex items-center justify-between mb-3">
  <h2 className="dog-section-title">Off-Leash Parks</h2>
  <Link 
    href="/atl-dogs/parks"
    className="text-sm font-semibold"
    style={{ color: "var(--dog-orange)" }}
  >
    See all (23) →
  </Link>
</div>
```

---

## 3. Feed-to-Deep-Page Transitions

### Interaction Model

**User taps "See all →":**
1. Navigate to deep page (real route, no modal)
2. Slide-up animation (existing Next.js page transition)
3. Deep page header shows back button
4. Bottom nav persists (mobile)

**No modals, no overlays.** Deep pages are full pages for:
- Keyboard navigation (users can tab through filters)
- Screen reader compatibility
- URL copyability
- Browser back button works

### Per-Section Transition Behavior

| Section | Deep Page | Transition |
|---------|-----------|------------|
| Off-Leash Parks | `/atl-dogs/parks` | Navigate, default tab "Off-Leash" |
| Trails & Nature | `/atl-dogs/parks#trails` | Navigate, tab "Trails" |
| Pup Cup Spots | `/atl-dogs/pup-cups` | Navigate |
| Adopt | `/atl-dogs/adopt` | Navigate |
| Training & Classes | `/atl-dogs/training` | Navigate |
| Services | `/atl-dogs/services` | Navigate |
| Patios Near You | `/atl-dogs?category=dog-friendly&vibe=patio` | Filter feed (no new page) |
| This Weekend | `/atl-dogs?date=this-weekend` | Filter feed (no new page) |
| Coming Up | `/atl-dogs?view=find&layout=calendar` | Navigate to Find view, calendar layout |

**Why some filter feed instead of new page?**
- "Patios Near You" is a filtered view of dog-friendly spots → existing Find architecture handles this
- "This Weekend" is a temporal filter → feed can handle inline
- New pages are for DISTINCT content types (parks vs pup-cups vs adoption)

---

## 4. Tag Submission UX Flow

### Entry Points

**Primary:** Venue detail page
- Button placement: Below venue metadata, above description
- Label: "🏷️ Tag as dog-friendly"
- Visual: Secondary button style (outline, not filled)

**Secondary:** Feed CTA (bottom of feed)
- Card style: Warm orange gradient background
- Copy: "Know a dog-friendly spot? Help the pack find it."
- Button: "Tag a spot"
- Links to: Search overlay → user finds venue → opens detail → tag button

### The Tag Modal

**Trigger:** User taps "Tag as dog-friendly" on venue detail
**Auth check:** If not logged in → redirect to `/login?return=/atl-dogs/spots/[slug]`
**If logged in:** Open modal

**Modal Structure:**

```
┌─────────────────────────────────────────┐
│ Tag [Venue Name] as Dog-Friendly   [×]  │
├─────────────────────────────────────────┤
│                                         │
│ Help other dog owners discover this     │
│ spot! Select all that apply:            │
│                                         │
│ ✅ Dog-friendly (primary)               │ ← Auto-checked, required
│                                         │
│ AMENITIES                               │
│ ☐ Water bowls available                │
│ ☐ Shaded patio                         │
│ ☐ Dog wash station                     │
│                                         │
│ FOOD & TREATS                           │
│ ☐ Pup cup or dog treats                │
│ ☐ Dog menu                             │
│                                         │
│ ACCESS (for parks)                      │
│ ☐ Off-leash area                       │
│ ☐ Fenced                               │
│ ☐ Small dog area                       │
│                                         │
│ TRAILS (for nature spots)               │
│ ☐ Water access                         │
│ ☐ Paved paths                          │
│ ☐ Shaded                               │
│                                         │
│ [Cancel]              [Submit Tags]     │
│                                         │
└─────────────────────────────────────────┘
```

### Conditional Tag Groups

**Smart display logic:**
- If `venue_type === 'park'` OR `venue_type === 'dog_park'` → Show ACCESS group
- If `venue_type === 'trail'` OR `venue_type === 'nature_preserve'` → Show TRAILS group
- If `venue_type` in `['restaurant', 'bar', 'cafe', 'brewery']` → Show FOOD & TREATS group
- Always show AMENITIES (universal)

**This prevents overwhelming users** — a brewery doesn't need "fenced" or "water access" tags. Context-aware options.

### Tag Vocabulary Constraints

**Why structured tags (not freeform)?**
1. Consistency: "pup cup" vs "puppuccino" vs "dog treats" → all map to `pup-cup`
2. Filterability: Can't filter on freeform text
3. Icon mapping: Each tag has a defined icon for display
4. Translation-ready: Structured keys can be localized

**How to handle "other" needs?**
- Future: Add "Suggest a tag" link in modal → collects freeform text → we review and add to vocabulary
- V1: Users can comment on venue detail page if tag missing

### Success State

**After submission:**
1. Modal closes
2. Toast notification: "Thanks! Your tags help the pack. 🐾"
3. Optimistic update: Tags appear immediately on venue detail (no page refresh)
4. Confetti burst (micro-delight, matches design direction "celebration moments")

**Post-submit:**
- Button changes to "Update tags" (allows editing)
- User's contribution is tracked (future: badges for top taggers)

### Rate Limiting

- Use existing `RATE_LIMITS.write` (30/min)
- If hit limit: Toast error "Whoa there! Take a break and try again in a minute."
- No hard IP ban (dogs don't deserve that)

### API Route

```typescript
// app/api/tag-venue/route.ts
POST /api/tag-venue
Body: { venue_id: number, vibes: string[] }
Auth: Required (createClient().auth.getUser())
Response: { success: true, vibes: string[] }
```

**Backend logic:**
1. Verify auth
2. Validate `vibes` array (only allowed tags, no SQL injection)
3. Merge with existing `vibes` (no duplicates)
4. Update `venues.vibes` column
5. Track contribution in `user_contributions` table (future analytics)
6. Return updated vibes array

---

## 5. Deep Page Layouts

### A. Parks & Trails (`/atl-dogs/parks`)

**Layout:** Two tabs, map-first on desktop, list-first on mobile

**Tab 1: Off-Leash**

```
┌─────────────────────────────────────────┐
│ ← Parks & Trails                        │ ← Header with back button
├─────────────────────────────────────────┤
│ [Off-Leash] [Trails]                    │ ← Tabs
├─────────────────────────────────────────┤
│ 🗺️ Map View (desktop: 60% width)        │
│ [Interactive map with pins]             │
│ • Green pins: Fenced off-leash          │
│ • Yellow pins: Unfenced off-leash       │
│                                         │
│ ┌─────────────────────────────────┐    │
│ │ List (desktop: 40% sidebar)      │    │
│ │ (mobile: below map)              │    │
│ │                                  │    │
│ │ Filters:                         │    │
│ │ [All] [Fenced] [Unfenced] [...]  │    │
│ │                                  │    │
│ │ ┌──────────────────────────┐    │    │
│ │ │ PIEDMONT DOG PARK        │    │    │
│ │ │ 0.3 mi • Open now        │    │    │
│ │ │ 🟢 Fenced • Small dog area│    │    │
│ │ └──────────────────────────┘    │    │
│ │ ┌──────────────────────────┐    │    │
│ │ │ FREEDOM BARKWAY          │    │    │
│ │ │ 1.2 mi • Open now        │    │    │
│ │ │ 🟡 Unfenced • Water access│    │    │
│ │ └──────────────────────────┘    │    │
│ └─────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Tab 2: Trails**

Same layout, different filters:
- `[All] [Shaded] [Water Access] [Paved] [Off-Leash OK]`
- Pins: Single color (green), no access color-coding

**Card structure:**
```tsx
<DogVenueCard
  variant="park"
  venue={park}
  showDistance={true}
  showOpenStatus={true}
  tags={["fenced", "small-dog-area"]}
/>
```

**Empty state (no parks):**
```
┌─────────────────────────────────────┐
│        🐕                           │
│   No off-leash parks found nearby   │
│                                     │
│   We're building our map. Know one? │
│   [Tag a park]                      │
└─────────────────────────────────────┘
```

**Mobile sticky bottom bar:**
- "Filter" button (opens sheet with filter chips)
- "List / Map" toggle (switches view)

---

### B. Pup Cup Directory (`/atl-dogs/pup-cups`)

**Layout:** Grid on desktop, list on mobile

```
┌─────────────────────────────────────────┐
│ ← Pup Cup Spots                         │
├─────────────────────────────────────────┤
│ Filter: [All Neighborhoods ▼]           │
├─────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────┐
│ │ [Photo]    │ │ [Photo]    │ │ [Photo]│
│ │ STARBUCKS  │ │ SPOTTED    │ │ THREE  │
│ │ Virginia   │ │ TROTTER    │ │ DOG    │
│ │ Highland   │ │ Inman Park │ │ BAKERY │
│ │ 🧋 Pup cup │ │ 🦴 Treats  │ │ 🍪 Menu│
│ └────────────┘ └────────────┘ └────────┘
│ [... more cards in grid]                │
└─────────────────────────────────────────┘
```

**Card treatment:**
- Use `DogVenueCard` (existing)
- Fallback color: `--dog-gold` (food category)
- Show tags below name: "Pup cup · Dog biscuits"

**Sorting:**
- Default: Alphabetical by name
- Future: Distance (if geolocation enabled)

**Empty state:**
```
🧋 No pup cup spots yet

Know a place that serves dog treats?
[Tag a spot]
```

---

### C. Adoption Hub (`/atl-dogs/adopt`)

**Layout:** Org profiles at top, events below

```
┌─────────────────────────────────────────┐
│ ← Adoption                              │
├─────────────────────────────────────────┤
│ SHELTERS & RESCUES                      │
│                                         │
│ ┌─────────────────────────────────┐    │
│ │ [Logo] LIFELINE ANIMAL PROJECT  │    │
│ │ Animal rescue & shelter          │    │
│ │ 3180 Presidential Dr, Atlanta    │    │
│ │ [Website] [Follow]               │    │
│ └─────────────────────────────────┘    │
│ ┌─────────────────────────────────┐    │
│ │ [Logo] ATLANTA HUMANE SOCIETY    │    │
│ │ ...                              │    │
│ └─────────────────────────────────┘    │
│                                         │
│ UPCOMING ADOPTION EVENTS                │
│                                         │
│ ┌────────────┐ ┌────────────┐          │
│ │ [Photo]    │ │ [Photo]    │          │
│ │ Sat, Feb 15│ │ Sun, Feb 16│          │
│ │ ADOPTION   │ │ MEET &     │          │
│ │ DAY        │ │ GREET      │          │
│ │ LifeLine   │ │ Furkids    │          │
│ └────────────┘ └────────────┘          │
└─────────────────────────────────────────┘
```

**Org profile card:**
- Component: `DogOrgCard` (new variant of `DogVenueCard`)
- Logo thumbnail (40x40, rounded)
- Name, tagline, address
- Website link, Follow button
- Tappable → links to org venue detail page

**Event cards:**
- Use `DogEventCard` (existing)
- Badge: "Adoption Event" (warm green background)
- Show org logo in corner

**Empty state (no events):**
```
🐾 No upcoming adoption events

Check back soon, or visit shelters directly above.
```

---

### D. Training Classes (`/atl-dogs/training`)

**Layout:** Filterable event list

```
┌─────────────────────────────────────────┐
│ ← Training & Classes                    │
├─────────────────────────────────────────┤
│ [All] [Puppy] [Obedience] [Agility]     │ ← Filter chips
├─────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐          │
│ │ [Photo]    │ │ [Photo]    │          │
│ │ Thu, Feb 20│ │ Sat, Feb 22│          │
│ │ PUPPY      │ │ BASIC      │          │
│ │ SOCIAL HR  │ │ OBEDIENCE  │          │
│ │ PetSmart   │ │ Zoom Room  │          │
│ └────────────┘ └────────────┘          │
└─────────────────────────────────────────┘
```

**Filter logic:**
- Filter by event tags: `dog-training`, `puppy-class`, `obedience`, `agility`
- "All" shows all training events

**Card structure:**
- Use `DogEventCard` (existing)
- Badge color: `--dog-teal` (services category)

**Empty state:**
```
🎓 No training classes scheduled

We're working on adding more trainers.
[Suggest a trainer]
```

---

### E. Services Directory (`/atl-dogs/services`)

**Layout:** Compact rows, filterable, sortable

```
┌─────────────────────────────────────────┐
│ ← Services                              │
├─────────────────────────────────────────┤
│ [All] [Vets] [Groomers] [Pet Stores]    │
│ [Daycare]                               │
│                                         │
│ ☑ Open Now                              │ ← Toggle
├─────────────────────────────────────────┤
│ ┌──────────────────────────────────┐   │
│ │ [Thumbnail] MIDTOWN VET CLINIC   │   │
│ │ Vet • 0.8 mi                     │   │
│ │ Open until 6pm                   │   │
│ └──────────────────────────────────┘   │
│ ┌──────────────────────────────────┐   │
│ │ [Thumbnail] PAWS & CLAWS GROOMER │   │
│ │ Groomer • 1.2 mi                 │   │
│ │ Closed • Opens Mon 9am           │   │
│ └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Component:** `DogVenueRow` (existing compact row variant)

**Open/Closed Logic:**
- If venue has structured `hours` JSON → compute open/closed real-time
- If only `hours_display` string → show string as-is
- "Open Now" toggle filters to open venues only

**Sorting:**
- Default: Distance (if geolocation available), else alphabetical
- Future: Rating (if we add ratings)

**Empty state:**
```
🏥 No services found

Try adjusting filters or zoom out on map.
```

---

## 6. Card Variants

### Existing Variants (Reuse)

**`DogEventCard`**
- Horizontal scroll cards
- 288px wide (w-72)
- Photo + date + title + venue
- Use for: Events, training classes, adoption events

**`DogVenueCard`**
- Horizontal scroll cards
- 288px wide
- Photo + type badge + name + neighborhood
- Use for: Parks, pup cups, trails

**`DogVenueRow`**
- Compact list rows
- Thumbnail (48px) + name + type + neighborhood
- Use for: Services, patios near you

### New Variants Needed

**`DogOrgCard`** (Adoption hub orgs)
```tsx
// Similar to DogVenueRow but with different metadata
<div className="dog-card p-4 flex items-start gap-3">
  {org.logo_url && <img src={org.logo_url} className="w-10 h-10 rounded-lg" />}
  <div className="flex-1">
    <h3 className="font-bold">{org.name}</h3>
    <p className="text-xs text-stone">{org.tagline}</p>
    <p className="text-xs text-stone">{org.address}</p>
  </div>
  <FollowButton orgId={org.id} size="sm" />
</div>
```

**`DogParkCard` (variant of DogVenueCard)**
- Shows distance ("0.3 mi")
- Shows open/closed status ("Open now" or "Closed")
- Shows access tags below name (color-coded chips: 🟢 Fenced, 🟡 Unfenced)

### When to Create New Variants vs. Props?

**New variant if:**
- Layout structure differs significantly (row vs card)
- Metadata needs are unique (org cards have logo + follow button)

**Use props if:**
- Layout is same, only content differs
- Example: `DogVenueCard` with `showDistance={true}` for parks page

**Recommendation:** Start with props, extract variant only if props get unwieldy (>5 conditional props).

---

## 7. Empty States

### Philosophy

Empty states are **community CTAs**, not dead ends. Turn absence into invitation.

### Empty State Patterns

**Pattern 1: No data seeded yet**
```
┌─────────────────────────────────┐
│          🐕                     │
│   We're still sniffing around   │
│                                 │
│   Know a [type]? Help us build  │
│   the map.                      │
│   [Tag a spot]                  │
└─────────────────────────────────┘
```
Use for: Pup cups, training, services (if no data)

**Pattern 2: Filters too narrow**
```
┌─────────────────────────────────┐
│          🦴                     │
│   No spots match your filters   │
│                                 │
│   [Clear filters]               │
└─────────────────────────────────┘
```
Use for: Deep pages with active filters

**Pattern 3: Location-dependent, no results**
```
┌─────────────────────────────────┐
│          🌳                     │
│   No parks found nearby         │
│                                 │
│   Try zooming out on the map    │
│   or searching by neighborhood  │
└─────────────────────────────────┘
```
Use for: Parks page with geolocation enabled

**Pattern 4: Feed section (conditional display)**
- Don't render section header if 0 items
- Exception: "Adopt" shows org profiles even if 0 events

### Empty State Illustration System (Future)

Per design direction, we'll add a simple illustrated dog mascot:
- Lying down (resting) → "No events this weekend"
- Tilting head (confused) → "No results found"
- Digging → "We're building this section"

V1: Use emoji (🐕 🦴 🌳 🎓 🏥). V2: Replace with illustrations.

### CTA Buttons in Empty States

**Primary:** "Tag a spot" → Opens venue search → user finds venue → tag modal
**Secondary:** "Clear filters" → Resets filters, shows all results
**Tertiary:** "Browse all spots" → Links back to feed

---

## 8. Filter System

### Feed-Level Filters (Top of Feed)

**Placement:** Sticky below header, horizontal scroll chips

```
┌─────────────────────────────────────────┐
│ [Header]                                │
├─────────────────────────────────────────┤
│ [All] [Events] [Parks] [Patios] [...]   │ ← Filter chips
├─────────────────────────────────────────┤
│ [Feed sections below]                   │
└─────────────────────────────────────────┘
```

**Chips:**
- `[All]` → Shows all sections (default)
- `[Events]` → Filters to event sections only (This Weekend, Coming Up)
- `[Parks]` → Filters to park/trail sections
- `[Patios]` → Filters to patio section (if geolocation available)
- `[Services]` → Filters to services section
- `[Adoption]` → Filters to adoption section

**Behavior:**
- Single-select (not multi-select)
- Selecting a chip hides unrelated sections
- Smooth scroll to first visible section
- Active chip: Orange background (primary color)

**Why not always visible?**
- Appears on scroll down (sticky)
- Hides on scroll up (to maximize feed content)
- Mobile: Hide chips on scroll, show "Filter" button in bottom-right corner (FAB)

### Deep Page Filters

**Parks page:**
- Tabs: Off-Leash | Trails
- Chips: `[All] [Fenced] [Unfenced] [Small Dog Area] [Water Access]`

**Services page:**
- Tabs: `[All] [Vets] [Groomers] [Pet Stores] [Daycare]`
- Toggle: `☑ Open Now`

**Training page:**
- Chips: `[All] [Puppy] [Obedience] [Agility] [Behavioral]`

**Pup Cups page:**
- Dropdown: `[All Neighborhoods ▼]`

### Filter State Persistence

**URL params:** Yes, for shareability
- `/atl-dogs/parks?filter=fenced` → Share link, user sees same filtered view
- `/atl-dogs/services?type=vet&open=true` → Bookmarkable

**Local storage:** No (privacy, stale data issues)

**Clear filters:**
- "Clear" button appears if any filter active
- Returns to URL without query params

---

## Design Consistency Checklist

### Typography
- [x] Display headings: `Plus Jakarta Sans 800` (Baloo 2 per design direction, mapped to Plus Jakarta Sans in implementation)
- [x] Body text: `Inter 400`
- [x] Section titles: `dog-section-title` class (1.35rem, 800 weight)
- [x] Metadata: `text-xs`, `--dog-stone` color

### Colors
- [x] Primary: `#FF6B35` (orange)
- [x] Secondary: `#F7931E` (gold)
- [x] Background: `#FFFBEB` (cream)
- [x] Text: `#292524` (charcoal)
- [x] Muted: `#78716C` (stone)
- [x] Category colors: Events `#FF6F59`, Parks `#FFD23F`, Services `#06BCC1`, Trails `#059669`

### Borders & Radius
- [x] Card radius: `16px` (chunky, rounded)
- [x] Pill buttons: `9999px` (fully rounded)
- [x] Border color: `#FDE68A` (pale gold)

### Shadows
- [x] Card shadow: `0 4px 16px rgba(255, 107, 53, 0.1)`
- [x] Hover shadow: `0 8px 24px rgba(255, 107, 53, 0.16)`

### Motion
- [x] Card hover: `translateY(-4px)`, 200ms ease
- [x] Button click: `scale(1.05)`, bounce easing
- [x] Page transitions: Slide up from bottom

### Icons
- [x] NO paw prints (banned per design direction)
- [x] Use emoji for content types (🎉 events, 🌳 parks, 🦴 services, etc.)
- [x] SVG icons for UI elements (arrows, close buttons)

---

## Mobile-First Considerations

### Thumb Zones
- Bottom nav icons: Min 44px tap target
- Filter chips: Min 40px height
- CTAs in sticky bar: Full-width or 50% split (easy to tap with thumb)

### One-Handed Usability
- Primary actions at bottom (sticky bar)
- Search at top-right (reachable)
- Swipe gestures for horizontal scrolls (cards)

### Performance
- Lazy load images (Next.js Image component)
- Horizontal scrolls: Only render visible + 2 offscreen (viewport optimization)
- Map: Load on tab switch, not initial render

### Offline Considerations (Future)
- Cache venue data for "Open Now" checks
- Show stale data with "Last updated" timestamp
- Gray out real-time features (open/closed status)

---

## Accessibility

### Keyboard Navigation
- All filters: Tab-accessible, arrow keys to navigate chips
- Cards: Tab stops, Enter to activate
- Modals: Focus trap, Esc to close
- Bottom nav: Arrow keys to switch tabs

### Screen Readers
- `aria-label` on icon-only buttons
- `role="tablist"` on tab groups
- `aria-live="polite"` on filter result counts
- Image `alt` text: Descriptive (not "dog image")

### Color Contrast
- Text on background: 7:1 (AAA)
- Orange on cream: Test with WebAIM checker
- Filter chips: 3:1 minimum (active state)

### Focus Indicators
- Visible focus ring: 2px solid orange, 2px offset
- Never `outline: none` without custom focus style

---

## Analytics & Tracking

### Events to Track

**Feed interactions:**
- Section "See all" clicks → Track which sections drive traffic
- Card clicks → Track which cards get attention
- Filter chip usage → Understand user intent

**Tag submission:**
- Tag modal opens → Measure interest
- Tag modal submits → Measure contribution rate
- Individual tag selections → Which tags are most useful?

**Deep page engagement:**
- Time on page → Are parks page useful?
- Filter usage → Which filters matter?
- "Open Now" toggle → High-intent users

**Empty states:**
- CTA clicks from empty states → Conversion to contribution

### Implementation

Use existing analytics pattern:
```typescript
trackEvent("dog_section_click", {
  section: "off-leash-parks",
  position: 3,
  source: "feed"
});
```

---

## Implementation Phases

### Phase 1: Core Routes & Navigation (Week 1)
- [ ] Create route files: `/parks`, `/pup-cups`, `/adopt`, `/training`, `/services`
- [ ] Update `DogHeader` to handle deep pages (back button, active states)
- [ ] Test bottom nav persistence across routes

### Phase 2: Deep Page Layouts (Week 2)
- [ ] Parks page with tabs (Off-Leash, Trails)
- [ ] Services page with filters
- [ ] Adoption hub with org profiles
- [ ] Pup cups grid
- [ ] Training list

### Phase 3: Tag Submission (Week 3)
- [ ] Tag modal UI
- [ ] Conditional tag groups (venue-type-aware)
- [ ] API route `/api/tag-venue`
- [ ] Optimistic updates
- [ ] Success states (toast + confetti)

### Phase 4: Filters & Polish (Week 4)
- [ ] Feed-level filter chips
- [ ] Deep page filters (per page)
- [ ] URL param persistence
- [ ] Empty states for all sections
- [ ] Mobile bottom sheet filters

### Phase 5: Data Seeding (Ongoing)
- [ ] Batch tag 23 existing dog-friendly venues
- [ ] Add Atlanta dog parks (Piedmont, Freedom Barkway, etc.)
- [ ] Add pup cup spots (Starbucks, breweries)
- [ ] Add adoption org profiles
- [ ] Crawl training class calendars

---

## Open Questions & Decisions

### Q1: Should "Patios Near You" be a separate deep page?
**Decision:** No. It's a filtered view of dog-friendly spots, handled by existing Find architecture (`/atl-dogs?vibe=patio`). No new page needed.

### Q2: How to handle venues with multiple types (e.g., brewery + dog park)?
**Decision:** Use `venue_types` array (existing field). Show both types in card subtitle: "Brewery · Dog Park". Tags apply to both contexts.

### Q3: Should we allow users to remove/downvote tags?
**Decision:** V1 no. Only additive tagging. V2: Add "Report incorrect tag" flow (sends to moderation queue).

### Q4: Map provider: Google Maps or Mapbox?
**Decision:** Mapbox (per design direction). Outdoor theme, better customization, matches AllTrails vibe.

### Q5: Should parks show distance by default?
**Decision:** Yes if geolocation available. Show "0.3 mi" in card subtitle. If no location, show neighborhood instead.

### Q6: Empty feed state (no sections show)?
**Decision:** Show hero + "We're building ROMP. Check back soon!" message. This shouldn't happen in production (we'll seed data first).

---

## Success Metrics

**Engagement:**
- 40%+ of users scroll past 3 sections (not just hero)
- 20%+ click into a deep page
- 10%+ filter usage (chips or toggles)

**Contribution:**
- 5%+ of users submit at least 1 tag
- 50+ tags submitted in first month
- 80%+ tag accuracy (verified via spot checks)

**Utility:**
- 30%+ of deep page visits result in venue detail click (found what they need)
- "Open Now" filter used 60%+ on services page (high-intent users)
- Map interactions (pin clicks) 40%+ on parks page

**Retention:**
- 25%+ return within 7 days
- 15%+ save a venue or event (bookmark for later)

---

## Final Notes

This design prioritizes **utility over novelty**. Dog owners need answers fast:
- "Where can I take my dog off-leash RIGHT NOW?" → Parks page, "Open Now" filter
- "What's dog-friendly nearby?" → Feed with geolocation
- "How do I help?" → Tag modal, always accessible

Every interaction should feel like a **helpful friend**, not a corporate directory. Copy is warm, empty states are inviting, and contributions are celebrated.

We're not building a pet directory. We're building a tool that makes life with a dog in Atlanta easier. That's the bar.

---

**Approved by:** Product Designer Agent  
**Next Steps:** Engineering review, implementation kickoff  
**Target Launch:** Phase 1 live in 2 weeks
