"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import SmartImage from "@/components/SmartImage";
import type { RankingItem, RankingEntry, ParticipantRankings } from "@/lib/ranking-types";

interface Props {
  items: RankingItem[];
  myEntries: RankingEntry[];
  participants: ParticipantRankings[];
}

interface AggregatedItem {
  item: RankingItem;
  avgPosition: number;
  minRank: number;
  maxRank: number;
  rankedBy: number;
  myRank: number | null;
  spread: number;
}

export default function GoblinRankingGroup({ items, myEntries, participants }: Props) {
  const myRankMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of myEntries) m.set(e.item_id, e.sort_order);
    return m;
  }, [myEntries]);

  const aggregated: AggregatedItem[] = useMemo(() => {
    const result: AggregatedItem[] = [];

    for (const item of items) {
      const ranks: number[] = [];
      for (const p of participants) {
        const entry = p.entries.find((e) => e.item_id === item.id);
        if (entry) ranks.push(entry.sort_order);
      }

      if (ranks.length === 0) continue;

      const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
      const min = Math.min(...ranks);
      const max = Math.max(...ranks);

      result.push({
        item,
        avgPosition: avg,
        minRank: min,
        maxRank: max,
        rankedBy: ranks.length,
        myRank: myRankMap.get(item.id) ?? null,
        spread: max - min,
      });
    }

    result.sort((a, b) => a.avgPosition - b.avgPosition);
    return result;
  }, [items, participants, myRankMap]);

  const [animKey, setAnimKey] = useState(0);
  const prevItemsRef = useRef(items);
  useEffect(() => {
    if (prevItemsRef.current !== items) {
      setAnimKey((k) => k + 1);
      prevItemsRef.current = items;
    }
  }, [items]);

  if (aggregated.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="font-mono text-sm text-zinc-500 tracking-widest uppercase">
          No rankings yet
        </p>
      </div>
    );
  }

  const maxSpread = Math.max(...aggregated.map((a) => a.spread));

  return (
    <div className="space-y-1">
      {aggregated.map((agg, i) => {
        const isContested = maxSpread > 0 && agg.spread >= maxSpread * 0.7;
        const isHero = i < 3;
        const isMid = i >= 3 && i < 10;
        const tierColor = isHero ? "#00f0ff" : isMid ? "#ff00aa" : "#52525b";
        const totalItems = items.length || 1;

        return (
          <div
            key={`${agg.item.id}-${animKey}`}
            className={`flex items-stretch transition-colors motion-safe:animate-[rankItemEntry_300ms_ease-out_backwards]
              rounded-lg p-2 gap-2
              ${isHero
                ? "bg-zinc-950 border border-cyan-500/20 shadow-[inset_0_0_20px_rgba(0,240,255,0.03)]"
                : isContested
                ? "bg-zinc-950 border border-amber-800/40"
                : "bg-zinc-950 border border-zinc-800/50"}`}
            style={{ animationDelay: i < 10 ? `${i * 50}ms` : "0ms" }}
          >
            {/* Rank number */}
            <div className="flex-shrink-0 w-14 flex items-center justify-center relative">
              <span
                className={`font-mono font-black tabular-nums ${isHero ? "text-[28px]" : isMid ? "text-xl" : "text-lg"}`}
                style={{ color: tierColor }}
              >
                {isHero ? String(i + 1).padStart(2, "0") : i + 1}
              </span>
              {isHero && (
                <span
                  className="absolute inset-0 rounded-full blur-xl motion-safe:animate-[glowPulse_2s_ease-in-out_infinite] pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${tierColor}60 0%, transparent 70%)` }}
                />
              )}
            </div>

            {/* Image */}
            {agg.item.image_url && (
              <div className="flex-shrink-0 w-[60px] sm:w-20 relative overflow-hidden bg-zinc-900 rounded-md"
                style={{ aspectRatio: "16/10" }}
              >
                <SmartImage src={agg.item.image_url} alt="" fill className="object-cover" sizes="(max-width: 640px) 60px, 80px" />
                {isHero && (
                  <>
                    <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 pointer-events-none" style={{ borderColor: tierColor }} />
                    <span className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 pointer-events-none" style={{ borderColor: tierColor }} />
                    <span className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 pointer-events-none" style={{ borderColor: tierColor }} />
                    <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 pointer-events-none" style={{ borderColor: tierColor }} />
                  </>
                )}
              </div>
            )}

            <div className="flex-1 min-w-0 py-2.5 pr-2">
              <p className="text-sm font-semibold text-white truncate">
                {agg.item.name}
                {isContested && (
                  <span className="relative ml-2 text-2xs text-amber-500 font-mono">
                    CONTESTED
                    <span
                      className="absolute inset-0 blur-sm motion-safe:animate-[contestedPulse_1.5s_ease-in-out_infinite] pointer-events-none"
                      style={{ background: "radial-gradient(circle, rgba(255,217,61,0.4) 0%, transparent 70%)" }}
                    />
                  </span>
                )}
              </p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-2xs text-zinc-500 font-mono">
                  avg #{agg.avgPosition.toFixed(1)}
                </span>
                <span className="text-2xs text-zinc-500 font-mono">
                  range #{agg.minRank}–#{agg.maxRank}
                </span>
                {agg.item.subtitle && (
                  <span className="text-2xs text-zinc-400 font-mono truncate">{agg.item.subtitle}</span>
                )}
              </div>

              {/* Rank distribution bar */}
              {agg.spread > 0 && (
                <div className="relative mt-1.5 h-1 bg-zinc-800 rounded-full overflow-visible">
                  <div
                    className="absolute top-0 h-full rounded-full"
                    style={{
                      left: `${((agg.minRank - 1) / totalItems) * 100}%`,
                      width: `${(agg.spread / totalItems) * 100}%`,
                      background: `linear-gradient(90deg, ${tierColor}40, ${tierColor}20)`,
                    }}
                  />
                  {agg.myRank !== null && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                      style={{
                        left: `${((agg.myRank - 1) / totalItems) * 100}%`,
                        background: "#00f0ff",
                        boxShadow: "0 0 4px rgba(0,240,255,0.6)",
                      }}
                    />
                  )}
                </div>
              )}
            </div>

            {agg.myRank !== null && (
              <div className="flex-shrink-0 flex items-center pr-3">
                <span className="text-2xs text-zinc-600 font-mono">
                  You: #{agg.myRank}
                </span>
              </div>
            )}

            {/* Threat sidebar */}
            {(isHero || isMid) && (
              <div className="flex-shrink-0 w-1 self-stretch rounded-r-full"
                style={{ background: `linear-gradient(180deg, ${tierColor}, ${tierColor}${isHero ? "40" : "20"})` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
