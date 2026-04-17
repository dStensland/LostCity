# Feed Shell Server/Client Split — Follow-up from Feed Elevate

**Origin:** Deferred work from `docs/plans/feed-elevate-2026-04-16.md` Wave C (C1, C2, C7). The elevate pass shipped 70% of Wave C (prefs cleanup, redundant fetch removal, canonical URL migration, Yonder/community pruning). The remaining 30% — a genuine architectural rebuild — was pulled out because it deserves its own branch, staged migration, and dedicated session.

**Status:** Not started. Pick up in a clean context window.

## North star

Turn `web/components/feed/CityPulseShell.tsx` from a 400-line `"use client"` kitchen sink into a thin **server orchestrator** that renders a **section manifest** with **client islands** only where interactivity earns its keep. Measured wins:

- Real HTML for above-the-fold sections (today they all hydrate after JS parse).
- Smaller client bundle: `LineupSection` is 945 lines with 40+ Phosphor icon imports; most of that shouldn't ship for static sections.
- A real contract — adding or removing a section should be ≤1 file change, not surgery across the shell + type enum + prefs migration + section file.
- Enables the deferred C7 port of `TodayInAtlantaSection` + `FestivalsSection` to RSC.

## Current state (read this before touching anything)

- `web/components/feed/CityPulseShell.tsx` — `"use client"` at the top. Shell is a flat JSX stream of 9 sections with hard-coded order. Feed-block prefs system was removed in the elevate pass (commit `720d7054`) so there's no user reorder/hide to worry about anymore.
- Section self-fetching is the norm. Each section does its own `useQuery` or `useEffect`+fetch. No section-contract object, no shared loader pattern.
- Server-loader pattern exists partially: `web/lib/city-pulse/server-feed.ts` + `server-regulars.ts` are RSC-friendly and already server-prefetched in `FeedSurface.tsx`. The shell then hydrates and the sections re-fetch anyway (redundancy removed in elevate pass).
- `LineupSection` is genuinely interactive (tab + chip state, category picker) and must stay a client island.
- `NowShowingSection`, `LiveMusicSection`, `GameDaySection`, `YonderRegionalEscapesSection`, `YonderDestinationNodeQuestsSection`, `HangFeedSection`, `PlacesToGoSection` are dynamic-imported with `ssr: false` — no HTML on first paint, pop in after scroll.
- `CityBriefing` (hero), `FestivalsSection`, `TodayInAtlantaSection`, `RegularHangsSection` render eagerly.
- Yonder branch in the shell is tagged with a TODO for a dedicated `YonderFeedShell` — should be extracted by this work.

## Target architecture

### Section contract

```ts
// web/lib/city-pulse/feed-section-contract.ts
import type { ComponentType } from "react";

export interface FeedSectionContext {
  portalSlug: string;
  portalId: string;
  vertical?: string | null;
  isLightTheme: boolean;
}

export interface FeedSectionProps {
  ctx: FeedSectionContext;
  /** Pre-loaded server data, typed by the section. */
  initialData?: unknown;
}

export type FeedSectionMode = "server" | "client-island";

export interface FeedSection<TData = unknown> {
  id: string;                          // stable identifier, e.g. "festivals"
  mode: FeedSectionMode;
  component: ComponentType<FeedSectionProps & { initialData?: TData }>;
  /** Runs on the server (RSC path). Returns the data the component needs. */
  loader?: (ctx: FeedSectionContext) => Promise<TData | null>;
  /** Rendered around the section (anchors, spacing, dividers). Same shape for all. */
  wrapper?: {
    id?: string;
    className?: string;
    dataAnchor?: boolean;
    indexLabel?: string;
  };
  /** Placeholder while the section is off-screen or loading. */
  placeholder?: ComponentType;
  /** Gate. If returns false, section is not rendered at all. */
  shouldRender?: (ctx: FeedSectionContext) => boolean;
}
```

### Manifest per portal template

