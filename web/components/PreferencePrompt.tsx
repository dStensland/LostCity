"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import CategoryIcon from "./CategoryIcon";

interface PreferencePromptProps {
  category: string;
  categoryLabel: string;
  onAccept: () => void;
  onDismiss: () => void;
  /** Auto-dismiss after this many milliseconds (default: 5000) */
  autoDismissMs?: number;
}

// localStorage key for tracking dismissed prompts
const DISMISSED_CATEGORIES_KEY = "preference_prompts_dismissed";

/**
 * Check if a category prompt has been dismissed recently
 */
export function hasPromptBeenDismissed(category: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const stored = localStorage.getItem(DISMISSED_CATEGORIES_KEY);
    if (!stored) return false;

    const dismissed = JSON.parse(stored) as Record<string, number>;
    const dismissedAt = dismissed[category];

    if (!dismissedAt) return false;

    // Consider dismissed for 7 days
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - dismissedAt < sevenDaysMs;
  } catch {
    return false;
  }
}

/**
 * Mark a category prompt as dismissed
 */
export function markPromptDismissed(category: string): void {
  if (typeof window === "undefined") return;

  try {
    const stored = localStorage.getItem(DISMISSED_CATEGORIES_KEY);
    const dismissed = stored ? JSON.parse(stored) : {};
    dismissed[category] = Date.now();
    localStorage.setItem(DISMISSED_CATEGORIES_KEY, JSON.stringify(dismissed));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Inline slide-down prompt that appears after RSVP
 * Asks if user wants to add the event's category to their preferences
 * Uses CSS animations instead of framer-motion for better performance
 */
export default function PreferencePrompt({
  category,
  categoryLabel,
  onAccept,
  onDismiss,
  autoDismissMs = 5000,
}: PreferencePromptProps) {
  const [visible, setVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleExit = useCallback((callback: () => void) => {
    setIsExiting(true);
    // Wait for CSS animation to complete
    setTimeout(() => {
      setVisible(false);
      callback();
    }, 150); // Match CSS transition duration
  }, []);

  // Auto-dismiss timer
  useEffect(() => {
    if (!visible || isExiting) return;

    const timer = setTimeout(() => {
      handleExit(() => {
        markPromptDismissed(category);
        onDismiss();
      });
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [visible, isExiting, autoDismissMs, category, onDismiss, handleExit]);

  const handleAccept = () => {
    handleExit(onAccept);
  };

  const handleDismiss = () => {
    handleExit(() => {
      markPromptDismissed(category);
      onDismiss();
    });
  };

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden transition-all duration-150 ease-out ${
        isExiting ? "opacity-0 max-h-0 mt-0" : "opacity-100 max-h-32 mt-3"
      }`}
      style={{
        // Initial animation on mount
        animation: isExiting ? undefined : "slideDown 0.15s ease-out",
      }}
    >
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]">
        {/* Category icon */}
        <div className="flex-shrink-0">
          <CategoryIcon type={category} size={20} glow="subtle" />
        </div>

        {/* Prompt text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--cream)]">
            Want more <span className="font-medium">{categoryLabel}</span> events?
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleAccept}
            className="px-3 py-1.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium hover:bg-[var(--rose)] transition-colors min-h-[44px] sm:min-h-[32px]"
          >
            Yes please
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-lg bg-transparent text-[var(--muted)] font-mono text-xs hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors min-h-[44px] sm:min-h-[32px]"
          >
            Not now
          </button>
        </div>
      </div>

      {/* Progress bar for auto-dismiss */}
      <div className="h-0.5 mt-1 rounded-full overflow-hidden bg-[var(--twilight)]">
        <div
          className="h-full bg-[var(--coral)]/50"
          style={{
            width: "100%",
            animation: `shrinkWidth ${autoDismissMs}ms linear forwards`,
          }}
        />
      </div>

      {/* CSS keyframes injected via style tag */}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
            margin-top: 0;
          }
          to {
            opacity: 1;
            max-height: 8rem;
            margin-top: 0.75rem;
          }
        }
        @keyframes shrinkWidth {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}
