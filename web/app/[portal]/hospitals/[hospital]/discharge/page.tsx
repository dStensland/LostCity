import { notFound } from "next/navigation";
import Link from "next/link";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { getPortalHospitalLocations } from "@/lib/hospitals";
import {
  getHospitalProfile,
  getDischargeResources,
  AUDIENCE_LABELS,
  type CampusResource,
  type DischargeTransportCard,
  type DischargeFollowUpCard,
} from "@/lib/emory-hospital-profiles";
import {
  parseCampusOpenHours,
  getCampusResourceOpenStatus,
} from "@/lib/campus-hours-parser";
import {
  EMORY_THEME_CSS,
  EMORY_THEME_SCOPE_CLASS,
  hospitalBodyFont,
  hospitalDisplayFont,
  isEmoryDemoPortal,
} from "@/lib/hospital-art";
import { EmoryDemoHeader } from "@/components/headers";
import PrintButton from "./PrintButton";
import type { EmoryCommunityCategory } from "@/lib/emory-community-categories";

type Props = {
  params: Promise<{ portal: string; hospital: string }>;
};

const CATEGORY_LABELS: Partial<Record<EmoryCommunityCategory, string>> = {
  food_nutrition: "Food & Nutrition",
  support_groups: "Support Groups",
  life_essentials: "Life Essentials",
  family_children: "Family & Children",
  stay_well: "Stay Well",
  recovery_healing: "Recovery & Healing",
};

function OpenStatusBadge({ resource }: { resource: CampusResource }) {
  const parsed = parseCampusOpenHours(resource.openHours);
  const status = getCampusResourceOpenStatus(parsed);

  if (status.statusLabel === "Open Now" || status.statusLabel === "24/7") {
    return (
      <span className="inline-flex items-center rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-semibold text-[#166534]">
        {status.statusLabel}
      </span>
    );
  }
  if (status.statusLabel === "Badge Access" || status.statusLabel === "On-Call") {
    return (
      <span className="inline-flex items-center rounded-full bg-[#e0e7ff] px-2 py-0.5 text-[10px] font-semibold text-[#3730a3]">
        {status.statusLabel}
      </span>
    );
  }
  if (status.statusLabel === "Closed") {
    return (
      <span className="inline-flex items-center rounded-full bg-[#fee2e2] px-2 py-0.5 text-[10px] font-semibold text-[#991b1b]">
        Closed
      </span>
    );
  }
  return null;
}

