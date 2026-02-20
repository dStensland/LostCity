/* eslint-disable @next/next/no-img-element */
import FeedShell from "@/components/feed/FeedShell";
import CuratedContent from "@/components/feed/CuratedContent";
import type { Portal } from "@/lib/portal-context";
import {
  getHospitalBookVisitHref,
  getHospitalLandingData,
  getHospitalWayfindingHref,
  getPortalHospitalLocations,
  type HospitalLocation,
} from "@/lib/hospitals";
import type { HospitalAudienceMode } from "@/lib/hospital-modes";
import {
  EMORY_THEME_CSS,
  EMORY_THEME_SCOPE_CLASS,
  hospitalBodyFont,
  hospitalDisplayFont,
  isEmoryDemoPortal,
  HOSPITAL_CARD_IMAGE_BY_SLUG,
  HOSPITAL_CARD_FALLBACK_IMAGE,
  getEventFallbackImage,
} from "@/lib/hospital-art";
import HospitalTrackedLink from "@/app/[portal]/_components/hospital/HospitalTrackedLink";
import ContinueToHospitalBanner from "@/app/[portal]/_components/hospital/ContinueToHospitalBanner";
import type { CSSProperties } from "react";
import { getEmoryFederationShowcase } from "@/lib/emory-federation-showcase";
import { getSupportPolicyCounts } from "@/lib/support-source-policy";
import { Suspense } from "react";

type FeedTab = "curated" | "explore" | "foryou";

type HospitalPortalExperienceProps = {
  portal: Portal;
  feedTab: FeedTab;
  mode: HospitalAudienceMode;
};

type HospitalCardModel = {
  hospital: HospitalLocation;
  openNowCount: number;
  foodCount: number;
  stayCount: number;
  essentialsCount: number;
  imageUrl: string;
};

const HERO_IMAGE = "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1400&q=80";

function appendQueryParams(href: string, entries: Record<string, string>): string {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  for (const [key, value] of Object.entries(entries)) {
    params.set(key, value);
  }
  return `${path}?${params.toString()}`;
}

function readMetaUrl(hospital: HospitalLocation | null, keys: string[]): string | null {
  if (!hospital?.metadata) return null;
  for (const key of keys) {
    const value = hospital.metadata[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) return trimmed;
  }
  return null;
}

function resourceHref(hospital: HospitalLocation | null, fallback: string, keys: string[]): string {
  const fromMeta = readMetaUrl(hospital, keys);
  if (fromMeta) return fromMeta;
  if (hospital?.website) return hospital.website;
  return fallback;
}

async function buildHospitalCards(args: {
  portalId: string;
  hospitals: HospitalLocation[];
  mode: HospitalAudienceMode;
}): Promise<HospitalCardModel[]> {
  const { portalId, hospitals, mode } = args;

  const cards = await Promise.all(
    hospitals.map(async (hospital) => {
      const landing = await getHospitalLandingData(portalId, hospital.slug, mode);
      const nearby = landing?.nearby;
      const openNowCount =
        (nearby?.food || []).filter((row) => row.is_open_now).length
        + (nearby?.essentials || []).filter((row) => row.is_open_now).length
        + (nearby?.late || []).filter((row) => row.is_open_now).length;

      return {
        hospital,
        openNowCount,
        foodCount: (nearby?.food || []).length,
        stayCount: (nearby?.stay || []).length,
        essentialsCount: (nearby?.essentials || []).length,
        imageUrl: HOSPITAL_CARD_IMAGE_BY_SLUG[hospital.slug] || HOSPITAL_CARD_FALLBACK_IMAGE,
      } satisfies HospitalCardModel;
    }),
  );

  return cards;
}

