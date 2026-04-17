# Music Festivals-on-the-Horizon Implementation Plan (Phase 3b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `Festivals on the Horizon` zone to `/{portal}/explore/music` — horizontally scrollable cards leading with the days-away gap (`47 DAYS`) rather than festival name. Pulls from the Phase 1 `/api/music/festivals-horizon` endpoint.

**Architecture:**
- Single new component (`MusicFestivalHorizonStrip`) rendered after `ByVenueView`/`ByShowView` but before the `MusicResidencyStrip` on the explore page.
- Reads from the `loadFestivalsHorizon` server loader — already shipped in Plan 1.

**Tech Stack:** React, Tailwind v4, TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-17-live-music-feed-and-explore-design.md` §7.7

**Depends on:** Plans 1 + 3a shipped.

---

## File Structure

### Create
- `web/components/explore/music/MusicFestivalHorizonStrip.tsx`
- `web/components/explore/music/MusicFestivalCard.tsx`
- `web/components/explore/music/MusicFestivalHorizonStrip.test.tsx`

### Modify
- `web/components/explore/music/MusicPageClient.tsx` — add the strip between main view and residencies
- `web/app/[portal]/explore/music/page.tsx` — add `loadFestivalsHorizon` call; pass payload to client

---

## Task 1: `MusicFestivalCard`

**Files:**
- Create: `web/components/explore/music/MusicFestivalCard.tsx`

- [ ] **Step 1: Implement**

```tsx
// web/components/explore/music/MusicFestivalCard.tsx
"use client";

import SmartImage from "@/components/SmartImage";
import { buildFestivalUrl } from "@/lib/entity-urls";
import type { FestivalHorizonPayload } from "@/lib/music/types";

export interface MusicFestivalCardProps {
  festival: FestivalHorizonPayload["festivals"][number];
  portalSlug: string;
}

function formatRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sLabel = s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (start === end) return sLabel;
  const eLabel = e.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${sLabel}–${eLabel}`;
}

export function MusicFestivalCard({ festival, portalSlug }: MusicFestivalCardProps) {
  const url = buildFestivalUrl(festival.slug, portalSlug);
  return (
    <a
      href={url}
      className="flex-shrink-0 w-[220px] rounded-card overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40 hover-lift"
    >
      <div className="relative h-28 bg-[var(--twilight)]/20">
        {festival.image_url ? (
          <SmartImage src={festival.image_url} alt={festival.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--muted)] font-mono text-xs">
            {festival.name.slice(0, 3).toUpperCase()}
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="font-mono text-2xl font-bold tracking-wider uppercase text-[var(--gold)]">
          {festival.days_away} DAYS
        </div>
        <div className="text-lg font-semibold text-[var(--cream)] leading-tight mt-1">
          {festival.name}
        </div>
        <div className="font-mono text-2xs text-[var(--muted)] uppercase tracking-wider mt-1">
          {[formatRange(festival.start_date, festival.end_date), festival.venue_name]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {festival.genre_bucket && (
          <div className="font-mono text-2xs text-[var(--soft)] uppercase tracking-wider mt-1.5">
            {festival.genre_bucket}
          </div>
        )}
        {festival.headliner_teaser && (
          <div className="text-xs italic text-[var(--soft)] mt-1.5 line-clamp-2">
            {festival.headliner_teaser}
          </div>
        )}
      </div>
    </a>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/explore/music/MusicFestivalCard.tsx
git commit -m "feat(music-explore): MusicFestivalCard leading with days-away"
```

---

## Task 2: `MusicFestivalHorizonStrip`

**Files:**
- Create: `web/components/explore/music/MusicFestivalHorizonStrip.tsx`
- Create: `web/components/explore/music/MusicFestivalHorizonStrip.test.tsx`

- [ ] **Step 1: Test**

