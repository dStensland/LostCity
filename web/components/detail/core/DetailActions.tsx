"use client";

import SmartImage from "@/components/SmartImage";
import type { ActionConfig } from "@/lib/detail/types";

interface DetailActionsProps {
  config: ActionConfig;
  accentColor: string;
  variant?: "sidebar" | "rail";
}

export function DetailActions({
  config,
  accentColor: _accentColor,
  variant = "sidebar",
}: DetailActionsProps) {
  const { primaryCTA, secondaryActions, posterUrl, heroTier } = config;

  // ─── Rail variant ────────────────────────────────────────────────
  if (variant === "rail") {
    return (
      <div
        className="flex flex-col gap-3 motion-fade-in"
        style={{ animationDelay: "200ms" }}
      >
        {/* Poster thumbnail — only when heroTier is compact and posterUrl exists */}
        {heroTier === "compact" && posterUrl && (
          <div
            className="w-[120px] mx-auto rounded-xl overflow-hidden flex-shrink-0"
            style={{ aspectRatio: "3/4", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.6))" }}
          >
            <SmartImage
              src={posterUrl}
              alt=""
              fill
              className="object-cover"
            />
          </div>
        )}

        {/* Primary CTA — full width */}
        {primaryCTA && (
          <>
            {primaryCTA.href ? (
              <a
                href={primaryCTA.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full flex items-center justify-center gap-2 h-[48px] rounded-full text-sm font-semibold transition-colors duration-300 cta-pulse-glow motion-hover-glow motion-press ${
                  primaryCTA.variant === "filled"
                    ? "text-white"
                    : "border border-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/50"
                }`}
                style={
                  primaryCTA.variant === "filled"
                    ? {
                        backgroundColor: primaryCTA.color ?? "var(--coral)",
                        ["--cta-pulse-color" as string]: primaryCTA.color ?? "var(--coral)",
                      }
                    : { ["--cta-pulse-color" as string]: primaryCTA.color ?? "var(--coral)" }
                }
              >
                {primaryCTA.icon}
                {primaryCTA.label}
              </a>
            ) : (
              <button
                onClick={primaryCTA.onClick}
                className={`w-full flex items-center justify-center gap-2 h-[48px] rounded-full text-sm font-semibold transition-colors duration-300 cta-pulse-glow motion-hover-glow motion-press ${
                  primaryCTA.variant === "filled"
                    ? "text-white"
                    : "border border-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/50"
                }`}
                style={
                  primaryCTA.variant === "filled"
                    ? {
                        backgroundColor: primaryCTA.color ?? "var(--coral)",
                        ["--cta-pulse-color" as string]: primaryCTA.color ?? "var(--coral)",
                      }
                    : { ["--cta-pulse-color" as string]: primaryCTA.color ?? "var(--coral)" }
                }
              >
                {primaryCTA.icon}
                {primaryCTA.label}
              </button>
            )}
          </>
        )}

        {/* Secondary actions — icon row centered */}
        {secondaryActions.length > 0 && (
          <div className="flex gap-2 justify-center">
            {secondaryActions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className="w-10 h-10 rounded-xl border border-[var(--twilight)] flex items-center justify-center text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 hover:scale-110 transition-all duration-200 motion-press"
                title={action.label}
              >
                {action.icon}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Sidebar variant (default) — EXACT current behavior ────────
  // First secondary goes in CTA row as circle button, rest go in actions row
  const ctaRowSecondary = secondaryActions[0];
  const actionsRowButtons = secondaryActions.slice(1);

  return (
    <div className="space-y-0 motion-fade-up" style={{ animationDelay: "200ms" }}>
      {/* CTA Row */}
      {primaryCTA && (
        <div className="flex items-center gap-2.5 px-4 pb-3">
          {primaryCTA.href ? (
            <a
              href={primaryCTA.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 flex items-center justify-center gap-2 h-[44px] rounded-[22px] text-sm font-semibold transition-colors duration-300 motion-hover-glow motion-press ${
                primaryCTA.variant === "filled"
                  ? "bg-[var(--coral)] text-white"
                  : "border border-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/50"
              }`}
            >
              {primaryCTA.icon}
              {primaryCTA.label}
            </a>
          ) : (
            <button
              onClick={primaryCTA.onClick}
              className={`flex-1 flex items-center justify-center gap-2 h-[44px] rounded-[22px] text-sm font-semibold transition-colors duration-300 motion-hover-glow motion-press ${
                primaryCTA.variant === "filled"
                  ? "bg-[var(--coral)] text-white"
                  : "border border-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/50"
              }`}
            >
              {primaryCTA.icon}
              {primaryCTA.label}
            </button>
          )}

          {/* First secondary as circle button in CTA row */}
          {ctaRowSecondary && (
            <button
              onClick={ctaRowSecondary.onClick}
              className="w-[44px] h-[44px] rounded-[22px] border border-[var(--twilight)] flex items-center justify-center text-[var(--soft)] hover:bg-[var(--twilight)]/50 transition-colors duration-300 flex-shrink-0 motion-hover-lift motion-press"
              title={ctaRowSecondary.label}
            >
              {ctaRowSecondary.icon}
            </button>
          )}
        </div>
      )}

      {/* Actions Row - remaining secondary buttons */}
      {actionsRowButtons.length > 0 && (
        <div className="flex gap-2 justify-center px-4 pb-4">
          {actionsRowButtons.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className="w-10 h-10 rounded-xl border border-[var(--twilight)] flex items-center justify-center text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 hover:scale-110 transition-all duration-200 motion-press"
              title={action.label}
            >
              {action.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
