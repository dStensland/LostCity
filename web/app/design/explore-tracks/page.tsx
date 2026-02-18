import Link from "next/link";
import { Bebas_Neue, Fraunces, Space_Grotesk } from "next/font/google";
import {
  ArrowUpRight,
  Compass,
  MapPin,
  MoonStars,
  ShootingStar,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import Image from "@/components/SmartImage";
import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";

const display = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-explore-track-display",
  display: "swap",
});

const editorial = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-explore-track-editorial",
  display: "swap",
});

const modern = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-explore-track-modern",
  display: "swap",
});

type TrackRow = {
  id: number;
  slug: string;
  name: string;
  quote: string;
  quote_source: string;
  description: string | null;
  banner_image_url: string | null;
  accent_color: string | null;
  category: string | null;
  group_name: string | null;
  sort_order: number;
};

type VenueRow = {
  id: number;
  name: string;
  neighborhood: string | null;
  image_url: string | null;
  hero_image_url: string | null;
};

type TrackVenueRow = {
  track_id: number;
  venue_id: number | null;
  editorial_blurb: string | null;
  is_featured: boolean;
  sort_order: number | null;
  venues: VenueRow | VenueRow[] | null;
};

type EventRow = {
  venue_id: number;
  start_date: string;
  is_free: boolean | null;
};

type TrackSummary = {
  id: number;
  slug: string;
  name: string;
  quote: string;
  quoteSource: string;
  description: string | null;
  accentColor: string;
  category: string;
  groupName: string;
  bannerImageUrl: string | null;
  venueCount: number;
  upcomingCount: number;
  tonightCount: number;
  freeCount: number;
  featuredCount: number;
  images: string[];
  venueNames: string[];
  neighborhoods: string[];
};

type CompData = {
  tracks: TrackSummary[];
  topActiveTracks: TrackSummary[];
  topCuratedTracks: TrackSummary[];
  sparseTracks: TrackSummary[];
  artefactTrack: TrackSummary | null;
  groupedTracks: Array<{ group: string; tracks: TrackSummary[] }>;
  coverage: {
    activeTracks: number;
    tracksWithBanner: number;
    approvedTrackVenues: number;
    venuesWithUpcomingEvents: number;
    totalUpcomingEvents: number;
  };
};

const FALLBACK_ACCENT = "#f18d46";
const FALLBACK_CATEGORY = "Explore";
const FALLBACK_GROUP = "City Guides";

function normalizeVenue(input: VenueRow | VenueRow[] | null): VenueRow | null {
  if (!input) return null;
  return Array.isArray(input) ? (input[0] ?? null) : input;
}

function todayPlus(days: number): string {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return getLocalDateString(value);
}

function pickTrackImage(track: TrackSummary, imageIndex = 0): string | null {
  if (track.bannerImageUrl) return track.bannerImageUrl;
  if (!track.images.length) return null;
  return track.images[imageIndex % track.images.length];
}

function badgeTone(count: number): string {
  if (count > 3) return "border-[#61e4b8]/45 bg-[#18382f] text-[#8df2cf]";
  if (count > 0) return "border-[#f3cc70]/45 bg-[#3c3018] text-[#f8de9e]";
  return "border-[#66637f]/40 bg-[#272536] text-[#c3bfdc]";
}

