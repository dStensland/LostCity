"use client";

import { memo, type ReactNode } from "react";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlaceDetailShellProps {
  hero: ReactNode;
  identity: ReactNode;
  /** null when no hours data — status bar omitted entirely */
  statusBar: ReactNode | null;
  quickActions: ReactNode;
  /** Already-rendered section components; shell inserts 8px --night dividers between each */
  sections: ReactNode[];
  /** Mobile-only sticky bottom bar */
  bottomBar?: ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PlaceDetailShell = memo(function PlaceDetailShell({
  hero,
  identity,
  statusBar,
  quickActions,
  sections,
  bottomBar,
}: PlaceDetailShellProps) {
  return (
    <div className="min-h-[100dvh] bg-[var(--void)]">
      {/* Hero — full-bleed on desktop, edge-to-edge on mobile */}
      <div>{hero}</div>

      {/* Centered content column below hero */}
      <div className="lg:max-w-[896px] lg:mx-auto">
        {/* Identity */}
        <div>{identity}</div>

        {/* Status bar */}
        {statusBar}

        {/* Quick actions */}
        {quickActions}

        {/* Sections — separated by 8px --night divider strips */}
        {sections.map((section, i) => (
          <div key={i}>
            <div className="h-2 bg-[var(--night)]" />
            <div className="px-4 py-5 lg:px-8 lg:py-7">{section}</div>
          </div>
        ))}

        {/* Bottom spacing */}
        <div className="h-8 lg:h-16" />
      </div>

      {/* Mobile-only sticky bottom bar */}
      {bottomBar && <div className="lg:hidden">{bottomBar}</div>}
    </div>
  );
});

export type { PlaceDetailShellProps };
