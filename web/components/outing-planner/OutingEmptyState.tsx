"use client";

import { Compass } from "@phosphor-icons/react";

interface OutingEmptyStateProps {
  title: string;
  subtitle: string;
  onBrowse?: () => void;
}

export default function OutingEmptyState({
  title,
  subtitle,
  onBrowse,
}: OutingEmptyStateProps) {
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 rounded-full bg-[var(--twilight)] flex items-center justify-center mx-auto mb-3">
        <Compass size={24} weight="light" className="text-[var(--muted)]" />
      </div>
      <p className="text-sm text-[var(--soft)] mb-1">{title}</p>
      {onBrowse && (
        <button
          onClick={onBrowse}
          className="text-xs font-mono text-[var(--coral)] hover:underline"
        >
          {subtitle}
        </button>
      )}
    </div>
  );
}