async function getCompData(): Promise<CompData> {
  const supabase = await createClient();
  const today = getLocalDateString();
  const date14 = todayPlus(14);

  const { data: rawTracks } = await supabase
    .from("explore_tracks")
    .select("id, slug, name, quote, quote_source, description, banner_image_url, accent_color, category, group_name, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const tracks = (rawTracks ?? []) as unknown as TrackRow[];
  if (!tracks.length) {
    return {
      tracks: [],
      topActiveTracks: [],
      topCuratedTracks: [],
      sparseTracks: [],
      artefactTrack: null,
      groupedTracks: [],
      coverage: {
        activeTracks: 0,
        tracksWithBanner: 0,
        approvedTrackVenues: 0,
        venuesWithUpcomingEvents: 0,
        totalUpcomingEvents: 0,
      },
    };
  }

  const trackIds = tracks.map((track) => track.id);

  const { data: rawTrackVenues } = await supabase
    .from("explore_track_venues")
    .select("track_id, venue_id, editorial_blurb, is_featured, sort_order, venues (id, name, neighborhood, image_url, hero_image_url)")
    .in("track_id", trackIds)
    .eq("status", "approved")
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true });

  const trackVenueRows = (rawTrackVenues ?? []) as unknown as TrackVenueRow[];
  const venueIds = Array.from(
    new Set(
      trackVenueRows
        .map((row) => normalizeVenue(row.venues)?.id ?? row.venue_id ?? null)
        .filter((id): id is number => Boolean(id))
    )
  );

  const { data: rawEvents } = venueIds.length
    ? await supabase
        .from("events")
        .select("venue_id, start_date, is_free")
        .in("venue_id", venueIds)
        .gte("start_date", today)
        .lte("start_date", date14)
        .is("canonical_event_id", null)
        .is("portal_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null")
    : { data: [] };

  const events = (rawEvents ?? []) as unknown as EventRow[];

  const eventsByVenue = new Map<number, EventRow[]>();
  for (const event of events) {
    const list = eventsByVenue.get(event.venue_id) ?? [];
    list.push(event);
    eventsByVenue.set(event.venue_id, list);
  }

  const rowsByTrack = new Map<number, TrackVenueRow[]>();
  for (const row of trackVenueRows) {
    const list = rowsByTrack.get(row.track_id) ?? [];
    list.push(row);
    rowsByTrack.set(row.track_id, list);
  }

  const summaries: TrackSummary[] = tracks.map((track) => {
    const rows = rowsByTrack.get(track.id) ?? [];
    const venues = rows.map((row) => normalizeVenue(row.venues)).filter((v): v is VenueRow => Boolean(v));
    const uniqueVenues = Array.from(new Map(venues.map((venue) => [venue.id, venue])).values());

    let upcomingCount = 0;
    let tonightCount = 0;
    let freeCount = 0;

    for (const venue of uniqueVenues) {
      const venueEvents = eventsByVenue.get(venue.id) ?? [];
      for (const event of venueEvents) {
        upcomingCount += 1;
        if (event.start_date === today) tonightCount += 1;
        if (event.is_free) freeCount += 1;
      }
    }

    const images = uniqueVenues
      .map((venue) => venue.hero_image_url || venue.image_url)
      .filter((url): url is string => Boolean(url))
      .slice(0, 6);

    const venueNames = uniqueVenues.map((venue) => venue.name).slice(0, 5);
    const neighborhoods = Array.from(
      new Set(uniqueVenues.map((venue) => venue.neighborhood).filter((value): value is string => Boolean(value)))
    ).slice(0, 4);

    return {
      id: track.id,
      slug: track.slug,
      name: track.name,
      quote: track.quote,
      quoteSource: track.quote_source,
      description: track.description,
      accentColor: track.accent_color ?? FALLBACK_ACCENT,
      category: track.category ?? FALLBACK_CATEGORY,
      groupName: track.group_name ?? FALLBACK_GROUP,
      bannerImageUrl: track.banner_image_url,
      venueCount: uniqueVenues.length,
      upcomingCount,
      tonightCount,
      freeCount,
      featuredCount: rows.filter((row) => row.is_featured).length,
      images,
      venueNames,
      neighborhoods,
    };
  });

  const topActiveTracks = [...summaries]
    .sort((a, b) => b.upcomingCount - a.upcomingCount || b.venueCount - a.venueCount)
    .slice(0, 8);

  const topCuratedTracks = [...summaries]
    .sort((a, b) => b.featuredCount - a.featuredCount || b.venueCount - a.venueCount)
    .slice(0, 6);

  const sparseTracks = [...summaries]
    .sort((a, b) => a.upcomingCount - b.upcomingCount || b.venueCount - a.venueCount)
    .slice(0, 6);

  const artefactTrack =
    summaries.find((track) => track.slug.includes("artefact")) ??
    summaries.find((track) => track.name.toLowerCase().includes("artefact")) ??
    null;

  const groupMap = new Map<string, TrackSummary[]>();
  for (const track of summaries) {
    const list = groupMap.get(track.groupName) ?? [];
    list.push(track);
    groupMap.set(track.groupName, list);
  }

  const groupedTracks = Array.from(groupMap.entries()).map(([group, list]) => ({
    group,
    tracks: [...list].sort((a, b) => b.upcomingCount - a.upcomingCount),
  }));

  const venuesWithUpcomingEvents = Array.from(eventsByVenue.entries()).filter(([, list]) => list.length > 0).length;

  return {
    tracks: summaries,
    topActiveTracks,
    topCuratedTracks,
    sparseTracks,
    artefactTrack,
    groupedTracks,
    coverage: {
      activeTracks: summaries.length,
      tracksWithBanner: summaries.filter((track) => Boolean(track.bannerImageUrl)).length,
      approvedTrackVenues: trackVenueRows.length,
      venuesWithUpcomingEvents,
      totalUpcomingEvents: events.length,
    },
  };
}

