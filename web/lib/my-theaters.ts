/**
 * localStorage CRUD for user-added theater slugs and hidden theater slugs.
 * Lets users pin chain theaters and hide default indie theaters from the carousel.
 */

const STORAGE_KEY = "lostcity-my-theaters";
const HIDDEN_KEY = "lostcity-hidden-theaters";

export function getMyTheaters(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Failed to load my theaters:", e);
  }
  return [];
}

export function addMyTheater(slug: string): void {
  const current = getMyTheaters();
  if (current.includes(slug)) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, slug]));
  } catch (e) {
    console.error("Failed to save my theater:", e);
  }
}

export function removeMyTheater(slug: string): void {
  const current = getMyTheaters();
  const updated = current.filter((s) => s !== slug);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to remove my theater:", e);
  }
}

// ── Hidden theaters (indie theaters the user has removed) ────────────

export function getHiddenTheaters(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(HIDDEN_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Failed to load hidden theaters:", e);
  }
  return [];
}

export function hideTheater(slug: string): void {
  const current = getHiddenTheaters();
  if (current.includes(slug)) return;

  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...current, slug]));
  } catch (e) {
    console.error("Failed to hide theater:", e);
  }
}

export function unhideTheater(slug: string): void {
  const current = getHiddenTheaters();
  const updated = current.filter((s) => s !== slug);

  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to unhide theater:", e);
  }
}
