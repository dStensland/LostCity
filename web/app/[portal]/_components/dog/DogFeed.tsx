import { getDogFeed, type DogEvent, type DogVenue } from "@/lib/dog-data";
import { DogEventCard, DogVenueCard, DogVenueRow } from "./DogCard";
import DogSectionHeader from "./DogSectionHeader";

interface Props {
  portalSlug: string;
}

export default async function DogFeed({ portalSlug }: Props) {
  const sections = await getDogFeed();

  if (sections.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <p
          className="dog-display text-xl font-bold"
          style={{ color: "var(--dog-charcoal)" }}
        >
          Sniffing around...
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--dog-stone)" }}>
          We&apos;re building out the dog-friendly map of Atlanta. Check back
          soon.
        </p>
      </div>
    );
  }

  /** Sections that show tag chips on venue cards */
  const TAG_SECTIONS = new Set(["off_leash", "pup_cups", "trails"]);
  /** Sections that render as compact rows */
  const ROW_SECTIONS = new Set(["patios", "services"]);

  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <section key={section.key}>
          <DogSectionHeader
            title={section.title}
            subtitle={section.subtitle}
            seeAllHref={section.deepPageHref}
            seeAllCount={
              section.items.length > 8 ? section.items.length : undefined
            }
            portalSlug={portalSlug}
          />

          {section.type === "events" ? (
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
              {(section.items as DogEvent[]).map((event) => (
                <DogEventCard
                  key={event.id}
                  event={event}
                  portalSlug={portalSlug}
                />
              ))}
            </div>
          ) : ROW_SECTIONS.has(section.key) ? (
            <div className="space-y-3">
              {(section.items as DogVenue[]).slice(0, 6).map((venue) => (
                <DogVenueRow
                  key={venue.id}
                  venue={venue}
                  portalSlug={portalSlug}
                />
              ))}
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
              {(section.items as DogVenue[]).map((venue) => (
                <DogVenueCard
                  key={venue.id}
                  venue={venue}
                  portalSlug={portalSlug}
                  showTags={TAG_SECTIONS.has(section.key)}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
