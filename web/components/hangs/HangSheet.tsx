"use client";

import { memo, useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { triggerHaptic } from "@/lib/haptics";
import { useAuthenticatedFetch } from "@/lib/hooks/useAuthenticatedFetch";
import { usePortalSlug } from "@/lib/portal-context";
import { trackHangCreated } from "@/lib/analytics/hangs-tracking";
import type { HangVisibility, CreateHangRequest } from "@/lib/types/hangs";
import {
  HANG_VISIBILITY_OPTIONS,
  HANG_DURATION_OPTIONS,
  MAX_HANG_NOTE_LENGTH,
} from "@/lib/types/hangs";

interface HangSheetProps {
  isOpen: boolean;
  onClose: () => void;
  venue: {
    id: number;
    name: string;
    slug: string | null;
    image_url: string | null;
    neighborhood: string | null;
  };
  event?: {
    id: number;
    title: string;
  } | null;
  source?: "venue_detail" | "event_detail" | "feed";
  onHangCreated?: () => void;
}

// Color per visibility option — coral for social choices, gold for temporal
const VISIBILITY_COLORS: Record<HangVisibility, string> = {
  private: "var(--coral)",
  friends: "var(--coral)",
  public: "var(--coral)",
};

const VISIBILITY_ACTIVE_CLASSES: Record<HangVisibility, string> = {
  private:
    "bg-[var(--coral)]/15 border-[var(--coral)]/60 text-[var(--coral)]",
  friends:
    "bg-[var(--coral)]/15 border-[var(--coral)]/60 text-[var(--coral)]",
  public:
    "bg-[var(--coral)]/15 border-[var(--coral)]/60 text-[var(--coral)]",
};

export const HangSheet = memo(function HangSheet({
  isOpen,
  onClose,
  venue,
  event,
  source = "venue_detail",
  onHangCreated,
}: HangSheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Form state
  const [visibility, setVisibility] = useState<HangVisibility>("friends");
  const [note, setNote] = useState("");
  const [durationHours, setDurationHours] = useState(4);
  const [isPlanned, setIsPlanned] = useState(false);
  const [plannedFor, setPlannedFor] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);
  const { authFetch } = useAuthenticatedFetch();
  const portalSlug = usePortalSlug();

  // Handle open/close animation — matches MobileFilterSheet pattern exactly
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Required for entrance animation timing
      setIsVisible(true);
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
      document.body.style.overflow = "hidden";
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional form reset on sheet open
      setVisibility("friends");
      setNote("");
      setDurationHours(4);
      setIsPlanned(false);
      setPlannedFor("");
      setSubmitError(null);
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      triggerHaptic("light");
      onClose();
    }
  };

  const handleVisibilityChange = (v: HangVisibility) => {
    triggerHaptic("selection");
    setVisibility(v);
  };

  const handleDurationChange = (hours: number) => {
    triggerHaptic("selection");
    setDurationHours(hours);
  };

  const handleModeToggle = () => {
    triggerHaptic("selection");
    setIsPlanned((prev) => !prev);
    setPlannedFor("");
  };

  const handleSubmit = useCallback(async () => {
    triggerHaptic("success");
    setIsSubmitting(true);
    setSubmitError(null);

    const body: CreateHangRequest = {
      venue_id: venue.id,
      ...(event?.id && { event_id: event.id }),
      visibility,
      ...(note.trim() && { note: note.trim() }),
      duration_hours: durationHours,
      ...(isPlanned && plannedFor && { planned_for: plannedFor }),
    };

    const { error } = await authFetch<{ hang: unknown }>("/api/hangs", {
      method: "POST",
      body,
      showErrorToast: false,
    });

    setIsSubmitting(false);

    if (error) {
      setSubmitError(error);
      triggerHaptic("error");
      return;
    }

    trackHangCreated({
      portalSlug,
      venueId: venue.id,
      venueName: venue.name,
      visibility,
      durationHours,
      hasNote: note.trim().length > 0,
      hasEvent: Boolean(event),
      source,
    });

    onHangCreated?.();
    onClose();
  }, [venue.id, venue.name, event, visibility, note, durationHours, isPlanned, plannedFor, source, portalSlug, authFetch, onHangCreated, onClose]);

  if (typeof document === "undefined" || !isVisible) return null;

  const ctaLabel = isSubmitting
    ? "Saving..."
    : isPlanned
    ? "Plan It"
    : "I'm Here";

  return createPortal(
    <div
      className={`fixed inset-0 z-[140] transition-colors duration-300 ${
        isAnimating ? "bg-black/50" : "bg-transparent"
      }`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Check in at ${venue.name}`}
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
        <div className="flex justify-center pt-3 pb-2 md:hidden">
          <div className="w-12 h-1 rounded-full bg-[var(--twilight)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 pt-2 md:pt-5">
          <h2 className="font-mono text-lg font-semibold text-[var(--cream)]">
            Check In
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[var(--twilight)] transition-colors"
            aria-label="Close"
          >
            <X size={18} className="text-[var(--muted)]" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[calc(85vh-120px)] md:max-h-[calc(100vh-80px)]">
          <div className="px-4 pb-6 space-y-6">
            {/* Venue identity */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40">
              {venue.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={venue.image_url}
                  alt={venue.name}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-[var(--dusk)] flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-mono text-base font-semibold text-[var(--cream)] truncate">
                  {venue.name}
                </p>
                {venue.neighborhood && (
                  <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
                    {venue.neighborhood}
                  </p>
                )}
                {event && (
                  <p className="font-mono text-xs text-[var(--soft)] mt-0.5 truncate">
                    {event.title}
                  </p>
                )}
              </div>
            </div>

            {/* Visibility selector */}
            <div>
              <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Who can see this?
              </p>
              <div className="grid grid-cols-3 gap-2">
                {HANG_VISIBILITY_OPTIONS.map((opt) => {
                  const isActive = visibility === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleVisibilityChange(opt.value)}
                      className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 px-2 py-2.5 rounded-lg border font-mono text-xs font-medium transition-all ${
                        isActive
                          ? VISIBILITY_ACTIVE_CLASSES[opt.value]
                          : "bg-[var(--dusk)] border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--soft)]"
                      }`}
                      aria-pressed={isActive}
                    >
                      {/* Color dot indicator */}
                      <span
                        className="w-1.5 h-1.5 rounded-full mb-0.5"
                        style={{
                          backgroundColor: isActive
                            ? VISIBILITY_COLORS[opt.value]
                            : "var(--muted)",
                        }}
                      />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {/* Inline description for current selection */}
              <p className="font-mono text-xs text-[var(--soft)] mt-2 leading-relaxed">
                {
                  HANG_VISIBILITY_OPTIONS.find((o) => o.value === visibility)
                    ?.description
                }
              </p>
            </div>

            {/* Note field */}
            <div>
              <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                Note <span className="normal-case tracking-normal opacity-60">(optional)</span>
              </p>
              <div className="relative">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, MAX_HANG_NOTE_LENGTH))}
                  placeholder="What's the vibe?"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors resize-none"
                />
                <span
                  className={`absolute bottom-2 right-2.5 font-mono text-xs tabular-nums ${
                    note.length >= MAX_HANG_NOTE_LENGTH
                      ? "text-[var(--coral)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {note.length}/{MAX_HANG_NOTE_LENGTH}
                </span>
              </div>
            </div>

            {/* Duration selector */}
            <div>
              <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                How long?
              </p>
              <div className="grid grid-cols-4 gap-2">
                {HANG_DURATION_OPTIONS.map((opt) => {
                  const isActive = durationHours === opt.hours;
                  return (
                    <button
                      key={opt.hours}
                      onClick={() => handleDurationChange(opt.hours)}
                      className={`min-h-[44px] px-2 py-2.5 rounded-lg border font-mono text-xs font-medium transition-all leading-tight text-center ${
                        isActive
                          ? "bg-[var(--gold)]/15 border-[var(--gold)]/60 text-[var(--gold)]"
                          : "bg-[var(--dusk)] border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--soft)]"
                      }`}
                      aria-pressed={isActive}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Check in now vs plan for later toggle */}
            <div>
              <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
                Timing
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => !isPlanned || handleModeToggle()}
                  className={`min-h-[44px] px-3 py-2.5 rounded-lg border font-mono text-xs font-medium transition-all ${
                    !isPlanned
                      ? "bg-[var(--gold)]/15 border-[var(--gold)]/60 text-[var(--gold)]"
                      : "bg-[var(--dusk)] border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--soft)]"
                  }`}
                  aria-pressed={!isPlanned}
                >
                  Check in now
                </button>
                <button
                  onClick={() => isPlanned || handleModeToggle()}
                  className={`min-h-[44px] px-3 py-2.5 rounded-lg border font-mono text-xs font-medium transition-all ${
                    isPlanned
                      ? "bg-[var(--gold)]/15 border-[var(--gold)]/60 text-[var(--gold)]"
                      : "bg-[var(--dusk)] border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--soft)]"
                  }`}
                  aria-pressed={isPlanned}
                >
                  Plan for later
                </button>
              </div>

              {/* Date/time picker when planning */}
              {isPlanned && (
                <div className="mt-3">
                  <input
                    type="datetime-local"
                    value={plannedFor}
                    onChange={(e) => setPlannedFor(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Inline error */}
            {submitError && (
              <div className="p-3 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]">
                <p className="font-mono text-xs text-[var(--coral)]">{submitError}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="sticky bottom-0 border-t border-[var(--twilight)] bg-[var(--void)] px-4 py-3">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (isPlanned && !plannedFor)}
            className="w-full min-h-[44px] bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

export type { HangSheetProps };
