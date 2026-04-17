# Music Just-Announced / On-Sale Implementation Plan (Phase 3c)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `Just Announced · On Sale Now` zone to `/{portal}/explore/music` — compressed horizontal carousel of shows 2–6 months out, sorted by `created_at` DESC (v1 proxy for "newly announced"; v2 uses dedicated crawler field).

**Architecture:**
- Single component `MusicOnSaleStrip` rendered at the bottom of the explore page (after festivals-on-horizon, after residencies).
- Uses existing `loadOnSale` from Plan 1.

**Tech Stack:** React, Tailwind v4, TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-17-live-music-feed-and-explore-design.md` §7.8

**Depends on:** Plans 1 + 3a shipped.

---

## File Structure

### Create
- `web/components/explore/music/MusicOnSaleStrip.tsx`
- `web/components/explore/music/MusicOnSaleCard.tsx`
- `web/components/explore/music/MusicOnSaleStrip.test.tsx`

### Modify
- `web/components/explore/music/MusicPageClient.tsx` — add strip
- `web/app/[portal]/explore/music/page.tsx` — call loader

---

## Task 1: `MusicOnSaleCard`

**Files:**
- Create: `web/components/explore/music/MusicOnSaleCard.tsx`

- [ ] **Step 1: Implement**

```tsx
// web/components/explore/music/MusicOnSaleCard.tsx
"use client";

import SmartImage from "@/components/SmartImage";
import { buildEventUrl } from "@/lib/entity-urls";
import type { MusicShowPayload } from "@/lib/music/types";

