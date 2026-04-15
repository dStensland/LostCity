import type { FC } from "react";

interface SectionHeaderProps {
  label: string;
  count?: number | null;
  icon?: FC<{ size?: number; className?: string }>;
}

export function SectionHeader({ label, count, icon: Icon }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon size={16} className="text-[var(--muted)]" />}
      <span className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--soft)]">
        {label}
      </span>
      {count != null && count > 0 && (
        <span className="font-mono text-xs bg-[var(--twilight)] text-[var(--muted)] px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </div>
  );
}
