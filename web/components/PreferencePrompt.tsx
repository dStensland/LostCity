"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
 */
export default function PreferencePrompt({
  category,
  categoryLabel,
  onAccept,
  onDismiss,
  autoDismissMs = 5000,
}: PreferencePromptProps) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss timer
  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      setVisible(false);
      markPromptDismissed(category);
      onDismiss();
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [visible, autoDismissMs, category, onDismiss]);

  const handleAccept = () => {
    setVisible(false);
    onAccept();
  };

  const handleDismiss = () => {
    setVisible(false);
    markPromptDismissed(category);
    onDismiss();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: "auto", marginTop: 12 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="overflow-hidden"
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
                className="px-3 py-1.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium hover:bg-[var(--rose)] transition-colors"
              >
                Yes please
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 rounded-lg bg-transparent text-[var(--muted)] font-mono text-xs hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors"
              >
                Not now
              </button>
            </div>
          </div>

          {/* Progress bar for auto-dismiss */}
          <div className="h-0.5 mt-1 rounded-full overflow-hidden bg-[var(--twilight)]">
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: autoDismissMs / 1000, ease: "linear" }}
              className="h-full bg-[var(--coral)]/50"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
