"use client";

import {
  MapPin,
  Repeat,
  Buildings,
  StarFour,
  Compass,
  MusicNote,
  ArrowRight,
} from "@phosphor-icons/react";
import { resolveConnections } from "@/lib/detail/connections";
import type { SectionProps } from "@/lib/detail/types";
import SmartImage from "@/components/SmartImage";

export function ConnectionsSection({ data, portalSlug }: SectionProps) {
  const connections = resolveConnections(data, portalSlug);
  if (connections.length === 0) return null;

  return (
    <div className="flex flex-col gap-[10px] motion-stagger">
      {connections.map((row) => {
        const body = (
          <>
            {row.avatars ? (
              <div className="flex -space-x-1.5 flex-shrink-0">
                {row.avatars.slice(0, 3).map((url, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded-full border-2 border-[var(--void)]"
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
                  <ConnectionTypeIcon type={row.type} accent={row.accent} />
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div
                className="text-sm font-medium truncate"
                style={{ color: row.accent === "gold" ? "#FFD93D" : "var(--cream)" }}
              >
                {row.label}
              </div>
              <div className="text-xs text-[var(--muted)] truncate">{row.contextLine}</div>
            </div>
            {row.href && (
              <ArrowRight
                size={14}
                style={{
                  color:
                    row.accent === "coral"
                      ? "#FF6B7A66"
                      : row.accent === "gold"
                        ? "#FFD93D66"
                        : "var(--twilight)",
                  flexShrink: 0,
                }}
              />
            )}
          </>
        );

        const baseStyle =
          row.accent === "gold"
            ? { background: "#FFD93D0D", border: "1px solid #FFD93D33", borderRadius: "8px" }
            : row.accent === "coral"
              ? { background: "#FF6B7A0D", border: "1px solid #FF6B7A33", borderRadius: "8px" }
              : { background: "var(--night)", borderRadius: "8px" };

        if (row.href) {
          const hoverClass =
            row.accent === "gold"
              ? "hover:bg-[#FFD93D1A]"
              : row.accent === "coral"
                ? "hover:bg-[#FF6B7A1A]"
                : "hover:bg-[var(--twilight)]/50";
          return (
            <a
              key={row.id}
              href={row.href}
              className={`flex items-center gap-3 rounded-lg p-3 transition-colors duration-300 motion-hover-lift motion-press ${hoverClass}`}
              style={baseStyle}
            >
              {body}
            </a>
          );
        }

        return (
          <div
            key={row.id}
            className="flex items-center gap-3 rounded-lg p-3"
            style={baseStyle}
          >
            {body}
          </div>
        );
      })}
    </div>
  );
}

function ConnectionTypeIcon({ type, accent }: { type: string; accent?: "gold" | "coral" | null }) {
  const iconProps = { size: 18, color: accent === "gold" ? "#FFD93D" : "var(--soft)" };

  switch (type) {
    case "venue":
      return <MapPin {...iconProps} />;
    case "series":
      return <Repeat {...iconProps} />;
    case "org":
      return <Buildings {...iconProps} />;
    case "festival":
      return <StarFour {...iconProps} />;
    case "proximity":
      return <Compass {...iconProps} />;
    case "artist":
      return <MusicNote {...iconProps} />;
    default:
      return <MapPin {...iconProps} />;
  }
}
