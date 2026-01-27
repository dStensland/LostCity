"use client";

import { useState } from "react";
import { PREFERENCE_CATEGORIES, PREFERENCE_SUBCATEGORIES } from "@/lib/preferences";

interface SubcategoryPickerProps {
  selectedCategories: string[];
  onComplete: (subcategories: string[]) => void;
  onSkip: () => void;
}

export function SubcategoryPicker({ selectedCategories, onComplete, onSkip }: SubcategoryPickerProps) {
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);

  // Filter to only show subcategories for selected categories that have them
  const relevantCategories = selectedCategories.filter(
    (cat) => PREFERENCE_SUBCATEGORIES[cat]
  );

  const toggleSubcategory = (value: string) => {
    setSelectedSubcategories((prev) =>
      prev.includes(value)
        ? prev.filter((s) => s !== value)
        : [...prev, value]
    );
  };

  const handleContinue = () => {
    onComplete(selectedSubcategories);
  };

  // Get category label by value
  const getCategoryLabel = (value: string) => {
    const category = PREFERENCE_CATEGORIES.find((c) => c.value === value);
    return category?.label || value;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 py-8">
      <div className="w-full max-w-lg animate-fadeIn">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--cream)] mb-2">
            Get more specific
          </h1>
          <p className="text-[var(--soft)] text-sm">
            Tell us what you love most
          </p>
        </div>

        {/* Subcategory chips grouped by category */}
        <div className="space-y-6 mb-8 max-h-[50vh] overflow-y-auto">
          {relevantCategories.map((categoryValue) => {
            const subcategories = PREFERENCE_SUBCATEGORIES[categoryValue];
            if (!subcategories) return null;

            return (
              <div key={categoryValue}>
                {/* Category header */}
                <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
                  {getCategoryLabel(categoryValue)}
                </h3>

                {/* Subcategory chips */}
                <div className="flex flex-wrap gap-2">
                  {subcategories.map((sub) => {
                    const isSelected = selectedSubcategories.includes(sub.value);
                    return (
                      <button
                        key={sub.value}
                        onClick={() => toggleSubcategory(sub.value)}
                        className={`px-4 py-2 rounded-full border-2 font-mono text-sm transition-all ${
                          isSelected
                            ? "border-[var(--coral)] bg-[var(--coral)]/10 text-[var(--cream)]"
                            : "border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--coral)]/50 hover:text-[var(--cream)]"
                        }`}
                      >
                        {sub.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleContinue}
            className={`w-full py-3 px-6 rounded-xl font-mono text-sm transition-all ${
              selectedSubcategories.length > 0
                ? "bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)]"
                : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/80"
            }`}
          >
            {selectedSubcategories.length > 0
              ? `Continue (${selectedSubcategories.length})`
              : "Continue without selecting"}
          </button>

          <button
            onClick={onSkip}
            className="w-full py-3 text-center font-mono text-sm text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
          >
            Skip this step
          </button>
        </div>
      </div>
    </div>
  );
}
