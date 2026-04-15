"use client";

import type { ActionConfig } from "@/lib/detail/types";

interface DetailActionsProps {
  config: ActionConfig;
  accentColor: string;
}

export function DetailActions({ config }: DetailActionsProps) {
  const { primaryCTA, secondaryActions } = config;

  // First secondary goes in CTA row as circle button, rest go in actions row
  const ctaRowSecondary = secondaryActions[0];
  const actionsRowButtons = secondaryActions.slice(1);

  return (
    <div className="space-y-0">
      {/* CTA Row */}
      {primaryCTA && (
        <div className="flex items-center gap-2.5 px-4 pb-3">
          {primaryCTA.href ? (
            <a
              href={primaryCTA.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 flex items-center justify-center gap-2 h-[44px] rounded-[22px] text-sm font-semibold transition-colors duration-300 ${
                primaryCTA.variant === "filled"
                  ? "bg-[var(--coral)] text-white hover:opacity-90"
                  : "border border-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/50"
              }`}
            >
              {primaryCTA.icon}
              {primaryCTA.label}
            </a>
          ) : (
            <button
              onClick={primaryCTA.onClick}
              className={`flex-1 flex items-center justify-center gap-2 h-[44px] rounded-[22px] text-sm font-semibold transition-colors duration-300 ${
                primaryCTA.variant === "filled"
                  ? "bg-[var(--coral)] text-white hover:opacity-90"
                  : "border border-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/50"
              }`}
            >
              {primaryCTA.icon}
              {primaryCTA.label}
            </button>
          )}

          {/* First secondary as circle button in CTA row */}
          {ctaRowSecondary && (
            <button
              onClick={ctaRowSecondary.onClick}
              className="w-[44px] h-[44px] rounded-[22px] border border-[var(--twilight)] flex items-center justify-center text-[var(--soft)] hover:bg-[var(--twilight)]/50 transition-colors duration-300 flex-shrink-0"
              title={ctaRowSecondary.label}
            >
              {ctaRowSecondary.icon}
            </button>
          )}
        </div>
      )}

      {/* Actions Row - remaining secondary buttons */}
      {actionsRowButtons.length > 0 && (
        <div className="flex gap-2 justify-center px-4 pb-4">
          {actionsRowButtons.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className="w-10 h-10 rounded-xl border border-[var(--twilight)] flex items-center justify-center text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors duration-300"
              title={action.label}
            >
              {action.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
