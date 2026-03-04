import Link from "next/link";
import { safeJsonLd, formatTime } from "@/lib/formats";
import { buildBreadcrumbSchema } from "@/lib/breadcrumb-schema";
import { toAbsoluteUrl } from "@/lib/site-url";
import type { EventWithLocation } from "@/lib/search";

type Props = {
  title: string;
  description: string;
  portalSlug: string;
  portalName: string;
  canonicalPath: string;
  findHref: string;
  breadcrumbLabel: string;
  events: EventWithLocation[];
};

function buildCollectionSchema(
  props: Pick<Props, "title" | "description" | "canonicalPath" | "portalSlug" | "portalName"> & {
    events: EventWithLocation[];
  }
) {
  const items = props.events.slice(0, 50).map((event, i) => {
    const startDateTime = event.start_time
      ? `${event.start_date}T${event.start_time}`
      : event.start_date;

    return {
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Event",
        name: event.title,
        startDate: startDateTime,
        ...(event.end_date ? { endDate: event.end_date } : {}),
        url: toAbsoluteUrl(`/${props.portalSlug}/events/${event.id}`),
        ...(event.venue
          ? {
              location: {
                "@type": "Place",
                name: event.venue.name,
                address: {
                  "@type": "PostalAddress",
                  addressLocality: event.venue.city,
                  addressRegion: event.venue.state,
                },
              },
            }
          : {}),
        ...(event.image_url ? { image: event.image_url } : {}),
        ...(event.is_free
          ? {
              isAccessibleForFree: true,
              offers: {
                "@type": "Offer",
                price: 0,
                priceCurrency: "USD",
                availability: "https://schema.org/InStock",
              },
            }
          : {}),
      },
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: props.title,
    description: props.description,
    url: toAbsoluteUrl(props.canonicalPath),
    isPartOf: {
      "@type": "WebSite",
      name: "Lost City",
      url: toAbsoluteUrl("/"),
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: props.events.length,
      itemListElement: items,
    },
  };
}

export default function EventListingPage({
  title,
  description,
  portalSlug,
  portalName,
  canonicalPath,
  findHref,
  breadcrumbLabel,
  events,
}: Props) {
  const collectionSchema = buildCollectionSchema({
    title,
    description,
    canonicalPath,
    portalSlug,
    portalName,
    events,
  });

  const breadcrumb = buildBreadcrumbSchema([
    { name: portalName, href: `/${portalSlug}` },
    { name: breadcrumbLabel },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(collectionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }}
      />

      <div className="min-h-screen bg-[var(--void)]">
        <header className="max-w-3xl mx-auto px-4 pt-6 pb-4">
          <nav className="mb-4">
            <Link
              href={`/${portalSlug}`}
              className="text-sm text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
            >
              &larr; {portalName}
            </Link>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--cream)] mb-2">
            {title}
          </h1>
          <p className="text-sm text-[var(--soft)]">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </p>
        </header>

        <main className="max-w-3xl mx-auto px-4 pb-20">
          <ul className="divide-y divide-[var(--twilight)]">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/${portalSlug}/events/${event.id}`}
                  className="flex items-start gap-3 py-3 hover:bg-[var(--night)] transition-colors rounded-lg px-2 -mx-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-[var(--cream)] truncate">
                      {event.title}
                    </p>
                    <p className="text-sm text-[var(--soft)] mt-0.5">
                      {event.start_date}
                      {event.start_time ? ` \u00b7 ${formatTime(event.start_time, event.is_all_day)}` : ""}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
                      {event.venue?.name}
                      {event.venue?.neighborhood ? ` \u00b7 ${event.venue.neighborhood}` : ""}
                      {event.category_id ? ` \u00b7 ${event.category_id}` : ""}
                      {event.is_free ? " \u00b7 Free" : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {events.length === 0 && (
            <p className="text-center text-[var(--soft)] py-12">
              No events found right now. Check back soon.
            </p>
          )}

          <div className="mt-8 text-center">
            <Link
              href={findHref}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:opacity-90 transition-opacity"
            >
              See all events
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}
