/**
 * Single source of truth for all holiday/themed section configurations.
 * Used by HolidayHero (full-size hero cards) and FeedSection (grid cards).
 */

export interface HolidayConfig {
  slug: string;
  tag: string;
  title: string;
  subtitle: string;
  gradient: string;
  accentColor: string;
  glowColor: string;
  /** Hero icon (full-size, for HolidayHero) — path in /public/ or emoji string */
  icon: string;
  /** Grid icon (smaller, for FeedSection) — falls back to icon if not set */
  gridIcon?: string;
  bgImage?: string;
  /** Show between these dates [month, day] inclusive */
  showFrom: [number, number];
  showUntil: [number, number];
  /**
   * When does the event actually happen? For countdown.
   * - Fixed-date holidays: [month, day] — year auto-computed, no yearly updates needed
   * - Floating holidays: [year, month, day] — must be updated annually
   */
  eventDate: [number, number] | [number, number, number];
  /** Override countdown text (e.g. "ALL MONTH" for month-long observances) */
  countdownOverride?: string;
  /** Enable blurred background glow effect using the icon image */
  iconBgGlow?: boolean;
  /** Enable pulsing glow ring around the icon */
  iconGlowRing?: boolean;
}

// Holiday configs — Valentine's first (hero position), then specifics, then broad
export const HOLIDAYS: HolidayConfig[] = [
  {
    slug: "valentines-day",
    tag: "valentines",
    title: "Valentine's Weekend",
    subtitle: "The heart has reasons that reason cannot know",
    gradient: "linear-gradient(135deg, #1a0a1e 0%, #2d0a2e 30%, #1e0a28 60%, #0f0a1a 100%)",
    accentColor: "#ff4da6",
    glowColor: "#ff4da6",
    icon: "/images/valentines-heart-neon.gif",
    gridIcon: "/icons/valentines-heart.png",
    showFrom: [2, 8],
    showUntil: [2, 15],
    eventDate: [2, 14],
    iconBgGlow: true,
    iconGlowRing: true,
  },
  {
    slug: "friday-the-13th",
    tag: "friday-13",
    title: "Friday the 13th",
    subtitle: "Toss your favorite body through a window to celebrate",
    gradient: "linear-gradient(135deg, #050a05 0%, #0a1a0a 30%, #051005 60%, #030a03 100%)",
    accentColor: "#00ff41",
    glowColor: "#00ff41",
    icon: "/images/friday13-jason.gif",
    showFrom: [2, 10],
    showUntil: [2, 13],
    eventDate: [2026, 2, 13], // TODO: Update for 2027 — not every year has a Feb Friday 13th
    iconBgGlow: true,
    iconGlowRing: true,
  },
  {
    slug: "mardi-gras",
    tag: "mardi-gras",
    title: "Mardi Gras",
    subtitle: "Laissez les bons temps rouler",
    gradient: "linear-gradient(135deg, #0d0520 0%, #1a0a35 25%, #0a1a08 50%, #1a1505 75%, #0d0520 100%)",
    accentColor: "#ffd700",
    glowColor: "#d040ff",
    icon: "/images/mardi-gras-mask.svg",
    showFrom: [2, 15],
    showUntil: [2, 17],
    eventDate: [2026, 2, 17], // TODO: Update for 2027 — date shifts yearly
    iconBgGlow: true,
    iconGlowRing: true,
  },
  {
    slug: "lunar-new-year",
    tag: "lunar-new-year",
    title: "Lunar New Year",
    subtitle: "A Year of Fire Horsin' Around",
    gradient: "linear-gradient(135deg, #1a0505 0%, #350a0a 30%, #2a0808 60%, #1a0303 100%)",
    accentColor: "#ff4444",
    glowColor: "#cc0000",
    icon: "/icons/fire-horse.png",
    showFrom: [2, 18],
    showUntil: [2, 22],
    eventDate: [2026, 2, 17], // TODO: Update for 2027 — lunar calendar
    countdownOverride: "YEAR OF THE HORSE",
  },
  {
    slug: "black-history-month",
    tag: "black-history-month",
    title: "Black History Month",
    subtitle: "Honoring Black culture, art & community in Atlanta",
    gradient: "linear-gradient(135deg, #1a0505 0%, #0c0c0c 35%, #0c0c0c 65%, #051a05 100%)",
    accentColor: "#e53935",
    glowColor: "#43a047",
    icon: "/icons/black-history-fist.png",
    showFrom: [2, 1],
    showUntil: [2, 28],
    eventDate: [2, 1],
    countdownOverride: "ALL MONTH",
    iconGlowRing: true,
  },
  {
    slug: "ramadan",
    tag: "ramadan",
    title: "Ramadan",
    subtitle: "Iftars, community meals & reflection across Atlanta",
    gradient: "linear-gradient(135deg, #0a0e2a 0%, #0f1a3d 30%, #1a1540 60%, #0a0e2a 100%)",
    accentColor: "#c5a028",
    glowColor: "#c5a028",
    icon: "/images/ramadan-crescent.svg",
    showFrom: [2, 18],
    showUntil: [3, 19],
    eventDate: [2026, 2, 18], // TODO: Update for 2027 — Islamic calendar
    countdownOverride: "RAMADAN MUBARAK",
    iconBgGlow: true,
    iconGlowRing: true,
  },
  {
    slug: "holi",
    tag: "holi",
    title: "Holi",
    subtitle: "Festival of Colors — paint the town every shade",
    gradient: "linear-gradient(135deg, #1a0a28 0%, #2a0a1a 25%, #0a1a2a 50%, #1a2a0a 75%, #2a1a0a 100%)",
    accentColor: "#ff6f00",
    glowColor: "#e040fb",
    icon: "/images/holi-colors.svg",
    showFrom: [2, 28],
    showUntil: [3, 5],
    eventDate: [2026, 3, 3], // TODO: Update for 2027 — Hindu calendar
    iconBgGlow: true,
    iconGlowRing: true,
  },
  {
    slug: "womens-history-month",
    tag: "womens-history-month",
    title: "Women's History Month",
    subtitle: "Celebrating the women shaping Atlanta's story",
    gradient: "linear-gradient(135deg, #1a0520 0%, #280a35 30%, #1a0520 60%, #0f0318 100%)",
    accentColor: "#ab47bc",
    glowColor: "#ab47bc",
    icon: "/images/womens-history-venus.svg",
    showFrom: [3, 1],
    showUntil: [3, 31],
    eventDate: [3, 1],
    countdownOverride: "ALL MONTH",
    iconGlowRing: true,
  },
  {
    slug: "st-patricks-day",
    tag: "st-patricks-day",
    title: "St. Patrick's Day",
    subtitle: "Parade, pubs & plenty of green in the ATL",
    gradient: "linear-gradient(135deg, #020d02 0%, #0a2a0a 30%, #061a06 60%, #020d02 100%)",
    accentColor: "#4caf50",
    glowColor: "#4caf50",
    icon: "/images/shamrock-neon.svg",
    showFrom: [3, 12],
    showUntil: [3, 17],
    eventDate: [3, 17],
    iconBgGlow: true,
    iconGlowRing: true,
  },
];

