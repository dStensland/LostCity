"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";

export interface RelatedCardProps {
  variant: "compact" | "image";
  href: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  icon?: ReactNode;
  accentColor?: string;
}

export function RelatedCard({
  variant,
  href,
  title,
  subtitle,
  imageUrl,
  icon,
  accentColor = "var(--coral)",
}: RelatedCardProps) {
  if (variant === "compact") {
    return (
      <Link
        href={href}
        className="flex items-center gap-3 p-3 rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] transition-all hover:bg-[var(--card-bg-hover)] hover:border-[var(--soft)] snap-start min-w-[280px] sm:min-w-0"
      >
        {icon && (
          <div
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: `${accentColor}20`,
              color: accentColor,
            }}
          >
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--cream)] truncate">{title}</h3>
          {subtitle && (
            <p className="text-xs text-[var(--muted)] truncate">{subtitle}</p>
          )}
        </div>
        <svg className="w-4 h-4 text-[var(--muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="group block rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] overflow-hidden transition-all hover:bg-[var(--card-bg-hover)] hover:border-[var(--soft)] snap-start min-w-[280px] sm:min-w-0"
    >
      <div className="relative w-full aspect-video bg-[var(--dusk)]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {icon || (
              <svg className="w-12 h-12 text-[var(--muted)] opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-sm font-semibold text-[var(--cream)] mb-1 line-clamp-2 group-hover:text-glow" style={{ "--glow-color": accentColor } as React.CSSProperties}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-[var(--muted)] line-clamp-1">{subtitle}</p>
        )}
      </div>
    </Link>
  );
}
