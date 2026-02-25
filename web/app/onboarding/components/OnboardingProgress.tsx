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
    <div className="w-full border-b border-[var(--twilight)]/35 bg-[var(--night)]/55 px-4 py-3 backdrop-blur-sm sm:px-6">
      <ScopedStyles css={progressClass?.css} />
      <div className="mx-auto w-full max-w-4xl">
      {/* Progress bar */}
      <div className="h-1 overflow-hidden rounded-full bg-[var(--twilight)]/55">
        <div
          className={`h-full w-[var(--onboarding-progress)] bg-[linear-gradient(90deg,var(--coral),var(--neon-cyan))] transition-all duration-500 ease-out ${progressClass?.className ?? ""}`}
        />
      </div>

      {/* Step dots with labels */}
      <div className="mt-4 flex justify-center gap-8">
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;

          return (
            <div key={step.id} className="flex flex-col items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  isActive
                    ? "scale-110 bg-[var(--coral)] animate-onboarding-dot-pulse"
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
    </div>
  );
}
