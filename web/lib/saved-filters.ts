/**
 * Saved filter presets for events
 * Allows users to save and restore named filter configurations
 */

export interface SavedFilter {
  id: string;
  name: string;
  categories: string[];
  neighborhoods: string[];
  vibes: string[];
  tags: string[];
  dateRange?: string;
  priceFilter?: string;
  createdAt: number;
}

const STORAGE_KEY = "lostcity-saved-filter-presets";
const MAX_PRESETS = 10;

/**
 * Generate a unique ID for a new filter preset
 */
function generateId(): string {
  return `filter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get all saved filter presets from localStorage
 */
export function getSavedFilters(): SavedFilter[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load saved filters:", e);
  }
  return [];
}

/**
 * Save a new filter preset
 */
export function saveFilterPreset(preset: Omit<SavedFilter, "id" | "createdAt">): SavedFilter {
  const filters = getSavedFilters();

  const newFilter: SavedFilter = {
    ...preset,
    id: generateId(),
    createdAt: Date.now(),
  };

  // Add to beginning, limit to MAX_PRESETS
  const updated = [newFilter, ...filters].slice(0, MAX_PRESETS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save filter preset:", e);
  }

  return newFilter;
}

/**
 * Delete a saved filter preset by ID
 */
export function deleteFilterPreset(id: string): void {
  const filters = getSavedFilters();
  const updated = filters.filter((f) => f.id !== id);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to delete filter preset:", e);
  }
}

/**
 * Update a saved filter preset
 */
export function updateFilterPreset(id: string, updates: Partial<Omit<SavedFilter, "id" | "createdAt">>): void {
  const filters = getSavedFilters();
  const updated = filters.map((f) =>
    f.id === id ? { ...f, ...updates } : f
  );

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to update filter preset:", e);
  }
}

/**
 * Get a single filter preset by ID
 */
export function getFilterPresetById(id: string): SavedFilter | undefined {
  return getSavedFilters().find((f) => f.id === id);
}

/**
 * Convert URL search params to filter state
 */
export function searchParamsToFilterState(searchParams: URLSearchParams): Omit<SavedFilter, "id" | "name" | "createdAt"> {
  return {
    categories: searchParams.get("categories")?.split(",").filter(Boolean) || [],
    neighborhoods: searchParams.get("neighborhoods")?.split(",").filter(Boolean) || [],
    vibes: searchParams.get("vibes")?.split(",").filter(Boolean) || [],
    tags: searchParams.get("tags")?.split(",").filter(Boolean) || [],
    dateRange: searchParams.get("date") || undefined,
    priceFilter: searchParams.get("price") || undefined,
  };
}

/**
 * Convert filter state to URL search params string
 */
export function filterStateToSearchParams(filter: Omit<SavedFilter, "id" | "name" | "createdAt">): URLSearchParams {
  const params = new URLSearchParams();

  if (filter.categories.length > 0) {
    params.set("categories", filter.categories.join(","));
  }
  if (filter.neighborhoods.length > 0) {
    params.set("neighborhoods", filter.neighborhoods.join(","));
  }
  if (filter.vibes.length > 0) {
    params.set("vibes", filter.vibes.join(","));
  }
  if (filter.tags.length > 0) {
    params.set("tags", filter.tags.join(","));
  }
  if (filter.dateRange) {
    params.set("date", filter.dateRange);
  }
  if (filter.priceFilter) {
    params.set("price", filter.priceFilter);
  }

  return params;
}

/**
 * Check if current filters have any values worth saving
 */
export function hasFiltersToSave(filter: Omit<SavedFilter, "id" | "name" | "createdAt">): boolean {
  return (
    filter.categories.length > 0 ||
    filter.neighborhoods.length > 0 ||
    filter.vibes.length > 0 ||
    filter.tags.length > 0 ||
    !!filter.dateRange ||
    !!filter.priceFilter
  );
}

/**
 * Generate a default name for a filter preset based on its contents
 */
export function generateFilterName(filter: Omit<SavedFilter, "id" | "name" | "createdAt">): string {
  const parts: string[] = [];

  if (filter.categories.length > 0) {
    parts.push(filter.categories[0].charAt(0).toUpperCase() + filter.categories[0].slice(1));
  }
  if (filter.neighborhoods.length > 0) {
    parts.push(filter.neighborhoods[0]);
  }
  if (filter.dateRange) {
    parts.push(filter.dateRange);
  }
  if (filter.priceFilter === "free") {
    parts.push("Free");
  }

  if (parts.length === 0) {
    return `Filter ${getSavedFilters().length + 1}`;
  }

  return parts.slice(0, 3).join(" + ");
}
