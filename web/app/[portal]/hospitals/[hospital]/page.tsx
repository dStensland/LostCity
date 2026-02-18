/* eslint-disable @next/next/no-img-element */
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
import {
  EMORY_THEME_CSS,
  EMORY_THEME_SCOPE_CLASS,
  hospitalBodyFont,
  hospitalDisplayFont,
  isEmoryDemoPortal,
  getEventFallbackImage,
} from "@/lib/hospital-art";
import HospitalTrackedLink from "@/app/[portal]/_components/hospital/HospitalTrackedLink";
import type { CSSProperties } from "react";
import {
  getEmoryFederationShowcase,
  type EmoryFederationEventPreview,
} from "@/lib/emory-federation-showcase";
import EmoryConciergeFoodExplorer, {
  type ConciergeExplorerItem,
} from "@/app/[portal]/_components/hospital/EmoryConciergeFoodExplorer";
import { getDistanceMiles } from "@/lib/geo";
import EmoryMobileBottomNav from "@/app/[portal]/_components/hospital/EmoryMobileBottomNav";
import { Suspense } from "react";

type Props = {
  params: Promise<{ portal: string; hospital: string }>;
  searchParams: Promise<{ mode?: string; persona?: string }>;
};

type NearbyEventCard = {
  id: string;
  title: string;
  schedule: string;
  subtitle: string;
  imageUrl: string | null;
  detailHref: string;
  mapsHref: string | null;
  distanceMiles: number | null;
};

type NearbyBucket = "food" | "stay" | "late" | "essentials" | "services" | "fitness" | "escapes";

const DEFAULT_HERO_IMAGE = "https://images.pexels.com/photos/263402/pexels-photo-263402.jpeg?auto=compress&cs=tinysrgb&w=1600";

const HOSPITAL_HERO_IMAGE_BY_SLUG: Record<string, string> = {
  "emory-university-hospital": "https://images.pexels.com/photos/263402/pexels-photo-263402.jpeg?auto=compress&cs=tinysrgb&w=1600",
  "emory-university-hospital-midtown": "https://images.pexels.com/photos/2383010/pexels-photo-2383010.jpeg?auto=compress&cs=tinysrgb&w=1600",
  "emory-saint-josephs-hospital": "https://images.pexels.com/photos/17057065/pexels-photo-17057065.jpeg?auto=compress&cs=tinysrgb&w=1600",
  "emory-johns-creek-hospital": "https://images.pexels.com/photos/7722603/pexels-photo-7722603.jpeg?auto=compress&cs=tinysrgb&w=1600",
};

const HOSPITAL_EVENT_POSITIVE = /\b(health|wellness|caregiver|support|family|nutrition|meal prep|food pantry|screening|clinic|public health|pharmacy|fitness|walk|yoga|movement|mental|mindful|recovery|education|workshop|class|volunteer)\b/i;
const HOSPITAL_EVENT_NEGATIVE = /\b(concert|dj|nightlife|party|happy hour|bar crawl|club|cocktail|beer|wine|comedy|dating|festival afterparty)\b/i;

function normalize(value: string | null | undefined): string {
  return (value || "").toLowerCase();
}

function getHospitalHeroImage(hospitalSlug: string): string {
  return HOSPITAL_HERO_IMAGE_BY_SLUG[hospitalSlug] || DEFAULT_HERO_IMAGE;
}

function buildFallbackCampusResources(hospitalName: string): HospitalService[] {
  const short = hospitalName.split(" ").slice(0, 2).join(" ");
  return [
    {
      id: "fallback-resource-main-cafe",
      hospital_location_id: "fallback",
      category: "Dining",
      name: "Main Concourse Cafe",
      description: "Quick meals and coffee options near the main entrance.",
      open_hours: "Daily 6:30 AM-8:00 PM",
      location_hint: "Main concourse",
      cta_label: null,
      cta_url: null,
      display_order: 1,
    },
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
    {
      id: "fallback-resource-quiet-room",
      hospital_location_id: "fallback",
      category: "Support",
      name: "Quiet Family Lounge",
      description: "A quiet waiting area for caregivers and families.",
      open_hours: "Hours vary",
      location_hint: "Near north tower elevators",
      cta_label: null,
      cta_url: null,
      display_order: 4,
    },
  ];
}

