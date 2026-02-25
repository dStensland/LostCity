"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "@/components/SmartImage";
import { usePortal } from "@/lib/portal-context";
import type { ExploreTrack, ExploreTrackFeaturedEvent, PillType } from "@/lib/explore-tracks";
import {
  EXPLORE_THEME,
  PILL_COLORS,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_CATEGORY,
} from "@/lib/explore-tracks";
import ExploreTrackDetail from "./ExploreTrackDetail";

export default function ExploreTrackList() {
  const { portal } = usePortal();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tracks, setTracks] = useState<ExploreTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const trackParam = searchParams?.get("track") ?? null;
  const [selectedSlug, setSelectedSlug] = useState<string | null>(trackParam);
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapTracks = (json: any): ExploreTrack[] =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (json.tracks || []).map((t: any) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        quote: t.quote,
        quoteSource: t.quote_source,
        quotePortraitUrl: t.quote_portrait_url,
        description: t.description,
        bannerImageUrl: t.banner_image_url ?? null,
        sortOrder: t.sort_order,
        venueCount: t.venue_count ?? 0,
        tonightCount: t.tonight_count ?? 0,
        weekendCount: t.weekend_count ?? 0,
        freeCount: t.free_count ?? 0,
        featuredEvent: t.featured_event
          ? {
              title: t.featured_event.title,
              date: t.featured_event.date,
              time: t.featured_event.time,
              venueName: t.featured_event.venue_name,
              isFree: t.featured_event.is_free,
            }
          : null,
        accentColor: t.accent_color ?? DEFAULT_ACCENT_COLOR,
        category: t.category ?? DEFAULT_CATEGORY,
        groupName: t.group_name ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        previewVenues: (t.preview_venues || []).map((pv: any) => ({
          id: pv.venue?.id ?? 0,
          name: pv.venue?.name ?? "",
          slug: pv.venue?.slug ?? null,
          neighborhood: pv.venue?.neighborhood,
          imageUrl: pv.venue?.hero_image_url || pv.venue?.image_url,
          upvoteCount: pv.upvote_count ?? 0,
          upcomingEventCount: pv.upcoming_event_count ?? 0,
        })),
      }));

    const fetchTracks = async (attempt = 0): Promise<void> => {
      try {
        const res = await fetch("/api/explore/tracks");
        if (cancelled) return;
        if (res.ok) {
          const json = await res.json();
          if (cancelled) return;
          setTracks(mapTracks(json));
          setIsLoading(false);
        } else if (res.status >= 500 && attempt < 2) {
          // Server hiccup (503 etc) — wait and retry
          await new Promise((r) => setTimeout(r, 800));
          if (!cancelled) await fetchTracks(attempt + 1);
        } else {
          if (!cancelled) setIsLoading(false);
        }
      } catch {
        if (cancelled) return;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 800));
          if (!cancelled) await fetchTracks(attempt + 1);
        } else {
          setIsLoading(false);
        }
      }
    };

    fetchTracks();
    return () => { cancelled = true; };
  }, []);

  // Sync selectedSlug when URL track param changes (e.g. direct navigation)
  useEffect(() => {
    setSelectedSlug(trackParam);
  }, [trackParam]);

  // Browser back-nav: push URL with track param when entering a track detail
  const handleSelectTrack = useCallback((slug: string) => {
    scrollPositionRef.current = window.scrollY;
    setSelectedSlug(slug);
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("track", slug);
    router.push(`/${portal.slug}?${params.toString()}`, { scroll: false });
  }, [searchParams, portal.slug, router]);

  const handleBack = useCallback(() => {
    setSelectedSlug(null);
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.delete("track");
    router.push(`/${portal.slug}?${params.toString()}`, { scroll: false });
    const savedScroll = scrollPositionRef.current;
    requestAnimationFrame(() => window.scrollTo(0, savedScroll));
  }, [searchParams, portal.slug, router]);

  // Build groups from DB group_name — tracks arrive sorted by sort_order,
  // so group insertion order = order of first track in each group
  const trackGroups = useMemo(() => {
    const groupMap = new Map<string, ExploreTrack[]>();
    for (const track of tracks) {
      if (!track.groupName) continue;
      const list = groupMap.get(track.groupName) ?? [];
      list.push(track);
      groupMap.set(track.groupName, list);
    }
    return Array.from(groupMap.entries()).map(([label, groupTracks]) => ({
      label,
      tracks: groupTracks,
    }));
  }, [tracks]);

  // Deduplicate banner images across tracks so no two banners share the same photo
  const bannerImages = useMemo(() => deduplicateBannerImages(tracks), [tracks]);

  // Calculate total tonight count for header
  const totalTonightCount = useMemo(
    () => tracks.reduce((sum, t) => sum + t.tonightCount, 0),
    [tracks]
  );

  // Show track detail if one is selected
  if (selectedSlug) {
    const selectedTrack = tracks.find((t) => t.slug === selectedSlug);
    return (
      <div className="animate-page-enter">
        <ExploreTrackDetail
          slug={selectedSlug}
          onBack={handleBack}
          portalSlug={portal.slug}
          accentColor={selectedTrack?.accentColor}
          category={selectedTrack?.category}
        />
      </div>
    );
  }

  if (isLoading) {
    return <TrackListSkeleton />;
  }

  if (tracks.length === 0) {
    return (
      <div
        className="py-16 px-6 text-center rounded-2xl border"
        style={{
          background: "var(--void)",
          borderColor: "var(--twilight)",
        }}
      >
        <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
          No tracks available right now
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg font-medium text-sm transition-colors"
          style={{
            background: "var(--night)",
            color: "var(--cream)",
            border: "1px solid var(--twilight)",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{ background: "var(--void)" }}
    >
      <div
        className="pointer-events-none absolute -top-24 -left-20 w-72 h-72 rounded-full blur-3xl opacity-25"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--coral) 35%, transparent) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute top-40 -right-28 w-80 h-80 rounded-full blur-3xl opacity-20"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--neon-cyan) 30%, transparent) 0%, transparent 75%)" }}
      />

      {/* Header — editorial serif with accent bar */}
      <div className="px-5 md:px-7 pt-6 md:pt-8 pb-5 md:pb-6 relative">
        <div
          className="absolute left-0 top-6 md:top-8 w-[4px] h-9 md:h-11 rounded-r"
          style={{ background: EXPLORE_THEME.primary }}
        />

        <h2
          className="explore-display-heading text-[30px] md:text-[38px] tracking-[-0.03em] leading-[1.05] pl-4"
          style={{ color: "var(--cream)" }}
        >
          Explore Atlanta
        </h2>
        <p
          className="text-xs md:text-[13px] font-mono mt-1.5 pl-4"
          style={{ color: "var(--muted)" }}
        >
          {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
          {totalTonightCount > 0 && (
            <>
              {" "}&middot;{" "}
              <span style={{ color: EXPLORE_THEME.secondary }}>
                {totalTonightCount} {totalTonightCount === 1 ? "event" : "events"} tonight
              </span>
            </>
          )}
        </p>
        <p
          className="text-sm md:text-[15px] mt-3 pl-4 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Curated collections to help you explore Atlanta. Browse themed guides, neighborhood
          deep-dives, and hand-picked recommendations.
        </p>
      </div>

      {/* Grouped cinematic banners — groups derived from DB group_name */}
      <div className="px-4 lg:px-6 pb-5 lg:pb-7 space-y-8 lg:space-y-10">
        {trackGroups.map((group, groupIdx) => {
          // First group's first track gets hero treatment
          const isFirstGroup = groupIdx === 0;

          return (
            <div key={group.label}>
              <p
                className="font-mono text-[11px] md:text-xs font-bold uppercase tracking-[0.14em] mb-3.5 pl-1"
                style={{ color: "var(--muted)" }}
              >
                {group.label}
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-5">
                {group.tracks.map((track, index) => {
                  const isHero = isFirstGroup && index === 0;
                  const emphasis: "hero" | "feature" | "standard" = isHero
                    ? "hero"
                    : index === 0
                      ? "feature"
                      : "standard";
                  return (
                    <div
                      key={track.id}
                      className={`explore-track-enter ${emphasis !== "standard" ? "lg:col-span-2" : ""}`}
                      style={{ animationDelay: `${Math.min(index * 90, 450)}ms` }}
                    >
                      <TrackBanner
                        track={track}
                        bannerImage={track.bannerImageUrl || bannerImages.get(track.slug) || null}
                        onSelect={() => handleSelectTrack(track.slug)}
                        emphasis={emphasis}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Track Banner — Cinematic editorial card
// ============================================================================

function TrackBanner({
  track,
  bannerImage,
  onSelect,
  emphasis,
}: {
  track: ExploreTrack;
  bannerImage: string | null;
  onSelect: () => void;
  emphasis: "hero" | "feature" | "standard";
}) {
  const accent = track.accentColor;
  const category = track.category;
  const pills = buildActivityPills(track);
  const isHero = emphasis === "hero";
  const isFeature = emphasis === "feature";

  return (
    <button
      onClick={onSelect}
      className="explore-track-banner relative w-full rounded-[16px] text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cream)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] transition-[transform,box-shadow] duration-500 ease-out motion-safe:hover:-translate-y-1 motion-safe:hover:-rotate-[0.2deg]"
      style={{
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
      aria-label={`${track.name} — ${category}`}
    >
      {/* Background image — overflow-hidden clips image to rounded corners */}
      <div
        className={`relative overflow-hidden rounded-[16px] ${
          isHero
            ? "aspect-[2/1] lg:aspect-[2.4/1]"
            : isFeature
              ? "aspect-[2/1] lg:aspect-[2/1]"
              : "aspect-[2/1] lg:aspect-[1.5/1]"
        }`}
      >
        {bannerImage ? (
          <Image
            src={bannerImage}
            alt=""
            fill
            sizes={
              isHero
                ? "(max-width: 1024px) 100vw, 960px"
                : isFeature
                  ? "(max-width: 1024px) 100vw, 820px"
                  : "(max-width: 768px) 100vw, 600px"
            }
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-110 explore-banner-img"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg, var(--night) 0%, var(--void) 100%)",
            }}
          />
        )}
      </div>

      {/* Gradient overlay — OUTSIDE overflow-hidden so it backs text descenders fully */}
      <div className="absolute inset-0 rounded-[16px] z-[1] explore-banner-gradient" />

      {/* Hover glow — CSS-only to avoid JS style mutation */}
      <div
        className="absolute inset-0 rounded-[16px] z-[2] pointer-events-none opacity-0 transition-opacity duration-500 motion-safe:group-hover:opacity-100"
        style={{ boxShadow: `0 16px 40px ${accent}18, 0 8px 16px rgba(0,0,0,0.4)` }}
      />

      {/* Accent left border with glow */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[4px] md:w-[5px] z-[5]"
        style={{
          background: accent,
          borderRadius: "16px 0 0 16px",
          boxShadow: `0 0 16px ${accent}35, 0 0 6px ${accent}60`,
        }}
      />

      {(track.tonightCount > 0 || track.weekendCount > 0) && (
        <div className="absolute top-3 right-3 z-[5] flex items-center gap-1.5">
          {track.tonightCount > 0 ? (
            <span
              className="font-mono text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-[0.06em] inline-flex items-center gap-1"
              style={{
                background: "rgba(224,58,62,0.92)",
                color: "#fff",
                boxShadow: "0 0 14px rgba(224,58,62,0.35)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Live
            </span>
          ) : (
            <span
              className="font-mono text-[10px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(193,211,47,0.9)", color: "var(--void)" }}
            >
              Active this week
            </span>
          )}
        </div>
      )}

      {/* Content — positioned over gradient */}
      <div className="absolute bottom-0 left-0 right-0 p-[16px_20px] md:p-[24px_32px] z-[4]">
        {/* Category label — dark bg for readability */}
        <div
          className="explore-banner-text-sm font-mono text-[11px] md:text-xs font-bold uppercase tracking-[0.14em] mb-1.5 md:mb-2 inline-block px-2 py-[3px] rounded"
          style={{
            color: accent,
            background: "rgba(0,0,0,0.5)",
          }}
        >
          {category}
        </div>

        {/* Track name — Syne 800 has short descenders by design */}
        <h3
          className={`explore-banner-text explore-display-heading leading-[1.35] tracking-[-0.02em] mb-1 ${
            isHero
              ? "text-[26px] md:text-[42px]"
              : isFeature
                ? "text-[24px] md:text-[36px]"
                : "text-[22px] md:text-[30px]"
          }`}
          style={{ color: "var(--cream)" }}
        >
          {track.name}
        </h3>

        {/* Description */}
        {track.description && (
          <p
            className={`explore-banner-text-sm text-xs md:text-[15px] font-light leading-[1.55] md:leading-[1.65] ${
              isHero ? "md:max-w-[75%]" : isFeature ? "md:max-w-[78%]" : "md:max-w-[82%]"
            }`}
            style={{ color: "var(--cream)", opacity: 0.86 }}
          >
            {track.description}
          </p>
        )}

        {/* Quote — editorial identity */}
        {track.quote && !track.description && (
          <p
            className={`explore-banner-text-sm text-xs md:text-[14px] italic leading-[1.55] ${
              isHero ? "md:max-w-[75%]" : isFeature ? "md:max-w-[78%]" : "md:max-w-[82%]"
            }`}
            style={{ color: "var(--cream)", opacity: 0.78 }}
          >
            &ldquo;{track.quote}&rdquo;
            {track.quoteSource && (
              <span className="not-italic font-mono text-[11px] ml-1.5" style={{ color: accent }}>
                — {track.quoteSource}
              </span>
            )}
          </p>
        )}

        {/* Activity pills — inline row at bottom */}
        {pills.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2 md:mt-2.5">
            {pills.map((pill, i) => {
              const colors = PILL_COLORS[pill.type];
              return (
                <span
                  key={i}
                  className={`explore-pill font-mono text-[10px] md:text-[11px] font-medium px-2.5 md:px-3 py-[4px] md:py-[5px] rounded-full whitespace-nowrap inline-flex items-center gap-1 transition-shadow duration-200${
                    pill.type === "tonight" ? " explore-pill-tonight" : ""
                  }`}
                  style={{
                    color: colors.text,
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {pill.type === "tonight" && (
                    <span
                      className="inline-block w-[7px] h-[7px] rounded-full animate-pulse"
                      style={{ background: colors.text }}
                    />
                  )}
                  {pill.label}
                </span>
              );
            })}
          </div>
        )}
      </div>

    </button>
  );
}

// ============================================================================
// Activity pill builder
// ============================================================================

type ActivityPill = { label: string; type: PillType };

function buildActivityPills(track: ExploreTrack): ActivityPill[] {
  const pills: ActivityPill[] = [];

  // Tonight count — highest priority, most time-sensitive
  if (track.tonightCount > 0) {
    pills.push({
      label: `${track.tonightCount} tonight`,
      type: "tonight",
    });
  }

  // Featured event — specific and compelling
  if (track.featuredEvent && pills.length < 3) {
    const fe = track.featuredEvent;
    const label = formatFeaturedPill(fe);
    const today = new Date().toISOString().slice(0, 10);
    // Don't duplicate "tonight" signal
    if (fe.date === today && pills.some((p) => p.type === "tonight")) {
      // Skip — already showing tonight count
    } else {
      pills.push({ label, type: fe.date === today ? "tonight" : "weekend" });
    }
  }

  // Weekend count (if not today-heavy)
  if (track.weekendCount > 0 && track.tonightCount === 0 && pills.length < 3) {
    pills.push({
      label: `${track.weekendCount} this week`,
      type: "weekend",
    });
  }

  // Free events
  if (track.freeCount > 0 && pills.length < 3) {
    pills.push({
      label: track.freeCount === 1 ? "Free event" : `${track.freeCount} free`,
      type: "free",
    });
  }

  return pills;
}

function formatFeaturedPill(fe: ExploreTrackFeaturedEvent): string {
  let timeStr = "";
  if (fe.time) {
    const parts = fe.time.split(":");
    const h = parseInt(parts[0]);
    const m = parseInt(parts[1] ?? "0");
    const ampm = h >= 12 ? "pm" : "am";
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    timeStr = m > 0 ? ` ${h12}:${parts[1]}${ampm}` : ` ${h12}${ampm}`;
  }
  // Budget: keep total pill text under ~26 chars for readability
  const maxTitle = 26 - timeStr.length;
  let title = fe.title;
  if (title.length > maxTitle) {
    // Truncate at word boundary for cleaner pills
    const truncated = title.slice(0, maxTitle).replace(/[\s:,\-]+\S*$/, "");
    title = (truncated || title.slice(0, maxTitle - 1)).trimEnd() + "\u2026";
  }
  return title + timeStr;
}

// ============================================================================
// Image deduplication — ensures no two banners share the same photo
// ============================================================================

// Preferred banner venues per track — prioritize better-fitting images
const PREFERRED_BANNER_VENUES: Record<string, string[]> = {
  "welcome-to-atlanta": ["Georgia Aquarium", "Centennial Olympic Park"],
  "the-south-got-something-to-say": ["Trap Music Museum", "The Tabernacle", "Patchwerk Recording Studios", "Criminal Records"],
  "keep-moving-forward": ["Historic Fourth Ward Park", "Krog Street Market", "Ponce City Market"],
  "the-itis": ["Twisted Soul Cookhouse & Pours", "Sweet Auburn Curb Market"],
  "hard-in-da-paint": ["Atlanta Contemporary", "Krog Street Tunnel", "Pullman Yards"],
  "a-beautiful-mosaic": ["Buford Highway Farmers Market", "Blooms Emporium Chinatown"],
  "too-busy-to-hate": ["Mary's", "Blake's on the Park", "Lips Atlanta"],
  "the-midnight-train": ["MJQ Concourse", "Arabia Mountain", "The Oddities Museum", "Westview Cemetery", "Clermont Lounge"],
  "keep-swinging": ["Mercedes-Benz Stadium", "Bobby Dodd Stadium", "Atlanta Motor Speedway"],
  "lifes-like-a-movie": ["Center for Puppetry Arts", "LEGOLAND Discovery Center Atlanta", "Fernbank Museum of Natural History"],
  "say-less": ["Red Phone Booth", "JoJo's Beloved", "Himitsu"],
  "yallywood": ["Fox Theatre", "Plaza Theatre"],
  "spelhouse-spirit": ["Paschal's", "Hammonds House Museum", "Busy Bee Cafe"],
  "not-from-around-here": ["Buford Highway Farmers Market", "Antico Pizza Napoletana", "Chai Pani", "Desta Ethiopian Kitchen"],
  "as-seen-on-tv": ["Trilith Studios", "Atlanta Marriott Marquis", "Porsche Experience Center"],
  "comedy-live": ["The Punchline", "Dad's Garage Theatre", "Alliance Theatre"],
  "native-heritage": ["Etowah Indian Mounds", "Ocmulgee Mounds"],
  "hell-of-an-engineer": ["Bobby Dodd Stadium", "Tech Tower"],
  "resurgens": ["Bank of America Plaza", "One Atlantic Center"],
  "artefacts-of-the-lost-city": ["Willie B Statue", "Crypt of Civilization", "The Big Chicken"],
};

function deduplicateBannerImages(
  tracks: ExploreTrack[]
): Map<string, string | null> {
  const usedUrls = new Set<string>();
  const result = new Map<string, string | null>();

  for (const track of tracks) {
    let chosen: string | null = null;
    const preferred = PREFERRED_BANNER_VENUES[track.slug];

    // Try preferred venues first
    if (preferred) {
      for (const prefName of preferred) {
        const match = track.previewVenues.find(
          (v) =>
            v.name === prefName &&
            v.imageUrl &&
            !usedUrls.has(v.imageUrl) &&
            !v.imageUrl.endsWith(".svg")
        );
        if (match?.imageUrl) {
          chosen = match.imageUrl;
          break;
        }
      }
    }

    // Fallback: first unused image
    if (!chosen) {
      for (const v of track.previewVenues) {
        if (
          v.imageUrl &&
          !usedUrls.has(v.imageUrl) &&
          !v.imageUrl.endsWith(".svg")
        ) {
          chosen = v.imageUrl;
          break;
        }
      }
    }

    if (chosen) usedUrls.add(chosen);
    result.set(track.slug, chosen);
  }

  return result;
}

// ============================================================================
// Skeleton
// ============================================================================

function TrackListSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--void)" }}
    >
      {/* Header skeleton */}
      <div className="px-5 md:px-7 pt-6 md:pt-8 pb-4 md:pb-5 relative">
        <div
          className="absolute left-0 top-6 md:top-8 w-[4px] h-9 md:h-11 rounded-r explore-skeleton-text"
        />
        <div className="pl-4 space-y-2">
          <div className="h-9 w-52 rounded explore-skeleton-text" />
          <div className="h-3 w-64 rounded explore-skeleton-text" />
        </div>
      </div>

      {/* Banner skeletons — match real card layout exactly */}
      <div className="px-4 lg:px-6 pb-5 lg:pb-7">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`explore-track-enter ${i === 0 ? "lg:col-span-2" : ""}`}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div
                className={`rounded-[16px] overflow-hidden explore-skeleton-banner relative ${
                  i === 0
                    ? "aspect-[2/1] lg:aspect-[2.4/1]"
                    : "aspect-[2/1] lg:aspect-[1.5/1]"
                }`}
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
              >
                {/* Accent bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[4px] md:w-[5px] rounded-l-[16px] explore-skeleton-text opacity-30"
                />
                {/* Content — bottom left */}
                <div className="absolute bottom-0 left-0 right-0 p-[16px_20px] md:p-[24px_32px] space-y-2.5">
                  <div className="h-2.5 w-20 rounded explore-skeleton-text opacity-40" />
                  <div className={`rounded explore-skeleton-text opacity-50 ${i === 0 ? "h-10 md:h-12 w-2/5" : "h-8 md:h-10 w-3/5"}`} />
                  <div className="h-3 w-4/5 rounded explore-skeleton-text opacity-25" />
                  {/* Pills placeholder */}
                  <div className="flex gap-1.5 mt-1.5">
                    <div className="h-5 w-20 rounded-full explore-skeleton-text opacity-35" />
                    <div className="h-5 w-16 rounded-full explore-skeleton-text opacity-25" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
