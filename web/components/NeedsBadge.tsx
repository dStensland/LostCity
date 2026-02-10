"use client";

import { useState, useEffect } from "react";

interface NeedsBadgeProps {
  venueId: number;
  compact?: boolean;
}

interface VerifiedTag {
  tag_slug: string;
  tag_label: string;
  tag_group: string;
  confirm_count: number;
}

// Minimum confirmations to show a badge
const CONFIDENCE_THRESHOLD = 3;

// Priority tags to display first (most important accessibility info)
const PRIORITY_TAGS = [
  "wheelchair-accessible",
  "asl-interpreted",
  "hearing-loop",
  "sensory-friendly",
];

/**
 * NeedsBadge - Shows verified accessibility/needs badges on event cards
 *
 * Displays a small badge when a venue has 3+ confirmations on accessibility tags.
 * Shows the most important verified tag (wheelchair access, ASL, etc.).
 *
 * Usage: <NeedsBadge venueId={event.venue_id} compact />
 */
export function NeedsBadge({ venueId, compact = false }: NeedsBadgeProps) {
  const [verifiedTag, setVerifiedTag] = useState<VerifiedTag | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVerifiedTags = async () => {
      try {
        const queryParams = new URLSearchParams({
          entity_type: "venue",
          entity_id: venueId.toString(),
        });

        const res = await fetch(`/api/tags/vote?${queryParams.toString()}`);
        if (!res.ok) {
          setIsLoading(false);
          return;
        }

        const data = await res.json();
        const tags: VerifiedTag[] = (data.tags || []).filter(
          (tag: VerifiedTag) =>
            ["accessibility", "dietary", "family"].includes(tag.tag_group) &&
            tag.confirm_count >= CONFIDENCE_THRESHOLD
        );

        if (tags.length === 0) {
          setIsLoading(false);
          return;
        }

        // Find highest priority tag, or fall back to highest score
        const priorityTag = PRIORITY_TAGS.map((slug) =>
          tags.find((t) => t.tag_slug === slug)
        ).find(Boolean);

        const topTag =
          priorityTag || tags.sort((a, b) => b.confirm_count - a.confirm_count)[0];

        setVerifiedTag(topTag);
      } catch (err) {
        console.error("Failed to fetch verified tags:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVerifiedTags();
  }, [venueId]);

  if (isLoading || !verifiedTag) return null;

  // Icon mapping
  const getIcon = (slug: string) => {
    if (slug.includes("wheelchair")) return "♿";
    if (slug.includes("asl")) return "🤟";
    if (slug.includes("hearing")) return "👂";
    if (slug.includes("sensory")) return "🎧";
    if (slug.includes("vegan")) return "🌱";
    if (slug.includes("gluten")) return "🌾";
    if (slug.includes("kid") || slug.includes("family") || slug.includes("stroller"))
      return "👨‍👩‍👧";
    return "✓";
  };

  if (compact) {
    // Small icon badge for event cards
    return (
      <div
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/30"
        title={`Verified ${verifiedTag.tag_label} (${verifiedTag.confirm_count} confirm)`}
      >
        <span className="text-xs">{getIcon(verifiedTag.tag_slug)}</span>
        <span className="font-mono text-[0.65rem] text-[var(--neon-cyan)]">
          Verified
        </span>
      </div>
    );
  }

  // Full badge with label
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/30">
      <span className="text-sm">{getIcon(verifiedTag.tag_slug)}</span>
      <span className="font-mono text-xs text-[var(--neon-cyan)]">
        {verifiedTag.tag_label}
      </span>
      <span className="font-mono text-xs text-[var(--neon-cyan)]/60">
        ({verifiedTag.confirm_count})
      </span>
    </div>
  );
}
