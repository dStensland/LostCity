"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

interface InlinePreferencesProps {
  eventId: number;
  category?: string | null;
  venueId?: number | null;
  neighborhood?: string | null;
  className?: string;
  onHide?: () => void;
}

export default function InlinePreferences({
  eventId,
  category,
  venueId,
  neighborhood,
  className = "",
  onHide,
}: InlinePreferencesProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [showMenu, setShowMenu] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  const handleThumbsUp = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) return;

    setFeedback("up");
    setSubmitting(true);

    try {
      // Send positive signal to the personalization API
      await fetch("/api/personalization/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          signal: "positive",
          category,
          venueId,
          neighborhood,
        }),
      });

      showToast("Got it! We'll show more like this.");
    } catch (error) {
      console.error("Failed to send feedback:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleThumbsDown = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) return;

    setFeedback("down");
    setShowMenu(true);
  };

  const handleHideReason = async (reason: string) => {
    if (!user) return;

    setSubmitting(true);

    try {
      // Send negative signal with reason
      await fetch("/api/personalization/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          signal: "negative",
          reason,
          category,
          venueId,
          neighborhood,
        }),
      });

      // Also hide this specific event
      await fetch("/api/personalization/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          reason,
        }),
      });

      showToast("Got it! We'll show less like this.");
      setShowMenu(false);
      onHide?.();
    } catch (error) {
      console.error("Failed to hide event:", error);
      showToast("Failed to update preferences", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <div className="flex items-center gap-1">
        {/* Thumbs up */}
        <button
          onClick={handleThumbsUp}
          disabled={submitting}
          className={`p-1.5 rounded-md transition-colors ${
            feedback === "up"
              ? "bg-[var(--neon-green)]/20 text-[var(--neon-green)]"
              : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50"
          }`}
          title="Show more like this"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
            />
          </svg>
        </button>

        {/* Thumbs down */}
        <button
          onClick={handleThumbsDown}
          disabled={submitting}
          className={`p-1.5 rounded-md transition-colors ${
            feedback === "down"
              ? "bg-[var(--coral)]/20 text-[var(--coral)]"
              : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50"
          }`}
          title="Show less like this"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5"
            />
          </svg>
        </button>
      </div>

      {/* Reason menu */}
      {showMenu && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-xl z-50 py-1 overflow-hidden">
          <p className="px-3 py-1.5 text-[0.65rem] font-mono text-[var(--muted)] uppercase tracking-wider">
            Why?
          </p>
          <button
            onClick={() => handleHideReason("not_interested")}
            disabled={submitting}
            className="w-full px-3 py-2 text-left text-sm text-[var(--cream)] hover:bg-[var(--twilight)]/30 transition-colors"
          >
            Not interested
          </button>
          <button
            onClick={() => handleHideReason("seen_enough")}
            disabled={submitting}
            className="w-full px-3 py-2 text-left text-sm text-[var(--cream)] hover:bg-[var(--twilight)]/30 transition-colors"
          >
            Seen it enough
          </button>
          {category && (
            <button
              onClick={() => handleHideReason("wrong_category")}
              disabled={submitting}
              className="w-full px-3 py-2 text-left text-sm text-[var(--cream)] hover:bg-[var(--twilight)]/30 transition-colors"
            >
              Less {category}
            </button>
          )}
          {neighborhood && (
            <button
              onClick={() => handleHideReason("wrong_neighborhood")}
              disabled={submitting}
              className="w-full px-3 py-2 text-left text-sm text-[var(--cream)] hover:bg-[var(--twilight)]/30 transition-colors"
            >
              Less from {neighborhood}
            </button>
          )}
          <div className="border-t border-[var(--twilight)] my-1" />
          <button
            onClick={() => setShowMenu(false)}
            className="w-full px-3 py-2 text-left text-sm text-[var(--muted)] hover:bg-[var(--twilight)]/30 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// Preference chips for the dashboard header
export function PreferenceChips({
  className = "",
}: {
  className?: string;
}) {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<{
    categories: string[];
    neighborhoods: string[];
  }>({ categories: [], neighborhoods: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPreferences() {
      if (!user) return;

      try {
        const res = await fetch("/api/personalization/preferences");
        if (res.ok) {
          const data = await res.json();
          setPreferences({
            categories: data.favorite_categories || [],
            neighborhoods: data.favorite_neighborhoods || [],
          });
        }
      } catch (error) {
        console.error("Failed to load preferences:", error);
      } finally {
        setLoading(false);
      }
    }

    loadPreferences();
  }, [user]);

  const toggleCategory = async (category: string) => {
    if (!user) return;

    const isActive = preferences.categories.includes(category);
    const newCategories = isActive
      ? preferences.categories.filter((c) => c !== category)
      : [...preferences.categories, category];

    setPreferences((prev) => ({
      ...prev,
      categories: newCategories,
    }));

    try {
      await fetch("/api/personalization/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          favorite_categories: newCategories,
        }),
      });
    } catch (error) {
      console.error("Failed to update preferences:", error);
      // Revert on error
      setPreferences((prev) => ({
        ...prev,
        categories: isActive
          ? [...prev.categories, category]
          : prev.categories.filter((c) => c !== category),
      }));
    }
  };

  if (!user || loading) return null;

  const allCategories = ["music", "comedy", "theater", "art", "film", "community", "sports", "nightlife"];

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {allCategories.map((category) => {
        const isActive = preferences.categories.includes(category);
        return (
          <button
            key={category}
            onClick={() => toggleCategory(category)}
            className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
              isActive
                ? "bg-[var(--coral)] text-[var(--void)]"
                : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}
