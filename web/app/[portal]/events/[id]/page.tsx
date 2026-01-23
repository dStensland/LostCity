import { getEventById, getRelatedEvents } from "@/lib/supabase";
import { getNearbySpots, getSpotTypeLabel } from "@/lib/spots";
import { getPortalBySlug } from "@/lib/portal";
import { getSeriesTypeLabel, getSeriesTypeColor } from "@/lib/series";
import Image from "next/image";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import FollowButton from "@/components/FollowButton";
import FriendsGoing from "@/components/FriendsGoing";
import WhosGoing from "@/components/WhosGoing";
import UnifiedHeader from "@/components/UnifiedHeader";
import PageFooter from "@/components/PageFooter";
import { PortalTheme } from "@/components/PortalTheme";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DirectionsDropdown from "@/components/DirectionsDropdown";
import EventStickyBar from "@/components/EventStickyBar";
import EventHeroImage from "@/components/EventHeroImage";
import EventActionCard from "@/components/EventActionCard";
import VenueVibes from "@/components/VenueVibes";
import LinkifyText from "@/components/LinkifyText";
import { formatTimeSplit, formatTimeRange } from "@/lib/formats";
import VenueTagList from "@/components/VenueTagList";
import FlagButton from "@/components/FlagButton";

export const revalidate = 60;

