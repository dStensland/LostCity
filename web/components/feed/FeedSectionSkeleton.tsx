"use client";

import { useEffect, useRef, useState } from "react";
import { HorseIcon } from "@/components/ui/HorseSpinner";

interface FeedSectionSkeletonProps {
  accentColor: string;
  minHeight?: number;
  /** Minimum ms to show the skeleton even if data arrives faster (prevents flash) */
  minDisplayMs?: number;
  /** Ms after which to show a "taking longer than usual" message with retry */
  timeoutMs?: number;
  onRetry?: () => void;
}

function AtlantaSkylineSVG() {
  return (
    <svg
      viewBox="0 0 400 100"
      preserveAspectRatio="xMidYMax slice"
      fill="currentColor"
      className="w-full h-full"
    >
      {/* ── Far-left low-rises with varied rooftops ── */}
      <rect x="2" y="78" width="8" height="20" />
      <rect x="12" y="70" width="10" height="28" />
      <rect x="14" y="66" width="6" height="4" />
      <rect x="24" y="60" width="12" height="38" />
      <polygon points="24,60 30,54 36,60" />
      <rect x="38" y="72" width="8" height="26" />

      {/* ── Georgia-Pacific Tower: stair-stepped east face ── */}
      <polygon points="48,34 60,34 60,48 64,48 64,60 68,60 68,74 72,74 72,98 48,98" />

      {/* ── Westin Peachtree Plaza: cylinder + elevator shaft + Sun Dial ── */}
      <rect x="76" y="30" width="14" height="68" />
      <rect x="90" y="30" width="3" height="68" />
      <ellipse cx="83" cy="30" rx="9" ry="3" />

      {/* ── Equitable Building: flat-topped International Style box ── */}
      <rect x="96" y="56" width="14" height="42" />

      {/* ── 191 Peachtree: body + twin rounded dome "rabbit ears" ── */}
      <rect x="114" y="28" width="24" height="70" />
      <rect x="116" y="24" width="20" height="4" />
      <path d="M116,24 Q121,14 126,24" />
      <path d="M126,24 Q131,14 136,24" />

      {/* ── Truist Plaza: 2nd tallest, clean shaft + compact crown ── */}
      <rect x="142" y="18" width="18" height="80" />
      <rect x="144" y="14" width="14" height="4" />
      <polygon points="147,14 151,10 155,14" />
      {/* Corner articulation — alternating office projections */}
      <rect x="140" y="28" width="2" height="6" />
      <rect x="160" y="28" width="2" height="6" />
      <rect x="140" y="52" width="2" height="6" />
      <rect x="160" y="52" width="2" height="6" />
      <rect x="140" y="76" width="2" height="6" />
      <rect x="160" y="76" width="2" height="6" />

      {/* ── Bank of America Plaza (tallest): open-lattice pyramid + gold spire ── */}
      <rect x="166" y="6" width="20" height="92" />
      <rect x="168" y="2" width="16" height="4" />
      {/* Open-lattice pyramid — outline only, NOT solid */}
      <polygon
        points="168,2 176,-14 184,2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      {/* Lattice diagonal cross-bracing */}
      <line x1="172" y1="2" x2="180" y2="-12" stroke="currentColor" strokeWidth="0.5" />
      <line x1="180" y1="2" x2="172" y2="-12" stroke="currentColor" strokeWidth="0.5" />
      {/* Horizontal lattice bar */}
      <line x1="170" y1="-6" x2="182" y2="-6" stroke="currentColor" strokeWidth="0.5" />
      {/* Gold spire/obelisk atop pyramid */}
      <polygon points="175,-14 176,-20 177,-14" />

      {/* ── One Atlantic Center: steep Gothic pyramid + pinnacles ── */}
      <rect x="190" y="22" width="16" height="76" />
      <polygon points="190,22 198,4 206,22" />
      {/* Pinnacles along pyramid slopes */}
      <polygon points="193,17 194,13 195,17" />
      <polygon points="201,17 202,13 203,17" />
      {/* Apex spire */}
      <rect x="197.5" y="0" width="1" height="4" />

      {/* ── 1180 Peachtree: tower with open structural veil crown ── */}
      <rect x="212" y="36" width="14" height="62" />
      {/* Open veil/framework above roof — outline rect */}
      <rect
        x="212"
        y="24"
        width="14"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
      />
      {/* Vertical structural members inside veil */}
      <line x1="217" y1="24" x2="217" y2="36" stroke="currentColor" strokeWidth="0.5" />
      <line x1="222" y1="24" x2="222" y2="36" stroke="currentColor" strokeWidth="0.5" />

      {/* ── Mid-rise gap fillers ── */}
      <rect x="230" y="50" width="10" height="48" />
      <rect x="242" y="44" width="12" height="54" />
      <rect x="244" y="40" width="8" height="4" />

      {/* ── SkyView Atlanta Ferris Wheel with gondola pods ── */}
      <circle cx="270" cy="80" r="14" fill="none" stroke="currentColor" strokeWidth="1.2" />
      {/* 8 spokes */}
      <line x1="270" y1="66" x2="270" y2="94" stroke="currentColor" strokeWidth="0.5" />
      <line x1="256" y1="80" x2="284" y2="80" stroke="currentColor" strokeWidth="0.5" />
      <line x1="260" y1="70" x2="280" y2="90" stroke="currentColor" strokeWidth="0.5" />
      <line x1="280" y1="70" x2="260" y2="90" stroke="currentColor" strokeWidth="0.5" />
      {/* Central hub */}
      <circle cx="270" cy="80" r="2" />
      {/* Gondola pods at 8 positions around rim */}
      <rect x="268" y="64.5" width="4" height="2.5" rx="0.5" />
      <rect x="268" y="93" width="4" height="2.5" rx="0.5" />
      <rect x="254.5" y="78.5" width="2.5" height="3" rx="0.5" />
      <rect x="285" y="78.5" width="2.5" height="3" rx="0.5" />
      <rect x="258.5" y="68.5" width="3" height="2.5" rx="0.5" />
      <rect x="278.5" y="68.5" width="3" height="2.5" rx="0.5" />
      <rect x="258.5" y="89" width="3" height="2.5" rx="0.5" />
      <rect x="278.5" y="89" width="3" height="2.5" rx="0.5" />
      {/* A-frame support legs */}
      <line x1="264" y1="94" x2="270" y2="98" stroke="currentColor" strokeWidth="1.5" />
      <line x1="276" y1="94" x2="270" y2="98" stroke="currentColor" strokeWidth="1.5" />

      {/* ── Promenade II: ziggurat crown with metallic fins ── */}
      <rect x="292" y="34" width="14" height="64" />
      <rect x="294" y="30" width="10" height="4" />
      <rect x="296" y="26" width="6" height="4" />
      <polygon points="296,26 299,22 302,26" />
      {/* Fin lines along steps */}
      <line x1="294" y1="30" x2="296" y2="26" stroke="currentColor" strokeWidth="0.4" />
      <line x1="304" y1="30" x2="302" y2="26" stroke="currentColor" strokeWidth="0.4" />

      {/* ── Right cluster ── */}
      {/* Tower with antenna */}
      <rect x="312" y="44" width="12" height="54" />
      <rect x="317" y="36" width="2" height="8" />

      {/* Office with tiered crown */}
      <rect x="328" y="52" width="14" height="46" />
      <rect x="330" y="48" width="10" height="4" />
      <rect x="332" y="44" width="6" height="4" />

      {/* ── Mercedes-Benz Stadium: angular pinwheel roof ── */}
      <rect x="348" y="88" width="30" height="10" />
      <polygon points="348,88 354,82 360,86 363,78 366,86 372,82 378,88" />

      {/* Trailing low-rises */}
      <rect x="382" y="74" width="8" height="24" />
      <rect x="392" y="80" width="8" height="18" />

      {/* ── Street / ground plane ── */}
      <rect x="0" y="96" width="400" height="4" />
    </svg>
  );
}

