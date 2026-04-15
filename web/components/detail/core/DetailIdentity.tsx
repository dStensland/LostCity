import type { ReactNode } from "react";

interface DetailIdentityProps {
  children: ReactNode;
}

export function DetailIdentity({ children }: DetailIdentityProps) {
  return (
    <div className="px-5 py-4 border-b border-[var(--twilight)]/40">
      {children}
    </div>
  );
}
