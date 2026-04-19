"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import Skeleton from "@/components/Skeleton";
import { useQuery } from "@tanstack/react-query";

type WhosGoingProps = {
  eventId: number;
  className?: string;
};

type AttendeeProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type WhosGoingResponse = {
  profiles: AttendeeProfile[];
  count: number;
};

export default function WhosGoing({ eventId, className = "" }: WhosGoingProps) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery<WhosGoingResponse>({
    queryKey: ["whos-going", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/whos-going`);
      if (!res.ok) throw new Error("Failed to fetch whos-going");
      return res.json() as Promise<WhosGoingResponse>;
    },
    staleTime: 60_000, // 1 minute
  });

  const profiles = data?.profiles ?? [];
  const goingCount = profiles.length;

  // Show skeleton immediately while fetching so there's no blank-space flash
  if (isLoading) {
    return (
      <div className={className}>
        <Skeleton variant="text" className="h-3 w-16 mb-4" />
        <div className="flex items-center gap-4 mb-4">
          <Skeleton variant="rect" className="h-5 w-20" />
        </div>
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} variant="circle" width={40} height={40} />
          ))}
        </div>
      </div>
    );
  }

  // No attendees — collapse to nothing (don't hold space)
  if (profiles.length === 0) {
    return null;
  }

  const displayLimit = expanded ? profiles.length : 12;
  const displayProfiles = profiles.slice(0, displayLimit);
  const remainingCount = profiles.length - displayLimit;

  return (
    <div className={`${className}`}>
      <h2 className="font-mono text-xs font-bold text-[var(--muted)] uppercase tracking-[0.14em] mb-4">
        WHO&apos;S IN
      </h2>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {goingCount > 0 && (
          <span className="flex items-center gap-1.5 text-sm">
            <span
              className="w-4 h-4 rounded-full bg-[var(--coral)] flex items-center justify-center text-2xs font-bold text-[var(--void)]"
              aria-label="Going indicator"
            >
              G
            </span>
            <span className="text-[var(--cream)] font-medium">{goingCount}</span>
            <span className="text-[var(--muted)]">going</span>
          </span>
        )}
      </div>

      {/* Avatar grid */}
      <div className="flex flex-wrap gap-2">
        {displayProfiles.map((profile) => (
          <Link
            key={profile.id}
            href={`/profile/${profile.username}`}
            className="group relative"
            title={`${profile.display_name || profile.username} (going)`}
          >
            <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-[var(--twilight)] group-hover:border-[var(--soft)] transition-all">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.display_name || profile.username || ""}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[var(--dusk)] flex items-center justify-center">
                  <span className="font-mono text-sm font-bold text-white">
                    {((profile.display_name || profile.username || "?")[0]).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            {/* Going indicator */}
            <span
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[var(--dusk)] flex items-center justify-center text-2xs font-bold bg-[var(--coral)] text-[var(--void)]"
              title="Going"
            >
              ✓
            </span>
          </Link>
        ))}

        {/* Show more button */}
        {!expanded && remainingCount > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-10 h-10 rounded-full bg-[var(--twilight)] border-2 border-[var(--twilight)] hover:border-[var(--soft)] transition-colors flex items-center justify-center"
          >
            <span className="font-mono text-xs font-medium text-[var(--muted)]">
              +{remainingCount}
            </span>
          </button>
        )}
      </div>

      {/* Collapse button */}
      {expanded && profiles.length > 12 && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-3 text-xs font-mono text-[var(--muted)] hover:text-[var(--soft)] transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}
