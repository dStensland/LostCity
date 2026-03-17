"use client";

import React, { type ReactNode } from "react";
import NeonBackButton from "@/components/detail/NeonBackButton";

interface DetailShellProps {
  /** Back button, share/save icons — spans full width above the columns */
  topBar?: ReactNode;
  /** Identity zone: hero, name, type, quick actions, hours, getting there, vibes, action buttons */
  sidebar?: ReactNode;
  /** Content zone: events/lineup (primary), about, signal, discovery */
  content: ReactNode;
  /** Optional bottom action bar (sticky on mobile) */
  bottomBar?: ReactNode;
  /** If topBar is not provided, render a default back button using this callback */
  onClose?: () => void;
  /** Single-column centered layout (for error/empty states) */
  singleColumn?: boolean;
}

/**
 * DetailShell — Two-zone layout for all detail pages.
 *
 * Desktop (≥1024px): 340px sticky sidebar + fluid scrollable content
 * Mobile (<1024px): stacked vertically (sidebar on top, content below)
 */
export default function DetailShell({
  topBar,
  sidebar,
  content,
  bottomBar,
  onClose,
  singleColumn = false,
}: DetailShellProps) {
  const resolvedTopBar = topBar ?? (onClose ? (
    <div className="flex items-center px-4 lg:px-6 py-3">
      <NeonBackButton onClose={onClose} floating={false} />
    </div>
  ) : null);

  if (singleColumn) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        {/* Top bar — always full width */}
        {resolvedTopBar}

        {/* Single-column centered content (error/empty states) */}
        <div className="flex-1 flex items-center justify-center">
          {content}
        </div>

        {/* Bottom action bar */}
        {bottomBar}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Top bar — always full width */}
      {resolvedTopBar}

      {/* Two-column on desktop, stacked on mobile */}
      <div className="lg:flex flex-1">
        {/* Identity sidebar */}
        <section
          aria-label="Details"
          className="lg:w-[340px] lg:flex-shrink-0 lg:sticky lg:top-0 lg:self-start lg:max-h-[100dvh] lg:overflow-y-auto border-b border-[var(--twilight)]/40 lg:border-b-0 lg:border-r lg:border-[var(--twilight)]/40 bg-[var(--card-bg,var(--night))] scrollbar-hide"
        >
          {sidebar}
        </section>

        {/* Content zone */}
        <main className="flex-1 min-w-0">
          {content}
        </main>
      </div>

      {/* Bottom action bar */}
      {bottomBar}
    </div>
  );
}
