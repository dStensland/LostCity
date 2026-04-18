/**
 * Atlanta (default) feed manifest.
 *
 * Mirrors the legacy `CityPulseShell` render order section-for-section.
 * Server sections ship their payload through `loader`; client islands stay
 * client but receive server-pre-loaded `initialData` via the same loader
 * mechanic — React Query inside the island is seeded so no client waterfall
 * fires on mount.
 *
 * See docs/plans/feed-shell-server-split-2026-04-17.md.
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import HolidayHero from "@/components/feed/HolidayHero";
import { TodayInAtlantaSection } from "@/components/feed/sections/TodayInAtlantaSection";
import BigStuffSection from "@/components/feed/sections/BigStuffSection";
import RegularHangsSection from "@/components/feed/sections/RegularHangsSection";
import { PlacesToGoSection } from "@/components/feed/sections/PlacesToGoSection";
import ActiveContestSection from "@/components/feed/sections/ActiveContestSection";
import { LiveTonightSection } from "@/components/feed/sections/LiveTonightSection";
import CityBriefingIsland from "@/components/feed/islands/CityBriefingIsland";
import LineupIsland from "@/components/feed/islands/LineupIsland";
import LazySection from "@/components/feed/LazySection";
import { ENABLE_HANGS_V1 } from "@/lib/launch-flags";

import {
  loadBigStuffForFeed,
  type BigStuffFeedData,
} from "../loaders/load-big-stuff";
import {
  loadNewsForFeed,
  type NewsFeedData,
} from "../loaders/load-news";
import {
  loadRegularsForFeed,
  type RegularsFeedData,
} from "../loaders/load-regulars";
import { loadPlacesToGoForFeed } from "../loaders/load-places-to-go";
import {
  loadActiveContestForFeed,
  type ActiveContestFeedData,
} from "../loaders/load-active-contest";
import {
  loadHolidayHeroForFeed,
  type HolidayHeroFeedData,
} from "../loaders/load-holiday-hero";
import { loadCityPulseForFeed } from "../loaders/load-city-pulse";
import type { CityPulseResponse } from "../types";
import type { PlacesToGoResponse } from "@/lib/places-to-go/types";
import type {
  FeedSection,
  FeedSectionComponentProps,
} from "../feed-section-contract";

// ── Dynamically-imported client islands (code-split below the fold) ─────────
//
// `ssr: false` is intentionally omitted — manifest is imported from a Server
// Component, and `next/dynamic` disallows `ssr: false` in that context. The
// underlying section components all carry `"use client"` and are wrapped by
// `LazySection`, which already defers rendering until the viewport intersects.

const NowShowingSection = dynamic(
  () => import("@/components/feed/sections/NowShowingSection"),
);
const GameDaySection = dynamic<{ portalSlug: string }>(() =>
  import("@/components/feed/sections/GameDaySection").then((m) => ({
    default: m.default as ComponentType<{ portalSlug: string }>,
  })),
);
const HangFeedSection = dynamic(() =>
  import("@/components/feed/sections/HangFeedSection").then((m) => ({
    default: m.HangFeedSection,
  })),
);

// ── Section island adapters ─────────────────────────────────────────────────

function CityBriefingManifestIsland({ ctx, initialData }: FeedSectionComponentProps) {
  const data = initialData as CityPulseResponse | null | undefined;
  return (
    <CityBriefingIsland
      portalSlug={ctx.portalSlug}
      portalId={ctx.portalId}
      serverHeroUrl={ctx.serverHeroUrl}
      initialData={data ?? null}
    />
  );
}

function HolidayHeroIsland({ ctx, initialData }: FeedSectionComponentProps) {
  const data = initialData as HolidayHeroFeedData | null | undefined;
  return (
    <HolidayHero
      portalSlug={ctx.portalSlug}
      eventCount={data?.eventCount ?? null}
    />
  );
}

function TodayInAtlantaIsland({ ctx, initialData }: FeedSectionComponentProps) {
  const data = initialData as NewsFeedData | null | undefined;
  return (
    <TodayInAtlantaSection
      portalSlug={ctx.portalSlug}
      initialData={data ?? null}
    />
  );
}

function LineupManifestIsland({ ctx, initialData }: FeedSectionComponentProps) {
  const data = initialData as CityPulseResponse | null | undefined;
  return <LineupIsland portalSlug={ctx.portalSlug} initialData={data ?? null} />;
}

function BigStuffSectionIsland({ ctx, initialData }: FeedSectionComponentProps) {
  const data = initialData as BigStuffFeedData | null | undefined;
  return (
    <BigStuffSection
      portalSlug={ctx.portalSlug}
      portalId={ctx.portalId}
      initialData={data ?? null}
    />
  );
}

function NowShowingIsland({ ctx }: FeedSectionComponentProps) {
  return (
    <>
      <div className="h-px bg-[var(--twilight)]" />
      <div className="pt-6">
        <LazySection minHeight={220}>
          <NowShowingSection portalSlug={ctx.portalSlug} />
        </LazySection>
      </div>
    </>
  );
}

function LiveTonightIsland({ ctx }: FeedSectionComponentProps) {
  return (
    <>
      <div className="h-px bg-[var(--twilight)]" />
      <div className="pt-6">
        {/* Density-fix posture (mirrors cinema widget): hero strip cap 200px +
            tonight sub-header ~28px + 4 venue rows × ~32px + footer link ~24px
            ≈ 380px max. Use 320 as the placeholder (matches cinema's typical
            height) so the lazy section doesn't collapse before paint. */}
        <LazySection minHeight={320}>
          <LiveTonightSection portalSlug={ctx.portalSlug} />
        </LazySection>
      </div>
    </>
  );
}

