import Link from "next/link";
import { notFound } from "next/navigation";
import { AmbientBackground } from "@/components/ambient";
import { EmoryDemoHeader, PortalHeader } from "@/components/headers";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import {
  getHospitalBookVisitHref,
  getHospitalLandingData,
  getHospitalWayfindingHref,
  getVenueMapsHref,
  type HospitalNearbyVenue,
  type HospitalService,
} from "@/lib/hospitals";
import {
  HOSPITAL_MODE_CONFIG,
  HOSPITAL_MODE_LIST,
  normalizeHospitalMode,
  type HospitalAudienceMode,
} from "@/lib/hospital-modes";
import {
  getEmoryPersonaProfile,
  normalizeEmoryPersona,
} from "@/lib/emory-personas";
import {
  EMORY_COMPETITOR_EXCLUSIONS,
} from "@/lib/emory-source-policy";
import { getEmoryCompanionCopy } from "@/lib/emory-copywriter";
import {
  EMORY_THEME_CSS,
  EMORY_THEME_SCOPE_CLASS,
  hospitalBodyFont,
  hospitalDisplayFont,
  isEmoryDemoPortal,
} from "@/lib/hospital-art";
import { formatSmartDate, formatTime } from "@/lib/formats";
import { getEmoryCommunityDigest, type EmoryCommunityStory } from "@/lib/emory-community-feed";
import HospitalTrackedLink from "@/app/[portal]/_components/hospital/HospitalTrackedLink";
import EmoryActionRail, { type EmoryActionRailAction } from "@/app/[portal]/_components/hospital/EmoryActionRail";

type Props = {
  params: Promise<{ portal: string; hospital: string }>;
  searchParams: Promise<{ mode?: string; persona?: string }>;
};

type SectionKey = "services" | "food" | "stay" | "late";

const SECTION_META: Record<SectionKey, { title: string; subtitle: string; tag: string }> = {
  services: {
    title: "On-Site Amenities & Services",
    subtitle: "Official Emory-operated support services for this hospital",
    tag: "Emory-Owned",
  },
  food: {
    title: "Where to Eat Nearby",
    subtitle: "Practical food options ranked for hospital-adjacent utility",
    tag: "Food",
  },
  stay: {
    title: "Where to Stay Nearby",
    subtitle: "Nearby lodging options for multi-day care journeys",
    tag: "Stay",
  },
  late: {
    title: "Open-Late Essentials",
    subtitle: "Night-hour options prioritized for practical support",
    tag: "Late",
  },
};

const HOSPITAL_HERO_PHOTO_BY_SLUG: Record<string, { image: string; position: string }> = {
  "emory-university-hospital": {
    image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=2200&q=80",
    position: "center 35%",
  },
  "emory-saint-josephs-hospital": {
    image: "https://images.unsplash.com/photo-1666214277651-dd0f2078c0ad?auto=format&fit=crop&w=2200&q=80",
    position: "center 42%",
  },
  "emory-johns-creek-hospital": {
    image: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=2200&q=80",
    position: "center 45%",
  },
  "emory-midtown-hospital": {
    image: "https://images.unsplash.com/photo-1666214280557-f1b5022eb634?auto=format&fit=crop&w=2200&q=80",
    position: "center 40%",
  },
};

