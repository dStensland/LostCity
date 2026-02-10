"use client";

import type { OnboardingStep } from "@/lib/types";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClassForLength } from "@/lib/css-utils";

interface OnboardingProgressProps {
  currentStep: OnboardingStep;
}

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  const steps: { id: OnboardingStep; label: string }[] = [
    { id: "categories", label: "Interests" },
    { id: "genres", label: "Genres" },
  ];

  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  const totalSteps = steps.length;
  const progress = ((currentIndex + 1) / totalSteps) * 100;
  const progressClass = createCssVarClassForLength(
    "--onboarding-progress",
    `${progress}%`,
    "onboarding-progress"
  );

  return (
    <div className="w-full">
      <ScopedStyles css={progressClass?.css} />
      {/* Progress bar */}
      <div className="h-1 bg-[var(--twilight)]">
        <div
          className={`h-full bg-[var(--coral)] transition-all duration-500 ease-out w-[var(--onboarding-progress)] ${progressClass?.className ?? ""}`}
        />
      </div>

      {/* Step dots with labels */}
      <div className="flex justify-center gap-8 mt-4 px-4">
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;

          return (
            <div key={step.id} className="flex flex-col items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  isActive
                    ? "bg-[var(--coral)] animate-onboarding-dot-pulse scale-110"
                    : isComplete
                    ? "bg-[var(--coral)]"
                    : "bg-[var(--twilight)]"
                }`}
              />
              <span
                className={`font-mono text-xs transition-colors ${
                  isActive || isComplete
                    ? "text-[var(--cream)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
