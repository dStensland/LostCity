"use client";

export type ExploreView = 'by-theater' | 'by-film' | 'schedule';

interface ViewToggleProps {
  view: ExploreView;
  onChange: (next: ExploreView) => void;
}

const OPTIONS: Array<{ id: ExploreView; label: string; disabled: boolean }> = [
  { id: 'by-theater', label: 'By Theater', disabled: false },
  { id: 'by-film', label: 'By Film', disabled: false },
  { id: 'schedule', label: 'Schedule', disabled: true },
];

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="View mode"
      className="inline-flex items-center gap-0 rounded-card border border-[var(--twilight)] bg-[var(--night)] p-0.5"
    >
      {OPTIONS.map((o) => {
        const isActive = o.id === view;
        const cls = o.disabled
          ? 'text-[var(--twilight)] cursor-not-allowed'
          : isActive
            ? 'bg-[var(--vibe)]/15 text-[var(--cream)]'
            : 'text-[var(--muted)] hover:text-[var(--cream)]';
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={isActive}
            disabled={o.disabled}
            onClick={() => !o.disabled && onChange(o.id)}
            className={`px-3 py-1.5 rounded-[calc(var(--radius-card)-2px)] font-mono text-xs uppercase tracking-[0.12em] transition-colors flex items-center gap-1.5 ${cls}`}
          >
            <span>{o.label}</span>
            {isActive && <span className="w-1 h-1 rounded-full bg-[var(--gold)]" aria-hidden />}
            {o.disabled && <span className="text-[0.6rem] text-[var(--muted)]">soon</span>}
          </button>
        );
      })}
    </div>
  );
}
