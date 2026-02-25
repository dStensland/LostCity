"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import type { ListItem } from "./ListItemCard";
import type { CurationTipData } from "./CurationTipCard";
import CurationHeader from "./CurationHeader";
import CurationItemsList from "./CurationItemsList";
import ContributionPanel from "./ContributionPanel";
import { AddItemsModal } from "@/components/community/AddItemsModal";
import ListEditModal from "@/components/community/ListEditModal";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { useToast } from "@/components/Toast";
import type { Curation } from "@/lib/curation-utils";
import { CATEGORY_COLORS } from "@/lib/curation-constants";

interface CurationViewProps {
  portalSlug: string;
  listSlug: string;
}

type SortOption = "position" | "votes" | "newest";

export default function CurationView({ portalSlug, listSlug }: CurationViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  // ── Core data ─────────────────────────────────────────────────────────
  const [list, setList] = useState<Curation | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────
  const [sortBy, setSortBy] = useState<SortOption>("position");
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);

  // ── Interaction state ─────────────────────────────────────────────────
  const [isVoting, setIsVoting] = useState(false);
  const [userListVote, setUserListVote] = useState<"up" | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [tipsByItem, setTipsByItem] = useState<Record<string, CurationTipData[]>>({});

  // ── Derived values ────────────────────────────────────────────────────
  const isOwner = user?.id === list?.creator_id;
  const canContribute = !isOwner && !!user && (!!list?.allow_contributions || list?.submission_mode === "open");
  const canAddItems = isOwner || canContribute;
  const categoryColor = list?.accent_color || (list?.category ? CATEGORY_COLORS[list.category] || "var(--coral)" : "var(--coral)");
  const accentClass = createCssVarClass("--accent-color", categoryColor, "accent");

  // ── Data fetching ─────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
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
      setIsFollowing(data.list.is_following || false);
      setFollowerCount(data.list.follower_count || 0);

      // Fetch tips non-blocking
      if (data.list.id) {
        fetch(`/api/curations/${data.list.id}/tips?limit=100`)
          .then((r) => (r.ok ? r.json() : null))
          .then((tipsData) => {
            if (tipsData?.tips) {
              const grouped: Record<string, CurationTipData[]> = {};
              for (const tip of tipsData.tips) {
                const key = tip.list_item_id || "__curation__";
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(tip);
              }
              setTipsByItem(grouped);
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error("Error fetching list:", err);
      setError("Unable to load this list");
    } finally {
      setLoading(false);
    }
  }, [listSlug, portalSlug]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const refreshItems = useCallback(async () => {
    if (!list?.id) return;
    try {
      const res = await fetch(`/api/lists?slug=${listSlug}&portal_slug=${portalSlug}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.list?.items) {
        setItems(data.list.items);
        setList((prev) => (prev ? { ...prev, item_count: data.list.items.length } : prev));
      }
    } catch {
      // Non-critical
    }
  }, [list?.id, listSlug, portalSlug]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleToggleFollow = useCallback(async () => {
    if (!user || !list || isTogglingFollow) return;
    setIsTogglingFollow(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowerCount((prev) => (wasFollowing ? prev - 1 : prev + 1));
    try {
      const res = await fetch(`/api/curations/${list.id}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.following);
        setFollowerCount(data.follower_count);
      } else {
        setIsFollowing(wasFollowing);
        setFollowerCount((prev) => (wasFollowing ? prev + 1 : prev - 1));
      }
    } catch {
      setIsFollowing(wasFollowing);
      setFollowerCount((prev) => (wasFollowing ? prev + 1 : prev - 1));
    } finally {
      setIsTogglingFollow(false);
    }
  }, [user, list, isFollowing, isTogglingFollow]);

  const handleVoteList = useCallback(async () => {
    if (!user || !list || isVoting) return;
    setIsVoting(true);
    const wasVoted = userListVote === "up";
    // Optimistic update
    setUserListVote(wasVoted ? null : "up");
    setList((prev) =>
      prev ? { ...prev, vote_count: wasVoted ? prev.vote_count - 1 : prev.vote_count + 1 } : null
    );
    try {
      const res = await fetch(`/api/lists/${list.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote_type: "up" }),
      });
      if (!res.ok) {
        // Revert on failure
        setUserListVote(wasVoted ? "up" : null);
        setList((prev) =>
          prev ? { ...prev, vote_count: wasVoted ? prev.vote_count + 1 : prev.vote_count - 1 } : null
        );
      }
    } catch {
      setUserListVote(wasVoted ? "up" : null);
      setList((prev) =>
        prev ? { ...prev, vote_count: wasVoted ? prev.vote_count + 1 : prev.vote_count - 1 } : null
      );
    } finally {
      setIsVoting(false);
    }
  }, [user, list, isVoting, userListVote]);

  const handleItemVote = useCallback(
    async (itemId: string, voteType: "up" | "down") => {
      if (!user || !list) return;
      await fetch(`/api/lists/${list.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, vote_type: voteType }),
      });
    },
    [user, list]
  );

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      if (!user || !list || !isOwner) return;

      if (confirmingRemoveId !== itemId) {
        setConfirmingRemoveId(itemId);
        return;
      }

      setConfirmingRemoveId(null);
      try {
        const res = await fetch(`/api/lists/${list.id}/items/${itemId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setItems((prev) => prev.filter((item) => item.id !== itemId));
          showToast("Item removed");
        }
      } catch {
        showToast("Failed to remove item", "error");
      }
    },
    [user, list, isOwner, confirmingRemoveId, showToast]
  );

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: list?.title,
          text: list?.description || `Check out this list: ${list?.title}`,
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard!");
    }
  }, [list, showToast]);

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="space-y-4">
          <div className="h-32 skeleton-shimmer rounded-xl -mx-4" />
          <div className="h-6 w-24 skeleton-shimmer rounded" />
          <div className="h-10 w-3/4 skeleton-shimmer rounded" />
          <div className="h-4 w-1/2 skeleton-shimmer rounded" />
          <div className="flex gap-3 mt-4">
            <div className="h-10 w-24 skeleton-shimmer rounded-lg" />
            <div className="h-10 w-24 skeleton-shimmer rounded-lg" />
          </div>
        </div>
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

  // ── Error state ───────────────────────────────────────────────────────
  if (error || !list) {
    return (
      <div className="py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] border border-[var(--twilight)] flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="font-serif text-lg text-[var(--cream)] mb-2">
          Curation not found
        </h3>
        <p className="text-sm text-[var(--muted)] mb-6 max-w-xs mx-auto">
          This curation may have been removed or made private.
        </p>
        <Link
          href={`/${portalSlug}/curations`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
        >
          Browse Curations
        </Link>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────
  return (
    <div className={accentClass?.className ?? ""}>
      <ScopedStyles css={accentClass?.css} />

      {/* Back link */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--coral)] transition-colors mb-6"
        aria-label="Go back"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header section */}
      <CurationHeader
        list={list}
        isOwner={isOwner}
        user={user}
        followerCount={followerCount}
        isFollowing={isFollowing}
        isTogglingFollow={isTogglingFollow}
        userListVote={userListVote}
        isVoting={isVoting}
        onVote={handleVoteList}
        onToggleFollow={handleToggleFollow}
        onShare={handleShare}
        onEdit={() => setShowEditModal(true)}
        onAddItems={() => setShowAddItemsModal(true)}
        canContribute={canContribute}
      />

      {/* Contribution invite banner */}
      {canContribute && (
        <ContributionPanel onSuggest={() => setShowAddItemsModal(true)} />
      )}

      {/* Items list with sorting */}
      <CurationItemsList
        items={items}
        sortBy={sortBy}
        onSortChange={setSortBy}
        categoryColor={categoryColor}
        portalSlug={portalSlug}
        isOwner={isOwner}
        canAddItems={canAddItems}
        confirmingRemoveId={confirmingRemoveId}
        tipsByItem={tipsByItem}
        onVote={handleItemVote}
        onRemove={handleRemoveItem}
        onCancelRemove={() => setConfirmingRemoveId(null)}
        onAddItems={() => setShowAddItemsModal(true)}
      />

      {/* Add Items Modal */}
      {showAddItemsModal && list && (
        <AddItemsModal
          listId={list.id}
          existingItems={items.map((item) => ({
            item_type: item.item_type,
            venue_id: item.venue_id ?? undefined,
            event_id: item.event_id ?? undefined,
            organization_id: item.organization_id ?? undefined,
          }))}
          onClose={() => setShowAddItemsModal(false)}
          onItemsAdded={() => {
            setShowAddItemsModal(false);
            refreshItems();
          }}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && list && (
        <ListEditModal
          list={list}
          portalSlug={portalSlug}
          onClose={() => setShowEditModal(false)}
          onUpdated={(updated) => {
            setList({ ...list, ...updated });
            setShowEditModal(false);
          }}
          onDeleted={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}
