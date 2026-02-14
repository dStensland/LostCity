import type { Portal } from "@/lib/portal-context";
import { formatSmartDate, formatTime } from "@/lib/formats";
import { getPortalHospitalLocations } from "@/lib/hospitals";
import type { HospitalAudienceMode } from "@/lib/hospital-modes";
import type { EmoryPersonaKey } from "@/lib/emory-personas";
import { getEmoryCommunityDigest, type EmoryCommunityStory } from "@/lib/emory-community-feed";
import {
  EMORY_THEME_CSS,
  EMORY_THEME_SCOPE_CLASS,
  hospitalBodyFont,
  hospitalDisplayFont,
} from "@/lib/hospital-art";
import HospitalTrackedLink from "@/app/[portal]/_components/hospital/HospitalTrackedLink";
import type { CSSProperties } from "react";
import { getEmoryFederationShowcase } from "@/lib/emory-federation-showcase";
import EmoryDiscoveryDeck from "@/app/[portal]/_components/hospital/EmoryDiscoveryDeck";
import EmoryCommunityNeedExplorer, { type CommunityNeedLens } from "@/app/[portal]/_components/hospital/EmoryCommunityNeedExplorer";

type EmoryCommunityExperienceProps = {
  portal: Portal;
  mode: HospitalAudienceMode;
  persona: EmoryPersonaKey;
  includeSupportSensitive?: boolean;
};

type StoryCard = {
  id: string;
  title: string;
  summary: string;
  meta: string;
  href: string;
  imageUrl: string;
  targetId: string;
};

const HERO_IMAGE = "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1400&q=80";
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1516302752625-fcc3c50ae61f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80",
];

const NEED_LENSES: CommunityNeedLens[] = [
  {
    id: "healthy_eating",
    label: "Healthy Eating",
    description: "Classes, markets, and nutrition support happening this week.",
    imageUrl: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80",
    filterId: "healthy_eating",
    tab: "events",
  },
  {
    id: "fitness",
    label: "Fitness",
    description: "Walks, mobility sessions, and movement events near Emory.",
    imageUrl: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80",
    filterId: "fitness",
    tab: "events",
  },
  {
    id: "community_support",
    label: "Community Support",
    description: "Caregiver resources, aid services, and neighborhood organizations.",
    imageUrl: "https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1200&q=80",
    filterId: "community_support",
    tab: "organizations",
  },
  {
    id: "mental_health",
    label: "Mental Health",
    description: "Mindfulness programs, peer circles, and support options.",
    imageUrl: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=1200&q=80",
    filterId: "mental_health",
    tab: "organizations",
  },
];

function appendQueryParams(href: string, entries: Record<string, string>): string {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  for (const [key, value] of Object.entries(entries)) {
    params.set(key, value);
  }
  return `${path}?${params.toString()}`;
}

function storyScheduleLabel(date: string, time: string | null, isAllDay: boolean): string {
  const label = formatSmartDate(date).label;
  if (isAllDay) return `${label} · All Day`;
  return `${label} · ${formatTime(time, false)}`;
}

function toStoryCard(args: {
  story: EmoryCommunityStory;
  index: number;
  portalSlug: string;
  mode: HospitalAudienceMode;
  persona: EmoryPersonaKey;
}): StoryCard {
  const { story, index, portalSlug, mode, persona } = args;
  return {
    id: story.id,
    title: story.title,
    summary: story.summary,
    meta: story.neighborhood
      ? `${story.neighborhood} · ${storyScheduleLabel(story.startDate, story.startTime, story.isAllDay)}`
      : storyScheduleLabel(story.startDate, story.startTime, story.isAllDay),
    href: story.eventId
      ? `/${portalSlug}?view=community&event=${story.eventId}&mode=${mode}&persona=${persona}`
      : `/${portalSlug}?view=community&mode=${mode}&persona=${persona}`,
    imageUrl: story.imageUrl || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
    targetId: story.eventId ? String(story.eventId) : story.id,
  };
}

