import ScrollToTop from "@/components/ScrollToTop";
import { getEventById, getRelatedEvents } from "@/lib/supabase";
import { getNearbySpots, getSpotTypeLabel } from "@/lib/spots";
import { getCachedPortalBySlug } from "@/lib/portal";
import { getSeriesTypeLabel, getSeriesTypeColor } from "@/lib/series";
import Image from "@/components/SmartImage";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import FollowButton from "@/components/FollowButton";
import FriendsGoing from "@/components/FriendsGoing";
import WhosGoing from "@/components/WhosGoing";
import { PortalHeader } from "@/components/headers";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DirectionsDropdown from "@/components/DirectionsDropdown";
import VenueVibes from "@/components/VenueVibes";
import LinkifyText from "@/components/LinkifyText";
import { formatTimeSplit, formatPriceDetailed, safeJsonLd, formatRelativeTime } from "@/lib/formats";
import VenueTagList from "@/components/VenueTagList";
import FlagButton from "@/components/FlagButton";
import LiveIndicator from "@/components/LiveIndicator";
import RSVPButton from "@/components/RSVPButton";
import AddToCalendar from "@/components/AddToCalendar";
import { EntityTagList } from "@/components/tags/EntityTagList";
import { SaveToListButton } from "@/components/SaveToListButton";
import { getEventArtists } from "@/lib/artists";
import LineupSection from "@/components/LineupSection";
import {
  DetailHero,
  InfoCard,
  MetadataGrid,
  SectionHeader,
  RelatedSection,
  RelatedCard,
  DetailStickyBar,
} from "@/components/detail";
import VenueEventsByDay from "@/components/VenueEventsByDay";
import ScopedStylesServer from "@/components/ScopedStylesServer";
import { createCssVarClass } from "@/lib/css-utils";
import { cache } from "react";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string; id: string }>;
};

// Cache getEventById to prevent duplicate queries in generateMetadata and page component
const getCachedEventById = cache(getEventById);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, portal: portalSlug } = await params;
  const event = await getCachedEventById(parseInt(id, 10));
  const portal = await getCachedPortalBySlug(portalSlug);

  if (!event) {
    return {
      title: "Event Not Found | Lost City",
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
    openGraph: {
      title: event.title,
      description,
      type: "website",
      images: event.image_url ? [{ url: event.image_url }] : [],
    },
    twitter: {
      card: event.image_url ? "summary_large_image" : "summary",
      title: event.title,
      description,
      images: event.image_url ? [event.image_url] : [],
    },
  };
}


type EventWithOrganization = NonNullable<Awaited<ReturnType<typeof getEventById>>>;

