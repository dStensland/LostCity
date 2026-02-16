import { resolvePortalSlugAlias } from "@/lib/portal-aliases";

export const DOG_PORTAL_SLUG = "atl-dogs";

export function isDogPortal(portalSlug: string): boolean {
  return resolvePortalSlugAlias(portalSlug) === DOG_PORTAL_SLUG;
}

export const DOG_THEME_SCOPE_CLASS = "dog-brand-native";

/** Content type → color mapping for badges and no-photo fallback cards */
export const DOG_CONTENT_COLORS = {
  events: "#FF6F59",
  parks: "#FFD23F",
  services: "#06BCC1",
  trails: "#059669",
  food: "#FF6B35",
  adoption: "#E879A0",
} as const;

/** Content type → emoji for no-photo fallback cards */
export const DOG_CONTENT_EMOJI = {
  events: "🎉",
  parks: "🌳",
  services: "🦴",
  trails: "🥾",
  food: "🍽️",
  adoption: "❤️",
} as const;

export type DogContentType = keyof typeof DOG_CONTENT_COLORS;

export function classifyDogContentType(
  venueType: string | null | undefined,
  vibes: string[] | null | undefined,
  tags: string[] | null | undefined,
  isEvent: boolean
): DogContentType {
  if (isEvent) return "events";

  const type = (venueType || "").toLowerCase();
  const vibeStr = (vibes || []).join(" ").toLowerCase();
  const tagStr = (tags || []).join(" ").toLowerCase();
  const haystack = `${type} ${vibeStr} ${tagStr}`;

  if (
    haystack.includes("shelter") ||
    haystack.includes("rescue") ||
    haystack.includes("adoption")
  )
    return "adoption";

  if (
    haystack.includes("trail") ||
    haystack.includes("hik") ||
    haystack.includes("nature") ||
    haystack.includes("preserve")
  )
    return "trails";

  if (
    haystack.includes("park") ||
    haystack.includes("off-leash") ||
    haystack.includes("dog-park")
  )
    return "parks";

  if (
    haystack.includes("restaurant") ||
    haystack.includes("bakery") ||
    haystack.includes("cafe") ||
    haystack.includes("brewery") ||
    haystack.includes("patio") ||
    haystack.includes("bar")
  )
    return "food";

  if (
    haystack.includes("vet") ||
    haystack.includes("groomer") ||
    haystack.includes("daycare") ||
    haystack.includes("training") ||
    haystack.includes("pet-store") ||
    haystack.includes("pet_store")
  )
    return "services";

  return "parks"; // default fallback
}

export const DOG_THEME_CSS = `
  .${DOG_THEME_SCOPE_CLASS} {
    --dog-orange: #FF6B35;
    --dog-gold: #F7931E;
    --dog-teal: #06BCC1;
    --dog-cream: #FFFBEB;
    --dog-charcoal: #292524;
    --dog-stone: #78716C;
    --dog-border: #FDE68A;
    --dog-coral: #FF6F59;
    --dog-yellow: #FFD23F;
    --dog-green: #059669;
    --dog-error: #EF4444;
    --dog-card-bg: #FFFFFF;
    --dog-card-shadow: 0 4px 16px rgba(255, 107, 53, 0.1);
    --dog-card-shadow-hover: 0 8px 24px rgba(255, 107, 53, 0.16);
    --dog-radius: 16px;
    --dog-radius-sm: 10px;
    --dog-radius-pill: 999px;
  }

  .${DOG_THEME_SCOPE_CLASS} {
    color: var(--dog-charcoal);
    background: var(--dog-cream);
    font-family: var(--font-dog), 'Plus Jakarta Sans', system-ui, sans-serif;
  }

  .${DOG_THEME_SCOPE_CLASS} h1,
  .${DOG_THEME_SCOPE_CLASS} h2,
  .${DOG_THEME_SCOPE_CLASS} h3,
  .${DOG_THEME_SCOPE_CLASS} .dog-display {
    font-family: var(--font-dog), 'Plus Jakarta Sans', system-ui, sans-serif;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .${DOG_THEME_SCOPE_CLASS} .dog-card {
    background: var(--dog-card-bg);
    border-radius: var(--dog-radius);
    box-shadow: var(--dog-card-shadow);
    overflow: hidden;
    transition: transform 200ms ease, box-shadow 200ms ease;
  }

  @media (hover: hover) {
    .${DOG_THEME_SCOPE_CLASS} .dog-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--dog-card-shadow-hover);
    }
  }

  .${DOG_THEME_SCOPE_CLASS} .dog-pill {
    border-radius: var(--dog-radius-pill);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    padding: 0.25rem 0.7rem;
  }

  .${DOG_THEME_SCOPE_CLASS} .dog-btn-primary {
    border-radius: var(--dog-radius-pill);
    background: var(--dog-orange);
    color: #FFFFFF;
    font-weight: 700;
    font-size: 14px;
    padding: 0.6rem 1.4rem;
    border: none;
    cursor: pointer;
    transition: transform 200ms ease, background 160ms ease;
  }

  .${DOG_THEME_SCOPE_CLASS} .dog-btn-primary:hover {
    background: #e55a27;
  }

  .${DOG_THEME_SCOPE_CLASS} .dog-btn-primary:active {
    transform: scale(1.05);
  }

  .${DOG_THEME_SCOPE_CLASS} .dog-btn-secondary {
    border-radius: var(--dog-radius-pill);
    background: transparent;
    color: var(--dog-charcoal);
    font-weight: 600;
    font-size: 14px;
    padding: 0.55rem 1.3rem;
    border: 2px solid var(--dog-border);
    cursor: pointer;
    transition: background 160ms ease, border-color 160ms ease;
  }

  .${DOG_THEME_SCOPE_CLASS} .dog-btn-secondary:hover {
    background: rgba(253, 232, 138, 0.2);
    border-color: var(--dog-gold);
  }

  .${DOG_THEME_SCOPE_CLASS} .dog-section-title {
    font-family: var(--font-dog), 'Plus Jakarta Sans', system-ui, sans-serif;
    font-weight: 800;
    font-size: 1.35rem;
    color: var(--dog-charcoal);
    margin-bottom: 0.75rem;
  }

  .${DOG_THEME_SCOPE_CLASS} .dog-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 3px 8px;
    border-radius: 6px;
    color: #fff;
  }

  /* Card image zoom on hover */
  @media (hover: hover) {
    .${DOG_THEME_SCOPE_CLASS} .dog-card:active {
      transform: scale(0.98);
    }
  }

  /* Smooth link focus */
  .${DOG_THEME_SCOPE_CLASS} a:focus-visible {
    outline: 2px solid var(--dog-orange);
    outline-offset: 2px;
    border-radius: var(--dog-radius-sm);
  }
`;

