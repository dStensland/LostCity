"use client";

import { useEffect, useState } from "react";
import { HangSheet } from "./HangSheet";

interface PostRsvpHangPromptProps {
  eventId: number;
  eventTitle: string;
  venue: {
    id: number;
    name: string;
    slug: string | null;
    image_url: string | null;
    neighborhood: string | null;
  };
  onDismiss: () => void;
}

export function PostRsvpHangPrompt({
  eventId,
  eventTitle,
  venue,
  onDismiss,
}: PostRsvpHangPromptProps) {
  const [showHangSheet, setShowHangSheet] = useState(false);

  // Check localStorage immediately — skip if already dismissed for this event
  const storageKey = `rsvp_hang_prompt_dismissed_${eventId}`;
  const alreadyDismissed =
    typeof window !== "undefined" && !!localStorage.getItem(storageKey);

  useEffect(() => {
    if (alreadyDismissed) {
      onDismiss();
      return;
    }

    // Auto-dismiss after 6 seconds
    const timer = setTimeout(() => {
      handleDismiss();
    }, 6000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // localStorage may be unavailable (private browsing edge cases)
    }
    onDismiss();
  };

  const handleCheckInNow = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
    setShowHangSheet(true);
  };

  if (alreadyDismissed) return null;

  return (
    <>
      <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-fadeIn">
        <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl shadow-2xl p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {/* Neon-green dot accent for hangs */}
              <span className="w-2 h-2 rounded-full bg-[var(--neon-green)] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-mono text-sm font-semibold text-[var(--cream)]">
                  Check in when you arrive?
                </h3>
                <p className="font-mono text-xs text-[var(--muted)] mt-0.5 line-clamp-1">
                  Going to {eventTitle}
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors p-1 flex-shrink-0"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleCheckInNow}
              className="flex-1 min-h-[36px] px-3 py-2 rounded-lg bg-[var(--neon-green)]/15 border border-[var(--neon-green)]/40 text-[var(--neon-green)] font-mono text-xs font-medium hover:bg-[var(--neon-green)]/25 transition-colors"
            >
              Check in now
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 min-h-[36px] px-3 py-2 rounded-lg bg-[var(--twilight)] text-[var(--soft)] font-mono text-xs font-medium hover:text-[var(--cream)] transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </div>

      <HangSheet
        isOpen={showHangSheet}
        onClose={() => {
          setShowHangSheet(false);
          onDismiss();
        }}
        venue={venue}
        event={{ id: eventId, title: eventTitle }}
        onHangCreated={() => {
          setShowHangSheet(false);
          onDismiss();
        }}
      />
    </>
  );
}
