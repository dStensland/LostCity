"use client";

import { useState, useEffect } from "react";
import { TagVoteChip } from "./TagVoteChip";

interface PostRsvpNeedsPromptProps {
  venueId: number;
  venueName: string;
  venueType: string | null;
  onDismiss?: () => void;
}

// Tag suggestions based on venue type
const VENUE_TYPE_TAG_MAP: Record<string, string[]> = {
  restaurant: ["wheelchair-accessible", "gluten-free-options", "vegan-options", "kid-friendly"],
  bar: ["wheelchair-accessible", "accessible-restroom", "stroller-friendly"],
  music_venue: ["wheelchair-accessible", "accessible-restroom", "hearing-loop", "accessible-parking"],
  theater: ["wheelchair-accessible", "asl-interpreted", "hearing-loop", "accessible-parking"],
  comedy_club: ["wheelchair-accessible", "accessible-restroom", "accessible-parking"],
  gallery: ["wheelchair-accessible", "stroller-friendly", "elevator-access"],
  museum: ["wheelchair-accessible", "stroller-friendly", "elevator-access", "nursing-room"],
  brewery: ["wheelchair-accessible", "gluten-free-options", "vegan-options", "kid-friendly"],
  coffee_shop: ["wheelchair-accessible", "vegan-options", "vegetarian-options", "stroller-friendly"],
  cinema: ["wheelchair-accessible", "hearing-loop", "accessible-parking", "sensory-friendly"],
};

// Default tags for unknown venue types
const DEFAULT_TAGS = ["wheelchair-accessible", "accessible-restroom", "stroller-friendly"];

// Tag metadata for display (matches migration 173)
const TAG_METADATA: Record<string, { label: string; group: string }> = {
  "wheelchair-accessible": { label: "Wheelchair Accessible", group: "accessibility" },
  "elevator-access": { label: "Elevator Access", group: "accessibility" },
  "hearing-loop": { label: "Hearing Loop", group: "accessibility" },
  "asl-interpreted": { label: "ASL Interpreted", group: "accessibility" },
  "sensory-friendly": { label: "Sensory Friendly", group: "accessibility" },
  "service-animals-welcome": { label: "Service Animals Welcome", group: "accessibility" },
  "accessible-parking": { label: "Accessible Parking", group: "accessibility" },
  "accessible-restroom": { label: "Accessible Restroom", group: "accessibility" },
  "gluten-free-options": { label: "Gluten-Free Options", group: "dietary" },
  "vegan-options": { label: "Vegan Options", group: "dietary" },
  "vegetarian-options": { label: "Vegetarian Options", group: "dietary" },
  "halal": { label: "Halal", group: "dietary" },
  "kosher": { label: "Kosher", group: "dietary" },
  "nut-free": { label: "Nut-Free", group: "dietary" },
  "stroller-friendly": { label: "Stroller Friendly", group: "family" },
  "kid-friendly": { label: "Kid Friendly", group: "family" },
  "changing-table": { label: "Changing Table", group: "family" },
  "nursing-room": { label: "Nursing Room", group: "family" },
};

const DISMISS_STORAGE_KEY = "rsvp-needs-prompt-dismissed";

/**
 * PostRsvpNeedsPrompt - Shows after RSVP to collect accessibility/dietary/family needs data
 *
 * Displays 3-4 relevant tags based on venue type. Users can thumbs-up/down.
 * Dismissible and saves dismiss state to localStorage per venue.
 *
 * Usage: Render after successful RSVP in RSVPButton onRSVPChange callback
 */
export function PostRsvpNeedsPrompt({
  venueId,
  venueName,
  venueType,
  onDismiss,
}: PostRsvpNeedsPromptProps) {
  const [isDismissed, setIsDismissed] = useState(true); // Start dismissed, show after mount check
  const [votedTags, setVotedTags] = useState<Set<string>>(new Set());

  // Check localStorage on mount
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (dismissed) {
        const dismissedVenues: number[] = JSON.parse(dismissed);
        if (dismissedVenues.includes(venueId)) {
          return; // Keep dismissed
        }
      }
      // Not dismissed for this venue, show the prompt
      setIsDismissed(false);
    } catch (err) {
      console.error("Failed to load dismiss state:", err);
      setIsDismissed(false); // Show on error to be safe
    }
  }, [venueId]);

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();

    // Save to localStorage
    try {
      const dismissed = localStorage.getItem(DISMISS_STORAGE_KEY);
      const dismissedVenues: number[] = dismissed ? JSON.parse(dismissed) : [];
      if (!dismissedVenues.includes(venueId)) {
        dismissedVenues.push(venueId);
        localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(dismissedVenues));
      }
    } catch (err) {
      console.error("Failed to save dismiss state:", err);
    }
  };

  const handleVoteChange = (tagSlug: string) => {
    // Track voted tags to auto-dismiss after 2 votes
    setVotedTags((prev) => {
      const updated = new Set(prev);
      updated.add(tagSlug);

      // Auto-dismiss after voting on 2 tags
      if (updated.size >= 2) {
        setTimeout(handleDismiss, 500); // Brief delay so user sees the vote register
      }

      return updated;
    });
  };

  // Don't render if dismissed
  if (isDismissed) return null;

  // Get relevant tags for this venue type
  const suggestedTagSlugs =
    (venueType && VENUE_TYPE_TAG_MAP[venueType]) || DEFAULT_TAGS;

  // Take first 4 tags
  const displayTags = suggestedTagSlugs.slice(0, 4);

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-fadeIn">
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl shadow-2xl p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-mono text-sm font-semibold text-[var(--cream)]">
              Quick question
            </h3>
            <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
              Help the community know about {venueName}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors p-1"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tag chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {displayTags.map((slug) => {
            const meta = TAG_METADATA[slug];
            if (!meta) return null;

            return (
              <TagVoteChip
                key={slug}
                entityType="venue"
                entityId={venueId}
                tagSlug={slug}
                tagLabel={meta.label}
                confirmCount={0} // Start at 0, will update optimistically
                onVoteChange={() => handleVoteChange(slug)}
              />
            );
          })}
        </div>

        {/* Skip button */}
        <button
          onClick={handleDismiss}
          className="w-full text-center font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors py-1"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
