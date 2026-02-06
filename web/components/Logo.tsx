import Link from "next/link";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
  portal?: string;
}

// Portal-specific configurations
const PORTAL_CONFIG: Record<string, { name: string; color: string; glow: string }> = {
  [DEFAULT_PORTAL_SLUG]: { name: "ATLANTA", color: "var(--gold)", glow: "rgba(255, 215, 0, 0.4)" },
  nashville: { name: "NASHVILLE", color: "var(--neon-cyan)", glow: "rgba(0, 229, 255, 0.4)" },
};

const SIZE_CONFIG = {
  sm: { text: "1.1rem", portal: "0.85em", icon: 0, gap: "gap-0", weight: 900 as const, tracking: "0.08em", inline: true },
  md: { text: "1.5rem", portal: "0.7rem", icon: 20, gap: "gap-2", weight: 800 as const, tracking: "0.06em", inline: false },
  lg: { text: "2.5rem", portal: "1.1rem", icon: 30, gap: "gap-2.5", weight: 900 as const, tracking: "0.06em", inline: false },
};

export default function Logo({ size = "md", href = "/", className = "", portal }: LogoProps) {
  const config = SIZE_CONFIG[size];
  const portalConfig = portal ? PORTAL_CONFIG[portal] : null;

  // Abbreviate city name at sm size
  const portalLabel = portalConfig
    ? config.inline
      ? (portalConfig.name === "ATLANTA" ? "ATL" : portalConfig.name.slice(0, 3))
      : portalConfig.name
    : null;

  const sizeClass = size === "sm" ? "logo-size-sm" : size === "md" ? "logo-size-md" : "logo-size-lg";

  const content = (
    <span
      data-portal={portalConfig ? portal : undefined}
      className={`inline-flex items-center logo-root ${config.gap} ${sizeClass} ${
        config.inline ? "logo-inline" : "logo-stack"
      }`}
    >
      {/* Abstract geometric mark — hidden at sm size */}
      {config.icon > 0 && (
        <svg
          viewBox="0 0 20 24"
          width={config.icon}
          height={Math.round(config.icon * 1.2)}
          fill="none"
          aria-hidden="true"
          className="flex-shrink-0"
        >
          <path
            d="M10 1L18.5 10L10 23L1.5 10Z"
            fill="#FF6B7A"
          />
          <circle cx="10" cy="10.5" r="3" fill="var(--void, #0a0a0f)" />
        </svg>
      )}
      {config.inline ? (
        /* Single-line lockup for sm size */
        <span className={`logo-text ${sizeClass}`}>
          <span className="logo-lost">LOST</span>
          <span className="logo-city">CITY</span>
          {portalConfig && portalLabel && (
            <span
              className="logo-portal logo-portal-inline"
            >
              {portalLabel}
            </span>
          )}
        </span>
      ) : (
        /* Stacked layout for md/lg */
        <span className="inline-flex flex-col logo-stack">
          <span className={`logo-text ${sizeClass}`}>
            <span className="logo-lost">LOST</span>
            <span className="logo-city">CITY</span>
          </span>
          {portalConfig && portalLabel && (
            <span
              className="logo-portal logo-portal-stack"
            >
              {portalLabel}
            </span>
          )}
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className={`group ${className}`}>
        {content}
      </Link>
    );
  }

  return <span className={className}>{content}</span>;
}
