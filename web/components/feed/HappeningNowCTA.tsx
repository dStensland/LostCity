"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getDayPart, getHappeningNowGreeting } from "@/lib/time-greeting";

interface HappeningNowCTAProps {
  portalSlug: string;
}

function HappeningNowSkeleton() {
  return (
    <div className="px-4 py-3 rounded-xl border border-[var(--coral)]/15 bg-gradient-to-r from-[var(--coral)]/4 via-[var(--rose)]/2 to-transparent relative overflow-hidden">
      {/* Animated scan line */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-y-0 w-full animate-coral-shimmer bg-gradient-to-r from-transparent via-[var(--coral)] to-transparent" />
      </div>

      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          {/* Pulsing live indicator - double ring effect */}
          <div className="relative flex items-center justify-center w-4 h-4">
            <span className="absolute w-4 h-4 bg-[var(--coral)]/18 rounded-full animate-ping" />
            <span className="relative w-2 h-2 bg-[var(--coral)]/45 rounded-full animate-pulse" />
          </div>

          <div className="space-y-2">
            {/* Headline skeleton with shimmer */}
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-24 rounded-sm bg-[var(--coral)]/12 relative overflow-hidden">
                <div className="absolute inset-0 animate-coral-scan bg-gradient-to-r from-transparent via-[var(--coral)]/30 to-transparent" />
              </div>
              <div className="h-4 w-7 rounded bg-[var(--coral)]/20 animate-coral-pulse" />
            </div>
            {/* Description skeleton */}
            <div className="h-3 w-48 rounded-sm bg-[var(--twilight)]/80 relative overflow-hidden">
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
  const [eventCount, setEventCount] = useState<number>(0);
  const [spotCount, setSpotCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const totalCount = eventCount + spotCount;

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchLiveCount() {
      try {
        const res = await fetch(`/api/around-me?countOnly=true`, {
          signal: abortController.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setEventCount(data.eventCount || 0);
          setSpotCount(data.spotCount || 0);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Failed to fetch happening now count:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLiveCount();

    // Refresh every 5 minutes
    const interval = setInterval(fetchLiveCount, 5 * 60 * 1000);
    return () => {
      abortController.abort();
      clearInterval(interval);
    };
  }, [portalSlug]);

  // Show skeleton while loading
  if (loading) {
    return <HappeningNowSkeleton />;
  }

  // Don't render if nothing is happening
  if (totalCount === 0) {
    return null;
  }

  const dayPart = getDayPart();
  const { headline, subtitle } = getHappeningNowGreeting(dayPart, eventCount, spotCount);

  return (
    <Link
      href={`/${portalSlug}/happening-now`}
      className="block px-4 py-3 rounded-xl border border-[var(--coral)]/30 bg-gradient-to-r from-[var(--coral)]/10 via-[var(--coral)]/4 to-transparent hover:border-[var(--coral)]/45 hover:shadow-[0_0_18px_var(--coral)/18] hover:scale-[1.005] active:scale-[0.99] transition-all duration-200 group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Live indicator - double ring pulse effect */}
          <div className="relative flex items-center justify-center w-5 h-5">
            <span className="absolute w-5 h-5 bg-[var(--coral)]/20 rounded-full animate-ping animate-duration-1800" />
            <span className="relative w-2 h-2 bg-[var(--coral)] rounded-full shadow-[0_0_12px_var(--coral)]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[var(--coral)] uppercase tracking-wider">
                {headline}
              </span>
              {eventCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--coral)]/20 text-[var(--coral)] border border-[var(--coral)]/50 font-mono text-xs font-bold">
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
              {subtitle}
            </p>
          </div>
        </div>

        {/* Arrow with pulse */}
        <svg
          className="w-5 h-5 text-[var(--coral)] group-hover:translate-x-1 transition-transform"
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
