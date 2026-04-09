"use client";

import { useMemo } from "react";
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
        return (
          <div
            key={agg.item.id}
            className={`flex items-stretch bg-zinc-950 border transition-colors
              ${isContested ? "border-amber-800/40" : "border-zinc-800/50"}`}
          >
            <div className="flex-shrink-0 w-12 flex items-center justify-center">
              <span
                className="font-mono text-lg font-black tabular-nums"
                style={{
                  color: i < 3 ? "#00f0ff" : i < 10 ? "#ff00aa" : "#52525b",
                  textShadow: i < 3
                    ? "0 0 10px rgba(0,240,255,0.4)"
                    : i < 10
                    ? "0 0 8px rgba(255,0,170,0.3)"
                    : "none",
                }}
              >
                {i + 1}
              </span>
            </div>

            <div className="flex-1 min-w-0 py-2.5 pr-2">
              <p className="text-sm font-semibold text-white truncate">
                {agg.item.name}
                {isContested && (
                  <span className="ml-2 text-2xs text-amber-500 font-mono">CONTESTED</span>
                )}
              </p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-2xs text-zinc-500 font-mono">
                  avg #{agg.avgPosition.toFixed(1)}
                </span>
                <span className="text-2xs text-zinc-600 font-mono">
                  range #{agg.minRank}–#{agg.maxRank}
                </span>
                {agg.item.subtitle && (
                  <span className="text-2xs text-zinc-700 font-mono truncate">{agg.item.subtitle}</span>
                )}
              </div>
            </div>

            {agg.myRank !== null && (
              <div className="flex-shrink-0 flex items-center pr-3">
                <span className="text-2xs text-zinc-600 font-mono">
                  You: #{agg.myRank}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
