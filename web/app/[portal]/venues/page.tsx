import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { PortalHeader } from "@/components/headers";
import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import FilmPortalNav from "../_components/film/FilmPortalNav";
import FilmShowtimeBoard from "../_components/film/FilmShowtimeBoard";

type Props = {
  params: Promise<{ portal: string }>;
};

type RawVenueEventRow = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  image_url: string | null;
  venue: {
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
};

type VenueCard = {
  name: string;
  slug: string | null;
  neighborhood: string | null;
  screeningCount: number;
  todayCount: number;
  nextDate: string;
  nextTime: string | null;
  imageUrl: string | null;
  topTitles: string[];
};

const FALLBACK_PHOTOS = [
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1460881680858-30d872d5b530?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1502139214982-d0ad755818d8?auto=format&fit=crop&w=1600&q=80",
];

const INDIE_THEATER_KEYWORDS = [
  "plaza",
  "tara",
  "starlight",
  "landmark midtown",
  "arthouse",
  "art house",
  "indie",
  "independent",
];

function formatShortDate(isoDate: string): string {
  const utcMidday = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(utcMidday);
}

function formatTimeLabel(time: string | null): string {
  if (!time) return "Time TBA";
  const hour = Number(time.slice(0, 2));
  const minute = time.slice(3, 5);
  if (Number.isNaN(hour)) return time;
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour >= 12 ? "PM" : "AM";
  return `${normalizedHour}:${minute} ${period}`;
}