/** Resolve eventDate to a JS Date for the current (or specified) year */
function resolveEventDate(h: HolidayConfig, referenceYear?: number): Date {
  if (h.eventDate.length === 2) {
    const year = referenceYear ?? new Date().getFullYear();
    return new Date(year, h.eventDate[0] - 1, h.eventDate[1]);
  }
  return new Date(h.eventDate[0], h.eventDate[1] - 1, h.eventDate[2]);
}

/** Check if a holiday is currently in its active display window */
export function isHolidayActive(h: HolidayConfig): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  // Auto-expiry: floating holidays with a past year are stale
  if (h.eventDate.length === 3 && h.eventDate[0] < currentYear) {
    return false;
  }

  const [fromM, fromD] = h.showFrom;
  const [untilM, untilD] = h.showUntil;
  const afterStart = month > fromM || (month === fromM && day >= fromD);
  const beforeEnd = month < untilM || (month === untilM && day <= untilD);
  return afterStart && beforeEnd;
}

/** Returns slugs of all holidays currently promoted to hero (up to 2), sorted by nearest event date */
export function getActiveHeroSlugs(): string[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const active = HOLIDAYS
    .filter(h => isHolidayActive(h))
    .map(h => {
      const eventDate = resolveEventDate(h, now.getFullYear());
      const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { slug: h.slug, daysUntil, isObservance: !!h.countdownOverride };
    })
    .sort((a, b) => {
      // Single-day holidays sort before month-long observances
      if (a.isObservance !== b.isObservance) return a.isObservance ? 1 : -1;
      return a.daysUntil - b.daysUntil;
    });

  return active.slice(0, 2).map(h => h.slug);
}

/** Compute countdown text and days until for a holiday */
export function computeCountdown(h: HolidayConfig): { countdown: string; daysUntil: number } {
  const now = new Date();
  const eventDate = resolveEventDate(h, now.getFullYear());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let countdown: string;
  if (h.countdownOverride) {
    countdown = h.countdownOverride;
  } else if (diff < 0) {
    countdown = "THIS WEEKEND";
  } else if (diff === 0) {
    countdown = "TODAY";
  } else if (diff === 1) {
    countdown = "TOMORROW";
  } else {
    countdown = `IN ${diff} DAYS`;
  }

  return { countdown, daysUntil: diff };
}

/** Get the first active holiday matching an optional slug, with countdown info */
export function getActiveHoliday(slug?: string): (HolidayConfig & { countdown: string; daysUntil: number }) | null {
  for (const h of HOLIDAYS) {
    if (slug && h.slug !== slug) continue;
    if (!isHolidayActive(h)) continue;

    const { countdown, daysUntil } = computeCountdown(h);
    return { ...h, countdown, daysUntil };
  }
  return null;
}
