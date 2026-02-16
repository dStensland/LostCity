"use client";

import { useState, useCallback } from "react";
import {
  type PortalPreferences,
  type TravelParty,
  type InterestTag,
  type DietaryNeed,
  type OnboardingStep,
  ONBOARDING_STEPS,
  TRAVEL_PARTY_OPTIONS,
  INTEREST_OPTIONS,
  DIETARY_OPTIONS,
  getStepTitle,
  getStepSubtitle,
  isStepSkippable,
  suggestGuestIntent,
} from "@/lib/onboarding-utils";

// ============================================================================
// ICONS (inline SVG to avoid external deps)
// ============================================================================

const ICONS: Record<string, React.ReactNode> = {
  person: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  heart: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  family: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  group: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  utensils: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" />
      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </svg>
  ),
  moon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  palette: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" /><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" /><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  ),
  tree: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 22H7" /><path d="M12 22V12" />
      <path d="m12 2-5.4 9h10.8L12 2z" /><path d="M12 7 6.6 16h10.8L12 7z" />
    </svg>
  ),
  spa: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22c4-4 8-7.5 8-12S16.4 2 12 2 4 5.5 4 10s4 8 8 12z" />
      <path d="M12 6c-1.5 2-3 4-3 6.5 0 2 1.3 3.5 3 3.5s3-1.5 3-3.5c0-2.5-1.5-4.5-3-6.5z" />
    </svg>
  ),
  music: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  ),
  trophy: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
  ),
  leaf: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.5 10-10 10z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  ),
  seedling: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22V10" /><path d="M6 12c0-4.4 3.6-8 8-8" /><path d="M18 12c0-4.4-3.6-8-8-8" />
    </svg>
  ),
  "wheat-off": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m2 22 10-10" /><path d="m16 8-1.17 1.17" /><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94z" />
    </svg>
  ),
  alert: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  "milk-off": (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 2h8" /><path d="M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  ),
  check: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

function Icon({ name }: { name: string }) {
  return <span className="inline-flex items-center justify-center">{ICONS[name] || ICONS.check}</span>;
}

// ============================================================================
// COMPONENT
// ============================================================================

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

  const canAdvance = useCallback(() => {
    switch (currentStep) {
      case "travel_party":
        return travelParty !== null;
      case "interests":
        return interests.length > 0;
      case "dietary":
        return true; // always skippable
    }
  }, [currentStep, travelParty, interests]);

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
      // Auto-set intent/persona from preferences
      prefs.preferred_guest_intent = suggestGuestIntent(prefs);
      onComplete(prefs);
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [isLastStep, travelParty, interests, dietaryNeeds, onComplete]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  }, [stepIndex]);

  const toggleInterest = useCallback((id: InterestTag) => {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const toggleDietary = useCallback((id: DietaryNeed) => {
    setDietaryNeeds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onDismiss}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-auto bg-[var(--bg-primary,#1a1a2e)] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Progress bar */}
        <div className="flex gap-1.5 px-6 pt-5">
          {ONBOARDING_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= stepIndex
                  ? "bg-[var(--accent,#f97316)]"
                  : "bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* Header */}
        <div className="px-6 pt-4 pb-2">
          {portalName && stepIndex === 0 && (
            <p className="text-xs uppercase tracking-wider text-white/40 mb-1">
              {portalName}
            </p>
          )}
          <h2 className="text-xl font-bold text-white">
            {getStepTitle(currentStep)}
          </h2>
          <p className="text-sm text-white/60 mt-1">
            {getStepSubtitle(currentStep)}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {currentStep === "travel_party" && (
            <div className="grid grid-cols-2 gap-3">
              {TRAVEL_PARTY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setTravelParty(opt.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    travelParty === opt.id
                      ? "border-[var(--accent,#f97316)] bg-[var(--accent,#f97316)]/10 text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
                  }`}
                >
                  <Icon name={opt.icon} />
                  <span className="font-medium text-sm">{opt.label}</span>
                  {opt.description && (
                    <span className="text-xs text-white/50">
                      {opt.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {currentStep === "interests" && (
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggleInterest(opt.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all text-sm ${
                    interests.includes(opt.id)
                      ? "border-[var(--accent,#f97316)] bg-[var(--accent,#f97316)]/10 text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
                  }`}
                >
                  <Icon name={opt.icon} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          {currentStep === "dietary" && (
            <div className="flex flex-wrap gap-2">
              {DIETARY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggleDietary(opt.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all text-sm ${
                    dietaryNeeds.includes(opt.id)
                      ? "border-[var(--accent,#f97316)] bg-[var(--accent,#f97316)]/10 text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
                  }`}
                >
                  <Icon name={opt.icon} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center gap-3 border-t border-white/5">
          {stepIndex > 0 ? (
            <button
              onClick={handleBack}
              className="px-4 py-2.5 text-sm text-white/60 hover:text-white transition-colors"
            >
              Back
            </button>
          ) : (
            onDismiss && (
              <button
                onClick={onDismiss}
                className="px-4 py-2.5 text-sm text-white/60 hover:text-white transition-colors"
              >
                Skip
              </button>
            )
          )}

          <div className="flex-1" />

          {isStepSkippable(currentStep) && !isLastStep && (
            <button
              onClick={handleNext}
              className="px-4 py-2.5 text-sm text-white/60 hover:text-white transition-colors"
            >
              Skip
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={!canAdvance()}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
              canAdvance()
                ? "bg-[var(--accent,#f97316)] text-white hover:brightness-110"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            {isLastStep ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
