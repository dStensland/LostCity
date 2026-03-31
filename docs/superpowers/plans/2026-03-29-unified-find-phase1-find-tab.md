# Unified Find — Phase 1: Find Tab & Discovery Cards

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Happening + Places tabs with a unified "Find" tab featuring a "Right Now" temporal stream, vertical lane sections, context-adaptive cards, and lane drill-in views.

**Architecture:** New `FindView` component replaces `HappeningView` + `SpotsFinder`. `DiscoveryCard` component with discriminated union dispatches to per-vertical compact/expanded renderers. Lane views reuse existing `/api/spots` and `/api/whats-on/*` APIs. URL migration via `normalizeFinURLParams()` utility.

**Tech Stack:** Next.js 16, React, Tailwind v4, existing Supabase API routes

**Spec:** `docs/superpowers/specs/2026-03-29-unified-find-and-detail-redesign.md` — Sections 1, 2, 5, 6, 7

**Depends on:** Phase 0 (data layer) must be complete — `place_vertical_details.google` must be wired into `/api/spots`.

---

### Task 1: Update navigation — replace Happening + Places with Find

**Files:**
- Modify: `web/components/headers/StandardHeader.tsx:30-35` (NavTab type)
- Modify: `web/components/headers/StandardHeader.tsx:37-75` (DEFAULT_TABS)
- Modify: `web/components/headers/StandardHeader.tsx:154-193` (getHref)
- Modify: `web/components/headers/StandardHeader.tsx:195-232` (isActive)
- Modify: `web/app/[portal]/page.tsx:136` (ViewMode type)
- Modify: `web/app/[portal]/page.tsx:331-358` (view resolution)
- Modify: `web/app/[portal]/page.tsx:460-511` (view rendering dispatch)

- [ ] **Step 1: Extend NavTab key union**

In `StandardHeader.tsx`, update the `NavTab` type (line 31):

```typescript
type NavTab = {
  key: "feed" | "find" | "happening" | "places" | "community" | "support";
  defaultLabel: string;
  authRequired?: boolean;
  icon?: React.ReactNode;
};
```

- [ ] **Step 2: Replace Happening + Places with Find in DEFAULT_TABS**

Replace the `happening` and `places` entries in `DEFAULT_TABS` with a single `find` entry:

```typescript
{
  key: "find",
  defaultLabel: "Find",
  icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
      <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
    </svg>
  ),
},
```

Keep `feed` as the first tab and `community` after `find`.

- [ ] **Step 3: Add Find case to getHref()**

Add to the `getHref` function (after the feed case):

```typescript
} else if (tab.key === "find") {
  params.set("view", "find");
  params.delete("content");
  params.delete("tab");
  params.delete("type");
  params.delete("display");
  params.delete("lane");
```

- [ ] **Step 4: Add Find case to isActive()**

Add to the `isActive` function:

```typescript
if (tab.key === "find") {
  return currentView === "find" || currentView === "happening" || currentView === "places";
}
```

This ensures the Find tab shows as active for both legacy and new URL patterns.

- [ ] **Step 5: Update ViewMode type in page.tsx**

```typescript
type ViewMode = "feed" | "find" | "happening" | "places" | "community";
```

- [ ] **Step 6: Add view resolution for "find"**

In the view resolution block (`page.tsx` ~line 331), add before the happening case:

```typescript
} else if (viewParam === "find") {
  viewMode = "find";
```

- [ ] **Step 7: Add view rendering dispatch for "find"**

After the `viewMode === "happening"` block (~line 478), add:

```typescript
{viewMode === "find" && (
  <Suspense fallback={<div data-skeleton-route="find-view" />}>
    <FindView
      portalId={portal.id}
      portalSlug={portalSlug}
      portalSettings={portal.settings}
    />
  </Suspense>
)}
```

Add the dynamic import at the top of the file:

```typescript
const FindView = dynamic(() => import("@/components/find/FindView"), {
  ssr: false,
});
```

- [ ] **Step 8: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: Error — FindView doesn't exist yet. That's expected. The nav changes are correct.

- [ ] **Step 9: Commit navigation changes**

```bash
git add web/components/headers/StandardHeader.tsx web/app/[portal]/page.tsx
git commit -m "feat(nav): replace Happening + Places tabs with unified Find tab"
```

