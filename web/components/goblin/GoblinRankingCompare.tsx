"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import GoblinRankingItem from "./GoblinRankingItem";
import SmartImage from "@/components/SmartImage";
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

  const [animKey, setAnimKey] = useState(0);
  const prevSelectedRef = useRef(selectedUserId);
  useEffect(() => {
    if (prevSelectedRef.current !== selectedUserId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- animation-reset trigger: bumps animKey when selectedUserId changes so entries re-animate. Cascade bounded — animKey is not in the dep array ([selectedUserId]).
      setAnimKey((k) => k + 1);
      prevSelectedRef.current = selectedUserId;
    }
  }, [selectedUserId]);

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
                ? "border-cyan-500/40 text-cyan-300 bg-cyan-500/15"
                : "border-zinc-800 text-zinc-500 hover:text-cyan-400/60 hover:border-cyan-800/40"
              }`}
            style={p.user_id === selectedUserId ? {
              boxShadow: "0 0 12px rgba(0,240,255,0.1), inset 0 0 12px rgba(0,240,255,0.05)",
            } : undefined}
          >
            {p.avatar_url && (
              <div className="relative">
                <SmartImage src={p.avatar_url} alt="" width={16} height={16} className="rounded-full" />
                {p.user_id === selectedUserId && (
                  <>
                    <span className="absolute -top-px -left-px w-1.5 h-1.5 border-t border-l border-cyan-500 pointer-events-none" />
                    <span className="absolute -top-px -right-px w-1.5 h-1.5 border-t border-r border-cyan-500 pointer-events-none" />
                    <span className="absolute -bottom-px -left-px w-1.5 h-1.5 border-b border-l border-cyan-500 pointer-events-none" />
                    <span className="absolute -bottom-px -right-px w-1.5 h-1.5 border-b border-r border-cyan-500 pointer-events-none" />
                  </>
                )}
              </div>
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
            {selectedEntries.map((entry, idx) => {
              const item = itemMap.get(entry.item_id);
              if (!item) return null;
              const myRank = myRankMap.get(entry.item_id) ?? null;
              const delta = myRank != null ? entry.sort_order - myRank : null;
              const isDivergent = delta != null && Math.abs(delta) >= 5;

              return (
                <div
                  key={`${entry.item_id}-${animKey}`}
                  className="motion-safe:animate-[rankItemEntry_300ms_ease-out_backwards] relative"
                  style={{ animationDelay: idx < 10 ? `${idx * 50}ms` : "0ms" }}
                >
                  {isDivergent && (
                    <span className="absolute top-1 right-2 text-[9px] font-mono text-amber-500/70 tracking-widest uppercase z-10">
                      DIVERGENT
                    </span>
                  )}
                  <GoblinRankingItem
                    name={item.name}
                    subtitle={item.subtitle}
                    description={item.description}
                    imageUrl={item.image_url}
                    rank={entry.sort_order}
                    tierColor={entry.tier_color}
                    readOnly
                    compareRank={myRank}
                  />
                </div>
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
