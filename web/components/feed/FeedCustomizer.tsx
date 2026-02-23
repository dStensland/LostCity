"use client";

/**
 * FeedCustomizer — responsive feed settings panel.
 *
 * Mobile (< lg): bottom sheet (swipe-friendly).
 * Desktop (lg+): popover anchored to the gear icon.
 *
 * Block reordering only — filtering is handled by category chips in LineupSection.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  GearSix,
  X,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";
import type { FeedBlockId, FeedLayout } from "@/lib/city-pulse/types";
import { DEFAULT_FEED_ORDER } from "@/lib/city-pulse/types";

// ---------------------------------------------------------------------------
// Block display config (descriptive labels, not cute)
// ---------------------------------------------------------------------------

const BLOCK_LABELS: Record<FeedBlockId, string> = {
  timeline: "Events",
  trending: "Trending",
  weather_discovery: "Weather Discovery",
  your_people: "Your People",
  new_from_spots: "New from Spots",
  coming_up: "Coming Up",
  browse: "Browse",
};

const BLOCK_DESCRIPTIONS: Record<FeedBlockId, string> = {
  timeline: "Today, This Week, and Coming Up events",
  trending: "What the city is buzzing about",
  weather_discovery: "Places that match the weather",
  your_people: "Events your friends are attending",
  new_from_spots: "New events from spots you follow",
  coming_up: "Events in the next two weeks",
  browse: "Explore all categories",
};

const ALWAYS_VISIBLE: FeedBlockId[] = ["timeline"];
const FIXED_POSITION: FeedBlockId[] = ["browse"];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FeedCustomizerProps {
  currentLayout: FeedLayout | null;
  onSave: (layout: FeedLayout | null) => void;
  isAuthenticated: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FeedCustomizer({
  currentLayout,
  onSave,
  isAuthenticated,
}: FeedCustomizerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Block ordering state
  const [visibleBlocks, setVisibleBlocks] = useState<FeedBlockId[]>(() => {
    if (currentLayout?.visible_blocks) return [...currentLayout.visible_blocks];
    return [...DEFAULT_FEED_ORDER].filter((b) => !FIXED_POSITION.includes(b));
  });
  const [hiddenBlocks, setHiddenBlocks] = useState<FeedBlockId[]>(() => {
    if (currentLayout?.hidden_blocks) return [...currentLayout.hidden_blocks];
    return [];
  });

  // Close popover on outside click (desktop)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        triggerRef.current?.contains(target) ||
        target.closest("[data-customizer-panel]")
      ) {
        return;
      }
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  if (!isAuthenticated) return null;

  const moveUp = useCallback((blockId: FeedBlockId) => {
    setVisibleBlocks((prev) => {
      const idx = prev.indexOf(blockId);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((blockId: FeedBlockId) => {
    setVisibleBlocks((prev) => {
      const idx = prev.indexOf(blockId);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  const toggleBlock = useCallback((blockId: FeedBlockId) => {
    if (ALWAYS_VISIBLE.includes(blockId)) return;
    setVisibleBlocks((prev) => {
      if (prev.includes(blockId)) {
        setHiddenBlocks((h) => [...h, blockId]);
        return prev.filter((b) => b !== blockId);
      }
      setHiddenBlocks((h) => h.filter((b) => b !== blockId));
      return [...prev, blockId];
    });
  }, []);

  const handleSave = () => {
    const defaultOrder = DEFAULT_FEED_ORDER.filter((d) => !FIXED_POSITION.includes(d));
    const isBlockDefault =
      hiddenBlocks.length === 0 &&
      visibleBlocks.every((b, i) => b === defaultOrder[i]);

    if (isBlockDefault) {
      onSave(null);
    } else {
      onSave({
        visible_blocks: visibleBlocks,
        hidden_blocks: hiddenBlocks,
        // Preserve existing interest selections
        ...(currentLayout?.interests && { interests: currentLayout.interests }),
        version: 1,
      });
    }
    setIsOpen(false);
  };

  const handleReset = () => {
    setVisibleBlocks(DEFAULT_FEED_ORDER.filter((b) => !FIXED_POSITION.includes(b)));
    setHiddenBlocks([]);
  };

  // Shared panel content
  const panelContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--twilight)]/50">
        <h3 className="font-mono text-[0.8125rem] font-semibold text-[var(--cream)]">
          Customize Feed
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="font-mono text-[0.625rem] text-[var(--muted)] hover:text-[var(--soft)] transition-colors"
          >
            Reset
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            <X weight="bold" className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="overflow-y-auto max-h-[60vh] lg:max-h-[50vh] px-5 py-3">
        {/* --- Section 1: Feed blocks --- */}
        <span className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-[var(--muted)] mb-1 block">
          Sections
        </span>

        {/* Fixed: GreetingBar */}
        <div className="flex items-center gap-3 py-2.5 opacity-50">
          <span className="font-mono text-[0.5625rem] w-5 text-center text-[var(--muted)]">1</span>
          <div className="flex-1">
            <p className="text-[0.8125rem] font-medium text-[var(--soft)]">Greeting</p>
            <p className="text-[0.625rem] text-[var(--muted)]">Always first</p>
          </div>
        </div>

        {/* Reorderable blocks */}
        {visibleBlocks.map((blockId, idx) => (
          <div
            key={blockId}
            className="flex items-center gap-3 py-2.5 border-t border-[var(--twilight)]/30"
          >
            <span className="font-mono text-[0.5625rem] w-5 text-center text-[var(--muted)] tabular-nums">
              {idx + 2}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[0.8125rem] font-medium text-[var(--cream)]">
                {BLOCK_LABELS[blockId]}
              </p>
              <p className="text-[0.625rem] text-[var(--muted)] truncate">
                {BLOCK_DESCRIPTIONS[blockId]}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => moveUp(blockId)}
                disabled={idx === 0}
                className="p-1 text-[var(--muted)] hover:text-[var(--cream)] disabled:opacity-20 transition-colors"
              >
                <ArrowUp weight="bold" className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => moveDown(blockId)}
                disabled={idx === visibleBlocks.length - 1}
                className="p-1 text-[var(--muted)] hover:text-[var(--cream)] disabled:opacity-20 transition-colors"
              >
                <ArrowDown weight="bold" className="w-3.5 h-3.5" />
              </button>
              {!ALWAYS_VISIBLE.includes(blockId) && (
                <button
                  onClick={() => toggleBlock(blockId)}
                  className="p-1 text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
                >
                  <Eye weight="bold" className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Hidden blocks */}
        {hiddenBlocks.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[var(--twilight)]/50">
            <span className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-[var(--muted)] mb-2 block">
              Hidden
            </span>
            {hiddenBlocks.map((blockId) => (
              <div key={blockId} className="flex items-center gap-3 py-2.5 opacity-60">
                <span className="w-5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[0.8125rem] font-medium text-[var(--soft)]">
                    {BLOCK_LABELS[blockId]}
                  </p>
                </div>
                <button
                  onClick={() => toggleBlock(blockId)}
                  className="p-1 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                >
                  <EyeSlash weight="bold" className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Fixed: Browse */}
        <div className="flex items-center gap-3 py-2.5 opacity-50 border-t border-[var(--twilight)]/30 mt-2">
          <span className="font-mono text-[0.5625rem] w-5 text-center text-[var(--muted)]">&bull;</span>
          <div className="flex-1">
            <p className="text-[0.8125rem] font-medium text-[var(--soft)]">Browse</p>
            <p className="text-[0.625rem] text-[var(--muted)]">Always last</p>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="px-5 py-4 border-t border-[var(--twilight)]/50">
        <button
          onClick={handleSave}
          className="w-full py-2.5 rounded-lg bg-[var(--action-primary)] text-[var(--btn-primary-text)] font-mono text-[0.75rem] font-medium hover:bg-[var(--action-primary-hover)] transition-colors"
        >
          Save Layout
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Gear trigger */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[var(--muted)] hover:text-[var(--soft)] hover:bg-[var(--cream)]/5 transition-colors"
        aria-label="Customize feed"
      >
        <GearSix weight="bold" className="w-3.5 h-3.5" />
        <span className="font-mono text-[0.5625rem] tracking-wide">Customize</span>
      </button>

      {isOpen && (
        <>
          {/* Mobile: bottom sheet */}
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="absolute bottom-0 left-0 right-0 max-h-[80vh] bg-[var(--night)] rounded-t-2xl border-t border-[var(--twilight)] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              data-customizer-panel
            >
              {panelContent}
            </div>
          </div>

          {/* Desktop: popover */}
          <div
            className="hidden lg:block fixed inset-0 z-50"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="absolute z-50 w-[360px] max-h-[70vh] bg-[var(--night)] rounded-xl border border-[var(--twilight)] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              data-customizer-panel
              style={{
                top: (triggerRef.current?.getBoundingClientRect().bottom ?? 60) + 8,
                right: Math.max(
                  16,
                  window.innerWidth - (triggerRef.current?.getBoundingClientRect().right ?? window.innerWidth),
                ),
              }}
            >
              {panelContent}
            </div>
          </div>
        </>
      )}
    </>
  );
}
