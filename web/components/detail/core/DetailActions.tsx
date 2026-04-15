"use client";

import type { ActionConfig } from "@/lib/detail/types";

interface DetailActionsProps {
  config: ActionConfig;
  accentColor: string;
}

export function DetailActions({ config }: DetailActionsProps) {
  const { primaryCTA, secondaryActions } = config;

  return (
    <div className="px-5 py-4 space-y-3">
      {/* Primary CTA */}
      {primaryCTA && (
        primaryCTA.href ? (
          <a
            href={primaryCTA.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-colors duration-300 min-h-[44px] flex items-center justify-center ${
              primaryCTA.variant === "filled"
                ? "bg-[var(--coral)] text-[var(--void)] hover:brightness-110"
                : "border border-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/50"
            }`}
          >
            {primaryCTA.label}
          </a>
        ) : (
          <button
            onClick={primaryCTA.onClick}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors duration-300 min-h-[44px] ${
              primaryCTA.variant === "filled"
                ? "bg-[var(--coral)] text-[var(--void)] hover:brightness-110"
                : "border border-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/50"
            }`}
          >
            {primaryCTA.label}
          </button>
        )
      )}

      {/* Secondary actions row */}
      {secondaryActions.length > 0 && (
        <div className="flex gap-2 justify-center">
          {secondaryActions.map((action, i) => (
            action.href ? (
              <a
                key={i}
                href={action.href}
                className="w-10 h-10 rounded-xl border border-[var(--twilight)] flex items-center justify-center text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors duration-300"
                title={action.label}
                aria-label={action.label}
              >
                {action.icon}
              </a>
            ) : (
              <button
                key={i}
                onClick={action.onClick}
                className="w-10 h-10 rounded-xl border border-[var(--twilight)] flex items-center justify-center text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors duration-300"
                title={action.label}
                aria-label={action.label}
              >
                {action.icon}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}
