"use client";

export type CalendarView = "month" | "week" | "agenda";

interface CalendarViewToggleProps {
  currentView: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

const views: { value: CalendarView; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "agenda", label: "Agenda" },
];

export default function CalendarViewToggle({ currentView, onViewChange }: CalendarViewToggleProps) {
  return (
    <div className="flex items-center bg-[var(--deep-violet)] rounded-lg p-1">
      {views.map((view) => {
        const isActive = currentView === view.value;
        return (
          <button
            key={view.value}
            onClick={() => onViewChange(view.value)}
            className={`
              relative px-4 py-2 rounded-md font-mono text-xs font-medium transition-all duration-200
              ${isActive
                ? "bg-[var(--cosmic-blue)] text-[var(--neon-cyan)] shadow-[0_0_10px_rgba(0,212,232,0.3)]"
                : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight-purple)]/50"
              }
            `}
          >
            {view.label}
            {isActive && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--neon-cyan)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
