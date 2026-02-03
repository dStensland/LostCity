"use client";

import { memo } from "react";
import { DESIGN_TOKENS, token, cssVar } from "@/lib/design-tokens";

/**
 * Example component demonstrating the three-layer design token system.
 * This shows how to use tokens in both Tailwind classes and inline styles.
 */
export const DesignTokenExample = memo(function DesignTokenExample() {
  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-display" style={{ color: cssVar("text-primary") }}>
        Design Token Examples
      </h2>

      {/* Brand colors */}
      <section className="space-y-3">
        <h3 className={token("text", "text-secondary")}>Brand Colors</h3>
        <div className="flex gap-3">
          <div
            className="w-20 h-20 rounded-lg"
            style={{ backgroundColor: DESIGN_TOKENS.brand.primary }}
          />
          <div
            className="w-20 h-20 rounded-lg"
            style={{ backgroundColor: DESIGN_TOKENS.brand.secondary }}
          />
          <div
            className="w-20 h-20 rounded-lg"
            style={{ backgroundColor: DESIGN_TOKENS.brand.accent }}
          />
        </div>
      </section>

      {/* Action buttons */}
      <section className="space-y-3">
        <h3 className={token("text", "text-secondary")}>Action Buttons</h3>
        <div className="flex gap-3">
          <button
            className="px-4 py-2 rounded-lg transition-colors"
            style={{
              backgroundColor: DESIGN_TOKENS.button.primaryBg,
              color: DESIGN_TOKENS.button.primaryText,
            }}
          >
            Primary Button
          </button>
          <button
            className="px-4 py-2 rounded-lg transition-colors"
            style={{
              backgroundColor: DESIGN_TOKENS.button.secondaryBg,
              border: `1px solid ${cssVar("btn-secondary-border")}`,
              color: DESIGN_TOKENS.button.secondaryText,
            }}
          >
            Secondary Button
          </button>
        </div>
      </section>

      {/* Cards */}
      <section className="space-y-3">
        <h3 className={token("text", "text-secondary")}>Cards</h3>
        <div
          className="p-4 rounded-lg transition-colors hover:border-[var(--card-border-hover)]"
          style={{
            backgroundColor: DESIGN_TOKENS.card.bg,
            border: `1px solid ${cssVar("card-border")}`,
          }}
        >
          <p style={{ color: DESIGN_TOKENS.text.primary }}>Card content</p>
          <p style={{ color: DESIGN_TOKENS.text.secondary }}>Secondary text</p>
        </div>
      </section>

      {/* Badges */}
      <section className="space-y-3">
        <h3 className={token("text", "text-secondary")}>Badges</h3>
        <div className="flex gap-2">
          <span
            className="px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: DESIGN_TOKENS.badge.bg,
              color: DESIGN_TOKENS.badge.text,
            }}
          >
            Standard
          </span>
          <span
            className="px-2 py-1 rounded text-xs"
            style={{
              backgroundColor: DESIGN_TOKENS.badge.accentBg,
              color: DESIGN_TOKENS.badge.accentText,
            }}
          >
            Accent
          </span>
        </div>
      </section>

      {/* Surfaces */}
      <section className="space-y-3">
        <h3 className={token("text", "text-secondary")}>Surface Layers</h3>
        <div
          className="p-4 rounded-lg"
          style={{ backgroundColor: DESIGN_TOKENS.surface.base }}
        >
          <div
            className="p-3 rounded-lg mb-2"
            style={{ backgroundColor: DESIGN_TOKENS.surface.raised }}
          >
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: DESIGN_TOKENS.surface.elevated }}
            >
              <p style={{ color: DESIGN_TOKENS.text.primary }}>
                Elevated surface
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Links */}
      <section className="space-y-3">
        <h3 className={token("text", "text-secondary")}>Links</h3>
        <a
          href="#"
          className="hover:underline transition-colors"
          style={{ color: DESIGN_TOKENS.text.link }}
        >
          Example Link
        </a>
      </section>
    </div>
  );
});

export type { };