function isIndieVenueName(name: string): boolean {
  const normalized = name.toLowerCase();
  return INDIE_THEATER_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function getVenuePriority(name: string): number {
  const normalized = name.toLowerCase();
  if (normalized.includes("plaza")) return 0;
  if (normalized.includes("tara")) return 1;
  if (normalized.includes("starlight")) return 2;
  return 10;
}

async function getVenuePulse(limit = 36): Promise<VenueCard[]> {
  const supabase = await createClient();
  const today = getLocalDateString();

  const { data } = await supabase
    .from("events")
    .select(`
      id,
      title,
      start_date,
      start_time,
      image_url,
      venue:venues!events_venue_id_fkey(name,slug,neighborhood)
    `)
    .eq("category", "film")
    .gte("start_date", today)
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(600);

  const rows = (data as RawVenueEventRow[] | null) || [];
  const bucket = new Map<string, VenueCard>();

  for (const row of rows) {
    if (!row.venue) continue;

    const key = (row.venue.slug || row.venue.name).toLowerCase();
    const existing = bucket.get(key);

    if (!existing) {
      bucket.set(key, {
        name: row.venue.name,
        slug: row.venue.slug || null,
        neighborhood: row.venue.neighborhood,
        screeningCount: 1,
        todayCount: row.start_date === today ? 1 : 0,
        nextDate: row.start_date,
        nextTime: row.start_time,
        imageUrl: row.image_url,
        topTitles: [row.title],
      });
      continue;
    }

    existing.screeningCount += 1;
    if (row.start_date === today) {
      existing.todayCount += 1;
    }

    if (
      row.start_date < existing.nextDate ||
      (row.start_date === existing.nextDate && (row.start_time || "") < (existing.nextTime || ""))
    ) {
      existing.nextDate = row.start_date;
      existing.nextTime = row.start_time;
    }

    if (!existing.imageUrl && row.image_url) {
      existing.imageUrl = row.image_url;
    }

    if (!existing.topTitles.includes(row.title) && existing.topTitles.length < 3) {
      existing.topTitles.push(row.title);
    }
  }

  return Array.from(bucket.values())
    .sort((a, b) => {
      const priorityDelta = getVenuePriority(a.name) - getVenuePriority(b.name);
      if (priorityDelta !== 0) return priorityDelta;
      return b.screeningCount - a.screeningCount || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export default async function FilmVenuesPage({ params }: Props) {
  const { portal: slug } = await params;
  const portal = await getCachedPortalBySlug(slug);

  if (!portal || getPortalVertical(portal) !== "film") {
    notFound();
  }

  const venues = await getVenuePulse(36);
  const indieVenues = venues.filter((venue) => isIndieVenueName(venue.name));
  const spotlightVenues = (indieVenues.length > 0 ? indieVenues : venues).slice(0, 3);

  return (
    <div className="min-h-screen bg-[#090d16] text-[#f6f7fb]">
      <PortalHeader portalSlug={portal.slug} portalName={portal.name} backLink={{ label: "Home", fallbackHref: `/${portal.slug}` }} hideNav />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 space-y-7">
        <FilmPortalNav portalSlug={portal.slug} />

        <header className="space-y-2">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-[#8fa2c4]">Atlanta Film</p>
          <h1 className="font-[var(--font-film-editorial)] text-4xl text-[#f7f7fb]">Venues</h1>
          <p className="max-w-3xl text-sm text-[#b8c7e3]">
            A theater-by-theater guide to what is playing now, with Atlanta&apos;s indie houses in focus.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-[#2a3349] bg-[#0d1424] p-4">
            <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[#9bb0d7]">Active Theaters</p>
            <p className="mt-1 text-2xl font-semibold text-[#f5f8ff]">{venues.length}</p>
          </article>
          <article className="rounded-2xl border border-[#2a3349] bg-[#0d1424] p-4">
            <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[#9bb0d7]">Indie Priority</p>
            <p className="mt-1 text-2xl font-semibold text-[#f5f8ff]">{indieVenues.length}</p>
          </article>
          <article className="rounded-2xl border border-[#2a3349] bg-[#0d1424] p-4">
            <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[#9bb0d7]">Upcoming Screenings</p>
            <p className="mt-1 text-2xl font-semibold text-[#f5f8ff]">{venues.reduce((sum, venue) => sum + venue.screeningCount, 0)}</p>
          </article>
        </section>

        <section className="space-y-4">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">Indie Spotlight</p>
              <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">Indie houses in focus</h2>
            </div>
            <Link href={`/${portal.slug}/showtimes`} className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-[#c9d9ff] hover:text-[#e1eaff]">
              View showtimes
              <ArrowRight size={12} />
            </Link>
          </header>

          <div className="grid gap-4 md:grid-cols-3">
            {spotlightVenues.length > 0 ? spotlightVenues.map((venue, index) => (
              <Link
                key={`${venue.slug || venue.name}-${index}`}
                href={venue.slug ? `/${portal.slug}/spots/${venue.slug}` : `/${portal.slug}/showtimes`}
                className="group overflow-hidden rounded-2xl border border-[#2f3a56] bg-[#0c1322] hover:border-[#4a628f]"
              >
                <div className="relative h-40">
                  <Image
                    src={getProxiedImageSrc(venue.imageUrl || FALLBACK_PHOTOS[index % FALLBACK_PHOTOS.length])}
                    alt={venue.name}
                    fill
                    unoptimized
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,16,0.12)_0%,rgba(4,8,16,0.86)_100%)]" />
                </div>

                <div className="space-y-1.5 p-3.5">
                  <h3 className="text-lg font-semibold text-[#f4f7ff]">{venue.name}</h3>
                  <p className="text-[0.68rem] uppercase tracking-[0.12em] text-[#c8d8f4]">{venue.screeningCount} upcoming • {venue.todayCount} today</p>
                  <p className="text-xs text-[#adbfdf]">{formatShortDate(venue.nextDate)} • {formatTimeLabel(venue.nextTime)}</p>
                </div>
              </Link>
            )) : (
              <div className="rounded-2xl border border-[#2f3a56] bg-[#0c1322] px-4 py-6 text-sm text-[#bccbe6]">
                Showtimes are updating.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <header>
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">Venue Index</p>
            <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">All active cinema venues</h2>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {venues.length > 0 ? venues.map((venue) => (
              <article key={`${venue.slug || venue.name}`} className="rounded-2xl border border-[#2a334a] bg-[#0d1424] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#f5f8ff]">{venue.name}</h3>
                    <p className="mt-1 text-[0.72rem] text-[#9fb2d5]">{venue.neighborhood || "Atlanta"}</p>
                  </div>
                  <span className="rounded-full border border-[#36507f] bg-[#12203a] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-[#bad0f3]">
                    {venue.screeningCount}
                  </span>
                </div>

                <p className="mt-2 text-[0.68rem] text-[#c4d4f1]">Next: {formatShortDate(venue.nextDate)} • {formatTimeLabel(venue.nextTime)}</p>
                <p className="mt-2 line-clamp-2 text-xs text-[#aebfdf]">{venue.topTitles.join(" • ") || "New listings coming in."}</p>

                <div className="mt-3 flex items-center gap-3 text-[0.66rem] uppercase tracking-[0.13em]">
                  <Link href={venue.slug ? `/${portal.slug}/spots/${venue.slug}` : `/${portal.slug}/showtimes`} className="text-[#c9d9ff] hover:text-[#e1eaff]">
                    Venue page
                  </Link>
                  <Link href={`/${portal.slug}/showtimes`} className="text-[#9fb2d7] hover:text-[#d6e3ff]">
                    Showtimes
                  </Link>
                </div>
              </article>
            )) : (
              <div className="rounded-2xl border border-[#2a334a] bg-[#0d1424] px-4 py-6 text-sm text-[#bccbe6]">
                No active cinema venues found yet.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <header className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-[var(--font-film-editorial)] text-2xl text-[#f7f7fb]">Live schedule by venue</h2>
            <Link href={`/${portal.slug}/showtimes`} className="text-xs uppercase tracking-[0.14em] text-[#c9d9ff] hover:text-[#e1eaff]">Showtimes page</Link>
          </header>
          <FilmShowtimeBoard portalSlug={portal.slug} mode="by-theater" />
        </section>
      </main>
    </div>
  );
}
