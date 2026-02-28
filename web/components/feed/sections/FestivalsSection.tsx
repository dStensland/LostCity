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

type StandaloneTentpole = {
  id: number;
  title: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  category: string | null;
  image_url: string | null;
  description: string | null;
  source_id: number | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
};

type BigStuffItem = {
  id: string;
  kind: "festival" | "event";
  title: string;
  start: string | null;
  end: string | null;
  location: string | null;
  href: string;
  countdownText: string;
  urgencyColor: string;
};

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
  const [standaloneTentpoles, setStandaloneTentpoles] = useState<StandaloneTentpole[]>([]);
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
        setStandaloneTentpoles((data.standalone_tentpoles || []) as StandaloneTentpole[]);
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
  const displayItems = useMemo(() => {
    const festivalItems: BigStuffItem[] = festivals.flatMap((festival) => {
      const countdown = computeCountdown(festival, today);
      if (countdown.urgency === "tbd") return [];
      return [{
        id: `festival:${festival.id}`,
        kind: "festival",
        title: festival.name,
        start: festival.announced_start,
        end: festival.announced_end,
        location: festival.neighborhood || festival.location,
        href: festival.slug
          ? `/${portalSlug}/festivals/${festival.slug}`
          : `/${portalSlug}/festivals`,
        countdownText: countdown.text,
        urgencyColor: getUrgencyColor(countdown.urgency),
      }];
    });

    const tentpoleItems: BigStuffItem[] = standaloneTentpoles.flatMap((event) => {
      const pseudoFestival = {
        announced_start: event.start_date,
        announced_end: event.end_date,
      } as Festival;
      const countdown = computeCountdown(pseudoFestival, today);
      if (countdown.urgency === "tbd") return [];
      return [{
        id: `event:${event.id}`,
        kind: "event",
        title: event.title,
        start: event.start_date,
        end: event.end_date,
        location: event.venue?.name || event.venue?.neighborhood || null,
        href: `/${portalSlug}?event=${event.id}`,
        countdownText: countdown.text,
        urgencyColor: getUrgencyColor(countdown.urgency),
      }];
    });

    return [...festivalItems, ...tentpoleItems]
      .sort((a, b) => {
        const aStart = a.start || "9999-12-31";
        const bStart = b.start || "9999-12-31";
        if (aStart !== bStart) return aStart.localeCompare(bStart);
        return a.title.localeCompare(b.title);
      })
      .slice(0, 4);
  }, [festivals, standaloneTentpoles, today, portalSlug]);

  if (loading) {
    return (
      <section>
        <SectionHeader portalSlug={portalSlug} />
        <FestivalsSkeleton />
      </section>
    );
  }

  if (displayItems.length === 0) return null;

  return (
    <section>
      <SectionHeader portalSlug={portalSlug} />

      <div className="space-y-2.5">
        {displayItems.map((item) => {
          const dateStr = formatFestivalDates(item.start, item.end);

          return (
            <Link
              key={item.id}
              href={item.href}
              className="group flex items-center gap-3 rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)] p-3 transition-all hover:border-[var(--twilight)]/60 hover:bg-white/[0.02]"
            >
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[var(--cream)] line-clamp-1 group-hover:text-white transition-colors">
                  {item.title}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {dateStr && (
                    <span className="text-2xs text-[var(--muted)]">
                      {dateStr}
                    </span>
                  )}
                  {dateStr && item.location && (
                    <span className="text-[var(--muted)] text-2xs">
                      &middot;
                    </span>
                  )}
                  {item.location && (
                    <span className="text-2xs text-[var(--muted)] truncate">
                      {item.location}
                    </span>
                  )}
                </div>
              </div>

              {/* Countdown badge */}
              <span
                className="shrink-0 px-2 py-1 rounded-full text-2xs font-mono font-medium tracking-wide whitespace-nowrap"
                style={{
                  backgroundColor: `color-mix(in srgb, ${item.urgencyColor} 20%, transparent)`,
                  color: item.urgencyColor,
                }}
              >
                {item.countdownText}
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
        All Big Stuff <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
