"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { ShareNetwork } from "@phosphor-icons/react";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

export interface DetailStickyBarProps {
  onShare?: () => void | Promise<void>;
  shareLabel?: string;
  showShareButton?: boolean;
  shareTracking?: {
    portalSlug: string;
    eventId: number;
  };
  secondaryActions?: ReactNode;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: ReactNode;
  };
  /** "filled" = coral/colored bg (transactions). "outlined" = border-only (navigation). */
  primaryVariant?: "filled" | "outlined";
  primaryColor?: string;
  className?: string;
  containerClassName?: string;
  scrollThreshold?: number;
}

const ICON_BTN =
  "flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--soft)] hover:bg-[var(--dusk)] active:scale-95 transition-all";

export function DetailStickyBar({
  onShare,
  shareLabel = "Share",
  showShareButton = false,
  shareTracking,
  secondaryActions,
  primaryAction,
  primaryVariant = "filled",
  primaryColor,
  className = "",
  containerClassName = "max-w-3xl",
  scrollThreshold = 300,
}: DetailStickyBarProps) {
  const [isVisible, setIsVisible] = useState(false);

  const ctaColorClass = useMemo(
    () => primaryColor ? createCssVarClass("--cta-color", primaryColor, "sticky-cta") : null,
    [primaryColor]
  );

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > scrollThreshold);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrollThreshold]);

  const trackEventShare = async (method: "native" | "clipboard" | "unknown") => {
    if (!shareTracking) return;

    await fetch(`/api/portals/${shareTracking.portalSlug}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: shareTracking.eventId,
        method,
      }),
    }).catch(() => {
      // Non-blocking analytics call.
    });
  };

  const handleShare = async () => {
    let shareMethod: "native" | "clipboard" | "unknown" | null = null;

    if (onShare) {
      await onShare();
      shareMethod = "unknown";
    } else {
      if (navigator.share) {
        await navigator.share({
          title: document.title,
          url: window.location.href,
        });
        shareMethod = "native";
      } else {
        await navigator.clipboard.writeText(window.location.href);
        shareMethod = "clipboard";
      }
    }

    if (shareMethod) {
      void trackEventShare(shareMethod);
    }
  };

  const ctaBase = "ml-auto inline-flex items-center justify-center gap-2 px-5 min-h-[44px] text-sm font-semibold rounded-xl active:scale-95 transition-all";
  const ctaClass = primaryVariant === "outlined"
    ? `${ctaBase} border border-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)] hover:border-[var(--soft)] hover:bg-[var(--dusk)]`
    : `${ctaBase} ${ctaColorClass ? "bg-[var(--cta-color)]" : "bg-[var(--coral)]"} text-[var(--void)] hover:brightness-110`;

  return (
    <>
      {ctaColorClass && <ScopedStyles css={ctaColorClass.css} />}
      <div
        className={`fixed bottom-3 sm:bottom-5 left-0 right-0 z-50 px-4 transition-all duration-300 ${
          isVisible ? "translate-y-0 opacity-100" : "translate-y-[calc(100%+2rem)] opacity-0"
        } ${ctaColorClass?.className ?? ""} ${className}`}
      >
        <div
          className={`mx-auto bg-[var(--void)] backdrop-blur-md border border-[var(--twilight)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] safe-area-bottom ${containerClassName}`}
        >
          <div className="flex items-center gap-2 px-3 py-2.5">
            {/* Share button */}
            {showShareButton && (
              <button
                onClick={() => {
                  handleShare().catch(() => {
                    // User cancelled share or share failed.
                  });
                }}
                className={ICON_BTN}
                aria-label={shareLabel}
              >
                <ShareNetwork size={18} weight="light" />
              </button>
            )}

            {/* Secondary actions */}
            {secondaryActions && (
              <div className="flex shrink-0 items-center gap-1 [&>*]:shrink-0">
                {secondaryActions}
              </div>
            )}

            {/* Primary CTA — pushed right */}
            {primaryAction && (
              primaryAction.href ? (
                <a
                  href={primaryAction.href}
                  {...(primaryAction.href.startsWith("#") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                  className={ctaClass}
                  onClick={primaryAction.href.startsWith("#") ? (e) => {
                    e.preventDefault();
                    document.getElementById(primaryAction.href!.slice(1))?.scrollIntoView({ behavior: "smooth" });
                  } : undefined}
                >
                  {primaryAction.icon}
                  {primaryAction.label}
                </a>
              ) : (
                <button
                  onClick={primaryAction.onClick}
                  className={ctaClass}
                >
                  {primaryAction.icon}
                  {primaryAction.label}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}
