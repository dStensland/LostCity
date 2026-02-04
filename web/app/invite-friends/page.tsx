"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

// Dynamic import QRCodeSVG to reduce initial bundle size
const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((m) => ({ default: m.QRCodeSVG })),
  { ssr: false }
);

export default function InviteFriendsPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [autoFriend, setAutoFriend] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  // Set origin on client side
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Need to set origin after mount
    setOrigin(window.location.origin);
  }, []);

  const baseUrl = profile?.username && origin
    ? `${origin}/invite/${profile.username}`
    : "";

  const inviteUrl = autoFriend ? `${baseUrl}?auto=1` : baseUrl;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      showToast("Link copied to clipboard!", "success");
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
      showToast("Link copied to clipboard!", "success");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Lost City",
          text: "Join me on Lost City - discover the best events happening in your city!",
          url: inviteUrl,
        });
      } catch {
        // User cancelled or share failed - fall back to copy
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  // Show loading only briefly - if no profile after origin loads, show anyway
  if (!origin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If profile not loaded yet, show a placeholder
  if (!profile?.username) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--cream)] mb-2">
            Invite Friends
          </h1>
          <p className="text-[var(--muted)] font-mono text-sm">
            Loading your invite link...
          </p>
        </div>
        <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl p-6 mb-6">
          <div className="flex justify-center">
            <div className="w-[200px] h-[200px] bg-[var(--twilight)] rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[var(--cream)] mb-2">
          Invite Friends
        </h1>
        <p className="text-[var(--muted)] font-mono text-sm">
          Share your personal invite link to connect with friends on Lost City.
        </p>
      </div>

      {/* QR Code */}
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl p-6 mb-6">
        <div className="flex justify-center mb-4">
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG
              value={inviteUrl}
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>
        </div>
        <p className="text-center text-[var(--muted)] font-mono text-xs">
          Scan to visit your invite link
        </p>
      </div>

      {/* URL Display */}
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl p-4 mb-6">
        <label className="block text-[var(--muted)] font-mono text-xs uppercase tracking-wider mb-2">
          Your Invite Link
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inviteUrl}
            readOnly
            className="flex-1 bg-[var(--night)] border border-[var(--twilight)] rounded-lg px-3 py-2.5 text-[var(--cream)] font-mono text-sm truncate"
          />
          <button
            onClick={handleCopy}
            className="px-4 py-2.5 bg-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-sm hover:bg-[var(--twilight)]/80 transition-colors flex-shrink-0"
            title="Copy link"
          >
            {copied ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl font-mono text-sm text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy Link
        </button>
        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[var(--coral)] text-[var(--void)] rounded-xl font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share
        </button>
      </div>

      {/* Auto-Friend Toggle */}
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <div className="relative flex-shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={autoFriend}
              onChange={(e) => setAutoFriend(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-[var(--twilight)] rounded-full peer-checked:bg-[var(--coral)] transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
          </div>
          <div>
            <span className="block text-[var(--cream)] font-medium text-sm">
              Automatically add as friend
            </span>
            <span className="block text-[var(--muted)] font-mono text-xs mt-1">
              Skip the friend request - they&apos;ll be added as a friend when they join.
            </span>
          </div>
        </label>
      </div>

      {/* Info */}
      <p className="text-center text-[var(--muted)] font-mono text-xs mt-6">
        When someone signs up using your link, you&apos;ll{" "}
        {autoFriend ? "automatically become friends" : "receive a friend request"}.
      </p>
    </div>
  );
}