export interface MusicOnSaleCardProps {
  show: MusicShowPayload;
  portalSlug: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

export function MusicOnSaleCard({ show, portalSlug }: MusicOnSaleCardProps) {
  const headliner = show.artists.find((a) => a.is_headliner) ?? show.artists[0];
  const img = show.image_url ?? show.venue.image_url;
  const url = buildEventUrl(show.id, portalSlug, "page");  // page context — not overlay
  const isSoldOut = show.ticket_status === "sold-out";

  return (
    <a
      href={url}
      className="flex-shrink-0 w-[180px] rounded-card overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40 hover-lift"
    >
      <div className="relative h-[180px] bg-[var(--twilight)]/20">
        {img ? (
          <SmartImage src={img} alt={headliner?.name ?? show.title} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--muted)] font-mono text-xs p-2 text-center">
            {show.genre_buckets[0] ?? headliner?.name.slice(0, 3).toUpperCase()}
          </div>
        )}
        <span className={[
          "absolute top-2 left-2 font-mono text-2xs font-bold tracking-widest uppercase px-2 py-0.5",
          isSoldOut ? "bg-[var(--coral)] text-[var(--void)]" : "bg-[var(--gold)] text-[var(--void)]",
        ].join(" ")}>
          {isSoldOut ? "Sold Out" : "On Sale"}
        </span>
      </div>
      <div className="p-3">
        <div className="text-base font-semibold text-[var(--cream)] leading-tight line-clamp-2">
          {headliner?.name ?? show.title}
        </div>
        <div className="font-mono text-2xs text-[var(--muted)] uppercase tracking-wider mt-1">
          {[show.venue.name, formatDate(show.start_date)].filter(Boolean).join(" · ")}
        </div>
        {show.genre_buckets[0] && (
          <div className="font-mono text-2xs text-[var(--soft)] uppercase tracking-wider mt-1">
            {show.genre_buckets[0]}
          </div>
        )}
      </div>
    </a>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/explore/music/MusicOnSaleCard.tsx
git commit -m "feat(music-explore): MusicOnSaleCard poster-shape"
```

---

## Task 2: `MusicOnSaleStrip`

**Files:**
- Create: `web/components/explore/music/MusicOnSaleStrip.tsx`
- Create: `web/components/explore/music/MusicOnSaleStrip.test.tsx`

- [ ] **Step 1: Test**

```tsx
// web/components/explore/music/MusicOnSaleStrip.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MusicOnSaleStrip } from "./MusicOnSaleStrip";

describe("MusicOnSaleStrip", () => {
  it("returns null when empty", () => {
    const { container } = render(<MusicOnSaleStrip shows={[]} portalSlug="atlanta" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders header when non-empty", () => {
    render(<MusicOnSaleStrip portalSlug="atlanta" shows={[{
      id: 1, title: "Lucius", start_date: "2026-12-15", start_time: "20:00",
      doors_time: null, image_url: null, is_free: false, is_curator_pick: false,
      is_tentpole: false, importance: null, festival_id: null,
      ticket_status: "tickets-available", ticket_url: null, age_policy: null,
      featured_blurb: null, tags: [], genres: [], genre_buckets: ["Pop/Singer-Songwriter"],
      venue: { id: 1, name: "Variety Playhouse", slug: "variety-playhouse", neighborhood: "L5P",
               image_url: null, hero_image_url: null, music_programming_style: "curated_indie",
               music_venue_formats: [], capacity: 1050, editorial_line: null,
               display_tier: "editorial", capacity_band: "theater" },
      artists: [{ id: null, slug: null, name: "Lucius", is_headliner: true, billing_order: 1 }],
    }]} />);
    expect(screen.getByText(/Just Announced/i)).toBeInTheDocument();
    expect(screen.getByText(/Lucius/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// web/components/explore/music/MusicOnSaleStrip.tsx
"use client";

import { MusicOnSaleCard } from "./MusicOnSaleCard";
import type { MusicShowPayload } from "@/lib/music/types";

export interface MusicOnSaleStripProps {
  shows: MusicShowPayload[];
  portalSlug: string;
}

export function MusicOnSaleStrip({ shows, portalSlug }: MusicOnSaleStripProps) {
  if (shows.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <div className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--gold)]">
          Just Announced · On Sale Now
        </div>
        <div className="text-xs italic text-[var(--muted)]">Plan ahead.</div>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-4 px-4 pb-2">
        {shows.map((show) => (
          <div key={show.id} className="snap-start">
            <MusicOnSaleCard show={show} portalSlug={portalSlug} />
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Run + commit**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run components/explore/music/MusicOnSaleStrip.test.tsx
git add web/components/explore/music/MusicOnSaleStrip.tsx web/components/explore/music/MusicOnSaleStrip.test.tsx
git commit -m "feat(music-explore): MusicOnSaleStrip — just announced carousel"
```

---

## Task 3: Integrate into page

**Files:**
- Modify: `web/app/[portal]/explore/music/page.tsx`
- Modify: `web/components/explore/music/MusicPageClient.tsx`

- [ ] **Step 1: Page server component**

```typescript
// page.tsx additions:
import { loadOnSale } from "@/lib/music/on-sale-loader";

const [thisWeek, byVenue, byShow, residencies, festivals, onSale] = await Promise.all([
  loadThisWeek(portal),
  loadByVenue(portal, { date, pinned_slugs: pinnedSlugs }),
  loadByShow(portal, { date, days: 7 }),
  loadResidencies(portal),
  loadFestivalsHorizon(portal),
  loadOnSale(portal),
]);

return (
  <MusicPageClient
    ...
    onSale={onSale}
  />
);
```

- [ ] **Step 2: Client wrapper**

```typescript
// MusicPageClient.tsx:
// Add prop:
onSale: OnSalePayload;

// Render at the end (after festivals horizon, after residencies):
<MusicOnSaleStrip shows={onSale.shows} portalSlug={portalSlug} />
```

- [ ] **Step 3: Browser verify**

Load the explore page; confirm strip appears (only if there are events 60–180 days out — may be empty on a dev DB).

- [ ] **Step 4: Commit**

```bash
git add web/app/\[portal\]/explore/music/page.tsx web/components/explore/music/MusicPageClient.tsx
git commit -m "feat(music-explore): wire MusicOnSaleStrip into explore page"
```

---

## Task 4: V2 follow-up note — dedicated on_sale_date field

**Files:** `docs/superpowers/specs/2026-04-17-live-music-feed-and-explore-design.md` (spec amendment note)

**Context:** Per spec §11.5 + data review: v1 uses `created_at DESC` as a proxy for "just announced." This over-promises in practice — events created recently include backlog imports, not just newly-announced shows. Follow-up: crawler-populated `events.on_sale_date` column.

- [ ] **Step 1: Append a note to the spec**

Edit the spec to add under §11 open questions:

```markdown
7. **On-sale proxy is imperfect.** V1 uses `created_at DESC` for the Just Announced strip. This surfaces recently-ingested events, not just recently-announced. Fix path: add `events.on_sale_date` column + crawler extraction (e.g., Ticketmaster/AXS announce timestamps). Track as v1.5 crawler work.
```

- [ ] **Step 2: Commit the note**

```bash
git add docs/superpowers/specs/2026-04-17-live-music-feed-and-explore-design.md
git commit -m "docs(specs): note on_sale_date as v1.5 crawler follow-up"
```

---

## Completion Checklist

- [ ] Strip renders on page
- [ ] Empty state handled (no render)
- [ ] Card links route canonically
- [ ] Spec amendment committed
- [ ] Tests green
