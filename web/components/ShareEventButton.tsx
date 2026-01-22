"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";

interface ShareEventButtonProps {
  eventId: number;
  eventTitle: string;
  className?: string;
}

export default function ShareEventButton({
  eventId,
  eventTitle,
  className = "",
}: ShareEventButtonProps) {
  const { showToast } = useToast();
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/events/${eventId}`;
    const shareData = {
      title: eventTitle,
      text: `Check out ${eventTitle} on Lost City`,
      url,
    };

    setIsSharing(true);

    try {
      // Try native share API first (mobile)
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        showToast("Shared!");
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(url);
        showToast("Link copied!");
      }
    } catch (error) {
      // User cancelled share or error occurred
      if ((error as Error).name !== "AbortError") {
        // Try clipboard as fallback
        try {
          await navigator.clipboard.writeText(url);
          showToast("Link copied!");
        } catch {
          showToast("Failed to share", "error");
        }
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={isSharing}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[var(--muted)] text-sm font-medium rounded-lg hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors disabled:opacity-50 ${className}`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
      {isSharing ? "Sharing..." : "Share"}
    </button>
  );
}
