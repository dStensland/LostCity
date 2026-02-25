"use client";

/**
 * FestivalsSection — compact rail of upcoming festivals with urgency-colored
 * countdown badges for the City Pulse dashboard.
 *
 * Fetches from /api/festivals/upcoming, computes countdown urgency via
 * moments-utils, and hides entirely when no upcoming festivals exist.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Star, ArrowRight } from "@phosphor-icons/react";
import type { Festival } from "@/lib/festivals";
import {
  computeCountdown,
  getUrgencyColor,
  formatFestivalDates,
} from "@/lib/moments-utils";

interface FestivalsSectionProps {
  portalSlug: string;
  portalId: string;
}

// ── Skeleton ─────────────────────────────────────────────────────────

function FestivalsSkeleton() {
  return (
    <div className="space-y-2.5 animate-pulse">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)] p-3 flex items-center gap-3"
        >
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-white/[0.08]" />
            <div className="h-3 w-24 rounded bg-white/[0.05]" />
          </div>
          <div className="h-6 w-20 rounded-full bg-white/[0.06] shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────

export default function FestivalsSection({ portalSlug, portalId }: FestivalsSectionProps) {
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/festivals/upcoming?portal_id=${portalId}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setFestivals((data.festivals || []) as Festival[]);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [portalId]);

  // Filter out TBD festivals, compute countdowns, limit to top 4
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const displayFestivals = useMemo(
    () =>
      festivals
        .map((f) => ({ festival: f, countdown: computeCountdown(f, today) }))
        .filter((item) => item.countdown.urgency !== "tbd")
        .slice(0, 4),
    [festivals, today]
  );

  if (loading) {
    return (
      <section>
        <SectionHeader portalSlug={portalSlug} />
        <FestivalsSkeleton />
      </section>
    );
  }

  if (displayFestivals.length === 0) return null;

  return (
    <section>
      <SectionHeader portalSlug={portalSlug} />

      <div className="space-y-2.5">
        {displayFestivals.map(({ festival, countdown }) => {
          const urgencyColor = getUrgencyColor(countdown.urgency);
          const dateStr = formatFestivalDates(
            festival.announced_start,
            festival.announced_end
          );
          const href = festival.slug
            ? `/${portalSlug}/festivals/${festival.slug}`
            : `/${portalSlug}/festivals`;

          return (
            <Link
              key={festival.id}
              href={href}
              className="group flex items-center gap-3 rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)] p-3 transition-all hover:border-[var(--twilight)]/60 hover:bg-white/[0.02]"
            >
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[var(--cream)] line-clamp-1 group-hover:text-white transition-colors">
                  {festival.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {dateStr && (
                    <span className="text-2xs text-[var(--muted)]">
                      {dateStr}
                    </span>
                  )}
                  {dateStr && (festival.location || festival.neighborhood) && (
                    <span className="text-[var(--muted)] text-2xs">
                      &middot;
                    </span>
                  )}
                  {(festival.location || festival.neighborhood) && (
                    <span className="text-2xs text-[var(--muted)] truncate">
                      {festival.neighborhood || festival.location}
                    </span>
                  )}
                </div>
              </div>

              {/* Countdown badge */}
              <span
                className="shrink-0 px-2 py-1 rounded-full text-2xs font-mono font-medium tracking-wide whitespace-nowrap"
                style={{
                  backgroundColor: `color-mix(in srgb, ${urgencyColor} 20%, transparent)`,
                  color: urgencyColor,
                }}
              >
                {countdown.text}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function SectionHeader({ portalSlug }: { portalSlug: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Star weight="bold" className="w-3.5 h-3.5 text-[var(--gold)]" />
        <h2 className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--gold)]">
          The Big Stuff
        </h2>
      </div>
      <Link
        href={`/${portalSlug}/festivals`}
        className="text-xs flex items-center gap-1 text-[var(--gold)] transition-colors hover:opacity-80"
      >
        All Festivals <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
