"use client";

import { ONBOARDING_MOODS, type OnboardingMood } from "@/lib/preferences";

interface MoodPickerProps {
  onSelect: (mood: OnboardingMood) => void;
  onSkip: () => void;
}

export function MoodPicker({ onSelect, onSkip }: MoodPickerProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 py-8">
      <div className="w-full max-w-md animate-fadeIn">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-2xl sm:text-3xl text-[var(--cream)] italic mb-2">
            What sounds good?
          </h1>
          <p className="text-[var(--soft)] text-sm">
            Pick a vibe to get started
          </p>
        </div>

        {/* Mood cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {ONBOARDING_MOODS.map((mood) => (
            <button
              key={mood.value}
              onClick={() => onSelect(mood.value)}
              className="group relative p-6 rounded-2xl border-2 border-[var(--twilight)] bg-[var(--dusk)]/50 hover:border-[var(--coral)] hover:bg-[var(--coral)]/10 transition-all duration-200 text-left"
            >
              {/* Emoji */}
              <span className="text-4xl mb-3 block group-hover:scale-110 transition-transform">
                {mood.emoji}
              </span>

              {/* Label */}
              <h3 className="font-mono text-lg text-[var(--cream)] mb-1">
                {mood.label}
              </h3>

              {/* Description */}
              <p className="text-xs text-[var(--muted)] line-clamp-2">
                {mood.description}
              </p>

              {/* Hover indicator */}
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full border-2 border-[var(--twilight)] group-hover:border-[var(--coral)] group-hover:bg-[var(--coral)] transition-all flex items-center justify-center">
                <svg
                  className="w-3 h-3 text-[var(--void)] opacity-0 group-hover:opacity-100 transition-opacity"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Skip option */}
        <button
          onClick={onSkip}
          className="w-full py-3 text-center font-mono text-sm text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
        >
          Show me everything
        </button>
      </div>
    </div>
  );
}
