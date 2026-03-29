"use client";

/**
 * BriefingSection — editorial briefing at the top of the feed.
 *
 * Renders in two states:
 * - Collapsed: Single horizontal row (~40px), shows day label + weather + event count
 * - Full: Multi-row layout with editorial prose, weather, and context pills
 *
 * Props:
 *   briefing: BriefingOutput from CityPulse pipeline
 *   eventCount: Optional event count for collapsed state
 */

import { memo, useMemo } from "react";
import Link from "next/link";
import type { BriefingOutput } from "@/lib/city-pulse/types";

interface BriefingSectionProps {
  briefing: BriefingOutput | undefined;
  eventCount?: number;
}

export const BriefingSection = memo(function BriefingSection({
  briefing,
  eventCount,
}: BriefingSectionProps) {
  // If no briefing or all data is missing, render nothing
  if (!briefing) {
    return null;
  }

  // Split prose into headline (first sentence) + supporting text
  const { headline, supportText } = useMemo(() => {
    const prose = briefing.prose || "";
    const firstSentenceMatch = prose.match(/^([^.!?]+[.!?])\s*(.*)/);

    if (firstSentenceMatch) {
      return {
        headline: firstSentenceMatch[1],
        supportText: firstSentenceMatch[2],
      };
    }

    return {
      headline: prose,
      supportText: "",
    };
  }, [briefing.prose]);

  // Collapsed state: single row with day + weather + count
  if (briefing.collapsed) {
    return (
      <section
        className="sticky top-0 z-[5] h-10 flex items-center gap-3 px-4 sm:px-6 py-2 bg-[var(--void)] border-b border-[var(--twilight)]/40"
        data-feed-anchor="briefing"
        data-index-label="The Briefing"
        data-block-id="briefing"
      >
        <span className="text-xs font-mono uppercase tracking-wider text-[var(--soft)]">
          {briefing.dayLabel}
        </span>

        {briefing.weatherBadge && (
          <span className="text-xs font-semibold text-[var(--neon-green)] bg-[var(--neon-green)]/10 px-2 py-1 rounded-md">
            {briefing.weatherBadge.temp} · {briefing.weatherBadge.condition}
          </span>
        )}

        {eventCount !== undefined && eventCount > 0 && (
          <span className="ml-auto text-xs text-[var(--muted)]">
            {eventCount} event{eventCount === 1 ? "" : "s"}
          </span>
        )}
      </section>
    );
  }

  // Full state: editorial + pills
  return (
    <section
      className="px-4 sm:px-6 py-4 sm:py-6 bg-[var(--void)] border-b border-[var(--twilight)]/40 space-y-4"
      data-feed-anchor="briefing"
      data-index-label="The Briefing"
      data-block-id="briefing"
    >
      {/* Day label + weather badge row */}
      <div className="flex items-center gap-2.5">
        <span className="text-2xs font-mono uppercase tracking-wider text-[var(--cream)]/60">
          {briefing.dayLabel}
        </span>

        {briefing.weatherBadge && (
          <span className="text-xs font-semibold text-[var(--neon-green)] bg-[var(--neon-green)]/10 px-2 py-1 rounded-md">
            {briefing.weatherBadge.temp}
          </span>
        )}
      </div>

      {/* Editorial prose: headline + supporting text */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--cream)] leading-snug">
          {headline}
        </h2>

        {supportText && (
          <p className="text-sm text-[var(--soft)] leading-relaxed">
            {supportText}
          </p>
        )}
      </div>

      {/* Context pills */}
      {briefing.pills && briefing.pills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {briefing.pills.map((pill) => {
            const accentColor = pill.accent || "var(--coral)";
            const pillStyle = {
              borderColor: accentColor,
              backgroundColor: `color-mix(in srgb, ${accentColor} 8%, transparent)`,
            } as React.CSSProperties;

            return (
              <Link
                key={pill.label}
                href={pill.href}
                className="inline-flex items-center px-3.5 py-1.5 rounded-full border font-mono text-xs font-medium transition-all hover:border-opacity-100 hover:bg-opacity-12"
                style={pillStyle}
                aria-label={pill.ariaLabel}
              >
                <span style={{ color: accentColor }}>
                  {pill.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
});

export type { BriefingSectionProps };
