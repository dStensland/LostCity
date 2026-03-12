"use client";

/**
 * WhatsHappeningSection — combined city overview that surfaces what's big
 * (festivals, tentpoles) alongside local news. Renders between the hero
 * and the Lineup to communicate "here's what's going on in Atlanta right now."
 *
 * Designed to eventually include cross-portal signals (civic, family,
 * adventure, sports) as those portals come online.
 *
 * Self-fetching: pulls from /api/festivals/upcoming + /api/portals/[slug]/network-feed.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Crown,
  Broadcast,
  ArrowRight,
  ArrowSquareOut,
  Lightning,
} from "@phosphor-icons/react";
import SmartImage from "@/components/SmartImage";
import Dot from "@/components/ui/Dot";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import type { Festival } from "@/lib/festivals";
import {
  computeCountdown,
  getUrgencyColor,
  formatFestivalDates,
} from "@/lib/moments-utils";
import type { NetworkPost } from "./NetworkFeedSection";
import { getCategoryColor, CATEGORY_ICONS } from "./NetworkFeedSection";

// ── Types ────────────────────────────────────────────────────────────

interface WhatsHappeningSectionProps {
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

// ── Helpers ──────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// ── Component ────────────────────────────────────────────────────────

export default function WhatsHappeningSection({
  portalSlug,
  portalId,
}: WhatsHappeningSectionProps) {
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [tentpoles, setTentpoles] = useState<StandaloneTentpole[]>([]);
  const [posts, setPosts] = useState<NetworkPost[]>([]);
  const [liveCounts, setLiveCounts] = useState<{ eventCount: number; spotCount: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch festivals + news + live counts in parallel
  useEffect(() => {
    const controller = new AbortController();
    let festDone = false;
    let newsDone = false;
    let liveDone = false;
    const checkDone = () => {
      if (festDone && newsDone && liveDone) setLoading(false);
    };

    fetch(`/api/festivals/upcoming?portal_id=${portalId}`, {
      signal: controller.signal,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((data) => {
        if (controller.signal.aborted) return;
        setFestivals((data.festivals || []) as Festival[]);
        setTentpoles((data.standalone_tentpoles || []) as StandaloneTentpole[]);
      })
      .catch(() => {})
      .finally(() => { festDone = true; checkDone(); });

    fetch(`/api/portals/${portalSlug}/network-feed?limit=3&category=culture`, {
      signal: controller.signal,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((data) => {
        if (controller.signal.aborted) return;
        setPosts((data.posts || []) as NetworkPost[]);
      })
      .catch(() => {})
      .finally(() => { newsDone = true; checkDone(); });

    fetch(`/api/portals/${portalSlug}/happening-now?countOnly=true`, {
      signal: controller.signal,
    })
      .then((res) => res.ok ? res.json() : Promise.reject(res))
      .then((data) => {
        if (controller.signal.aborted) return;
        setLiveCounts({ eventCount: data.eventCount || 0, spotCount: data.spotCount || 0 });
      })
      .catch(() => {})
      .finally(() => { liveDone = true; checkDone(); });

    return () => controller.abort();
  }, [portalId, portalSlug]);

  // Process festivals + tentpoles into display items
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const bigItems = useMemo(() => {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

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

    const festivalNorms = festivalItems.map((f) => normalize(f.title));
    const tentpoleItems: BigStuffItem[] = tentpoles.flatMap((event) => {
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
        return aStart.localeCompare(bStart);
      })
      .slice(0, 4);
  }, [festivals, tentpoles, today, portalSlug]);

  const totalLive = liveCounts ? liveCounts.eventCount + liveCounts.spotCount : 0;

  // Nothing to show? Don't render the section at all.
  if (!loading && bigItems.length === 0 && posts.length === 0 && totalLive === 0) return null;

  // Still loading? Show skeleton
  if (loading) return null; // LazySection handles minimum height

  return (
    <section>
      <FeedSectionHeader
        title="What's Happening"
        priority="primary"
        icon={<Crown weight="duotone" className="w-3.5 h-3.5" />}
        accentColor="var(--gold)"
      />

      {/* Live Now banner */}
      {totalLive > 0 && (
        <Link
          href={`/${portalSlug}/happening-now`}
          className="flex items-center gap-3 mt-3 px-3.5 py-2.5 rounded-card bg-[var(--neon-red)]/8 border border-[var(--neon-red)]/25 hover:bg-[var(--neon-red)]/14 transition-colors group"
        >
          <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-[var(--neon-red)]/15">
            <Lightning weight="fill" className="w-4 h-4 text-[var(--neon-red)]" />
            <span className="absolute inset-0 rounded-full bg-[var(--neon-red)]/30 animate-ping" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--cream)] group-hover:text-[var(--neon-red)] transition-colors">
              {liveCounts!.eventCount > 0 && (
                <span>{liveCounts!.eventCount} event{liveCounts!.eventCount !== 1 ? "s" : ""} live</span>
              )}
              {liveCounts!.eventCount > 0 && liveCounts!.spotCount > 0 && (
                <span className="text-[var(--muted)]"> · </span>
              )}
              {liveCounts!.spotCount > 0 && (
                <span>{liveCounts!.spotCount} spot{liveCounts!.spotCount !== 1 ? "s" : ""} open</span>
              )}
            </p>
            <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-wider">Happening right now</p>
          </div>
          <ArrowRight
            weight="bold"
            className="w-4 h-4 text-[var(--muted)] flex-shrink-0 group-hover:text-[var(--neon-red)] transition-colors"
          />
        </Link>
      )}

      {/* Festival / Tentpole cards */}
      {bigItems.length > 0 && (
        <div className="space-y-2 mt-3">
          {bigItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 rounded-card p-3 bg-[var(--night)] border border-[var(--twilight)]/40 hover-lift transition-all group"
            >
              {/* Thumbnail */}
              <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--dusk)]">
                {item.imageUrl ? (
                  <SmartImage
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Crown weight="duotone" className="w-5 h-5 text-[var(--muted)]" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {/* Urgency badge */}
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="inline-flex items-center gap-1 font-mono text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{
                      color: item.urgencyColor,
                      backgroundColor: `${item.urgencyColor}18`,
                    }}
                  >
                    {item.countdownText === "Live" && (
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ backgroundColor: item.urgencyColor }}
                      />
                    )}
                    {item.countdownText}
                  </span>
                </div>
                <p className="text-base font-semibold text-[var(--cream)] truncate group-hover:text-[var(--gold)] transition-colors">
                  {item.title}
                </p>
                {item.location && (
                  <p className="text-xs text-[var(--muted)] truncate">
                    {item.location}
                    {item.start && (
                      <>
                        <Dot />
                        {formatFestivalDates(item.start, item.end)}
                      </>
                    )}
                  </p>
                )}
              </div>

              <ArrowRight
                weight="bold"
                className="w-4 h-4 text-[var(--muted)] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </Link>
          ))}
        </div>
      )}

      {/* Local News — compact headlines */}
      {posts.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Broadcast weight="duotone" className="w-3.5 h-3.5 text-[var(--neon-cyan)]" />
            <span className="font-mono text-2xs font-bold uppercase tracking-wider text-[var(--neon-cyan)]">
              Local News
            </span>
          </div>
          <div className="space-y-1">
            {posts.map((post) => {
              const catColor = getCategoryColor(post.categories || post.source.categories);
              const CatIcon = CATEGORY_ICONS[
                (post.categories?.[0] || post.source.categories?.[0] || "news")
              ] || CATEGORY_ICONS.news;
              return (
                <a
                  key={post.id}
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2.5 py-2 px-2 -mx-2 rounded-lg hover:bg-[var(--night)] transition-colors group"
                >
                  <CatIcon
                    weight="duotone"
                    className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                    style={{ color: catColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--cream)] leading-snug line-clamp-2 group-hover:text-[var(--neon-cyan)] transition-colors">
                      {post.title}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      {post.source.name}
                      <Dot />
                      {timeAgo(post.published_at)}
                    </p>
                  </div>
                  <ArrowSquareOut
                    weight="bold"
                    className="w-3.5 h-3.5 text-[var(--muted)] flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity"
                  />
                </a>
              );
            })}
          </div>
          <Link
            href={`/${portalSlug}/network`}
            className="flex items-center gap-1 mt-2 text-xs font-mono text-[var(--neon-cyan)] hover:opacity-80 transition-opacity"
          >
            More local news
            <ArrowRight weight="bold" className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Future: Cross-portal signals
          e.g. "5 new volunteer opportunities" (Citizen),
               "Spring break camps posted" (Family),
               "Trail conditions: perfect" (Adventure)
      */}
    </section>
  );
}
