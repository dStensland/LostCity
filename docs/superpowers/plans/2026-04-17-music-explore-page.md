# /{portal}/explore/music — Page Implementation Plan (Phase 3a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the standalone `/{portal}/explore/music` page: shell + date strip + view toggle + filter chips + This Week hero (large) + `By Venue` default view + `By Show` toggle view + Residencies section. The venue view carries My Venues (pinned) → Editorial → Marquee → Additional (opt-in) ordering. Uses Phase 1 APIs and shares chip / action-sheet primitives with Plan 2's feed widget.

**Architecture:**
- New track under existing `ExploreSurface` pattern — `/{portal}/explore/music` routes through `app/[portal]/explore/[track]/page.tsx` via an editorial-guide registration.
- Page composition: server-rendered shell with client islands for view toggle, filter chips, and the action sheet.
- Data from Phase 1 loaders (`this-week`, `by-venue`, `by-show`, `residencies`). Called directly server-side (no self-fetch).
- Pinning (`My Venues`): new API route `POST/DELETE /api/music/venue-pins` + `user_venue_pins` table (new migration).
- Reuses `MusicShowtimeChip` + `MusicActionSheet` from Plan 2.

**Tech Stack:** Next.js 16 App Router, React, Tailwind v4, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-17-live-music-feed-and-explore-design.md` §7

**Depends on:** Plan 1 shipped. Plan 2 (feed widget) ships independently but ideally first so shared primitives are in place.

---

## File Structure

### Create — DB + API
- `database/migrations/615_user_venue_pins.sql` — new `user_venue_pins(user_id, portal_id, place_id, pinned_at)` table
- `supabase/migrations/<ts>_user_venue_pins.sql` — parity
- `web/app/api/music/venue-pins/route.ts` — POST, DELETE, GET (scoped to logged-in user + portal)
- `web/app/api/music/venue-pins/route.test.ts`

### Create — page + components
- `web/app/[portal]/explore/music/page.tsx` — **NEW dedicated route** (shadows `[track]` for music specifically; cleaner than editorial-guide indirection)
- `web/app/[portal]/explore/music/layout.tsx` — runtime config
- `web/app/[portal]/explore/music/loading.tsx` — skeleton
- `web/components/explore/music/MusicPageShell.tsx` — top block (breadcrumb + title + subtitle + date strip + view toggle + filters)
- `web/components/explore/music/MusicDateStrip.tsx` — 14-day pill strip
- `web/components/explore/music/MusicViewToggle.tsx` — `[ By Venue ] [ By Show ]`
- `web/components/explore/music/MusicFilterChips.tsx` — genre + utility chips (scrollable)
- `web/components/explore/music/ThisWeekHeroZone.tsx` — enlarged version of LiveTonightHeroStrip (300px tiles, press-less)
- `web/components/explore/music/ByVenueView.tsx` — four-group rendering
- `web/components/explore/music/ByVenueBlock.tsx` — single venue block (editorial vs marquee vs additional variants)
- `web/components/explore/music/ByVenueRow.tsx` — single show row in a venue block
- `web/components/explore/music/ByShowView.tsx` — chronological groups by day
- `web/components/explore/music/ByShowRow.tsx` — single chronological row
- `web/components/explore/music/MusicResidencyStrip.tsx` — horizontal-scroll residency cards
- `web/components/explore/music/MusicResidencyCard.tsx`
- `web/components/explore/music/AdditionalOptInPanel.tsx` — opt-in CTA + browse surface
- `web/components/explore/music/MusicPageClient.tsx` — client wrapper for state (active view, active filters, action sheet)
- Component tests for each above (where logic non-trivial)

### Reused from Plan 2
- `MusicShowtimeChip`, `MusicActionSheet`, `LiveTonightHeroTile` (with size variant prop)

### Modify
- `web/lib/explore-platform/editorial-guides.ts` — ensure `"music"` track is recognized (if not already). If the existing track routing routes through `[track]/page.tsx`, we short-circuit via our new dedicated `/music/page.tsx` which takes precedence (Next.js routes static segments first).

---

## Task 1: Migration — `user_venue_pins` table

**Files:**
- Create: `database/migrations/615_user_venue_pins.sql`
- Create: `supabase/migrations/<ts>_user_venue_pins.sql`

- [ ] **Step 1: Generate + write**

```bash
python3 /Users/coach/Projects/LostCity/database/create_migration_pair.py user_venue_pins
```

```sql
CREATE TABLE IF NOT EXISTS user_venue_pins (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portal_id text NOT NULL,
  place_id integer NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  pinned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, portal_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_user_venue_pins_user_portal
  ON user_venue_pins (user_id, portal_id);

ALTER TABLE user_venue_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own pins"
  ON user_venue_pins FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE user_venue_pins IS
  'Per-portal venue favorites. Tuple (user, portal, place) — portal_id prevents Atlanta pins from leaking to other portals.';
```

- [ ] **Step 2: Apply + verify + commit**

```bash
cd /Users/coach/Projects/LostCity && npx supabase db reset --local

psql "$(npx supabase status -o json | jq -r '.DB_URL')" -c "\d user_venue_pins"

git add database/migrations/615_user_venue_pins.sql supabase/migrations/*_user_venue_pins.sql
git commit -m "feat(db): user_venue_pins table — per-portal venue favorites"
```

---

## Task 2: `/api/music/venue-pins` route

**Files:**
- Create: `web/app/api/music/venue-pins/route.ts`
- Create: `web/app/api/music/venue-pins/route.test.ts`

**Context:** Uses `withAuth` middleware. GET returns pinned venue slugs for current user+portal. POST adds a pin. DELETE removes.

- [ ] **Step 1: Test**

```typescript
// web/app/api/music/venue-pins/route.test.ts
import { describe, expect, it } from "vitest";

describe("/api/music/venue-pins", () => {
  it("GET requires portal query", async () => {
    const res = await fetch("http://localhost:3000/api/music/venue-pins");
    expect(res.status).toBe(400);
  });

  it("GET returns 401 without auth", async () => {
    const res = await fetch("http://localhost:3000/api/music/venue-pins?portal=atlanta");
    expect(res.status).toBe(401);
  });

  // Full flow tested via authenticated e2e in integration suite (out of scope here).
});
```

- [ ] **Step 2: Implement**

```typescript
// web/app/api/music/venue-pins/route.ts
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const runtime = "nodejs";

export const GET = withAuth(async (request, { user, serviceClient }) => {
  const url = new URL(request.url);
  const portal = url.searchParams.get("portal");
  if (!portal) return NextResponse.json({ error: "portal required" }, { status: 400 });

  const { data, error } = await serviceClient
    .from("user_venue_pins")
    .select(`
      place_id,
      pinned_at,
      place:places(slug, name)
    `)
    .eq("user_id", user.id)
    .eq("portal_id", portal)
    .order("pinned_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    pins: (data ?? []).map((p) => {
      const place = p.place as unknown as { slug: string; name: string };
      return { place_id: p.place_id, slug: place.slug, name: place.name, pinned_at: p.pinned_at };
    }),
  });
});

export const POST = withAuth(async (request, { user, serviceClient }) => {
  const body = await request.json() as { portal: string; place_id: number };
  if (!body.portal || !body.place_id) {
    return NextResponse.json({ error: "portal and place_id required" }, { status: 400 });
  }
  const { error } = await serviceClient
    .from("user_venue_pins")
    .upsert({ user_id: user.id, portal_id: body.portal, place_id: body.place_id } as never);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
});

export const DELETE = withAuth(async (request, { user, serviceClient }) => {
  const url = new URL(request.url);
  const portal = url.searchParams.get("portal");
  const placeId = Number(url.searchParams.get("place_id"));
  if (!portal || !placeId) return NextResponse.json({ error: "portal + place_id required" }, { status: 400 });

  const { error } = await serviceClient
    .from("user_venue_pins")
    .delete()
    .eq("user_id", user.id)
    .eq("portal_id", portal)
    .eq("place_id", placeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
});
```

- [ ] **Step 3: Test + commit**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run app/api/music/venue-pins/route.test.ts
git add web/app/api/music/venue-pins
git commit -m "feat(music-explore): /api/music/venue-pins for favorite venue pinning"
```

---

## Task 3: `MusicDateStrip` — 14-day pill strip

**Files:**
- Create: `web/components/explore/music/MusicDateStrip.tsx`
- Create: `web/components/explore/music/MusicDateStrip.test.tsx`

**Context:** Spec §7.1. 14 pills, today gold, past hidden. URL param `?date=YYYY-MM-DD` drives active state. Client component — uses `window.history.replaceState` for instant navigation (per `web/CLAUDE.md` filter rule — never `router.push`).

- [ ] **Step 1: Test**

```tsx
// web/components/explore/music/MusicDateStrip.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MusicDateStrip } from "./MusicDateStrip";

describe("MusicDateStrip", () => {
  it("renders 14 pills", () => {
    render(<MusicDateStrip activeDate="2026-04-20" dateCounts={{}} />);
    expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(14);
  });

  it("highlights the active date", () => {
    render(<MusicDateStrip activeDate="2026-04-20" dateCounts={{}} />);
    const active = screen.getByLabelText("Date 2026-04-20");
    expect(active.getAttribute("aria-current")).toBe("date");
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// web/components/explore/music/MusicDateStrip.tsx
"use client";

import { useCallback } from "react";

export interface MusicDateStripProps {
  activeDate: string;  // YYYY-MM-DD
  dateCounts: Record<string, number>;  // { "2026-04-20": 9, ... }
  onChange?: (dateIso: string) => void;
}

function generateDates(today: Date, n = 14): Date[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

export function MusicDateStrip({ activeDate, dateCounts, onChange }: MusicDateStripProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = generateDates(today);

  const handleClick = useCallback((d: Date) => {
    const iso = d.toISOString().slice(0, 10);
    const url = new URL(window.location.href);
    url.searchParams.set("date", iso);
    window.history.replaceState(null, "", url.toString());
    onChange?.(iso);
  }, [onChange]);

  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="font-mono text-xs tracking-[0.12em] uppercase text-[var(--muted)]">
        The next two weeks
      </div>
    </div>
  );
  // (actual pill row below — omitting the two tiny sections below for brevity; the real file renders the pills)
}
```

Actually, write the full component — no shortcuts:

```tsx
// web/components/explore/music/MusicDateStrip.tsx (full)
"use client";

import { useCallback } from "react";

export interface MusicDateStripProps {
  activeDate: string;
  dateCounts: Record<string, number>;
  onChange?: (dateIso: string) => void;
}

function format(d: Date): { iso: string; dow: string; day: number } {
  const iso = d.toISOString().slice(0, 10);
  return {
    iso,
    dow: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    day: d.getDate(),
  };
}

export function MusicDateStrip({ activeDate, dateCounts, onChange }: MusicDateStripProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const handleClick = useCallback((iso: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("date", iso);
    window.history.replaceState(null, "", url.toString());
    onChange?.(iso);
  }, [onChange]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-xs tracking-[0.12em] uppercase text-[var(--muted)]">
          The next two weeks
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2">
        {dates.map((d) => {
          const { iso, dow, day } = format(d);
          const isActive = iso === activeDate;
          const isToday = iso === today.toISOString().slice(0, 10);
          const count = dateCounts[iso] ?? 0;
          return (
            <button
              key={iso}
              type="button"
              aria-label={`Date ${iso}`}
              aria-current={isActive ? "date" : undefined}
              onClick={() => handleClick(iso)}
              className={[
                "flex-shrink-0 w-[70px] h-[86px] flex flex-col items-center justify-center rounded-md",
                "border transition-colors",
                isActive
                  ? "bg-[var(--vibe)]/20 border-[var(--vibe)]"
                  : "bg-[var(--night)] border-[var(--twilight)] hover:border-[var(--twilight)]/80",
              ].join(" ")}
            >
              <div className={[
                "font-mono text-2xs tracking-wider uppercase",
                isToday ? "text-[var(--gold)]" : "text-[var(--muted)]",
              ].join(" ")}>
                {isToday ? "TODAY" : dow}
              </div>
              <div className="text-2xl font-semibold text-[var(--cream)] leading-none mt-1">
                {day}
              </div>
              {count > 0 && (
                <div className="font-mono text-2xs text-[var(--soft)] mt-1">
                  {count} show{count === 1 ? "" : "s"}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Tests + commit**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run components/explore/music/MusicDateStrip.test.tsx
git add web/components/explore/music/MusicDateStrip.tsx web/components/explore/music/MusicDateStrip.test.tsx
git commit -m "feat(music-explore): MusicDateStrip 14-day pill navigator"
```

---

## Task 4: `MusicViewToggle` + `MusicFilterChips`

**Files:**
- Create: `web/components/explore/music/MusicViewToggle.tsx`
- Create: `web/components/explore/music/MusicFilterChips.tsx`

- [ ] **Step 1: View toggle**

```tsx
// web/components/explore/music/MusicViewToggle.tsx
"use client";

export type MusicView = "by-venue" | "by-show";

export interface MusicViewToggleProps {
  view: MusicView;
  onChange: (view: MusicView) => void;
}

export function MusicViewToggle({ view, onChange }: MusicViewToggleProps) {
  const opts: { key: MusicView; label: string }[] = [
    { key: "by-venue", label: "By Venue" },
    { key: "by-show", label: "By Show" },
  ];
  return (
    <div role="tablist" className="inline-flex rounded-lg border border-[var(--twilight)] bg-[var(--night)] p-0.5">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={view === o.key}
          onClick={() => onChange(o.key)}
          className={[
            "px-3.5 py-1.5 rounded-md font-mono text-xs tracking-wider uppercase transition-colors",
            view === o.key
              ? "bg-[var(--vibe)]/20 text-[var(--cream)]"
              : "text-[var(--muted)] hover:text-[var(--soft)]",
          ].join(" ")}
        >
          {view === o.key && <span className="mr-1 text-[var(--gold)]">●</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Filter chips**

```tsx
// web/components/explore/music/MusicFilterChips.tsx
"use client";

import { MUSIC_GENRE_BUCKETS, type MusicGenreBucket } from "@/lib/music/genre-map";

export interface MusicFilterState {
  genre: MusicGenreBucket | null;
  free: boolean;
  under25: boolean;
  allAges: boolean;
  lateNight: boolean;
}

export interface MusicFilterChipsProps {
  state: MusicFilterState;
  onChange: (next: MusicFilterState) => void;
}

export function MusicFilterChips({ state, onChange }: MusicFilterChipsProps) {
  const toggleGenre = (g: MusicGenreBucket) =>
    onChange({ ...state, genre: state.genre === g ? null : g });
  const toggle = (key: keyof Omit<MusicFilterState, "genre">) =>
    onChange({ ...state, [key]: !state[key] });

  const chipCls = (active: boolean, accent = "gold") => [
    "flex-shrink-0 min-h-[36px] px-3 rounded-full font-mono text-xs tracking-wider uppercase border",
    "whitespace-nowrap transition-colors",
    active
      ? accent === "gold"
        ? "bg-[var(--gold)]/20 border-[var(--gold)] text-[var(--gold)]"
        : "bg-[var(--neon-green)]/20 border-[var(--neon-green)] text-[var(--neon-green)]"
      : "bg-[var(--night)] border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]",
  ].join(" ");

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
      <span className="flex-shrink-0 font-mono text-xs text-[var(--muted)] uppercase tracking-wider">Filter:</span>
      {MUSIC_GENRE_BUCKETS.map((g) => (
        <button key={g} type="button" onClick={() => toggleGenre(g)}
          className={chipCls(state.genre === g)}>{g}</button>
      ))}
      <div className="h-5 w-px bg-[var(--twilight)] flex-shrink-0 mx-1" />
      <button type="button" onClick={() => toggle("free")}
        className={chipCls(state.free, "green")}>Free</button>
      <button type="button" onClick={() => toggle("under25")}
        className={chipCls(state.under25)}>Under $25</button>
      <button type="button" onClick={() => toggle("allAges")}
        className={chipCls(state.allAges)}>All Ages</button>
      <button type="button" onClick={() => toggle("lateNight")}
        className={chipCls(state.lateNight)}>Late Night</button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/explore/music/MusicViewToggle.tsx web/components/explore/music/MusicFilterChips.tsx
git commit -m "feat(music-explore): view toggle + filter chip strip"
```

---

## Task 5: `ByVenueBlock` + `ByVenueRow`

**Files:**
- Create: `web/components/explore/music/ByVenueBlock.tsx`
- Create: `web/components/explore/music/ByVenueRow.tsx`

**Context:** Spec §7.3. Editorial blocks have full header (name + programming label in gold + meta) + italic venue editorial line + full-feature rows. Marquee blocks have compressed header + single italic line + compressed rows.

- [ ] **Step 1: Row**

```tsx
// web/components/explore/music/ByVenueRow.tsx
"use client";

import SmartImage from "@/components/SmartImage";
import { MusicShowtimeChip } from "@/components/feed/music/MusicShowtimeChip";
import type { MusicShowPayload } from "@/lib/music/types";

export interface ByVenueRowProps {
  show: MusicShowPayload;
  portalSlug: string;
  compressed: boolean;
  onShowTap: (show: MusicShowPayload) => void;
}

export function ByVenueRow({ show, portalSlug: _portalSlug, compressed, onShowTap }: ByVenueRowProps) {
  const headliner = show.artists.find((a) => a.is_headliner) ?? show.artists[0];
  const supports = show.artists.filter((a) => !a.is_headliner).slice(0, 2);
  const img = show.image_url ?? show.venue.image_url;

  return (
    <div className={[
      "flex gap-3 items-start py-3 border-b border-[var(--twilight)]/30 last:border-b-0",
    ].join(" ")}>
      <div className={[
        "flex-shrink-0 relative overflow-hidden rounded-md bg-[var(--twilight)]/20",
        compressed ? "w-16 h-24" : "w-24 h-36 sm:w-28 sm:h-40",
      ].join(" ")}>
        {img ? (
          <SmartImage src={img} alt={headliner?.name ?? show.title} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-mono text-2xs text-[var(--muted)] p-1.5 text-center">
            {show.genre_buckets[0] ?? headliner?.name.slice(0, 3).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className={[
          "font-semibold text-[var(--cream)] leading-tight",
          compressed ? "text-base" : "text-xl sm:text-2xl",
        ].join(" ")}>
          {headliner?.name ?? show.title}
        </div>

        <div className="font-mono text-2xs text-[var(--muted)] uppercase tracking-wider mt-1">
          {[
            show.genre_buckets[0],
            show.age_policy,
          ].filter(Boolean).join(" · ")}
        </div>

        {supports.length > 0 && (
          <div className="text-sm italic text-[var(--soft)] mt-1">
            w/ {supports.map((s) => s.name).join(", ")}
          </div>
        )}

        {!compressed && show.featured_blurb && (
          <div className="text-sm italic text-[var(--soft)] mt-1.5">
            "{show.featured_blurb}"
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-2">
          <MusicShowtimeChip
            doorsTime={show.doors_time}
            showTime={show.start_time}
            ticketStatus={show.ticket_status}
            isFree={show.is_free}
            agePolicy={show.age_policy}
            onTap={() => onShowTap(show)}
          />
          {show.is_curator_pick && (
            <span className="bg-[var(--gold)] text-[var(--void)] px-2 py-1 text-2xs font-mono font-bold tracking-widest uppercase rounded">
              CURATOR PICK
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Block**

```tsx
// web/components/explore/music/ByVenueBlock.tsx
"use client";

import { ByVenueRow } from "./ByVenueRow";
import { buildSpotUrl } from "@/lib/entity-urls";
import type { MusicDisplayTier, MusicShowPayload, MusicVenuePayload } from "@/lib/music/types";

export interface ByVenueBlockProps {
  venue: MusicVenuePayload;
  shows: MusicShowPayload[];
  portalSlug: string;
  tier: MusicDisplayTier | "my-venues";
  pinned?: boolean;
  onTogglePin?: (venue: MusicVenuePayload) => void;
  onShowTap: (show: MusicShowPayload) => void;
}

function programmingLabel(style: MusicVenuePayload["music_programming_style"]): string {
  switch (style) {
    case "listening_room": return "LISTENING ROOM";
    case "curated_indie": return "CURATED INDIE";
    case "jazz_club": return "JAZZ CLUB";
    case "dj_electronic": return "DJ · ELECTRONIC";
    case "drive_in_amph": return "DRIVE-IN AMPH";
    default: return "";
  }
}

export function ByVenueBlock({
  venue, shows, portalSlug, tier, pinned, onTogglePin, onShowTap,
}: ByVenueBlockProps) {
  const compressed = tier === "marquee" || tier === "additional";
  const venueUrl = buildSpotUrl(venue.slug, portalSlug, "feed");
  const label = programmingLabel(venue.music_programming_style);

  return (
    <section aria-label={venue.name} className="mb-6">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div className="min-w-0">
          <a href={venueUrl} className="inline-flex items-baseline gap-3 hover:opacity-80">
            <h3 className={[
              "font-bold text-[var(--cream)] truncate",
              compressed ? "text-2xl" : "text-3xl sm:text-4xl",
            ].join(" ")}>
              {venue.name}
            </h3>
            {label && (
              <span className="font-mono text-xs tracking-[0.2em] uppercase text-[var(--gold)] whitespace-nowrap">
                {label}
              </span>
            )}
          </a>
          <div className="font-mono text-2xs text-[var(--muted)] uppercase tracking-wider mt-1">
            {[
              venue.neighborhood,
              venue.capacity ? `${venue.capacity} cap` : null,
              `${shows.length} show${shows.length === 1 ? "" : "s"}`,
            ].filter(Boolean).join(" · ")}
          </div>
        </div>
        {onTogglePin && (
          <button
            type="button"
            onClick={() => onTogglePin(venue)}
            aria-label={pinned ? "Unpin venue" : "Pin venue"}
            className={[
              "flex-shrink-0 px-3 py-1.5 rounded-lg border font-mono text-2xs uppercase tracking-wider transition-colors",
              pinned
                ? "bg-[var(--coral)]/20 border-[var(--coral)] text-[var(--coral)]"
                : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]",
            ].join(" ")}
          >
            {pinned ? "Pinned" : "Pin"}
          </button>
        )}
      </div>

      {venue.editorial_line && (
        <div className="text-sm italic text-[var(--soft)] mb-3">
          "{venue.editorial_line}"
        </div>
      )}

      <div className="border-t border-[var(--twilight)]/40">
        {shows.map((show) => (
          <ByVenueRow
            key={show.id}
            show={show}
            portalSlug={portalSlug}
            compressed={compressed}
            onShowTap={onShowTap}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/explore/music/ByVenueBlock.tsx web/components/explore/music/ByVenueRow.tsx
git commit -m "feat(music-explore): ByVenueBlock + ByVenueRow with tier-aware sizing"
```

---

## Task 6: `ByVenueView` — orchestrates four groups + pin UX

**Files:**
- Create: `web/components/explore/music/ByVenueView.tsx`
- Create: `web/components/explore/music/AdditionalOptInPanel.tsx`

- [ ] **Step 1: Opt-in panel**

```tsx
// web/components/explore/music/AdditionalOptInPanel.tsx
"use client";

export interface AdditionalOptInPanelProps {
  optedIn: boolean;
  onOptIn: () => void;
}

export function AdditionalOptInPanel({ optedIn, onOptIn }: AdditionalOptInPanelProps) {
  if (optedIn) return null;

  return (
    <div className="rounded-xl border border-[var(--twilight)] bg-[var(--night)] p-6 mt-6">
      <div className="font-mono text-2xs uppercase tracking-widest text-[var(--muted)] mb-2">
        Optional
      </div>
      <div className="text-lg italic text-[var(--cream)] mb-2">
        Additional rooms
      </div>
      <div className="text-sm text-[var(--soft)] mb-4 max-w-prose">
        Add venues near you. Saves to your account so you see the same set every visit.
      </div>
      <button
        type="button"
        onClick={onOptIn}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--vibe)]/20 border border-[var(--vibe)] text-[var(--vibe)] font-mono text-xs tracking-wider uppercase hover:bg-[var(--vibe)]/30 transition-colors"
      >
        Browse rooms →
      </button>
    </div>
  );
}
```

- [ ] **Step 2: View**

```tsx
// web/components/explore/music/ByVenueView.tsx
"use client";

import { useState } from "react";
import { ByVenueBlock } from "./ByVenueBlock";
import { AdditionalOptInPanel } from "./AdditionalOptInPanel";
import type { ByVenuePayload, MusicShowPayload, MusicVenuePayload } from "@/lib/music/types";

export interface ByVenueViewProps {
  payload: ByVenuePayload;
  portalSlug: string;
  pinnedSlugs: Set<string>;
  onTogglePin: (venue: MusicVenuePayload) => void;
  onShowTap: (show: MusicShowPayload) => void;
  onOptInAdditional: () => void;
  additionalOptedIn: boolean;
}

export function ByVenueView({
  payload, portalSlug, pinnedSlugs,
  onTogglePin, onShowTap, onOptInAdditional, additionalOptedIn,
}: ByVenueViewProps) {
  return (
    <div>
      {payload.my_venues.length > 0 && (
        <>
          <div className="font-mono text-xs tracking-[0.12em] uppercase text-[var(--gold)] mb-3">
            My Venues · Pinned
          </div>
          {payload.my_venues.map(({ venue, shows }) => (
            <ByVenueBlock
              key={venue.id}
              venue={venue}
              shows={shows}
              portalSlug={portalSlug}
              tier="my-venues"
              pinned={pinnedSlugs.has(venue.slug)}
              onTogglePin={onTogglePin}
              onShowTap={onShowTap}
            />
          ))}
        </>
      )}

      {payload.editorial.length > 0 && (
        <>
          {payload.my_venues.length > 0 && (
            <div className="h-px bg-[var(--twilight)] my-6" />
          )}
          {payload.editorial.map(({ venue, shows }) => (
            <ByVenueBlock
              key={venue.id}
              venue={venue}
              shows={shows}
              portalSlug={portalSlug}
              tier="editorial"
              pinned={pinnedSlugs.has(venue.slug)}
              onTogglePin={onTogglePin}
              onShowTap={onShowTap}
            />
          ))}
        </>
      )}

      {payload.marquee.length > 0 && (
        <>
          <div className="h-px bg-[var(--twilight)] my-6" />
          <div className="font-mono text-xs tracking-[0.12em] uppercase text-[var(--muted)] mb-3">
            Marquee Rooms
          </div>
          {payload.marquee.map(({ venue, shows }) => (
            <ByVenueBlock
              key={venue.id}
              venue={venue}
              shows={shows}
              portalSlug={portalSlug}
              tier="marquee"
              pinned={pinnedSlugs.has(venue.slug)}
              onTogglePin={onTogglePin}
              onShowTap={onShowTap}
            />
          ))}
        </>
      )}

      <AdditionalOptInPanel
        optedIn={additionalOptedIn}
        onOptIn={onOptInAdditional}
      />

      {additionalOptedIn && payload.additional.length > 0 && (
        <>
          <div className="h-px bg-[var(--twilight)] my-6" />
          {payload.additional.map(({ venue, shows }) => (
            <ByVenueBlock
              key={venue.id}
              venue={venue}
              shows={shows}
              portalSlug={portalSlug}
              tier="additional"
              pinned={pinnedSlugs.has(venue.slug)}
              onTogglePin={onTogglePin}
              onShowTap={onShowTap}
            />
          ))}
        </>
      )}

      {payload.my_venues.length === 0 && payload.editorial.length === 0 && payload.marquee.length === 0 && (
        <div className="text-sm italic text-[var(--muted)] py-8 text-center">
          Quiet day — see what's showing this week →
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/explore/music/ByVenueView.tsx web/components/explore/music/AdditionalOptInPanel.tsx
git commit -m "feat(music-explore): ByVenueView orchestrating My Venues/Editorial/Marquee/Additional"
```

---

## Task 7: `ByShowView` — chronological grouped list

**Files:**
- Create: `web/components/explore/music/ByShowView.tsx`
- Create: `web/components/explore/music/ByShowRow.tsx`

- [ ] **Step 1: Row + view**

```tsx
// web/components/explore/music/ByShowRow.tsx
"use client";

import SmartImage from "@/components/SmartImage";
import { MusicShowtimeChip } from "@/components/feed/music/MusicShowtimeChip";
import { buildSpotUrl } from "@/lib/entity-urls";
import type { MusicShowPayload } from "@/lib/music/types";

export interface ByShowRowProps {
  show: MusicShowPayload;
  portalSlug: string;
  onShowTap: (show: MusicShowPayload) => void;
}

export function ByShowRow({ show, portalSlug, onShowTap }: ByShowRowProps) {
  const headliner = show.artists.find((a) => a.is_headliner) ?? show.artists[0];
  const supports = show.artists.filter((a) => !a.is_headliner).slice(0, 2);
  const img = show.image_url ?? show.venue.image_url;
  const venueUrl = buildSpotUrl(show.venue.slug, portalSlug, "feed");

  return (
    <div className="flex gap-3 items-start py-3 border-b border-[var(--twilight)]/30">
      <div className="w-20 h-20 flex-shrink-0 relative overflow-hidden rounded-md bg-[var(--twilight)]/20">
        {img ? (
          <SmartImage src={img} alt={headliner?.name ?? show.title} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-mono text-2xs text-[var(--muted)] p-1 text-center">
            {show.genre_buckets[0] ?? headliner?.name.slice(0, 3).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xl font-semibold text-[var(--cream)] leading-tight">
          {headliner?.name ?? show.title}
        </div>
        <a href={venueUrl} className="text-sm text-[var(--soft)] hover:text-[var(--cream)] mt-0.5 inline-block">
          {show.venue.name}{show.venue.neighborhood ? ` · ${show.venue.neighborhood}` : ""}
        </a>
        {supports.length > 0 && (
          <div className="text-sm italic text-[var(--soft)] mt-0.5">
            w/ {supports.map((s) => s.name).join(", ")}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          {show.genre_buckets.slice(0, 2).map((g) => (
            <span key={g} className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)] border border-[var(--twilight)] rounded-full px-2 py-0.5">
              {g}
            </span>
          ))}
          <MusicShowtimeChip
            doorsTime={show.doors_time}
            showTime={show.start_time}
            ticketStatus={show.ticket_status}
            isFree={show.is_free}
            agePolicy={show.age_policy}
            onTap={() => onShowTap(show)}
          />
        </div>
      </div>
    </div>
  );
}
```

```tsx
// web/components/explore/music/ByShowView.tsx
"use client";

import { ByShowRow } from "./ByShowRow";
import type { ByShowPayload, MusicShowPayload } from "@/lib/music/types";

export interface ByShowViewProps {
  payload: ByShowPayload;
  portalSlug: string;
  onShowTap: (show: MusicShowPayload) => void;
}

export function ByShowView({ payload, portalSlug, onShowTap }: ByShowViewProps) {
  if (payload.groups.length === 0) {
    return (
      <div className="text-sm italic text-[var(--muted)] py-8 text-center">
        Quiet day — see residencies and what's coming up →
      </div>
    );
  }

  return (
    <div>
      {payload.groups.map((group) => (
        <section key={group.date} className="mb-8">
          <div className="sticky top-0 bg-[var(--void)] z-10 py-2">
            <div className="font-mono text-xs tracking-[0.12em] uppercase text-[var(--gold)]">
              {group.day_label}
            </div>
          </div>
          {group.shows.map((show) => (
            <ByShowRow
              key={show.id}
              show={show}
              portalSlug={portalSlug}
              onShowTap={onShowTap}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/explore/music/ByShowView.tsx web/components/explore/music/ByShowRow.tsx
git commit -m "feat(music-explore): ByShowView chronological grouped list"
```

---

## Task 8: `MusicResidencyStrip` (fork of RecurringStrip)

**Files:**
- Create: `web/components/explore/music/MusicResidencyStrip.tsx`
- Create: `web/components/explore/music/MusicResidencyCard.tsx`

**Context:** Spec §7.5. Horizontal-scroll. Each card shows day-of-week + gold `RESIDENCY` chip + venue + editorial blurb + next-event stamp.

- [ ] **Step 1: Card**

```tsx
// web/components/explore/music/MusicResidencyCard.tsx
"use client";

import SmartImage from "@/components/SmartImage";
import type { MusicResidencyPayload } from "@/lib/music/types";

export interface MusicResidencyCardProps {
  residency: MusicResidencyPayload;
}

function formatNext(r: MusicResidencyPayload): string {
  if (!r.next_event) return "";
  const d = new Date(r.next_event.start_date + "T00:00:00");
  const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  const door = r.next_event.doors_time ? `DOORS ${r.next_event.doors_time}` : null;
  const show = r.next_event.start_time ? `SHOW ${r.next_event.start_time}` : null;
  return [`NEXT: ${label}`, door, show].filter(Boolean).join(" · ");
}

export function MusicResidencyCard({ residency }: MusicResidencyCardProps) {
  const img = residency.image_url ?? residency.venue?.image_url ?? null;
  const dow = residency.day_of_week?.toUpperCase();

  return (
    <article className="flex-shrink-0 w-[260px] rounded-card overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40 hover-lift">
      <div className="relative h-32 bg-[var(--twilight)]/20">
        {img ? (
          <SmartImage src={img} alt={residency.title} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--muted)] font-mono text-xs">
            {residency.title.slice(0, 3).toUpperCase()}
          </div>
        )}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="bg-[var(--gold)] text-[var(--void)] font-mono text-2xs font-bold tracking-widest uppercase px-2 py-0.5">
            Residency
          </span>
          {dow && (
            <span className="bg-[var(--void)]/80 text-[var(--cream)] font-mono text-2xs font-bold tracking-widest uppercase px-2 py-0.5">
              {dow}s
            </span>
          )}
        </div>
      </div>
      <div className="p-3">
        <div className="text-lg font-semibold text-[var(--cream)] leading-tight">
          {residency.title}
        </div>
        {residency.venue && (
          <div className="font-mono text-2xs text-[var(--muted)] uppercase tracking-wider mt-1">
            {residency.venue.name}{residency.venue.neighborhood ? ` · ${residency.venue.neighborhood}` : ""}
          </div>
        )}
        {residency.description && (
          <div className="text-sm italic text-[var(--soft)] mt-2 line-clamp-3">
            "{residency.description}"
          </div>
        )}
        <div className="font-mono text-2xs text-[var(--vibe)] uppercase tracking-wider mt-2">
          {formatNext(residency)}
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Strip**

```tsx
// web/components/explore/music/MusicResidencyStrip.tsx
"use client";

import { MusicResidencyCard } from "./MusicResidencyCard";
import type { MusicResidencyPayload } from "@/lib/music/types";

export interface MusicResidencyStripProps {
  residencies: MusicResidencyPayload[];
}

export function MusicResidencyStrip({ residencies }: MusicResidencyStripProps) {
  if (residencies.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <div className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--gold)]">
          Residencies · Weekly at Atlanta Rooms
        </div>
        <div className="text-xs italic text-[var(--muted)]">
          Regulars worth building into the week.
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-4 px-4 pb-2">
        {residencies.map((r) => (
          <div key={r.id} className="snap-start">
            <MusicResidencyCard residency={r} />
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/explore/music/MusicResidencyStrip.tsx web/components/explore/music/MusicResidencyCard.tsx
git commit -m "feat(music-explore): MusicResidencyStrip (forked from RecurringStrip, artist-keyed)"
```

---

## Task 9: `ThisWeekHeroZone` — larger hero for explore page

**Files:**
- Create: `web/components/explore/music/ThisWeekHeroZone.tsx`

**Context:** Spec §7.2. Reuses `LiveTonightHeroTile` from Plan 2 but at larger size. Adds `Coming next week →` link when viewing current week.

- [ ] **Step 1: Implement**

```tsx
// web/components/explore/music/ThisWeekHeroZone.tsx
"use client";

import { LiveTonightHeroTile } from "@/components/feed/music/LiveTonightHeroTile";
import type { MusicShowPayload } from "@/lib/music/types";

export interface ThisWeekHeroZoneProps {
  shows: MusicShowPayload[];
  portalSlug: string;
  viewingFutureWeek: boolean;
  onTileTap: (show: MusicShowPayload) => void;
  onComingNextWeekClick: () => void;
}

export function ThisWeekHeroZone({
  shows, portalSlug, viewingFutureWeek, onTileTap, onComingNextWeekClick,
}: ThisWeekHeroZoneProps) {
  if (shows.length === 0) return null;
  const n = Math.min(shows.length, 3);

  return (
    <section aria-label="This week's significant shows" className="mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <div className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--gold)]">
          This Week · {shows.length} significant show{shows.length === 1 ? "" : "s"}
        </div>
        <div className="text-xs italic text-[var(--muted)]">Not to miss.</div>
      </div>

      <div className={[
        "grid gap-px bg-black rounded-lg overflow-hidden",
        n === 1 ? "grid-cols-1 h-[320px]" :
          n === 2 ? "grid-cols-[60fr_40fr] h-[300px]" :
          "grid-cols-3 h-[300px]",
      ].join(" ")}>
        {shows.slice(0, n).map((show) => (
          <LiveTonightHeroTile
            key={show.id}
            show={show}
            portalSlug={portalSlug}
            onTap={onTileTap}
          />
        ))}
      </div>

      {!viewingFutureWeek && (
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={onComingNextWeekClick}
            className="font-mono text-xs text-[var(--vibe)] hover:opacity-80 tracking-wider"
          >
            Coming next week →
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/explore/music/ThisWeekHeroZone.tsx
git commit -m "feat(music-explore): ThisWeekHeroZone larger hero variant"
```

---

## Task 10: `MusicPageShell` + page route

**Files:**
- Create: `web/app/[portal]/explore/music/page.tsx`
- Create: `web/app/[portal]/explore/music/layout.tsx`
- Create: `web/app/[portal]/explore/music/loading.tsx`
- Create: `web/components/explore/music/MusicPageShell.tsx`
- Create: `web/components/explore/music/MusicPageClient.tsx`

**Context:** Server-renders the shell + zones; client wrapper manages view toggle, filter state, action sheet, pin state.

- [ ] **Step 1: Layout + loading**

```tsx
// web/app/[portal]/explore/music/layout.tsx
export const runtime = "nodejs";
export const revalidate = 60;

export default function MusicExploreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

```tsx
// web/app/[portal]/explore/music/loading.tsx
export default function Loading() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <div className="h-4 w-24 bg-[var(--twilight)] animate-pulse rounded mb-6" />
      <div className="h-16 w-[60%] bg-[var(--twilight)] animate-pulse rounded mb-8" />
      <div className="h-[86px] w-full bg-[var(--twilight)]/50 animate-pulse rounded mb-6" />
      <div className="h-[320px] w-full bg-[var(--twilight)]/30 animate-pulse rounded mb-6" />
    </main>
  );
}
```

- [ ] **Step 2: Server page**

```tsx
// web/app/[portal]/explore/music/page.tsx
import { notFound } from "next/navigation";
import { loadThisWeek } from "@/lib/music/this-week-loader";
import { loadByVenue } from "@/lib/music/by-venue-loader";
import { loadByShow } from "@/lib/music/by-show-loader";
import { loadResidencies } from "@/lib/music/residencies-loader";
import { createClient } from "@/lib/supabase/server";
import { getManifestForPortalSlug } from "@/lib/portal-runtime";
import { MusicPageClient } from "@/components/explore/music/MusicPageClient";

export default async function MusicExplorePage({
  params, searchParams,
}: {
  params: Promise<{ portal: string }>;
  searchParams: Promise<{ date?: string; view?: string; genre?: string | string[] }>;
}) {
  const { portal } = await params;
  const sp = await searchParams;
  const manifest = await getManifestForPortalSlug(portal);
  if (!manifest) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const date = sp.date ?? today;

  // Fetch pinned slugs if authenticated.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let pinnedSlugs: string[] = [];
  if (user) {
    const { data: pins } = await supabase
      .from("user_venue_pins")
      .select("place:places(slug)")
      .eq("user_id", user.id)
      .eq("portal_id", portal);
    pinnedSlugs = (pins ?? []).map((p) => (p.place as unknown as { slug: string }).slug).filter(Boolean);
  }

  const [thisWeek, byVenue, byShow, residencies] = await Promise.all([
    loadThisWeek(portal),
    loadByVenue(portal, { date, pinned_slugs: pinnedSlugs }),
    loadByShow(portal, { date, days: 7 }),
    loadResidencies(portal),
  ]);

  return (
    <MusicPageClient
      portalSlug={portal}
      initialDate={date}
      initialView={(sp.view === "by-show" ? "by-show" : "by-venue") as "by-venue" | "by-show"}
      thisWeek={thisWeek}
      byVenue={byVenue}
      byShow={byShow}
      residencies={residencies}
      initialPinnedSlugs={pinnedSlugs}
    />
  );
}
```

- [ ] **Step 3: Client orchestrator**

```tsx
// web/components/explore/music/MusicPageClient.tsx
"use client";

import { useState, useTransition } from "react";
import { MusicPageShell } from "./MusicPageShell";
import { ThisWeekHeroZone } from "./ThisWeekHeroZone";
import { ByVenueView } from "./ByVenueView";
import { ByShowView } from "./ByShowView";
import { MusicResidencyStrip } from "./MusicResidencyStrip";
import { MusicActionSheet } from "@/components/feed/music/MusicActionSheet";
import type {
  ByShowPayload, ByVenuePayload, MusicResidencyPayload,
  MusicShowPayload, MusicVenuePayload, ThisWeekPayload,
} from "@/lib/music/types";
import type { MusicView } from "./MusicViewToggle";
import type { MusicFilterState } from "./MusicFilterChips";

export interface MusicPageClientProps {
  portalSlug: string;
  initialDate: string;
  initialView: MusicView;
  thisWeek: ThisWeekPayload;
  byVenue: ByVenuePayload;
  byShow: ByShowPayload;
  residencies: { residencies: MusicResidencyPayload[] };
  initialPinnedSlugs: string[];
}

export function MusicPageClient({
  portalSlug, initialDate, initialView,
  thisWeek, byVenue, byShow, residencies, initialPinnedSlugs,
}: MusicPageClientProps) {
  const [date, setDate] = useState(initialDate);
  const [view, setView] = useState<MusicView>(initialView);
  const [filters, setFilters] = useState<MusicFilterState>({
    genre: null, free: false, under25: false, allAges: false, lateNight: false,
  });
  const [activeShow, setActiveShow] = useState<MusicShowPayload | null>(null);
  const [pinnedSlugs, setPinnedSlugs] = useState<Set<string>>(new Set(initialPinnedSlugs));
  const [additionalOptedIn, setAdditionalOptedIn] = useState(false);
  const [_isPending, startTransition] = useTransition();

  // (Client-side filter reduction for speed — for SSR freshness, would re-fetch via URL+revalidate.)
  const filterShows = (shows: MusicShowPayload[]) => shows.filter((s) => {
    if (filters.genre && !s.genre_buckets.includes(filters.genre)) return false;
    if (filters.free && !s.is_free) return false;
    if (filters.allAges && !s.age_policy?.toLowerCase().includes("all")) return false;
    if (filters.lateNight) {
      const eff = s.doors_time || s.start_time || "00:00";
      if (eff < "21:00") return false;
    }
    return true;
  });

  const filteredByVenue: ByVenuePayload = {
    date: byVenue.date,
    my_venues: byVenue.my_venues.map((g) => ({ ...g, shows: filterShows(g.shows) })).filter((g) => g.shows.length > 0 || pinnedSlugs.has(g.venue.slug)),
    editorial: byVenue.editorial.map((g) => ({ ...g, shows: filterShows(g.shows) })).filter((g) => g.shows.length > 0),
    marquee: byVenue.marquee.map((g) => ({ ...g, shows: filterShows(g.shows) })).filter((g) => g.shows.length > 0),
    additional: byVenue.additional.map((g) => ({ ...g, shows: filterShows(g.shows) })).filter((g) => g.shows.length > 0),
  };

  const filteredByShow: ByShowPayload = {
    groups: byShow.groups.map((g) => ({ ...g, shows: filterShows(g.shows) })).filter((g) => g.shows.length > 0),
  };

  const handleTogglePin = async (venue: MusicVenuePayload) => {
    const isPinned = pinnedSlugs.has(venue.slug);
    startTransition(() => {
      setPinnedSlugs((prev) => {
        const next = new Set(prev);
        if (isPinned) next.delete(venue.slug);
        else next.add(venue.slug);
        return next;
      });
    });
    try {
      if (isPinned) {
        await fetch(`/api/music/venue-pins?portal=${portalSlug}&place_id=${venue.id}`, { method: "DELETE" });
      } else {
        await fetch("/api/music/venue-pins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ portal: portalSlug, place_id: venue.id }),
        });
      }
    } catch {
      // Rollback.
      setPinnedSlugs((prev) => {
        const next = new Set(prev);
        if (isPinned) next.add(venue.slug);
        else next.delete(venue.slug);
        return next;
      });
    }
  };

  const handleAddToPlans = async (show: MusicShowPayload) => {
    await fetch("/api/plans/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: show.id }),
    }).catch(() => {});
    setActiveShow(null);
  };

  const today = new Date().toISOString().slice(0, 10);
  const viewingFutureWeek = date > (() => {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 pb-28">
      <MusicPageShell
        portalSlug={portalSlug}
        activeDate={date}
        dateCounts={{}}  // populated via API in a follow-up
        view={view}
        filters={filters}
        onDateChange={(d) => { setDate(d); window.location.search = `?date=${d}&view=${view}`; }}
        onViewChange={setView}
        onFiltersChange={setFilters}
      />

      <ThisWeekHeroZone
        shows={thisWeek.shows}
        portalSlug={portalSlug}
        viewingFutureWeek={viewingFutureWeek}
        onTileTap={setActiveShow}
        onComingNextWeekClick={() => {
          const d = new Date(today + "T00:00:00");
          d.setDate(d.getDate() + 7);
          const iso = d.toISOString().slice(0, 10);
          setDate(iso);
          window.location.search = `?date=${iso}&view=${view}`;
        }}
      />

      {view === "by-venue" ? (
        <ByVenueView
          payload={filteredByVenue}
          portalSlug={portalSlug}
          pinnedSlugs={pinnedSlugs}
          onTogglePin={handleTogglePin}
          onShowTap={setActiveShow}
          onOptInAdditional={() => setAdditionalOptedIn(true)}
          additionalOptedIn={additionalOptedIn}
        />
      ) : (
        <ByShowView
          payload={filteredByShow}
          portalSlug={portalSlug}
          onShowTap={setActiveShow}
        />
      )}

      <MusicResidencyStrip residencies={residencies.residencies} />

      <MusicActionSheet
        show={activeShow}
        portalSlug={portalSlug}
        onClose={() => setActiveShow(null)}
        onAddToPlans={handleAddToPlans}
      />
    </main>
  );
}
```

- [ ] **Step 4: Page shell**

```tsx
// web/components/explore/music/MusicPageShell.tsx
"use client";

import { MusicDateStrip } from "./MusicDateStrip";
import { MusicViewToggle, type MusicView } from "./MusicViewToggle";
import { MusicFilterChips, type MusicFilterState } from "./MusicFilterChips";

export interface MusicPageShellProps {
  portalSlug: string;
  activeDate: string;
  dateCounts: Record<string, number>;
  view: MusicView;
  filters: MusicFilterState;
  onDateChange: (d: string) => void;
  onViewChange: (v: MusicView) => void;
  onFiltersChange: (f: MusicFilterState) => void;
}

export function MusicPageShell(p: MusicPageShellProps) {
  return (
    <div className="mb-6">
      <div className="font-mono text-xs tracking-[0.12em] uppercase text-[var(--vibe)] mb-3">
        EXPLORE &nbsp;/&nbsp; MUSIC
      </div>
      <h1 className="text-3xl sm:text-5xl italic font-bold text-[var(--cream)] mb-2">
        Live Music in Atlanta.
      </h1>
      <div className="text-sm italic text-[var(--soft)] max-w-prose mb-4">
        This week — significant shows across Atlanta's editorial rooms + marquee venues, plus the residencies that define the calendar.
      </div>

      <MusicDateStrip
        activeDate={p.activeDate}
        dateCounts={p.dateCounts}
        onChange={p.onDateChange}
      />

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <MusicViewToggle view={p.view} onChange={p.onViewChange} />
        <div className="flex-1 min-w-0">
          <MusicFilterChips state={p.filters} onChange={p.onFiltersChange} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Browser verify**

```bash
cd /Users/coach/Projects/LostCity/web && npm run dev &
sleep 5
```

Load `http://localhost:3000/atlanta/explore/music`. Verify:
- All sections render
- Date strip navigates
- View toggle flips between By Venue and By Show
- Filter chips toggle
- Residency strip scrolls horizontally
- Action sheet opens on showtime-chip tap
- Pin button works for logged-in users
- No console errors
- 375px viewport clean

- [ ] **Step 6: Commit**

```bash
git add web/app/\[portal\]/explore/music web/components/explore/music/MusicPageShell.tsx web/components/explore/music/MusicPageClient.tsx
git commit -m "feat(music-explore): /{portal}/explore/music page — shell + views + residencies"
```

---

## Task 11: URL-state wiring for date + view + filters

**Files:**
- Modify: `web/components/explore/music/MusicPageClient.tsx`

**Context:** Per spec §8.5 — date + filters in URL params for shareability. Currently the click handlers reload the page (`window.location.search = ...`). Replace with `window.history.replaceState` for instant filter toggling (per web/CLAUDE.md filter rule).

- [ ] **Step 1: Replace the reloads**

Wherever `window.location.search = ...` appears, replace with:

```typescript
const params = new URLSearchParams(window.location.search);
params.set("date", nextDate);
params.set("view", nextView);
if (filters.genre) params.set("genre", filters.genre); else params.delete("genre");
// ... other filter params
window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
```

For SSR freshness on date change (different data set), keep a full navigation via `router.push` WITH `scroll: false`. Filter changes stay client-only.

- [ ] **Step 2: Verify in browser — filter changes don't re-render the page header**

- [ ] **Step 3: Commit**

```bash
git add web/components/explore/music/MusicPageClient.tsx
git commit -m "feat(music-explore): URL-state for date, view, filters; instant filter UX"
```

---

## Task 12: Design handoff + motion polish

**Files:**
- Various component files

**Context:** Per `feedback_design_motion_in_plans.md` — this is a workflow GATE, not a final-polish option. Run `/design-handoff extract` against the Pencil design if one exists for this page; if not, improvise from film's `/explore/film` spec to stay visually coherent.

- [ ] **Step 1: Check for Pencil design**

```bash
cd /Users/coach/Projects/LostCity && ls docs/explore-music.pen 2>/dev/null
```

If exists: run `/design-handoff extract <node-id>` to produce a spec, then verify implementation matches.

If absent: use Film's `/explore/film` as a design proxy (same page pattern, sibling product). Confirm visual alignment on:
- Breadcrumb treatment
- Title italic weight + size
- Date strip pill shape + spacing
- View toggle segmented-control look
- Venue block headers
- Residency card sizing

- [ ] **Step 2: Run `/motion audit`**

From parent context, dispatch `/motion audit http://localhost:3000/atlanta/explore/music`. Fold findings in.

- [ ] **Step 3: Entrance animations**

Add to server page's root:
```tsx
<div className="animate-page-enter">
  ...
</div>
```

Stagger sections via `.section:nth-child(n) { animation-delay: calc(n * 80ms) }` pattern.

- [ ] **Step 4: Commit**

```bash
git add web/components/explore/music
git commit -m "feat(music-explore): design handoff alignment + motion polish"
```

---

## Completion Checklist

- [ ] `/{portal}/explore/music` loads for atlanta with all sections rendering
- [ ] Pin/unpin persists across reloads for authenticated users
- [ ] URL state (date, view, filters) is shareable + restored on reload
- [ ] All vitest green
- [ ] `npx tsc --noEmit` clean
- [ ] 375px + 1280px viewports verified
- [ ] Action sheet parity with Plan 2 (same component reused)
- [ ] Residency strip shows real residencies from Plan 1 seed
- [ ] Additional opt-in panel appears; CTA works
- [ ] `/motion audit` has no open findings
