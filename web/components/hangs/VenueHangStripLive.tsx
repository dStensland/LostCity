"use client";

import { useVenueHangs } from "@/lib/hooks/useHangs";
import { VenueHangStrip } from "./VenueHangStrip";

interface VenueHangStripLiveProps {
  venueId: number;
  variant?: "compact" | "full";
  className?: string;
}

/**
 * Client wrapper that fetches venue hang data via useVenueHangs hook
 * and passes it to VenueHangStrip. Use this on venue detail pages
 * where data needs to be live-fetched.
 */
export function VenueHangStripLive({
  venueId,
  variant = "full",
  className,
}: VenueHangStripLiveProps) {
  const { data, isLoading } = useVenueHangs(venueId);

  if (isLoading || !data) return null;
  // Hide when no one is here — avoid "be the first" noise on every venue page
  if (data.total_count === 0) return null;

  return (
    <VenueHangStrip
      venueId={venueId}
      hangInfo={data}
      variant={variant}
      className={className}
    />
  );
}
