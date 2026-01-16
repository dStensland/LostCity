"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

type ShareInviteLinkProps = {
  className?: string;
  variant?: "button" | "icon";
};

export default function ShareInviteLink({
  className = "",
  variant = "button",
}: ShareInviteLinkProps) {
  const { user, profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const inviteUrl = profile?.username
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${profile.username}`
    : "";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowModal(false);
      }
    }

    if (showModal) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showModal]);

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
        await navigator.share({
          title: "Join me on Lost City",
          text: `Join me on Lost City - discover the best events happening in Atlanta!`,
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

  if (variant === "icon") {
    return (
      <>
        <button
          onClick={handleShare}
          className={`p-2 rounded-full hover:bg-[var(--charcoal)] transition-colors ${className}`}
          title="Invite friends"
        >
          <svg
            className="w-5 h-5 text-[var(--cream)]"
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
        </button>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div
              ref={modalRef}
              className="bg-[var(--charcoal)] rounded-lg p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-bold text-[var(--cream)] mb-4">
                Invite Friends
              </h3>
              <p className="text-[var(--clay)] text-sm mb-4">
                Share your personal invite link with friends
              </p>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="flex-1 bg-[var(--night)] border border-[var(--twilight)] rounded px-3 py-2 text-[var(--cream)] text-sm"
                />
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 bg-[var(--coral)] text-[var(--night)] rounded font-medium text-sm hover:opacity-90"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-full py-2 text-[var(--clay)] hover:text-[var(--cream)] text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={handleShare}
        className={`flex items-center gap-2 px-4 py-2 bg-[var(--charcoal)] border border-[var(--twilight)] rounded-lg hover:bg-[var(--twilight)] transition-colors ${className}`}
      >
        <svg
          className="w-4 h-4 text-[var(--cream)]"
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
        <span className="text-sm text-[var(--cream)]">Invite Friends</span>
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            ref={modalRef}
            className="bg-[var(--charcoal)] rounded-lg p-6 max-w-md w-full"
          >
            <h3 className="text-lg font-bold text-[var(--cream)] mb-4">
              Invite Friends
            </h3>
            <p className="text-[var(--clay)] text-sm mb-4">
              Share your personal invite link with friends. When they sign up,
              you&apos;ll receive a friend request to connect!
            </p>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={inviteUrl}
                readOnly
                className="flex-1 bg-[var(--night)] border border-[var(--twilight)] rounded px-3 py-2 text-[var(--cream)] text-sm"
              />
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-[var(--coral)] text-[var(--night)] rounded font-medium text-sm hover:opacity-90"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="w-full py-2 text-[var(--clay)] hover:text-[var(--cream)] text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
