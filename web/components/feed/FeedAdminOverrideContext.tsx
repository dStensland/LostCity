"use client";

/**
 * FeedAdminOverrideProvider — admin-only client context for previewing the
 * feed at any day × time_slot.
 *
 * The provider wraps `CityPulseServerShell`'s children (islands) at the
 * DefaultTemplate boundary. When the URL has `?admin` it also renders the
 * `FeedTimeMachine` toolbar; otherwise the context is a no-op pass-through.
 *
 * Islands that care about overrides (briefing, lineup) read
 * `useFeedAdminOverrides()` and pass `dayOverride` / `timeSlotOverride` into
 * `useCityPulseFeed`, which sends them to `/api/portals/<slug>/city-pulse`
 * and bypasses normal caching when set.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { TimeSlot } from "@/lib/city-pulse/types";

interface FeedAdminOverrides {
  dayOverride?: string;
  timeSlotOverride?: TimeSlot;
  setOverrides: (day: string | undefined, slot: TimeSlot | undefined) => void;
}

const FeedAdminOverrideContext = createContext<FeedAdminOverrides>({
  setOverrides: () => {},
});

export function useFeedAdminOverrides(): FeedAdminOverrides {
  return useContext(FeedAdminOverrideContext);
}

const FeedTimeMachine = dynamic(() => import("./FeedTimeMachine"));

export function FeedAdminOverrideProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const isAdminMode = searchParams?.get("admin") !== null;

  const [dayOverride, setDayOverride] = useState<string | undefined>();
  const [timeSlotOverride, setTimeSlotOverride] = useState<TimeSlot | undefined>();

  const setOverrides = useCallback(
    (day: string | undefined, slot: TimeSlot | undefined) => {
      setDayOverride(day);
      setTimeSlotOverride(slot);
    },
    [],
  );

  const value = useMemo<FeedAdminOverrides>(
    () => ({ dayOverride, timeSlotOverride, setOverrides }),
    [dayOverride, timeSlotOverride, setOverrides],
  );

  return (
    <FeedAdminOverrideContext.Provider value={value}>
      {children}
      {isAdminMode && (
        <FeedTimeMachine
          currentDay={dayOverride}
          currentTimeSlot={timeSlotOverride}
          onOverride={setOverrides}
        />
      )}
    </FeedAdminOverrideContext.Provider>
  );
}
