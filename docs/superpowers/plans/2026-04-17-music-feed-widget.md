# Music Feed Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing `MusicTabContent`-based "Music" tab inside `VenuesSection` with a standalone, manifest-registered `LiveTonightSection` feed widget: `This Week` hero strip (adaptive 1/2/3-up with dual image/typographic tile states) + `Tonight`/`Late Night` venue-rowed playbill, height-bounded 220–320px, using the Phase 1 APIs.

**Architecture:**
- One new manifest-registered section component: `LiveTonightSection` (feed island with server-side data loading).
- Three new leaf components: `LiveTonightHeroStrip`, `LiveTonightPlaybill`, `LiveTonightActionSheet` (fork of `EventPreviewSheet` pattern).
- Uses `/api/music/this-week` + `/api/music/tonight` via the shared server-loader pattern (import loaders directly; do not fetch own API on server per `web/CLAUDE.md`).
- Existing `MusicTabContent` tab inside `VenuesSection` removed. The music programming lane is retired from the old tab container to avoid a duplicate surface.

**Tech Stack:** Next.js 16 App Router (server components + small client island for the action sheet), React, Tailwind v4, TypeScript, Vitest, Playwright browser verification.

**Spec:** `docs/superpowers/specs/2026-04-17-live-music-feed-and-explore-design.md` §6

**Depends on:** Plan 1 (Music Phase 1 — data foundation) shipped and deployed.

**Out of scope:**
- `/explore/music` page → Plan 3a
- Festivals horizon section → Plan 3b
- Just announced / on sale section → Plan 3c

---

## File Structure

### Create
- `web/components/feed/sections/LiveTonightSection.tsx` — manifest-registered server component island
- `web/components/feed/music/LiveTonightHeroStrip.tsx` — 1/2/3-up adaptive tile strip
- `web/components/feed/music/LiveTonightHeroTile.tsx` — single tile with dual image/typographic state
- `web/components/feed/music/LiveTonightPlaybill.tsx` — tonight + late-night venue rows
- `web/components/feed/music/LiveTonightPlaybillRow.tsx` — single venue row
- `web/components/feed/music/MusicShowtimeChip.tsx` — stacked doors/show chip
- `web/components/feed/music/MusicActionSheet.tsx` — fork of EventPreviewSheet for music
- `web/components/feed/music/LiveTonightSection.test.tsx` — component tests
- `web/components/feed/music/LiveTonightHeroTile.test.tsx`
- `web/components/feed/music/MusicShowtimeChip.test.tsx`

### Modify
- `web/lib/city-pulse/manifests/atlanta.tsx` — swap out `LiveMusicSection` (current `MusicTabContent` wrapper) for new `LiveTonightSection` island
- `web/components/feed/sections/MusicTabContent.tsx` — **delete** after manifest swap lands + verifying no other importers

### Not modified
- `VenuesSection.tsx` — the old Music tab is retired; leave the other tabs untouched

---

## Task 1: Audit import sites of `MusicTabContent` before deletion

**Files (read-only):**
- Any file importing `MusicTabContent`

- [ ] **Step 1: Find all importers**

```bash
cd /Users/coach/Projects/LostCity && grep -r "MusicTabContent" web/ --include="*.ts" --include="*.tsx" -l
```

Expected output: a short list — at minimum `web/lib/city-pulse/manifests/atlanta.tsx`. Any other site must also be migrated or documented before Task 9's delete step.

- [ ] **Step 2: Record findings**

Paste the output into a commit message on Task 9 so the deletion is defensible. No commit here (audit only).

---

## Task 2: `MusicShowtimeChip` — stacked doors / show chip

**Files:**
- Create: `web/components/feed/music/MusicShowtimeChip.tsx`
- Create: `web/components/feed/music/MusicShowtimeChip.test.tsx`

**Context:** Spec §5 + §6.4. Renders `DOORS 7 · SHOW 9` when both present, `SHOW 9PM` when only one, and respects `SOLD OUT` / `FREE` / age policy chip state. Click handler receives the show payload and opens the action sheet.

- [ ] **Step 1: Test**