---

### Task 2: Create DiscoveryCard discriminated union and compact renderers

**Files:**
- Create: `web/lib/types/discovery.ts`
- Create: `web/components/cards/DiscoveryCard.tsx`
- Create: `web/components/cards/CompactDiningCard.tsx`
- Create: `web/components/cards/CompactArtsCard.tsx`
- Create: `web/components/cards/CompactOutdoorCard.tsx`
- Create: `web/components/cards/CompactEventCard.tsx`
- Create: `web/components/cards/CompactNightlifeCard.tsx`

- [ ] **Step 1: Define the DiscoveryEntity discriminated union**

Create `web/lib/types/discovery.ts`:

```typescript
export type DiscoveryEntityType = "place" | "event";

export interface DiscoveryPlaceEntity {
  entity_type: "place";
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  place_type: string;
  neighborhood: string | null;
  short_description: string | null;
  is_open: boolean;
  closes_at: string | null;
  google_rating: number | null;
  google_rating_count: number | null;
  price_level: number | null;
  vibes: string[];
  genres: string[];
  distance_km: number | null;
  event_count: number;
  // Vertical-specific inline data
  current_exhibition_title: string | null;
  current_exhibition_status: string | null;
  commitment_tier: string | null;
  best_seasons: string[] | null;
  cuisine: string[] | null;
}

export interface DiscoveryEventEntity {
  entity_type: "event";
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  place_type: string | null;
  neighborhood: string | null;
  venue_name: string | null;
  start_date: string;
  start_time: string | null;
  category_id: string | null;
  is_free: boolean;
  price_min: number | null;
  genres: string[];
}

export type DiscoveryEntity = DiscoveryPlaceEntity | DiscoveryEventEntity;

export type CardFidelity = "compact" | "expanded";

export type VerticalLane =
  | "arts"
  | "dining"
  | "nightlife"
  | "outdoors"
  | "music"
  | "entertainment";

export const LANE_CONFIG: Record<
  VerticalLane,
  { label: string; icon: string; color: string; placeTypes: string[] }
> = {
  arts: {
    label: "Arts & Culture",
    icon: "palette",
    color: "#C9874F",
    placeTypes: ["museum", "gallery", "arts_center", "theater", "cinema"],
  },
  dining: {
    label: "Eat & Drink",
    icon: "fork-knife",
    color: "#FF6B7A",
    placeTypes: ["restaurant", "bar", "brewery", "cocktail_bar", "coffee_shop", "food_hall", "wine_bar", "rooftop", "lounge"],
  },
  nightlife: {
    label: "Nightlife",
    icon: "moon-stars",
    color: "#FF6B7A",
    placeTypes: ["bar", "nightclub", "cocktail_bar", "lounge", "music_venue", "comedy_club", "karaoke", "lgbtq"],
  },
  outdoors: {
    label: "Outdoors",
    icon: "tree",
    color: "#00D9A0",
    placeTypes: ["park", "trail", "recreation", "viewpoint", "landmark"],
  },
  music: {
    label: "Music & Shows",
    icon: "music-notes",
    color: "#A78BFA",
    placeTypes: ["music_venue", "amphitheater", "arena", "stadium"],
  },
  entertainment: {
    label: "Entertainment",
    icon: "ticket",
    color: "#FF6B7A",
    placeTypes: ["arcade", "attraction", "entertainment", "escape_room", "bowling", "zoo", "aquarium"],
  },
};
```

- [ ] **Step 2: Create the DiscoveryCard dispatcher**

Create `web/components/cards/DiscoveryCard.tsx`:

