/**
 * localStorage CRUD for user-added theater slugs.
 * Lets users pin chain theaters to their indie cinema carousel.
 */

const STORAGE_KEY = "lostcity-my-theaters";

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
