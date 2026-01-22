"use client";

import { useState, useEffect, useRef, memo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  getSavedFilters,
  saveFilterPreset,
  deleteFilterPreset,
  searchParamsToFilterState,
  filterStateToSearchParams,
  hasFiltersToSave,
  generateFilterName,
  type SavedFilter,
} from "@/lib/saved-filters";

interface SavedFiltersMenuProps {
  variant?: "compact" | "full";
}

function SavedFiltersMenu({ variant = "compact" }: SavedFiltersMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load saved filters on mount
  useEffect(() => {
    setSavedFilters(getSavedFilters());
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowSaveDialog(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const currentFilter = searchParamsToFilterState(searchParams);
  const canSave = hasFiltersToSave(currentFilter);

  const handleSaveFilter = () => {
    const name = filterName.trim() || generateFilterName(currentFilter);
    const newFilter = saveFilterPreset({
      name,
      ...currentFilter,
    });
    setSavedFilters(getSavedFilters());
    setFilterName("");
    setShowSaveDialog(false);
    setIsOpen(false);
  };

  const handleApplyFilter = (filter: SavedFilter) => {
    const params = filterStateToSearchParams(filter);
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(newUrl, { scroll: false });
    setIsOpen(false);
  };

  const handleDeleteFilter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteFilterPreset(id);
    setSavedFilters(getSavedFilters());
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-mono text-xs font-medium transition-all ${
          savedFilters.length > 0
            ? "bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/30"
            : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
        }`}
        title="Saved Filters"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        {variant === "full" && "Saved"}
        {savedFilters.length > 0 && (
          <span className="px-1 py-0.5 rounded-full bg-[var(--neon-cyan)]/30 text-[0.55rem]">
            {savedFilters.length}
          </span>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--night)] border border-[var(--twilight)] rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Save current filter section */}
          {canSave && (
            <div className="p-3 border-b border-[var(--twilight)]">
              {showSaveDialog ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    placeholder={generateFilterName(currentFilter)}
                    className="w-full px-3 py-2 rounded-md bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-xs placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--neon-cyan)]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveFilter();
                      if (e.key === "Escape") setShowSaveDialog(false);
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveFilter}
                      className="flex-1 px-3 py-1.5 rounded-md bg-[var(--neon-cyan)] text-[var(--void)] font-mono text-xs font-medium hover:bg-[var(--neon-cyan)]/80"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setShowSaveDialog(false)}
                      className="px-3 py-1.5 rounded-md bg-[var(--twilight)] text-[var(--muted)] font-mono text-xs font-medium hover:text-[var(--cream)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveDialog(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] font-mono text-xs font-medium hover:bg-[var(--neon-cyan)]/30 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Save current filters
                </button>
              )}
            </div>
          )}

          {/* Saved filters list */}
          <div className="max-h-64 overflow-y-auto">
            {savedFilters.length === 0 ? (
              <div className="p-4 text-center">
                <div className="text-[var(--muted)] font-mono text-xs mb-2">No saved filters</div>
                <p className="text-[var(--muted)] text-[0.6rem]">
                  Apply some filters, then save them here for quick access later.
                </p>
              </div>
            ) : (
              <div className="py-1">
                {savedFilters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => handleApplyFilter(filter)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--twilight)]/50 transition-colors group"
                  >
                    <div className="flex-1 text-left">
                      <div className="font-mono text-xs text-[var(--cream)] truncate">
                        {filter.name}
                      </div>
                      <div className="font-mono text-[0.55rem] text-[var(--muted)] truncate">
                        {[
                          filter.categories.length > 0 && `${filter.categories.length} cat`,
                          filter.neighborhoods.length > 0 && `${filter.neighborhoods.length} area`,
                          filter.dateRange,
                          filter.priceFilter,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteFilter(filter.id, e)}
                      className="p-1 rounded text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--coral)] hover:bg-[var(--coral)]/10 transition-all"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(SavedFiltersMenu);
