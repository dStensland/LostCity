import FeedShell from "@/components/feed/FeedShell";
import CuratedContent from "@/components/feed/CuratedContent";
import type { Portal } from "@/lib/portal-context";
import {
  getHospitalWayfindingHref,
  getPortalHospitalLocations,
  type HospitalLocation,
} from "@/lib/hospitals";
import HospitalTrackedLink from "@/app/[portal]/_components/hospital/HospitalTrackedLink";
import {
  HOSPITAL_MODE_LIST,
  HOSPITAL_MODE_CONFIG,
  type HospitalAudienceMode,
} from "@/lib/hospital-modes";

type FeedTab = "curated" | "foryou";

type GoldenAction = {
  key: string;
  label: string;
  hint: string;
  href: string;
  external?: boolean;
  actionType: "resource_clicked" | "wayfinding_opened";
  targetKind: string;
  sectionKey: string;
  proofTag: string;
};

type ExplorationTrack = {
  key: string;
  title: string;
  subtitle: string;
  description: string;
  href: string;
  targetKind: string;
  chips: string[];
  trustNote: string;
  accent: string;
};

interface HospitalPortalExperienceProps {
  portal: Portal;
  feedTab: FeedTab;
  mode: HospitalAudienceMode;
}

const MODE_VISUAL: Record<HospitalAudienceMode, { halo: string; border: string; chip: string }> = {
  urgent: {
    halo: "from-[#bf3a2d]/28 via-[var(--action-primary)]/18 to-transparent",
    border: "border-[#bf3a2d]/45",
    chip: "bg-[#bf3a2d]/16 border-[#bf3a2d]/50",
  },
  treatment: {
    halo: "from-[#2f66ab]/24 via-[var(--action-primary)]/18 to-transparent",
    border: "border-[#2f66ab]/45",
    chip: "bg-[#2f66ab]/16 border-[#2f66ab]/50",
  },
  visitor: {
    halo: "from-[var(--action-primary)]/24 via-[var(--portal-accent)]/20 to-transparent",
    border: "border-[var(--action-primary)]/45",
    chip: "bg-[var(--action-primary)]/14 border-[var(--action-primary)]/45",
  },
  staff: {
    halo: "from-[#2b7a6b]/24 via-[var(--portal-accent)]/20 to-transparent",
    border: "border-[#2b7a6b]/45",
    chip: "bg-[#2b7a6b]/16 border-[#2b7a6b]/45",
  },
};

