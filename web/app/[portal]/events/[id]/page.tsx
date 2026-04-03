import ScrollToTop from "@/components/ScrollToTop";
import { getEventById, getRelatedEvents } from "@/lib/supabase";
import { getCachedPortalBySlug } from "@/lib/portal";
import { format, parseISO } from "date-fns";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { safeJsonLd } from "@/lib/formats";
import { cache } from "react";
import { buildBreadcrumbSchema } from "@/lib/breadcrumb-schema";
import { getEventArtists } from "@/lib/artists";
import {
  suppressEventImageIfVenueFlagged,
} from "@/lib/image-quality-suppression";
import { mapEventServerDataToViewData } from "@/lib/mappers/event-detail-mapper";
import { getNearbyDestinationsForVenue } from "@/lib/spot-detail";
import EventDetailWrapper from "./EventDetailWrapper";

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
      images: [
        {
          url: `/${portalSlug}/events/${event.id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: event.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      images: [
        {
          url: `/${portalSlug}/events/${event.id}/twitter-image`,
          width: 1200,
          height: 600,
          alt: event.title,
        },
      ],
    },
  };
}


type EventWithOrganization = NonNullable<Awaited<ReturnType<typeof getEventById>>>;

function generateEventSchema(event: EventWithOrganization) {
  const locationDesignator = event.venue?.location_designator || "standard";
  const isVirtualLocation = locationDesignator === "virtual";
  // Treat midnight (00:00:00) as a placeholder — crawlers default to it
  const hasRealTime = event.start_time && event.start_time !== "00:00:00";
  const startDateTime = hasRealTime
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

export default async function PortalEventPage({ params }: Props) {
  const { id, portal: portalSlug } = await params;
  const event = await getCachedEventById(parseInt(id, 10));
  const portal = await getCachedPortalBySlug(portalSlug);

  if (!event) {
    notFound();
  }

  const activePortalSlug = portal?.slug || portalSlug;
  const activePortalName =
    portal?.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);

  // Fetch related data in parallel
  const [{ venueEvents, sameDateEvents }, eventArtists, nearbyDestinations] = await Promise.all([
    getRelatedEvents(event, {
      portalId: portal?.id,
      portalCity: portal?.filters?.city ?? "Atlanta",
    }),
    getEventArtists(event.id),
    event.venue
      ? getNearbyDestinationsForVenue({
          id: event.venue.id,
          neighborhood: event.venue.neighborhood,
          lat: event.venue.lat,
          lng: event.venue.lng,
        })
      : Promise.resolve(undefined),
  ]);

  // Map server data to the client view shape
  const initialData = mapEventServerDataToViewData(
    event,
    eventArtists,
    venueEvents,
    sameDateEvents,
    nearbyDestinations ?? undefined
  );

  // JSON-LD schema (using raw eventArtists for performer schema — same data, no extra fetch)
  const eventSchema = withPerformerSchema(
    generateEventSchema(event),
    eventArtists,
    event.category
  );
  // Override description with display_description if present
  if (initialData.event.display_description) {
    eventSchema.description = initialData.event.display_description;
  }
  // Use resolved image in schema if event has no image but series/venue does
  if (!event.image_url && initialData.event.image_url) {
    eventSchema.image = [initialData.event.image_url];
  }

  return (
    <>
      <ScrollToTop />
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
              { name: "Events", href: `/${activePortalSlug}?view=find&lane=events` },
              { name: event.title },
            ])
          ),
        }}
      />
      <EventDetailWrapper
        eventId={event.id}
        portalSlug={activePortalSlug}
        initialData={initialData}
      />
    </>
  );
}
