"use client";

import ListItemCard, { type ListItem } from "./ListItemCard";
import type { CurationTipData } from "./CurationTipCard";

type SortOption = "position" | "votes" | "newest";

interface CurationItemsListProps {
  items: ListItem[];
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  categoryColor: string;
  portalSlug: string;
  isOwner: boolean;
  canAddItems: boolean;
  confirmingRemoveId: string | null;
  tipsByItem: Record<string, CurationTipData[]>;
  onVote: (itemId: string, voteType: "up" | "down") => Promise<void>;
  onRemove: (itemId: string) => void;
  onCancelRemove: () => void;
  onAddItems: () => void;
}

export default function CurationItemsList({
  items,
  sortBy,
  onSortChange,
  categoryColor,
  portalSlug,
  isOwner,
  canAddItems,
  confirmingRemoveId,
  tipsByItem,
  onVote,
  onRemove,
  onCancelRemove,
  onAddItems,
}: CurationItemsListProps) {
  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === "votes") return b.vote_count - a.vote_count;
    if (sortBy === "newest") return b.position - a.position;
    return a.position - b.position;
  });

  // Empty state
  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/50 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-lg text-[var(--cream)] mb-2">This list is empty</h3>
        <p className="text-sm text-[var(--muted)] mb-4">
          {canAddItems
            ? "Add some items to get started!"
            : "The creator hasn't added any items yet."}
        </p>
        {canAddItems && (
          <button
            onClick={onAddItems}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Items
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Sort controls */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--twilight)]">
        <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
          {items.length} spot{items.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-[var(--muted)]">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            aria-label="Sort items by"
            className="px-2 py-1 rounded bg-[var(--twilight)] text-[var(--cream)] text-sm font-mono border-none focus:outline-none focus:ring-1 focus:ring-[var(--coral)]"
          >
            <option value="position">Ranking</option>
            <option value="votes">Most Voted</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {sortedItems.map((item, index) => (
          <div
            key={item.id}
            style={{
              animation: `stagger-fade-in 0.4s ease-out ${Math.min(index * 0.06, 0.6)}s backwards`,
            }}
          >
            <ListItemCard
              item={item}
              rank={sortBy === "position" ? item.position + 1 : index + 1}
              categoryColor={categoryColor}
              portalSlug={portalSlug}
              isOwner={isOwner}
              isConfirmingRemove={confirmingRemoveId === item.id}
              tips={tipsByItem[item.id] || []}
              onVote={onVote}
              onRemove={onRemove}
              onCancelRemove={onCancelRemove}
            />
          </div>
        ))}
      </div>

      {/* Add more items CTA */}
      {canAddItems && (
        <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
          <button
            onClick={onAddItems}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-[var(--twilight)] text-[var(--muted)] hover:border-[var(--coral)] hover:text-[var(--coral)] transition-colors font-mono text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add More Items
          </button>
        </div>
      )}
    </div>
  );
}
