"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { VISIBILITY_OPTIONS, DEFAULT_VISIBILITY, type Visibility } from "@/lib/visibility";
import type { Database } from "@/lib/types";

type RecommendButtonProps = {
  eventId?: number;
  venueId?: number;
  producerId?: string;
  size?: "sm" | "md";
  className?: string;
};

type RecommendationRow = Database["public"]["Tables"]["recommendations"]["Row"];

export default function RecommendButton({
  eventId,
  venueId,
  producerId,
  size = "md",
  className = "",
}: RecommendButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();
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

  // Load existing recommendation
  useEffect(() => {
    async function loadRecommendation() {
      if (!user) {
        setLoading(false);
        return;
      }

      let query = supabase
        .from("recommendations")
        .select("*")
        .eq("user_id", user.id);

      if (eventId) {
        query = query.eq("event_id", eventId);
      } else if (venueId) {
        query = query.eq("venue_id", venueId);
      } else if (producerId) {
        query = query.eq("producer_id", producerId);
      }

      const { data } = await query.single();
      const rec = data as RecommendationRow | null;

      if (rec) {
        setIsRecommended(true);
        setNote(rec.note || "");
        setVisibility(rec.visibility as Visibility);
      }
      setLoading(false);
    }

    loadRecommendation();
  }, [user, eventId, venueId, producerId, supabase]);

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

    const recData: Record<string, unknown> = {
      user_id: user.id,
      note: note.trim() || null,
      visibility,
    };

    if (eventId) {
      recData.event_id = eventId;
    } else if (venueId) {
      recData.venue_id = venueId;
    } else if (producerId) {
      recData.producer_id = producerId;
    }

    if (isRecommended) {
      // Update existing
      let query = supabase
        .from("recommendations")
        .update({ note: note.trim() || null, visibility } as never)
        .eq("user_id", user.id);

      if (eventId) {
        query = query.eq("event_id", eventId);
      } else if (venueId) {
        query = query.eq("venue_id", venueId);
      } else if (producerId) {
        query = query.eq("producer_id", producerId);
      }

      await query;
    } else {
      // Create new
      await supabase.from("recommendations").insert(recData as never);
    }

    setIsRecommended(true);
    setModalOpen(false);
    setActionLoading(false);
  };

  const handleRemove = async () => {
    if (!user) return;

    setActionLoading(true);

    let query = supabase
      .from("recommendations")
      .delete()
      .eq("user_id", user.id);

    if (eventId) {
      query = query.eq("event_id", eventId);
    } else if (venueId) {
      query = query.eq("venue_id", venueId);
    } else if (producerId) {
      query = query.eq("producer_id", producerId);
    }

    await query;

    setIsRecommended(false);
    setNote("");
    setModalOpen(false);
    setActionLoading(false);
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };

  if (loading) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-lg bg-[var(--twilight)] animate-pulse ${className}`}
        style={{ width: size === "sm" ? 90 : 110 }}
      />
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`font-mono font-medium rounded-lg transition-colors flex items-center gap-2 ${sizeClasses[size]} ${
          isRecommended
            ? "bg-[var(--rose)] text-[var(--void)]"
            : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
        } ${className}`}
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
