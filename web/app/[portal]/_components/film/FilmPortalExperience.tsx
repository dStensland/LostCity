import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarBlank,
  FilmSlate,
  Ticket,
} from "@phosphor-icons/react/dist/ssr";
import type { Portal } from "@/lib/portal-context";
import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import { getAllFestivals, type Festival } from "@/lib/festivals";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import { getPortalSourceAccess } from "@/lib/federation";
import FilmPortalNav from "./FilmPortalNav";
import FilmShowtimeBoard from "./FilmShowtimeBoard";
import FilmForYouSection from "./FilmForYouSection";
import FilmWatchlist from "./FilmWatchlist";
import FilmWeekendPlanner from "./FilmWeekendPlanner";

type FilmPortalExperienceProps = {
  portal: Portal;
};

type UpcomingFilmEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  image_url: string | null;
  venue_name: string | null;
  venue_slug: string | null;
  organization_name: string | null;
  organization_slug: string | null;
  source_id: number | null;
  source_name: string | null;
  source_slug: string | null;
  source_url: string | null;
  tags: string[];
};

type RawFilmEventRow = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  image_url: string | null;
  category: string | null;
  tags: string[] | null;
  source_id: number | null;
  source_url: string | null;
  source: {
    name: string | null;
    slug: string | null;
    url: string | null;
  } | null;
  venue: {
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
  organization: {
    name: string;
    slug: string;
    logo_url: string | null;
  } | null;
};

type RawOrganizationRow = {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  description: string | null;
  logo_url: string | null;
  categories: string[] | null;
  neighborhood: string | null;
};

type FilmCommunityGroup = {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  description: string | null;
  logo_url: string | null;
  neighborhood: string | null;
  next_meetup: UpcomingFilmEvent | null;
};

type CrawlItem = {
  id: string;
  kind: "festival" | "event";
  title: string;
  href: string;
  date_label: string;
  detail_label: string;
  image_url: string | null;
};

