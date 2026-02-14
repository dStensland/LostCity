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

  .${EMORY_THEME_SCOPE_CLASS} {
    --cream: #111827;
    --ink: #1a1a1a;
    --muted: #4b5563;
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
    --card-shadow-soft: 0 6px 18px rgba(0, 0, 0, 0.06);
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
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b7280;
    font-weight: 700;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-panel {
    background: var(--card-bg);
    border: 1px solid var(--twilight);
    box-shadow: var(--card-shadow-soft);
    border-radius: 20px;
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
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    padding: 0.24rem 0.58rem;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-primary-btn {
    border-radius: 6px;
    border: 1px solid #7ecf75;
    background: var(--action-primary);
    color: var(--btn-primary-text);
    font-weight: 700;
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
`;
