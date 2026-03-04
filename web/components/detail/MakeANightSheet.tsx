"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "@/components/SmartImage";
import Skeleton from "@/components/Skeleton";
import { getSpotTypeLabel } from "@/lib/spots-constants";
import { formatTime } from "@/lib/formats";
import {
  X,
  Clock,
  PersonSimpleWalk,
  ForkKnife,
  BeerStein,
  Mountains,
  GameController,
  CaretDown,
  Lightning,
} from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnchorEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day?: boolean;
  venue: {
    id: number;
    name: string;
    slug: string;
    lat: number | null;
    lng: number | null;
  } | null;
};

type Suggestion = {
  id: number;
  title: string;
  venue: {
    id: number;
    name: string;
    slug: string;
    lat: number | null;
    lng: number | null;
    venue_type: string | null;
  };
  suggested_time: string;
  distance_km: number;
  walking_minutes: number;
  reason: string;
  category: "food" | "drinks" | "activity" | "sight";
  image_url: string | null;
  active_special?: { title: string; type: string } | null;
};

interface MakeANightSheetProps {
  anchorEvent: AnchorEvent;
  portalSlug: string;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Category fallback icon
// ---------------------------------------------------------------------------

function CategoryFallbackIcon({ category }: { category: Suggestion["category"] }) {
  const props = { size: 20, weight: "light" as const };
  switch (category) {
    case "food":
      return <ForkKnife {...props} className="text-[var(--gold)]" />;
    case "drinks":
      return <BeerStein {...props} className="text-[var(--neon-cyan)]" />;
    case "sight":
      return <Mountains {...props} className="text-[var(--neon-green)]" />;
    case "activity":
      return <GameController {...props} className="text-[var(--coral)]" />;
  }
}

function categoryFallbackBg(category: Suggestion["category"]): string {
  switch (category) {
    case "food": return "bg-[var(--gold)]/10";
    case "drinks": return "bg-[var(--neon-cyan)]/10";
    case "sight": return "bg-[var(--neon-green)]/10";
    case "activity": return "bg-[var(--coral)]/10";
  }
}

// ---------------------------------------------------------------------------
// Suggestion Card — with reason, special, 56px image
// ---------------------------------------------------------------------------

const INITIAL_SHOW = 6;

function SuggestionCard({
  suggestion,
  onNavigate,
}: {
  suggestion: Suggestion;
  onNavigate: (slug: string) => void;
}) {
  const typeLabel = getSpotTypeLabel(suggestion.venue.venue_type);

  return (
    <button
      onClick={() => onNavigate(suggestion.venue.slug)}
      className="flex items-start gap-3 w-full text-left p-3 rounded-lg border border-[var(--twilight)] bg-[var(--night)] hover:border-[var(--coral)]/50 transition-colors group focus-ring"
    >
      {/* Venue image — 56x56 with category-colored fallback */}
      <div className={`w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 ${
        suggestion.image_url ? "bg-[var(--twilight)]" : categoryFallbackBg(suggestion.category)
      }`}>
        {suggestion.image_url ? (
          <Image
            src={suggestion.image_url}
            alt={suggestion.title}
            width={56}
            height={56}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <CategoryFallbackIcon category={suggestion.category} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors">
          {suggestion.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {typeLabel && (
            <span className="text-xs text-[var(--soft)]">{typeLabel}</span>
          )}
          <span className="flex items-center gap-0.5 text-xs text-[var(--muted)]">
            <PersonSimpleWalk size={11} weight="light" />
            {suggestion.walking_minutes} min
          </span>
        </div>
        {/* Reason — the API's intelligence, made visible */}
        <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
          {suggestion.reason}
        </p>
        {/* Active special badge */}
        {suggestion.active_special && (
          <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-2xs font-mono font-medium bg-[var(--neon-green)]/10 text-[var(--neon-green)] border border-[var(--neon-green)]/20">
            <Lightning size={10} weight="fill" />
            {suggestion.active_special.title}
          </span>
        )}
      </div>

      {/* Suggested time */}
      <div className="flex-shrink-0 text-right pt-0.5">
        <span className="block text-2xs font-mono text-[var(--muted)] uppercase tracking-wider">
          arrive by
        </span>
        <span className="text-xs font-mono text-[var(--soft)]">
          {suggestion.suggested_time}
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Skeleton cards — updated to 56px
// ---------------------------------------------------------------------------

function SuggestionSkeleton({ index }: { index: number }) {
  const delay = `${0.1 + index * 0.1}s`;
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--twilight)] bg-[var(--night)]">
      <Skeleton className="w-14 h-14 rounded-xl flex-shrink-0" delay={delay} />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-[60%] rounded" delay={delay} />
        <Skeleton className="h-3 w-[40%] rounded mt-1.5" delay={delay} />
        <Skeleton className="h-3 w-[55%] rounded mt-1" delay={delay} />
      </div>
      <Skeleton className="h-6 w-14 rounded flex-shrink-0" delay={delay} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section with show-more
// ---------------------------------------------------------------------------

function SuggestionSection({
  title,
  suggestions,
  loading: isLoading,
  onNavigate,
}: {
  title: string;
  suggestions: Suggestion[];
  loading: boolean;
  onNavigate: (slug: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = suggestions.length > INITIAL_SHOW;
  const visible = expanded ? suggestions : suggestions.slice(0, INITIAL_SHOW);

  // Loading state
  if (isLoading) {
    return (
      <div>
        <h3 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)] py-3 border-t border-[var(--twilight)]">
          {title}
        </h3>
        <div className="space-y-2">
          <SuggestionSkeleton index={0} />
          <SuggestionSkeleton index={1} />
          <SuggestionSkeleton index={2} />
        </div>
      </div>
    );
  }

  // No results — don't render section at all
  if (suggestions.length === 0) return null;

  return (
    <div>
      <h3 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)] py-3 border-t border-[var(--twilight)]">
        {title}
      </h3>
      <div className="space-y-2">
        {visible.map((s) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            onNavigate={onNavigate}
          />
        ))}
      </div>
      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 mt-2 text-xs font-mono text-[var(--coral)] hover:opacity-80 transition-opacity"
        >
          <CaretDown size={12} weight="bold" />
          +{suggestions.length - INITIAL_SHOW} more
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MakeANightSheet({
  anchorEvent,
  portalSlug,
  isOpen,
  onClose,
}: MakeANightSheetProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [beforeSuggestions, setBeforeSuggestions] = useState<Suggestion[]>([]);
  const [afterSuggestions, setAfterSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const hasCoords = anchorEvent.venue?.lat != null && anchorEvent.venue?.lng != null;
  const hasTime = anchorEvent.start_time != null;
  const venueName = anchorEvent.venue?.name;

  // Navigate to venue detail — retain event context for back navigation
  const navigateToSpot = useCallback(
    (slug: string) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      // Keep the event param so user can navigate back
      params.delete("spot");
      params.delete("series");
      params.delete("festival");
      params.delete("org");
      params.set("spot", slug);
      onClose();
      router.push(`/${portalSlug}?${params.toString()}`, { scroll: false });
    },
    [router, portalSlug, searchParams, onClose],
  );

  // Fetch suggestions on open
  useEffect(() => {
    if (!isOpen || !hasCoords || !hasTime) return;

    let cancelled = false;
    const controller = new AbortController();

    async function fetchSuggestions() {
      setLoading(true);
      setError(null);

      const baseParams = new URLSearchParams({
        anchor_lat: String(anchorEvent.venue!.lat),
        anchor_lng: String(anchorEvent.venue!.lng),
        anchor_time: anchorEvent.start_time!,
        anchor_date: anchorEvent.start_date,
      });
      if (anchorEvent.end_time) {
        baseParams.set("anchor_end_time", anchorEvent.end_time);
      }

      const base = `/api/portals/${portalSlug}/outing-suggestions`;

      try {
        const [beforeRes, afterRes] = await Promise.all([
          fetch(`${base}?${baseParams}&slot=before`, {
            signal: controller.signal,
          }),
          fetch(`${base}?${baseParams}&slot=after`, {
            signal: controller.signal,
          }),
        ]);

        if (cancelled) return;

        if (beforeRes.ok) {
          const data = await beforeRes.json();
          if (!cancelled) setBeforeSuggestions(data.suggestions ?? []);
        }
        if (afterRes.ok) {
          const data = await afterRes.json();
          if (!cancelled) setAfterSuggestions(data.suggestions ?? []);
        }
      } catch {
        if (controller.signal.aborted) return;
        if (!cancelled) setError("Couldn't load suggestions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSuggestions();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen, hasCoords, hasTime, anchorEvent, portalSlug]);

  // Open/close animation + body scroll lock
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
      document.body.style.overflow = "hidden";
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setIsVisible(false), 300);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (typeof document === "undefined" || !isVisible) return null;

  const canSuggest = hasCoords && hasTime;
  const hasBefore = beforeSuggestions.length > 0;
  const hasAfter = afterSuggestions.length > 0;
  const isEmpty = !loading && !hasBefore && !hasAfter;

  return createPortal(
    <div
      className={`fixed inset-0 z-[140] transition-colors duration-300 ${
        isAnimating ? "bg-black/50" : "bg-transparent"
      }`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Make a Night of It"
    >
      <div
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 bg-[var(--void)] border-t border-[var(--twilight)] rounded-t-2xl shadow-2xl max-h-[85vh] transition-transform duration-300 md:top-0 md:bottom-0 md:left-auto md:right-0 md:w-[420px] md:max-h-none md:rounded-none md:border-t-0 md:border-l-2 md:border-l-[var(--gold)]/20 ${
          isAnimating
            ? "translate-y-0 md:translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-y-0 md:translate-x-full"
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2 md:hidden">
          <div className="w-12 h-1 rounded-full bg-[var(--twilight)]" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 md:pt-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-lg font-semibold text-[var(--cream)]">
              Make a Night of It
            </h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[var(--twilight)] transition-colors"
              aria-label="Close"
            >
              <X size={20} weight="bold" className="text-[var(--muted)]" />
            </button>
          </div>
          {venueName && (
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Spots near {venueName}
            </p>
          )}
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[calc(85vh-120px)] md:max-h-[calc(100vh-100px)]">
          <div className="px-4 pb-6 space-y-5">
            {/* Anchor card */}
            <div className="flex items-center gap-3 p-3 rounded-lg border-l-2 border-l-[var(--gold)] border border-[var(--twilight)] bg-[var(--night)]">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--cream)] truncate">
                  {anchorEvent.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {anchorEvent.venue && (
                    <span className="text-xs text-[var(--soft)] truncate">
                      {anchorEvent.venue.name}
                    </span>
                  )}
                  {anchorEvent.start_time && (
                    <span className="flex items-center gap-0.5 text-xs text-[var(--muted)]">
                      <Clock size={11} weight="light" />
                      {formatTime(anchorEvent.start_time, anchorEvent.is_all_day)}
                    </span>
                  )}
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-2xs font-mono font-medium uppercase tracking-wider bg-[var(--gold)]/15 text-[var(--gold)] flex-shrink-0">
                Your Event
              </span>
            </div>

            {/* Empty / error states */}
            {!canSuggest && (
              <div className="text-center py-8">
                <p className="text-sm text-[var(--muted)]">
                  We don&apos;t have enough info to suggest spots nearby.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    router.push(`/${portalSlug}?tab=find`);
                  }}
                  className="mt-3 text-xs font-mono text-[var(--coral)] hover:underline"
                >
                  Browse Around Me instead
                </button>
              </div>
            )}

            {error && (
              <div className="text-center py-6">
                <p className="text-sm text-[var(--muted)]">{error}</p>
              </div>
            )}

            {/* Before the Show — header only renders with content */}
            {canSuggest && (
              <SuggestionSection
                title="Before the Show"
                suggestions={beforeSuggestions}
                loading={loading}
                onNavigate={navigateToSpot}
              />
            )}

            {/* After the Show — header only renders with content */}
            {canSuggest && (
              <SuggestionSection
                title="After the Show"
                suggestions={afterSuggestions}
                loading={loading}
                onNavigate={navigateToSpot}
              />
            )}

            {/* True empty — both slots empty */}
            {isEmpty && canSuggest && (
              <div className="text-center py-6">
                <p className="text-sm text-[var(--muted)] mb-3">
                  Nothing found nearby.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    router.push(`/${portalSlug}?tab=find`);
                  }}
                  className="text-xs font-mono text-[var(--coral)] hover:underline"
                >
                  Browse all nearby spots
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export type { MakeANightSheetProps };
