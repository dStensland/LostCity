"use client";

import { useState } from "react";
import { HealthStatus } from "./SourceHealthBadge";
import { ALL_HEALTH_TAGS, getTagLabel } from "./HealthTagBadge";

export type SourceFilters = {
  status: HealthStatus | "all";
  healthTags: string[];
  sourceType: string | "all";
  integrationMethod: string | "all";
  inSeason: boolean;
  search: string;
};

type Props = {
  filters: SourceFilters;
  onFiltersChange: (filters: SourceFilters) => void;
  sourceTypes: string[];
  integrationMethods: string[];
  showInSeasonFilter?: boolean;
};

export default function SourceFiltersComponent({
  filters,
  onFiltersChange,
  sourceTypes,
  integrationMethods,
  showInSeasonFilter = true,
}: Props) {
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);

  const statusOptions: { value: HealthStatus | "all"; label: string }[] = [
    { value: "all", label: "All Statuses" },
    { value: "healthy", label: "Healthy" },
    { value: "warning", label: "Warning" },
    { value: "failing", label: "Failing" },
    { value: "inactive", label: "Inactive" },
    { value: "unknown", label: "Never Run" },
  ];

  const toggleTag = (tag: string) => {
    const newTags = filters.healthTags.includes(tag)
      ? filters.healthTags.filter((t) => t !== tag)
      : [...filters.healthTags, tag];
    onFiltersChange({ ...filters, healthTags: newTags });
  };

  const clearFilters = () => {
    onFiltersChange({
      status: "all",
      healthTags: [],
      sourceType: "all",
      integrationMethod: "all",
      inSeason: false,
      search: "",
    });
  };

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.healthTags.length > 0 ||
    filters.sourceType !== "all" ||
    filters.integrationMethod !== "all" ||
    filters.inSeason ||
    filters.search;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search sources..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="px-3 py-1.5 bg-[var(--night)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] w-48"
        />
      </div>

      {/* Status filter */}
      <select
        value={filters.status}
        onChange={(e) =>
          onFiltersChange({ ...filters, status: e.target.value as HealthStatus | "all" })
        }
        className="px-3 py-1.5 bg-[var(--night)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
      >
        {statusOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Health tags dropdown */}
      <div className="relative">
        <button
          onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
          className={`px-3 py-1.5 bg-[var(--night)] border rounded-lg font-mono text-sm flex items-center gap-2 ${
            filters.healthTags.length > 0
              ? "border-[var(--coral)] text-[var(--coral)]"
              : "border-[var(--twilight)] text-[var(--cream)]"
          }`}
        >
          Tags {filters.healthTags.length > 0 && `(${filters.healthTags.length})`}
          <span className="text-[0.6rem]">&#9660;</span>
        </button>

        {tagDropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setTagDropdownOpen(false)}
            />
            <div className="absolute top-full left-0 mt-1 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-lg z-20 min-w-[180px]">
              {ALL_HEALTH_TAGS.map((tag) => (
                <label
                  key={tag}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--night)] cursor-pointer font-mono text-sm"
                >
                  <input
                    type="checkbox"
                    checked={filters.healthTags.includes(tag)}
                    onChange={() => toggleTag(tag)}
                    className="accent-[var(--coral)]"
                  />
                  <span className="text-[var(--cream)]">{getTagLabel(tag)}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Source type filter */}
      {sourceTypes.length > 0 && (
        <select
          value={filters.sourceType}
          onChange={(e) => onFiltersChange({ ...filters, sourceType: e.target.value })}
          className="px-3 py-1.5 bg-[var(--night)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
        >
          <option value="all">All Types</option>
          {sourceTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      )}

      {/* Integration method filter */}
      {integrationMethods.length > 0 && (
        <select
          value={filters.integrationMethod}
          onChange={(e) => onFiltersChange({ ...filters, integrationMethod: e.target.value })}
          className="px-3 py-1.5 bg-[var(--night)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--coral)]"
        >
          <option value="all">All Methods</option>
          {integrationMethods.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      )}

      {/* In season toggle */}
      {showInSeasonFilter && (
        <label className="flex items-center gap-2 font-mono text-sm text-[var(--cream)] cursor-pointer">
          <input
            type="checkbox"
            checked={filters.inSeason}
            onChange={(e) => onFiltersChange({ ...filters, inSeason: e.target.checked })}
            className="accent-[var(--coral)]"
          />
          In Season
        </label>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="px-3 py-1.5 text-[var(--muted)] hover:text-[var(--cream)] font-mono text-sm"
        >
          Clear
        </button>
      )}
    </div>
  );
}
