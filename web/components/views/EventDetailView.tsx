"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "@/components/SmartImage";
import Skeleton from "@/components/Skeleton";
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
import AroundHereSection, { type NearbyDestination } from "@/components/detail/AroundHereSection";
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
import dynamic from "next/dynamic";
import {
  ForkKnife,

  CaretRight,
  CaretDown,
  ArrowSquareOut,
  FrameCorners,
  Repeat,
  Buildings,
  Flag,
} from "@phosphor-icons/react";

const MakeANightSheet = dynamic(
  () => import("@/components/detail/MakeANightSheet"),
  { ssr: false },
);
import { DescriptionTeaser } from "@/components/detail/DescriptionTeaser";
import { InfoCard } from "@/components/detail/InfoCard";
import { SectionHeader } from "@/components/detail/SectionHeader";
import { DetailStickyBar } from "@/components/detail/DetailStickyBar";
import { GenreChip } from "@/components/ActivityChip";
import { parseRecurrenceRule, parseRecurrenceDays } from "@/lib/recurrence";
import { isTicketingUrl } from "@/lib/card-utils";
import NeonBackButton from "@/components/detail/NeonBackButton";
import Badge from "@/components/ui/Badge";

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
    lat?: number | null;
    lng?: number | null;
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
  end_time?: string | null;
  distance?: number;
  proximity_label?: string;
  venue: { id: number; name: string; slug: string; city?: string; location_designator?: string } | null;
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
};

type NearbyDestinations = {
  food: NearbyDestination[];
  drinks: NearbyDestination[];
  nightlife: NearbyDestination[];
  fun: NearbyDestination[];
};

interface EventDetailViewProps {
  eventId: number;
  portalSlug: string;
  onClose: () => void;
}

function isExhibition(event: EventData): boolean {
  return event.genres?.includes("exhibition") || event.series?.series_type === "exhibition";
}