function EmptyCompState() {
  return (
    <div className="rounded-3xl border border-[#35456b]/75 bg-[#101833]/75 p-6 text-center">
      <p className="font-[var(--font-explore-track-editorial)] text-2xl text-[#eef3ff]">No active tracks in this environment.</p>
      <p className="mt-2 text-sm text-[#b9c7e8]">Seed explore tracks first, then this comp deck will render against live data.</p>
    </div>
  );
}

function CityPulseComp({ tracks }: { tracks: TrackSummary[] }) {
  const heroTrack = tracks[0] ?? null;
  const heroImage = heroTrack ? pickTrackImage(heroTrack, 0) : null;

  return (
    <section className="rounded-[30px] border border-[#3a4f80]/70 bg-[linear-gradient(155deg,#0a1838_0%,#121a3f_55%,#211328_100%)] p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-[var(--font-explore-track-modern)] text-[0.62rem] uppercase tracking-[0.22em] text-[#9eb7ec]">Comp 01</p>
          <h2 className="font-[var(--font-explore-track-editorial)] text-3xl text-[#f5f7ff]">City Pulse</h2>
        </div>
        <span className="rounded-full border border-[#5072b4]/70 bg-[#1a2d5e]/65 px-3 py-1 font-[var(--font-explore-track-modern)] text-[0.62rem] uppercase tracking-[0.14em] text-[#bfd3ff]">
          Immersive discovery
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="relative overflow-hidden rounded-2xl border border-[#415b95]/75 bg-[#0c1634] min-h-[350px]">
          {heroImage ? (
            <Image src={heroImage} alt={heroTrack?.name ?? "Track hero"} fill sizes="(max-width: 1024px) 100vw, 720px" className="object-cover object-center" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(110%_130%_at_0%_0%,#3853a0_0%,#161a34_55%,#101320_100%)]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,9,19,0.1)_0%,rgba(7,11,22,0.8)_58%,rgba(7,10,16,0.96)_100%)]" />
          <div className="absolute left-5 right-5 bottom-5">
            <p className="inline-flex items-center gap-1 rounded-full border border-[#f0c56d]/55 bg-[#4e3b1f]/65 px-2.5 py-1 font-[var(--font-explore-track-modern)] text-[0.62rem] uppercase tracking-[0.14em] text-[#ffd891]">
              <ShootingStar size={11} />
              Explore tonight
            </p>
            <h3 className="mt-2 font-[var(--font-explore-track-display)] text-5xl uppercase leading-[0.86] text-[#f9fbff] sm:text-6xl">
              {heroTrack?.name ?? "Explore Atlanta"}
            </h3>
            <p className="mt-2 max-w-xl font-[var(--font-explore-track-modern)] text-sm text-[#d6e2ff]">
              {heroTrack?.description || "Track cards surface what is alive tonight while still preserving slower discovery lanes."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`rounded-full border px-2.5 py-1 font-[var(--font-explore-track-modern)] text-[0.6rem] uppercase tracking-[0.14em] ${badgeTone(heroTrack?.tonightCount ?? 0)}`}>
                {heroTrack?.tonightCount ?? 0} tonight
              </span>
              <span className={`rounded-full border px-2.5 py-1 font-[var(--font-explore-track-modern)] text-[0.6rem] uppercase tracking-[0.14em] ${badgeTone(heroTrack?.upcomingCount ?? 0)}`}>
                {heroTrack?.upcomingCount ?? 0} in 14 days
              </span>
              <span className={`rounded-full border px-2.5 py-1 font-[var(--font-explore-track-modern)] text-[0.6rem] uppercase tracking-[0.14em] ${badgeTone(heroTrack?.freeCount ?? 0)}`}>
                {heroTrack?.freeCount ?? 0} free
              </span>
            </div>
          </div>
        </div>

        <aside className="rounded-2xl border border-[#445f9e]/75 bg-[#111c3f]/85 p-3.5">
          <p className="font-[var(--font-explore-track-modern)] text-[0.62rem] uppercase tracking-[0.16em] text-[#9fb6e7]">Tonight lanes</p>
          <div className="mt-2 space-y-2.5">
            {tracks.slice(0, 4).map((track) => (
              <article key={track.slug} className="rounded-lg border border-[#4b659f]/70 bg-[#172754]/70 p-2.5">
                <p className="text-sm text-[#f4f7ff]">{track.name}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className={`rounded-full border px-1.5 py-0.5 font-[var(--font-explore-track-modern)] text-[0.52rem] uppercase tracking-[0.1em] ${badgeTone(track.tonightCount)}`}>
                    {track.tonightCount} tonight
                  </span>
                  <span className={`rounded-full border px-1.5 py-0.5 font-[var(--font-explore-track-modern)] text-[0.52rem] uppercase tracking-[0.1em] ${badgeTone(track.upcomingCount)}`}>
                    {track.upcomingCount} upcoming
                  </span>
                  <span className="rounded-full border border-[#5a688d]/50 bg-[#2a2f46] px-1.5 py-0.5 font-[var(--font-explore-track-modern)] text-[0.52rem] uppercase tracking-[0.1em] text-[#cfd8f5]">
                    {track.venueCount} venues
                  </span>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tracks.slice(0, 4).map((track, idx) => {
          const image = pickTrackImage(track, idx + 1);
          return (
            <article key={track.slug} className="rounded-xl border border-[#40578f]/65 bg-[#142149]/70 p-2.5">
              <div className="relative h-28 overflow-hidden rounded-lg border border-[#4d679f]/50 bg-[#1b2347]">
                {image ? (
                  <Image src={image} alt={track.name} fill sizes="(max-width: 1024px) 100vw, 280px" className="object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(100%_100%_at_10%_0%,#4058a9_0%,#21284a_65%,#171c31_100%)]" />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(7,10,18,0.88)_100%)]" />
                <p className="absolute left-2 bottom-2 text-[0.62rem] uppercase tracking-[0.1em] text-[#dce6ff]">{track.category}</p>
              </div>
              <p className="mt-2 text-sm text-[#eff4ff]">{track.name}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function NeighborhoodDriftComp({ groupedTracks }: { groupedTracks: Array<{ group: string; tracks: TrackSummary[] }> }) {
  return (
    <section className="rounded-[30px] border border-[#6c5a5e]/70 bg-[linear-gradient(145deg,#2a161f_0%,#181326_60%,#112032_100%)] p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-[var(--font-explore-track-modern)] text-[0.62rem] uppercase tracking-[0.22em] text-[#d6b3bf]">Comp 02</p>
          <h2 className="font-[var(--font-explore-track-editorial)] text-3xl text-[#fff2f7]">Neighborhood Drift</h2>
        </div>
        <span className="rounded-full border border-[#7f6572]/70 bg-[#341f2d]/70 px-3 py-1 font-[var(--font-explore-track-modern)] text-[0.62rem] uppercase tracking-[0.14em] text-[#ffd2e2]">
          Narrative route
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {groupedTracks.slice(0, 6).map(({ group, tracks }) => {
          const lead = tracks[0];
          const second = tracks[1];
          const third = tracks[2];
          return (
            <article key={group} className="rounded-2xl border border-[#765e6f]/70 bg-[#261929]/75 p-3.5">
              <p className="font-[var(--font-explore-track-modern)] text-[0.6rem] uppercase tracking-[0.16em] text-[#f0c4d6]">{group}</p>
              {lead && (
                <>
                  <h3 className="mt-1 font-[var(--font-explore-track-editorial)] text-xl text-[#fff1f8]">{lead.name}</h3>
                  <p className="mt-1 font-[var(--font-explore-track-editorial)] text-sm italic text-[#ffdce8]">&ldquo;{lead.quote}&rdquo;</p>
                  <p className="mt-1 font-[var(--font-explore-track-modern)] text-[0.62rem] uppercase tracking-[0.12em] text-[#f4bfd6]">{lead.quoteSource}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 font-[var(--font-explore-track-modern)] text-[0.52rem] uppercase tracking-[0.1em] ${badgeTone(lead.upcomingCount)}`}>
                      {lead.upcomingCount} upcoming
                    </span>
                    <span className="rounded-full border border-[#8d6272]/60 bg-[#3a2431] px-2 py-0.5 font-[var(--font-explore-track-modern)] text-[0.52rem] uppercase tracking-[0.1em] text-[#ffd1e2]">
                      {lead.venueCount} venues
                    </span>
                    {lead.neighborhoods[0] && (
                      <span className="rounded-full border border-[#7a6d89]/60 bg-[#302741] px-2 py-0.5 font-[var(--font-explore-track-modern)] text-[0.52rem] uppercase tracking-[0.1em] text-[#dcccf3]">
                        {lead.neighborhoods[0]}
                      </span>
                    )}
                  </div>
                </>
              )}

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[second, third].filter((item): item is TrackSummary => Boolean(item)).map((track) => (
                  <div key={track.slug} className="rounded-lg border border-[#7a5f73]/65 bg-[#331f32]/70 p-2">
                    <p className="text-sm text-[#ffeef7]">{track.name}</p>
                    <p className="mt-0.5 text-[0.7rem] text-[#e5c7d3]">{track.upcomingCount} events in 14 days</p>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RelicCabinetComp({ artefactTrack, sparseTracks }: { artefactTrack: TrackSummary | null; sparseTracks: TrackSummary[] }) {
  const relic = artefactTrack ?? sparseTracks[0] ?? null;
  const relicImage = relic ? pickTrackImage(relic, 0) : null;

  return (
    <section className="rounded-[30px] border border-[#526f59]/70 bg-[linear-gradient(150deg,#10211c_0%,#1b2d2a_55%,#1b1f2d_100%)] p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-[var(--font-explore-track-modern)] text-[0.62rem] uppercase tracking-[0.22em] text-[#b9dcba]">Comp 03</p>
          <h2 className="font-[var(--font-explore-track-editorial)] text-3xl text-[#edffef]">Relic Cabinet</h2>
        </div>
        <span className="rounded-full border border-[#62856a]/70 bg-[#1f3b27]/65 px-3 py-1 font-[var(--font-explore-track-modern)] text-[0.62rem] uppercase tracking-[0.14em] text-[#cff6d0]">
          Weird and wonderful
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-[#58785d]/70 bg-[#173024]/75 p-3.5">
          <p className="font-[var(--font-explore-track-modern)] text-[0.6rem] uppercase tracking-[0.16em] text-[#c2e6c4]">Hero artefact track</p>
          <h3 className="mt-1 font-[var(--font-explore-track-editorial)] text-2xl text-[#efffef]">{relic?.name ?? "Artefact Track"}</h3>
          <div className="mt-2 relative h-44 overflow-hidden rounded-xl border border-[#6c8f71]/60 bg-[#263e33]">
            {relicImage ? (
              <Image src={relicImage} alt={relic?.name ?? "Artefact"} fill sizes="(max-width: 1024px) 100vw, 560px" className="object-cover" />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(120%_110%_at_0%_0%,#4c7350_0%,#2c3e36_62%,#1f2a2d_100%)]" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_28%,rgba(8,17,14,0.92)_100%)]" />
            <p className="absolute left-3 right-3 bottom-3 text-sm text-[#e8ffe8]">
              {relic?.description || "Object-first storytelling with facts, provenance, and track lore front and center."}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-[#6f9071]/60 bg-[#294633] px-2 py-0.5 font-[var(--font-explore-track-modern)] text-[0.54rem] uppercase tracking-[0.1em] text-[#dcf6dc]">
              {relic?.venueCount ?? 0} objects/venues
            </span>
            <span className={`rounded-full border px-2 py-0.5 font-[var(--font-explore-track-modern)] text-[0.54rem] uppercase tracking-[0.1em] ${badgeTone(relic?.upcomingCount ?? 0)}`}>
              {relic?.upcomingCount ?? 0} upcoming events
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#5f7b62]/70 bg-[#172633]/78 p-3.5">
          <p className="font-[var(--font-explore-track-modern)] text-[0.6rem] uppercase tracking-[0.16em] text-[#c4e1cc]">Low-signal tracks still worth opening</p>
          <div className="mt-2 space-y-2.5">
            {sparseTracks.slice(0, 5).map((track) => (
              <article key={track.slug} className="rounded-lg border border-[#658068]/70 bg-[#26363f]/72 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-[#ecffef]">{track.name}</p>
                    <p className="mt-0.5 text-[0.68rem] text-[#c5ddd2]">{track.venueNames.slice(0, 2).join(" • ") || "Curated locations"}</p>
                  </div>
                  <span className={`rounded-full border px-1.5 py-0.5 font-[var(--font-explore-track-modern)] text-[0.5rem] uppercase tracking-[0.1em] ${badgeTone(track.upcomingCount)}`}>
                    {track.upcomingCount}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function ExploreTracksCompDeckPage() {
  const data = await getCompData();

  return (
    <main
      className={`${display.variable} ${editorial.variable} ${modern.variable} min-h-screen bg-[radial-gradient(140%_150%_at_0%_0%,#1a2145_0%,#0c1124_52%,#090b15_100%)] text-[#ecf1ff]`}
    >
      <div className="mx-auto max-w-[1320px] px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-[#3a4e7c]/70 bg-[#101a38]/80 p-5 backdrop-blur-md sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-[var(--font-explore-track-modern)] text-[0.62rem] uppercase tracking-[0.22em] text-[#9eb5ea]">
                Explore + Tracks Comp Reboot
              </p>
              <h1 className="mt-2 font-[var(--font-explore-track-editorial)] text-3xl text-[#f6f8ff] sm:text-4xl">
                Consumer-First Concepts, Not Dashboard UI
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-[#bfd0f0] sm:text-base">
                Three new exploration directions that prioritize story, place, and momentum while still respecting live data density.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/atlanta?view=explore"
                className="inline-flex items-center gap-1 rounded-full border border-[#5771aa]/75 bg-[#1a2f61]/72 px-3 py-1.5 font-[var(--font-explore-track-modern)] text-[0.62rem] uppercase tracking-[0.14em] text-[#d3e2ff] hover:bg-[#1f3870]"
              >
                <Compass size={12} />
                Open Live Explore
              </Link>
              <Link
                href="/design/atlanta"
                className="inline-flex items-center gap-1 rounded-full border border-[#5771aa]/75 bg-[#1a2f61]/72 px-3 py-1.5 font-[var(--font-explore-track-modern)] text-[0.62rem] uppercase tracking-[0.14em] text-[#d3e2ff] hover:bg-[#1f3870]"
              >
                <ArrowUpRight size={12} />
                Other Decks
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-7 space-y-5">
          {data.tracks.length === 0 ? (
            <EmptyCompState />
          ) : (
            <>
              <CityPulseComp tracks={data.topActiveTracks} />
              <NeighborhoodDriftComp groupedTracks={data.groupedTracks} />
              <RelicCabinetComp artefactTrack={data.artefactTrack} sparseTracks={data.sparseTracks} />
            </>
          )}
        </section>

        {data.tracks.length > 0 && (
          <section className="mt-7 rounded-2xl border border-[#3f517b]/65 bg-[#121c3a]/70 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <MoonStars size={16} className="text-[#a9bee8]" />
              <h2 className="font-[var(--font-explore-track-editorial)] text-xl text-[#f4f7ff]">Reality check from current data</h2>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-[#5771aa]/65 bg-[#1c2f61]/70 px-2.5 py-1 font-[var(--font-explore-track-modern)] text-[0.6rem] uppercase tracking-[0.12em] text-[#d2e2ff]">
                {data.coverage.activeTracks} active tracks
              </span>
              <span className="rounded-full border border-[#7b688a]/60 bg-[#2f2940]/70 px-2.5 py-1 font-[var(--font-explore-track-modern)] text-[0.6rem] uppercase tracking-[0.12em] text-[#d8c8e9]">
                {data.coverage.tracksWithBanner}/{data.coverage.activeTracks} have track banners
              </span>
              <span className="rounded-full border border-[#698b72]/65 bg-[#223a2a]/70 px-2.5 py-1 font-[var(--font-explore-track-modern)] text-[0.6rem] uppercase tracking-[0.12em] text-[#c7ebd1]">
                {data.coverage.venuesWithUpcomingEvents} venues with upcoming events
              </span>
              <span className="rounded-full border border-[#947755]/65 bg-[#3d2f1c]/70 px-2.5 py-1 font-[var(--font-explore-track-modern)] text-[0.6rem] uppercase tracking-[0.12em] text-[#f5ddad]">
                {data.coverage.totalUpcomingEvents} track-linked events in 14 days
              </span>
              <span className="rounded-full border border-[#5a7396]/65 bg-[#1f2f47]/70 px-2.5 py-1 font-[var(--font-explore-track-modern)] text-[0.6rem] uppercase tracking-[0.12em] text-[#c8dcff]">
                {data.coverage.approvedTrackVenues} curated track-venue rows
              </span>
            </div>
            <p className="mt-2 text-xs text-[#b9c8e7]">
              Design intent: keep exploration emotional first, then reveal these operational constraints as quiet secondary context.
            </p>
          </section>
        )}

        <footer className="mt-7 text-xs text-[#9dafd5]">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1"><MapPin size={12} />Uses live explore track + venue + event data</span>
            <span className="inline-flex items-center gap-1"><Sparkle size={12} />Built for deliberate next pass selection</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
