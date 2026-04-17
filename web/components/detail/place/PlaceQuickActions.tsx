"use client";

import { memo, type ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuickAction {
  /** Phosphor icon element (size={18} weight="duotone" already applied by caller) */
  icon: ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  variant: "primary" | "secondary";
  /** aria-label for the button — falls back to label */
  ariaLabel?: string;
}

interface PlaceQuickActionsProps {
  actions: QuickAction[];
}

// ─── Component ────────────────────────────────────────────────────────────────

function ActionItem({ action }: { action: QuickAction }) {
  const isPrimary = action.variant === "primary";

  const buttonClass = [
    "w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 focus-ring",
    isPrimary
      ? "bg-[var(--coral)] text-[var(--void)] hover:brightness-110"
      : "bg-[var(--dusk)] text-[var(--soft)] hover:bg-[var(--twilight)]",
  ].join(" ");

  const labelClass = [
    "text-2xs text-center leading-tight mt-1.5 font-medium",
    isPrimary ? "text-[var(--coral)]" : "text-[var(--muted)]",
  ].join(" ");

  const content = (
    <div className="flex flex-col items-center min-w-0 flex-1">
      <button
        type="button"
        aria-label={action.ariaLabel ?? action.label}
        className={buttonClass}
        onClick={action.onClick}
      >
        {action.icon}
      </button>
      <span className={labelClass}>{action.label}</span>
    </div>
  );

  if (action.href) {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center min-w-0 flex-1 no-underline"
        aria-label={action.ariaLabel ?? action.label}
      >
        <span className={buttonClass} role="presentation">
          {action.icon}
        </span>
        <span className={labelClass}>{action.label}</span>
      </a>
    );
  }

  return content;
}

export const PlaceQuickActions = memo(function PlaceQuickActions({
  actions,
}: PlaceQuickActionsProps) {
  if (actions.length === 0) return null;

  return (
    <div className="px-4 py-3 lg:px-8 lg:py-4 flex justify-between gap-2.5">
      {actions.map((action, i) => (
        <ActionItem key={i} action={action} />
      ))}
    </div>
  );
});

export type { PlaceQuickActionsProps };
