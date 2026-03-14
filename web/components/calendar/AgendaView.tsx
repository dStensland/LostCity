"use client";

import { useMemo } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import { format, isToday, isBefore, parseISO } from "date-fns";
import CategoryIcon from "@/components/CategoryIcon";
import { formatTimeSplit, formatPriceDetailed, type PriceableEvent } from "@/lib/formats";
import { getSmartDateLabel } from "@/lib/card-utils";

interface CalendarPlan {
  id: string;
  title: string;
  description: string | null;
  plan_date: string;
  plan_time: string | null;
  status: string;
  item_count: number;
  creator: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  participants: Array<{
    user_id: string;
    status: string;
    user: { username: string; display_name: string | null; avatar_url: string | null };
  }>;
  is_creator: boolean;
  participant_status: string | null;
}

interface CalendarEvent {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  image_url: string | null;
  rsvp_status: "going" | "interested" | "went";
  venue: {
    id: number;
    name: string;
    slug: string | null;
    neighborhood: string | null;
  } | null;
}

interface FriendCalendarEvent {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  category: string | null;
  rsvp_status: "going" | "interested";
  friend: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface AgendaViewProps {
  events: CalendarEvent[];
  friendEvents: FriendCalendarEvent[];
  plans?: CalendarPlan[];
  eventsByDate: Map<string, CalendarEvent[]>;
  friendEventsByDate: Map<string, FriendCalendarEvent[]>;
  plansByDate?: Map<string, CalendarPlan[]>;
  portalSlug?: string;
}

export default function AgendaView({
  events,
  friendEvents,
  plans = [],
  eventsByDate,
  friendEventsByDate,
  plansByDate = new Map(),
  portalSlug = "atlanta",
}: AgendaViewProps) {
  // Get sorted dates that have events or plans
  const sortedDates = useMemo(() => {
    const allDates = new Set<string>();
    events.forEach((e) => allDates.add(e.start_date));
    friendEvents.forEach((e) => allDates.add(e.start_date));
    plans.forEach((p) => allDates.add(p.plan_date));
    const now = new Date();

    return Array.from(allDates)
      .sort()
      .filter((dateStr) => {
        // Only include today and future dates
        const date = parseISO(dateStr);
        return isToday(date) || !isBefore(date, now);
      });
  }, [events, friendEvents, plans]);

  // Group friend avatars by event
  const friendsByEvent = useMemo(() => {
    const map = new Map<number, { friend: FriendCalendarEvent["friend"]; status: string }[]>();
    friendEvents.forEach((fe) => {
      if (!map.has(fe.id)) {
        map.set(fe.id, []);
      }
      map.get(fe.id)!.push({ friend: fe.friend, status: fe.rsvp_status });
    });
    return map;
  }, [friendEvents]);

  if (sortedDates.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--twilight)]/85 bg-[var(--void)]/65 shadow-[0_18px_40px_rgba(0,0,0,0.28)] p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-[var(--muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <p className="text-[var(--cream)] font-mono text-sm mb-2">No upcoming events or plans</p>
        <p className="text-[var(--muted)] text-xs">
          RSVP to events or create plans to see them here
        </p>
        <Link
          href={`/${portalSlug}`}
          className="inline-block mt-4 px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium rounded-lg hover:bg-[var(--coral)]/80 transition-colors"
        >
          Explore Events
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--twilight)]/85 bg-[var(--void)]/65 shadow-[0_18px_40px_rgba(0,0,0,0.28)] overflow-hidden">
      {sortedDates.map((dateStr) => {
        const dayEvents = eventsByDate.get(dateStr) || [];
        const dayFriendEvents = friendEventsByDate.get(dateStr) || [];
        const dateLabel = getSmartDateLabel(dateStr);
        const isDateToday = isToday(parseISO(dateStr));

        const dayPlans = plansByDate.get(dateStr) || [];

        return (
          <div key={dateStr} className="border-b border-[var(--twilight)]/70 last:border-b-0">
            {/* Date header */}
            <div
              className={`
                sticky top-0 z-10 px-4 py-3 border-b border-[var(--twilight)]/55
                ${isDateToday
                  ? "bg-[var(--twilight)]/70 text-[var(--gold)]"
                  : "bg-[var(--night)]/92 text-[var(--cream)]"
                }
              `}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold uppercase tracking-wider">
                  {dateLabel}
                </span>
                {isDateToday && (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--neon-magenta)]/20 text-[var(--neon-magenta)] font-mono text-xs font-medium">
                    NOW
                  </span>
                )}
                <span className="text-[var(--muted)] font-mono text-xs">
                  {format(parseISO(dateStr), "MMM d, yyyy")}
                </span>
              </div>
            </div>

            {/* Plans then events for this date */}
            <div className="divide-y divide-[var(--twilight)]/45">
              {/* Plans come first — they frame the day */}
              {dayPlans.map((plan) => {
                const { time, period } = formatTimeSplit(plan.plan_time, false);
                const acceptedParticipants = plan.participants.filter(
                  (p) => p.status === "accepted" || p.status === "invited"
                );

                return (
                  <Link
                    key={`plan-${plan.id}`}
                    href={`/plans/${plan.id}`}
                    className="flex gap-4 p-4 hover:bg-[var(--neon-cyan)]/5 transition-colors group border-l-[3px] border-l-[var(--neon-cyan)] bg-[var(--neon-cyan)]/[0.03]"
                  >
                    {/* Plan icon */}
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--neon-cyan)]/10 flex items-center justify-center border border-[var(--neon-cyan)]/20">
                      <svg
                        className="w-7 h-7 text-[var(--neon-cyan)] opacity-80"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                      </svg>
                    </div>

                    {/* Plan details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-[var(--neon-cyan)]">
                          {plan.plan_time ? (
                            <>
                              {time}
                              {period && <span className="text-xs ml-0.5 opacity-60">{period}</span>}
                            </>
                          ) : (
                            "All day"
                          )}
                        </span>
                        <span className="text-[var(--muted)]">·</span>
                        <span className="font-mono text-xs text-[var(--muted)] uppercase">
                          Plan
                        </span>
                      </div>

                      <h3 className="text-[var(--cream)] font-medium group-hover:text-[var(--neon-cyan)] transition-colors line-clamp-2">
                        {plan.title}
                      </h3>

                      <div className="flex items-center gap-3 mt-2">
                        {!plan.is_creator && (
                          <span className="text-sm text-[var(--muted)] truncate">
                            by {plan.creator.display_name || plan.creator.username}
                          </span>
                        )}

                        {plan.item_count > 0 && (
                          <span className="px-2 py-0.5 rounded-full font-mono text-xs font-medium bg-[var(--twilight)] text-[var(--soft)]">
                            {plan.item_count} {plan.item_count === 1 ? "stop" : "stops"}
                          </span>
                        )}

                        {acceptedParticipants.length > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="flex -space-x-1">
                              {acceptedParticipants.slice(0, 3).map((p) => (
                                <div
                                  key={p.user_id}
                                  className="w-5 h-5 rounded-full border-2 border-[var(--night)] overflow-hidden bg-[var(--neon-cyan)]/20 flex items-center justify-center"
                                  title={p.user.display_name || p.user.username}
                                >
                                  <span className="text-2xs text-[var(--neon-cyan)] font-medium">
                                    {(p.user.display_name || p.user.username)[0].toUpperCase()}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <span className="font-mono text-xs text-[var(--muted)]">
                              {acceptedParticipants.length === 1
                                ? `${acceptedParticipants[0].user.display_name || acceptedParticipants[0].user.username}`
                                : `${acceptedParticipants.length} people`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg
                        className="w-5 h-5 text-[var(--neon-cyan)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </Link>
                );
              })}

              {dayEvents.map((event) => {
                const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
                const priceResult = formatPriceDetailed(event as PriceableEvent);
                const price = priceResult.text || null;
                const friendsGoing = friendsByEvent.get(event.id) || [];

                return (
                  <Link
                    key={event.id}
                    href={`/${portalSlug}?event=${event.id}`}
                    scroll={false}
                    className="flex gap-4 p-4 hover:bg-[var(--twilight)]/25 transition-colors group"
                  >
                    {/* Event image or category icon */}
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--dusk)]">
                      {event.image_url ? (
                        <Image
                          src={event.image_url}
                          alt=""
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {event.category ? (
                            <CategoryIcon type={event.category} size={28} className="opacity-60" />
                          ) : (
                            <svg
                              className="w-7 h-7 text-[var(--muted)]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                          )}
                        </div>
                      )}
                      {/* RSVP badge */}
                      <span
                        className={`
                          absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold
                          ${event.rsvp_status === "going"
                            ? "bg-[var(--coral)] text-[var(--void)]"
                            : "bg-[var(--gold)] text-[var(--void)]"
                          }
                        `}
                      >
                        {event.rsvp_status === "going" ? "✓" : "?"}
                      </span>
                    </div>

                    {/* Event details */}
                    <div className="flex-1 min-w-0">
                      {/* Time and category */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-[var(--coral)]">
                          {time}
                          {period && <span className="text-xs ml-0.5 opacity-60">{period}</span>}
                        </span>
                        {event.category && (
                          <>
                            <span className="text-[var(--muted)]">·</span>
                            <span className="font-mono text-xs text-[var(--muted)] uppercase">
                              {event.category}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-[var(--cream)] font-medium group-hover:text-[var(--coral)] transition-colors line-clamp-2">
                        {event.title}
                      </h3>

                      {/* Venue */}
                      {event.venue && (
                        <p className="text-sm text-[var(--muted)] mt-1 truncate">
                          {event.venue.name}
                          {event.venue.neighborhood && (
                            <span className="text-[var(--muted)]/60"> · {event.venue.neighborhood}</span>
                          )}
                        </p>
                      )}

                      {/* Price and friends */}
                      <div className="flex items-center gap-3 mt-2">
                        {price && (
                          <span
                            className={`
                              px-2 py-0.5 rounded-full font-mono text-xs font-medium
                              ${priceResult.isFree
                                ? "bg-[var(--neon-green)]/20 text-[var(--neon-green)]"
                                : "bg-[var(--twilight)] text-[var(--cream)]"
                              }
                            `}
                          >
                            {price}
                          </span>
                        )}

                        {friendsGoing.length > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="flex -space-x-1">
                              {friendsGoing.slice(0, 3).map(({ friend }) => (
                                <div
                                  key={friend.id}
                                  className="w-5 h-5 rounded-full border-2 border-[var(--night)] overflow-hidden bg-[var(--twilight)]"
                                  title={friend.display_name || friend.username}
                                >
                                  {friend.avatar_url ? (
                                    <Image
                                      src={friend.avatar_url}
                                      alt=""
                                      width={20}
                                      height={20}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="w-full h-full flex items-center justify-center text-2xs text-[var(--muted)]">
                                      {(friend.display_name || friend.username)[0].toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                            <span className="font-mono text-xs text-[var(--muted)]">
                              {friendsGoing.length === 1
                                ? `${friendsGoing[0].friend.display_name || friendsGoing[0].friend.username} going`
                                : `${friendsGoing.length} friends going`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg
                        className="w-5 h-5 text-[var(--coral)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </Link>
                );
              })}

              {/* Show friend-only events (events user hasn't RSVP'd to but friends are going) */}
              {dayFriendEvents
                .filter((fe) => !dayEvents.some((e) => e.id === fe.id))
                .slice(0, 3)
                .map((friendEvent) => {
                  const { time, period } = formatTimeSplit(
                    friendEvent.start_time,
                    friendEvent.is_all_day
                  );
                  const otherFriends = dayFriendEvents.filter(
                    (fe) => fe.id === friendEvent.id && fe.friend.id !== friendEvent.friend.id
                  );

                  return (
                    <Link
                      key={`friend-${friendEvent.id}-${friendEvent.friend.id}`}
                      href={`/${portalSlug}?event=${friendEvent.id}`}
                      scroll={false}
                      className="flex gap-4 p-4 hover:bg-[var(--twilight)]/20 transition-colors group bg-[var(--twilight)]/15"
                    >
                      {/* Friend indicator */}
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--twilight)]/50 flex items-center justify-center">
                        {friendEvent.friend.avatar_url ? (
                          <Image
                            src={friendEvent.friend.avatar_url}
                            alt=""
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <span className="w-12 h-12 rounded-full bg-[var(--neon-magenta)]/20 flex items-center justify-center text-sm font-bold text-[var(--neon-magenta)]">
                            {(friendEvent.friend.display_name || friendEvent.friend.username)[0].toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Event details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-[var(--muted)]">
                            {friendEvent.friend.display_name || friendEvent.friend.username}
                            {otherFriends.length > 0 && ` +${otherFriends.length}`}
                            {" "}
                            {friendEvent.rsvp_status === "going" ? "going" : "interested"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-[var(--muted)]">
                            {time}
                            {period && <span className="text-xs ml-0.5 opacity-60">{period}</span>}
                          </span>
                        </div>

                        <h3 className="text-[var(--soft)] font-medium group-hover:text-[var(--cream)] transition-colors line-clamp-2">
                          {friendEvent.title}
                        </h3>
                      </div>
                    </Link>
                  );
                })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
