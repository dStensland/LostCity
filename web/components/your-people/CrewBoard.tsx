"use client";

import Link from "next/link";
import { useCrewBoard } from "@/lib/hooks/useCrewBoard";
import CrewEventCard from "@/components/your-people/CrewEventCard";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";

export default function CrewBoard() {
  const { days, isLoading } = useCrewBoard();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[var(--twilight)] overflow-hidden">
        <div className="h-0.5 bg-gradient-to-r from-[var(--coral)] via-[var(--neon-magenta)] to-transparent" />
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 skeleton-shimmer rounded-[10px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--twilight)] overflow-hidden">
      {/* Accent bar */}
      <div className="h-0.5 bg-gradient-to-r from-[var(--coral)] via-[var(--neon-magenta)] to-transparent" />

      <div className="p-4 space-y-4">
        <FeedSectionHeader
          title="This Week"
          priority="secondary"
          accentColor="var(--coral)"
        />

        {days.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-[var(--soft)] mb-3">Nobody&apos;s got plans yet.</p>
            <Link
              href="/atl?view=find"
              className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--coral)] hover:opacity-80 transition-opacity"
            >
              Browse events &rarr;
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {days.map((day) => (
              <div key={day.date} className="space-y-1.5">
                <p className="font-mono text-2xs font-medium text-[var(--soft)] uppercase tracking-wider pl-1">
                  {day.day_label}
                </p>
                <div className="space-y-1.5">
                  {day.events.map((event) => (
                    <CrewEventCard key={event.event_id} event={event} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Returns all event IDs shown in the crew board (for deduplication with radar) */
export function useCrewBoardEventIds(): number[] {
  const { days } = useCrewBoard();
  return days.flatMap((d) => d.events.map((e) => e.event_id));
}
