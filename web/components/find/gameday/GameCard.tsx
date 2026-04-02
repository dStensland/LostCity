"use client";

import { memo } from "react";
import Image from "next/image";

interface GameCardProps {
  teamName: string;
  teamLogo?: string;
  teamAccent: string;
  opponent: string;
  venue: string;
  date: string;
  time: string | null;
  league: string;
  ticketUrl?: string | null;
  eventUrl: string;
}

/** Format "HH:MM:SS" or "HH:MM" to "7:30 PM" */
function formatGameTime(time: string | null): string | null {
  if (!time) return null;
  const parts = time.split(":");
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return null;
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${period}`;
}

export const GameCard = memo(function GameCard({
  teamName,
  teamLogo,
  teamAccent,
  opponent,
  venue,
  date: _date,
  time,
  league,
  ticketUrl,
  eventUrl,
}: GameCardProps) {
  const formattedTime = formatGameTime(time);
  const subtitle = [venue, formattedTime].filter(Boolean).join(" · ");

  return (
    <div
      className="rounded-card border border-[var(--twilight)]/40 p-4 flex items-center gap-4"
      style={{
        backgroundColor: `color-mix(in srgb, ${teamAccent} 5%, var(--night))`,
      }}
    >
      {/* Team logo */}
      {teamLogo ? (
        <div className="shrink-0 w-12 h-12 flex items-center justify-center">
          <Image
            src={teamLogo}
            alt={teamName}
            width={48}
            height={48}
            className="object-contain"
          />
        </div>
      ) : (
        <div className="shrink-0 w-12 h-12 rounded-full bg-[var(--twilight)]" />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-2xs font-mono font-bold uppercase tracking-wider text-[var(--muted)] mb-0.5">
          {league}
        </p>
        <h3 className="text-base font-semibold text-[var(--cream)] leading-tight truncate">
          {teamName} vs {opponent}
        </h3>
        {subtitle && (
          <p className="text-sm text-[var(--soft)] truncate mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Action */}
      <div className="shrink-0">
        {ticketUrl ? (
          <a
            href={ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-[var(--coral)] hover:opacity-80 transition-opacity whitespace-nowrap"
          >
            Tickets →
          </a>
        ) : (
          <a
            href={eventUrl}
            className="text-sm font-semibold text-[var(--soft)] hover:text-[var(--cream)] transition-colors whitespace-nowrap"
          >
            Details →
          </a>
        )}
      </div>
    </div>
  );
});

export type { GameCardProps };
