# Venues Section → Standalone Film + Music Blocks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 7-tab VenuesSection with two standalone feed blocks: "Now Showing" (Film) and "Live Music" (Music). Drop Comedy, Theater, Nightlife, Arts, Attractions from the feed (covered by LineupSection + PlacesToGo).

**Architecture:** Keep `"cinema"` FeedBlockId for Film (avoids breaking existing user layouts), add `"live_music"` FeedBlockId for Music. Mount NowShowingSection and MusicTabContent as standalone lazy-loaded blocks in CityPulseShell. Cap the music venue directory at 6 venues. Delete VenuesSection and SeeShowsSection.

**Tech Stack:** Next.js 16, React, Tailwind v4, existing FeedSectionHeader/LazySection components.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `web/lib/city-pulse/types.ts` | Add `"live_music"` to FeedBlockId, DEFAULT_FEED_ORDER |
| Modify | `web/components/feed/FeedPageIndex.tsx` | Update BLOCK_LABELS: cinema → "Now Showing", add live_music → "Live Music" |
| Modify | `web/components/feed/CityPulseShell.tsx` | Replace cinema case with standalone NowShowingSection, add live_music case with LiveMusicSection |
| Modify | `web/components/feed/sections/MusicTabContent.tsx` | Rename to LiveMusicSection, add FeedSectionHeader, cap directory at 6 venues |
| Delete | `web/components/feed/sections/VenuesSection.tsx` | No longer needed |
| Delete | `web/components/feed/sections/SeeShowsSection.tsx` | Dead code, never imported |

---

### Task 1: Add live_music FeedBlockId

**Files:**
- Modify: `web/lib/city-pulse/types.ts`

- [ ] **Step 1: Add `"live_music"` to FeedBlockId union type**

In `web/lib/city-pulse/types.ts`, find the FeedBlockId type (line 456):

```typescript
// BEFORE:
export type FeedBlockId =
  | "briefing"
  | "events"
  | "hangs"
  | "recurring"
  | "festivals"
  | "experiences"
  | "community"
  | "cinema"
  | "sports"
  | "horizon"
  | "browse";
```

Add `"live_music"` after `"cinema"`:

```typescript
// AFTER:
export type FeedBlockId =
  | "briefing"
  | "events"
  | "hangs"
  | "recurring"
  | "festivals"
  | "experiences"
  | "community"
  | "cinema"
  | "live_music"
  | "sports"
  | "horizon"
  | "browse";
```

- [ ] **Step 2: Add `"live_music"` to DEFAULT_FEED_ORDER**

Find `DEFAULT_FEED_ORDER` (line 489):

```typescript
// BEFORE:
export const DEFAULT_FEED_ORDER: FeedBlockId[] = [
  "briefing",
  "events",
  "cinema",
  "sports",
  "horizon",
];
```

Add `"live_music"` after `"cinema"`:

