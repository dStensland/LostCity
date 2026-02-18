import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { EmoryDemoHeader, PortalHeader } from "@/components/headers";
import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { isEmoryDemoPortal } from "@/lib/hospital-art";
import { normalizeHospitalMode } from "@/lib/hospital-modes";
import Skeleton from "@/components/Skeleton";
import EmoryCommunityExperience from "../_components/hospital/EmoryCommunityExperience";
import EmoryMobileBottomNav from "../_components/hospital/EmoryMobileBottomNav";
import { Suspense } from "react";
import FilmPortalNav from "../_components/film/FilmPortalNav";

type Props = {
  params: Promise<{ portal: string }>;
  searchParams?: Promise<{ mode?: string; support?: string }>;
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

type RawMeetupEventRow = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  image_url: string | null;
  category: string | null;
  tags: string[] | null;
  organization: {
    name: string;
    slug: string;
  } | null;
  venue: {
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
};

type MeetupEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  image_url: string | null;
  org_name: string | null;
  org_slug: string | null;
  venue_name: string | null;
};

type FilmGroup = {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  description: string | null;
  logo_url: string | null;
  neighborhood: string | null;
  next_meetup: MeetupEvent | null;
  upcoming_count: number;
};

const FALLBACK_PHOTOS = [
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1460881680858-30d872d5b530?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1502139214982-d0ad755818d8?auto=format&fit=crop&w=1600&q=80",
];