const IRRELEVANT_VENUE_PATTERN = /\b(home depot|lowe's|autozone|auto ?parts|o'reilly|advance auto|car wash|self storage|storage unit|gas station|shell|chevron|bp|exxon|racetrac|qt|quicktrip|tire|muffler|jiffy lube|u-haul)\b/i;

function isIrrelevantVenue(venue: Pick<HospitalNearbyVenue, "venue_type" | "name">): boolean {
  return IRRELEVANT_VENUE_PATTERN.test(normalize(venue.name));
}

function isMealExcluded(venue: Pick<HospitalNearbyVenue, "venue_type" | "name">): boolean {
  const type = normalize(venue.venue_type);
  const name = normalize(venue.name);
  if (type === "bar" || type === "nightclub") return true;
  return /\b(bar|night ?club|cocktail|taproom|speakeasy|pub)\b/.test(name);
}

function classifyConciergeCategory(args: {
  bucket?: NearbyBucket;
  venueType: string | null;
  name: string;
  searchBlob?: string;
}): ConciergeExplorerItem["category"] {
  const venueType = normalize(args.venueType);
  const blob = `${venueType} ${normalize(args.name)} ${normalize(args.searchBlob)}`;

  if (args.bucket === "stay") return "lodging";
  if (args.bucket === "food") return "food";
  if (args.bucket === "essentials") return "essentials";
  if (args.bucket === "late") {
    if (/\b(pharmacy|drug|market|grocery|urgent care|clinic)\b/.test(blob)) return "essentials";
    return "food";
  }
  if (args.bucket === "services") return "services";
  if (args.bucket === "fitness") return "fitness";
  if (args.bucket === "escapes") return "escapes";

  if (/\b(gym|fitness|yoga|pilates|spin|crossfit|workout|athletic|rec center|ymca|training|strength)\b/.test(blob)) return "fitness";
  if (/\b(park|museum|garden|trail|greenway|library|cinema|theater|gallery|aquarium|botanical|quiet)\b/.test(blob)) return "escapes";
  if (/\b(hotel|motel|inn|suite|suites|lodge|residence)\b/.test(blob)) return "lodging";
  if (/\b(pharmacy|drug|market|grocery|convenience|supply|urgent care|clinic)\b/.test(blob)) return "essentials";
  if (/\b(restaurant|coffee|cafe|bakery|kitchen|deli|food|eatery|grill|pizza|breakfast|lunch|dinner)\b/.test(blob)) return "food";

  return "services";
}

function buildConciergeExplorerItems(args: {
  food: HospitalNearbyVenue[];
  stay: HospitalNearbyVenue[];
  late: HospitalNearbyVenue[];
  essentials: HospitalNearbyVenue[];
  services: HospitalNearbyVenue[];
  fitness: HospitalNearbyVenue[];
  escapes: HospitalNearbyVenue[];
}): ConciergeExplorerItem[] {
  const byId = new Map<string, ConciergeExplorerItem>();

  const ingestNearby = (bucket: NearbyBucket, rows: HospitalNearbyVenue[]) => {
    for (const row of rows) {
      if (isIrrelevantVenue(row)) continue;
      if (bucket === "food" && isMealExcluded(row)) continue;

      const key = String(row.id);
      const existing = byId.get(key);
      const searchBlob = [row.relevance_reason, row.status_label, row.venue_type, row.neighborhood]
        .filter(Boolean)
        .join(" ");

      if (existing) {
        existing.searchBlob = `${existing.searchBlob} ${searchBlob}`.trim();
        existing.isOpenNow = existing.isOpenNow || row.is_open_now;
        existing.openLate = existing.openLate || row.open_late;
        if (row.distance_miles < existing.distanceMiles) {
          existing.distanceMiles = row.distance_miles;
          existing.summary = row.status_label || existing.summary;
        }
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
        searchBlob,
        category: classifyConciergeCategory({
          bucket,
          venueType: row.venue_type,
          name: row.name,
          searchBlob,
        }),
      });
    }
  };

  ingestNearby("food", args.food);
  ingestNearby("stay", args.stay);
  ingestNearby("late", args.late);
  ingestNearby("essentials", args.essentials);
  ingestNearby("services", args.services);
  ingestNearby("fitness", args.fitness);
  ingestNearby("escapes", args.escapes);

  return [...byId.values()];
}

