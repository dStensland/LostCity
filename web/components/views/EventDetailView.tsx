"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "@/components/SmartImage";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import FollowButton from "@/components/FollowButton";
import FriendsGoing from "@/components/FriendsGoing";
import WhosGoing from "@/components/WhosGoing";
import DirectionsDropdown from "@/components/DirectionsDropdown";
import EventQuickActions from "@/components/EventQuickActions";
import VenueVibes from "@/components/VenueVibes";
import LinkifyText from "@/components/LinkifyText";
import { formatTime, formatTimeRange } from "@/lib/formats";
import { format, parseISO } from "date-fns";
import { EntityTagList } from "@/components/tags/EntityTagList";
import FlagButton from "@/components/FlagButton";
import { getSeriesTypeLabel, getSeriesTypeColor } from "@/lib/series-utils";
import NearbySection from "@/components/NearbySection";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { isDogPortal } from "@/lib/dog-art";
import { usePortal } from "@/lib/portal-context";
import { getDisplayParticipants, getLineupLabels, type EventArtist } from "@/lib/artists-utils";
import LineupSection from "@/components/LineupSection";
import GettingThereSection from "@/components/GettingThereSection";
import { deriveShowSignals } from "@/lib/show-signals";
import ShowSignalsPanel from "@/components/ShowSignalsPanel";
import { inferLineupGenreFallback } from "@/lib/artist-fallbacks";

type EventData = {
  id: number;
  title: string;
  description: string | null;
  display_description?: string | null;
  start_date: string;
  start_time: string | null;
  doors_time?: string | null;
  end_time: string | null;
  end_date: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  price_note?: string | null;
  category: string | null;
  subcategory: string | null;
  tags: string[] | null;
  genres?: string[] | null;
  ticket_url: string | null;
  source_url: string | null;
  image_url: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  is_adult?: boolean | null;
  age_policy?: string | null;
  ticket_status?: string | null;
  reentry_policy?: string | null;
  set_times_mentioned?: boolean | null;
  is_live?: boolean;
  venue: {
    id: number;
    name: string;
    slug: string;
    address: string | null;
    neighborhood: string | null;
    city: string;
    state: string;
    vibes: string[] | null;
    nearest_marta_station?: string | null;
    marta_walk_minutes?: number | null;
    marta_lines?: string[] | null;
    beltline_adjacent?: boolean | null;
    beltline_segment?: string | null;
    parking_type?: string[] | null;
    parking_free?: boolean | null;
    transit_score?: number | null;
  } | null;
  producer: {
    id: string;
    name: string;
    slug: string;
    org_type: string;
    website: string | null;
    logo_url: string | null;
  } | null;
  series: {
    id: string;
    title: string;
    slug: string;
    series_type: string;
    festival?: {
      id: string;
      name: string;
      slug: string;
      image_url: string | null;
      festival_type?: string | null;
      location: string | null;
      neighborhood: string | null;
    } | null;
  } | null;
};

type RelatedEvent = {
  id: number;
  title: string;
  start_date: string;
  end_date?: string | null;
  start_time: string | null;
  venue: { id: number; name: string; slug: string } | null;
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
};

type NearbySpot = {
  id: number;
  name: string;
  slug: string;
  spot_type: string | null;
  neighborhood: string | null;
  closesAt?: string;
};

type NearbyDestinations = {
  food: NearbySpot[];
  drinks: NearbySpot[];
  nightlife: NearbySpot[];
  caffeine: NearbySpot[];
  fun: NearbySpot[];
};

interface EventDetailViewProps {
  eventId: number;
  portalSlug: string;
  onClose: () => void;
}

