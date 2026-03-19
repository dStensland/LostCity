"use client";

import Link from "next/link";
import { FAMILY_TOKENS } from "@/lib/family-design-tokens";

const SAGE = FAMILY_TOKENS.sage;
const BORDER = FAMILY_TOKENS.border;

// ---- SectionLabel ----------------------------------------------------------

export function SectionLabel({
  text,
  color,
  rightSlot,
}: {
  text: string;
  color: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span
        style={{
          color,
          fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
        }}
      >
        {text}
      </span>
      {rightSlot}
    </div>
  );
}

// ---- SeeAllLink ------------------------------------------------------------

export function SeeAllLink({
  href,
  label = "See all →",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="hover:opacity-70 transition-opacity"
      style={{ color: SAGE, fontSize: 12, fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}
    >
      {label}
    </Link>
  );
}

// ---- SkeletonBlock ---------------------------------------------------------

export function SkeletonBlock({ height = 60 }: { height?: number }) {
  return (
    <div
      className="rounded-2xl animate-pulse"
      style={{ height, backgroundColor: BORDER }}
    />
  );
}