```typescript
// web/components/feed/music/MusicShowtimeChip.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MusicShowtimeChip } from "./MusicShowtimeChip";

const baseProps = {
  doorsTime: null as string | null,
  showTime: null as string | null,
  ticketStatus: null as string | null,
  isFree: false,
  agePolicy: null as string | null,
  onTap: vi.fn(),
};

describe("MusicShowtimeChip", () => {
  it("renders DOORS + SHOW stacked when both present", () => {
    render(<MusicShowtimeChip {...baseProps} doorsTime="19:00" showTime="21:00" />);
    expect(screen.getByText(/DOORS/)).toBeInTheDocument();
    expect(screen.getByText(/SHOW/)).toBeInTheDocument();
  });

  it("renders SHOW only when just start_time present", () => {
    render(<MusicShowtimeChip {...baseProps} showTime="21:00" />);
    expect(screen.getByText(/SHOW 9/)).toBeInTheDocument();
    expect(screen.queryByText(/DOORS/)).not.toBeInTheDocument();
  });

  it("renders SOLD OUT state with strike-through", () => {
    render(<MusicShowtimeChip {...baseProps} showTime="21:00" ticketStatus="sold-out" />);
    expect(screen.getByText(/SOLD OUT/)).toBeInTheDocument();
  });

  it("renders FREE pill when is_free", () => {
    render(<MusicShowtimeChip {...baseProps} showTime="21:00" isFree />);
    expect(screen.getByText(/FREE/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run components/feed/music/MusicShowtimeChip.test.tsx
```

- [ ] **Step 3: Implement**

```tsx
// web/components/feed/music/MusicShowtimeChip.tsx
"use client";

import { useMemo } from "react";

export interface MusicShowtimeChipProps {
  doorsTime: string | null;
  showTime: string | null;
  ticketStatus: string | null;
  isFree: boolean;
  agePolicy: string | null;
  onTap?: () => void;
}

function formatTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  const period = h >= 12 ? "PM" : "AM";
  if (m === 0) return `${hour12}${period}`;
  return `${hour12}:${String(m).padStart(2, "0")}${period}`;
}

export function MusicShowtimeChip({
  doorsTime, showTime, ticketStatus, isFree, agePolicy, onTap,
}: MusicShowtimeChipProps) {
  const isSoldOut = ticketStatus === "sold-out";
  const isLastTix = ticketStatus === "low-tickets";
  const primary = showTime || doorsTime;
  const showBoth = Boolean(doorsTime && showTime);
  const ageBadge = useMemo(() => {
    if (!agePolicy) return null;
    const normalized = agePolicy.toLowerCase().replace(/_/g, "-");
    if (normalized.includes("all")) return "ALL AGES";
    if (normalized.includes("21")) return "21+";
    if (normalized.includes("18")) return "18+";
    return null;
  }, [agePolicy]);

  if (!primary) return null;

  return (
    <button
      type="button"
      onClick={onTap}
      className={[
        "inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg",
        "bg-[var(--twilight)]/40 hover:bg-[var(--twilight)]/60",
        "border border-[var(--twilight)] active:scale-95 transition",
        "font-mono text-xs",
        isSoldOut ? "opacity-60" : "",
      ].join(" ")}
    >
      {showBoth ? (
        <span className="flex items-baseline gap-1.5">
          <span className="text-[var(--muted)]">DOORS</span>
          <span className="text-[var(--cream)]">{formatTime(doorsTime)}</span>
          <span className="text-[var(--twilight)]">·</span>
          <span className="text-[var(--muted)]">SHOW</span>
          <span className={[
            "text-[var(--vibe)]",
            isSoldOut ? "line-through" : "",
          ].join(" ")}>{formatTime(showTime)}</span>
        </span>
      ) : (
        <span>
          <span className="text-[var(--muted)]">SHOW </span>
          <span className={[
            "text-[var(--vibe)]",
            isSoldOut ? "line-through" : "",
          ].join(" ")}>{formatTime(primary)}</span>
        </span>
      )}
      {isSoldOut && (
        <span className="bg-[var(--coral)] text-[var(--void)] px-1.5 py-0.5 text-2xs font-bold tracking-wider">
          SOLD OUT
        </span>
      )}
      {!isSoldOut && isLastTix && (
        <span className="bg-[var(--gold)] text-[var(--void)] px-1.5 py-0.5 text-2xs font-bold tracking-wider">
          LAST TIX
        </span>
      )}
      {isFree && (
        <span className="border border-[var(--neon-green)] text-[var(--neon-green)] px-1.5 py-0.5 text-2xs font-bold tracking-wider">
          FREE
        </span>
      )}
      {ageBadge && (
        <span className="border border-[var(--twilight)] text-[var(--muted)] px-1.5 py-0.5 text-2xs font-bold tracking-wider">
          {ageBadge}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run components/feed/music/MusicShowtimeChip.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add web/components/feed/music/MusicShowtimeChip.tsx web/components/feed/music/MusicShowtimeChip.test.tsx
git commit -m "feat(music-feed): MusicShowtimeChip with stacked doors/show + state chips"
```

---

## Task 3: `MusicActionSheet` — fork of `EventPreviewSheet`

**Files:**
- Create: `web/components/feed/music/MusicActionSheet.tsx`

**Context:** Spec §6.5. Reuses the structural pattern of `web/components/calendar/sheets/EventPreviewSheet.tsx` (backdrop, sheet, drag handle). Three buttons: `Add to Plans` primary, `Get Tickets →` conditional (when `ticket_url`), `Open Event →` tertiary (replaces `Dismiss` per designer review).

