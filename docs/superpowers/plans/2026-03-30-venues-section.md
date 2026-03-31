# Venues Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace "See Shows" with a venue-first "Venues" section — 7 tabs (Film, Music, Comedy, Theater, Nightlife, Arts, Attractions), two card flavors (programming + exhibition).

**Architecture:** Expand the existing `SeeShowsSection` tab structure from 3→7 tabs. Replace the `PlaceGroupedShowsList` carousel with a 2-col card grid using new `VenueShowCard` and `VenueExhibitionCard` components. Film tab preserves `NowShowingSection` internally. Arts/Attractions tabs fetch from exhibitions table + events at arts/attraction venues.

**Tech Stack:** Next.js, React, Supabase, Tailwind, Phosphor Icons

**Spec:** `docs/superpowers/specs/2026-03-30-venues-section-redesign.md`

---

### Task 1: Create VenueShowCard component

**Files:**
- Create: `web/components/feed/venues/VenueShowCard.tsx`

- [ ] **Step 1: Create the VenueShowCard component**

```tsx
// web/components/feed/venues/VenueShowCard.tsx
"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import CategoryIcon from "@/components/CategoryIcon";
import { formatTime } from "@/lib/formats";

interface VenueShow {
  id: number;
  title: string;
  start_time: string | null;
  is_free?: boolean;
  price_min?: number | null;
}

interface VenueShowCardProps {
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    image_url: string | null;
  };
  shows: VenueShow[];
  totalCount: number;
  portalSlug: string;
  accentColor: string;
  venueType?: string; // for icon fallback
}

export function VenueShowCard({
  venue, shows, totalCount, portalSlug, accentColor, venueType = "venue",
}: VenueShowCardProps) {
  const overflow = totalCount - shows.length;
  return (
    <Link
      href={`/${portalSlug}/spots/${venue.slug}`}
      prefetch={false}
      className="group block rounded-xl bg-[var(--night)] border border-[var(--twilight)]/30 hover:bg-[var(--dusk)]/50 hover:border-[var(--twilight)]/50 transition-colors overflow-hidden"
    >
      <div className="flex items-center gap-3 px-3 pt-3 pb-2">
        {/* Venue image or icon */}
        <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--twilight)]/40">
          {venue.image_url ? (
            <SmartImage src={venue.image_url} alt="" fill sizes="48px" className="object-cover"
              fallback={<FallbackIcon type={venueType} color={accentColor} />} />
          ) : (
            <FallbackIcon type={venueType} color={accentColor} />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--cream)] truncate group-hover:text-white transition-colors">
            {venue.name}
          </p>
          {venue.neighborhood && (
            <p className="text-xs text-[var(--muted)] truncate">{venue.neighborhood}</p>
          )}
        </div>
      </div>

      {/* Shows list */}
      {shows.length > 0 && (
        <div className="border-t border-[var(--twilight)]/20 mx-3 pt-1.5 pb-2.5">
          {shows.slice(0, 3).map((show) => (
            <div key={show.id} className="flex items-center justify-between py-1">
              <span className="text-xs text-[var(--soft)] truncate mr-2">{show.title}</span>
              <span className="text-2xs text-[var(--muted)] font-mono flex-shrink-0">
                {show.start_time ? formatTime(show.start_time) : ""}
              </span>
            </div>
          ))}
          {overflow > 0 && (
            <p className="text-2xs font-mono mt-0.5" style={{ color: accentColor }}>
              +{overflow} more
            </p>
          )}
        </div>
      )}
    </Link>
  );
}

function FallbackIcon({ type, color }: { type: string; color: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, var(--night))` }}>
      <CategoryIcon type={type} size={20} glow="none" weight="bold" className="opacity-70" />
    </div>
  );
}

export type { VenueShowCardProps, VenueShow };
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit` — should pass

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/venues/VenueShowCard.tsx
git commit -m "feat(venues): add VenueShowCard component"
```

---

### Task 2: Create VenueExhibitionCard component

**Files:**
- Create: `web/components/feed/venues/VenueExhibitionCard.tsx`

- [ ] **Step 1: Create the VenueExhibitionCard component**

The exhibition card shows venue + exhibitions with date context instead of start times. Date labels: "Through [date]", "Opens [date]", "Now showing".

