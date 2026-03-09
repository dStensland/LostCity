"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Copy, ShareNetwork } from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";

interface OutingShareModalProps {
  shareUrl: string;
  title: string;
  open: boolean;
  onClose: () => void;
}

export default function OutingShareModal({
  shareUrl,
  title,
  open,
  onClose,
}: OutingShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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

  const handleNativeShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title,
        text: `Check out my outing: ${title}`,
        url: shareUrl,
      }).catch(() => {
        // User cancelled
      });
    }
  }, [shareUrl, title]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-[var(--night)] border border-[var(--twilight)] rounded-xl p-6 max-w-sm w-full shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--twilight)] transition-colors"
          aria-label="Close"
        >
          <X size={16} weight="bold" className="text-[var(--muted)]" />
        </button>

        <h3 className="text-lg font-semibold text-[var(--cream)] mb-1">Share Outing</h3>
        <p className="text-sm text-[var(--muted)] mb-5 truncate">{title}</p>

        {/* QR Code */}
        <div className="flex justify-center mb-5">
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG value={shareUrl} size={160} level="M" />
          </div>
        </div>

        {/* Link + copy */}
        <div className="flex items-center gap-2 mb-5">
          <input
            type="text"
            value={shareUrl}
            readOnly
            className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-xs truncate focus:outline-none"
          />
          <button
            onClick={handleCopyLink}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-mono font-medium shrink-0 transition-all ${
              copied
                ? "bg-[var(--neon-green)]/15 text-[var(--neon-green)]"
                : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--dusk)]"
            }`}
          >
            <Copy size={14} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          {canNativeShare && (
            <button
              onClick={handleNativeShare}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] text-sm font-mono font-medium hover:brightness-110 transition-all"
            >
              <ShareNetwork size={16} />
              Share
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-[var(--twilight)] text-[var(--cream)] text-sm font-mono hover:bg-[var(--dusk)] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
