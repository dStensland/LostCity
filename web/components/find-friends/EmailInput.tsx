"use client";

import { useState } from "react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailInputProps {
  onSubmit: (emails: string[]) => void;
  isLoading: boolean;
}

export function EmailInput({ onSubmit, isLoading }: EmailInputProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);

    // Parse emails from text: split by commas, newlines, spaces, semicolons
    const raw = text
      .split(/[,;\n\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const valid = raw.filter((e) => EMAIL_REGEX.test(e));
    const invalid = raw.filter((e) => !EMAIL_REGEX.test(e));

    if (valid.length === 0) {
      setError("No valid email addresses found. Paste emails separated by commas or newlines.");
      return;
    }

    if (valid.length > 100) {
      setError("Maximum 100 emails at a time.");
      return;
    }

    if (invalid.length > 0) {
      setError(`${invalid.length} invalid email${invalid.length !== 1 ? "s" : ""} skipped. Processing ${valid.length} valid email${valid.length !== 1 ? "s" : ""}.`);
    }

    onSubmit([...new Set(valid)]);
  };

  return (
    <div className="space-y-3">
      <label className="block text-[var(--soft)] font-mono text-xs uppercase tracking-wider">
        Paste email addresses
      </label>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        placeholder="friend@example.com, another@example.com&#10;Or paste one per line..."
        rows={4}
        className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--coral)]/50 transition-all font-mono text-sm resize-none"
        disabled={isLoading}
      />
      {error && (
        <p className="text-xs text-[var(--gold)] font-mono">{error}</p>
      )}
      <button
        onClick={handleSubmit}
        disabled={isLoading || !text.trim()}
        className="w-full sm:w-auto px-6 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <span className="w-4 h-4 border-2 border-[var(--void)] border-t-transparent rounded-full animate-spin" />
            Searching...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Find Friends
          </>
        )}
      </button>
    </div>
  );
}
