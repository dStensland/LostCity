"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface SubmitEventModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalState = "form" | "success";

export default function SubmitEventModal({ isOpen, onClose }: SubmitEventModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [modalState, setModalState] = useState<ModalState>("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [eventName, setEventName] = useState("");
  const [date, setDate] = useState("");
  const [venueLocation, setVenueLocation] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");

  const resetForm = useCallback(() => {
    setEventName("");
    setDate("");
    setVenueLocation("");
    setDescription("");
    setEmail("");
    setWebsite("");
    setError(null);
    setSubmitting(false);
    setModalState("form");
  }, []);

  // Focus trap, escape key, body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    firstInputRef.current?.focus();
    document.body.style.overflow = "hidden";

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) {
        onClose();
        return;
      }

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
  }, [isOpen, submitting, onClose]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !submitting) {
        onClose();
      }
    },
    [submitting, onClose]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/contact-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "event",
          eventName: eventName.trim(),
          date: date.trim(),
          venueLocation: venueLocation.trim(),
          description: description.trim() || undefined,
          email: email.trim(),
          website: website.trim() || undefined,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to submit");
      }

      setModalState("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-event-title"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative max-w-lg w-full animate-in fade-in scale-in">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-[var(--muted)] hover:text-[var(--cream)] transition-colors p-1"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div
          ref={modalRef}
          className="bg-[var(--night)] border border-[var(--twilight)] rounded-xl p-6 w-full shadow-2xl max-h-[85vh] overflow-y-auto"
        >
          {modalState === "success" ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--neon-green)]/20 border-2 border-[var(--neon-green)]/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-[var(--neon-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[var(--cream)] mb-2">
                Thanks for the tip!
              </h2>
              <p className="text-[var(--soft)] mb-6">
                We&apos;ll review your event submission and reach out if we have questions.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <h2 id="submit-event-title" className="text-xl font-semibold text-[var(--cream)] mb-2">
                Submit an Event
              </h2>
              <p className="text-sm text-[var(--soft)] mb-4">
                Know of an event we should add? Let us know the details.
              </p>

              {/* Info box */}
              <div className="p-3 rounded-lg bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/20 mb-5">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-[var(--neon-cyan)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-[var(--soft)]">
                    We&apos;re working directly with event organizers to build a better submission system. If you&apos;re an organizer, we&apos;d love to chat &mdash; include your details above and we&apos;ll reach out.
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)] text-[var(--coral)] font-mono text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    Event Name *
                  </label>
                  <input
                    ref={firstInputRef}
                    type="text"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="Summer Music Festival"
                    className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] placeholder:text-[var(--muted)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                    required
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    Date *
                  </label>
                  <input
                    type="text"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    placeholder="March 15, 2025 or Every Friday"
                    className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] placeholder:text-[var(--muted)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                    required
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    Venue / Location *
                  </label>
                  <input
                    type="text"
                    value={venueLocation}
                    onChange={(e) => setVenueLocation(e.target.value)}
                    placeholder="The Tabernacle, Atlanta"
                    className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] placeholder:text-[var(--muted)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                    required
                    maxLength={300}
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell us more about the event..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] placeholder:text-[var(--muted)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors resize-none"
                    maxLength={2000}
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    Your Email *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] placeholder:text-[var(--muted)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                    required
                    maxLength={255}
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    Website
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] placeholder:text-[var(--muted)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-lg font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !eventName.trim() || !date.trim() || !venueLocation.trim() || !email.trim()}
                    className="flex-1 py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Submitting..." : "Submit Event"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return null;
}