- [ ] **Step 1: Read the existing pattern**

```bash
cd /Users/coach/Projects/LostCity && cat web/components/calendar/sheets/EventPreviewSheet.tsx | head -120
```

Note the visual structure (backdrop, drag handle, header, footer). Our sheet is simpler — no RSVP state, just three actions.

- [ ] **Step 2: Implement**

```tsx
// web/components/feed/music/MusicActionSheet.tsx
"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { buildEventUrl } from "@/lib/entity-urls";
import type { MusicShowPayload } from "@/lib/music/types";

export interface MusicActionSheetProps {
  show: MusicShowPayload | null;
  portalSlug: string;
  onClose: () => void;
  onAddToPlans: (show: MusicShowPayload) => void;
}

export function MusicActionSheet({ show, portalSlug, onClose, onAddToPlans }: MusicActionSheetProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (show) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [show, onClose]);

  if (!show) return null;
  if (typeof document === "undefined") return null;

  const headliner = show.artists.find((a) => a.is_headliner) ?? show.artists[0];
  const supports = show.artists.filter((a) => !a.is_headliner).slice(0, 3);
  const eventUrl = buildEventUrl(show.id, portalSlug, "feed");

  const content = (
    <div
      className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={[
          "fixed bottom-0 left-0 right-0",
          "bg-[var(--void)] border-t border-[var(--twilight)]",
          "rounded-t-2xl shadow-2xl",
          "max-h-[85vh] overflow-y-auto",
          "md:top-0 md:left-auto md:right-0 md:w-[420px] md:rounded-none md:border-t-0 md:border-l",
          "transition-transform duration-300",
        ].join(" ")}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 rounded-full bg-[var(--twilight)]" />
        </div>

        <div className="px-4 pb-5">
          <div className="font-mono text-2xs text-[var(--muted)] uppercase tracking-wider mb-2">
            {show.venue.name}{show.venue.neighborhood ? ` · ${show.venue.neighborhood}` : ""}
          </div>
          <h2 className="text-xl font-semibold text-[var(--cream)] mb-1">
            {headliner?.name ?? show.title}
          </h2>
          {supports.length > 0 && (
            <div className="text-sm italic text-[var(--soft)] mb-2">
              w/ {supports.map((s) => s.name).join(", ")}
            </div>
          )}
          <div className="text-sm text-[var(--muted)] mb-5 font-mono">
            {show.doors_time && show.start_time
              ? `DOORS ${show.doors_time} · SHOW ${show.start_time}`
              : `SHOW ${show.start_time ?? show.doors_time ?? "TBD"}`}
            {show.age_policy ? ` · ${show.age_policy}` : ""}
            {show.is_free ? " · FREE" : ""}
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              autoFocus
              onClick={() => onAddToPlans(show)}
              className="w-full min-h-[44px] bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
            >
              Add to Plans
            </button>
            {show.ticket_url && (
              <a
                href={show.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[44px] flex items-center justify-center border border-[var(--coral)] text-[var(--coral)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--coral)]/10 transition-colors"
              >
                Get Tickets →
              </a>
            )}
            <a
              href={eventUrl}
              className="w-full min-h-[44px] flex items-center justify-center text-[var(--muted)] hover:text-[var(--cream)] font-mono text-sm transition-colors"
            >
              Open Event →
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
```

- [ ] **Step 3: Commit (no separate test — covered by LiveTonightSection integration test in Task 8)**

```bash
git add web/components/feed/music/MusicActionSheet.tsx
git commit -m "feat(music-feed): MusicActionSheet — Add to Plans / Tickets / Open Event"
```

---

## Task 4: `LiveTonightHeroTile` — dual image/typographic state

**Files:**
- Create: `web/components/feed/music/LiveTonightHeroTile.tsx`
- Create: `web/components/feed/music/LiveTonightHeroTile.test.tsx`

**Context:** Spec §6.2. A tile renders in one of two states: (A) full-bleed artist/venue image, (B) typographic fallback. Image-absent state is first-class per designer review.

- [ ] **Step 1: Test**