```typescript
"use client";

import type { DiscoveryEntity, CardFidelity } from "@/lib/types/discovery";
import { CompactDiningCard } from "./CompactDiningCard";
import { CompactArtsCard } from "./CompactArtsCard";
import { CompactOutdoorCard } from "./CompactOutdoorCard";
import { CompactEventCard } from "./CompactEventCard";
import { CompactNightlifeCard } from "./CompactNightlifeCard";

// Maps place_type to the correct compact renderer
const PLACE_TYPE_TO_RENDERER: Record<string, React.ComponentType<{ entity: DiscoveryEntity; portalSlug: string }>> = {
  restaurant: CompactDiningCard,
  bar: CompactNightlifeCard,
  brewery: CompactNightlifeCard,
  cocktail_bar: CompactNightlifeCard,
  coffee_shop: CompactDiningCard,
  food_hall: CompactDiningCard,
  museum: CompactArtsCard,
  gallery: CompactArtsCard,
  arts_center: CompactArtsCard,
  theater: CompactArtsCard,
  cinema: CompactArtsCard,
  park: CompactOutdoorCard,
  trail: CompactOutdoorCard,
  recreation: CompactOutdoorCard,
  nightclub: CompactNightlifeCard,
  music_venue: CompactNightlifeCard,
  comedy_club: CompactNightlifeCard,
};

interface DiscoveryCardProps {
  entity: DiscoveryEntity;
  fidelity: CardFidelity;
  portalSlug: string;
}

export function DiscoveryCard({ entity, fidelity, portalSlug }: DiscoveryCardProps) {
  if (fidelity === "expanded") {
    // Expanded renderers — Phase 1b, separate task
    return null;
  }

  // Compact renderers
  if (entity.entity_type === "event") {
    return <CompactEventCard entity={entity} portalSlug={portalSlug} />;
  }

  const Renderer = PLACE_TYPE_TO_RENDERER[entity.place_type] ?? CompactDiningCard;
  return <Renderer entity={entity} portalSlug={portalSlug} />;
}
```

- [ ] **Step 3: Create CompactDiningCard**

Create `web/components/cards/CompactDiningCard.tsx`. Follow the Pencil design (frame `UkWA8` in `design-system.pen`):

```typescript
"use client";

import type { DiscoveryEntity } from "@/lib/types/discovery";
import { ForkKnife, Coffee } from "@phosphor-icons/react";
import Link from "next/link";

interface Props {
  entity: DiscoveryEntity;
  portalSlug: string;
}

export function CompactDiningCard({ entity, portalSlug }: Props) {
  if (entity.entity_type !== "place") return null;

  const isCoffee = entity.place_type === "coffee_shop";
  const Icon = isCoffee ? Coffee : ForkKnife;
  const priceStr = entity.price_level ? "$".repeat(entity.price_level) : null;
  const cuisineStr = entity.cuisine?.slice(0, 2).join(" · ") ?? null;

  return (
    <Link
      href={`/${portalSlug}?spot=${entity.slug}`}
      className="flex items-start gap-3 rounded-[var(--card-radius)] border border-[var(--twilight)] bg-[var(--night)] p-3 transition-colors hover:bg-[var(--dusk)]"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#FF6B7A1A]">
        <Icon size={18} className="text-[#FF6B7A]" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-[var(--cream)]">{entity.name}</span>
          {entity.google_rating && (
            <span className="flex-shrink-0 text-2xs font-semibold text-[#FFD93D]">★ {entity.google_rating}</span>
          )}
        </div>
        <span className="text-2xs text-[var(--soft)]">
          {[cuisineStr, priceStr].filter(Boolean).join(" · ")}
        </span>
        <div className="flex items-center gap-1.5">
          {entity.is_open && (
            <span className="inline-flex items-center gap-1 rounded bg-[#00D9A01A] px-1.5 py-0.5 font-mono text-2xs text-[#00D9A0]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00D9A0]" />
              Open{entity.closes_at ? ` · Closes ${entity.closes_at}` : ""}
            </span>
          )}
          {entity.neighborhood && (
            <span className="text-2xs text-[var(--muted)]">{entity.neighborhood}</span>
          )}
          {entity.distance_km != null && (
            <span className="font-mono text-2xs text-[#00D9A0]">{entity.distance_km.toFixed(1)} mi</span>
          )}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Create remaining compact card renderers**

Create `CompactArtsCard.tsx`, `CompactOutdoorCard.tsx`, `CompactEventCard.tsx`, `CompactNightlifeCard.tsx` following the same pattern but with vertical-specific data:

**CompactArtsCard** — copper icon bg (`#C9874F1A`), Palette icon, inline exhibition badge when `current_exhibition_title` exists
**CompactOutdoorCard** — green icon bg (`#00D9A01A`), Tree icon, commitment tier badge, best_seasons proxy badge
**CompactEventCard** — different structure: 3px coral accent border + time block (JetBrains Mono) + content. Uses vibe purple `#A78BFA` for music, coral for other events. Shares the same outer container treatment (rounded, bordered, card-bg).
**CompactNightlifeCard** — coral icon bg, MoonStars icon, vibes chips, tonight's event count if available

