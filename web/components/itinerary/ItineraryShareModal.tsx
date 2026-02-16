"use client";

import { useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";

interface ItineraryShareModalProps {
  shareUrl: string;
  title: string;
  open: boolean;
  onClose: () => void;
}

export default function ItineraryShareModal({
  shareUrl,
  title,
  open,
  onClose,
}: ItineraryShareModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  const handleShareText = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: title,
        text: `Check out my itinerary: ${title}`,
        url: shareUrl,
      }).catch(() => {
        // User cancelled
      });
    }
  }, [shareUrl, title]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm mx-4 bg-[var(--bg-primary,#1a1a2e)] rounded-2xl shadow-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-1">Share Itinerary</h3>
        <p className="text-sm text-white/50 mb-5">{title}</p>

        {/* QR Code */}
        <div className="flex justify-center mb-5">
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG value={shareUrl} size={160} level="M" />
          </div>
        </div>

        {/* Link input + copy */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            value={shareUrl}
            readOnly
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs truncate"
          />
          <button
            onClick={handleCopyLink}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
              copied
                ? "bg-green-500/20 text-green-300"
                : "bg-white/10 text-white hover:bg-white/15"
            }`}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {/* Share buttons */}
        <div className="flex gap-2">
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              onClick={handleShareText}
              className="flex-1 py-2.5 rounded-lg bg-[var(--accent,#f97316)] text-white text-sm font-medium hover:brightness-110 transition-all"
            >
              Share
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
