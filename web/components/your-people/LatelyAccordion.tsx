"use client";

import { useState } from "react";
import { FriendsActivity } from "@/components/community/FriendsActivity";

export default function LatelyAccordion() {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-[var(--twilight)] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[var(--twilight)]/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-3.5 rounded-full bg-[var(--vibe)]" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--vibe)]">
            Lately
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-[var(--muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <FriendsActivity />
        </div>
      )}
    </div>
  );
}
