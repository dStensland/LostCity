"use client";

import { useState } from "react";
import SmartImage from "@/components/SmartImage";

interface Props {
  name: string;
  subtitle: string | null;
  imageUrl?: string | null;
  rank: number;
  tierColor?: string | null;
  readOnly?: boolean;
  onMoveToRank?: (rank: number) => void;
  onRemove?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
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
  name, subtitle, imageUrl, rank, tierColor, readOnly,
  onMoveToRank, onRemove, onEdit, onDelete,
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

      {/* Thumbnail */}
      {imageUrl && (
        <div className="flex-shrink-0 w-14 h-14 relative overflow-hidden bg-zinc-900">
          <SmartImage src={imageUrl} alt="" fill className="object-cover" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 py-2.5 pr-2">
        <p className="text-sm font-semibold text-white truncate">{name}</p>
        {subtitle && (
          <p className="text-2xs text-zinc-500 font-mono mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      {/* Edit button */}
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="flex-shrink-0 w-7 flex items-center justify-center
            text-zinc-700 hover:text-cyan-400 transition-colors"
          title="Edit item"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      )}

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex-shrink-0 w-7 flex items-center justify-center
            text-zinc-700 hover:text-red-400 transition-colors"
          title="Delete item"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      )}

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
