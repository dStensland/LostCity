"use client";

import { memo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MagnifyingGlass, FunnelSimple } from "@phosphor-icons/react";
import {
  PROGRAM_TYPE_LABELS,
  SEASON_LABELS,
  type ProgramWithVenue,
  type ProgramType,
  type ProgramSeason,
  type RegistrationStatus,
} from "@/lib/types/programs";
import { ProgramCard } from "./ProgramCard";

interface ProgramsBrowserProps {
  portalSlug: string;
}

type BrowserSubTab = "browse" | "opening_soon" | "seasonal";

interface ProgramFilters {
  type: ProgramType | "";
  season: ProgramSeason | "";
  registration: RegistrationStatus | "open,waitlist" | "";
  age: string;
  costMax: string;
}

// ---- Data fetcher --------------------------------------------------------

async function fetchPrograms(
  portalSlug: string,
  filters: ProgramFilters,
  subTab: BrowserSubTab
): Promise<ProgramWithVenue[]> {
  const params = new URLSearchParams({ portal: portalSlug, limit: "30" });

  if (filters.type) params.set("type", filters.type);
  if (filters.season) params.set("season", filters.season);
  if (filters.registration) params.set("registration", filters.registration);
  if (filters.age) params.set("age", filters.age);
  if (filters.costMax) params.set("cost_max", filters.costMax);

  // Sub-tab overrides
  if (subTab === "opening_soon") {
    params.set("registration", "upcoming");
    params.set("sort", "registration_urgency");
  } else if (subTab === "seasonal") {
    // No season override — let user see current seasonal programs
    if (!filters.season) {
      const month = new Date().getMonth() + 1;
      const season: ProgramSeason =
        month >= 6 && month <= 8
          ? "summer"
          : month >= 9 && month <= 11
          ? "fall"
          : month >= 3 && month <= 5
          ? "spring"
          : "winter";
      params.set("season", season);
    }
  }

  const res = await fetch(`/api/programs?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.programs ?? []) as ProgramWithVenue[];
}

// ---- Sub-tab bar ---------------------------------------------------------

function SubTabBar({
  active,
  onChange,
}: {
  active: BrowserSubTab;
  onChange: (tab: BrowserSubTab) => void;
}) {
  const tabs: Array<{ id: BrowserSubTab; label: string }> = [
    { id: "browse", label: "Browse" },
    { id: "opening_soon", label: "Opening Soon" },
    { id: "seasonal", label: "Seasonal" },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors"
          style={{
            backgroundColor: active === tab.id ? "var(--coral)" : "transparent",
            color: active === tab.id ? "white" : "var(--soft, #57534E)",
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ---- Filter row ----------------------------------------------------------

function FilterRow({
  filters,
  onChange,
}: {
  filters: ProgramFilters;
  onChange: (updates: Partial<ProgramFilters>) => void;
}) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div
      className="border-b px-4 py-3"
      style={{ borderColor: "var(--twilight, #E8E4DF)" }}
    >
      <div className="flex items-center gap-2">
        {/* Search box */}
        <div className="flex-1 relative">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            type="text"
            placeholder="Search programs..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border bg-white text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
            style={{ borderColor: "var(--twilight, #E8E4DF)" }}
            value={filters.age}
            readOnly
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors"
          style={{
            borderColor: showFilters ? "var(--coral)" : "var(--twilight, #E8E4DF)",
            color: showFilters ? "var(--coral)" : "var(--soft, #57534E)",
            backgroundColor: showFilters ? "color-mix(in srgb, var(--coral) 8%, white)" : "white",
          }}
        >
          <FunnelSimple size={16} />
          Filters
        </button>
      </div>

      {showFilters && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1" style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
              Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => onChange({ type: e.target.value as ProgramType | "" })}
              className="w-full px-2.5 py-1.5 rounded-lg text-sm border bg-white text-[var(--cream)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              style={{ borderColor: "var(--twilight, #E8E4DF)" }}
            >
              <option value="">All types</option>
              {Object.entries(PROGRAM_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Season */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1" style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
              Season
            </label>
            <select
              value={filters.season}
              onChange={(e) => onChange({ season: e.target.value as ProgramSeason | "" })}
              className="w-full px-2.5 py-1.5 rounded-lg text-sm border bg-white text-[var(--cream)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              style={{ borderColor: "var(--twilight, #E8E4DF)" }}
            >
              <option value="">All seasons</option>
              {Object.entries(SEASON_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Age */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1" style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
              Child&rsquo;s Age
            </label>
            <input
              type="number"
              min={0}
              max={18}
              placeholder="Any"
              value={filters.age}
              onChange={(e) => onChange({ age: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg text-sm border bg-white text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              style={{ borderColor: "var(--twilight, #E8E4DF)" }}
            />
          </div>

          {/* Cost max */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1" style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
              Max Cost ($)
            </label>
            <input
              type="number"
              min={0}
              placeholder="Any"
              value={filters.costMax}
              onChange={(e) => onChange({ costMax: e.target.value })}
              className="w-full px-2.5 py-1.5 rounded-lg text-sm border bg-white text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
              style={{ borderColor: "var(--twilight, #E8E4DF)" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main component ------------------------------------------------------

export const ProgramsBrowser = memo(function ProgramsBrowser({
  portalSlug,
}: ProgramsBrowserProps) {
  const [subTab, setSubTab] = useState<BrowserSubTab>("browse");
  const [filters, setFilters] = useState<ProgramFilters>({
    type: "",
    season: "",
    registration: "",
    age: "",
    costMax: "",
  });

  const updateFilters = (updates: Partial<ProgramFilters>) => {
    setFilters((f) => ({ ...f, ...updates }));
  };

  const { data: programs, isLoading } = useQuery({
    queryKey: ["family-programs", portalSlug, subTab, filters],
    queryFn: () => fetchPrograms(portalSlug, filters, subTab),
    staleTime: 2 * 60 * 1000,
  });

  const results = programs ?? [];

  return (
    <div className="pb-6">
      {/* Sub-tab bar + filter row */}
      <div
        className="sticky top-0 z-10 bg-[var(--background)]"
      >
        <div
          className="px-4 py-3 border-b"
          style={{ borderColor: "var(--twilight, #E8E4DF)" }}
        >
          <SubTabBar active={subTab} onChange={setSubTab} />
        </div>
        {subTab === "browse" && (
          <FilterRow filters={filters} onChange={updateFilters} />
        )}
      </div>

      {/* Program list */}
      <div className="px-4 pt-4 space-y-3">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-xl skeleton-shimmer-light" />
            ))}
          </>
        ) : results.length > 0 ? (
          results.map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))
        ) : (
          <div className="text-center py-12">
            {subTab === "opening_soon" ? (
              <p className="text-sm text-[var(--muted)]">
                No programs opening soon. Check back — registration cycles throughout the year.
              </p>
            ) : subTab === "seasonal" ? (
              <p className="text-sm text-[var(--muted)]">
                No seasonal programs found for this time of year.
              </p>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                No programs matched your filters. Try removing the age or type filter.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export type { ProgramsBrowserProps };
