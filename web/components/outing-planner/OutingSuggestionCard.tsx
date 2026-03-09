"use client";

import { useState, useEffect, useRef } from "react";
import Image from "@/components/SmartImage";
import { getSpotTypeLabel } from "@/lib/spots-constants";
import {
  ForkKnife,
  BeerStein,
  Mountains,
  GameController,
  MusicNotesSimple,
  PersonSimpleWalk,
  Lightning,
  Plus,
  Check,
} from "@phosphor-icons/react";

import type {
  OutingSuggestion,
  SuggestionCategory,
} from "@/lib/outing-suggestions-utils";

// ---------------------------------------------------------------------------
// Category icons
// ---------------------------------------------------------------------------

function CategoryFallbackIcon({ category }: { category: SuggestionCategory }) {
  const props = { size: 20, weight: "light" as const };
  switch (category) {
    case "food":
      return <ForkKnife {...props} className="text-[var(--gold)]" />;
    case "drinks":
      return <BeerStein {...props} className="text-[var(--neon-cyan)]" />;
    case "events":
      return <MusicNotesSimple {...props} className="text-[var(--vibe)]" />;
    case "sight":
      return <Mountains {...props} className="text-[var(--neon-green)]" />;
    case "activity":
      return <GameController {...props} className="text-[var(--coral)]" />;
  }
}

function categoryFallbackBg(category: SuggestionCategory): string {
  switch (category) {
    case "food": return "bg-[var(--gold)]/10";
    case "drinks": return "bg-[var(--neon-cyan)]/10";
    case "events": return "bg-[var(--vibe)]/10";
    case "sight": return "bg-[var(--neon-green)]/10";
    case "activity": return "bg-[var(--coral)]/10";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OutingSuggestionCardProps {
  suggestion: OutingSuggestion;
  onAdd?: (suggestion: OutingSuggestion) => void;
  onNavigate?: (slug: string) => void;
  adding?: boolean;
  disabled?: boolean;
}

export default function OutingSuggestionCard({
  suggestion,
  onAdd,
  onNavigate,
  adding,
  disabled,
}: OutingSuggestionCardProps) {
  const isEvent = suggestion.type === "event";
  const typeLabel = getSpotTypeLabel(suggestion.venue.venue_type);
  const subtitleText = isEvent ? `at ${suggestion.venue.name}` : typeLabel;
  const [justAdded, setJustAdded] = useState(false);
  const wasAddingRef = useRef(false);

  // Detect when adding transitions from true → false (add completed)
  useEffect(() => {
    if (wasAddingRef.current && !adding) {
      setJustAdded(true);
      const timer = setTimeout(() => setJustAdded(false), 1500);
      return () => clearTimeout(timer);
    }
    wasAddingRef.current = !!adding;
  }, [adding]);

  return (
    <div className="flex items-start gap-3 w-full text-left p-3 rounded-lg border border-[var(--twilight)] bg-[var(--night)] group">
      {/* Venue image */}
      <button
        onClick={() => onNavigate?.(suggestion.venue.slug)}
        className={`w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 ${
          suggestion.image_url ? "bg-[var(--twilight)]" : categoryFallbackBg(suggestion.category)
        }`}
      >
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
      </button>

      {/* Content */}
      <button
        onClick={() => onNavigate?.(suggestion.venue.slug)}
        className="flex-1 min-w-0 text-left"
      >
        <p className="text-sm font-medium text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors">
          {suggestion.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {subtitleText && (
            <span className="text-xs text-[var(--soft)] truncate">{subtitleText}</span>
          )}
          <span className="flex items-center gap-0.5 text-xs text-[var(--muted)]">
            <PersonSimpleWalk size={11} weight="light" />
            {suggestion.walking_minutes} min
          </span>
        </div>
        <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-2">
          {suggestion.reason}
        </p>
        {suggestion.active_special && (
          <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-2xs font-mono font-medium bg-[var(--neon-green)]/10 text-[var(--neon-green)] border border-[var(--neon-green)]/20">
            <Lightning size={10} weight="fill" />
            {suggestion.active_special.title}
          </span>
        )}
      </button>

      {/* Right column: time + add button */}
      <div className="flex-shrink-0 flex flex-col items-end gap-2 pt-0.5">
        <div className="text-right">
          <span className="block text-2xs font-mono text-[var(--muted)] uppercase tracking-wider">
            {isEvent ? "starts at" : "head over by"}
          </span>
          <span className="text-xs font-mono text-[var(--soft)]">
            {suggestion.suggested_time}
          </span>
        </div>
        {onAdd && (
          justAdded ? (
            <div className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center bg-[var(--neon-green)]/15 border border-[var(--neon-green)]/30 text-[var(--neon-green)] animate-[scaleIn_0.25s_ease-out]">
              <Check size={16} weight="bold" />
            </div>
          ) : (
            <button
              onClick={() => onAdd(suggestion)}
              disabled={adding || disabled}
              className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center bg-[var(--coral)]/10 border border-[var(--coral)]/25 text-[var(--coral)] hover:bg-[var(--coral)]/20 hover:border-[var(--coral)]/40 transition-all disabled:opacity-40"
              aria-label={`Add ${suggestion.title} to your outing`}
            >
              {adding ? (
                <div className="w-3.5 h-3.5 border-2 border-[var(--coral)]/30 border-t-[var(--coral)] rounded-full animate-spin" />
              ) : (
                <Plus size={16} weight="bold" />
              )}
            </button>
          )
        )}
      </div>
    </div>
  );
}
