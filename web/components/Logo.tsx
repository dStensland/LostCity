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

export default function Logo({ size = "md", href = "/", className = "", portal }: LogoProps) {
  const portalConfig = portal ? PORTAL_CONFIG[portal] : null;
  const sizeClass = size === "sm" ? "logo-size-sm" : size === "md" ? "logo-size-md" : "logo-size-lg";

  const content = (
    <span
      data-portal={portalConfig ? portal : undefined}
      className={`logo-root ${sizeClass}`}
    >
      {/* Cyan pulse — vertical line accent */}
      <span className="logo-pulse" aria-hidden="true" />

      {/* Stacked wordmark */}
      <span className="logo-wordmark">
        <span className="logo-lost">LOST</span>
        <span className="logo-city">CITY</span>
        {portalConfig && (
          <span className="logo-portal">
            {size === "sm" ? portalConfig.abbrev : portalConfig.name}
          </span>
        )}
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className={`group inline-flex items-center ${className}`}>
        {content}
      </Link>
    );
  }

  return <span className={className}>{content}</span>;
}
