"use client";

import Link from "next/link";
import UserAvatar, { AvatarStack } from "@/components/UserAvatar";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import { format, parseISO } from "date-fns";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

interface ActivityEventCardProps {
  event: {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    is_all_day: boolean;
    category: string | null;
    venue?: { name: string } | null;
  };
  users: Array<{
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  }>;
  activityType: "rsvp" | "save";
  timeAgo?: string;
}

export function ActivityEventCard({ event, users, activityType, timeAgo }: ActivityEventCardProps) {
  const dateObj = parseISO(event.start_date);
  const categoryColor = event.category ? getCategoryColor(event.category) : null;
  const accentColor = categoryColor || "var(--neon-magenta)";
  const accentClass = createCssVarClass("--accent-color", accentColor, "accent");

  const timeStr = event.is_all_day
    ? "All Day"
    : event.start_time
      ? format(parseISO(`2000-01-01T${event.start_time}`), "h:mm a")
      : "";

  const dayLabel = format(dateObj, "EEE");
  const dateLabel = format(dateObj, "MMM d");

  const isMultiUser = users.length > 1;
  const isSave = activityType === "save";

  // CTA config
  const ctaLabel = isSave ? "Check it out →" : "See event →";
  const ctaColor = isSave ? "var(--neon-magenta)" : "var(--coral)";
  const hoverGlow = isSave ? "hover-glow-magenta-coral" : "hover-glow-coral-magenta";
  const hoverBorder = isSave ? "hover:border-[var(--neon-magenta)]/30" : "hover:border-[var(--coral)]/30";
  const titleHoverColor = isSave ? "group-hover:text-[var(--neon-magenta)]" : "group-hover:text-[var(--coral)]";

  return (
    <>
      <ScopedStyles css={accentClass?.css} />
      <Link
        href={`/events/${event.id}`}
        className={`block p-2.5 sm:p-3 rounded-lg glass border border-[var(--twilight)]/50 ${hoverBorder} transition-all group relative ${accentClass?.className ?? ""} ${
          categoryColor ? "border-l-[3px] border-l-[var(--accent-color)]" : ""
        }`}
      >
        <div className={`absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none blur-xl ${hoverGlow}`} />
        <div className="flex gap-2 sm:gap-3 relative z-10">
          {/* Time cell */}
          <div className="flex-shrink-0 w-12 sm:w-14 flex flex-col items-center justify-center py-1">
            <span className="font-mono text-2xs font-medium leading-none text-[var(--muted)]">
              {dayLabel}
            </span>
            <span className="font-mono text-sm font-medium text-[var(--soft)] leading-none tabular-nums mt-0.5">
              {dateLabel}
            </span>
            {timeStr && (
              <span className="font-mono text-2xs text-[var(--muted)] mt-0.5">{timeStr}</span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* User action header */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {isMultiUser ? (
                <>
                  <div className="relative">
                    <AvatarStack
                      users={users.map((u) => ({
                        id: u.id,
                        name: u.display_name || u.username,
                        avatar_url: u.avatar_url,
                      }))}
                      max={4}
                      size="xs"
                    />
                    {users.length > 1 && (
                      <div className="absolute -inset-1 bg-[var(--coral)]/10 rounded-full blur-sm -z-10 animate-pulse-slow" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {users.length <= 3 ? (
                      <>
                        <span className="font-medium text-[var(--coral)] text-xs">
                          {users.slice(0, 2).map((u) => u.display_name || u.username).join(", ")}
                        </span>
                        {users.length === 3 && (
                          <>
                            <span className="text-[var(--muted)] text-xs">and</span>
                            <span className="font-medium text-[var(--coral)] text-xs">
                              {users[2].display_name || users[2].username}
                            </span>
                          </>
                        )}
                        <span className="font-mono text-xs text-[var(--muted)]">are going</span>
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-[var(--coral)] text-sm">
                          {users.length}
                        </span>
                        <span className="font-mono text-xs text-[var(--muted)]">friends going</span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <UserAvatar
                    src={users[0].avatar_url}
                    name={users[0].display_name || users[0].username}
                    size="xs"
                  />
                  <span className="text-xs text-[var(--muted)] truncate">
                    <span className="text-[var(--soft)]">
                      {users[0].display_name || users[0].username}
                    </span>
                    {" "}{isSave ? "saved this" : "is going"}
                  </span>
                  {timeAgo && (
                    <span className="ml-auto font-mono text-2xs text-[var(--muted)] flex-shrink-0">
                      {timeAgo}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Category icon + title */}
            <div className="flex items-center gap-2 mb-1">
              {event.category && (
                <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded bg-accent-20">
                  <CategoryIcon type={event.category} size={12} glow="subtle" />
                </span>
              )}
              <h3 className={`text-[var(--cream)] font-medium leading-snug line-clamp-2 sm:line-clamp-1 ${titleHoverColor} transition-colors`}>
                {event.title}
              </h3>
            </div>

            {/* Venue + CTA */}
            <div className="flex items-center gap-2 mt-0.5">
              {event.venue && (
                <p className="font-mono text-xs text-[var(--muted)] truncate">
                  {event.venue.name}
                </p>
              )}
              <span
                className="font-mono text-xs font-medium flex-shrink-0 transition-opacity hover:opacity-80"
                style={{ color: ctaColor }}
              >
                {ctaLabel}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </>
  );
}

export type { ActivityEventCardProps };
