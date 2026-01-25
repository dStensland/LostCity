"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

type Visibility = "public" | "private" | "unlisted";

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateCollectionModal({ isOpen, onClose }: CreateCollectionModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    // Focus the title input when modal opens
    titleInputRef.current?.focus();

    // Lock body scroll
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) {
        onClose();
        return;
      }

      // Focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
  }, [isOpen, loading, onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !loading) {
        onClose();
      }
    },
    [loading, onClose]
  );

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, visibility }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create collection");
      }

      router.push(`/collections/${data.collection.slug}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    const notLoggedInContent = (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-collection-title"
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative bg-[var(--night)] border border-[var(--twilight)] rounded-xl p-6 max-w-md w-full">
          <p className="text-[var(--soft)] text-center mb-4">
            You need to be logged in to create a collection.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-sm hover:bg-[var(--dusk)] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );

    if (typeof document !== "undefined") {
      return createPortal(notLoggedInContent, document.body);
    }
    return null;
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-collection-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-[var(--night)] border border-[var(--twilight)] rounded-xl p-6 max-w-md w-full shadow-2xl animate-in fade-in scale-in"
      >
        <h2 id="create-collection-title" className="text-xl font-semibold text-[var(--cream)] mb-6">
          Create Collection
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Title
            </label>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Favorite Events"
              className="w-full px-4 py-2.5 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-[var(--cream)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--neon-magenta)] transition-colors"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A curated list of..."
              rows={3}
              className="w-full px-4 py-2.5 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-[var(--cream)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--neon-magenta)] transition-colors resize-none"
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
              Visibility
            </label>
            <div className="flex gap-2">
              {(["public", "unlisted", "private"] as Visibility[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`flex-1 py-2 px-3 rounded-lg font-mono text-xs font-medium transition-all ${
                    visibility === v
                      ? "bg-[var(--neon-cyan)] text-[var(--void)] shadow-[0_0_10px_hsl(var(--neon-cyan-hsl)/0.4)]"
                      : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <p className="font-mono text-[0.65rem] text-[var(--muted)] mt-1.5">
              {visibility === "public" && "Anyone can find and view this collection"}
              {visibility === "unlisted" && "Only people with the link can view"}
              {visibility === "private" && "Only you can see this collection"}
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-[var(--neon-red)] font-mono">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-sm hover:bg-[var(--dusk)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 py-2.5 bg-[var(--neon-magenta)] text-white rounded-lg font-mono text-sm font-medium shadow-[0_0_15px_hsl(var(--neon-magenta-hsl)/0.4)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return null;
}
