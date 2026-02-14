"use client";

import { useEffect, useRef, useState } from "react";

const SECTIONS = [
  { key: "today", label: "Today" },
  { key: "eat-drink", label: "Eat & Drink" },
  { key: "the-roof", label: "The Roof" },
  { key: "beltline", label: "BeltLine" },
  { key: "this-week", label: "This Week" },
] as const;

export default function MarketplaceNav() {
  const [active, setActive] = useState<string>("today");
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const elements = SECTIONS.map((s) => document.getElementById(s.key)).filter(Boolean) as HTMLElement[];

    observer.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    for (const el of elements) {
      observer.current.observe(el);
    }

    return () => observer.current?.disconnect();
  }, []);

  function scrollTo(key: string) {
    const el = document.getElementById(key);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <nav className="sticky top-0 z-30 -mx-4 px-4 py-2 bg-[var(--mkt-ivory)]/95 backdrop-blur-sm border-b border-[var(--mkt-sand)]/60">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {SECTIONS.map((section) => (
          <button
            key={section.key}
            onClick={() => scrollTo(section.key)}
            className={`mkt-pill rounded-full px-3.5 py-1.5 text-xs font-label tracking-[0.06em] transition-all ${
              active === section.key
                ? "mkt-pill-active"
                : "text-[var(--mkt-steel)] hover:text-[var(--mkt-charcoal)] hover:border-[var(--mkt-steel)]/40"
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
