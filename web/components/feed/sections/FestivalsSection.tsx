"use client";

/**
 * FestivalsSection — compact horizontal reminder rail of upcoming festivals.
 *
 * Intentionally low-profile: users should glance and move on, not linger.
 * Cards are 220px wide with a fixed-height image — no 16:9 hero treatment.
 *
 * Fetches from /api/festivals/upcoming, computes countdown urgency via
 * moments-utils, and hides entirely when no upcoming festivals exist.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Crown } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import FeedSectionSkeleton from "@/components/feed/FeedSectionSkeleton";
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
  imageUrl: string | null;
  href: string;
  countdownText: string;
  urgencyColor: string;
};

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
        imageUrl: festival.image_url,
        href: festival.slug
          ? `/${portalSlug}/festivals/${festival.slug}`
          : `/${portalSlug}/festivals`,
        countdownText: countdown.text,
        urgencyColor: getUrgencyColor(countdown.urgency),
      }];
    });

    // Build normalized festival name set for dedup against tentpoles
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const festivalNorms = festivalItems.map((f) => normalize(f.title));

    const tentpoleItems: BigStuffItem[] = standaloneTentpoles.flatMap((event) => {
      // Skip tentpoles that duplicate a festival already in the list
      const normTitle = normalize(event.title);
      if (festivalNorms.some((fn) => fn.includes(normTitle) || normTitle.includes(fn))) {
        return [];
      }

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
        imageUrl: event.image_url,
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
        <FeedSectionSkeleton accentColor="var(--gold)" minHeight={160} />
      </section>
    );
  }

  if (displayItems.length === 0) return null;

  return (
    <section className="pb-2 feed-section-enter">
      <SectionHeader portalSlug={portalSlug} />

      {/* Horizontal snap-scroll rail — no grid, no hero treatment */}
      <div className="flex flex-row gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {displayItems.map((item) => {
          const dateStr = formatFestivalDates(item.start, item.end);

          return (
            <Link
              key={item.id}
              href={item.href}
              className="group flex-shrink-0 w-[220px] snap-start rounded-card overflow-hidden border border-[var(--twilight)]/40 bg-[var(--night)] transition-all duration-200 hover:border-[var(--twilight)]/70 hover:-translate-y-0.5 hover:shadow-card-sm"
            >
              {/* Image — fixed height, blurred fill + sharp contain */}
              <div className="relative h-[116px] overflow-hidden bg-[var(--dusk)]">
                {item.imageUrl ? (
                  <>
                    {/* Blurred background fill — covers letterbox areas */}
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-35"
                      loading="lazy"
                      aria-hidden="true"
                    />
                    {/* Sharp contained image — full image visible, no crop */}
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="absolute inset-0 w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--gold)]/10 to-[var(--void)]">
                    <Crown weight="duotone" className="w-8 h-8 text-[var(--gold)]/30" />
                  </div>
                )}
                {/* Countdown badge — top right, solid surface, no blur */}
                <span
                  className="absolute top-2 right-2 inline-flex px-1.5 py-0.5 rounded text-2xs font-mono font-semibold tracking-wide whitespace-nowrap"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${item.urgencyColor} 18%, var(--night))`,
                    color: item.urgencyColor,
                    border: `1px solid color-mix(in srgb, ${item.urgencyColor} 40%, transparent)`,
                  }}
                >
                  {item.countdownText}
                </span>
              </div>

              {/* Content below image — title + date only, 1 line each */}
              <div className="px-2.5 py-2">
                <h3 className="text-sm font-semibold text-[var(--cream)] line-clamp-1 group-hover:text-white transition-colors leading-snug">
                  {item.title}
                </h3>
                {dateStr && (
                  <p className="text-xs text-[var(--muted)] mt-0.5 truncate leading-tight">
                    {dateStr}
                  </p>
                )}
              </div>
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
    <FeedSectionHeader
      title="The Big Stuff"
      priority="secondary"
      accentColor="var(--gold)"
      icon={<Crown weight="duotone" className="w-5 h-5" />}
      seeAllHref={`/${portalSlug}/festivals`}
    />
  );
}
