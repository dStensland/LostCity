"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import type { OnboardingSwipeEvent } from "@/lib/types";

interface FeedPreviewProps {
  likedEvents: OnboardingSwipeEvent[];
  onComplete: (followedProducerIds: number[]) => void;
  portalSlug: string | null;
}

interface Producer {
  id: number;
  name: string;
  slug: string;
}

export function FeedPreview({ likedEvents, onComplete, portalSlug }: FeedPreviewProps) {
  // Extract unique producers from liked events
  const producers = useMemo(() => {
    const seen = new Set<number>();
    const result: Producer[] = [];

    likedEvents.forEach((event) => {
      if (event.producer && !seen.has(event.producer.id)) {
        seen.add(event.producer.id);
        result.push(event.producer);
      }
    });

    return result;
  }, [likedEvents]);

  const [followedProducers, setFollowedProducers] = useState<number[]>(
    producers.map((p) => p.id)
  );
  const [saving, setSaving] = useState(false);

  const toggleProducer = (id: number) => {
    setFollowedProducers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleComplete = async () => {
    setSaving(true);
    await onComplete(followedProducers);
  };

  // Pick up to 3 events to preview
  const previewEvents = likedEvents.slice(0, 3);

  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-120px)] px-4 py-6">
      <div className="w-full max-w-md animate-fadeIn">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--coral)]/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h1 className="font-serif text-xl sm:text-2xl text-[var(--cream)] italic mb-1">
            Your feed is ready
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Here&apos;s a preview of what you&apos;ll discover
          </p>
        </div>

        {/* Preview cards */}
        {previewEvents.length > 0 && (
          <div className="space-y-3 mb-6">
            {previewEvents.map((event) => (
              <div
                key={event.id}
                className="flex gap-3 p-3 bg-[var(--dusk)]/50 rounded-xl border border-[var(--twilight)]"
              >
                {/* Image */}
                {event.image_url && (
                  <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden">
                    <Image
                      src={event.image_url}
                      alt={event.title}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[var(--cream)] line-clamp-1">
                    {event.title}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {new Date(event.start_date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  {event.venue && (
                    <p className="text-xs text-[var(--soft)] truncate">
                      {event.venue.name}
                    </p>
                  )}
                </div>

                {/* Saved indicator */}
                <div className="flex-shrink-0 self-center">
                  <svg className="w-5 h-5 text-[var(--coral)]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Producer follows */}
        {producers.length > 0 && (
          <div className="mb-6">
            <h2 className="font-mono text-sm text-[var(--soft)] mb-3">
              Follow these organizers?
            </h2>
            <div className="space-y-2">
              {producers.map((producer) => {
                const isFollowed = followedProducers.includes(producer.id);
                return (
                  <button
                    key={producer.id}
                    onClick={() => toggleProducer(producer.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                      isFollowed
                        ? "border-[var(--coral)] bg-[var(--coral)]/10"
                        : "border-[var(--twilight)] hover:border-[var(--soft)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--twilight)] flex items-center justify-center">
                        <span className="font-mono text-xs text-[var(--muted)]">
                          {producer.name.charAt(0)}
                        </span>
                      </div>
                      <span className="font-medium text-sm text-[var(--cream)]">
                        {producer.name}
                      </span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isFollowed
                          ? "border-[var(--coral)] bg-[var(--coral)]"
                          : "border-[var(--twilight)]"
                      }`}
                    >
                      {isFollowed && (
                        <svg className="w-3 h-3 text-[var(--void)]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Complete button */}
        <button
          onClick={handleComplete}
          disabled={saving}
          className="w-full py-4 bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-[var(--void)] border-t-transparent rounded-full animate-spin" />
              Setting up...
            </span>
          ) : (
            `Explore ${portalSlug ? portalSlug : "your feed"}`
          )}
        </button>
      </div>
    </div>
  );
}
