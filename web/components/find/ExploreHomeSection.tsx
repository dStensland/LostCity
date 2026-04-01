"use client";

import { memo } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import type { LaneSlug, LanePreview } from "@/lib/types/explore-home";

// ---------------------------------------------------------------------------
// Lane metadata
// ---------------------------------------------------------------------------

const LANE_META: Record<
  LaneSlug,
  { label: string; accent: string; href: string; zeroCta: string }
> = {
  events: {
    label: "EVENTS",
    accent: "#FF6B7A",
    href: "?view=find&lane=events",
    zeroCta: "",
  },
  "now-showing": {
    label: "NOW SHOWING",
    accent: "#FF6B7A",
    href: "?view=find&lane=now-showing&vertical=film",
    zeroCta: "",
  },
  "live-music": {
    label: "LIVE MUSIC",
    accent: "#A78BFA",
    href: "?view=find&lane=live-music&vertical=music",
    zeroCta: "",
  },
  stage: {
    label: "STAGE & COMEDY",
    accent: "#E855A0",
    href: "?view=find&lane=stage&vertical=stage",
    zeroCta: "",
  },
  regulars: {
    label: "REGULARS",
    accent: "#FFD93D",
    href: "?view=find&lane=regulars",
    zeroCta: "",
  },
  places: {
    label: "PLACES",
    accent: "#00D9A0",
    href: "?view=find&lane=places",
    zeroCta: "",
  },
  classes: {
    label: "CLASSES & WORKSHOPS",
    accent: "#C9874F",
    href: "?view=find&lane=classes",
    zeroCta: "Coming soon — know a great class?",
  },
  calendar: {
    label: "CALENDAR",
    accent: "#FFD93D",
    href: "?view=find&lane=calendar",
    zeroCta: "",
  },
  map: {
    label: "MAP",
    accent: "#00D4E8",
    href: "?view=find&lane=map",
    zeroCta: "",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a mono-uppercase label like "LIVE MUSIC" to title case "Live Music". */
function toTitleCase(label: string): string {
  return label
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface LivenessBadgeProps {
  countToday: number | null;
  countWeekend: number | null;
  count: number;
  accent: string;
}

function LivenessBadge({
  countToday,
  countWeekend,
  count,
  accent,
}: LivenessBadgeProps) {
  let text: string;
  let showPulse: boolean;

  if (countToday && countToday > 0) {
    text = `TONIGHT · ${countToday}`;
    showPulse = true;
  } else if (countWeekend && countWeekend > 0) {
    text = `THIS WEEKEND · ${countWeekend}`;
    showPulse = false;
  } else {
    text = String(count);
    showPulse = false;
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-2xs font-bold tracking-wider"
      style={{
        backgroundColor: `${accent}1A`,
        color: accent,
      }}
    >
      {showPulse && (
        <span
          className="relative flex h-1.5 w-1.5 shrink-0"
          aria-hidden
        >
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ backgroundColor: accent }}
          />
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: accent }}
          />
        </span>
      )}
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ExploreHomeSectionProps {
  laneSlug: LaneSlug;
  preview: LanePreview;
  portalSlug: string;
}

export const ExploreHomeSection = memo(function ExploreHomeSection({
  laneSlug,
  preview,
  portalSlug,
}: ExploreHomeSectionProps) {
  const meta = LANE_META[laneSlug];
  const { label, accent, zeroCta } = meta;
  // Prefix the href with the portal base path
  const laneHref = `/${portalSlug}${meta.href}`;
  const { state, count, count_today, count_weekend, copy, items } = preview;

  // Footer link text
  let footerText: string;
  if (state === "alive") {
    footerText = `Explore ${toTitleCase(label)} →`;
  } else if (state === "quiet") {
    footerText = "Browse →";
  } else if (zeroCta) {
    footerText = "Tell us →";
  } else {
    footerText = "Coming soon";
  }

  return (
    <div className="rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 p-4 sm:p-5 flex flex-col gap-3">
      {/* Header */}
      <header className="flex items-center justify-between gap-2">
        <Link
          href={laneHref}
          className="mono-label hover:opacity-80 transition-opacity"
          style={{ color: state === "alive" ? accent : "var(--soft)" }}
        >
          {label}
        </Link>

        {state === "alive" && (
          <LivenessBadge
            countToday={count_today}
            countWeekend={count_weekend}
            count={count}
            accent={accent}
          />
        )}
      </header>

      {/* Body */}
      {state === "alive" && items.length > 0 && (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.detail_url}
              className="shrink-0 w-[140px] sm:w-[160px] flex flex-col gap-1.5 hover:opacity-90 transition-opacity"
            >
              {/* Image */}
              <div className="relative aspect-[16/10] rounded-lg bg-[var(--dusk)] overflow-hidden">
                {item.image_url && (
                  <SmartImage
                    src={item.image_url}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="160px"
                  />
                )}
              </div>

              {/* Title */}
              <p className="text-sm font-semibold text-[var(--cream)] truncate leading-tight">
                {item.title}
              </p>

              {/* Subtitle + metadata */}
              <p className="text-xs text-[var(--muted)] truncate leading-tight">
                {item.subtitle}
                {item.subtitle && item.metadata ? " · " : ""}
                {item.metadata}
              </p>
            </Link>
          ))}
        </div>
      )}

      {state === "quiet" && (
        <p className="text-sm text-[var(--soft)]">{copy}</p>
      )}

      {state === "zero" && zeroCta && (
        <p className="text-sm text-[var(--soft)]">{zeroCta}</p>
      )}

      {/* Footer */}
      <footer className="flex justify-end">
        {footerText === "Coming soon" ? (
          <span className="text-xs text-[var(--muted)]">{footerText}</span>
        ) : (
          <Link
            href={laneHref}
            className="text-xs hover:opacity-80 transition-opacity"
            style={{ color: accent }}
          >
            {footerText}
          </Link>
        )}
      </footer>
    </div>
  );
});
