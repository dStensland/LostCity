"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import { useAuth } from "@/lib/auth-context";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

export type ListItem = {
  id: string;
  list_id: string;
  item_type: "venue" | "event" | "organization" | "custom";
  venue_id: number | null;
  event_id: number | null;
  organization_id: number | null;
  custom_name: string | null;
  custom_description: string | null;
  note?: string | null;
  position: number;
  vote_count: number;
  user_vote: "up" | "down" | null;
  venue?: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    venue_type: string | null;
    image_url?: string | null;
  } | null;
  event?: {
    id: number;
    title: string;
    start_date: string;
    image_url?: string | null;
    venue?: { name: string } | null;
  } | null;
  organization?: {
    id: number;
    name: string;
    slug: string;
    image_url?: string | null;
  } | null;
};

interface ListItemCardProps {
  item: ListItem;
  rank: number;
  categoryColor: string;
  portalSlug: string;
  isOwner?: boolean;
  onVote?: (itemId: string, voteType: "up" | "down") => void;
  onRemove?: (itemId: string) => void;
  onNoteChange?: (itemId: string, note: string) => void;
}

const SPOT_TYPE_LABELS: Record<string, string> = {
  music_venue: "Music Venue",
  bar: "Bar",
  restaurant: "Restaurant",
  coffee_shop: "Coffee Shop",
  brewery: "Brewery",
  gallery: "Gallery",
  club: "Club",
  nightclub: "Nightclub",
  theater: "Theater",
  arena: "Arena",
  comedy_club: "Comedy Club",
  museum: "Museum",
  distillery: "Distillery",
  winery: "Winery",
  food_hall: "Food Hall",
  rooftop: "Rooftop",
  sports_bar: "Sports Bar",
  event_space: "Event Space",
  park: "Park",
  bookstore: "Bookstore",
};

