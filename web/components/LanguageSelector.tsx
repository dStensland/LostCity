"use client";

import { useState, useRef, useEffect } from "react";
import {
  type SupportedLocale,
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  LOCALE_FLAGS,
  getStoredLocale,
  setStoredLocale,
} from "@/lib/i18n/config";

interface LanguageSelectorProps {
  className?: string;
  onLocaleChange?: (locale: SupportedLocale) => void;
}

export default function LanguageSelector({
  className = "",
  onLocaleChange,
}: LanguageSelectorProps) {
  const [locale, setLocale] = useState<SupportedLocale>("en");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocale(getStoredLocale());
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSelect = (newLocale: SupportedLocale) => {
    setLocale(newLocale);
    setStoredLocale(newLocale);
    setOpen(false);
    onLocaleChange?.(newLocale);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/10 transition-colors"
        aria-label="Select language"
      >
        <span>{LOCALE_FLAGS[locale]}</span>
        <span className="hidden sm:inline text-white/60">
          {LOCALE_LABELS[locale]}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-white/40"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-[var(--bg-primary,#1a1a2e)] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50 min-w-[140px]">
          {SUPPORTED_LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => handleSelect(l)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                locale === l
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>{LOCALE_FLAGS[l]}</span>
              <span>{LOCALE_LABELS[l]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
