/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import Link from "next/link";
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
import {
  getHospitalProfile,
  getProfileCampusResources,
  getProfileCampusResourcesForStage,
  getProfileNeighborhoodTipsFiltered,
  getStaffBoardItemsForToday,
  buildHospitalHandoffDiff,
  AUDIENCE_LABELS,
  type CampusResource,
  type CampusResourceAudience,
  type VisitStage,
  type StaffBoardItemCategory,
} from "@/lib/emory-hospital-profiles";
import {
  parseCampusOpenHours,
  getCampusResourceOpenStatus,
  isLateNightResource,
  getSeason,
  getDayOfWeekKey,
} from "@/lib/campus-hours-parser";
import { normalizeHospitalMode, HOSPITAL_MODE_LIST } from "@/lib/hospital-modes";
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
import MyHospitalPersister from "@/app/[portal]/_components/hospital/MyHospitalPersister";
import { Suspense } from "react";

type Props = {
  params: Promise<{ portal: string; hospital: string }>;
  searchParams: Promise<{ mode?: string; persona?: string; stage?: string; from?: string }>;
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

const VALID_STAGES: VisitStage[] = ["pre_admission", "inpatient", "discharge"];

const STAFF_BOARD_CATEGORY_COLORS: Record<StaffBoardItemCategory, { bg: string; text: string }> = {
  cme: { bg: "bg-[#dbeafe]", text: "text-[#1e40af]" },
  wellness: { bg: "bg-[#dcfce7]", text: "text-[#166534]" },
  food_special: { bg: "bg-[#fef3c7]", text: "text-[#92400e]" },
  announcement: { bg: "bg-[#ede9fe]", text: "text-[#5b21b6]" },
};

const STAFF_BOARD_CATEGORY_LABELS: Record<StaffBoardItemCategory, string> = {
  cme: "CME",
  wellness: "Wellness",
  food_special: "Food Special",
  announcement: "Announcement",
};

function normalize(value: string | null | undefined): string {
  return (value || "").toLowerCase();
}

function normalizeVisitStage(value: string | null | undefined): VisitStage | null {
  if (!value) return null;
  const cleaned = value.toLowerCase().replace(/[\s-]+/g, "_");
  if (VALID_STAGES.includes(cleaned as VisitStage)) return cleaned as VisitStage;
  return null;
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

function campusResourceToService(resource: CampusResource, index: number): HospitalService {
  return {
    id: resource.id,
    hospital_location_id: "profile",
    category: resource.category,
    name: resource.name,
    description: resource.description,
    open_hours: resource.openHours,
    location_hint: resource.locationHint,
    cta_label: resource.ctaLabel,
    cta_url: resource.ctaUrl,
    display_order: index + 1,
  };
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
  const stage = normalizeVisitStage(searchParamsData.stage);
  const fromSlug = searchParamsData.from || null;
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
  const communityHubHref = `/${portal.slug}/community-hub?hospital=${encodeURIComponent(data.hospital.slug)}`;
  const hospitalHeroImage = getHospitalHeroImage(data.hospital.slug);

  const hospitalProfile = getHospitalProfile(data.hospital.slug);
  const useProfileResources = data.services.length === 0 && hospitalProfile !== null;

  // Get resources — apply stage filtering if stage param is set
  const profileResources = hospitalProfile
    ? (stage
        ? getProfileCampusResourcesForStage(hospitalProfile, mode, stage)
        : getProfileCampusResources(hospitalProfile, mode))
    : [];

  const campusResources = data.services.length > 0
    ? data.services.slice(0, 8)
    : hospitalProfile
      ? profileResources.slice(0, 20).map(campusResourceToService)
      : buildFallbackCampusResources(data.hospital.name);

  // Feature 1: Compute open status for each resource and sort open above closed
  const now = new Date();
  const currentHour = now.getHours();
  const isLateHour = currentHour >= 21 || currentHour < 5;

  const resourceOpenStatuses = new Map<string, ReturnType<typeof getCampusResourceOpenStatus>>();
  if (useProfileResources) {
    for (const resource of profileResources) {
      const parsed = parseCampusOpenHours(resource.openHours);
      resourceOpenStatuses.set(resource.id, getCampusResourceOpenStatus(parsed, now));
    }
  }

  // Feature 6: Neighborhood tips with temporal filtering
  const timeContext: "day" | "night" = isLateHour ? "night" : "day";
  const season = getSeason(now);
  const dayOfWeek = getDayOfWeekKey(now);

  const neighborhoodTips = hospitalProfile
    ? getProfileNeighborhoodTipsFiltered(hospitalProfile, mode, { timeContext, season, dayOfWeek })
    : [];

  // Build event-based tips from upcoming events (Feature 6)
  const threeDaysFromNow = new Date(now);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const eventTips = nearbyEventCards
    .filter((card) => {
      const matchingEvent = showcase.events.find((e) => String(e.id) === card.id);
      if (!matchingEvent) return false;
      const eventDate = new Date(`${matchingEvent.startDate}T12:00:00`);
      return eventDate <= threeDaysFromNow;
    })
    .slice(0, 2)
    .map((card) => `Coming up: ${card.title} — ${card.schedule}`);

  // Feature 4: Hospital handoff
  const handoffDiff = fromSlug ? buildHospitalHandoffDiff(fromSlug, hospitalSlug) : null;

  // Feature 1: Late night resources
  const lateNightProfileResources = useProfileResources
    ? profileResources.filter((r) => {
        const parsed = parseCampusOpenHours(r.openHours);
        return isLateNightResource(parsed);
      })
    : [];
  const showLateNightPanel = (mode === "staff" || mode === "urgent" || isLateHour) && lateNightProfileResources.length > 0;

  // Feature 8: Staff board
  const staffBoardItems = hospitalProfile && mode === "staff"
    ? getStaffBoardItemsForToday(hospitalProfile, now)
    : [];

  // Group profile resources by audience for sectioned rendering
  const audienceGroupedResources = useProfileResources
    ? (["patient", "visitor", "caregiver", "staff"] as CampusResourceAudience[])
        .map((audience) => ({
          audience,
          label: AUDIENCE_LABELS[audience],
          resources: campusResources.filter(
            (s) => profileResources.find((r) => r.id === s.id)?.audience === audience
          ),
        }))
        .filter((group) => group.resources.length > 0)
    : null;

  // Feature 1: Sort open resources above closed within audience groups
  if (audienceGroupedResources) {
    for (const group of audienceGroupedResources) {
      group.resources.sort((a, b) => {
        const aStatus = resourceOpenStatuses.get(a.id);
        const bStatus = resourceOpenStatuses.get(b.id);
        const aOpen = aStatus?.isOpen ? 0 : 1;
        const bOpen = bStatus?.isOpen ? 0 : 1;
        return aOpen - bOpen;
      });
    }
  }

  // Feature 2: Stage hero hint
  const stageHeroHint = stage && hospitalProfile?.stageHeroHints?.[stage]
    ? hospitalProfile.stageHeroHints[stage]
    : null;

  const dischargePageHref = `/${portal.slug}/hospitals/${hospitalSlug}/discharge`;

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

          {/* Feature 4: Hospital Handoff Banner */}
          {handoffDiff && (
            <div className="rounded-xl border-2 border-[#fbbf24] bg-[#fffbeb] px-4 py-3">
              <p className="text-sm font-semibold text-[#92400e]">
                Switching from {handoffDiff.fromName} to {handoffDiff.toName}
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {handoffDiff.differences.map((diff, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[#78350f]">
                    <span className="mt-0.5 shrink-0 text-[10px] text-[#f59e0b]">&bull;</span>
                    <span>{diff}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/${portal.slug}/hospitals/${fromSlug}`}
                className="mt-2 inline-flex text-[11px] font-semibold text-[#92400e] hover:underline"
              >
                Back to {handoffDiff.fromName}
              </Link>
            </div>
          )}

          <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#002f6c] via-[#003a7c] to-[#0b4a9e]">
            {/* Subtle grid overlay */}
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

            <div className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-0 items-stretch">
              <div className="p-5 sm:p-7">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8ed585]">Your Campus</p>
                <h1 className={`mt-2 text-[clamp(1.8rem,3.6vw,2.8rem)] leading-[0.96] text-white ${hospitalDisplayFont.className}`}>
                  {data.hospital.name}
                </h1>
                <p className="mt-1.5 text-sm text-white/70">{data.hospital.address}</p>

                {/* Mode selector */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {HOSPITAL_MODE_LIST.map((modeConfig) => {
                    const isActive = mode === modeConfig.key;
                    const modeHref = `/${portal.slug}/hospitals/${hospitalSlug}?mode=${modeConfig.key}${
                      stage ? `&stage=${stage}` : ""
                    }${fromSlug ? `&from=${encodeURIComponent(fromSlug)}` : ""}`;
                    return (
                      <Link
                        key={modeConfig.key}
                        href={modeHref}
                        className={isActive
                          ? "inline-flex items-center rounded-full border border-[#7ecf75] bg-[#8ed585] px-3.5 py-1.5 text-[11.5px] font-bold text-[#0f2f5f] shadow-sm"
                          : "inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[11.5px] font-semibold text-white/90 hover:bg-white/20 transition-colors"}
                      >
                        {modeConfig.shortLabel}
                      </Link>
                    );
                  })}
                </div>

                {/* Feature 2: Stage hero hint */}
                {stageHeroHint && (
                  <p className="mt-3 text-sm text-white/90 bg-white/10 rounded-lg px-3 py-2 border border-white/15">
                    {stageHeroHint}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
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
                    className="inline-flex items-center rounded-lg border border-[#7ecf75] bg-[#8ed585] px-4 py-2.5 text-[13px] font-bold text-[#002f6c] shadow-md hover:bg-[#7fcf75] transition-colors"
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
                      className="inline-flex items-center rounded-lg border border-white/25 bg-white/10 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/20 transition-colors"
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
                    className="inline-flex items-center rounded-lg border border-white/25 bg-white/10 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/20 transition-colors"
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
                    className="inline-flex items-center rounded-lg border border-white/25 bg-white/10 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/20 transition-colors"
                  >
                    Switch hospital
                  </HospitalTrackedLink>

                  {/* Feature 2: Discharge link */}
                  {stage === "discharge" && (
                    <Link
                      href={dischargePageHref}
                      className="inline-flex items-center rounded-lg border border-[#7ecf75] bg-[#166534] px-4 py-2.5 text-[13px] font-bold text-white shadow-md hover:bg-[#15803d] transition-colors"
                    >
                      View Take-Home Resources
                    </Link>
                  )}
                </div>

                {/* Feature 4: Campus pill strip with handoff context */}
                <div className="mt-5 rounded-lg border border-white/15 bg-white/8 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">Choose campus</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hospitalLocations.map((hospital) => {
                      const isActive = hospital.slug === data.hospital.slug;
                      const switchHref = `/${portal.slug}/hospitals/${hospital.slug}${
                        !isActive ? `?from=${encodeURIComponent(data.hospital.slug)}` : ""
                      }`;
                      return (
                        <HospitalTrackedLink
                          key={hospital.id}
                          href={switchHref}
                          tracking={{
                            actionType: "resource_clicked",
                            portalSlug: portal.slug,
                            hospitalSlug: hospital.slug,
                            modeContext: mode,
                            sectionKey: "v8_hospital_switch",
                            targetKind: "hospital_switch",
                            targetId: hospital.slug,
                            targetLabel: hospital.name,
                            targetUrl: switchHref,
                          }}
                          className={isActive
                            ? "inline-flex items-center rounded-md border border-[#7ecf75] bg-[#8ed585] px-2.5 py-1 text-[11px] font-bold text-[#0f2f5f]"
                            : "inline-flex items-center rounded-md border border-white/20 bg-white/8 px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/15 transition-colors"}
                        >
                          {hospital.name}
                        </HospitalTrackedLink>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Hero photo */}
              <div className="relative hidden lg:block min-h-[380px]">
                <img src={hospitalHeroImage} alt={data.hospital.name} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#002f6c] via-[#002f6c]/40 to-transparent" />
                <div className="absolute inset-x-3 bottom-3 z-[2] rounded-lg bg-[#002f6c]/85 backdrop-blur-sm px-3 py-2.5 text-white text-[11.5px] leading-snug border border-white/10">
                  <strong>{data.hospital.name}</strong>
                  <span className="ml-2 text-white/75">Care, directions, and nearby support in one place.</span>
                </div>
              </div>
            </div>

            {/* Feature 8: Staff Board */}
            {staffBoardItems.length > 0 && (
              <div className="mt-5">
                <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-[#4b6a9b] mb-2.5">Staff Board — Today</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {staffBoardItems.map((item) => {
                    const colors = STAFF_BOARD_CATEGORY_COLORS[item.category];
                    return (
                      <article key={item.id} className="rounded-xl border border-[#d7dce4] bg-white px-4 py-3.5 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-[#002f6c]">{item.title}</p>
                          <span className={`shrink-0 inline-flex items-center rounded-full ${colors.bg} px-2.5 py-0.5 text-[10px] font-bold ${colors.text}`}>
                            {STAFF_BOARD_CATEGORY_LABELS[item.category]}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#4b5563]">{item.description}</p>
                        <p className="mt-1.5 text-[11px] text-[#6b7280]">{item.timeHint}</p>
                        {item.ctaLabel && (
                          <span className="mt-1.5 inline-block text-[11.5px] font-bold text-[#1a56a8]">{item.ctaLabel} &rarr;</span>
                        )}
                      </article>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <Link
                    href={`${communityHubHref}&mode=staff`}
                    className="emory-link-btn text-[11px]"
                  >
                    Explore staff community resources
                  </Link>
                </div>
              </div>
            )}

            {/* Campus resources with open/closed badges (Feature 1) */}
            {audienceGroupedResources ? (
              <div className="mt-5 space-y-5">
                {audienceGroupedResources.map((group) => (
                  <div key={group.audience}>
                    <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-[#4b6a9b] mb-2.5">{group.label}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {group.resources.map((service) => {
                        const status = resourceOpenStatuses.get(service.id);
                        return (
                          <article key={service.id} className="rounded-xl border border-[#d7dce4] bg-white px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#8094b3]">{service.category}</p>
                              {status && (
                                status.isOpen ? (
                                  <span className="inline-flex items-center rounded-full bg-[#dcfce7] px-2.5 py-0.5 text-[10px] font-bold text-[#166534]">
                                    {status.statusLabel}
                                  </span>
                                ) : status.statusLabel === "Closed" ? (
                                  <span className="inline-flex items-center rounded-full bg-[#fee2e2] px-2.5 py-0.5 text-[10px] font-bold text-[#991b1b]">
                                    Closed
                                  </span>
                                ) : status.statusLabel !== "See Schedule" ? (
                                  <span className="inline-flex items-center rounded-full bg-[#e0e7ff] px-2.5 py-0.5 text-[10px] font-bold text-[#3730a3]">
                                    {status.statusLabel}
                                  </span>
                                ) : null
                              )}
                            </div>
                            <p className="mt-1 text-[14.5px] font-semibold text-[#002f6c] leading-snug">{service.name}</p>
                            <p className="mt-1 text-xs text-[#4b5563] leading-relaxed">{service.description || "On-campus support service."}</p>
                            <p className="mt-1.5 text-[11px] text-[#6b7280]">
                              {[service.open_hours, service.location_hint].filter(Boolean).join(" · ") || "Check with main desk"}
                            </p>
                            {service.cta_label && service.cta_url && (
                              <a href={service.cta_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[11.5px] font-bold text-[#1a56a8] hover:underline">
                                {service.cta_label} &rarr;
                              </a>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {campusResources.map((service) => (
                  <article key={service.id} className="rounded-xl border border-[#d7dce4] bg-white px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#8094b3]">{service.category}</p>
                    <p className="mt-1 text-[14.5px] font-semibold text-[#002f6c] leading-snug">{service.name}</p>
                    <p className="mt-1 text-xs text-[#4b5563] leading-relaxed">{service.description || "On-campus support service."}</p>
                    <p className="mt-1.5 text-[11px] text-[#6b7280]">
                      {[service.open_hours, service.location_hint].filter(Boolean).join(" · ") || "Check with main desk"}
                    </p>
                  </article>
                ))}
              </div>
            )}

            {/* Feature 1: Late Night & 24/7 panel */}
            {showLateNightPanel && (
              <div className="mt-4 rounded-xl border border-[#374151] bg-[#111827] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af] mb-2">Late Night &amp; 24/7</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {lateNightProfileResources.slice(0, 6).map((resource) => {
                    const status = resourceOpenStatuses.get(resource.id);
                    return (
                      <div key={resource.id} className="flex items-start justify-between gap-2 rounded-lg bg-[#1f2937] px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{resource.name}</p>
                          <p className="text-[11px] text-[#9ca3af]">{resource.openHours} · {resource.locationHint}</p>
                        </div>
                        {status && (
                          <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            status.isOpen
                              ? "bg-[#dcfce7] text-[#166534]"
                              : "bg-[#374151] text-[#9ca3af]"
                          }`}>
                            {status.statusLabel}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Neighborhood tips + event tips (Feature 6) */}
            {(neighborhoodTips.length > 0 || eventTips.length > 0) && (
              <div className="mt-4 rounded-xl border border-[#d4dde8] bg-[#f6f9fd] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4b6a9b] mb-2">Neighborhood Tips</p>
                <ul className="space-y-1.5">
                  {neighborhoodTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[var(--muted)]">
                      <span className="mt-0.5 shrink-0 text-[10px] text-[#7a9bc8]">&bull;</span>
                      <span>{tip.text}</span>
                    </li>
                  ))}
                  {eventTips.map((tip, i) => (
                    <li key={`event-${i}`} className="flex items-start gap-2 text-xs text-[#1a56a8] font-medium">
                      <span className="mt-0.5 shrink-0 text-[10px] text-[#3b82f6]">&bull;</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="emory-panel p-4 sm:p-5" id="concierge-explorer">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4b5563]">What&apos;s nearby</p>
            <h2 className={`mt-1 text-[clamp(1.5rem,2.8vw,2.2rem)] leading-[1] text-[#002f6c] ${hospitalDisplayFont.className}`}>
              Find what you need around campus
            </h2>
            <p className="mt-1.5 text-sm text-[#4b5563]">Food, lodging, pharmacies, fitness, and more within a few miles.</p>

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
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4b5563]">Nearby this week</p>
                <h2 className={`mt-1 text-[clamp(1.4rem,2.6vw,2rem)] leading-[1] text-[#002f6c] ${hospitalDisplayFont.className}`}>
                  Events and programs near {data.hospital.short_name || data.hospital.name}
                </h2>
                <p className="mt-1.5 text-sm text-[#4b5563]">Relevant events close to campus for patients, guests, and caregivers.</p>
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
                  <article key={eventCard.id} className="rounded-xl border border-[#d7dce4] bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <img src={eventCard.imageUrl || getEventFallbackImage(null, eventCard.title)} alt={eventCard.title} className="h-32 w-full object-cover" />
                    <div className="p-3">
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#8094b3]">Event</p>
                      <h3 className="mt-0.5 text-[1rem] leading-[1.08] text-[#002f6c] font-semibold">{eventCard.title}</h3>
                      <p className="mt-1 text-xs text-[#4b5563]">{eventCard.schedule}</p>
                      <p className="mt-0.5 text-[11px] text-[#6b7280]">{eventCard.subtitle}</p>

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
              <div className="mt-3 rounded-lg border border-dashed border-[#d7dce4] bg-[#f9fbfe] px-3 py-3">
                <p className="text-sm text-[#6b7280]">No nearby events are currently in range. Open the community hub to browse citywide programs.</p>
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

      {/* Feature 7: My Hospital Persistence */}
      {hospitalProfile && (
        <MyHospitalPersister
          portalId={portal.id}
          hospitalSlug={hospitalProfile.slug}
          displayName={hospitalProfile.displayName}
          shortName={hospitalProfile.shortName}
        />
      )}
    </div>
  );
}
