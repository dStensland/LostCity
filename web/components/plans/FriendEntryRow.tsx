"use client";

import { buildEventUrl } from "@/lib/entity-urls";
import { formatTime } from "./utils";

interface FriendEntryRowProps {
  event: {
    id: number;
    title: string;
    start_time?: string;
    venue?: { name: string };
  };
  friend: {
    display_name: string;
    initials: string;
    avatar_url?: string;
  };
  portalSlug: string;
}

export function FriendEntryRow({ event, friend, portalSlug }: FriendEntryRowProps) {
  const url = buildEventUrl(event.id, portalSlug, "canonical");

  return (
    <a
      href={url}
      className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--vibe)]/4 border border-[var(--vibe)]/10 opacity-70 transition-colors duration-300 hover:opacity-90"
      role="listitem"
      aria-label={`${friend.display_name} going to ${event.title}`}
    >
      <div className="w-[3px] rounded-sm self-stretch min-h-[32px] bg-[var(--vibe)]/60 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-normal text-[var(--cream)] truncate">
          {friend.display_name} going: {event.title}
        </div>
        <div className="text-xs text-[var(--muted)] mt-0.5">
          {event.start_time && formatTime(event.start_time)}
          {event.venue && ` · ${event.venue.name}`}
        </div>
      </div>
      <div className="w-5 h-5 rounded-full bg-[var(--vibe)]/20 flex items-center justify-center text-[9px] font-semibold text-[var(--cream)]/80 flex-shrink-0">
        {friend.initials}
      </div>
    </a>
  );
}

