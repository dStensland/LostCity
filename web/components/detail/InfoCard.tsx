import { type ReactNode } from "react";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

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
  const accentClass = createCssVarClass("--info-accent", accentColor, "info-card");

  return (
    <>
      <ScopedStyles css={accentClass?.css} />
      <div
        className={`rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] p-6 sm:p-8 info-card ${
          accentClass?.className ?? ""
        } ${className}`}
      >
        {children}
      </div>
    </>
  );
}
