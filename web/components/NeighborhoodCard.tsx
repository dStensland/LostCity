"use client";

import { memo } from "react";

interface NeighborhoodCardProps {
  name: string;
  liveCount: number;
  openCount: number;
  isSelected: boolean;
  onClick: () => void;
}

function NeighborhoodCard({ name, liveCount, openCount, isSelected, onClick }: NeighborhoodCardProps) {
  const hasActivity = liveCount > 0 || openCount > 0;

  return (
    <button
      onClick={onClick}
      className={`text-left p-3 rounded-lg border transition-all ${
        isSelected
          ? "border-[var(--neon-amber)] bg-[var(--neon-amber)]/10"
          : hasActivity
          ? "border-[var(--twilight)] bg-[var(--dusk)]/30 hover:bg-[var(--dusk)]/60 hover:border-[var(--muted)]"
          : "border-[var(--twilight)]/50 bg-[var(--dusk)]/10 opacity-50 hover:opacity-75"
      }`}
    >
      <div className="font-mono text-xs font-medium text-[var(--cream)] truncate mb-1">
        {name}
      </div>
      <div className="flex items-center gap-2">
        {liveCount > 0 && (
          <span className="flex items-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--neon-red)]"
              style={{ boxShadow: "0 0 4px var(--neon-red)" }}
            />
            <span className="font-mono text-[0.6rem] text-[var(--neon-red)]">
              {liveCount}
            </span>
          </span>
        )}
        {openCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)]" />
            <span className="font-mono text-[0.6rem] text-[var(--neon-green)]">
              {openCount}
            </span>
          </span>
        )}
        {!hasActivity && (
          <span className="font-mono text-[0.55rem] text-[var(--muted)]">
            quiet
          </span>
        )}
      </div>
    </button>
  );
}

export default memo(NeighborhoodCard);
