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
import { CalendarBlank, ArrowRight } from "@phosphor-icons/react";

interface Props {
  section: CityPulseSection;
  portalSlug: string;
  excludeEventIds?: Set<number>;
}

export default function ComingUpSection({ section, portalSlug, excludeEventIds }: Props) {
  const events = section.items.filter(
    (i): i is CityPulseEventItem =>
      i.item_type === "event" && !(excludeEventIds?.has(i.event.id)),
  );

  if (events.length === 0) return null;

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarBlank weight="duotone" className="w-3.5 h-3.5 text-[var(--neon-green)]" />
          <h2 className="font-mono text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-[var(--neon-green)]">
            {section.title || "Coming Up"}
          </h2>
        </div>
        <Link
          href={`/${portalSlug}?view=find&type=events&date=next_7_days`}
          className="text-[0.6875rem] flex items-center gap-1 text-[var(--neon-green)] transition-colors hover:opacity-80"
        >
          This week <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

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
          className="mt-2 w-full flex items-center justify-center gap-1.5 text-[0.6875rem] font-mono font-medium py-2 rounded-lg transition-all hover:bg-white/[0.02] text-[var(--neon-green)]"
        >
          +{events.length - 6} more this week
          <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </section>
  );
}