function parseRecurrenceRule(rule: string | null | undefined): string | null {
  if (!rule) return null;
  const match = rule.match(/FREQ=(\w+)(?:;BYDAY=([\w,]+))?/i);
  if (!match) return null;

  const freq = match[1]?.toUpperCase();
  const days = match[2];

  const dayNames: Record<string, string> = {
    MO: "Monday", TU: "Tuesday", WE: "Wednesday",
    TH: "Thursday", FR: "Friday", SA: "Saturday", SU: "Sunday"
  };

  const shortDayNames: Record<string, string> = {
    MO: "Mon", TU: "Tue", WE: "Wed",
    TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun"
  };

  if (freq === "WEEKLY" && days) {
    const dayList = days.split(",");
    if (dayList.length === 1 && dayNames[dayList[0]]) {
      return `Every ${dayNames[dayList[0]]}`;
    }
    const names = dayList.map(d => shortDayNames[d]).filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }
  if (freq === "WEEKLY") return "Weekly";
  if (freq === "MONTHLY") return "Monthly";
  if (freq === "DAILY") return "Daily";

  return null;
}

function parseRecurrenceDays(rule: string | null | undefined): string[] {
  if (!rule) return [];
  const match = rule.match(/BYDAY=([\w,]+)/i);
  if (!match) return [];
  const dayNames: Record<string, string> = {
    MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun"
  };
  return match[1].split(",").map(d => dayNames[d]).filter(Boolean);
}

function isExhibition(event: EventData): boolean {
  return event.genres?.includes("exhibition") || event.series?.series_type === "exhibition";
}

