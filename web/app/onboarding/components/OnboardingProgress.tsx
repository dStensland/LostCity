"use client";

import type { OnboardingStep } from "@/lib/types";

interface OnboardingProgressProps {
  currentStep: OnboardingStep;
  showSubcategories: boolean;
}

export function OnboardingProgress({ currentStep, showSubcategories }: OnboardingProgressProps) {
  // Build the steps array based on whether subcategories are shown
  const steps: OnboardingStep[] = showSubcategories
    ? ["categories", "subcategories", "neighborhoods"]
    : ["categories", "neighborhoods"];

  const currentIndex = steps.indexOf(currentStep);
  const totalSteps = steps.length;
  const progress = ((currentIndex + 1) / totalSteps) * 100;

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="h-1 bg-[var(--twilight)]">
        <div
          className="h-full bg-[var(--coral)] transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step dots */}
      <div className="flex justify-center gap-2 mt-4">
        {steps.map((step, index) => (
          <div
            key={step}
            className={`w-2 h-2 rounded-full transition-colors ${
              index <= currentIndex
                ? "bg-[var(--coral)]"
                : "bg-[var(--twilight)]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
