"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePortal } from "@/lib/portal-context";

interface HappeningNowCTAProps {
  portalSlug: string;
}

function HappeningNowSkeleton() {
  return (
    <div className="mb-6 p-4 rounded-xl border border-[var(--coral)]/20 bg-gradient-to-r from-[var(--coral)]/5 via-[var(--rose)]/3 to-transparent relative overflow-hidden">
      {/* Animated scan line */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-y-0 w-full animate-coral-shimmer bg-gradient-to-r from-transparent via-[var(--coral)] to-transparent" />
      </div>

      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          {/* Pulsing live indicator - triple ring effect */}
          <div className="relative flex items-center justify-center w-5 h-5">
            <span className="absolute w-5 h-5 bg-[var(--coral)]/20 rounded-full animate-ping" />
            <span className="absolute w-4 h-4 bg-[var(--coral)]/30 rounded-full animate-coral-pulse" />
            <span className="relative w-2.5 h-2.5 bg-[var(--coral)]/50 rounded-full animate-pulse" />
          </div>

          <div className="space-y-2">
            {/* "Happening Now" text skeleton with shimmer */}
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-24 rounded-sm bg-[var(--coral)]/15 relative overflow-hidden">
                <div className="absolute inset-0 animate-coral-scan bg-gradient-to-r from-transparent via-[var(--coral)]/30 to-transparent" />
              </div>
              <div className="h-4 w-7 rounded bg-[var(--coral)]/25 animate-coral-pulse" />
            </div>
            {/* Description skeleton */}
            <div className="h-3 w-48 rounded-sm bg-[var(--twilight)] relative overflow-hidden">
              <div className="absolute inset-0 animate-coral-scan delay-200 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
          </div>
        </div>

        {/* Arrow skeleton - pulsing chevron hint */}
        <div className="w-5 h-5 rounded-full bg-[var(--coral)]/10 flex items-center justify-center animate-coral-pulse">
          <div className="w-2 h-2 border-r border-t border-[var(--coral)]/30 rotate-45 -ml-0.5" />
        </div>
      </div>
    </div>
  );
}

export default function HappeningNowCTA({ portalSlug }: HappeningNowCTAProps) {
  const { portal } = usePortal();
  const [eventCount, setEventCount] = useState<number>(0);
  const [spotCount, setSpotCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const totalCount = eventCount + spotCount;

  useEffect(() => {
    async function fetchLiveCount() {
      try {
        const res = await fetch(`/api/portals/${portalSlug}/happening-now?countOnly=true`);
        if (res.ok) {
          const data = await res.json();
          setEventCount(data.eventCount || 0);
          setSpotCount(data.spotCount || 0);
        }
      } catch (error) {
        console.error("Failed to fetch happening now count:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLiveCount();

    // Refresh every 5 minutes
    const interval = setInterval(fetchLiveCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [portalSlug]);

  // Show skeleton while loading
  if (loading) {
    return <HappeningNowSkeleton />;
  }

  // Don't render if nothing is happening
  if (totalCount === 0) {
    return null;
  }

  return (
    <Link
      href={`/${portalSlug}/happening-now`}
      className="block mb-6 p-4 rounded-xl border-2 border-[var(--neon-red)]/40 bg-gradient-to-r from-[var(--neon-red)]/15 via-[var(--neon-red)]/8 to-transparent hover:border-[var(--neon-red)]/60 hover:shadow-[0_0_24px_var(--neon-red)/25] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 group animate-happening-now-pulse"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Live indicator - enhanced quadruple ring pulse effect with brighter accent */}
          <div className="relative flex items-center justify-center w-7 h-7">
            <span className="absolute w-7 h-7 bg-[var(--neon-red)]/25 rounded-full animate-ping animate-duration-1500" />
            <span className="absolute w-5 h-5 bg-[var(--neon-red)]/35 rounded-full animate-pulse animate-duration-2000" />
            <span className="absolute w-3 h-3 bg-[var(--neon-red)]/50 rounded-full animate-ping animate-duration-1000" />
            <span className="relative w-2.5 h-2.5 bg-[var(--neon-red)] rounded-full shadow-[0_0_16px_var(--neon-red)]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-[var(--neon-red)] uppercase tracking-wider">
                LIVE NOW
              </span>
              {eventCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--neon-red)]/20 text-[var(--neon-red)] border border-[var(--neon-red)]/50 font-mono text-xs font-bold">
                  {eventCount} {eventCount === 1 ? "event" : "events"}
                </span>
              )}
              {spotCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--neon-green)]/20 text-[var(--neon-green)] border border-[var(--neon-green)]/50 font-mono text-xs font-bold">
                  {spotCount} open
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--soft)] mt-0.5 font-medium">
              {eventCount > 0 && spotCount > 0 ? (
                <>
                  {eventCount} {eventCount === 1 ? "event" : "events"} live, {spotCount} {spotCount === 1 ? "spot" : "spots"} open in{" "}
                </>
              ) : eventCount > 0 ? (
                <>
                  {eventCount} {eventCount === 1 ? "event happening" : "events happening"} right now in{" "}
                </>
              ) : (
                <>
                  {spotCount} {spotCount === 1 ? "spot" : "spots"} open right now in{" "}
                </>
              )}
              <span className="text-[var(--cream)]">{portal.name}</span>
            </p>
          </div>
        </div>

        {/* Arrow with pulse */}
        <svg
          className="w-5 h-5 text-[var(--neon-red)] group-hover:translate-x-1 transition-transform animate-pulse"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
