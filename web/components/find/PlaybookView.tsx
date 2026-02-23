"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import PlaybookDateNav from "./PlaybookDateNav";
import PlaybookCard, { type PlaybookItemData } from "./PlaybookCard";

interface PlaybookViewProps {
  portalId: string;
  portalSlug: string;
  onPlanAroundEvent?: (item: PlaybookItemData) => void;
}

type TimeBlock = {
  label: string;
  time_slot: string;
  items: PlaybookItemData[];
};

type PlaybookData = {
  date: string;
  time_blocks: TimeBlock[];
  context: { time_slot: string; weather_signal?: string };
};

const CATEGORY_CHIPS = [
  { key: "all", label: "All" },
  { key: "music", label: "Music" },
  { key: "food", label: "Food & Drink" },
  { key: "art", label: "Art" },
  { key: "comedy", label: "Comedy" },
  { key: "nightlife", label: "Nightlife" },
  { key: "festival", label: "Festivals" },
  { key: "happy_hour", label: "Happy Hour" },
] as const;

function getLocalDateString(): string {
  const now = new Date();
  return format(now, "yyyy-MM-dd");
}

export default function PlaybookView({ portalSlug, onPlanAroundEvent }: PlaybookViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [data, setData] = useState<PlaybookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derive state from URL params
  const selectedDate = searchParams?.get("date") || getLocalDateString();
  const selectedCategory = searchParams?.get("categories") || "all";
  const activeNow = searchParams?.get("active_now") === "true";

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      // Preserve required find params
      params.set("view", "find");
      params.set("type", "playbook");
      router.push(`/${portalSlug}?${params.toString()}`, { scroll: false });
    },
    [portalSlug, router, searchParams],
  );

  const handleDateChange = useCallback(
    (date: string) => updateParam("date", date === getLocalDateString() ? null : date),
    [updateParam],
  );

  const handleCategoryChange = useCallback(
    (cat: string) => updateParam("categories", cat === "all" ? null : cat),
    [updateParam],
  );

  const handleActiveNowToggle = useCallback(
    () => updateParam("active_now", activeNow ? null : "true"),
    [updateParam, activeNow],
  );

  // Fetch playbook data
  useEffect(() => {
    let cancelled = false;

    async function fetchPlaybook() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedDate !== getLocalDateString()) {
        params.set("date", selectedDate);
      }
      if (selectedCategory !== "all") {
        params.set("categories", selectedCategory);
      }
      if (activeNow) {
        params.set("active_now", "true");
      }

      try {
        const res = await fetch(
          `/api/portals/${portalSlug}/playbook?${params.toString()}`,
        );
        if (!res.ok) throw new Error("Failed to load playbook");
        const json = await res.json();
        if (!cancelled) {
          setData(json);
        }
      } catch {
        if (!cancelled) {
          setError("Something went wrong loading the playbook.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPlaybook();
    return () => { cancelled = true; };
  }, [portalSlug, selectedDate, selectedCategory, activeNow]);

  // Total item count
  const totalItems = useMemo(
    () => data?.time_blocks.reduce((sum, b) => sum + b.items.length, 0) ?? 0,
    [data],
  );

  return (
    <div className="space-y-4">
      {/* Date Navigation */}
      <PlaybookDateNav selectedDate={selectedDate} onDateChange={handleDateChange} />

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-1.5">
        {/* Active Now toggle */}
        <button
          onClick={handleActiveNowToggle}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 ${
            activeNow
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-semibold"
              : "bg-[var(--void)]/50 border border-[var(--twilight)]/60 text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--twilight)]"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${activeNow ? "bg-emerald-400 animate-pulse" : "bg-[var(--muted)]/40"}`} />
          Active Now
        </button>

        {/* Category chips */}
        {CATEGORY_CHIPS.map((chip) => {
          const isActive = selectedCategory === chip.key;
          return (
            <button
              key={chip.key}
              onClick={() => handleCategoryChange(chip.key)}
              className={`px-3 py-1.5 rounded-full font-mono text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 ${
                isActive
                  ? "bg-[var(--coral)]/20 text-[var(--coral)] border border-[var(--coral)]/40 font-semibold"
                  : "bg-[var(--void)]/50 border border-[var(--twilight)]/60 text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--twilight)]"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 skeleton-shimmer rounded-xl" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-12">
          <p className="text-sm text-[var(--muted)]">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && totalItems === 0 && (
        <div className="text-center py-16">
          <p className="text-lg font-mono text-[var(--cream)] mb-2">Nothing happening</p>
          <p className="text-sm text-[var(--muted)]">
            {activeNow
              ? "Nothing active right now. Try removing the filter."
              : "No events or specials found for this date. Try a different day."}
          </p>
        </div>
      )}

      {/* Time blocks */}
      {!loading && !error && data && data.time_blocks.map((block) => (
        <section key={block.time_slot}>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-mono text-sm font-semibold text-[var(--cream)]">
              {block.label}
            </h2>
            <span className="text-[10px] font-mono text-[var(--muted)]/60 bg-[var(--twilight)]/30 px-1.5 py-0.5 rounded">
              {block.items.length}
            </span>
            {block.time_slot === "happening_now" && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </div>
          <div className="space-y-2">
            {block.items.map((item) => (
              <PlaybookCard
                key={`${item.item_type}-${item.id}`}
                item={item}
                portalSlug={portalSlug}
                onPlanAround={onPlanAroundEvent}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Summary */}
      {!loading && !error && totalItems > 0 && (
        <p className="text-center text-xs font-mono text-[var(--muted)]/50 py-4">
          {totalItems} {totalItems === 1 ? "thing" : "things"} happening
        </p>
      )}
    </div>
  );
}
