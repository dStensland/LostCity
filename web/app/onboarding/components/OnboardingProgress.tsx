"use client";

import type { OnboardingStep } from "@/lib/types";

interface OnboardingProgressProps {
  currentStep: OnboardingStep;
}

const STEPS: OnboardingStep[] = ["splash", "mood", "swipe", "neighborhood", "preview"];

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  const currentIndex = STEPS.indexOf(currentStep);

  // Don't show progress on splash
  if (currentStep === "splash") {
    return null;
  }

  // Calculate progress percentage (excluding splash)
  const adjustedIndex = currentIndex - 1; // Offset for splash
  const totalSteps = STEPS.length - 1; // Exclude splash
  const progress = ((adjustedIndex + 1) / totalSteps) * 100;

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="h-1 bg-[var(--twilight)]">
        <div
          className="h-full bg-[var(--coral)] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step dots (optional, hidden on mobile) */}
      <div className="hidden sm:flex justify-center gap-2 mt-4">
        {STEPS.slice(1).map((step, index) => (
          <div
            key={step}
            className={`w-2 h-2 rounded-full transition-colors ${
              index <= adjustedIndex
                ? "bg-[var(--coral)]"
                : "bg-[var(--twilight)]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
