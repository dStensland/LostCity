"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import { OnboardingProgress } from "@/app/onboarding/components/OnboardingProgress";
import { CategoryPicker } from "@/app/onboarding/steps/CategoryPicker";
import { GenrePicker } from "@/app/onboarding/steps/GenrePicker";
import type { OnboardingStep } from "@/lib/types";

export default function OnboardingRefreshPreviewPage() {
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");
  const categoriesParam = searchParams.get("categories");

  const initialStep: OnboardingStep = stepParam === "genres" ? "genres" : "categories";
  const initialCategories = categoriesParam
    ? categoriesParam
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategories);
  const [showDone, setShowDone] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--void)]">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_16%_14%,rgba(0,212,232,0.12),transparent_42%),radial-gradient(circle_at_80%_12%,rgba(255,107,122,0.12),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background:repeating-linear-gradient(125deg,rgba(255,255,255,0.025)_0,rgba(255,255,255,0.025)_2px,transparent_2px,transparent_11px)]" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="border-b border-[var(--twilight)]/45 bg-[var(--night)]/75 px-4 py-4 backdrop-blur-sm sm:px-6">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Logo />
              <div className="flex flex-col">
                <span className="font-mono text-xs text-[var(--muted)]">Onboarding Refresh Preview</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--soft)]">
                  Design Sandbox
                </span>
              </div>
            </div>
            <p className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--soft)] sm:block">
              Personalized Discovery Setup
            </p>
          </div>
        </header>

        <OnboardingProgress currentStep={step} />

        <main className="relative flex-1 overflow-hidden">
          {showDone && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--void)]/75 backdrop-blur-sm">
              <div className="rounded-2xl border border-[var(--coral)]/45 bg-[var(--night)]/90 px-8 py-6 text-center">
                <p className="font-mono text-xl text-[var(--cream)]">Preview Complete</p>
              </div>
            </div>
          )}

          {step === "categories" ? (
            <CategoryPicker
              onComplete={(categories) => {
                setSelectedCategories(categories);
                setStep("genres");
              }}
              onSkip={() => setStep("genres")}
            />
          ) : (
            <GenrePicker
              onComplete={() => setShowDone(true)}
              onSkip={() => setShowDone(true)}
              selectedCategories={selectedCategories}
            />
          )}
        </main>
      </div>
    </div>
  );
}
