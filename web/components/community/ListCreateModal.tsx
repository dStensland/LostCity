"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import type { Curation } from "@/lib/curation-utils";
import { CATEGORY_OPTIONS, CATEGORY_ICONS } from "@/lib/curation-constants";

interface ListCreateModalProps {
  portalId: string;
  portalSlug: string;
  onClose: () => void;
  onCreated: (list: Curation) => void;
}

export default function ListCreateModal({
  portalId,
  portalSlug,
  onClose,
  onCreated,
}: ListCreateModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const trapRef = useFocusTrap<HTMLDivElement>();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [allowContributions, setAllowContributions] = useState(false);
  const [saving, setSaving] = useState(false);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast("Please enter a title", "error");
      return;
    }

    if (!category) {
      showToast("Please select a category", "error");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portal_id: portalId,
          title: title.trim(),
          description: description.trim() || null,
          category,
          is_public: isPublic,
          allow_contributions: allowContributions,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create curation");
      }

      const data = await res.json();
      showToast("Curation created! Now add some items.");
      onCreated(data.list);
      // Navigate to the new list page
      router.push(`/${portalSlug}/curations/${data.list.slug}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create curation", "error");
    } finally {
      setSaving(false);
    }
  };

  const canProceed = step === 1 ? category : title.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Create curation">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--void)]/80 backdrop-blur-sm modal-backdrop-enter"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={trapRef}
        data-category={category || "other"}
        className="relative w-full max-w-md bg-[var(--dusk)] border rounded-xl shadow-2xl overflow-hidden list-create-modal modal-content-enter"
      >
        {/* Gradient header */}
        <div
          className="absolute top-0 left-0 right-0 h-24 opacity-20 list-create-header"
        />

        {/* Header */}
        <div className="relative flex items-center justify-between p-4 border-b border-[var(--twilight)]">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="p-1 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-[var(--cream)]">Create Curation</h2>
              <p className="text-xs text-[var(--muted)]">
                Step {step} of 2 — {step === 1 ? "Pick a category" : "Name your curation"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close create modal"
            className="p-3 min-w-[48px] min-h-[48px] text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] rounded-lg hover:scale-110 transition-all active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 px-4 pt-4">
          <div
            className={`flex-1 h-1 rounded-full transition-colors ${
              step >= 1 ? "bg-[var(--category-color,var(--twilight))]" : "bg-[var(--twilight)]"
            }`}
          />
          <div
            className={`flex-1 h-1 rounded-full transition-colors ${
              step >= 2 ? "bg-[var(--category-color,var(--twilight))]" : "bg-[var(--twilight)]"
            }`}
          />
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="relative p-4">
          {/* Step 1: Category Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--soft)]">
                What kind of list is this? Pick a category that best describes your recommendations.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_OPTIONS.map((cat) => {
                  const isSelected = category === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      data-category={cat.value}
                      className={`p-3 rounded-xl text-left transition-all border ${
                        isSelected
                          ? "ring-2 ring-offset-2 ring-offset-[var(--dusk)] bg-[color-mix(in_srgb,var(--category-color)_20%,transparent)] border-[var(--category-color)] ring-[var(--category-color)]"
                          : "hover:bg-[var(--night)] bg-[var(--night)] border-[var(--twilight)]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center list-category-icon"
                        >
                          {CATEGORY_ICONS[cat.value]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`font-mono text-xs font-medium ${
                              isSelected ? "text-[var(--category-color)]" : "text-[var(--cream)]"
                            }`}
                          >
                            {cat.label}
                          </div>
                          <div className="text-[10px] text-[var(--muted)] line-clamp-1">
                            {cat.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Title & Description */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Selected category preview */}
              {category && (
                <div
                  data-category={category}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[color-mix(in_srgb,var(--category-color)_20%,transparent)]"
                >
                  <span className="text-[var(--category-color)]">
                    {CATEGORY_ICONS[category]}
                  </span>
                  <span className="text-sm font-mono text-[var(--category-color)]">
                    {CATEGORY_OPTIONS.find((c) => c.value === category)?.label}
                  </span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Best Coffee Shops in Midtown"
                  className={`w-full px-3 py-2.5 bg-[var(--night)] border rounded-lg text-[var(--cream)] placeholder-[var(--muted)] focus:outline-none transition-colors ${
                    title.trim() ? "border-[var(--category-color)]" : "border-[var(--twilight)]"
                  }`}
                  maxLength={100}
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-2">
                  Description <span className="opacity-50">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What makes this list special?"
                  rows={2}
                  className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded-lg text-[var(--cream)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--coral)] resize-none"
                  maxLength={500}
                />
              </div>

              {/* Public toggle */}
              <div className="flex items-center justify-between py-2 px-3 bg-[var(--night)] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--twilight)] flex items-center justify-center">
                    {isPublic ? (
                      <svg className="w-4 h-4 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-[var(--cream)]">
                      {isPublic ? "Public list" : "Private list"}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {isPublic ? "Anyone can view and vote" : "Only you can see this"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPublic(!isPublic)}
                  role="switch"
                  aria-checked={isPublic}
                  aria-label="Toggle public visibility"
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    isPublic ? "bg-[var(--coral)]" : "bg-[var(--twilight)]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      isPublic ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              {/* Allow contributions toggle */}
              {isPublic && (
                <div className="flex items-center justify-between py-2 px-3 bg-[var(--night)] rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--twilight)] flex items-center justify-center">
                      {allowContributions ? (
                        <svg className="w-4 h-4 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-[var(--cream)]">
                        Allow contributions
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        Others can add items to this list
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAllowContributions(!allowContributions)}
                    role="switch"
                    aria-checked={allowContributions}
                    aria-label="Toggle allow contributions"
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      allowContributions ? "bg-[var(--coral)]" : "bg-[var(--twilight)]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        allowContributions ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={step === 1 ? onClose : () => setStep(1)}
              className="flex-1 px-4 py-2.5 bg-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-sm hover:bg-[var(--twilight)]/80 transition-colors"
            >
              {step === 1 ? "Cancel" : "Back"}
            </button>
            {step === 1 ? (
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canProceed}
                className={`flex-1 px-4 py-2.5 rounded-lg font-mono text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed list-create-action ${
                  canProceed ? "list-create-action-primary" : "list-create-action-disabled"
                }`}
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg font-mono text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed list-create-action list-create-action-primary"
              >
                {saving ? "Creating..." : "Create Curation"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
