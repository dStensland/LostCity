import FeedShell from "@/components/feed/FeedShell";
import CuratedContent from "@/components/feed/CuratedContent";
import type { Portal } from "@/lib/portal-context";
import {
  getHospitalBookVisitHref,
  getHospitalWayfindingHref,
  getPortalHospitalLocations,
  type HospitalLocation,
} from "@/lib/hospitals";
import {
  HOSPITAL_MODE_CONFIG,
  HOSPITAL_MODE_LIST,
  type HospitalAudienceMode,
} from "@/lib/hospital-modes";
import {
  getEmoryPersonaProfile,
  type EmoryPersonaKey,
} from "@/lib/emory-personas";
import {
  getEmorySourcesByRail,
  type EmorySourcePolicyItem,
} from "@/lib/emory-source-policy";
import { getEmoryFeedCopy } from "@/lib/emory-copywriter";
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

type FeedTab = "curated" | "foryou";

type NextAction = {
  key: string;
  label: string;
  hint: string;
  href: string;
  external?: boolean;
  actionType: "resource_clicked" | "wayfinding_opened";
  targetKind: string;
  proofTag: string;
};

type HospitalPortalExperienceProps = {
  portal: Portal;
  feedTab: FeedTab;
  mode: HospitalAudienceMode;
  persona: EmoryPersonaKey;
};

const HERO_PHOTO_URL =
  "https://images.unsplash.com/photo-1666214280391-8ff5bd3c0bf0?auto=format&fit=crop&w=2000&q=80";

const HOSPITAL_CARD_PHOTOS = [
  "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1571772996211-2f02c9727629?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?auto=format&fit=crop&w=1200&q=80",
];

const COMMUNITY_TRACK_PHOTOS: Record<string, string> = {
  prevention: "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1400&q=80",
  food_support: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1400&q=80",
  community_wellness: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1400&q=80",
};

function SourceCard({ source }: { source: EmorySourcePolicyItem }) {
  return (
    <article className="emory-panel-subtle rounded-xl p-4">
      <p className="emory-kicker">{source.rail === "emory_owned" ? "Emory-Owned" : "Atlanta Federation"}</p>
      <h3 className="mt-1 text-sm font-semibold text-[var(--cream)]">{source.name}</h3>
      <p className="mt-1 text-xs text-[var(--muted)]">{source.focus}</p>
      <p className="mt-2 text-[11px] text-[var(--muted)]">{source.class} · {source.tier}</p>
    </article>
  );
}

function formatStorySchedule(story: EmoryCommunityStory): string {
  const date = formatSmartDate(story.startDate);
  if (story.isAllDay) return `${date.label} · All Day`;
  const time = formatTime(story.startTime, false);
  return `${date.label} · ${time}`;
}

function buildNextActions(args: {
  portal: Portal;
  mode: HospitalAudienceMode;
  persona: EmoryPersonaKey;
  primaryHospital: HospitalLocation | null;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  tertiaryActionLabel: string;
}): NextAction[] {
  const {
    portal,
    mode,
    persona,
    primaryHospital,
    primaryActionLabel,
    secondaryActionLabel,
    tertiaryActionLabel,
  } = args;

  if (!primaryHospital) {
    return [
      {
        key: "directory",
        label: primaryActionLabel,
        hint: "Choose a campus and launch the right path",
        href: `/${portal.slug}/hospitals?mode=${mode}&persona=${persona}`,
        actionType: "resource_clicked",
        targetKind: "hospital_directory",
        proofTag: "Primary",
      },
      {
        key: "directions",
        label: secondaryActionLabel,
        hint: "Open route options and entry guidance",
        href: `/${portal.slug}/hospitals?mode=${mode}&persona=${persona}`,
        actionType: "resource_clicked",
        targetKind: "hospital_directory",
        proofTag: "Fast Path",
      },
      {
        key: "services",
        label: tertiaryActionLabel,
        hint: "Browse campus services and nearby essentials",
        href: `/${portal.slug}?view=find&type=events&mode=${mode}&persona=${persona}`,
        actionType: "resource_clicked",
        targetKind: "services_overview",
        proofTag: "Details",
      },
    ];
  }

  const bookHref = getHospitalBookVisitHref(primaryHospital);
  const wayfindingHref = getHospitalWayfindingHref(primaryHospital);

  return [
    {
      key: "book-visit",
      label: primaryActionLabel,
      hint: "Open official Emory booking or intake entrypoint",
      href: bookHref,
      external: /^https?:\/\//i.test(bookHref),
      actionType: "resource_clicked",
      targetKind: "book_visit",
      proofTag: "Primary",
    },
    {
      key: "directions",
      label: secondaryActionLabel,
      hint: "Launch wayfinding for the selected hospital",
      href: wayfindingHref,
      external: true,
      actionType: "wayfinding_opened",
      targetKind: "wayfinding",
      proofTag: "Fast Path",
    },
    {
      key: "services",
      label: tertiaryActionLabel,
      hint: "Open services, food, lodging, and open-late details",
      href: `/${portal.slug}/hospitals/${primaryHospital.slug}?mode=${mode}&persona=${persona}`,
      actionType: "resource_clicked",
      targetKind: "hospital_companion",
      proofTag: "Details",
    },
  ];
}

