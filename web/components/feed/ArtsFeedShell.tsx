"use client";

import { useEffect, useState, useCallback } from "react";
import FeedSectionHeader from "./FeedSectionHeader";
import LazySection from "./LazySection";
import ExhibitionCard from "./ExhibitionCard";
import CompactEventRow from "./CompactEventRow";
import { ArtsSecondaryNav } from "@/components/arts/ArtsSecondaryNav";
import { usePortal } from "@/lib/portal-context";
import type { FeedEventData } from "@/components/EventCard";

interface ArtsFeedShellProps {
  portalSlug: string;
}

// Shape returned by the exhibitions table via the arts-feed API
interface ApiExhibition {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  opening_date: string | null;
  closing_date: string | null;
  exhibition_type: string | null;
  admission_type: string | null;
  source_url: string | null;
  tags: string[] | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
    slug: string | null;
    image_url: string | null;
    blurhash: string | null;
  } | null;
}

interface ArtsFeedData {
  openingThisWeek: FeedEventData[];
  closingSoon: FeedEventData[];
  eventsThisWeek: FeedEventData[];
  classes: FeedEventData[];
}

const CLASS_TAGS = ["class", "workshop", "ceramics", "pottery", "printmaking", "painting-class"];

function isClass(e: FeedEventData): boolean {
  return (
    e.tags?.some((t: string) => CLASS_TAGS.includes(t)) === true ||
    (e.title?.toLowerCase().includes("class") ?? false) ||
    (e.title?.toLowerCase().includes("workshop") ?? false)
  );
}

/**
 * Map an exhibitions-table row to FeedEventData so ExhibitionCard can render it.
 * opening_date → start_date, closing_date → end_date.
 * is_free derived from admission_type.
 */
function exhibitionToFeedEvent(ex: ApiExhibition): FeedEventData {
  return {
    id: ex.id as unknown as number, // ExhibitionCard only uses id as a key
    title: ex.title,
    start_date: ex.opening_date ?? "",
    end_date: ex.closing_date ?? null,
    start_time: null,
    end_time: null,
    is_all_day: true,
    is_free: ex.admission_type === "free",
    price_min: null,
    price_max: null,
    image_url: ex.image_url,
    blurhash: null,
    description: ex.description,
    tags: ex.tags ?? null,
    ticket_url: ex.source_url ?? null,
    source_url: ex.source_url ?? null,
    category: "art",
    venue: ex.venue
      ? {
          id: ex.venue.id,
          name: ex.venue.name,
          neighborhood: ex.venue.neighborhood,
          slug: ex.venue.slug ?? "",
          image_url: ex.venue.image_url,
          blurhash: ex.venue.blurhash,
        }
      : null,
    going_count: 0,
    interested_count: 0,
  };
}

/**
 * ArtsFeedShell — bespoke feed for the Arts vertical.
 *
 * Sections:
 *  1. Fresh on the Walls — exhibitions opening this week (ExhibitionCard)
 *  2. Don't Sleep on These — exhibitions closing soon (ExhibitionCard + urgency)
 *  3. Happening This Week — openings, artist talks, performances (grid)
 *  4. Classes + Workshops — ceramics, printmaking, painting (grid)
 *
 * Uses the portal feed API. Exhibitions come from the exhibitions table
 * directly; events come from the events table (no tag-based heuristics).
 */
