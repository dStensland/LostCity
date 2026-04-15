"use client";

import { useMemo, useState, type ReactNode } from "react";
import Skeleton from "@/components/Skeleton";
import { getCategoryColor } from "@/components/CategoryIcon";
import FriendsGoing from "@/components/FriendsGoing";
import WhosGoing from "@/components/WhosGoing";
import DirectionsDropdown from "@/components/DirectionsDropdown";
import RSVPButton from "@/components/RSVPButton";
import AddToCalendar from "@/components/AddToCalendar";
import ShareEventButton from "@/components/ShareEventButton";
import InviteToEventButton from "@/components/InviteToEventButton";
import SaveButton from "@/components/SaveButton";
import PlaceVibes from "@/components/PlaceVibes";
import LinkifyText from "@/components/LinkifyText";
import { formatTime, formatPriceDetailed } from "@/lib/formats";
import { format, parseISO } from "date-fns";
import { getSeriesTypeLabel, getSeriesTypeColor } from "@/lib/series-utils";
import NearbySection, { type NearbySpots } from "@/components/NearbySection";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { isDogPortal } from "@/lib/dog-art";
import { usePortal } from "@/lib/portal-context";
import { getDisplayParticipants, getLineupLabels, type EventArtist } from "@/lib/artists-utils";
import { RichArtistCard } from "@/components/detail/RichArtistCard";
import { ProducerSection } from "@/components/detail/ProducerSection";
import GettingThereSection from "@/components/GettingThereSection";
import { deriveShowSignals } from "@/lib/show-signals";
import ShowSignalsPanel from "@/components/ShowSignalsPanel";
import { isTicketingUrl } from "@/lib/card-utils";
import dynamic from "next/dynamic";
import {
  CaretRight,
  ArrowSquareOut,
  FrameCorners,
  Repeat,
  Flag,
  Ticket,
  ArrowCounterClockwise,
  ArrowLeft,
} from "@phosphor-icons/react";

const HangButton = dynamic(
  () => import("@/components/hangs/HangButton").then((m) => ({ default: m.HangButton })),
  { ssr: false },
);

import { SectionHeader } from "@/components/detail/SectionHeader";
import { parseRecurrenceRule } from "@/lib/recurrence";
import DetailShell from "@/components/detail/DetailShell";
import DetailHeroImage from "@/components/detail/DetailHeroImage";
import { DetailStickyBar } from "@/components/detail/DetailStickyBar";
import Badge from "@/components/ui/Badge";
import Dot from "@/components/ui/Dot";
import { useDetailFetch } from "@/lib/hooks/useDetailFetch";
import { useDetailNavigation } from "@/lib/hooks/useDetailNavigation";
import { ContentSwap } from "@/components/ui/ContentSwap";
import { DETAIL_HERO_SKELETON_HEIGHT } from "@/components/skeletons/DetailHeroSkeleton";

// ─── Description cleaner ─────────────────────────────────────────────────────

/**
 * Strip crawler extraction artifacts from event descriptions.
 * Some crawlers produce descriptions like "Event name [title] Description [body]"
 * — raw key-value pairs that should never reach the user.
 */
function cleanDescription(desc: string | null | undefined): string | null {
  if (!desc) return null;
  const cleaned = desc
    // Strip "Event name [anything] Description " prefix from crawler key-value artifacts
    .replace(/^Event name\s+.+?\s+Description\s+/i, "")
    // Strip trailing "[...]\n" truncation markers
    .replace(/\[\.\.\.\]\s*\\n/g, "")
    .trim();
  return cleaned || null;
}

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
  // Taxonomy v2 derived attributes
  cost_tier?: string | null;
  duration?: string | null;
  booking_required?: boolean | null;
  indoor_outdoor?: string | null;
  significance?: string | null;
  significance_signals?: string[] | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    address: string | null;
    neighborhood: string | null;
    city: string;
    state: string;
    vibes: string[] | null;
    place_type?: string | null;
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
    org_type: string | null;
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
  category?: string | null;
  is_free?: boolean;
  price_min?: number | null;
  distance?: number;
  proximity_label?: string;
  venue: { id: number; name: string; slug: string; city?: string; neighborhood?: string | null; location_designator?: string } | null;
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
};

export type EventApiResponse = {
  event: EventData;
  eventArtists: EventArtist[];
  venueEvents: RelatedEvent[];
  nearbyEvents: RelatedEvent[];
  nearbyDestinations: NearbySpots;
};

