import { notFound } from "next/navigation";
import { AmbientBackground } from "@/components/ambient";
import { PortalHeader } from "@/components/headers";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { getHospitalWayfindingHref, getPortalHospitalLocations } from "@/lib/hospitals";
import {
  HOSPITAL_MODE_LIST,
  normalizeHospitalMode,
  type HospitalAudienceMode,
} from "@/lib/hospital-modes";
import HospitalTrackedLink from "@/app/[portal]/_components/hospital/HospitalTrackedLink";

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<{ mode?: string }>;
};

const MODE_VISUAL: Record<
  HospitalAudienceMode,
  { border: string; pill: string; halo: string; narrative: string }
> = {
  urgent: {
    border: "border-[#bf3a2d]/45",
    pill: "bg-[#bf3a2d]/14 border-[#bf3a2d]/45",
    halo: "from-[#bf3a2d]/24 via-[var(--action-primary)]/14 to-transparent",
    narrative: "Prioritizing rapid handoff to wayfinding, contacts, and near-term support.",
  },
  treatment: {
    border: "border-[#2f66ab]/45",
    pill: "bg-[#2f66ab]/14 border-[#2f66ab]/45",
    halo: "from-[#2f66ab]/22 via-[var(--portal-accent)]/16 to-transparent",
    narrative: "Prioritizing repeat-visit logistics, lodging, and stable support infrastructure.",
  },
  visitor: {
    border: "border-[var(--action-primary)]/45",
    pill: "bg-[var(--action-primary)]/12 border-[var(--action-primary)]/45",
    halo: "from-[var(--action-primary)]/22 via-[var(--portal-accent)]/16 to-transparent",
    narrative: "Prioritizing visitor confidence, location clarity, and practical next steps.",
  },
  staff: {
    border: "border-[#2b7a6b]/45",
    pill: "bg-[#2b7a6b]/14 border-[#2b7a6b]/45",
    halo: "from-[#2b7a6b]/22 via-[var(--portal-accent)]/16 to-transparent",
    narrative: "Prioritizing shift speed, late-night reliability, and essential services.",
  },
};