const COMMUNITY_PATHS = [
  {
    title: "Film Groups",
    body: "Local collectives, recurring meetups, and screening clubs.",
    hrefFor: (slug: string) => `/${slug}?view=community&tab=groups`,
  },
  {
    title: "People + Lists",
    body: "Curators and community-made lists to discover what matters in Atlanta.",
    hrefFor: (slug: string) => `/${slug}?view=community&tab=people`,
  },
  {
    title: "Classes + Workshops",
    body: "Film education, craft workshops, and production skill-building sessions.",
    hrefFor: (slug: string) => `/${slug}?view=find&type=classes`,
  },
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

function isFilmMeetup(row: RawMeetupEventRow): boolean {
  const tags = row.tags || [];
  const searchable = `${row.title} ${tags.join(" ")} ${row.organization?.name || ""}`.toLowerCase();

  return (
    row.category === "community" ||
    /film|cinema|movie|society|club|collective|meetup|workshop|filmmaker|screenwriter|discussion/.test(searchable)
  );
}

async function getFilmCommunityData() {
  const supabase = await createClient();
  const today = getLocalDateString();

  const [orgResult, eventResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("id,name,slug,org_type,description,logo_url,categories,neighborhood")
      .eq("hidden", false)
      .limit(180),
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
        organization:organizations!events_organization_id_fkey(name,slug),
        venue:venues!events_venue_id_fkey(name,slug,neighborhood)
      `)
      .in("category", ["community", "film"])
      .gte("start_date", today)
      .or("is_sensitive.eq.false,is_sensitive.is.null")
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(360),
  ]);

  const organizations = (orgResult.data as RawOrganizationRow[] | null) || [];
  const eventsRaw = (eventResult.data as RawMeetupEventRow[] | null) || [];
  const events = eventsRaw.filter(isFilmMeetup);

  const meetupsByOrg = new Map<string, MeetupEvent[]>();
  for (const row of events) {
    const orgSlug = row.organization?.slug || null;
    if (!orgSlug) continue;

    const existing = meetupsByOrg.get(orgSlug) || [];
    existing.push({
      id: row.id,
      title: row.title,
      start_date: row.start_date,
      start_time: row.start_time,
      image_url: row.image_url,
      org_name: row.organization?.name || null,
      org_slug: orgSlug,
      venue_name: row.venue?.name || null,
    });
    meetupsByOrg.set(orgSlug, existing);
  }

  const groups: FilmGroup[] = organizations
    .filter((org) => isFilmCommunityOrg(org) || meetupsByOrg.has(org.slug))
    .map((org) => {
      const upcoming = meetupsByOrg.get(org.slug) || [];
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        org_type: org.org_type,
        description: org.description,
        logo_url: org.logo_url,
        neighborhood: org.neighborhood,
        next_meetup: upcoming[0] || null,
        upcoming_count: upcoming.length,
      };
    })
    .sort((a, b) => {
      if (a.next_meetup && !b.next_meetup) return -1;
      if (!a.next_meetup && b.next_meetup) return 1;

      if (a.next_meetup && b.next_meetup) {
        const dateDelta = a.next_meetup.start_date.localeCompare(b.next_meetup.start_date);
        if (dateDelta !== 0) return dateDelta;
      }

      return b.upcoming_count - a.upcoming_count || a.name.localeCompare(b.name);
    });

  const upcomingMeetups = events
    .map((row) => ({
      id: row.id,
      title: row.title,
      start_date: row.start_date,
      start_time: row.start_time,
      image_url: row.image_url,
      org_name: row.organization?.name || null,
      org_slug: row.organization?.slug || null,
      venue_name: row.venue?.name || null,
    }))
    .slice(0, 14);

  return { groups, upcomingMeetups };
}

export default async function CommunityHubPage({ params, searchParams }: Props) {
  const { portal: slug } = await params;
  const searchParamsData = searchParams ? await searchParams : {};
  const portal = await getCachedPortalBySlug(slug);

  if (!portal) notFound();

  const vertical = getPortalVertical(portal);
  const isEmoryPortal = isEmoryDemoPortal(portal.slug);
  const isHospital = vertical === "hospital" || isEmoryPortal;

  if (isHospital && isEmoryPortal) {
    const hospitalMode = normalizeHospitalMode(searchParamsData.mode);
    return (
      <div className="min-h-screen bg-[#f2f5fa] text-[#002f6c]">
        <EmoryDemoHeader portalSlug={portal.slug} />
        <main className="max-w-6xl mx-auto px-4 pb-20">
          <Suspense fallback={<EmoryCommunityExperienceSkeleton />}>
            <EmoryCommunityExperience
              portal={portal}
              mode={hospitalMode}
              includeSupportSensitive={searchParamsData.support === "1"}
            />
          </Suspense>
        </main>
        <Suspense fallback={null}>
          <EmoryMobileBottomNav portalSlug={portal.slug} />
        </Suspense>
        <div className="lg:hidden h-16" />
      </div>
    );
  }

  if (vertical !== "film") {
    redirect(`/${portal.slug}?view=community`);
  }

  const { groups, upcomingMeetups } = await getFilmCommunityData();
  const spotlight = upcomingMeetups[0] || null;

  return (
    <div className="min-h-screen bg-[#090d16] text-[#f6f7fb]">
      <PortalHeader portalSlug={portal.slug} portalName={portal.name} backLink={{ label: "Home", fallbackHref: `/${portal.slug}` }} hideNav />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 space-y-7">
        <FilmPortalNav portalSlug={portal.slug} />

        <header className="space-y-2">
          <p className="text-[0.64rem] uppercase tracking-[0.18em] text-[#8fa2c4]">Atlanta Film</p>
          <h1 className="font-[var(--font-film-editorial)] text-4xl text-[#f7f7fb]">Community</h1>
          <p className="max-w-3xl text-sm text-[#b8c7e3]">
            Film clubs, filmmaker circles, and recurring meetups across the city.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-[#2a3349] bg-[#0d1424] p-4">
            <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[#9bb0d7]">Active Groups</p>
            <p className="mt-1 text-2xl font-semibold text-[#f5f8ff]">{groups.length}</p>
          </article>
          <article className="rounded-2xl border border-[#2a3349] bg-[#0d1424] p-4">
            <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[#9bb0d7]">Upcoming Meetups</p>
            <p className="mt-1 text-2xl font-semibold text-[#f5f8ff]">{upcomingMeetups.length}</p>
          </article>
          <article className="rounded-2xl border border-[#2a3349] bg-[#0d1424] p-4">
            <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[#9bb0d7]">Groups With Events</p>
            <p className="mt-1 text-2xl font-semibold text-[#f5f8ff]">{groups.filter((group) => group.upcoming_count > 0).length}</p>
          </article>
        </section>

        <section className="space-y-4">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">Spotlight Meetup</p>
              <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">Where Atlanta&apos;s film scene meets</h2>
            </div>
            <Link href={`/${portal.slug}?view=community&tab=groups`} className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-[#c9d9ff] hover:text-[#e1eaff]">
              Explore groups
              <ArrowRight size={12} />
            </Link>
          </header>

          {spotlight ? (
            <article className="relative overflow-hidden rounded-3xl border border-[#2a3349] bg-[#0d1424]">
              <div className="absolute inset-0">
                <Image
                  src={getProxiedImageSrc(spotlight.image_url || FALLBACK_PHOTOS[0])}
                  alt={spotlight.title}
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="100vw"
                />
              </div>
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,16,0.2)_0%,rgba(4,8,16,0.88)_100%)]" />

              <div className="relative p-5 sm:p-6">
                <p className="text-[0.62rem] uppercase tracking-[0.16em] text-[#d6e2fb]">{spotlight.org_name || "Film community"}</p>
                <h3 className="mt-2 max-w-3xl text-2xl font-semibold text-[#f6f8ff]">{spotlight.title}</h3>
                <p className="mt-2 text-sm text-[#d4def2]">
                  {formatShortDate(spotlight.start_date)} • {formatTimeLabel(spotlight.start_time)}
                  {spotlight.venue_name ? ` • ${spotlight.venue_name}` : ""}
                </p>
                {spotlight.org_slug ? (
                  <Link
                    href={`/${portal.slug}/community/${spotlight.org_slug}`}
                    className="mt-4 inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-[#d9e6ff] hover:text-[#f3f7ff]"
                  >
                    View group
                    <ArrowRight size={12} />
                  </Link>
                ) : null}
              </div>
            </article>
          ) : (
            <div className="rounded-2xl border border-[#2a3349] bg-[#0d1424] px-4 py-6 text-sm text-[#bccbe6]">
              Community events are being refreshed.
            </div>
          )}
        </section>

        <section className="space-y-4">
          <header>
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">Film Groups</p>
            <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">Who is organizing in Atlanta</h2>
          </header>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.length > 0 ? groups.slice(0, 18).map((group, index) => (
              <Link
                key={group.id}
                href={`/${portal.slug}/community/${group.slug}`}
                className="group block rounded-2xl border border-[#2a3349] bg-[#0d1424] p-4 hover:border-[#4a628f]"
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
                      <Image
                        src={getProxiedImageSrc(FALLBACK_PHOTOS[index % FALLBACK_PHOTOS.length])}
                        alt={group.name}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="44px"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-1 text-base font-semibold text-[#f5f8ff]">{group.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-[#b9c8e5]">
                      {group.description || "Film community, screenings, and discussion events in Atlanta."}
                    </p>
                    {group.next_meetup ? (
                      <p className="mt-2 text-[0.66rem] uppercase tracking-[0.14em] text-[#d5e2ff]">
                        {formatShortDate(group.next_meetup.start_date)} • {formatTimeLabel(group.next_meetup.start_time)}
                      </p>
                    ) : (
                      <p className="mt-2 text-[0.66rem] uppercase tracking-[0.14em] text-[#96abcf]">
                        {group.neighborhood || "Atlanta"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 inline-flex items-center gap-1 text-[0.66rem] uppercase tracking-[0.14em] text-[#c9d9ff] group-hover:text-[#e1eaff]">
                  View group
                  <ArrowRight size={11} />
                </div>
              </Link>
            )) : (
              <div className="rounded-2xl border border-[#2a3349] bg-[#0d1424] px-4 py-6 text-sm text-[#bccbe6]">
                Film groups are being curated now.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <header>
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-[#95a8cb]">Upcoming Meetups</p>
            <h2 className="mt-1 font-[var(--font-film-editorial)] text-3xl text-[#f7f8fd]">Next sessions and gatherings</h2>
          </header>

          <div className="space-y-2">
            {upcomingMeetups.length > 0 ? upcomingMeetups.slice(0, 10).map((event) => (
              <article key={event.id} className="rounded-xl border border-[#2f3d5a] bg-[#10182b] p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#f4f7ff]">{event.title}</h3>
                    <p className="mt-1 text-[0.72rem] text-[#adc0e3]">{event.org_name || "Film group"}</p>
                    <p className="mt-1 text-[0.7rem] uppercase tracking-[0.12em] text-[#c8d8f4]">
                      {formatShortDate(event.start_date)} • {formatTimeLabel(event.start_time)}
                      {event.venue_name ? ` • ${event.venue_name}` : ""}
                    </p>
                  </div>

                  {event.org_slug ? (
                    <Link href={`/${portal.slug}/community/${event.org_slug}`} className="inline-flex items-center gap-1 text-[0.66rem] uppercase tracking-[0.14em] text-[#c9d9ff] hover:text-[#e1eaff]">
                      Group
                      <ArrowRight size={11} />
                    </Link>
                  ) : null}
                </div>
              </article>
            )) : (
              <div className="rounded-xl border border-[#2f3d5a] bg-[#10182b] px-3 py-4 text-sm text-[#9eb0d1]">
                Upcoming meetups are updating.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {COMMUNITY_PATHS.map((path) => (
            <article key={path.title} className="rounded-2xl border border-[#2a3349] bg-[#0d1424] p-4">
              <h2 className="font-[var(--font-film-editorial)] text-2xl text-[#f7f7fb]">{path.title}</h2>
              <p className="mt-2 text-sm text-[#c8d5eb]">{path.body}</p>
              <Link
                href={path.hrefFor(portal.slug)}
                className="mt-3 inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-[#c9d9ff]"
              >
                Explore
                <ArrowRight size={12} />
              </Link>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

function EmoryCommunityExperienceSkeleton() {
  return (
    <div className="py-6 space-y-5">
      {/* Hero skeleton */}
      <section className="rounded-[20px] border border-[#ede8e1] bg-[#faf9f7] p-5 sm:p-7">
        <Skeleton light className="h-10 w-[70%] rounded" />
        <Skeleton light className="h-4 w-48 rounded mt-3" delay="0.04s" />
        <div className="mt-3 flex gap-1.5">
          <Skeleton light className="h-7 w-36 rounded-full" delay="0.08s" />
          <Skeleton light className="h-7 w-32 rounded-full" delay="0.12s" />
        </div>
      </section>

      {/* Category pathway cards skeleton */}
      <section className="px-4 sm:px-5">
        <Skeleton light className="h-3 w-32 rounded mb-3" delay="0.16s" />
        <div className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="shrink-0 w-[260px] sm:w-auto rounded-2xl border border-[#e5e7eb] bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <Skeleton light className="h-6 w-6 rounded shrink-0" delay={`${i * 0.04 + 0.2}s`} />
                <div className="min-w-0 flex-1">
                  <Skeleton light className="h-4 w-24 rounded" delay={`${i * 0.04 + 0.24}s`} />
                  <Skeleton light className="h-3 w-full rounded mt-1.5" delay={`${i * 0.04 + 0.28}s`} />
                  <Skeleton light className="h-5 w-20 rounded-full mt-2" delay={`${i * 0.04 + 0.32}s`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Discovery deck skeleton */}
      <section className="rounded-[20px] border border-[#e5e7eb] bg-white p-4 sm:p-5">
        <Skeleton light className="h-6 w-64 rounded" delay="0.5s" />
        <Skeleton light className="h-4 w-80 rounded mt-2" delay="0.54s" />
        <div className="mt-4 flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton light key={i} className="h-9 w-24 rounded-lg" delay={`${i * 0.04 + 0.58}s`} />
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton light key={i} className="h-20 rounded-xl" delay={`${i * 0.06 + 0.7}s`} />
          ))}
        </div>
      </section>
    </div>
  );
}