type VenuePulseCard = {
  venueName: string;
  venueSlug: string | null;
  neighborhood: string | null;
  screeningCount: number;
  nextTimeLabel: string | null;
  heroImage: string | null;
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

function formatFestivalWindow(festival: Festival): string {
  if (!festival.announced_start) return "Dates coming soon";
  if (!festival.announced_end || festival.announced_end === festival.announced_start) {
    return formatShortDate(festival.announced_start);
  }
  return `${formatShortDate(festival.announced_start)} - ${formatShortDate(festival.announced_end)}`;
}

function hasPhoto(url: string | null | undefined): url is string {
  return Boolean(url && url.trim().length > 0);
}

function isFilmCommunityOrg(org: RawOrganizationRow): boolean {
  if (org.org_type === "film_society") return true;

  const categoryText = (org.categories || []).join(" ").toLowerCase();
  const hasFilmCategory = /film|cinema|movie|screen|documentary|filmmaker/.test(categoryText);

  if (org.org_type === "community_group" && hasFilmCategory) return true;
  return hasFilmCategory;
}

function isIndieVenueName(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = name.toLowerCase();
  return INDIE_THEATER_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

type OpeningFilm = {
  series_id: string;
  title: string;
  slug: string;
  image_url: string | null;
  genres: string[];
  opening_date: string;
  venue_count: number;
};

type LastChanceFilm = {
  series_id: string;
  title: string;
  slug: string;
  image_url: string | null;
  genres: string[];
  last_date: string;
  venue_count: number;
};

async function getOpeningThisWeek(): Promise<OpeningFilm[]> {
  const supabase = await createClient();
  const today = getLocalDateString();
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = getLocalDateString(weekEnd);

  const { data } = await supabase
    .from("events")
    .select(`
      id,
      start_date,
      series_id,
      venue:venues!events_venue_id_fkey(id, name),
      series:series!events_series_id_fkey(id, slug, title, image_url, genres)
    `)
    .eq("category", "film")
    .not("series_id", "is", null)
    .gte("start_date", today)
    .lte("start_date", weekEndStr)
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .order("start_date", { ascending: true })
    .limit(500);

  if (!data) return [];

  type OpeningRow = {
    id: number;
    start_date: string;
    series_id: string | null;
    venue: { id: number; name: string } | null;
    series: { id: string; slug: string; title: string; image_url: string | null; genres: string[] | null } | null;
  };

  const rows = data as unknown as OpeningRow[];

  // Group by series, find MIN date + distinct venue count
  const seriesMap = new Map<string, { minDate: string; venues: Set<number>; series: OpeningRow["series"] }>();
  for (const row of rows) {
    if (!row.series_id || !row.series) continue;
    const existing = seriesMap.get(row.series_id);
    if (!existing) {
      seriesMap.set(row.series_id, {
        minDate: row.start_date,
        venues: new Set(row.venue?.id ? [row.venue.id] : []),
        series: row.series,
      });
    } else {
      if (row.start_date < existing.minDate) existing.minDate = row.start_date;
      if (row.venue?.id) existing.venues.add(row.venue.id);
    }
  }

  // Also check if any earlier events exist for this series (if so, it's not "opening")
  const results: OpeningFilm[] = [];
  for (const [seriesId, entry] of seriesMap) {
    // Check if there are any events before today for this series
    const { count } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("series_id", seriesId)
      .lt("start_date", today);

    if ((count ?? 0) > 0) continue; // Not opening — had earlier screenings

    if (entry.series) {
      results.push({
        series_id: seriesId,
        title: entry.series.title,
        slug: entry.series.slug,
        image_url: entry.series.image_url,
        genres: entry.series.genres || [],
        opening_date: entry.minDate,
        venue_count: entry.venues.size,
      });
    }
  }

  return results.sort((a, b) => a.opening_date.localeCompare(b.opening_date)).slice(0, 8);
}

async function getLastChance(): Promise<LastChanceFilm[]> {
  const supabase = await createClient();
  const today = getLocalDateString();
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = getLocalDateString(weekEnd);

  const { data } = await supabase
    .from("events")
    .select(`
      id,
      start_date,
      series_id,
      venue:venues!events_venue_id_fkey(id, name),
      series:series!events_series_id_fkey(id, slug, title, image_url, genres)
    `)
    .eq("category", "film")
    .not("series_id", "is", null)
    .gte("start_date", today)
    .lte("start_date", weekEndStr)
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .order("start_date", { ascending: true })
    .limit(500);

  if (!data) return [];

  type LastChanceRow = {
    id: number;
    start_date: string;
    series_id: string | null;
    venue: { id: number; name: string } | null;
    series: { id: string; slug: string; title: string; image_url: string | null; genres: string[] | null } | null;
  };

  const rows = data as unknown as LastChanceRow[];

  // Group by series, find MAX date + distinct venue count
  const seriesMap = new Map<string, { maxDate: string; venues: Set<number>; series: LastChanceRow["series"] }>();
  for (const row of rows) {
    if (!row.series_id || !row.series) continue;
    const existing = seriesMap.get(row.series_id);
    if (!existing) {
      seriesMap.set(row.series_id, {
        maxDate: row.start_date,
        venues: new Set(row.venue?.id ? [row.venue.id] : []),
        series: row.series,
      });
    } else {
      if (row.start_date > existing.maxDate) existing.maxDate = row.start_date;
      if (row.venue?.id) existing.venues.add(row.venue.id);
    }
  }

  // Check if any future events exist after the week window (if so, it's not "last chance")
  const results: LastChanceFilm[] = [];
  for (const [seriesId, entry] of seriesMap) {
    const { count } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("series_id", seriesId)
      .gt("start_date", weekEndStr);

    if ((count ?? 0) > 0) continue; // Not last chance — has future screenings

    if (entry.series) {
      results.push({
        series_id: seriesId,
        title: entry.series.title,
        slug: entry.series.slug,
        image_url: entry.series.image_url,
        genres: entry.series.genres || [],
        last_date: entry.maxDate,
        venue_count: entry.venues.size,
      });
    }
  }

  return results.sort((a, b) => a.last_date.localeCompare(b.last_date)).slice(0, 8);
}

function getVenuePriority(name: string): number {
  const normalized = name.toLowerCase();
  if (normalized.includes("plaza")) return 0;
  if (normalized.includes("tara")) return 1;
  if (normalized.includes("starlight")) return 2;
  return 10;
}

async function getUpcomingFilmEvents(limit = 40): Promise<UpcomingFilmEvent[]> {
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
      category,
      tags,
      source_id,
      source_url,
      source:sources!events_source_id_fkey(
        name,
        slug,
        url
      ),
      venue:venues!events_venue_id_fkey(
        name,
        slug,
        neighborhood
      ),
      organization:organizations!events_organization_id_fkey(
        name,
        slug,
        logo_url
      )
    `)
    .eq("category", "film")
    .gte("start_date", today)
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(260);

  const rows = (data as RawFilmEventRow[] | null) || [];

  const normalized = rows.map((row) => ({
    id: row.id,
    title: row.title,
    start_date: row.start_date,
    start_time: row.start_time,
    image_url: row.image_url,
    venue_name: row.venue?.name || null,
    venue_slug: row.venue?.slug || null,
    organization_name: row.organization?.name || null,
    organization_slug: row.organization?.slug || null,
    source_id: row.source_id || null,
    source_name: row.source?.name || null,
    source_slug: row.source?.slug || null,
    source_url: row.source_url || row.source?.url || null,
    tags: row.tags || [],
  }));

  const seen = new Set<string>();
  const unique: UpcomingFilmEvent[] = [];
  for (const event of normalized) {
    const venueKey = event.venue_slug || event.venue_name || "venue";
    const key = `${event.title.toLowerCase()}-${event.start_date}-${venueKey.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(event);
    if (unique.length >= limit) break;
  }

  return unique;
}

async function getFilmCommunityGroups(limit = 4): Promise<FilmCommunityGroup[]> {
  const supabase = await createClient();
  const today = getLocalDateString();

  const [organizationsResult, eventsResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, org_type, description, logo_url, categories, neighborhood")
      .eq("hidden", false)
      .limit(120),
    supabase
      .from("events")
      .select(`
        id,
        title,
        start_date,
        start_time,
        image_url,
        category,
        tags,
        source_id,
        source_url,
        source:sources!events_source_id_fkey(name, slug, url),
        venue:venues!events_venue_id_fkey(name, slug, neighborhood),
        organization:organizations!events_organization_id_fkey(name, slug, logo_url)
      `)
      .in("category", ["community", "film"])
      .gte("start_date", today)
      .or("is_sensitive.eq.false,is_sensitive.is.null")
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(220),
  ]);

  const organizations = (organizationsResult.data as RawOrganizationRow[] | null) || [];
  const events = (eventsResult.data as RawFilmEventRow[] | null) || [];

  const meetupByOrg = new Map<string, UpcomingFilmEvent>();
  for (const row of events) {
    const orgSlug = row.organization?.slug || null;
    if (!orgSlug || meetupByOrg.has(orgSlug)) continue;

    const tags = row.tags || [];
    const searchable = `${row.title} ${tags.join(" ")}`.toLowerCase();
    const looksLikeGroupMeetup =
      row.category === "community" ||
      /film|cinema|movie|society|club|collective|meetup|workshop|filmmaker|screenwriter|discussion/.test(searchable);

    if (!looksLikeGroupMeetup) continue;

    meetupByOrg.set(orgSlug, {
      id: row.id,
      title: row.title,
      start_date: row.start_date,
      start_time: row.start_time,
      image_url: row.image_url,
      venue_name: row.venue?.name || null,
      venue_slug: row.venue?.slug || null,
      organization_name: row.organization?.name || null,
      organization_slug: orgSlug,
      source_id: row.source_id || null,
      source_name: row.source?.name || null,
      source_slug: row.source?.slug || null,
      source_url: row.source_url || row.source?.url || null,
      tags,
    });
  }

  const groups = organizations
    .filter((org) => isFilmCommunityOrg(org) || meetupByOrg.has(org.slug))
    .map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      org_type: org.org_type,
      description: org.description,
      logo_url: org.logo_url,
      neighborhood: org.neighborhood,
      next_meetup: meetupByOrg.get(org.slug) || null,
    }))
    .sort((a, b) => {
      if (a.next_meetup && !b.next_meetup) return -1;
      if (!a.next_meetup && b.next_meetup) return 1;

      if (a.next_meetup && b.next_meetup) {
        const dateDelta = a.next_meetup.start_date.localeCompare(b.next_meetup.start_date);
        if (dateDelta !== 0) return dateDelta;
      }

      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);

  return groups;
}