```typescript
// AFTER:
export const DEFAULT_FEED_ORDER: FeedBlockId[] = [
  "briefing",
  "events",
  "cinema",
  "live_music",
  "sports",
  "horizon",
];
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: Errors in FeedPageIndex.tsx (BLOCK_LABELS missing `"live_music"` key) — this is expected, we fix it in Task 2.

- [ ] **Step 4: Commit**

```bash
git add web/lib/city-pulse/types.ts
git commit -m "feat(feed): add live_music FeedBlockId to feed type system"
```

---

### Task 2: Update Feed Index Labels

**Files:**
- Modify: `web/components/feed/FeedPageIndex.tsx`

- [ ] **Step 1: Update BLOCK_LABELS**

In `web/components/feed/FeedPageIndex.tsx`, find `BLOCK_LABELS` (line 49):

```typescript
// BEFORE:
const BLOCK_LABELS: Record<FeedBlockId, string> = {
  briefing: "The Briefing",
  events: "The Lineup",
  hangs: "Hangs",
  recurring: "Regular Hangs",
  festivals: "The Big Stuff",
  experiences: "Things to Do",
  community: "The Network",
  cinema: "Venues",
  sports: "Game Day",
  horizon: "On the Horizon",
  browse: "Browse by Category",
};
```

Change `cinema` label and add `live_music`:

```typescript
// AFTER:
const BLOCK_LABELS: Record<FeedBlockId, string> = {
  briefing: "The Briefing",
  events: "The Lineup",
  hangs: "Hangs",
  recurring: "Regular Hangs",
  festivals: "The Big Stuff",
  experiences: "Things to Do",
  community: "The Network",
  cinema: "Now Showing",
  live_music: "Live Music",
  sports: "Game Day",
  horizon: "On the Horizon",
  browse: "Browse by Category",
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors (BLOCK_LABELS now covers all FeedBlockId values).

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/FeedPageIndex.tsx
git commit -m "feat(feed): update block labels — cinema→Now Showing, add Live Music"
```

---

### Task 3: Refactor MusicTabContent → LiveMusicSection

**Files:**
- Modify: `web/components/feed/sections/MusicTabContent.tsx`

This component needs three changes to work as a standalone feed section:
1. Add its own FeedSectionHeader
2. Cap the venue directory at 6 venues with a "See all" link
3. Rename export to LiveMusicSection

- [ ] **Step 1: Refactor the component**

Replace the full content of `web/components/feed/sections/MusicTabContent.tsx` with:

```tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { MusicNote } from "@phosphor-icons/react";
import { TonightShowCard } from "@/components/feed/venues/TonightShowCard";
import { VenueShowCard } from "@/components/feed/venues/VenueShowCard";
import { GenreFilterStrip } from "@/components/feed/GenreFilterStrip";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { getGenreBuckets, type GenreBucket } from "@/lib/genre-map";
import { buildExploreUrl } from "@/lib/find-url";

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
  genres: string[];
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
const MAX_DIRECTORY_VENUES = 6;

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveMusicSection({
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

  const filteredData = useMemo(() => {
    if (!activeGenre) return data;
    return data
      .map((vg) => ({
        ...vg,
        shows: vg.shows.filter((s) => {
          const fromGenres = getGenreBuckets(s.genres);
          const fromTags = getGenreBuckets(s.tags);
          const allBuckets = [...new Set([...fromGenres, ...fromTags])];
          return allBuckets.includes(activeGenre as GenreBucket);
        }),
      }))
      .filter((vg) => vg.shows.length > 0);
  }, [data, activeGenre]);

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

  const allDirectoryVenues = useMemo(() => {
    return filteredData
      .filter((vg) => vg.venue.place_type === "music_venue")
      .sort((a, b) => {
        const aToday = a.shows.some((s) => s.start_date === today);
        const bToday = b.shows.some((s) => s.start_date === today);
        if (aToday !== bToday) return aToday ? -1 : 1;
        return b.shows.length - a.shows.length;
      });
  }, [filteredData, today]);

  const directoryVenues = allDirectoryVenues.slice(0, MAX_DIRECTORY_VENUES);
  const overflowCount = allDirectoryVenues.length - MAX_DIRECTORY_VENUES;

  // Don't render the section at all if there's no data
  if (!loading && data.length === 0) return null;

  const hasContent = tonightShows.length > 0 || directoryVenues.length > 0;
  const seeAllHref = buildExploreUrl({
    portalSlug,
    lane: "shows",
    extraParams: { tab: "music" },
  });

  return (
    <section>
      <FeedSectionHeader
        title="Live Music"
        priority="secondary"
        variant="destinations"
        accentColor={ACCENT}
        icon={<MusicNote weight="duotone" className="w-5 h-5" />}
        seeAllHref={seeAllHref}
      />

      {loading ? (
        <LiveMusicSkeleton />
      ) : (
        <div>
          <GenreFilterStrip
            activeGenre={activeGenre}
            onGenreChange={setActiveGenre}
          />

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
              {overflowCount > 0 && (
                <div className="flex justify-end pt-2">
                  <a
                    href={seeAllHref}
                    className="text-xs font-mono hover:opacity-80 transition-opacity"
                    style={{ color: ACCENT }}
                  >
                    +{overflowCount} more venues &rarr;
                  </a>
                </div>
              )}
            </div>
          )}

          {activeGenre && !hasContent && (
            <p className="py-6 text-center text-sm text-[var(--muted)]">
              No {activeGenre} shows this week
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function LiveMusicSkeleton() {
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

Key changes from the old MusicTabContent:
- Renamed export to `LiveMusicSection`
- Added `FeedSectionHeader` with "Live Music" title, MusicNote icon, magenta accent
- Added `MAX_DIRECTORY_VENUES = 6` cap on directory
- Added overflow link "+N more venues →" linking to explore shows/music
- Returns `null` when no data (section disappears from feed)
- Skeleton is inside the section (header always renders)

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/sections/MusicTabContent.tsx
git commit -m "feat(feed): refactor MusicTabContent → standalone LiveMusicSection with venue cap"
```

---

### Task 4: Rewire CityPulseShell — Replace VenuesSection with Standalone Blocks

**Files:**
- Modify: `web/components/feed/CityPulseShell.tsx`

This is the critical wiring task. We need to:
1. Replace the `VenuesSection` dynamic import with `LiveMusicSection`
2. Change the `"cinema"` case to render standalone `NowShowingSection`
3. Add a `"live_music"` case to render standalone `LiveMusicSection`

- [ ] **Step 1: Read CityPulseShell.tsx**

Read `web/components/feed/CityPulseShell.tsx` to confirm the current dynamic imports (around line 77) and the `"cinema"` case in `renderMiddleSection` (around line 422).

- [ ] **Step 2: Replace VenuesSection import with LiveMusicSection**

Find the dynamic import (around line 77):

```typescript
// BEFORE:
const VenuesSection = dynamic(() => import("./sections/VenuesSection"), { ssr: false });
```

Replace with:

```typescript
// AFTER:
const LiveMusicSection = dynamic(() => import("./sections/MusicTabContent"), { ssr: false });
```

Note: NowShowingSection is already imported somewhere in the file (check for existing import). If not, it needs to be imported as a dynamic import too:

```typescript
const NowShowingSection = dynamic(() => import("./sections/NowShowingSection"), { ssr: false });
```

If NowShowingSection is already imported statically (e.g., `import NowShowingSection from "./sections/NowShowingSection"`), convert it to a dynamic import since it's below the fold.

- [ ] **Step 3: Replace the `"cinema"` case**

Find the `"cinema"` case in `renderMiddleSection` (around line 422):

```tsx
// BEFORE:
case "cinema":
  return (
    <div
      key="city-pulse-cinema"
      id="city-pulse-cinema"
      data-feed-anchor="true"
      data-index-label="Venues"
      data-block-id="cinema"
      className="mt-8 scroll-mt-28"
    >
      <div className="h-px bg-[var(--twilight)]" />
      <div className="pt-6">
        <LazySection minHeight={300}>
          <VenuesSection portalSlug={portalSlug} />
        </LazySection>
      </div>
    </div>
  );
```

Replace with:

```tsx
// AFTER:
case "cinema":
  return (
    <div
      key="city-pulse-cinema"
      id="city-pulse-cinema"
      data-feed-anchor="true"
      data-index-label="Now Showing"
      data-block-id="cinema"
      className="mt-8 scroll-mt-28"
    >
      <div className="h-px bg-[var(--twilight)]" />
      <div className="pt-6">
        <LazySection minHeight={300}>
          <NowShowingSection portalSlug={portalSlug} />
        </LazySection>
      </div>
    </div>
  );
```

- [ ] **Step 4: Add the `"live_music"` case**

Add a new case right after the `"cinema"` case:

```tsx
case "live_music":
  return (
    <div
      key="city-pulse-live-music"
      id="city-pulse-live-music"
      data-feed-anchor="true"
      data-index-label="Live Music"
      data-block-id="live_music"
      className="mt-8 scroll-mt-28"
    >
      <div className="h-px bg-[var(--twilight)]" />
      <div className="pt-6">
        <LazySection minHeight={300}>
          <LiveMusicSection portalSlug={portalSlug} />
        </LazySection>
      </div>
    </div>
  );
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors. VenuesSection is no longer imported — it may produce an unused import warning if it's still in the file. Remove any remaining VenuesSection import.

- [ ] **Step 6: Commit**

```bash
git add web/components/feed/CityPulseShell.tsx
git commit -m "feat(feed): replace VenuesSection with standalone Now Showing + Live Music blocks"
```

---

### Task 5: Delete Dead Code

**Files:**
- Delete: `web/components/feed/sections/VenuesSection.tsx`
- Delete: `web/components/feed/sections/SeeShowsSection.tsx`

- [ ] **Step 1: Verify VenuesSection is no longer imported**

Run: `cd web && grep -r "VenuesSection" --include="*.tsx" --include="*.ts" | grep -v "node_modules"`

Expected: No results (or only the file itself if not yet deleted).

- [ ] **Step 2: Verify SeeShowsSection is not imported**

Run: `cd web && grep -r "SeeShowsSection" --include="*.tsx" --include="*.ts" | grep -v "node_modules" | grep -v ".md"`

Expected: Only the file itself.

- [ ] **Step 3: Delete both files**

```bash
rm web/components/feed/sections/VenuesSection.tsx
rm web/components/feed/sections/SeeShowsSection.tsx
```

- [ ] **Step 4: Verify TypeScript compiles and tests pass**

Run: `cd web && npx tsc --noEmit && npx vitest run`
Expected: Clean compile, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete VenuesSection and SeeShowsSection (replaced by standalone blocks)"
```

---

### Task 6: Browser Test

- [ ] **Step 1: Run dev server and test**

Run: `cd web && npm run dev`

Open `http://localhost:3000/atlanta`. Scroll through the feed and verify:

1. **Now Showing section exists** — Film carousel with theater cards, poster strips, showtimes. Has its own "Now Showing" section header with vibe accent.
2. **Live Music section exists below it** — Has "Live Music" section header with magenta accent and MusicNote icon. Genre filter strip, tonight carousel (if shows today), venue directory (max 6 venues).
3. **No "Venues" tabbed section** — the 7-tab section is gone.
4. **Feed index** — City Field Guide shows "Now Showing" and "Live Music" as separate anchors (not "Venues").
5. **No Comedy/Theater/Nightlife/Arts/Attractions tabs** — these are gone from the feed (covered by LineupSection + PlacesToGo).
6. **Overflow link** — if >6 music venues, "+N more venues →" link appears.
7. **Genre filter works** — clicking genre chips filters tonight carousel + venue directory.
8. **No console errors.**

- [ ] **Step 2: Test at 375px mobile viewport**

- Both sections render cleanly
- Tonight carousel scrolls horizontally with snap
- Genre chips scroll without overflow
- Venue cards are full-width

---

## Post-Implementation Verification

```bash
cd web && npx tsc --noEmit && npx vitest run
```

Browser-test at both desktop and 375px mobile.
