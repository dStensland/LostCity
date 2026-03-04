export interface SectionHeaderProps {
  title: string;
  count?: number;
  /** "divider" (default) adds border-top + top padding. "inline" flows naturally within a card. */
  variant?: "divider" | "inline";
  className?: string;
}

export function SectionHeader({ title, count, variant = "divider", className = "" }: SectionHeaderProps) {
  return (
    <div className={`flex items-center gap-2.5 ${variant === "divider" ? "pt-6 border-t border-[var(--twilight)]/30" : ""} pb-3 ${className}`}>
      <h2 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
        {title}
      </h2>
      {count !== undefined && (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-2xs font-mono bg-[var(--twilight)]/75 text-[var(--cream)] border border-[var(--twilight)]">
          {count}
        </span>
      )}
    </div>
  );
}
