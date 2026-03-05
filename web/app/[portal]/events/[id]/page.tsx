import ScrollToTop from "@/components/ScrollToTop";
import { getEventById, getRelatedEvents } from "@/lib/supabase";
import { getNearbySpots, getSpotTypeLabel } from "@/lib/spots";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { getSeriesTypeLabel, getSeriesTypeColor } from "@/lib/series";
import Image from "@/components/SmartImage";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import FollowButton from "@/components/FollowButton";
import FriendsGoing from "@/components/FriendsGoing";
import WhosGoing from "@/components/WhosGoing";
import { fetchSocialProofCounts } from "@/lib/social-proof";
import { GenreChip } from "@/components/ActivityChip";
import { PortalHeader } from "@/components/headers";
import { format, parseISO } from "date-fns";
import { parseRecurrenceRule } from "@/lib/recurrence";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isTicketingUrl } from "@/lib/card-utils";
import DirectionsDropdown from "@/components/DirectionsDropdown";
import VenueVibes from "@/components/VenueVibes";
import GettingThereSection from "@/components/GettingThereSection";
import LinkifyText from "@/components/LinkifyText";
import { formatTime, formatTimeSplit, formatPriceDetailed, safeJsonLd } from "@/lib/formats";
import VenueTagList from "@/components/VenueTagList";
import FlagButton from "@/components/FlagButton";
import LiveIndicator from "@/components/LiveIndicator";
import RSVPButton from "@/components/RSVPButton";
import AddToCalendar from "@/components/AddToCalendar";
import { EntityTagList } from "@/components/tags/EntityTagList";
import { SaveToListButton } from "@/components/SaveToListButton";
import { getEventArtists } from "@/lib/artists";
import { getDisplayParticipants, getLineupLabels } from "@/lib/artists-utils";
import LineupSection from "@/components/LineupSection";
import {
  DetailHero,
  InfoCard,
  MetadataGrid,
  SectionHeader,
  RelatedSection,
  RelatedCard,
  DetailStickyBar,
  DescriptionTeaser,
  SocialProofStrip,
} from "@/components/detail";
import VenueEventsByDay from "@/components/VenueEventsByDay";
import ScopedStylesServer from "@/components/ScopedStylesServer";
import { createCssVarClass } from "@/lib/css-utils";
import { cache } from "react";
import { buildDisplayDescription } from "@/lib/event-description";
import { buildBreadcrumbSchema } from "@/lib/breadcrumb-schema";
import { deriveShowSignals } from "@/lib/show-signals";
import ShowSignalsPanel from "@/components/ShowSignalsPanel";
import { inferLineupGenreFallback } from "@/lib/artist-fallbacks";
import {
  suppressEventImageIfVenueFlagged,
  suppressEventImagesIfVenueFlagged,
} from "@/lib/image-quality-suppression";
import OutingPlannerButton from "@/components/outing-planner/OutingPlannerButton";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string; id: string }>;
};

