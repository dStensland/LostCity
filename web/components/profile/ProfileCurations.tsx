"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ListCard from "@/components/community/ListCard";
import type { Curation } from "@/lib/curation-utils";

interface ProfileCurationsProps {
  userId: string;
  portalSlug?: string;
  isOwnProfile: boolean;
}

export default function ProfileCurations({ userId, portalSlug, isOwnProfile }: ProfileCurationsProps) {
  const [curations, setCurations] = useState<Curation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCurations() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ creator_id: userId });
        if (portalSlug) params.set("portal_slug", portalSlug);
        const res = await fetch(`/api/lists?${params}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setCurations(data.lists || []);
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchCurations();
  }, [userId, portalSlug]);

  // Sort: pinned first, then by created_at
  const sortedCurations = [...curations].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg skeleton-shimmer" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-2/3 skeleton-shimmer rounded" />
                <div className="h-4 w-1/2 skeleton-shimmer rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (curations.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--twilight)]/50 flex items-center justify-center">
          <svg className="w-7 h-7 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-sm text-[var(--muted)]">
          {isOwnProfile ? "You haven't created any curations yet." : "No curations yet."}
        </p>
        {isOwnProfile && portalSlug && (
          <Link
            href={`/${portalSlug}/curations`}
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm hover:bg-[var(--rose)] transition-colors"
          >
            Create Your First Curation
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedCurations.map((curation, index) => (
        <div
          key={curation.id}
          className="relative"
          style={{
            animation: `stagger-fade-in 0.4s ease-out ${Math.min(index * 0.06, 0.6)}s backwards`,
          }}
        >
          {curation.is_pinned && (
            <div className="absolute -top-1 -left-1 z-10 w-5 h-5 rounded-full bg-[var(--coral)] flex items-center justify-center">
              <svg className="w-3 h-3 text-[var(--void)]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.828 4.172a4 4 0 015.656 0l.344.344 1.06-1.06a1 1 0 011.414 1.414l-1.06 1.06.344.344a4 4 0 010 5.656l-2.828 2.828a1 1 0 01-1.414-1.414l2.828-2.828a2 2 0 000-2.828l-.344-.344L11 11.172a1 1 0 01-1.414-1.414L13.828 5.5l-.344-.344a2 2 0 00-2.828 0L7.828 8A1 1 0 016.414 6.586l2.828-2.828.586.586z" />
              </svg>
            </div>
          )}
          <ListCard list={curation} portalSlug={curation.portal?.slug || portalSlug || "atlanta"} />
        </div>
      ))}
    </div>
  );
}
