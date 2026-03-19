"use client";

import Link from "next/link";
import { Umbrella, Sun, ArrowRight } from "@phosphor-icons/react";
import { FAMILY_TOKENS } from "@/lib/family-design-tokens";

const SAGE = FAMILY_TOKENS.sage;
const SKY = FAMILY_TOKENS.sky;
const TEXT = FAMILY_TOKENS.text;
const MUTED = FAMILY_TOKENS.textSecondary;

// ---- RainyDayBanner --------------------------------------------------------

/**
 * Shown when weather is rainy — promotes indoor activities.
 * Uses sky blue (#78B7D0) to match the sky/rain visual association.
 */
export function RainyDayBanner({
  portalSlug,
  condition,
}: {
  portalSlug: string;
  condition: string;
}) {
  return (
    <section>
      <div
        className="overflow-hidden rounded-2xl"
        style={{
          background: `linear-gradient(135deg, ${SKY}22 0%, ${SKY}0A 100%)`,
          border: `1px solid ${SKY}40`,
          padding: "14px 16px",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ width: 36, height: 36, backgroundColor: `${SKY}20` }}
          >
            <Umbrella size={18} weight="duotone" style={{ color: SKY }} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              style={{
                fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)",
                fontSize: 15,
                fontWeight: 700,
                color: TEXT,
                lineHeight: 1.3,
                marginBottom: 3,
              }}
            >
              Rainy Day Plan
            </p>
            <p
              style={{
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 12,
                color: MUTED,
                lineHeight: 1.45,
                marginBottom: 10,
              }}
            >
              {condition} today — here are the best indoor activities to keep the crew busy.
            </p>
            <Link
              href={`/${portalSlug}?tab=programs`}
              className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              style={{
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 12,
                fontWeight: 600,
                color: SKY,
              }}
            >
              Browse indoor activities <ArrowRight size={12} weight="bold" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---- GetOutsideBanner ------------------------------------------------------

/**
 * Shown when weather is clear and warm — promotes outdoor activities.
 * Uses sage green to match the outdoor/nature visual.
 */
export function GetOutsideBanner({
  portalSlug,
  condition,
  temp,
}: {
  portalSlug: string;
  condition: string;
  temp: number;
}) {
  return (
    <section>
      <div
        className="overflow-hidden rounded-2xl"
        style={{
          background: `linear-gradient(135deg, ${SAGE}18 0%, ${SAGE}08 100%)`,
          border: `1px solid ${SAGE}35`,
          padding: "14px 16px",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ width: 36, height: 36, backgroundColor: `${SAGE}18` }}
          >
            <Sun size={18} weight="duotone" style={{ color: SAGE }} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              style={{
                fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)",
                fontSize: 15,
                fontWeight: 700,
                color: TEXT,
                lineHeight: 1.3,
                marginBottom: 3,
              }}
            >
              Get Outside
            </p>
            <p
              style={{
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 12,
                color: MUTED,
                lineHeight: 1.45,
                marginBottom: 10,
              }}
            >
              {condition} and {temp}°F — a great day to head outdoors with the kids.
            </p>
            <Link
              href={`/${portalSlug}?view=find&type=events&tags=family-friendly&outdoor=1`}
              className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              style={{
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                fontSize: 12,
                fontWeight: 600,
                color: SAGE,
              }}
            >
              Browse outdoor activities <ArrowRight size={12} weight="bold" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