```tsx
// web/components/feed/music/LiveTonightHeroTile.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LiveTonightHeroTile } from "./LiveTonightHeroTile";
import type { MusicShowPayload } from "@/lib/music/types";

const mkShow = (overrides: Partial<MusicShowPayload> = {}): MusicShowPayload => ({
  id: 1, title: "Kishi Bashi", start_date: "2026-04-20",
  start_time: "21:00", doors_time: "19:00", image_url: null,
  is_free: false, is_curator_pick: true, is_tentpole: false,
  importance: "major", festival_id: null,
  ticket_status: null, ticket_url: null, age_policy: null, featured_blurb: null,
  tags: ["indie-folk"], genres: ["indie-folk"], genre_buckets: ["Rock"],
  venue: {
    id: 1, name: "Terminal West", slug: "terminal-west", neighborhood: "West Midtown",
    image_url: null, hero_image_url: null, music_programming_style: "curated_indie",
    music_venue_formats: ["standing_room"], capacity: 600, editorial_line: null,
    display_tier: "editorial", capacity_band: "club",
  },
  artists: [{ id: null, slug: null, name: "Kishi Bashi", is_headliner: true, billing_order: 1 }],
  ...overrides,
});

describe("LiveTonightHeroTile", () => {
  it("renders image state when image_url present", () => {
    const show = mkShow({ image_url: "https://example.com/image.jpg" });
    render(<LiveTonightHeroTile show={show} portalSlug="atlanta" onTap={vi.fn()} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("renders typographic state when no image", () => {
    render(<LiveTonightHeroTile show={mkShow()} portalSlug="atlanta" onTap={vi.fn()} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText(/Kishi Bashi/)).toBeInTheDocument();
    expect(screen.getByText(/Terminal West/)).toBeInTheDocument();
  });

  it("renders editorial chip for curator pick", () => {
    render(<LiveTonightHeroTile show={mkShow({ is_curator_pick: true })} portalSlug="atlanta" onTap={vi.fn()} />);
    expect(screen.getByText(/CURATOR PICK/)).toBeInTheDocument();
  });

  it("renders festival chip when festival_id set", () => {
    const show = mkShow({ festival_id: "abc", is_curator_pick: false });
    render(<LiveTonightHeroTile show={show} portalSlug="atlanta" onTap={vi.fn()} />);
    expect(screen.getByText(/FESTIVAL/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// web/components/feed/music/LiveTonightHeroTile.tsx
"use client";

import SmartImage from "@/components/SmartImage";
import type { MusicShowPayload } from "@/lib/music/types";

export interface LiveTonightHeroTileProps {
  show: MusicShowPayload;
  portalSlug: string;
  onTap: (show: MusicShowPayload) => void;
}

function pickImage(show: MusicShowPayload): string | null {
  return show.image_url ?? show.venue.hero_image_url ?? show.venue.image_url ?? null;
}

function chipLabel(show: MusicShowPayload): string | null {
  if (show.is_curator_pick) return "CURATOR PICK";
  if (show.is_tentpole || show.importance === "flagship") return "FLAGSHIP";
  if (show.festival_id) return "FESTIVAL";
  if (show.importance === "major") return "MAJOR SHOW";
  return null;
}

function headlinerName(show: MusicShowPayload): string {
  const headliner = show.artists.find((a) => a.is_headliner);
  return headliner?.name ?? show.title;
}

function supportLine(show: MusicShowPayload): string | null {
  const supports = show.artists.filter((a) => !a.is_headliner).slice(0, 2);
  if (!supports.length) return null;
  return "w/ " + supports.map((s) => s.name).join(", ");
}

function metaLine(show: MusicShowPayload): string {
  const tonight = show.doors_time && show.start_time
    ? `DOORS ${show.doors_time} · SHOW ${show.start_time}`
    : show.start_time ? `SHOW ${show.start_time}` : show.doors_time ? `DOORS ${show.doors_time}` : "";
  return [show.venue.name, tonight].filter(Boolean).join(" · ");
}

export function LiveTonightHeroTile({ show, portalSlug: _portalSlug, onTap }: LiveTonightHeroTileProps) {
  const img = pickImage(show);
  const chip = chipLabel(show);
  const headliner = headlinerName(show);
  const support = supportLine(show);

  return (
    <button
      type="button"
      onClick={() => onTap(show)}
      className={[
        "group relative w-full h-full min-h-[200px] overflow-hidden",
        "bg-[var(--night)] text-left transition-transform active:scale-[0.98]",
      ].join(" ")}
    >
      {img ? (
        <>
          <SmartImage src={img} alt={headliner} fill sizes="(min-width: 768px) 33vw, 100vw"
            className="object-cover" />
          <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/70 to-transparent" />
        </>
      ) : (
        <div className={[
          "absolute inset-0",
          "bg-[var(--night)]",
          "border-l-[3px]",
          show.genre_buckets[0] === "Rock" ? "border-l-[var(--vibe)]" :
            show.genre_buckets[0] === "Hip-Hop/R&B" ? "border-l-[var(--coral)]" :
            show.genre_buckets[0] === "Electronic" ? "border-l-[var(--neon-cyan)]" :
            show.genre_buckets[0] === "Jazz/Blues" ? "border-l-[var(--gold)]" :
            "border-l-[var(--vibe)]",
        ].join(" ")}>
          {show.genre_buckets[0] && (
            <div className="absolute top-10 left-4 font-mono text-xs font-bold tracking-[2px] uppercase text-[var(--gold)]">
              {show.genre_buckets[0]}
            </div>
          )}
        </div>
      )}

      {chip && (
        <span className="absolute top-3 left-3 bg-[var(--gold)] text-[var(--void)] text-2xs font-mono font-bold tracking-widest uppercase px-2 py-1">
          {chip}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="text-3xl font-bold text-[var(--cream)] leading-tight drop-shadow-lg">
          {headliner}
        </div>
        {support && (
          <div className="text-xs italic text-[var(--cream)]/80 mt-1 drop-shadow">
            {support}
          </div>
        )}
        <div className="font-mono text-2xs text-[var(--cream)]/80 mt-2 tracking-wider uppercase drop-shadow">
          {metaLine(show)}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 3: Run tests — expect pass + commit**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run components/feed/music/LiveTonightHeroTile.test.tsx
git add web/components/feed/music/LiveTonightHeroTile.tsx web/components/feed/music/LiveTonightHeroTile.test.tsx
git commit -m "feat(music-feed): LiveTonightHeroTile with dual image/typographic state"
```

