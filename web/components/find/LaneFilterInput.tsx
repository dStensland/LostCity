"use client";

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";

const DEBOUNCE_MS = 200;

interface LaneFilterInputProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Lane-scoped filter input. ~50 lines. Zero dependency on the unified search
 * stack. Debounced, emits onChange(next) on idle. Used by EventsFinder and
 * PlaceFilterBar to narrow the lane's timeline by text match.
 */
export function LaneFilterInput({
  value,
  onChange,
  placeholder = "Filter...",
  className = "",
}: LaneFilterInputProps) {
  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value changes without a setState-in-effect.
  // Pattern from https://react.dev/learn/you-might-not-need-an-effect
  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(value);
  }

  useEffect(() => {
    if (local === value) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(local), DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [local, value, onChange]);

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)] focus-within:border-[var(--coral)] ${className}`}>
      <MagnifyingGlass weight="duotone" className="w-4 h-4 text-[var(--muted)] flex-shrink-0" />
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="flex-1 bg-transparent text-sm text-[var(--cream)] placeholder:text-[var(--muted)] outline-none min-w-0"
      />
      {local.length > 0 && (
        <button
          type="button"
          onClick={() => setLocal("")}
          className="flex-shrink-0 text-[var(--muted)] hover:text-[var(--cream)]"
          aria-label="Clear filter"
        >
          <X weight="bold" className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
