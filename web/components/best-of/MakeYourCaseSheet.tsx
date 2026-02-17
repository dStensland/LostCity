"use client";

import { useState, useRef, useEffect } from "react";
import { CASE_MIN_LENGTH, CASE_MAX_LENGTH } from "@/lib/best-of";

interface MakeYourCaseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (content: string) => Promise<void>;
  venueName: string;
  categoryName: string;
  accentColor: string;
  existingContent?: string;
}

export default function MakeYourCaseSheet({
  isOpen,
  onClose,
  onSubmit,
  venueName,
  categoryName,
  accentColor,
  existingContent,
}: MakeYourCaseSheetProps) {
  const [content, setContent] = useState(existingContent ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setContent(existingContent ?? "");
      setError(null);
    }
  }, [isOpen, existingContent]);

  const charCount = content.trim().length;
  const isValid = charCount >= CASE_MIN_LENGTH && charCount <= CASE_MAX_LENGTH;

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(content.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 z-50 animate-fade-in" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div
          className="bg-[var(--night)] rounded-t-2xl max-w-lg mx-auto"
          style={{ borderTop: `2px solid ${accentColor}` }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-12 h-1.5 rounded-full bg-white/20" />
          </div>

          <div className="px-4 pb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--cream)]">Make Your Case</h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Why is <span className="text-[var(--cream)]">{venueName}</span>{" "}
                  {categoryName.toLowerCase().replace("best ", "").replace("the ", "")}?
                </p>
                <p className="text-[10px] font-mono text-[var(--muted)] mt-1 opacity-70">
                  {CASE_MIN_LENGTH}–{CASE_MAX_LENGTH} characters — make it count
                </p>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-[var(--muted)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tell us what makes this place special..."
              maxLength={CASE_MAX_LENGTH}
              rows={4}
              className="w-full px-3 py-2.5 bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl text-sm text-[var(--cream)] placeholder-[var(--muted)] resize-none focus:outline-none transition-all"
              style={{
                // Focus ring applied via JS below
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = `${accentColor}50`;
                e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}20`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--twilight)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />

            {/* Character counter + error */}
            <div className="flex items-center justify-between mt-2">
              <div className="text-xs text-[var(--muted)] font-mono">
                {error && <span className="text-red-400">{error}</span>}
              </div>
              <span
                className="text-xs font-mono transition-colors duration-200"
                style={{
                  color:
                    charCount > CASE_MAX_LENGTH
                      ? "#ef4444"
                      : charCount >= CASE_MIN_LENGTH
                        ? accentColor
                        : "var(--muted)",
                }}
              >
                {charCount}/{CASE_MAX_LENGTH}
              </span>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-mono font-medium transition-all"
              style={
                isValid && !isSubmitting
                  ? {
                      background: accentColor,
                      color: "var(--void)",
                      boxShadow: `0 0 12px ${accentColor}30`,
                    }
                  : {
                      background: "rgba(255,255,255,0.06)",
                      color: "var(--muted)",
                      cursor: "not-allowed",
                    }
              }
            >
              {isSubmitting ? "Submitting..." : existingContent ? "Update Your Case" : "Submit Your Case"}
            </button>

            {charCount < CASE_MIN_LENGTH && charCount > 0 && (
              <p className="text-xs text-[var(--muted)] text-center mt-2">
                {CASE_MIN_LENGTH - charCount} more characters needed
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
