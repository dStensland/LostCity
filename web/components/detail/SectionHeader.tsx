export interface SectionHeaderProps {
  title: string;
  count?: number;
  className?: string;
}

export function SectionHeader({ title, count, className = "" }: SectionHeaderProps) {
  return (
    <div className={`flex items-center gap-3 py-4 border-t border-[var(--twilight)] ${className}`}>
      <h2 className="font-mono text-[0.65rem] uppercase tracking-widest text-[var(--muted)]">
        {title}
      </h2>
      {count !== undefined && (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[0.6rem] font-mono bg-[var(--twilight)] text-[var(--soft)]">
          {count}
        </span>
      )}
    </div>
  );
}
