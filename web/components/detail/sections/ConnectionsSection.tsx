"use client";

import { resolveConnections } from "@/lib/detail/connections";
import type { SectionProps } from "@/lib/detail/types";
import SmartImage from "@/components/SmartImage";

export function ConnectionsSection({ data, portalSlug }: SectionProps) {
  const connections = resolveConnections(data, portalSlug);
  if (connections.length === 0) return null;

  return (
    <div className="space-y-2">
      {connections.map((row) => (
        <a
          key={row.id}
          href={row.href}
          className={`flex items-center gap-3 rounded-lg p-3 transition-colors duration-300 hover:bg-[var(--twilight)]/50 ${
            row.accent === "gold"
              ? "bg-[var(--gold)]/5 border border-[var(--gold)]/20"
              : row.accent === "coral"
                ? "bg-[var(--coral)]/5 border border-[var(--coral)]/20"
                : "bg-[var(--night)] border border-[var(--twilight)]/40"
          }`}
        >
          {row.avatars ? (
            <div className="flex -space-x-1.5">
              {row.avatars.slice(0, 3).map((url, i) => (
                <div
                  key={i}
                  className="w-[18px] h-[18px] rounded-full border-2 border-[var(--night)]"
                  style={{ backgroundImage: `url(${url})`, backgroundSize: "cover" }}
                />
              ))}
            </div>
          ) : (
            <div className="w-9 h-9 bg-[var(--twilight)] rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
              {row.imageUrl ? (
                <SmartImage
                  src={row.imageUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ConnectionTypeIcon type={row.type} />
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div
              className={`text-sm font-medium truncate ${
                row.accent === "gold"
                  ? "text-[var(--gold)]"
                  : "text-[var(--cream)]"
              }`}
            >
              {row.label}
            </div>
            <div className="text-xs text-[var(--muted)] truncate">{row.contextLine}</div>
          </div>
          <span className="text-[var(--muted)] text-sm flex-shrink-0">→</span>
        </a>
      ))}
    </div>
  );
}

function ConnectionTypeIcon({ type }: { type: string }) {
  const glyphs: Record<string, string> = {
    venue: "📍",
    festival: "🎪",
    org: "🏢",
    series: "🔄",
    social: "👥",
    proximity: "📍",
    artist: "🎵",
  };
  return (
    <span className="text-sm" role="img" aria-hidden="true">
      {glyphs[type] ?? "⬡"}
    </span>
  );
}
