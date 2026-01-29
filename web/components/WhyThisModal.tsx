"use client";

import { useEffect, useCallback, useState } from "react";
import Link from "next/link";
import ReasonBadge, { type RecommendationReason } from "./ReasonBadge";

interface WhyThisModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: number;
  eventTitle: string;
  reasons: RecommendationReason[];
  portalSlug?: string;
  onHide?: () => void;
}

// Group reasons by type for display
type ReasonGroup = "social" | "preferences" | "inferred";

function getReasonGroup(type: RecommendationReason["type"]): ReasonGroup {
  switch (type) {
    case "friends_going":
      return "social";
    case "followed_venue":
    case "followed_organization":
    case "neighborhood":
    case "category":
    case "price":
      return "preferences";
    case "trending":
    default:
      return "inferred";
  }
}

const GROUP_LABELS: Record<ReasonGroup, { title: string; description: string }> = {
  social: {
    title: "Social Signals",
    description: "People you know are interested",
  },
  preferences: {
    title: "Your Preferences",
    description: "Matches what you've told us you like",
  },
  inferred: {
    title: "Discovered For You",
    description: "Based on your activity and trending events",
  },
};

/**
 * Modal showing why an event was recommended.
 * Uses CSS animations instead of framer-motion for better performance.
 */
export default function WhyThisModal({
  isOpen,
  onClose,
  eventId,
  eventTitle,
  reasons,
  portalSlug,
  onHide,
}: WhyThisModalProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Handle open/close with exit animation
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Required for animation state sync
      setShouldRender(true);
      setIsExiting(false);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setShouldRender(false);
      setIsExiting(false);
      onClose();
    }, 150); // Match CSS animation duration
  }, [onClose]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, handleClose]);

  // Group reasons
  const groupedReasons = reasons.reduce(
    (acc, reason) => {
      const group = getReasonGroup(reason.type);
      if (!acc[group]) acc[group] = [];
      acc[group].push(reason);
      return acc;
    },
    {} as Record<ReasonGroup, RecommendationReason[]>
  );

  // Order groups
  const groupOrder: ReasonGroup[] = ["social", "preferences", "inferred"];
  const activeGroups = groupOrder.filter((g) => groupedReasons[g]?.length > 0);

  const handleHide = useCallback(async () => {
    try {
      await fetch("/api/events/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, reason: "not_interested" }),
      });
      onHide?.();
      handleClose();
    } catch (err) {
      console.error("Failed to hide event:", err);
    }
  }, [eventId, onHide, handleClose]);

  if (!shouldRender) return null;

  const animationClass = isExiting ? "modal-exit" : "modal-enter";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] ${animationClass}`}
        onClick={handleClose}
        style={{
          animation: isExiting
            ? "fadeOut 0.15s ease-out forwards"
            : "fadeIn 0.15s ease-out forwards",
        }}
      />

      {/* Modal */}
      <div
        className={`fixed inset-x-4 top-[15%] z-[101] max-w-md mx-auto ${animationClass}`}
        style={{
          animation: isExiting
            ? "modalOut 0.15s ease-out forwards"
            : "modalIn 0.15s ease-out forwards",
        }}
      >
        <div
          className="rounded-2xl border border-[var(--twilight)] shadow-2xl overflow-hidden"
          style={{ backgroundColor: "var(--void)" }}
        >
          {/* Header */}
          <div className="p-4 border-b border-[var(--twilight)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--cream)]">
                  Why this event?
                </h2>
                <p className="text-sm text-[var(--muted)] mt-0.5 line-clamp-1">
                  {eventTitle}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="flex-shrink-0 w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 max-h-[50vh] overflow-y-auto">
            {reasons.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-[var(--muted)] text-sm">
                  This event appeared in your feed based on general relevance.
                </p>
                <p className="text-[var(--muted)] text-xs mt-2">
                  Tell us your preferences to get better recommendations.
                </p>
                <Link
                  href={portalSlug ? `/${portalSlug}/preferences` : "/settings/taste-profile"}
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm hover:bg-[var(--coral)] hover:text-[var(--void)] transition-colors min-h-[44px] sm:min-h-[36px]"
                >
                  Set preferences
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {activeGroups.map((group) => (
                  <div key={group}>
                    <div className="mb-2">
                      <h3 className="text-sm font-medium text-[var(--cream)]">
                        {GROUP_LABELS[group].title}
                      </h3>
                      <p className="text-xs text-[var(--muted)]">
                        {GROUP_LABELS[group].description}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {groupedReasons[group].map((reason, idx) => (
                        <ReasonBadge
                          key={`${reason.type}-${idx}`}
                          reason={reason}
                          size="md"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--twilight)]">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handleHide}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--coral)] font-mono text-xs hover:bg-[var(--coral)]/10 transition-colors min-h-[44px] sm:min-h-[36px]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
                Not for me
              </button>

              <Link
                href={portalSlug ? `/${portalSlug}/settings/taste-profile` : "/settings/taste-profile"}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--muted)] font-mono text-xs hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors min-h-[44px] sm:min-h-[36px]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Manage preferences
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* CSS keyframes */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes modalOut {
          from {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          to {
            opacity: 0;
            transform: scale(0.95) translateY(20px);
          }
        }
      `}</style>
    </>
  );
}