async function getNetworkFilmEvents(portalId: string, limit = 80): Promise<UpcomingFilmEvent[]> {
  const access = await getPortalSourceAccess(portalId);
  if (access.sourceIds.length === 0) {
    return [];
  }

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
      category,
      tags,
      source_id,
      source_url,
      source:sources!events_source_id_fkey(name, slug, url),
      venue:venues!events_venue_id_fkey(name, slug, neighborhood),
      organization:organizations!events_organization_id_fkey(name, slug, logo_url)
    `)
    .eq("category", "film")
    .gte("start_date", today)
    .in("source_id", access.sourceIds)
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(320);

  const rows = ((data as RawFilmEventRow[] | null) || []).filter((row) => {
    if (!row.source_id) return false;
    const allowedCategories = access.categoryConstraints.get(row.source_id);
    if (!allowedCategories || allowedCategories.length === 0) return true;
    if (!row.category) return true;
    return allowedCategories.includes(row.category);
  });

  const normalized = rows.map((row) => ({
    id: row.id,
    title: row.title,
    start_date: row.start_date,
    start_time: row.start_time,
    image_url: row.image_url,
    venue_name: row.venue?.name || null,
    venue_slug: row.venue?.slug || null,
    organization_name: row.organization?.name || null,
    organization_slug: row.organization?.slug || null,
    source_id: row.source_id || null,
    source_name: row.source?.name || null,
    source_slug: row.source?.slug || null,
    source_url: row.source_url || row.source?.url || null,
    tags: row.tags || [],
  }));

  const seen = new Set<string>();
  const deduped: UpcomingFilmEvent[] = [];
  for (const event of normalized) {
    const venueKey = event.venue_slug || event.venue_name || "venue";
    const key = `${event.title.toLowerCase()}-${event.start_date}-${venueKey.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
    if (deduped.length >= limit) break;
  }

  return deduped;
}