export default function EventDetailView({ eventId, portalSlug, onClose }: EventDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { portal } = usePortal();
  const [event, setEvent] = useState<EventData | null>(null);
  const [eventArtists, setEventArtists] = useState<EventArtist[]>([]);
  const [venueEvents, setVenueEvents] = useState<RelatedEvent[]>([]);
  const [nearbyEvents, setNearbyEvents] = useState<RelatedEvent[]>([]);
  const [nearbyDestinations, setNearbyDestinations] = useState<NearbyDestinations>({
    food: [],
    drinks: [],
    nightlife: [],
    caffeine: [],
    fun: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLowRes, setIsLowRes] = useState(false);

  useEffect(() => {
    async function fetchEvent() {
      setLoading(true);
      setError(null);

      try {
        const eventUrl = portal?.id ? `/api/events/${eventId}?portal_id=${portal.id}` : `/api/events/${eventId}`;
        const res = await fetch(eventUrl);
        if (!res.ok) {
          throw new Error("Event not found");
        }
        const data = await res.json();
        setEvent(data.event);
        setEventArtists(data.eventArtists || []);
        setVenueEvents(data.venueEvents || []);
        setNearbyEvents(data.nearbyEvents || []);
        setNearbyDestinations(data.nearbyDestinations || {
          food: [],
          drinks: [],
          nightlife: [],
          caffeine: [],
          fun: [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load event");
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, [eventId, portal?.id]);

  // Navigate to another detail view, clearing all detail params first
  // so only one is active at a time. Each push adds to history for proper back nav.
  const navigateToDetail = (param: string, value: string | number) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.delete("event");
    params.delete("spot");
    params.delete("series");
    params.delete("festival");
    params.delete("org");
    params.set(param, String(value));
    router.push(`/${portalSlug}?${params.toString()}`, { scroll: false });
  };

  const handleEventClick = (id: number) => navigateToDetail("event", id);
  const handleSpotClick = (slug: string) => navigateToDetail("spot", slug);
  const handleSeriesClick = (slug: string) => navigateToDetail("series", slug);
  const handleFestivalClick = (slug: string) => navigateToDetail("festival", slug);

  // Reusable neon back button with 48x48px minimum touch target
  const NeonBackButton = () => (
    <button
      onClick={onClose}
      aria-label="Back to event list"
      className="group absolute top-3 left-3 flex items-center gap-2 px-4 py-3 rounded-full font-mono text-xs font-semibold tracking-wide uppercase transition-all duration-300 z-10 hover:scale-110 hover:brightness-110 active:scale-105 neon-back-btn"
    >
      <svg
        className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5 neon-back-icon"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
      </svg>
      <span
        className="transition-all duration-300 group-hover:text-[var(--coral)] neon-back-text"
      >
        Back
      </span>
    </button>
  );

  if (loading) {
    return (
      <div className="pt-6">
        {/* Loading skeleton with back button integrated */}
        <div className="relative aspect-[4/3] skeleton-shimmer rounded-xl mb-4">
          <NeonBackButton />
        </div>
        <div className="h-24 skeleton-shimmer rounded-xl mb-4" />
        <div className="h-48 skeleton-shimmer rounded-xl" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="pt-6">
        <div className="relative aspect-[4/3] bg-[var(--dusk)] rounded-xl mb-4 flex items-center justify-center">
          <NeonBackButton />
          <p className="text-[var(--muted)]">{error || "Event not found"}</p>
        </div>
      </div>
    );
  }

  const isLive = event.is_live || false;
  const isDog = isDogPortal(portalSlug);
  const recurrenceText = parseRecurrenceRule(event.recurrence_rule);
  const showImage = event.image_url && !imageError;
  const dogTags = isDog && event.tags
    ? event.tags.filter((t) => ["dog-friendly", "pets", "adoption", "outdoor", "family-friendly"].includes(t))
    : [];
  const heroAccentClass = createCssVarClass(
    "--hero-accent",
    getCategoryColor(event.category || "other"),
    "hero-accent"
  );
  const seriesColorClass = event.series
    ? createCssVarClass(
        "--series-color",
        getSeriesTypeColor(event.series.series_type),
        "series-color"
      )
    : null;
  const festivalColorClass = event.series?.festival
    ? createCssVarClass(
        "--series-color",
        getSeriesTypeColor("festival_program"),
        "festival-color"
      )
    : null;

  const descriptionText = event.display_description || event.description;
  const lineupGenreFallback = inferLineupGenreFallback(event.genres, event.tags, event.category);
  const derivedSignals = deriveShowSignals({
    title: event.title,
    description: descriptionText,
    price_note: event.price_note,
    tags: event.tags,
    start_time: event.start_time,
    doors_time: event.doors_time,
    end_time: event.end_time,
    is_all_day: event.is_all_day,
    is_free: event.is_free,
    is_adult: event.is_adult,
    ticket_url: event.ticket_url,
    age_policy: event.age_policy,
    ticket_status: event.ticket_status,
    reentry_policy: event.reentry_policy,
    set_times_mentioned: event.set_times_mentioned,
  });
  const defaultStartLabel = formatTime(event.start_time, event.is_all_day || undefined);
  const showSignals = {
    ...derivedSignals,
    showTime: derivedSignals.showTime === defaultStartLabel ? null : derivedSignals.showTime,
  };
  const hasShowSignals = Boolean(
    showSignals.showTime ||
      showSignals.doorsTime ||
      showSignals.endTime ||
      showSignals.agePolicy ||
      showSignals.ticketStatus ||
      showSignals.reentryPolicy ||
      showSignals.hasSetTimesMention
  );
  const displayParticipants = getDisplayParticipants(eventArtists, {
    eventTitle: event.title,
    eventCategory: event.category,
  });
  const participantLabels = getLineupLabels(displayParticipants, {
    eventCategory: event.category,
  });
  const hasLineup = displayParticipants.length > 0;
  const hasAboutContent = Boolean(descriptionText) || hasLineup;
  const hasIntroContent = hasAboutContent || hasShowSignals;

  return (
    <div className="pt-6 pb-8">
      <ScopedStyles
        css={[heroAccentClass?.css, seriesColorClass?.css, festivalColorClass?.css].filter(Boolean).join("\n")}
      />
      {/* Hero Image with integrated back button */}
      <div
        className={`relative aspect-[4/3] bg-[var(--night)] rounded-xl overflow-hidden mb-4 ${
          isLive ? "ring-2 ring-[var(--coral)] ring-opacity-50" : ""
        } ${heroAccentClass?.className ?? ""}`}
      >
        {showImage ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 skeleton-shimmer" />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.image_url!}
              alt={event.title}
              className={`absolute inset-0 w-full h-full ${isLowRes ? "object-contain" : "object-cover"} transition-opacity duration-300 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={(e) => {
                setImageLoaded(true);
                if (e.currentTarget.naturalWidth < 600) setIsLowRes(true);
              }}
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </>
        ) : (
          <>
            {/* Branded gradient hero fallback — animated neon aesthetic */}
            <div className="absolute inset-0 bg-[var(--void)]" />
            <div className="absolute inset-0 hero-fallback-ambient" />
            {/* Neon top line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] hero-fallback-topline" />
            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center justify-center w-20 h-20 rounded-2xl hero-fallback-icon">
                <CategoryIcon type={event.category || "other"} size={40} glow="intense" />
              </div>
            </div>
            {/* Scanline effect */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] hero-fallback-scanlines" />
            {/* Bottom gradient for title overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          </>
        )}

        {/* Back button - neon styled */}
        <NeonBackButton />

        {/* Live badge - positioned on the right to avoid overlapping back button */}
        {isLive && (
          <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 bg-[var(--coral)] text-[var(--void)] rounded-full font-mono text-xs font-medium z-10">
            <span className="w-2 h-2 bg-[var(--void)] rounded-full animate-pulse" />
            LIVE NOW
          </div>
        )}

        {/* Image source attribution - subtle link to original source */}
        {showImage && event.source_url && (
          <a
            href={event.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-[0.55rem] font-mono text-[var(--muted)] hover:text-[var(--soft)] transition-colors z-10 ${isLive ? "hidden" : ""}`}
            title="View original source"
          >
            <svg className="w-3 h-3 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Source
          </a>
        )}

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow-lg">
            {event.title}
          </h1>
          {event.venue && (
            <p className="text-sm text-white/80 mt-1">
              <button
                onClick={() => handleSpotClick(event.venue!.slug)}
                className="hover:text-white hover:underline transition-colors"
              >
                {event.venue.name}
              </button>
              {event.venue.neighborhood && ` · ${event.venue.neighborhood}`}
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <EventQuickActions event={event} isLive={isLive} className="mb-6" />

      {/* Dog-friendly event highlights (dog portal only) */}
      {isDog && dogTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {dogTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
              style={{
                background: "rgba(255, 107, 53, 0.1)",
                color: "#FF6B35",
                border: "1px solid rgba(255, 107, 53, 0.25)",
              }}
            >
              {tag === "dog-friendly" && "🐾 Dog Friendly"}
              {tag === "pets" && "🐕 Pet Event"}
              {tag === "adoption" && "❤️ Adoption"}
              {tag === "outdoor" && "🌳 Outdoor"}
              {tag === "family-friendly" && "👨‍👩‍👧 Family Friendly"}
            </span>
          ))}
        </div>
      )}

      {/* Exhibition Info Card */}
      {isExhibition(event) && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-[#F59E0B]/30 mb-6 bg-[#F59E0B]/5">
          <div className="w-10 h-10 rounded-full bg-[#F59E0B]/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-[#F59E0B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4-4 2 2 4-4 6 6" />
            </svg>
          </div>
          <div>
            <p className="text-[var(--cream)] font-medium">
              Exhibition
              {event.end_date && (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const endDate = parseISO(event.end_date!);
                const startDate = parseISO(event.start_date);
                if (startDate > today) {
                  return ` · Opens ${format(startDate, "MMM d")}`;
                }
                return ` · Through ${format(endDate, "MMM d")}`;
              })()}
            </p>
            <p className="text-sm text-[var(--muted)]">
              {(() => {
                const days = parseRecurrenceDays(event.recurrence_rule);
                const hours = formatTimeRange(event.start_time, event.end_time);
                if (days.length > 0 && hours !== "TBA") {
                  return `${days.join(", ")} · ${hours}`;
                }
                if (days.length > 0) return days.join(", ");
                if (hours !== "TBA") return hours;
                return "See venue for hours";
              })()}
            </p>
          </div>
        </div>
      )}

      {/* Recurring Event Badge (non-exhibition) */}
      {!isExhibition(event) && event.is_recurring && recurrenceText && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-[var(--twilight)] mb-6 bg-[var(--dusk)]">
          <div className="w-10 h-10 rounded-full bg-[var(--twilight)] flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <p className="text-[var(--cream)] font-medium">This event repeats {recurrenceText.toLowerCase()}</p>
            <p className="text-sm text-[var(--muted)]">View all dates in the series</p>
          </div>
        </div>
      )}

      {/* Main event info card */}
      <div className="border border-[var(--twilight)] rounded-xl p-5 sm:p-6 bg-[var(--dusk)]">
        {/* Description */}
        {descriptionText && (
          <div className="mb-5">
            <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
              About
            </h2>
            <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed">
              <LinkifyText text={descriptionText} />
            </p>
          </div>
        )}

        {/* Artists */}
        {hasLineup && (
          <div className={`mb-5 ${descriptionText ? "pt-5 border-t border-[var(--twilight)]" : ""}`}>
            <LineupSection
              artists={displayParticipants}
              portalSlug={portalSlug}
              maxDisplay={20}
              title={participantLabels.sectionTitle}
              headlinerLabel={participantLabels.headlinerLabel}
              supportLabel={participantLabels.supportLabel}
              eventCategory={event.category}
              fallbackImageUrl={event.image_url}
              fallbackGenres={lineupGenreFallback}
            />
          </div>
        )}

        {hasShowSignals && (
          <div className={`mb-5 ${hasAboutContent ? "pt-5 border-t border-[var(--twilight)]" : ""}`}>
            <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
              Show Details
            </h2>
            <ShowSignalsPanel signals={showSignals} ticketUrl={event.ticket_url} />
          </div>
        )}

        {/* Location */}
        {event.venue && event.venue.address && (
          <div className={`mb-5 ${hasIntroContent ? "pt-5 border-t border-[var(--twilight)]" : ""}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest">
                Location
              </h2>
              <DirectionsDropdown
                venueName={event.venue.name}
                address={event.venue.address}
                city={event.venue.city}
                state={event.venue.state}
              />
            </div>
            <button
              onClick={() => handleSpotClick(event.venue!.slug)}
              className="block w-full text-left p-3 rounded-lg border border-[var(--twilight)] transition-colors hover:border-[var(--coral)]/50 group bg-[var(--void)]"
            >
              <p className="text-[var(--soft)]">
                <span className="text-[var(--cream)] font-medium group-hover:text-[var(--coral)] transition-colors">
                  {event.venue.name}
                </span>
                <svg className="inline-block w-4 h-4 ml-1 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <br />
                <span className="text-sm text-[var(--muted)]">
                  {event.venue.address} · {event.venue.city}, {event.venue.state}
                </span>
              </p>
              {event.venue.vibes && event.venue.vibes.length > 0 && (
                <VenueVibes vibes={event.venue.vibes} className="mt-2" />
              )}
              <GettingThereSection transit={event.venue} variant="compact" />
            </button>

          </div>
        )}

        {/* Social proof */}
        <div className="pt-5 border-t border-[var(--twilight)]">
          <FriendsGoing eventId={event.id} className="mb-4" />
          <WhosGoing eventId={event.id} />
        </div>

        {/* Series link */}
        {event.series && (
          <div className="pt-5 border-t border-[var(--twilight)] space-y-3">
            {event.series.festival && (
              <button
                onClick={() => handleFestivalClick(event.series!.festival!.slug)}
                className={`flex items-center gap-3 w-full p-3 rounded-lg border border-[var(--twilight)] transition-colors hover:border-[var(--coral)]/50 group bg-[var(--void)] text-left ${festivalColorClass?.className ?? ""}`}
              >
                <svg
                  className="w-5 h-5 flex-shrink-0 series-accent"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 4v16m0-12h9l-1.5 3L14 14H5" />
                </svg>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-[var(--soft)] group-hover:text-[var(--coral)] transition-colors">
                    Part of <span className="text-[var(--cream)] font-medium">{event.series.festival.name}</span>
                  </span>
                  <span
                    className="ml-2 text-[0.6rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded series-bg-20 series-accent"
                  >
                    Festival
                  </span>
                </div>
                <svg className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            <button
              onClick={() => handleSeriesClick(event.series!.slug)}
              className={`flex items-center gap-3 w-full p-3 rounded-lg border border-[var(--twilight)] transition-colors hover:border-[var(--coral)]/50 group bg-[var(--void)] text-left ${seriesColorClass?.className ?? ""}`}
            >
              <svg
                className="w-5 h-5 flex-shrink-0 series-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-[var(--soft)] group-hover:text-[var(--coral)] transition-colors">
                  Part of <span className="text-[var(--cream)] font-medium">{event.series.title}</span>
                </span>
                <span
                  className="ml-2 text-[0.6rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded series-bg-20 series-accent"
                >
                  {getSeriesTypeLabel(event.series.series_type)}
                </span>
              </div>
              <svg className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* Producer */}
        {event.producer && (
          <div className="pt-5 border-t border-[var(--twilight)]">
            <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
              Presented by
            </h2>
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-[var(--twilight)] bg-[var(--void)]">
              <div className="flex items-center gap-3 min-w-0">
                {event.producer.logo_url ? (
                  <Image
                    src={event.producer.logo_url}
                    alt={event.producer.name}
                    width={40}
                    height={40}
                    className="rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[var(--twilight)] flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-[var(--cream)] font-medium truncate text-sm">
                    {event.producer.name}
                  </h3>
                  <p className="text-[0.65rem] text-[var(--muted)] font-mono uppercase tracking-wider">
                    {event.producer.org_type.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
              <FollowButton targetProducerId={event.producer.id} size="sm" />
            </div>
          </div>
        )}

        {/* Tags Section - Event tags + Venue tags + Org tags */}
        <div className="pt-5 border-t border-[var(--twilight)]">
          <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
            Community Tags
          </h2>

          {/* Event system tags (from crawlers) */}
          {event.tags && event.tags.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-2 mb-2">
                {event.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full text-xs font-mono bg-[var(--coral)]/10 text-[var(--coral)] border border-[var(--coral)]/20"
                  >
                    {tag.replace(/-/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Event community tags */}
          <div className="mb-4">
            <p className="text-[0.6rem] text-[var(--muted)] font-mono uppercase tracking-wider mb-2">
              This Event
            </p>
            <EntityTagList entityType="event" entityId={event.id} />
          </div>

          {/* Venue community tags */}
          {event.venue && (
            <div className="mb-4">
              <p className="text-[0.6rem] text-[var(--muted)] font-mono uppercase tracking-wider mb-2">
                {event.venue.name}
              </p>
              <EntityTagList entityType="venue" entityId={event.venue.id} />
            </div>
          )}

          {/* Org community tags */}
          {event.producer && (
            <div>
              <p className="text-[0.6rem] text-[var(--muted)] font-mono uppercase tracking-wider mb-2">
                {event.producer.name}
              </p>
              <EntityTagList entityType="org" entityId={Number(event.producer.id)} />
            </div>
          )}
        </div>

        {/* Flag */}
        <div className="pt-5 border-t border-[var(--twilight)]">
          <FlagButton
            entityType="event"
            entityId={event.id}
            entityName={event.title}
          />
        </div>
      </div>

      {/* Happening Around Here */}
      <NearbySection
        nearbySpots={nearbyDestinations}
        venueEvents={venueEvents}
        nearbyEvents={nearbyEvents}
        venueName={event.venue?.name}
        onSpotClick={handleSpotClick}
        onEventClick={handleEventClick}
      />
    </div>
  );
}