function fallbackStoryCards(args: {
  portalSlug: string;
  mode: HospitalAudienceMode;
  persona: EmoryPersonaKey;
}): StoryCard[] {
  const { portalSlug, mode, persona } = args;
  return [
    {
      id: "fallback-walk",
      title: "Saturday 5K Walk and Jog",
      summary: "Beginner-friendly community movement with hydration and blood pressure checks.",
      meta: "BeltLine Eastside Trail · Saturday",
      href: `/${portalSlug}?view=community&mode=${mode}&persona=${persona}`,
      imageUrl: FALLBACK_IMAGES[0],
      targetId: "fallback-walk",
    },
    {
      id: "fallback-cooking",
      title: "Heart-Healthy Cooking Night",
      summary: "Practical recipes and low-cost ingredient guides at The Stove ATL.",
      meta: "Old Fourth Ward · Class",
      href: `/${portalSlug}?view=community&mode=${mode}&persona=${persona}`,
      imageUrl: FALLBACK_IMAGES[1],
      targetId: "fallback-cooking",
    },
    {
      id: "fallback-mindful",
      title: "Mindful Mondays Peer Circle",
      summary: "Stress, grief, and caregiver support with local facilitators.",
      meta: "Southwest Atlanta · Org",
      href: `/${portalSlug}?view=community&mode=${mode}&persona=${persona}`,
      imageUrl: FALLBACK_IMAGES[2],
      targetId: "fallback-mindful",
    },
    {
      id: "fallback-market",
      title: "Fresh Route Market Pop-Up",
      summary: "Affordable produce and nutrition consultations.",
      meta: "East Atlanta · Venue",
      href: `/${portalSlug}?view=community&mode=${mode}&persona=${persona}`,
      imageUrl: FALLBACK_IMAGES[3],
      targetId: "fallback-market",
    },
  ];
}

