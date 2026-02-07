import Link from "next/link";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
  portal?: string;
}

// Portal-specific configurations
const PORTAL_CONFIG: Record<string, { name: string; abbrev: string }> = {
  [DEFAULT_PORTAL_SLUG]: { name: "ATLANTA", abbrev: "ATL" },
  nashville: { name: "NASHVILLE", abbrev: "NSH" },
};

/**
 * Stylized Atlanta skyline — etched line art extending right from the logo.
 * Simplified silhouette: Bank of America spire, Westin cylinder, mid-rises.
 * Uses non-scaling-stroke so it stays crisp at any size.
 * Hidden on narrow screens to prevent crowding.
 */
function AtlantaSkyline() {
  return (
    <svg
      className="logo-skyline"
      viewBox="0 0 300 50"
      preserveAspectRatio="xMinYMax meet"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={[
          // Start from left ground
          "M0 49",
          // Low-rises approach
          "L12 49 L12 40 L20 40 L20 36 L26 36",
          // Bank of America Plaza — the iconic spire
          "L26 24 L29 24 L29 14 L31 14 L32 4 L33 14 L35 14 L35 24 L38 24",
          // Mid-rise cluster
          "L38 30 L46 30 L46 24 L52 24 L52 20 L58 20 L58 24 L64 24 L64 30",
          // Westin Peachtree — cylindrical tower
          "L68 30 L68 16 L71 13 L76 11 L81 13 L84 16 L84 30",
          // Downtown towers
          "L90 30 L90 22 L94 22 L94 28 L100 28 L100 20 L106 20 L106 28",
          // 191 Peachtree
          "L110 28 L110 16 L113 13 L116 16 L116 28",
          // More buildings trailing off
          "L122 28 L122 32 L130 32 L130 26 L136 26 L136 32 L142 32",
          // Taper down — city fading into distance
          "L142 36 L152 36 L152 40 L164 40 L164 44",
          "L178 44 L178 47 L196 47 L196 49 L300 49",
        ].join(" ")}
        stroke="var(--neon-cyan, #00D4E8)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function Logo({ size = "md", href = "/", className = "", portal }: LogoProps) {
  const portalConfig = portal ? PORTAL_CONFIG[portal] : null;
  const sizeClass = size === "sm" ? "logo-size-sm" : size === "md" ? "logo-size-md" : "logo-size-lg";
  const isAtlanta = portal === DEFAULT_PORTAL_SLUG;

  const content = (
    <span
      data-portal={portalConfig ? portal : undefined}
      className={`logo-root ${sizeClass}`}
    >
      {/* Cyan pulse — vertical line accent */}
      <span className="logo-pulse" aria-hidden="true" />

      {/* Stacked wordmark — tight overlap, chaotic energy */}
      <span className="logo-wordmark">
        <span className="logo-lost">LOST</span>
        <span className="logo-city">CITY</span>
        {/* City name tucked below CITY */}
        {portalConfig && (
          <span className="logo-portal">{portalConfig.name}</span>
        )}
      </span>

      {/* Etched skyline behind — Atlanta only, hidden on narrow screens */}
      {isAtlanta && <AtlantaSkyline />}
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
