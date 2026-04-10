"use client";

import { useState } from "react";
import SmartImage from "@/components/SmartImage";

interface Props {
  name: string;
  subtitle: string | null;
  description?: string | null;
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

const getRankTier = (rank: number, tierColor?: string | null) => {
  if (tierColor) return { color: tierColor, tier: "custom" as const };
  if (rank <= 3) return { color: "#00f0ff", tier: "hero" as const };
  if (rank <= 10) return { color: "#ff00aa", tier: "mid" as const };
  return { color: "#52525b", tier: "rest" as const };
};

export default function GoblinRankingItem({
  name, subtitle, description, imageUrl, rank, tierColor, readOnly,
  onMoveToRank, onRemove, onEdit, onDelete,
  onDragStart, onDragOver, onDrop, isDragging, isDragTarget,
  compareRank,
}: Props) {
  const [editingRank, setEditingRank] = useState(false);
  const [rankInput, setRankInput] = useState("");

  const rankTier = getRankTier(rank, tierColor);

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
      className={`flex items-stretch transition-all duration-150 rounded-lg p-2 gap-2
        ${isDragging ? "opacity-30 scale-95" : ""}
        ${isDragTarget ? "ring-1 ring-cyan-500/50" : ""}
        ${!readOnly ? "cursor-grab active:cursor-grabbing" : ""}
        ${rankTier.tier === "hero"
          ? "bg-zinc-950 border border-cyan-500/20 shadow-[inset_0_0_20px_rgba(0,240,255,0.03)]"
          : rankTier.tier === "mid"
          ? "bg-zinc-950 border border-zinc-800/40"
          : "bg-zinc-950/80 border border-zinc-800/30"}`}
    >
      {/* Rank badge */}
      <div className="flex-shrink-0 w-14 flex items-center justify-center relative">
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
            className={`font-mono font-black tabular-nums leading-none relative
              ${rankTier.tier === "hero" ? "text-[28px]" : rankTier.tier === "mid" ? "text-xl" : "text-lg"}`}
            style={{ color: rankTier.color }}
            title={readOnly ? undefined : "Tap to jump to rank"}
          >
            {rankTier.tier === "hero" ? String(rank).padStart(2, "0") : rank}
            {/* Glow pulse — compositor-friendly opacity animation on pseudo-element */}
            {rankTier.tier === "hero" && (
              <span
                className="absolute inset-0 rounded-full blur-xl motion-safe:animate-[glowPulse_2s_ease-in-out_infinite] pointer-events-none"
                style={{ background: `radial-gradient(circle, ${rankTier.color}60 0%, transparent 70%)` }}
              />
            )}
          </button>
        )}
      </div>

      {/* Thumbnail with HUD frame */}
      {imageUrl ? (
        <div className={`flex-shrink-0 relative overflow-hidden bg-zinc-900 rounded-md
          ${rankTier.tier === "hero" ? "w-28 sm:w-36" : rankTier.tier === "mid" ? "w-24 sm:w-32" : "w-20 sm:w-28"}
          ${rankTier.tier === "rest" ? "opacity-70" : ""}`}
          style={{ aspectRatio: "16/10" }}
        >
          <SmartImage src={imageUrl} alt="" fill className="object-cover" sizes="(max-width: 640px) 112px, 144px" />
          {/* Corner brackets — top 3 only */}
          {rankTier.tier === "hero" && (
            <>
              <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 pointer-events-none" style={{ borderColor: rankTier.color }} />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 pointer-events-none" style={{ borderColor: rankTier.color }} />
              <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 pointer-events-none" style={{ borderColor: rankTier.color }} />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 pointer-events-none" style={{ borderColor: rankTier.color }} />
            </>
          )}
        </div>
      ) : (
        <div className={`flex-shrink-0 relative overflow-hidden bg-zinc-900/50 rounded-md
          ${rankTier.tier === "hero" ? "w-28 sm:w-36" : rankTier.tier === "mid" ? "w-24 sm:w-32" : "w-20 sm:w-28"}
          flex items-center justify-center`}
          style={{ aspectRatio: "16/10" }}
        >
          <span className="font-mono text-2xl font-black text-zinc-800/30">{rank}</span>
          <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-zinc-700/40 pointer-events-none" />
          <span className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-zinc-700/40 pointer-events-none" />
          <span className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-zinc-700/40 pointer-events-none" />
          <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-zinc-700/40 pointer-events-none" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 py-1">
        <p className="text-sm sm:text-base font-semibold text-white truncate">{name}</p>
        {subtitle && (
          <p className="text-2xs text-zinc-500 font-mono mt-1 truncate">{subtitle}</p>
        )}
        {description && (
          <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{description}</p>
        )}
      </div>

      {/* Edit button */}
      {onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="flex-shrink-0 w-11 min-h-[44px] flex items-center justify-center
            text-zinc-600 hover:text-cyan-400 transition-colors"
          title="Edit item"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
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
          className="flex-shrink-0 w-11 min-h-[44px] flex items-center justify-center
            text-zinc-600 hover:text-red-400 transition-colors"
          title="Delete item"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
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
            className="font-mono text-xs font-bold relative"
            style={{
              color: delta > 0 ? "#00d9a0" : delta < 0 ? "#ff5a5a" : "#52525b",
            }}
          >
            {delta === 0 ? "=" : delta > 0 ? `+${delta}` : String(delta)}
            {delta !== 0 && (
              <span
                className="absolute inset-0 blur-md pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${delta > 0 ? "rgba(0,217,160,0.4)" : "rgba(255,90,90,0.4)"} 0%, transparent 70%)`,
                }}
              />
            )}
          </span>
        </div>
      )}

      {/* Threat-level sidebar */}
      {rankTier.tier !== "rest" && (
        <div
          className="flex-shrink-0 w-1 self-stretch"
          style={{
            background: `linear-gradient(180deg, ${rankTier.color}, ${rankTier.color}${rankTier.tier === "hero" ? "40" : "20"})`,
          }}
        />
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
