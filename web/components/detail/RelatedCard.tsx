"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import CategoryPlaceholder from "../CategoryPlaceholder";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

export interface RelatedCardProps {
  variant: "compact" | "image";
  href: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  icon?: ReactNode;
  category?: string | null;
  accentColor?: string;
}

export function RelatedCard({
  variant,
  href,
  title,
  subtitle,
  imageUrl,
  icon,
  category,
  accentColor = "var(--coral)",
}: RelatedCardProps) {
  const accentClass = createCssVarClass("--accent-color", accentColor, "related-card");

  if (variant === "compact") {
    return (
      <>
        <ScopedStyles css={accentClass?.css} />
        <Link
          href={href}
          className={`flex items-center gap-3.5 p-3.5 rounded-xl border border-[var(--twilight)]/80 bg-[var(--card-bg)] transition-all hover:bg-[var(--card-bg-hover)] hover:border-[var(--soft)] snap-start min-w-[280px] sm:min-w-0 related-card-accent ${
            accentClass?.className ?? ""
          }`}
        >
          {icon && (
            <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center related-card-icon border border-[var(--twilight)]/60 bg-[var(--night)]/35">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-[0.95rem] leading-tight font-semibold text-[var(--cream)] line-clamp-2">{title}</h3>
            {subtitle && (
              <p className="mt-1 text-[0.72rem] text-[var(--muted)] line-clamp-1">{subtitle}</p>
            )}
          </div>
          <svg className="w-4 h-4 text-[var(--muted)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </>
    );
  }

  return (
    <>
      <ScopedStyles css={accentClass?.css} />
      <Link
        href={href}
        className={`group block rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] overflow-hidden transition-all hover:bg-[var(--card-bg-hover)] hover:border-[var(--soft)] snap-start min-w-[280px] sm:min-w-0 related-card-accent ${
          accentClass?.className ?? ""
        }`}
      >
        <div className="relative w-full aspect-video bg-[var(--night)] overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={title}
              fill
              className="object-cover"
            />
          ) : (
            <CategoryPlaceholder category={category} color={accentColor} size="sm" />
          )}
        </div>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-[var(--cream)] mb-1 line-clamp-2 group-hover:text-glow related-card-title">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-[var(--muted)] line-clamp-1">{subtitle}</p>
          )}
        </div>
      </Link>
    </>
  );
}
