"use client";

import { ClipboardText } from "@phosphor-icons/react";

interface OutingFABProps {
  hasActiveOuting: boolean;
  itemCount: number;
  onOpen: () => void;
}

export default function OutingFAB({ hasActiveOuting, itemCount, onOpen }: OutingFABProps) {
  if (!hasActiveOuting) return null;

  return (
    <button
      onClick={onOpen}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-[var(--gold)] to-[var(--coral)] text-[var(--void)] font-mono text-sm font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.45)] hover:scale-[1.02] transition-all active:scale-[0.98]"
    >
      <ClipboardText size={20} weight="bold" />
      <span>{itemCount > 0 ? `${itemCount} stop${itemCount !== 1 ? "s" : ""} planned` : "Your outing"}</span>
    </button>
  );
}
