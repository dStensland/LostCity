"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
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
};

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const portalSlug = searchParams.get("portal");
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  // State
  const [step, setStep] = useState<OnboardingStep>("categories");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
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
    if (!authLoading && !user) {
      router.push(`/auth/login${portalSlug ? `?redirect=/onboarding?portal=${portalSlug}` : ""}`);
    }
  }, [authLoading, user, router, portalSlug]);

  // Load portal data if specified
  useEffect(() => {
    async function loadPortal() {
      if (!portalSlug) return;

      const { data } = await supabase
        .from("portals")
        .select("id, slug, name, branding")
        .eq("slug", portalSlug)
        .eq("status", "active")
        .maybeSingle();

      if (data) {
        setPortal(data as Portal);
      }
    }
    loadPortal();
  }, [portalSlug, supabase]);

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
    if (!user) return;

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
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--void)]">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--void)]">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 border-b border-[var(--twilight)] flex items-center justify-between">
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
          {portal && (
            <span className="font-mono text-xs text-[var(--muted)]">{portal.name}</span>
          )}
        </div>

        {/* Exit button */}
        <button
          onClick={handleExit}
          className="p-2 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          aria-label="Exit onboarding"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Progress bar */}
      <OnboardingProgress currentStep={step} />

      {/* Main content */}
      <main className="flex-1 relative overflow-hidden">
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
              <p className="font-mono text-xl text-[var(--cream)]">You're all set!</p>
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
              />
            </div>
          )}

          {step === "genres" && (
            <div className="animate-step-slide-in">
              <GenrePicker
                onComplete={handleGenreComplete}
                onSkip={handleGenreSkip}
                selectedCategories={selectedCategories}
              />
            </div>
          )}
        </div>
      </main>
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
