"use client";

import { useState, useEffect, type ReactNode } from "react";

export interface DetailStickyBarProps {
  onShare?: () => void;
  shareLabel?: string;
  secondaryActions?: ReactNode;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: ReactNode;
  };
  className?: string;
  scrollThreshold?: number;
}

export function DetailStickyBar({
  onShare,
  shareLabel = "Share",
  secondaryActions,
  primaryAction,
  className = "",
  scrollThreshold = 400,
}: DetailStickyBarProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > scrollThreshold);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrollThreshold]);

  const handleShare = async () => {
    if (onShare) {
      onShare();
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: document.title,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
      }
    } catch {
      // User cancelled or error - ignore
    }
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "translate-y-full"
      } ${className}`}
    >
      <div className="h-6 bg-gradient-to-t from-[var(--void)] to-transparent" />

      <div className="bg-[var(--void)]/95 backdrop-blur-md border-t border-[var(--twilight)] px-4 py-3 safe-area-bottom">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          {/* Share button */}
          {onShare !== undefined && (
            <button
              onClick={handleShare}
              className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg border border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--soft)] transition-colors"
              aria-label={shareLabel}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            </button>
          )}

          {/* Secondary actions */}
          {secondaryActions && (
            <div className="flex-shrink-0">{secondaryActions}</div>
          )}

          {/* Primary CTA */}
          {primaryAction && (
            primaryAction.href ? (
              <a
                href={primaryAction.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[var(--coral)] text-[var(--void)] font-semibold rounded-lg hover:bg-[var(--rose)] transition-all shadow-[0_0_20px_rgba(255,107,122,0.4)] hover:shadow-[0_0_30px_rgba(255,107,122,0.6)]"
              >
                {primaryAction.icon}
                {primaryAction.label}
              </a>
            ) : (
              <button
                onClick={primaryAction.onClick}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[var(--coral)] text-[var(--void)] font-semibold rounded-lg hover:bg-[var(--rose)] transition-all shadow-[0_0_20px_rgba(255,107,122,0.4)] hover:shadow-[0_0_30px_rgba(255,107,122,0.6)]"
              >
                {primaryAction.icon}
                {primaryAction.label}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