function buildCrawlItems(
  portalSlug: string,
  festivals: Festival[],
  events: UpcomingFilmEvent[],
  networkEvents: UpcomingFilmEvent[]
): CrawlItem[] {
  const festivalItems = festivals
    .filter((festival) => hasPhoto(festival.image_url))
    .slice(0, 6)
    .map((festival) => ({
      id: `festival-${festival.id}`,
      kind: "festival" as const,
      title: festival.name,
      href: `/${portalSlug}/festivals/${festival.slug}`,
      date_label: formatFestivalWindow(festival),
      detail_label: festival.location || "Atlanta",
      image_url: festival.image_url,
    }));

  const prioritizedEvents = [
    ...networkEvents,
    ...events.filter((event) => !networkEvents.some((networkEvent) => networkEvent.id === event.id)),
  ];

  const eventItems = prioritizedEvents
    .filter((event) => hasPhoto(event.image_url))
    .slice(0, 12)
    .map((event) => ({
      id: `event-${event.id}`,
      kind: "event" as const,
      title: event.title,
      href: `/${portalSlug}/events/${event.id}`,
      date_label: `${formatShortDate(event.start_date)} • ${formatTimeLabel(event.start_time)}`,
      detail_label: event.venue_name || "Atlanta",
      image_url: event.image_url,
    }));

  const interleaved: CrawlItem[] = [];
  for (let index = 0; index < Math.max(festivalItems.length, eventItems.length); index += 1) {
    if (festivalItems[index]) interleaved.push(festivalItems[index]);
    if (eventItems[index]) interleaved.push(eventItems[index]);
    if (interleaved.length >= 9) break;
  }

  return interleaved;
}

function buildVenuePulse(events: UpcomingFilmEvent[], limit = 4): VenuePulseCard[] {
  const bucket = new Map<string, VenuePulseCard>();

  for (const event of events) {
    if (!event.venue_name) continue;

    const key = `${event.venue_slug || event.venue_name}`.toLowerCase();
    const existing = bucket.get(key);

    if (!existing) {
      bucket.set(key, {
        venueName: event.venue_name,
        venueSlug: event.venue_slug,
        neighborhood: null,
        screeningCount: 1,
        nextTimeLabel: event.start_time ? `${formatShortDate(event.start_date)} • ${formatTimeLabel(event.start_time)}` : formatShortDate(event.start_date),
        heroImage: event.image_url,
      });
      continue;
    }

    existing.screeningCount += 1;
    if (!existing.heroImage && event.image_url) existing.heroImage = event.image_url;
  }

  const cards = Array.from(bucket.values());
  const indieCards = cards.filter((card) => isIndieVenueName(card.venueName));
  const pool = indieCards.length > 0 ? indieCards : cards;

  return pool
    .sort((a, b) => {
      const priorityDelta = getVenuePriority(a.venueName) - getVenuePriority(b.venueName);
      if (priorityDelta !== 0) return priorityDelta;
      return b.screeningCount - a.screeningCount || a.venueName.localeCompare(b.venueName);
    })
    .slice(0, limit);
}

