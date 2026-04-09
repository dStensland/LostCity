"use client";

import { useState, useMemo } from "react";
import GoblinRankingItem from "./GoblinRankingItem";
import type { RankingItem, RankingEntry, ParticipantRankings } from "@/lib/ranking-types";

interface Props {
  items: RankingItem[];
  myEntries: RankingEntry[];
  participants: ParticipantRankings[];
  currentUserId: string;
}

export default function GoblinRankingCompare({ items, myEntries, participants, currentUserId }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const otherParticipants = useMemo(
    () => participants.filter((p) => p.user_id !== currentUserId),
    [participants, currentUserId]
  );

  const myRankMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of myEntries) m.set(e.item_id, e.sort_order);
    return m;
  }, [myEntries]);

  const selectedParticipant = useMemo(
    () => participants.find((p) => p.user_id === selectedUserId),
    [participants, selectedUserId]
  );

  const selectedEntries = useMemo(() => {
    if (!selectedParticipant) return [];
    return [...selectedParticipant.entries].sort((a, b) => a.sort_order - b.sort_order);
  }, [selectedParticipant]);

  const itemMap = useMemo(() => {
    const m = new Map<number, RankingItem>();
    for (const item of items) m.set(item.id, item);
    return m;
  }, [items]);

  if (otherParticipants.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="font-mono text-sm text-zinc-500 tracking-widest uppercase">
          No other participants yet
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {otherParticipants.map((p) => (
          <button
            key={p.user_id}
            onClick={() => setSelectedUserId(p.user_id === selectedUserId ? null : p.user_id)}
            className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 font-mono text-2xs font-bold
              tracking-[0.1em] uppercase border transition-all
              ${p.user_id === selectedUserId
                ? "border-cyan-600 text-cyan-300 bg-cyan-950/30"
                : "border-zinc-800 text-zinc-500 hover:text-cyan-400/60 hover:border-cyan-800/40"
              }`}
          >
            {p.avatar_url && (
              <img src={p.avatar_url} alt="" className="w-4 h-4 rounded-full" />
            )}
            {p.display_name}
            <span className="text-zinc-700">{p.items_ranked}</span>
          </button>
        ))}
      </div>

      {selectedParticipant && selectedEntries.length > 0 ? (
        <div>
          <p className="font-mono text-2xs text-zinc-600 uppercase tracking-[0.2em] mb-2">
            {selectedParticipant.display_name}&apos;s ranking
          </p>
          <div className="space-y-1">
            {selectedEntries.map((entry) => {
              const item = itemMap.get(entry.item_id);
              if (!item) return null;
              const myRank = myRankMap.get(entry.item_id) ?? null;
              return (
                <GoblinRankingItem
                  key={entry.item_id}
                  name={item.name}
                  subtitle={item.subtitle}
                  imageUrl={item.image_url}
                  rank={entry.sort_order}
                  tierColor={entry.tier_color}
                  readOnly
                  compareRank={myRank}
                />
              );
            })}
          </div>
        </div>
      ) : selectedUserId ? (
        <div className="py-8 text-center">
          <p className="font-mono text-sm text-zinc-600">
            {selectedParticipant?.display_name} hasn&apos;t ranked anything in this category yet.
          </p>
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="font-mono text-sm text-zinc-600 tracking-widest uppercase">
            Select someone to compare
          </p>
        </div>
      )}
    </div>
  );
}
