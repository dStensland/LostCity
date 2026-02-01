import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatTimeSplit } from "@/lib/formats";
import { format, startOfDay } from "date-fns";
import CategoryIcon, { getCategoryColor } from "./CategoryIcon";
import CategoryPlaceholder from "./CategoryPlaceholder";

type TonightEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  category: string | null;
  image_url: string | null;
  venue: {
    name: string;
    neighborhood: string | null;
  } | null;
};

async function getTonightEvents(): Promise<TonightEvent[]> {
  try {
    // Use date-fns format to get local date (not UTC from toISOString)
    const today = format(startOfDay(new Date()), "yyyy-MM-dd");
    const now = new Date();
    const currentHour = now.getHours();

    // After 4pm, show tonight's events; before 4pm, don't show this section
    if (currentHour < 16) {
      return [];
    }

    // Calculate time filter - show events that haven't ended yet
    // Events are "tonight" if they haven't started yet or started within last 2 hours
    const currentTime = format(now, "HH:mm:ss");
    const twoHoursAgo = format(new Date(now.getTime() - 2 * 60 * 60 * 1000), "HH:mm:ss");

    const { data: events, error } = await supabase
      .from("events")
      .select(`
        id,
        title,
        start_date,
        start_time,
        is_all_day,
        is_free,
        category,
        image_url,
        venue:venues(name, neighborhood)
      `)
      .eq("start_date", today)
      .is("canonical_event_id", null) // Only show canonical events
      .is("portal_id", null) // Only show public events
      // Time filter: show events starting in future or started within last 2 hours, or all-day events
      .or(`start_time.gte.${twoHoursAgo},is_all_day.eq.true`)
      .order("start_time", { ascending: true })
      .limit(12); // Fetch more to allow for filtering

    if (error || !events) {
      console.error("Failed to fetch tonight events:", error);
      return [];
    }

    // Cast to expected type
    const typedEvents = events as unknown as TonightEvent[];

    // Return first 6 events (already filtered by query)
    return typedEvents.slice(0, 6);
  } catch (error) {
    console.error("Error in getTonightEvents:", error);
    return [];
  }
}

export default async function TonightsPicks({ portalSlug }: { portalSlug?: string } = {}) {
  const events = await getTonightEvents();

  if (events.length === 0) {
    return null;
  }

  const heroEvent = events[0];
  const otherEvents = events.slice(1, 4);
  const heroCategory = heroEvent.category ? getCategoryColor(heroEvent.category) : "var(--neon-magenta)";

  return (
    <section className="py-8 -mx-4 px-4 mb-2 relative overflow-hidden">
      {/* Atmospheric background glow */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${heroCategory}22 0%, transparent 70%)`,
        }}
      />

      <div className="relative max-w-3xl mx-auto">
        {/* Section header with improved visual hierarchy */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--neon-magenta)] to-[var(--coral)] flex items-center justify-center shadow-lg"
            style={{ boxShadow: '0 0 20px rgba(232, 85, 160, 0.3)' }}
          >
            <span className="text-xl">🌙</span>
          </div>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-semibold text-[var(--cream)] tracking-tight">Tonight&apos;s Picks</h2>
            <p className="font-mono text-xs text-[var(--muted)] mt-0.5">Hand-picked for your evening</p>
          </div>
        </div>

        {/* Hero card with optimized image loading */}
        <Link
          href={portalSlug ? `/${portalSlug}?event=${heroEvent.id}` : `/events/${heroEvent.id}`}
          scroll={false}
          className="block relative rounded-2xl overflow-hidden mb-4 group card-atmospheric card-hero transition-transform duration-300 hover:scale-[1.01]"
          style={{
            "--glow-color": heroCategory,
            willChange: "transform",
          } as React.CSSProperties}
        >
          {/* Background - optimized for performance */}
          {heroEvent.image_url ? (
            <>
              <div
                className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                style={{
                  backgroundImage: `url(${heroEvent.image_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  willChange: "transform",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/20" />
            </>
          ) : (
            <CategoryPlaceholder category={heroEvent.category} size="lg" />
          )}

          {/* Content */}
          <div className="relative p-5 pt-32">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-full bg-[var(--neon-magenta)]/30 text-[var(--neon-magenta)] text-[0.65rem] font-mono font-medium backdrop-blur-sm">
                TONIGHT
              </span>
              {heroEvent.category && (
                <span
                  className="px-2 py-0.5 rounded-full text-[0.65rem] font-mono font-medium"
                  style={{ backgroundColor: `${heroCategory}33`, color: heroCategory }}
                >
                  <CategoryIcon type={heroEvent.category} size={10} className="inline mr-1" glow="none" />
                  {heroEvent.category}
                </span>
              )}
            </div>

            <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-[var(--neon-magenta)] transition-colors line-clamp-2">
              {heroEvent.title}
            </h3>

            <div className="flex items-center gap-2 text-sm text-white/80 font-mono">
              {heroEvent.start_time && (
                <span className="font-medium">
                  {formatTimeSplit(heroEvent.start_time, heroEvent.is_all_day).time}
                  <span className="opacity-60 ml-0.5 text-xs">
                    {formatTimeSplit(heroEvent.start_time, heroEvent.is_all_day).period}
                  </span>
                </span>
              )}
              {heroEvent.venue && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{heroEvent.venue.name}</span>
                </>
              )}
              {heroEvent.is_free && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="text-[var(--neon-green)]">Free</span>
                </>
              )}
            </div>
          </div>

          {/* Hover arrow */}
          <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* Other tonight events */}
        {otherEvents.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {otherEvents.map((event) => {
              const categoryColor = event.category ? getCategoryColor(event.category) : null;
              return (
                <Link
                  key={event.id}
                  href={portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`}
                  scroll={false}
                  className="block p-3 rounded-xl bg-[var(--dusk)]/80 border border-[var(--twilight)] hover:border-[var(--neon-magenta)]/40 transition-all group card-atmospheric"
                  style={{
                    "--glow-color": categoryColor || "var(--neon-magenta)",
                  } as React.CSSProperties}
                >
                  <div className="font-mono text-[0.6rem] text-[var(--muted)] mb-1">
                    {event.start_time ? formatTimeSplit(event.start_time, event.is_all_day).time : "Tonight"}
                  </div>
                  <h4 className="text-sm text-[var(--cream)] font-medium line-clamp-2 group-hover:text-[var(--neon-magenta)] transition-colors mb-1">
                    {event.title}
                  </h4>
                  {event.venue && (
                    <p className="font-mono text-[0.55rem] text-[var(--muted)] truncate">
                      {event.venue.name}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* View all tonight link */}
        {events.length > 4 && (
          <Link
            href={portalSlug ? `/${portalSlug}?view=events&date=today` : `/?view=events&date=today`}
            className="block mt-4 text-center py-2 rounded-lg border border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--neon-magenta)] hover:border-[var(--neon-magenta)]/30 transition-colors font-mono text-xs"
          >
            View all tonight&apos;s events →
          </Link>
        )}
      </div>
    </section>
  );
}