function CommunityTagsSection({
  eventId,
  venue,
  producer,
}: {
  eventId: number;
  venue: EventData["venue"];
  producer: EventData["producer"];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full text-left group min-h-[44px] focus-ring"
        aria-expanded={expanded}
      >
        <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-widest">
          Community Tags
        </h2>
        <CaretDown
          size={14}
          weight="bold"
          className={`text-[var(--muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
        />
        {!expanded && (
          <span className="text-2xs font-mono text-[var(--muted)]/60">Tap to expand</span>
        )}
      </button>
      {expanded && (
        <div className="mt-3 space-y-4">
          <div>
            <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-widest mb-2">
              This Event
            </p>
            <EntityTagList entityType="event" entityId={eventId} />
          </div>
          {venue && (
            <div>
              <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-widest mb-2">
                {venue.name}
              </p>
              <EntityTagList entityType="venue" entityId={venue.id} />
            </div>
          )}
          {producer && (
            <div>
              <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-widest mb-2">
                {producer.name}
              </p>
              <EntityTagList entityType="org" entityId={Number(producer.id)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export default function EventDetailView({ eventId, portalSlug, onClose }: EventDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { portal } = usePortal();
  const [showNightSheet, setShowNightSheet] = useState(false);
  const [event, setEvent] = useState<EventData | null>(null);
  const [eventArtists, setEventArtists] = useState<EventArtist[]>([]);
  const [venueEvents, setVenueEvents] = useState<RelatedEvent[]>([]);
  const [nearbyEvents, setNearbyEvents] = useState<RelatedEvent[]>([]);
  const [nearbyDestinations, setNearbyDestinations] = useState<NearbyDestinations>({
    food: [],
    drinks: [],
    nightlife: [],
    fun: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLowRes, setIsLowRes] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function fetchEvent() {
      setLoading(true);
      setError(null);
      setImageLoaded(false);
      setImageError(false);
      setIsLowRes(false);

      try {
        const eventUrl = portal?.id ? `/api/events/${eventId}?portal_id=${portal.id}` : `/api/events/${eventId}`;
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(eventUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (cancelled) return;
        if (!res.ok) {
          throw new Error("Event not found");
        }
        const data = await res.json();
        if (cancelled) return;
        setEvent(data.event);
        setEventArtists(data.eventArtists || []);
        setVenueEvents(data.venueEvents || []);
        setNearbyEvents(data.nearbyEvents || []);
        setNearbyDestinations(data.nearbyDestinations || {
          food: [],
          drinks: [],
          nightlife: [],
          fun: [],
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load event");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchEvent();
    return () => { cancelled = true; controller.abort(); };
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

  // Merge all destination categories into a flat sorted list
  const allDestinations = useMemo(() => {
    const { food, drinks, nightlife, fun } = nearbyDestinations;
    const merged = [...food, ...drinks, ...nightlife, ...fun];
    // Open venues first, then by distance
    return merged.sort((a, b) => {
      const aOpen = a.closesAt !== undefined ? 1 : 0;
      const bOpen = b.closesAt !== undefined ? 1 : 0;
      if (aOpen !== bOpen) return bOpen - aOpen; // open first
      return (a.distance ?? 99) - (b.distance ?? 99);
    });
  }, [nearbyDestinations]);

  if (loading) {
    return (
      <div className="pt-6 pb-8" role="status" aria-label="Loading event details">
        {/* Hero skeleton with back button */}
        <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-4 bg-[var(--night)]">
          <Skeleton className="absolute inset-0" />
          <NeonBackButton onClose={onClose} />
          {/* Title overlay skeleton */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <Skeleton className="h-7 w-[70%] rounded" delay="0.1s" />
            <Skeleton className="h-4 w-[45%] rounded mt-2" delay="0.15s" />
          </div>
        </div>

        {/* Quick actions skeleton */}
        <div className="rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)] mb-6">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--twilight)]">
            <div className="flex items-center gap-4">
              <Skeleton className="h-5 w-14 rounded" delay="0.2s" />
              <Skeleton className="h-4 w-20 rounded" delay="0.25s" />
              <Skeleton className="h-4 w-16 rounded" delay="0.3s" />
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" delay="0.3s" />
              <Skeleton className="h-8 w-8 rounded-lg" delay="0.35s" />
            </div>
          </div>
          <div className="p-3 flex items-center gap-3">
            <Skeleton className="flex-1 h-12 rounded-lg" delay="0.35s" />
            <Skeleton className="h-12 w-12 rounded-lg" delay="0.4s" />
          </div>
        </div>

        {/* Info card skeleton */}
        <div className="border border-[var(--twilight)] rounded-lg p-6 sm:p-8 bg-[var(--card-bg)]">
          {/* Description skeleton */}
          <Skeleton className="h-3 w-16 rounded mb-3" delay="0.4s" />
          <div className="space-y-2 mb-5">
            <Skeleton className="h-4 w-full rounded" delay="0.45s" />
            <Skeleton className="h-4 w-[90%] rounded" delay="0.5s" />
            <Skeleton className="h-4 w-[75%] rounded" delay="0.55s" />
          </div>

          {/* Location skeleton */}
          <div className="pt-5 border-t border-[var(--twilight)] mb-5">
            <Skeleton className="h-3 w-16 rounded mb-3" delay="0.6s" />
            <div className="p-3 rounded-lg border border-[var(--twilight)] bg-[var(--void)]">
              <Skeleton className="h-5 w-[50%] rounded mb-2" delay="0.65s" />
              <Skeleton className="h-3 w-[70%] rounded" delay="0.7s" />
            </div>
          </div>

          {/* Social proof skeleton */}
          <div className="pt-5 border-t border-[var(--twilight)]">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" delay="0.75s" />
              <Skeleton className="h-8 w-8 rounded-full" delay="0.8s" />
              <Skeleton className="h-8 w-8 rounded-full" delay="0.85s" />
              <Skeleton className="h-4 w-24 rounded ml-1" delay="0.9s" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="pt-6" role="alert">
        <div className="relative aspect-[4/3] bg-[var(--dusk)] rounded-xl mb-4 flex items-center justify-center">
          <NeonBackButton onClose={onClose} />
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
            <Image
              src={event.image_url!}
              alt={event.title}
              fill
              sizes="(max-width: 640px) 100vw, 640px"
              className={`${isLowRes ? "object-contain" : "object-cover"} transition-opacity duration-300 ${
                imageLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={(e) => {
                setImageLoaded(true);
                const img = e.currentTarget as HTMLImageElement;
                if (img.naturalWidth > 0 && img.naturalWidth < 600) setIsLowRes(true);
              }}
              onError={() => setImageError(true)}
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </>
        ) : (
          <>
            {/* Branded gradient hero fallback — animated neon aesthetic */}
            <div className="absolute inset-0 bg-[var(--void)]" />
            <div className="absolute inset-0 hero-fallback-ambient" />
            {/* Neon top line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 hero-fallback-topline" />
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
        <NeonBackButton onClose={onClose} />

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
            className={`absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-2xs font-mono text-[var(--muted)] hover:text-[var(--soft)] transition-colors z-10 focus-ring ${isLive ? "hidden" : ""}`}
            title="View original source"
          >
            <ArrowSquareOut size={12} weight="light" className="inline-block mr-1 -mt-0.5" />
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
                className="py-1 hover:text-white hover:underline transition-colors"
              >
                {event.venue.name}
              </button>
              {event.venue.neighborhood && ` · ${event.venue.neighborhood}`}
            </p>
          )}
          {event.genres && event.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {event.genres.slice(0, 4).map((genre) => (
                <span
                  key={genre}
                  className="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-white/15 text-white/90 backdrop-blur-sm border border-white/10"
                >
                  {genre.replace(/-/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <EventQuickActions event={event} isLive={isLive} className="mb-5" />

      {/* Above-the-fold: Description teaser */}
      {event.description && event.description.length >= 50 && (
        <div className="mb-5">
          <DescriptionTeaser
            description={event.description}
            accentColor={getCategoryColor(event.category || "other")}
          />
        </div>
      )}

      {/* Above-the-fold: Social proof (promoted from info card) */}
      <FriendsGoing eventId={event.id} className="mb-4" />

      {/* Above-the-fold: Interactive genre pills */}
      {event.genres && event.genres.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {event.genres.slice(0, 5).map((genre) => (
            <GenreChip key={genre} genre={genre} category={event.category} portalSlug={portalSlug} />
          ))}
        </div>
      )}

      {/* Make a Night of It — inline bottom sheet, no page navigation */}
      {event.venue && event.venue.lat != null && event.venue.lng != null && (
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setShowNightSheet(true)}
            className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg text-sm font-mono font-medium text-[var(--gold)] bg-[var(--gold)]/8 border border-[var(--gold)]/25 hover:bg-[var(--gold)]/14 hover:border-[var(--gold)]/40 transition-all focus-ring"
          >
            <ForkKnife size={16} weight="duotone" />
            Make a Night of It
          </button>
        </div>
      )}

      {/* Dog-friendly event highlights (dog portal only) */}
      {isDog && dogTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {dogTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold min-h-[44px] bg-[var(--coral)]/10 text-[var(--coral)] border border-[var(--coral)]/25"
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
        <div className="flex items-center gap-3 p-4 rounded-lg border border-[var(--neon-amber)]/30 mb-6 bg-[var(--neon-amber)]/5">
          <div className="w-10 h-10 rounded-full bg-[var(--neon-amber)]/15 flex items-center justify-center flex-shrink-0">
            <FrameCorners size={20} weight="light" className="text-[var(--neon-amber)]" aria-hidden="true" />
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
            <Repeat size={20} weight="light" className="text-[var(--coral)]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[var(--cream)] font-medium">This event repeats {recurrenceText.toLowerCase()}</p>
            <p className="text-sm text-[var(--muted)]">View all dates in the series</p>
          </div>
        </div>
      )}

      {/* Main event info card */}
      <InfoCard accentColor={getCategoryColor(event.category || "other")}>
        {/* Description */}
        {descriptionText && (
          <div className="mb-5">
            <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted)] pb-3">
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
          <div className="mb-5">
            <SectionHeader title="Show Details" className={hasAboutContent ? "" : "border-t-0 pt-0"} />
            <ShowSignalsPanel signals={showSignals} ticketUrl={event.ticket_url} />
          </div>
        )}

        {/* Location */}
        {event.venue && event.venue.address && (
          <div className="mb-5">
            <div className={`flex items-center justify-between py-4 ${hasIntroContent ? "border-t border-[var(--twilight)]" : ""}`}>
              <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
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
              className="block w-full text-left p-3 rounded-lg border border-[var(--twilight)] transition-colors hover:border-[var(--coral)]/50 group bg-[var(--void)] focus-ring"
            >
              <p className="text-[var(--soft)]">
                <span className="text-[var(--cream)] font-medium group-hover:text-[var(--coral)] transition-colors">
                  {event.venue.name}
                </span>
                <CaretRight size={16} weight="bold" className="inline-block ml-1 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors" />
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

        {/* Social proof — FriendsGoing promoted above the fold */}
        <div>
          <SectionHeader title="Who's Going" />
          <WhosGoing eventId={event.id} />
        </div>

        {/* Series link */}
        {event.series && (
          <div className="pt-4 border-t border-[var(--twilight)] space-y-3">
            {event.series.festival && (
              <button
                onClick={() => handleFestivalClick(event.series!.festival!.slug)}
                className={`flex items-center gap-3 w-full p-3 rounded-lg border border-[var(--twilight)] transition-colors hover:border-[var(--coral)]/50 group bg-[var(--void)] text-left focus-ring ${festivalColorClass?.className ?? ""}`}
              >
                <Flag size={20} weight="light" className="flex-shrink-0 series-accent" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-[var(--soft)] group-hover:text-[var(--coral)] transition-colors">
                    Part of <span className="text-[var(--cream)] font-medium">{event.series.festival.name}</span>
                  </span>
                  <span
                    className="ml-2 text-xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded series-bg-20 series-accent"
                  >
                    Festival
                  </span>
                </div>
                <CaretRight size={16} weight="bold" className="text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0" />
              </button>
            )}
            <button
              onClick={() => handleSeriesClick(event.series!.slug)}
              className={`flex items-center gap-3 w-full p-3 rounded-lg border border-[var(--twilight)] transition-colors hover:border-[var(--coral)]/50 group bg-[var(--void)] text-left focus-ring ${seriesColorClass?.className ?? ""}`}
            >
              <Repeat size={20} weight="light" className="flex-shrink-0 series-accent" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-[var(--soft)] group-hover:text-[var(--coral)] transition-colors">
                  Part of <span className="text-[var(--cream)] font-medium">{event.series.title}</span>
                </span>
                <span
                  className="ml-2 text-xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded series-bg-20 series-accent"
                >
                  {getSeriesTypeLabel(event.series.series_type)}
                </span>
              </div>
              <CaretRight size={16} weight="bold" className="text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0" />
            </button>
          </div>
        )}

        {/* Producer */}
        {event.producer && (
          <div>
            <SectionHeader title="Presented by" />
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
                    <Buildings size={20} weight="light" className="text-[var(--muted)]" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-[var(--cream)] font-medium truncate text-sm">
                    {event.producer.name}
                  </h3>
                  <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-widest">
                    {event.producer.org_type.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
              <FollowButton targetProducerId={event.producer.id} size="sm" />
            </div>
          </div>
        )}

        {/* Tags Section */}
        <div>
          {/* System tags (from crawlers) — always visible */}
          {event.tags && event.tags.length > 0 && (
            <div className="mb-4">
              <SectionHeader title="Tags" />
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag) => (
                  <Badge key={tag} variant="alert">{tag.replace(/-/g, " ")}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Community tags — collapsed by default to reduce scroll depth + API calls */}
          <div className="mt-4">
            <CommunityTagsSection
              eventId={event.id}
              venue={event.venue}
              producer={event.producer}
            />
          </div>
        </div>

        {/* Flag */}
        <div className="pt-4 border-t border-[var(--twilight)]">
          <FlagButton
            entityType="event"
            entityId={event.id}
            entityName={event.title}
          />
        </div>
      </InfoCard>

      {/* Sticky bottom CTA — appears on scroll */}
      <DetailStickyBar
        showShareButton
        shareTracking={{ portalSlug, eventId: event.id }}
        primaryAction={
          event.ticket_url
            ? {
                label: isLive ? "Join Now" : isTicketingUrl(event.ticket_url) ? "Get Tickets" : event.is_free ? "RSVP Free" : "Learn More",
                href: event.ticket_url,
              }
            : event.source_url
              ? {
                  label: event.is_free ? "RSVP Free" : "Get Tickets",
                  href: event.source_url,
                }
              : undefined
        }
        scrollThreshold={400}
      />

      {/* Around Here */}
      <AroundHereSection
        venueEvents={venueEvents}
        nearbyEvents={nearbyEvents}
        destinations={allDestinations}
        venueName={event.venue?.name}
        neighborhood={event.venue?.neighborhood}
        portalSlug={portalSlug}
        onSpotClick={handleSpotClick}
        onEventClick={handleEventClick}
      />

      {/* Make a Night of It — inline bottom sheet */}
      {showNightSheet && event.venue && (
        <MakeANightSheet
          anchorEvent={{
            id: event.id,
            title: event.title,
            start_date: event.start_date,
            start_time: event.start_time,
            end_time: event.end_time,
            is_all_day: event.is_all_day,
            venue: {
              ...event.venue,
              lat: event.venue.lat ?? null,
              lng: event.venue.lng ?? null,
            },
          }}
          portalSlug={portalSlug}
          isOpen={showNightSheet}
          onClose={() => setShowNightSheet(false)}
        />
      )}
    </div>
  );
}
