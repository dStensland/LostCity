"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import Image from "@/components/SmartImage";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { OnboardingProgress } from "./components/OnboardingProgress";
import { CategoryPicker } from "./steps/CategoryPicker";
import { SubcategoryPicker } from "./steps/SubcategoryPicker";
import { NeighborhoodPicker } from "./steps/NeighborhoodPicker";
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
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([]);
  const [showSubcategories, setShowSubcategories] = useState(false);
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
    (categories: string[], hasSubcategories: boolean) => {
      setSelectedCategories(categories);
      setShowSubcategories(hasSubcategories);

      if (hasSubcategories && categories.length > 0) {
        setStep("subcategories");
      } else {
        setStep("neighborhoods");
      }
    },
    []
  );

  const handleCategorySkip = useCallback(() => {
    setShowSubcategories(false);
    setStep("neighborhoods");
  }, []);

  const handleSubcategoryComplete = useCallback((subcategories: string[]) => {
    setSelectedSubcategories(subcategories);
    setStep("neighborhoods");
  }, []);

  const handleSubcategorySkip = useCallback(() => {
    setStep("neighborhoods");
  }, []);

  const handleNeighborhoodComplete = useCallback(
    async (neighborhoods: string[]) => {
      setSelectedNeighborhoods(neighborhoods);
      await completeOnboarding(neighborhoods);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCategories, selectedSubcategories]
  );

  const handleNeighborhoodSkip = useCallback(async () => {
    await completeOnboarding([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategories, selectedSubcategories]);

  // Complete onboarding and save preferences
  const completeOnboarding = async (neighborhoods: string[]) => {
    if (!user) return;

    try {
      await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedCategories,
          selectedSubcategories,
          selectedNeighborhoods: neighborhoods,
        }),
      });
    } catch (err) {
      console.error("Failed to save onboarding data:", err);
      // Continue anyway - don't block the user
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
    if (user && (selectedCategories.length > 0 || selectedNeighborhoods.length > 0)) {
      fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedCategories,
          selectedSubcategories,
          selectedNeighborhoods,
        }),
      }).catch(console.error);
    }

    // Navigate to feed
    if (portalSlug) {
      router.push(`/${portalSlug}`);
    } else {
      router.push("/atlanta");
    }
  }, [user, selectedCategories, selectedSubcategories, selectedNeighborhoods, portalSlug, router]);

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
      <OnboardingProgress currentStep={step} showSubcategories={showSubcategories} />

      {/* Main content */}
      <main className="flex-1">
        {step === "categories" && (
          <CategoryPicker
            onComplete={handleCategoryComplete}
            onSkip={handleCategorySkip}
          />
        )}

        {step === "subcategories" && (
          <SubcategoryPicker
            selectedCategories={selectedCategories}
            onComplete={handleSubcategoryComplete}
            onSkip={handleSubcategorySkip}
          />
        )}

        {step === "neighborhoods" && (
          <NeighborhoodPicker
            onComplete={handleNeighborhoodComplete}
            onSkip={handleNeighborhoodSkip}
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
