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
    <div className="flex items-center rounded-full bg-[var(--void)]/70 border border-[var(--twilight)]/80 p-0.5">
      {views.map((view) => {
        const isActive = currentView === view.value;
        return (
          <button
            key={view.value}
            onClick={() => onViewChange(view.value)}
            className={`
              px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all duration-200
              ${isActive
                ? "bg-[var(--cream)] text-[var(--void)] shadow-[0_6px_16px_rgba(0,0,0,0.2)]"
                : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45"
              }
            `}
          >
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
