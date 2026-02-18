import { notFound } from "next/navigation";
import { AmbientBackground } from "@/components/ambient";
import { EmoryDemoHeader, PortalHeader } from "@/components/headers";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import {
  getHospitalWayfindingHref,
  getPortalHospitalLocations,
} from "@/lib/hospitals";
import { normalizeHospitalMode } from "@/lib/hospital-modes";
import {
  EMORY_THEME_CSS,
  EMORY_THEME_SCOPE_CLASS,
  hospitalBodyFont,
  hospitalDisplayFont,
  isEmoryDemoPortal,
  HOSPITAL_CARD_IMAGE_BY_SLUG,
  HOSPITAL_CARD_FALLBACK_IMAGE,
} from "@/lib/hospital-art";
import HospitalTrackedLink from "@/app/[portal]/_components/hospital/HospitalTrackedLink";
import EmoryMobileBottomNav from "@/app/[portal]/_components/hospital/EmoryMobileBottomNav";
import { Suspense } from "react";

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
  const hospitals = await getPortalHospitalLocations(portal.id);
  const communityHref = `/${portal.slug}/community-hub`;

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
            <h1 className={`mt-2 text-[clamp(2.5rem,4.5vw,3.6rem)] leading-[0.94] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
              Choose a campus
            </h1>
            <p className="mt-3 max-w-[52ch] text-sm sm:text-base text-[var(--muted)]">
              Find nearby food, lodging, and support services for each campus.
            </p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {hospitals.map((hospital) => {
              const conciergeHref = `/${portal.slug}/hospitals/${hospital.slug}`;
              const wayfindingHref = getHospitalWayfindingHref(hospital);
              const cardImage = HOSPITAL_CARD_IMAGE_BY_SLUG[hospital.slug] || HOSPITAL_CARD_FALLBACK_IMAGE;
              return (
                <article key={hospital.id} className="emory-panel overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cardImage} alt={hospital.short_name || hospital.name} className="h-44 w-full object-cover" />
                  <div className="p-4 sm:p-5">
                  <h2 className={`text-[1.55rem] leading-[0.98] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                    {hospital.short_name || hospital.name}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">{hospital.address}</p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hospital.neighborhood && <span className="emory-chip">{hospital.neighborhood}</span>}
                    {hospital.phone && <span className="emory-chip">{hospital.phone}</span>}
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
                      className="emory-primary-btn inline-flex items-center"
                    >
                      Explore Campus
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
                      className="emory-secondary-btn inline-flex items-center"
                    >
                      Directions
                    </HospitalTrackedLink>

                    {hospital.phone && (
                      <HospitalTrackedLink
                        href={`tel:${hospital.phone}`}
                        tracking={{
                          actionType: "resource_clicked",
                          portalSlug: portal.slug,
                          hospitalSlug: hospital.slug,
                          modeContext: mode,
                          sectionKey: "v3_directory_cards",
                          targetKind: "phone_call",
                          targetId: hospital.slug,
                          targetLabel: hospital.short_name || hospital.name,
                          targetUrl: `tel:${hospital.phone}`,
                        }}
                        className="emory-link-btn inline-flex items-center"
                      >
                        Call Main Desk
                      </HospitalTrackedLink>
                    )}
                  </div>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="emory-panel p-4 sm:p-5">
            <p className="emory-kicker">Community Hub</p>
            <h2 className={`mt-1 text-[clamp(1.9rem,3.3vw,2.6rem)] leading-[0.96] text-[var(--cream)] ${hospitalDisplayFont.className}`}>
              Explore community health programs and events
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
              className="emory-primary-btn mt-3 inline-flex items-center"
            >
              Browse Community Health
            </HospitalTrackedLink>
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