export default async function FilmPortalExperience({ portal }: FilmPortalExperienceProps) {
  const today = getLocalDateString();

  const [festivals, events, communityGroups, networkEvents, openingFilms, lastChanceFilms] = await Promise.all([
    getAllFestivals(portal.id),
    getUpcomingFilmEvents(72),
    getFilmCommunityGroups(4),
    getNetworkFilmEvents(portal.id, 90),
    getOpeningThisWeek(),
    getLastChance(),
  ]);

  const upcomingFestivals = festivals
    .filter((festival) => !festival.announced_end || festival.announced_end >= today)
    .slice(0, 8);

  const crawlItems = buildCrawlItems(portal.slug, upcomingFestivals, events, networkEvents);

  const combinedEvents = [
    ...networkEvents,
    ...events.filter((event) => !networkEvents.some((networkEvent) => networkEvent.id === event.id)),
  ];

  const venuePulse = buildVenuePulse(combinedEvents, 4);

  const heroPhoto =
    upcomingFestivals.find((festival) => hasPhoto(festival.image_url))?.image_url ||
    networkEvents.find((event) => hasPhoto(event.image_url))?.image_url ||
    events.find((event) => hasPhoto(event.image_url))?.image_url ||
    FALLBACK_PHOTOS[0];

  const heroTiles = [
    networkEvents[1]?.image_url,
    upcomingFestivals[1]?.image_url,
    events[2]?.image_url || networkEvents[2]?.image_url,
  ].map((value, index) => value || FALLBACK_PHOTOS[(index + 1) % FALLBACK_PHOTOS.length]);

  const communityHeroPhoto =
    communityGroups.find((group) => hasPhoto(group.next_meetup?.image_url || null))?.next_meetup?.image_url ||
    events.find((event) => hasPhoto(event.image_url))?.image_url ||
    FALLBACK_PHOTOS[2];

  const festivalSpotlight = upcomingFestivals[0] || null;

  return (
    <div className="space-y-8 py-6 font-[var(--font-film-body)] text-[#f7f8fc]">
      <FilmPortalNav portalSlug={portal.slug} />

      <section className="relative overflow-hidden rounded-[2rem] border border-[#2a3349] bg-[#070b14]">
        <div className="absolute inset-0">
          <Image
            src={getProxiedImageSrc(heroPhoto)}
            alt="Atlanta film scene"
            fill
            unoptimized
            className="object-cover"
            sizes="100vw"
            priority
          />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(112deg,rgba(5,9,18,0.92)_14%,rgba(7,11,20,0.82)_46%,rgba(7,11,20,0.58)_78%,rgba(7,11,20,0.38)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(110%_150%_at_12%_0%,rgba(133,164,240,0.28),transparent_54%)]" />

        <div className="relative grid gap-5 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
          <div className="flex flex-col justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[#90adeb66] bg-[#90adeb1f] px-3 py-1 text-[0.66rem] uppercase tracking-[0.18em] text-[#dde7ff]">
                <FilmSlate size={12} />
                Atlanta Film Portal
              </p>

              <h1 className="mt-5 max-w-3xl font-[var(--font-film-display)] text-5xl uppercase leading-[0.88] text-[#f6f8ff] drop-shadow-[0_10px_20px_rgba(0,0,0,0.55)] sm:text-7xl">
                The Citywide
                <br />
                Film Front Row
              </h1>

              <p className="mt-4 max-w-xl text-sm text-[#d9e2f3] sm:text-base">
                A premium guide to Atlanta cinema: indie theaters, film festivals, special screenings, and community groups shaping the local scene.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5 text-xs uppercase tracking-[0.12em]">
              <Link
                href={`/${portal.slug}/showtimes`}
                className="inline-flex items-center gap-2 rounded-xl bg-[#d7e1ff] px-4 py-2.5 font-semibold text-[#0f1628] shadow-[0_8px_22px_rgba(141,168,234,0.26)] transition-colors hover:bg-[#e3ebff]"
              >
                <Ticket size={14} />
                Full Showtimes
              </Link>
              <Link
                href={`/${portal.slug}/festivals`}
                className="inline-flex items-center gap-2 rounded-xl border border-[#8da8ea66] bg-[#101a30cc] px-4 py-2.5 text-[#f3f6ff] hover:border-[#8da8ea]"
              >
                <CalendarBlank size={14} />
                Festivals
              </Link>
            </div>
          </div>

          <aside className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {heroTiles.map((tilePhoto, index) => (
              <div key={`${tilePhoto}-${index}`} className="relative h-32 overflow-hidden rounded-2xl border border-[#35415e] sm:h-36 lg:h-40">
                <Image
                  src={getProxiedImageSrc(tilePhoto)}
                  alt="Atlanta film spotlight"
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="(max-width: 1024px) 33vw, 28vw"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,11,19,0.06)_0%,rgba(7,11,19,0.56)_100%)]" />
              </div>
            ))}
          </aside>
        </div>

        {festivalSpotlight ? (
          <div className="relative border-t border-[#2d3b5a] bg-[#0d1628cc] p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[0.62rem] uppercase tracking-[0.17em] text-[#95acd9]">Festival Spotlight</p>
                <h2 className="mt-1 font-[var(--font-film-editorial)] text-2xl text-[#f6f8ff]">{festivalSpotlight.name}</h2>
                <p className="mt-1 text-xs text-[#c3d3ef]">{formatFestivalWindow(festivalSpotlight)} • {festivalSpotlight.location || "Atlanta"}</p>
              </div>
              <Link
                href={`/${portal.slug}/festivals/${festivalSpotlight.slug}`}
                className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-[#d4e2ff] hover:text-[#eef3ff]"
              >
                View festival
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      {openingFilms.length > 0 && (
        <section className="space-y-4">
          <header>
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">Opening This Week</p>
            <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">New to Atlanta screens</h2>
          </header>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
            {openingFilms.map((film) => (
              <Link
                key={film.series_id}
                href={`/${portal.slug}/series/${film.slug}`}
                className="group relative h-64 w-44 shrink-0 snap-start overflow-hidden rounded-2xl border border-[#2f3a56] bg-[#0c1322]"
              >
                {film.image_url ? (
                  <Image
                    src={getProxiedImageSrc(film.image_url)}
                    alt={film.title}
                    fill
                    unoptimized
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    sizes="176px"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-slate-300/85 to-slate-500/85" />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,16,0.05)_0%,rgba(4,8,16,0.48)_46%,rgba(4,8,16,0.92)_100%)]" />
                <div className="relative flex h-full flex-col justify-end p-3">
                  <span className="mb-1 inline-flex w-fit rounded-full border border-[#4ade8066] bg-[#4ade801f] px-2 py-0.5 text-[0.52rem] uppercase tracking-[0.16em] text-[#a7f3d0]">
                    Opens {formatShortDate(film.opening_date).split(",")[0]}
                  </span>
                  <h3 className="line-clamp-2 text-sm font-semibold text-[#f6f8ff]">{film.title}</h3>
                  {film.venue_count > 1 && (
                    <p className="mt-0.5 text-[0.62rem] text-[#c0d0ea]">{film.venue_count} venues</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {lastChanceFilms.length > 0 && (
        <section className="space-y-4">
          <header>
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">Last Chance</p>
            <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">Closing soon</h2>
          </header>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
            {lastChanceFilms.map((film) => (
              <Link
                key={film.series_id}
                href={`/${portal.slug}/series/${film.slug}`}
                className="group relative h-64 w-44 shrink-0 snap-start overflow-hidden rounded-2xl border border-[#2f3a56] bg-[#0c1322]"
              >
                {film.image_url ? (
                  <Image
                    src={getProxiedImageSrc(film.image_url)}
                    alt={film.title}
                    fill
                    unoptimized
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    sizes="176px"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-slate-300/85 to-slate-500/85" />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,16,0.05)_0%,rgba(4,8,16,0.48)_46%,rgba(4,8,16,0.92)_100%)]" />
                <div className="relative flex h-full flex-col justify-end p-3">
                  <span className="mb-1 inline-flex w-fit rounded-full border border-[#f59e0b66] bg-[#f59e0b1f] px-2 py-0.5 text-[0.52rem] uppercase tracking-[0.16em] text-[#fcd34d]">
                    Last showing {formatShortDate(film.last_date).split(",")[0]}
                  </span>
                  <h3 className="line-clamp-2 text-sm font-semibold text-[#f6f8ff]">{film.title}</h3>
                  {film.venue_count > 1 && (
                    <p className="mt-0.5 text-[0.62rem] text-[#c0d0ea]">{film.venue_count} venues</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">Now Showing</p>
            <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">Tonight across Atlanta screens</h2>
            <p className="mt-1 text-sm text-[#b8c8e4]">A quick look at what&apos;s on now. Full schedules live on dedicated pages.</p>
          </div>
          <Link href={`/${portal.slug}/showtimes`} className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-[#c9d9ff] hover:text-[#e1eaff]">
            View full showtimes
            <ArrowRight size={12} />
          </Link>
        </header>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-[#26324a] bg-[#0a111f] p-4 sm:p-5">
            <p className="mb-2 text-[0.62rem] uppercase tracking-[0.16em] text-[#8ea4c8]">Citywide theater preview</p>
            <FilmShowtimeBoard portalSlug={portal.slug} mode="by-theater" compact hideHeader hideDateRail hideGenreFilter />
          </article>

          <aside className="space-y-3">
            {venuePulse.length > 0 ? (
              venuePulse.slice(0, 3).map((venue, index) => (
                <Link
                  key={`${venue.venueSlug || venue.venueName}-${index}`}
                  href={venue.venueSlug ? `/${portal.slug}/spots/${venue.venueSlug}` : `/${portal.slug}/venues`}
                  className="group block overflow-hidden rounded-2xl border border-[#2a334a] bg-[#0d1424] hover:border-[#445a85]"
                >
                  <div className="relative h-28">
                    <Image
                      src={getProxiedImageSrc(venue.heroImage || FALLBACK_PHOTOS[index % FALLBACK_PHOTOS.length])}
                      alt={venue.venueName}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      sizes="(max-width: 1280px) 100vw, 32vw"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,11,19,0.06)_0%,rgba(7,11,19,0.82)_100%)]" />
                  </div>

                  <div className="space-y-1 p-3.5">
                    <p className="text-sm font-semibold text-[#f4f7ff]">{venue.venueName}</p>
                    <p className="text-[0.68rem] uppercase tracking-[0.12em] text-[#cfe0ff]">{venue.screeningCount} upcoming screenings</p>
                    <p className="text-[0.7rem] text-[#adbfdf]">{venue.nextTimeLabel || "Schedule soon"}</p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-[#2a334a] bg-[#0d1424] px-4 py-6 text-sm text-[#bccbe6]">
                Venue schedules are updating.
              </div>
            )}

            <Link
              href={`/${portal.slug}/venues`}
              className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-[#c9d9ff] hover:text-[#e1eaff]"
            >
              View venue guide
              <ArrowRight size={12} />
            </Link>
          </aside>
        </div>
      </section>

      <FilmForYouSection portalSlug={portal.slug} />

      <FilmWatchlist portalSlug={portal.slug} />

      <FilmWeekendPlanner portalSlug={portal.slug} />

      <section className="space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">Festival Circuit</p>
            <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">Premieres, festivals, and special screenings</h2>
          </div>
          <div className="flex gap-3 text-[0.68rem] uppercase tracking-[0.14em]">
            <Link href={`/${portal.slug}/festivals`} className="text-[#c9d9ff] hover:text-[#e1eaff]">Festivals</Link>
            <Link href={`/${portal.slug}/calendar`} className="text-[#c9d9ff] hover:text-[#e1eaff]">Calendar</Link>
          </div>
        </header>

        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
          {crawlItems.length > 0 ? (
            crawlItems.map((item, index) => {
              const cardPhoto = item.image_url || FALLBACK_PHOTOS[index % FALLBACK_PHOTOS.length];
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group relative h-72 w-[18.5rem] shrink-0 snap-start overflow-hidden rounded-2xl border border-[#2f3a56] bg-[#0c1322]"
                >
                  <Image
                    src={getProxiedImageSrc(cardPhoto)}
                    alt={item.title}
                    fill
                    unoptimized
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    sizes="296px"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,16,0.05)_0%,rgba(4,8,16,0.48)_46%,rgba(4,8,16,0.92)_100%)]" />

                  <div className="relative flex h-full flex-col justify-between p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-full border border-[#8ea9ec66] bg-[#8ea9ec1f] px-2 py-1 text-[0.58rem] uppercase tracking-[0.16em] text-[#d9e5ff]">
                        {item.kind === "festival" ? "Festival" : "Event"}
                      </span>
                      <span className="text-[0.62rem] text-[#d2ddf2]">{item.date_label}</span>
                    </div>

                    <div>
                      <h3 className="line-clamp-2 text-lg font-semibold text-[#f6f8ff]">{item.title}</h3>
                      <p className="mt-1 text-xs text-[#c0d0ea]">{item.detail_label}</p>
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="w-full rounded-2xl border border-[#2f3a56] bg-[#0c1322] px-4 py-6 text-sm text-[#bccbe6]">
              New festival and event listings are on the way.
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <header>
          <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">Atlanta Film Scene</p>
          <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">Explore the scene</h2>
        </header>
        <Link
          href={`/${portal.slug}?view=feed&tab=explore`}
          className="group relative block overflow-hidden rounded-2xl border border-[#2a334a] bg-[#0d1424] hover:border-[#445a85]"
        >
          <div className="relative h-40">
            <Image
              src={getProxiedImageSrc(FALLBACK_PHOTOS[1])}
              alt="Atlanta Film Scene"
              fill
              unoptimized
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,11,19,0.06)_0%,rgba(7,11,19,0.82)_100%)]" />
          </div>
          <div className="relative p-4">
            <span className="mb-2 inline-flex rounded-full border border-[#8ea9ec66] bg-[#8ea9ec1f] px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.16em] text-[#d9e5ff]">
              Yallywood
            </span>
            <h3 className="mt-1 text-lg font-semibold text-[#f6f8ff]">Explore curated tracks</h3>
            <p className="mt-1 text-xs text-[#b9c8e5]">
              Indie circuits, film festival calendars, drive-in date nights, and more curated paths through Atlanta&apos;s film world.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[0.66rem] uppercase tracking-[0.14em] text-[#c9d9ff] group-hover:text-[#e1eaff]">
              Explore tracks
              <ArrowRight size={11} />
            </span>
          </div>
        </Link>
      </section>

      <section className="space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">Community</p>
            <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">Atlanta&apos;s film communities</h2>
          </div>
          <Link href={`/${portal.slug}/community-hub`} className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-[#c9d9ff] hover:text-[#e1eaff]">
            Visit community
            <ArrowRight size={12} />
          </Link>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="relative overflow-hidden rounded-3xl border border-[#29344d] bg-[#0a111f]">
            <div className="absolute inset-0">
              <Image
                src={getProxiedImageSrc(communityHeroPhoto)}
                alt="Atlanta film community meetup"
                fill
                unoptimized
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,16,0.2)_0%,rgba(4,8,16,0.86)_100%)]" />

            <div className="relative flex min-h-[18rem] flex-col justify-end p-5 sm:min-h-[20rem]">
              <p className="text-[0.62rem] uppercase tracking-[0.17em] text-[#d6e2fb]">Meetup Spotlight</p>
              {communityGroups[0]?.next_meetup ? (
                <>
                  <h3 className="mt-2 max-w-xl text-2xl font-semibold text-[#f6f8ff]">
                    {communityGroups[0].next_meetup.title}
                  </h3>
                  <p className="mt-2 text-sm text-[#d4def2]">
                    {formatShortDate(communityGroups[0].next_meetup.start_date)} • {formatTimeLabel(communityGroups[0].next_meetup.start_time)}
                    {communityGroups[0].next_meetup.venue_name ? ` • ${communityGroups[0].next_meetup.venue_name}` : ""}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="mt-2 max-w-xl text-2xl font-semibold text-[#f6f8ff]">Film clubs, societies, and craft communities</h3>
                  <p className="mt-2 text-sm text-[#d4def2]">Discover recurring meetings, post-screening conversations, and filmmaker circles.</p>
                </>
              )}
            </div>
          </article>

          <div className="space-y-3">
            {communityGroups.length > 0 ? (
              communityGroups.map((group) => (
                <Link
                  key={group.id}
                  href={`/${portal.slug}/community/${group.slug}`}
                  className="group block rounded-2xl border border-[#2a334a] bg-[#0d1424] p-4 hover:border-[#445a85]"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[#3a4969] bg-[#121e36]">
                      {hasPhoto(group.logo_url) ? (
                        <Image
                          src={getProxiedImageSrc(group.logo_url)}
                          alt={group.name}
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="44px"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[0.62rem] uppercase tracking-[0.14em] text-[#b9c9e9]">
                          {group.name.slice(0, 2)}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-1 text-base font-semibold text-[#f5f8ff]">{group.name}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-[#b9c8e5]">
                        {group.description || "Film community, screenings, and discussion events in Atlanta."}
                      </p>

                      {group.next_meetup ? (
                        <p className="mt-2 text-[0.66rem] uppercase tracking-[0.14em] text-[#d5e2ff]">
                          Next meetup: {formatShortDate(group.next_meetup.start_date)} • {formatTimeLabel(group.next_meetup.start_time)}
                        </p>
                      ) : (
                        <p className="mt-2 text-[0.66rem] uppercase tracking-[0.14em] text-[#96abcf]">
                          Neighborhood: {group.neighborhood || "Atlanta"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 inline-flex items-center gap-1 text-[0.66rem] uppercase tracking-[0.14em] text-[#c9d9ff] group-hover:text-[#e1eaff]">
                    View group
                    <ArrowRight size={11} />
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-[#2a334a] bg-[#0d1424] px-4 py-6 text-sm text-[#bccbe6]">
                Film community groups are being curated now.
              </div>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}
