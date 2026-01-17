"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CATEGORIES, SUBCATEGORIES, DATE_FILTERS, PRICE_FILTERS, ALL_TAGS } from "@/lib/search";
import { PREFERENCE_VIBES, PREFERENCE_NEIGHBORHOODS } from "@/lib/preferences";
import CategoryIcon, { CATEGORY_CONFIG, type CategoryType } from "./CategoryIcon";

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FilterDrawer({ isOpen, onClose }: FilterDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentCategories = searchParams.get("categories")?.split(",").filter(Boolean) || [];
  const currentSubcategories = searchParams.get("subcategories")?.split(",").filter(Boolean) || [];
  const currentTags = searchParams.get("tags")?.split(",").filter(Boolean) || [];
  const currentVibes = searchParams.get("vibes")?.split(",").filter(Boolean) || [];
  const currentNeighborhoods = searchParams.get("neighborhoods")?.split(",").filter(Boolean) || [];
  const currentPriceFilter = searchParams.get("price") || "";
  const currentDateFilter = searchParams.get("date") || "";

  // Handle escape key and body scroll lock
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    params.delete("page");
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(newUrl, { scroll: false });
  };

  const toggleCategory = (category: string) => {
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter((c) => c !== category)
      : [...currentCategories, category];
    updateParams({ categories: newCategories.length > 0 ? newCategories.join(",") : null });
  };

  const toggleNeighborhood = (neighborhood: string) => {
    const newNeighborhoods = currentNeighborhoods.includes(neighborhood)
      ? currentNeighborhoods.filter((n) => n !== neighborhood)
      : [...currentNeighborhoods, neighborhood];
    updateParams({ neighborhoods: newNeighborhoods.length > 0 ? newNeighborhoods.join(",") : null });
  };

  const toggleSubcategory = (subcategory: string) => {
    const newSubcategories = currentSubcategories.includes(subcategory)
      ? currentSubcategories.filter((s) => s !== subcategory)
      : [...currentSubcategories, subcategory];
    updateParams({ subcategories: newSubcategories.length > 0 ? newSubcategories.join(",") : null });
  };

  const toggleTag = (tag: string) => {
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    updateParams({ tags: newTags.length > 0 ? newTags.join(",") : null });
  };

  const toggleVibe = (vibe: string) => {
    const newVibes = currentVibes.includes(vibe)
      ? currentVibes.filter((v) => v !== vibe)
      : [...currentVibes, vibe];
    updateParams({ vibes: newVibes.length > 0 ? newVibes.join(",") : null });
  };

  const setDateFilter = (date: string) => {
    updateParams({ date: currentDateFilter === date ? null : date });
  };

  const setPriceFilter = (price: string) => {
    updateParams({ price: currentPriceFilter === price ? null : price });
  };

  const clearAll = () => {
    updateParams({
      categories: null,
      subcategories: null,
      tags: null,
      vibes: null,
      neighborhoods: null,
      date: null,
      price: null,
    });
    onClose();
  };

  const applyFilters = () => {
    onClose();
  };

  // Get available subcategories for selected categories
  const availableSubcategories = currentCategories.flatMap((cat) =>
    SUBCATEGORIES[cat]?.map((sub) => ({ ...sub, category: cat })) || []
  );

  const activeFilterCount =
    currentCategories.length +
    currentSubcategories.length +
    currentTags.length +
    currentVibes.length +
    currentNeighborhoods.length +
    (currentDateFilter ? 1 : 0) +
    (currentPriceFilter ? 1 : 0);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[var(--void)]/80 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-[var(--night)] border-l border-[var(--twilight)] z-50 animate-slide-in-right overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--twilight)]">
          <h2 className="font-display text-xl font-semibold text-[var(--cream)]">Filters</h2>
          <button
            onClick={onClose}
            className="p-2 text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* When */}
          <FilterSection title="When" icon="calendar">
            <div className="grid grid-cols-2 gap-2">
              {DATE_FILTERS.map((df) => (
                <FilterOption
                  key={df.value}
                  label={df.label}
                  checked={currentDateFilter === df.value}
                  onChange={() => setDateFilter(df.value)}
                />
              ))}
            </div>
          </FilterSection>

          {/* Categories */}
          <FilterSection title="Category" icon="grid">
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <FilterOption
                  key={cat.value}
                  label={cat.label}
                  checked={currentCategories.includes(cat.value)}
                  onChange={() => toggleCategory(cat.value)}
                  icon={<CategoryIcon type={cat.value} size={16} style={{ color: CATEGORY_CONFIG[cat.value as CategoryType]?.color }} />}
                />
              ))}
            </div>
          </FilterSection>

          {/* Neighborhoods */}
          <FilterSection title="Neighborhood" icon="map">
            <div className="grid grid-cols-2 gap-2">
              {PREFERENCE_NEIGHBORHOODS.map((neighborhood) => (
                <FilterOption
                  key={neighborhood}
                  label={neighborhood}
                  checked={currentNeighborhoods.includes(neighborhood)}
                  onChange={() => toggleNeighborhood(neighborhood)}
                />
              ))}
            </div>
          </FilterSection>

          {/* Price */}
          <FilterSection title="Price" icon="dollar">
            <div className="grid grid-cols-2 gap-2">
              {PRICE_FILTERS.map((pf) => (
                <FilterOption
                  key={pf.value}
                  label={pf.label}
                  checked={currentPriceFilter === pf.value}
                  onChange={() => setPriceFilter(pf.value)}
                />
              ))}
            </div>
          </FilterSection>

          {/* Subcategories - only show when categories with subcategories are selected */}
          {availableSubcategories.length > 0 && (
            <FilterSection title="Genre" icon="music">
              <div className="grid grid-cols-2 gap-2">
                {availableSubcategories.map((sub) => (
                  <FilterOption
                    key={sub.value}
                    label={sub.label}
                    checked={currentSubcategories.includes(sub.value)}
                    onChange={() => toggleSubcategory(sub.value)}
                  />
                ))}
              </div>
            </FilterSection>
          )}

          {/* Tags */}
          <FilterSection title="Tags" icon="tag">
            <div className="grid grid-cols-2 gap-2">
              {ALL_TAGS.map((tag) => (
                <FilterOption
                  key={tag.value}
                  label={tag.label}
                  checked={currentTags.includes(tag.value)}
                  onChange={() => toggleTag(tag.value)}
                />
              ))}
            </div>
          </FilterSection>

          {/* Vibes */}
          <FilterSection title="Vibes" icon="sparkles">
            <div className="grid grid-cols-2 gap-2">
              {PREFERENCE_VIBES.map((vibe) => (
                <FilterOption
                  key={vibe.value}
                  label={vibe.label}
                  checked={currentVibes.includes(vibe.value)}
                  onChange={() => toggleVibe(vibe.value)}
                />
              ))}
            </div>
          </FilterSection>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--twilight)] space-y-2">
          <button
            onClick={applyFilters}
            className="w-full py-3 bg-[var(--neon-magenta)] text-[var(--void)] font-semibold rounded-lg glow-sm hover:opacity-90 transition-opacity"
          >
            Show Results {activeFilterCount > 0 && `(${activeFilterCount} filters)`}
          </button>
          <button
            onClick={clearAll}
            className="w-full py-3 text-[var(--muted)] hover:text-[var(--cream)] font-medium transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>
    </>
  );
}

function FilterSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: "calendar" | "grid" | "map" | "dollar" | "tag" | "sparkles" | "music";
  children: React.ReactNode;
}) {
  const icons = {
    calendar: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    grid: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    map: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    dollar: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    tag: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    sparkles: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    music: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[var(--muted)]">
        {icons[icon]}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function FilterOption({
  label,
  checked,
  onChange,
  icon,
}: {
  label: string;
  checked?: boolean;
  onChange: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <label
      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
        checked
          ? "bg-[var(--neon-magenta)]/20 border border-[var(--neon-magenta)]/40"
          : "bg-[var(--twilight)]/30 hover:bg-[var(--twilight)] border border-transparent"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          checked
            ? "bg-[var(--neon-magenta)] border-[var(--neon-magenta)]"
            : "border-[var(--muted)]"
        }`}
      >
        {checked && (
          <svg className="w-3 h-3 text-[var(--void)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className={`text-sm ${checked ? "text-[var(--cream)]" : "text-[var(--soft)]"}`}>
        {label}
      </span>
    </label>
  );
}
