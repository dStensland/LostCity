import { Noto_Serif, Source_Sans_3 } from "next/font/google";
import { resolvePortalSlugAlias } from "@/lib/portal-aliases";

export const hospitalDisplayFont = Noto_Serif({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const hospitalBodyFont = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const EMORY_DEMO_SLUG = "emory-demo";

export function isEmoryDemoPortal(portalSlug: string): boolean {
  return resolvePortalSlugAlias(portalSlug) === EMORY_DEMO_SLUG;
}

export const EMORY_THEME_SCOPE_CLASS = "emory-brand-native";

export const EMORY_THEME_CSS = `
  @import url("https://use.typekit.net/usv3fbs.css");

  /* NOTE: Variable names are inverted from the LostCity dark theme.
     In the dark theme --cream = light off-white, --ink = dark text.
     Here in the light Emory theme, --cream = dark text (#111827),
     --ink = near-black (#1a1a1a), so existing component classes
     (text-[var(--cream)]) render correctly on a white background. */
  .${EMORY_THEME_SCOPE_CLASS} {
    --cream: #111827;
    --ink: #1a1a1a;
    --muted: #1f2937;
    --card-bg: #ffffff;
    --twilight: #d7dce4;
    --line-strong: #c4ccd8;
    --surface-1: #f8f9fb;
    --surface-2: #f2f5f9;
    --surface-warm: #f7f7f7;
    --action-primary: #8ed585;
    --action-primary-hover: #7fcf75;
    --btn-primary-text: #002f6c;
    --portal-accent: #143b83;
    --card-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
    --card-shadow-soft: 0 8px 24px rgba(0, 0, 0, 0.07);
  }

  .${EMORY_THEME_SCOPE_CLASS} {
    color: var(--ink);
    font-family: "scandia-web", "source-sans-pro", "Source Sans 3", Arial, sans-serif;
  }

  .${EMORY_THEME_SCOPE_CLASS} h1,
  .${EMORY_THEME_SCOPE_CLASS} h2,
  .${EMORY_THEME_SCOPE_CLASS} h3,
  .${EMORY_THEME_SCOPE_CLASS} .emory-display {
    font-family: "superior-title", "Noto Serif", Georgia, serif;
    letter-spacing: -0.012em;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-kicker {
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #4b5563;
    font-weight: 700;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-panel {
    background: var(--card-bg);
    border: 1px solid var(--twilight);
    box-shadow: var(--card-shadow-soft);
    border-radius: 20px;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-panel:hover {
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.09);
    transition: box-shadow 200ms ease;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-panel-subtle {
    background: var(--surface-1);
    border: 1px solid var(--twilight);
    box-shadow: none;
    border-radius: 14px;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-chip {
    border-radius: 999px;
    border: 1px solid var(--line-strong);
    background: #f9fafb;
    color: #4b5563;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    padding: 0.24rem 0.58rem;
  }

  .${EMORY_THEME_SCOPE_CLASS} button.emory-chip:hover {
    background: #eef1f5;
    border-color: #9ca3af;
    transition: all 150ms ease;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-chip:focus-visible {
    outline: 3px solid var(--portal-accent);
    outline-offset: 2px;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-primary-btn {
    border-radius: 6px;
    border: 1px solid #7ecf75;
    background: var(--action-primary);
    color: var(--btn-primary-text);
    font-weight: 700;
    font-size: 13px;
    padding: 0.5rem 1rem;
    transition: background 160ms ease, border-color 160ms ease;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-primary-btn:hover {
    background: var(--action-primary-hover);
    border-color: #69bb5f;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-primary-btn:focus-visible {
    outline: 2px solid var(--portal-accent);
    outline-offset: 2px;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-secondary-btn {
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: #ffffff;
    color: #143b83;
    font-weight: 600;
    font-size: 13px;
    padding: 0.5rem 1rem;
    transition: background 160ms ease, border-color 160ms ease;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-secondary-btn:hover {
    background: #f6f8fc;
    border-color: #b7c2d3;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-secondary-btn:focus-visible {
    outline: 2px solid var(--portal-accent);
    outline-offset: 2px;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-link-btn {
    color: var(--portal-accent);
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-link-btn:hover {
    text-decoration: underline;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-photo-hero {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--twilight);
    border-radius: 14px;
    background: var(--hero-image, url("https://images.unsplash.com/photo-1666214280557-f1b5022eb634?auto=format&fit=crop&w=1800&q=80")) var(--hero-position, center) / cover no-repeat;
    box-shadow: var(--card-shadow);
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-photo-hero::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(180deg, rgba(255,255,255,0) 62%, rgba(0,0,0,0.34) 100%);
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-photo-hero .emory-kicker {
    color: #e5e7eb;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-hero-title {
    color: #f9fafb;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-hero-lede {
    color: #e5e7eb;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-hero-chip {
    border-radius: 999px;
    border: 1px solid rgba(229, 231, 235, 0.8);
    background: rgba(0, 47, 108, 0.86);
    color: #f9fafb;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 0.3rem 0.62rem;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-hero-lens {
    border-radius: 12px;
    border: 1px solid #dce2ea;
    background: #f9fafb;
    box-shadow: none;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-warm-section {
    background: var(--surface-warm);
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-photo-card {
    position: relative;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--twilight);
    min-height: 150px;
    background: var(--photo, linear-gradient(120deg, #d7e3f6, #eef3fb));
    background-size: cover;
    background-position: center;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-photo-card::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(5, 35, 82, 0.05), rgba(5, 35, 82, 0.35));
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-photo-card > * {
    position: relative;
    z-index: 1;
  }

  /* ── Warm community hub styles ── */
  .emory-brand-native .emory-warm-hero {
    background: #faf9f7;
    border: 1px solid #ede8e1;
    border-radius: 20px;
  }

  .emory-brand-native .emory-pathway-card {
    border-radius: 14px;
    border: 2px solid var(--twilight);
    min-height: 44px;
    transition: all 200ms ease;
    cursor: pointer;
  }

  .emory-brand-native .emory-pathway-card:hover {
    border-color: #e8a662;
    box-shadow: 0 4px 16px rgba(232, 166, 98, 0.12);
  }

  .emory-brand-native .emory-category-card {
    border-radius: 14px;
    border: 1px solid var(--twilight);
    border-left: 4px solid transparent;
    background: white;
    padding: 1rem;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .emory-brand-native .emory-category-card:hover {
    border-color: #c4a97d;
    box-shadow: 0 4px 16px rgba(196, 169, 125, 0.1);
  }

  .emory-brand-native .emory-category-card:focus-visible {
    outline: 3px solid var(--portal-accent);
    outline-offset: 2px;
  }

  .emory-brand-native .emory-category-card-active {
    border-left-color: #e8a662;
    background: #fffbf5;
  }

  .emory-brand-native .emory-private-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: rgba(244, 168, 150, 0.12);
    color: #c27a68;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
  }

  .emory-brand-native .emory-always-available {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: #f0f7ee;
    color: #205634;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
  }

  .emory-brand-native .emory-crisis-footer {
    background: linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%);
    border-radius: 12px;
    padding: 1.25rem;
    margin-top: 1.5rem;
  }

  .emory-brand-native .emory-story-card {
    border-radius: 10px;
    border: 1px solid var(--twilight);
    background: white;
    padding: 0.75rem;
    transition: box-shadow 200ms ease;
  }

  .emory-brand-native .emory-story-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  }

  .emory-brand-native .emory-story-card:focus-visible {
    outline: 3px solid var(--portal-accent);
    outline-offset: 2px;
  }

  .emory-brand-native .emory-org-card {
    border-radius: 10px;
    border: 1px solid var(--twilight);
    background: var(--surface-1);
    padding: 0.75rem;
  }

  /* ── Body background ── */
  .${EMORY_THEME_SCOPE_CLASS} {
    --body-bg: #f2f5fa;
  }
`;

// ── Shared hospital card images ──

export const HOSPITAL_CARD_IMAGE_BY_SLUG: Record<string, string> = {
  "emory-university-hospital": "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=1200&q=80",
  "emory-saint-josephs-hospital": "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1200&q=80",
  "emory-johns-creek-hospital": "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=1200&q=80",
  "emory-university-hospital-midtown": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80",
};

export const HOSPITAL_CARD_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80";

// ── Event fallback images by category ──

const EVENT_FALLBACK_IMAGES: Record<string, string> = {
  food: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=640&q=80",
  nutrition: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=640&q=80",
  fitness: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=640&q=80",
  wellness: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=640&q=80",
  support: "https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=640&q=80",
  screening: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=640&q=80",
  health: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=640&q=80",
  volunteer: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=640&q=80",
  community: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=640&q=80",
  family: "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=640&q=80",
  children: "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=640&q=80",
};

const EVENT_GENERIC_FALLBACK = "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=640&q=80";

const KEYWORD_PATTERNS: [RegExp, string][] = [
  [/\b(food|meal|nutrition|pantry|kitchen|cooking|eat|diet)\b/i, "food"],
  [/\b(fitness|walk|yoga|movement|exercise|run|gym|stretch)\b/i, "fitness"],
  [/\b(support|group|peer|caregiver|recovery|grief|circle)\b/i, "support"],
  [/\b(screening|clinic|vaccine|immuniz|blood pressure|checkup|testing)\b/i, "screening"],
  [/\b(volunteer|community service|give back|helping|hands on)\b/i, "volunteer"],
  [/\b(family|child|kid|parent|baby|maternal|prenatal|pediatric|youth)\b/i, "family"],
  [/\b(wellness|mindful|mental|meditation|self-care|stress)\b/i, "wellness"],
];

/**
 * Returns an appropriate fallback image URL based on event category and title keywords.
 * Avoids showing yoga photos for food events, etc.
 */
export function getEventFallbackImage(category: string | null, title: string | null): string {
  // Try category first
  if (category) {
    const normalizedCategory = category.toLowerCase().replace(/[^a-z]+/g, "_");
    const directMatch = EVENT_FALLBACK_IMAGES[normalizedCategory];
    if (directMatch) return directMatch;
  }

  // Try keyword matching on title + category
  const searchable = [category, title].filter(Boolean).join(" ");
  for (const [pattern, key] of KEYWORD_PATTERNS) {
    if (pattern.test(searchable)) {
      return EVENT_FALLBACK_IMAGES[key] || EVENT_GENERIC_FALLBACK;
    }
  }

  return EVENT_GENERIC_FALLBACK;
}
