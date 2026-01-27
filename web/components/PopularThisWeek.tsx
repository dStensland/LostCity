import Link from "next/link";
import { getPopularEvents, type EventWithLocation } from "@/lib/search";
import { formatTimeSplit } from "@/lib/formats";
import { format, parseISO } from "date-fns";
import CategoryIcon, { getCategoryColor } from "./CategoryIcon";

// Get reflection color class based on category
function getReflectionClass(category: string | null): string {
  if (!category) return "";
  const reflectionMap: Record<string, string> = {
    music: "reflect-music",
    comedy: "reflect-comedy",
    art: "reflect-art",
    theater: "reflect-theater",
    film: "reflect-film",
    community: "reflect-community",
    food_drink: "reflect-food",
    food: "reflect-food",
    sports: "reflect-sports",
    fitness: "reflect-fitness",
    nightlife: "reflect-nightlife",
    family: "reflect-family",
  };
  return reflectionMap[category] || "";
}

export default async function PopularThisWeek({ portalSlug }: { portalSlug?: string } = {}) {
  const events = await getPopularEvents(6);

  // Don't render if no popular events
  if (events.length === 0) {
    return null;
  }

  return (
    <section className="py-4 border-b border-[var(--twilight)]">
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="font-mono text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-3">
          Popular This Week
        </h2>

        {/* Horizontal scroll container */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {events.map((event) => (
            <PopularEventCard key={event.id} event={event} portalSlug={portalSlug} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PopularEventCard({ event, portalSlug }: { event: EventWithLocation; portalSlug?: string }) {
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  const dateObj = parseISO(event.start_date);
  const dayName = format(dateObj, "EEE");
  const dayNum = format(dateObj, "d");
  const categoryColor = event.category ? getCategoryColor(event.category) : null;
  const reflectionClass = getReflectionClass(event.category);

  const totalEngagement =
    (event.going_count || 0) + (event.interested_count || 0) + (event.recommendation_count || 0);

  return (
    <Link
      href={portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`}
      scroll={false}
      className={`flex-shrink-0 w-64 p-3 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg hover:border-[var(--coral)] transition-colors group card-atmospheric ${reflectionClass}`}
      style={{
        "--glow-color": categoryColor || "var(--coral)",
        "--reflection-color": categoryColor ? `color-mix(in srgb, ${categoryColor} 15%, transparent)` : undefined,
      } as React.CSSProperties}
    >
      <div className="flex items-start gap-3">
        {/* Date block */}
        <div className="flex-shrink-0 w-10 text-center">
          <div className="font-mono text-[0.6rem] text-[var(--muted)] uppercase">
            {dayName}
          </div>
          <div className="font-serif text-lg text-[var(--cream)]">{dayNum}</div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-sans text-sm font-medium text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors">
            {event.title}
          </h3>

          <div className="flex items-center gap-1.5 mt-1 text-[var(--muted)]">
            <CategoryIcon type={event.category || "other"} size={12} />
            <span className="font-mono text-[0.6rem]">
              {time}
              <span className="text-[var(--twilight)]">{period}</span>
            </span>
          </div>

          {event.venue?.name && (
            <p className="font-mono text-[0.6rem] text-[var(--muted)] truncate mt-0.5">
              {event.venue.name}
            </p>
          )}

          {/* Engagement indicator */}
          <div className="flex items-center gap-1 mt-2">
            <span className="font-mono text-[0.6rem] text-[var(--coral)]">
              {totalEngagement} {totalEngagement === 1 ? "person" : "people"} interested
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