function buildFallbackServices(hospitalName: string): HospitalService[] {
  const prefix = hospitalName.split(" ").slice(0, 2).join(" ");
  return [
    {
      id: "mock-service-cafeteria",
      hospital_location_id: "mock-hospital",
      category: "Food",
      name: "Main Concourse Cafeteria",
      description: `${prefix} visitor and family dining with all-day service windows and grab-and-go options.`,
      open_hours: "Mon-Sun 6:30am-11:00pm",
      location_hint: "Main concourse",
      cta_label: "View hours",
      cta_url: null,
      display_order: 1,
    },
    {
      id: "mock-service-pharmacy",
      hospital_location_id: "mock-hospital",
      category: "Pharmacy",
      name: "Outpatient Pharmacy",
      description: "Prescription pickup, refill support, and over-the-counter essentials for caregivers.",
      open_hours: "Mon-Fri 8:00am-7:00pm",
      location_hint: "First floor near patient discharge",
      cta_label: "Pharmacy info",
      cta_url: null,
      display_order: 2,
    },
    {
      id: "mock-service-parking",
      hospital_location_id: "mock-hospital",
      category: "Parking",
      name: "Visitor Parking Deck",
      description: "Accessible parking with direct pedestrian routing to admissions and elevator banks.",
      open_hours: "24/7 access",
      location_hint: "Visitor deck entrance on Clifton Rd",
      cta_label: "Parking details",
      cta_url: null,
      display_order: 3,
    },
  ];
}

function buildFallbackNearby(): Record<Exclude<SectionKey, "services">, HospitalNearbyVenue[]> {
  return {
    food: [
      {
        id: -101,
        name: "The Vortex Bar & Grill",
        slug: null,
        address: "438 Moreland Ave NE, Atlanta, GA 30307",
        neighborhood: "Little Five Points",
        city: "Atlanta",
        venue_type: "restaurant",
        image_url: null,
        website: "https://thevortexatl.com/",
        price_level: 2,
        distance_miles: 2.4,
        is_open_now: true,
        open_late: true,
        status_label: "Open now · closes 12am",
        relevance_score: 123,
        relevance_reason: "open now",
      },
      {
        id: -102,
        name: "Waffle House (Cheshire Bridge)",
        slug: null,
        address: "2161 Cheshire Bridge Rd NE, Atlanta, GA 30324",
        neighborhood: "Cheshire Bridge",
        city: "Atlanta",
        venue_type: "restaurant",
        image_url: null,
        website: "https://locations.wafflehouse.com/",
        price_level: 1,
        distance_miles: 2.5,
        is_open_now: true,
        open_late: true,
        status_label: "Open 24 hours",
        relevance_score: 116,
        relevance_reason: "open now",
      },
    ],
    stay: [
      {
        id: -201,
        name: "Emory Conference Center Hotel",
        slug: null,
        address: "1615 Clifton Rd NE, Atlanta, GA 30329",
        neighborhood: "Druid Hills",
        city: "Atlanta",
        venue_type: "hotel",
        image_url: null,
        website: "https://www.emoryconferencecenter.com/",
        price_level: 3,
        distance_miles: 0.6,
        is_open_now: true,
        open_late: true,
        status_label: "Open now · front desk 24/7",
        relevance_score: 132,
        relevance_reason: "close for recurring visits",
      },
      {
        id: -202,
        name: "Courtyard Atlanta Decatur Downtown/Emory",
        slug: null,
        address: "130 Clairemont Ave, Decatur, GA 30030",
        neighborhood: "Decatur",
        city: "Atlanta",
        venue_type: "hotel",
        image_url: null,
        website: "https://www.marriott.com/",
        price_level: 3,
        distance_miles: 2.0,
        is_open_now: true,
        open_late: true,
        status_label: "Open now · front desk 24/7",
        relevance_score: 118,
        relevance_reason: "close for recurring visits",
      },
    ],
    late: [
      {
        id: -301,
        name: "CVS Pharmacy (N Decatur Rd)",
        slug: null,
        address: "2738 N Decatur Rd, Decatur, GA 30033",
        neighborhood: "North Decatur",
        city: "Atlanta",
        venue_type: "pharmacy",
        image_url: null,
        website: "https://www.cvs.com/store-locator",
        price_level: 2,
        distance_miles: 1.7,
        is_open_now: true,
        open_late: true,
        status_label: "Open now · closes 10pm",
        relevance_score: 124,
        relevance_reason: "high utility",
      },
      {
        id: -302,
        name: "Kroger (Ponce De Leon)",
        slug: null,
        address: "725 Ponce De Leon Ave NE, Atlanta, GA 30306",
        neighborhood: "Poncey-Highland",
        city: "Atlanta",
        venue_type: "market",
        image_url: null,
        website: "https://www.kroger.com/",
        price_level: 2,
        distance_miles: 2.3,
        is_open_now: false,
        open_late: true,
        status_label: "Open late",
        relevance_score: 103,
        relevance_reason: "high utility",
      },
    ],
  };
}