function getGoldenActions(args: {
  portal: Portal;
  mode: HospitalAudienceMode;
  primaryHospital: HospitalLocation | null;
}): GoldenAction[] {
  const { portal, mode, primaryHospital } = args;

  if (!primaryHospital) {
    return [
      {
        key: "directory",
        label: "Open Hospital Directory",
        hint: "Choose a campus before starting",
        href: `/${portal.slug}/hospitals?mode=${mode}`,
        actionType: "resource_clicked",
        targetKind: "hospital_directory",
        sectionKey: "golden_step3",
        proofTag: "Context Set",
      },
      {
        key: "events",
        label: "Browse Community Health",
        hint: "Public health and wellness events",
        href: `/${portal.slug}?view=find&type=events&mode=${mode}`,
        actionType: "resource_clicked",
        targetKind: "community_events",
        sectionKey: "golden_step3",
        proofTag: "Discovery",
      },
    ];
  }

  const guideHref = `/${portal.slug}/hospitals/${primaryHospital.slug}?mode=${mode}`;
  const directoryHref = `/${portal.slug}/hospitals?mode=${mode}`;
  const eventsHref = `/${portal.slug}?view=find&type=events&mode=${mode}`;
  const wayfindingHref = getHospitalWayfindingHref(primaryHospital);

  if (mode === "urgent") {
    return [
      {
        key: "wayfinding",
        label: `Start Wayfinding to ${primaryHospital.short_name || primaryHospital.name}`,
        hint: "Fastest path to entrances and critical services",
        href: wayfindingHref,
        external: true,
        actionType: "wayfinding_opened",
        targetKind: "golden_wayfinding",
        sectionKey: "golden_step3",
        proofTag: "Primary Conversion",
      },
      {
        key: "guide",
        label: "Open Immediate Support Guide",
        hint: "Late-hour essentials, contacts, and support services",
        href: guideHref,
        actionType: "resource_clicked",
        targetKind: "golden_hospital_guide",
        sectionKey: "golden_step3",
        proofTag: "Support",
      },
      {
        key: "directory",
        label: "Switch Hospital",
        hint: "Go to full Emory location directory",
        href: directoryHref,
        actionType: "resource_clicked",
        targetKind: "hospital_directory",
        sectionKey: "golden_step3",
        proofTag: "Fallback",
      },
    ];
  }

  if (mode === "staff") {
    return [
      {
        key: "wayfinding",
        label: "Open Shift Wayfinding",
        hint: "Campus routing + fastest operational paths",
        href: wayfindingHref,
        external: true,
        actionType: "wayfinding_opened",
        targetKind: "golden_wayfinding",
        sectionKey: "golden_step3",
        proofTag: "Primary Conversion",
      },
      {
        key: "guide",
        label: "Open Staff Support Guide",
        hint: "Late-night food, essentials, and nearby services",
        href: guideHref,
        actionType: "resource_clicked",
        targetKind: "golden_hospital_guide",
        sectionKey: "golden_step3",
        proofTag: "Support",
      },
      {
        key: "events",
        label: "Browse Community Wellness",
        hint: "Shift-compatible public wellness programming",
        href: eventsHref,
        actionType: "resource_clicked",
        targetKind: "community_events",
        sectionKey: "golden_step3",
        proofTag: "Retention",
      },
    ];
  }

  if (mode === "treatment") {
    return [
      {
        key: "guide",
        label: "Open Treatment Journey Guide",
        hint: "Lodging, repeat-visit planning, and support",
        href: guideHref,
        actionType: "resource_clicked",
        targetKind: "golden_hospital_guide",
        sectionKey: "golden_step3",
        proofTag: "Primary Conversion",
      },
      {
        key: "wayfinding",
        label: "Launch Campus Wayfinding",
        hint: "Reliable route to your treatment location",
        href: wayfindingHref,
        external: true,
        actionType: "wayfinding_opened",
        targetKind: "golden_wayfinding",
        sectionKey: "golden_step3",
        proofTag: "Support",
      },
      {
        key: "directory",
        label: "Compare Emory Locations",
        hint: "Switch campuses for care context",
        href: directoryHref,
        actionType: "resource_clicked",
        targetKind: "hospital_directory",
        sectionKey: "golden_step3",
        proofTag: "Discovery",
      },
    ];
  }

  return [
    {
      key: "guide",
      label: "Open Visitor Guide",
      hint: "Food, stays, and what is open nearby",
      href: guideHref,
      actionType: "resource_clicked",
      targetKind: "golden_hospital_guide",
      sectionKey: "golden_step3",
      proofTag: "Primary Conversion",
    },
    {
      key: "wayfinding",
      label: "Open Wayfinding",
      hint: "Navigate quickly to the right entrance",
      href: wayfindingHref,
      external: true,
      actionType: "wayfinding_opened",
      targetKind: "golden_wayfinding",
      sectionKey: "golden_step3",
      proofTag: "Support",
    },
    {
      key: "events",
      label: "Browse Public Health Events",
      hint: "Citywide support, wellness, and family resources",
      href: eventsHref,
      actionType: "resource_clicked",
      targetKind: "community_events",
      sectionKey: "golden_step3",
      proofTag: "Discovery",
    },
  ];
}

function getExplorationTracks(portalSlug: string, mode: HospitalAudienceMode): ExplorationTrack[] {
  const base = `/${portalSlug}?view=find&type=events&mode=${mode}`;

  return [
    {
      key: "public-health",
      title: "Public Health & Prevention",
      subtitle: "Screenings, education, and trusted care resources",
      description:
        "Federated public and nonprofit streams focused on prevention, awareness, and practical care support.",
      href: `${base}&search=${encodeURIComponent("public health screening wellness")}`,
      targetKind: "explore_public_health",
      chips: ["Community Care", "Prevention", "Free/Low-Cost"],
      trustNote: "Strict source attribution · Government/nonprofit first",
      accent: "from-[#2f66ab]/24 via-[var(--action-primary)]/18 to-transparent",
    },
    {
      key: "food-family",
      title: "Food Access & Family Support",
      subtitle: "Lower-income family health and stability resources",
      description:
        "Programs and events that help families stay fed and supported, including meal access and service navigation.",
      href: `${base}&search=${encodeURIComponent("food access family support atlanta")}`,
      targetKind: "explore_food_access",
      chips: ["Family Support", "Food Security", "Community Services"],
      trustNote: "Curated to avoid competitor health-system sources",
      accent: "from-[#c17f22]/20 via-[var(--portal-accent)]/18 to-transparent",
    },
    {
      key: "outdoor-wellness",
      title: "Outdoor & Community Wellness",
      subtitle: "Non-commercial movement and mental wellness programming",
      description:
        "Parks, civic groups, and neighborhood organizations powering accessible wellness activities across Atlanta.",
      href: `${base}&search=${encodeURIComponent("outdoor fitness community wellness atlanta")}`,
      targetKind: "explore_outdoor_wellness",
      chips: ["Parks", "Movement", "Mental Wellness"],
      trustNote: "Non-commercial civic and nonprofit emphasis",
      accent: "from-[#2b7a6b]/22 via-[var(--portal-accent)]/18 to-transparent",
    },
  ];
}

