// web/lib/my-teams.ts

/**
 * localStorage CRUD for user team preferences.
 * Mirrors my-theaters.ts: default teams show unless hidden,
 * non-default teams show when explicitly added.
 */

const STORAGE_KEY = "lostcity-my-teams";
const HIDDEN_KEY = "lostcity-hidden-teams";

export function getMyTeams(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Failed to load my teams:", e);
  }
  return [];
}

export function addMyTeam(slug: string): void {
  const current = getMyTeams();
  if (current.includes(slug)) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, slug]));
  } catch (e) {
    console.error("Failed to save my team:", e);
  }
}

export function removeMyTeam(slug: string): void {
  const current = getMyTeams();
  const updated = current.filter((s) => s !== slug);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to remove my team:", e);
  }
}

export function getHiddenTeams(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(HIDDEN_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Failed to load hidden teams:", e);
  }
  return [];
}

export function hideTeam(slug: string): void {
  const current = getHiddenTeams();
  if (current.includes(slug)) return;

  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...current, slug]));
  } catch (e) {
    console.error("Failed to hide team:", e);
  }
}

export function unhideTeam(slug: string): void {
  const current = getHiddenTeams();
  const updated = current.filter((s) => s !== slug);

  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to unhide team:", e);
  }
}
