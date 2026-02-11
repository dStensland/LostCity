"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { usePortalOptional, DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";

interface ShareEventButtonProps {
  eventId: number;
  eventTitle: string;
  className?: string;
  /** "default" shows full button with text, "icon" shows compact icon-only button */
  variant?: "default" | "icon";
  /** Portal slug for constructing the correct share URL (auto-detected from context if not provided) */
  portalSlug?: string;
  /** Custom brand name for sharing text (Enterprise feature) */
  brandName?: string;
}

export default function ShareEventButton({
  eventId,
  eventTitle,
  className = "",
  variant = "default",
  portalSlug: portalSlugProp,
  brandName = "Lost City",
}: ShareEventButtonProps) {
  const { showToast } = useToast();
  const [isSharing, setIsSharing] = useState(false);
  const portalContext = usePortalOptional();

  // Use provided slug, or get from context, or fall back to default
  const portalSlug = portalSlugProp ?? portalContext?.portal?.slug ?? DEFAULT_PORTAL_SLUG;
  const attributionPortalSlug = portalSlugProp ?? portalContext?.portal?.slug ?? null;

  const trackShare = async (method: "native" | "clipboard") => {
    if (!attributionPortalSlug) return;

    await fetch(`/api/portals/${attributionPortalSlug}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: eventId,
        method,
      }),
    }).catch(() => {
      // Non-blocking analytics call.
    });
  };

  const handleShare = async () => {
    // Use portal-aware URL structure: /{portal}?event={id}
    const url = `${window.location.origin}/${portalSlug}?event=${eventId}`;
    const shareText = brandName === "Lost City"
      ? `Check out ${eventTitle} on Lost City`
      : `Check out ${eventTitle} on ${brandName}`;
    const shareData = {
      title: eventTitle,
      text: shareText,
      url,
    };

    setIsSharing(true);

    try {
      // Try native share API first (mobile)
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        void trackShare("native");
        showToast("Shared!");
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(url);
        void trackShare("clipboard");
        showToast("Link copied!");
      }
    } catch (error) {
      // User cancelled share or error occurred
      if ((error as Error).name !== "AbortError") {
        // Try clipboard as fallback
        try {
          await navigator.clipboard.writeText(url);
          void trackShare("clipboard");
          showToast("Link copied!");
        } catch {
          showToast("Failed to share", "error");
        }
      }
    } finally {
      setIsSharing(false);
    }
  };

  const isIcon = variant === "icon";

  return (
    <button
      onClick={handleShare}
      disabled={isSharing}
      aria-label="Share event"
      className={
        isIcon
          ? `inline-flex items-center justify-center min-w-[48px] min-h-[48px] p-3 text-[var(--muted)] rounded-lg hover:bg-[var(--twilight)] hover:text-[var(--cream)] hover:scale-110 transition-all disabled:opacity-50 active:scale-95 ${className}`
          : `inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[var(--muted)] text-sm font-medium rounded-lg hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors disabled:opacity-50 ${className}`
      }
    >
      <svg
        className={isIcon ? "w-5 h-5 icon-drop-shadow" : "w-4 h-4"}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
      {!isIcon && (isSharing ? "On it..." : "Spread the word")}
    </button>
  );
}
