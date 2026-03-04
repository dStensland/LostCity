"use client";

/**
 * Coming Up section — events in the next few days.
 *
 * Simple list: section header + compact event rows.
 * Links to the full Find view for this week.
 */

import Link from "next/link";
import type { CityPulseSection, CityPulseEventItem } from "@/lib/city-pulse/types";
import type { FeedEventData } from "@/components/EventCard";
import CompactEventRow from "../CompactEventRow";
import { Confetti, ArrowRight } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";

interface Props {
  section: CityPulseSection;
  portalSlug: string;
}

export default function ComingUpSection({ section, portalSlug }: Props) {
  const events = section.items.filter(
    (i): i is CityPulseEventItem => i.item_type === "event",
  );

  if (events.length === 0) return null;

  return (
    <section>
      {/* Section header */}
      <FeedSectionHeader
        title={section.title || "Coming Up"}
        priority="secondary"
        accentColor="var(--neon-green)"
        icon={<Confetti weight="duotone" className="w-5 h-5" />}
        seeAllHref={`/${portalSlug}?view=find&type=events&date=next_7_days`}
        seeAllLabel="This week"
      />

      {/* Compact event rows */}
      <div className="rounded-xl overflow-hidden border border-[var(--twilight)]/40 bg-[var(--night)]">
        {events.slice(0, 6).map((item, idx) => (
          <CompactEventRow
            key={`coming-${item.event.id}`}
            event={item.event as FeedEventData}
            portalSlug={portalSlug}
            isLast={idx === Math.min(events.length, 6) - 1}
          />
        ))}
      </div>

      {events.length > 6 && (
        <Link
          href={`/${portalSlug}?view=find&type=events&date=next_7_days`}
          className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-mono font-medium py-2 rounded-lg transition-all hover:bg-white/[0.02] text-[var(--neon-green)]"
        >
          +{events.length - 6} more this week
          <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </section>
  );
}
