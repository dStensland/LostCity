"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { VISIBILITY_OPTIONS, DEFAULT_VISIBILITY, type Visibility } from "@/lib/visibility";
import type { Database } from "@/lib/types";

type RecommendButtonProps = {
  eventId?: number;
  venueId?: number;
  size?: "sm" | "md";
  className?: string;
};

type RecommendationRow = Database["public"]["Tables"]["recommendations"]["Row"];

export default function RecommendButton({
  eventId,
  venueId,
  size = "md",
  className = "",
}: RecommendButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();
  const modalRef = useRef<HTMLDivElement>(null);

  const [isRecommended, setIsRecommended] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<Visibility>(DEFAULT_VISIBILITY);

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setModalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
  }, [user, eventId, venueId, supabase]);

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
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div
            ref={modalRef}
            className="w-full max-w-md bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-xl"
          >
            <div className="p-4 border-b border-[var(--twilight)]">
              <h3 className="font-mono text-sm font-medium text-[var(--cream)]">
                {isRecommended ? "Edit Recommendation" : "Add Recommendation"}
              </h3>
            </div>

            <div className="p-4 space-y-4">
              {/* Note */}
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                  Note (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why do you recommend this?"
                  rows={3}
                  maxLength={280}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--night)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors resize-none"
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
                      className={`flex-1 px-3 py-2 rounded-lg font-mono text-xs transition-colors ${
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
                  className="px-4 py-2 font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors disabled:opacity-50"
                >
                  Remove
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Saving..." : isRecommended ? "Update" : "Recommend"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
