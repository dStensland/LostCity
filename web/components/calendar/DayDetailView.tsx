"use client";

import Link from "next/link";
import { format, isToday, isBefore } from "date-fns";
import Image from "@/components/SmartImage";
import CategoryIcon from "@/components/CategoryIcon";
import { formatTimeSplit } from "@/lib/formats";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import { useCalendar } from "@/lib/calendar/CalendarProvider";
import { useSelectedDayData } from "@/lib/calendar/useCalendarDerived";
import { OpenTimeBlock } from "@/components/calendar/OpenTimeBlock";
import type { CalendarEvent, CalendarPlan, FriendCalendarEvent } from "@/lib/types/calendar";
import { buildExploreUrl } from "@/lib/find-url";

interface DayDetailViewProps {
  eventsByDate: Map<string, CalendarEvent[]>;
  plansByDate: Map<string, CalendarPlan[]>;
  friendEventsByDate: Map<string, FriendCalendarEvent[]>;
}

export default function DayDetailView({ eventsByDate, plansByDate, friendEventsByDate }: DayDetailViewProps) {
  const { state, openSheet } = useCalendar();
  const { selectedDate } = state;

  const selectedDayData = useSelectedDayData(
    selectedDate,
    eventsByDate,
    friendEventsByDate,
    plansByDate
  );

  // No date selected state
  if (!selectedDate) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
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
        </div>
        <p className="text-[var(--soft)] font-mono text-sm">Select a day to see events</p>
      </div>
    );
  }

  const { events: dayEvents, plans: dayPlans, friendEvents: dayFriendEvents } = selectedDayData;
  const isTodayDate = isToday(selectedDate);
  const isPastDate = isBefore(selectedDate, new Date()) && !isTodayDate;
  const totalPlanned = dayEvents.length + dayPlans.length;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3 border-b border-[var(--twilight)]/65 bg-[var(--void)]/92 backdrop-blur-sm">
        <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-widest mb-1">
          {format(selectedDate, "EEEE")}
        </div>
        <div className="font-mono text-2xl font-bold text-[var(--cream)] leading-tight">
          {format(selectedDate, "MMMM d, yyyy")}
        </div>

        {/* Badge row */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {isTodayDate && (
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--gold)] text-[var(--void)] font-mono text-xs font-bold">
              TODAY
            </span>
          )}
          {totalPlanned > 0 && (
            <span className="px-2.5 py-0.5 rounded-full border border-[var(--twilight)] bg-[var(--dusk)] text-[var(--soft)] font-mono text-xs">
              {totalPlanned} planned
            </span>
          )}

          {/* Add from Find link */}
          <Link
            href={`${buildExploreUrl({ portalSlug: DEFAULT_PORTAL_SLUG, lane: "events" })}&date_start=${format(selectedDate, "yyyy-MM-dd")}&date_end=${format(selectedDate, "yyyy-MM-dd")}`}
            className="px-2.5 py-0.5 rounded-full bg-[var(--coral)]/20 text-[var(--coral)] font-mono text-xs font-medium hover:bg-[var(--coral)]/30 transition-colors"
          >
            + Add from Explore
          </Link>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Plans section */}
        {dayPlans.length > 0 && (
          <section>
            <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Plans
            </div>
            <div className="space-y-2">
              {dayPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onPreview={() => openSheet({ sheet: "plan-preview", data: plan })}
                />
              ))}
            </div>
          </section>
        )}

        {/* OpenTimeBlock between plans and events */}
        {dayEvents.length > 0 && (
          <OpenTimeBlock events={dayEvents} selectedDate={selectedDate} />
        )}

        {/* Your Events section */}
        {dayEvents.length > 0 && (
          <section>
            <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Your Events
            </div>
            <div className="space-y-2">
              {dayEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onPreview={() => openSheet({ sheet: "event-preview", data: event })}
                />
              ))}
            </div>
          </section>
        )}

        {/* Friends' Events section */}
        {dayFriendEvents.length > 0 && (
          <section>
            <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Friends&apos; Events
            </div>
            <div className="space-y-2">
              {dayFriendEvents.map((fe) => (
                <FriendEventCard key={`${fe.id}-${fe.friend.id}`} event={fe} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {dayEvents.length === 0 && dayPlans.length === 0 && dayFriendEvents.length === 0 && (
          <EmptyDayState isPast={isPastDate} selectedDate={selectedDate} />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onPreview,
}: {
  plan: CalendarPlan;
  onPreview: () => void;
}) {
  const { time, period } = formatTimeSplit(plan.plan_time, false);
  const acceptedParticipants = plan.participants.filter(
    (p) => p.status === "accepted" || p.status === "invited"
  );

  return (
    <Link
      href={`/plans/${plan.id}`}
      onClick={(e) => {
        e.preventDefault();
        onPreview();
      }}
      className="flex gap-3 p-3 rounded-xl border-l-[3px] border-l-[var(--neon-cyan)] border border-[var(--twilight)]/60 bg-[var(--neon-cyan)]/[0.03] hover:bg-[var(--neon-cyan)]/[0.06] transition-colors group"
    >
      {/* Plan icon */}
      <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/20 flex items-center justify-center">
        <svg
          className="w-5 h-5 text-[var(--neon-cyan)] opacity-80"
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
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-xs text-[var(--neon-cyan)]">
            {plan.plan_time ? (
              <>
                {time}
                {period && <span className="opacity-60 ml-0.5">{period}</span>}
              </>
            ) : (
              "All day"
            )}
          </span>
          <span className="font-mono text-xs text-[var(--muted)] uppercase">PLAN</span>
        </div>

        <p className="text-[var(--cream)] text-sm font-medium group-hover:text-[var(--neon-cyan)] transition-colors line-clamp-2">
          {plan.title}
        </p>

        <div className="flex items-center gap-3 mt-1.5">
          {!plan.is_creator && (
            <span className="text-xs text-[var(--muted)] truncate">
              by {plan.creator.display_name || plan.creator.username}
            </span>
          )}
          {plan.item_count > 0 && (
            <span className="px-1.5 py-0.5 rounded-full font-mono text-xs bg-[var(--twilight)] text-[var(--soft)]">
              {plan.item_count} {plan.item_count === 1 ? "stop" : "stops"}
            </span>
          )}
          {acceptedParticipants.length > 0 && (
            <ParticipantAvatars participants={acceptedParticipants} />
          )}
        </div>
      </div>
    </Link>
  );
}

function EventCard({
  event,
  onPreview,
}: {
  event: CalendarEvent;
  onPreview: () => void;
}) {
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  const isGoing = event.rsvp_status === "going";
  const borderColor = isGoing ? "var(--coral)" : "var(--gold)";

  return (
    <Link
      href={`/${DEFAULT_PORTAL_SLUG}?event=${event.id}`}
      scroll={false}
      onClick={(e) => {
        e.preventDefault();
        onPreview();
      }}
      className="flex gap-3 p-3 rounded-xl border-l-[3px] border border-[var(--twilight)]/60 hover:bg-[var(--twilight)]/20 transition-colors group"
      style={{ borderLeftColor: borderColor }}
    >
      {/* Image or icon */}
      <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--dusk)]">
        {event.image_url ? (
          <Image src={event.image_url} alt="" fill sizes="48px" className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {event.category ? (
              <CategoryIcon type={event.category} size={22} className="opacity-60" />
            ) : (
              <svg
                className="w-5 h-5 text-[var(--muted)]"
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
        {/* RSVP dot */}
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full flex items-center justify-center text-2xs font-bold ${
            isGoing
              ? "bg-[var(--coral)] text-[var(--void)]"
              : "bg-[var(--gold)] text-[var(--void)]"
          }`}
        >
          {isGoing ? "✓" : "?"}
        </span>
      </div>

      {/* Event details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-xs text-[var(--coral)]">
            {time}
            {period && <span className="opacity-60 ml-0.5">{period}</span>}
          </span>
          {event.rsvp_status !== "went" && (
            <span
              className={`font-mono text-xs uppercase ${
                isGoing ? "text-[var(--coral)]" : "text-[var(--gold)]"
              }`}
            >
              {isGoing ? "GOING" : "INTERESTED"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mb-0.5">
          {event.category && (
            <CategoryIcon type={event.category} size={13} className="flex-shrink-0 opacity-60" />
          )}
          <p className="text-[var(--cream)] text-sm font-medium group-hover:text-[var(--coral)] transition-colors line-clamp-2">
            {event.title}
          </p>
        </div>

        {event.venue && (
          <p className="text-xs text-[var(--muted)] truncate">
            {event.venue.name}
            {event.venue.neighborhood && (
              <span className="opacity-70"> · {event.venue.neighborhood}</span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}

function FriendEventCard({ event }: { event: FriendCalendarEvent }) {
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);

  return (
    <Link
      href={`/${DEFAULT_PORTAL_SLUG}?event=${event.id}`}
      scroll={false}
      className="flex gap-3 p-3 rounded-xl border border-[var(--twilight)]/60 bg-[var(--twilight)]/10 hover:bg-[var(--twilight)]/20 transition-colors group"
    >
      {/* Friend avatar */}
      <div className="w-10 h-10 flex-shrink-0 rounded-full overflow-hidden bg-[var(--twilight)] flex items-center justify-center">
        {event.friend.avatar_url ? (
          <Image
            src={event.friend.avatar_url}
            alt=""
            width={40}
            height={40}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-sm font-bold text-[var(--vibe)]">
            {(event.friend.display_name || event.friend.username)[0].toUpperCase()}
          </span>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="font-mono text-xs text-[var(--muted)] truncate">
            {event.friend.display_name || event.friend.username}
          </span>
          <span className="font-mono text-xs text-[var(--muted)]">
            {event.rsvp_status === "going" ? "· going" : "· interested"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="font-mono text-xs text-[var(--muted)]">
            {time}
            {period && <span className="opacity-60 ml-0.5">{period}</span>}
          </span>
        </div>

        <p className="text-[var(--soft)] text-sm font-medium group-hover:text-[var(--cream)] transition-colors line-clamp-2">
          {event.title}
        </p>
      </div>
    </Link>
  );
}

function ParticipantAvatars({
  participants,
}: {
  participants: CalendarPlan["participants"];
}) {
  const shown = participants.slice(0, 3);

  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-1">
        {shown.map((p) => (
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
      {participants.length > 3 && (
        <span className="font-mono text-xs text-[var(--muted)]">
          +{participants.length - 3}
        </span>
      )}
    </div>
  );
}

function EmptyDayState({
  isPast,
  selectedDate,
}: {
  isPast: boolean;
  selectedDate: Date;
}) {
  return (
    <div className="text-center py-12">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-[var(--muted)]"
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
      <p className="text-[var(--cream)] font-mono text-sm mb-1">No events on this day</p>
      <p className="text-[var(--muted)] text-xs mb-4">
        {isPast ? "That date has passed." : "Nothing planned yet."}
      </p>
      <Link
        href={`${buildExploreUrl({ portalSlug: DEFAULT_PORTAL_SLUG, lane: "events" })}&date_start=${format(selectedDate, "yyyy-MM-dd")}&date_end=${format(selectedDate, "yyyy-MM-dd")}`}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--coral)]/20 text-[var(--coral)] font-mono text-xs font-medium hover:bg-[var(--coral)]/30 transition-colors"
      >
        Explore events
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
