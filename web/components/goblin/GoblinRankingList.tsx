"use client";

import { useState, useCallback, useMemo } from "react";
import GoblinRankingItem from "./GoblinRankingItem";
import type { RankingItem, RankingEntry } from "@/lib/ranking-types";

interface Props {
  items: RankingItem[];
  entries: RankingEntry[];
  categoryId: number;
  isOpen: boolean;
  onSave: (categoryId: number, entries: RankingEntry[]) => void;
}

export default function GoblinRankingList({ items, entries, categoryId, isOpen, onSave }: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const { ranked, unranked } = useMemo(() => {
    const entryMap = new Map<number, RankingEntry>();
    for (const e of entries) entryMap.set(e.item_id, e);

    const rankedItems: (RankingItem & { entry: RankingEntry })[] = [];
    const unrankedItems: RankingItem[] = [];

    for (const item of items) {
      const entry = entryMap.get(item.id);
      if (entry) {
        rankedItems.push({ ...item, entry });
      } else {
        unrankedItems.push(item);
      }
    }

    rankedItems.sort((a, b) => a.entry.sort_order - b.entry.sort_order);
    return { ranked: rankedItems, unranked: unrankedItems };
  }, [items, entries]);

  const saveFromRanked = useCallback(
    (newRanked: typeof ranked) => {
      const newEntries: RankingEntry[] = newRanked.map((item, i) => ({
        item_id: item.id,
        sort_order: i + 1,
        tier_name: item.entry.tier_name,
        tier_color: item.entry.tier_color,
      }));
      onSave(categoryId, newEntries);
    },
    [categoryId, onSave]
  );

  const addToRanking = useCallback(
    (item: RankingItem) => {
      const newEntry: RankingEntry = {
        item_id: item.id,
        sort_order: ranked.length + 1,
        tier_name: null,
        tier_color: null,
      };
      const newRanked = [...ranked, { ...item, entry: newEntry }];
      saveFromRanked(newRanked);
    },
    [ranked, saveFromRanked]
  );

  const removeFromRanking = useCallback(
    (itemId: number) => {
      const newRanked = ranked.filter((r) => r.id !== itemId);
      saveFromRanked(newRanked);
    },
    [ranked, saveFromRanked]
  );

  const moveToRank = useCallback(
    (currentIndex: number, newRank: number) => {
      const targetIndex = Math.max(0, Math.min(newRank - 1, ranked.length - 1));
      if (targetIndex === currentIndex) return;
      const newRanked = [...ranked];
      const [moved] = newRanked.splice(currentIndex, 1);
      newRanked.splice(targetIndex, 0, moved);
      saveFromRanked(newRanked);
    },
    [ranked, saveFromRanked]
  );

  const handleDrop = useCallback(
    (toIndex: number) => {
      if (dragFrom === null || dragFrom === toIndex) {
        setDragFrom(null);
        setDragOver(null);
        return;
      }
      const newRanked = [...ranked];
      const [moved] = newRanked.splice(dragFrom, 1);
      newRanked.splice(toIndex, 0, moved);
      setDragFrom(null);
      setDragOver(null);
      saveFromRanked(newRanked);
    },
    [dragFrom, ranked, saveFromRanked]
  );

  const tierGroups = useMemo(() => {
    const groups: { tierName: string | null; tierColor: string | null; items: typeof ranked }[] = [];
    let current: (typeof groups)[0] | null = null;
    for (const item of ranked) {
      if (item.entry.tier_name || !current) {
        current = { tierName: item.entry.tier_name, tierColor: item.entry.tier_color, items: [] };
        groups.push(current);
      }
      current.items.push(item);
    }
    return groups;
  }, [ranked]);

  return (
    <div onDragLeave={() => setDragOver(null)}>
      {ranked.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-mono text-sm text-zinc-500 tracking-widest uppercase">
            Drag items up to rank them, or tap a number to place them.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {tierGroups.map((group, gi) => (
            <div key={gi} className="flex mb-3">
              {group.tierName ? (
                <div
                  className="flex-shrink-0 w-6 sm:w-8 flex items-center justify-center relative"
                  style={{ borderLeft: `2px solid ${group.tierColor || "#00f0ff"}` }}
                >
                  <span
                    className="font-mono text-2xs font-black uppercase tracking-[0.3em] whitespace-nowrap
                      [writing-mode:vertical-lr] rotate-180"
                    style={{
                      color: group.tierColor || "#00f0ff",
                      textShadow: `0 0 8px ${group.tierColor || "#00f0ff"}40`,
                    }}
                  >
                    {group.tierName}
                  </span>
                </div>
              ) : (
                <div className="w-0" />
              )}
              <div className="flex-1 min-w-0 space-y-1">
                {group.items.map((item) => {
                  const globalIdx = ranked.indexOf(item);
                  return (
                    <GoblinRankingItem
                      key={item.id}
                      name={item.name}
                      subtitle={item.subtitle}
                      rank={globalIdx + 1}
                      tierColor={group.tierColor}
                      readOnly={!isOpen}
                      onMoveToRank={(r) => moveToRank(globalIdx, r)}
                      onRemove={isOpen ? () => removeFromRanking(item.id) : undefined}
                      onDragStart={() => setDragFrom(globalIdx)}
                      onDragOver={() => setDragOver(globalIdx)}
                      onDrop={() => handleDrop(globalIdx)}
                      isDragging={dragFrom === globalIdx}
                      isDragTarget={dragOver === globalIdx && dragFrom !== globalIdx}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {unranked.length > 0 && isOpen && (
        <div className="mt-6">
          <p className="font-mono text-2xs text-zinc-600 uppercase tracking-[0.2em] mb-2">
            Unranked ({unranked.length})
          </p>
          <div className="space-y-1">
            {unranked.map((item) => (
              <button
                key={item.id}
                onClick={() => addToRanking(item)}
                className="w-full flex items-stretch bg-zinc-950/50 border border-zinc-800/30
                  hover:border-zinc-700/50 hover:bg-zinc-900/30 transition-all text-left"
              >
                <div className="flex-shrink-0 w-12 flex items-center justify-center">
                  <span className="font-mono text-lg text-zinc-800">–</span>
                </div>
                <div className="flex-1 min-w-0 py-2.5 pr-2">
                  <p className="text-sm text-zinc-500 truncate">{item.name}</p>
                  {item.subtitle && (
                    <p className="text-2xs text-zinc-700 font-mono mt-0.5 truncate">{item.subtitle}</p>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center pr-3">
                  <span className="text-2xs text-zinc-700 font-mono">TAP TO ADD</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
