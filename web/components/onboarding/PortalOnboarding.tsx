"use client";

import { useCallback, useMemo, useState, type CSSProperties, type ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  User,
  Heart,
  UsersThree,
  UsersFour,
  ForkKnife,
  MoonStars,
  Palette,
  Tree,
  Sparkle,
  MusicNotes,
  Trophy,
  Leaf,
  Plant,
  WarningCircle,
  Drop,
  SealCheck,
  X,
} from "@phosphor-icons/react/dist/ssr";
import {
  type PortalPreferences,
  type TravelParty,
  type InterestTag,
  type DietaryNeed,
  ONBOARDING_STEPS,
  TRAVEL_PARTY_OPTIONS,
  INTEREST_OPTIONS,
  DIETARY_OPTIONS,
  getStepTitle,
  getStepSubtitle,
  isStepSkippable,
  suggestGuestIntent,
} from "@/lib/onboarding-utils";

type Tone = {
  accent: string;
  glow: string;
};

const TRAVEL_TONES: Record<TravelParty, Tone> = {
  alone: { accent: "#00d4e8", glow: "rgba(0,212,232,0.25)" },
  couple: { accent: "#ff6b7a", glow: "rgba(255,107,122,0.27)" },
  family: { accent: "#ffd166", glow: "rgba(255,209,102,0.26)" },
  group: { accent: "#6ee7b7", glow: "rgba(110,231,183,0.24)" },
};

const INTEREST_TONES: Record<InterestTag, Tone> = {
  food: { accent: "#f59e0b", glow: "rgba(245,158,11,0.24)" },
  nightlife: { accent: "#00d4e8", glow: "rgba(0,212,232,0.24)" },
  arts: { accent: "#a78bfa", glow: "rgba(167,139,250,0.24)" },
  outdoors: { accent: "#22c55e", glow: "rgba(34,197,94,0.22)" },
  wellness: { accent: "#6ee7b7", glow: "rgba(110,231,183,0.22)" },
  music: { accent: "#ff6b7a", glow: "rgba(255,107,122,0.24)" },
  sports: { accent: "#60a5fa", glow: "rgba(96,165,250,0.24)" },
};

const DIETARY_TONE: Tone = { accent: "#00d4e8", glow: "rgba(0,212,232,0.2)" };

const ICONS: Record<string, ComponentType<IconProps>> = {
  person: User,
  heart: Heart,
  family: UsersThree,
  group: UsersFour,
  utensils: ForkKnife,
  moon: MoonStars,
  palette: Palette,
  tree: Tree,
  spa: Sparkle,
  music: MusicNotes,
  trophy: Trophy,
  leaf: Leaf,
  seedling: Plant,
  "wheat-off": WarningCircle,
  alert: WarningCircle,
  "milk-off": Drop,
  check: SealCheck,
};

function Icon({ name, accent, size = 18 }: { name: string; accent: string; size?: number }) {
  const IconComponent = ICONS[name] ?? SealCheck;
  return (
    <IconComponent
      size={size}
      weight="light"
      className="shrink-0"
      style={{ color: accent, filter: `drop-shadow(0 0 8px ${accent}66)` }}
    />
  );
}

interface PortalOnboardingProps {
  portalName?: string;
  onComplete: (preferences: PortalPreferences) => void;
  onDismiss?: () => void;
}

