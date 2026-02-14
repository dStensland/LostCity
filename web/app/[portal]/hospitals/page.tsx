import { notFound } from "next/navigation";
import { AmbientBackground } from "@/components/ambient";
import { EmoryDemoHeader, PortalHeader } from "@/components/headers";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import {
  getHospitalWayfindingHref,
  getPortalHospitalLocations,
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

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<{ mode?: string; persona?: string }>;
};

export default async function HospitalDirectoryPage({ params, searchParams }: Props) {
  const { portal: portalSlug } = await params;
  const searchParamsData = await searchParams;

  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();
  const isEmoryBrand = isEmoryDemoPortal(portal.slug);
  if (getPortalVertical(portal) !== "hospital" && !isEmoryBrand) notFound();

  const mode = normalizeHospitalMode(searchParamsData.mode);
  const persona = normalizeEmoryPersona(searchParamsData.persona);
  const hospitals = await getPortalHospitalLocations(portal.id);
  const communityHref = `/${portal.slug}?view=community&mode=${mode}&persona=${persona}`;

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

        <div className={`${hospitalBodyFont.className} ${isEmoryBrand ? EMORY_THEME_SCOPE_CLASS : ""} py-6 space-y-4`}>
          <section className="emory-panel p-4 sm:p-5">
            <p className="emory-kicker">Hospital Network</p>
            <h1 className={`mt-2 text-[clamp(2.1rem,3.8vw,3.15rem)] leading-[0.94] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
              Choose a campus
            </h1>
            <p className="mt-3 max-w-[52ch] text-sm sm:text-base text-[var(--muted)]">
              Open a concierge view for nearby meals, services, and support around your visit.
            </p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {hospitals.map((hospital) => {
              const conciergeHref = `/${portal.slug}/hospitals/${hospital.slug}?mode=${mode}&persona=${persona}`;
              const wayfindingHref = getHospitalWayfindingHref(hospital);
              return (
                <article key={hospital.id} className="emory-panel p-4 sm:p-5">
                  <h2 className={`text-[1.55rem] leading-[0.98] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                    {hospital.short_name || hospital.name}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">{hospital.address}</p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hospital.neighborhood && <span className="emory-chip">{hospital.neighborhood}</span>}
                    {hospital.phone && <span className="emory-chip">Main Desk</span>}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <HospitalTrackedLink
                      href={conciergeHref}
                      tracking={{
                        actionType: "resource_clicked",
                        portalSlug: portal.slug,
                        hospitalSlug: hospital.slug,
                        modeContext: mode,
                        sectionKey: "v3_directory_cards",
                        targetKind: "concierge",
                        targetId: hospital.slug,
                        targetLabel: hospital.short_name || hospital.name,
                        targetUrl: conciergeHref,
                      }}
                      className="emory-primary-btn inline-flex items-center px-3 py-1.5 text-xs"
                    >
                      Open Concierge
                    </HospitalTrackedLink>

                    <HospitalTrackedLink
                      href={wayfindingHref}
                      external
                      tracking={{
                        actionType: "wayfinding_opened",
                        portalSlug: portal.slug,
                        hospitalSlug: hospital.slug,
                        modeContext: mode,
                        sectionKey: "v3_directory_cards",
                        targetKind: "wayfinding",
                        targetId: hospital.slug,
                        targetLabel: hospital.short_name || hospital.name,
                        targetUrl: wayfindingHref,
                      }}
                      className="emory-secondary-btn inline-flex items-center px-3 py-1.5 text-xs"
                    >
                      Directions
                    </HospitalTrackedLink>

                    {hospital.phone && (
                      <a href={`tel:${hospital.phone}`} className="emory-link-btn inline-flex items-center">
                        Call Main Desk
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          <section className="emory-panel p-4 sm:p-5">
            <p className="emory-kicker">Community Hub</p>
            <h2 className={`mt-1 text-[clamp(1.7rem,3vw,2.35rem)] leading-[0.96] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
              Continue with local classes, events, and neighborhood support
            </h2>
            <HospitalTrackedLink
              href={communityHref}
              tracking={{
                actionType: "resource_clicked",
                portalSlug: portal.slug,
                modeContext: mode,
                sectionKey: "v3_directory_next",
                targetKind: "community_hub",
                targetId: "open-community",
                targetLabel: "Open Community Hub",
                targetUrl: communityHref,
              }}
              className="emory-primary-btn mt-3 inline-flex items-center px-4 py-2 text-sm"
            >
              Open Community Hub
            </HospitalTrackedLink>
          </section>
        </div>
      </main>
    </div>
  );
}