```tsx
// web/components/feed/venues/VenueExhibitionCard.tsx
"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import CategoryIcon from "@/components/CategoryIcon";

interface Exhibition {
  id: number;
  title: string;
  start_date: string | null;
  end_date: string | null;
}

interface VenueExhibitionCardProps {
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    image_url: string | null;
  };
  exhibitions: Exhibition[];
  portalSlug: string;
  accentColor: string;
  venueType?: string;
}

function formatExhibitionDate(ex: Exhibition): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (ex.end_date) {
    const end = new Date(ex.end_date + "T00:00:00");
    if (end >= today) {
      return `Through ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
  }
  if (ex.start_date) {
    const start = new Date(ex.start_date + "T00:00:00");
    if (start > today) {
      return `Opens ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
  }
  return "Now showing";
}

export function VenueExhibitionCard({
  venue, exhibitions, portalSlug, accentColor, venueType = "museum",
}: VenueExhibitionCardProps) {
  return (
    <Link
      href={`/${portalSlug}/spots/${venue.slug}`}
      prefetch={false}
      className="group block rounded-xl bg-[var(--night)] border border-[var(--twilight)]/30 hover:bg-[var(--dusk)]/50 hover:border-[var(--twilight)]/50 transition-colors overflow-hidden"
    >
      <div className="flex items-center gap-3 px-3 pt-3 pb-2">
        <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--twilight)]/40">
          {venue.image_url ? (
            <SmartImage src={venue.image_url} alt="" fill sizes="48px" className="object-cover"
              fallback={<FallbackIcon type={venueType} color={accentColor} />} />
          ) : (
            <FallbackIcon type={venueType} color={accentColor} />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--cream)] truncate group-hover:text-white transition-colors">
            {venue.name}
          </p>
          {venue.neighborhood && (
            <p className="text-xs text-[var(--muted)] truncate">{venue.neighborhood}</p>
          )}
        </div>
      </div>

      {exhibitions.length > 0 && (
        <div className="border-t border-[var(--twilight)]/20 mx-3 pt-1.5 pb-2.5">
          {exhibitions.slice(0, 3).map((ex) => (
            <div key={ex.id} className="py-1">
              <p className="text-xs text-[var(--soft)] truncate">{ex.title}</p>
              <p className="text-2xs text-[var(--muted)]">{formatExhibitionDate(ex)}</p>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

function FallbackIcon({ type, color }: { type: string; color: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, var(--night))` }}>
      <CategoryIcon type={type} size={20} glow="none" weight="bold" className="opacity-70" />
    </div>
  );
}

export type { VenueExhibitionCardProps, Exhibition };
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/venues/VenueExhibitionCard.tsx
git commit -m "feat(venues): add VenueExhibitionCard component"
```

---

### Task 3: Extend shows API with venue_types filter

**Files:**
- Modify: `web/app/api/portals/[slug]/shows/route.ts`

The shows API has a dead `PERFORMANCE_VENUE_TYPES` array that was never wired up. Add a `venue_types` query parameter so Arts and Attractions tabs can filter by place_type.

- [ ] **Step 1: Add venue_types param to the shows API**

After the existing `categories` parsing (line ~36), add:
```typescript
const venueTypesParam = searchParams.get("venue_types") ?? null;
const venueTypes = venueTypesParam
  ? venueTypesParam.split(",").map((t) => t.trim()).filter(Boolean)
  : null;
```

Then after the existing query chain (before `const { data: rawEvents }`), add the filter:
```typescript
if (venueTypes && venueTypes.length > 0) {
  query = query.in("places.place_type", venueTypes);
}
```

Remove the dead `PERFORMANCE_VENUE_TYPES` constant.

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/app/api/portals/[slug]/shows/route.ts
git commit -m "feat(api): add venue_types filter to shows endpoint"
```

---

### Task 4: Create Arts/Attractions data hooks

**Files:**
- Create: `web/components/feed/venues/useVenueExhibitions.ts`

Arts and Attractions tabs need exhibitions data + events at arts/attraction venues. Create a hook that fetches and merges both.

- [ ] **Step 1: Create the hook**

