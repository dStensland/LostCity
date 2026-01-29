"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { VISIBILITY_OPTIONS, DEFAULT_VISIBILITY, type Visibility } from "@/lib/visibility";

type RecommendButtonProps = {
  eventId?: number;
  venueId?: number;
  organizationId?: string; // New name (preferred)
  producerId?: string; // Legacy name (deprecated)
  size?: "sm" | "md";
  className?: string;
};

export default function RecommendButton({
  eventId,
  venueId,
  organizationId: organizationIdProp,
  producerId,
  size = "md",
  className = "",
}: RecommendButtonProps) {
  // Support both old and new prop names
  const organizationId = organizationIdProp || producerId;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isRecommended, setIsRecommended] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(DEFAULT_VISIBILITY);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!modalOpen) return;

    // Focus the textarea when modal opens
    textareaRef.current?.focus();

    // Lock body scroll
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !actionLoading) {
        setModalOpen(false);
        return;
      }

      // Focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
  }, [modalOpen, actionLoading]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !actionLoading) {
        setModalOpen(false);
      }
    },
    [actionLoading]
  );

  // Load existing recommendation via API
  useEffect(() => {
    let cancelled = false;

    async function loadRecommendation() {
      if (authLoading) {
        return;
      }

      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      if (!eventId && !venueId && !organizationId) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (eventId) params.set("eventId", eventId.toString());
        else if (venueId) params.set("venueId", venueId.toString());
        else if (organizationId) params.set("organizationId", organizationId);

        const res = await fetch(`/api/recommend?${params.toString()}`);
        const data = await res.json();

        if (!cancelled) {
          setIsRecommended(data.isRecommended || false);
          if (data.note) setNote(data.note);
          if (data.visibility) setVisibility(data.visibility as Visibility);
        }
      } catch (err) {
        console.error("Error loading recommendation:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRecommendation();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, eventId, venueId, organizationId]);

  const handleClick = () => {
    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    if (isRecommended) {
      // Show modal to edit/remove
      setModalOpen(true);
    } else {
      // Show modal to add
      setNote("");
      setModalOpen(true);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    setActionLoading(true);

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          venueId,
          organizationId,
          action: "save",
          note: note.trim() || null,
          visibility,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setIsRecommended(true);
        setModalOpen(false);
      } else {
        console.error("Recommendation submit error:", data.error);
      }
    } catch (err) {
      console.error("Recommendation submit exception:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!user) return;

    setActionLoading(true);

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          venueId,
          organizationId,
          action: "remove",
        }),
      });

      const data = await res.json();

      if (data.success) {
        setIsRecommended(false);
        setNote("");
        setModalOpen(false);
      } else {
        console.error("Remove recommendation error:", data.error);
      }
    } catch (err) {
      console.error("Recommendation remove exception:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };

  const isDisabled = loading;

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`font-mono font-medium rounded-lg transition-colors flex items-center gap-2 ${sizeClasses[size]} ${
          isRecommended
            ? "bg-[var(--rose)] text-[var(--void)]"
            : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
        } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      >
        <svg
          className="w-4 h-4"
          fill={isRecommended ? "currentColor" : "none"}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
        {isRecommended ? "Recommended" : "Recommend"}
      </button>

      {/* Modal */}
      {modalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="recommend-modal-title"
        >
          <div
            ref={modalRef}
            className="w-full max-w-md bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl shadow-2xl animate-in fade-in scale-in"
          >
            <div className="p-4 border-b border-[var(--twilight)]">
              <h3 id="recommend-modal-title" className="text-lg font-semibold text-[var(--cream)]">
                {isRecommended ? "Edit Recommendation" : "Add Recommendation"}
              </h3>
            </div>

            <div className="p-4 space-y-4">
              {/* Note */}
              <div>
                <label htmlFor="recommend-note" className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  Note (optional)
                </label>
                <textarea
                  id="recommend-note"
                  ref={textareaRef}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why do you recommend this?"
                  rows={3}
                  maxLength={280}
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors resize-none"
                />
                <p className="mt-1 font-mono text-[0.6rem] text-[var(--muted)] text-right">
                  {note.length}/280
                </p>
              </div>

              {/* Visibility */}
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  Who can see this
                </label>
                <div className="flex gap-2">
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setVisibility(opt.value)}
                      type="button"
                      className={`flex-1 px-3 py-2.5 rounded-lg font-mono text-xs transition-colors ${
                        visibility === opt.value
                          ? "bg-[var(--coral)] text-[var(--void)]"
                          : "bg-[var(--night)] text-[var(--muted)] border border-[var(--twilight)] hover:text-[var(--cream)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--twilight)] flex gap-3">
              {isRecommended && (
                <button
                  onClick={handleRemove}
                  disabled={actionLoading}
                  type="button"
                  className="px-4 py-2.5 font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors disabled:opacity-50"
                >
                  Remove
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setModalOpen(false)}
                type="button"
                className="px-4 py-2.5 font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={actionLoading}
                type="button"
                className="px-4 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Saving..." : isRecommended ? "Update" : "Recommend"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
