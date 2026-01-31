"use client";

import { format } from "date-fns";
import Image from "next/image";

// Category to CSS variable mapping
const categoryColors: Record<string, string> = {
  music: "var(--cat-music)",
  film: "var(--cat-film)",
  comedy: "var(--cat-comedy)",
  theater: "var(--cat-theater)",
  art: "var(--cat-art)",
  community: "var(--cat-community)",
  food: "var(--cat-food)",
  sports: "var(--cat-sports)",
  fitness: "var(--cat-fitness)",
  nightlife: "var(--cat-nightlife)",
  family: "var(--cat-family)",
};

function getCategoryColor(category: string | null): string {
  if (!category) return "var(--muted)";
  const normalized = category.toLowerCase().replace(/[^a-z]/g, "");
  return categoryColors[normalized] || "var(--muted)";
}

interface CalendarEvent {
  id: number;
  title: string;
  start_time: string | null;
  is_all_day: boolean;
  category: string | null;
  rsvp_status: "going" | "interested" | "went";
}

interface FriendCalendarEvent {
  id: number;
  title: string;
  friend: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface DayCellProps {
  date: Date;
  events: CalendarEvent[];
  friendEvents: FriendCalendarEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isSelected: boolean;
  onClick: () => void;
}

export default function DayCell({
  date,
  events,
  friendEvents,
  isCurrentMonth,
  isToday,
  isPast,
  isSelected,
  onClick,
}: DayCellProps) {
  const MAX_VISIBLE_EVENTS = 3;
  const visibleEvents = events.slice(0, MAX_VISIBLE_EVENTS);
  const overflowCount = events.length - MAX_VISIBLE_EVENTS;
  const hasEvents = events.length > 0;
  const hasFriendEvents = friendEvents.length > 0;

  // Get unique friend avatars
  const friendAvatars = Array.from(
    new Map(friendEvents.map((e) => [e.friend.id, e.friend])).values()
  ).slice(0, 3);

  const dayNumber = format(date, "d");
  const dayName = format(date, "EEE");

  return (
    <button
      onClick={onClick}
      disabled={!isCurrentMonth}
      className={`
        relative min-h-[90px] p-1.5 rounded-lg border transition-all duration-200 text-left
        ${isCurrentMonth
          ? "hover:border-[var(--neon-cyan)]/50 hover:scale-[1.01]"
          : "opacity-30 cursor-default"
        }
        ${isSelected
          ? "border-[var(--neon-cyan)] bg-[var(--cosmic-blue)] shadow-[0_0_15px_rgba(0,212,232,0.2)]"
          : "border-[var(--nebula)]/30 bg-[var(--midnight-blue)] hover:bg-[var(--twilight-purple)]/30"
        }
        ${isToday && !isSelected
          ? "ring-2 ring-[var(--neon-magenta)] ring-offset-1 ring-offset-[var(--deep-violet)]"
          : ""
        }
        ${isPast && !isSelected ? "opacity-60" : ""}
      `}
    >
      {/* Header row: date + day name */}
      <div className="flex items-baseline justify-between mb-1">
        <span
          className={`
            font-mono text-sm font-semibold
            ${isToday ? "text-[var(--neon-magenta)]" : ""}
            ${isSelected ? "text-[var(--neon-cyan)]" : ""}
            ${!isToday && !isSelected ? (isPast ? "text-[var(--muted)]" : "text-[var(--cream)]") : ""}
          `}
        >
          {dayNumber}
        </span>
        <span className="font-mono text-[0.55rem] text-[var(--muted)] uppercase">
          {dayName}
        </span>
      </div>

      {/* Events list */}
      {hasEvents && isCurrentMonth && (
        <div className="space-y-0.5">
          {visibleEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-1 group/event"
              title={event.title}
            >
              {/* Category dot */}
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: getCategoryColor(event.category) }}
              />
              {/* Event title */}
              <span className="text-[0.6rem] text-[var(--cream)] truncate leading-tight">
                {event.title}
              </span>
            </div>
          ))}

          {/* Overflow indicator */}
          {overflowCount > 0 && (
            <span className="text-[0.55rem] text-[var(--muted)] font-mono">
              +{overflowCount} more
            </span>
          )}
        </div>
      )}

      {/* Friend avatars at bottom */}
      {hasFriendEvents && isCurrentMonth && (
        <div className="absolute bottom-1 right-1 flex -space-x-1">
          {friendAvatars.map((friend) => (
            <div
              key={friend.id}
              className="w-4 h-4 rounded-full border border-[var(--cosmic-blue)] overflow-hidden bg-[var(--twilight-purple)]"
              title={friend.display_name || friend.username}
            >
              {friend.avatar_url ? (
                <Image
                  src={friend.avatar_url}
                  alt=""
                  width={16}
                  height={16}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-[0.4rem] text-[var(--muted)]">
                  {(friend.display_name || friend.username)[0].toUpperCase()}
                </span>
              )}
            </div>
          ))}
          {friendEvents.length > 3 && (
            <span className="w-4 h-4 rounded-full border border-[var(--cosmic-blue)] bg-[var(--twilight-purple)] flex items-center justify-center text-[0.4rem] text-[var(--muted)]">
              +{friendEvents.length - 3}
            </span>
          )}
        </div>
      )}

      {/* RSVP status indicators */}
      {hasEvents && isCurrentMonth && (
        <div className="absolute top-1 right-1 flex gap-0.5">
          {events.some((e) => e.rsvp_status === "going") && (
            <span
              className="w-2 h-2 rounded-full bg-[var(--coral)]"
              title="Going"
            />
          )}
          {events.some((e) => e.rsvp_status === "interested") &&
           !events.some((e) => e.rsvp_status === "going") && (
            <span
              className="w-2 h-2 rounded-full bg-[var(--gold)]"
              title="Interested"
            />
          )}
        </div>
      )}
    </button>
  );
}
