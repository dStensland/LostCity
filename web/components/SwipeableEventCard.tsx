"use client";

import { useCallback, useState } from "react";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import EventCard, { type FriendGoing } from "./EventCard";
import type { Event } from "@/lib/supabase";

type EventCardEvent = Event & {
  is_live?: boolean;
  venue?: Event["venue"] & {
    typical_price_min?: number | null;
    typical_price_max?: number | null;
  } | null;
  category_data?: {
    typical_price_min: number | null;
    typical_price_max: number | null;
  } | null;
};

interface SwipeableEventCardProps {
  event: EventCardEvent;
  index?: number;
  skipAnimation?: boolean;
  portalSlug?: string;
  friendsGoing?: FriendGoing[];
  onSave?: (eventId: number) => void;
  onShare?: (eventId: number) => void;
  isSaved?: boolean;
}

export default function SwipeableEventCard({
  event,
  index = 0,
  skipAnimation = false,
  portalSlug,
  friendsGoing = [],
  onSave,
  onShare,
  isSaved = false,
}: SwipeableEventCardProps) {
  const [saved, setSaved] = useState(isSaved);

  const handleSave = useCallback(() => {
    setSaved((prev) => !prev);
    onSave?.(event.id);
  }, [event.id, onSave]);

  const handleShare = useCallback(async () => {
    // Use portal-aware URL structure
    const shareUrl = portalSlug
      ? `${window.location.origin}/${portalSlug}?event=${event.id}`
      : `${window.location.origin}/events/${event.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: `Check out ${event.title}`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
        if ((err as Error).name !== "AbortError") {
          // Fallback: copy to clipboard
          navigator.clipboard.writeText(shareUrl);
        }
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl);
    }
    onShare?.(event.id);
  }, [event.id, event.title, portalSlug, onShare]);

  const { containerRef, contentStyle, swipeOffset, isSwipingLeft, isSwipingRight, leftActionRevealed, rightActionRevealed } =
    useSwipeGesture({
      leftAction: {
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        ),
        label: "Share",
        color: "var(--coral)",
        onAction: handleShare,
      },
      rightAction: {
        icon: saved ? (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        ),
        label: saved ? "Unsave" : "Save",
        color: "var(--coral)",
        onAction: handleSave,
      },
      threshold: 60,
      maxSwipe: 80,
    });

  // Calculate action visibility
  const leftProgress = Math.min(Math.abs(swipeOffset) / 60, 1);
  const rightProgress = Math.min(swipeOffset / 60, 1);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-lg mb-4"
    >
      {/* Left action (Share) - revealed when swiping left */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center px-6 transition-opacity"
        style={{
          backgroundColor: "var(--coral)",
          opacity: isSwipingLeft ? leftProgress : 0,
          width: Math.abs(swipeOffset) + 20,
        }}
      >
        <div className={`flex flex-col items-center text-[var(--void)] ${leftActionRevealed ? "scale-110" : ""} transition-transform`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="text-xs font-medium mt-1">Share</span>
        </div>
      </div>

      {/* Right action (Save) - revealed when swiping right */}
      <div
        className="absolute inset-y-0 left-0 flex items-center justify-center px-6 transition-opacity"
        style={{
          backgroundColor: "var(--coral)",
          opacity: isSwipingRight ? rightProgress : 0,
          width: swipeOffset + 20,
        }}
      >
        <div className={`flex flex-col items-center text-[var(--void)] ${rightActionRevealed ? "scale-110" : ""} transition-transform`}>
          {saved ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          )}
          <span className="text-xs font-medium mt-1">{saved ? "Saved" : "Save"}</span>
        </div>
      </div>

      {/* Event card content */}
      <div style={contentStyle}>
        <EventCard
          event={event}
          index={index}
          skipAnimation={skipAnimation}
          portalSlug={portalSlug}
          friendsGoing={friendsGoing}
        />
      </div>
    </div>
  );
}
