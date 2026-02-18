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
    },
  ] as const;

  const supportCards = [
    { id: "emergency", label: "Emergency support", detail: "Immediate phone support", cta: "Call now", href: emergencyHref, external: emergencyHref.startsWith("http") },
    { id: "main-line", label: "Main hospital line", detail: "Call the front desk directly", cta: "Call desk", href: mainLineHref, external: false },
    { id: "wayfinding", label: "Wayfinding and parking", detail: "Navigate entrances and parking", cta: "Open map", href: wayfindingHref, external: /^https?:\/\//i.test(wayfindingHref) },
    { id: "care", label: "Care and appointments", detail: "Manage visits and appointments", cta: "Manage care", href: careHref, external: /^https?:\/\//i.test(careHref) },
    { id: "billing", label: "Billing and insurance", detail: "Financial and coverage help", cta: "Get help", href: billingHref, external: /^https?:\/\//i.test(billingHref) },
    { id: "language", label: "Language and accessibility", detail: "Interpreter and accessibility support", cta: "Language help", href: languageHref, external: /^https?:\/\//i.test(languageHref) },
  ] as const;

  return (
    <>
      <style>{EMORY_THEME_CSS}</style>

      <div className={`${hospitalBodyFont.className} ${EMORY_THEME_SCOPE_CLASS} py-6 pb-20 lg:pb-6 space-y-5`}>
        {/* Continue to Hospital Banner (Feature 7) */}
        <Suspense fallback={null}>
          <ContinueToHospitalBanner portalSlug={portal.slug} portalId={portal.id} />
        </Suspense>

        {/* 1. Hero */}
        <section className="emory-panel p-4 sm:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
            <div>
              <p className="emory-kicker">Your Hospital Network</p>
              <h1 className={`mt-2 text-[clamp(2.6rem,4.8vw,3.8rem)] leading-[0.93] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                Everything you need, all in one place.
              </h1>
              <p className="mt-3 max-w-[52ch] text-sm sm:text-base text-[var(--muted)]">
                Find your hospital, explore nearby options, and connect with community health resources.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
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
                  className="emory-primary-btn inline-flex items-center"
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
                  className="emory-secondary-btn inline-flex items-center"
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
                  className="emory-secondary-btn inline-flex items-center"
                >
                  Community Health
                </HospitalTrackedLink>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="emory-chip">{showcase.counts.events} health events this week</span>
                <span className="emory-chip">{supportCounts.totalOrganizations}+ community organizations</span>
              </div>
            </div>

            <div
              className="emory-photo-hero min-h-[240px] sm:min-h-[290px]"
              style={{ "--hero-image": `url("${HERO_IMAGE}")` } as CSSProperties}
            >
                  <div className="absolute inset-x-2 bottom-2 z-[2] rounded-md bg-[#002f6c]/88 px-2.5 py-2 text-white text-[13px] sm:text-sm leading-tight">
                <div className="flex items-center justify-between gap-2">
                  <strong>Today at {primaryHospital?.name || "Emory Healthcare"}</strong>
                  <span className="text-white/90">Care, directions, and local support in one place.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Hospital Campuses */}
        <section className="emory-panel p-4 sm:p-5 scroll-mt-20" id="choose-hospital">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="emory-kicker">Your hospitals</p>
              <h2 className={`mt-1 text-[clamp(2rem,3.5vw,2.8rem)] leading-[0.96] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                Select a campus
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">View nearby food, lodging, services, and directions for each campus.</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {hospitalCards.map((card) => {
              const conciergeHref = `/${portal.slug}/hospitals/${card.hospital.slug}`;
              const hospitalWayfindingHref = getHospitalWayfindingHref(card.hospital);
              return (
                <article key={card.hospital.id} className="group overflow-hidden rounded-xl border border-[var(--twilight)] bg-white shadow-[0_5px_16px_rgba(12,28,58,0.08)]">
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
        <section className="emory-panel p-4 sm:p-5">
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
              <h2 className={`text-[clamp(1.9rem,3.3vw,2.6rem)] leading-[0.96] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                Health resources in your neighborhood
              </h2>
            </HospitalTrackedLink>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Events, programs, and support organizations across Atlanta.
              Including CDC, YMCA, Atlanta Community Food Bank, and {supportCounts.totalOrganizations}+ organizations.
            </p>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            {categoryCards.map((category) => (
              <article key={category.id} className="rounded-xl border border-[var(--twilight)] bg-gradient-to-b from-white to-[#f9fbfe] px-3 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#6b7280]">Active this week</p>
                <p className="mt-1 text-sm font-semibold text-[var(--cream)]">{category.label}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{category.detail}</p>
                <p className="mt-2 text-2xl font-semibold text-[#143b83]">{category.countLabel || category.count}</p>
                <HospitalTrackedLink
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
                  className="emory-link-btn mt-1.5 inline-flex items-center"
                >
                  Explore
                </HospitalTrackedLink>
              </article>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
          <h2 className={`mt-1 text-[clamp(1.8rem,3.2vw,2.5rem)] leading-[0.97] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
            Help when you need it
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Phone numbers, directions, and essential services.</p>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {supportCards.map((item) => (
              <article key={item.id} className="rounded-xl border border-[var(--twilight)] bg-gradient-to-b from-white to-[#f9fbfe] px-3 py-3">
                <p className="text-sm font-semibold text-[var(--cream)]">{item.label}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{item.detail}</p>
                <HospitalTrackedLink
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
                  className="mt-2 inline-flex items-center rounded-md border border-[#c7d3e8] bg-white px-2 py-1 text-[11px] font-semibold text-[#143b83] hover:bg-[#f3f7ff]"
                >
                  {item.cta}
                </HospitalTrackedLink>
              </article>
            ))}
          </div>
        </section>

        {/* 5. Footer */}
        <footer className="mt-2 text-center">
          <p className="text-[10.5px] font-medium tracking-[0.04em] text-[#9ca3af]">
            Emory Healthcare &middot; Guest Services: (404) 712-2000
          </p>
        </footer>
      </div>
    </>
  );
}
