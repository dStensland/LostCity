import { type ReactNode } from "react";

interface QuickActionLinkProps {
  href: string;
  icon: ReactNode;
  label: string;
  external?: boolean;
  /** Column layout: icon above label, for sidebar grid */
  compact?: boolean;
}

export function QuickActionLink({ href, icon, label, external = true, compact = false }: QuickActionLinkProps) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={
        compact
          ? "flex flex-col items-center justify-center gap-1 py-2 min-h-[44px] text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/30 rounded-lg text-xs font-mono transition-colors focus-ring"
          : "inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--soft)] hover:bg-[var(--twilight)] hover:text-[var(--cream)] rounded-full text-sm transition-colors focus-ring"
      }
    >
      {icon}
      {label}
    </a>
  );
}