Each file follows the same interface: `{ entity: DiscoveryEntity; portalSlug: string }`.

- [ ] **Step 5: Run type check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/lib/types/discovery.ts web/components/cards/
git commit -m "feat(cards): create DiscoveryCard system with compact per-vertical renderers"
```

---

### Task 3: Build FindView — unified stream with Right Now + lane sections

**Files:**
- Create: `web/components/find/FindView.tsx`
- Create: `web/components/find/RightNowSection.tsx`
- Create: `web/components/find/LanePreviewSection.tsx`
- Create: `web/lib/hooks/useRightNow.ts`
- Create: `web/lib/hooks/useLanePreview.ts`

- [ ] **Step 1: Create useRightNow hook**

Create `web/lib/hooks/useRightNow.ts`:

```typescript
"use client";

import { useState, useEffect } from "react";
import type { DiscoveryEntity } from "@/lib/types/discovery";

export function useRightNow(portalSlug: string) {
  const [items, setItems] = useState<DiscoveryEntity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    fetch(`/api/find/right-now?portal=${portalSlug}&limit=6`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("[useRightNow] fetch error:", err);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [portalSlug]);

  return { items, loading };
}
```

- [ ] **Step 2: Create RightNowSection component**

Create `web/components/find/RightNowSection.tsx`:

```typescript
"use client";

import { useRightNow } from "@/lib/hooks/useRightNow";
import { DiscoveryCard } from "@/components/cards/DiscoveryCard";

interface Props {
  portalSlug: string;
}

