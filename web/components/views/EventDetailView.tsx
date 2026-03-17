"use client";

import { useState, useMemo } from "react";
import Image from "@/components/SmartImage";
import Skeleton from "@/components/Skeleton";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import FollowButton from "@/components/FollowButton";
import FriendsGoing from "@/components/FriendsGoing";
import WhosGoing from "@/components/WhosGoing";
import DirectionsDropdown from "@/components/DirectionsDropdown";
import RSVPButton from "@/components/RSVPButton";
import AddToCalendar from "@/components/AddToCalendar";
import ShareEventButton from "@/components/ShareEventButton";
import InviteToEventButton from "@/components/InviteToEventButton";
import SaveButton from "@/components/SaveButton";
import VenueVibes from "@/components/VenueVibes";
import LinkifyText from "@/components/LinkifyText";
import { formatTime, formatPriceDetailed } from "@/lib/formats";
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
import { isTicketingUrl } from "@/lib/card-utils";
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
  Ticket,
  ArrowCounterClockwise,
  ArrowLeft,
} from "@phosphor-icons/react";

const OutingPlannerSheet = dynamic(
  () => import("@/components/outing-planner/OutingPlannerSheet"),
  { ssr: false },
);

import { SectionHeader } from "@/components/detail/SectionHeader";
import { parseRecurrenceRule } from "@/lib/recurrence";
import NeonBackButton from "@/components/detail/NeonBackButton";
import DetailShell from "@/components/detail/DetailShell";
import DetailHeroImage from "@/components/detail/DetailHeroImage";
import { DetailStickyBar } from "@/components/detail/DetailStickyBar";
import Badge from "@/components/ui/Badge";
import Dot from "@/components/ui/Dot";
import { useDetailFetch } from "@/lib/hooks/useDetailFetch";
import { useDetailNavigation } from "@/lib/hooks/useDetailNavigation";

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
    venue_type?: string | null;
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