export default async function HospitalPortalExperience({
  portal,
  feedTab,
  mode,
}: HospitalPortalExperienceProps) {
  if (!isEmoryDemoPortal(portal.slug)) {
    return (
      <FeedShell
        portalId={portal.id}
        portalSlug={portal.slug}
        activeTab={feedTab}
        curatedContent={<CuratedContent portalSlug={portal.slug} />}
      />
    );
  }

  const hospitals = await getPortalHospitalLocations(portal.id);
  const primaryHospital = hospitals[0] || null;
  const showcase = await getEmoryFederationShowcase({
    portalId: portal.id,
    portalSlug: portal.slug,
    hospital: primaryHospital,
  });
  const hospitalCards = await buildHospitalCards({
    portalId: portal.id,
    hospitals,
    mode,
  });

  const supportCounts = getSupportPolicyCounts();

  const communityHref = `/${portal.slug}/community-hub`;
  const directoryHref = `/${portal.slug}/hospitals`;

  const emergencyHref = primaryHospital?.emergency_phone
    ? `tel:${primaryHospital.emergency_phone}`
    : primaryHospital?.phone
      ? `tel:${primaryHospital.phone}`
      : directoryHref;
  const mainLineHref = primaryHospital?.phone ? `tel:${primaryHospital.phone}` : directoryHref;
  const wayfindingHref = primaryHospital ? getHospitalWayfindingHref(primaryHospital) : directoryHref;
  const careHref = primaryHospital ? getHospitalBookVisitHref(primaryHospital) : directoryHref;
  const billingHref = resourceHref(primaryHospital, directoryHref, ["billing_url", "insurance_url", "financial_help_url"]);
  const languageHref = resourceHref(primaryHospital, directoryHref, ["language_support_url", "accessibility_url", "interpreter_url"]);

  const foodSupportOrgCount = supportCounts.trackCounts.food_support || 0;

  const categoryCards = [
    {
      id: "support-groups",
      label: "Community organizations",
      count: supportCounts.totalOrganizations,
      countLabel: `${supportCounts.totalOrganizations}+ organizations`,
      href: appendQueryParams(communityHref, {
        community_hub_tab: "organizations",
        community_hub_filter: "community_support",
        community_hub_view: "list",
      }),
      detail: "Peer support, caregiver circles, and neighborhood partners",
      accent: "#143b83",
      accentBg: "#e8edf6",
      emoji: "\u{1F91D}",
    },
    {
      id: "health-events",
      label: "Health events this week",
      count: showcase.counts.events,
      countLabel: null,
      href: appendQueryParams(communityHref, {
        community_hub_tab: "events",
        community_hub_filter: "all",
        community_hub_view: "list",
      }),
      detail: "Screenings, classes, and practical wellness programs",
      accent: "#0e7c5f",
      accentBg: "#e6f5f0",
      emoji: "\u{1F4C5}",
    },
    {
      id: "fitness",
      label: "Fitness and movement",
      count: Math.max(1, Math.floor(showcase.counts.events * 0.28)),
      countLabel: null,
      href: appendQueryParams(communityHref, {
        community_hub_tab: "events",
        community_hub_filter: "fitness",
        community_hub_view: "list",
      }),
      detail: "Walks, mobility sessions, and movement meetups",
      accent: "#b45309",
      accentBg: "#fef3e2",
      emoji: "\u{1F3C3}",
    },
    {
      id: "healthy-eating",
      label: "Healthy eating resources",
      count: foodSupportOrgCount,
      countLabel: `${foodSupportOrgCount} organizations`,
      href: appendQueryParams(communityHref, {
        community_hub_tab: "venues",
        community_hub_filter: "healthy_eating",
        community_hub_view: "list",
      }),
      detail: "Nutrition-friendly programs, venues, and local support",
      accent: "#15803d",
      accentBg: "#e8f5e9",
      emoji: "\u{1F96C}",
    },
  ] as const;

  const supportCards = [
    { id: "emergency", label: "Emergency support", detail: "Immediate phone support", cta: "Call now", href: emergencyHref, external: emergencyHref.startsWith("http"), emoji: "\u{1F6A8}", accentColor: "#dc2626" },
    { id: "main-line", label: "Main hospital line", detail: "Call the front desk directly", cta: "Call desk", href: mainLineHref, external: false, emoji: "\u{1F4DE}", accentColor: "#143b83" },
    { id: "wayfinding", label: "Wayfinding and parking", detail: "Navigate entrances and parking", cta: "Open map", href: wayfindingHref, external: /^https?:\/\//i.test(wayfindingHref), emoji: "\u{1F5FA}\u{FE0F}", accentColor: "#0e7c5f" },
    { id: "care", label: "Care and appointments", detail: "Manage visits and appointments", cta: "Manage care", href: careHref, external: /^https?:\/\//i.test(careHref), emoji: "\u{1F4CB}", accentColor: "#7c3aed" },
    { id: "billing", label: "Billing and insurance", detail: "Financial and coverage help", cta: "Get help", href: billingHref, external: /^https?:\/\//i.test(billingHref), emoji: "\u{1F4B3}", accentColor: "#b45309" },
    { id: "language", label: "Language and accessibility", detail: "Interpreter and accessibility support", cta: "Language help", href: languageHref, external: /^https?:\/\//i.test(languageHref), emoji: "\u{1F310}", accentColor: "#0284c7" },
  ] as const;

  return (
    <>
      <style>{EMORY_THEME_CSS}</style>

      <div className={`${hospitalBodyFont.className} ${EMORY_THEME_SCOPE_CLASS} py-6 pb-20 lg:pb-6 space-y-6`}>
        {/* Continue to Hospital Banner (Feature 7) */}
        <Suspense fallback={null}>
          <ContinueToHospitalBanner portalSlug={portal.slug} portalId={portal.id} />
        </Suspense>

        {/* 1. Hero */}
        <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#002f6c] via-[#003a7c] to-[#0b4a9e]">
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 30h60M30 0v60\' stroke=\'%23fff\' stroke-width=\'.5\' fill=\'none\'/%3E%3C/svg%3E")', backgroundSize: '60px 60px' }} />
          <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_0.85fr]">
            <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8ed585]">Your Hospital Network</p>
              <h1 className={`mt-3 text-[clamp(1.75rem,3.8vw,2.8rem)] leading-[1.05] text-white ${hospitalDisplayFont.className}`}>
                Everything you need,<br />all in one place.
              </h1>
              <p className="mt-3 max-w-[44ch] text-[15px] leading-relaxed text-white/75">
                Find your hospital, explore nearby options, and connect with community health resources across Atlanta.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <HospitalTrackedLink
                  href="#choose-hospital"
                  tracking={{
                    actionType: "resource_clicked",
                    portalSlug: portal.slug,
                    hospitalSlug: primaryHospital?.slug,
                    modeContext: mode,
                    sectionKey: "v6_hub_hero",
                    targetKind: "hospital_cards",
                    targetId: "find-nearby",
                    targetLabel: "Find what is nearby",
                  }}
                  className="inline-flex items-center rounded-lg bg-[#8ed585] px-5 py-2.5 text-[14px] font-bold text-[#002f6c] hover:bg-[#7fcf75] transition-colors shadow-lg shadow-[#8ed585]/20"
                >
                  Explore Nearby
                </HospitalTrackedLink>
                <HospitalTrackedLink
                  href={directoryHref}
                  tracking={{
                    actionType: "resource_clicked",
                    portalSlug: portal.slug,
                    modeContext: mode,
                    sectionKey: "v6_hub_hero",
                    targetKind: "hospital_directory",
                    targetId: "manage-care",
                    targetLabel: "Manage My Care",
                    targetUrl: directoryHref,
                  }}
                  className="inline-flex items-center rounded-lg border border-white/30 bg-white/10 px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
                >
                  Manage My Care
                </HospitalTrackedLink>
                <HospitalTrackedLink
                  href={communityHref}
                  tracking={{
                    actionType: "resource_clicked",
                    portalSlug: portal.slug,
                    modeContext: mode,
                    sectionKey: "v6_hub_hero",
                    targetKind: "community_hub",
                    targetId: "community-guide",
                    targetLabel: "Community Guide",
                    targetUrl: communityHref,
                  }}
                  className="inline-flex items-center rounded-lg border border-white/30 bg-white/10 px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
                >
                  Community Health
                </HospitalTrackedLink>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 border border-white/20 px-3 py-1 text-[11.5px] font-bold uppercase tracking-[0.03em] text-white/90">{showcase.counts.events} health events this week</span>
                <span className="rounded-full bg-white/10 border border-white/20 px-3 py-1 text-[11.5px] font-bold uppercase tracking-[0.03em] text-white/90">{supportCounts.totalOrganizations}+ organizations</span>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <img
                src={HERO_IMAGE}
                alt="Emory Healthcare"
                className="h-full w-full object-cover min-h-[340px]"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#002f6c] via-[#002f6c]/40 to-transparent" />
              <div className="absolute inset-x-4 bottom-4 z-[2] rounded-lg bg-black/50 px-3.5 py-2.5 text-white text-[13px] leading-tight backdrop-blur-md">
                <strong>Today at {primaryHospital?.name || "Emory Healthcare"}</strong>
                <span className="text-white/80 ml-2">Care, directions, and local support in one place.</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Hospital Campuses */}
        <section className="emory-panel p-4 sm:p-5 scroll-mt-20" id="choose-hospital">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="emory-kicker">Your hospitals</p>
              <h2 className={`mt-1.5 text-[clamp(1.5rem,2.8vw,2.2rem)] leading-[1.05] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                Select a campus
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">View nearby food, lodging, services, and directions for each campus.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {hospitalCards.map((card) => {
              const conciergeHref = `/${portal.slug}/hospitals/${card.hospital.slug}`;
              const hospitalWayfindingHref = getHospitalWayfindingHref(card.hospital);
              return (
                <article key={card.hospital.id} className="group overflow-hidden rounded-xl border border-[var(--twilight)] bg-white shadow-[0_4px_16px_rgba(12,28,58,0.07)] transition-shadow hover:shadow-[0_8px_24px_rgba(12,28,58,0.12)]">
                  <div className="relative">
                    <img src={card.imageUrl} alt={card.hospital.name} className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b2d5f]/85 via-[#0b2d5f]/60 to-transparent px-3 pb-2.5 pt-5 text-white">
                      <h3 className="text-base font-semibold leading-tight">{card.hospital.name}</h3>
                      <p className="mt-0.5 text-[11px] text-white/90">{card.hospital.address}</p>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="emory-chip">{card.openNowCount} open now</span>
                      <span className="emory-chip">{card.foodCount} food spots</span>
                      <span className="emory-chip">{card.stayCount} stay options</span>
                      <span className="emory-chip">{card.essentialsCount} essentials</span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2.5">
                      <HospitalTrackedLink
                        href={conciergeHref}
                        tracking={{
                          actionType: "resource_clicked",
                          portalSlug: portal.slug,
                          hospitalSlug: card.hospital.slug,
                          modeContext: mode,
                          sectionKey: "v5_hub_hospital_cards",
                          targetKind: "concierge",
                          targetId: card.hospital.slug,
                          targetLabel: card.hospital.name,
                          targetUrl: conciergeHref,
                        }}
                        className="emory-primary-btn inline-flex items-center"
                      >
                        Explore Campus
                      </HospitalTrackedLink>
                      <HospitalTrackedLink
                        href={hospitalWayfindingHref}
                        external
                        tracking={{
                          actionType: "wayfinding_opened",
                          portalSlug: portal.slug,
                          hospitalSlug: card.hospital.slug,
                          modeContext: mode,
                          sectionKey: "v5_hub_hospital_cards",
                          targetKind: "wayfinding",
                          targetId: card.hospital.slug,
                          targetLabel: card.hospital.name,
                          targetUrl: hospitalWayfindingHref,
                        }}
                        className="emory-link-btn"
                      >
                        Directions
                      </HospitalTrackedLink>
                      {card.hospital.phone && (
                        <HospitalTrackedLink
                          href={`tel:${card.hospital.phone}`}
                          tracking={{
                            actionType: "resource_clicked",
                            portalSlug: portal.slug,
                            hospitalSlug: card.hospital.slug,
                            modeContext: mode,
                            sectionKey: "v5_hub_hospital_cards",
                            targetKind: "phone_call",
                            targetId: card.hospital.slug,
                            targetLabel: card.hospital.name,
                            targetUrl: `tel:${card.hospital.phone}`,
                          }}
                          className="emory-link-btn"
                        >
                          Call
                        </HospitalTrackedLink>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* 3. Community Health Preview (elevated from position 5) */}
        <section className="rounded-[20px] border border-[#d0dae8] bg-gradient-to-br from-[#f0f4fa] to-[#f8f9fc] p-5 sm:p-6">
          <div>
            <p className="emory-kicker">Community health</p>
            <HospitalTrackedLink
              href={communityHref}
              tracking={{
                actionType: "resource_clicked",
                portalSlug: portal.slug,
                modeContext: mode,
                sectionKey: "v5_hub_community_preview",
                targetKind: "community_hub",
                targetId: "explore-all",
                targetLabel: "Health resources in your neighborhood",
                targetUrl: communityHref,
              }}
              className="block mt-1 hover:opacity-80 transition-opacity"
            >
              <h2 className={`text-[clamp(1.4rem,2.6vw,2rem)] leading-[1.05] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                Health resources in your neighborhood
              </h2>
            </HospitalTrackedLink>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Events, programs, and support organizations across Atlanta.
              Including CDC, YMCA, Atlanta Community Food Bank, and {supportCounts.totalOrganizations}+ organizations.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {categoryCards.map((category) => (
              <HospitalTrackedLink
                key={category.id}
                href={category.href}
                tracking={{
                  actionType: "resource_clicked",
                  portalSlug: portal.slug,
                  modeContext: mode,
                  sectionKey: "v5_hub_community_preview",
                  targetKind: "community_category",
                  targetId: category.id,
                  targetLabel: category.label,
                  targetUrl: category.href,
                }}
                className="group block rounded-xl border border-[var(--twilight)] bg-white px-4 py-4 transition-all hover:shadow-[0_6px_20px_rgba(12,28,58,0.10)] hover:border-[var(--line-strong)]"
                style={{ borderLeftWidth: '3px', borderLeftColor: category.accent } as CSSProperties}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg" style={{ background: category.accentBg }}>{category.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#6b7280]">Active this week</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--cream)] leading-snug">{category.label}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)] leading-relaxed">{category.detail}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-2xl font-bold" style={{ color: category.accent }}>{category.countLabel || category.count}</p>
                  <span className="text-xs font-semibold text-[var(--portal-accent)] group-hover:underline">Explore &rarr;</span>
                </div>
              </HospitalTrackedLink>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {showcase.events.slice(0, 3).map((event) => {
              const eventHref = event.detailHref || communityHref;
              const eventImage = event.imageUrl || getEventFallbackImage(event.category, event.title);
              return (
                <HospitalTrackedLink
                  key={event.id}
                  href={eventHref}
                  tracking={{
                    actionType: "resource_clicked",
                    portalSlug: portal.slug,
                    modeContext: mode,
                    sectionKey: "v6_hub_community_preview",
                    targetKind: "event",
                    targetId: String(event.id),
                    targetLabel: event.title,
                    targetUrl: eventHref,
                  }}
                  className="group overflow-hidden rounded-xl border border-[var(--twilight)] bg-white shadow-[0_4px_14px_rgba(12,28,58,0.06)]"
                >
                  <img
                    src={eventImage}
                    alt={event.title}
                    className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <div className="p-3">
                    <p className="text-[11px] uppercase tracking-[0.06em] text-[#6b7280]">
                      {[event.category || "Health", event.neighborhood || event.venueName].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-sm font-semibold text-[var(--cream)] leading-tight">{event.title}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--muted)]">{event.scheduleLabel}</p>
                    <span className="mt-1.5 inline-flex text-xs font-semibold text-[#143b83]">View details</span>
                  </div>
                </HospitalTrackedLink>
              );
            })}
          </div>
        </section>

        {/* 4. Quick Support (moved down from position 2) */}
        <section className="emory-panel p-4 sm:p-5">
          <p className="emory-kicker">Quick support</p>
          <h2 className={`mt-1.5 text-[clamp(1.4rem,2.6vw,2rem)] leading-[1.05] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
            Help when you need it
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Phone numbers, directions, and essential services.</p>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {supportCards.map((item) => (
              <HospitalTrackedLink
                key={item.id}
                href={item.href}
                external={item.external}
                tracking={{
                  actionType: "resource_clicked",
                  portalSlug: portal.slug,
                  hospitalSlug: primaryHospital?.slug,
                  modeContext: mode,
                  sectionKey: "v5_hub_support",
                  targetKind: "always_available_support",
                  targetId: item.id,
                  targetLabel: item.label,
                  targetUrl: item.href,
                }}
                className="group flex items-start gap-3 rounded-xl border border-[var(--twilight)] bg-white px-3.5 py-3.5 transition-all hover:shadow-[0_4px_14px_rgba(12,28,58,0.08)] hover:border-[var(--line-strong)]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-lg">{item.emoji}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--cream)]">{item.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)] leading-relaxed">{item.detail}</p>
                  <span className="mt-1.5 inline-flex items-center rounded-md text-xs font-semibold group-hover:underline" style={{ color: item.accentColor }}>
                    {item.cta} &rarr;
                  </span>
                </div>
              </HospitalTrackedLink>
            ))}
          </div>
        </section>

        {/* 5. Footer */}
        <footer className="mt-3 text-center pb-2">
          <p className="text-[11.5px] font-medium tracking-[0.03em] text-[#9ca3af]">
            Emory Healthcare &middot; Guest Services: (404) 712-2000
          </p>
        </footer>
      </div>
    </>
  );
}