export default async function EmoryCommunityExperience({
  portal,
  mode,
  persona,
  includeSupportSensitive = false,
}: EmoryCommunityExperienceProps) {
  const hospitals = await getPortalHospitalLocations(portal.id);
  const primaryHospital = hospitals[0] || null;
  const digest = await getEmoryCommunityDigest({
    portalSlug: portal.slug,
    mode,
  });
  const showcase = await getEmoryFederationShowcase({
    portalId: portal.id,
    portalSlug: portal.slug,
    hospital: primaryHospital,
    includeSensitive: includeSupportSensitive,
  });
  const storyPool = digest.tracks.flatMap((track) => track.stories);
  const stories = storyPool.map((story, index) => toStoryCard({
    story,
    index,
    portalSlug: portal.slug,
    mode,
    persona,
  }));
  const cards = stories.length > 0 ? stories : fallbackStoryCards({ portalSlug: portal.slug, mode, persona });
  const liveCards = cards.slice(0, 2);
  const calendarHref = `/${portal.slug}?view=community&tab=groups&mode=${mode}&persona=${persona}`;
  const supportOnHref = `/${portal.slug}?view=community&tab=groups&mode=${mode}&persona=${persona}&support=1`;
  const supportOffHref = `/${portal.slug}?view=community&tab=groups&mode=${mode}&persona=${persona}`;
  const neighborhoodCards = [
    {
      title: "Decatur + Candler Park",
      summary: "Family wellness classes and preventive care outreach.",
      href: appendQueryParams(calendarHref, {
        community_hub_tab: "events",
        community_hub_filter: "all",
        community_hub_view: "list",
        community_hub_q: "Decatur Candler Park",
      }),
    },
    {
      title: "West End + South Atlanta",
      summary: "Food access partners and youth movement programs.",
      href: appendQueryParams(calendarHref, {
        community_hub_tab: "events",
        community_hub_filter: "community_support",
        community_hub_view: "list",
        community_hub_q: "West End South Atlanta",
      }),
    },
    {
      title: "Midtown + Virginia-Highland",
      summary: "After-work fitness and mental wellness circles.",
      href: appendQueryParams(calendarHref, {
        community_hub_tab: "events",
        community_hub_filter: "fitness",
        community_hub_view: "list",
        community_hub_q: "Midtown Virginia Highland",
      }),
    },
  ] as const;

  return (
    <>
      <style>{EMORY_THEME_CSS}</style>

      <div className={`${hospitalBodyFont.className} ${EMORY_THEME_SCOPE_CLASS} py-6 space-y-5`}>
        <section className="emory-panel p-4 sm:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-4">
            <div>
              <p className="emory-kicker">Keeping Atlanta Healthy</p>
              <h1 className={`mt-2 text-[clamp(2.1rem,3.8vw,3.15rem)] leading-[0.94] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                Community care beyond the hospital walls.
              </h1>
              <p className="mt-3 max-w-[48ch] text-sm sm:text-base text-[var(--muted)]">
                Ongoing support for healthier routines between hospital visits.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="emory-chip">{showcase.counts.events} events this week</span>
                <span className="emory-chip">{showcase.counts.organizations} support groups and orgs</span>
                <span className="emory-chip">{showcase.counts.venues} venues</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <HospitalTrackedLink
                  href={calendarHref}
                  tracking={{
                    actionType: "resource_clicked",
                    portalSlug: portal.slug,
                    modeContext: mode,
                    sectionKey: "v3_community_hero",
                    targetKind: "community_calendar",
                    targetId: "explore-near-me",
                    targetLabel: "Explore Near Me",
                    targetUrl: calendarHref,
                  }}
                  className="emory-primary-btn inline-flex items-center px-3 py-1.5 text-xs"
                >
                  Explore Near Me
                </HospitalTrackedLink>
                <HospitalTrackedLink
                  href={calendarHref}
                  tracking={{
                    actionType: "resource_clicked",
                    portalSlug: portal.slug,
                    modeContext: mode,
                    sectionKey: "v3_community_hero",
                    targetKind: "family_programs",
                    targetId: "family-programs",
                    targetLabel: "Family Programs",
                    targetUrl: calendarHref,
                  }}
                  className="emory-secondary-btn inline-flex items-center px-3 py-1.5 text-xs"
                >
                  Family Programs
                </HospitalTrackedLink>
                <HospitalTrackedLink
                  href={calendarHref}
                  tracking={{
                    actionType: "resource_clicked",
                    portalSlug: portal.slug,
                    modeContext: mode,
                    sectionKey: "v3_community_hero",
                    targetKind: "calendar",
                    targetId: "open-calendar",
                    targetLabel: "Open Calendar",
                    targetUrl: calendarHref,
                  }}
                  className="emory-secondary-btn inline-flex items-center px-3 py-1.5 text-xs"
                >
                  Open Calendar
                </HospitalTrackedLink>
              </div>
            </div>

            <div
              className="emory-photo-hero min-h-[240px] sm:min-h-[290px]"
              style={{ "--hero-image": `url("${HERO_IMAGE}")` } as CSSProperties}
            >
              <div className="absolute inset-x-2 bottom-2 z-[2] rounded-md bg-[#002f6c]/88 px-2.5 py-2 text-white text-[11px] leading-tight">
                <div className="flex items-center justify-between gap-2">
                  <strong>Featured tonight</strong>
                  <span className="text-white/90">Free Park Fitness with Emory coaches at 6:00 PM in Grant Park</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="emory-panel p-4 sm:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1.12fr_0.88fr] gap-4">
            <div>
              <p className="emory-kicker">Now</p>
              <h2 className={`mt-1 text-[clamp(1.9rem,3.2vw,2.65rem)] leading-[0.96] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                Pick what you need now
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Choose a lens to see matching events, venues, and organizations.</p>

              <div className="mt-3">
                <EmoryCommunityNeedExplorer stateKey="community_hub" lenses={NEED_LENSES} />
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {liveCards.map((card) => (
                  <article key={card.id} className="overflow-hidden rounded-xl border border-[var(--twilight)] bg-white shadow-[0_4px_14px_rgba(12,28,58,0.06)]">
                    <img src={card.imageUrl} alt={card.title} className="h-40 w-full object-cover" />
                    <div className="p-3">
                      <p className="text-[11px] uppercase tracking-[0.06em] text-[#6b7280]">{card.meta}</p>
                      <h3 className={`mt-1 text-[1.28rem] leading-[0.98] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                        {card.title}
                      </h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">{card.summary}</p>
                      <HospitalTrackedLink
                        href={card.href}
                        tracking={{
                          actionType: "resource_clicked",
                          portalSlug: portal.slug,
                          modeContext: mode,
                          sectionKey: "v3_community_live",
                          targetKind: "community_story",
                          targetId: card.targetId,
                          targetLabel: card.title,
                          targetUrl: card.href,
                        }}
                        className="mt-2 inline-flex items-center rounded-md border border-[#c7d3e8] bg-white px-2 py-1 text-[11px] font-semibold text-[#143b83] hover:bg-[#f3f7ff]"
                      >
                        View details
                      </HospitalTrackedLink>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="emory-hero-lens p-4">
              <p className="emory-kicker">Neighborhoods</p>
              <h3 className={`mt-1 text-[clamp(1.4rem,2.2vw,2rem)] leading-[0.98] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                Pick your neighborhood lens
              </h3>
              <div className="mt-3 space-y-2">
                {neighborhoodCards.map((item) => (
                  <article key={item.title} className="rounded-xl border border-[var(--twilight)] bg-gradient-to-b from-white to-[#f9fbfe] px-3 py-3">
                    <p className="text-sm font-semibold text-[var(--cream)]">{item.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{item.summary}</p>
                    <HospitalTrackedLink
                      href={item.href}
                      tracking={{
                        actionType: "resource_clicked",
                        portalSlug: portal.slug,
                        modeContext: mode,
                        sectionKey: "v3_community_neighborhoods",
                        targetKind: "neighborhood_filter",
                        targetId: item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                        targetLabel: item.title,
                        targetUrl: item.href,
                      }}
                      className="mt-2 inline-flex items-center rounded-md border border-[#c7d3e8] bg-white px-2 py-1 text-[11px] font-semibold text-[#143b83] hover:bg-[#f3f7ff]"
                    >
                      Open view
                    </HospitalTrackedLink>
                  </article>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-[var(--twilight)] bg-gradient-to-b from-white to-[#f9fbfe] px-3 py-3">
                <p className="text-sm font-semibold text-[var(--cream)]">Support groups</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">Include local peer and recovery support options.</p>
                <HospitalTrackedLink
                  href={includeSupportSensitive ? supportOffHref : supportOnHref}
                  tracking={{
                    actionType: "resource_clicked",
                    portalSlug: portal.slug,
                    modeContext: mode,
                    sectionKey: "v3_community_support_toggle",
                    targetKind: "support_groups_toggle",
                    targetId: includeSupportSensitive ? "support-off" : "support-on",
                    targetLabel: includeSupportSensitive ? "Hide Support Groups" : "Include Support Groups",
                    targetUrl: includeSupportSensitive ? supportOffHref : supportOnHref,
                  }}
                  className="mt-2 inline-flex items-center rounded-md border border-[#c7d3e8] bg-white px-2 py-1 text-[11px] font-semibold text-[#143b83] hover:bg-[#f3f7ff]"
                >
                  {includeSupportSensitive ? "Hide support groups" : "Show support groups"}
                </HospitalTrackedLink>
              </div>
            </aside>
          </div>
        </section>

        <section className="emory-panel p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="emory-kicker">This week</p>
              <h2 className={`mt-1 text-[clamp(1.9rem,3.2vw,2.65rem)] leading-[0.96] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                Everything happening this week
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Browse events, venues, organizations, and classes in one place.</p>
            </div>
            <HospitalTrackedLink
              href={calendarHref}
              tracking={{
                actionType: "resource_clicked",
                portalSlug: portal.slug,
                modeContext: mode,
                sectionKey: "v3_community_week",
                targetKind: "calendar",
                targetId: "open-full-week",
                targetLabel: "Open Full Week",
                targetUrl: calendarHref,
              }}
              className="emory-secondary-btn inline-flex items-center px-3 py-1.5 text-xs"
            >
              Open Full Week
            </HospitalTrackedLink>
          </div>

          <div className="mt-3">
            <EmoryDiscoveryDeck
              stateKey="community_hub"
              title="Explore events, venues, and organizations"
              subtitle="Live Lost City discovery for neighborhood health and support."
              events={showcase.events}
              venues={showcase.venues}
              organizations={showcase.organizations}
              defaultTab="events"
              emptyHref={calendarHref}
              contextParams={{ mode, persona }}
              quickFilters={[
                { id: "all", label: "All", keywords: [] },
                { id: "healthy_eating", label: "Healthy eating", keywords: ["food", "meal", "nutrition", "market", "produce", "kitchen"] },
                { id: "fitness", label: "Fitness", keywords: ["fitness", "walk", "movement", "yoga", "run"] },
                { id: "community_support", label: "Community support", keywords: ["support", "caregiver", "aid", "resource", "community"] },
                { id: "mental_health", label: "Mental health", keywords: ["mental", "mindful", "stress", "peer", "wellness", "nami"] },
                { id: "support_groups", label: "Support groups", keywords: ["support group", "peer support", "recovery", "grief"] },
              ]}
            />
          </div>
        </section>
      </div>
    </>
  );
}
