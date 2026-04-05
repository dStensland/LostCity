"use client";

/**
 * Coming Up section — events in the next few days.
 *
 * Renders events using TieredEventList when card_tier data is available,
 * falling back to compact rows otherwise. Hero events get full-width
 * treatment; featured events scroll horizontally; standard events are
 * compact rows.
 */

import type { CityPulseSection, CityPulseEventItem } from "@/lib/city-pulse/types";
import { Confetti } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { TieredEventList, type TieredFeedEvent } from "@/components/feed/TieredEventList";
import { buildExploreUrl } from "@/lib/find-url";

interface Props {
  section: CityPulseSection;
  portalSlug: string;
}

export default function ComingUpSection({ section, portalSlug }: Props) {
  const eventItems = section.items.filter(
    (i): i is CityPulseEventItem => i.item_type === "event",
  );

  if (eventItems.length === 0) return null;

  // Map CityPulseEventItem → TieredFeedEvent (card_tier + editorial_mentions included)
  const events = eventItems.map((i) => i.event as TieredFeedEvent);

  const seeAllHref = buildExploreUrl({
    portalSlug,
    lane: "events",
    extraParams: { date: "next_7_days" },
  });

  return (
    <section>
      {/* Section header */}
      <FeedSectionHeader
        title={section.title || "Coming Up"}
        priority="secondary"
        accentColor="var(--neon-green)"
        icon={<Confetti weight="duotone" className="w-5 h-5" />}
        seeAllHref={seeAllHref}
        seeAllLabel="This week"
      />

      {/* Tiered event list */}
      <TieredEventList
        events={events}
        portalSlug={portalSlug}
        sectionType="coming_up"
        seeAllHref={events.length > 8 ? seeAllHref : undefined}
        seeAllLabel={`+${events.length - 8} more this week`}
      />
    </section>
  );
}