function modeTopline(mode: HospitalAudienceMode): string {
  switch (mode) {
    case "urgent":
      return "Designed for fastest route to help now.";
    case "staff":
      return "Designed for shift efficiency and late-hour reliability.";
    case "treatment":
      return "Designed for recurring care journeys and logistics.";
    case "visitor":
    default:
      return "Designed for clear visitor support and confident navigation.";
  }
}

export default async function HospitalPortalExperience({
  portal,
  feedTab,
  mode,
}: HospitalPortalExperienceProps) {
  const hospitals = await getPortalHospitalLocations(portal.id);
  const featuredHospitals = hospitals.slice(0, 3);
  const primaryHospital = featuredHospitals[0] || hospitals[0] || null;
  const wayfindingPartner =
    typeof portal.settings?.wayfinding_partner === "string"
      ? portal.settings.wayfinding_partner
      : "gozio";
  const modeConfig = HOSPITAL_MODE_CONFIG[mode];
  const modeVisual = MODE_VISUAL[mode];
  const goldenActions = getGoldenActions({ portal, mode, primaryHospital });
  const explorationTracks = getExplorationTracks(portal.slug, mode);

  return (
    <>
      <style>{`
        @keyframes emoryFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .emory-reveal {
          opacity: 0;
          animation: emoryFadeUp 580ms cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
        }
        .emory-delay-1 { animation-delay: 70ms; }
        .emory-delay-2 { animation-delay: 130ms; }
        .emory-delay-3 { animation-delay: 190ms; }
      `}</style>

      <div className="py-6 space-y-7">
        <section className="emory-reveal relative overflow-hidden rounded-[30px] border border-[var(--twilight)]/35 bg-[var(--card-bg)] p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0">
            <div className={`absolute -top-24 right-0 h-56 w-56 rounded-full blur-3xl bg-gradient-to-br ${modeVisual.halo}`} />
            <div className="absolute -bottom-20 -left-16 h-60 w-60 rounded-full bg-[var(--portal-accent)]/12 blur-3xl" />
          </div>

          <div className="relative">
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Emory Demo Experience OS</p>
                <h1 className="mt-2 font-serif text-[clamp(1.55rem,3.1vw,2.35rem)] leading-[1.15] text-[var(--cream)]">
                  Concierge Care + Public Health Discovery, in One Elegant Flow
                </h1>
                <p className="mt-3 text-sm sm:text-base text-[var(--muted)] max-w-4xl leading-relaxed">
                  A conversion-first portal experience on top of federated data: intent-aware routing, hospital-specific context,
                  and trusted community health exploration with strict source attribution.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    "Strict Attribution",
                    `Wayfinding (${wayfindingPartner})`,
                    "Mode-Ranked Recommendations",
                    "Portal-Specific ROI Proof",
                  ].map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full border border-[var(--twilight)]/55 bg-[var(--night)]/45 px-3 py-1 text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              </div>

              <aside className={`rounded-2xl border ${modeVisual.border} bg-[var(--night)]/45 p-4`}> 
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Launch Proof Lens</p>
                <h2 className="mt-1 text-sm font-semibold text-[var(--cream)]">Intent Context</h2>
                <p className="mt-2 text-xs text-[var(--muted)] leading-relaxed">{modeTopline(mode)}</p>

                <div className="mt-3 space-y-2">
                  <div className={`rounded-lg border px-3 py-2 ${modeVisual.chip}`}>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Active Mode</p>
                    <p className="text-sm font-medium text-[var(--cream)] mt-0.5">{modeConfig.label}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--twilight)]/35 bg-[var(--night)]/35 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Optimization</p>
                    <p className="text-xs text-[var(--cream)] mt-1">{modeConfig.heroHint}</p>
                  </div>
                </div>
              </aside>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <section className="group rounded-2xl border border-[var(--twilight)]/35 bg-[var(--night)]/45 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--action-primary)]/45">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Step 1 · Intent</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--cream)]">Choose Audience Mode</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">Intent drives ranking and action hierarchy.</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {HOSPITAL_MODE_LIST.map((candidateMode) => {
                    const isActive = candidateMode.key === mode;
                    return (
                      <HospitalTrackedLink
                        key={candidateMode.key}
                        href={`/${portal.slug}?mode=${candidateMode.key}`}
                        tracking={{
                          actionType: "mode_selected",
                          portalSlug: portal.slug,
                          modeContext: candidateMode.key,
                          sectionKey: "golden_step1",
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

                <p className="mt-3 text-xs text-[var(--muted)] leading-relaxed">{modeConfig.description}</p>
              </section>

              <section className="group rounded-2xl border border-[var(--twilight)]/35 bg-[var(--night)]/45 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--action-primary)]/45">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Step 2 · Context</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--cream)]">Select Hospital Context</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">Campus specificity increases trust and conversion.</p>

                {featuredHospitals.length === 0 ? (
                  <div className="mt-3 rounded-lg border border-[var(--twilight)]/30 bg-[var(--night)]/25 p-3 text-xs text-[var(--muted)]">
                    No hospitals configured yet. Use the full directory once locations are seeded.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {featuredHospitals.map((hospital, idx) => (
                      <div
                        key={hospital.id}
                        className={`rounded-lg border p-3 ${
                          idx === 0
                            ? "border-[var(--action-primary)]/55 bg-[var(--action-primary)]/10"
                            : "border-[var(--twilight)]/30 bg-[var(--night)]/25"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-[var(--cream)]">{hospital.short_name || hospital.name}</p>
                            <p className="mt-1 text-[11px] text-[var(--muted)]">{hospital.address}</p>
                          </div>
                          {idx === 0 && (
                            <span className="rounded-full border border-[var(--action-primary)]/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--cream)]">
                              Recommended
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <HospitalTrackedLink
                            href={`/${portal.slug}/hospitals/${hospital.slug}?mode=${mode}`}
                            tracking={{
                              actionType: "resource_clicked",
                              portalSlug: portal.slug,
                              hospitalSlug: hospital.slug,
                              modeContext: mode,
                              sectionKey: "golden_step2",
                              targetKind: "hospital_guide",
                              targetId: hospital.slug,
                              targetLabel: hospital.short_name || hospital.name,
                            }}
                            className="inline-flex items-center rounded-md border border-[var(--twilight)] px-2 py-1 text-[11px] font-medium text-[var(--cream)] hover:bg-[var(--twilight)]/25"
                          >
                            Open Guide
                          </HospitalTrackedLink>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="group rounded-2xl border border-[var(--twilight)]/35 bg-[var(--night)]/45 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--action-primary)]/45">
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Step 3 · Action</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--cream)]">Take Highest-Value Next Step</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">Mode-specific action hierarchy optimized for conversion.</p>

                <div className="mt-3 space-y-2">
                  {goldenActions.map((action, index) => (
                    <HospitalTrackedLink
                      key={action.key}
                      href={action.href}
                      external={action.external}
                      tracking={{
                        actionType: action.actionType,
                        portalSlug: portal.slug,
                        hospitalSlug: primaryHospital?.slug,
                        modeContext: mode,
                        sectionKey: action.sectionKey,
                        targetKind: action.targetKind,
                        targetId: action.key,
                        targetLabel: action.label,
                        targetUrl: action.href,
                      }}
                      className={`group/action flex w-full flex-col rounded-lg border px-3 py-2 transition-all duration-200 ${
                        index === 0
                          ? "border-[var(--action-primary)] bg-[var(--action-primary)] text-[var(--btn-primary-text)] hover:bg-[var(--action-primary-hover)]"
                          : "border-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/25 hover:-translate-y-0.5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">{action.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.08em] border ${index === 0 ? "border-[var(--btn-primary-text)]/40 text-[var(--btn-primary-text)]" : "border-[var(--twilight)] text-[var(--muted)]"}`}>
                          {action.proofTag}
                        </span>
                      </div>
                      <span className={`text-[11px] ${index === 0 ? "text-[var(--btn-primary-text)]/85" : "text-[var(--muted)]"}`}>
                        {action.hint}
                      </span>
                    </HospitalTrackedLink>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </section>

        <section className="emory-reveal emory-delay-1 rounded-[28px] border border-[var(--twilight)]/35 bg-[var(--card-bg)] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Broader Exploration</p>
              <h2 className="mt-1 font-serif text-[clamp(1.2rem,2.4vw,1.8rem)] text-[var(--cream)]">
                Public Health Discovery Tracks
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)] max-w-3xl leading-relaxed">
                The second rail for engagement and community impact: discover prevention, food support, and non-commercial
                wellness opportunities with explicit trust cues.
              </p>
            </div>
            <span className="rounded-full border border-[var(--twilight)] px-3 py-1 text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
              Attribution Enforced
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {explorationTracks.map((track) => (
              <article
                key={track.key}
                className="group relative overflow-hidden rounded-2xl border border-[var(--twilight)]/40 bg-[var(--night)]/45 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--action-primary)]/45"
              >
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${track.accent}`} />
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{track.subtitle}</p>
                <h3 className="mt-1 text-lg font-semibold text-[var(--cream)]">{track.title}</h3>
                <p className="mt-2 text-xs text-[var(--muted)] leading-relaxed">{track.description}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {track.chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-[var(--twilight)]/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>

                <p className="mt-3 text-[11px] text-[var(--muted)]">{track.trustNote}</p>

                <HospitalTrackedLink
                  href={track.href}
                  tracking={{
                    actionType: "resource_clicked",
                    portalSlug: portal.slug,
                    modeContext: mode,
                    sectionKey: "broader_exploration",
                    targetKind: track.targetKind,
                    targetId: track.key,
                    targetLabel: track.title,
                    targetUrl: track.href,
                  }}
                  className="mt-4 inline-flex items-center rounded-lg bg-[var(--action-primary)] px-3 py-1.5 text-xs font-medium text-[var(--btn-primary-text)] transition-colors hover:bg-[var(--action-primary-hover)]"
                >
                  Explore Track
                </HospitalTrackedLink>
              </article>
            ))}
          </div>
        </section>

        <section className="emory-reveal emory-delay-2 rounded-2xl border border-[var(--twilight)]/40 bg-[var(--card-bg)] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-[var(--cream)]">All Hospital Landing Pages</h2>
            <span className="text-xs text-[var(--muted)]">{hospitals.length} locations</span>
          </div>

          {hospitals.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No hospital locations configured yet. Add records to <code>portal_hospital_locations</code> to enable landing pages.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {hospitals.map((hospital) => {
                const wayfindingHref = getHospitalWayfindingHref(hospital);
                return (
                  <article
                    key={hospital.id}
                    className="group rounded-xl border border-[var(--twilight)]/35 bg-[var(--night)]/40 p-4 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--action-primary)]/40"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--cream)]">{hospital.short_name || hospital.name}</p>
                      <p className="text-xs text-[var(--muted)] mt-1">{hospital.address}</p>
                      {hospital.phone && <p className="text-xs text-[var(--muted)] mt-1">Main: {hospital.phone}</p>}
                    </div>

                    <div className="mt-auto flex flex-wrap gap-2">
                      <HospitalTrackedLink
                        href={`/${portal.slug}/hospitals/${hospital.slug}?mode=${mode}`}
                        tracking={{
                          actionType: "resource_clicked",
                          portalSlug: portal.slug,
                          hospitalSlug: hospital.slug,
                          modeContext: mode,
                          sectionKey: "hospital_directory_cards",
                          targetKind: "hospital_guide",
                          targetId: hospital.slug,
                          targetLabel: hospital.short_name || hospital.name,
                        }}
                        className="inline-flex items-center rounded-lg bg-[var(--action-primary)] px-3 py-1.5 text-xs font-medium text-[var(--btn-primary-text)] hover:bg-[var(--action-primary-hover)]"
                      >
                        Open Hospital Guide
                      </HospitalTrackedLink>
                      <HospitalTrackedLink
                        href={wayfindingHref}
                        external
                        tracking={{
                          actionType: "wayfinding_opened",
                          portalSlug: portal.slug,
                          hospitalSlug: hospital.slug,
                          modeContext: mode,
                          sectionKey: "hospital_directory_cards",
                          targetKind: "wayfinding",
                          targetId: hospital.slug,
                          targetLabel: hospital.short_name || hospital.name,
                          targetUrl: wayfindingHref,
                        }}
                        className="inline-flex items-center rounded-lg border border-[var(--twilight)] px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--twilight)]/25"
                      >
                        Open Wayfinding
                      </HospitalTrackedLink>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="emory-reveal emory-delay-3">
          <FeedShell
            portalId={portal.id}
            portalSlug={portal.slug}
            activeTab={feedTab}
            curatedContent={<CuratedContent portalSlug={portal.slug} />}
          />
        </div>
      </div>
    </>
  );
}
