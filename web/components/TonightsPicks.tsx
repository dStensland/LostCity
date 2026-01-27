import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatTimeSplit } from "@/lib/formats";
import { format } from "date-fns";
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
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const currentHour = now.getHours();

    // After 4pm, show tonight's events; before 4pm, don't show this section
    if (currentHour < 16) {
      return [];
    }

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
      .eq("is_live", true)
      .order("start_time", { ascending: true })
      .limit(6);

    if (error || !events) {
      console.error("Failed to fetch tonight events:", error);
      return [];
    }

    // Cast to expected type for filtering
    const typedEvents = events as unknown as TonightEvent[];

    // Filter to events that haven't started yet or started within last hour
    return typedEvents.filter((event) => {
      if (event.is_all_day) return true;
      if (!event.start_time) return true;
      // Include if starts in the future or started within last 2 hours
      const twoHoursAgo = format(new Date(now.getTime() - 2 * 60 * 60 * 1000), "HH:mm:ss");
      return event.start_time >= twoHoursAgo;
    });
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
    <section className="py-6 -mx-4 px-4 mb-6 relative overflow-hidden">
      {/* Atmospheric background glow */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${heroCategory}22 0%, transparent 70%)`,
        }}
      />

      <div className="relative max-w-3xl mx-auto">
        {/* Section header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--neon-magenta)] to-[var(--coral)] flex items-center justify-center">
            <span className="text-lg">🌙</span>
          </div>
          <div>
            <h2 className="font-serif text-xl text-[var(--cream)]">Tonight&apos;s Picks</h2>
            <p className="font-mono text-xs text-[var(--muted)]">Hand-picked for your evening</p>
          </div>
        </div>

        {/* Hero card */}
        <Link
          href={portalSlug ? `/${portalSlug}?event=${heroEvent.id}` : `/events/${heroEvent.id}`}
          scroll={false}
          className="block relative rounded-2xl overflow-hidden mb-4 group card-atmospheric card-hero"
          style={{
            "--glow-color": heroCategory,
          } as React.CSSProperties}
        >
          {/* Background */}
          {heroEvent.image_url ? (
            <>
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${heroEvent.image_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
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
