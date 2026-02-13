"use client";

import { format } from "date-fns";
import Image from "@/components/SmartImage";

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
  const hasEvents = events.length > 0;
  const hasFriendEvents = friendEvents.length > 0;
  const eventCount = events.length;
  const uniqueCategories = Array.from(new Set(events.map((event) => event.category).filter(Boolean))).slice(0, 3);
  const topCategory = uniqueCategories[0] || null;
  const extraCategoryCount = Math.max(uniqueCategories.length - 1, 0);

  // Get unique friend avatars
  const friendAvatars = Array.from(
    new Map(friendEvents.map((e) => [e.friend.id, e.friend])).values()
  ).slice(0, 3);

  const dayNumber = format(date, "d");
  const eventCountLabel = eventCount > 99 ? "99+" : String(eventCount);

  return (
    <button
      onClick={onClick}
      disabled={!isCurrentMonth}
      className={`
        relative min-h-[68px] sm:min-h-[76px] p-1.5 rounded-lg border transition-all duration-150 text-left outline-none
        focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)]
        ${isCurrentMonth
          ? "hover:border-[var(--coral)]/55 hover:bg-[var(--twilight)]/42"
          : "opacity-30 cursor-default pointer-events-none"
        }
        ${isSelected
          ? "border-[var(--gold)] bg-[var(--twilight)]/72 shadow-[0_10px_24px_rgba(0,0,0,0.26)]"
          : "border-[var(--twilight)]/60 bg-[var(--night)]/34"
        }
        ${isToday && !isSelected
          ? "ring-2 ring-[var(--gold)] ring-offset-1 ring-offset-[var(--void)]"
          : ""
        }
        ${isPast && !isSelected ? "opacity-70" : ""}
      `}
      aria-label={`${format(date, "EEEE, MMMM d, yyyy")}${eventCount > 0 ? `, ${eventCount} events` : ", no events"}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={`
            font-mono text-[13px] font-semibold
            ${isToday ? "text-[var(--gold)]" : ""}
            ${isSelected && !isToday ? "text-[var(--cream)]" : ""}
            ${!isToday && !isSelected ? (isPast ? "text-[var(--soft)]/70" : "text-[var(--cream)]/95") : ""}
          `}
        >
          {dayNumber}
        </span>
        {hasEvents && isCurrentMonth && (
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md font-mono text-[0.58rem] font-semibold border leading-none ${
            isSelected
              ? "text-[var(--cream)] border-[var(--gold)]/50 bg-[var(--twilight)]/88"
              : eventCount >= 6
                ? "text-[var(--cream)] border-[var(--coral)]/55 bg-[var(--coral)]/22"
                : "text-[var(--soft)] border-[var(--twilight)]/75 bg-[var(--void)]/56"
          }`}>
            {eventCountLabel}
          </span>
        )}
      </div>

      {hasFriendEvents && isCurrentMonth && (
        <div className="absolute bottom-1.5 right-1.5 flex -space-x-1">
          {friendAvatars.map((friend) => (
            <div
              key={friend.id}
              className="w-4 h-4 rounded-full border border-[var(--void)] overflow-hidden bg-[var(--twilight-purple)]"
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
            <span className="w-4 h-4 rounded-full border border-[var(--void)] bg-[var(--twilight-purple)] flex items-center justify-center text-[0.4rem] text-[var(--muted)]">
              +{friendEvents.length - 3}
            </span>
          )}
        </div>
      )}

      {hasEvents && isCurrentMonth && (
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
          {topCategory && (
            <span
              data-category={topCategory}
              className="w-1.5 h-1.5 rounded-full bg-[var(--category-color,var(--muted))]"
            />
          )}
          {extraCategoryCount > 0 && (
            <span className="font-mono text-[0.5rem] text-[var(--muted)]/90">
              +{extraCategoryCount}
            </span>
          )}
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              events.some((e) => e.rsvp_status === "going")
                ? "bg-[var(--coral)]"
                : "bg-[var(--gold)]"
            }`}
            title={events.some((e) => e.rsvp_status === "going") ? "Going" : "Interested"}
          />
        </div>
      )}
    </button>
  );
}