The hook fetches exhibitions from the exhibitions table and events at arts/attraction venues from the shows API, merges them into VenueExhibitionCard format.

For Arts: `venue_types=gallery,museum,arts_center` + exhibitions at those venues
For Attractions: `venue_types=zoo,aquarium,attraction,theme_park` + events at those venues

Use the shows API with the new `venue_types` param for events. For exhibitions, create a simple fetch to `/api/portals/[slug]/exhibitions` (or inline query if the API doesn't exist — check first).

- [ ] **Step 2: TypeScript check**

- [ ] **Step 3: Commit**

---

### Task 5: Build VenuesSection (replaces SeeShowsSection)

**Files:**
- Create: `web/components/feed/sections/VenuesSection.tsx`
- Keep: `web/components/feed/sections/SeeShowsSection.tsx` (don't delete yet)

- [ ] **Step 1: Create VenuesSection**

Based on the existing `SeeShowsSection` structure (98 lines). Expand TABS array to 7 entries with accent colors from spec. Film tab renders `NowShowingSection` (unchanged). Programming tabs (Music, Comedy, Theater, Nightlife) render `VenueShowCard` grid. Exhibition tabs (Arts, Attractions) render `VenueExhibitionCard` grid.

Key structure:
```tsx
const TABS = [
  { id: "film", label: "Film", accent: "var(--vibe)", type: "film" },
  { id: "music", label: "Music", accent: "#E855A0", type: "programming" },
  { id: "comedy", label: "Comedy", accent: "var(--gold)", type: "programming" },
  { id: "theater", label: "Theater", accent: "var(--neon-cyan)", type: "programming" },
  { id: "nightlife", label: "Nightlife", accent: "var(--neon-magenta)", type: "programming" },
  { id: "arts", label: "Arts", accent: "var(--coral)", type: "exhibition" },
  { id: "attractions", label: "Attractions", accent: "var(--neon-green)", type: "exhibition" },
];
```

Programming tabs: fetch from `/api/portals/[slug]/shows?categories=X`, render shows as `VenueShowCard` in 2-col grid.
Exhibition tabs: fetch exhibitions/events at venue types, render as `VenueExhibitionCard` in 2-col grid.
Film tab: `<NowShowingSection portalSlug={portalSlug} />` (unchanged).

Section header: "VENUES" with MapPin icon, `var(--vibe)` accent.
Tab caching: `visited` set pattern.
Tab bar: horizontal scroll with accent-colored active state.

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/sections/VenuesSection.tsx
git commit -m "feat(venues): create VenuesSection with 7 tabs"
```

---

### Task 6: Wire VenuesSection into CityPulseShell

**Files:**
- Modify: `web/components/feed/CityPulseShell.tsx`

- [ ] **Step 1: Replace SeeShowsSection with VenuesSection**

Change the dynamic import from `SeeShowsSection` to `VenuesSection`:
```typescript
const VenuesSection = dynamic(() => import("./sections/VenuesSection"), { ssr: false });
```

Replace the render site where `SeeShowsSection` was used.

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Browser test**

Load `http://localhost:3000/atlanta`, scroll to the Venues section. Verify:
- Section header says "VENUES"
- 7 tabs visible, horizontally scrollable on mobile
- Film tab shows existing NowShowingSection content
- Music tab shows venue cards with shows
- Comedy tab shows venue cards
- Tab switching doesn't re-fetch

- [ ] **Step 4: Commit**

```bash
git add web/components/feed/CityPulseShell.tsx
git commit -m "feat(feed): wire VenuesSection into CityPulseShell"
```

---

### Task 7: QA + polish

- [ ] **Step 1: Test all 7 tabs with real data**

Load each tab. Note which have data and which are empty. For empty tabs, verify the "No X tonight" message shows.

- [ ] **Step 2: Mobile test at 375px**

Tabs should scroll horizontally. Cards should be single column. No overflow.

- [ ] **Step 3: Console check**

Zero errors, zero warnings.

- [ ] **Step 4: Clean up old SeeShowsSection**

If everything works, the old `SeeShowsSection.tsx` can stay as dead code for now (it's not imported). Don't delete it until we're confident the replacement is stable.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(venues): complete Venues section — 7 tabs, two card flavors"
```
