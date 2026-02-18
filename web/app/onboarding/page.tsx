"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import Image from "@/components/SmartImage";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { OnboardingProgress } from "./components/OnboardingProgress";
import { CategoryPicker } from "./steps/CategoryPicker";
import { GenrePicker } from "./steps/GenrePicker";
import type { OnboardingStep } from "@/lib/types";

type Portal = {
  id: string;
  slug: string;
  name: string;
  branding: {
    logo_url?: string;
  };
  filters?: {
    categories?: string[];
  } | null;
};

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runtimeSearch = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search);
  }, []);
  const portalSlug = searchParams.get("portal") ?? runtimeSearch?.get("portal");
  const isPreviewMode =
    searchParams.get("preview") === "1" || runtimeSearch?.get("preview") === "1";
  const previewStepParam = searchParams.get("step") ?? runtimeSearch?.get("step");
  const previewCategoriesParam =
    searchParams.get("categories") ?? runtimeSearch?.get("categories");
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const initialStep: OnboardingStep =
    isPreviewMode && previewStepParam === "genres" ? "genres" : "categories";
  const initialPreviewCategories =
    isPreviewMode && previewCategoriesParam
      ? previewCategoriesParam
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

  // State
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialPreviewCategories);
  const [selectedGenres, setSelectedGenres] = useState<Record<string, string[]>>({});
  const [selectedNeeds, setSelectedNeeds] = useState<{
    accessibility: string[];
    dietary: string[];
    family: string[];
  }>({ accessibility: [], dietary: [], family: [] });
  const [portal, setPortal] = useState<Portal | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!isPreviewMode && !authLoading && !user) {
      router.push(`/auth/login${portalSlug ? `?redirect=/onboarding?portal=${portalSlug}` : ""}`);
    }
  }, [authLoading, isPreviewMode, user, router, portalSlug]);

  // Load portal data if specified
  useEffect(() => {
    async function loadPortal() {
      if (!portalSlug) return;

      const { data } = await supabase
        .from("portals")
        .select("id, slug, name, branding, filters")
        .eq("slug", portalSlug)
        .eq("status", "active")
        .maybeSingle();

      if (data) {
        setPortal(data as Portal);
      }
    }
    loadPortal();
  }, [portalSlug, supabase]);

  const portalCategoryFilter = useMemo(() => {
    const categories = portal?.filters?.categories;
    if (!Array.isArray(categories)) return undefined;
    const valid = categories.filter((value): value is string => typeof value === "string");
    return valid.length > 0 ? valid : undefined;
  }, [portal?.filters?.categories]);

  // Step handlers
  const handleCategoryComplete = useCallback(
    (categories: string[]) => {
      setSelectedCategories(categories);
      // Trigger smooth transition to next step
      setIsTransitioning(true);
      setTimeout(() => {
        setStep("genres");
        setIsTransitioning(false);
      }, 300);
    },
    []
  );

  const handleCategorySkip = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep("genres");
      setIsTransitioning(false);
    }, 300);
  }, []);

  const handleGenreComplete = useCallback(
    async (genres: Record<string, string[]>, needs: { accessibility: string[]; dietary: string[]; family: string[] }) => {
      setSelectedGenres(genres);
      setSelectedNeeds(needs);
      // Show celebration before redirect
      setShowCelebration(true);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await completeOnboarding(genres, needs);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCategories]
  );

  const handleGenreSkip = useCallback(async () => {
    setShowCelebration(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await completeOnboarding({}, { accessibility: [], dietary: [], family: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategories]);

  // Complete onboarding and save preferences
  const completeOnboarding = async (
    genres: Record<string, string[]>,
    needs: { accessibility: string[]; dietary: string[]; family: string[] }
  ) => {
    if (!user) {
      if (isPreviewMode) {
        if (portalSlug) router.push(`/${portalSlug}`);
        else router.push("/atlanta");
      }
      return;
    }

    try {
      await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedCategories,
          selectedGenres: genres,
          selectedNeeds: needs,
        }),
      });
    } catch (err) {
      console.error("Failed to save onboarding data:", err);
    }

    // Navigate to feed
    if (portalSlug) {
      router.push(`/${portalSlug}`);
    } else {
      router.push("/atlanta");
    }
  };

  // Handle exit (X button)
  const handleExit = useCallback(() => {
    // Save partial progress if we have any selections
    const hasGenres = Object.values(selectedGenres).some((g) => g.length > 0);
    const hasNeeds = Object.values(selectedNeeds).some((n) => n.length > 0);
    if (user && (selectedCategories.length > 0 || hasGenres || hasNeeds)) {
      fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedCategories,
          selectedGenres,
          selectedNeeds,
        }),
      }).catch(console.error);
    }

    // Navigate to feed
    if (portalSlug) {
      router.push(`/${portalSlug}`);
    } else {
      router.push("/atlanta");
    }
  }, [user, selectedCategories, selectedGenres, selectedNeeds, portalSlug, router]);

  // Loading state
  if (authLoading || (!user && !isPreviewMode)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--void)]">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--void)]">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(circle_at_16%_14%,rgba(0,212,232,0.12),transparent_42%),radial-gradient(circle_at_80%_12%,rgba(255,107,122,0.12),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background:repeating-linear-gradient(125deg,rgba(255,255,255,0.025)_0,rgba(255,255,255,0.025)_2px,transparent_2px,transparent_11px)]" />
      <div className="relative z-10 flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-[var(--twilight)]/45 bg-[var(--night)]/75 px-4 py-4 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {portal?.branding?.logo_url ? (
              <Image
                src={portal.branding.logo_url}
                alt={portal.name}
                width={32}
                height={32}
                className="rounded-lg"
              />
            ) : (
              <Logo />
            )}
            <div className="flex flex-col">
              {portal && (
                <span className="font-mono text-xs text-[var(--muted)]">{portal.name}</span>
              )}
              {isPreviewMode && (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--soft)]">
                  Preview Mode
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <p className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--soft)] sm:block">
              Personalized Discovery Setup
            </p>

            {/* Exit button */}
            <button
              onClick={handleExit}
              className="p-2 text-[var(--muted)] transition-colors hover:text-[var(--cream)]"
              aria-label="Exit onboarding"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <OnboardingProgress currentStep={step} />

      {/* Main content */}
      <main className="relative flex-1 overflow-hidden">
        {/* Celebration overlay */}
        {showCelebration && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--void)]/80 backdrop-blur-sm animate-fadeIn">
            <div className="text-center animate-celebration-checkmark">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--coral)] flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-[var(--void)]"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="font-mono text-xl text-[var(--cream)]">You&apos;re all set!</p>
            </div>
          </div>
        )}

        {/* Step transitions */}
        <div className={isTransitioning ? "animate-step-slide-out" : ""}>
          {step === "categories" && (
            <div className="animate-step-slide-in">
              <CategoryPicker
                onComplete={handleCategoryComplete}
                onSkip={handleCategorySkip}
                portalCategoryFilter={portalCategoryFilter}
              />
            </div>
          )}

          {step === "genres" && (
            <div className="animate-step-slide-in">
              <GenrePicker
                onComplete={handleGenreComplete}
                onSkip={handleGenreSkip}
                selectedCategories={selectedCategories}
                portalCategoryFilter={portalCategoryFilter}
              />
            </div>
          )}
        </div>
      </main>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--void)]">
          <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
