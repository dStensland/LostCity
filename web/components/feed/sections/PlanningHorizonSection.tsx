"use client";

/**
 * Planning Horizon section — big future events with urgency signals.
 *
 * Carousel layout: wider cards than ComingUp's list rows.
 * Shows flagship + major events more than 7 days away.
 * Minimum 3 items to render.
 */

import type { CityPulseSection, CityPulseEventItem } from "@/lib/city-pulse/types";
import { Binoculars } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { PlanningHorizonCard } from "@/components/feed/PlanningHorizonCard";

interface Props {
  section: CityPulseSection;
  portalSlug: string;
}

export default function PlanningHorizonSection({ section, portalSlug }: Props) {
  const eventItems = section.items.filter(
    (i): i is CityPulseEventItem => i.item_type === "event",
  );

  if (eventItems.length < 3) return null;

  return (
    <section>
      {/* Section header */}
      <FeedSectionHeader
        title={section.title || "On the Horizon"}
        priority="secondary"
        accentColor="var(--gold)"
        icon={<Binoculars weight="duotone" className="w-5 h-5" />}
        seeAllHref={`/${portalSlug}?view=find&type=events&importance=flagship,major`}
        seeAllLabel="All big events"
      />

      {/* Horizontal scroll carousel */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-4 px-4">
        {eventItems.slice(0, 12).map((item) => {
          // Urgency and freshness are pre-computed server-side to avoid
          // timezone inconsistencies between server (UTC) and client (local).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rawEvent = item.event as any;

          return (
            <PlanningHorizonCard
              key={`horizon-${item.event.id}`}
              event={{
                ...rawEvent,
                urgency: rawEvent.urgency ?? null,
                ticket_freshness: rawEvent.ticket_freshness ?? null,
              }}
              portalSlug={portalSlug}
            />
          );
        })}
      </div>
    </section>
  );
}
