"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import EventCard from "@/components/EventCard";
import type { Event } from "@/lib/supabase";

interface ClassesViewProps {
  portalId: string;
  portalSlug: string;
}

const CLASS_CATEGORIES = [
  { key: "all", label: "All" },
  { key: "painting", label: "Painting" },
  { key: "cooking", label: "Cooking" },
  { key: "pottery", label: "Pottery" },
  { key: "dance", label: "Dance" },
  { key: "fitness", label: "Fitness" },
  { key: "woodworking", label: "Woodworking" },
  { key: "floral", label: "Floral" },
  { key: "photography", label: "Photo" },
  { key: "candle-making", label: "Candles" },
  { key: "outdoor-skills", label: "Outdoor" },
  { key: "mixed", label: "Mixed" },
] as const;

const PAGE_SIZE = 20;

export default function ClassesView({
  portalId,
  portalSlug,
}: ClassesViewProps) {
  const [classes, setClasses] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState("all");
  const offsetRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchClasses = useCallback(
    async (offset: number, cat: string, append = false) => {
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        if (cat !== "all") params.set("class_category", cat);
        if (portalId) params.set("portal_id", portalId);

        const res = await fetch(`/api/classes?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();

        const newClasses = data.classes || [];
        if (append) {
          setClasses((prev) => [...prev, ...newClasses]);
        } else {
          setClasses(newClasses);
        }
        setTotal(data.total ?? 0);
        setHasMore(offset + PAGE_SIZE < (data.total ?? 0));
        offsetRef.current = offset + PAGE_SIZE;
      } catch {
        // fail silently
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [portalId]
  );

  // Initial load and category change
  useEffect(() => {
    offsetRef.current = 0;
    fetchClasses(0, category);
  }, [category, fetchClasses]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) {
          fetchClasses(offsetRef.current, category, true);
        }
      },
      { rootMargin: "200px" }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, loading, category, fetchClasses]);

  return (
    <div>
      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {CLASS_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full font-mono text-xs whitespace-nowrap transition-all ${
              category === cat.key
                ? "bg-[var(--coral)] text-[var(--void)] font-medium shadow-[0_0_12px_var(--coral)/20]"
                : "bg-[var(--night)] text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 border border-[var(--twilight)]"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Results count */}
      {!loading && (
        <div className="text-xs font-mono text-[var(--muted)] mb-3">
          {total} {total === 1 ? "class" : "classes"} found
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 skeleton-shimmer rounded-xl" />
          ))}
        </div>
      )}

      {/* Classes list */}
      {!loading && classes.length > 0 && (
        <div>
          {classes.map((event, index) => (
            <EventCard
              key={event.id}
              event={event}
              index={index}
              skipAnimation={index >= 10}
              portalSlug={portalSlug}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && classes.length === 0 && (
        <div className="py-16 text-center">
          <div className="text-[var(--muted)] font-mono text-sm">
            No classes found
          </div>
          <div className="text-[var(--muted)]/60 font-mono text-xs mt-2">
            Try a different category or check back later
          </div>
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="py-4 text-center">
          <div className="inline-flex items-center gap-2 text-[var(--muted)] font-mono text-xs">
            <div className="w-3 h-3 border border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
            Loading more classes...
          </div>
        </div>
      )}
    </div>
  );
}