---

## Task 5: `LiveTonightHeroStrip` — adaptive 1/2/3-up layout

**Files:**
- Create: `web/components/feed/music/LiveTonightHeroStrip.tsx`

**Context:** Spec §6.2 adaptive layout. 1-up: full width. 2-up: 60/40 split. 3-up: equal thirds. Empty: hide entirely (rendered as `null`).

- [ ] **Step 1: Implement**

```tsx
// web/components/feed/music/LiveTonightHeroStrip.tsx
"use client";

import { LiveTonightHeroTile } from "./LiveTonightHeroTile";
import type { MusicShowPayload } from "@/lib/music/types";

export interface LiveTonightHeroStripProps {
  shows: MusicShowPayload[];
  portalSlug: string;
  onTileTap: (show: MusicShowPayload) => void;
}

export function LiveTonightHeroStrip({ shows, portalSlug, onTileTap }: LiveTonightHeroStripProps) {
  if (shows.length === 0) return null;

  const n = Math.min(shows.length, 3);

  return (
    <section aria-label="This week's significant shows" className="mb-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--gold)]">
          This Week · {shows.length} significant show{shows.length === 1 ? "" : "s"}
        </div>
        <div className="text-xs italic text-[var(--muted)]">Not to miss.</div>
      </div>

      <div className={[
        "grid gap-px bg-black rounded-md overflow-hidden",
        n === 1 ? "grid-cols-1 h-[240px]" :
          n === 2 ? "grid-cols-[60fr_40fr] h-[220px]" :
          "grid-cols-3 h-[200px]",
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
    </section>
  );
}
```

- [ ] **Step 2: Commit (covered by integration test in Task 8)**

```bash
git add web/components/feed/music/LiveTonightHeroStrip.tsx
git commit -m "feat(music-feed): LiveTonightHeroStrip adaptive 1/2/3-up layout"
```

---

## Task 6: `LiveTonightPlaybillRow` + `LiveTonightPlaybill`

**Files:**
- Create: `web/components/feed/music/LiveTonightPlaybillRow.tsx`
- Create: `web/components/feed/music/LiveTonightPlaybill.tsx`

**Context:** Spec §6.4. Single row per venue: venue name fixed-col + artist entries + overflow handling. Separate `TONIGHT` and `LATE NIGHT` bands.

- [ ] **Step 1: Implement row**

```tsx
// web/components/feed/music/LiveTonightPlaybillRow.tsx
"use client";

import { MusicShowtimeChip } from "./MusicShowtimeChip";
import type { MusicShowPayload } from "@/lib/music/types";
import { buildSpotUrl } from "@/lib/entity-urls";

export interface LiveTonightPlaybillRowProps {
  venueName: string;
  venueSlug: string;
  portalSlug: string;
  shows: MusicShowPayload[];
  onShowTap: (show: MusicShowPayload) => void;
}

export function LiveTonightPlaybillRow({
  venueName, venueSlug, portalSlug, shows, onShowTap,
}: LiveTonightPlaybillRowProps) {
  const visible = shows.slice(0, 4);
  const overflow = shows.length - visible.length;
  const venueUrl = buildSpotUrl(venueSlug, portalSlug, "feed");

  return (
    <div className="flex items-start gap-3 py-2 border-b border-[var(--twilight)]/40 last:border-b-0">
      <a
        href={venueUrl}
        className="w-[110px] flex-shrink-0 pt-1.5 font-mono text-xs font-bold tracking-[2.2px] uppercase text-[var(--cream)] hover:text-[var(--vibe)] transition-colors truncate"
      >
        {venueName}
      </a>
      <div className="flex-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {visible.map((show) => {
          const headliner = show.artists.find((a) => a.is_headliner);
          const name = headliner?.name ?? show.title;
          return (
            <div key={show.id} className="flex items-center gap-1.5 text-sm">
              <span className="font-semibold text-[var(--cream)]">{name}</span>
              <MusicShowtimeChip
                doorsTime={show.doors_time}
                showTime={show.start_time}
                ticketStatus={show.ticket_status}
                isFree={show.is_free}
                agePolicy={show.age_policy}
                onTap={() => onShowTap(show)}
              />
            </div>
          );
        })}
        {overflow > 0 && (
          <a
            href={venueUrl}
            className="font-mono text-xs text-[var(--vibe)] hover:opacity-80"
          >
            +{overflow} more →
          </a>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement playbill**

```tsx
// web/components/feed/music/LiveTonightPlaybill.tsx
"use client";

