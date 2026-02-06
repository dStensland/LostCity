"use client";

import { useState } from "react";

interface ExpandableSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function ExpandableSection({
  title,
  children,
  defaultOpen = false,
}: ExpandableSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const sectionId = `section-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="border-b border-[#1a1a24]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={sectionId}
        className="w-full flex items-center justify-between py-5 px-2 text-left group rounded-lg hover:bg-[rgba(0,229,255,0.02)] transition-colors duration-300"
      >
        <h2 className="font-mono text-sm uppercase tracking-widest text-[var(--cream)] group-hover:text-[#00e5ff] transition-colors">
          {title}
        </h2>
        <svg
          className={`w-5 h-5 text-[#5a5a6a] group-hover:text-[#00e5ff] transition-all duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <div
        id={sectionId}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[2000px] opacity-100 pb-6" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-2 text-[var(--soft)] leading-relaxed space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}
