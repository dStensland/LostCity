"use client";

import { ReactNode } from "react";

// Pre-built variant configurations
export type EmptyStateVariant = "no-events" | "no-results" | "no-saved" | "connect-friends" | "no-activity" | "no-friends" | "default";

type EmptyStateProps = {
  variant?: EmptyStateVariant;
  title?: string;
  message: string;
  icon?: ReactNode;
  suggestions?: string[];
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  atmospheric?: boolean;
};

// Get variant-specific accent color
function getVariantColor(variant: EmptyStateVariant): string {
  switch (variant) {
    case "no-events":
      return "var(--neon-amber)";
    case "no-results":
      return "var(--neon-cyan)";
    case "no-saved":
      return "var(--neon-magenta)";
    case "connect-friends":
      return "var(--neon-green)";
    case "no-activity":
      return "var(--coral)";
    case "no-friends":
      return "var(--lavender)";
    default:
      return "var(--neon-magenta)";
  }
}

export default function EmptyState({
  variant = "default",
  title,
  message,
  icon,
  suggestions,
  action,
  secondaryAction,
  className = "",
  atmospheric = true,
}: EmptyStateProps) {
  const accentColor = getVariantColor(variant);

  return (
    <div className={`py-12 text-center relative ${atmospheric ? "empty-state-atmospheric" : ""} ${className}`}>
      {/* Radial gradient background */}
      {atmospheric && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, color-mix(in srgb, ${accentColor} 8%, transparent) 0%, transparent 60%)`,
          }}
        />
      )}

      {/* Content with staggered animations */}
      <div className="relative z-10">
        {icon && (
          <div className={`mb-4 flex justify-center ${atmospheric ? "animate-stagger-1" : ""}`}>
            <div
              className={`relative flex items-center justify-center w-16 h-16 rounded-full ${atmospheric ? "empty-state-icon-glow" : ""}`}
              style={{
                background: `linear-gradient(135deg, var(--twilight), var(--dusk))`,
                "--glow-color": accentColor,
              } as React.CSSProperties}
            >
              <div className={`text-[var(--muted)] ${atmospheric ? "animate-empty-icon-pulse" : ""}`} style={{ color: accentColor }}>
                {icon}
              </div>
            </div>
          </div>
        )}
        {title && (
          <h3 className={`text-xl font-semibold text-[var(--cream)] mb-2 ${atmospheric ? "animate-stagger-2" : ""}`}>
            {title}
          </h3>
        )}
        <p className={`font-mono text-sm text-[var(--muted)] max-w-sm mx-auto ${atmospheric ? "animate-stagger-2" : ""}`}>
          {message}
        </p>

        {suggestions && suggestions.length > 0 && (
          <div className={`mt-4 text-left max-w-xs mx-auto ${atmospheric ? "animate-stagger-3" : ""}`}>
            <p className="font-mono text-[0.65rem] text-[var(--muted)] uppercase tracking-wider mb-2">Try:</p>
            <ul className="space-y-1">
              {suggestions.map((suggestion, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--soft)]">
                  <span className="text-[var(--muted)]">•</span>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(action || secondaryAction) && (
          <div className={`mt-6 flex items-center justify-center gap-3 ${atmospheric ? "animate-stagger-4" : ""}`}>
            {action && (
              <button
                onClick={action.onClick}
                className="px-4 py-2 rounded-lg font-mono text-sm font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: accentColor,
                  color: "var(--void)",
                  boxShadow: `0 0 20px color-mix(in srgb, ${accentColor} 40%, transparent)`,
                }}
              >
                {action.label}
              </button>
            )}
            {secondaryAction && (
              <button
                onClick={secondaryAction.onClick}
                className="px-4 py-2 rounded-lg border border-[var(--twilight)] text-[var(--soft)] font-mono text-sm hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors"
              >
                {secondaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Pre-defined icons for common empty states
export function NoResultsIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

export function NoEventsIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

export function NoNotificationsIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

export function NoUsersIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

export function NoSavedIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
  );
}