export function RightNowSection({ portalSlug }: Props) {
  const { items, loading } = useRightNow(portalSlug);

  if (!loading && items.length === 0) return null;

  const now = new Date();
  const hour = now.getHours();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const label = hour >= 22 || hour < 6 ? "Open Now" : "Right Now";

  return (
    <section className="flex flex-col gap-3 px-4 pb-2 pt-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-[var(--cream)]">{label}</h2>
        <span className="text-sm text-[var(--muted)]">· {dayName} {timeStr}</span>
      </div>
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-[var(--card-radius)] bg-[var(--dusk)]" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <DiscoveryCard
              key={`${item.entity_type}-${item.id}`}
              entity={item}
              fidelity="compact"
              portalSlug={portalSlug}
            />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Create LanePreviewSection component**

Create `web/components/find/LanePreviewSection.tsx`. This renders a single lane's header + 2-3 preview cards + "See all →" link:

```typescript
"use client";

import { useEffect, useState } from "react";
import type { DiscoveryEntity, VerticalLane } from "@/lib/types/discovery";
import { LANE_CONFIG } from "@/lib/types/discovery";
import { DiscoveryCard } from "@/components/cards/DiscoveryCard";
import { Icon } from "@phosphor-icons/react";
import Link from "next/link";

interface Props {
  lane: VerticalLane;
  portalSlug: string;
}

export function LanePreviewSection({ lane, portalSlug }: Props) {
  const config = LANE_CONFIG[lane];
  const [items, setItems] = useState<DiscoveryEntity[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const venueTypes = config.placeTypes.join(",");
    fetch(`/api/spots?portal=${portalSlug}&venue_type=${venueTypes}&limit=3`)
      .then((res) => res.json())
      .then((data) => {
        const mapped: DiscoveryEntity[] = data.map((s: Record<string, unknown>) => ({
          entity_type: "place" as const,
          id: s.id,
          name: s.name,
          slug: s.slug,
          image_url: s.image_url,
          place_type: s.place_type,
          neighborhood: s.neighborhood,
          short_description: s.short_description,
          is_open: s.is_open ?? false,
          closes_at: s.closes_at ?? null,
          google_rating: s.google_rating ?? null,
          google_rating_count: s.google_rating_count ?? null,
          price_level: s.price_level ?? null,
          vibes: s.vibes ?? [],
          genres: s.genres ?? [],
          distance_km: s.distance_km ?? null,
          event_count: s.event_count ?? 0,
          current_exhibition_title: null,
          current_exhibition_status: null,
          commitment_tier: null,
          best_seasons: null,
          cuisine: s.cuisine ?? null,
        }));
        setItems(mapped);
        setCount(data.length);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [portalSlug, config.placeTypes]);

  if (!loading && items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 px-4 pb-2 pt-4">
      <div className="flex items-center">
        <div className="flex items-center gap-2">
          <span style={{ color: config.color }}>{/* Icon rendered inline */}</span>
          <h2 className="text-base font-bold text-[var(--cream)]">{config.label}</h2>
          {count > 0 && (
            <span
              className="rounded px-1.5 py-0.5 font-mono text-2xs font-semibold uppercase"
              style={{ backgroundColor: `${config.color}1A`, color: config.color }}
            >
              {count} OPEN
            </span>
          )}
        </div>
        <div className="flex-1" />
        <Link
          href={`/${portalSlug}?view=find&lane=${lane}`}
          className="font-mono text-2xs"
          style={{ color: config.color }}
        >
          See all →
        </Link>
      </div>
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-[var(--card-radius)] bg-[var(--dusk)]" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <DiscoveryCard
              key={`${item.entity_type}-${item.id}`}
              entity={item}
              fidelity="compact"
              portalSlug={portalSlug}
            />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Create FindView shell**

Create `web/components/find/FindView.tsx`:

```typescript
"use client";

import { useSearchParams } from "next/navigation";
import { RightNowSection } from "./RightNowSection";
import { LanePreviewSection } from "./LanePreviewSection";
import type { VerticalLane } from "@/lib/types/discovery";

interface Props {
  portalId: number;
  portalSlug: string;
  portalSettings: Record<string, unknown>;
}

// Default lane order — adjusted by portal identity
function getLaneOrder(portalSettings: Record<string, unknown>): VerticalLane[] {
  const defaultOrder: VerticalLane[] = ["arts", "dining", "nightlife", "outdoors", "music", "entertainment"];
  const vertical = portalSettings?.vertical as string | undefined;

  // Portal-level reordering: put the portal's primary vertical first
  const verticalToLane: Record<string, VerticalLane> = {
    arts: "arts",
    adventure: "outdoors",
    family: "entertainment",
    citizen: "arts",
  };

  const primaryLane = vertical ? verticalToLane[vertical] : undefined;
  if (primaryLane) {
    return [primaryLane, ...defaultOrder.filter((l) => l !== primaryLane)];
  }

  return defaultOrder;
}

export default function FindView({ portalId, portalSlug, portalSettings }: Props) {
  const searchParams = useSearchParams();
  const laneParam = searchParams?.get("lane");
  const regularsParam = searchParams?.get("regulars");

  // If a lane is selected, render the lane drill-in view (Task 4)
  // If regulars=true, render RegularsView (reuse existing)
  // Otherwise, render the unified stream

  const lanes = getLaneOrder(portalSettings);

  return (
    <div className="flex flex-col">
      {/* Search bar */}
      <div className="px-4 py-2">
        <div className="flex h-[44px] items-center gap-2 rounded-[var(--input-radius)] bg-[var(--dusk)] px-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="text-[var(--muted)]" viewBox="0 0 256 256">
            <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
          </svg>
          <span className="text-sm text-[var(--muted)]">Search places, events, artists...</span>
        </div>
      </div>

      {/* Right Now section */}
      <RightNowSection portalSlug={portalSlug} />

      {/* Vertical lane sections */}
      {lanes.map((lane) => (
        <div key={lane}>
          <div className="mx-4 h-px bg-[var(--twilight)] opacity-50" />
          <LanePreviewSection lane={lane} portalSlug={portalSlug} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run type check and dev server test**

Run: `cd web && npx tsc --noEmit`
Expected: PASS

Start dev server, navigate to `http://localhost:3000/atlanta?view=find`
Expected: Find view renders with Right Now section + lane preview sections

- [ ] **Step 6: Commit**

```bash
git add web/components/find/FindView.tsx web/components/find/RightNowSection.tsx web/components/find/LanePreviewSection.tsx web/lib/hooks/useRightNow.ts
git commit -m "feat(find): create unified FindView with Right Now + lane preview sections"
```

---

### Task 4: Build lane drill-in view with expanded cards

**Files:**
- Create: `web/components/find/LaneView.tsx`
- Create: `web/components/find/LaneFilterBar.tsx`
- Create: `web/components/cards/ExpandedArtsCard.tsx`
- Create: `web/components/cards/ExpandedDiningCard.tsx`
- Create: `web/components/cards/ExpandedDefaultCard.tsx`
- Modify: `web/components/find/FindView.tsx` (add lane routing)

This is the "See all →" view for a vertical lane with expanded cards, filter chips, and summary bar. Implement one expanded card type fully (Arts) and a default fallback, then add others incrementally.

- [ ] **Step 1–6: Build LaneView, LaneFilterBar, ExpandedArtsCard, wire into FindView**

(Follow the same Pencil design patterns from frames `SF9JL` for mobile and `22TQy` for desktop. LaneView wraps the existing `/api/spots` fetch with lane-specific filters. ExpandedArtsCard shows hero image, type badge, exhibition inline block, metadata row, description.)

- [ ] **Step 7: Commit**

```bash
git add web/components/find/LaneView.tsx web/components/find/LaneFilterBar.tsx web/components/cards/Expanded*.tsx
git commit -m "feat(find): add lane drill-in view with expanded vertical-aware cards"
```

---

### Task 5: URL migration utility

**Files:**
- Create: `web/lib/normalize-find-url.ts`
- Create: `web/lib/__tests__/normalize-find-url.test.ts`
- Modify: `web/app/[portal]/page.tsx` (apply normalization)

- [ ] **Step 1: Write failing tests**

Create `web/lib/__tests__/normalize-find-url.test.ts`:

```typescript
import { normalizeFinURLParams } from "../normalize-find-url";

describe("normalizeFinURLParams", () => {
  it("redirects ?view=happening to ?view=find", () => {
    const params = new URLSearchParams("view=happening");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
  });

  it("redirects ?view=places to ?view=find", () => {
    const params = new URLSearchParams("view=places");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
  });

  it("redirects ?view=events to ?view=find", () => {
    const params = new URLSearchParams("view=events");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
  });

  it("redirects ?view=spots to ?view=find", () => {
    const params = new URLSearchParams("view=spots");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
  });

  it("redirects ?content=showtimes to ?view=find&lane=music", () => {
    const params = new URLSearchParams("content=showtimes");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("music");
    expect(result.has("content")).toBe(false);
  });

  it("redirects ?tab=eat-drink to ?view=find&lane=dining", () => {
    const params = new URLSearchParams("tab=eat-drink");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("dining");
    expect(result.has("tab")).toBe(false);
  });

  it("preserves filter params through redirects", () => {
    const params = new URLSearchParams("view=happening&venue_type=restaurant&neighborhoods=Midtown");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
    expect(result.get("venue_type")).toBe("restaurant");
    expect(result.get("neighborhoods")).toBe("Midtown");
  });

  it("redirects ?view=map to ?view=find&display=map", () => {
    const params = new URLSearchParams("view=map");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
    expect(result.get("display")).toBe("map");
  });

  it("does not modify ?view=find", () => {
    const params = new URLSearchParams("view=find&lane=arts");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("arts");
  });

  it("does not modify non-find views", () => {
    const params = new URLSearchParams("view=feed");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("feed");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run lib/__tests__/normalize-find-url.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement normalizeFinURLParams**

Create `web/lib/normalize-find-url.ts`:

```typescript
const LEGACY_FIND_VIEWS = new Set(["happening", "places", "events", "spots"]);
const DISPLAY_VIEWS = new Set(["map", "calendar"]);

const TAB_TO_LANE: Record<string, string> = {
  "eat-drink": "dining",
  "things-to-do": "entertainment",
  nightlife: "nightlife",
};

const CONTENT_TO_LANE: Record<string, string> = {
  showtimes: "music",
  whats_on: "music",
};

const TYPE_TO_LANE: Record<string, string> = {
  showtimes: "music",
  whats_on: "music",
  destinations: "outdoors",
  spots: "outdoors",
};

export function normalizeFinURLParams(params: URLSearchParams): URLSearchParams {
  const result = new URLSearchParams(params.toString());
  const view = result.get("view");
  const tab = result.get("tab");
  const content = result.get("content");
  const type = result.get("type");

  // Legacy view aliases → find
  if (view && LEGACY_FIND_VIEWS.has(view)) {
    result.set("view", "find");
  }

  // Display-mode views → find with display param
  if (view && DISPLAY_VIEWS.has(view)) {
    result.set("view", "find");
    result.set("display", view);
  }

  // Tab → lane mapping
  if (tab && TAB_TO_LANE[tab]) {
    result.set("view", "find");
    result.set("lane", TAB_TO_LANE[tab]);
    result.delete("tab");
  }

  // Content → lane mapping
  if (content && CONTENT_TO_LANE[content]) {
    result.set("view", "find");
    result.set("lane", CONTENT_TO_LANE[content]);
    result.delete("content");
  }

  // Type → lane mapping (only if view is now find)
  if (type && TYPE_TO_LANE[type] && result.get("view") === "find") {
    if (!result.has("lane")) {
      result.set("lane", TYPE_TO_LANE[type]);
    }
    result.delete("type");
  }

  // Regulars
  if (content === "regulars") {
    result.set("view", "find");
    result.set("regulars", "true");
    result.delete("content");
  }

  return result;
}
```

- [ ] **Step 4: Run tests**

Run: `cd web && npx vitest run lib/__tests__/normalize-find-url.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Wire into page.tsx view resolution**

In `web/app/[portal]/page.tsx`, import and apply normalization early in the server component (before the view resolution block):

```typescript
import { normalizeFinURLParams } from "@/lib/normalize-find-url";

// Inside the component, before view resolution:
const rawParams = new URLSearchParams(searchParams?.toString() || "");
const normalizedParams = normalizeFinURLParams(rawParams);
const viewParam = normalizedParams.get("view") || "";
```

- [ ] **Step 6: Commit**

```bash
git add web/lib/normalize-find-url.ts web/lib/__tests__/normalize-find-url.test.ts web/app/[portal]/page.tsx
git commit -m "feat(routing): add normalizeFinURLParams with URL migration for legacy Happening/Places patterns"
```

---

### Task 6: Desktop sidebar layout

**Files:**
- Create: `web/components/find/FindSidebar.tsx`
- Modify: `web/components/find/FindView.tsx` (desktop responsive layout)

Build the sidebar with lane navigation, search, count badges, and date/weather context as designed in frame `22TQy`. Uses `@media (min-width: 1024px)` to show sidebar on desktop, hide on mobile.

- [ ] **Step 1–4: Build FindSidebar, wire into FindView with responsive layout**

(Follow Pencil design frame `22TQy`. Sidebar is 240px fixed, main content fills remaining width. Active lane highlighted with accent color bg. Count badges per lane.)

- [ ] **Step 5: Commit**

```bash
git add web/components/find/FindSidebar.tsx web/components/find/FindView.tsx
git commit -m "feat(find): add desktop sidebar with lane navigation"
```

---

### Task 7: Wire artist param into DetailViewRouter

**Files:**
- Modify: `web/components/views/DetailViewRouter.tsx:60-64` (param reading)
- Modify: `web/components/views/DetailViewRouter.tsx:73-82` (closeFallbackUrl)
- Modify: `web/app/[portal]/page.tsx` (PortalSearchParams)

- [ ] **Step 1: Add artist param reading**

In `DetailViewRouter.tsx`, after `const orgSlug = searchParams.get("org");` (line 64):

```typescript
const artistSlug = searchParams.get("artist");
```

- [ ] **Step 2: Add artist to closeFallbackUrl cleanup**

In the `closeFallbackUrl` useMemo, after `params.delete("org");`:

```typescript
params.delete("artist");
```

- [ ] **Step 3: Add artist to PortalSearchParams**

In `page.tsx`, add `artist` to the search params that get passed through.

- [ ] **Step 4: Add artist detail view branch (placeholder)**

In the detail view branching, after the org case:

```typescript
} else if (artistSlug) {
  // ArtistDetailView — conditional on data audit (Phase 3)
  // Placeholder: shows nothing until Phase 3 ships
}
```

- [ ] **Step 5: Commit**

```bash
git add web/components/views/DetailViewRouter.tsx web/app/[portal]/page.tsx
git commit -m "feat(routing): add artist param to DetailViewRouter for future ArtistDetailView"
```
