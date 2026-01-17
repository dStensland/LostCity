import Link from "next/link";
import type { PortalSection as PortalSectionType } from "@/lib/portal-sections";

interface PortalSectionProps {
  section: PortalSectionType;
}

export function PortalSection({ section }: PortalSectionProps) {
  // Only render curated sections with items for now
  if (section.section_type !== "curated" || !section.items?.length) {
    return null;
  }

  // Filter to only items with hydrated event data
  const eventsWithData = section.items.filter((item) => item.event);

  if (eventsWithData.length === 0) {
    return null;
  }

  return (
    <section className="py-6 border-b border-[var(--twilight)]">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-4">
          <h2 className="font-serif text-xl text-[var(--cream)]">{section.title}</h2>
          {section.description && (
            <p className="font-mono text-xs text-[var(--muted)] mt-1">{section.description}</p>
          )}
        </div>

        <div className="grid gap-3">
          {eventsWithData.map((item) => {
            const event = item.event!;
            const date = new Date(event.start_date);
            const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
            const dayOfMonth = date.getDate();
            const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();

            return (
              <Link
                key={item.id}
                href={`/events/${event.id}`}
                className="group flex items-start gap-4 p-3 bg-[var(--night)] hover:bg-[var(--dusk)] rounded-lg border border-[var(--twilight)] hover:border-[var(--portal-primary,var(--neon-magenta))]/30 transition-all"
              >
                {/* Date block */}
                <div className="flex-shrink-0 text-center w-14">
                  <div className="font-mono text-[0.65rem] text-[var(--muted)]">{dayOfWeek}</div>
                  <div className="font-mono text-xl text-[var(--cream)] leading-tight">{dayOfMonth}</div>
                  <div className="font-mono text-[0.65rem] text-[var(--muted)]">{month}</div>
                </div>

                {/* Event info */}
                <div className="flex-1 min-w-0">
                  <div className="font-serif text-[var(--cream)] group-hover:text-[var(--portal-primary,var(--neon-magenta))] transition-colors line-clamp-2">
                    {event.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {event.venue && (
                      <span className="font-mono text-xs text-[var(--muted)]">
                        {event.venue.name}
                      </span>
                    )}
                    {event.start_time && (
                      <span className="font-mono text-xs text-[var(--muted)]">
                        · {formatTime(event.start_time)}
                      </span>
                    )}
                    {event.is_free && (
                      <span className="px-1.5 py-0.5 bg-[var(--neon-green)]/20 text-[var(--neon-green)] font-mono text-[0.6rem] rounded">
                        FREE
                      </span>
                    )}
                  </div>
                  {item.note && (
                    <p className="font-mono text-xs text-[var(--coral)] mt-1 italic">
                      {item.note}
                    </p>
                  )}
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0 text-[var(--muted)] group-hover:text-[var(--portal-primary,var(--neon-magenta))] transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}