function formatStorySchedule(story: EmoryCommunityStory): string {
  const date = formatSmartDate(story.startDate);
  if (story.isAllDay) return `${date.label} · All Day`;
  return `${date.label} · ${formatTime(story.startTime, false)}`;
}

function NearbyVenueCard({
  venue,
  portalSlug,
  hospitalSlug,
  mode,
  sectionKey,
}: {
  venue: HospitalNearbyVenue;
  portalSlug: string;
  hospitalSlug: string;
  mode: HospitalAudienceMode;
  sectionKey: SectionKey;
}) {
  const mapsHref = getVenueMapsHref(venue);

  return (
    <article className="rounded-xl border border-[var(--twilight)] bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--cream)]">{venue.name}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {venue.distance_miles.toFixed(1)} mi away{venue.neighborhood ? ` · ${venue.neighborhood}` : ""}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">{venue.status_label}</p>
        </div>
        <span className="emory-chip">{SECTION_META[sectionKey].tag}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={`emory-chip ${venue.is_open_now ? "!border-[#82d17a] !bg-[#e7f5e5]" : ""}`}>
          {venue.is_open_now ? "Open Now" : "Check Hours"}
        </span>
        {venue.open_late && <span className="emory-chip !border-[#f0b0aa] !bg-[#fdf0ef]">Open Late</span>}
        {venue.price_level !== null && venue.price_level <= 2 && <span className="emory-chip">Lower Cost</span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <HospitalTrackedLink
          href={mapsHref}
          external
          tracking={{
            actionType: "resource_clicked",
            portalSlug,
            hospitalSlug,
            modeContext: mode,
            sectionKey: `v2_${sectionKey}`,
            targetKind: `${sectionKey}_maps`,
            targetId: String(venue.id),
            targetLabel: venue.name,
            targetUrl: mapsHref,
          }}
          className="emory-secondary-btn inline-flex items-center px-2.5 py-1 text-xs"
        >
          Open in Maps
        </HospitalTrackedLink>

        {venue.website && (
          <HospitalTrackedLink
            href={venue.website}
            external
            tracking={{
              actionType: "resource_clicked",
              portalSlug,
              hospitalSlug,
              modeContext: mode,
              sectionKey: `v2_${sectionKey}`,
              targetKind: `${sectionKey}_website`,
              targetId: String(venue.id),
              targetLabel: venue.name,
              targetUrl: venue.website,
            }}
            className="emory-secondary-btn inline-flex items-center px-2.5 py-1 text-xs"
          >
            Website
          </HospitalTrackedLink>
        )}
      </div>
    </article>
  );
}

export default async function HospitalLandingPage({ params, searchParams }: Props) {
  const { portal: portalSlug, hospital: hospitalSlug } = await params;
  const searchParamsData = await searchParams;

  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();
  const isEmoryBrand = isEmoryDemoPortal(portal.slug);
  if (getPortalVertical(portal) !== "hospital" && !isEmoryBrand) notFound();

  const mode = normalizeHospitalMode(searchParamsData.mode);
  const persona = normalizeEmoryPersona(searchParamsData.persona);
  const personaProfile = getEmoryPersonaProfile(persona);
  const modeConfig = HOSPITAL_MODE_CONFIG[mode];
  const copy = getEmoryCompanionCopy({
    personaProfile,
    mode,
    modeConfig,
  });
  const data = await getHospitalLandingData(portal.id, hospitalSlug, mode);
  if (!data) notFound();

  const bookVisitHref = getHospitalBookVisitHref(data.hospital);
  const wayfindingHref = getHospitalWayfindingHref(data.hospital);

  const nearbyUnique = new Map<number, HospitalNearbyVenue>();
  for (const venue of [...data.nearby.food, ...data.nearby.stay, ...data.nearby.late]) {
    if (!nearbyUnique.has(venue.id)) nearbyUnique.set(venue.id, venue);
  }
  const nearbyList = [...nearbyUnique.values()];
  const openNowCount = nearbyList.filter((venue) => venue.is_open_now).length;

  const railActions: EmoryActionRailAction[] = [
    {
      key: "book-visit",
      label: personaProfile.primaryActionLabel,
      href: bookVisitHref,
      external: /^https?:\/\//i.test(bookVisitHref),
      actionType: "resource_clicked",
      targetKind: "book_visit",
      targetId: data.hospital.slug,
      targetLabel: data.hospital.short_name || data.hospital.name,
    },
    {
      key: "get-directions",
      label: personaProfile.secondaryActionLabel,
      href: wayfindingHref,
      external: true,
      actionType: "wayfinding_opened",
      targetKind: "wayfinding",
      targetId: data.hospital.slug,
      targetLabel: data.hospital.short_name || data.hospital.name,
    },
    {
      key: "view-services",
      label: personaProfile.tertiaryActionLabel,
      href: `/${portal.slug}/hospitals/${data.hospital.slug}?mode=${mode}&persona=${persona}#services`,
      actionType: "resource_clicked",
      targetKind: "hospital_services",
      targetId: data.hospital.slug,
      targetLabel: data.hospital.short_name || data.hospital.name,
    },
  ];

  const communityDigest = await getEmoryCommunityDigest({
    portalSlug: portal.slug,
    mode,
  });
  const fallbackNearby = buildFallbackNearby();
  const fallbackServices = buildFallbackServices(data.hospital.short_name || data.hospital.name);

  const sectionData: Record<SectionKey, HospitalNearbyVenue[] | HospitalService[]> = {
    services: data.services.length > 0 ? data.services : fallbackServices,
    food: data.nearby.food.length > 0 ? data.nearby.food : fallbackNearby.food,
    stay: data.nearby.stay.length > 0 ? data.nearby.stay : fallbackNearby.stay,
    late: data.nearby.late.length > 0 ? data.nearby.late : fallbackNearby.late,
  };
  const heroPhoto =
    HOSPITAL_HERO_PHOTO_BY_SLUG[data.hospital.slug] || {
      image: "https://images.unsplash.com/photo-1666214280391-8ff5bd3c0bf0?auto=format&fit=crop&w=2200&q=80",
      position: "center 40%",
    };

  return (
    <div className={`min-h-screen ${isEmoryBrand ? "bg-[#f2f5fa] text-[#002f6c]" : ""}`}>
      {isEmoryBrand && (
        <style>{`
          body::before { opacity: 0 !important; }
          body::after { opacity: 0 !important; }
          .ambient-glow { opacity: 0 !important; }
          .rain-overlay { display: none !important; }
        `}</style>
      )}
      {!isEmoryBrand && <AmbientBackground />}
      {isEmoryBrand ? <EmoryDemoHeader portalSlug={portal.slug} /> : <PortalHeader portalSlug={portal.slug} portalName={portal.name} />}

      <main className="max-w-6xl mx-auto px-4 pb-20">
        <style>{`
          @keyframes companionReveal {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .companion-reveal { opacity: 1; animation: companionReveal 460ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards; }
          .companion-delay-1 { animation-delay: 80ms; }
          .companion-delay-2 { animation-delay: 140ms; }
          ${EMORY_THEME_CSS}
        `}</style>

        <div className={`${hospitalBodyFont.className} ${isEmoryBrand ? EMORY_THEME_SCOPE_CLASS : ""} py-8 space-y-7`}>
          <div className="companion-reveal flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <Link href={`/${portal.slug}?mode=${mode}&persona=${persona}`} className="hover:text-[var(--cream)]">{portal.name}</Link>
            <span>/</span>
            <Link href={`/${portal.slug}/hospitals?mode=${mode}&persona=${persona}`} className="hover:text-[var(--cream)]">Hospital Directory</Link>
            <span>/</span>
            <span className="text-[var(--cream)]">{data.hospital.short_name || data.hospital.name}</span>
          </div>

          <section
            className="companion-reveal emory-photo-hero rounded-[30px] p-6 sm:p-7"
            style={{
              ["--hero-image" as string]: `url('${heroPhoto.image}')`,
              ["--hero-position" as string]: heroPhoto.position,
            }}
          >
            <div className="relative z-[1] grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
              <div>
                <p className="emory-kicker">{copy.heroKicker}</p>
                <h1 className={`emory-hero-title mt-3 font-serif text-[clamp(2.1rem,4.2vw,3.45rem)] leading-[0.99] tracking-[-0.018em] ${hospitalDisplayFont.className}`}>
                  {data.hospital.name}
                </h1>
                <p className="emory-hero-lede mt-2 text-base">{data.hospital.address}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {HOSPITAL_MODE_LIST.map((candidateMode) => {
                    const active = candidateMode.key === mode;
                    return (
                      <HospitalTrackedLink
                        key={candidateMode.key}
                        href={`/${portal.slug}/hospitals/${data.hospital.slug}?mode=${candidateMode.key}&persona=${persona}`}
                        tracking={{
                          actionType: "mode_selected",
                          portalSlug: portal.slug,
                          hospitalSlug: data.hospital.slug,
                          modeContext: candidateMode.key,
                          sectionKey: "v2_companion_modes",
                          targetKind: "mode",
                          targetId: candidateMode.key,
                          targetLabel: candidateMode.label,
                        }}
                        className={active ? "emory-primary-btn inline-flex items-center px-3 py-1.5 text-xs" : "emory-secondary-btn inline-flex items-center px-3 py-1.5 text-xs"}
                      >
                        {candidateMode.shortLabel}
                      </HospitalTrackedLink>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <HospitalTrackedLink
                    href={bookVisitHref}
                    external={/^https?:\/\//i.test(bookVisitHref)}
                    tracking={{
                      actionType: "resource_clicked",
                      portalSlug: portal.slug,
                      hospitalSlug: data.hospital.slug,
                      modeContext: mode,
                      sectionKey: "v2_companion_header",
                      targetKind: "book_visit",
                      targetId: data.hospital.slug,
                      targetLabel: data.hospital.short_name || data.hospital.name,
                    }}
                    className="emory-primary-btn inline-flex items-center px-3 py-1.5 text-xs"
                  >
                    {personaProfile.primaryActionLabel}
                  </HospitalTrackedLink>

                  <HospitalTrackedLink
                    href={wayfindingHref}
                    external
                    tracking={{
                      actionType: "wayfinding_opened",
                      portalSlug: portal.slug,
                      hospitalSlug: data.hospital.slug,
                      modeContext: mode,
                      sectionKey: "v2_companion_header",
                      targetKind: "wayfinding",
                      targetId: data.hospital.slug,
                      targetLabel: data.hospital.short_name || data.hospital.name,
                    }}
                    className="emory-secondary-btn inline-flex items-center px-3 py-1.5 text-xs"
                  >
                    {personaProfile.secondaryActionLabel}
                  </HospitalTrackedLink>

                  <HospitalTrackedLink
                    href={`/${portal.slug}/hospitals/${data.hospital.slug}?mode=${mode}&persona=${persona}#services`}
                    tracking={{
                      actionType: "resource_clicked",
                      portalSlug: portal.slug,
                      hospitalSlug: data.hospital.slug,
                      modeContext: mode,
                      sectionKey: "v2_companion_header",
                      targetKind: "hospital_services",
                      targetId: data.hospital.slug,
                      targetLabel: data.hospital.short_name || data.hospital.name,
                    }}
                    className="emory-secondary-btn inline-flex items-center px-3 py-1.5 text-xs"
                  >
                    {personaProfile.tertiaryActionLabel}
                  </HospitalTrackedLink>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="emory-hero-chip">{modeConfig.label}</span>
                  <span className="emory-hero-chip">{personaProfile.shortLabel}</span>
                  <span className="emory-hero-chip">{copy.scopeChip}</span>
                </div>
              </div>

              <aside className="emory-hero-lens rounded-2xl p-5">
                <p className="emory-kicker">{copy.focusKicker}</p>
                <h2 className="mt-2 text-base font-semibold text-[var(--cream)]">{personaProfile.focusTitle}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">{copy.modeNarrative}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[#b5ddaf] bg-[#e7f5e5] p-3">
                    <p className="emory-kicker">Services</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--cream)]">{data.services.length}</p>
                  </div>
                  <div className="rounded-lg border border-[#b5ddaf] bg-[#e7f5e5] p-3">
                    <p className="emory-kicker">Nearby</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--cream)]">{nearbyList.length}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--twilight)] bg-white p-3">
                    <p className="emory-kicker">Open Now</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--cream)]">{openNowCount}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--twilight)] bg-white p-3">
                    <p className="emory-kicker">Attribution</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--cream)]">Strict</p>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <div className="companion-reveal companion-delay-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {modeConfig.sectionOrder.map((sectionKey) => {
              const key = sectionKey as SectionKey;
              const meta = SECTION_META[key];
              const entries = sectionData[key];

              return (
                <section key={key} id={key} className="emory-panel rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--cream)]">{meta.title}</h2>
                      <p className="mt-1 text-xs text-[var(--muted)]">{meta.subtitle}</p>
                    </div>
                    <span className="emory-chip">{meta.tag}</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {key === "services" ? (
                        (entries as HospitalService[]).map((service) => (
                          <article key={service.id} className="rounded-xl border border-[var(--twilight)] bg-white p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-[var(--cream)]">{service.name}</p>
                                <p className="mt-1 text-xs text-[var(--muted)]">{service.description || "Service details available from Emory operations metadata."}</p>
                                {(service.open_hours || service.location_hint) && (
                                  <p className="mt-1 text-[11px] text-[var(--muted)]">{[service.open_hours, service.location_hint].filter(Boolean).join(" · ")}</p>
                                )}
                              </div>
                              <span className="emory-chip">{service.category}</span>
                            </div>

                            {service.cta_url && (
                              <HospitalTrackedLink
                                href={service.cta_url}
                                external
                                tracking={{
                                  actionType: "resource_clicked",
                                  portalSlug: portal.slug,
                                  hospitalSlug: data.hospital.slug,
                                  modeContext: mode,
                                  sectionKey: "v2_services",
                                  targetKind: "service_cta",
                                  targetId: service.id,
                                  targetLabel: service.name,
                                  targetUrl: service.cta_url,
                                }}
                                className="emory-secondary-btn mt-2 inline-flex items-center px-2.5 py-1 text-xs"
                              >
                                {service.cta_label || "Learn More"}
                              </HospitalTrackedLink>
                            )}
                          </article>
                        ))
                    ) : (
                      (entries as HospitalNearbyVenue[]).map((venue) => (
                        <NearbyVenueCard
                          key={`${key}-${venue.id}`}
                          venue={venue}
                          portalSlug={portal.slug}
                          hospitalSlug={data.hospital.slug}
                          mode={mode}
                          sectionKey={key}
                        />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <section className="companion-reveal companion-delay-2 emory-panel rounded-2xl p-5" id="community-layer">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className={`text-[clamp(1.2rem,2.5vw,1.9rem)] font-semibold text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                  {copy.communityTitle}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)] max-w-3xl">
                  {copy.communitySummary}
                </p>
              </div>
              <span className="emory-chip">
                {communityDigest.storyCount > 0
                  ? `${communityDigest.storyCount} live briefings`
                  : "Briefings syncing"}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {communityDigest.tracks.map((track) => {
                return (
                  <article key={track.key} className="emory-panel-subtle rounded-xl p-4">
                    <p className="emory-kicker">{track.title}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{track.blurb}</p>
                    <div className="mt-3 space-y-2">
                      {track.stories.slice(0, 2).map((story) => {
                        const openHref = story.eventId
                          ? `/${portal.slug}?view=find&type=events&event=${story.eventId}&mode=${mode}&persona=${persona}`
                          : `/${portal.slug}?view=find&type=events&search=${encodeURIComponent(story.title)}&mode=${mode}&persona=${persona}`;

                        return (
                          <article key={story.id} className="rounded-lg border border-[var(--twilight)] bg-white p-3">
                            <p className="text-sm font-semibold text-[var(--cream)] leading-tight">{story.title}</p>
                            <p className="mt-1 text-[11px] text-[var(--muted)]">
                              {formatStorySchedule(story)}
                              {story.neighborhood ? ` · ${story.neighborhood}` : ""}
                            </p>
                            <p className="mt-1 text-[11px] text-[var(--muted)]">
                              Source: {story.sourceName}
                              {story.sourceTier ? ` · ${story.sourceTier}` : ""}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <HospitalTrackedLink
                                href={openHref}
                                tracking={{
                                  actionType: "resource_clicked",
                                  portalSlug: portal.slug,
                                  hospitalSlug: data.hospital.slug,
                                  modeContext: mode,
                                  sectionKey: "v2_community",
                                  targetKind: "community_story",
                                  targetId: story.id,
                                  targetLabel: story.title,
                                  targetUrl: openHref,
                                }}
                                className="emory-primary-btn inline-flex items-center px-3 py-1.5 text-xs"
                              >
                                View Briefing
                              </HospitalTrackedLink>
                              {story.sourceUrl !== "#" && (
                                <HospitalTrackedLink
                                  href={story.sourceUrl}
                                  external
                                  tracking={{
                                    actionType: "resource_clicked",
                                    portalSlug: portal.slug,
                                    hospitalSlug: data.hospital.slug,
                                    modeContext: mode,
                                    sectionKey: "v2_community",
                                    targetKind: "community_source",
                                    targetId: story.id,
                                    targetLabel: story.sourceName,
                                    targetUrl: story.sourceUrl,
                                  }}
                                  className="emory-secondary-btn inline-flex items-center px-3 py-1.5 text-xs"
                                >
                                  Source
                                </HospitalTrackedLink>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    {track.sourceNames.length > 0 && (
                      <p className="mt-3 text-[11px] text-[var(--muted)]">Sources: {track.sourceNames.join(" · ")}</p>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <article className="rounded-xl border border-[var(--twilight)] bg-white p-3">
                <p className="text-sm font-semibold text-[var(--cream)]">{copy.attributionTitle}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {copy.attributionBody} {EMORY_COMPETITOR_EXCLUSIONS.join(", ")} references are excluded.
                </p>
              </article>
              <article className="rounded-xl border border-[var(--twilight)] bg-white p-3">
                <p className="text-sm font-semibold text-[var(--cream)]">{copy.scopeTitle}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{copy.scopeBody}</p>
              </article>
              <article className="rounded-xl border border-[var(--twilight)] bg-white p-3">
                <p className="text-sm font-semibold text-[var(--cream)]">{copy.federationTitle}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {communityDigest.isLive
                    ? copy.federationLiveBody
                    : copy.federationSyncingBody}
                </p>
              </article>
            </div>
          </section>

          <EmoryActionRail
            portalSlug={portal.slug}
            mode={mode}
            hospitalSlug={data.hospital.slug}
            sectionKey="v2_companion_action_rail"
            actions={railActions}
          />
        </div>
      </main>
    </div>
  );
}
