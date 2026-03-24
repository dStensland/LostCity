"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { trackPortalAction } from "@/lib/analytics/portal-action-tracker";
import { useFeedVisible } from "@/lib/feed-visibility";
import {
  ArrowUp,
  ArrowDown,
  Eye,
  EyeSlash,
  PencilSimple,
  X,
  Check,
} from "@phosphor-icons/react";
import type { FeedBlockId, FeedLayout } from "@/lib/city-pulse/types";
import {
  DEFAULT_FEED_ORDER,
  ALWAYS_VISIBLE_BLOCKS,
  FIXED_LAST_BLOCKS,
} from "@/lib/city-pulse/types";

/** A TOC entry read directly from the DOM */
interface DomEntry {
  id: string;
  label: string;
  blockId: FeedBlockId;
}

/** Legacy entry type for non-CityPulse templates (e.g. CuratedContent) */
export interface IndexEntry {
  id: string;
  label: string;
  blockId?: FeedBlockId;
}

interface FeedPageIndexProps {
  portalSlug: string;
  /** Legacy: manually-supplied entries (used by CuratedContent). When omitted, reads from DOM. */
  entries?: IndexEntry[];
  loading?: boolean;
  sectionKey?: string;
  isAuthenticated?: boolean;
  feedLayout?: FeedLayout | null;
  onSaveLayout?: (layout: FeedLayout | null) => void;
}

/** Block display labels for edit mode — must match actual section titles */
const BLOCK_LABELS: Record<FeedBlockId, string> = {
  events: "The Lineup",
  hangs: "Hangs",
  recurring: "Regular Hangs",
  festivals: "The Big Stuff",
  experiences: "Things to Do",
  community: "The Network",
  cinema: "Now Showing",
  horizon: "On the Horizon",
  browse: "Browse by Category",
};

/**
 * Scan the DOM for [data-feed-anchor] elements.
 * Returns entries in document order — what's on the page IS the TOC.
 */
function scanFeedAnchors(): DomEntry[] {
  const nodes = document.querySelectorAll<HTMLElement>("[data-feed-anchor]");
  const result: DomEntry[] = [];
  nodes.forEach((el) => {
    const id = el.id;
    const label = el.dataset.indexLabel;
    const blockId = el.dataset.blockId as FeedBlockId | undefined;
    if (id && label && blockId) {
      result.push({ id, label, blockId });
    }
  });
  return result;
}

/**
 * FeedPageIndex — floating "City Field Guide" table of contents.
 *
 * View mode: reads [data-feed-anchor] elements from the DOM directly.
 *   What renders on the page = what's in the TOC. No mapping, no config.
 * Edit mode (auth-gated): show/hide toggles + reorder arrows.
 */
