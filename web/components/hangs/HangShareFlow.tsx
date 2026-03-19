"use client";

import { memo, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "@phosphor-icons/react";
import { triggerHaptic } from "@/lib/haptics";
import { useAuth } from "@/lib/auth-context";
import { trackHangShared } from "@/lib/analytics/hangs-tracking";
import { HangShareCard } from "./HangShareCard";

interface HangShareFlowProps {
  isOpen: boolean;
  onClose: () => void;
  hang: {
    id: string;
    venue: {
      name: string;
      slug: string | null;
      image_url: string | null;
      neighborhood: string | null;
    };
    note: string | null;
    started_at: string;
  };
  portalSlug: string;
}

export const HangShareFlow = memo(function HangShareFlow({
  isOpen,
  onClose,
  hang,
  portalSlug,
}: HangShareFlowProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [shared, setShared] = useState(false);

  const { profile } = useAuth();

  const userName =
    profile?.display_name ?? profile?.username ?? "Someone";
  const avatarUrl = profile?.avatar_url ?? null;

  // Open/close animation — same pattern as HangSheet
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
        // Reset shared state after sheet is gone
        setShared(false);
      }, 300);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Escape key
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lostcity.ai";
  const venueUrl = hang.venue.slug
    ? `${siteUrl}/${portalSlug}/spots/${hang.venue.slug}`
    : `${siteUrl}/${portalSlug}`;

  const handleShare = useCallback(async () => {
    triggerHaptic("success");

    const shareTitle = `I'm at ${hang.venue.name}`;
    const shareText = hang.note?.trim()
      ? hang.note.trim()
      : `Join me at ${hang.venue.name}!`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: venueUrl,
        });
        trackHangShared({
          portalSlug,
          venueId: hang.venue.slug ?? hang.venue.name,
          venueName: hang.venue.name,
          shareMethod: "native",
        });
        setShared(true);
        // Auto-close after brief confirmation
        setTimeout(() => {
          onClose();
        }, 1200);
      } catch {
        // User cancelled native share — not an error, just do nothing
      }
    } else {
      // Fallback: copy URL to clipboard
      try {
        await navigator.clipboard.writeText(venueUrl);
        trackHangShared({
          portalSlug,
          venueId: hang.venue.slug ?? hang.venue.name,
          venueName: hang.venue.name,
          shareMethod: "clipboard",
        });
        setShared(true);
        setTimeout(() => {
          onClose();
        }, 1200);
      } catch {
        // Clipboard also unavailable — nothing we can do
      }
    }
  }, [hang.venue.name, hang.venue.slug, hang.note, portalSlug, venueUrl, onClose]);

  const handleNotNow = () => {
    triggerHaptic("light");
    onClose();
  };

  if (typeof document === "undefined" || !isVisible) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[140] transition-colors duration-300 ${
        isAnimating ? "bg-black/50" : "bg-transparent"
      }`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Share your hang"
    >
      <div
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
          <h2 className="font-mono text-base text-[var(--cream)]">
            Let friends know
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
          <div className="px-4 pb-6 flex flex-col items-center gap-5">
            {/* Share card preview */}
            <HangShareCard
              hang={hang}
              userName={userName}
              avatarUrl={avatarUrl}
              portalSlug={portalSlug}
              className="w-full"
            />

            {/* CTAs */}
            <div className="w-full space-y-3">
              {shared ? (
                /* Success confirmation */
                <div className="flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--neon-green)]/15 border border-[var(--neon-green)]/40 rounded-lg">
                  <Check
                    size={16}
                    className="text-[var(--neon-green)]"
                    weight="bold"
                  />
                  <span className="font-mono text-sm text-[var(--neon-green)] font-medium">
                    Shared!
                  </span>
                </div>
              ) : (
                <button
                  onClick={handleShare}
                  className="bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg py-2.5 w-full hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  Share
                </button>
              )}

              <div className="text-center">
                <button
                  onClick={handleNotNow}
                  className="text-xs text-[var(--muted)] hover:text-[var(--soft)] transition-colors"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
});

export type { HangShareFlowProps };
