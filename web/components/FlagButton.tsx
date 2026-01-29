"use client";

import { useState } from "react";

interface FlagButtonProps {
  entityType: "event" | "venue" | "organization" | "producer";
  entityId: number;
  entityName?: string;
  className?: string;
}

export default function FlagButton({
  entityType,
  entityId,
  entityName,
  className = "",
}: FlagButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError("Please describe the issue");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          message: message.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit");
      }

      setSubmitted(true);
      setMessage("");

      // Auto-close after showing success
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
      }, 2000);
    } catch {
      setError("Failed to submit flag. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (submitted) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--neon-green)]/20 border border-[var(--neon-green)]/40 text-[var(--neon-green)] text-sm ${className}`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="font-mono text-xs">Flagged for review</span>
      </div>
    );
  }

  // Collapsed state - just the flag button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--neon-amber)] hover:bg-[var(--twilight)]/50 transition-all text-sm ${className}`}
        title="Report an issue"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
        <span className="font-mono text-xs hidden sm:inline">Flag issue</span>
      </button>
    );
  }

  // Expanded state - show the form
  return (
    <div className={`rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] p-4 ${className}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h4 className="font-mono text-xs font-medium text-[var(--cream)] uppercase tracking-wider">
            Flag Issue
          </h4>
          {entityName && (
            <p className="text-xs text-[var(--muted)] mt-0.5 truncate max-w-[200px]">
              {entityName}
            </p>
          )}
        </div>
        <button
          onClick={() => {
            setIsOpen(false);
            setMessage("");
            setError(null);
          }}
          className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What's wrong? (e.g., wrong date, closed venue, duplicate event...)"
        className="w-full px-3 py-2 rounded-lg bg-[var(--void)] border border-[var(--twilight)] text-[var(--cream)] placeholder-[var(--muted)] text-sm resize-none focus:outline-none focus:border-[var(--coral)] transition-colors"
        rows={3}
        maxLength={500}
      />

      {error && (
        <p className="text-xs text-[var(--neon-red)] mt-2">{error}</p>
      )}

      <div className="flex items-center justify-between mt-3">
        <span className="text-[0.6rem] text-[var(--muted)] font-mono">
          {message.length}/500
        </span>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !message.trim()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium hover:bg-[var(--rose)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <>
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Submitting...
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Submit Flag
            </>
          )}
        </button>
      </div>
    </div>
  );
}
