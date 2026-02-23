"use client";

/**
 * ConversionCard — sign-up taste moments for anonymous or low-engagement users.
 *
 * Types: friends_teaser, save_teaser, calendar_teaser, prefs_teaser.
 * Each renders only once per session. Progressive reveal of feed improvements.
 */

import { useState } from "react";
import Link from "next/link";
import {
  Users,
  BookmarkSimple,
  CalendarCheck,
  SlidersHorizontal,
  ArrowRight,
} from "@phosphor-icons/react";
import type { CityPulseConversionItem } from "@/lib/city-pulse/types";

interface ConversionCardProps {
  conversion: CityPulseConversionItem["conversion"];
}

function getPromptIcon(promptType: string) {
  switch (promptType) {
    case "friends_teaser":
      return <Users weight="duotone" className="w-5 h-5" />;
    case "save_teaser":
      return <BookmarkSimple weight="duotone" className="w-5 h-5" />;
    case "calendar_teaser":
      return <CalendarCheck weight="duotone" className="w-5 h-5" />;
    case "prefs_teaser":
      return <SlidersHorizontal weight="duotone" className="w-5 h-5" />;
    default:
      return <Users weight="duotone" className="w-5 h-5" />;
  }
}

function getPromptAccent(promptType: string): string {
  switch (promptType) {
    case "friends_teaser":
      return "var(--neon-cyan)";
    case "save_teaser":
      return "var(--coral)";
    case "calendar_teaser":
      return "var(--gold)";
    case "prefs_teaser":
      return "var(--action-primary)";
    default:
      return "var(--action-primary)";
  }
}

export default function ConversionCard({ conversion }: ConversionCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const accent = getPromptAccent(conversion.prompt_type);

  return (
    <div
      className="relative overflow-hidden rounded-xl border"
      style={{
        borderColor: `color-mix(in srgb, ${accent} 20%, transparent)`,
        background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 8%, var(--card-bg)), var(--card-bg))`,
      }}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Icon */}
        <div
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
          style={{
            backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
            color: accent,
          }}
        >
          {getPromptIcon(conversion.prompt_type)}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--cream)]">
            {conversion.headline}
          </p>
        </div>

        {/* CTA */}
        <Link
          href={conversion.cta_href}
          className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-mono text-xs font-medium transition-colors"
          style={{
            backgroundColor: accent,
            color: "var(--btn-primary-text, #000)",
          }}
        >
          {conversion.cta_label}
          <ArrowRight weight="bold" className="w-3 h-3" />
        </Link>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-[var(--muted)] hover:text-[var(--cream)] transition-colors p-2.5 -mr-1"
          aria-label="Dismiss"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
