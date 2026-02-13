import { Noto_Serif, Source_Sans_3 } from "next/font/google";

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
  return portalSlug === EMORY_DEMO_SLUG;
}

export const EMORY_THEME_SCOPE_CLASS = "emory-brand-native";

export const EMORY_THEME_CSS = `
  .${EMORY_THEME_SCOPE_CLASS} {
    --cream: #002f6c;
    --ink: #1e3d64;
    --muted: #4f6687;
    --night: #edf3fb;
    --card-bg: #ffffff;
    --twilight: #c7d5ea;
    --line-strong: #aac0df;
    --surface-1: #f9fbff;
    --surface-2: #f1f5fc;
    --surface-warm: #f7f1e8;
    --action-primary: #8ed585;
    --action-primary-hover: #7bcf74;
    --btn-primary-text: #002f6c;
    --portal-accent: #245ebc;
    --card-shadow: 0 16px 38px rgba(3, 43, 100, 0.1);
    --card-shadow-soft: 0 8px 24px rgba(3, 43, 100, 0.08);
  }

  .${EMORY_THEME_SCOPE_CLASS} {
    color: var(--ink);
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-kicker {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 700;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-panel {
    background: linear-gradient(180deg, var(--card-bg) 0%, var(--surface-1) 100%);
    border: 1px solid color-mix(in srgb, var(--twilight) 85%, white 15%);
    box-shadow: var(--card-shadow-soft);
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-panel-subtle {
    background: linear-gradient(180deg, var(--surface-1) 0%, var(--surface-2) 100%);
    border: 1px solid color-mix(in srgb, var(--twilight) 78%, white 22%);
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-chip {
    border-radius: 9999px;
    border: 1px solid color-mix(in srgb, var(--twilight) 80%, white 20%);
    background: color-mix(in srgb, var(--surface-2) 70%, white 30%);
    color: var(--muted);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 0.25rem 0.65rem;
    text-transform: uppercase;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-primary-btn {
    border-radius: 9999px;
    border: 1px solid color-mix(in srgb, var(--action-primary) 80%, #68bf5d 20%);
    background: linear-gradient(90deg, var(--action-primary) 0%, color-mix(in srgb, var(--action-primary) 75%, white 25%) 100%);
    color: var(--btn-primary-text);
    font-weight: 700;
    box-shadow: 0 4px 14px color-mix(in srgb, var(--action-primary) 34%, transparent);
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-primary-btn:hover {
    background: linear-gradient(90deg, var(--action-primary-hover) 0%, color-mix(in srgb, var(--action-primary-hover) 78%, white 22%) 100%);
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-secondary-btn {
    border-radius: 9999px;
    border: 1px solid color-mix(in srgb, var(--line-strong) 70%, white 30%);
    background: color-mix(in srgb, var(--card-bg) 70%, var(--surface-1) 30%);
    color: var(--cream);
    font-weight: 600;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-secondary-btn:hover {
    background: color-mix(in srgb, var(--surface-1) 82%, white 18%);
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-photo-hero {
    position: relative;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--twilight) 70%, white 30%);
    background:
      linear-gradient(102deg, rgba(8, 35, 78, 0.86) 0%, rgba(7, 37, 82, 0.7) 48%, rgba(7, 38, 82, 0.32) 100%),
      var(--hero-image, url("https://images.unsplash.com/photo-1666214280557-f1b5022eb634?auto=format&fit=crop&w=1800&q=80")) var(--hero-position, center)/cover no-repeat;
    box-shadow: var(--card-shadow);
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-photo-hero::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 40%);
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-photo-hero .emory-kicker {
    color: #bfd0ea;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-hero-title {
    color: #f6faff;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-hero-lede {
    color: #dce8fa;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-hero-chip {
    border-radius: 9999px;
    border: 1px solid rgba(186, 205, 230, 0.55);
    background: rgba(255, 255, 255, 0.14);
    color: #f1f7ff;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 0.3rem 0.68rem;
    text-transform: uppercase;
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-hero-lens {
    border-radius: 18px;
    border: 1px solid #c0d8bb;
    background: linear-gradient(180deg, rgba(247, 252, 255, 0.95) 0%, rgba(234, 245, 251, 0.95) 100%);
    box-shadow: 0 12px 30px rgba(4, 39, 88, 0.18);
    backdrop-filter: blur(4px);
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-warm-section {
    background:
      linear-gradient(180deg, var(--card-bg) 0%, color-mix(in srgb, var(--surface-warm) 40%, var(--surface-1) 60%) 100%);
  }

  .${EMORY_THEME_SCOPE_CLASS} .emory-photo-card {
    position: relative;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--twilight) 80%, white 20%);
    min-height: 132px;
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
