"use client";

import { useState, useEffect, useCallback } from "react";
import { OnboardingSwipeCard } from "../components/OnboardingSwipeCard";
import type { OnboardingSwipeEvent, OnboardingMood } from "@/lib/types";

interface SwipeDiscoveryProps {
  mood: OnboardingMood | null;
  portalId: string | null;
  onComplete: (likedEvents: OnboardingSwipeEvent[]) => void;
  onSkip: () => void;
}

const MIN_SWIPES = 3;

export function SwipeDiscovery({ mood, portalId, onComplete, onSkip }: SwipeDiscoveryProps) {
  const [events, setEvents] = useState<OnboardingSwipeEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedEvents, setLikedEvents] = useState<OnboardingSwipeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<OnboardingSwipeEvent | null>(null);

  // Fetch swipe deck
  useEffect(() => {
    async function fetchDeck() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (mood) params.set("mood", mood);
        if (portalId) params.set("portal_id", portalId);
        params.set("limit", "8");

        const res = await fetch(`/api/onboarding/swipe-deck?${params}`);
        if (!res.ok) throw new Error("Failed to load events");

        const data = await res.json();
        setEvents(data.events || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        setLoading(false);
      }
    }

    fetchDeck();
  }, [mood, portalId]);

  const handleLike = useCallback(() => {
    const event = events[currentIndex];
    if (event) {
      setLikedEvents((prev) => [...prev, event]);
    }
    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, events]);

  const handleSkip = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
  }, []);

  const handleTap = useCallback(() => {
    const event = events[currentIndex];
    if (event) {
      setExpandedEvent(event);
    }
  }, [currentIndex, events]);

  const handleContinue = () => {
    onComplete(likedEvents);
  };

  const totalSwipes = currentIndex;
  const remainingCards = events.length - currentIndex;
  const canSkip = totalSwipes >= MIN_SWIPES;
  const isComplete = remainingCards === 0;

  // Render loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-[var(--muted)]">Loading events...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4">
        <p className="text-[var(--muted)] mb-4">{error}</p>
        <button
          onClick={onSkip}
          className="px-6 py-3 bg-[var(--coral)] text-[var(--void)] font-mono text-sm rounded-lg"
        >
          Continue anyway
        </button>
      </div>
    );
  }

  // Render expanded event detail
  if (expandedEvent) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--void)]/95 flex flex-col animate-fadeIn">
        <button
          onClick={() => setExpandedEvent(null)}
          className="absolute top-4 right-4 p-2 text-[var(--cream)]"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex-1 overflow-auto p-6 pt-16">
          <div className="max-w-md mx-auto">
            {/* Category */}
            {expandedEvent.category && (
              <span className="inline-block px-3 py-1 bg-[var(--coral)] text-[var(--void)] text-xs font-mono rounded-full mb-4">
                {expandedEvent.category.replace("_", " ")}
              </span>
            )}

            {/* Title */}
            <h2 className="text-2xl font-semibold text-[var(--cream)] mb-4">
              {expandedEvent.title}
            </h2>

            {/* Date & Time */}
            <div className="flex items-center gap-2 text-[var(--soft)] mb-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>
                {new Date(expandedEvent.start_date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                {expandedEvent.start_time && ` at ${expandedEvent.start_time.slice(0, 5)}`}
              </span>
            </div>

            {/* Venue */}
            {expandedEvent.venue && (
              <div className="flex items-center gap-2 text-[var(--soft)] mb-3">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>
                  {expandedEvent.venue.name}
                  {expandedEvent.venue.neighborhood && (
                    <span className="text-[var(--muted)]"> ({expandedEvent.venue.neighborhood})</span>
                  )}
                </span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-center gap-2 mb-6">
              <svg className="w-4 h-4 text-[var(--soft)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {expandedEvent.is_free ? (
                <span className="text-green-400">Free</span>
              ) : expandedEvent.price_min ? (
                <span className="text-[var(--soft)]">From ${expandedEvent.price_min}</span>
              ) : (
                <span className="text-[var(--muted)]">Price varies</span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setExpandedEvent(null);
                  handleSkip();
                }}
                className="flex-1 py-3 border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm rounded-lg hover:bg-[var(--twilight)] transition-colors"
              >
                Skip
              </button>
              <button
                onClick={() => {
                  setExpandedEvent(null);
                  handleLike();
                }}
                className="flex-1 py-3 bg-[var(--coral)] text-[var(--void)] font-mono text-sm rounded-lg hover:bg-[var(--rose)] transition-colors"
              >
                I&apos;m interested
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render complete state
  if (isComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 animate-fadeIn">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--coral)]/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-[var(--cream)] mb-2">
            Nice picks!
          </h2>
          <p className="text-sm text-[var(--muted)] mb-6">
            You liked {likedEvents.length} event{likedEvents.length !== 1 ? "s" : ""}
          </p>
          <button
            onClick={handleContinue}
            className="px-8 py-3 bg-[var(--coral)] text-[var(--void)] font-mono text-sm rounded-lg hover:bg-[var(--rose)] transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Render card stack
  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-120px)] px-4 py-6">
      {/* Header */}
      <div className="text-center mb-4 animate-fadeIn">
        <h1 className="text-xl sm:text-2xl font-semibold text-[var(--cream)] mb-1">
          Swipe to discover
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Right = interested, Left = skip
        </p>
      </div>

      {/* Progress indicator */}
      <div className="mb-4 text-center">
        {!canSkip && (
          <p className="text-xs text-[var(--coral)]">
            {MIN_SWIPES - totalSwipes} more to unlock your feed
          </p>
        )}
        {canSkip && (
          <p className="text-xs text-[var(--muted)]">
            {likedEvents.length} saved | {remainingCards} left
          </p>
        )}
      </div>

      {/* Card stack */}
      <div className="relative w-full max-w-sm aspect-[3/4] mb-6">
        {events
          .slice(currentIndex, currentIndex + 3)
          .reverse()
          .map((event, reverseIndex) => {
            const actualIndex = 2 - reverseIndex;
            return (
              <OnboardingSwipeCard
                key={event.id}
                event={event}
                onLike={handleLike}
                onSkip={handleSkip}
                onTap={handleTap}
                isTop={actualIndex === 0}
                index={actualIndex}
              />
            );
          })}
      </div>

      {/* Action buttons for desktop */}
      <div className="hidden sm:flex gap-4 mb-4">
        <button
          onClick={handleSkip}
          className="w-14 h-14 rounded-full border-2 border-[var(--muted)] text-[var(--muted)] hover:border-[var(--cream)] hover:text-[var(--cream)] transition-colors flex items-center justify-center"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <button
          onClick={handleLike}
          className="w-14 h-14 rounded-full bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)] transition-colors flex items-center justify-center"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Skip link */}
      {canSkip && (
        <button
          onClick={handleContinue}
          className="font-mono text-sm text-[var(--soft)] hover:text-[var(--cream)] transition-colors"
        >
          Continue with {likedEvents.length} pick{likedEvents.length !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
