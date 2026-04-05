"use client";

import { useFriendSignalEvents } from "@/lib/hooks/useFriendSignalEvents";
import FriendRadarCard from "@/components/your-people/FriendRadarCard";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { buildExploreUrl } from "@/lib/find-url";

interface FriendRadarCarouselProps {
  excludeEventIds: number[];
}

export default function FriendRadarCarousel({ excludeEventIds }: FriendRadarCarouselProps) {
  const { events, isLoading } = useFriendSignalEvents(excludeEventIds);

  if (isLoading || events.length === 0) return null;

  return (
    <div className="space-y-3">
      <FeedSectionHeader
        title="On Your Friends' Radar"
        priority="tertiary"
        accentColor="var(--neon-cyan)"
        seeAllHref={buildExploreUrl({ portalSlug: "atlanta" })}
      />
      <div className="flex gap-2.5 sm:gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
        {events.map((event) => (
          <FriendRadarCard key={event.event_id} event={event} />
        ))}
      </div>
    </div>
  );
}
