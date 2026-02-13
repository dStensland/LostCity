import { notFound } from "next/navigation";
import { AmbientBackground } from "@/components/ambient";
import { EmoryDemoHeader, PortalHeader } from "@/components/headers";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import {
  getHospitalBookVisitHref,
  getHospitalWayfindingHref,
  getPortalHospitalLocations,
} from "@/lib/hospitals";
import {
  HOSPITAL_MODE_LIST,
  normalizeHospitalMode,
} from "@/lib/hospital-modes";
import {
  getEmoryPersonaProfile,
  normalizeEmoryPersona,
} from "@/lib/emory-personas";
import {
  getEmorySourcesByRail,
  EMORY_COMPETITOR_EXCLUSIONS,
} from "@/lib/emory-source-policy";
import { getEmoryDirectoryCopy } from "@/lib/emory-copywriter";
import { formatSmartDate, formatTime } from "@/lib/formats";
import { getEmoryCommunityDigest, type EmoryCommunityStory } from "@/lib/emory-community-feed";
import {
  EMORY_THEME_CSS,
  EMORY_THEME_SCOPE_CLASS,
  hospitalBodyFont,
  hospitalDisplayFont,
  isEmoryDemoPortal,
} from "@/lib/hospital-art";
import HospitalTrackedLink from "@/app/[portal]/_components/hospital/HospitalTrackedLink";
import EmoryActionRail, { type EmoryActionRailAction } from "@/app/[portal]/_components/hospital/EmoryActionRail";

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<{ mode?: string; persona?: string }>;
};

const DIRECTORY_HERO_PHOTO_URL =
  "https://images.unsplash.com/photo-1666214280557-f1b5022eb634?auto=format&fit=crop&w=2000&q=80";

const DIRECTORY_CARD_PHOTOS = [
  "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1504813184591-01572f98c85f?auto=format&fit=crop&w=1200&q=80",
];

function formatStorySchedule(story: EmoryCommunityStory): string {
  const date = formatSmartDate(story.startDate);
  if (story.isAllDay) return `${date.label} · All Day`;
  return `${date.label} · ${formatTime(story.startTime, false)}`;
}