export default function FeedSectionSkeleton({
  accentColor,
  minHeight = 360,
  minDisplayMs = 400,
  timeoutMs = 12000,
  onRetry,
}: FeedSectionSkeletonProps) {
  // Track whether the minimum display time has elapsed (controls readiness to
  // swap out). This state is consumed by the *parent* via the exported hook.
  const [, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const minTimer = setTimeout(() => setMinElapsed(true), minDisplayMs);
    const timeoutTimer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(timeoutTimer);
    };
  }, [minDisplayMs, timeoutMs]);

  const label = timedOut ? "Taking longer than usual..." : "Hold your horses";

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      style={{
        minHeight,
        border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)`,
        background: `
          radial-gradient(ellipse at 20% 30%, color-mix(in srgb, ${accentColor} 4%, transparent) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 60%, color-mix(in srgb, ${accentColor} 5%, transparent) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 90%, color-mix(in srgb, ${accentColor} 8%, transparent) 0%, transparent 40%),
          repeating-linear-gradient(0deg, transparent, transparent 30px, color-mix(in srgb, ${accentColor} 2%, transparent) 30px, color-mix(in srgb, ${accentColor} 2%, transparent) 31px),
          repeating-linear-gradient(90deg, transparent, transparent 30px, color-mix(in srgb, ${accentColor} 2%, transparent) 30px, color-mix(in srgb, ${accentColor} 2%, transparent) 31px)
        `,
      }}
      role="status"
    >
      {/* Shimmer content bars */}
      <div className="relative z-10 px-6 pt-6 space-y-3">
        <div className="h-3 rounded-full skeleton-shimmer" style={{ width: "75%", opacity: 0.25 }} />
        <div className="h-3 rounded-full skeleton-shimmer" style={{ width: "55%", opacity: 0.2 }} />
        <div className="h-2.5 rounded-full skeleton-shimmer" style={{ width: "65%", opacity: 0.15 }} />
        <div className="h-2.5 rounded-full skeleton-shimmer" style={{ width: "40%", opacity: 0.12 }} />
      </div>

      {/* Skyline — fills bottom 70% */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ top: "30%", color: accentColor, opacity: 0.12 }}
      >
        <AtlantaSkylineSVG />
      </div>

      {/* Label + horse — centered, z-20, above the skyline */}
      <div className="absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2">
        <span
          className="font-mono text-xs font-medium tracking-[0.25em] uppercase transition-all duration-500"
          style={{ color: accentColor, opacity: 0.8 }}
        >
          {label}
        </span>

        {/* Horse with glow backdrop */}
        <div className="relative">
          <div
            className="absolute -inset-x-6 -inset-y-3 rounded-full blur-2xl"
            style={{ background: accentColor, opacity: 0.3 }}
          />
          <HorseIcon
            className="relative w-16 h-16 animate-horse-gallop"
            style={{
              color: accentColor,
              filter: `drop-shadow(0 0 18px ${accentColor}) drop-shadow(0 0 8px ${accentColor})`,
            }}
          />
        </div>

        {/* Retry button — only shown after timeout */}
        {timedOut && onRetry && (
          <button
            onClick={onRetry}
            className="mt-1 px-4 py-1.5 rounded-lg font-mono text-xs font-medium transition-colors"
            style={{
              color: accentColor,
              border: `1px solid color-mix(in srgb, ${accentColor} 40%, transparent)`,
              background: `color-mix(in srgb, ${accentColor} 8%, transparent)`,
            }}
          >
            Retry
          </button>
        )}
      </div>

      <span className="sr-only">Loading...</span>
    </div>
  );
}

/**
 * Hook for parent components to enforce a minimum skeleton display time.
 *
 * Usage:
 *   const showSkeleton = useMinSkeletonDelay(isLoading, 400);
 *   return showSkeleton ? <FeedSectionSkeleton /> : <Content />;
 */
export function useMinSkeletonDelay(isLoading: boolean, minMs = 400): boolean {
  const [showSkeleton, setShowSkeleton] = useState(isLoading);
  const loadStartRef = useRef<number>(isLoading ? Date.now() : 0);

  useEffect(() => {
    if (isLoading) {
      // Loading started — record start time, show skeleton
      loadStartRef.current = Date.now();
      setShowSkeleton(true);
    } else if (loadStartRef.current > 0) {
      // Loading ended — wait for remaining minimum time before hiding
      const elapsed = Date.now() - loadStartRef.current;
      const remaining = minMs - elapsed;
      if (remaining <= 0) {
        setShowSkeleton(false);
      } else {
        const t = setTimeout(() => setShowSkeleton(false), remaining);
        return () => clearTimeout(t);
      }
    }
  }, [isLoading, minMs]);

  return showSkeleton;
}