// Cache event fetch + image suppression to avoid duplicate work in metadata + page render.
const getCachedEventById = cache(async (id: number) => {
  const event = await getEventById(id);
  return event ? suppressEventImageIfVenueFlagged(event) : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, portal: portalSlug } = await params;
  const event = await getCachedEventById(parseInt(id, 10));
  const portal = await getCachedPortalBySlug(portalSlug);

  if (!event) {
    return {
      title: "Event Not Found | Lost City",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const portalName = portal?.name || "Lost City";
  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEEE, MMMM d, yyyy");
  const venueName = event.venue?.name || "TBA";
  const description = event.description
    ? event.description.slice(0, 160)
    : `${event.title} at ${venueName} on ${formattedDate}. Discover more events with ${portalName}.`;

  return {
    title: `${event.title} | ${venueName} | ${portalName}`,
    description,
    alternates: {
      canonical: `/${portalSlug}/events/${event.id}`,
    },
    openGraph: {
      title: event.title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
    },
  };
}


type EventWithOrganization = NonNullable<Awaited<ReturnType<typeof getEventById>>>;

function getLocationDesignatorLabel(
  designator:
    | "standard"
    | "private_after_signup"
    | "virtual"
    | "recovery_meeting"
    | null
    | undefined
): string | null {
  if (!designator || designator === "standard") return null;
  if (designator === "private_after_signup") return "Location after RSVP";
  if (designator === "virtual") return "Virtual event";
  if (designator === "recovery_meeting") return "Recovery meeting";
  return null;
}

function generateEventSchema(event: EventWithOrganization) {
  const locationDesignator = event.venue?.location_designator || "standard";
  const isVirtualLocation = locationDesignator === "virtual";
  const startDateTime = event.start_time
    ? `${event.start_date}T${event.start_time}:00`
    : event.start_date;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: startDateTime,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: isVirtualLocation
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
  };

  // End date (Google wants this)
  if (event.end_date) {
    const endDateTime = event.end_time
      ? `${event.end_date}T${event.end_time}:00`
      : event.end_date;
    schema.endDate = endDateTime;
  } else if (event.start_time) {
    // Estimate 2-3 hour duration if no end date
    const [hours, minutes] = event.start_time.split(":").map(Number);
    const endHours = (hours + 2) % 24;
    schema.endDate = `${event.start_date}T${String(endHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  }

  if (event.description) {
    schema.description = event.description;
  }

  // Image (as array for better compatibility)
  if (event.image_url) {
    schema.image = [event.image_url];
  }

  if (isVirtualLocation) {
    const virtualUrl = event.ticket_url || event.source_url;
    schema.location = virtualUrl
      ? {
          "@type": "VirtualLocation",
          url: virtualUrl,
        }
      : {
          "@type": "VirtualLocation",
          name: "Online event",
        };
  } else if (event.venue) {
    schema.location = {
      "@type": "Place",
      name: event.venue.name,
      address: {
        "@type": "PostalAddress",
        ...(locationDesignator === "private_after_signup"
          ? {}
          : { streetAddress: event.venue.address }),
        addressLocality: event.venue.city,
        addressRegion: event.venue.state,
        addressCountry: "US",
      },
    };
  }

  // Organizer (use organization if available, otherwise venue)
  if (event.organization) {
    schema.organizer = {
      "@type": "Organization",
      name: event.organization.name,
      url: event.organization.website || undefined,
    };
  } else if (event.venue) {
    schema.organizer = {
      "@type": "Organization",
      name: event.venue.name,
    };
  }

  // Performer (for music/comedy/theater events)
  if (event.category === "music" || event.category === "comedy") {
    schema.performer = {
      "@type": event.category === "music" ? "MusicGroup" : "Person",
      name: event.title,
    };
  }

  // Offers (always include, even for free events)
  if (event.is_free) {
    schema.isAccessibleForFree = true;
    schema.offers = {
      "@type": "Offer",
      price: 0,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: event.ticket_url || event.source_url,
    };
  } else if (event.price_min !== null) {
    schema.offers = {
      "@type": "Offer",
      price: event.price_min,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: event.ticket_url || event.source_url,
    };
  } else {
    // Unknown price - still include offers with URL
    schema.offers = {
      "@type": "Offer",
      availability: "https://schema.org/InStock",
      url: event.ticket_url || event.source_url,
    };
  }

  if (event.ticket_url) {
    schema.url = event.ticket_url;
  }

  return schema;
}

/** Enhance Schema.org event data with actual artist performers */
function withPerformerSchema(
  eventSchema: Record<string, unknown>,
  artists: Awaited<ReturnType<typeof getEventArtists>>,
  category: string | null | undefined
): Record<string, unknown> {
  if (artists.length === 0) return eventSchema;

  if (category === "sports") {
    const competitors = artists.map((a) => ({
      "@type": "SportsTeam",
      name: a.artist?.name || a.name,
      ...(a.artist?.image_url ? { image: a.artist.image_url } : {}),
      ...(a.artist?.website ? { url: a.artist.website } : {}),
    }));
    return {
      ...eventSchema,
      competitor: competitors.length === 1 ? competitors[0] : competitors,
    };
  }

  const performers = artists.map((a) => ({
    "@type": a.artist?.discipline === "band" ? "MusicGroup" : "Person",
    name: a.artist?.name || a.name,
    ...(a.artist?.image_url ? { image: a.artist.image_url } : {}),
  }));

  return {
    ...eventSchema,
    performer: performers.length === 1 ? performers[0] : performers,
  };
}

// Parse recurrence rule to human-readable format
export default async function PortalEventPage({ params }: Props) {
  const { id, portal: portalSlug } = await params;
  const event = await getCachedEventById(parseInt(id, 10));
  const portal = await getCachedPortalBySlug(portalSlug);

  if (!event) {
    notFound();
  }

  // Use the URL portal or fall back to event's portal
  const activePortalSlug = portal?.slug || portalSlug;
  const activePortalName = portal?.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);

  const [{ venueEvents, sameDateEvents }, nearbySpots, eventArtists, socialProofMap] = await Promise.all([
    getRelatedEvents(event, { portalId: portal?.id }),
    event.venue?.id ? getNearbySpots(event.venue.id) : Promise.resolve([]),
    getEventArtists(event.id),
    fetchSocialProofCounts([event.id]),
  ]);
  const sanitizedVenueEvents = suppressEventImagesIfVenueFlagged(venueEvents);
  const sanitizedSameDateEvents = suppressEventImagesIfVenueFlagged(sameDateEvents);

  // Image fallback chain: event -> series -> venue
  const resolvedImageUrl = event.image_url
    || (event.series as { image_url?: string | null } | null)?.image_url
    || event.venue?.image_url
    || null;
  const displayParticipants = getDisplayParticipants(eventArtists, {
    eventTitle: event.title,
    eventCategory: event.category,
  });
  const participantLabels = getLineupLabels(displayParticipants, {
    eventCategory: event.category,
  });
  const displayDescription = buildDisplayDescription(event.description, displayParticipants, {
    eventTitle: event.title,
    eventGenres: event.genres,
    eventTags: event.tags,
    eventCategory: event.category,
  });
  const derivedSignals = deriveShowSignals({
    title: event.title,
    description: displayDescription || event.description,
    price_note: event.price_note,
    tags: event.tags,
    start_time: event.start_time,
    doors_time: (event as { doors_time?: string | null }).doors_time,
    end_time: event.end_time,
    is_all_day: event.is_all_day,
    is_free: event.is_free,
    is_adult: (event as { is_adult?: boolean | null }).is_adult,
    ticket_url: event.ticket_url,
    age_policy: (event as { age_policy?: string | null }).age_policy,
    ticket_status: (event as { ticket_status?: string | null }).ticket_status,
    reentry_policy: (event as { reentry_policy?: string | null }).reentry_policy,
    set_times_mentioned: (event as { set_times_mentioned?: boolean | null }).set_times_mentioned,
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
  const lineupGenreFallback = inferLineupGenreFallback(event.genres, event.tags, event.category);
  const eventSchema = withPerformerSchema(generateEventSchema(event), displayParticipants, event.category);
  if (displayDescription) {
    eventSchema.description = displayDescription;
  }
  // Use resolved image in schema if event has no image but series/venue does
  if (!event.image_url && resolvedImageUrl) {
    eventSchema.image = [resolvedImageUrl];
  }

  // Event state
  const isLive = (event as { is_live?: boolean }).is_live || false;
  const recurrenceText = parseRecurrenceRule(event.recurrence_rule);
  const categoryColor = event.category ? getCategoryColor(event.category) : "var(--coral)";
  const categoryAccentClass = createCssVarClass("--accent-color", categoryColor, "accent");
  const seriesAccentClass = event.series
    ? createCssVarClass(
        "--accent-color",
        getSeriesTypeColor(event.series.series_type),
        "series-accent"
      )
    : null;
  const festivalAccentClass = event.series?.festival
    ? createCssVarClass(
        "--accent-color",
        getSeriesTypeColor("festival_program"),
        "festival-accent"
      )
    : null;

  // Above-the-fold social proof
  const socialProof = socialProofMap.get(event.id);
  const goingCount = socialProof?.going ?? 0;
  const interestedCount = socialProof?.interested ?? 0;

  // Format metadata
  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEEE, MMMM d, yyyy");
  const { text: priceText, isFree } = formatPriceDetailed(event);

  const timeDisplay = event.is_all_day
    ? "All Day"
    : event.start_time
      ? (() => {
          const { time, period } = formatTimeSplit(event.start_time);
          return `${time} ${period}`;
        })()
      : "Time TBA";
  const locationDesignator = event.venue?.location_designator || "standard";
  const locationDesignatorLabel = getLocationDesignatorLabel(locationDesignator);
  const isVirtualLocation = locationDesignator === "virtual";
  const isPrivateLocation = locationDesignator === "private_after_signup";
  const showLocationSection = Boolean(event.venue);
  const ticketUrl = event.ticket_url?.trim() || null;
  const sourceUrl = event.source_url?.trim() || null;
  const primaryCtaHref = ticketUrl || sourceUrl;
  const primaryCtaIsTicketIntent =
    Boolean(ticketUrl) || isTicketingUrl(sourceUrl) || Boolean(sourceUrl && !event.is_free);
  const primaryCtaLabel = isLive
    ? "Join Now"
    : event.is_free
      ? "RSVP Free"
      : primaryCtaHref
        ? "Get Tickets"
        : null;

  return (
    <>
      <ScrollToTop />
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(eventSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            buildBreadcrumbSchema([
              { name: activePortalName, href: `/${activePortalSlug}` },
              { name: "Events", href: `/${activePortalSlug}?view=find` },
              { name: event.title },
            ])
          ),
        }}
      />

      <ScopedStylesServer
        css={[categoryAccentClass?.css, seriesAccentClass?.css, festivalAccentClass?.css].filter(Boolean).join("\n")}
      />

      <div className={`min-h-screen ${categoryAccentClass?.className ?? ""}`}>
        <PortalHeader
          portalSlug={activePortalSlug}
          portalName={activePortalName}
          hideNav
        />

        <main className="max-w-3xl mx-auto px-4 py-4 sm:py-6 pb-28 space-y-5 sm:space-y-8">
          {/* Hero Section */}
          <DetailHero
            mode={resolvedImageUrl ? "image" : "fallback"}
            imageUrl={resolvedImageUrl}
            title={event.title}
            subtitle={event.venue?.name}
            categoryColor={categoryColor}
            backFallbackHref={`/${activePortalSlug}`}
            portrait
            categoryIcon={<CategoryIcon type={event.category || "other"} size={48} />}
            badge={
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider bg-accent-20 text-accent border border-accent-40"
                >
                  <CategoryIcon type={event.category || "other"} size={16} />
                  {event.category}
                </span>
                {isLive && <LiveIndicator eventId={event.id} initialIsLive={isLive} />}
              </div>
            }
            isLive={isLive}
          />

          {/* Festival Context Banner — prominent breadcrumb back to festival */}
          {event.series?.festival && (
            <Link
              href={`/${activePortalSlug}/festivals/${event.series.festival.slug}`}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg bg-accent-08 border border-accent-40 transition-all hover:bg-accent-15 group ${festivalAccentClass?.className ?? ""}`}
            >
              <svg className="w-4 h-4 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm text-[var(--soft)] group-hover:text-[var(--cream)] transition-colors">
                <span className="text-accent font-medium">{event.series.festival.name}</span>
              </span>
              <span className="ml-auto text-2xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-20 text-accent">
                Festival
              </span>
            </Link>
          )}

          {/* Recurring Event Notice */}
          {event.is_recurring && recurrenceText && (
            <div
              className="flex items-center gap-3 p-4 rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)]"
            >
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

          {/* Description Teaser */}
          <DescriptionTeaser
            description={displayDescription}
            accentColor={categoryColor}
          />

          {/* Social Proof Strip */}
          {(goingCount > 0 || interestedCount > 0) && (
            <SocialProofStrip goingCount={goingCount} interestedCount={interestedCount}>
              <FriendsGoing eventId={event.id} />
            </SocialProofStrip>
          )}

          {/* Genre Pills */}
          {event.genres && event.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {event.genres.slice(0, 5).map((genre: string) => (
                <GenreChip
                  key={genre}
                  genre={genre}
                  category={event.category}
                  portalSlug={activePortalSlug}
                />
              ))}
            </div>
          )}

          {/* Main Content Card */}
          <InfoCard accentColor={categoryColor}>
            {/* Metadata Grid */}
            <MetadataGrid
              items={[
                { label: "Date", value: formattedDate },
                { label: "Time", value: timeDisplay },
                ...(priceText ? [{
                  label: "Price",
                  value: priceText,
                  color: isFree ? "var(--neon-green)" : "var(--gold)"
                }] : []),
              ]}
              className="mb-5"
            />

            {/* Description */}
            {displayDescription && (
              <>
                <SectionHeader title="About" variant="inline" />
                <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed mb-6">
                  <LinkifyText text={displayDescription} />
                </p>
              </>
            )}

            {/* Artists / Performers */}
            {displayParticipants.length > 0 && (
              <div className="mb-6">
                <LineupSection
                  artists={displayParticipants}
                  portalSlug={activePortalSlug}
                  maxDisplay={12}
                  title={participantLabels.sectionTitle}
                  headlinerLabel={participantLabels.headlinerLabel}
                  supportLabel={participantLabels.supportLabel}
                  eventCategory={event.category}
                  fallbackImageUrl={resolvedImageUrl}
                  fallbackGenres={lineupGenreFallback}
                />
              </div>
            )}

            {hasShowSignals && (
              <>
                <SectionHeader title="Show Details" />
                <ShowSignalsPanel signals={showSignals} ticketUrl={event.ticket_url} className="mb-6" />
              </>
            )}

            {/* Location */}
            {showLocationSection && event.venue && (
              <>
                <SectionHeader title="Location" />
                <div className="mb-6">
                  {locationDesignatorLabel && (
                    <span className="inline-flex mb-3 items-center px-2.5 py-1 rounded-full border border-[var(--twilight)] bg-[var(--twilight)]/45 font-mono text-xs uppercase tracking-[0.1em] text-[var(--soft)]">
                      {locationDesignatorLabel}
                    </span>
                  )}

                  {!isVirtualLocation &&
                    !isPrivateLocation &&
                    event.venue.address && (
                      <div className="flex items-center justify-between mb-3">
                        <DirectionsDropdown
                          venueName={event.venue.name}
                          address={event.venue.address}
                          city={event.venue.city}
                          state={event.venue.state}
                        />
                      </div>
                    )}

                  <Link
                    href={`/${activePortalSlug}?venue=${event.venue.slug}`}
                    scroll={false}
                    className="block p-4 rounded-lg border border-[var(--twilight)] bg-[var(--void)] transition-all hover:bg-[var(--card-bg-hover)] hover:border-[var(--soft)] group"
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
                        {isVirtualLocation
                          ? "Online event"
                          : isPrivateLocation
                            ? `Exact location shared after RSVP${event.venue.city ? ` · ${event.venue.city}, ${event.venue.state}` : ""}`
                            : event.venue.address
                              ? `${event.venue.address} · ${event.venue.city}, ${event.venue.state}`
                              : `${event.venue.city}, ${event.venue.state}`}
                      </span>
                    </p>

                    <VenueVibes vibes={event.venue.vibes} className="mt-3" />
                    <GettingThereSection transit={event.venue} variant="compact" />
                  </Link>

                  {isVirtualLocation && (event.ticket_url || event.source_url) && (
                    <div className="mt-3">
                      <a
                        href={event.ticket_url || event.source_url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)]/70 text-[var(--cream)] text-sm hover:border-[var(--soft)] transition-colors"
                      >
                        Open join link
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0-7L10 14" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v8a1 1 0 001 1h8" />
                        </svg>
                      </a>
                    </div>
                  )}

                  {!isVirtualLocation && !isPrivateLocation && (
                    <div className="mt-3">
                      <VenueTagList venueId={event.venue.id} />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Social Proof */}
            {goingCount > 0 && (
              <>
                <SectionHeader title="Who's Going" />
                <div className="mb-6">
                  <WhosGoing eventId={event.id} />
                </div>
              </>
            )}

            {/* Series Link */}
            {event.series && (
              <>
                <SectionHeader title="Series" />
                {event.series.festival && (
                  <Link
                    href={`/${activePortalSlug}/festivals/${event.series.festival.slug}`}
                    className={`flex items-center gap-3 p-4 rounded-lg border border-[var(--twilight)] bg-[var(--void)] transition-all hover:bg-[var(--card-bg-hover)] hover:border-[var(--soft)] group mb-3 ${festivalAccentClass?.className ?? ""}`}
                  >
                    <svg
                      className="w-5 h-5 flex-shrink-0 text-accent"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 4v16m0-12h9l-1.5 3L14 14H5" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[var(--soft)] group-hover:text-[var(--coral)] transition-colors">
                        Part of{" "}
                        <span className="text-[var(--cream)] font-medium">
                          {event.series.festival.name}
                        </span>
                      </span>
                      <span
                        className="ml-2 text-2xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-20 text-accent"
                      >
                        Festival
                      </span>
                    </div>
                    <svg className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
                <Link
                  href={`/${activePortalSlug}?series=${event.series.slug}`}
                  scroll={false}
                  className={`flex items-center gap-3 p-4 rounded-lg border border-[var(--twilight)] bg-[var(--void)] transition-all hover:bg-[var(--card-bg-hover)] hover:border-[var(--soft)] group mb-6 ${seriesAccentClass?.className ?? ""}`}
                >
                  <svg
                    className="w-5 h-5 flex-shrink-0 text-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                    />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[var(--soft)] group-hover:text-[var(--coral)] transition-colors">
                      Part of <span className="text-[var(--cream)] font-medium">{event.series.title}</span>
                    </span>
                    <span
                      className="ml-2 text-2xs font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-20 text-accent"
                    >
                      {getSeriesTypeLabel(event.series.series_type)}
                    </span>
                  </div>
                  <svg className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </>
            )}

            {/* Organization */}
            {event.organization && (
              <>
                <SectionHeader title="Presented by" />
                <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-[var(--twilight)] mb-6 bg-[var(--void)]">
                  <div className="flex items-center gap-3 min-w-0">
                    {event.organization.logo_url ? (
                      <Image
                        src={event.organization.logo_url}
                        alt={event.organization.name}
                        width={40}
                        height={40}
                        className="rounded-lg object-cover flex-shrink-0"
                        unoptimized
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
                        {event.organization.name}
                      </h3>
                      <p className="text-xs text-[var(--muted)] font-mono uppercase tracking-wider">
                        {event.organization.org_type.replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>
                  <FollowButton targetOrganizationId={event.organization.id} size="sm" />
                </div>
              </>
            )}

            {/* Tags */}
            {(() => {
              const INTERNAL_TAGS = new Set(["ticketed", "ticketmaster", "eventbrite", "meetup", "touring"]);
              const displayTags = event.tags?.filter((t: string) => !INTERNAL_TAGS.has(t)) ?? [];
              return displayTags.length > 0 ? (
                <>
                  <SectionHeader title="Tags" count={displayTags.length} />
                  <div className="flex flex-wrap gap-2 mb-6">
                    {displayTags.map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 text-[var(--soft)] rounded border border-[var(--twilight)] text-xs bg-[var(--void)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </>
              ) : null;
            })()}

            {/* Community Tags */}
            <div className="mb-6">
              <EntityTagList entityType="event" entityId={event.id} />
            </div>


            {/* Flag for QA */}
            <div className="pt-5 border-t border-[var(--twilight)]/30">
              <FlagButton
                entityType="event"
                entityId={event.id}
                entityName={event.title}
              />
            </div>
          </InfoCard>

          {/* Before & After - Nearby Spots */}
          {nearbySpots.length > 0 && event.venue?.neighborhood && (
            <RelatedSection
              title={`Before & After in ${event.venue.neighborhood}`}
              count={nearbySpots.length}
            >
              {nearbySpots.map((spot) => (
                <RelatedCard
                  key={spot.id}
                  variant="image"
                  href={`/${activePortalSlug}?venue=${spot.slug}`}
                  title={spot.name}
                  subtitle={getSpotTypeLabel(spot.venue_type)}
                  imageUrl={spot.image_url || undefined}
                  icon={<CategoryIcon type={spot.venue_type || "bar"} size={20} />}
                />
              ))}
            </RelatedSection>
          )}

          {/* More at Venue */}
          {sanitizedVenueEvents.length > 0 && event.venue && (
            <RelatedSection
              title={`More at ${event.venue.name}`}
              count={sanitizedVenueEvents.length}
              layout="content"
            >
              <VenueEventsByDay
                events={sanitizedVenueEvents}
                portalSlug={activePortalSlug}
                maxDates={5}
                compact={true}
              />
            </RelatedSection>
          )}

          {/* Same Night */}
          {sanitizedSameDateEvents.length > 0 && (
            <RelatedSection
              title="That same night"
              count={sanitizedSameDateEvents.length}
            >
              {sanitizedSameDateEvents.map((relatedEvent) => {
                const eventColor = relatedEvent.category ? getCategoryColor(relatedEvent.category) : "var(--coral)";
                const subtitle = [
                  relatedEvent.venue?.name || "Venue TBA",
                  relatedEvent.start_time && `${formatTimeSplit(relatedEvent.start_time).time} ${formatTimeSplit(relatedEvent.start_time).period}`
                ].filter(Boolean).join(" · ");

                return (
                  <RelatedCard
                    key={relatedEvent.id}
                    variant="compact"
                    href={`/${activePortalSlug}/events/${relatedEvent.id}`}
                    title={relatedEvent.title}
                    subtitle={subtitle}
                    icon={<CategoryIcon type={relatedEvent.category || "other"} size={20} />}
                    accentColor={eventColor}
                  />
                );
              })}
            </RelatedSection>
          )}
        </main>
      </div>

      {/* Sticky bottom bar with CTAs */}
      <DetailStickyBar
        shareLabel="Share Event"
        showShareButton
        shareTracking={{
          portalSlug: activePortalSlug,
          eventId: event.id,
        }}
        secondaryActions={
          <>
            <SaveToListButton itemType="event" itemId={event.id} />
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
            <RSVPButton
              eventId={event.id}
              venueId={event.venue?.id}
              venueName={event.venue?.name}
              venueType={event.venue?.venue_type}
              variant="compact"
            />
            {event.venue && event.venue.lat != null && event.venue.lng != null && (
              <OutingPlannerButton
                event={{
                  id: event.id,
                  title: event.title,
                  start_date: event.start_date,
                  start_time: event.start_time,
                  end_time: event.end_time,
                  is_all_day: event.is_all_day,
                  category: event.category,
                  venue: {
                    id: event.venue.id,
                    name: event.venue.name,
                    slug: event.venue.slug,
                    lat: event.venue.lat,
                    lng: event.venue.lng,
                  },
                }}
                portalId={portal?.id || ""}
                portalSlug={activePortalSlug}
                portalVertical={portal ? getPortalVertical(portal) : undefined}
                categoryColor={categoryColor}
              />
            )}
          </>
        }
        primaryAction={
          primaryCtaHref && primaryCtaLabel
            ? {
                label: primaryCtaLabel,
                href: primaryCtaHref,
                icon: primaryCtaIsTicketIntent ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                ),
              }
            : undefined
        }
      />
    </>
  );
}
