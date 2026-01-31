"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth-context";

type ShareInviteLinkProps = {
  className?: string;
  variant?: "button" | "icon";
  /** Custom brand name for sharing text (Enterprise feature) */
  brandName?: string;
  /** Custom city name for the sharing message */
  cityName?: string;
};

export default function ShareInviteLink({
  className = "",
  variant = "button",
  brandName = "Lost City",
  cityName = "Atlanta",
}: ShareInviteLinkProps) {
  const { user, profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const inviteUrl = profile?.username
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${profile.username}`
    : "";

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!showModal) return;

    // Focus the input when modal opens
    inputRef.current?.focus();
    inputRef.current?.select();

    // Lock body scroll
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowModal(false);
        return;
      }

      // Focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [showModal]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        setShowModal(false);
      }
    },
    []
  );

  if (!user || !profile) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = inviteUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        const shareTitle = brandName === "Lost City"
          ? "Join me on Lost City"
          : `Join me on ${brandName}`;
        const shareText = brandName === "Lost City"
          ? `Join me on Lost City - discover the best events happening in ${cityName}!`
          : `Join me on ${brandName} - discover the best events happening in ${cityName}!`;

        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: inviteUrl,
        });
      } catch {
        // User cancelled or share failed
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  const modalContent = showModal ? (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl p-6 max-w-md w-full shadow-2xl animate-in fade-in scale-in"
      >
        <h3 id="invite-modal-title" className="text-lg font-semibold text-[var(--cream)] mb-4">
          Invite Friends
        </h3>
        <p className="text-[var(--muted)] font-mono text-sm mb-4">
          Share your personal invite link with friends. When they sign up, you&apos;ll receive a friend request to connect!
        </p>

        <div className="flex gap-2 mb-4">
          <input
            ref={inputRef}
            type="text"
            value={inviteUrl}
            readOnly
            className="flex-1 bg-[var(--night)] border border-[var(--twilight)] rounded-lg px-3 py-2.5 text-[var(--cream)] font-mono text-sm"
          />
          <button
            onClick={handleCopy}
            className="px-4 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono font-medium text-sm hover:bg-[var(--rose)] transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <button
          onClick={() => setShowModal(false)}
          className="w-full py-2.5 text-[var(--muted)] hover:text-[var(--cream)] font-mono text-sm transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  ) : null;

  if (variant === "icon") {
    return (
      <>
        <button
          onClick={handleShare}
          className={`p-2.5 rounded-lg hover:bg-[var(--twilight)] transition-colors ${className}`}
          title="Invite friends"
          aria-label="Invite friends"
        >
          <svg
            className="w-5 h-5 text-[var(--cream)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
        </button>

        {showModal && typeof document !== "undefined" && createPortal(modalContent, document.body)}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleShare}
        className={`flex items-center gap-2 px-4 py-2.5 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg hover:bg-[var(--twilight)] transition-colors ${className}`}
      >
        <svg
          className="w-4 h-4 text-[var(--cream)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
        <span className="font-mono text-sm text-[var(--cream)]">Invite Friends</span>
      </button>

      {showModal && typeof document !== "undefined" && createPortal(modalContent, document.body)}
    </>
  );
}