```ts
// web/lib/city-pulse/manifests/atlanta.ts
import type { FeedSection } from "../feed-section-contract";
import { CityBriefingSection } from "@/components/feed/CityBriefing";
import { TodayInAtlantaSection } from "@/components/feed/sections/TodayInAtlantaSection";
// ... imports

export const ATLANTA_FEED_MANIFEST: FeedSection[] = [
  { id: "briefing",     mode: "client-island", component: CityBriefingSection, ... },
  { id: "news",         mode: "server",        component: TodayInAtlantaSection, loader: loadNewsFeed, ... },
  { id: "lineup",       mode: "client-island", component: LineupSection, ... },
  { id: "festivals",    mode: "server",        component: FestivalsSection, loader: loadFestivals, ... },
  { id: "cinema",       mode: "client-island", component: NowShowingSection, ... },
  { id: "live_music",   mode: "client-island", component: LiveMusicSection, ... },
  { id: "regulars",     mode: "server",        component: RegularHangsSection, loader: loadRegulars, ... },
  { id: "places",       mode: "server",        component: PlacesToGoSection, loader: loadPlacesToGo, ... },
  { id: "hangs",        mode: "client-island", component: HangFeedSection, shouldRender: () => ENABLE_HANGS_V1 },
  { id: "sports",       mode: "client-island", component: GameDaySection, ... },
  { id: "active_contest", mode: "server",      component: ActiveContestSection, loader: loadActiveContest, ... },
];
```

Parallel manifests: `yonder.ts` (the current Yonder branch extracted), and optionally consolidate community/arts into their existing shells or bring them under this contract too.

### Server orchestrator

```tsx
// web/components/feed/CityPulseServerShell.tsx — Server Component (no "use client")
export async function CityPulseServerShell({ portalSlug, portalId, vertical }: Props) {
  const manifest = resolveFeedManifest(portalSlug);
  const ctx: FeedSectionContext = { portalSlug, portalId, vertical, isLightTheme };

  // Load server sections in parallel.
  const loaded = await Promise.all(
    manifest
      .filter((s) => s.mode === "server" && s.shouldRender?.(ctx) !== false)
      .map(async (s) => [s.id, await s.loader!(ctx)] as const),
  );
  const serverDataById = new Map(loaded);

  return (
    <FeedShellChrome>
      {manifest.map((section) => {
        if (section.shouldRender?.(ctx) === false) return null;
        if (section.mode === "server") {
          const Component = section.component;
          return (
            <SectionWrapper key={section.id} {...section.wrapper}>
              <Component ctx={ctx} initialData={serverDataById.get(section.id)} />
            </SectionWrapper>
          );
        }
        // Client island — renders nothing on server; component is "use client"
        const ClientComponent = section.component;
        return (
          <SectionWrapper key={section.id} {...section.wrapper}>
            <ClientComponent ctx={ctx} />
          </SectionWrapper>
        );
      })}
    </FeedShellChrome>
  );
}
```

## Execution plan (staged)

**Branch:** `feat/feed-shell-server-split` off current `main` (includes elevate pass).

### Step 1 — Define the contract
- Add `web/lib/city-pulse/feed-section-contract.ts` with `FeedSection`, `FeedSectionProps`, `FeedSectionContext`.
- Add `web/lib/city-pulse/manifests/atlanta.ts` — empty scaffold at first, just a type-correct empty array + `resolveFeedManifest(slug)` helper.
- No runtime behavior change yet. Merge.

### Step 2 — Extract the simplest server section first
Start with **`FestivalsSection`** — it's a straight data fetch with no client state.
- Move the fetch logic out of the component into `web/lib/city-pulse/loaders/load-festivals.ts`. Signature: `async (ctx) => FestivalData | null`.
- Make the component accept `initialData`. Retain the current client-side `useEffect` fetch as fallback if `initialData` is undefined (helps with parallel migration).
- Add the section to the manifest as `mode: "server"`.
- Render from the new `CityPulseServerShell` alongside the still-client `CityPulseShell` behind a flag (`USE_FEED_MANIFEST`).
- Flip the flag locally, verify parity, browser-test.

### Step 3 — Port remaining server-safe sections
Same pattern for each:
- `TodayInAtlantaSection` (news — client island for tab state, but the data fetch moves server-side)
- `RegularHangsSection`
- `PlacesToGoSection`
- `ActiveContestSection`
- `HolidayHero`

Each needs a server loader + `initialData` prop. Keep the tab/filter state in a small client wrapper where applicable. Motion classes stay put — they're CSS.

### Step 4 — Keep the real interactive sections as client islands
`LineupSection`, `NowShowingSection`, `MusicTabContent`, `GameDaySection`, `CityBriefing` — rename their wrappers to `*Island` and add them to the manifest as `mode: "client-island"`. The `"use client"` directive moves to each island component instead of living at the shell level.

### Step 5 — Cut over
- Replace `CityPulseShell` with `CityPulseServerShell` in `DefaultTemplate`.
- Delete the flag.
- Delete the old `CityPulseShell.tsx`.

