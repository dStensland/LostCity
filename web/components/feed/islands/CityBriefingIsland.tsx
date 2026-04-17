"use client";

/**
 * CityBriefingIsland — client island wrapping CityBriefing + the optional CTA.
 *
 * Consumes the shared city-pulse feed payload via `useCityPulseFeed` (seeded
 * from the manifest loader's `initialData`) and derives the briefing's
 * header/context/quick-links. Falls back to the client-safe defaults used by
 * the legacy shell when the API hasn't returned yet.
 */
import { useMemo } from "react";
import Link from "next/link";
import CityBriefing from "../CityBriefing";
import { useCityPulseFeed } from "@/lib/hooks/useCityPulseFeed";
import { getDayOfWeek, getDayTheme } from "@/lib/city-pulse/time-slots";
import {
  getEditorialHeadline,
  getCityPhoto,
  getDefaultAccentColor,
} from "@/lib/city-pulse/header-defaults";
import { getDashboardCards } from "@/lib/city-pulse/dashboard-cards";
import { getContextualQuickLinks } from "@/lib/city-pulse/quick-links";
import type {
  CityPulseResponse,
  FeedContext,
  ResolvedHeader,
  TimeSlot,
} from "@/lib/city-pulse/types";

interface CityBriefingIslandProps {
  portalSlug: string;
  serverHeroUrl?: string;
  initialData?: CityPulseResponse | null;
}

function buildDefaultContext(timeSlot: TimeSlot, dayOfWeek: string): FeedContext {
  return {
    time_slot: timeSlot,
    day_of_week: dayOfWeek,
    weather: null,
    active_holidays: [],
    active_festivals: [],
    quick_links: [],
    day_theme: getDayTheme(dayOfWeek, timeSlot),
    weather_signal: undefined,
  };
}

function buildDefaultHeader(
  context: FeedContext,
  portalSlug: string,
): ResolvedHeader {
  return {
    config_id: null,
    config_slug: null,
    headline: getEditorialHeadline(context),
    hero_image_url: getCityPhoto(
      context.time_slot,
      undefined,
      context.day_of_week,
    ),
    accent_color: getDefaultAccentColor(context),
    dashboard_cards: getDashboardCards(context, portalSlug),
    quick_links: getContextualQuickLinks(
      portalSlug,
      context.time_slot,
      context.day_of_week,
      null,
    ),
    events_pulse: { total_active: 0, trending_event: null },
    suppressed_event_ids: [],
    boosted_event_ids: [],
  };
}

export default function CityBriefingIsland({
  portalSlug,
  serverHeroUrl,
  initialData,
}: CityBriefingIslandProps) {
  const {
    data,
    context: apiContext,
    tabCounts,
    categoryCounts,
    timeSlot: effectiveTimeSlot,
  } = useCityPulseFeed({
    portalSlug,
    initialData: initialData ?? undefined,
  });

  const defaults = useMemo(() => {
    const ctx = buildDefaultContext(effectiveTimeSlot, getDayOfWeek());
    return { context: ctx, header: buildDefaultHeader(ctx, portalSlug) };
  }, [effectiveTimeSlot, portalSlug]);

  const context = apiContext ?? defaults.context;
  const header = data?.header ?? defaults.header;
  const quickLinks = header.quick_links;

  return (
    <>
      <CityBriefing
        header={header}
        context={context}
        portalSlug={portalSlug}
        quickLinks={quickLinks}
        tabCounts={tabCounts}
        categoryCounts={categoryCounts}
        serverHeroUrl={serverHeroUrl}
      />
      {header.cta && (
        <div className="mt-2.5 animate-fade-in">
          <Link
            href={header.cta.href}
            className={`block w-full text-center rounded-xl px-4 py-3 font-mono text-sm font-medium transition-colors ${
              header.cta.style === "ghost"
                ? "border border-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
                : "bg-[var(--action-primary)] text-[var(--btn-primary-text)] hover:bg-[var(--action-primary-hover)]"
            }`}
          >
            {header.cta.label}
          </Link>
        </div>
      )}
    </>
  );
}
