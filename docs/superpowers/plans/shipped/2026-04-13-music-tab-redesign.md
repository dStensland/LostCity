# Music Tab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat-grid Music tab with a hybrid layout: tonight's shows carousel + established venue directory, with genre filtering.

**Architecture:** Single API call to existing `/shows` endpoint (extended with `tags`, `doors_time`). Client-side splitting: today's shows → carousel, `music_venue` places → directory. Genre filtering is client-side on the fetched data. Three new components (MusicTabContent orchestrator, TonightShowCard, GenreFilterStrip), one API modification, one wiring change.

**Tech Stack:** Next.js 16, React, Tailwind v4, Supabase, existing FilterChip/VenueShowCard components.

**Spec:** `docs/superpowers/specs/2026-04-13-music-tab-redesign.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `web/lib/genre-map.ts` | Tag → genre bucket mapping, subgenre label formatting |
| Create | `web/lib/__tests__/genre-map.test.ts` | Unit tests for genre mapping |
| Create | `web/components/feed/GenreFilterStrip.tsx` | Horizontal genre filter pill strip |
| Create | `web/components/feed/venues/TonightShowCard.tsx` | Carousel card for tonight's shows |
| Create | `web/components/feed/sections/MusicTabContent.tsx` | Orchestrator: tonight + filter + directory |
| Modify | `web/app/api/portals/[slug]/shows/route.ts` | Add `tags`, `doors_time` to select and response |
| Modify | `web/components/feed/sections/VenuesSection.tsx` | Swap ProgrammingTabContent → MusicTabContent for music tab |

---

### Task 1: Genre Mapping Utility

**Files:**
- Create: `web/lib/genre-map.ts`
- Create: `web/lib/__tests__/genre-map.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// web/lib/__tests__/genre-map.test.ts
import { describe, it, expect } from "vitest";
import {
  getGenreBuckets,
  getSubgenreLabels,
  formatSubgenreLabel,
  GENRE_BUCKETS,
} from "../genre-map";

describe("getGenreBuckets", () => {
  it("maps rock tags to Rock bucket", () => {
    expect(getGenreBuckets(["indie-rock", "post-punk"])).toEqual(["Rock"]);
  });

  it("maps multiple genre tags to distinct buckets", () => {
    const result = getGenreBuckets(["hip-hop", "jazz", "electronic"]);
    expect(result).toContain("Hip-Hop / R&B");
    expect(result).toContain("Jazz / Blues");
    expect(result).toContain("Electronic / DJ");
    expect(result).toHaveLength(3);
  });

  it("returns empty array for null or empty tags", () => {
    expect(getGenreBuckets(null)).toEqual([]);
    expect(getGenreBuckets([])).toEqual([]);
  });

  it("ignores unmapped tags", () => {
    expect(getGenreBuckets(["outdoor", "family-friendly", "rock"])).toEqual([
      "Rock",
    ]);
  });

  it("deduplicates when multiple tags map to same bucket", () => {
    expect(getGenreBuckets(["rock", "indie-rock", "alt-rock"])).toEqual([
      "Rock",
    ]);
  });
});

describe("getSubgenreLabels", () => {
  it("returns formatted labels for genre-mapped tags only", () => {
    expect(getSubgenreLabels(["indie-rock", "outdoor"])).toEqual([
      "Indie Rock",
    ]);
  });

  it("returns empty array for null", () => {
    expect(getSubgenreLabels(null)).toEqual([]);
  });

  it("returns multiple labels preserving order", () => {
    expect(getSubgenreLabels(["jazz", "hip-hop"])).toEqual([
      "Jazz",
      "Hip Hop",
    ]);
  });
});

