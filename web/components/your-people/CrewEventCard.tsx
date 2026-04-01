"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import UserAvatar from "@/components/UserAvatar";
import ImInButton from "@/components/your-people/ImInButton";
import type { CrewEvent } from "@/lib/hooks/useCrewBoard";

interface CrewEventCardProps {
  event: CrewEvent;
}

export default function CrewEventCard({ event }: CrewEventCardProps) {
  const firstFriend = event.friends[0];
  const extraCount = event.friends.length - 1;

  const timeStr = event.start_time
    ? new Date(`2000-01-01T${event.start_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  const metaParts = [timeStr, event.venue_name].filter(Boolean).join(" · ");

  return (
    <div className="flex items-center gap-2.5 sm:gap-3.5 p-3 sm:p-3.5 rounded-[10px] bg-[var(--night)] border border-[var(--twilight)] hover:border-[var(--twilight)]/80 transition-colors">
      {/* Event image */}
      <Link href={`/events/${event.event_id}`} className="flex-shrink-0">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-[var(--dusk)]">
          {event.image_url && (
            <SmartImage src={event.image_url} alt={event.title} width={56} height={56} className="w-full h-full object-cover" />
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <Link href={`/events/${event.event_id}`} className="block">
          <h4 className="text-sm font-medium text-[var(--cream)] truncate hover:text-[var(--coral)] transition-colors">
            {event.title}
          </h4>
        </Link>

        {/* Friend attribution */}
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1">
            {event.friends.slice(0, 3).map((f) => (
              <UserAvatar key={f.id} src={f.avatar_url} name={f.display_name || f.username} size="xs" />
            ))}
          </div>
          <span className="text-xs text-[var(--soft)]">
            {extraCount > 0 ? (
              <><span className="text-[var(--coral)] font-medium">{firstFriend.display_name || firstFriend.username} + {extraCount}</span> going</>
            ) : (
              <><span>{firstFriend.display_name || firstFriend.username}</span> <span className="text-[var(--muted)]">is going</span></>
            )}
          </span>
        </div>

        {metaParts && (
          <p className="font-mono text-xs text-[var(--muted)]">{metaParts}</p>
        )}
      </div>

      {/* I'm in button */}
      <ImInButton eventId={event.event_id} />
    </div>
  );
}
