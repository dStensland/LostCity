"use client";

import { memo } from "react";
import Link from "next/link";
import { SCHOOL_SYSTEM_LABELS, type SchoolSystem } from "@/lib/types/programs";

// Spring break 2026: April 6–10 (APS, DeKalb, Cobb, Gwinnett share this window)
const SPRING_BREAK_START = new Date("2026-04-06T00:00:00");
const SPRING_BREAK_END = new Date("2026-04-10T23:59:59");
const SHOW_WITHIN_DAYS = 21;

const AMBER = "#C48B1D";
const SAGE = "#5E7A5E";

interface SpringBreakBannerProps {
  portalSlug: string;
  schoolSystem?: SchoolSystem | null;
}

function getDaysUntil(target: Date): number {
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export const SpringBreakBanner = memo(function SpringBreakBanner({
  portalSlug,
  schoolSystem,
}: SpringBreakBannerProps) {
  const now = new Date();
  const daysUntilStart = getDaysUntil(SPRING_BREAK_START);
  const isOngoing = now >= SPRING_BREAK_START && now <= SPRING_BREAK_END;
  const isUpcoming = daysUntilStart > 0 && daysUntilStart <= SHOW_WITHIN_DAYS;

  if (!isOngoing && !isUpcoming) {
    return null;
  }

  const systemName = schoolSystem ? SCHOOL_SYSTEM_LABELS[schoolSystem] : null;

  const startLabel = SPRING_BREAK_START.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const endLabel = SPRING_BREAK_END.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  const headlineText = isOngoing
    ? "Spring Break is here!"
    : daysUntilStart === 1
    ? "Spring Break starts tomorrow"
    : `Spring Break in ${daysUntilStart} days`;

  const subText = isOngoing
    ? `${startLabel} – ${endLabel}${systemName ? ` · ${systemName}` : ""}`
    : `${startLabel} – ${endLabel}${systemName ? ` · ${systemName}` : ""}`;

  const dateFrom = SPRING_BREAK_START.toISOString().slice(0, 10);
  const dateTo = SPRING_BREAK_END.toISOString().slice(0, 10);
  const filterHref = `/${portalSlug}?view=find&date_from=${dateFrom}&date_to=${dateTo}&categories=family,community,fitness`;

  return (
    <div
      className="rounded-2xl border p-4 sm:p-5"
      style={{
        background: `linear-gradient(135deg, ${AMBER}18 0%, ${AMBER}08 100%)`,
        borderColor: `${AMBER}40`,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Countdown pill or sun icon */}
        <div
          className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl"
          style={{ backgroundColor: `${AMBER}20`, border: `1px solid ${AMBER}35` }}
          aria-hidden="true"
        >
          {isOngoing ? "🌞" : (
            <span className="flex flex-col items-center leading-none" aria-hidden="true">
              <span className="text-2xs font-bold uppercase tracking-wider" style={{ color: AMBER }}>APR</span>
              <span className="text-lg font-bold" style={{ color: AMBER }}>{SPRING_BREAK_START.getDate()}</span>
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="text-base font-bold leading-snug"
            style={{ color: AMBER, fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)" }}
          >
            {headlineText}
          </p>
          <p
            className="text-xs mt-0.5"
            style={{ color: "#756E63" }}
          >
            {subText}
          </p>

          <Link
            href={filterHref}
            className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: SAGE,
              color: "#fff",
              fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)",
            }}
          >
            Find Spring Break Activities
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
});

export type { SpringBreakBannerProps };
