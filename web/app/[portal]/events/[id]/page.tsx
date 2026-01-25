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
import EventQuickActions from "@/components/EventQuickActions";
import VenueVibes from "@/components/VenueVibes";
import LinkifyText from "@/components/LinkifyText";
import { formatTimeSplit } from "@/lib/formats";
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

  // Organizer (use producer if available, otherwise venue)
  if (event.producer) {
    schema.organizer = {
      "@type": "Organization",
      name: event.producer.name,
      url: event.producer.website || undefined,
    };
  } else if (event.venue) {
    schema.organizer = {
      "@type": "Organization",
      name: event.venue.name,
    };
  }

  // Performer (for music/comedy/theater events)
  if (event.category === "music" || event.category === "comedy") {
    // Use event title as performer name (usually the artist/comedian)
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

        <main className="max-w-3xl mx-auto px-4 py-6 pb-28">
          {/* Hero Section - compact 2:1 ratio for faster access to CTAs */}
          <div
            className={`relative aspect-[2/1] bg-[var(--night)] rounded-xl overflow-hidden mb-4 animate-fade-in ${
              isLive ? "live-border-glow" : ""
            }`}
            style={{
              "--glow-color": categoryColor,
            } as React.CSSProperties}
          >
            <EventHeroImage
              src={event.image_url || ""}
              alt={event.title}
              category={event.category}
              title={event.title}
              venueName={event.venue?.name}
              neighborhood={event.venue?.neighborhood}
              isLive={isLive}
              eventId={event.id}
            />

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

          {/* Quick Actions - Price, Date, Time + Primary CTA */}
          <EventQuickActions
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
            className="border border-[var(--twilight)] rounded-xl p-5 sm:p-6 animate-fade-up"
            style={{ backgroundColor: "var(--card-bg)", animationDelay: "0.2s" }}
          >
            {/* 1. Description - primary content, what is this event? */}
            {event.description && (
              <div className="mb-5">
                <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
                  About
                </h2>
                <p className="text-[var(--soft)] whitespace-pre-wrap leading-relaxed">
                  <LinkifyText text={event.description} />
                </p>
              </div>
            )}

            {/* 2. Location - where is it? (important decision info) */}
            {event.venue && event.venue.address && (
              <div className={`mb-5 ${event.description ? "pt-5 border-t border-[var(--twilight)]" : ""}`}>
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
                  className="block p-3 rounded-lg border border-[var(--twilight)] transition-colors hover:border-[var(--coral)]/50 group"
                  style={{ backgroundColor: "var(--void)" }}
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

                  {/* Venue Vibes */}
                  <VenueVibes vibes={event.venue.vibes} className="mt-2" />
                </Link>

                {/* Community Tags */}
                <div className="mt-3">
                  <VenueTagList venueId={event.venue.id} />
                </div>
              </div>
            )}

            {/* 3. Social proof - friends and who's going */}
            <div className="pt-5 border-t border-[var(--twilight)]">
              <FriendsGoing eventId={event.id} className="mb-4" />
              <WhosGoing eventId={event.id} />
            </div>

            {/* 4. Series link (if part of series) */}
            {event.series && (
              <div className="pt-5 border-t border-[var(--twilight)]">
                <Link
                  href={`/${activePortalSlug}/series/${event.series.slug}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-[var(--twilight)] transition-colors hover:border-[var(--coral)]/50 group"
                  style={{ backgroundColor: "var(--void)" }}
                >
                  <svg
                    className="w-5 h-5 flex-shrink-0"
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
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[var(--soft)] group-hover:text-[var(--coral)] transition-colors">
                      Part of <span className="text-[var(--cream)] font-medium">{event.series.title}</span>
                    </span>
                    <span
                      className="ml-2 text-[0.6rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${getSeriesTypeColor(event.series.series_type)}20`,
                        color: getSeriesTypeColor(event.series.series_type),
                      }}
                    >
                      {getSeriesTypeLabel(event.series.series_type)}
                    </span>
                  </div>
                  <svg className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}

            {/* 5. Producer/Presented by */}
            {event.producer && (
              <div className="pt-5 border-t border-[var(--twilight)]">
                <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
                  Presented by
                </h2>
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-[var(--twilight)]" style={{ backgroundColor: "var(--void)" }}>
                  <div className="flex items-center gap-3 min-w-0">
                    {event.producer.logo_url ? (
                      <Image
                        src={event.producer.logo_url}
                        alt={event.producer.name}
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

            {/* 6. Tags (if any) */}
            {event.tags && event.tags.length > 0 && (
              <div className="pt-5 border-t border-[var(--twilight)]">
                <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-3">
                  Also Featuring
                </h2>
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 text-[var(--soft)] rounded border border-[var(--twilight)] text-xs"
                      style={{ backgroundColor: "var(--void)" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 7. Flag for QA (minimal) */}
            <div className="pt-5 border-t border-[var(--twilight)]">
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