function getEventTimestamp(event: EmoryFederationEventPreview): number {
  const iso = event.startTime ? `${event.startDate}T${event.startTime}` : `${event.startDate}T12:00:00`;
  const timestamp = Date.parse(iso);
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function buildNearbyEventCards(args: {
  events: EmoryFederationEventPreview[];
  hospitalLat: number;
  hospitalLng: number;
}): NearbyEventCard[] {
  const cards = args.events
    .map((event) => {
      if (!event.detailHref.includes("event=")) {
        return null;
      }

      const contentBlob = [
        event.title,
        event.category,
        event.venueName,
        event.neighborhood,
      ].filter(Boolean).join(" ");

      if (!HOSPITAL_EVENT_POSITIVE.test(contentBlob) || HOSPITAL_EVENT_NEGATIVE.test(contentBlob)) {
        return null;
      }

      const distanceMiles = (event.lat !== null && event.lng !== null)
        ? getDistanceMiles(args.hospitalLat, args.hospitalLng, event.lat, event.lng)
        : null;

      if (distanceMiles !== null && distanceMiles > 2.2) {
        return null;
      }

      const subtitleParts = [
        event.venueName,
        event.neighborhood,
        distanceMiles !== null ? `${distanceMiles.toFixed(1)} mi` : null,
      ].filter(Boolean);

      return {
        id: String(event.id),
        title: event.title,
        schedule: event.scheduleLabel,
        subtitle: subtitleParts.join(" · ") || "Nearby",
        imageUrl: event.imageUrl || null,
        detailHref: event.detailHref,
        mapsHref: event.mapsHref || null,
        distanceMiles,
      } satisfies NearbyEventCard;
    })
    .filter((card): card is NearbyEventCard => card !== null)
    .sort((a, b) => {
      const aEvent = args.events.find((event) => String(event.id) === a.id);
      const bEvent = args.events.find((event) => String(event.id) === b.id);
      const timeDelta = (aEvent ? getEventTimestamp(aEvent) : Number.MAX_SAFE_INTEGER)
        - (bEvent ? getEventTimestamp(bEvent) : Number.MAX_SAFE_INTEGER);
      if (timeDelta !== 0) return timeDelta;
      return (a.distanceMiles ?? Number.MAX_SAFE_INTEGER) - (b.distanceMiles ?? Number.MAX_SAFE_INTEGER);
    });

  return cards.slice(0, 4);
}

export default async function HospitalLandingPage({ params, searchParams }: Props) {
  const { portal: portalSlug, hospital: hospitalSlug } = await params;
  const searchParamsData = await searchParams;

  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();
  const isEmoryBrand = isEmoryDemoPortal(portal.slug);
  if (getPortalVertical(portal) !== "hospital" && !isEmoryBrand) notFound();

  const mode = normalizeHospitalMode(searchParamsData.mode);
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
    services: data.nearby.services || [],
    fitness: data.nearby.fitness || [],
    escapes: data.nearby.escapes || [],
  });

  const nearbyEventCards = buildNearbyEventCards({
    events: showcase.events,
    hospitalLat: data.hospital.lat,
    hospitalLng: data.hospital.lng,
  });

  const wayfindingHref = getHospitalWayfindingHref(data.hospital);
  const bookVisitHref = getHospitalBookVisitHref(data.hospital);
  const hospitalDirectoryHref = `/${portal.slug}/hospitals`;
  const communityHubHref = `/${portal.slug}/community-hub`;
  const hospitalHeroImage = getHospitalHeroImage(data.hospital.slug);

  const campusResources = (data.services.length > 0
    ? data.services.slice(0, 6)
    : buildFallbackCampusResources(data.hospital.name));

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
            <div className="grid grid-cols-1 lg:grid-cols-[1.08fr_0.92fr] gap-4 items-stretch">
              <div>
                <p className="emory-kicker">Your campus</p>
                <h1 className={`mt-1 text-[clamp(2.4rem,4.2vw,3.4rem)] leading-[0.94] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                  {data.hospital.name}
                </h1>
                <p className="mt-1 text-sm text-[var(--muted)]">{data.hospital.address}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <HospitalTrackedLink
                    href={wayfindingHref}
                    external
                    tracking={{
                      actionType: "wayfinding_opened",
                      portalSlug: portal.slug,
                      hospitalSlug: data.hospital.slug,
                      modeContext: mode,
                      sectionKey: "v8_hospital_hero",
                      targetKind: "wayfinding",
                      targetId: data.hospital.slug,
                      targetLabel: "Wayfinding",
                      targetUrl: wayfindingHref,
                    }}
                    className="emory-primary-btn inline-flex items-center"
                  >
                    Wayfinding
                  </HospitalTrackedLink>

                  {data.hospital.phone && (
                    <HospitalTrackedLink
                      href={`tel:${data.hospital.phone}`}
                      tracking={{
                        actionType: "resource_clicked",
                        portalSlug: portal.slug,
                        hospitalSlug: data.hospital.slug,
                        modeContext: mode,
                        sectionKey: "v8_hospital_hero",
                        targetKind: "phone_call",
                        targetId: data.hospital.slug,
                        targetLabel: "Call main desk",
                        targetUrl: `tel:${data.hospital.phone}`,
                      }}
                      className="emory-secondary-btn inline-flex items-center"
                    >
                      Call main desk
                    </HospitalTrackedLink>
                  )}

                  <HospitalTrackedLink
                    href={bookVisitHref}
                    external={/^https?:\/\//i.test(bookVisitHref)}
                    tracking={{
                      actionType: "resource_clicked",
                      portalSlug: portal.slug,
                      hospitalSlug: data.hospital.slug,
                      modeContext: mode,
                      sectionKey: "v8_hospital_hero",
                      targetKind: "care_action",
                      targetId: "manage-care",
                      targetLabel: "Manage care",
                      targetUrl: bookVisitHref,
                    }}
                    className="emory-secondary-btn inline-flex items-center"
                  >
                    Manage care
                  </HospitalTrackedLink>

                  <HospitalTrackedLink
                    href={hospitalDirectoryHref}
                    tracking={{
                      actionType: "resource_clicked",
                      portalSlug: portal.slug,
                      hospitalSlug: data.hospital.slug,
                      modeContext: mode,
                      sectionKey: "v8_hospital_hero",
                      targetKind: "hospital_directory",
                      targetId: "switch-hospital",
                      targetLabel: "Switch hospital",
                      targetUrl: hospitalDirectoryHref,
                    }}
                    className="emory-secondary-btn inline-flex items-center"
                  >
                    Switch hospital
                  </HospitalTrackedLink>
                </div>

                <div className="mt-4 rounded-lg border border-[var(--twilight)] bg-[#f8fafe] p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#6b7280]">Choose campus</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hospitalLocations.map((hospital) => {
                      const isActive = hospital.slug === data.hospital.slug;
                      const href = `/${portal.slug}/hospitals/${hospital.slug}`;
                      return (
                        <HospitalTrackedLink
                          key={hospital.id}
                          href={href}
                          tracking={{
                            actionType: "resource_clicked",
                            portalSlug: portal.slug,
                            hospitalSlug: hospital.slug,
                            modeContext: mode,
                            sectionKey: "v8_hospital_switch",
                            targetKind: "hospital_switch",
                            targetId: hospital.slug,
                            targetLabel: hospital.name,
                            targetUrl: href,
                          }}
                          className={isActive
                            ? "inline-flex items-center rounded-md border border-[#7ecf75] bg-[#8ed585] px-2 py-1 text-[11px] font-semibold text-[#0f2f5f]"
                            : "inline-flex items-center rounded-md border border-[#c7d3e8] bg-white px-2 py-1 text-[11px] font-semibold text-[#143b83] hover:bg-[#f3f7ff]"}
                        >
                          {hospital.name}
                        </HospitalTrackedLink>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div
                className="emory-photo-hero min-h-[260px] sm:min-h-[320px]"
                style={{ "--hero-image": `url("${hospitalHeroImage}")` } as CSSProperties}
              >
                <div className="absolute inset-x-2 bottom-2 z-[2] rounded-md bg-[#002f6c]/88 px-2.5 py-2 text-white text-[11px] leading-tight">
                  <div className="flex items-center justify-between gap-2">
                    <strong>{data.hospital.name}</strong>
                    <span className="text-white/90">Care, directions, and nearby support in one place.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {campusResources.map((service) => (
                <article key={service.id} className="rounded-xl border border-[var(--twilight)] bg-gradient-to-b from-white to-[#f9fbfe] px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.06em] text-[#6b7280]">{service.category}</p>
                  <p className="mt-0.5 text-sm font-semibold text-[var(--cream)]">{service.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{service.description || "On-campus support service."}</p>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    {[service.open_hours, service.location_hint].filter(Boolean).join(" · ") || "Check with main desk"}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="emory-panel p-4 sm:p-5" id="concierge-explorer">
            <p className="emory-kicker">What&apos;s nearby</p>
            <h2 className={`mt-1 text-[clamp(1.9rem,3.3vw,2.6rem)] leading-[0.96] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
              Find what you need around campus
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Food, lodging, pharmacies, fitness, and more within a few miles.</p>

            <div className="mt-3">
              <EmoryConciergeFoodExplorer
                portalSlug={portal.slug}
                hospitalSlug={data.hospital.slug}
                mode={mode}
                items={conciergeExplorerItems}
              />
            </div>
          </section>

          <section className="emory-panel p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="emory-kicker">Nearby this week</p>
                <h2 className={`mt-1 text-[clamp(1.7rem,2.9vw,2.3rem)] leading-[0.98] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                  Events and programs near {data.hospital.short_name || data.hospital.name}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Relevant events close to campus for patients, guests, and caregivers.</p>
              </div>
              <HospitalTrackedLink
                href={communityHubHref}
                tracking={{
                  actionType: "resource_clicked",
                  portalSlug: portal.slug,
                  hospitalSlug: data.hospital.slug,
                  modeContext: mode,
                  sectionKey: "v8_hospital_events",
                  targetKind: "community_hub",
                  targetId: "open-community-hub",
                  targetLabel: "Open Community Hub",
                  targetUrl: communityHubHref,
                }}
                className="emory-link-btn"
              >
                Open community hub
              </HospitalTrackedLink>
            </div>

            {nearbyEventCards.length > 0 ? (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {nearbyEventCards.map((eventCard) => (
                  <article key={eventCard.id} className="rounded-lg border border-[var(--twilight)] bg-white overflow-hidden">
                    <img src={eventCard.imageUrl || getEventFallbackImage(null, eventCard.title)} alt={eventCard.title} className="h-32 w-full object-cover" />
                    <div className="p-3">
                      <p className="text-[11px] uppercase tracking-[0.06em] text-[#6b7280]">Event</p>
                      <h3 className="mt-0.5 text-[1rem] leading-[1.08] text-[var(--cream)] font-semibold">{eventCard.title}</h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">{eventCard.schedule}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">{eventCard.subtitle}</p>

                      <div className="mt-2 flex flex-wrap gap-3">
                        <HospitalTrackedLink
                          href={eventCard.detailHref}
                          tracking={{
                            actionType: "resource_clicked",
                            portalSlug: portal.slug,
                            hospitalSlug: data.hospital.slug,
                            modeContext: mode,
                            sectionKey: "v8_hospital_events",
                            targetKind: "event_detail",
                            targetId: eventCard.id,
                            targetLabel: eventCard.title,
                            targetUrl: eventCard.detailHref,
                          }}
                          className="emory-link-btn"
                        >
                          View details
                        </HospitalTrackedLink>

                        {eventCard.mapsHref && (
                          <HospitalTrackedLink
                            href={eventCard.mapsHref}
                            external
                            tracking={{
                              actionType: "resource_clicked",
                              portalSlug: portal.slug,
                              hospitalSlug: data.hospital.slug,
                              modeContext: mode,
                              sectionKey: "v8_hospital_events",
                              targetKind: "event_maps",
                              targetId: eventCard.id,
                              targetLabel: eventCard.title,
                              targetUrl: eventCard.mapsHref,
                            }}
                            className="emory-link-btn"
                          >
                            Directions
                          </HospitalTrackedLink>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-[var(--twilight)] bg-[#f9fbfe] px-3 py-3">
                <p className="text-sm text-[var(--muted)]">No nearby events are currently in range. Open the community hub to browse citywide programs.</p>
              </div>
            )}
          </section>
        </div>
      </main>
      {isEmoryBrand && (
        <>
          <Suspense fallback={null}>
            <EmoryMobileBottomNav portalSlug={portal.slug} />
          </Suspense>
          <div className="lg:hidden h-16" />
        </>
      )}
    </div>
  );
}
