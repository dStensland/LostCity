"use client";

import { memo, useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { CATEGORIES } from "@/lib/search-constants";
import CategoryIcon from "./CategoryIcon";
import { triggerHaptic } from "@/lib/haptics";

// Simple date filters
const SIMPLE_DATE_FILTERS = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "Weekend" },
  { value: "week", label: "This Week" },
] as const;

type FilterOption = {
  value: string;
  label: string;
};

type FilterGroup = {
  group: string;
  options: FilterOption[];
};

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentCategories: string[];
  currentDateFilter: string;
  currentFreeOnly: boolean;
  currentTags?: string[];
  currentVibes?: string[];
  currentMood?: string;
  tagGroups?: FilterGroup[];
  vibeGroups?: FilterGroup[];
  moodOptions?: FilterOption[];
  onToggleCategory: (category: string) => void;
  onSetDateFilter: (date: string) => void;
  onToggleFreeOnly: () => void;
  onToggleTag?: (tag: string) => void;
  onToggleVibe?: (vibe: string) => void;
  onSetMood?: (mood: string) => void;
  onClearAll: () => void;
  resultCount?: number;
}

export const MobileFilterSheet = memo(function MobileFilterSheet({
  isOpen,
  onClose,
  currentCategories,
  currentDateFilter,
  currentFreeOnly,
  currentTags = [],
  currentVibes = [],
  currentMood = "",
  tagGroups = [],
  vibeGroups = [],
  moodOptions = [],
  onToggleCategory,
  onSetDateFilter,
  onToggleFreeOnly,
  onToggleTag,
  onToggleVibe,
  onSetMood,
  onClearAll,
  resultCount,
}: MobileFilterSheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const isSpecificDate = /^\d{4}-\d{2}-\d{2}$/.test(currentDateFilter);

  const formatDateLabel = (dateStr: string): string => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Handle open/close animation
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Required for entrance animation timing
      setIsVisible(true);
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
      // Prevent body scroll when sheet is open
      document.body.style.overflow = "hidden";
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300); // Match transition duration
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      triggerHaptic("light");
      onClose();
    }
  };

  // Wrap filter actions with haptic feedback
  const handleToggleCategory = (category: string) => {
    triggerHaptic("selection");
    onToggleCategory(category);
  };

  const handleSetDateFilter = (date: string) => {
    triggerHaptic("selection");
    onSetDateFilter(date);
  };

  const handleToggleFreeOnly = () => {
    triggerHaptic("selection");
    onToggleFreeOnly();
  };

  const handleToggleTag = (tag: string) => {
    if (!onToggleTag) return;
    triggerHaptic("selection");
    onToggleTag(tag);
  };

  const handleToggleVibe = (vibe: string) => {
    if (!onToggleVibe) return;
    triggerHaptic("selection");
    onToggleVibe(vibe);
  };

  const handleSetMood = (mood: string) => {
    if (!onSetMood) return;
    triggerHaptic("selection");
    onSetMood(mood);
  };

  const handleClearAll = () => {
    triggerHaptic("medium");
    onClearAll();
  };

  const handleApply = () => {
    triggerHaptic("success");
    onClose();
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (typeof document === "undefined" || !isVisible) return null;

  const hasFilters =
    currentCategories.length > 0 ||
    currentDateFilter ||
    currentFreeOnly ||
    currentTags.length > 0 ||
    currentVibes.length > 0 ||
    Boolean(currentMood);

  return createPortal(
    <div
      className={`fixed inset-0 z-[140] transition-colors duration-300 ${
        isAnimating ? "bg-black/50" : "bg-transparent"
      }`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 bg-[var(--void)] border-t border-[var(--twilight)] rounded-t-2xl shadow-2xl max-h-[85vh] transition-transform duration-300 md:top-0 md:bottom-0 md:left-auto md:right-0 md:w-[420px] md:max-h-none md:rounded-none md:border-t-0 md:border-l ${
          isAnimating
            ? "translate-y-0 md:translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-y-0 md:translate-x-full"
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 rounded-full bg-[var(--twilight)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="font-mono text-lg font-semibold text-[var(--cream)]">Filters</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[var(--twilight)] transition-colors"
            aria-label="Close filters"
          >
            <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[calc(85vh-120px)]">
          <div className="px-4 pb-6 space-y-6">
            {/* When Section */}
            <div>
              <h3 className="font-mono text-sm font-semibold text-[var(--cream)] mb-3">When</h3>
              <div className="grid grid-cols-2 gap-2">
                {SIMPLE_DATE_FILTERS.map((df) => {
                  const isActive = currentDateFilter === df.value;
                  return (
                    <button
                      key={df.value}
                      onClick={() => handleSetDateFilter(df.value)}
                      className={`min-h-[44px] px-4 py-2.5 rounded-lg font-mono text-sm font-medium transition-all ${
                        isActive
                          ? "bg-[var(--gold)] text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
                      }`}
                    >
                      {df.label}
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    triggerHaptic("selection");
                    dateInputRef.current?.showPicker();
                  }}
                  className={`min-h-[44px] col-span-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-mono text-sm font-medium transition-all ${
                    isSpecificDate
                      ? "bg-[var(--gold)] text-[var(--void)]"
                      : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {isSpecificDate ? formatDateLabel(currentDateFilter) : "Pick a date"}
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  className="sr-only"
                  min={new Date().toISOString().split("T")[0]}
                  value={isSpecificDate ? currentDateFilter : ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleSetDateFilter(e.target.value);
                    }
                  }}
                />
              </div>
            </div>

            {/* Categories Section */}
            <div>
              <h3 className="font-mono text-sm font-semibold text-[var(--cream)] mb-3">Categories</h3>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => {
                  const isActive = currentCategories.includes(cat.value);
                  return (
                    <button
                      key={cat.value}
                      onClick={() => handleToggleCategory(cat.value)}
                      className={`min-h-[44px] flex items-center gap-2 px-3 py-2.5 rounded-lg font-mono text-sm font-medium transition-all ${
                        isActive
                          ? "bg-[var(--coral)] text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
                      }`}
                    >
                      <CategoryIcon
                        type={cat.value}
                        size={16}
                        glow="none"
                        className="shrink-0"
                      />
                      <span className="truncate">{cat.label}</span>
                      {isActive && (
                        <svg className="w-4 h-4 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mood Section */}
            {moodOptions.length > 0 && onSetMood && (
              <div>
                <h3 className="font-mono text-sm font-semibold text-[var(--cream)] mb-3">Mood</h3>
                <div className="grid grid-cols-2 gap-2">
                  {moodOptions.map((mood) => {
                    const isActive = currentMood === mood.value;
                    return (
                      <button
                        key={mood.value}
                        onClick={() => handleSetMood(mood.value)}
                        className={`min-h-[44px] px-4 py-2.5 rounded-lg font-mono text-sm font-medium transition-all ${
                          isActive
                            ? "bg-[#7C3AED] text-[var(--cream)]"
                            : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
                        }`}
                      >
                        {mood.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tags Section */}
            {tagGroups.length > 0 && onToggleTag && (
              <div>
                <h3 className="font-mono text-sm font-semibold text-[var(--cream)] mb-3">Tags</h3>
                <div className="space-y-3">
                  {tagGroups.map((group) => (
                    <div key={group.group}>
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
                        {group.group}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.options.map((tag) => {
                          const isActive = currentTags.includes(tag.value);
                          return (
                            <button
                              key={tag.value}
                              onClick={() => handleToggleTag(tag.value)}
                              className={`min-h-[36px] px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all ${
                                isActive
                                  ? "bg-[var(--coral)] text-[var(--void)]"
                                  : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
                              }`}
                            >
                              {tag.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vibes Section */}
            {vibeGroups.length > 0 && onToggleVibe && (
              <div>
                <h3 className="font-mono text-sm font-semibold text-[var(--cream)] mb-3">Vibes</h3>
                <div className="space-y-3">
                  {vibeGroups.map((group) => (
                    <div key={group.group}>
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--muted)]">
                        {group.group}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.options.map((vibe) => {
                          const isActive = currentVibes.includes(vibe.value);
                          return (
                            <button
                              key={vibe.value}
                              onClick={() => handleToggleVibe(vibe.value)}
                              className={`min-h-[36px] px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all ${
                                isActive
                                  ? "bg-[var(--neon-cyan)] text-[var(--void)]"
                                  : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
                              }`}
                            >
                              {vibe.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Price Section */}
            <div>
              <h3 className="font-mono text-sm font-semibold text-[var(--cream)] mb-3">Price</h3>
              <button
                onClick={handleToggleFreeOnly}
                className={`w-full min-h-[44px] flex items-center gap-3 px-4 py-3 rounded-lg font-mono text-sm font-medium transition-all ${
                  currentFreeOnly
                    ? "bg-[var(--neon-green)] text-[var(--void)]"
                    : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
                }`}
              >
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  currentFreeOnly
                    ? "border-[var(--void)] bg-[var(--void)]"
                    : "border-[var(--muted)]"
                }`}>
                  {currentFreeOnly && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--neon-green)]" />
                  )}
                </span>
                <span>Free only</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer with actions */}
        <div className="sticky bottom-0 border-t border-[var(--twilight)] bg-[var(--void)] px-4 py-3 flex gap-3">
          {hasFilters && (
            <button
              onClick={handleClearAll}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg font-mono text-sm font-medium bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)] transition-colors"
            >
              Clear all
            </button>
          )}
          <button
            onClick={handleApply}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg font-mono text-sm font-medium bg-[var(--coral)] text-[var(--void)] hover:opacity-90 transition-opacity"
          >
            {resultCount !== undefined ? `Show ${resultCount} events` : "Apply"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

export type { MobileFilterSheetProps };
