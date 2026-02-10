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
  const [portal, setPortal] = useState<Portal | null>(null);

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
      setStep("genres");
    },
    []
  );

  const handleCategorySkip = useCallback(() => {
    setStep("genres");
  }, []);

  const handleGenreComplete = useCallback(
    async (genres: Record<string, string[]>) => {
      setSelectedGenres(genres);
      await completeOnboarding(genres);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCategories]
  );

  const handleGenreSkip = useCallback(async () => {
    await completeOnboarding({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategories]);

  // Complete onboarding and save preferences
  const completeOnboarding = async (genres: Record<string, string[]>) => {
    if (!user) return;

    try {
      await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedCategories,
          selectedGenres: genres,
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
    if (user && (selectedCategories.length > 0 || hasGenres)) {
      fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedCategories,
          selectedGenres,
        }),
      }).catch(console.error);
    }

    // Navigate to feed
    if (portalSlug) {
      router.push(`/${portalSlug}`);
    } else {
      router.push("/atlanta");
    }
  }, [user, selectedCategories, selectedGenres, portalSlug, router]);

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
      <main className="flex-1">
        {step === "categories" && (
          <CategoryPicker
            onComplete={handleCategoryComplete}
            onSkip={handleCategorySkip}
          />
        )}

        {step === "genres" && (
          <GenrePicker
            onComplete={handleGenreComplete}
            onSkip={handleGenreSkip}
            selectedCategories={selectedCategories}
          />
        )}
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
