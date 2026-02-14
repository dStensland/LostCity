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
      return "Visitor-first support with practical campus and nearby options.";
  }
}

export function getEmoryFeedCopy(args: {
  personaProfile: EmoryPersonaProfile;
  mode: HospitalAudienceMode;
  modeConfig: HospitalModeConfig;
}) {
  const { personaProfile, mode, modeConfig } = args;

  return {
    heroKicker: "Emory Community Companion",
    heroTitle: personaProfile.headline,
    heroSummary: buildHeroSummary({ personaProfile, mode }),
    focusKicker: "Today's Support",
    priorityKicker: "Priority",
    trustKicker: "Mode Guidance",
    trustBody: "Start with one clear action, then use backup options if needed.",
    step1Title: "Choose Your Need",
    step1Summary: `${modeConfig.description} Pick what fits your situation, then move forward with one clear path.`,
    step2Title: "Choose a Campus",
    step2Summary: "Choose one Emory campus for booking, wayfinding, and nearby practical support.",
    step3Title: "Take Next Action",
    step3Summary: "Take one primary action first, then use backup options if needed.",
    railATitle: "Hospital Operations",
    railASummary: "Official campus details and direct action links.",
    railBTitle: "Community Support",
    railBSummary: "Live Atlanta public-health and nonprofit resources for everyday support.",
    briefingCtaLabel: "Open Briefing",
  };
}

export function getEmoryDirectoryCopy(args: {
  personaProfile: EmoryPersonaProfile;
  mode: HospitalAudienceMode;
}) {
  const { personaProfile, mode } = args;

  return {
    heroKicker: "Emory Healthcare Directory",
    heroTitle: "Choose Your Hospital Companion",
    heroSummary: "Select a campus to open practical guidance for booking links, wayfinding, on-site services, and nearby community support.",
    lensKicker: "Today's View",
    objectiveKicker: "Primary Objective",
    objectiveBody: "Route each visitor to the right hospital action in one tap.",
    guardrailKicker: "Support Scope",
    guardrailBody: personaProfile.sourcePolicyNote,
    federationKicker: "Community Updates",
    federationLiveLabel: "community support updates available now.",
    federationSyncingLabel: "Community support updates are refreshing now.",
    modeTone: modeTone(mode),
    railATitle: "Emory Operations",
    railBTitle: "Emory Community Support",
    railBSubcopy: "Practical prevention, food, and wellness support around each campus.",
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
    heroKicker: "Hospital Guide",
    focusKicker: "Today's Support View",
    scopeChip:
      mode === "urgent"
        ? "Urgent Support"
        : mode === "staff"
          ? "Shift Support"
          : mode === "treatment"
            ? "Treatment Support"
            : "Visitor Support",
    communityTitle: "Emory Community Updates",
    communitySummary: "Atlanta public-health and nonprofit support surfaced as practical next steps for visitors and families.",
    attributionTitle: "Next Step",
    attributionBody: "Choose one primary action first, then continue with support options.",
    scopeTitle: "Support Scope",
    scopeBody: "Community and location support only. Clinical coordination remains in Emory systems.",
    federationTitle: "Community Status",
    federationLiveBody: "Community support updates are active for this hospital guide.",
    federationSyncingBody: "Community support updates are refreshing.",
    modeNarrative: `${modeTone(mode)} ${personaProfile.focusNarrative} ${modeConfig.heroHint}`,
  };
}

export function getEmoryCopywriterRules(): string[] {
  return [
    ...HOSPITAL_COPY_FRAMEWORK.voice_system,
    ...HOSPITAL_COPY_FRAMEWORK.conversion_copy_patterns,
  ];
}