export default function ArtsFeedShell({ portalSlug }: ArtsFeedShellProps) {
  const { portal } = usePortal();
  const [feedData, setFeedData] = useState<ArtsFeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/portals/${portalSlug}/arts-feed`);
      if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
      const json = await res.json();

      const events: FeedEventData[] = json.events ?? [];
      const rawExhibitions: ApiExhibition[] = json.exhibitions ?? [];

      // Map exhibitions to FeedEventData for ExhibitionCard
      const exhibitionFeedItems = rawExhibitions.map(exhibitionToFeedEvent);

      const classes = events.filter(isClass);
      const otherEvents = events.filter((e) => !isClass(e));

      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const weekOutStr = weekOut.toISOString().split("T")[0];
      const twoWeeksOutStr = twoWeeksOut.toISOString().split("T")[0];

      // "Fresh on the Walls" — opening within next 7 days (opening_date between today and weekOut)
      const openingThisWeek = exhibitionFeedItems
        .filter((e) => {
          if (!e.start_date) return false;
          return e.start_date >= today && e.start_date <= weekOutStr;
        })
        .slice(0, 6);

      // "Don't Sleep on These" — closing within next 14 days
      const closingSoon = exhibitionFeedItems
        .filter((e) => {
          if (!e.end_date) return false;
          return e.end_date >= today && e.end_date <= twoWeeksOutStr;
        })
        .slice(0, 6);

      const eventsThisWeek = otherEvents
        .filter((e) => {
          const start = new Date(e.start_date);
          return start >= now && start <= weekOut;
        })
        .slice(0, 8);

      setFeedData({
        openingThisWeek,
        closingSoon,
        eventsThisWeek,
        classes: classes.slice(0, 6),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, [portalSlug]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const accentCopper = portal.branding?.primary_color ?? "#D4944C";
  const accentYellow = portal.branding?.secondary_color ?? "#E8B931";
  const accentPink = portal.branding?.accent_color ?? "#D4567A";

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        <ArtsSkeleton accentColor={accentCopper} />
        <ArtsSkeleton accentColor={accentPink} />
        <ArtsSkeleton accentColor={accentYellow} />
      </div>
    );
  }

  if (error || !feedData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-[var(--muted)] font-mono text-sm">
          {error ?? "Nothing on the walls right now. Check back soon."}
        </p>
      </div>
    );
  }

  const isEmpty =
    feedData.openingThisWeek.length === 0 &&
    feedData.closingSoon.length === 0 &&
    feedData.eventsThisWeek.length === 0 &&
    feedData.classes.length === 0;

  return (
    <>
      {/* Secondary nav — sticky below portal header, desktop only */}
      <ArtsSecondaryNav portalSlug={portalSlug} />

      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-10 sm:space-y-14">
      {/* Section 1: Fresh on the Walls — exhibition cards, stacked */}
      {feedData.openingThisWeek.length > 0 && (
        <section>
          <FeedSectionHeader
            title="fresh on the walls"
            priority="secondary"
            accentColor={accentCopper}
            seeAllHref={`/${portalSlug}/exhibitions`}
            seeAllLabel="all exhibitions"
          />
          <div className="space-y-2">
            {feedData.openingThisWeek.map((event) => (
              <ExhibitionCard
                key={event.id}
                event={event}
                portalSlug={portalSlug}
                accentColor={accentCopper}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section 2: Don't Sleep on These — closing soon, with urgency badges */}
      {feedData.closingSoon.length > 0 && (
        <LazySection>
          <FeedSectionHeader
            title="don't sleep on these"
            subtitle="closing soon"
            priority="secondary"
            accentColor={accentPink}
            seeAllHref={`/${portalSlug}?view=happening&category=art&sort=ending_soon`}
            seeAllLabel="all closing soon"
          />
          <div className="space-y-2">
            {feedData.closingSoon.map((event) => (
              <ExhibitionCard
                key={event.id}
                event={event}
                portalSlug={portalSlug}
                showUrgency
                accentColor={accentPink}
              />
            ))}
          </div>
        </LazySection>
      )}

      {/* Section 3: Happening This Week — events grid */}
      {feedData.eventsThisWeek.length > 0 && (
        <LazySection>
          <FeedSectionHeader
            title="happening this week"
            priority="secondary"
            accentColor={accentYellow}
            seeAllHref={`/${portalSlug}?view=happening&date=this_week`}
            seeAllLabel="full calendar"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {feedData.eventsThisWeek.map((event) => (
              <CompactEventRow
                key={event.id}
                event={event}
                portalSlug={portalSlug}
                size="sm"
              />
            ))}
          </div>
        </LazySection>
      )}

      {/* Section 4: Classes + Workshops — events grid */}
      {feedData.classes.length > 0 && (
        <LazySection>
          <FeedSectionHeader
            title="classes + workshops"
            subtitle="learn from local artists"
            priority="secondary"
            accentColor={accentCopper}
            seeAllHref={`/${portalSlug}?view=happening&tags=class,workshop`}
            seeAllLabel="all classes"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {feedData.classes.map((event) => (
              <CompactEventRow
                key={event.id}
                event={event}
                portalSlug={portalSlug}
                size="sm"
              />
            ))}
          </div>
        </LazySection>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="py-20 text-center">
          <p className="font-mono text-sm text-[var(--muted)]">
            Nothing on the walls right now. Check back soon.
          </p>
        </div>
      )}
    </div>
    </>
  );
}

/**
 * Arts-specific skeleton — minimal, no Atlanta skyline.
 * Thin shimmer bars on a dark surface with accent-tinted border.
 */
function ArtsSkeleton({ accentColor }: { accentColor: string }) {
  return (
    <div
      className="relative overflow-hidden py-8 px-6"
      style={{
        minHeight: 180,
        borderLeft: `2px solid ${accentColor}`,
      }}
      role="status"
    >
      <div className="space-y-3">
        <div
          className="h-2.5 skeleton-shimmer"
          style={{ width: "40%", opacity: 0.3 }}
        />
        <div className="space-y-2 mt-6">
          <div className="h-16 skeleton-shimmer" style={{ width: "100%", opacity: 0.1 }} />
          <div className="h-16 skeleton-shimmer" style={{ width: "100%", opacity: 0.08 }} />
          <div className="h-16 skeleton-shimmer" style={{ width: "80%", opacity: 0.06 }} />
        </div>
      </div>
      <span className="sr-only">Loading exhibitions...</span>
    </div>
  );
}