```tsx
// web/components/explore/music/MusicFestivalHorizonStrip.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MusicFestivalHorizonStrip } from "./MusicFestivalHorizonStrip";

describe("MusicFestivalHorizonStrip", () => {
  it("renders nothing when empty", () => {
    const { container } = render(<MusicFestivalHorizonStrip festivals={[]} portalSlug="atlanta" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders header + cards when non-empty", () => {
    render(<MusicFestivalHorizonStrip festivals={[
      {
        id: "f1", slug: "shaky-knees", name: "Shaky Knees",
        start_date: "2026-05-01", end_date: "2026-05-03",
        venue_name: "Central Park", neighborhood: "Old Fourth Ward",
        days_away: 14, headliner_teaser: "Three-day indie rock lineup",
        genre_bucket: "Rock", image_url: null,
      },
    ]} portalSlug="atlanta" />);
    expect(screen.getByText(/Festivals on the Horizon/i)).toBeInTheDocument();
    expect(screen.getByText(/14 DAYS/)).toBeInTheDocument();
    expect(screen.getByText(/Shaky Knees/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// web/components/explore/music/MusicFestivalHorizonStrip.tsx
"use client";

import { MusicFestivalCard } from "./MusicFestivalCard";
import type { FestivalHorizonPayload } from "@/lib/music/types";

export interface MusicFestivalHorizonStripProps {
  festivals: FestivalHorizonPayload["festivals"];
  portalSlug: string;
}

export function MusicFestivalHorizonStrip({
  festivals, portalSlug,
}: MusicFestivalHorizonStripProps) {
  if (festivals.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <div className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--gold)]">
          Festivals on the Horizon
        </div>
        <div className="text-xs italic text-[var(--muted)]">Within 90 days.</div>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-4 px-4 pb-2">
        {festivals.map((f) => (
          <div key={f.id} className="snap-start">
            <MusicFestivalCard festival={f} portalSlug={portalSlug} />
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Run + commit**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run components/explore/music/MusicFestivalHorizonStrip.test.tsx
git add web/components/explore/music/MusicFestivalHorizonStrip.tsx web/components/explore/music/MusicFestivalHorizonStrip.test.tsx
git commit -m "feat(music-explore): MusicFestivalHorizonStrip"
```

---

## Task 3: Integrate into page

**Files:**
- Modify: `web/app/[portal]/explore/music/page.tsx`
- Modify: `web/components/explore/music/MusicPageClient.tsx`

- [ ] **Step 1: Add loader call to page**

```typescript
// in page.tsx — add import:
import { loadFestivalsHorizon } from "@/lib/music/festivals-horizon-loader";

// in the Promise.all:
const [thisWeek, byVenue, byShow, residencies, festivals] = await Promise.all([
  loadThisWeek(portal),
  loadByVenue(portal, { date, pinned_slugs: pinnedSlugs }),
  loadByShow(portal, { date, days: 7 }),
  loadResidencies(portal),
  loadFestivalsHorizon(portal),
]);

// pass to client:
return (
  <MusicPageClient
    ... // existing props
    festivals={festivals}
  />
);
```

- [ ] **Step 2: Render in client**

```typescript
// MusicPageClient.tsx:
// Add prop type:
festivals: FestivalHorizonPayload;

// In the JSX, render after main view, before residencies:
<MusicFestivalHorizonStrip festivals={festivals.festivals} portalSlug={portalSlug} />
```

- [ ] **Step 3: Browser-verify**

Load `http://localhost:3000/atlanta/explore/music` — scroll past By Venue to confirm the festivals strip renders (only if there are festivals in the next 90 days; on dev DB with no upcoming festivals, nothing renders — that's correct).

- [ ] **Step 4: Commit**

```bash
git add web/app/\[portal\]/explore/music/page.tsx web/components/explore/music/MusicPageClient.tsx
git commit -m "feat(music-explore): wire MusicFestivalHorizonStrip into explore page"
```

---

## Completion Checklist

- [ ] Strip renders on page when festivals exist
- [ ] Strip hides entirely when none
- [ ] Card links route to `buildFestivalUrl(slug, portal)`
- [ ] All tests green
- [ ] `tsc --noEmit` clean
