"use client";

import { useState } from "react";
import { PREFERENCE_NEIGHBORHOODS } from "@/lib/preferences";

interface NeighborhoodPickerProps {
  onComplete: (neighborhoods: string[]) => void;
  onSkip: () => void;
}

export function NeighborhoodPicker({ onComplete, onSkip }: NeighborhoodPickerProps) {
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([]);

  const toggleNeighborhood = (value: string) => {
    setSelectedNeighborhoods((prev) =>
      prev.includes(value)
        ? prev.filter((n) => n !== value)
        : [...prev, value]
    );
  };

  const handleContinue = () => {
    onComplete(selectedNeighborhoods);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 py-8">
      <div className="w-full max-w-lg animate-fadeIn">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--cream)] mb-2">
            Where do you hang out?
          </h1>
          <p className="text-[var(--soft)] text-sm">
            Pick your favorite neighborhoods
          </p>
        </div>

        {/* Neighborhood chips */}
        <div className="flex flex-wrap gap-2 justify-center mb-8 max-h-[45vh] overflow-y-auto">
          {PREFERENCE_NEIGHBORHOODS.map((neighborhood) => {
            const isSelected = selectedNeighborhoods.includes(neighborhood);
            return (
              <button
                key={neighborhood}
                onClick={() => toggleNeighborhood(neighborhood)}
                className={`px-4 py-2 rounded-full border-2 font-mono text-sm transition-all ${
                  isSelected
                    ? "border-[var(--coral)] bg-[var(--coral)]/10 text-[var(--cream)]"
                    : "border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--coral)]/50 hover:text-[var(--cream)]"
                }`}
              >
                {neighborhood}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleContinue}
            className={`w-full py-3 px-6 rounded-xl font-mono text-sm transition-all ${
              selectedNeighborhoods.length > 0
                ? "bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)]"
                : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/80"
            }`}
          >
            {selectedNeighborhoods.length > 0
              ? `Finish (${selectedNeighborhoods.length})`
              : "Finish without selecting"}
          </button>

          <button
            onClick={onSkip}
            className="w-full py-3 text-center font-mono text-sm text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
          >
            Surprise me — all neighborhoods
          </button>
        </div>
      </div>
    </div>
  );
}
