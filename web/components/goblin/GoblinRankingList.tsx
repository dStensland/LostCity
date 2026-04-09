"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import GoblinRankingItem from "./GoblinRankingItem";
import SmartImage from "@/components/SmartImage";
import type { RankingItem, RankingEntry } from "@/lib/ranking-types";

interface Props {
  items: RankingItem[];
  entries: RankingEntry[];
  categoryId: number;
  isOpen: boolean;
  onSave: (categoryId: number, entries: RankingEntry[]) => void;
  onAddItem?: (categoryId: number, name: string, subtitle: string | null) => Promise<unknown>;
  onEditItem?: (itemId: number, name: string, subtitle: string | null) => Promise<boolean>;
  onDeleteItem?: (itemId: number) => Promise<boolean>;
}

// ─── Inline add form ──────────────────────────────────────────────────────────

function AddItemForm({
  onSave,
  onCancel,
}: {
  onSave: (name: string, subtitle: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    await onSave(trimmed, subtitle.trim() || null);
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="border border-dashed border-cyan-800/50 bg-zinc-950/30 p-3 space-y-2">
      <input
        ref={nameRef}
        type="text"
        placeholder="Item name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent border-b border-cyan-500/50 text-white font-mono text-sm
          outline-none pb-1 placeholder:text-zinc-700"
      />
      <input
        type="text"
        placeholder="Subtitle (optional)"
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent border-b border-zinc-700/50 text-zinc-400 font-mono text-xs
          outline-none pb-1 placeholder:text-zinc-700"
      />
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="font-mono text-2xs uppercase tracking-wider text-cyan-400
            hover:text-cyan-300 disabled:text-zinc-700 transition-colors"
        >
          {saving ? "SAVING..." : "SAVE"}
        </button>
        <button
          onClick={onCancel}
          className="font-mono text-2xs uppercase tracking-wider text-zinc-600
            hover:text-zinc-400 transition-colors"
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

// ─── Inline edit form ─────────────────────────────────────────────────────────

function EditItemForm({
  initialName,
  initialSubtitle,
  onSave,
  onCancel,
}: {
  initialName: string;
  initialSubtitle: string | null;
  onSave: (name: string, subtitle: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [subtitle, setSubtitle] = useState(initialSubtitle ?? "");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    await onSave(trimmed, subtitle.trim() || null);
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="flex-1 min-w-0 py-2 pr-2 space-y-1.5">
      <input
        ref={nameRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent border-b border-cyan-500/50 text-white font-mono text-sm
          outline-none pb-0.5"
      />
      <input
        type="text"
        placeholder="Subtitle (optional)"
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent border-b border-zinc-700/50 text-zinc-400 font-mono text-xs
          outline-none pb-0.5 placeholder:text-zinc-700"
      />
      <div className="flex items-center gap-3 pt-0.5">
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="font-mono text-2xs uppercase tracking-wider text-cyan-400
            hover:text-cyan-300 disabled:text-zinc-700 transition-colors"
        >
          {saving ? "SAVING..." : "SAVE"}
        </button>
        <button
          onClick={onCancel}
          className="font-mono text-2xs uppercase tracking-wider text-zinc-600
            hover:text-zinc-400 transition-colors"
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

// ─── Main list component ──────────────────────────────────────────────────────

export default function GoblinRankingList({
  items,
  entries,
  categoryId,
  isOpen,
  onSave,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

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

  const handleAddItem = useCallback(
    async (name: string, subtitle: string | null) => {
      if (!onAddItem) return;
      await onAddItem(categoryId, name, subtitle);
      setShowAddForm(false);
    },
    [categoryId, onAddItem]
  );

  const handleEditItem = useCallback(
    async (itemId: number, name: string, subtitle: string | null) => {
      if (!onEditItem) return;
      await onEditItem(itemId, name, subtitle);
      setEditingItemId(null);
    },
    [onEditItem]
  );

  const handleDeleteItem = useCallback(
    async (itemId: number) => {
      if (!onDeleteItem) return;
      // Also remove from ranking first so the save is consistent
      removeFromRanking(itemId);
      await onDeleteItem(itemId);
    },
    [onDeleteItem, removeFromRanking]
  );

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
                  const isEditing = editingItemId === item.id;

                  if (isEditing && onEditItem) {
                    return (
                      <div
                        key={item.id}
                        className="flex items-stretch bg-zinc-950 border border-cyan-800/50"
                      >
                        <div className="flex-shrink-0 w-12 flex items-center justify-center">
                          <span
                            className="font-mono text-lg font-black tabular-nums leading-none text-zinc-700"
                          >
                            {globalIdx + 1}
                          </span>
                        </div>
                        <EditItemForm
                          initialName={item.name}
                          initialSubtitle={item.subtitle}
                          onSave={(name, subtitle) => handleEditItem(item.id, name, subtitle)}
                          onCancel={() => setEditingItemId(null)}
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={item.id} className="flex items-stretch group">
                      <div className="flex-1 min-w-0">
                        <GoblinRankingItem
                          name={item.name}
                          subtitle={item.subtitle}
                          imageUrl={item.image_url}
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
                          onEdit={isOpen && onEditItem ? () => setEditingItemId(item.id) : undefined}
                          onDelete={isOpen && onDeleteItem ? () => handleDeleteItem(item.id) : undefined}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unranked section */}
      {unranked.length > 0 && isOpen && (
        <div className="mt-6">
          <p className="font-mono text-2xs text-zinc-600 uppercase tracking-[0.2em] mb-2">
            Unranked ({unranked.length})
          </p>
          <div className="space-y-1">
            {unranked.map((item) => {
              const isEditing = editingItemId === item.id;

              if (isEditing && onEditItem) {
                return (
                  <div
                    key={item.id}
                    className="flex items-stretch bg-zinc-950/50 border border-cyan-800/50"
                  >
                    <div className="flex-shrink-0 w-12 flex items-center justify-center">
                      <span className="font-mono text-lg text-zinc-800">–</span>
                    </div>
                    <EditItemForm
                      initialName={item.name}
                      initialSubtitle={item.subtitle}
                      onSave={(name, subtitle) => handleEditItem(item.id, name, subtitle)}
                      onCancel={() => setEditingItemId(null)}
                    />
                  </div>
                );
              }

              return (
                <div key={item.id} className="flex items-stretch group">
                  <button
                    onClick={() => addToRanking(item)}
                    className="flex-1 flex items-stretch bg-zinc-950/50 border border-zinc-800/30
                      hover:border-zinc-700/50 hover:bg-zinc-900/30 transition-all text-left"
                  >
                    <div className="flex-shrink-0 w-12 flex items-center justify-center">
                      <span className="font-mono text-lg text-zinc-800">–</span>
                    </div>
                    {item.image_url && (
                      <div className="flex-shrink-0 w-14 h-14 relative overflow-hidden bg-zinc-900 opacity-50">
                        <SmartImage src={item.image_url} alt="" fill className="object-cover" />
                      </div>
                    )}
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
                  {/* Edit/delete controls for unranked items */}
                  {(onEditItem || onDeleteItem) && (
                    <div className="flex items-center gap-0.5 pl-1">
                      {onEditItem && (
                        <button
                          onClick={() => setEditingItemId(item.id)}
                          className="w-8 h-full flex items-center justify-center
                            text-zinc-700 hover:text-cyan-400 transition-colors"
                          title="Edit item"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}
                      {onDeleteItem && (
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="w-8 h-full flex items-center justify-center
                            text-zinc-700 hover:text-red-400 transition-colors"
                          title="Delete item"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add item */}
      {isOpen && onAddItem && (
        <div className="mt-4">
          {showAddForm ? (
            <AddItemForm
              onSave={handleAddItem}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5
                border border-dashed border-zinc-800/60 text-zinc-700
                hover:border-cyan-800/50 hover:text-zinc-500
                font-mono text-2xs uppercase tracking-[0.2em] transition-all"
            >
              <span>+ Add Item</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
