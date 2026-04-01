"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import UserAvatar from "@/components/UserAvatar";
import type { FriendSignalEvent } from "@/lib/hooks/useFriendSignalEvents";

interface FriendRadarCardProps {
  event: FriendSignalEvent;
}

export default function FriendRadarCard({ event }: FriendRadarCardProps) {
  const hasGoing = event.going_count > 0;
  const label = hasGoing
    ? `${event.going_count} friend${event.going_count !== 1 ? "s" : ""} going`
    : `${event.interested_count} friend${event.interested_count !== 1 ? "s" : ""} interested`;
  const labelColor = hasGoing ? "var(--coral)" : "var(--gold)";

  return (
    <Link
      href={`/events/${event.event_id}`}
      className="flex-shrink-0 w-40 sm:w-[220px] rounded-[10px] bg-[var(--night)] border border-[var(--twilight)] overflow-hidden hover:border-[var(--twilight)]/80 transition-colors group"
    >
      <div className="w-full h-[90px] sm:h-[120px] bg-[var(--dusk)] overflow-hidden">
        {event.image_url && (
          <SmartImage src={event.image_url} alt={event.title} width={220} height={120} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        )}
      </div>
      <div className="p-2 sm:p-2.5 space-y-1">
        <h4 className="text-xs sm:text-sm font-medium text-[var(--cream)] truncate">{event.title}</h4>
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1">
            {event.friend_avatars.slice(0, 2).map((a) => (
              <UserAvatar key={a.id} src={a.avatar_url} name="" size="xs" />
            ))}
          </div>
          <span className="font-mono text-2xs font-medium" style={{ color: labelColor }}>
            {label}
          </span>
        </div>
      </div>
    </Link>
  );
}