export default async function HospitalPortalExperience({
  portal,
  feedTab,
  mode,
  persona,
}: HospitalPortalExperienceProps) {
  const hospitals = await getPortalHospitalLocations(portal.id);

  if (!isEmoryDemoPortal(portal.slug)) {
    return (
      <FeedShell
        portalId={portal.id}
        portalSlug={portal.slug}
        activeTab={feedTab}
        curatedContent={<CuratedContent portalSlug={portal.slug} />}
      />
    );
  }

  const personaProfile = getEmoryPersonaProfile(persona);
  const modeConfig = HOSPITAL_MODE_CONFIG[mode];
  const primaryHospital = hospitals[0] || null;
  const emoryOwnedSources = getEmorySourcesByRail("emory_owned");
  const communityDigest = await getEmoryCommunityDigest({
    portalSlug: portal.slug,
    mode,
  });
  const communitySourceCards = Array.from(
    new Map(
      communityDigest.tracks.flatMap((track) => {
        const tierBySource = new Map(
          track.stories
            .filter((story) => Boolean(story.sourceTier))
            .map((story) => [story.sourceName.toLowerCase(), story.sourceTier] as const)
        );
        return track.sourceNames.map((sourceName) => ({
          key: `${track.key}:${sourceName.toLowerCase()}`,
          sourceName,
          trackTitle: track.title,
          sourceTier: tierBySource.get(sourceName.toLowerCase()) || null,
        }));
      })
        .map((item) => [item.sourceName.toLowerCase(), item] as const)
    ).values()
  ).slice(0, 6);
  const nextActions = buildNextActions({
    portal,
    mode,
    persona,
    primaryHospital,
    primaryActionLabel: personaProfile.primaryActionLabel,
    secondaryActionLabel: personaProfile.secondaryActionLabel,
    tertiaryActionLabel: personaProfile.tertiaryActionLabel,
  });

  const railActions: EmoryActionRailAction[] = nextActions.map((action) => ({
    key: action.key,
    label: action.label,
    href: action.href,
    external: action.external,
    actionType: action.actionType,
    targetKind: action.targetKind,
    targetId: primaryHospital?.slug,
    targetLabel: primaryHospital?.short_name || primaryHospital?.name,
  }));

  const wayfindingPartner =
    typeof portal.settings?.wayfinding_partner === "string"
      ? portal.settings.wayfinding_partner
      : "gozio";
  const copy = getEmoryFeedCopy({
    personaProfile,
    mode,
    modeConfig,
  });

  return (
    <>
      <style>{`
        @keyframes emoryReveal {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .emory-reveal { opacity: 1; animation: emoryReveal 480ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards; }
        .emory-delay-1 { animation-delay: 80ms; }
        .emory-delay-2 { animation-delay: 140ms; }
        ${EMORY_THEME_CSS}
      `}</style>

      <div className={`${hospitalBodyFont.className} ${EMORY_THEME_SCOPE_CLASS} py-8 space-y-7`}>
        <section
          className="emory-reveal emory-photo-hero rounded-[30px] p-6 sm:p-7"
          style={{ ["--hero-image" as string]: `url('${HERO_PHOTO_URL}')` }}
        >
          <div className="relative z-[1] grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
            <div>
              <p className="emory-kicker">{copy.heroKicker}</p>
              <h1 className={`emory-hero-title mt-3 font-serif text-[clamp(2.15rem,4.3vw,3.5rem)] leading-[0.98] tracking-[-0.018em] ${hospitalDisplayFont.className}`}>
                {copy.heroTitle}
              </h1>
              <p className="emory-hero-lede mt-4 max-w-4xl text-[1.05rem] leading-relaxed">
                {copy.heroSummary}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="emory-hero-chip">Wayfinding via {wayfindingPartner}</span>
                <span className="emory-hero-chip">Strict Attribution</span>
                <span className="emory-hero-chip">Community Resource Scope</span>
                <span className="emory-hero-chip">
                  {communityDigest.storyCount > 0
                    ? `${communityDigest.storyCount} live community briefings`
                    : "Community briefings syncing"}
                </span>
              </div>
            </div>

            <aside className="emory-hero-lens rounded-2xl p-5">
              <p className="emory-kicker">{copy.focusKicker}</p>
              <h2 className="mt-2 text-base font-semibold text-[var(--cream)]">{personaProfile.focusTitle}</h2>
              <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">{personaProfile.focusNarrative}</p>
              <div className="mt-4 rounded-xl border border-[#b5ddaf] bg-[#e7f5e5] p-3">
                <p className="emory-kicker">{copy.priorityKicker}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--cream)]">{modeConfig.heroHint}</p>
              </div>
              <div className="mt-2 rounded-xl border border-[var(--twilight)] p-3">
                <p className="emory-kicker">{copy.trustKicker}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{copy.trustBody}</p>
              </div>
            </aside>
          </div>

          <div className="relative z-[1] mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className="emory-hero-lens rounded-2xl p-5">
              <p className="emory-kicker">Step 1</p>
              <h3 className="mt-2 text-base font-semibold text-[var(--cream)]">{copy.step1Title}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{copy.step1Summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {HOSPITAL_MODE_LIST.map((candidateMode) => {
                  const active = candidateMode.key === mode;
                  return (
                    <HospitalTrackedLink
                      key={candidateMode.key}
                      href={`/${portal.slug}?mode=${candidateMode.key}&persona=${persona}`}
                      tracking={{
                        actionType: "mode_selected",
                        portalSlug: portal.slug,
                        modeContext: candidateMode.key,
                        sectionKey: "v2_step1",
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
            </section>

            <section className="emory-hero-lens rounded-2xl p-5">
              <p className="emory-kicker">Step 2</p>
              <h3 className="mt-2 text-base font-semibold text-[var(--cream)]">{copy.step2Title}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{copy.step2Summary}</p>
              <div className="mt-3 space-y-2">
                {hospitals.slice(0, 4).map((hospital, index) => (
                  <article key={hospital.id} className={`rounded-xl border p-3 ${index === 0 ? "border-[#b4dcad] bg-[#e7f5e5]" : "border-[var(--twilight)] bg-white"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--cream)]">{hospital.short_name || hospital.name}</p>
                        <p className="text-xs text-[var(--muted)] mt-1">{hospital.address}</p>
                      </div>
                      {index === 0 && <span className="emory-chip">Recommended</span>}
                    </div>
                    <HospitalTrackedLink
                      href={`/${portal.slug}/hospitals/${hospital.slug}?mode=${mode}&persona=${persona}`}
                      tracking={{
                        actionType: "resource_clicked",
                        portalSlug: portal.slug,
                        hospitalSlug: hospital.slug,
                        modeContext: mode,
                        sectionKey: "v2_step2",
                        targetKind: "hospital_companion",
                        targetId: hospital.slug,
                        targetLabel: hospital.short_name || hospital.name,
                      }}
                      className="emory-secondary-btn mt-2 inline-flex items-center px-2.5 py-1 text-xs"
                    >
                      {personaProfile.companionActionLabel}
                    </HospitalTrackedLink>
                  </article>
                ))}
              </div>
            </section>

            <section className="emory-hero-lens rounded-2xl p-5">
              <p className="emory-kicker">Step 3</p>
              <h3 className="mt-2 text-base font-semibold text-[var(--cream)]">{copy.step3Title}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{copy.step3Summary}</p>
              <div className="mt-3 space-y-2">
                {nextActions.map((action, index) => (
                  <HospitalTrackedLink
                    key={action.key}
                    href={action.href}
                    external={action.external}
                    tracking={{
                      actionType: action.actionType,
                      portalSlug: portal.slug,
                      hospitalSlug: primaryHospital?.slug,
                      modeContext: mode,
                      sectionKey: "v2_step3",
                      targetKind: action.targetKind,
                      targetId: action.key,
                      targetLabel: action.label,
                      targetUrl: action.href,
                    }}
                    className={`${index === 0 ? "emory-primary-btn" : "emory-secondary-btn"} flex w-full flex-col rounded-xl px-3 py-2.5`}
                  >
                    <span className="text-xs font-semibold">{action.label}</span>
                    <span className="text-[11px] text-[var(--muted)]">{action.hint}</span>
                    <span className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">{action.proofTag}</span>
                  </HospitalTrackedLink>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="emory-reveal emory-delay-1 emory-panel emory-warm-section rounded-[28px] p-6 sm:p-7" id="emory-owned-rail">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="emory-kicker">Emory-Owned Network</p>
              <h2 className={`mt-1 text-[clamp(1.2rem,2.5vw,1.9rem)] font-semibold text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                {copy.railATitle}
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)] max-w-3xl">
                {copy.railASummary}
              </p>
            </div>
            <span className="emory-chip">Official Sources</span>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {hospitals.map((hospital, index) => (
              <article key={hospital.id} className="emory-panel-subtle rounded-xl p-4">
                <div
                  className="emory-photo-card mb-3"
                  style={{ ["--photo" as string]: `url('${HOSPITAL_CARD_PHOTOS[index % HOSPITAL_CARD_PHOTOS.length]}')` }}
                />
                <p className="text-sm font-semibold text-[var(--cream)]">{hospital.short_name || hospital.name}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{hospital.address}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <HospitalTrackedLink
                    href={`/${portal.slug}/hospitals/${hospital.slug}?mode=${mode}&persona=${persona}`}
                    tracking={{
                      actionType: "resource_clicked",
                      portalSlug: portal.slug,
                      hospitalSlug: hospital.slug,
                      modeContext: mode,
                      sectionKey: "v2_owned_rail",
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
                      sectionKey: "v2_owned_rail",
                      targetKind: "wayfinding",
                      targetId: hospital.slug,
                      targetLabel: hospital.short_name || hospital.name,
                    }}
                    className="emory-secondary-btn inline-flex items-center px-3 py-1.5 text-xs"
                  >
                    Open Wayfinding
                  </HospitalTrackedLink>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {emoryOwnedSources.map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
        </section>

        <section className="emory-reveal emory-delay-2 emory-panel rounded-[28px] p-6 sm:p-7" id="atlanta-federated-rail">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="emory-kicker">Atlanta Federation</p>
              <h2 className={`mt-1 text-[clamp(1.2rem,2.5vw,1.9rem)] font-semibold text-[var(--cream)] ${hospitalDisplayFont.className}`}>
                {copy.railBTitle}
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)] max-w-3xl">
                {copy.railBSummary}
              </p>
            </div>
            <span className="emory-chip">
              {communityDigest.isLive ? "Live Community Feed" : "Seeded While Syncing"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {communityDigest.tracks.map((track) => (
              <article key={track.key} className="emory-panel-subtle rounded-xl p-4">
                <div
                  className="emory-photo-card mb-3 min-h-[112px]"
                  style={{ ["--photo" as string]: `url('${COMMUNITY_TRACK_PHOTOS[track.key] || COMMUNITY_TRACK_PHOTOS.community_wellness}')` }}
                />
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
                              hospitalSlug: primaryHospital?.slug,
                              modeContext: mode,
                              sectionKey: "v2_federated_rail",
                              targetKind: "community_story",
                              targetId: story.id,
                              targetLabel: story.title,
                              targetUrl: openHref,
                            }}
                            className="emory-primary-btn inline-flex items-center px-3 py-1.5 text-xs"
                          >
                            {copy.briefingCtaLabel}
                          </HospitalTrackedLink>
                          {story.sourceUrl !== "#" && (
                            <HospitalTrackedLink
                              href={story.sourceUrl}
                              external
                              tracking={{
                                actionType: "resource_clicked",
                                portalSlug: portal.slug,
                                hospitalSlug: primaryHospital?.slug,
                                modeContext: mode,
                                sectionKey: "v2_federated_rail",
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
                  <p className="mt-3 text-[11px] text-[var(--muted)]">
                    Sources: {track.sourceNames.join(" · ")}
                  </p>
                )}
              </article>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {communitySourceCards.map((source) => (
              <article key={source.key} className="emory-panel-subtle rounded-xl p-4">
                <p className="emory-kicker">Atlanta Federation</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--cream)]">{source.sourceName}</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">Primary track: {source.trackTitle}</p>
                {source.sourceTier && (
                  <p className="mt-1 text-[11px] text-[var(--muted)]">Trust tier: {source.sourceTier}</p>
                )}
              </article>
            ))}
          </div>
        </section>

        {railActions.length > 0 && (
          <EmoryActionRail
            portalSlug={portal.slug}
            mode={mode}
            hospitalSlug={primaryHospital?.slug || undefined}
            sectionKey="v2_action_rail"
            actions={railActions}
          />
        )}
      </div>
    </>
  );
}
