import { getTentpoleEvents, type TentpoleEvent } from "@/lib/festivals";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { type CountdownLabel, getUrgencyColor } from "@/lib/moments-utils";
import { getLocalDateString } from "@/lib/formats";
import { PortalHeader } from "@/components/headers";
import FilmPortalNav from "../_components/film/FilmPortalNav";
import Link from "next/link";
import Image from "@/components/SmartImage";
import type { Metadata } from "next";

export const revalidate = 300;

type Props = {
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal: portalSlug } = await params;
  const portal = await getCachedPortalBySlug(portalSlug);
  const portalName = portal?.name || "Lost City";

  return {
    title: `The Big Stuff | ${portalName}`,
    description: `The biggest events and festivals in ${portalName}. Curated tentpole events you won't want to miss.`,
  };
}

function computeTentpoleCountdown(
  event: TentpoleEvent,
  today: string
): CountdownLabel {
  const start = event.start_date;
  const end = event.end_date;

  if (!start) {
    return { urgency: "tbd", text: "TBD", daysUntil: null };
  }

  const todayMs = new Date(today + "T00:00:00").getTime();
  const startMs = new Date(start + "T00:00:00").getTime();
  const endMs = end
    ? new Date(end + "T00:00:00").getTime()
    : startMs;

  if (todayMs >= startMs && todayMs <= endMs) {
    return { urgency: "happening-now", text: "Happening Now", daysUntil: 0 };
  }

  if (todayMs > endMs) {
    return { urgency: "tbd", text: "Past", daysUntil: null };
  }

  const daysUntil = Math.ceil((startMs - todayMs) / (1000 * 60 * 60 * 24));

  if (daysUntil === 1) {
    return { urgency: "starts-tomorrow", text: "Starts Tomorrow", daysUntil: 1 };
  }
  if (daysUntil <= 6) {
    return { urgency: "days-away", text: `In ${daysUntil} Days`, daysUntil };
  }
  if (daysUntil <= 13) {
    return { urgency: "next-week", text: "Next Week", daysUntil };
  }
  if (daysUntil <= 56) {
    const weeks = Math.round(daysUntil / 7);
    return {
      urgency: "weeks-away",
      text: weeks === 1 ? "In 1 Week" : `In ${weeks} Weeks`,
      daysUntil,
    };
  }

  const startDate = new Date(start + "T00:00:00");
  const monthLabel = startDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  return { urgency: "month-label", text: monthLabel, daysUntil };
}

function formatEventDates(event: TentpoleEvent): string {
  const start = new Date(event.start_date + "T00:00:00");

  if (!event.end_date || event.start_date === event.end_date) {
    return start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const end = new Date(event.end_date + "T00:00:00");
  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
}

export default async function BigStuffPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const portal = await getCachedPortalBySlug(portalSlug);

  const activePortalSlug = portal?.slug || portalSlug;
  const activePortalName = portal?.name || portalSlug.charAt(0).toUpperCase() + portalSlug.slice(1);
  const isFilmPortal = portal ? getPortalVertical(portal) === "film" : false;
  const today = getLocalDateString();

  const events = await getTentpoleEvents(portal?.id);

  // Split into happening now, upcoming, and past
  const happeningNow: TentpoleEvent[] = [];
  const upcoming: TentpoleEvent[] = [];

  for (const event of events) {
    const countdown = computeTentpoleCountdown(event, today);
    if (countdown.urgency === "happening-now") {
      happeningNow.push(event);
    } else if (countdown.urgency !== "tbd") {
      upcoming.push(event);
    }
  }

  const totalCount = happeningNow.length + upcoming.length;

  return (
    <div className="min-h-screen">
      <PortalHeader
        portalSlug={activePortalSlug}
        portalName={activePortalName}
        backLink={{ label: "Back", fallbackHref: `/${activePortalSlug}` }}
        hideNav
      />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-16 space-y-8">
        {isFilmPortal && <FilmPortalNav portalSlug={activePortalSlug} />}

        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold text-[var(--cream)] mb-2">
            The Big Stuff
          </h1>
          <p className="text-[var(--soft)]">
            {totalCount > 0
              ? `${totalCount} major event${totalCount !== 1 ? "s" : ""} coming to ${activePortalName}`
              : `Major events in ${activePortalName}`}
          </p>
        </div>

        {/* Happening Now */}
        {happeningNow.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-[var(--neon-red)] mb-4 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--neon-red)] animate-pulse" />
              Happening Now
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {happeningNow.map((event) => (
                <TentpoleCard
                  key={event.id}
                  event={event}
                  portalSlug={activePortalSlug}
                  today={today}
                />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-[var(--cream)] mb-4">
              Coming Up
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcoming.map((event) => (
                <TentpoleCard
                  key={event.id}
                  event={event}
                  portalSlug={activePortalSlug}
                  today={today}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {totalCount === 0 && (
          <div className="py-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <p className="text-[var(--muted)]">
              No major events coming up yet. Check back soon!
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function TentpoleCountdownBadge({
  event,
  today,
}: {
  event: TentpoleEvent;
  today: string;
}) {
  const countdown = computeTentpoleCountdown(event, today);
  if (countdown.urgency === "tbd" || countdown.text === "Past") return null;

  const color = getUrgencyColor(countdown.urgency);
  return (
    <span
      className="inline-flex items-center rounded-full font-mono font-medium uppercase tracking-wider backdrop-blur-sm px-2 py-0.5 text-2xs"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 25%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
        borderWidth: 1,
        borderStyle: "solid",
      }}
    >
      {countdown.text}
    </span>
  );
}

function TentpoleCard({
  event,
  portalSlug,
  today,
}: {
  event: TentpoleEvent;
  portalSlug: string;
  today: string;
}) {
  // Link to festival detail page if event is linked to a festival, otherwise link to event
  const href = event.festival?.slug
    ? `/${portalSlug}/festivals/${event.festival.slug}`
    : `/${portalSlug}?event=${event.id}`;

  const displayImage = event.image_url || event.festival?.image_url;
  const displayName = event.festival?.name || event.title;
  const displayLocation =
    event.venue?.name ||
    event.festival?.location ||
    event.festival?.neighborhood;

  return (
    <Link
      href={href}
      className="group block rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] overflow-hidden hover:bg-[var(--card-bg-hover)] hover:border-[var(--soft)] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
    >
      {/* Image */}
      <div className="relative w-full aspect-[4/5] bg-[var(--night)] overflow-hidden">
        {!displayImage && <div className="absolute inset-0 skeleton-shimmer" />}
        {displayImage ? (
          <Image
            src={displayImage}
            alt={displayName}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center relative z-[1]">
            <svg className="w-12 h-12 text-[var(--muted)]" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
        )}

        {/* Free badge */}
        {event.is_free && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-bold bg-[var(--neon-green)] text-[var(--void)]">
            FREE
          </span>
        )}

        {/* Countdown badge */}
        <div className="absolute top-2 left-2">
          <TentpoleCountdownBadge event={event} today={today} />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-[var(--cream)] mb-1 line-clamp-2 group-hover:text-accent transition-colors">
          {displayName}
        </h3>
        <p className="text-sm text-[var(--muted)] mb-2">
          {formatEventDates(event)}
        </p>
        {displayLocation && (
          <p className="text-xs text-[var(--soft)] flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {displayLocation}
          </p>
        )}
        {event.category && (
          <div className="flex flex-wrap gap-1 mt-2">
            <span className="px-1.5 py-0.5 rounded text-2xs font-mono uppercase border border-[var(--twilight)] text-[var(--muted)]">
              {event.category.replace(/_/g, " ")}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
