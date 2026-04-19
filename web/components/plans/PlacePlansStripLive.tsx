"use client";

import { usePlacePlans } from "@/lib/hooks/useUserPlans";
import { PlacePlansStrip } from "./PlacePlansStrip";

interface PlacePlansStripLiveProps {
  placeId: number;
  variant?: "compact" | "full";
  className?: string;
}

/**
 * Client wrapper that fetches place plans data via usePlacePlans hook
 * and passes it to PlacePlansStrip. Use this on place detail pages
 * where data needs to be live-fetched.
 *
 * Renamed from PlaceHangStripLive — prop renamed venueId → placeId.
 */
export function PlacePlansStripLive({
  placeId,
  variant = "full",
  className,
}: PlacePlansStripLiveProps) {
  const { data, isLoading } = usePlacePlans(placeId);

  if (isLoading) {
    return (
      <div className={["flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse", className].filter(Boolean).join(" ")}>
        <div className="w-6 h-6 rounded-full bg-[var(--twilight)]/60" />
        <div className="h-3 w-24 rounded bg-[var(--twilight)]/60" />
      </div>
    );
  }
  if (!data) return null;
  // Hide when no one is here — avoid "be the first" noise on every place page
  if (data.active_count === 0) return null;

  return (
    <PlacePlansStrip
      placeId={placeId}
      plansInfo={data}
      variant={variant}
      className={className}
    />
  );
}
