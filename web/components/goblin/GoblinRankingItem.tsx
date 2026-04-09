"use client";

import { useState } from "react";

interface Props {
  name: string;
  subtitle: string | null;
  rank: number;
  tierColor?: string | null;
  readOnly?: boolean;
  onMoveToRank?: (rank: number) => void;
  onRemove?: () => void;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  isDragging?: boolean;
  isDragTarget?: boolean;
  compareRank?: number | null;
}

const RANK_NEON = {
  hero: { color: "#00f0ff", glow: "0 0 10px rgba(0,240,255,0.4), 0 0 30px rgba(0,240,255,0.15)" },
  mid: { color: "#ff00aa", glow: "0 0 8px rgba(255,0,170,0.3), 0 0 20px rgba(255,0,170,0.1)" },
  rest: { color: "#52525b", glow: "none" },
};

export default function GoblinRankingItem({
  name, subtitle, rank, tierColor, readOnly,
  onMoveToRank, onRemove,
  onDragStart, onDragOver, onDrop, isDragging, isDragTarget,
  compareRank,
}: Props) {
  const [editingRank, setEditingRank] = useState(false);
  const [rankInput, setRankInput] = useState("");

  const isHero = rank <= 3;
  const isMid = rank > 3 && rank <= 10;
  const tier = tierColor
    ? { color: tierColor, glow: `0 0 8px ${tierColor}40, 0 0 20px ${tierColor}15` }
    : isHero ? RANK_NEON.hero : isMid ? RANK_NEON.mid : RANK_NEON.rest;

  // positive = you rank it higher (better), negative = you rank it lower (worse)
  const delta = compareRank != null ? rank - compareRank : null;

  return (
    <div
      draggable={!readOnly}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.();
      }}
      className={`flex items-stretch transition-all duration-150
        ${isDragging ? "opacity-30 scale-95" : ""}
        ${isDragTarget ? "ring-1 ring-cyan-500/50" : ""}
        ${!readOnly ? "cursor-grab active:cursor-grabbing" : ""}
        bg-zinc-950 border border-zinc-800/50 hover:border-zinc-700/50`}
    >
      {/* Rank badge */}
      <div className="flex-shrink-0 w-12 flex items-center justify-center">
        {editingRank ? (
          <input
            autoFocus
            type="number"
            min={1}
            value={rankInput}
            onChange={(e) => setRankInput(e.target.value)}
            onBlur={() => {
              const n = parseInt(rankInput);
              if (n > 0) onMoveToRank?.(n);
              setEditingRank(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const n = parseInt(rankInput);
                if (n > 0) onMoveToRank?.(n);
                setEditingRank(false);
              }
              if (e.key === "Escape") setEditingRank(false);
            }}
            className="w-10 bg-transparent text-center font-mono text-lg font-black
              border-b border-cyan-500 text-cyan-300 outline-none"
          />
        ) : (
          <button
            onClick={() => {
              if (readOnly) return;
              setRankInput(String(rank));
              setEditingRank(true);
            }}
            className="font-mono text-lg font-black tabular-nums leading-none"
            style={{
              color: tier.color,
              textShadow: tier.glow,
            }}
            title={readOnly ? undefined : "Tap to jump to rank"}
          >
            {rank}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-2.5 pr-2">
        <p className="text-sm font-semibold text-white truncate">{name}</p>
        {subtitle && (
          <p className="text-2xs text-zinc-500 font-mono mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      {/* Compare delta */}
      {delta !== null && (
        <div className="flex-shrink-0 flex items-center pr-3">
          <span
            className="font-mono text-xs font-bold"
            style={{
              color: delta > 0 ? "#00d9a0" : delta < 0 ? "#ff5a5a" : "#52525b",
            }}
          >
            {delta === 0 ? "=" : delta > 0 ? `+${delta}` : String(delta)}
          </span>
        </div>
      )}

      {/* Remove button */}
      {!readOnly && onRemove && (
        <button
          onClick={onRemove}
          className="flex-shrink-0 w-8 flex items-center justify-center
            text-zinc-700 hover:text-red-400 transition-colors"
          title="Remove from ranking"
        >
          ×
        </button>
      )}
    </div>
  );
}