export default function PortalOnboarding({
  portalName,
  onComplete,
  onDismiss,
}: PortalOnboardingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [travelParty, setTravelParty] = useState<TravelParty | null>(null);
  const [interests, setInterests] = useState<InterestTag[]>([]);
  const [dietaryNeeds, setDietaryNeeds] = useState<DietaryNeed[]>([]);

  const currentStep = ONBOARDING_STEPS[stepIndex];
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;

  const canAdvance = useMemo(() => {
    switch (currentStep) {
      case "travel_party":
        return travelParty !== null;
      case "interests":
        return interests.length > 0;
      case "dietary":
        return true;
    }
  }, [currentStep, interests.length, travelParty]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      const prefs: PortalPreferences = {
        travel_party: travelParty,
        interests,
        dietary_needs: dietaryNeeds,
        preferred_guest_intent: null,
        preferred_experience_view: null,
        mobility_preferences: {},
        onboarding_completed_at: new Date().toISOString(),
      };
      prefs.preferred_guest_intent = suggestGuestIntent(prefs);
      onComplete(prefs);
      return;
    }
    setStepIndex((index) => index + 1);
  }, [dietaryNeeds, interests, isLastStep, onComplete, travelParty]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((index) => index - 1);
    }
  }, [stepIndex]);

  const toggleInterest = useCallback((id: InterestTag) => {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }, []);

  const toggleDietary = useCallback((id: DietaryNeed) => {
    setDietaryNeeds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }, []);

  const stepLabel = `${stepIndex + 1}/${ONBOARDING_STEPS.length}`;

  const getTone = (optionId: TravelParty | InterestTag | DietaryNeed): Tone => {
    if (optionId in TRAVEL_TONES) return TRAVEL_TONES[optionId as TravelParty];
    if (optionId in INTEREST_TONES) return INTEREST_TONES[optionId as InterestTag];
    return DIETARY_TONE;
  };

  const selectedCardStyle = (tone: Tone): CSSProperties => ({
    borderColor: tone.accent,
    background: `linear-gradient(145deg, ${tone.glow}, rgba(14,20,34,0.88))`,
    boxShadow: `0 0 16px ${tone.glow}`,
  });

  const selectedPillStyle = (tone: Tone): CSSProperties => ({
    borderColor: tone.accent,
    background: `linear-gradient(145deg, ${tone.glow}, rgba(16,21,37,0.82))`,
    boxShadow: `0 0 12px ${tone.glow}`,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-[var(--void)]/78 backdrop-blur-[3px]" onClick={onDismiss} />

      <div className="relative mx-auto flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-[var(--twilight)]/55 bg-[linear-gradient(160deg,rgba(15,20,34,0.96),rgba(9,12,20,0.98))] shadow-[0_14px_44px_rgba(0,0,0,0.45)] sm:rounded-2xl">
        <div className="pointer-events-none absolute inset-0 opacity-25 [background:repeating-linear-gradient(125deg,rgba(255,255,255,0.02)_0,rgba(255,255,255,0.02)_2px,transparent_2px,transparent_10px)]" />

        <div className="relative border-b border-[var(--twilight)]/45 px-5 pb-4 pt-4 sm:px-6">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--soft)]">
                {portalName ? `${portalName} concierge setup` : "Concierge setup"}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--cream)]">{getStepTitle(currentStep)}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{getStepSubtitle(currentStep)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-[var(--twilight)]/60 bg-[var(--dusk)]/70 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--soft)]">
                {stepLabel}
              </span>
              {onDismiss ? (
                <button
                  onClick={onDismiss}
                  aria-label="Close onboarding"
                  className="rounded-md border border-[var(--twilight)]/60 p-1.5 text-[var(--muted)] transition-colors hover:text-[var(--cream)]"
                >
                  <X size={16} weight="bold" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {ONBOARDING_STEPS.map((step, index) => (
              <div key={step} className="h-1.5 overflow-hidden rounded-full bg-[var(--twilight)]/45">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    index <= stepIndex
                      ? "bg-[linear-gradient(90deg,var(--coral),var(--neon-cyan))]"
                      : "bg-transparent"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {currentStep === "travel_party" ? (
            <div className="grid grid-cols-2 gap-3">
              {TRAVEL_PARTY_OPTIONS.map((option) => {
                const tone = getTone(option.id);
                const isSelected = travelParty === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setTravelParty(option.id)}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      isSelected
                        ? "text-[var(--cream)]"
                        : "border-[var(--twilight)]/60 bg-[var(--dusk)]/50 text-[var(--soft)] hover:border-[var(--soft)]/35"
                    }`}
                    style={isSelected ? selectedCardStyle(tone) : undefined}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <Icon name={option.icon} accent={tone.accent} size={20} />
                    </div>
                    <p className="font-mono text-[12px] uppercase tracking-[0.12em]">{option.label}</p>
                    {option.description ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">{option.description}</p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {currentStep === "interests" ? (
            <div className="flex flex-wrap gap-2.5">
              {INTEREST_OPTIONS.map((option) => {
                const tone = getTone(option.id);
                const isSelected = interests.includes(option.id);
                return (
                  <button
                    key={option.id}
                    onClick={() => toggleInterest(option.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all ${
                      isSelected
                        ? "text-[var(--cream)]"
                        : "border-[var(--twilight)]/65 bg-[var(--dusk)]/50 text-[var(--soft)] hover:border-[var(--soft)]/35"
                    }`}
                    style={isSelected ? selectedPillStyle(tone) : undefined}
                  >
                    <Icon name={option.icon} accent={tone.accent} size={16} />
                    <span className="font-mono text-xs uppercase tracking-[0.08em]">{option.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {currentStep === "dietary" ? (
            <div className="flex flex-wrap gap-2.5">
              {DIETARY_OPTIONS.map((option) => {
                const isSelected = dietaryNeeds.includes(option.id);
                const tone = getTone(option.id);
                return (
                  <button
                    key={option.id}
                    onClick={() => toggleDietary(option.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all ${
                      isSelected
                        ? "text-[var(--cream)]"
                        : "border-[var(--twilight)]/65 bg-[var(--dusk)]/50 text-[var(--soft)] hover:border-[var(--soft)]/35"
                    }`}
                    style={isSelected ? selectedPillStyle(tone) : undefined}
                  >
                    <Icon name={option.icon} accent={tone.accent} size={16} />
                    <span className="font-mono text-xs uppercase tracking-[0.08em]">{option.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="relative flex items-center gap-3 border-t border-[var(--twilight)]/45 px-5 py-4 sm:px-6">
          {stepIndex > 0 ? (
            <button
              onClick={handleBack}
              className="rounded-md border border-[var(--twilight)]/60 px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] text-[var(--soft)] transition-colors hover:text-[var(--cream)]"
            >
              Back
            </button>
          ) : onDismiss ? (
            <button
              onClick={onDismiss}
              className="rounded-md border border-[var(--twilight)]/60 px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] text-[var(--soft)] transition-colors hover:text-[var(--cream)]"
            >
              Skip
            </button>
          ) : null}

          <div className="flex-1" />

          {isStepSkippable(currentStep) && !isLastStep ? (
            <button
              onClick={handleNext}
              className="rounded-md border border-transparent px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)] transition-colors hover:text-[var(--cream)]"
            >
              Skip step
            </button>
          ) : null}

          <button
            onClick={handleNext}
            disabled={!canAdvance}
            className={`rounded-lg px-5 py-2.5 font-mono text-xs uppercase tracking-[0.14em] transition-all ${
              canAdvance
                ? "bg-[linear-gradient(90deg,var(--coral),var(--neon-cyan))] text-[var(--void)] shadow-[0_0_16px_rgba(0,212,232,0.28)] hover:brightness-110"
                : "cursor-not-allowed bg-[var(--twilight)]/45 text-[var(--muted)]"
            }`}
          >
            {isLastStep ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
