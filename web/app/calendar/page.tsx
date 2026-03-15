"use client";

import React from "react";
import { CalendarProvider, useCalendar } from "@/lib/calendar/CalendarProvider";
import {
  useCalendarEvents,
  useFriendCalendarEvents,
  useFriendsList,
  useFeedUrls,
} from "@/lib/calendar/useCalendarData";
import {
  useEventsByDate,
  usePlansByDate,
  useFriendEventsByDate,
  useCalendarGrid,
  useMobileWeekStrip,
} from "@/lib/calendar/useCalendarDerived";
import { useAuth } from "@/lib/auth-context";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import WeekView from "@/components/calendar/WeekView";
import AgendaView from "@/components/calendar/AgendaView";
import DayDetailView from "@/components/calendar/DayDetailView";
import CalendarSheet from "@/components/calendar/CalendarSheet";
import { EmptyState } from "@/components/calendar/EmptyState";
import { CalendarSkeleton } from "@/components/calendar/CalendarSkeleton";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";

export default function CalendarPage() {
  return (
    <CalendarProvider>
      <CalendarContent />
    </CalendarProvider>
  );
}

function CalendarContent() {
  const { user } = useAuth();
  const { state, dispatch, selectDate } = useCalendar();
  const { currentView, currentMonth, selectedDate } = state;

  const portalSlug = DEFAULT_PORTAL_SLUG;

  // Data hooks
  const { data, isLoading, isRefetching } = useCalendarEvents();
  const { data: friendsData } = useFriendCalendarEvents();
  const { data: friendsList } = useFriendsList();
  const { data: feedUrls } = useFeedUrls();

  // Derived maps
  const eventsByDate = useEventsByDate(data?.events);
  const plansByDate = usePlansByDate(data?.plans);
  const friendEventsByDate = useFriendEventsByDate(friendsData?.events);

  // Grid + week strip
  const calendarDays = useCalendarGrid(currentMonth, eventsByDate, friendEventsByDate, plansByDate);
  const mobileWeekStripDays = useMobileWeekStrip(currentMonth, selectedDate, eventsByDate, friendEventsByDate);

  const friends = friendsList?.friends ?? [];
  const allEvents = data?.events ?? [];
  const allFriendEvents = friendsData?.events ?? [];
  const allPlans = data?.plans ?? [];

  if (!user) {
    return null; // Layout handles redirect
  }

  // Loading state
  if (isLoading && !data) {
    return <CalendarSkeleton />;
  }

  const hasContent = allEvents.length > 0 || allPlans.length > 0 || allFriendEvents.length > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
      <CalendarHeader
        summary={data?.summary}
        friends={friends}
        feedUrls={feedUrls ?? null}
        isLoading={isLoading}
      />

      {currentView === "agenda" && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4">
          {hasContent ? (
            <AgendaView
              events={allEvents}
              friendEvents={allFriendEvents}
              plans={allPlans}
              eventsByDate={eventsByDate}
              friendEventsByDate={friendEventsByDate}
              plansByDate={plansByDate}
              portalSlug={portalSlug}
            />
          ) : !isLoading ? (
            <EmptyState />
          ) : null}
          {/* Desktop sidebar: mini month + day detail */}
          <div className="hidden xl:flex xl:flex-col gap-4">
            <MonthGrid
              calendarDays={calendarDays}
              mobileWeekStripDays={mobileWeekStripDays}
              isLoading={isLoading}
              isRefetching={isRefetching}
              compact
            />
            <aside className="rounded-2xl border border-[var(--twilight)]/85 bg-[var(--void)]/65 shadow-[0_18px_40px_rgba(0,0,0,0.28)] h-fit sticky top-20">
              <DayDetailView
                eventsByDate={eventsByDate}
                plansByDate={plansByDate}
                friendEventsByDate={friendEventsByDate}
              />
            </aside>
          </div>
        </div>
      )}

      {currentView === "week" && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
          <WeekView
            currentDate={currentMonth}
            onDateChange={(date) => dispatch({ type: "SET_MONTH", month: date })}
            eventsByDate={eventsByDate}
            plansByDate={plansByDate}
            onDayClick={selectDate}
            selectedDate={selectedDate}
            portalSlug={portalSlug}
          />
          {/* Desktop sidebar: mini month */}
          <div className="hidden xl:flex xl:flex-col gap-4">
            <MonthGrid
              calendarDays={calendarDays}
              mobileWeekStripDays={mobileWeekStripDays}
              isLoading={isLoading}
              isRefetching={isRefetching}
              compact
            />
          </div>
        </div>
      )}

      {currentView === "month" && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px] gap-4">
          <MonthGrid
            calendarDays={calendarDays}
            mobileWeekStripDays={mobileWeekStripDays}
            isLoading={isLoading}
            isRefetching={isRefetching}
          />
          <aside className="rounded-2xl border border-[var(--twilight)]/85 bg-[var(--void)]/65 shadow-[0_18px_40px_rgba(0,0,0,0.28)] h-fit xl:sticky xl:top-20">
            <DayDetailView
              eventsByDate={eventsByDate}
              plansByDate={plansByDate}
              friendEventsByDate={friendEventsByDate}
            />
          </aside>
        </div>
      )}

      <CalendarSheet />
    </div>
  );
}
