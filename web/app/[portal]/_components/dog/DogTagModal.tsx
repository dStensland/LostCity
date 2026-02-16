"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAuthenticatedFetch } from "@/lib/hooks/useAuthenticatedFetch";
import { DOG_TAG_GROUPS, type DogTagGroup } from "@/lib/dog-tags";

interface Props {
  venueId: number;
  venueName: string;
  venueType: string | null;
  existingVibes: string[] | null;
  onClose: () => void;
  onSuccess: (updatedVibes: string[]) => void;
}

export default function DogTagModal({
  venueId,
  venueName,
  venueType,
  existingVibes,
  onClose,
  onSuccess,
}: Props) {
  const { user } = useAuth();
  const { authFetch } = useAuthenticatedFetch();
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    new Set(["dog-friendly"])
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleGroups = getVisibleGroups(venueType);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (tag === "dog-friendly") return next; // Cannot uncheck base tag
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const handleSubmit = async () => {
    if (selectedTags.size === 0) {
      setError("Select at least one tag.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const vibes = Array.from(selectedTags);
    const { data, error: fetchError } = await authFetch<{
      success: boolean;
      vibes: string[];
    }>("/api/tag-venue", { method: "POST", body: { venue_id: venueId, vibes } });

    setSubmitting(false);

    if (fetchError || !data?.success) {
      setError("Something went wrong. Try again.");
      return;
    }

    onSuccess(data.vibes);
  };

  const alreadyTagged = new Set(existingVibes || []);

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-6"
        style={{ background: "var(--dog-cream, #FFFBEB)" }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--dog-charcoal)" }}
            >
              Tag this spot
            </h2>
            <p className="text-sm" style={{ color: "var(--dog-stone)" }}>
              {venueName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 -mt-2"
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="var(--dog-stone, #78716C)"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M5 5L15 15M15 5L5 15" />
            </svg>
          </button>
        </div>

        {!user && (
          <div
            className="text-center py-6 rounded-xl mb-4"
            style={{ background: "rgba(253, 232, 138, 0.2)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--dog-charcoal)" }}>
              Sign in to tag venues
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--dog-stone)" }}>
              Your tags help other dog owners find the best spots.
            </p>
          </div>
        )}

        {user && (
          <>
            <div className="space-y-5">
              {visibleGroups.map((group) => (
                <div key={group.key}>
                  <h3
                    className="text-xs font-bold uppercase tracking-wider mb-2"
                    style={{ color: "var(--dog-stone)" }}
                  >
                    {group.label}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {group.tags.map((tag) => {
                      const isSelected = selectedTags.has(tag.machineKey);
                      const isExisting = alreadyTagged.has(tag.machineKey);
                      return (
                        <button
                          key={tag.machineKey}
                          onClick={() => toggleTag(tag.machineKey)}
                          disabled={isExisting || tag.machineKey === "dog-friendly"}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                          style={{
                            background: isExisting
                              ? "rgba(5, 150, 105, 0.15)"
                              : isSelected
                                ? "var(--dog-orange)"
                                : "rgba(253, 232, 138, 0.25)",
                            color: isExisting
                              ? "var(--dog-green)"
                              : isSelected
                                ? "#fff"
                                : "var(--dog-charcoal)",
                            opacity: isExisting ? 0.7 : 1,
                          }}
                        >
                          {tag.icon} {tag.label}
                          {isExisting && " ✓"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <p
                className="text-xs mt-3"
                style={{ color: "var(--dog-error, #EF4444)" }}
              >
                {error}
              </p>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="dog-btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || selectedTags.size === 0}
                className="dog-btn-primary flex-1"
                style={{
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? "Saving..." : "Submit Tags"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function getVisibleGroups(venueType: string | null): DogTagGroup[] {
  const type = (venueType || "").toLowerCase();
  const isPark = ["park", "dog_park", "trail", "nature_preserve"].includes(type);
  const isTrail = ["trail", "nature_preserve"].includes(type);
  const isFood = ["restaurant", "bar", "cafe", "brewery", "coffee_shop"].includes(type);

  return DOG_TAG_GROUPS.filter((group) => {
    if (group.key === "base" || group.key === "amenities") return true;
    if (group.key === "food") return isFood || (!isPark && !isTrail);
    if (group.key === "access") return isPark;
    if (group.key === "surface") return isPark || isTrail;
    return true;
  });
}
