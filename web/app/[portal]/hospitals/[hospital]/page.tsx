import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AmbientBackground } from "@/components/ambient";
import { PortalHeader } from "@/components/headers";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import {
  getHospitalLandingData,
  getHospitalWayfindingHref,
  getVenueMapsHref,
  type HospitalNearbyVenue,
} from "@/lib/hospitals";
import {
  HOSPITAL_MODE_CONFIG,
  HOSPITAL_MODE_LIST,
  normalizeHospitalMode,
  type HospitalAudienceMode,
} from "@/lib/hospital-modes";
import HospitalTrackedLink from "@/app/[portal]/_components/hospital/HospitalTrackedLink";

type Props = {
  params: Promise<{ portal: string; hospital: string }>;
  searchParams: Promise<{ mode?: string }>;
};

type SectionKey = "services" | "late" | "food" | "stay";

type SectionCard = {
  key: SectionKey;
  title: string;
  description: string;
  trustNote: string;
  accent: string;
  content: ReactNode;
};

const SECTION_META: Record<
  SectionKey,
  { title: string; description: string; trustNote: string; accent: string; chipLabel: string }
> = {
  services: {
    title: "On-Site Amenities & Services",
    description: "Hospital-specific offerings such as pharmacy, cafeteria, parking, and patient-family support.",
    trustNote: "Published from hospital service records and operations metadata.",
    accent: "from-[#2f66ab]/26 via-[var(--action-primary)]/20 to-transparent",
    chipLabel: "On Campus",
  },
  late: {
    title: "Late-Night Options Nearby",
    description: "Higher-utility options for overnight visitors, caregivers, and night-shift coordination.",
    trustNote: "Ranked by open status, distance, and audience mode relevance.",
    accent: "from-[#bf3a2d]/22 via-[var(--action-primary)]/18 to-transparent",
    chipLabel: "Late",
  },
  food: {
    title: "Where to Eat Nearby",
    description: "Practical meal options with proximity and operational state surfaced first.",
    trustNote: "Filtered and ranked for hospital-adjacent utility.",
    accent: "from-[#c17f22]/22 via-[var(--portal-accent)]/20 to-transparent",
    chipLabel: "Food",
  },
  stay: {
    title: "Where to Stay Nearby",
    description: "Nearby lodging support for out-of-town treatment and multi-day visitor journeys.",
    trustNote: "Sorted by distance and mode-aware relevance scoring.",
    accent: "from-[#2b7a6b]/22 via-[var(--portal-accent)]/18 to-transparent",
    chipLabel: "Stay",
  },
};

const MODE_VISUAL: Record<HospitalAudienceMode, { border: string; halo: string; pill: string }> = {
  urgent: {
    border: "border-[#bf3a2d]/45",
    halo: "from-[#bf3a2d]/25 via-[var(--action-primary)]/16 to-transparent",
    pill: "bg-[#bf3a2d]/14 border-[#bf3a2d]/45",
  },
  treatment: {
    border: "border-[#2f66ab]/45",
    halo: "from-[#2f66ab]/25 via-[var(--action-primary)]/16 to-transparent",
    pill: "bg-[#2f66ab]/14 border-[#2f66ab]/45",
  },
  visitor: {
    border: "border-[var(--action-primary)]/45",
    halo: "from-[var(--action-primary)]/25 via-[var(--portal-accent)]/18 to-transparent",
    pill: "bg-[var(--action-primary)]/12 border-[var(--action-primary)]/45",
  },
  staff: {
    border: "border-[#2b7a6b]/45",
    halo: "from-[#2b7a6b]/25 via-[var(--portal-accent)]/16 to-transparent",
    pill: "bg-[#2b7a6b]/14 border-[#2b7a6b]/45",
  },
};

