"use client";

import { useState, useEffect, useCallback } from "react";
import type { StudioVenue, StudioType, AvailabilityStatus } from "@/lib/types/studios";
import { STUDIO_TYPE_LABELS, AVAILABILITY_LABELS } from "@/lib/types/studios";
import { StudioCard } from "./StudioCard";

interface StudiosDirectoryProps {
  portalSlug: string;
}

type Filters = {
  type: StudioType | "";
  status: AvailabilityStatus | "";
};

export function StudiosDirectory({ portalSlug }: StudiosDirectoryProps) {
  const [studios, setStudios] = useState<StudioVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ type: "", status: "" });

  const fetchStudios = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ city: "Atlanta" });
    if (filters.type) params.set("type", filters.type);
    if (filters.status) params.set("status", filters.status);

    try {
      const resp = await fetch(`/api/studios?${params}`);
      const data = await resp.json();
      setStudios(data.studios ?? []);
    } catch {
      setStudios([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchStudios();
  }, [fetchStudios]);

  const updateFilter = (key: keyof Filters, value: string) => {
    const next = { ...filters, [key]: value === filters[key] ? "" : value };
    setFilters(next);
    const params = new URLSearchParams();
    if (next.type) params.set("type", next.type);
    if (next.status) params.set("status", next.status);
    window.history.replaceState(null, "", `?${params}`);
  };

  const typeOptions = Object.entries(STUDIO_TYPE_LABELS) as [StudioType, string][];
  const statusOptions = Object.entries(AVAILABILITY_LABELS) as [AvailabilityStatus, string][];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider flex-shrink-0">
            // type
          </span>
          {typeOptions.map(([key, label]) => (
            <button
              key={key}
              onClick={() => updateFilter("type", key)}
              className={`flex-shrink-0 font-mono text-xs px-3 py-1.5 border rounded-none transition-colors ${
                filters.type === key
                  ? "border-[var(--action-primary)] text-[var(--action-primary)]"
                  : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider flex-shrink-0">
            // availability
          </span>
          {statusOptions.map(([key, label]) => (
            <button
              key={key}
              onClick={() => updateFilter("status", key)}
              className={`flex-shrink-0 font-mono text-xs px-3 py-1.5 border rounded-none transition-colors ${
                filters.status === key
                  ? "border-[var(--action-primary)] text-[var(--action-primary)]"
                  : "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--soft)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="border border-[var(--twilight)] rounded-none p-5 h-40 animate-pulse bg-[var(--twilight)]/10"
            />
          ))}
        </div>
      ) : studios.length === 0 ? (
        <div className="border border-[var(--twilight)] rounded-none p-8 text-center">
          <p className="font-mono text-sm text-[var(--muted)]">
            // no studios match your filters
          </p>
          <button
            onClick={() => setFilters({ type: "", status: "" })}
            className="mt-3 font-mono text-xs text-[var(--action-primary)] hover:opacity-80"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {studios.map((studio) => (
            <StudioCard
              key={studio.id}
              studio={studio}
              portalSlug={portalSlug}
            />
          ))}
        </div>
      )}

      {/* Count */}
      {!loading && studios.length > 0 && (
        <p className="font-mono text-xs text-[var(--muted)] text-center">
          {studios.length} studio{studios.length === 1 ? "" : "s"} found
        </p>
      )}
    </div>
  );
}
