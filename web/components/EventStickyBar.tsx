"use client";

import { useState, useEffect, useCallback } from "react";
import RSVPButton, { type RSVPStatus } from "./RSVPButton";
import PreferencePrompt, { hasPromptBeenDismissed } from "./PreferencePrompt";
import { useAuth } from "@/lib/auth-context";
import { CATEGORY_CONFIG, type CategoryType } from "./CategoryIcon";
import { useViewTracking, useShareTracking } from "@/hooks/useSignalTracking";

interface Props {
  eventId: number;
  eventTitle: string;
  ticketUrl?: string | null;
  /** Event category for preference prompts */
  eventCategory?: string | null;
}

export default function EventStickyBar({ eventId, eventTitle, ticketUrl, eventCategory }: Props) {
  const { user } = useAuth();
  const [showPreferencePrompt, setShowPreferencePrompt] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Track view signal after 2 seconds on page
  useViewTracking(eventId, 2000);

  // Share tracking
  const { trackShare } = useShareTracking(eventId);

  // Show sticky bar after scrolling past the quick actions (roughly 400px)
  useEffect(() => {
    const handleScroll = () => {
      const scrollThreshold = 400;
      setIsVisible(window.scrollY > scrollThreshold);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial position

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle RSVP change - potentially show preference prompt
  const handleRSVPChange = useCallback(
    async (newStatus: RSVPStatus, _prevStatus: RSVPStatus) => {
      // Only show prompt for "going" status and if we have a category
      if (newStatus !== "going" || !eventCategory || !user) {
        return;
      }

      // Check if prompt was already dismissed for this category
      if (hasPromptBeenDismissed(eventCategory)) {
        return;
      }

      // Check if category is already in user preferences
      try {
        const res = await fetch("/api/preferences");
        if (res.ok) {
          const prefs = await res.json();
          const userCategories = prefs.favorite_categories || [];
          if (userCategories.includes(eventCategory)) {
            return; // Already in preferences
          }
        }
      } catch {
        // If we can't fetch preferences, still show the prompt
      }

      // Show the prompt
      setShowPreferencePrompt(true);
    },
    [eventCategory, user]
  );

  const handlePreferenceAccept = useCallback(async () => {
    if (!eventCategory) return;

    try {
      await fetch("/api/preferences/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "category", value: eventCategory }),
      });
    } catch (err) {
      console.error("Failed to add preference:", err);
    }

    setShowPreferencePrompt(false);
  }, [eventCategory]);

  const handlePreferenceDismiss = useCallback(() => {
    setShowPreferencePrompt(false);
  }, []);


  const handleShare = async () => {
    const shareData = {
      title: eventTitle,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        // Track share signal
        trackShare();
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        // Track share signal even for clipboard copy
        trackShare();
      }
    } catch {
      // User cancelled or error - ignore
    }
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      {/* Gradient fade above the bar */}
      <div className="h-6 bg-gradient-to-t from-[var(--void)] to-transparent" />

      {/* Main bar */}
      <div className="bg-[var(--void)]/95 backdrop-blur-md border-t border-[var(--twilight)] px-4 py-3 safe-area-bottom">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {/* Share button */}
          <button
            onClick={handleShare}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg border border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--soft)] transition-colors"
            aria-label="Share event"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
          </button>

          {/* RSVP button */}
          <div className="flex-shrink-0">
            <RSVPButton eventId={eventId} variant="compact" onRSVPChange={handleRSVPChange} />
          </div>

          {/* Primary CTA */}
          {ticketUrl ? (
            <a
              href={ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[var(--coral)] text-[var(--void)] font-semibold rounded-lg hover:bg-[var(--rose)] transition-all shadow-[0_0_20px_rgba(255,107,122,0.4)] hover:shadow-[0_0_30px_rgba(255,107,122,0.6)]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                />
              </svg>
              Get Tickets
            </a>
          ) : (
            <div className="flex-1">
              <RSVPButton eventId={eventId} variant="primary" className="w-full justify-center" onRSVPChange={handleRSVPChange} />
            </div>
          )}

          {/* Preference Prompt */}
          {showPreferencePrompt && eventCategory && (
            <div className="absolute left-4 right-4 bottom-full mb-3">
              <PreferencePrompt
                category={eventCategory}
                categoryLabel={CATEGORY_CONFIG[eventCategory as CategoryType]?.label || eventCategory}
                onAccept={handlePreferenceAccept}
                onDismiss={handlePreferenceDismiss}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
