"use client";

interface ContributionPanelProps {
  onSuggest: () => void;
}

export default function ContributionPanel({ onSuggest }: ContributionPanelProps) {
  return (
    <div className="mb-6 p-4 rounded-xl border border-dashed border-[var(--coral)]/30 bg-[var(--coral)]/5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--coral)]/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--cream)]">Know a great spot?</p>
          <p className="text-xs text-[var(--muted)]">This curation is open for suggestions from anyone</p>
        </div>
        <button
          onClick={onSuggest}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-xs font-medium hover:bg-[var(--rose)] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Suggest
        </button>
      </div>
    </div>
  );
}
