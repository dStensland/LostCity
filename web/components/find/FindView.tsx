"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SimpleFilterBar from "@/components/SimpleFilterBar";
import EventList from "@/components/EventList";
import MapViewWrapper from "@/components/MapViewWrapper";
import CalendarView from "@/components/CalendarView";
import MobileCalendarView from "@/components/calendar/MobileCalendarView";
import PortalSpotsView from "@/components/PortalSpotsView";
import PortalCommunityView from "@/components/PortalCommunityView";
import ClassesView from "@/components/find/ClassesView";
import { ActiveFiltersRow } from "@/components/filters";
import AddNewChooser from "@/components/find/AddNewChooser";

type FindType = "events" | "classes" | "destinations" | "orgs";
type DisplayMode = "list" | "map" | "calendar";

interface FindViewProps {
  portalId: string;
  portalSlug: string;
  portalExclusive: boolean;
  findType: FindType;
  displayMode: DisplayMode;
  hasActiveFilters: boolean;
}

const TYPE_OPTIONS: { key: FindType; label: string; icon: React.ReactNode }[] = [
  {
    key: "events",
    label: "Events",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "classes",
    label: "Classes",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    key: "destinations",
    label: "Destinations",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: "orgs",
    label: "Orgs",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
];

function FindViewInner({
  portalId,
  portalSlug,
  portalExclusive,
  findType,
  displayMode,
  hasActiveFilters,
}: FindViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [eventSearch, setEventSearch] = useState(searchParams?.get("search") || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pathname = `/${portalSlug}`;

  // Sync local state when URL search param changes externally
  useEffect(() => {
    setEventSearch(searchParams?.get("search") || "");
  }, [searchParams]);

  const updateSearchParam = (value: string) => {
    setEventSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (value) {
        params.set("search", value);
      } else {
        params.delete("search");
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);
  };

  const handleTypeChange = (type: FindType) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("view", "find");
    params.set("type", type);
    // Reset display mode when changing type
    params.delete("display");
    router.push(`/${portalSlug}?${params.toString()}`);
  };

  return (
    <div className="py-4">
      {/* Type selector tabs + Add new button */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex p-1 bg-[var(--night)] rounded-lg max-w-md">
          {TYPE_OPTIONS.map((option) => {
            const isActive = findType === option.key;
            return (
              <button
                key={option.key}
                onClick={() => handleTypeChange(option.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-mono text-xs whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-[var(--coral)] text-[var(--void)] font-medium shadow-[0_0_12px_var(--coral)/20]"
                    : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50"
                }`}
              >
                {option.icon}
                {option.label}
              </button>
            );
          })}
        </div>
        <AddNewChooser portalSlug={portalSlug} />
      </div>

      {/* Filter bar for events */}
      {findType === "events" && (
        <Suspense fallback={<div className="h-10 bg-[var(--night)]" />}>
          {/* Search input */}
          <div className="relative mb-3">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search events..."
              value={eventSearch}
              onChange={(e) => updateSearchParam(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)]/50 transition-colors"
            />
            {eventSearch && (
              <button
                onClick={() => updateSearchParam("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <SimpleFilterBar variant={displayMode === "map" ? "compact" : "full"} />
          {/* Active Filters */}
          <div className="px-4 pb-2">
            <ActiveFiltersRow />
          </div>
        </Suspense>
      )}

      {/* Content based on type and display mode */}
      {findType === "events" && displayMode === "list" && (
        <EventList
          hasActiveFilters={hasActiveFilters}
          portalId={portalId}
          portalExclusive={portalExclusive}
          portalSlug={portalSlug}
        />
      )}

      {findType === "events" && displayMode === "calendar" && (
        <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading calendar...</div>}>
          {/* Mobile: Hybrid week strip + agenda view */}
          <div className="lg:hidden">
            <MobileCalendarView
              portalId={portalId}
              portalSlug={portalSlug}
              portalExclusive={portalExclusive}
            />
          </div>
          {/* Desktop: Full month grid with side panel */}
          <div className="hidden lg:block">
            <CalendarView
              portalId={portalId}
              portalSlug={portalSlug}
              portalExclusive={portalExclusive}
            />
          </div>
        </Suspense>
      )}

      {findType === "events" && displayMode === "map" && (
        <div className="relative z-0 h-[calc(100vh-180px)] -mx-4">
          <MapViewWrapper
            portalId={portalId}
            portalExclusive={portalExclusive}
          />
        </div>
      )}

      {findType === "classes" && (
        <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading classes...</div>}>
          <ClassesView
            portalId={portalId}
            portalSlug={portalSlug}
          />
        </Suspense>
      )}

      {findType === "destinations" && displayMode === "list" && (
        <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading destinations...</div>}>
          <PortalSpotsView
            portalId={portalId}
            portalSlug={portalSlug}
            isExclusive={portalExclusive}
          />
        </Suspense>
      )}

      {findType === "destinations" && displayMode === "map" && (
        <div className="relative z-0 h-[calc(100vh-180px)] -mx-4">
          {/* TODO: Add showVenuesOnly support to MapViewWrapper */}
          <MapViewWrapper
            portalId={portalId}
            portalExclusive={portalExclusive}
          />
        </div>
      )}

      {findType === "orgs" && (
        <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading organizations...</div>}>
          <PortalCommunityView
            portalId={portalId}
            portalSlug={portalSlug}
            portalName=""
          />
        </Suspense>
      )}
    </div>
  );
}

export default function FindView(props: FindViewProps) {
  return (
    <Suspense
      fallback={
        <div className="py-4 space-y-4">
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-20 skeleton-shimmer rounded-full" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 skeleton-shimmer rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <FindViewInner {...props} />
    </Suspense>
  );
}