function RegularHangsIsland({ ctx, initialData }: FeedSectionComponentProps) {
  const data = initialData as RegularsFeedData | null | undefined;
  return (
    <RegularHangsSection
      portalSlug={ctx.portalSlug}
      initialData={data ?? null}
    />
  );
}

function PlacesToGoIsland({ ctx, initialData }: FeedSectionComponentProps) {
  const data = initialData as PlacesToGoResponse | null | undefined;
  return (
    <LazySection minHeight={400}>
      <PlacesToGoSection
        portalSlug={ctx.portalSlug}
        initialData={data ?? null}
      />
    </LazySection>
  );
}

function ActiveContestIsland({ ctx, initialData }: FeedSectionComponentProps) {
  const data = initialData as ActiveContestFeedData | null | undefined;
  return (
    <ActiveContestSection
      portalSlug={ctx.portalSlug}
      initialData={data ?? null}
    />
  );
}

function HangFeedIsland({ ctx }: FeedSectionComponentProps) {
  return (
    <LazySection minHeight={200}>
      <HangFeedSection portalSlug={ctx.portalSlug} />
    </LazySection>
  );
}

function GameDayIsland({ ctx }: FeedSectionComponentProps) {
  return (
    <>
      <div className="h-px bg-[var(--twilight)]" />
      <div className="pt-6">
        <LazySection minHeight={200}>
          <GameDaySection portalSlug={ctx.portalSlug} />
        </LazySection>
      </div>
    </>
  );
}

// ── Manifest ────────────────────────────────────────────────────────────────

export const ATLANTA_FEED_MANIFEST: FeedSection[] = [
  {
    id: "briefing",
    render: "client-island",
    component: CityBriefingManifestIsland,
    loader: loadCityPulseForFeed,
    wrapper: {
      id: "city-pulse-briefing",
      className: "scroll-mt-28",
      dataAnchor: true,
      indexLabel: "City Briefing",
      blockId: "briefing",
    },
  },
  {
    id: "holiday",
    render: "server",
    component: HolidayHeroIsland,
    loader: loadHolidayHeroForFeed,
  },
  {
    id: "news",
    render: "server",
    component: TodayInAtlantaIsland,
    loader: loadNewsForFeed,
  },
  {
    id: "lineup",
    render: "client-island",
    component: LineupManifestIsland,
    loader: loadCityPulseForFeed,
    wrapper: {
      id: "city-pulse-events",
      className: "mt-4 scroll-mt-28",
      dataAnchor: true,
      indexLabel: "The Lineup",
      blockId: "events",
    },
  },
  {
    id: "festivals",
    render: "server",
    component: BigStuffSectionIsland,
    loader: loadBigStuffForFeed,
    wrapper: {
      id: "city-pulse-festivals",
      className: "scroll-mt-28",
      dataAnchor: true,
      indexLabel: "The Big Stuff",
      blockId: "festivals",
    },
    shouldRender: (ctx) => Boolean(ctx.portalId),
  },
  {
    id: "cinema",
    render: "client-island",
    component: NowShowingIsland,
    wrapper: {
      id: "city-pulse-cinema",
      className: "mt-8 scroll-mt-28",
      dataAnchor: true,
      indexLabel: "Now Showing",
      blockId: "cinema",
    },
  },
  {
    id: "live_tonight",
    render: "client-island",
    component: LiveTonightIsland,
    wrapper: {
      id: "city-pulse-live-tonight",
      className: "mt-8 scroll-mt-28",
      dataAnchor: true,
      indexLabel: "Live Tonight",
      blockId: "live_tonight",
    },
  },
  {
    id: "regulars",
    render: "server",
    component: RegularHangsIsland,
    loader: loadRegularsForFeed,
  },
  {
    id: "places",
    render: "server",
    component: PlacesToGoIsland,
    loader: loadPlacesToGoForFeed,
    wrapper: {
      id: "city-pulse-places-to-go",
      className: "scroll-mt-28 mt-6",
      dataAnchor: true,
      indexLabel: "Places to Go",
      blockId: "places",
    },
  },
  {
    id: "active_contest",
    render: "server",
    component: ActiveContestIsland,
    loader: loadActiveContestForFeed,
  },
  {
    id: "hangs",
    render: "client-island",
    component: HangFeedIsland,
    wrapper: {
      id: "city-pulse-hangs",
      className: "mt-6 scroll-mt-28",
      dataAnchor: true,
      indexLabel: "Hangs",
      blockId: "hangs",
    },
    shouldRender: () => ENABLE_HANGS_V1,
  },
  {
    id: "sports",
    render: "client-island",
    component: GameDayIsland,
    wrapper: {
      id: "city-pulse-sports",
      className: "mt-8 scroll-mt-28",
      dataAnchor: true,
      indexLabel: "Game Day",
      blockId: "sports",
    },
  },
];
