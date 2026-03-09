"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Clock, ShareNetwork } from "@phosphor-icons/react";
import { formatTime } from "@/lib/formats";
import OutingPlannerProvider, { useOutingPlannerContext } from "./OutingPlannerProvider";
import OutingTimeline from "./OutingTimeline";
import OutingSuggestionList from "./OutingSuggestionList";
import OutingShareModal from "./OutingShareModal";
import OutingEmptyState from "./OutingEmptyState";
import type { AnchorInput } from "./useOutingPlanner";
import { resolveLabel } from "./outing-copy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OutingPlannerSheetProps {
  anchor: AnchorInput;
  portalId: string;
  portalSlug: string;
  portalVertical?: string;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Anchor card — shows the event/venue the outing is built around
// ---------------------------------------------------------------------------

function AnchorCard({ anchor }: { anchor: AnchorInput }) {
  const { copy } = useOutingPlannerContext();

  if (anchor.type === "event") {
    const e = anchor.event;
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border-l-2 border-l-[var(--gold)] border border-[var(--twilight)] bg-[var(--night)]">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--cream)] truncate">{e.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {e.venue && (
              <span className="text-xs text-[var(--soft)] truncate">{e.venue.name}</span>
            )}
            {e.start_time && (
              <span className="flex items-center gap-0.5 text-xs text-[var(--muted)]">
                <Clock size={11} weight="light" />
                {formatTime(e.start_time, e.is_all_day)}
              </span>
            )}
          </div>
        </div>
        <span className="px-2 py-0.5 rounded text-2xs font-mono font-medium uppercase tracking-wider bg-[var(--gold)]/15 text-[var(--gold)] flex-shrink-0">
          {copy.anchorBadge}
        </span>
      </div>
    );
  }

  // Venue anchor
  const v = anchor.venue;
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border-l-2 border-l-[var(--gold)] border border-[var(--twilight)] bg-[var(--night)]">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--cream)] truncate">{v.name}</p>
      </div>
      <span className="px-2 py-0.5 rounded text-2xs font-mono font-medium uppercase tracking-wider bg-[var(--gold)]/15 text-[var(--gold)] flex-shrink-0">
        {copy.anchorBadge}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sheet content (uses context)
// ---------------------------------------------------------------------------

function SheetContent({
  anchor,
  onClose,
  portalSlug,
}: {
  anchor: AnchorInput;
  onClose: () => void;
  portalSlug: string;
}) {
  const router = useRouter();
  const {
    phase,
    items,
    beforeSuggestions,
    afterSuggestions,
    suggestionsLoading,
    suggestionsError,
    saving,
    creating,
    addingId,
    addSuggestion,
    removeItem,
    shareUrl,
    canSuggest,
    anchorName,
    anchorHour,
    anchorCategory,
    copy,
  } = useOutingPlannerContext();

  const [shareOpen, setShareOpen] = useState(false);

  const handleNavigateToSpot = (slug: string) => {
    onClose();
    router.push(`/${portalSlug}?spot=${slug}`, { scroll: false });
  };

  const handleBrowseAll = () => {
    onClose();
    router.push(`/${portalSlug}?tab=find`);
  };

  const isEmpty = !suggestionsLoading && beforeSuggestions.length === 0 && afterSuggestions.length === 0;

  return (
    <>
      {/* Header */}
      <div className="px-4 pb-3 md:pt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-lg font-semibold text-[var(--cream)]">
            {copy.sheetTitle}
          </h2>
          <div className="flex items-center gap-1">
            {shareUrl && items.length > 0 && (
              <button
                onClick={() => setShareOpen(true)}
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[var(--twilight)] transition-colors"
                aria-label="Share outing"
              >
                <ShareNetwork size={18} weight="bold" className="text-[var(--coral)]" />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[var(--twilight)] transition-colors"
              aria-label="Close"
            >
              <X size={20} weight="bold" className="text-[var(--muted)]" />
            </button>
          </div>
        </div>
        {anchorName && (
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {copy.subtitle(anchorName)}
          </p>
        )}
      </div>

      {/* Scrollable content */}
      <div className="overflow-y-auto max-h-[calc(85vh-120px)] md:max-h-[calc(100vh-100px)]">
        <div className="px-4 pb-6 space-y-5">
          {/* Anchor card — only show in suggestions phase (timeline has it as first item) */}
          {phase === "suggestions" && <AnchorCard anchor={anchor} />}

          {/* Timeline — visible in planning phase, animated entry */}
          {phase === "planning" && items.length > 0 && (
            <div className="animate-fade-in">
              <OutingTimeline
                items={items}
                onRemoveItem={removeItem}
                saving={saving}
              />
            </div>
          )}

          {/* Error state */}
          {suggestionsError && (
            <div className="text-center py-6">
              <p className="text-sm text-[var(--muted)]">{suggestionsError}</p>
            </div>
          )}

          {/* No coords/time — can't suggest */}
          {!canSuggest && (
            <OutingEmptyState
              title="Not enough info to suggest spots nearby"
              subtitle="Browse all nearby spots"
              onBrowse={handleBrowseAll}
            />
          )}

          {/* Suggestions — always visible when available */}
          {canSuggest && !isEmpty && (
            <OutingSuggestionList
              beforeSuggestions={beforeSuggestions}
              afterSuggestions={afterSuggestions}
              beforeLabel={resolveLabel(copy.beforeLabel, anchorCategory)}
              afterLabel={resolveLabel(copy.afterLabel, anchorCategory)}
              loading={suggestionsLoading}
              onAdd={addSuggestion}
              onNavigate={handleNavigateToSpot}
              addingId={addingId}
              creating={creating}
              anchorHour={anchorHour}
            />
          )}

          {/* True empty — both slots empty */}
          {isEmpty && canSuggest && (
            <OutingEmptyState
              title={copy.emptyTitle}
              subtitle={copy.emptySubtitle}
              onBrowse={handleBrowseAll}
            />
          )}
        </div>
      </div>

      {/* Share modal */}
      {shareUrl && (
        <OutingShareModal
          shareUrl={shareUrl}
          title={items.length > 0 ? `${items.length} stop outing` : "My Outing"}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Shell — bottom sheet / sidebar with animation
// ---------------------------------------------------------------------------

export default function OutingPlannerSheet({
  anchor,
  portalId,
  portalSlug,
  portalVertical,
  isOpen,
  onClose,
}: OutingPlannerSheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (typeof document === "undefined" || !isVisible) return null;

  return createPortal(
    <OutingPlannerProvider
      portalId={portalId}
      portalSlug={portalSlug}
      portalVertical={portalVertical}
      anchor={anchor}
      isOpen={isOpen}
    >
      <div
        className={`fixed inset-0 z-[140] transition-colors duration-300 ${
          isAnimating ? "bg-black/50" : "bg-transparent"
        }`}
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-label="Outing Planner"
      >
        <div
          ref={sheetRef}
          className={`fixed bottom-0 left-0 right-0 bg-[var(--void)] border-t border-[var(--twilight)] rounded-t-2xl shadow-2xl max-h-[85vh] transition-transform duration-300 md:top-0 md:bottom-0 md:left-auto md:right-0 md:w-[420px] md:max-h-none md:rounded-none md:border-t-0 md:border-l-2 md:border-l-[var(--gold)]/20 ${
            isAnimating
              ? "translate-y-0 md:translate-y-0 md:translate-x-0"
              : "translate-y-full md:translate-y-0 md:translate-x-full"
          }`}
        >
          {/* Drag handle (mobile) */}
          <div className="flex justify-center pt-3 pb-2 md:hidden">
            <div className="w-12 h-1 rounded-full bg-[var(--twilight)]" />
          </div>

          <SheetContent
            anchor={anchor}
            onClose={onClose}
            portalSlug={portalSlug}
          />
        </div>
      </div>
    </OutingPlannerProvider>,
    document.body,
  );
}
