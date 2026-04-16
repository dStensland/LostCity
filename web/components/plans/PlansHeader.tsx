"use client";

import { CalendarBlank, ListBullets, Plus, UsersThree } from "@phosphor-icons/react";
import Link from "next/link";

interface PlansHeaderProps {
  portalSlug: string;
  view?: "agenda" | "month";
  onToggleView?: () => void;
  onOpenFriendFilter?: () => void;
}

export function PlansHeader({
  portalSlug,
  view = "agenda",
  onToggleView,
  onOpenFriendFilter,
}: PlansHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-lg font-semibold text-[var(--cream)]">Plans</h1>
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenFriendFilter}
          className="w-9 h-9 rounded-lg border border-[var(--twilight)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--cream)] transition-colors duration-300"
          aria-label="Filter friends"
        >
          <UsersThree size={18} weight="duotone" />
        </button>
        <button
          onClick={onToggleView}
          className="w-9 h-9 rounded-lg border border-[var(--twilight)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--cream)] transition-colors duration-300"
          aria-label={view === "agenda" ? "Switch to month view" : "Switch to agenda view"}
        >
          {view === "agenda" ? (
            <CalendarBlank size={18} weight="duotone" />
          ) : (
            <ListBullets size={18} weight="duotone" />
          )}
        </button>
        <Link
          href={`/${portalSlug}/plans/new`}
          className="h-9 px-3 rounded-lg bg-[var(--coral)] text-[var(--night)] text-sm font-medium flex items-center gap-1.5 hover:brightness-110 transition-all duration-200"
        >
          <Plus size={14} weight="bold" />
          New Plan
        </Link>
      </div>
    </div>
  );
}
