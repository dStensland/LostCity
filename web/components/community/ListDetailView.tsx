"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "@/components/SmartImage";
import { useAuth } from "@/lib/auth-context";
import ListItemCard, { type ListItem } from "./ListItemCard";
import LinkifyText from "@/components/LinkifyText";
import { AddItemsModal } from "@/components/community/AddItemsModal";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

type ListDetail = {
  id: string;
  portal_id: string | null;
  creator_id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  is_public: boolean;
  status: string;
  created_at: string;
  item_count: number;
  vote_count: number;
  creator?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

interface ListDetailViewProps {
  portalSlug: string;
  listSlug: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  best_of: "Best Of",
  hidden_gems: "Hidden Gems",
  date_night: "Date Night",
  with_friends: "With Friends",
  solo: "Solo",
  budget: "Budget-Friendly",
  special_occasion: "Special Occasion",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  best_of: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  hidden_gems: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
  date_night: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  with_friends: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  solo: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  budget: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  special_occasion: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
    </svg>
  ),
};

const CATEGORY_COLORS: Record<string, string> = {
  best_of: "#FBBF24",
  hidden_gems: "#A78BFA",
  date_night: "#F472B6",
  with_friends: "#6EE7B7",
  solo: "#5EEAD4",
  budget: "#4ADE80",
  special_occasion: "#F9A8D4",
};

type SortOption = "position" | "votes" | "newest";

