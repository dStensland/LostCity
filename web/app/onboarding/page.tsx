"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { OnboardingProgress } from "./components/OnboardingProgress";
import { WelcomeSplash } from "./steps/WelcomeSplash";
import { MoodPicker } from "./steps/MoodPicker";
import { SwipeDiscovery } from "./steps/SwipeDiscovery";
import { NeighborhoodMap } from "./steps/NeighborhoodMap";
import { FeedPreview } from "./steps/FeedPreview";
import type { OnboardingStep, OnboardingSwipeEvent, OnboardingMood, OnboardingAction } from "@/lib/types";

type Portal = {
  id: string;
  slug: string;
  name: string;
  branding: {
    logo_url?: string;
  };
};

interface OnboardingInteraction {
  step: string;
  event_id?: number;
  action: OnboardingAction;
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const portalSlug = searchParams.get("portal");
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  // State
  const [step, setStep] = useState<OnboardingStep>("splash");
  const [mood, setMood] = useState<OnboardingMood | null>(null);
  const [likedEvents, setLikedEvents] = useState<OnboardingSwipeEvent[]>([]);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([]);
  const [portal, setPortal] = useState<Portal | null>(null);
  const [interactions, setInteractions] = useState<OnboardingInteraction[]>([]);

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
        .single();

      if (data) {
        setPortal(data as Portal);
      }
    }
    loadPortal();
  }, [portalSlug, supabase]);

  // Track interaction
  const trackInteraction = useCallback((step: string, action: OnboardingAction, eventId?: number) => {
    setInteractions((prev) => [
      ...prev,
      { step, action, event_id: eventId },
    ]);
  }, []);

  // Step handlers
  const handleSplashComplete = useCallback(() => {
    setStep("mood");
  }, []);

  const handleMoodSelect = useCallback(
    (selectedMood: OnboardingMood) => {
      setMood(selectedMood);
      trackInteraction("mood", "select");
      setStep("swipe");
    },
    [trackInteraction]
  );

  const handleMoodSkip = useCallback(() => {
    trackInteraction("mood", "skip");
    setStep("swipe");
  }, [trackInteraction]);

  const handleSwipeComplete = useCallback(
    (events: OnboardingSwipeEvent[]) => {
      setLikedEvents(events);
      // Track likes
      events.forEach((event) => {
        trackInteraction("swipe", "like", event.id);
      });
      setStep("neighborhood");
    },
    [trackInteraction]
  );

  const handleSwipeSkip = useCallback(() => {
    trackInteraction("swipe", "skip");
    setStep("neighborhood");
  }, [trackInteraction]);

  const handleNeighborhoodComplete = useCallback(
    (neighborhoods: string[]) => {
      setSelectedNeighborhoods(neighborhoods);
      neighborhoods.forEach(() => {
        trackInteraction("neighborhood", "select");
      });
      setStep("preview");
    },
    [trackInteraction]
  );

  const handleNeighborhoodSkip = useCallback(() => {
    trackInteraction("neighborhood", "skip");
    setStep("preview");
  }, [trackInteraction]);

  const handleFinalComplete = useCallback(
    async (followedProducerIds: number[]) => {
      if (!user) return;

      // Track producer follows
      followedProducerIds.forEach(() => {
        trackInteraction("producer", "follow");
      });

      try {
        // Save all onboarding data via API
        await fetch("/api/onboarding/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mood,
            likedEventIds: likedEvents.map((e) => e.id),
            selectedNeighborhoods,
            followedProducerIds,
            interactions,
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
        router.push("/foryou");
      }
    },
    [user, mood, likedEvents, selectedNeighborhoods, interactions, portalSlug, router, trackInteraction]
  );

  // Handle exit (X button)
  const handleExit = useCallback(() => {
    // Save partial progress if we have any
    if (user && (mood || likedEvents.length > 0)) {
      fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood,
          likedEventIds: likedEvents.map((e) => e.id),
          selectedNeighborhoods: [],
          followedProducerIds: [],
          interactions,
        }),
      }).catch(console.error);
    }

    // Navigate to feed
    if (portalSlug) {
      router.push(`/${portalSlug}`);
    } else {
      router.push("/");
    }
  }, [user, mood, likedEvents, interactions, portalSlug, router]);

  // Loading state
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--void)]">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Splash screen (full screen, no header)
  if (step === "splash") {
    return (
      <WelcomeSplash
        onComplete={handleSplashComplete}
        portalLogo={portal?.branding?.logo_url}
        portalName={portal?.name}
      />
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
        {step === "mood" && (
          <MoodPicker onSelect={handleMoodSelect} onSkip={handleMoodSkip} />
        )}

        {step === "swipe" && (
          <SwipeDiscovery
            mood={mood}
            portalId={portal?.id || null}
            onComplete={handleSwipeComplete}
            onSkip={handleSwipeSkip}
          />
        )}

        {step === "neighborhood" && (
          <NeighborhoodMap
            likedEvents={likedEvents}
            onComplete={handleNeighborhoodComplete}
            onSkip={handleNeighborhoodSkip}
          />
        )}

        {step === "preview" && (
          <FeedPreview
            likedEvents={likedEvents}
            onComplete={handleFinalComplete}
            portalSlug={portalSlug}
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