interface EventDetailViewProps {
  eventId: number;
  portalSlug: string;
  onClose: () => void;
  /** Server-fetched data — skips client fetch when provided */
  initialData?: EventApiResponse;
}

function isExhibition(event: EventData): boolean {
  return event.genres?.includes("exhibition") || event.series?.series_type === "exhibition";
}

/** Wraps FriendsGoing + WhosGoing — WhosGoing handles its own empty state */
function SocialProofSection({ eventId }: { eventId: number }) {
  return (
    <div>
      <FriendsGoing eventId={eventId} className="mb-4" />
      <WhosGoing eventId={eventId} />
    </div>
  );
}


export default function EventDetailView({ eventId, portalSlug, onClose, initialData }: EventDetailViewProps) {
  const { portal } = usePortal();
  const { toEvent: handleEventClick, toSpot: handleSpotClick, toSeries: handleSeriesClick, toFestival: handleFestivalClick } = useDetailNavigation(portalSlug);
  const fetchUrl = useMemo(
    () => {
      if (initialData) return null;
      if (!portal?.id) return null; // Wait for portal context
      return `/api/events/${eventId}?portal_id=${portal.id}`;
    },
    [eventId, portal?.id, initialData]
  );

  const { data: fetchedData, status, error: fetchError, retry } = useDetailFetch<EventApiResponse>(
    fetchUrl,
    { entityLabel: "event" }
  );
  const data = initialData ?? fetchedData;
  const isLoading = status === "loading";

  // Derive data slices
  const event = data?.event ?? null;
  const eventArtists = useMemo(() => data?.eventArtists ?? [], [data]);
  const venueEvents = useMemo(() => data?.venueEvents ?? [], [data]);
  const nearbyEvents = useMemo(() => data?.nearbyEvents ?? [], [data]);
  const nearbySpots = useMemo<NearbySpots>(
    () => data?.nearbyDestinations ?? { food: [], drinks: [], nightlife: [], caffeine: [], fun: [] },
    [data]
  );

  // Hooks that depend on event — must be called unconditionally (before early returns)
  const isLive = useMemo(() => {
    if (!event?.start_date || !event.start_time) return false;
    const now = new Date();
    const eventDate = new Date(event.start_date + "T00:00:00");
    const isToday = eventDate.toDateString() === now.toDateString();
    if (!isToday) return false;
    const [hours, minutes] = event.start_time.split(":").map(Number);
    const eventStart = new Date(eventDate);
    eventStart.setHours(hours, minutes, 0, 0);
    const eventEnd = new Date(eventStart);
    if (event.end_time) {
      const [endH, endM] = event.end_time.split(":").map(Number);
      eventEnd.setHours(endH, endM, 0, 0);
    } else {
      eventEnd.setHours(eventStart.getHours() + 3, eventStart.getMinutes(), 0, 0);
    }
    return now >= eventStart && now <= eventEnd;
  }, [event]);

  const displayParticipants = useMemo(
    () => event ? getDisplayParticipants(eventArtists, { eventTitle: event.title, eventCategory: event.category }) : [],
    [eventArtists, event?.title, event?.category, event]
  );
  const participantLabels = useMemo(
    () => event
      ? getLineupLabels(displayParticipants, { eventCategory: event.category })
      : { sectionTitle: "Lineup", headlinerLabel: "Headliner", supportLabel: "Support", artistNoun: "artist", descriptionLead: "", grouping: "flat" as const },
    [displayParticipants, event?.category, event]
  );

  // Expand/collapse for rich artist lineup (max 5 visible before expand)
  const [lineupExpanded, setLineupExpanded] = useState(false);
  const LINEUP_PREVIEW_COUNT = 5;

  // ── ERROR STATE ───────────────────────────────────────────────────────
  // Only show error when not still loading — during loading, event is null but that's expected.
  if (!isLoading && (fetchError || !event)) {
    return (
      <DetailShell
        onClose={onClose}
        singleColumn
        content={
          <div className="flex flex-col items-center justify-center py-20 px-4" role="alert">
            <p className="text-[var(--soft)] mb-6">{fetchError || "Event not found"}</p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--dusk)] transition-colors font-mono text-sm focus-ring"
              >
                <ArrowLeft size={16} weight="bold" />
                Go Back
              </button>
              <button
                onClick={retry}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:brightness-110 transition-all focus-ring"
              >
                <ArrowCounterClockwise size={16} weight="bold" />
                Try Again
              </button>
            </div>
          </div>
        }
      />
    );
  }

  // ── LOADING SKELETON ──────────────────────────────────────────────────
  const skeletonSidebar = (
    <div role="status" aria-label="Loading event details">
      <Skeleton className="aspect-video lg:aspect-[16/10] w-full" />
      <div className="px-5 pt-4 pb-3 space-y-2">
        <Skeleton className="h-7 w-[80%] rounded" delay="0.1s" />
        <Skeleton className="h-4 w-[50%] rounded" delay="0.14s" />
        <Skeleton className="h-4 w-[60%] rounded" delay="0.18s" />
      </div>
      <div className="mx-5 border-t border-[var(--twilight)]/40" />
      <div className="px-5 py-3 flex gap-1.5">
        <Skeleton className="h-6 w-16 rounded-full" delay="0.22s" />
        <Skeleton className="h-6 w-20 rounded-full" delay="0.24s" />
      </div>
      <div className="mx-5 border-t border-[var(--twilight)]/40" />
      <div className="px-5 py-3">
        <Skeleton className="h-12 w-full rounded-lg" delay="0.28s" />
      </div>
    </div>
  );
  const skeletonContent = (
    <div className="p-4 lg:p-8 space-y-6">
      <Skeleton className="h-3 w-32 rounded" delay="0.3s" />
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-lg" delay="0.34s" />
        <Skeleton className="h-10 w-full rounded-lg" delay="0.38s" />
        <Skeleton className="h-10 w-full rounded-lg" delay="0.42s" />
      </div>
    </div>
  );

  // ── LOADED CONTENT ────────────────────────────────────────────────────
  // All event-dependent values and JSX are computed inside this block.
  // During loading, event is null — ContentSwap shows the skeleton instead.
  // After load, event is non-null and ContentSwap crossfades to this content.
  let sidebarContent: ReactNode = null;
  let contentZone: ReactNode = null;
  let topBar: ReactNode = null;
  let bottomBar: ReactNode = null;

  if (event) {
  const isDog = isDogPortal(portalSlug);
  const recurrenceText = parseRecurrenceRule(event.recurrence_rule);
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

  const descriptionText = cleanDescription(event.display_description || event.description);
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
    // "Tickets available" is redundant with the Get Tickets CTA — only show actionable statuses
    ticketStatus: derivedSignals.ticketStatus === "Tickets available" ? null : derivedSignals.ticketStatus,
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
  const hasLineup = displayParticipants.length > 0;

  // Taxonomy v2 duration labels
  const DETAIL_DURATION_LABELS: Record<string, string> = {
    "short": "~1 hour",
    "medium": "2-3 hours",
    "half-day": "Half day",
    "full-day": "Full day",
    "multi-day": "Multiple days",
  };

  // Price + date/time for sidebar
  const { text: priceText, isFree } = formatPriceDetailed(event);
  const dateObj = parseISO(event.start_date);
  const dateDisplay = event.end_date && event.end_date !== event.start_date
    ? `${format(dateObj, "MMM d")} – ${format(parseISO(event.end_date), "MMM d")}`
    : format(dateObj, "EEE, MMM d");
  const hasRealTime = event.start_time && event.start_time !== "00:00:00" && event.start_time !== "00:00";
  const timeDisplay = event.is_all_day
    ? "All Day"
    : hasRealTime
      ? (() => {
          const [hours, minutes] = event.start_time!.split(":");
          const hour = parseInt(hours, 10);
          const period = hour >= 12 ? "PM" : "AM";
          const hour12 = hour % 12 || 12;
          return `${hour12}:${minutes} ${period}`;
        })()
      : "Time TBA";

  const isActuallyTicketed = isTicketingUrl(event.ticket_url);
  const sourceLooksTicketed = isTicketingUrl(event.source_url);
  const venueAddressContainsCity = event.venue?.address?.includes(event.venue.city) ?? false;

  // Hero overlay (LIVE badge + source attribution)
  const heroOverlay = (
    <>
      {isLive && (
        <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 bg-[var(--coral)] text-[var(--void)] rounded-full font-mono text-xs font-medium z-10">
          <span className="w-2 h-2 bg-[var(--void)] rounded-full animate-pulse" />
          LIVE NOW
        </div>
      )}
      {event.source_url && !isLive && (
        <a
          href={event.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-2xs font-mono text-[var(--muted)] hover:text-[var(--soft)] transition-colors z-10 focus-ring"
          title="View original source"
        >
          <ArrowSquareOut size={12} weight="light" className="inline-block mr-1 -mt-0.5" />
          Source
        </a>
      )}
    </>
  );

  // Primary CTA info for mobile sticky bar
  const primaryCtaUrl = event.ticket_url || event.source_url;
  const primaryCtaLabel = event.ticket_url
    ? (isLive ? "Join Now" : isActuallyTicketed ? "Get Tickets" : event.is_free ? "RSVP Free" : "Learn More")
    : event.source_url
      ? (event.is_free ? "RSVP Free" : "Get Tickets")
      : null;

  // ── SIDEBAR ───────────────────────────────────────────────────────────
  sidebarContent = (
    <div className="flex flex-col h-full">
      <ScopedStyles
        css={[heroAccentClass?.css, seriesColorClass?.css, festivalColorClass?.css].filter(Boolean).join("\n")}
      />

      {/* Hero image — compact */}
      <DetailHeroImage
        entityId={event.id}
        imageUrl={event.image_url}
        alt={event.title}
        category={event.category || "other"}
        isLive={isLive}
        priority
        overlay={heroOverlay}
      />

      {/* Identity */}
      <div className="px-5 pt-4 pb-3 space-y-2">
        {/* Title */}
        <h1 className="text-xl lg:text-2xl font-bold text-[var(--cream)] leading-tight">
          {event.title}
        </h1>

        {/* Venue link + neighborhood */}
        {event.venue && (
          <button
            onClick={() => handleSpotClick(event.venue!.slug)}
            className="text-sm text-[var(--soft)] hover:text-[var(--coral)] transition-colors text-left focus-ring"
          >
            {event.venue.name}
            {event.venue.neighborhood && (
              <span className="text-[var(--muted)]"> · {event.venue.neighborhood}</span>
            )}
          </button>
        )}

        {/* Date + Time + Price */}
        <p className="text-sm flex items-center gap-1.5 flex-wrap">
          <span className="text-[var(--cream)] font-medium">{dateDisplay}</span>
          <Dot />
          <span className="text-[var(--soft)]">{timeDisplay}</span>
          {priceText && (
            <>
              <Dot />
              <span className={`font-mono font-bold ${isFree ? "text-[var(--neon-green)]" : "text-[var(--gold)]"}`}>
                {priceText}
              </span>
            </>
          )}
        </p>

        {/* Taxonomy v2 derived attributes */}
        {(event.cost_tier || event.duration || event.indoor_outdoor || event.booking_required) && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            {event.cost_tier && event.cost_tier !== "free" && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-2xs font-medium text-[var(--gold)] bg-[var(--gold)]/10 border border-[var(--gold)]/25 uppercase tracking-wide">
                {event.cost_tier}
              </span>
            )}
            {event.duration && DETAIL_DURATION_LABELS[event.duration] && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-2xs text-[var(--muted)] bg-[var(--twilight)]/40">
                {DETAIL_DURATION_LABELS[event.duration]}
              </span>
            )}
            {event.indoor_outdoor && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-2xs text-[var(--muted)] bg-[var(--twilight)]/40 capitalize">
                {event.indoor_outdoor === "both" ? "Indoor & Outdoor" : event.indoor_outdoor}
              </span>
            )}
            {event.booking_required && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-2xs text-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/20">
                Book ahead
              </span>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-[var(--twilight)]/40" />

      {/* Genre pills */}
      {event.genres && event.genres.length > 0 && (
        <div className="px-5 py-3 flex flex-wrap gap-1.5">
          {event.genres.slice(0, 5).map((genre) => (
            <Badge key={genre} variant="neutral" size="sm">{genre.replace(/-/g, " ")}</Badge>
          ))}
        </div>
      )}

      {/* Exhibition info (compact) */}
      {isExhibition(event) && (
        <div className="px-5 py-2">
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--neon-amber)]/30 bg-[var(--neon-amber)]/5">
            <FrameCorners size={18} weight="light" className="text-[var(--neon-amber)] flex-shrink-0" aria-hidden="true" />
            <div className="text-sm">
              <span className="text-[var(--cream)] font-medium">Exhibition</span>
              {event.end_date && (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const endDate = parseISO(event.end_date!);
                const startDate = parseISO(event.start_date);
                if (startDate > today) {
                  return <span className="text-[var(--muted)]"> · Opens {format(startDate, "MMM d")}</span>;
                }
                return <span className="text-[var(--muted)]"> · Through {format(endDate, "MMM d")}</span>;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Recurring badge (compact, non-exhibition) */}
      {!isExhibition(event) && event.is_recurring && recurrenceText && (
        <div className="px-5 py-2">
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)]">
            <Repeat size={18} weight="light" className="text-[var(--coral)] flex-shrink-0" aria-hidden="true" />
            <span className="text-sm text-[var(--cream)]">Repeats {recurrenceText.toLowerCase()}</span>
          </div>
        </div>
      )}

      {/* Show Signals */}
      {hasShowSignals && (
        <div className="px-5 py-2">
          <ShowSignalsPanel signals={showSignals} ticketUrl={event.ticket_url} />
        </div>
      )}

      {/* Dog-friendly tags */}
      {isDog && dogTags.length > 0 && (
        <>
          <div className="mx-5 border-t border-[var(--twilight)]/40" />
          <div className="px-5 py-2 flex flex-wrap gap-2">
            {dogTags.map((tag) => (
              <Badge key={tag} variant="alert">
                {tag === "dog-friendly" && "🐾 Dog Friendly"}
                {tag === "pets" && "🐕 Pet Event"}
                {tag === "adoption" && "❤️ Adoption"}
                {tag === "outdoor" && "🌳 Outdoor"}
                {tag === "family-friendly" && "👨‍👩‍👧 Family Friendly"}
              </Badge>
            ))}
          </div>
        </>
      )}

      {/* Spacer (pushes actions to bottom on desktop) */}
      <div className="hidden lg:flex flex-1" />

      {/* Divider before actions */}
      <div className="mx-5 border-t border-[var(--twilight)]/40" />

      {/* Primary CTA */}
      <div className="px-5 py-3 space-y-2.5">
        {event.ticket_url ? (
          <a
            href={event.ticket_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--action-primary)] text-[var(--void)] text-base font-semibold rounded-lg hover:opacity-90 transition-all shadow-[0_0_20px_rgba(var(--portal-primary-rgb),0.3)] hover:shadow-[0_0_30px_rgba(var(--portal-primary-rgb),0.5)] ${
              isLive ? "animate-pulse-glow" : ""
            }`}
          >
            {isActuallyTicketed ? (
              <Ticket size={20} weight="bold" />
            ) : (
              <ArrowSquareOut size={20} weight="bold" />
            )}
            {isLive ? "Join Now" : isActuallyTicketed ? "Get Tickets" : event.is_free ? "RSVP Free" : "Learn More"}
          </a>
        ) : event.source_url ? (
          <a
            href={event.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--action-primary)] text-[var(--void)] text-base font-semibold rounded-lg hover:opacity-90 transition-all shadow-[0_0_20px_rgba(var(--portal-primary-rgb),0.3)] hover:shadow-[0_0_30px_rgba(var(--portal-primary-rgb),0.5)]"
          >
            {sourceLooksTicketed || !event.is_free ? (
              <Ticket size={20} weight="bold" />
            ) : (
              <ArrowSquareOut size={20} weight="bold" />
            )}
            {event.is_free ? "RSVP Free" : "Get Tickets"}
          </a>
        ) : (
          <RSVPButton
            eventId={event.id}
            venueId={event.venue?.id}
            venueName={event.venue?.name}
            venueType={event.venue?.place_type}
            variant="primary"
            className="w-full justify-center py-3 text-base"
          />
        )}

        {/* RSVP + Hang row — only when primary CTA is an external link */}
        {(event.ticket_url || event.source_url) && (
          <div className="flex gap-2">
            <RSVPButton
              eventId={event.id}
              venueId={event.venue?.id}
              venueName={event.venue?.name}
              venueType={event.venue?.place_type}
              size="sm"
              className="flex-1 min-h-[36px]"
            />
            {event.venue && (
              <HangButton
                venue={{
                  id: event.venue.id,
                  name: event.venue.name,
                  slug: event.venue.slug,
                  image_url: null,
                  neighborhood: event.venue.neighborhood,
                }}
                event={{ id: event.id, title: event.title }}
                rounded="xl"
                className="flex-1 min-h-[36px]"
              />
            )}
          </div>
        )}

        {/* Hang button alone when RSVPButton is the primary CTA */}
        {!event.ticket_url && !event.source_url && event.venue && (
          <HangButton
            venue={{
              id: event.venue.id,
              name: event.venue.name,
              slug: event.venue.slug,
              image_url: null,
              neighborhood: event.venue.neighborhood,
            }}
            event={{ id: event.id, title: event.title }}
            rounded="xl"
            className="w-full min-h-[36px]"
          />
        )}

        {/* Icon actions row */}
        <div className="flex items-center justify-center gap-2">
          <InviteToEventButton eventId={event.id} eventTitle={event.title} variant="icon" />
          <AddToCalendar
            eventId={event.id}
            title={event.title}
            date={event.start_date}
            time={event.start_time}
            venue={event.venue?.name}
            address={event.venue?.address}
            city={event.venue?.city}
            state={event.venue?.state}
            variant="icon"
          />
          <ShareEventButton eventId={event.id} eventTitle={event.title} variant="icon" />
        </div>
      </div>
    </div>
  );

  // ── CONTENT ZONE ──────────────────────────────────────────────────────
  contentZone = (
    <div className="px-4 lg:px-8 py-6 space-y-8">
      {/* ── 1. ABOUT ─────────────────────────────────────────── */}
      {descriptionText && (
        <div>
          <SectionHeader title="About" variant="inline" />
          <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed">
            <LinkifyText text={descriptionText} />
          </p>
        </div>
      )}

      {/* ── 2. LOCATION ──────────────────────────────────────── */}
      {event.venue && event.venue.address && (
        <div>
          <SectionHeader
            title="Location"
            rightAction={
              <DirectionsDropdown
                venueName={event.venue.name}
                address={event.venue.address}
                city={event.venue.city}
                state={event.venue.state}
              />
            }
          />
          <button
            onClick={() => handleSpotClick(event.venue!.slug)}
            className="block w-full text-left p-3 rounded-lg border border-[var(--twilight)] transition-colors hover:border-[var(--coral)]/50 group bg-[var(--void)] focus-ring"
          >
            <p className="text-[var(--soft)]">
              <span className="flex items-center gap-1 flex-wrap">
                <span className="text-[var(--cream)] font-medium group-hover:text-[var(--coral)] transition-colors">
                  {event.venue.name}
                </span>
                <CaretRight size={16} weight="bold" className="text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0" />
                {event.venue.place_type && (
                  <span className="text-xs font-mono text-[var(--muted)] bg-[var(--twilight)]/50 px-1.5 py-0.5 rounded capitalize">
                    {event.venue.place_type.replace(/_/g, " ")}
                  </span>
                )}
              </span>
              <span className="block text-sm text-[var(--muted)] mt-0.5">
                {event.venue.address}{!venueAddressContainsCity && ` · ${event.venue.city}, ${event.venue.state}`}
              </span>
            </p>
            {event.venue.vibes && event.venue.vibes.length > 0 &&
              event.category && ["food_drink", "nightlife", "music"].includes(event.category) && (
              <PlaceVibes vibes={event.venue.vibes} className="mt-2" />
            )}
            <GettingThereSection transit={event.venue} variant="compact" />
          </button>
        </div>
      )}

      {/* ── 3. LINEUP ────────────────────────────────────────── */}
      {hasLineup && (() => {
        const isTiered = participantLabels.grouping === "tiered";
        const headliners = displayParticipants.filter(
          (a) => a.is_headliner || a.billing_order === 1
        );
        const support = displayParticipants.filter(
          (a) => !a.is_headliner && a.billing_order !== 1
        );
        const allVisible = lineupExpanded
          ? displayParticipants
          : displayParticipants.slice(0, LINEUP_PREVIEW_COUNT);
        const visibleHeadliners = lineupExpanded
          ? headliners
          : headliners.slice(0, LINEUP_PREVIEW_COUNT);
        const visibleSupport = lineupExpanded
          ? support
          : support.slice(
              0,
              Math.max(0, LINEUP_PREVIEW_COUNT - visibleHeadliners.length)
            );
        const hasMore = displayParticipants.length > LINEUP_PREVIEW_COUNT;

        return (
          <div>
            <SectionHeader
              title={participantLabels.sectionTitle}
              count={displayParticipants.length}
              variant="divider"
              className="mb-1"
            />

            {isTiered ? (
              <div className="space-y-2">
                {visibleHeadliners.length > 0 && (
                  <>
                    {visibleHeadliners.length > 0 && visibleSupport.length > 0 && (
                      <p className="font-mono text-2xs uppercase tracking-[0.12em] text-[var(--muted)] pt-1">
                        {participantLabels.headlinerLabel}
                      </p>
                    )}
                    {visibleHeadliners.map((a) => (
                      <RichArtistCard key={a.id} artist={a} portalSlug={portalSlug} />
                    ))}
                  </>
                )}
                {visibleSupport.length > 0 && (
                  <>
                    <p className="font-mono text-2xs uppercase tracking-[0.12em] text-[var(--muted)] pt-2">
                      {participantLabels.supportLabel}
                    </p>
                    {visibleSupport.map((a) => (
                      <RichArtistCard key={a.id} artist={a} portalSlug={portalSlug} />
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {allVisible.map((a) => (
                  <RichArtistCard key={a.id} artist={a} portalSlug={portalSlug} />
                ))}
              </div>
            )}

            {hasMore && !lineupExpanded && (
              <button
                onClick={() => setLineupExpanded(true)}
                className="mt-3 w-full py-2.5 text-sm font-medium text-[var(--soft)] hover:text-[var(--cream)] border border-[var(--twilight)] rounded-lg hover:bg-[var(--card-bg-hover)] transition-colors"
              >
                See all {displayParticipants.length} {participantLabels.artistNoun}
              </button>
            )}
          </div>
        );
      })()}

      {/* ── 3b. PRODUCER ─────────────────────────────────────── */}
      {event.producer && (
        <ProducerSection producer={event.producer} portalSlug={portalSlug} />
      )}

      {/* ── 4. SOCIAL PROOF ──────────────────────────────────── */}
      <SocialProofSection eventId={event.id} />

      {/* ── 5. SERIES / FESTIVAL LINKS ───────────────────────── */}
      {event.series && (
        <div className="pt-6 border-t border-[var(--twilight)]/30 space-y-3">
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

      {/* ── 6. AROUND HERE (matching venue detail pattern) ──── */}
      {/* Hidden on civic portals: nearby restaurants/bars are irrelevant to civic events */}
      {portal.settings?.vertical !== "community" && (
        <NearbySection
          nearbySpots={nearbySpots}
          venueEvents={venueEvents}
          nearbyEvents={nearbyEvents}
          venueName={event.venue?.name}
          onSpotClick={handleSpotClick}
          onEventClick={handleEventClick}
        />
      )}
    </div>
  );

  // ── TOP BAR ───────────────────────────────────────────────────────────
  topBar = (
    <div className="flex items-center justify-end px-4 lg:px-6 py-3">
      <div className="flex items-center gap-1">
        <SaveButton eventId={event.id} size="sm" />
        <ShareEventButton eventId={event.id} eventTitle={event.title} variant="icon" />
      </div>
    </div>
  );

  // ── BOTTOM BAR (mobile only) ──────────────────────────────────────────
  bottomBar = primaryCtaUrl && primaryCtaLabel ? (
    <DetailStickyBar
      className="lg:hidden"
      primaryAction={{
        label: primaryCtaLabel,
        href: primaryCtaUrl,
        icon: <Ticket size={18} weight="bold" />,
      }}
      secondaryActions={
        <RSVPButton
          eventId={event.id}
          venueId={event.venue?.id}
          venueName={event.venue?.name}
          venueType={event.venue?.place_type}
          variant="compact"
        />
      }
    />
  ) : null;

  } // end if (event)

  // ── RENDER ────────────────────────────────────────────────────────────
  const swapKey = isLoading ? "skeleton" : "loaded";
  const fetchErrorObj = fetchError ? new Error(fetchError) : null;

  return (
    <DetailShell
      topBar={topBar ?? undefined}
      sidebar={
        <ContentSwap
          swapKey={swapKey}
          error={fetchErrorObj}
          minHeight={DETAIL_HERO_SKELETON_HEIGHT}
        >
          {isLoading ? skeletonSidebar : sidebarContent}
        </ContentSwap>
      }
      content={
        <ContentSwap
          swapKey={swapKey}
          error={fetchErrorObj}
        >
          {isLoading ? skeletonContent : contentZone}
        </ContentSwap>
      }
      bottomBar={bottomBar ?? undefined}
    />
  );
}
