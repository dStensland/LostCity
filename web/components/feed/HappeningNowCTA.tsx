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
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLiveCount() {
      try {
        const res = await fetch(`/api/portals/${portalSlug}/happening-now?countOnly=true`);
        if (res.ok) {
          const data = await res.json();
          setLiveCount(data.count || 0);
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

  // Don't render if no live events
  if (liveCount === null || liveCount === 0) {
    return null;
  }

  return (
    <Link
      href={`/${portalSlug}/happening-now`}
      className="block mb-6 p-4 rounded-xl border border-[var(--coral)]/30 bg-gradient-to-r from-[var(--coral)]/10 via-[var(--rose)]/5 to-transparent hover:border-[var(--coral)]/50 hover:shadow-[0_0_20px_var(--coral)/15] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Live indicator - subtle pulse */}
          <div className="relative flex items-center justify-center">
            <span className="absolute w-3.5 h-3.5 bg-[var(--coral)]/40 rounded-full animate-pulse" />
            <span className="relative w-2.5 h-2.5 bg-[var(--coral)] rounded-full shadow-[0_0_8px_var(--coral)]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-medium text-[var(--coral)] uppercase tracking-wider">
                Happening Now
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[var(--coral)] text-[var(--void)] font-mono text-[10px] font-bold">
                {liveCount}
              </span>
            </div>
            <p className="text-sm text-[var(--soft)] mt-0.5">
              {liveCount === 1
                ? "1 event is live right now in "
                : `${liveCount} events are live right now in `}
              <span className="text-[var(--cream)]">{portal.name}</span>
            </p>
          </div>
        </div>

        {/* Arrow */}
        <svg
          className="w-5 h-5 text-[var(--coral)] group-hover:translate-x-1 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
