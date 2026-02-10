"use client";

export type HighlightsPeriod = "today" | "week" | "month";

const TABS: { key: HighlightsPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
];

interface HighlightsTabsProps {
  activePeriod: HighlightsPeriod;
  onChange: (period: HighlightsPeriod) => void;
}

export default function HighlightsTabs({ activePeriod, onChange }: HighlightsTabsProps) {
  return (
    <div className="flex gap-1 p-1 bg-[var(--night)] rounded-xl border border-[var(--twilight)]/30 mb-4">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex-1 px-3 py-2 rounded-lg font-mono text-xs font-medium transition-all duration-200 ${
            activePeriod === tab.key
              ? "bg-[var(--twilight)] text-[var(--neon-amber)] border border-[var(--neon-amber)]/20"
              : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
