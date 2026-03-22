"use client";

import type { QuickAction as QuickActionType } from "@/lib/search-ranking";

// ============================================
// Types
// ============================================

export interface QuickActionProps {
  action: QuickActionType;
  isSelected: boolean;
  index: number;
  onSelect: (action: QuickActionType) => void;
  onHover: (index: number) => void;
}

export interface QuickActionsListProps {
  actions: QuickActionType[];
  selectedIndex: number;
  startIndex: number;
  onSelect: (action: QuickActionType) => void;
  onHover: (index: number) => void;
}

// ============================================
// Components
// ============================================

export function QuickAction({
  action,
  isSelected,
  index,
  onSelect,
  onHover,
}: QuickActionProps) {
  return (
    <button
      id={`suggestion-${index}`}
      role="option"
      aria-selected={isSelected}
      onMouseDown={() => onSelect(action)}
      onMouseEnter={() => onHover(index)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium border transition-all flex-shrink-0 ${
        isSelected
          ? "bg-[var(--action-primary)]/15 text-[var(--action-primary)] border-[var(--action-primary)]/40 scale-[1.02]"
          : "bg-[var(--twilight)]/50 text-[var(--soft)] border-[var(--twilight)] hover:text-[var(--cream)] hover:border-[var(--soft)]/50"
      }`}
      title={action.description}
    >
      <QuickActionIcon icon={action.icon} isSelected={isSelected} />
      <span className="truncate max-w-[120px]">{action.label}</span>
    </button>
  );
}

export default function QuickActionsList({
  actions,
  selectedIndex,
  startIndex,
  onSelect,
  onHover,
}: QuickActionsListProps) {
  if (actions.length === 0) return null;

  return (
    <div className="px-3 pt-2.5 pb-2 border-b border-[var(--twilight)]">
      {/* Section label */}
      <div className="flex items-center gap-1.5 mb-2">
        <svg
          className="h-3 w-3 text-[var(--action-primary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        <span className="text-2xs font-mono uppercase tracking-wider text-[var(--muted)]">
          Quick Actions
        </span>
      </div>

      {/* Pills — horizontal scrollable row */}
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action, idx) => (
          <QuickAction
            key={action.id}
            action={action}
            isSelected={selectedIndex === startIndex + idx}
            index={startIndex + idx}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

function QuickActionIcon({
  icon,
  isSelected,
}: {
  icon: QuickActionType["icon"];
  isSelected: boolean;
}) {
  const baseClass = `h-3 w-3 flex-shrink-0 transition-colors ${
    isSelected ? "text-[var(--action-primary)]" : "text-[var(--soft)]"
  }`;

  switch (icon) {
    case "category":
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
      );

    case "time":
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );

    case "free":
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );

    case "neighborhood":
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      );

    case "filter":
    default:
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
      );
  }
}
