"use client";

import { useMemo } from "react";
import { useCalendarEvents, useFriendCalendarEvents } from "@/lib/calendar/useCalendarData";
import { useEventsByDate, useFriendEventsByDate, usePlansByDate } from "@/lib/calendar/useCalendarDerived";
import { AgendaEntryRow } from "./AgendaEntryRow";
import { FriendEntryRow } from "./FriendEntryRow";
import { GapRow } from "./GapRow";
import { PlanExpandableRow } from "./PlanExpandableRow";

interface PlansAgendaProps {
  portalSlug: string;
}

export function PlansAgenda({ portalSlug }: PlansAgendaProps) {
  const { data: calendarData, isLoading } = useCalendarEvents();
  const { data: friendData } = useFriendCalendarEvents();

  const eventsByDate = useEventsByDate(calendarData?.events);
  const friendEventsByDate = useFriendEventsByDate(friendData?.events);
  const plansByDate = usePlansByDate(calendarData?.plans);

  const hasAnyCommitments = useMemo(() => {
    if (!calendarData) return false;
    return (
      (calendarData.events?.length ?? 0) > 0 ||
      (calendarData.plans?.length ?? 0) > 0
    );
  }, [calendarData]);

  // Generate 28 days starting from today
  const days = useMemo(() => {
    const today = new Date();
    const result: Date[] = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      result.push(d);
    }
    return result;
  }, []);

  if (isLoading) {
    return <AgendaSkeleton />;
  }

  if (!hasAnyCommitments) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] px-4 text-center">
        <p className="text-sm text-[var(--muted)]">
          No plans yet. RSVP to events or subscribe to series to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {days.map((day) => {
        const dateKey = formatDateKey(day);
        const myEvents = eventsByDate.get(dateKey) ?? [];
        const myPlans = plansByDate.get(dateKey) ?? [];
        const friendEvents = friendEventsByDate.get(dateKey) ?? [];

        // Dedup: remove friend events where user is also going
        const myEventIds = new Set(myEvents.map((e) => e.id));
        const friendOnlyEvents = friendEvents.filter((fe) => !myEventIds.has(fe.id));

        // Build friend avatar map for shared events
        const sharedFriendMap = new Map<number, { initials: string; color: string }[]>();
        friendEvents.forEach((fe) => {
          if (myEventIds.has(fe.id)) {
            const existing = sharedFriendMap.get(fe.id) ?? [];
            existing.push({
              initials: fe.friend?.display_name?.slice(0, 1) ?? "?",
              color: "rgba(140,160,255,0.3)",
            });
            sharedFriendMap.set(fe.id, existing);
          }
        });

        const hasContent = myEvents.length > 0 || myPlans.length > 0 || friendOnlyEvents.length > 0;
        const isToday = new Date().toDateString() === day.toDateString();
        const dayLabel = isToday
          ? `${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · Tonight`
          : day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

        return (
          <div key={dateKey} id={`day-${dateKey}`}>
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]/60 font-semibold mt-4 mb-1.5 px-1">
              {dayLabel}
            </div>
            {!hasContent && (
              <GapRow date={day} portalSlug={portalSlug} />
            )}
            {myPlans.map((plan) => (
              <div key={`plan-${plan.id}`} className="mb-1">
                <PlanExpandableRow
                  plan={{
                    id: plan.id,
                    title: plan.title,
                    plan_time: plan.plan_time ?? undefined,
                    stops: [],
                    participants: plan.participants?.map((p) => ({
                      initials: p.user?.display_name?.slice(0, 1) ?? "?",
                      color: "rgba(140,160,255,0.3)",
                    })) ?? [],
                  }}
                  portalSlug={portalSlug}
                />
              </div>
            ))}
            {myEvents.map((event) => (
              <div key={`event-${event.id}`} className="mb-1">
                <AgendaEntryRow
                  event={{
                    id: event.id,
                    title: event.title,
                    start_time: event.start_time ?? undefined,
                    venue: event.venue ? { name: event.venue.name, slug: event.venue.slug ?? "" } : undefined,
                  }}
                  friendAvatars={sharedFriendMap.get(event.id)}
                  portalSlug={portalSlug}
                />
              </div>
            ))}
            {friendOnlyEvents.map((fe) => (
              <div key={`friend-${fe.id}-${fe.friend?.id}`} className="mb-1">
                <FriendEntryRow
                  event={{
                    id: fe.id,
                    title: fe.title,
                    start_time: fe.start_time ?? undefined,
                    venue: undefined,
                  }}
                  friend={{
                    display_name: fe.friend?.display_name ?? "Friend",
                    initials: fe.friend?.display_name?.slice(0, 1) ?? "?",
                    avatar_url: fe.friend?.avatar_url ?? undefined,
                  }}
                  portalSlug={portalSlug}
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function AgendaSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[...Array(5)].map((_, i) => (
        <div key={i}>
          <div className="h-3 w-24 bg-[var(--twilight)] rounded animate-pulse mb-2" />
          <div className="h-14 bg-[var(--twilight)] rounded-xl animate-pulse" />
        </div>
      ))}
    </div>
  );
}
