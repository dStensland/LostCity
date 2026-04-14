"use client";

import { useEffect, useRef } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useSearchStore } from "@/lib/search/store";

interface SearchInputProps {
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  autoFocus = false,
  placeholder = "Search events, places, classes, teams...",
  className = "",
}: SearchInputProps) {
  const raw = useSearchStore((s) => s.raw);
  const setRaw = useSearchStore((s) => s.setRaw);
  const clear = useSearchStore((s) => s.clear);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)] focus-within:border-[var(--coral)] focus-within:ring-2 focus-within:ring-[var(--coral)]/30 transition-all ${className}`}
      role="search"
    >
      <MagnifyingGlass
        weight="duotone"
        className="w-4 h-4 text-[var(--muted)] flex-shrink-0"
      />
      <input
        ref={inputRef}
        type="search"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="flex-1 bg-transparent text-sm text-[var(--cream)] placeholder:text-[var(--muted)] outline-none min-w-0"
        role="combobox"
        aria-expanded={raw.length >= 2}
        aria-controls="search-listbox"
        aria-autocomplete="list"
      />
      {raw.length > 0 && (
        <button
          type="button"
          onClick={() => {
            clear();
            inputRef.current?.focus();
          }}
          className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--twilight)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--cream)]"
          aria-label="Clear search"
        >
          <X weight="bold" className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
