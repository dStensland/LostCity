import { Suspense } from "react";
import TimeGreeting from "./TimeGreeting";
import HotelSection from "./HotelSection";
import HotelEventCard from "./HotelEventCard";
import HotelHeader from "./HotelHeader";
import type { Portal } from "@/lib/portal-context";

export interface HotelFeedEvent {
  id: string | number;
  title: string;
  start_date: string;
  start_time?: string | null;
  image_url?: string | null;
  description?: string | null;
  venue_name?: string | null;
  category?: string | null;
  is_free?: boolean;
  price_min?: number | null;
  distance_km?: number | null;
}

export interface FeedSection {
  title: string;
  description?: string;
  slug?: string;
  layout?: string;
  events: HotelFeedEvent[];
}

interface HotelFeedProps {
  portal: Portal;
  sections: FeedSection[];
}

/**
 * Main feed component for hotel portal.
 * Renders API sections directly — first section as compact list, rest as featured grid.
 */
export default function HotelFeed({ portal, sections }: HotelFeedProps) {
  const logoUrl = portal.branding?.logo_url as string | null | undefined;

  return (
    <div className="min-h-screen bg-[var(--hotel-ivory)]">
      <HotelHeader
        portalSlug={portal.slug}
        portalName={portal.name}
        logoUrl={logoUrl}
      />

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Time Greeting */}
        <Suspense fallback={<TimeGreetingSkeleton />}>
          <TimeGreeting />
        </Suspense>

        {sections.map((section, index) => {
          // First section or "list" layout → compact cards; others → featured grid
          const useCompact = index === 0 || section.layout === "list";
          const maxItems = useCompact ? 8 : 6;

          return (
            <HotelSection
              key={section.slug || section.title}
              title={section.title}
              subtitle={section.description}
              className="mb-16"
            >
              {useCompact ? (
                <div className="space-y-4 hotel-grid">
                  {section.events.slice(0, maxItems).map((event) => (
                    <HotelEventCard
                      key={event.id}
                      event={event}
                      portalSlug={portal.slug}
                      variant="compact"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 hotel-grid">
                  {section.events.slice(0, maxItems).map((event) => (
                    <HotelEventCard
                      key={event.id}
                      event={event}
                      portalSlug={portal.slug}
                      variant="featured"
                    />
                  ))}
                </div>
              )}
            </HotelSection>
          );
        })}

        {sections.length === 0 && (
          <div className="text-center py-16">
            <p className="font-display text-2xl text-[var(--hotel-stone)] mb-4">
              No events scheduled at the moment
            </p>
            <p className="font-body text-base text-[var(--hotel-stone)]">
              Check back soon for upcoming experiences
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function TimeGreetingSkeleton() {
  return (
    <div className="mb-16">
      <div className="h-12 w-64 bg-[var(--hotel-sand)] rounded mb-3 animate-pulse" />
      <div className="h-6 w-48 bg-[var(--hotel-sand)] rounded animate-pulse" />
    </div>
  );
}