describe("formatSubgenreLabel", () => {
  it("formats hyphenated tags to title case", () => {
    expect(formatSubgenreLabel("indie-rock")).toBe("Indie Rock");
    expect(formatSubgenreLabel("hip-hop")).toBe("Hip Hop");
  });

  it("capitalizes single-word tags", () => {
    expect(formatSubgenreLabel("rock")).toBe("Rock");
    expect(formatSubgenreLabel("jazz")).toBe("Jazz");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run lib/__tests__/genre-map.test.ts`
Expected: FAIL — module `../genre-map` not found.

- [ ] **Step 3: Implement the genre map**

```typescript
// web/lib/genre-map.ts

export const GENRE_BUCKETS = [
  "Rock",
  "Hip-Hop / R&B",
  "Electronic / DJ",
  "Jazz / Blues",
  "Country",
  "Latin",
  "Pop / Singer-Songwriter",
] as const;

export type GenreBucket = (typeof GENRE_BUCKETS)[number];

const TAG_TO_BUCKET: Record<string, GenreBucket> = {
  rock: "Rock",
  "indie-rock": "Rock",
  "alt-rock": "Rock",
  alternative: "Rock",
  "post-punk": "Rock",
  punk: "Rock",
  metal: "Rock",
  grunge: "Rock",
  shoegaze: "Rock",
  "garage-rock": "Rock",
  "hip-hop": "Hip-Hop / R&B",
  rap: "Hip-Hop / R&B",
  "r-and-b": "Hip-Hop / R&B",
  rnb: "Hip-Hop / R&B",
  soul: "Hip-Hop / R&B",
  "neo-soul": "Hip-Hop / R&B",
  trap: "Hip-Hop / R&B",
  electronic: "Electronic / DJ",
  edm: "Electronic / DJ",
  house: "Electronic / DJ",
  techno: "Electronic / DJ",
  dj: "Electronic / DJ",
  ambient: "Electronic / DJ",
  synthwave: "Electronic / DJ",
  jazz: "Jazz / Blues",
  blues: "Jazz / Blues",
  swing: "Jazz / Blues",
  country: "Country",
  bluegrass: "Country",
  americana: "Country",
  latin: "Latin",
  reggaeton: "Latin",
  salsa: "Latin",
  bachata: "Latin",
  cumbia: "Latin",
  pop: "Pop / Singer-Songwriter",
  "singer-songwriter": "Pop / Singer-Songwriter",
  folk: "Pop / Singer-Songwriter",
  "indie-pop": "Pop / Singer-Songwriter",
  acoustic: "Pop / Singer-Songwriter",
};

/** Map an array of event tags to their broad genre buckets (deduplicated). */
export function getGenreBuckets(tags: string[] | null): GenreBucket[] {
  if (!tags || tags.length === 0) return [];
  const buckets = new Set<GenreBucket>();
  for (const tag of tags) {
    const bucket = TAG_TO_BUCKET[tag];
    if (bucket) buckets.add(bucket);
  }
  return [...buckets];
}

/** Format a raw hyphenated tag into a human-readable label. */
export function formatSubgenreLabel(tag: string): string {
  return tag
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Get displayable subgenre labels from tags (only genre-mapped ones). */
export function getSubgenreLabels(tags: string[] | null): string[] {
  if (!tags || tags.length === 0) return [];
  return tags.filter((tag) => tag in TAG_TO_BUCKET).map(formatSubgenreLabel);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run lib/__tests__/genre-map.test.ts`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/genre-map.ts web/lib/__tests__/genre-map.test.ts
git commit -m "feat(music): add genre mapping utility with tests"
```

---

### Task 2: Extend Shows API Response

**Files:**
- Modify: `web/app/api/portals/[slug]/shows/route.ts`

The shows API currently selects `id, title, start_date, start_time, end_time, price_min, price_max, image_url, is_free` from events and joins `venue:places!inner(id, name, slug, neighborhood, image_url, place_type)`. We need to add `tags` and `doors_time` to the event select and include them in the per-show response objects.

- [ ] **Step 1: Read the current route file**

Read: `web/app/api/portals/[slug]/shows/route.ts`

Locate:
1. The `.select(...)` call (around line 102) — find the column list string
2. The event type definition (around line 152) — where fetched event shape is typed
3. The show-mapping code — where events are transformed into the response `shows` array objects

- [ ] **Step 2: Add `tags, doors_time` to the select**

In the `.select(...)` string, add `tags, doors_time` after `is_free`:

```
// Before:
image_url, is_free, venue:places!inner(...)

// After:
image_url, is_free, tags, doors_time, venue:places!inner(...)
```

- [ ] **Step 3: Update the event type**

In the type definition for fetched events (around line 152), add:

```typescript
tags: string[] | null;
doors_time: string | null;
```

- [ ] **Step 4: Include tags and doors_time in show response mapping**

Find where show objects are constructed for the response (the code that builds the `shows` array per venue). Add the two fields:

```typescript
// In the show mapping, add alongside existing fields:
tags: event.tags ?? [],
doors_time: event.doors_time ?? null,
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Verify API returns new fields**

Run: `cd web && npm run dev` (if not running)
Then: `curl -s "http://localhost:3000/api/portals/atlanta/shows?categories=music&is_show=true" | npx json venues[0].shows[0]`

Verify the response includes `tags` (array) and `doors_time` (string or null) on show objects.

- [ ] **Step 7: Commit**

```bash
git add web/app/api/portals/[slug]/shows/route.ts
git commit -m "feat(api): add tags and doors_time to shows endpoint response"
```

---

### Task 3: GenreFilterStrip Component

**Files:**
- Create: `web/components/feed/GenreFilterStrip.tsx`

Uses existing `FilterChip` component with `variant="genre"`.

- [ ] **Step 1: Create the component**

```tsx
// web/components/feed/GenreFilterStrip.tsx
"use client";

import { memo } from "react";
import FilterChip from "@/components/filters/FilterChip";
import { GENRE_BUCKETS } from "@/lib/genre-map";

interface GenreFilterStripProps {
  activeGenre: string | null;
  onGenreChange: (genre: string | null) => void;
}

export const GenreFilterStrip = memo(function GenreFilterStrip({
  activeGenre,
  onGenreChange,
}: GenreFilterStripProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-3">
      <FilterChip
        label="All"
        variant="genre"
        active={activeGenre === null}
        onClick={() => onGenreChange(null)}
        size="sm"
      />
      {GENRE_BUCKETS.map((genre) => (
        <FilterChip
          key={genre}
          label={genre}
          variant="genre"
          active={activeGenre === genre}
          onClick={() => onGenreChange(genre)}
          size="sm"
        />
      ))}
    </div>
  );
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/GenreFilterStrip.tsx
git commit -m "feat(music): add GenreFilterStrip component"
```

---

### Task 4: TonightShowCard Component

**Files:**
- Create: `web/components/feed/venues/TonightShowCard.tsx`

Carousel card (~260px) for tonight's shows. Shows artist/show name, venue, genre chips, doors time badge, show time. Follows the carousel card recipe from CLAUDE.md.

- [ ] **Step 1: Create the component**

```tsx
// web/components/feed/venues/TonightShowCard.tsx
"use client";

import { memo } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import { formatTime } from "@/lib/formats";
import { getSubgenreLabels } from "@/lib/genre-map";

interface TonightShowCardProps {
  show: {
    id: number;
    title: string;
    start_time: string | null;
    doors_time: string | null;
    image_url: string | null;
    is_free: boolean;
    tags: string[] | null;
  };
  venue: {
    name: string;
    slug: string;
    neighborhood: string | null;
    image_url: string | null;
  };
  portalSlug: string;
  accentColor: string;
}

export const TonightShowCard = memo(function TonightShowCard({
  show,
  venue,
  portalSlug,
  accentColor,
}: TonightShowCardProps) {
  const timeLabel = formatTime(show.start_time);
  const doorsLabel = show.doors_time
    ? `Doors ${formatTime(show.doors_time)}`
    : null;
  const subgenres = getSubgenreLabels(show.tags).slice(0, 3);

  return (
    <Link
      href={`/${portalSlug}/spots/${venue.slug}`}
      prefetch={false}
      className="group flex-shrink-0 w-[260px] snap-start rounded-card overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40 hover:border-[var(--twilight)]/60 transition-colors"
    >
      {/* Image area with gradient overlay */}
      <div className="relative h-[100px] overflow-hidden bg-[var(--dusk)]">
        {venue.image_url || show.image_url ? (
          <SmartImage
            src={(show.image_url || venue.image_url)!}
            alt=""
            fill
            sizes="260px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            fallback={<GradientFallback accentColor={accentColor} />}
          />
        ) : (
          <GradientFallback accentColor={accentColor} />
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/60 to-transparent" />

        {/* Top-right badge */}
        {show.is_free ? (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-2xs font-mono font-bold bg-[var(--neon-green)]/20 text-[var(--neon-green)]">
            FREE
          </span>
        ) : doorsLabel ? (
          <span
            className="absolute top-2 right-2 px-2 py-0.5 rounded text-2xs font-mono"
            style={{
              backgroundColor: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
              color: accentColor,
            }}
          >
            {doorsLabel}
          </span>
        ) : null}

        {/* Show title overlaid on image */}
        <div className="absolute bottom-2 left-2.5 right-2.5">
          <p className="text-base font-semibold text-white truncate leading-snug">
            {show.title}
          </p>
        </div>
      </div>

      {/* Content below image */}
      <div className="px-2.5 py-2">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="min-w-0">
            <p className="text-xs text-[var(--soft)] truncate">{venue.name}</p>
            {venue.neighborhood && (
              <p className="text-2xs text-[var(--muted)] truncate">
                {venue.neighborhood}
              </p>
            )}
          </div>
          {timeLabel !== "TBA" && (
            <span
              className="flex-shrink-0 text-xs font-mono"
              style={{ color: accentColor }}
            >
              {timeLabel}
            </span>
          )}
        </div>

        {/* Subgenre chips */}
        {subgenres.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {subgenres.map((label) => (
              <span
                key={label}
                className="px-1.5 py-0.5 rounded text-2xs text-[var(--muted)] bg-[var(--twilight)]/60"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
});

function GradientFallback({ accentColor }: { accentColor: string }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 15%, var(--night)), color-mix(in srgb, ${accentColor} 5%, var(--dusk)))`,
      }}
    />
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/venues/TonightShowCard.tsx
git commit -m "feat(music): add TonightShowCard carousel card component"
```

---

### Task 5: MusicTabContent Orchestrator

**Files:**
- Create: `web/components/feed/sections/MusicTabContent.tsx`

This is the core component. It replaces `ProgrammingTabContent` for the music tab. Fetches show data, splits it into tonight carousel + venue directory, applies genre filtering client-side.

**Data flow:**
1. Fetch from `/api/portals/[slug]/shows?categories=music&is_show=true` (same endpoint as before)
2. Split: today's shows → tonight carousel (all venue types), `music_venue` only → directory
3. Genre filter: client-side filtering on `tags` via `getGenreBuckets()`

- [ ] **Step 1: Create the component**

```tsx
// web/components/feed/sections/MusicTabContent.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { TonightShowCard } from "@/components/feed/venues/TonightShowCard";
import { VenueShowCard } from "@/components/feed/venues/VenueShowCard";
import { GenreFilterStrip } from "@/components/feed/GenreFilterStrip";
import { getGenreBuckets, type GenreBucket } from "@/lib/genre-map";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MusicShow {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  doors_time: string | null;
  price_min: number | null;
  image_url: string | null;
  is_free: boolean;
  tags: string[];
}

interface MusicVenue {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  image_url: string | null;
  place_type: string | null;
}

interface MusicVenueGroup {
  venue: MusicVenue;
  shows: MusicShow[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT = "#E855A0";
const FETCH_TIMEOUT_MS = 10_000;

// ── Component ─────────────────────────────────────────────────────────────────

export default function MusicTabContent({
  portalSlug,
}: {
  portalSlug: string;
}) {
  const [data, setData] = useState<MusicVenueGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    fetch(
      `/api/portals/${encodeURIComponent(portalSlug)}/shows?categories=music&is_show=true`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ venues: MusicVenueGroup[] }>;
      })
      .then((json) => {
        if (!controller.signal.aborted) {
          setData(json.venues ?? []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [portalSlug]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Apply genre filter to all data
  const filteredData = useMemo(() => {
    if (!activeGenre) return data;
    return data
      .map((vg) => ({
        ...vg,
        shows: vg.shows.filter((s) =>
          getGenreBuckets(s.tags).includes(activeGenre as GenreBucket),
        ),
      }))
      .filter((vg) => vg.shows.length > 0);
  }, [data, activeGenre]);

  // Tonight: flatten all shows from all venues where start_date === today
  const tonightShows = useMemo(() => {
    const flat: { show: MusicShow; venue: MusicVenue }[] = [];
    for (const vg of filteredData) {
      for (const show of vg.shows) {
        if (show.start_date === today) {
          flat.push({ show, venue: vg.venue });
        }
      }
    }
    return flat.sort((a, b) =>
      (a.show.start_time ?? "").localeCompare(b.show.start_time ?? ""),
    );
  }, [filteredData, today]);

  // Directory: only music_venue place_type, sorted by today-first then show count
  const directoryVenues = useMemo(() => {
    return filteredData
      .filter((vg) => vg.venue.place_type === "music_venue")
      .sort((a, b) => {
        const aToday = a.shows.some((s) => s.start_date === today);
        const bToday = b.shows.some((s) => s.start_date === today);
        if (aToday !== bToday) return aToday ? -1 : 1;
        return b.shows.length - a.shows.length;
      });
  }, [filteredData, today]);

  if (loading) return <MusicTabSkeleton />;

  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--muted)]">
        No music shows this week
      </p>
    );
  }

  const hasContent = tonightShows.length > 0 || directoryVenues.length > 0;

  return (
    <div>
      <GenreFilterStrip
        activeGenre={activeGenre}
        onGenreChange={setActiveGenre}
      />

      {/* Tonight carousel */}
      {tonightShows.length > 0 && (
        <div className="mb-4">
          <p
            className="font-mono text-xs font-bold tracking-[0.12em] uppercase mb-2.5"
            style={{ color: ACCENT }}
          >
            Tonight
          </p>
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1 pb-2">
            {tonightShows.map(({ show, venue }) => (
              <TonightShowCard
                key={show.id}
                show={show}
                venue={venue}
                portalSlug={portalSlug}
                accentColor={ACCENT}
              />
            ))}
          </div>
        </div>
      )}

      {/* Venue directory */}
      {directoryVenues.length > 0 && (
        <div>
          <p className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--muted)] mb-2.5">
            {tonightShows.length > 0
              ? "This Week at Atlanta Venues"
              : "Atlanta Music Venues"}
          </p>
          <div className="flex flex-col gap-1.5">
            {directoryVenues.map((vg) => (
              <VenueShowCard
                key={vg.venue.id}
                venue={vg.venue}
                shows={vg.shows}
                totalCount={vg.shows.length}
                portalSlug={portalSlug}
                accentColor={ACCENT}
                venueType="music_venue"
              />
            ))}
          </div>
        </div>
      )}

      {/* Genre filter yields nothing */}
      {activeGenre && !hasContent && (
        <p className="py-6 text-center text-sm text-[var(--muted)]">
          No {activeGenre} shows this week
        </p>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function MusicTabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-7 w-16 rounded-full bg-[var(--twilight)]/30 animate-pulse"
          />
        ))}
      </div>
      <div className="flex gap-2.5 overflow-hidden">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[260px] h-[160px] rounded-card bg-[var(--night)] border border-[var(--twilight)]/30 animate-pulse"
          />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 rounded-lg bg-[var(--night)] border border-[var(--twilight)]/30 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/sections/MusicTabContent.tsx
git commit -m "feat(music): add MusicTabContent orchestrator with tonight carousel + venue directory"
```

---

### Task 6: Wire Into VenuesSection + Browser Test

**Files:**
- Modify: `web/components/feed/sections/VenuesSection.tsx`

- [ ] **Step 1: Add MusicTabContent import**

At the top of `web/components/feed/sections/VenuesSection.tsx`, add the import alongside the existing ones:

```typescript
import MusicTabContent from "./MusicTabContent";
```

- [ ] **Step 2: Replace ProgrammingTabContent for the music tab**

Find the music tab panel (around line 388-399):

```tsx
// BEFORE:
{/* Music */}
<div className={activeTab === "music" ? "block" : "hidden"}>
  {visited.has("music") && (
    <ProgrammingTabContent
      portalSlug={portalSlug}
      categories="music"
      accentColor="#E855A0"
      label="music"
      requireShow
    />
  )}
</div>
```

Replace with:

```tsx
// AFTER:
{/* Music */}
<div className={activeTab === "music" ? "block" : "hidden"}>
  {visited.has("music") && (
    <MusicTabContent portalSlug={portalSlug} />
  )}
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Run all existing tests**

Run: `cd web && npx vitest run`
Expected: All tests pass (including genre-map tests from Task 1).

- [ ] **Step 5: Browser test**

Run: `cd web && npm run dev` (if not running)

Open `http://localhost:3000/atlanta` in browser. Navigate to the Venues section, click the **Music** tab.

**Verify:**
1. Genre filter strip appears at top with "All" active by default
2. If shows exist today: "TONIGHT" label + horizontal carousel of TonightShowCard cards
3. Below tonight (or at top if no tonight shows): "THIS WEEK AT ATLANTA VENUES" label + vertical list of VenueShowCard rows
4. Only `music_venue` places appear in the directory (Terminal West, The Earl, Variety Playhouse, etc. — not random bars)
5. Clicking a genre filter filters both carousel and directory
6. Clicking "All" clears the filter
7. Genre empty state shows if a genre has no shows
8. Carousel scrolls horizontally on mobile (375px viewport)
9. Cards link to venue detail pages (`/atlanta/spots/[slug]`)
10. No console errors

**Check at 375px viewport (mobile):**
- Genre chips scroll horizontally without overflow
- Tonight carousel cards scroll with snap
- Venue directory cards are full-width single column

- [ ] **Step 6: Commit**

```bash
git add web/components/feed/sections/VenuesSection.tsx
git commit -m "feat(music): wire MusicTabContent into VenuesSection music tab"
```

---

## Post-Implementation Verification

After all tasks are complete, run the full check:

```bash
cd web && npx tsc --noEmit && npx vitest run
```

Then browser-test the music tab at both desktop and 375px mobile to confirm the full experience works end-to-end.
