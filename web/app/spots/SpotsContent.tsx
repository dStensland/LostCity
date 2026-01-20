"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SpotCard from "@/components/SpotCard";
import SpotFilterBar from "@/components/SpotFilterBar";
import SpotSearchBar from "@/components/SpotSearchBar";
import CategoryIcon, { getCategoryLabel } from "@/components/CategoryIcon";
import type { Spot } from "@/lib/spots";

type GroupBy = "none" | "category" | "neighborhood";

interface Props {
  spots: Spot[];
  initialGroupBy: GroupBy;
  selectedTypes: string[];
  selectedHoods: string[];
  searchQuery: string;
}

export default function SpotsContent({
  spots,
  initialGroupBy,
  selectedTypes,
  selectedHoods,
  searchQuery,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [groupBy, setGroupBy] = useState<GroupBy>(initialGroupBy);

  const handleGroupByChange = (newGroupBy: GroupBy) => {
    setGroupBy(newGroupBy);
    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    if (newGroupBy === "none") {
      params.delete("group");
    } else {
      params.set("group", newGroupBy);
    }
    const query = params.toString();
    router.push(`/spots${query ? `?${query}` : ""}`, { scroll: false });
  };

  // Group spots by category or neighborhood
  const groupedSpots = useMemo(() => {
    if (groupBy === "none") {
      return null;
    }

    const groups = new Map<string, Spot[]>();

    for (const spot of spots) {
      const key = groupBy === "category"
        ? spot.spot_type || "other"
        : spot.neighborhood || "Other";

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(spot);
    }

    // Sort groups by count (descending)
    return Array.from(groups.entries())
      .sort((a, b) => b[1].length - a[1].length);
  }, [spots, groupBy]);

  const hasFilters = selectedTypes.length > 0 || selectedHoods.length > 0 || searchQuery;

  return (
    <>
      {/* Search Bar */}
      <section className="py-3 border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4">
          <SpotSearchBar />
        </div>
      </section>

      {/* Filter Bar */}
      <SpotFilterBar
        onGroupByChange={handleGroupByChange}
        currentGroupBy={groupBy}
      />

      {/* Results Count */}
      <div className="max-w-3xl mx-auto px-4 border-b border-[var(--twilight)]">
        <p className="font-mono text-xs text-[var(--muted)] py-3">
          <span className="text-[var(--soft)]">{spots.length}</span> spots
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      </div>

      {/* Spots List */}
      <main className="max-w-3xl mx-auto px-4 pb-12">
        {spots.length > 0 ? (
          groupBy === "none" ? (
            // Flat list
            <div>
              {spots.map((spot, index) => (
                <SpotCard key={spot.id} spot={spot} index={index} />
              ))}
            </div>
          ) : (
            // Grouped view
            <div className="space-y-6 pt-4">
              {groupedSpots?.map(([groupKey, groupSpots]) => (
                <div key={groupKey}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 mb-3 sticky top-[160px] bg-[var(--void)] py-2 z-10">
                    {groupBy === "category" && (
                      <CategoryIcon type={groupKey} size={18} className="opacity-70" />
                    )}
                    <h2 className="font-mono text-sm font-medium text-[var(--cream)]">
                      {groupBy === "category" ? getCategoryLabel(groupKey) : groupKey}
                    </h2>
                    <span className="font-mono text-xs text-[var(--muted)]">
                      ({groupSpots.length})
                    </span>
                  </div>

                  {/* Group spots */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {groupSpots.map((spot) => (
                      <Link
                        key={spot.id}
                        href={`/spots/${spot.slug}`}
                        className="p-3 rounded-lg border border-[var(--twilight)] transition-colors group"
                        style={{ backgroundColor: "var(--card-bg)" }}
                      >
                        <div className="flex items-start gap-3">
                          {groupBy !== "category" && spot.spot_type && (
                            <CategoryIcon type={spot.spot_type} size={16} className="flex-shrink-0 opacity-60 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors">
                              {spot.name}
                            </div>
                            <div className="flex items-center gap-1.5 font-mono text-[0.6rem] text-[var(--muted)] mt-0.5">
                              {groupBy !== "neighborhood" && spot.neighborhood && (
                                <span>{spot.neighborhood}</span>
                              )}
                              {groupBy === "neighborhood" && spot.spot_type && (
                                <span>{getCategoryLabel(spot.spot_type)}</span>
                              )}
                              {(spot.event_count ?? 0) > 0 && (
                                <>
                                  <span className="opacity-40">·</span>
                                  <span className="text-[var(--coral)]">
                                    {spot.event_count} event{spot.event_count !== 1 ? "s" : ""}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="py-16 text-center">
            <p className="text-[var(--muted)]">No spots found</p>
            {hasFilters && (
              <Link
                href="/spots"
                className="inline-block mt-4 font-mono text-sm text-[var(--coral)] hover:text-[var(--rose)]"
              >
                Clear filters
              </Link>
            )}
          </div>
        )}
      </main>
    </>
  );
}