export type EventApiResponse = {
  event: EventData;
  eventArtists: EventArtist[];
  venueEvents: RelatedEvent[];
  nearbyEvents: RelatedEvent[];
  nearbyDestinations: NearbyDestinations;
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
        <h2 className="font-mono text-xs font-bold text-[var(--muted)] uppercase tracking-[0.14em]">
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
            <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-[0.14em] mb-2">
              This Event
            </p>
            <EntityTagList entityType="event" entityId={eventId} />
          </div>
          {venue && (
            <div>
              <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-[0.14em] mb-2">
                {venue.name}
              </p>
              <EntityTagList entityType="venue" entityId={venue.id} />
            </div>
          )}
          {producer && (
            <div>
              <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-[0.14em] mb-2">
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
  const [showNightSheet, setShowNightSheet] = useState(false);

  const fetchUrl = useMemo(
    () => {
      if (initialData) return null;
      if (!portal?.id) return null; // Wait for portal context
      return `/api/events/${eventId}?portal_id=${portal.id}`;
    },
    [eventId, portal?.id, initialData]
  );

  const { data: fetchedData, status, error, retry } = useDetailFetch<EventApiResponse>(
    fetchUrl,
    { entityLabel: "event" }
  );
  const data = initialData ?? fetchedData;

  // Derive data slices
  const event = data?.event ?? null;
  const eventArtists = useMemo(() => data?.eventArtists ?? [], [data]);
  const venueEvents = useMemo(() => data?.venueEvents ?? [], [data]);
  const nearbyEvents = useMemo(() => data?.nearbyEvents ?? [], [data]);
  const nearbyDestinations = useMemo<NearbyDestinations>(
    () => data?.nearbyDestinations ?? { food: [], drinks: [], nightlife: [], fun: [] },
    [data]
  );

  const allDestinations = useMemo(() => {
    const { food, drinks, nightlife, fun } = nearbyDestinations;
    const merged = [...food, ...drinks, ...nightlife, ...fun];
    return merged.sort((a, b) => {
      const aOpen = a.closesAt !== undefined ? 1 : 0;
      const bOpen = b.closesAt !== undefined ? 1 : 0;
      if (aOpen !== bOpen) return bOpen - aOpen;
      return (a.distance ?? 99) - (b.distance ?? 99);
    });
  }, [nearbyDestinations]);

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
  }, [event?.start_date, event?.start_time, event?.end_time]);

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

  // ── LOADING SKELETON ──────────────────────────────────────────────────
  if (status === "loading") {
    const skeletonTopBar = (
      <div className="flex items-center px-4 lg:px-6 py-3">
        <NeonBackButton onClose={onClose} floating={false} />
      </div>
    );
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
    return (
      <DetailShell
        topBar={skeletonTopBar}
        sidebar={skeletonSidebar}
        content={skeletonContent}
      />
    );
  }

  // ── ERROR STATE ───────────────────────────────────────────────────────
  if (error || !event) {
    return (
      <DetailShell
        onClose={onClose}
        singleColumn
        content={
          <div className="flex flex-col items-center justify-center py-20 px-4" role="alert">
            <p className="text-[var(--soft)] mb-6">{error || "Event not found"}</p>
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

  // ── DERIVED VALUES ────────────────────────────────────────────────────
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
  const hasLineup = displayParticipants.length > 0;

  // Price + date/time for sidebar
  const { text: priceText, isFree } = formatPriceDetailed(event);
  const dateObj = parseISO(event.start_date);
  const dateDisplay = event.end_date && event.end_date !== event.start_date
    ? `${format(dateObj, "MMM d")} – ${format(parseISO(event.end_date), "MMM d")}`
    : format(dateObj, "EEE, MMM d");
  const timeDisplay = event.is_all_day
    ? "All Day"
    : event.start_time
      ? (() => {
          const [hours, minutes] = event.start_time.split(":");
          const hour = parseInt(hours, 10);
          const period = hour >= 12 ? "PM" : "AM";
          const hour12 = hour % 12 || 12;
          return `${hour12}:${minutes} ${period}`;
        })()
      : "Time TBA";

  const isActuallyTicketed = isTicketingUrl(event.ticket_url);
  const sourceLooksTicketed = isTicketingUrl(event.source_url);

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
  const sidebarContent = (
    <div className="flex flex-col h-full">
      <ScopedStyles
        css={[heroAccentClass?.css, seriesColorClass?.css, festivalColorClass?.css].filter(Boolean).join("\n")}
      />

      {/* Hero image — compact */}
      <DetailHeroImage
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
            className={`w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--coral)] text-[var(--void)] text-base font-semibold rounded-lg hover:bg-[var(--rose)] transition-all shadow-[0_0_20px_rgba(255,107,122,0.3)] hover:shadow-[0_0_30px_rgba(255,107,122,0.5)] ${
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
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--coral)] text-[var(--void)] text-base font-semibold rounded-lg hover:bg-[var(--rose)] transition-all shadow-[0_0_20px_rgba(255,107,122,0.3)] hover:shadow-[0_0_30px_rgba(255,107,122,0.5)]"
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
            venueType={event.venue?.venue_type}
            variant="primary"
            className="w-full justify-center py-3 text-base"
          />
        )}

        {/* Secondary actions row */}
        <div className="flex items-center justify-center gap-1">
          {(event.ticket_url || event.source_url) && (
            <RSVPButton
              eventId={event.id}
              venueId={event.venue?.id}
              venueName={event.venue?.name}
              venueType={event.venue?.venue_type}
              variant="compact"
            />
          )}
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
          {event.venue && event.venue.lat != null && event.venue.lng != null && (
            <button
              onClick={() => setShowNightSheet(true)}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/30 transition-colors focus-ring"
              title="Plan Night"
            >
              <ForkKnife size={18} weight="duotone" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ── CONTENT ZONE ──────────────────────────────────────────────────────
  const contentZone = (
    <div className="px-4 lg:px-8 py-6 space-y-8">
      {/* ── PRIMARY: LINEUP ──────────────────────────────────── */}
      {hasLineup && (
        <div>
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

      {/* ── ABOUT ────────────────────────────────────────────── */}
      {descriptionText && (
        <div>
          <SectionHeader title="About" variant={hasLineup ? "divider" : "inline"} />
          <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed">
            <LinkifyText text={descriptionText} />
          </p>
        </div>
      )}

      {/* ── SOCIAL PROOF ─────────────────────────────────────── */}
      <SocialProofSection eventId={event.id} />

      {/* ── LOCATION ─────────────────────────────────────────── */}
      {event.venue && event.venue.address && (
        <div>
          <div className="flex items-center justify-between pt-6 border-t border-[var(--twilight)]/30 pb-3">
            <h2 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
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
            {event.venue.vibes && event.venue.vibes.length > 0 &&
              event.category && ["food_drink", "nightlife", "music"].includes(event.category) && (
              <VenueVibes vibes={event.venue.vibes} className="mt-2" />
            )}
            <GettingThereSection transit={event.venue} variant="compact" />
          </button>
        </div>
      )}

      {/* ── SERIES / FESTIVAL LINKS ──────────────────────────── */}
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

      {/* ── PRODUCER ─────────────────────────────────────────── */}
      {event.producer && (
        <div>
          <SectionHeader title="Presented by" variant="divider" />
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
                <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-[0.14em]">
                  {event.producer.org_type?.replace(/_/g, " ")}
                </p>
              </div>
            </div>
            <FollowButton targetProducerId={event.producer.id} size="sm" />
          </div>
        </div>
      )}

      {/* ── TAGS ─────────────────────────────────────────────── */}
      <div className="border-t border-[var(--twilight)]/30 pt-5 space-y-3">
        {event.tags && event.tags.length > 0 && (
          <div className="mb-4">
            <h3 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)] pb-3">
              Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {event.tags.map((tag) => (
                <Badge key={tag} variant="alert">{tag.replace(/-/g, " ")}</Badge>
              ))}
            </div>
          </div>
        )}

        <CommunityTagsSection
          eventId={event.id}
          venue={event.venue}
          producer={event.producer}
        />

        <FlagButton
          entityType="event"
          entityId={event.id}
          entityName={event.title}
        />
      </div>

      {/* ── DISCOVERY: AROUND HERE ───────────────────────────── */}
      <AroundHereSection
        venueEvents={venueEvents}
        nearbyEvents={nearbyEvents}
        destinations={allDestinations}
        venueName={event.venue?.name}
        neighborhood={event.venue?.neighborhood}
        portalSlug={portalSlug}
        venueType={event.venue?.venue_type}
        onSpotClick={handleSpotClick}
        onEventClick={handleEventClick}
      />
    </div>
  );

  // ── TOP BAR ───────────────────────────────────────────────────────────
  const topBar = (
    <div className="flex items-center justify-between px-4 lg:px-6 py-3">
      <NeonBackButton onClose={onClose} floating={false} />
      <div className="flex items-center gap-1">
        <SaveButton eventId={event.id} size="sm" />
        <ShareEventButton eventId={event.id} eventTitle={event.title} variant="icon" />
      </div>
    </div>
  );

  // ── BOTTOM BAR (mobile only) ──────────────────────────────────────────
  const bottomBar = primaryCtaUrl && primaryCtaLabel ? (
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
          venueType={event.venue?.venue_type}
          variant="compact"
        />
      }
    />
  ) : null;

  return (
    <>
      <DetailShell
        topBar={topBar}
        sidebar={sidebarContent}
        content={contentZone}
        bottomBar={bottomBar}
      />

      {/* Outing Planner */}
      {showNightSheet && event.venue && (
        <OutingPlannerSheet
          anchor={{
            type: "event",
            event: {
              id: event.id,
              title: event.title,
              start_date: event.start_date,
              start_time: event.start_time,
              end_time: event.end_time,
              is_all_day: event.is_all_day,
              category_id: event.category,
              venue: {
                id: event.venue.id,
                name: event.venue.name,
                slug: event.venue.slug,
                lat: event.venue.lat ?? null,
                lng: event.venue.lng ?? null,
              },
            },
          }}
          portalId={portal?.id || ""}
          portalSlug={portalSlug}
          portalVertical={portal?.settings?.vertical}
          isOpen={showNightSheet}
          onClose={() => setShowNightSheet(false)}
        />
      )}
    </>
  );
}
