import type { ReactNode } from "react";

interface DetailIdentityProps {
  children: ReactNode;
  variant?: "sidebar" | "elevated";
}

export function DetailIdentity({ children, variant = "sidebar" }: DetailIdentityProps) {
  if (variant === "elevated") {
    return (
      <div className="motion-fade-up" style={{ animationDelay: "100ms" }}>
        {children}
      </div>
    );
  }

  // Sidebar (current behavior — preserve exactly)
  return (
    <div className="px-5 py-4 border-b border-[var(--twilight)]/40 motion-fade-up" style={{ animationDelay: "100ms" }}>
      {children}
    </div>
  );
}
