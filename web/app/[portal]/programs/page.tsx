import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { PortalHeader } from "@/components/headers";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import { getPortalSourceAccess } from "@/lib/federation";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import FilmPortalNav from "../_components/film/FilmPortalNav";

type Props = {
  params: Promise<{ portal: string }>;
};

type RawProgramRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  series_type: string;
  festival: {
    slug: string;
    name: string;
  } | null;
};

type RawProgramEventRow = {
  series_id: string | null;
  start_date: string;
  start_time: string | null;
};

type FilmProgram = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  series_type: string;
  upcoming_count: number;
  next_session_date: string | null;
  next_session_time: string | null;
  festival_slug: string | null;
  festival_name: string | null;
};

const FALLBACK_PHOTOS = [
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1460881680858-30d872d5b530?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1502139214982-d0ad755818d8?auto=format&fit=crop&w=1600&q=80",
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

function getProgramTypeLabel(seriesType: string): string {
  if (seriesType === "film") return "Film";
  if (seriesType === "festival_program") return "Festival Program";
  if (seriesType === "recurring_show") return "Recurring";
  if (seriesType === "class_series") return "Class";
  return "Program";
}

async function getFilmPrograms(portalId: string): Promise<FilmProgram[]> {
  const supabase = await createClient();
  const today = getLocalDateString();
  const access = await getPortalSourceAccess(portalId);

  const { data } = await supabase
    .from("series")
    .select(`
      id,
      slug,
      title,
      description,
      image_url,
      series_type,
      festival:festivals(slug,name)
    `)
    .eq("is_active", true)
    .in("series_type", ["film", "festival_program", "recurring_show"])
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data as RawProgramRow[] | null) || [];
  const seriesIds = rows.map((row) => row.id);
  if (seriesIds.length === 0) return [];

  let eventQuery = supabase
    .from("events")
    .select("series_id,start_date,start_time,source_id")
    .eq("category", "film")
    .in("series_id", seriesIds)
    .gte("start_date", today)
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(2000);

  if (access.sourceIds.length > 0) {
    eventQuery = eventQuery.in("source_id", access.sourceIds);
  }

  const { data: eventRowsRaw } = await eventQuery;
  const eventRows = (eventRowsRaw as (RawProgramEventRow & { source_id?: number | null })[] | null) || [];

  const bucket = new Map<string, { count: number; nextDate: string | null; nextTime: string | null }>();
  for (const row of eventRows) {
    if (!row.series_id) continue;
    const existing = bucket.get(row.series_id);
    if (!existing) {
      bucket.set(row.series_id, {
        count: 1,
        nextDate: row.start_date,
        nextTime: row.start_time,
      });
      continue;
    }

    existing.count += 1;
    if (
      !existing.nextDate ||
      row.start_date < existing.nextDate ||
      (row.start_date === existing.nextDate && (row.start_time || "") < (existing.nextTime || ""))
    ) {
      existing.nextDate = row.start_date;
      existing.nextTime = row.start_time;
    }
  }

  return rows
    .map((row) => {
      const stats = bucket.get(row.id);
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        image_url: row.image_url,
        series_type: row.series_type,
        upcoming_count: stats?.count || 0,
        next_session_date: stats?.nextDate || null,
        next_session_time: stats?.nextTime || null,
        festival_slug: row.festival?.slug || null,
        festival_name: row.festival?.name || null,
      };
    })
    .filter((program) => program.upcoming_count > 0)
    .sort((a, b) => {
      if (a.series_type === "festival_program" && b.series_type !== "festival_program") return -1;
      if (a.series_type !== "festival_program" && b.series_type === "festival_program") return 1;
      if (a.next_session_date && b.next_session_date) {
        const dateDelta = a.next_session_date.localeCompare(b.next_session_date);
        if (dateDelta !== 0) return dateDelta;
      }
      return b.upcoming_count - a.upcoming_count || a.title.localeCompare(b.title);
    });
}

export default async function FilmProgramsPage({ params }: Props) {
  const { portal: slug } = await params;
  const portal = await getCachedPortalBySlug(slug);

  if (!portal || getPortalVertical(portal) !== "film") {
    notFound();
  }

  const programs = await getFilmPrograms(portal.id);

  return (
    <div className="min-h-screen bg-[#090d16] text-[#f6f7fb]">
      <PortalHeader portalSlug={portal.slug} portalName={portal.name} backLink={{ label: "Home", fallbackHref: `/${portal.slug}` }} hideNav />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 space-y-6">
        <FilmPortalNav portalSlug={portal.slug} />

        <header className="space-y-2">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-[#8fa2c4]">Atlanta Film</p>
          <h1 className="font-[var(--font-film-editorial)] text-4xl text-[#f7f7fb]">Curated Programs</h1>
          <p className="max-w-3xl text-sm text-[#b8c7e3]">
            Repertory runs, festival programs, and recurring film series aggregated from across Atlanta screenings.
          </p>
        </header>

        {programs.length > 0 ? (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {programs.map((program, index) => (
              <article key={program.id} className="overflow-hidden rounded-2xl border border-[#29354f] bg-[#0e1526]">
                <Link href={`/${portal.slug}/series/${program.slug}`} className="group block">
                  <div className="relative h-44">
                    <Image
                      src={getProxiedImageSrc(program.image_url || FALLBACK_PHOTOS[index % FALLBACK_PHOTOS.length])}
                      alt={program.title}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      sizes="(max-width: 1280px) 50vw, 32vw"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,11,19,0.08)_0%,rgba(7,11,19,0.86)_100%)]" />
                    <div className="absolute left-3 top-3 rounded-full border border-[#8ea9ec66] bg-[#8ea9ec1f] px-2 py-1 text-[0.58rem] uppercase tracking-[0.14em] text-[#d9e5ff]">
                      {getProgramTypeLabel(program.series_type)}
                    </div>
                  </div>
                </Link>

                <div className="space-y-2 p-3.5">
                  <h2 className="line-clamp-2 text-lg font-semibold text-[#f3f7ff]">{program.title}</h2>
                  <p className="text-[0.7rem] uppercase tracking-[0.12em] text-[#c5d6f4]">
                    {program.upcoming_count} upcoming • {formatShortDate(program.next_session_date || getLocalDateString())}
                    {program.next_session_time ? ` • ${formatTimeLabel(program.next_session_time)}` : ""}
                  </p>
                  <p className="line-clamp-2 text-sm text-[#aec1e4]">{program.description || "Atlanta film programming."}</p>

                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/${portal.slug}/series/${program.slug}`}
                      className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-[#c9d9ff] hover:text-[#e1eaff]"
                    >
                      View program
                      <ArrowRight size={12} />
                    </Link>
                    {program.festival_slug ? (
                      <Link
                        href={`/${portal.slug}/festivals/${program.festival_slug}`}
                        className="text-[0.68rem] uppercase tracking-[0.12em] text-[#9db0d6] hover:text-[#d3e1ff]"
                      >
                        {program.festival_name || "Festival"}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <div className="rounded-2xl border border-[#2a334a] bg-[#0d1424] px-4 py-8 text-sm text-[#bccbe6]">
            Program listings are updating.
          </div>
        )}
      </main>
    </div>
  );
}
