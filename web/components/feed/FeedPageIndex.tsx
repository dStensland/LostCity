"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { trackPortalAction } from "@/lib/analytics/portal-action-tracker";
import { useFeedVisible } from "@/lib/feed-visibility";
import type { FeedBlockId } from "@/lib/city-pulse/types";

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
  /** Accepted but unused — kept for compatibility with existing callers. */
  isAuthenticated?: boolean;
}

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
 * Reads `[data-feed-anchor]` elements from the DOM directly in CityPulse mode
 * and uses legacy `entries` prop for non-CityPulse templates. What renders on
 * the page is what shows up in the TOC — no mapping, no config.
 */
export default function FeedPageIndex({
  portalSlug,
  entries: legacyEntries,
  loading = false,
  sectionKey = "feed_page_index",
}: FeedPageIndexProps) {
  const isLegacyMode = !!legacyEntries;
  const feedVisible = useFeedVisible();

  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // DOM-sourced entries — the single source of truth for view mode (CityPulse)
  const [domEntries, setDomEntries] = useState<DomEntry[]>([]);

  // Rescan on mount + whenever DOM mutates (new section renders, etc.)
  useEffect(() => {
    if (isLegacyMode) return;
    if (typeof document === "undefined") return;

    let raf = 0;
    const rescan = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setDomEntries(scanFeedAnchors());
      });
    };

    rescan();

    const observer = new MutationObserver(rescan);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", rescan);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", rescan);
    };
  }, [isLegacyMode]);

  const viewEntries: DomEntry[] = useMemo(() => {
    if (isLegacyMode && legacyEntries) {
      return legacyEntries
        .filter((e): e is Required<IndexEntry> => !!e.blockId)
        .map((e) => ({ id: e.id, label: e.label, blockId: e.blockId! }));
    }
    return domEntries;
  }, [isLegacyMode, legacyEntries, domEntries]);

  /* ── Scroll-spy: highlight the currently visible anchor ── */
  useEffect(() => {
    if (viewEntries.length === 0) return;
    if (typeof document === "undefined") return;

    const observer = new IntersectionObserver(
      (observedEntries) => {
        observedEntries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0 },
    );

    viewEntries.forEach((entry) => {
      const el = document.getElementById(entry.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [viewEntries]);

  /* ── Jump-to-anchor handler with analytics ── */
  const scrollToEntry = useCallback((entry: DomEntry) => {
    const el = document.getElementById(entry.id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(entry.id);
  }, []);

  const jumpTo = useCallback(
    (entry: DomEntry, index: number, source: "desktop" | "mobile") => {
      scrollToEntry(entry);
      trackPortalAction(portalSlug, {
        action_type: "resource_clicked",
        page_type: "feed",
        section_key: sectionKey,
        target_kind: "index_jump",
        target_id: entry.id,
        target_label: entry.label,
        target_url: `#${entry.id}`,
        metadata: { position: index + 1, source },
      });
      if (source === "mobile") setIsMobileOpen(false);
    },
    [portalSlug, sectionKey, scrollToEntry],
  );

  const handleProgressJump = useCallback(
    (entry: DomEntry, index: number, source: "desktop" | "mobile") => {
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
    [portalSlug, sectionKey, scrollToEntry],
  );

  /* ── Guards ── */
  if (viewEntries.length === 0) return null;
  if (typeof document === "undefined") return null;
  if (loading) return null;
  if (!feedVisible) return null;

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

  /* ── Render (portalled to document.body) ── */
  return createPortal(
    <>
      {/* ─── Desktop: floating sidebar ─── */}
      <aside className="pointer-events-none fixed right-4 top-[4.5rem] z-[120] hidden sm:block">
        <div className="pointer-events-auto">
          {isDesktopCollapsed ? (
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
                    City Field Guide
                  </p>
                  <p className="text-xs text-[var(--cream)]">
                    {viewEntries.length} quick jumps
                  </p>
                </div>
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
              </div>

              <div className="relative flex gap-2 p-2">
                <nav className="max-h-[calc(100vh-7rem)] flex-1 overflow-y-auto">
                  <ul className="space-y-1">
                    {viewEntries.map((entry, index) =>
                      renderViewEntry(entry, index, "desktop"),
                    )}
                  </ul>
                </nav>
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
              </div>
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
            onClick={() => setIsMobileOpen(false)}
            className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
            aria-label="Close page index"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-hidden rounded-t-2xl border-t border-[var(--twilight)]/45 bg-[var(--night)] p-3 pb-5">
            <div className="flex items-center justify-between px-1 pb-2">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  City Field Guide
                </p>
                <p className="text-xs text-[var(--cream)]">
                  {viewEntries.length} quick jumps
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="h-8 w-8 rounded-full border border-[var(--twilight)]/45 text-[var(--muted)] hover:text-[var(--cream)] flex items-center justify-center"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="flex gap-2">
              <nav className="max-h-[53vh] flex-1 overflow-y-auto pr-1">
                <ul className="space-y-1">
                  {viewEntries.map((entry, index) =>
                    renderViewEntry(entry, index, "mobile"),
                  )}
                </ul>
              </nav>
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
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
