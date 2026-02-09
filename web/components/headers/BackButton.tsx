"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

interface BackButtonProps {
  href?: string;
  fallbackHref?: string;
  label: string;
  className?: string;
  /** Hide the text label, show only the arrow icon. */
  iconOnly?: boolean;
}

const arrowIcon = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const defaultClassName =
  "flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--cream)] transition-colors mr-1";

/**
 * Smart back button for detail page headers.
 *
 * - If `href` is provided, renders a Next.js Link (always navigates there).
 * - Otherwise uses `router.back()` when the user has in-app history
 *   (same-origin referrer), and falls back to `fallbackHref` (typically
 *   the portal home) when opened directly or from an external site.
 */
export default function BackButton({ href, fallbackHref, label, className, iconOnly }: BackButtonProps) {
  const router = useRouter();

  const cls = className || defaultClassName;

  if (href) {
    return (
      <Link href={href} className={cls} aria-label={`Back to ${label}`}>
        {arrowIcon}
        {!iconOnly && <span className="font-mono text-xs hidden sm:inline">{label}</span>}
      </Link>
    );
  }

  const handleBack = () => {
    // Use history length to detect if user has navigable history.
    // In SPAs, document.referrer only tracks the last full page load,
    // not client-side route changes, so it's unreliable.
    // history.length > 1 means there's at least one entry to go back to.
    // (A fresh tab starts at 1; each navigation adds an entry.)
    if (window.history.length > 1) {
      router.back();
    } else if (fallbackHref) {
      router.replace(fallbackHref);
    } else {
      router.back();
    }
  };

  return (
    <button onClick={handleBack} className={cls} aria-label={`Back to ${label}`}>
      {arrowIcon}
      {!iconOnly && <span className="font-mono text-xs hidden sm:inline">{label}</span>}
    </button>
  );
}
