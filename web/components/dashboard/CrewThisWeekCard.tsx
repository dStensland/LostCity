"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import UserAvatar, { AvatarStack } from "@/components/UserAvatar";
import { format, parseISO } from "date-fns";
import { useState } from "react";

type CrewEvent = {
  id: number;
  title: string;
  start_date: string;
  venue_name: string | null;
};

type CrewMember = {
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  events: CrewEvent[];
};

type CrewThisWeekData = {
  crew: CrewMember[];
  totalFriendsWithPlans: number;
  latestActivityAt: string | null;
};

export default function CrewThisWeekCard() {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery<CrewThisWeekData>({
    queryKey: ["crew-this-week"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/crew-this-week");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="p-4 glass border border-[var(--twilight)] rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full bg-[var(--coral)]/30 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 skeleton-shimmer rounded" />
            <div className="h-3 w-48 skeleton-shimmer rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.crew.length === 0) {
    return null;
  }

  const displayCrew = expanded ? data.crew : data.crew.slice(0, 3);

  return (
    <div className="glass border border-[var(--coral)]/20 rounded-xl overflow-hidden">
      {/* Accent bar */}
      <div className="h-0.5 bg-gradient-to-r from-[var(--coral)] via-[var(--neon-magenta)] to-transparent" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--coral)]">
              Your crew this week
            </h3>
            <span className="font-mono text-[0.65rem] px-1.5 py-0.5 rounded-full bg-[var(--coral)]/15 text-[var(--coral)]">
              {data.totalFriendsWithPlans}
            </span>
          </div>
          <AvatarStack
            users={data.crew.map((c) => ({
              id: c.user.id,
              name: c.user.display_name || c.user.username,
              avatar_url: c.user.avatar_url,
            }))}
            max={5}
            size="xs"
          />
        </div>

        {/* Crew list */}
        <div className="space-y-2">
          {displayCrew.map((member) => {
            const nextEvent = member.events[0];
            if (!nextEvent) return null;

            const dateStr = format(parseISO(nextEvent.start_date), "EEE");

            return (
              <Link
                key={member.user.id}
                href={`/events/${nextEvent.id}`}
                className="flex items-center gap-2.5 p-2 -mx-2 rounded-lg hover:bg-[var(--twilight)]/30 transition-colors group"
              >
                <UserAvatar
                  src={member.user.avatar_url}
                  name={member.user.display_name || member.user.username}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-[var(--cream)] truncate">
                      {member.user.display_name || member.user.username}
                    </span>
                    <svg className="w-3 h-3 text-[var(--muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span className="text-sm text-[var(--soft)] truncate group-hover:text-[var(--coral)] transition-colors">
                      {nextEvent.title}
                    </span>
                  </div>
                  <p className="font-mono text-[0.6rem] text-[var(--muted)]">
                    {dateStr}{nextEvent.venue_name ? ` · ${nextEvent.venue_name}` : ""}
                    {member.events.length > 1 && ` +${member.events.length - 1} more`}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Expand/collapse */}
        {data.crew.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 w-full text-center font-mono text-xs text-[var(--muted)] hover:text-[var(--coral)] transition-colors py-1"
          >
            {expanded ? "Show less" : `Show ${data.crew.length - 3} more`}
          </button>
        )}
      </div>
    </div>
  );
}