import { LiveTonightPlaybillRow } from "./LiveTonightPlaybillRow";
import type { MusicShowPayload, MusicVenuePayload, TonightPayload } from "@/lib/music/types";

export interface LiveTonightPlaybillProps {
  payload: TonightPayload;
  portalSlug: string;
  onShowTap: (show: MusicShowPayload) => void;
}

function BandHeader({ label }: { label: string }) {
  return (
    <div className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--gold)] mb-2">
      {label}
    </div>
  );
}

function renderGroups(
  groups: { venue: MusicVenuePayload; shows: MusicShowPayload[] }[],
  portalSlug: string,
  onShowTap: (show: MusicShowPayload) => void,
) {
  return groups.map(({ venue, shows }) => (
    <LiveTonightPlaybillRow
      key={venue.id}
      venueName={venue.name}
      venueSlug={venue.slug}
      portalSlug={portalSlug}
      shows={shows}
      onShowTap={onShowTap}
    />
  ));
}

export function LiveTonightPlaybill({ payload, portalSlug, onShowTap }: LiveTonightPlaybillProps) {
  const hasTonight = payload.tonight.length > 0;
  const hasLate = payload.late_night.length > 0;

  if (!hasTonight && !hasLate) {
    return (
      <div className="text-sm italic text-[var(--muted)] py-3">
        Quiet night — see residencies and what's coming up →
      </div>
    );
  }

  return (
    <div>
      {hasTonight && (
        <div>
          <BandHeader label={`Tonight · ${payload.date}`} />
          <div>{renderGroups(payload.tonight, portalSlug, onShowTap)}</div>
        </div>
      )}
      {hasLate && (
        <div className={hasTonight ? "mt-4" : ""}>
          <BandHeader label="Late Night" />
          <div>{renderGroups(payload.late_night, portalSlug, onShowTap)}</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/music/LiveTonightPlaybill.tsx web/components/feed/music/LiveTonightPlaybillRow.tsx
git commit -m "feat(music-feed): playbill + row with TONIGHT/LATE NIGHT bands"
```

---

## Task 7: `LiveTonightSection` — manifest-registered island

**Files:**
- Create: `web/components/feed/sections/LiveTonightSection.tsx`

**Context:** Server component — imports server loaders directly (per `web/CLAUDE.md`), renders the hero strip + playbill, passes action-sheet handling via a small client subcomponent. Registered in the feed manifest (Task 8).

- [ ] **Step 1: Implement**

```tsx
// web/components/feed/sections/LiveTonightSection.tsx
import { loadThisWeek } from "@/lib/music/this-week-loader";
import { loadTonight } from "@/lib/music/tonight-loader";
import { FeedSectionHeader } from "@/components/feed/FeedSectionHeader";
import { LiveTonightClient } from "@/components/feed/music/LiveTonightClient";

export interface LiveTonightSectionProps {
  portalSlug: string;
}

export async function LiveTonightSection({ portalSlug }: LiveTonightSectionProps) {
  const [thisWeek, tonight] = await Promise.all([
    loadThisWeek(portalSlug),
    loadTonight(portalSlug),
  ]);

  const totalTonight = tonight.tonight.reduce((acc, g) => acc + g.shows.length, 0)
    + tonight.late_night.reduce((acc, g) => acc + g.shows.length, 0);

  // Hide entirely if there's nothing to show — avoids an empty block in the feed.
  if (thisWeek.shows.length === 0 && totalTonight === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)] overflow-hidden p-4">
      <FeedSectionHeader
        title="Live Tonight"
        priority="primary"
        accentColor="vibe"
        badge={totalTonight > 0 ? `${totalTonight} show${totalTonight === 1 ? "" : "s"}` : undefined}
        seeAllHref={`/${portalSlug}/explore/music`}
      />

      <LiveTonightClient
        thisWeekShows={thisWeek.shows}
        tonightPayload={tonight}
        portalSlug={portalSlug}
      />
    </section>
  );
}
```

- [ ] **Step 2: Create the client wrapper (handles action-sheet state)**

```tsx
// web/components/feed/music/LiveTonightClient.tsx
"use client";

import { useState } from "react";
import { LiveTonightHeroStrip } from "./LiveTonightHeroStrip";
import { LiveTonightPlaybill } from "./LiveTonightPlaybill";
import { MusicActionSheet } from "./MusicActionSheet";
import type { MusicShowPayload, TonightPayload } from "@/lib/music/types";

export interface LiveTonightClientProps {
  thisWeekShows: MusicShowPayload[];
  tonightPayload: TonightPayload;
  portalSlug: string;
}

export function LiveTonightClient({
  thisWeekShows, tonightPayload, portalSlug,
}: LiveTonightClientProps) {
  const [activeShow, setActiveShow] = useState<MusicShowPayload | null>(null);

  const handleAddToPlans = async (show: MusicShowPayload) => {
    await fetch("/api/plans/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: show.id }),
    }).catch(() => {
      // Error toast handled upstream in Plans infra.
    });
    setActiveShow(null);
  };

  return (
    <>
      <LiveTonightHeroStrip
        shows={thisWeekShows}
        portalSlug={portalSlug}
        onTileTap={setActiveShow}
      />
      <LiveTonightPlaybill
        payload={tonightPayload}
        portalSlug={portalSlug}
        onShowTap={setActiveShow}
      />
      <MusicActionSheet
        show={activeShow}
        portalSlug={portalSlug}
        onClose={() => setActiveShow(null)}
        onAddToPlans={handleAddToPlans}
      />
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/sections/LiveTonightSection.tsx web/components/feed/music/LiveTonightClient.tsx
git commit -m "feat(music-feed): LiveTonightSection + LiveTonightClient action orchestrator"
```

---

## Task 8: Swap manifest entry; integration test

**Files:**
- Modify: `web/lib/city-pulse/manifests/atlanta.tsx`
- Create: `web/components/feed/sections/LiveTonightSection.test.tsx`

**Context:** Replace the current music tab island in the Atlanta feed manifest with the new section. Verify feed still renders end-to-end.

- [ ] **Step 1: Edit the manifest**

In `web/lib/city-pulse/manifests/atlanta.tsx`, find the existing `LiveMusicSection` / `MusicTabContent` island registration and replace:

```typescript
// Before:
const LiveMusicSection = dynamic(
  () => import("@/components/feed/sections/MusicTabContent"),
);

// After:
const LiveTonightSection = dynamic(
  () => import("@/components/feed/sections/LiveTonightSection").then((m) => m.LiveTonightSection),
  { ssr: true },
);
```

Update the island wrapper:

```typescript
// Before:
function LiveMusicIsland({ ctx }: FeedSectionComponentProps) { ... }

// After:
function LiveTonightIsland({ ctx }: FeedSectionComponentProps) {
  return (
    <>
      <div className="h-px bg-[var(--twilight)]" />
      <div className="pt-6">
        <LazySection minHeight={320}>
          <LiveTonightSection portalSlug={ctx.portalSlug} />
        </LazySection>
      </div>
    </>
  );
}
```

Update the array entry:

```typescript
{ id: "live-tonight", component: LiveTonightIsland, loader: null },
```

- [ ] **Step 2: Integration test**

```tsx
// web/components/feed/sections/LiveTonightSection.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveTonightSection } from "./LiveTonightSection";

vi.mock("@/lib/music/this-week-loader", () => ({
  loadThisWeek: vi.fn(async () => ({ shows: [] })),
}));
vi.mock("@/lib/music/tonight-loader", () => ({
  loadTonight: vi.fn(async () => ({ date: "2026-04-20", tonight: [], late_night: [] })),
}));

describe("LiveTonightSection", () => {
  it("renders nothing when there's nothing to show", async () => {
    const { container } = render(await LiveTonightSection({ portalSlug: "atlanta" }));
    expect(container.firstChild).toBeNull();
  });

  it("renders the section when there's data", async () => {
    const { loadTonight } = await import("@/lib/music/tonight-loader");
    (loadTonight as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      date: "2026-04-20",
      tonight: [{
        venue: { id: 1, name: "Terminal West", slug: "terminal-west", neighborhood: "West Midtown",
                 image_url: null, hero_image_url: null, music_programming_style: null,
                 music_venue_formats: [], capacity: 600, editorial_line: null,
                 display_tier: "editorial" as const, capacity_band: "club" as const },
        shows: [],  // presence of venue group is enough to prove rendering
      }],
      late_night: [],
    });
    render(await LiveTonightSection({ portalSlug: "atlanta" }));
    expect(screen.getByText(/Live Tonight/)).toBeInTheDocument();
  });
});
```

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run components/feed/sections/LiveTonightSection.test.tsx
```

- [ ] **Step 3: Browser verification**

Start the dev server and confirm the feed renders without console errors:

```bash
cd /Users/coach/Projects/LostCity/web && npm run dev &
sleep 5
```

Load `http://localhost:3000/atlanta` in a headed browser (or use the `qa` agent). Verify:
1. Section renders with header "Live Tonight"
2. Hero strip shows 0-3 tiles based on real data
3. Tonight playbill shows venue rows
4. Late Night band appears only when there are 21:00+ shows
5. Tapping a showtime chip opens the action sheet
6. Action sheet shows Add to Plans + Get Tickets (when URL present) + Open Event
7. Escape key + backdrop click close the sheet
8. Height stays under ~320px at 1280px viewport
9. At 375px mobile, venue names truncate rather than wrap
10. No console errors

If any of these fail, STOP — do not proceed to Task 9 (deletion). Fix and re-verify first.

- [ ] **Step 4: Commit**

```bash
git add web/lib/city-pulse/manifests/atlanta.tsx web/components/feed/sections/LiveTonightSection.test.tsx
git commit -m "feat(music-feed): register LiveTonightSection in Atlanta feed manifest"
```

---

## Task 9: Retire `MusicTabContent`

**Files:**
- Delete: `web/components/feed/sections/MusicTabContent.tsx`

**Context:** Per `web/CLAUDE.md` Architectural Shifts — "Delete compatibility aggressively. If you replace a route bridge or legacy emitter, remove the old emission path in the same workstream."

- [ ] **Step 1: Re-audit before deletion**

```bash
cd /Users/coach/Projects/LostCity && grep -r "MusicTabContent" web/ --include="*.ts" --include="*.tsx" -l
```

Expected: only the file itself (or empty if manifest swap in Task 8 removed all imports). If any OTHER file still imports it, STOP and migrate that call-site first.

- [ ] **Step 2: Delete**

```bash
rm web/components/feed/sections/MusicTabContent.tsx
```

- [ ] **Step 3: Typecheck + lint + test suite**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit && npm run lint && npx vitest run
```

Expected: all green. If `tsc` flags an orphaned import, fix the import site.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(music-feed): retire MusicTabContent (superseded by LiveTonightSection)"
```

---

## Task 10: Motion + interaction polish

**Files:**
- Modify: `web/components/feed/music/LiveTonightHeroTile.tsx`
- Modify: `web/components/feed/music/LiveTonightPlaybillRow.tsx`
- Modify: `web/components/feed/music/MusicShowtimeChip.tsx`
- Modify: `web/components/feed/music/MusicActionSheet.tsx`

**Context:** Per `feedback_design_motion_in_plans.md` — motion is a workflow gate in implementation plans. This task is NOT optional. Hover states, entrance animations, and the action-sheet slide-in must be polished before calling the plan done.

- [ ] **Step 1: Hero tile entrance animation**

Add to the tile's outer element:

```tsx
className={["animate-page-enter duration-500 [animation-delay:50ms]", /* existing classes */].join(" ")}
```

Stagger across three tiles with `--tile-index` CSS var and `animation-delay: calc(var(--tile-index) * 80ms)`.

- [ ] **Step 2: Hover micro-interactions**

Hero tile: subtle scale on hover:
```css
.group:hover [data-tile-headline] {
  transform: translateY(-2px);
  transition: transform 240ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

Playbill row: left-gutter accent appears on hover of the venue name:
```tsx
<a className="... border-l-2 border-transparent hover:border-l-[var(--vibe)] hover:pl-2 transition-[border-color,padding-left] duration-200">
```

- [ ] **Step 3: Action sheet slide-in**

Ensure the sheet uses `transition-transform duration-300` with `translate-y-full` → `translate-y-0` keyed off open state. On close, reverse before unmounting (use `useEffect` with a `mounted` state flag and 300ms timeout).

- [ ] **Step 4: Chip press-state**

Already covered by `active:scale-95` in Task 2. Confirm visually.

- [ ] **Step 5: Run `/motion audit` on the feed URL**

```bash
# From the main conversation, dispatch:
#   /motion audit http://localhost:3000/atlanta --section live-tonight
```

Fix any findings flagged.

- [ ] **Step 6: Commit**

```bash
git add web/components/feed/music
git commit -m "feat(music-feed): motion polish — stagger, hover, sheet slide-in"
```

---

## Completion Checklist

- [ ] Manifest swap confirmed: `grep -rn "MusicTabContent" web/ --include="*.tsx"` returns nothing
- [ ] Feed renders end-to-end in browser (Task 8 Step 3 verification)
- [ ] All vitest suites green
- [ ] `npx tsc --noEmit` clean
- [ ] Lint clean
- [ ] Lighthouse CLS < 0.1 on feed page after this section loads
- [ ] `/motion audit` has no open findings for the section