type Props = {
  params: Promise<{ portal: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, portal: portalSlug } = await params;
  const event = await getEventById(parseInt(id, 10));
  const portal = await getPortalBySlug(portalSlug);

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


function generateEventSchema(event: NonNullable<Awaited<ReturnType<typeof getEventById>>>) {
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

  if (event.description) {
    schema.description = event.description;
  }

  if (event.image_url) {
    schema.image = event.image_url;
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

  if (event.is_free) {
    schema.isAccessibleForFree = true;
  } else if (event.price_min !== null) {
    schema.offers = {
      "@type": "Offer",
      price: event.price_min,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: event.ticket_url || event.source_url,
    };
  }

  if (event.ticket_url) {
    schema.url = event.ticket_url;
  }

  return schema;
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
  const event = await getEventById(parseInt(id, 10));
  const portal = await getPortalBySlug(portalSlug);

  if (!event) {
    notFound();
  }

  // Use the URL portal or fall back to event's portal
  const activePortalSlug = portal?.slug || portalSlug;
  const activePortalName = portal?.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);

  const { venueEvents, sameDateEvents } = await getRelatedEvents(event);
  const nearbySpots = event.venue?.id ? await getNearbySpots(event.venue.id) : [];
  const dateObj = parseISO(event.start_date);
  const shortDate = format(dateObj, "MMM d");
  const dayOfWeek = format(dateObj, "EEE");
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  const timeRange = formatTimeRange(event.start_time, event.end_time, event.is_all_day);
  const eventSchema = generateEventSchema(event);

  // Event state
  const isLive = (event as { is_live?: boolean }).is_live || false;
  const recurrenceText = parseRecurrenceRule(event.recurrence_rule);
  const categoryColor = event.category ? getCategoryColor(event.category) : "var(--coral)";

  return (
    <>
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
      />

      {/* Portal-specific theming */}
      {portal && <PortalTheme portal={portal} />}

      <div className="min-h-screen">
        <UnifiedHeader
          portalSlug={activePortalSlug}
          portalName={activePortalName}
          backLink={{ href: `/${activePortalSlug}?view=events`, label: "Events" }}
        />

        <main className="max-w-3xl mx-auto px-4 py-8 pb-28">
          {/* Hero Section with immersive image and glass overlay */}
          <div
            className={`relative aspect-video bg-[var(--night)] rounded-lg overflow-hidden mb-6 animate-fade-in ${
              isLive ? "live-border-glow" : ""
            }`}
            style={{
              "--glow-color": categoryColor,
            } as React.CSSProperties}
          >
            {event.image_url ? (
              <EventHeroImage
                src={event.image_url}
                alt={event.title}
                category={event.category}
                title={event.title}
                venueName={event.venue?.name}
                neighborhood={event.venue?.neighborhood}
                startDate={event.start_date}
                startTime={event.start_time}
                isLive={isLive}
                eventId={event.id}
              />
            ) : (
              <EventHeroImage
                src=""
                alt={event.title}
                category={event.category}
                title={event.title}
                venueName={event.venue?.name}
                neighborhood={event.venue?.neighborhood}
                startDate={event.start_date}
                startTime={event.start_time}
                isLive={isLive}
                eventId={event.id}
              />
            )}

            {/* Live event heat effect */}
            {isLive && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: "inset 0 0 60px rgba(255, 90, 90, 0.15)",
                }}
              />
            )}
          </div>

          {/* Floating Action Card */}
          <EventActionCard
            event={event}
            isLive={isLive}
            className="mb-6"
          />

          {/* Recurring Event Badge */}
          {event.is_recurring && recurrenceText && (
            <div
              className="flex items-center gap-3 p-4 rounded-lg border border-[var(--twilight)] mb-6 animate-fade-up"
              style={{ backgroundColor: "var(--card-bg)", animationDelay: "0.15s" }}
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

          {/* Main event info card */}
          <div
            className="border border-[var(--twilight)] rounded-lg p-6 sm:p-8 animate-fade-up"
            style={{ backgroundColor: "var(--card-bg)", animationDelay: "0.2s" }}
          >
            {/* Series link */}
            {event.series && (
              <Link
                href={`/${activePortalSlug}/series/${event.series.slug}`}
                className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-lg border border-[var(--twilight)] transition-colors hover:border-[var(--coral)]/50 group"
                style={{ backgroundColor: "var(--void)" }}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: getSeriesTypeColor(event.series.series_type) }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                  />
                </svg>
                <span className="text-sm text-[var(--soft)] group-hover:text-[var(--coral)] transition-colors">
                  Part of <span className="text-[var(--cream)] font-medium">{event.series.title}</span>
                </span>
                <span
                  className="text-[0.6rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${getSeriesTypeColor(event.series.series_type)}20`,
                    color: getSeriesTypeColor(event.series.series_type),
                  }}
                >
                  {getSeriesTypeLabel(event.series.series_type)}
                </span>
                <svg className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}

            {/* Friends going */}
            <FriendsGoing eventId={event.id} className="mb-5" />

            {/* Date/Time grid with end time */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
              <div className="rounded-lg p-3 sm:p-4 text-center border border-[var(--twilight)]" style={{ backgroundColor: "var(--void)" }}>
                <div className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-widest mb-1">
                  Date
                </div>
                <div className="font-mono text-lg sm:text-xl font-semibold text-[var(--coral)]">
                  {shortDate}
                </div>
                <div className="font-mono text-xs text-[var(--muted)]">{dayOfWeek}</div>
              </div>

              <div className="rounded-lg p-3 sm:p-4 text-center border border-[var(--twilight)]" style={{ backgroundColor: "var(--void)" }}>
                <div className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-widest mb-1">
                  Time
                </div>
                <div className="font-mono text-lg sm:text-xl font-semibold text-[var(--coral)]">
                  {time}
                </div>
                <div className="font-mono text-xs text-[var(--muted)]">
                  {event.end_time ? timeRange : period}
                </div>
              </div>

              {/* Show duration if we have end time */}
              {event.end_time && (
                <div className="rounded-lg p-3 sm:p-4 text-center border border-[var(--twilight)] col-span-2 sm:col-span-1" style={{ backgroundColor: "var(--void)" }}>
                  <div className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-widest mb-1">
                    Ends
                  </div>
                  <div className="font-mono text-lg sm:text-xl font-semibold text-[var(--soft)]">
                    {formatTimeSplit(event.end_time).time}
                  </div>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    {formatTimeSplit(event.end_time).period}
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {event.description && (
              <div className="mb-6 pt-6 border-t border-[var(--twilight)]">
                <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
                  About
                </h2>
                <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed">
                  <LinkifyText text={event.description} />
                </p>
              </div>
            )}

            {/* Tags */}
            {event.tags && event.tags.length > 0 && (
              <div className="mb-6 pt-6 border-t border-[var(--twilight)]">
                <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
                  Also Featuring
                </h2>
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 text-[var(--soft)] rounded border border-[var(--twilight)] text-sm"
                      style={{ backgroundColor: "var(--void)" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Presented by (Producer/Organizer) */}
            {event.producer && (
              <div className="mb-6 pt-6 border-t border-[var(--twilight)]">
                <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
                  Presented by
                </h2>
                <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-[var(--twilight)]" style={{ backgroundColor: "var(--void)" }}>
                  <div className="flex items-center gap-3 min-w-0">
                    {event.producer.logo_url ? (
                      <Image
                        src={event.producer.logo_url}
                        alt={event.producer.name}
                        width={48}
                        height={48}
                        className="rounded-lg object-cover flex-shrink-0"
                        unoptimized
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[var(--twilight)] flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="text-[var(--cream)] font-medium truncate">
                        {event.producer.name}
                      </h3>
                      <p className="text-[0.7rem] text-[var(--muted)] font-mono uppercase tracking-wider">
                        {event.producer.org_type.replace(/_/g, " ")}
                      </p>
                      {event.producer.website && (
                        <a
                          href={event.producer.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[var(--coral)] hover:underline"
                        >
                          {event.producer.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </a>
                      )}
                    </div>
                  </div>
                  <FollowButton targetProducerId={event.producer.id} size="sm" />
                </div>
              </div>
            )}

            {/* Location with Venue Vibes */}
            {event.venue && event.venue.address && (
              <div className="mb-6 pt-6 border-t border-[var(--twilight)]">
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
                <Link
                  href={`/${activePortalSlug}/spots/${event.venue.slug}`}
                  className="block p-4 -mx-4 rounded-lg transition-colors hover:bg-[var(--void)] group"
                >
                  <p className="text-[var(--soft)] mb-2">
                    <span className="text-[var(--cream)] font-medium group-hover:text-[var(--coral)] transition-colors">
                      {event.venue.name}
                    </span>
                    <svg className="inline-block w-4 h-4 ml-1.5 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <br />
                    <span className="text-sm">
                      {event.venue.address}
                      <br />
                      {event.venue.city}, {event.venue.state}
                    </span>
                  </p>

                  {/* Venue Vibes */}
                  <VenueVibes vibes={event.venue.vibes} className="mb-2" />

                  {/* Venue Description */}
                  {event.venue.description && (
                    <p className="text-sm text-[var(--muted)] italic leading-relaxed">
                      {event.venue.description}
                    </p>
                  )}
                </Link>

                {/* Community Tags */}
                <div className="mt-4 pt-4 border-t border-[var(--twilight)]">
                  <VenueTagList venueId={event.venue.id} />
                </div>
              </div>
            )}

            {/* Who's Going section */}
            <WhosGoing eventId={event.id} className="pt-6 border-t border-[var(--twilight)]" />

            {/* Flag for QA */}
            <div className="pt-6 border-t border-[var(--twilight)]">
              <FlagButton
                entityType="event"
                entityId={event.id}
                entityName={event.title}
              />
            </div>
          </div>

          {/* Before & After - Nearby Spots */}
          {nearbySpots.length > 0 && event.venue?.neighborhood && (
            <div className="mt-8 animate-fade-up" style={{ animationDelay: "0.3s" }}>
              <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-4">
                Before & After in {event.venue.neighborhood}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {nearbySpots.map((spot, index) => (
                  <Link
                    key={spot.id}
                    href={`/${activePortalSlug}/spots/${spot.slug}`}
                    className={`group p-3 border border-[var(--twilight)] rounded-lg transition-colors card-hover-lift stagger-${Math.min(index + 1, 6)}`}
                    style={{ backgroundColor: "var(--card-bg)" }}
                  >
                    <div className="flex items-start gap-2">
                      <CategoryIcon
                        type={spot.spot_type || "bar"}
                        size={16}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[var(--cream)] text-sm font-medium truncate group-hover:text-[var(--coral)] transition-colors">
                          {spot.name}
                        </h3>
                        <p className="text-[0.65rem] text-[var(--muted)] font-mono uppercase tracking-wider mt-0.5">
                          {getSpotTypeLabel(spot.spot_type)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related Events */}
          {(venueEvents.length > 0 || sameDateEvents.length > 0) && (
            <div className="mt-8 space-y-8 animate-fade-up" style={{ animationDelay: "0.35s" }}>
              {/* More at this venue */}
              {venueEvents.length > 0 && event.venue && (
                <div>
                  <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-4">
                    More at {event.venue.name}
                  </h2>
                  <div className="space-y-2">
                    {venueEvents.map((relatedEvent, index) => (
                      <Link
                        key={relatedEvent.id}
                        href={`/${activePortalSlug}/events/${relatedEvent.id}`}
                        className={`block p-4 border border-[var(--twilight)] rounded-lg transition-colors group card-hover-lift stagger-${Math.min(index + 1, 6)}`}
                        style={{ backgroundColor: "var(--card-bg)" }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[var(--cream)] font-medium truncate group-hover:text-[var(--coral)] transition-colors">
                              {relatedEvent.title}
                            </h3>
                            <p className="text-sm text-[var(--muted)] mt-1">
                              {format(parseISO(relatedEvent.start_date), "EEE, MMM d")}
                              {relatedEvent.start_time && ` · ${formatTimeSplit(relatedEvent.start_time).time} ${formatTimeSplit(relatedEvent.start_time).period}`}
                            </p>
                          </div>
                          <span className="text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Same night */}
              {sameDateEvents.length > 0 && (
                <div>
                  <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-4">
                    That same night
                  </h2>
                  <div className="space-y-2">
                    {sameDateEvents.map((relatedEvent, index) => (
                      <Link
                        key={relatedEvent.id}
                        href={`/${activePortalSlug}/events/${relatedEvent.id}`}
                        className={`block p-4 border border-[var(--twilight)] rounded-lg transition-colors group card-hover-lift stagger-${Math.min(index + 1, 6)}`}
                        style={{ backgroundColor: "var(--card-bg)" }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[var(--cream)] font-medium truncate group-hover:text-[var(--coral)] transition-colors">
                              {relatedEvent.title}
                            </h3>
                            <p className="text-sm text-[var(--muted)] mt-1">
                              {relatedEvent.venue?.name || "Venue TBA"}
                              {relatedEvent.start_time && ` · ${formatTimeSplit(relatedEvent.start_time).time} ${formatTimeSplit(relatedEvent.start_time).period}`}
                            </p>
                          </div>
                          <span className="text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        <PageFooter />
      </div>

      {/* Sticky bottom bar with CTAs */}
      <EventStickyBar
        eventId={event.id}
        eventTitle={event.title}
        ticketUrl={event.ticket_url}
        eventCategory={event.category}
      />
    </>
  );
}