/**
 * CSS variable overrides that remap the standard neon theme vars to dog
 * portal colors. Apply to the dog portal root wrapper so ALL child
 * components (detail views, cards, etc.) automatically get the warm theme.
 */
export const DOG_PORTAL_VAR_OVERRIDES = `
  /* Remap neon surface vars to dog cream palette */
  --void: #FFFBEB;
  --night: #FEF3C7;
  --dusk: #FFFFFF;
  --twilight: #FDE68A;

  /* Remap neon text vars to dog charcoal/stone */
  --cream: #292524;
  --soft: #44403C;
  --muted: #78716C;

  /* Remap neon accent vars to dog orange */
  --coral: #FF6B35;
  --coral-light: #FF8C5A;
  --coral-bg: rgba(255, 107, 53, 0.05);
  --rose: #E55A27;
  --gold: #F7931E;
  --neon-green: #059669;
  --neon-amber: #F7931E;
  --neon-magenta: #FF6B35;
  --lavender: #06BCC1;

  /* Skeleton shimmer for light bg */
  --placeholder-color: #FDE68A;
`;

/**
 * CSS overrides for neon-specific component classes used in detail views.
 * These override the dark glassmorphism back button, hero fallback, and
 * section headers to match the warm cream aesthetic.
 */
export const DOG_DETAIL_VIEW_CSS = `
  /* Back button: warm cream instead of dark glass */
  .neon-back-btn {
    background: rgba(255, 255, 255, 0.85) !important;
    backdrop-filter: blur(8px) !important;
    border: 1px solid var(--dog-border, #FDE68A) !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
  }
  .neon-back-btn:hover {
    border-color: var(--dog-orange, #FF6B35) !important;
    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.15) !important;
  }
  .neon-back-icon { color: var(--dog-orange, #FF6B35) !important; }
  .neon-back-text { color: var(--dog-charcoal, #292524) !important; }
  .neon-back-btn:hover .neon-back-text { color: var(--dog-orange, #FF6B35) !important; }

  /* Hero fallback: warm gradient instead of void/neon */
  .hero-fallback-ambient {
    background: linear-gradient(135deg, #FDE68A 0%, #FBBF24 50%, #FF6B35 100%) !important;
    opacity: 0.2 !important;
  }
  .hero-fallback-topline {
    background: linear-gradient(90deg, transparent, var(--dog-orange, #FF6B35), transparent) !important;
  }
  .hero-fallback-icon {
    background: rgba(255, 107, 53, 0.15) !important;
    border: 1px solid rgba(255, 107, 53, 0.3) !important;
  }
  .hero-fallback-scanlines { display: none !important; }

  /* Neon section headers: warm solid instead of glow */
  .neon-coral-wash { background: rgba(255, 107, 53, 0.08) !important; }
  .neon-coral-line { background: linear-gradient(90deg, transparent, var(--dog-border, #FDE68A), transparent) !important; }
  .text-coral-glow-outer { color: var(--dog-orange, #FF6B35) !important; }
  .text-coral-glow-main { color: var(--dog-charcoal, #292524) !important; }
  .text-blur-soft { filter: none !important; }
  .coral-sweep { display: none !important; }

  /* Skeleton on light bg */
  .skeleton-shimmer {
    background: linear-gradient(90deg, #FDE68A 25%, #FEF3C7 50%, #FDE68A 75%) !important;
    background-size: 200% 100% !important;
  }

  /* Series/accent color adjustments */
  .series-accent { color: var(--dog-orange, #FF6B35) !important; }
  .series-bg-20 { background: rgba(255, 107, 53, 0.1) !important; }
  .bg-accent-15 { background: rgba(255, 107, 53, 0.1) !important; }
  .border-accent-40 { border-color: rgba(255, 107, 53, 0.3) !important; }
  .text-accent { color: var(--dog-orange, #FF6B35) !important; }
  .bg-accent-20 { background: rgba(255, 107, 53, 0.12) !important; }
`;