export default function ListItemCard({
  item,
  rank,
  categoryColor,
  portalSlug,
  isOwner = false,
  onVote,
  onRemove,
  onNoteChange,
}: ListItemCardProps) {
  const { user } = useAuth();
  const [isVoting, setIsVoting] = useState(false);
  const [localVote, setLocalVote] = useState(item.user_vote);
  const [localVoteCount, setLocalVoteCount] = useState(item.vote_count);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(item.note || "");
  const accentClass = createCssVarClass("--accent-color", categoryColor, "accent");

  // Determine display info based on item type
  const getDisplayInfo = () => {
    if (item.item_type === "venue" && item.venue) {
      return {
        name: item.venue.name,
        subtitle: item.venue.venue_type
          ? SPOT_TYPE_LABELS[item.venue.venue_type] || item.venue.venue_type
          : null,
        location: item.venue.neighborhood,
        href: `/${portalSlug}?spot=${item.venue.slug}`,
        image: item.venue.image_url,
      };
    }
    if (item.item_type === "event" && item.event) {
      return {
        name: item.event.title,
        subtitle: "Event",
        location: item.event.venue?.name,
        href: `/${portalSlug}?event=${item.event.id}`,
        image: item.event.image_url,
      };
    }
    if (item.item_type === "organization" && item.organization) {
      return {
        name: item.organization.name,
        subtitle: "Organization",
        location: null,
        href: `/${portalSlug}?org=${item.organization.slug}`,
        image: item.organization.image_url,
      };
    }
    // Custom item
    return {
      name: item.custom_name || "Custom Item",
      subtitle: null,
      location: null,
      href: null,
      image: null,
    };
  };

  const display = getDisplayInfo();

  const handleVote = async (voteType: "up" | "down") => {
    if (!user || isVoting) return;

    setIsVoting(true);
    const previousVote = localVote;
    const previousCount = localVoteCount;

    // Optimistic update
    if (localVote === voteType) {
      // Removing vote
      setLocalVote(null);
      setLocalVoteCount((prev) => prev - (voteType === "up" ? 1 : -1));
    } else {
      // Adding or changing vote
      if (localVote) {
        // Had previous vote, swing the count
        setLocalVoteCount((prev) => prev + (voteType === "up" ? 2 : -2));
      } else {
        // New vote
        setLocalVoteCount((prev) => prev + (voteType === "up" ? 1 : -1));
      }
      setLocalVote(voteType);
    }

    try {
      if (onVote) {
        await onVote(item.id, voteType);
      }
    } catch {
      // Revert on error
      setLocalVote(previousVote);
      setLocalVoteCount(previousCount);
    } finally {
      setIsVoting(false);
    }
  };

  const handleSaveNote = () => {
    if (onNoteChange) {
      onNoteChange(item.id, noteText);
    }
    setIsEditingNote(false);
  };

  const content = (
    <div className={`flex items-start gap-3 ${accentClass?.className ?? ""}`}>
      <ScopedStyles css={accentClass?.css} />
      {/* Rank badge */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-mono text-sm font-bold bg-accent-20 text-accent"
      >
        {rank}
      </div>

      {/* Thumbnail */}
      <div
        className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-[var(--twilight)] bg-accent-10"
      >
        {display.image ? (
          <Image
            src={display.image}
            alt={display.name}
            width={56}
            height={56}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {item.item_type === "venue" && (
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            {item.item_type === "event" && (
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
            {item.item_type === "organization" && (
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            )}
            {item.item_type === "custom" && (
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-[var(--cream)] line-clamp-1 group-hover:text-[var(--coral)] transition-colors">
          {display.name}
        </h4>
        <div className="flex items-center gap-2 text-xs text-[var(--muted)] mt-0.5">
          {display.subtitle && <span>{display.subtitle}</span>}
          {display.subtitle && display.location && <span className="opacity-40">·</span>}
          {display.location && <span>{display.location}</span>}
        </div>

        {/* Note */}
        {(item.note || isEditingNote) && (
          <div className="mt-2">
            {isEditingNote ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note..."
                  className="flex-1 px-2 py-1 text-xs bg-[var(--night)] border border-[var(--twilight)] rounded text-[var(--cream)] placeholder-[var(--muted)]"
                  autoFocus
                />
                <button
                  onClick={handleSaveNote}
                  className="px-2 py-1 text-xs bg-[var(--coral)] text-[var(--void)] rounded hover:bg-[var(--rose)] transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditingNote(false);
                    setNoteText(item.note || "");
                  }}
                  className="px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <p
                className="text-xs text-[var(--soft)] italic cursor-pointer hover:text-[var(--cream)] transition-colors"
                onClick={(e) => {
                  if (isOwner) {
                    e.preventDefault();
                    setIsEditingNote(true);
                  }
                }}
              >
                &ldquo;{item.note}&rdquo;
              </p>
            )}
          </div>
        )}
      </div>

      {/* Vote buttons */}
      <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
        <button
          onClick={(e) => {
            e.preventDefault();
            handleVote("up");
          }}
          disabled={!user || isVoting}
          className={`p-1.5 rounded transition-all ${
            localVote === "up"
              ? "text-[var(--coral)] bg-[var(--coral)]/10"
              : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50"
          } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
          title={user ? "Upvote" : "Sign in to vote"}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <span
          className={`font-mono text-xs font-medium ${localVoteCount > 0 ? "text-accent" : "text-[var(--muted)]"}`}
        >
          {localVoteCount}
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            handleVote("down");
          }}
          disabled={!user || isVoting}
          className={`p-1.5 rounded transition-all ${
            localVote === "down"
              ? "text-[var(--neon-red)] bg-[var(--neon-red)]/10"
              : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50"
          } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
          title={user ? "Downvote" : "Sign in to vote"}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Owner actions */}
      {isOwner && (
        <div className="flex flex-col gap-1 flex-shrink-0">
          {!item.note && !isEditingNote && (
            <button
              onClick={(e) => {
                e.preventDefault();
                setIsEditingNote(true);
              }}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              title="Add note"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => {
              e.preventDefault();
              if (onRemove) onRemove(item.id);
            }}
            className="p-1.5 text-[var(--muted)] hover:text-[var(--neon-red)] transition-colors"
            title="Remove from list"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );

  // Wrap in link if we have a destination
  if (display.href) {
    return (
      <Link
        href={display.href}
        scroll={false}
        className="block p-3 rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] hover:border-[var(--twilight)]/80 transition-all group"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="p-3 rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)]">
      {content}
    </div>
  );
}
