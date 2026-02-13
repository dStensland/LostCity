import { getCopywritingFramework } from "@/lib/agents/portal-studio/copywriting";
import type { EmoryPersonaProfile } from "@/lib/emory-personas";
import type { HospitalAudienceMode, HospitalModeConfig } from "@/lib/hospital-modes";

const HOSPITAL_COPY_FRAMEWORK = getCopywritingFramework("hospital");

function stripFramePrefix(value: string): string {
  return value.replace(/^[^:]+:\s*/i, "").trim();
}

function modePromise(mode: HospitalAudienceMode): string {
  switch (mode) {
    case "urgent":
      return "Get people to the right entrance fast, with open-now essentials in view.";
    case "treatment":
      return "Keep recurring visits steady with dependable services, lodging, and family support.";
    case "staff":
      return "Reduce shift friction with reliable wayfinding and late-hour utility.";
    case "visitor":
    default:
      return "Give families and caregivers one calm path to the next right step.";
  }
}

function buildHeroSummary(args: {
  personaProfile: EmoryPersonaProfile;
  mode: HospitalAudienceMode;
}): string {
  const { personaProfile, mode } = args;
  const resolution = stripFramePrefix(HOSPITAL_COPY_FRAMEWORK.narrative_framework[1] || "");
  return `${personaProfile.summary} ${modePromise(mode)} ${resolution}`.replace(/\s+/g, " ").trim();
}

function modeTone(mode: HospitalAudienceMode): string {
  switch (mode) {
    case "urgent":
      return "Fast routing with the clearest next move first.";
    case "treatment":
      return "Recurring-visit logistics organized for consistency and less stress.";
    case "staff":
      return "Shift-ready guidance with open-now and late-hour utility first.";
    case "visitor":
    default:
      return "Visitor-first confidence with practical campus and nearby support.";
  }
}

export function getEmoryFeedCopy(args: {
  personaProfile: EmoryPersonaProfile;
  mode: HospitalAudienceMode;
  modeConfig: HospitalModeConfig;
}) {
  const { personaProfile, mode, modeConfig } = args;
  const proof = stripFramePrefix(HOSPITAL_COPY_FRAMEWORK.narrative_framework[2] || "");

  return {
    heroKicker: "Emory Healthcare Concierge",
    heroTitle: personaProfile.headline,
    heroSummary: buildHeroSummary({ personaProfile, mode }),
    focusKicker: "Today's Focus",
    priorityKicker: "Priority",
    trustKicker: "Trust Guardrail",
    trustBody: `${personaProfile.sourcePolicyNote} ${proof}`.replace(/\s+/g, " ").trim(),
    step1Title: "Set Your Mode",
    step1Summary: `${modeConfig.description} Set context first so every recommendation matches why you are here.`,
    step2Title: "Pick a Campus",
    step2Summary: "Choose one Emory campus to unlock booking, wayfinding, and local support.",
    step3Title: "Take Next Action",
    step3Summary: "Take one primary action now, then use clear backup paths as needed.",
    railATitle: "Emory-Owned Hospital Network",
    railASummary: "Official Emory campus metadata, service records, and direct action endpoints.",
    railBTitle: "Emory Community Briefings",
    railBSummary: "Atlanta public-health and nonprofit resources, vetted and ranked for practical family utility.",
    briefingCtaLabel: "Open Briefing",
  };
}

export function getEmoryDirectoryCopy(args: {
  personaProfile: EmoryPersonaProfile;
  mode: HospitalAudienceMode;
}) {
  const { personaProfile, mode } = args;
  const problem = stripFramePrefix(HOSPITAL_COPY_FRAMEWORK.narrative_framework[0] || "");

  return {
    heroKicker: "Emory Healthcare Directory",
    heroTitle: "Choose Your Hospital Companion",
    heroSummary: "Select a campus, launch the right action, and keep services, wayfinding, and trusted community support in one place.",
    lensKicker: "Today's Lens",
    objectiveKicker: "Primary Objective",
    objectiveBody: "Route each visitor to the right hospital action in one tap.",
    guardrailKicker: "Trust Guardrail",
    guardrailBody: personaProfile.sourcePolicyNote,
    federationKicker: "Atlanta Federation",
    federationLiveLabel: "live community briefings from vetted Atlanta partners.",
    federationSyncingLabel: "Community briefings are refreshing from vetted Atlanta partners.",
    modeTone: modeTone(mode),
    railATitle: "Authoritative hospital layer",
    railBTitle: "Emory community support layer",
    railBSubcopy: `Practical prevention, food, and wellness support with source context visible before action. ${problem}`,
    briefingCtaLabel: "Open Briefing",
  };
}

export function getEmoryCompanionCopy(args: {
  personaProfile: EmoryPersonaProfile;
  mode: HospitalAudienceMode;
  modeConfig: HospitalModeConfig;
}) {
  const { personaProfile, mode, modeConfig } = args;

  return {
    heroKicker: "Hospital Companion",
    focusKicker: "Today's Lens",
    scopeChip:
      mode === "urgent"
        ? "Urgent Support"
        : mode === "staff"
          ? "Shift Support"
          : mode === "treatment"
            ? "Treatment Support"
            : "Visitor Support",
    communityTitle: "Emory Community Briefings",
    communitySummary: "Vetted Atlanta public-health and nonprofit resources surfaced in an Emory-ready companion flow.",
    attributionTitle: "Attribution Guardrail",
    attributionBody: "Every briefing shows source and trust context before action.",
    scopeTitle: "Scope Guardrail",
    scopeBody: "Community and location support only. Clinical coordination remains in Emory systems.",
    federationTitle: "Federation Status",
    federationLiveBody: "Live Atlanta source federation is active for this companion.",
    federationSyncingBody: "Using seeded examples while Atlanta sources refresh.",
    modeNarrative: `${modeTone(mode)} ${personaProfile.focusNarrative} ${modeConfig.heroHint}`,
  };
}

export function getEmoryCopywriterRules(): string[] {
  return [
    ...HOSPITAL_COPY_FRAMEWORK.voice_system,
    ...HOSPITAL_COPY_FRAMEWORK.conversion_copy_patterns,
  ];
}
