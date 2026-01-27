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
      <div className="relative w-full aspect-video bg-[var(--night)] overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
          />
        ) : (
          <>
            {/* Layered background */}
            <div
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(ellipse 80% 60% at 50% -20%, ${accentColor}15 0%, transparent 50%),
                  linear-gradient(135deg, var(--twilight) 0%, var(--dusk) 100%)
                `,
              }}
            />

            {/* Subtle grid */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `
                  linear-gradient(${accentColor} 1px, transparent 1px),
                  linear-gradient(90deg, ${accentColor} 1px, transparent 1px)
                `,
                backgroundSize: "20px 20px",
              }}
            />

            {/* Decorative accent */}
            <div
              className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-[0.1]"
              style={{
                background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
              }}
            />

            {/* Icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="flex items-center justify-center w-12 h-12 rounded-lg"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}10 0%, ${accentColor}05 100%)`,
                  border: `1px solid ${accentColor}15`,
                }}
              >
                {icon ? (
                  <div style={{ color: accentColor, opacity: 0.5 }}>{icon}</div>
                ) : (
                  <svg className="w-6 h-6" style={{ color: accentColor, opacity: 0.4 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                )}
              </div>
            </div>
          </>
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