export default async function HospitalDirectoryPage({ params, searchParams }: Props) {
  const { portal: portalSlug } = await params;
  const searchParamsData = await searchParams;
  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();

  if (getPortalVertical(portal) !== "hospital") {
    notFound();
  }

  const hospitals = await getPortalHospitalLocations(portal.id);
  const mode = normalizeHospitalMode(searchParamsData.mode);
  const modeText = HOSPITAL_MODE_LIST.find((candidateMode) => candidateMode.key === mode)?.label || "Visiting Someone";
  const modeVisual = MODE_VISUAL[mode];

  return (
    <div className="min-h-screen">
      <AmbientBackground />
      <PortalHeader portalSlug={portal.slug} portalName={portal.name} />

      <main className="max-w-6xl mx-auto px-4 pb-20">
        <style>{`
          @keyframes directoryReveal {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .directory-reveal {
            opacity: 0;
            animation: directoryReveal 520ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
          }
          .directory-delay-1 { animation-delay: 70ms; }
          .directory-delay-2 { animation-delay: 130ms; }
          .directory-delay-3 { animation-delay: 190ms; }
        `}</style>

        <div className="py-6 space-y-6">
          <section className="directory-reveal relative overflow-hidden rounded-[30px] border border-[var(--twilight)]/35 bg-[var(--card-bg)] p-5 sm:p-6">
            <div className="pointer-events-none absolute inset-0">
              <div className={`absolute -top-24 right-0 h-56 w-56 rounded-full blur-3xl bg-gradient-to-br ${modeVisual.halo}`} />
              <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[var(--portal-accent)]/10 blur-3xl" />
            </div>

            <div className="relative grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Hospital Directory</p>
                <h1 className="mt-2 font-serif text-[clamp(1.4rem,2.9vw,2.2rem)] leading-[1.15] text-[var(--cream)]">
                  {portal.name} Campus Concierge Network
                </h1>
                <p className="mt-3 text-sm sm:text-base text-[var(--muted)] max-w-4xl leading-relaxed">
                  Pick a campus and launch into a hospital-specific guide tuned for food, amenities, lodging, and wayfinding.
                  Attribution remains explicit from source to action.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {HOSPITAL_MODE_LIST.map((candidateMode) => {
                    const isActive = candidateMode.key === mode;
                    return (
                      <HospitalTrackedLink
                        key={candidateMode.key}
                        href={`/${portal.slug}/hospitals?mode=${candidateMode.key}`}
                        tracking={{
                          actionType: "mode_selected",
                          portalSlug: portal.slug,
                          modeContext: candidateMode.key,
                          sectionKey: "directory_modes",
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
              </div>

              <aside className={`rounded-2xl border ${modeVisual.border} bg-[var(--night)]/45 p-4`}>
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Mode Briefing</p>
                <h2 className="mt-1 text-sm font-semibold text-[var(--cream)]">{modeText}</h2>
                <p className="mt-2 text-xs text-[var(--muted)] leading-relaxed">{modeVisual.narrative}</p>

                <div className="mt-3 space-y-2">
                  <div className={`rounded-lg border px-3 py-2 ${modeVisual.pill}`}>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Primary Objective</p>
                    <p className="mt-1 text-xs text-[var(--cream)]">Get users to the right campus action in one tap.</p>
                  </div>
                  <div className="rounded-lg border border-[var(--twilight)]/35 bg-[var(--night)]/35 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Trust Guardrail</p>
                    <p className="mt-1 text-xs text-[var(--cream)]">Strict attribution, nonprofit/public-health aware context.</p>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          {hospitals.length === 0 ? (
            <section className="directory-reveal directory-delay-1 rounded-2xl border border-[var(--twilight)]/40 bg-[var(--card-bg)] p-5">
              <p className="text-sm text-[var(--muted)]">No hospital locations have been configured yet.</p>
            </section>
          ) : (
            <section className="directory-reveal directory-delay-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              {hospitals.map((hospital, index) => (
                <article
                  key={hospital.id}
                  className="group relative overflow-hidden rounded-2xl border border-[var(--twilight)]/40 bg-[var(--card-bg)] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--action-primary)]/45"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--action-primary)]/45 via-[var(--portal-accent)]/35 to-transparent" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-[var(--cream)]">{hospital.short_name || hospital.name}</p>
                      <p className="text-sm text-[var(--muted)] mt-1">{hospital.address}</p>
                    </div>
                    {index === 0 && (
                      <span className="rounded-full border border-[var(--action-primary)]/55 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--cream)]">
                        Recommended
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {hospital.neighborhood && (
                      <span className="rounded-full border border-[var(--twilight)]/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                        {hospital.neighborhood}
                      </span>
                    )}
                    {hospital.phone && (
                      <span className="rounded-full border border-[var(--twilight)]/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                        Main Desk Available
                      </span>
                    )}
                    <span className="rounded-full border border-[var(--twilight)]/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                      Wayfinding Ready
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <HospitalTrackedLink
                      href={`/${portal.slug}/hospitals/${hospital.slug}?mode=${mode}`}
                      tracking={{
                        actionType: "resource_clicked",
                        portalSlug: portal.slug,
                        hospitalSlug: hospital.slug,
                        modeContext: mode,
                        sectionKey: "directory_cards",
                        targetKind: "hospital_guide",
                        targetId: hospital.slug,
                        targetLabel: hospital.name,
                      }}
                      className="inline-flex items-center rounded-lg bg-[var(--action-primary)] px-3 py-1.5 text-xs font-medium text-[var(--btn-primary-text)] transition-colors hover:bg-[var(--action-primary-hover)]"
                    >
                      Open Hospital Guide
                    </HospitalTrackedLink>
                    <HospitalTrackedLink
                      href={getHospitalWayfindingHref(hospital)}
                      external
                      tracking={{
                        actionType: "wayfinding_opened",
                        portalSlug: portal.slug,
                        hospitalSlug: hospital.slug,
                        modeContext: mode,
                        sectionKey: "directory_cards",
                        targetKind: "wayfinding",
                        targetId: hospital.slug,
                        targetLabel: hospital.name,
                      }}
                      className="inline-flex items-center rounded-lg border border-[var(--twilight)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] transition-colors hover:bg-[var(--twilight)]/25"
                    >
                      Open Wayfinding
                    </HospitalTrackedLink>
                    {hospital.phone && (
                      <a
                        href={`tel:${hospital.phone}`}
                        className="inline-flex items-center rounded-lg border border-[var(--twilight)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] transition-colors hover:bg-[var(--twilight)]/25"
                      >
                        Call Main Desk
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </section>
          )}

          <section className="directory-reveal directory-delay-2 rounded-2xl border border-[var(--twilight)]/40 bg-[var(--card-bg)] p-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <article className="rounded-xl border border-[var(--twilight)]/35 bg-[var(--night)]/35 p-4">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Proof Track 1</p>
                <p className="mt-1 text-sm font-semibold text-[var(--cream)]">Campus Precision</p>
                <p className="mt-2 text-xs text-[var(--muted)]">Every card routes to hospital-specific support instead of generic feeds.</p>
              </article>
              <article className="rounded-xl border border-[var(--twilight)]/35 bg-[var(--night)]/35 p-4">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Proof Track 2</p>
                <p className="mt-1 text-sm font-semibold text-[var(--cream)]">Wayfinding Handoff</p>
                <p className="mt-2 text-xs text-[var(--muted)]">One-click handoff into partner navigation to reduce time-to-destination.</p>
              </article>
              <article className="rounded-xl border border-[var(--twilight)]/35 bg-[var(--night)]/35 p-4">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Proof Track 3</p>
                <p className="mt-1 text-sm font-semibold text-[var(--cream)]">Attribution Integrity</p>
                <p className="mt-2 text-xs text-[var(--muted)]">Data cards preserve source trust cues and enforce competitor exclusions.</p>
              </article>
            </div>
          </section>

          <section className="directory-reveal directory-delay-3 flex flex-wrap items-center justify-between gap-3">
            <HospitalTrackedLink
              href={`/${portal.slug}?mode=${mode}`}
              tracking={{
                actionType: "resource_clicked",
                portalSlug: portal.slug,
                modeContext: mode,
                sectionKey: "directory_footer",
                targetKind: "overview",
                targetLabel: "Back to Emory overview",
              }}
              className="text-xs text-[var(--muted)] hover:text-[var(--cream)]"
            >
              Back to Emory overview
            </HospitalTrackedLink>
            <HospitalTrackedLink
              href={`/${portal.slug}?view=find&type=events&mode=${mode}`}
              tracking={{
                actionType: "resource_clicked",
                portalSlug: portal.slug,
                modeContext: mode,
                sectionKey: "directory_footer",
                targetKind: "community_events",
                targetLabel: "Browse Community Health",
              }}
              className="inline-flex items-center rounded-lg border border-[var(--twilight)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--twilight)]/25"
            >
              Browse Community Health
            </HospitalTrackedLink>
          </section>
        </div>
      </main>
    </div>
  );
}