function NearbyVenueCard({
  venue,
  sectionKey,
  chipLabel,
  portalSlug,
  hospitalSlug,
  mode,
}: {
  venue: HospitalNearbyVenue;
  sectionKey: "late" | "food" | "stay";
  chipLabel: string;
  portalSlug: string;
  hospitalSlug: string;
  mode: HospitalAudienceMode;
}) {
  const mapsHref = getVenueMapsHref(venue);

  return (
    <article className="rounded-xl border border-[var(--twilight)]/35 bg-[var(--night)]/35 p-4 transition-all duration-200 hover:border-[var(--action-primary)]/35 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--cream)]">{venue.name}</p>
          <p className="text-xs text-[var(--muted)] mt-1">
            {venue.distance_miles.toFixed(1)} mi away
            {venue.neighborhood ? ` · ${venue.neighborhood}` : ""}
          </p>
          <p className="text-xs text-[var(--muted)] mt-1">{venue.status_label}</p>
          <p className="text-[11px] text-[var(--muted)] mt-1">
            Relevance {venue.relevance_score.toFixed(0)} · {venue.relevance_reason}
          </p>
        </div>
        <span className="rounded-full border border-[var(--twilight)] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
          {chipLabel}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${
            venue.is_open_now
              ? "border-[#2b7a6b]/55 bg-[#2b7a6b]/14 text-[var(--cream)]"
              : "border-[var(--twilight)]/60 text-[var(--muted)]"
          }`}
        >
          {venue.is_open_now ? "Open Now" : "Check Hours"}
        </span>
        {venue.open_late && (
          <span className="rounded-full border border-[#bf3a2d]/55 bg-[#bf3a2d]/14 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--cream)]">
            Open Late
          </span>
        )}
        {venue.price_level !== null && venue.price_level <= 2 && (
          <span className="rounded-full border border-[var(--twilight)]/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
            Lower Cost
          </span>
        )}
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
            sectionKey,
            targetKind: `${sectionKey}_maps`,
            targetId: String(venue.id),
            targetLabel: venue.name,
            targetUrl: mapsHref,
          }}
          className="inline-flex items-center rounded-lg border border-[var(--twilight)] px-2.5 py-1 text-xs font-medium text-[var(--cream)] hover:bg-[var(--twilight)]/25"
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
              sectionKey,
              targetKind: `${sectionKey}_website`,
              targetId: String(venue.id),
              targetLabel: venue.name,
              targetUrl: venue.website,
            }}
            className="inline-flex items-center rounded-lg border border-[var(--twilight)] px-2.5 py-1 text-xs font-medium text-[var(--cream)] hover:bg-[var(--twilight)]/25"
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

  const vertical = getPortalVertical(portal);
  if (vertical !== "hospital") notFound();

  const mode = normalizeHospitalMode(searchParamsData.mode);
  const data = await getHospitalLandingData(portal.id, hospitalSlug, mode);
  if (!data) notFound();

  const wayfindingHref = getHospitalWayfindingHref(data.hospital);
  const wayfindingPartner =
    typeof portal.settings?.wayfinding_partner === "string"
      ? portal.settings.wayfinding_partner
      : "gozio";
  const modeConfig = HOSPITAL_MODE_CONFIG[mode];
  const modeVisual = MODE_VISUAL[mode];
  const uniqueNearbyVenueMap = new Map<number, HospitalNearbyVenue>();
  for (const venue of [...data.nearby.food, ...data.nearby.stay, ...data.nearby.late]) {
    if (!uniqueNearbyVenueMap.has(venue.id)) {
      uniqueNearbyVenueMap.set(venue.id, venue);
    }
  }
  const uniqueNearbyVenues = [...uniqueNearbyVenueMap.values()];
  const topVenueCount = uniqueNearbyVenues.length;
  const openNowCount = uniqueNearbyVenues.filter((venue) => venue.is_open_now).length;

  const sectionCards: SectionCard[] = modeConfig.sectionOrder.map((sectionKey) => {
    if (sectionKey === "services") {
      const meta = SECTION_META.services;
      return {
        key: "services",
        title: meta.title,
        description: meta.description,
        trustNote: meta.trustNote,
        accent: meta.accent,
        content:
          data.services.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No on-site services have been published for this location yet.</p>
          ) : (
            data.services.map((service) => (
              <article
                key={service.id}
                className="rounded-lg border border-[var(--twilight)]/30 bg-[var(--night)]/35 p-3 transition-all duration-200 hover:border-[var(--action-primary)]/35"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--cream)]">{service.name}</p>
                    <p className="text-xs text-[var(--muted)] mt-1">{service.description || "Service details available onsite."}</p>
                    {(service.open_hours || service.location_hint) && (
                      <p className="text-[11px] text-[var(--muted)] mt-1">
                        {[service.open_hours, service.location_hint].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full border border-[var(--twilight)] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    {service.category}
                  </span>
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
                      sectionKey: "services",
                      targetKind: "service_cta",
                      targetId: service.id,
                      targetLabel: service.name,
                      targetUrl: service.cta_url,
                    }}
                    className="inline-flex items-center rounded-lg border border-[var(--twilight)] px-2.5 py-1 mt-2 text-xs font-medium text-[var(--cream)] hover:bg-[var(--twilight)]/25"
                  >
                    {service.cta_label || "Learn More"}
                  </HospitalTrackedLink>
                )}
              </article>
            ))
          ),
      };
    }

    if (sectionKey === "late") {
      const meta = SECTION_META.late;
      return {
        key: "late",
        title: meta.title,
        description: meta.description,
        trustNote: meta.trustNote,
        accent: meta.accent,
        content:
          data.nearby.late.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No late-night options found in the current venue dataset.</p>
          ) : (
            data.nearby.late.map((venue) => (
              <NearbyVenueCard
                key={venue.id}
                venue={venue}
                sectionKey="late"
                chipLabel={meta.chipLabel}
                portalSlug={portal.slug}
                hospitalSlug={data.hospital.slug}
                mode={mode}
              />
            ))
          ),
      };
    }

    if (sectionKey === "food") {
      const meta = SECTION_META.food;
      return {
        key: "food",
        title: meta.title,
        description: meta.description,
        trustNote: meta.trustNote,
        accent: meta.accent,
        content:
          data.nearby.food.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No nearby food options found yet.</p>
          ) : (
            data.nearby.food.map((venue) => (
              <NearbyVenueCard
                key={venue.id}
                venue={venue}
                sectionKey="food"
                chipLabel={meta.chipLabel}
                portalSlug={portal.slug}
                hospitalSlug={data.hospital.slug}
                mode={mode}
              />
            ))
          ),
      };
    }

    const meta = SECTION_META.stay;
    return {
      key: "stay",
      title: meta.title,
      description: meta.description,
      trustNote: meta.trustNote,
      accent: meta.accent,
      content:
        data.nearby.stay.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No nearby stay options found yet.</p>
        ) : (
          data.nearby.stay.map((venue) => (
            <NearbyVenueCard
              key={venue.id}
              venue={venue}
              sectionKey="stay"
              chipLabel={meta.chipLabel}
              portalSlug={portal.slug}
              hospitalSlug={data.hospital.slug}
              mode={mode}
            />
          ))
        ),
    };
  });

  return (
    <div className="min-h-screen">
      <AmbientBackground />

      <PortalHeader portalSlug={portal.slug} portalName={portal.name} />

      <main className="max-w-6xl mx-auto px-4 pb-20">
        <style>{`
          @keyframes hospitalReveal {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .hospital-reveal {
            opacity: 0;
            animation: hospitalReveal 560ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
          }
          .hospital-delay-1 { animation-delay: 70ms; }
          .hospital-delay-2 { animation-delay: 130ms; }
          .hospital-delay-3 { animation-delay: 190ms; }
        `}</style>

        <div className="py-6 space-y-6">
          <div className="hospital-reveal flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <Link href={`/${portal.slug}?mode=${mode}`} className="hover:text-[var(--cream)]">
              {portal.name}
            </Link>
            <span>/</span>
            <Link href={`/${portal.slug}/hospitals?mode=${mode}`} className="hover:text-[var(--cream)]">
              Hospital Directory
            </Link>
            <span>/</span>
            <span className="text-[var(--cream)]">{data.hospital.short_name || data.hospital.name}</span>
          </div>

          <section className="hospital-reveal relative overflow-hidden rounded-[30px] border border-[var(--twilight)]/35 bg-[var(--card-bg)] p-5 sm:p-6">
            <div className="pointer-events-none absolute inset-0">
              <div className={`absolute -top-24 right-0 h-56 w-56 rounded-full blur-3xl bg-gradient-to-br ${modeVisual.halo}`} />
              <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-[var(--portal-accent)]/10 blur-3xl" />
            </div>

            <div className="relative grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Hospital Guide</p>
                <h1 className="mt-2 font-serif text-[clamp(1.4rem,2.9vw,2.25rem)] leading-[1.15] text-[var(--cream)]">
                  {data.hospital.name}
                </h1>
                <p className="mt-2 text-sm text-[var(--muted)] max-w-3xl">{data.hospital.address}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {HOSPITAL_MODE_LIST.map((candidateMode) => {
                    const isActive = candidateMode.key === mode;
                    return (
                      <HospitalTrackedLink
                        key={candidateMode.key}
                        href={`/${portal.slug}/hospitals/${data.hospital.slug}?mode=${candidateMode.key}`}
                        tracking={{
                          actionType: "mode_selected",
                          portalSlug: portal.slug,
                          hospitalSlug: data.hospital.slug,
                          modeContext: candidateMode.key,
                          sectionKey: "hospital_modes",
                          targetKind: "mode_chip",
                          targetId: candidateMode.key,
                          targetLabel: candidateMode.label,
                        }}
                        className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium border transition-all duration-200 ${
                          isActive
                            ? "bg-[var(--action-primary)] text-[var(--btn-primary-text)] border-[var(--action-primary)]"
                            : "border-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/25 hover:-translate-y-0.5"
                        }`}
                      >
                        {candidateMode.shortLabel}
                      </HospitalTrackedLink>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <HospitalTrackedLink
                    href={wayfindingHref}
                    external
                    tracking={{
                      actionType: "wayfinding_opened",
                      portalSlug: portal.slug,
                      hospitalSlug: data.hospital.slug,
                      modeContext: mode,
                      sectionKey: "hospital_header",
                      targetKind: "wayfinding",
                      targetId: data.hospital.slug,
                      targetLabel: data.hospital.short_name || data.hospital.name,
                      targetUrl: wayfindingHref,
                    }}
                    className="inline-flex items-center rounded-lg bg-[var(--action-primary)] px-3 py-1.5 text-xs font-medium text-[var(--btn-primary-text)] hover:bg-[var(--action-primary-hover)]"
                  >
                    Open Wayfinding ({wayfindingPartner})
                  </HospitalTrackedLink>
                  <HospitalTrackedLink
                    href={`/api/portals/${portal.slug}/hospitals/${data.hospital.slug}?mode=${mode}&include=wayfinding`}
                    tracking={{
                      actionType: "resource_clicked",
                      portalSlug: portal.slug,
                      hospitalSlug: data.hospital.slug,
                      modeContext: mode,
                      sectionKey: "hospital_header",
                      targetKind: "wayfinding_payload",
                      targetId: data.hospital.slug,
                      targetLabel: "View Wayfinding Payload",
                    }}
                    className="inline-flex items-center rounded-lg border border-[var(--twilight)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--twilight)]/25"
                  >
                    View Wayfinding Payload
                  </HospitalTrackedLink>
                  {data.hospital.phone && (
                    <a
                      href={`tel:${data.hospital.phone}`}
                      className="inline-flex items-center rounded-lg border border-[var(--twilight)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--twilight)]/25"
                    >
                      Call Main Desk
                    </a>
                  )}
                  {data.hospital.emergency_phone && (
                    <a
                      href={`tel:${data.hospital.emergency_phone}`}
                      className="inline-flex items-center rounded-lg border border-[var(--twilight)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--twilight)]/25"
                    >
                      Emergency Contact
                    </a>
                  )}
                </div>
              </div>

              <aside className={`rounded-2xl border ${modeVisual.border} bg-[var(--night)]/45 p-4`}>
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Concierge Snapshot</p>
                <h2 className="mt-1 text-sm font-semibold text-[var(--cream)]">{modeConfig.label}</h2>
                <p className="mt-2 text-xs text-[var(--muted)] leading-relaxed">{modeConfig.heroHint}</p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className={`rounded-lg border px-3 py-2 ${modeVisual.pill}`}>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Services</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--cream)]">{data.services.length}</p>
                  </div>
                  <div className={`rounded-lg border px-3 py-2 ${modeVisual.pill}`}>
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Nearby</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--cream)]">{topVenueCount}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--twilight)]/35 bg-[var(--night)]/35 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Open Now</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--cream)]">{openNowCount}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--twilight)]/35 bg-[var(--night)]/35 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">Attribution</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--cream)]">Strict</p>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <div className="hospital-reveal hospital-delay-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sectionCards.map((section) => (
              <section
                key={section.key}
                className="relative overflow-hidden rounded-2xl border border-[var(--twilight)]/40 bg-[var(--card-bg)] p-5"
              >
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${section.accent}`} />
                <h2 className="text-lg font-semibold text-[var(--cream)]">{section.title}</h2>
                <p className="text-xs text-[var(--muted)] mt-1">{section.description}</p>
                <p className="text-[11px] text-[var(--muted)] mt-1">{section.trustNote}</p>
                <div className="mt-4 space-y-3">{section.content}</div>
              </section>
            ))}
          </div>

          <section className="hospital-reveal hospital-delay-2 rounded-2xl border border-[var(--twilight)]/40 bg-[var(--card-bg)] p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-[var(--cream)]">Community Health Beyond the Campus</h2>
                <p className="text-sm text-[var(--muted)] mt-1 max-w-3xl">
                  Maintain continuity from campus logistics into citywide support: prevention events, food access resources,
                  and non-commercial wellness programming.
                </p>
              </div>
              <span className="rounded-full border border-[var(--twilight)] px-3 py-1 text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
                Source Trust Enforced
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <HospitalTrackedLink
                href={`/${portal.slug}?view=find&type=events&mode=${mode}&search=${encodeURIComponent("public health screening atlanta")}`}
                tracking={{
                  actionType: "resource_clicked",
                  portalSlug: portal.slug,
                  hospitalSlug: data.hospital.slug,
                  modeContext: mode,
                  sectionKey: "hospital_community",
                  targetKind: "public_health_track",
                  targetLabel: "Public Health Track",
                }}
                className="rounded-xl border border-[var(--twilight)]/35 bg-[var(--night)]/35 p-3"
              >
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Track A</p>
                <p className="mt-1 text-sm font-medium text-[var(--cream)]">Public Health and Prevention</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Screenings, awareness events, and education resources.</p>
              </HospitalTrackedLink>
              <HospitalTrackedLink
                href={`/${portal.slug}?view=find&type=events&mode=${mode}&search=${encodeURIComponent("food access family support atlanta")}`}
                tracking={{
                  actionType: "resource_clicked",
                  portalSlug: portal.slug,
                  hospitalSlug: data.hospital.slug,
                  modeContext: mode,
                  sectionKey: "hospital_community",
                  targetKind: "food_access_track",
                  targetLabel: "Food Access Track",
                }}
                className="rounded-xl border border-[var(--twilight)]/35 bg-[var(--night)]/35 p-3"
              >
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Track B</p>
                <p className="mt-1 text-sm font-medium text-[var(--cream)]">Food Access and Family Support</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Programs focused on lower-income and family stability.</p>
              </HospitalTrackedLink>
              <HospitalTrackedLink
                href={`/${portal.slug}?view=find&type=events&mode=${mode}&search=${encodeURIComponent("outdoor wellness atlanta")}`}
                tracking={{
                  actionType: "resource_clicked",
                  portalSlug: portal.slug,
                  hospitalSlug: data.hospital.slug,
                  modeContext: mode,
                  sectionKey: "hospital_community",
                  targetKind: "outdoor_wellness_track",
                  targetLabel: "Outdoor Wellness Track",
                }}
                className="rounded-xl border border-[var(--twilight)]/35 bg-[var(--night)]/35 p-3"
              >
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Track C</p>
                <p className="mt-1 text-sm font-medium text-[var(--cream)]">Outdoor and Community Wellness</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Accessible, non-commercial movement and mental wellness activities.</p>
              </HospitalTrackedLink>
            </div>

            <p className="mt-4 text-xs text-[var(--muted)]">Keep this context in play while returning to the network view.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <HospitalTrackedLink
                href={`/${portal.slug}?mode=${mode}`}
                tracking={{
                  actionType: "resource_clicked",
                  portalSlug: portal.slug,
                  hospitalSlug: data.hospital.slug,
                  modeContext: mode,
                  sectionKey: "hospital_footer",
                  targetKind: "overview",
                  targetLabel: "Back to Emory Overview",
                }}
                className="inline-flex items-center rounded-lg bg-[var(--action-primary)] px-3 py-1.5 text-xs font-medium text-[var(--btn-primary-text)] hover:bg-[var(--action-primary-hover)]"
              >
                Back to Emory Overview
              </HospitalTrackedLink>
              <HospitalTrackedLink
                href={`/${portal.slug}?view=find&type=events&mode=${mode}`}
                tracking={{
                  actionType: "resource_clicked",
                  portalSlug: portal.slug,
                  hospitalSlug: data.hospital.slug,
                  modeContext: mode,
                  sectionKey: "hospital_footer",
                  targetKind: "community_events",
                  targetLabel: "Browse Community Events",
                }}
                className="inline-flex items-center rounded-lg border border-[var(--twilight)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--twilight)]/25"
              >
                Browse Community Events
              </HospitalTrackedLink>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