export default async function HospitalDirectoryPage({ params, searchParams }: Props) {
  const { portal: portalSlug } = await params;
  const searchParamsData = await searchParams;

  const portal = await getCachedPortalBySlug(portalSlug);
  if (!portal) notFound();
  const isEmoryBrand = isEmoryDemoPortal(portal.slug);
  if (getPortalVertical(portal) !== "hospital" && !isEmoryBrand) notFound();

  const mode = normalizeHospitalMode(searchParamsData.mode);
  const persona = normalizeEmoryPersona(searchParamsData.persona);
  const personaProfile = getEmoryPersonaProfile(persona);
  const copy = getEmoryDirectoryCopy({
    personaProfile,
    mode,
  });

  const hospitals = await getPortalHospitalLocations(portal.id);
  const primaryHospital = hospitals[0] || null;
  const communityDigest = await getEmoryCommunityDigest({
    portalSlug: portal.slug,
    mode,
  });

  const emoryOwnedSources = getEmorySourcesByRail("emory_owned");

  const railActions: EmoryActionRailAction[] = primaryHospital
    ? [
        {
          key: "book-visit",
          label: personaProfile.primaryActionLabel,
          href: getHospitalBookVisitHref(primaryHospital),
          external: /^https?:\/\//i.test(getHospitalBookVisitHref(primaryHospital)),
          actionType: "resource_clicked",
          targetKind: "book_visit",
          targetId: primaryHospital.slug,
          targetLabel: primaryHospital.short_name || primaryHospital.name,
        },
        {
          key: "get-directions",
          label: personaProfile.secondaryActionLabel,
          href: getHospitalWayfindingHref(primaryHospital),
          external: true,
          actionType: "wayfinding_opened",
          targetKind: "wayfinding",
          targetId: primaryHospital.slug,
          targetLabel: primaryHospital.short_name || primaryHospital.name,
        },
        {
          key: "view-services",
          label: personaProfile.tertiaryActionLabel,
          href: `/${portal.slug}/hospitals/${primaryHospital.slug}?mode=${mode}&persona=${persona}`,
          actionType: "resource_clicked",
          targetKind: "hospital_companion",
          targetId: primaryHospital.slug,
          targetLabel: primaryHospital.short_name || primaryHospital.name,
        },
      ]
    : [];

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
          @keyframes directoryReveal {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .directory-reveal { opacity: 1; animation: directoryReveal 440ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards; }
          .directory-delay-1 { animation-delay: 80ms; }
          .directory-delay-2 { animation-delay: 140ms; }
          ${EMORY_THEME_CSS}
        `}</style>

        <div className={`${hospitalBodyFont.className} ${isEmoryBrand ? EMORY_THEME_SCOPE_CLASS : ""} py-8 space-y-7`}>
          <section
            className="directory-reveal emory-photo-hero rounded-[30px] p-6 sm:p-7"
            style={{ ["--hero-image" as string]: `url('${DIRECTORY_HERO_PHOTO_URL}')` }}
          >
            <div className="relative z-[1] grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
              <div>
                <p className="emory-kicker">{copy.heroKicker}</p>
                <h1 className={`emory-hero-title mt-3 font-serif text-[clamp(2.1rem,4.2vw,3.4rem)] leading-[0.99] tracking-[-0.018em] ${hospitalDisplayFont.className}`}>
                  {copy.heroTitle}
                </h1>
                <p className="emory-hero-lede mt-4 text-base max-w-4xl leading-relaxed">
                  {copy.heroSummary}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {HOSPITAL_MODE_LIST.map((candidateMode) => {
                    const isActive = candidateMode.key === mode;
                    return (
                      <HospitalTrackedLink
                        key={candidateMode.key}
                        href={`/${portal.slug}/hospitals?mode=${candidateMode.key}&persona=${persona}`}
                        tracking={{
                          actionType: "mode_selected",
                          portalSlug: portal.slug,
                          modeContext: candidateMode.key,
                          sectionKey: "v2_directory_modes",
                          targetKind: "mode",
                          targetId: candidateMode.key,
                          targetLabel: candidateMode.label,
                        }}
                        className={isActive ? "emory-primary-btn inline-flex items-center px-3 py-1.5 text-xs" : "emory-secondary-btn inline-flex items-center px-3 py-1.5 text-xs"}
                      >
                        {candidateMode.shortLabel}
                      </HospitalTrackedLink>
                    );
                  })}
                </div>
              </div>

              <aside className="emory-hero-lens rounded-2xl p-5">
                <p className="emory-kicker">{copy.lensKicker}</p>
                <h2 className="mt-2 text-base font-semibold text-[var(--cream)]">{personaProfile.focusTitle}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">{copy.modeTone}</p>
                <div className="mt-3 rounded-xl border border-[#b5ddaf] bg-[#e7f5e5] p-3">
                  <p className="emory-kicker">{copy.objectiveKicker}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{copy.objectiveBody}</p>
                </div>
                <div className="mt-2 rounded-xl border border-[var(--twilight)] p-3">
                  <p className="emory-kicker">{copy.guardrailKicker}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {copy.guardrailBody} Competitor exclusion active: {EMORY_COMPETITOR_EXCLUSIONS.join(", ")}.
                  </p>
                </div>
                <div className="mt-2 rounded-xl border border-[var(--twilight)] p-3">
                  <p className="emory-kicker">{copy.federationKicker}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {communityDigest.storyCount > 0
                      ? `${communityDigest.storyCount} ${copy.federationLiveLabel}`
                      : copy.federationSyncingLabel}
                  </p>
                </div>
              </aside>
            </div>
          </section>

          <section className="directory-reveal directory-delay-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            {hospitals.map((hospital, index) => (
              <article key={hospital.id} className="emory-panel rounded-2xl p-5">
                <div
                  className="emory-photo-card mb-3 min-h-[114px]"
                  style={{ ["--photo" as string]: `url('${DIRECTORY_CARD_PHOTOS[index % DIRECTORY_CARD_PHOTOS.length]}')` }}
                />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--cream)]">{hospital.short_name || hospital.name}</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">{hospital.address}</p>
                  </div>
                  {index === 0 && <span className="emory-chip">Recommended</span>}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {hospital.neighborhood && <span className="emory-chip">{hospital.neighborhood}</span>}
                  <span className="emory-chip">Navigation Ready</span>
                  {hospital.phone && <span className="emory-chip">Main Desk</span>}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <HospitalTrackedLink
                    href={`/${portal.slug}/hospitals/${hospital.slug}?mode=${mode}&persona=${persona}`}
                    tracking={{
                      actionType: "resource_clicked",
                      portalSlug: portal.slug,
                      hospitalSlug: hospital.slug,
                      modeContext: mode,
                      sectionKey: "v2_directory_cards",
                      targetKind: "hospital_companion",
                      targetId: hospital.slug,
                      targetLabel: hospital.short_name || hospital.name,
                    }}
                    className="emory-primary-btn inline-flex items-center px-3 py-1.5 text-xs"
                  >
                    Open Companion
                  </HospitalTrackedLink>

                  <HospitalTrackedLink
                    href={getHospitalWayfindingHref(hospital)}
                    external
                    tracking={{
                      actionType: "wayfinding_opened",
                      portalSlug: portal.slug,
                      hospitalSlug: hospital.slug,
                      modeContext: mode,
                      sectionKey: "v2_directory_cards",
                      targetKind: "wayfinding",
                      targetId: hospital.slug,
                      targetLabel: hospital.short_name || hospital.name,
                    }}
                    className="emory-secondary-btn inline-flex items-center px-3 py-1.5 text-xs"
                  >
                    Open Wayfinding
                  </HospitalTrackedLink>

                  {hospital.phone && (
                    <a href={`tel:${hospital.phone}`} className="emory-secondary-btn inline-flex items-center px-3 py-1.5 text-xs">
                      Call Main Desk
                    </a>
                  )}
                </div>
              </article>
            ))}
          </section>

          <section className="directory-reveal directory-delay-2 emory-panel rounded-2xl p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <article className="emory-panel-subtle rounded-xl p-4">
                <p className="emory-kicker">Emory-Owned Network</p>
                <h3 className="mt-1 text-base font-semibold text-[var(--cream)]">{copy.railATitle}</h3>
                <div className="mt-3 space-y-2">
                  {emoryOwnedSources.map((source) => (
                    <div key={source.id} className="rounded-lg border border-[var(--twilight)] bg-white p-3">
                      <p className="text-sm font-semibold text-[var(--cream)]">{source.name}</p>
                      <p className="text-xs text-[var(--muted)] mt-1">{source.focus}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="emory-panel-subtle rounded-xl p-4">
                <p className="emory-kicker">Atlanta Federation</p>
                <h3 className="mt-1 text-base font-semibold text-[var(--cream)]">{copy.railBTitle}</h3>
                <p className="mt-1 text-[11px] text-[var(--muted)]">{copy.railBSubcopy}</p>
                <div className="mt-3 space-y-2">
                  {communityDigest.tracks.map((track) => {
                    const story = track.stories[0];
                    const openHref = story?.eventId
                      ? `/${portal.slug}?view=find&type=events&event=${story.eventId}&mode=${mode}&persona=${persona}`
                      : `/${portal.slug}?view=find&type=events&search=${encodeURIComponent(track.title)}&mode=${mode}&persona=${persona}`;

                    return (
                      <article key={track.key} className="rounded-lg border border-[var(--twilight)] bg-white p-3">
                        <p className="text-sm font-semibold text-[var(--cream)]">{track.title}</p>
                        <p className="text-xs text-[var(--muted)] mt-1">{track.blurb}</p>
                        {story && (
                          <>
                            <p className="mt-2 text-xs font-semibold text-[var(--cream)]">{story.title}</p>
                            <p className="text-[11px] text-[var(--muted)]">
                              {formatStorySchedule(story)}
                              {story.neighborhood ? ` · ${story.neighborhood}` : ""}
                            </p>
                            <p className="text-[11px] text-[var(--muted)]">
                              Source: {story.sourceName}
                              {story.sourceTier ? ` · ${story.sourceTier}` : ""}
                            </p>
                          </>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <HospitalTrackedLink
                            href={openHref}
                            tracking={{
                              actionType: "resource_clicked",
                              portalSlug: portal.slug,
                              hospitalSlug: primaryHospital?.slug,
                              modeContext: mode,
                              sectionKey: "v2_directory_federated_rail",
                              targetKind: "community_track",
                              targetId: track.key,
                              targetLabel: track.title,
                              targetUrl: openHref,
                            }}
                            className="emory-secondary-btn inline-flex items-center px-3 py-1.5 text-xs"
                          >
                            {copy.briefingCtaLabel}
                          </HospitalTrackedLink>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </article>
            </div>
          </section>

          {isEmoryBrand && railActions.length > 0 && (
            <EmoryActionRail
              portalSlug={portal.slug}
              mode={mode}
              hospitalSlug={primaryHospital?.slug}
              sectionKey="v2_directory_action_rail"
              actions={railActions}
            />
          )}
        </div>
      </main>
    </div>
  );
}
