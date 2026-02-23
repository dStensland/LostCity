"use client";

import Image from "@/components/SmartImage";
import LinkifyText from "@/components/LinkifyText";
import type { Curation } from "@/lib/curation-utils";
import { CATEGORY_LABELS, CATEGORY_ICONS, CATEGORY_GRADIENTS, DEFAULT_GRADIENT } from "@/lib/curation-constants";

interface CurationHeaderProps {
  list: Curation;
  isOwner: boolean;
  user: { id: string } | null;
  followerCount: number;
  isFollowing: boolean;
  isTogglingFollow: boolean;
  userListVote: "up" | null;
  isVoting: boolean;
  onVote: () => void;
  onToggleFollow: () => void;
  onShare: () => void;
  onEdit: () => void;
  onAddItems: () => void;
  canContribute: boolean;
}

export default function CurationHeader({
  list,
  isOwner,
  user,
  followerCount,
  isFollowing,
  isTogglingFollow,
  userListVote,
  isVoting,
  onVote,
  onToggleFollow,
  onShare,
  onEdit,
  onAddItems,
  canContribute,
}: CurationHeaderProps) {
  const gradient =
    (list.category ? CATEGORY_GRADIENTS[list.category] : null) || DEFAULT_GRADIENT;

  return (
    <header className="mb-8">
      {/* Cover Image or gradient fallback */}
      {list.cover_image_url ? (
        <div className="relative -mx-4 mb-6 h-48 sm:h-64 overflow-hidden rounded-xl">
          <Image
            src={list.cover_image_url}
            alt={list.title}
            width={800}
            height={400}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--void)] via-transparent to-transparent" />
        </div>
      ) : (
        <div
          className="relative -mx-4 mb-6 h-32 sm:h-40 overflow-hidden rounded-xl flex items-end"
          style={{ background: gradient }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--void)] via-[var(--void)]/30 to-transparent" />
          {/* Large category icon */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 scale-[3] text-white">
            {list.category ? CATEGORY_ICONS[list.category] : null}
          </div>
        </div>
      )}

      {/* Vibe Tags */}
      {list.vibe_tags && list.vibe_tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {list.vibe_tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded-full text-xs font-mono bg-accent-20 text-accent"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Category badge */}
      {list.category && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider mb-4 bg-accent-20 text-accent">
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
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-accent text-[var(--void)]">
                {(list.creator.display_name || list.creator.username).charAt(0).toUpperCase()}
              </div>
            )}
            <span>
              {list.creator.display_name || `@${list.creator.username}`}
            </span>
          </div>
        )}

        <span className="opacity-40">·</span>

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

        {followerCount > 0 && (
          <>
            <span className="opacity-40">·</span>
            <span className="font-mono">{followerCount} follower{followerCount !== 1 ? "s" : ""}</span>
          </>
        )}

        {(list.allow_contributions || list.submission_mode === "open") && (
          <>
            <span className="opacity-40">·</span>
            <span className="flex items-center gap-1 text-[var(--soft)]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Open to suggestions
            </span>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 mt-6">
        {/* Upvote */}
        <button
          onClick={onVote}
          disabled={!user || isVoting}
          aria-label={userListVote === "up" ? "Remove upvote" : "Upvote this curation"}
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

        {/* Follow */}
        {!isOwner && (
          <button
            onClick={onToggleFollow}
            disabled={!user || isTogglingFollow}
            aria-label={isFollowing ? "Unfollow this curation" : "Follow this curation"}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-sm font-medium transition-all ${
              isFollowing
                ? "bg-accent text-[var(--void)]"
                : "bg-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/80"
            } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
            title={user ? (isFollowing ? "Unfollow" : "Follow") : "Sign in to follow"}
          >
            <svg className="w-4 h-4" fill={isFollowing ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {isFollowing ? "Following" : "Follow"}
          </button>
        )}

        {/* Share */}
        <button
          onClick={onShare}
          aria-label="Share this curation"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm font-medium hover:bg-[var(--twilight)]/80 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share
        </button>

        {/* Owner: Edit */}
        {isOwner && (
          <button
            onClick={onEdit}
            aria-label="Edit curation settings"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--twilight)] text-[var(--muted)] font-mono text-sm hover:text-[var(--cream)] hover:border-[var(--soft)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
        )}

        {/* Owner: Add Items */}
        {isOwner && (
          <button
            onClick={onAddItems}
            aria-label="Add items to curation"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--twilight)] text-[var(--muted)] font-mono text-sm hover:text-[var(--cream)] hover:border-[var(--soft)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Items
          </button>
        )}

        {/* Contributor: Suggest */}
        {canContribute && (
          <button
            onClick={onAddItems}
            aria-label="Suggest an item for this curation"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--twilight)] text-[var(--muted)] font-mono text-sm hover:text-[var(--cream)] hover:border-[var(--soft)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Suggest
          </button>
        )}
      </div>
    </header>
  );
}