export default function ListDetailView({ portalSlug, listSlug }: ListDetailViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [list, setList] = useState<ListDetail | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("position");
  const [isVoting, setIsVoting] = useState(false);
  const [userListVote, setUserListVote] = useState<"up" | null>(null);
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);

  const fetchItems = async () => {
    if (!list?.id) return;

    try {
      const res = await fetch(`/api/lists?slug=${listSlug}&portal_slug=${portalSlug}`);
      if (!res.ok) throw new Error("Failed to load items");

      const data = await res.json();
      if (data.list?.items) {
        setItems(data.list.items);
        setList((prev) => prev ? { ...prev, item_count: data.list.items.length } : prev);
      }
    } catch (err) {
      console.error("Error fetching items:", err);
    }
  };

  useEffect(() => {
    async function fetchList() {
      try {
        setLoading(true);
        // Fetch list by slug - API returns full list with items
        const res = await fetch(`/api/lists?slug=${listSlug}&portal_slug=${portalSlug}`);

        if (!res.ok) {
          if (res.status === 404) {
            setError("List not found");
            return;
          }
          throw new Error("Failed to load list");
        }

        const data = await res.json();

        if (!data.list) {
          setError("List not found");
          return;
        }

        setList(data.list);
        setItems(data.list.items || []);
      } catch (err) {
        console.error("Error fetching list:", err);
        setError("Unable to load this list");
      } finally {
        setLoading(false);
      }
    }

    fetchList();
  }, [listSlug, portalSlug]);

  const isOwner = user?.id === list?.creator_id;
  const categoryColor = list?.category ? CATEGORY_COLORS[list.category] || "var(--coral)" : "var(--coral)";
  const accentClass = createCssVarClass("--accent-color", categoryColor, "accent");

  const handleVoteList = async () => {
    if (!user || !list || isVoting) return;

    setIsVoting(true);
    try {
      const res = await fetch(`/api/lists/${list.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote_type: "up" }),
      });

      if (res.ok) {
        const data = await res.json();
        setUserListVote(data.vote ? "up" : null);
        setList((prev) =>
          prev
            ? {
                ...prev,
                vote_count: data.vote
                  ? prev.vote_count + 1
                  : prev.vote_count - 1,
              }
            : null
        );
      }
    } catch (err) {
      console.error("Error voting:", err);
    } finally {
      setIsVoting(false);
    }
  };

  const handleItemVote = async (itemId: string, voteType: "up" | "down") => {
    if (!user || !list) return;

    try {
      await fetch(`/api/lists/${list.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, vote_type: voteType }),
      });
    } catch (err) {
      console.error("Error voting on item:", err);
      throw err;
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!user || !list || !isOwner) return;

    if (!confirm("Remove this item from the list?")) return;

    try {
      const res = await fetch(`/api/lists/${list.id}/items/${itemId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== itemId));
      }
    } catch (err) {
      console.error("Error removing item:", err);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: list?.title,
          text: list?.description || `Check out this list: ${list?.title}`,
          url,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  // Sort items
  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === "votes") {
      return b.vote_count - a.vote_count;
    }
    if (sortBy === "newest") {
      return b.position - a.position; // Assuming higher position = newer
    }
    return a.position - b.position;
  });

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        {/* Header skeleton */}
        <div className="space-y-4">
          <div className="h-6 w-24 skeleton-shimmer rounded" />
          <div className="h-10 w-3/4 skeleton-shimmer rounded" />
          <div className="h-4 w-1/2 skeleton-shimmer rounded" />
          <div className="flex gap-3 mt-4">
            <div className="h-10 w-24 skeleton-shimmer rounded-lg" />
            <div className="h-10 w-24 skeleton-shimmer rounded-lg" />
          </div>
        </div>
        {/* Items skeleton */}
        <div className="space-y-3 mt-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)]">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 skeleton-shimmer rounded-lg" />
                <div className="w-14 h-14 skeleton-shimmer rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-2/3 skeleton-shimmer rounded" />
                  <div className="h-4 w-1/2 skeleton-shimmer rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] border border-[var(--twilight)] flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="font-serif text-lg text-[var(--cream)] mb-2">
          List not found
        </h3>
        <p className="text-sm text-[var(--muted)] mb-6 max-w-xs mx-auto">
          This list may have been removed or made private.
        </p>
        <Link
          href={`/${portalSlug}?view=community&tab=lists`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
        >
          Browse Lists
        </Link>
      </div>
    );
  }

  return (
    <div className={accentClass?.className ?? ""}>
      <ScopedStyles css={accentClass?.css} />
      {/* Back link */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--coral)] transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* List Header */}
      <header className="mb-8">
        {/* Category badge */}
        {list.category && (
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider mb-4 bg-accent-20 text-accent"
          >
            {CATEGORY_ICONS[list.category]}
            {CATEGORY_LABELS[list.category] || list.category}
          </div>
        )}

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[var(--cream)] mb-2">
          {list.title}
        </h1>

        {/* Description */}
        {list.description && (
          <p className="text-[var(--soft)] leading-relaxed mb-4 whitespace-pre-wrap">
            <LinkifyText text={list.description} />
          </p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
          {/* Creator */}
          {list.creator && (
            <div className="flex items-center gap-2">
              {list.creator.avatar_url ? (
                <Image
                  src={list.creator.avatar_url}
                  alt={list.creator.display_name || list.creator.username}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-accent text-[var(--void)]"
                >
                  {(list.creator.display_name || list.creator.username).charAt(0).toUpperCase()}
                </div>
              )}
              <span>
                {list.creator.display_name || `@${list.creator.username}`}
              </span>
            </div>
          )}

          <span className="opacity-40">·</span>

          {/* Stats */}
          {list.vote_count > 0 && (
            <>
              <div className="flex items-center gap-1 text-accent">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                <span className="font-mono">{list.vote_count} vote{list.vote_count !== 1 ? "s" : ""}</span>
              </div>
              <span className="opacity-40">·</span>
            </>
          )}

          <span className="font-mono">{list.item_count} spot{list.item_count !== 1 ? "s" : ""}</span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3 mt-6">
          {/* Upvote button */}
          <button
            onClick={handleVoteList}
            disabled={!user || isVoting}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-sm font-medium transition-all ${
              userListVote === "up"
                ? "bg-[var(--coral)] text-[var(--void)]"
                : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/80"
            } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
            title={user ? "Upvote this list" : "Sign in to vote"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            {userListVote === "up" ? "Upvoted" : "Upvote"}
          </button>

          {/* Share button */}
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm font-medium hover:bg-[var(--twilight)]/80 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>

          {/* Owner: Edit button */}
          {isOwner && (
            <button
              onClick={() => setShowAddItemsModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--twilight)] text-[var(--muted)] font-mono text-sm hover:text-[var(--cream)] hover:border-[var(--soft)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
        </div>
      </header>

      {/* Sort controls */}
      {items.length > 0 && (
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--twilight)]">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
            {items.length} spot{items.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[var(--muted)]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-2 py-1 rounded bg-[var(--twilight)] text-[var(--cream)] text-sm font-mono border-none focus:outline-none focus:ring-1 focus:ring-[var(--coral)]"
            >
              <option value="position">Ranking</option>
              <option value="votes">Most Voted</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>
      )}

      {/* List items */}
      {items.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/50 flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg text-[var(--cream)] mb-2">This list is empty</h3>
          <p className="text-sm text-[var(--muted)] mb-4">
            {isOwner
              ? "Add some items to get started!"
              : "The creator hasn't added any items yet."}
          </p>
          {isOwner && (
            <button
              onClick={() => setShowAddItemsModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Items
            </button>
          )}
        </div>
      ) : (
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
                onVote={handleItemVote}
                onRemove={handleRemoveItem}
              />
            </div>
          ))}
        </div>
      )}

      {/* Owner: Add more items CTA */}
      {isOwner && items.length > 0 && (
        <div className="mt-6 pt-6 border-t border-[var(--twilight)]">
          <button
            onClick={() => setShowAddItemsModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-[var(--twilight)] text-[var(--muted)] hover:border-[var(--coral)] hover:text-[var(--coral)] transition-colors font-mono text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add More Items
          </button>
        </div>
      )}

      {/* Add Items Modal */}
      {showAddItemsModal && list && (
        <AddItemsModal
          listId={list.id}
          existingItems={items.map(item => ({
            item_type: item.item_type,
            venue_id: item.venue_id ?? undefined,
            event_id: item.event_id ?? undefined,
            organization_id: item.organization_id ?? undefined
          }))}
          onClose={() => setShowAddItemsModal(false)}
          onItemsAdded={() => {
            setShowAddItemsModal(false);
            fetchItems();
          }}
        />
      )}
    </div>
  );
}
