import { notFound } from "next/navigation";
import { AmbientBackground } from "@/components/ambient";
import { EmoryDemoHeader, PortalHeader } from "@/components/headers";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import {
  getHospitalBookVisitHref,
  getHospitalLandingData,
  getPortalHospitalLocations,
  getHospitalWayfindingHref,
  getVenueMapsHref,
  type HospitalNearbyVenue,
  type HospitalService,
} from "@/lib/hospitals";
import { normalizeHospitalMode } from "@/lib/hospital-modes";
import { normalizeEmoryPersona } from "@/lib/emory-personas";
import {
  EMORY_THEME_CSS,
  EMORY_THEME_SCOPE_CLASS,
  hospitalBodyFont,
  hospitalDisplayFont,
  isEmoryDemoPortal,
} from "@/lib/hospital-art";
import HospitalTrackedLink from "@/app/[portal]/_components/hospital/HospitalTrackedLink";
import type { CSSProperties } from "react";
import {
  getEmoryFederationShowcase,
  type EmoryFederationShowcase,
} from "@/lib/emory-federation-showcase";
import EmoryConciergeFoodExplorer, {
  type ConciergeExplorerItem,
} from "@/app/[portal]/_components/hospital/EmoryConciergeFoodExplorer";

type Props = {
  params: Promise<{ portal: string; hospital: string }>;
  searchParams: Promise<{ mode?: string; persona?: string }>;
};

type SpotlightCard = {
  id: string;
  title: string;
  meta: string;
  summary: string;
  imageUrl: string | null;
  href: string;
  targetKind: "venue_maps" | "venue_detail";
};

const HERO_IMAGE = "https://images.unsplash.com/photo-1550831107-1553da8c8464?auto=format&fit=crop&w=1400&q=80";

function normalize(value: string | null | undefined): string {
  return (value || "").toLowerCase();
}

function buildFallbackCampusResources(hospitalName: string): HospitalService[] {
  const short = hospitalName.split(" ").slice(0, 2).join(" ");
  return [
    {
      id: "fallback-resource-pharmacy",
      hospital_location_id: "fallback",
      category: "Pharmacy",
      name: "Outpatient Pharmacy",
      description: `${short} prescription pickup and essential over-the-counter supplies.`,
      open_hours: "Mon-Fri 8:00 AM-7:00 PM",
      location_hint: "Main level near discharge",
      cta_label: null,
      cta_url: null,
      display_order: 1,
    },
    {
      id: "fallback-resource-cafe",
      hospital_location_id: "fallback",
      category: "Dining",
      name: "Main Concourse Cafe",
      description: "Quick meals and coffee options with grab-and-go service.",
      open_hours: "Daily 6:30 AM-8:00 PM",
      location_hint: "Main concourse",
      cta_label: null,
      cta_url: null,
      display_order: 2,
    },
    {
      id: "fallback-resource-parking",
      hospital_location_id: "fallback",
      category: "Parking",
      name: "Visitor Parking Desk",
      description: "Parking validation, gate support, and entry guidance.",
      open_hours: "Daily 6:00 AM-10:00 PM",
      location_hint: "First floor by main entrance",
      cta_label: null,
      cta_url: null,
      display_order: 3,
    },
  ];
}

function isMealExcluded(venue: HospitalNearbyVenue): boolean {
  const type = (venue.venue_type || "").toLowerCase();
  const name = venue.name.toLowerCase();
  if (type === "bar" || type === "nightclub") return true;
  if (/\b(bar|night ?club|cocktail|lounge|taproom|brewpub|speakeasy|happy hour)\b/i.test(name)) {
    return true;
  }
  return false;
}

function classifyConciergeCategory(args: {
  bucket: "food" | "stay" | "late" | "essentials";
  venueType: string | null;
  name: string;
}): ConciergeExplorerItem["category"] {
  const venueType = normalize(args.venueType);
  const name = normalize(args.name);
  const categoryBlob = `${venueType} ${name}`;

  if (/\b(hotel|motel|inn|suite|suites|lodge|residence)\b/.test(categoryBlob)) return "lodging";
  if (/\b(pharmacy|drug|market|grocery|convenience)\b/.test(categoryBlob)) return "essentials";
  if (/\b(restaurant|coffee|cafe|bakery|kitchen|deli|food)\b/.test(categoryBlob)) return "food";

  if (args.bucket === "stay") return "lodging";
  if (args.bucket === "food") return "food";
  if (args.bucket === "essentials") return "essentials";
  return "services";
}

