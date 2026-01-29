import Link from "next/link";
import { getTrendingEvents, type EventWithLocation } from "@/lib/search";
import { formatTimeSplit } from "@/lib/formats";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
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

function getSmartDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

export default async function TrendingNow({ portalSlug }: { portalSlug?: string } = {}) {
  let events: EventWithLocation[] = [];

  try {
    events = await getTrendingEvents(6);
  } catch (error) {
    console.error("Failed to fetch trending events:", error);
    return null;
  }

  // Don't render if no trending events
  if (events.length === 0) {
    return null;
  }

  return (
    <section className="py-4 border-b border-[var(--twilight)]">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">📈</span>
          <h2 className="font-mono text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
            Trending Now
          </h2>
          <span className="px-1.5 py-0.5 text-[0.55rem] font-mono bg-[var(--neon-magenta)]/20 text-[var(--neon-magenta)] rounded">
            HOT
          </span>
        </div>

        {/* Horizontal scroll container with scroll snap on mobile */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide snap-x snap-mandatory md:snap-none">
          {events.map((event) => (
            <TrendingEventCard key={event.id} event={event} portalSlug={portalSlug} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TrendingEventCard({ event, portalSlug }: { event: EventWithLocation; portalSlug?: string }) {
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  const categoryColor = event.category ? getCategoryColor(event.category) : null;
  const reflectionClass = getReflectionClass(event.category);
  const smartDate = getSmartDate(event.start_date);
  const goingCount = event.going_count || 0;

  return (
    <Link
      href={portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`}
      scroll={false}
      className={`flex-shrink-0 w-72 p-3 bg-[var(--dusk)] rounded-lg transition-all group card-atmospheric card-trending snap-start ${reflectionClass}`}
      style={{
        "--glow-color": categoryColor || "var(--neon-magenta)",
        "--reflection-color": categoryColor ? `color-mix(in srgb, ${categoryColor} 15%, transparent)` : undefined,
      } as React.CSSProperties}
    >
      <div className="flex items-start gap-3">
        {/* Trending indicator */}
        <div className="flex-shrink-0 w-10 flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-[var(--neon-magenta)]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--neon-magenta)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-sans text-sm font-medium text-[var(--cream)] line-clamp-2 group-hover:text-[var(--neon-magenta)] transition-colors">
            {event.title}
          </h3>

          <div className="flex items-center gap-1.5 mt-1 text-[var(--muted)]">
            <CategoryIcon type={event.category || "other"} size={12} />
            <span className="font-mono text-[0.6rem]">
              {smartDate} · {time}
              {period && <span className="opacity-60">{period}</span>}
            </span>
          </div>

          {event.venue?.name && (
            <p className="font-mono text-[0.6rem] text-[var(--muted)] truncate mt-0.5">
              {event.venue.name}
            </p>
          )}

          {/* Trending stats */}
          <div className="flex items-center gap-2 mt-2">
            {goingCount > 0 && (
              <span className="flex items-center gap-1 font-mono text-[0.6rem] text-[var(--neon-green)]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] animate-pulse" />
                {goingCount} going
              </span>
            )}
            <span className="font-mono text-[0.55rem] text-[var(--neon-magenta)]">
              Heating up
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
