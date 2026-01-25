"use client";

import { MOODS, type MoodId } from "@/lib/moods";

interface MoodSelectorProps {
  selectedMood: MoodId | null;
  onMoodChange: (mood: MoodId | null) => void;
  className?: string;
}

export default function MoodSelector({
  selectedMood,
  onMoodChange,
  className = "",
}: MoodSelectorProps) {
  const handleMoodClick = (moodId: MoodId) => {
    // Toggle off if same mood clicked
    if (selectedMood === moodId) {
      onMoodChange(null);
    } else {
      onMoodChange(moodId);
    }
  };

  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-[var(--cream)]">
          I&apos;m feeling...
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {MOODS.map((mood) => {
          const isSelected = selectedMood === mood.id;
          return (
            <button
              key={mood.id}
              onClick={() => handleMoodClick(mood.id)}
              className={`
                px-3 py-1.5 rounded-full font-mono text-xs font-medium
                transition-all duration-200 flex items-center gap-1.5
                ${
                  isSelected
                    ? "text-[var(--void)] scale-105"
                    : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--dusk)]"
                }
              `}
              style={
                isSelected
                  ? {
                      backgroundColor: mood.color,
                      boxShadow: `0 0 15px ${mood.color}, 0 0 30px ${mood.color}50`,
                    }
                  : undefined
              }
              title={mood.description}
            >
              <span aria-hidden="true">{mood.emoji}</span>
              <span>{mood.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
