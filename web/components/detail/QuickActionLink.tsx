import { type ReactNode } from "react";

interface QuickActionLinkProps {
  href: string;
  icon: ReactNode;
  label: string;
  external?: boolean;
}

export function QuickActionLink({ href, icon, label, external = true }: QuickActionLinkProps) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] bg-white/5 backdrop-blur-sm border border-white/10 text-[var(--soft)] hover:bg-white/10 hover:text-[var(--cream)] rounded-full text-sm transition-colors focus-ring"
    >
      {icon}
      {label}
    </a>
  );
}
