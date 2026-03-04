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
        className={`relative overflow-hidden rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)] p-5 sm:p-7 info-card ${
          accentClass?.className ?? ""
        } ${className}`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-50"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--info-accent) 65%, transparent) 48%, transparent 100%)",
          }}
        />
        {children}
      </div>
    </>
  );
}