function buildConciergeExplorerItems(args: {
  food: HospitalNearbyVenue[];
  stay: HospitalNearbyVenue[];
  late: HospitalNearbyVenue[];
  essentials: HospitalNearbyVenue[];
}): ConciergeExplorerItem[] {
  const byId = new Map<string, ConciergeExplorerItem>();
  const bucketKeywords: Record<"food" | "stay" | "late" | "essentials", string> = {
    food: "food breakfast lunch dinner coffee cafe healthy meal",
    stay: "stay lodging hotel overnight family",
    late: "late night overnight 24/7 pharmacy essentials",
    essentials: "essentials pharmacy supplies grocery market",
  };

  const ingest = (
    bucket: "food" | "stay" | "late" | "essentials",
    rows: HospitalNearbyVenue[],
  ) => {
    for (const row of rows) {
      if (bucket === "food" && isMealExcluded(row)) continue;
      const key = String(row.id);
      const existing = byId.get(key);
      const addition = [bucketKeywords[bucket], row.relevance_reason, row.status_label]
        .filter(Boolean)
        .join(" ");

      if (existing) {
        existing.searchBlob = `${existing.searchBlob} ${addition}`.trim();
        continue;
      }

      byId.set(key, {
        id: key,
        title: row.name,
        summary: row.status_label || `${row.distance_miles.toFixed(1)} mi from campus`,
        neighborhood: row.neighborhood || null,
        venueType: row.venue_type || null,
        distanceMiles: row.distance_miles,
        isOpenNow: row.is_open_now,
        openLate: row.open_late,
        imageUrl: row.image_url || null,
        mapsHref: getVenueMapsHref(row),
        websiteHref: row.website || null,
        searchBlob: addition,
        category: classifyConciergeCategory({
          bucket,
          venueType: row.venue_type,
          name: row.name,
        }),
      });
    }
  };

  ingest("food", args.food);
  ingest("stay", args.stay);
  ingest("late", args.late);
  ingest("essentials", args.essentials);

  return [...byId.values()];
}

