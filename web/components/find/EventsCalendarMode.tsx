"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const CalendarView = dynamic(() => import("@/components/CalendarView"));
const MobileCalendarView = dynamic(
  () => import("@/components/calendar/MobileCalendarView"),
);

interface EventsCalendarModeProps {
  portalId: string;
  portalSlug: string;
  portalExclusive: boolean;
}

export default function EventsCalendarMode({
  portalId,
  portalSlug,
  portalExclusive,
}: EventsCalendarModeProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="py-16 text-center">
          <p className="text-sm text-[var(--cream)] mb-1">
            Something went wrong loading the calendar.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-xs text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
          >
            Try again
          </button>
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="p-4 sm:p-6 animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="h-5 w-32 bg-[var(--twilight)] rounded" />
              <div className="h-8 w-20 bg-[var(--twilight)] rounded" />
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={`h${index}`} className="h-4 bg-[var(--twilight)] rounded mb-2" />
              ))}
              {Array.from({ length: 35 }).map((_, index) => (
                <div key={index} className="aspect-square bg-[var(--twilight)]/50 rounded" />
              ))}
            </div>
          </div>
        }
      >
        <div className="lg:hidden">
          <MobileCalendarView
            portalId={portalId}
            portalSlug={portalSlug}
            portalExclusive={portalExclusive}
          />
        </div>
        <div className="hidden lg:block relative z-0 border border-[var(--twilight)]/85 bg-[var(--void)]/65 shadow-[0_18px_40px_rgba(0,0,0,0.28)] overflow-hidden">
          <CalendarView
            portalId={portalId}
            portalSlug={portalSlug}
            portalExclusive={portalExclusive}
            fullBleed
          />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}
