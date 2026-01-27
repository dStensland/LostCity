import { type ReactNode } from "react";

export interface InfoCardProps {
  accentColor?: string;
  children: ReactNode;
  className?: string;
}

export function InfoCard({
  accentColor = "var(--coral)",
  children,
  className = "",
}: InfoCardProps) {
  return (
    <div
      className={`rounded-lg bg-[var(--card-bg)] p-6 sm:p-8 ${className}`}
      style={{
        borderLeft: `3px solid ${accentColor}`,
      }}
    >
      {children}
    </div>
  );
}
