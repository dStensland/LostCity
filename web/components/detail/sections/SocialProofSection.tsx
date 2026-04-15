"use client";

import FriendsGoing from "@/components/FriendsGoing";
import WhosGoing from "@/components/WhosGoing";
import type { SectionProps } from "@/lib/detail/types";

export function SocialProofSection({ data }: SectionProps) {
  let eventId: number | null = null;

  if (data.entityType === "event") {
    eventId = data.payload.event.id;
  }

  // Place social proof: no eventId — render nothing for now
  // (place-level attendance requires a different data surface)
  if (eventId === null) return null;

  return (
    <div className="space-y-3">
      <FriendsGoing eventId={eventId} />
      <WhosGoing eventId={eventId} />
    </div>
  );
}