function toSpotlightCards(args: {
  showcase: EmoryFederationShowcase;
  kind: "break" | "fitness";
}): SpotlightCard[] {
  const { showcase, kind } = args;
  const patterns = kind === "break"
    ? /\b(park|museum|garden|trail|quiet|library|walk|mindful|wellness|art)\b/i
    : /\b(gym|fitness|yoga|pilates|studio|ymca|run|workout|movement|strength)\b/i;

  return showcase.venues
    .filter((venue) => patterns.test([venue.name, venue.venueType, venue.neighborhood].filter(Boolean).join(" ")))
    .sort((a, b) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99))
    .slice(0, 3)
    .map((venue) => ({
      id: `venue-${venue.id}`,
      title: venue.name,
      meta: [venue.neighborhood, venue.distanceLabel].filter(Boolean).join(" · ") || "Nearby",
      summary: kind === "break"
        ? "Nearby place for a short reset."
        : "Nearby option for movement and fitness.",
      imageUrl: venue.imageUrl || null,
      href: venue.mapsHref || venue.detailHref,
      targetKind: venue.mapsHref ? "venue_maps" : "venue_detail",
    }));
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
  const hospitalLocations = await getPortalHospitalLocations(portal.id);
  const data = await getHospitalLandingData(portal.id, hospitalSlug, mode);
  if (!data) notFound();
  const showcase = await getEmoryFederationShowcase({
    portalId: portal.id,
    portalSlug: portal.slug,
    hospital: data.hospital,
  });

  const conciergeExplorerItems = buildConciergeExplorerItems({
    food: data.nearby.food || [],
    stay: data.nearby.stay || [],
    late: data.nearby.late || [],
    essentials: data.nearby.essentials || [],
  });
  const directoryHref = `/${portal.slug}/hospitals?mode=${mode}&persona=${persona}`;
  const communityHref = `/${portal.slug}?view=community&mode=${mode}&persona=${persona}`;
  const wayfindingHref = getHospitalWayfindingHref(data.hospital);
  const bookVisitHref = getHospitalBookVisitHref(data.hospital);
  const campusResources = (data.services.length > 0
    ? data.services.slice(0, 6)
    : buildFallbackCampusResources(data.hospital.name));

  const breakCards = toSpotlightCards({ showcase, kind: "break" });
  const fitnessCards = toSpotlightCards({ showcase, kind: "fitness" });
  const openNowCount = conciergeExplorerItems.filter((item) => item.isOpenNow).length;

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
        <style>{EMORY_THEME_CSS}</style>

        <div className={`${hospitalBodyFont.className} ${isEmoryBrand ? EMORY_THEME_SCOPE_CLASS : ""} py-6 space-y-5`}>
          <section className="emory-panel p-4 sm:p-5">
            <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-4">
              <div>
                <p className="emory-kicker">Concierge</p>
                <h1 className={`mt-2 text-[clamp(2.1rem,3.8vw,3.15rem)] leading-[0.94] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                  Explore support around your hospital.
                </h1>
                <p className="mt-3 max-w-[48ch] text-sm sm:text-base text-[var(--muted)]">
                  Campus resources first, then nearby meals, essentials, and reset options by moment.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <HospitalTrackedLink
                    href="#concierge-explorer"
                    tracking={{
                      actionType: "resource_clicked",
                      portalSlug: portal.slug,
                      hospitalSlug: data.hospital.slug,
                      modeContext: mode,
                      sectionKey: "v4_concierge_hero",
                      targetKind: "meals_explorer",
                      targetId: "meals",
                      targetLabel: "Find Meals Nearby",
                    }}
                    className="emory-primary-btn inline-flex items-center px-3 py-1.5 text-xs"
                  >
                    Find Meals Nearby
                  </HospitalTrackedLink>
                  <HospitalTrackedLink
                    href={wayfindingHref}
                    external
                    tracking={{
                      actionType: "wayfinding_opened",
                      portalSlug: portal.slug,
                      hospitalSlug: data.hospital.slug,
                      modeContext: mode,
                      sectionKey: "v5_concierge_hero",
                      targetKind: "wayfinding",
                      targetId: data.hospital.slug,
                      targetLabel: "Open Directions",
                      targetUrl: wayfindingHref,
                    }}
                    className="emory-secondary-btn inline-flex items-center px-3 py-1.5 text-xs"
                  >
                    Open Directions
                  </HospitalTrackedLink>
                  <HospitalTrackedLink
                    href={directoryHref}
                    tracking={{
                      actionType: "resource_clicked",
                      portalSlug: portal.slug,
                      hospitalSlug: data.hospital.slug,
                      modeContext: mode,
                      sectionKey: "v4_concierge_hero",
                      targetKind: "hospital_directory",
                      targetId: "change-campus",
                      targetLabel: "Change Campus",
                      targetUrl: directoryHref,
                    }}
                    className="emory-secondary-btn inline-flex items-center px-3 py-1.5 text-xs"
                  >
                    Change Campus
                  </HospitalTrackedLink>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="emory-chip">{openNowCount} open now</span>
                  <span className="emory-chip">{data.nearby.food.length} food options</span>
                  <span className="emory-chip">{data.nearby.stay.length} stay options</span>
                  <span className="emory-chip">{data.nearby.essentials.length} essentials</span>
                </div>
              </div>

              <div
                className="emory-photo-hero min-h-[240px] sm:min-h-[290px]"
                style={{ "--hero-image": `url("${HERO_IMAGE}")` } as CSSProperties}
              >
                <div className="absolute inset-x-2 bottom-2 z-[2] rounded-md bg-[#002f6c]/88 px-2.5 py-2 text-white text-[11px] leading-tight">
                  <div className="flex items-center justify-between gap-2">
                    <strong>{data.hospital.name}</strong>
                    <span className="text-white/90">Practical support for patients, caregivers, and visitors.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-[var(--twilight)] bg-[#f8fafe] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#6b7280]">Switch hospital</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hospitalLocations.map((hospital) => {
                  const isActive = hospital.slug === data.hospital.slug;
                  const href = `/${portal.slug}/hospitals/${hospital.slug}?mode=${mode}&persona=${persona}`;
                  return (
                    <HospitalTrackedLink
                      key={hospital.id}
                      href={href}
                      tracking={{
                        actionType: "resource_clicked",
                        portalSlug: portal.slug,
                        hospitalSlug: hospital.slug,
                        modeContext: mode,
                        sectionKey: "v6_concierge_switch_hospital",
                        targetKind: "hospital_switch",
                        targetId: hospital.slug,
                        targetLabel: hospital.name,
                        targetUrl: href,
                      }}
                      className={isActive
                        ? "inline-flex items-center rounded-md border border-[#7ecf75] bg-[#8ed585] px-2 py-1 text-[11px] font-semibold text-[#002f6c]"
                        : "inline-flex items-center rounded-md border border-[#c7d3e8] bg-white px-2 py-1 text-[11px] font-semibold text-[#143b83] hover:bg-[#f3f7ff]"}
                    >
                      {hospital.name}
                    </HospitalTrackedLink>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-4">
            <article className="emory-panel p-4 sm:p-5">
              <p className="emory-kicker">Campus overview</p>
              <h2 className={`mt-1 text-[clamp(1.6rem,2.9vw,2.2rem)] leading-[0.98] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                On-campus support and resources
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{data.hospital.address}</p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.hospital.neighborhood && <span className="emory-chip">{data.hospital.neighborhood}</span>}
                {data.hospital.phone && <span className="emory-chip">Main line available</span>}
                {data.hospital.emergency_phone && <span className="emory-chip">Emergency line available</span>}
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {campusResources.map((service) => (
                  <article key={service.id} className="rounded-xl border border-[var(--twilight)] bg-gradient-to-b from-white to-[#f9fbfe] px-3 py-3">
                    <p className="text-sm font-semibold text-[var(--cream)]">{service.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{service.description || "On-campus support service."}</p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      {[service.open_hours, service.location_hint].filter(Boolean).join(" · ") || "Check with main desk"}
                    </p>
                  </article>
                ))}
              </div>
            </article>

            <article className="emory-panel p-4 sm:p-5">
              <p className="emory-kicker">Wayfinding</p>
              <h2 className={`mt-1 text-[clamp(1.4rem,2.4vw,1.85rem)] leading-[0.98] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                Directions, parking, and contact
              </h2>

              <div className="mt-3 space-y-2">
                <article className="rounded-xl border border-[var(--twilight)] bg-gradient-to-b from-white to-[#f9fbfe] px-3 py-3">
                  <p className="text-sm font-semibold text-[var(--cream)]">Campus directions and parking</p>
                  <HospitalTrackedLink
                    href={wayfindingHref}
                    external
                    tracking={{
                      actionType: "wayfinding_opened",
                      portalSlug: portal.slug,
                      hospitalSlug: data.hospital.slug,
                      modeContext: mode,
                      sectionKey: "v4_concierge_wayfinding",
                      targetKind: "wayfinding",
                      targetId: data.hospital.slug,
                      targetLabel: "Open Wayfinding",
                      targetUrl: wayfindingHref,
                    }}
                    className="mt-2 inline-flex items-center rounded-md border border-[#c7d3e8] bg-white px-2 py-1 text-[11px] font-semibold text-[#143b83] hover:bg-[#f3f7ff]"
                  >
                    Open map
                  </HospitalTrackedLink>
                </article>

                <article className="rounded-xl border border-[var(--twilight)] bg-gradient-to-b from-white to-[#f9fbfe] px-3 py-3">
                  <p className="text-sm font-semibold text-[var(--cream)]">Appointments and care actions</p>
                  <HospitalTrackedLink
                    href={bookVisitHref}
                    external={/^https?:\/\//i.test(bookVisitHref)}
                    tracking={{
                      actionType: "resource_clicked",
                      portalSlug: portal.slug,
                      hospitalSlug: data.hospital.slug,
                      modeContext: mode,
                      sectionKey: "v4_concierge_wayfinding",
                      targetKind: "care_action",
                      targetId: "manage-care",
                      targetLabel: "Manage Care",
                      targetUrl: bookVisitHref,
                    }}
                    className="mt-2 inline-flex items-center rounded-md border border-[#c7d3e8] bg-white px-2 py-1 text-[11px] font-semibold text-[#143b83] hover:bg-[#f3f7ff]"
                  >
                    Manage care
                  </HospitalTrackedLink>
                </article>

                {data.hospital.phone && (
                  <article className="rounded-xl border border-[var(--twilight)] bg-gradient-to-b from-white to-[#f9fbfe] px-3 py-3">
                    <p className="text-sm font-semibold text-[var(--cream)]">Need help now?</p>
                    <a href={`tel:${data.hospital.phone}`} className="mt-2 inline-flex items-center rounded-md border border-[#c7d3e8] bg-white px-2 py-1 text-[11px] font-semibold text-[#143b83] hover:bg-[#f3f7ff]">
                      Call main desk
                    </a>
                  </article>
                )}
              </div>
            </article>
          </section>

          <section className="emory-panel p-4 sm:p-5" id="concierge-explorer">
            <p className="emory-kicker">Contextual meals</p>
            <h2 className={`mt-1 text-[clamp(1.7rem,3vw,2.35rem)] leading-[0.96] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
              Find what fits this moment
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Switch by time of day and preference to explore nearby options quickly.</p>
            <div className="mt-3">
              <EmoryConciergeFoodExplorer
                portalSlug={portal.slug}
                hospitalSlug={data.hospital.slug}
                mode={mode}
                items={conciergeExplorerItems}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <article className="emory-panel p-4 sm:p-5">
              <p className="emory-kicker">Need a break</p>
              <h2 className={`mt-1 text-[clamp(1.45rem,2.5vw,1.9rem)] leading-[0.98] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                Nearby reset options
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Parks, museums, and low-effort local breaks close to campus.</p>

              <div className="mt-3 grid grid-cols-1 gap-2.5">
                {breakCards.slice(0, 3).map((card) => (
                  <article key={card.id} className="rounded-lg border border-[var(--twilight)] bg-white overflow-hidden">
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt={card.title} className="h-28 w-full object-cover" />
                    ) : (
                      <div className="flex h-28 w-full items-center justify-center bg-[#eef2f7] px-3 text-center text-xs text-[#6b7280]">
                        No partner photo available
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-sm font-semibold text-[var(--cream)]">{card.title}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">{card.meta}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{card.summary}</p>
                      <HospitalTrackedLink
                        href={card.href}
                        external={card.targetKind === "venue_maps"}
                        tracking={{
                          actionType: "resource_clicked",
                          portalSlug: portal.slug,
                          hospitalSlug: data.hospital.slug,
                          modeContext: mode,
                          sectionKey: "v4_concierge_break",
                          targetKind: card.targetKind,
                          targetId: card.id,
                          targetLabel: card.title,
                          targetUrl: card.href,
                      }}
                        className="mt-2 inline-flex items-center rounded-md border border-[#c7d3e8] bg-white px-2 py-1 text-[11px] font-semibold text-[#143b83] hover:bg-[#f3f7ff]"
                      >
                        {card.targetKind === "venue_maps" ? "Get directions" : "View details"}
                      </HospitalTrackedLink>
                    </div>
                  </article>
                ))}
                {breakCards.length === 0 && (
                  <article className="rounded-lg border border-[var(--twilight)] bg-white px-3 py-2.5">
                    <p className="text-sm text-[var(--muted)]">Explore nearby parks, museums, and events from the community hub.</p>
                    <HospitalTrackedLink href={communityHref} className="emory-link-btn mt-1 inline-flex items-center" tracking={{
                      actionType: "resource_clicked",
                      portalSlug: portal.slug,
                      hospitalSlug: data.hospital.slug,
                      modeContext: mode,
                      sectionKey: "v4_concierge_break",
                      targetKind: "community_hub",
                      targetId: "community-fallback",
                      targetLabel: "Open Community Hub",
                      targetUrl: communityHref,
                    }}>
                      Open community hub
                    </HospitalTrackedLink>
                  </article>
                )}
              </div>
            </article>

            <article className="emory-panel p-4 sm:p-5">
              <p className="emory-kicker">Drop-in fitness</p>
              <h2 className={`mt-1 text-[clamp(1.45rem,2.5vw,1.9rem)] leading-[0.98] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                Find a place to move
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Gyms, studios, and movement options near campus.</p>

              <div className="mt-3 grid grid-cols-1 gap-2.5">
                {fitnessCards.slice(0, 3).map((card) => (
                  <article key={card.id} className="rounded-lg border border-[var(--twilight)] bg-white overflow-hidden">
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt={card.title} className="h-28 w-full object-cover" />
                    ) : (
                      <div className="flex h-28 w-full items-center justify-center bg-[#eef2f7] px-3 text-center text-xs text-[#6b7280]">
                        No partner photo available
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-sm font-semibold text-[var(--cream)]">{card.title}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">{card.meta}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{card.summary}</p>
                      <HospitalTrackedLink
                        href={card.href}
                        external={card.targetKind === "venue_maps"}
                        tracking={{
                          actionType: "resource_clicked",
                          portalSlug: portal.slug,
                          hospitalSlug: data.hospital.slug,
                          modeContext: mode,
                          sectionKey: "v4_concierge_fitness",
                          targetKind: card.targetKind,
                          targetId: card.id,
                          targetLabel: card.title,
                          targetUrl: card.href,
                      }}
                        className="mt-2 inline-flex items-center rounded-md border border-[#c7d3e8] bg-white px-2 py-1 text-[11px] font-semibold text-[#143b83] hover:bg-[#f3f7ff]"
                      >
                        {card.targetKind === "venue_maps" ? "Get directions" : "View details"}
                      </HospitalTrackedLink>
                    </div>
                  </article>
                ))}
                {fitnessCards.length === 0 && (
                  <article className="rounded-lg border border-[var(--twilight)] bg-white px-3 py-2.5">
                    <p className="text-sm text-[var(--muted)]">No fitness highlights yet for this area. Try another campus or open the community hub.</p>
                  </article>
                )}
              </div>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}