function generateEventSchema(event: EventWithOrganization) {
  const startDateTime = event.start_time
    ? `${event.start_date}T${event.start_time}:00`
    : event.start_date;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: startDateTime,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
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

  if (event.venue) {
    schema.location = {
      "@type": "Place",
      name: event.venue.name,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.venue.address,
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
  artists: Awaited<ReturnType<typeof getEventArtists>>
): Record<string, unknown> {
  if (artists.length === 0) return eventSchema;

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
function parseRecurrenceRule(rule: string | null | undefined): string | null {
  if (!rule) return null;

  // Simple RRULE parsing - handle common patterns
  const match = rule.match(/FREQ=(\w+)(?:;BYDAY=(\w+))?/i);
  if (!match) return null;

  const freq = match[1]?.toUpperCase();
  const day = match[2];

  const dayNames: Record<string, string> = {
    MO: "Monday", TU: "Tuesday", WE: "Wednesday",
    TH: "Thursday", FR: "Friday", SA: "Saturday", SU: "Sunday"
  };

  if (freq === "WEEKLY" && day && dayNames[day]) {
    return `Every ${dayNames[day]}`;
  }
  if (freq === "WEEKLY") return "Weekly";
  if (freq === "MONTHLY") return "Monthly";
  if (freq === "DAILY") return "Daily";

  return null;
}

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

  const [{ venueEvents, sameDateEvents }, nearbySpots, eventArtists] = await Promise.all([
    getRelatedEvents(event),
    event.venue?.id ? getNearbySpots(event.venue.id) : Promise.resolve([]),
    getEventArtists(event.id),
  ]);
  const eventSchema = withPerformerSchema(generateEventSchema(event), eventArtists);

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

  return (
    <>
      <ScrollToTop />
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(eventSchema) }}
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
            mode={event.image_url ? "image" : "fallback"}
            imageUrl={event.image_url}
            title={event.title}
            subtitle={event.venue?.name}
            categoryColor={categoryColor}
            backFallbackHref={`/${activePortalSlug}`}
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
              <span className="ml-auto text-[0.6rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-20 text-accent">
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
              className="mb-5 sm:mb-8"
            />

            {/* Description */}
            {event.description && (
              <>
                <SectionHeader title="About" />
                <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed mb-6">
                  <LinkifyText text={event.description} />
                </p>
              </>
            )}

            {/* Lineup / Performers — labels auto-derived from artist disciplines */}
            {eventArtists.length > 0 && (
              <div className="mb-6">
                <LineupSection
                  artists={eventArtists}
                  portalSlug={activePortalSlug}
                  maxDisplay={12}
                />
              </div>
            )}

            {/* Location */}
            {event.venue && event.venue.address && (
              <>
                <SectionHeader title="Location" />
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <DirectionsDropdown
                      venueName={event.venue.name}
                      address={event.venue.address}
                      city={event.venue.city}
                      state={event.venue.state}
                    />
                  </div>
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
                        {event.venue.address} · {event.venue.city}, {event.venue.state}
                      </span>
                    </p>

                    <VenueVibes vibes={event.venue.vibes} className="mt-3" />
                  </Link>

                  <div className="mt-3">
                    <VenueTagList venueId={event.venue.id} />
                  </div>
                </div>
              </>
            )}

            {/* Social Proof */}
            <SectionHeader title="Who's Going" />
            <div className="mb-6">
              <FriendsGoing eventId={event.id} className="mb-4" />
              <WhosGoing eventId={event.id} />
            </div>

            {/* Series Link */}
            {event.series && (
              <>
                <SectionHeader title="Series" />
                {event.series.festival && (
                  <Link
                    href={`/${activePortalSlug}?festival=${event.series.festival.slug}`}
                    scroll={false}
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
                        className="ml-2 text-[0.6rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-20 text-accent"
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
                      className="ml-2 text-[0.6rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-20 text-accent"
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
                      <p className="text-[0.65rem] text-[var(--muted)] font-mono uppercase tracking-wider">
                        {event.organization.org_type.replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>
                  <FollowButton targetOrganizationId={event.organization.id} size="sm" />
                </div>
              </>
            )}

            {/* Tags */}
            {event.tags && event.tags.length > 0 && (
              <>
                <SectionHeader title="Also Featuring" count={event.tags.length} />
                <div className="flex flex-wrap gap-2 mb-6">
                  {event.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 text-[var(--soft)] rounded border border-[var(--twilight)] text-xs bg-[var(--void)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* Community Tags */}
            <div className="mb-6">
              <EntityTagList entityType="event" entityId={event.id} />
            </div>

            {/* Data Freshness — subtle provenance hint */}
            {(event.source_url || event.updated_at) && (
              <div className="flex items-center gap-2 text-[0.65rem] font-mono text-[var(--muted)] mb-4 pb-4 border-b border-[var(--twilight)]/30">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  {event.updated_at && (
                    <>Last verified {formatRelativeTime(event.updated_at)}</>
                  )}
                  {event.source_url && event.updated_at && <span className="opacity-40"> · </span>}
                  {event.source_url && (
                    <a
                      href={event.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[var(--soft)] transition-colors underline decoration-dotted underline-offset-2"
                    >
                      View source
                    </a>
                  )}
                </span>
              </div>
            )}

            {/* Flag for QA */}
            <SectionHeader title="Report an Issue" />
            <FlagButton
              entityType="event"
              entityId={event.id}
              entityName={event.title}
            />
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
          {venueEvents.length > 0 && event.venue && (
            <RelatedSection
              title={`More at ${event.venue.name}`}
              count={venueEvents.length}
            >
              <VenueEventsByDay
                events={venueEvents}
                portalSlug={activePortalSlug}
                maxDates={5}
                compact={true}
              />
            </RelatedSection>
          )}

          {/* Same Night */}
          {sameDateEvents.length > 0 && (
            <RelatedSection
              title="That same night"
              count={sameDateEvents.length}
            >
              {sameDateEvents.map((relatedEvent) => {
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
          </>
        }
        primaryAction={
          event.ticket_url
            ? {
                label: isLive ? "Join Now" : "Get Tickets",
                href: event.ticket_url,
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                ),
              }
            : undefined
        }
      />
    </>
  );
}