export default async function DischargePage({ params }: Props) {
  const { portal: portalSlug, hospital: hospitalSlug } = await params;

  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();
  const isEmoryBrand = isEmoryDemoPortal(portal.slug);
  if (getPortalVertical(portal) !== "hospital" && !isEmoryBrand) notFound();

  const hospitalProfile = getHospitalProfile(hospitalSlug);
  if (!hospitalProfile) notFound();

  const hospitals = await getPortalHospitalLocations(portal.id);
  const hospital = hospitals.find((h) => h.slug === hospitalSlug);
  if (!hospital) notFound();

  const dischargeResources = getDischargeResources(hospitalProfile);
  const communityHubHref = `/${portal.slug}/community-hub?hospital=${encodeURIComponent(hospitalSlug)}`;
  const conciergeHref = `/${portal.slug}/hospitals/${hospitalSlug}`;

  const defaultTransport: DischargeTransportCard[] = [
    { id: "default-rideshare", title: "Rideshare", description: "Uber and Lyft serve all Emory campuses. Use the hospital main entrance for pickup.", ctaLabel: null, ctaUrl: null },
    { id: "default-marta", title: "MARTA Transit", description: "Public transit routes serve most Emory locations. Check itsmarta.com for schedules.", ctaLabel: "MARTA Trip Planner", ctaUrl: "https://www.itsmarta.com/trip-planner.aspx" },
    { id: "default-parking", title: "Valet & Parking", description: "Ask the main desk about parking validation before you leave campus.", ctaLabel: null, ctaUrl: null },
  ];
  const defaultFollowUp: DischargeFollowUpCard[] = [
    { id: "default-mychart", title: "Schedule Follow-Up via MyChart", description: "Log in to MyChart for follow-up appointments, test results, and messaging your care team.", ctaLabel: "Open MyChart", ctaUrl: "https://mychart.emoryhealthcare.org" },
  ];

  const dischargeCategoryBoosts = hospitalProfile.dischargeCategoryBoosts || [];

  return (
    <div className={`min-h-screen ${isEmoryBrand ? "bg-[#f2f5fa] text-[#002f6c]" : ""}`}>
      {isEmoryBrand && (
        <style>{`
          body::before { opacity: 0 !important; }
          body::after { opacity: 0 !important; }
          .ambient-glow { opacity: 0 !important; }
          .rain-overlay { display: none !important; }
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
            .emory-panel { box-shadow: none !important; border: 1px solid #e5e7eb !important; break-inside: avoid; }
          }
        `}</style>
      )}
      {isEmoryBrand && <EmoryDemoHeader portalSlug={portal.slug} />}

      <main className="max-w-4xl mx-auto px-4 pb-20">
        <style>{EMORY_THEME_CSS}</style>

        <div className={`${hospitalBodyFont.className} ${isEmoryBrand ? EMORY_THEME_SCOPE_CLASS : ""} py-6 space-y-5`}>
          {/* Header */}
          <section className="emory-panel p-4 sm:p-5">
            <p className="emory-kicker">Discharge guide</p>
            <h1 className={`mt-1 text-[clamp(2rem,3.8vw,3rem)] leading-[0.94] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
              Your Take-Home Guide
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Important resources as you leave {hospitalProfile.displayName}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 no-print">
              <PrintButton />
              <Link href={conciergeHref} className="emory-link-btn inline-flex items-center text-sm">
                Back to campus
              </Link>
            </div>
          </section>

          {/* Before You Leave Campus */}
          {dischargeResources.length > 0 && (
            <section className="emory-panel p-4 sm:p-5">
              <p className="emory-kicker">Before you leave campus</p>
              <h2 className={`mt-1 text-[clamp(1.6rem,2.8vw,2.2rem)] leading-[0.96] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                Campus resources for discharge
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Pick up prescriptions, settle billing, and gather what you need before heading home.
              </p>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {dischargeResources.map((resource) => (
                  <article key={resource.id} className="rounded-xl border border-[var(--twilight)] bg-gradient-to-b from-white to-[#f9fbfe] px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.06em] text-[#6b7280]">{resource.category}</p>
                        <p className="mt-0.5 text-sm font-semibold text-[var(--cream)]">{resource.name}</p>
                      </div>
                      <OpenStatusBadge resource={resource} />
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{resource.description}</p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      {[resource.openHours, resource.locationHint].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#6b7280]">{AUDIENCE_LABELS[resource.audience]}</p>
                    {resource.ctaLabel && resource.ctaUrl && (
                      <a href={resource.ctaUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[11px] font-semibold text-[#1a56a8] hover:underline">
                        {resource.ctaLabel}
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Community Support Near You */}
          {dischargeCategoryBoosts.length > 0 && (
            <section className="emory-panel p-4 sm:p-5">
              <p className="emory-kicker">Community support near you</p>
              <h2 className={`mt-1 text-[clamp(1.6rem,2.8vw,2.2rem)] leading-[0.96] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                Programs and resources after discharge
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Community organizations that can help with recovery, nutrition, and daily needs.
              </p>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {dischargeCategoryBoosts.map((cat) => (
                  <Link
                    key={cat}
                    href={`${communityHubHref}&community_hub_tab=organizations&community_hub_filter=${cat}`}
                    className="group rounded-xl border border-[var(--twilight)] bg-gradient-to-b from-white to-[#f9fbfe] px-3 py-3 hover:border-[#7ecf75] transition-colors"
                  >
                    <p className="text-sm font-semibold text-[var(--cream)]">{CATEGORY_LABELS[cat] || cat}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">Browse organizations and programs</p>
                    <span className="mt-1.5 inline-flex text-[11px] font-semibold text-[#1a56a8] group-hover:underline">Explore</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Getting Home */}
          <section className="emory-panel p-4 sm:p-5">
            <p className="emory-kicker">Getting home</p>
            <h2 className={`mt-1 text-[clamp(1.6rem,2.8vw,2.2rem)] leading-[0.96] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
              Transportation from {hospitalProfile.shortName}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Options for getting home from {hospitalProfile.neighborhood}.
            </p>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(hospitalProfile.dischargeTransport ?? defaultTransport).map((card: DischargeTransportCard) => (
                <article key={card.id} className="rounded-xl border border-[var(--twilight)] bg-gradient-to-b from-white to-[#f9fbfe] px-3 py-3">
                  <p className="text-sm font-semibold text-[var(--cream)]">{card.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{card.description}</p>
                  {card.ctaLabel && card.ctaUrl && (
                    <a href={card.ctaUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[11px] font-semibold text-[#1a56a8] hover:underline">
                      {card.ctaLabel}
                    </a>
                  )}
                </article>
              ))}
            </div>
          </section>

          {/* Follow-Up Care */}
          {(hospitalProfile.dischargeFollowUp ?? defaultFollowUp).length > 0 && (
            <section className="emory-panel p-4 sm:p-5">
              <p className="emory-kicker">After you get home</p>
              <h2 className={`mt-1 text-[clamp(1.6rem,2.8vw,2.2rem)] leading-[0.96] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                Follow-up care and prescriptions
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Stay connected with your care team and manage prescriptions from home.
              </p>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(hospitalProfile.dischargeFollowUp ?? defaultFollowUp).map((card: DischargeFollowUpCard) => (
                  <article key={card.id} className="rounded-xl border border-[var(--twilight)] bg-gradient-to-b from-white to-[#f9fbfe] px-3 py-3">
                    <p className="text-sm font-semibold text-[var(--cream)]">{card.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{card.description}</p>
                    {card.ctaLabel && card.ctaUrl && (
                      <a href={card.ctaUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[11px] font-semibold text-[#1a56a8] hover:underline">
                        {card.ctaLabel}
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Back to concierge */}
          <div className="text-center no-print">
            <Link href={conciergeHref} className="emory-link-btn inline-flex items-center text-sm">
              Back to {hospitalProfile.shortName} campus guide
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