export default function FeedPageIndex({
  portalSlug,
  entries: legacyEntries,
  loading = false,
  sectionKey = "feed_page_index",
  isAuthenticated = false,
  feedLayout,
  onSaveLayout,
}: FeedPageIndexProps) {
  // Legacy mode: entries passed in (CuratedContent), no DOM scanning
  const isLegacyMode = !!legacyEntries;
  const canEdit = isAuthenticated && !!onSaveLayout && !isLegacyMode;
  const feedVisible = useFeedVisible();

  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // DOM-sourced entries — the single source of truth for view mode (CityPulse)
  const [domEntries, setDomEntries] = useState<DomEntry[]>([]);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [draftVisible, setDraftVisible] = useState<FeedBlockId[]>([]);
  const [draftHidden, setDraftHidden] = useState<FeedBlockId[]>([]);

  // Stable ref for scan function used in observer
  const scanRef = useRef(scanFeedAnchors);
  scanRef.current = scanFeedAnchors;

  /* ── DOM scan: read [data-feed-anchor] elements ── */
  const refreshEntries = useCallback(() => {
    const next = scanRef.current();
    setDomEntries((prev) => {
      // Shallow compare to avoid unnecessary re-renders
      if (
        prev.length === next.length &&
        prev.every((e, i) => e.id === next[i].id && e.label === next[i].label)
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  // Counter to force re-evaluation of legacy DOM availability
  const [legacyScanTick, setLegacyScanTick] = useState(0);

  /* ── Single debounced MutationObserver for both modes ── */
  useEffect(() => {
    if (loading || !feedVisible) return;

    // Initial scan after two rAFs (let lazy sections mount)
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!isLegacyMode) refreshEntries();
        else setLegacyScanTick((t) => t + 1);
      });
    });

    // Debounced observer — fires at most once per 300ms instead of on
    // every DOM mutation. Single observer replaces the previous two.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!isLegacyMode) refreshEntries();
        else setLegacyScanTick((t) => t + 1);
      }, 300);
    });

    // Observe the feed container if available, else fall back to body
    const feedContainer = document.querySelector("[data-block-id='events']")?.parentElement ?? document.body;
    observer.observe(feedContainer, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      if (debounceTimer) clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, [loading, isLegacyMode, refreshEntries, feedVisible]);

  // Unified view entries: DOM-sourced for CityPulse, legacy prop for CuratedContent
  const viewEntries: DomEntry[] = useMemo(() => {
    if (!isLegacyMode) return domEntries;
    // Legacy: filter to entries present in DOM, keep original order
    return (legacyEntries ?? [])
      .filter((e) => typeof document !== "undefined" && document.getElementById(e.id))
      .map((e) => ({ id: e.id, label: e.label, blockId: e.blockId ?? ("events" as FeedBlockId) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLegacyMode, legacyEntries, domEntries, legacyScanTick]);

  /* ── IntersectionObserver: track which section is in view ── */
  useEffect(() => {
    if (viewEntries.length === 0 || isEditing) return;

    const elements = viewEntries
      .map((entry) => document.getElementById(entry.id))
      .filter((el): el is HTMLElement => !!el);
    if (elements.length === 0) return;

    // Set initial activeId
    if (!activeId && elements[0]) {
      setActiveId(elements[0].id);
    }

    const observer = new IntersectionObserver(
      (intersectionEntries) => {
        const visible = intersectionEntries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top) -
              Math.abs(b.boundingClientRect.top),
          );
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-18% 0px -64% 0px",
        threshold: [0.1, 0.3, 0.5],
      },
    );

    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [viewEntries, isEditing, activeId]);

  /* ── Scroll + analytics helpers ── */
  const scrollToEntry = useCallback((entry: DomEntry) => {
    const target = document.getElementById(entry.id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(entry.id);
  }, []);

  const jumpTo = useCallback(
    (entry: DomEntry, index: number, source: "desktop" | "mobile") => {
      if (isEditing) return;
      scrollToEntry(entry);
      trackPortalAction(portalSlug, {
        action_type: "resource_clicked",
        page_type: "feed",
        section_key: sectionKey,
        target_kind: "section_index",
        target_id: entry.id,
        target_label: entry.label,
        target_url: `#${entry.id}`,
        metadata: { position: index + 1, source },
      });
    },
    [portalSlug, sectionKey, scrollToEntry, isEditing],
  );

  const handleProgressJump = useCallback(
    (entry: DomEntry, index: number, source: "desktop" | "mobile") => {
      if (isEditing) return;
      scrollToEntry(entry);
      trackPortalAction(portalSlug, {
        action_type: "resource_clicked",
        page_type: "feed",
        section_key: sectionKey,
        target_kind: "index_progress",
        target_id: entry.id,
        target_label: entry.label,
        target_url: `#${entry.id}`,
        metadata: { position: index + 1, source },
      });
    },
    [portalSlug, sectionKey, scrollToEntry, isEditing],
  );

  /* ── Edit mode helpers ── */
  const enterEditMode = useCallback(() => {
    const middleDefaults = DEFAULT_FEED_ORDER.filter(
      (b) => !ALWAYS_VISIBLE_BLOCKS.includes(b) && !FIXED_LAST_BLOCKS.includes(b),
    );

    if (feedLayout) {
      const vis = feedLayout.visible_blocks.filter(
        (b) => !ALWAYS_VISIBLE_BLOCKS.includes(b) && !FIXED_LAST_BLOCKS.includes(b),
      );
      setDraftVisible(vis);
      setDraftHidden([...new Set(feedLayout.hidden_blocks)]);
    } else {
      setDraftVisible(middleDefaults);
      setDraftHidden([]);
    }
    setIsEditing(true);
  }, [feedLayout]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const saveEdit = useCallback(() => {
    if (!onSaveLayout) return;

    const middleDefaults = DEFAULT_FEED_ORDER.filter(
      (b) => !ALWAYS_VISIBLE_BLOCKS.includes(b) && !FIXED_LAST_BLOCKS.includes(b),
    );

    const isDefault =
      draftHidden.length === 0 &&
      draftVisible.length === middleDefaults.length &&
      draftVisible.every((b, i) => b === middleDefaults[i]);

    if (isDefault) {
      onSaveLayout(null);
    } else {
      onSaveLayout({
        visible_blocks: ["events", ...draftVisible],
        hidden_blocks: draftHidden,
        ...(feedLayout?.interests !== undefined && { interests: feedLayout.interests }),
        version: 2,
      });
    }
    setIsEditing(false);
  }, [draftVisible, draftHidden, feedLayout, onSaveLayout]);

  const moveUp = useCallback((blockId: FeedBlockId) => {
    setDraftVisible((prev) => {
      const idx = prev.indexOf(blockId);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  const moveDown = useCallback((blockId: FeedBlockId) => {
    setDraftVisible((prev) => {
      const idx = prev.indexOf(blockId);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  const toggleBlock = useCallback((blockId: FeedBlockId) => {
    if (ALWAYS_VISIBLE_BLOCKS.includes(blockId) || FIXED_LAST_BLOCKS.includes(blockId)) return;
    const isCurrentlyVisible = draftVisible.includes(blockId);
    if (isCurrentlyVisible) {
      setDraftVisible((prev) => prev.filter((b) => b !== blockId));
      setDraftHidden((prev) => prev.includes(blockId) ? prev : [...prev, blockId]);
    } else {
      setDraftHidden((prev) => prev.filter((b) => b !== blockId));
      setDraftVisible((prev) => prev.includes(blockId) ? prev : [...prev, blockId]);
    }
  }, [draftVisible]);

  /* ── Guards ── */
  if (viewEntries.length === 0 && !isEditing) return null;
  if (typeof document === "undefined") return null;

  /* ── All entries for edit mode (visible order + hidden) ── */
  const allEditEntries: { blockId: FeedBlockId; label: string; isVisible: boolean; isFixed: boolean }[] = [];
  allEditEntries.push({ blockId: "events", label: BLOCK_LABELS.events, isVisible: true, isFixed: true });
  for (const blockId of draftVisible) {
    allEditEntries.push({ blockId, label: BLOCK_LABELS[blockId], isVisible: true, isFixed: false });
  }
  allEditEntries.push({ blockId: "browse", label: BLOCK_LABELS.browse, isVisible: true, isFixed: true });
  for (const blockId of draftHidden) {
    allEditEntries.push({ blockId, label: BLOCK_LABELS[blockId], isVisible: false, isFixed: false });
  }

  /* ── Shared entry renderer ── */
  const renderEditEntry = (
    entry: { blockId: FeedBlockId; label: string; isVisible: boolean; isFixed: boolean },
    source: "desktop" | "mobile",
  ) => {
    const isMiddle = !ALWAYS_VISIBLE_BLOCKS.includes(entry.blockId) && !FIXED_LAST_BLOCKS.includes(entry.blockId);
    const middleIdx = draftVisible.indexOf(entry.blockId);
    return (
      <li
        key={`edit-${source}-${entry.blockId}`}
        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors ${
          entry.isVisible
            ? "text-[var(--cream)]"
            : "text-[var(--muted)] opacity-60"
        } ${entry.isFixed ? "opacity-50" : ""}`}
      >
        <span className="block truncate text-xs flex-1">
          {entry.label}
        </span>
        {isMiddle && entry.isVisible && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => moveUp(entry.blockId)}
              disabled={middleIdx === 0}
              className="p-0.5 text-[var(--muted)] hover:text-[var(--cream)] disabled:opacity-20 transition-colors"
            >
              <ArrowUp weight="bold" className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => moveDown(entry.blockId)}
              disabled={middleIdx === draftVisible.length - 1}
              className="p-0.5 text-[var(--muted)] hover:text-[var(--cream)] disabled:opacity-20 transition-colors"
            >
              <ArrowDown weight="bold" className="w-3 h-3" />
            </button>
          </div>
        )}
        {isMiddle && (
          <button
            type="button"
            onClick={() => toggleBlock(entry.blockId)}
            className="p-0.5 text-[var(--muted)] hover:text-[var(--cream)] transition-colors shrink-0"
          >
            {entry.isVisible ? (
              <Eye weight="bold" className="w-3.5 h-3.5" />
            ) : (
              <EyeSlash weight="bold" className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        {entry.isFixed && (
          <span className="text-2xs text-[var(--muted)] font-mono shrink-0">
            {ALWAYS_VISIBLE_BLOCKS.includes(entry.blockId) ? "pinned" : "last"}
          </span>
        )}
      </li>
    );
  };

  const renderViewEntry = (entry: DomEntry, index: number, source: "desktop" | "mobile") => {
    const isActive = activeId === entry.id;
    return (
      <li key={`${source}-${entry.id}`}>
        <button
          type="button"
          onClick={() => jumpTo(entry, index, source)}
          className={`w-full px-2.5 py-2 rounded-lg text-left transition-colors ${
            isActive
              ? source === "desktop"
                ? "border border-[var(--coral)]/55 bg-[linear-gradient(90deg,rgba(255,107,122,0.2),rgba(28,37,66,0.8))] text-[var(--cream)] shadow-[0_0_14px_rgba(255,107,122,0.24)]"
                : "border border-[var(--coral)]/40 bg-[var(--twilight)]/70 text-[var(--cream)]"
              : "border border-transparent text-[var(--muted)] hover:border-[var(--twilight)]/40 hover:bg-[var(--twilight)]/30 hover:text-[var(--cream)]"
          }`}
        >
          <span className="block truncate text-xs">
            {index + 1}. {entry.label}
          </span>
        </button>
      </li>
    );
  };

  /* ── Edit mode footer ── */
  const editFooter = isEditing && (
    <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--twilight)]/45">
      <button
        type="button"
        onClick={cancelEdit}
        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-[var(--twilight)]/50 text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--twilight)] transition-colors"
      >
        <X weight="bold" className="w-3 h-3" />
        <span className="text-xs font-mono">Cancel</span>
      </button>
      <button
        type="button"
        onClick={saveEdit}
        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium hover:bg-[var(--rose)] transition-colors"
      >
        <Check weight="bold" className="w-3 h-3" />
        <span>Save</span>
      </button>
    </div>
  );

  /* ── Render (portalled to document.body) ── */
  return createPortal(
    <>
      {/* ─── Desktop: floating sidebar ─── */}
      <aside className="pointer-events-none fixed right-4 top-[4.5rem] z-[120] hidden sm:block">
        <div className="pointer-events-auto">
          {isDesktopCollapsed && !isEditing ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsDesktopCollapsed(false);
                  trackPortalAction(portalSlug, {
                    action_type: "resource_clicked",
                    page_type: "feed",
                    section_key: sectionKey,
                    target_kind: "index_toggle",
                    target_id: "expanded",
                    target_label: "Expand index",
                    metadata: { source: "desktop_collapsed_button" },
                  });
                }}
                className="group flex h-11 w-11 items-center justify-center rounded-full border border-[var(--coral)]/45 bg-[linear-gradient(145deg,rgba(16,20,36,0.96),rgba(11,14,26,0.96))] text-[var(--cream)] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_18px_rgba(255,107,122,0.24),0_10px_20px_rgba(0,0,0,0.5)] transition-all hover:border-[var(--neon-cyan)]/60 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_0_20px_rgba(37,205,255,0.26),0_12px_22px_rgba(0,0,0,0.55)]"
                aria-label="Expand page index"
              >
                <span className="sr-only">Expand page index</span>
                <span className="inline-flex flex-col items-center justify-center gap-[3px] leading-none">
                  <span className="h-[2px] w-4 rounded-full bg-current" />
                  <span className="h-[2px] w-4 rounded-full bg-current/80" />
                  <span className="h-[2px] w-4 rounded-full bg-current/60" />
                </span>
              </button>
            </div>
          ) : (
            <div className="relative w-[280px] overflow-hidden rounded-[18px] border-2 border-[var(--twilight)]/70 bg-[linear-gradient(164deg,rgba(13,16,29,0.97),rgba(10,12,21,0.97))] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_22px_rgba(37,205,255,0.18),0_0_26px_rgba(255,107,122,0.14),0_20px_44px_rgba(0,0,0,0.55)] backdrop-blur-sm">
              <div className="pointer-events-none absolute inset-0 opacity-75 [background:repeating-linear-gradient(125deg,rgba(255,255,255,0.025)_0,rgba(255,255,255,0.025)_2px,transparent_2px,transparent_9px)]" />
              <div className="relative h-[3px] w-full bg-[linear-gradient(90deg,var(--coral),var(--neon-cyan),var(--neon-amber),var(--coral))]" />
              <div className="relative flex items-start justify-between gap-2 border-b border-[var(--twilight)]/45 px-3 py-2.5">
                <div className="space-y-0.5">
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--soft)]">
                    {isEditing ? "Edit Sections" : "City Field Guide"}
                  </p>
                  <p className="text-xs text-[var(--cream)]">
                    {isEditing
                      ? "Reorder and toggle sections"
                      : `${viewEntries.length} quick jumps`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && !isEditing && (
                    <button
                      type="button"
                      onClick={enterEditMode}
                      className="h-8 w-8 rounded-full border border-[var(--twilight)]/65 bg-[var(--night)]/70 text-[var(--muted)] transition-colors hover:border-[var(--coral)]/60 hover:text-[var(--cream)] flex items-center justify-center"
                      aria-label="Edit feed layout"
                    >
                      <PencilSimple weight="bold" className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDesktopCollapsed(true);
                        trackPortalAction(portalSlug, {
                          action_type: "resource_clicked",
                          page_type: "feed",
                          section_key: sectionKey,
                          target_kind: "index_toggle",
                          target_id: "collapsed",
                          target_label: "Collapse index",
                          metadata: { source: "desktop_panel_button" },
                        });
                      }}
                      className="h-8 w-8 rounded-full border border-[var(--twilight)]/65 bg-[var(--night)]/70 text-[var(--muted)] transition-colors hover:border-[var(--coral)]/60 hover:text-[var(--cream)] flex items-center justify-center"
                      aria-label="Collapse page index"
                    >
                      −
                    </button>
                  )}
                </div>
              </div>

              <div className="relative flex gap-2 p-2">
                <nav className="max-h-[calc(100vh-7rem)] flex-1 overflow-y-auto">
                  <ul className="space-y-1">
                    {isEditing
                      ? allEditEntries.map((entry) =>
                          renderEditEntry(entry, "desktop"),
                        )
                      : viewEntries.map((entry, index) =>
                          renderViewEntry(entry, index, "desktop"),
                        )}
                  </ul>
                </nav>
                {!isEditing && (
                  <div className="w-5 flex-shrink-0">
                    <div className="flex max-h-[calc(100vh-7rem)] flex-col items-center gap-1.5 overflow-y-auto rounded-full border border-[var(--twilight)]/50 bg-[var(--night)]/80 px-1 py-2">
                      {viewEntries.map((entry, index) => {
                        const isActive = activeId === entry.id;
                        return (
                          <button
                            key={`desktop-progress-${entry.id}`}
                            type="button"
                            title={entry.label}
                            onClick={() =>
                              handleProgressJump(entry, index, "desktop")
                            }
                            className={`rounded-full transition-all ${
                              isActive
                                ? "h-3.5 w-3.5 bg-[var(--neon-cyan)] shadow-[0_0_12px_rgba(37,205,255,0.7)]"
                                : "h-2.5 w-2.5 bg-[var(--twilight)] hover:bg-[var(--coral)]"
                            }`}
                            aria-label={`Jump to ${entry.label}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {editFooter}
            </div>
          )}
        </div>
      </aside>

      {/* ─── Mobile: FAB trigger ─── */}
      <button
        type="button"
        onClick={() => {
          setIsMobileOpen(true);
          trackPortalAction(portalSlug, {
            action_type: "resource_clicked",
            page_type: "feed",
            section_key: sectionKey,
            target_kind: "index_open",
            target_id: "mobile",
            target_label: "Open page index",
          });
        }}
        className="fixed top-[7rem] right-3 z-[120] flex h-11 w-11 items-center justify-center rounded-full border border-[var(--coral)]/45 bg-[linear-gradient(145deg,rgba(16,20,36,0.96),rgba(11,14,26,0.96))] text-[var(--cream)] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_16px_rgba(255,107,122,0.22),0_10px_20px_rgba(0,0,0,0.48)] transition-all hover:border-[var(--neon-cyan)]/60 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_0_20px_rgba(37,205,255,0.24),0_12px_22px_rgba(0,0,0,0.52)] sm:hidden"
        aria-label="Open page index"
      >
        <span className="sr-only">Open page index</span>
        <span className="inline-flex flex-col items-center justify-center gap-[3px] leading-none">
          <span className="h-[2px] w-4 rounded-full bg-current" />
          <span className="h-[2px] w-4 rounded-full bg-current/80" />
          <span className="h-[2px] w-4 rounded-full bg-current/60" />
        </span>
      </button>

      {/* ─── Mobile: bottom sheet ─── */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-[10010] sm:hidden">
          <button
            type="button"
            onClick={() => {
              if (!isEditing) setIsMobileOpen(false);
            }}
            className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
            aria-label="Close page index"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-hidden rounded-t-2xl border-t border-[var(--twilight)]/45 bg-[var(--night)] p-3 pb-5">
            <div className="flex items-center justify-between px-1 pb-2">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {isEditing ? "Edit Sections" : "City Field Guide"}
                </p>
                <p className="text-xs text-[var(--cream)]">
                  {isEditing
                    ? "Reorder and toggle sections"
                    : `${viewEntries.length} quick jumps`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {canEdit && !isEditing && (
                  <button
                    type="button"
                    onClick={enterEditMode}
                    className="h-8 w-8 rounded-full border border-[var(--twilight)]/45 text-[var(--muted)] hover:text-[var(--cream)] flex items-center justify-center"
                    aria-label="Edit feed layout"
                  >
                    <PencilSimple weight="bold" className="w-3.5 h-3.5" />
                  </button>
                )}
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => setIsMobileOpen(false)}
                    className="h-8 w-8 rounded-full border border-[var(--twilight)]/45 text-[var(--muted)] hover:text-[var(--cream)] flex items-center justify-center"
                    aria-label="Close"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <nav className="max-h-[53vh] flex-1 overflow-y-auto pr-1">
                <ul className="space-y-1">
                  {isEditing
                    ? allEditEntries.map((entry) =>
                        renderEditEntry(entry, "mobile"),
                      )
                    : viewEntries.map((entry, index) =>
                        renderViewEntry(entry, index, "mobile"),
                      )}
                </ul>
              </nav>
              {!isEditing && (
                <div className="w-5 flex-shrink-0">
                  <div className="flex max-h-[53vh] flex-col items-center gap-1.5 overflow-y-auto rounded-full border border-[var(--twilight)]/35 bg-[var(--night)]/65 px-1 py-2">
                    {viewEntries.map((entry, index) => {
                      const isActive = activeId === entry.id;
                      return (
                        <button
                          key={`mobile-progress-${entry.id}`}
                          type="button"
                          title={entry.label}
                          onClick={() => {
                            handleProgressJump(entry, index, "mobile");
                            setIsMobileOpen(false);
                          }}
                          className={`rounded-full transition-all ${
                            isActive
                              ? "h-3.5 w-3.5 bg-[var(--coral)] shadow-[0_0_10px_rgba(255,107,122,0.55)]"
                              : "h-2.5 w-2.5 bg-[var(--twilight)] hover:bg-[var(--soft)]"
                          }`}
                          aria-label={`Jump to ${entry.label}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {isEditing && (
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[var(--twilight)]/45">
                <button
                  type="button"
                  onClick={() => {
                    cancelEdit();
                  }}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-[var(--twilight)]/50 text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--twilight)] transition-colors"
                >
                  <X weight="bold" className="w-3 h-3" />
                  <span className="text-xs font-mono">Cancel</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveEdit();
                    setIsMobileOpen(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium hover:bg-[var(--rose)] transition-colors"
                >
                  <Check weight="bold" className="w-3 h-3" />
                  <span>Save</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
