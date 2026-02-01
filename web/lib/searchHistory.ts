const STORAGE_KEY = "lostcity_recent_searches";
const MAX_RECENT = 10;

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(term: string): void {
  if (!term.trim() || typeof window === "undefined") return;
  try {
    const recent = getRecentSearches().filter((s) => s !== term);
    recent.unshift(term);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // Ignore localStorage errors
  }
}

export function removeRecentSearch(term: string): void {
  if (typeof window === "undefined") return;
  try {
    const recent = getRecentSearches().filter((s) => s !== term);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
  } catch {
    // Ignore localStorage errors
  }
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore localStorage errors
  }
}
