import Link from "next/link";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
  portal?: string;
}

// Portal-specific configurations
const PORTAL_CONFIG: Record<string, { name: string; color: string }> = {
  [DEFAULT_PORTAL_SLUG]: { name: "ATLANTA", color: "var(--gold)" }, // Golden for Atlanta
};

export default function Logo({ size = "md", href = "/", className = "", portal }: LogoProps) {
  const sizeConfig = {
    sm: { fontSize: "1.5rem", lineHeight: 0.85, portalSize: "0.6rem", strokeWidth: "1px", fontWeight: 700 },
    md: { fontSize: "2rem", lineHeight: 0.85, portalSize: "0.75rem", strokeWidth: "1.5px", fontWeight: 700 },
    lg: { fontSize: "3.5rem", lineHeight: 0.85, portalSize: "1.25rem", strokeWidth: "2px", fontWeight: 800 },
  };

  const config = sizeConfig[size];
  const portalConfig = portal ? PORTAL_CONFIG[portal] : null;

  const content = (
    <span
      className={`inline-flex flex-col items-start`}
      style={{ lineHeight: config.lineHeight }}
    >
      <span
        className="font-[var(--font-outfit)] tracking-[0.02em]"
        style={{
          fontFamily: "var(--font-outfit), sans-serif",
          fontSize: config.fontSize,
          fontWeight: config.fontWeight,
          color: "#FF6B7A", // Brand coral - hardcoded to avoid portal theme overrides
          letterSpacing: "0.05em",
        }}
      >
        LOST
      </span>
      <span
        className="font-[var(--font-outfit)] tracking-[0.02em]"
        style={{
          fontFamily: "var(--font-outfit), sans-serif",
          fontSize: config.fontSize,
          fontWeight: config.fontWeight,
          color: "transparent",
          WebkitTextStroke: `${config.strokeWidth} #ffffff`,
          letterSpacing: "0.05em",
        }}
      >
        CITY
      </span>
      {portalConfig && (
        <span
          className="font-[var(--font-outfit)] tracking-[0.15em] mt-0.5"
          style={{
            fontFamily: "var(--font-outfit), sans-serif",
            fontSize: config.portalSize,
            fontWeight: 600,
            color: portalConfig.color,
            textShadow: portal === DEFAULT_PORTAL_SLUG ? "0 0 10px rgba(255, 215, 0, 0.4)" : "0 0 10px rgba(255, 107, 107, 0.4)",
          }}
        >
          {portalConfig.name}
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