### Step 6 — Extract Yonder
- New `YonderFeedShell` in `components/feed/YonderFeedShell.tsx` wrapping `CityPulseServerShell` with the Yonder manifest.
- Route `vertical === "yonder"` (or `portalSlug === "yonder"`) to it from `DefaultTemplate`.
- Remove the Yonder branch + TODO from the old shell.

## Verification gates (each step)

1. `npx tsc --noEmit` clean.
2. `/atlanta` renders the same sections in the same order.
3. Lighthouse: hydration JS budget on `/atlanta` should drop by 20%+ after Step 3.
4. No visual regression — use `product-designer` agent at desktop + mobile (browser exclusivity rule: one at a time).
5. No functional regression — all 20 items from the feed-elevate QA checklist still pass.

## Known risks

- **Prop contract drift:** today each section has a bespoke prop shape. The manifest forces a common shape. Some sections pass portal-specific signals (`CityBriefing` wants `context.weather_signal`). Either extend `FeedSectionContext` to carry those optionally or wrap the section component to translate.
- **`useCityPulseFeed` hook:** today `LineupSection` consumes this via `sections` + `tabCounts` props from the shell. Turning the shell server-side means either (a) `LineupSection` fetches its own feed data in-island, or (b) the shell passes server-loaded feed data down as `initialData`. Option (b) is cleaner; it moves the `getServerFeedData` call into the manifest.
- **Theme + ambient effects:** `getFeedThemeVars`, `AmbientBackground`, `AmbientSuppression` — these belong on the shell chrome layer, not inside sections. The server shell should own theme CSS injection via `<style>` or inline `style={themeVars}`.
- **Dynamic imports:** today `NowShowingSection` et al. are `dynamic(() => import(...), { ssr: false })`. After migration they can still use `dynamic()` for code-splitting but `ssr: false` is only needed if the island genuinely relies on window/browser-only APIs — audit each.
- **Stream priority:** server sections render top-down. If `loadFestivals` is slow it'll block everything below. Consider `Suspense` per section so sections stream independently.

## Things to **not** do in this pass

- Don't rewrite section visuals. The elevate pass already polished everything. This is an architecture-only migration.
- Don't touch the motion CSS. The classes (`lineup-tab-enter-*`, `festival-card-tilt`, `livemusic-card-glow`, `theater-poster-riffle`, etc.) are fine and decoupled from the shell structure.
- Don't change the sort logic or category exclusion lists. Leave `scoring.ts`, `fetch-events.ts` alone.
- Don't reintroduce the feed-block prefs system. It was deleted deliberately.

## Files in scope

Create:
- `web/lib/city-pulse/feed-section-contract.ts`
- `web/lib/city-pulse/manifests/atlanta.ts`
- `web/lib/city-pulse/manifests/yonder.ts`
- `web/lib/city-pulse/loaders/load-festivals.ts`
- `web/lib/city-pulse/loaders/load-news.ts`
- `web/lib/city-pulse/loaders/load-regulars.ts` (refactor of existing `server-regulars.ts`)
- `web/lib/city-pulse/loaders/load-places-to-go.ts`
- `web/lib/city-pulse/loaders/load-active-contest.ts`
- `web/lib/city-pulse/loaders/load-holiday-hero.ts`
- `web/components/feed/CityPulseServerShell.tsx`
- `web/components/feed/YonderFeedShell.tsx`

Modify:
- `web/components/feed/CityBriefing.tsx` (split into `CityBriefingIsland` + data-only props)
- `web/components/feed/LineupSection.tsx` (accept `initialFeedData` prop instead of receiving the hook's data from a parent client component)
- `web/components/feed/sections/*.tsx` (add `initialData` prop per section, retain useEffect fallback during migration, drop it after cutover)
- `web/app/[portal]/_templates/default.tsx` (dispatch to `YonderFeedShell` for Yonder; dispatch to `CityPulseServerShell` for Atlanta + default cities)

Delete after cutover:
- `web/components/feed/CityPulseShell.tsx`

## Reference — session that produced this plan

- Elevate pass commits: `54f317ae` (plan), `720d7054` (waves A/B/C/D)
- Feed elevate plan: `docs/plans/feed-elevate-2026-04-16.md`
- Wave C scope decisions: pruned prefs system, redundant prefetches, canonical URLs, Yonder TODO
- Audit findings that motivated this work: "Shell is 615 lines and growing", "vertical leakage inside Atlanta shell", "no section contract" — see the `CityPulseShell` architecture lens section of the elevate plan.
