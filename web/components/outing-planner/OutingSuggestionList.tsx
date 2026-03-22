"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { CaretDown } from "@phosphor-icons/react";
import Skeleton from "@/components/Skeleton";
import type {
  OutingSuggestion,
  SuggestionCategory,
  IntentSlot,
} from "@/lib/outing-suggestions-utils";
import { getIntentLabel, getSmartDefault } from "@/lib/outing-suggestions-utils";
import OutingSuggestionCard from "./OutingSuggestionCard";

// ---------------------------------------------------------------------------
// Category accent colors
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<SuggestionCategory, string> = {
  food: "var(--gold)",
  drinks: "var(--neon-cyan)",
  events: "var(--vibe)",
  activity: "var(--coral)",
  sight: "var(--neon-green)",
};

// ---------------------------------------------------------------------------
// Skeleton
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
// Slot section — self-contained with intent chips + smart default
// ---------------------------------------------------------------------------

const INITIAL_SHOW = 6;

function SlotSection({
  slot,
  label,
  suggestions,
  anchorHour,
  loading: isLoading,
  onAdd,
  onNavigate,
  addingId,
  creating,
}: {
  slot: IntentSlot;
  label: string;
  suggestions: OutingSuggestion[];
  anchorHour: number;
  loading: boolean;
  onAdd?: (s: OutingSuggestion) => void;
  onNavigate?: (slug: string) => void;
  addingId?: number | null;
  creating?: boolean;
}) {
  // Compute intent chips from actual suggestion data
  const { chips, smartDefault } = useMemo(() => {
    const counts: Partial<Record<SuggestionCategory, number>> = {};
    for (const s of suggestions) {
      counts[s.category] = (counts[s.category] ?? 0) + 1;
    }
    const available = (["food", "drinks", "events", "activity", "sight"] as SuggestionCategory[])
      .filter((cat) => (counts[cat] ?? 0) > 0);

    const chipList = available.map((cat) => ({
      category: cat,
      label: getIntentLabel(cat, slot, anchorHour),
      count: counts[cat]!,
      color: CATEGORY_COLORS[cat],
    }));

    const defaultCat = getSmartDefault(slot, anchorHour, available);
    return { chips: chipList, smartDefault: defaultCat };
  }, [suggestions, slot, anchorHour]);

  const [activeFilter, setActiveFilter] = useState<SuggestionCategory | null>(null);
  const initializedRef = useRef(false);

  // Set smart default once when data first loads
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => {
    if (!initializedRef.current && chips.length > 1 && smartDefault) {
      setActiveFilter(smartDefault);
      initializedRef.current = true;
    }
  }, [chips, smartDefault]);

  const filtered = activeFilter
    ? suggestions.filter((s) => s.category === activeFilter)
    : suggestions;

  const [expanded, setExpanded] = useState(false);
  const hasMore = filtered.length > INITIAL_SHOW;
  const visible = expanded ? filtered : filtered.slice(0, INITIAL_SHOW);

  if (isLoading) {
    return (
      <div>
        <h3 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)] py-3 border-t border-[var(--twilight)]">
          {label}
        </h3>
        <div className="space-y-2">
          <SuggestionSkeleton index={0} />
          <SuggestionSkeleton index={1} />
          <SuggestionSkeleton index={2} />
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div>
      <h3 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)] py-3 border-t border-[var(--twilight)]">
        {label}
      </h3>

      {/* Intent chips — only render when 2+ categories available */}
      {chips.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-3">
          {chips.map((chip) => {
            const isActive = activeFilter === chip.category;
            return (
              <button
                key={chip.category}
                onClick={() => setActiveFilter(isActive ? null : chip.category)}
                className={`flex-shrink-0 min-h-[44px] px-3.5 py-1.5 rounded-full text-xs font-mono font-medium border transition-all ${
                  isActive
                    ? "border-current"
                    : "bg-white/5 text-[var(--soft)] border-white/10 hover:bg-white/8"
                }`}
                style={
                  isActive
                    ? {
                        color: chip.color,
                        background: `color-mix(in srgb, ${chip.color} 10%, transparent)`,
                      }
                    : undefined
                }
              >
                {chip.label}
                <span className={`ml-1.5 ${isActive ? "opacity-70" : "opacity-50"}`}>
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        {visible.map((s) => (
          <OutingSuggestionCard
            key={s.id}
            suggestion={s}
            onAdd={onAdd}
            onNavigate={onNavigate}
            adding={addingId === s.id}
            disabled={creating && addingId !== s.id}
          />
        ))}
      </div>

      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 mt-2 text-xs font-mono text-[var(--coral)] hover:opacity-80 transition-opacity"
        >
          <CaretDown size={12} weight="bold" />
          +{filtered.length - INITIAL_SHOW} more
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main list
// ---------------------------------------------------------------------------

interface OutingSuggestionListProps {
  beforeSuggestions: OutingSuggestion[];
  afterSuggestions: OutingSuggestion[];
  beforeLabel: string;
  afterLabel: string;
  loading: boolean;
  onAdd?: (suggestion: OutingSuggestion) => void;
  onNavigate?: (slug: string) => void;
  addingId?: number | null;
  creating?: boolean;
  anchorHour?: number | null;
}

export default function OutingSuggestionList({
  beforeSuggestions,
  afterSuggestions,
  beforeLabel,
  afterLabel,
  loading,
  onAdd,
  onNavigate,
  addingId,
  creating,
  anchorHour,
}: OutingSuggestionListProps) {
  const hour = anchorHour ?? 19;

  return (
    <div className="space-y-4">
      <SlotSection
        slot="before"
        label={beforeLabel}
        suggestions={beforeSuggestions}
        anchorHour={hour}
        loading={loading}
        onAdd={onAdd}
        onNavigate={onNavigate}
        addingId={addingId}
        creating={creating}
      />
      <SlotSection
        slot="after"
        label={afterLabel}
        suggestions={afterSuggestions}
        anchorHour={hour}
        loading={loading}
        onAdd={onAdd}
        onNavigate={onNavigate}
        addingId={addingId}
        creating={creating}
      />
    </div>
  );
}
