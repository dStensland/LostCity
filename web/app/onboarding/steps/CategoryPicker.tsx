"use client";

import { useState } from "react";
import { PREFERENCE_CATEGORIES } from "@/lib/preferences";

interface CategoryPickerProps {
  onComplete: (categories: string[]) => void;
  onSkip: () => void;
}

export function CategoryPicker({ onComplete, onSkip }: CategoryPickerProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const toggleCategory = (value: string) => {
    setSelectedCategories((prev) =>
      prev.includes(value)
        ? prev.filter((c) => c !== value)
        : [...prev, value]
    );
  };

  const handleContinue = () => {
    onComplete(selectedCategories);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 py-8">
      <div className="w-full max-w-lg animate-fadeIn">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--cream)] mb-2">
            What are you into?
          </h1>
          <p className="text-[var(--soft)] text-sm">
            Pick your favorites (or skip to see everything)
          </p>
        </div>

        {/* Category grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {PREFERENCE_CATEGORIES.map((category) => {
            const isSelected = selectedCategories.includes(category.value);
            return (
              <button
                key={category.value}
                onClick={() => toggleCategory(category.value)}
                className={`group relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  isSelected
                    ? "border-[var(--coral)] bg-[var(--coral)]/10"
                    : "border-[var(--twilight)] bg-[var(--dusk)]/50 hover:border-[var(--coral)]/50"
                }`}
              >
                {/* Emoji */}
                <span className="text-2xl mb-2 block">
                  {category.emoji}
                </span>

                {/* Label */}
                <h3 className="font-mono text-sm text-[var(--cream)]">
                  {category.label}
                </h3>

                {/* Check indicator */}
                <div
                  className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? "border-[var(--coral)] bg-[var(--coral)]"
                      : "border-[var(--twilight)]"
                  }`}
                >
                  {isSelected && (
                    <svg
                      className="w-3 h-3 text-[var(--void)]"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleContinue}
            disabled={selectedCategories.length === 0}
            className={`w-full py-3 px-6 rounded-xl font-mono text-sm transition-all ${
              selectedCategories.length > 0
                ? "bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)]"
                : "bg-[var(--twilight)] text-[var(--muted)] cursor-not-allowed"
            }`}
          >
            Continue{selectedCategories.length > 0 && ` (${selectedCategories.length})`}
          </button>

          <button
            onClick={onSkip}
            className="w-full py-3 text-center font-mono text-sm text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
          >
            Skip — show me everything
          </button>
        </div>
      </div>
    </div>
  );
}
