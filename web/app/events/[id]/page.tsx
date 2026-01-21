import { getEventById, getRelatedEvents, getSimilarEvents } from "@/lib/supabase";
import { getNearbySpots, getSpotTypeLabel } from "@/lib/spots";
import { getPortalById } from "@/lib/portal";
import { getSeriesTypeLabel, getSeriesTypeColor } from "@/lib/series";
import Image from "next/image";
import CategoryIcon from "@/components/CategoryIcon";
import RSVPButton from "@/components/RSVPButton";
import RecommendButton from "@/components/RecommendButton";
import FollowButton from "@/components/FollowButton";
import FriendsGoing from "@/components/FriendsGoing";
import WhosGoing from "@/components/WhosGoing";
import LiveIndicator from "@/components/LiveIndicator";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { PortalTheme } from "@/components/PortalTheme";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AddToCalendar from "@/components/AddToCalendar";
import DirectionsDropdown from "@/components/DirectionsDropdown";
import EventStickyBar from "@/components/EventStickyBar";
import EventHeroImage from "@/components/EventHeroImage";
import { formatTimeSplit, formatPrice } from "@/lib/formats";

export const revalidate = 60;

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = await getEventById(parseInt(id, 10));

  if (!event) {
    return {
      title: "Event Not Found | Lost City",
    };
  }

  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEEE, MMMM d, yyyy");
  const venueName = event.venue?.name || "TBA";
  const description = event.description
    ? event.description.slice(0, 160)
    : `${event.title} at ${venueName} on ${formattedDate}. Discover more events with Lost City.`;

  return {
    title: `${event.title} | ${venueName} | Lost City`,
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

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const event = await getEventById(parseInt(id, 10));

  if (!event) {
    notFound();
  }

  // Get portal if event is portal-specific
  const portalId = (event as { portal_id?: string }).portal_id;
  const portal = portalId ? await getPortalById(portalId) : null;
  const portalSlug = portal?.slug || "atlanta";
  const portalName = portal?.name || "Atlanta";

  const [{ venueEvents, sameDateEvents }, similarEvents] = await Promise.all([
    getRelatedEvents(event),
    getSimilarEvents(event, 4),
  ]);
  const nearbySpots = event.venue?.id ? await getNearbySpots(event.venue.id) : [];
  const dateObj = parseISO(event.start_date);
  const shortDate = format(dateObj, "MMM d");
  const dayOfWeek = format(dateObj, "EEE");
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  const eventSchema = generateEventSchema(event);

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
        <PageHeader showEvents citySlug={portalSlug} cityName={portalName} />

        <main className="max-w-3xl mx-auto px-4 py-8">
          {/* Event image */}
          {event.image_url && (
            <div className="aspect-video bg-[var(--night)] rounded-lg overflow-hidden mb-6 border border-[var(--twilight)] relative">
              <EventHeroImage
                src={event.image_url}
                alt={event.title}
                category={event.category}
              />
            </div>
          )}

          {/* Main event info card */}
          <div className="border border-[var(--twilight)] rounded-lg p-6 sm:p-8" style={{ backgroundColor: "var(--card-bg)" }}>
            {/* Series link */}
            {event.series && (
              <Link
                href={`/series/${event.series.slug}`}
                className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded-lg border border-[var(--twilight)] transition-colors hover:border-[var(--coral)]/50 group"
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

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {/* Category badge */}
              {event.category && (
                <span className={`category-${event.category} inline-block px-2 py-0.5 rounded text-xs font-mono uppercase tracking-wider`}>
                  {event.category}
                </span>
              )}
              {/* Real-time live indicator */}
              <LiveIndicator
                eventId={event.id}
                initialIsLive={(event as { is_live?: boolean }).is_live || false}
                size="md"
              />
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--cream)] leading-tight">
              {event.title}
            </h1>

            {/* Venue */}
            {event.venue && (
              <p className="mt-2 text-[var(--soft)] font-serif text-lg">
                {event.venue.name}
                {event.venue.neighborhood && (
                  <span className="text-[var(--muted)]"> &middot; {event.venue.neighborhood}</span>
                )}
              </p>
            )}

            {/* Friends going */}
            <FriendsGoing eventId={event.id} className="mt-3" />

            {/* Date/Time/Price grid */}
            <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
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
                <div className="font-mono text-xs text-[var(--muted)]">{period}</div>
              </div>

              <div className="rounded-lg p-3 sm:p-4 text-center border border-[var(--twilight)]" style={{ backgroundColor: "var(--void)" }}>
                <div className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-widest mb-1">
                  Price
                </div>
                <div className={`font-mono text-lg sm:text-xl font-semibold ${event.is_free ? "text-green-400" : "text-[var(--gold)]"}`}>
                  {formatPrice(event)}
                </div>
                <div className="font-mono text-xs text-[var(--muted)]">
                  {event.is_free ? "No cover" : "Per ticket"}
                </div>
              </div>
            </div>

            {/* Description */}
            {event.description && (
              <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
                <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
                  About
                </h2>
                <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed">
                  {event.description}
                </p>
              </div>
            )}

            {/* Tags */}
            {event.tags && event.tags.length > 0 && (
              <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
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
              <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
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

            {/* Location */}
            {event.venue && event.venue.address && (
              <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
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
                <p className="text-[var(--soft)]">
                  <span className="text-[var(--cream)] font-medium">{event.venue.name}</span>
                  <br />
                  {event.venue.address}
                  <br />
                  {event.venue.city}, {event.venue.state}
                </p>
              </div>
            )}

            {/* Who's Going section */}
            <WhosGoing eventId={event.id} className="mt-6 pt-6 border-t border-[var(--twilight)]" />

            {/* RSVP and Recommend */}
            <div className="mt-8 pt-6 border-t border-[var(--twilight)] flex flex-wrap items-center gap-3">
              <RSVPButton eventId={event.id} />
              <RecommendButton eventId={event.id} />
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              {event.ticket_url && (
                <a
                  href={event.ticket_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-[var(--coral)] text-[var(--void)] text-lg font-semibold rounded-lg hover:bg-[var(--rose)] transition-colors glow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                  Get Tickets
                </a>
              )}

              <AddToCalendar
                title={event.title}
                date={event.start_date}
                time={event.start_time}
                venue={event.venue?.name}
                address={event.venue?.address}
                city={event.venue?.city}
                state={event.venue?.state}
              />

              {event.source_url && (
                <a
                  href={event.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[var(--muted)] text-sm font-medium rounded-lg hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View Source
                </a>
              )}
            </div>
          </div>

          {/* Before & After - Nearby Spots */}
          {nearbySpots.length > 0 && event.venue?.neighborhood && (
            <div className="mt-8">
              <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-4">
                Before & After in {event.venue.neighborhood}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {nearbySpots.map((spot) => (
                  <Link
                    key={spot.id}
                    href={`/spots/${spot.slug}`}
                    className="group p-3 border border-[var(--twilight)] rounded-lg transition-colors"
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
          {(venueEvents.length > 0 || sameDateEvents.length > 0 || similarEvents.length > 0) && (
            <div className="mt-8 space-y-8">
              {/* Similar Events */}
              {similarEvents.length > 0 && event.category && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <CategoryIcon type={event.category} size={14} />
                    <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest">
                      More {event.category.replace(/_/g, " ")} events
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {similarEvents.map((relatedEvent) => (
                      <Link
                        key={relatedEvent.id}
                        href={`/events/${relatedEvent.id}`}
                        className="block p-3 border border-[var(--twilight)] rounded-lg transition-all group card-event-hover"
                        style={{ backgroundColor: "var(--card-bg)" }}
                      >
                        {relatedEvent.image_url && (
                          <div className="aspect-[4/3] rounded-lg overflow-hidden bg-[var(--night)] relative mb-2">
                            <Image
                              src={relatedEvent.image_url}
                              alt={relatedEvent.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}
                        <h3 className="text-sm text-[var(--cream)] font-medium line-clamp-2 group-hover:text-[var(--coral)] transition-colors">
                          {relatedEvent.title}
                        </h3>
                        <p className="text-xs text-[var(--muted)] mt-1 truncate">
                          {relatedEvent.venue?.name || "Venue TBA"}
                        </p>
                        <p className="text-[0.65rem] text-[var(--soft)] font-mono mt-1">
                          {format(parseISO(relatedEvent.start_date), "EEE, MMM d")}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* More at this venue */}
              {venueEvents.length > 0 && event.venue && (
                <div>
                  <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-4">
                    More at {event.venue.name}
                  </h2>
                  <div className="space-y-2">
                    {venueEvents.map((relatedEvent) => (
                      <Link
                        key={relatedEvent.id}
                        href={`/events/${relatedEvent.id}`}
                        className="block p-4 border border-[var(--twilight)] rounded-lg transition-colors group"
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
                    {sameDateEvents.map((relatedEvent) => (
                      <Link
                        key={relatedEvent.id}
                        href={`/events/${relatedEvent.id}`}
                        className="block p-4 border border-[var(--twilight)] rounded-lg transition-colors group"
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
      />
    </>
  );
}
