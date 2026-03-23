"use client";

import Image from "next/image";

interface AuthHeroPhotoProps {
  portalSlug?: string | null;
  portalAccentColor?: string;
  portalLabel?: string;
  className?: string;
}

type TimeSlot = "morning" | "midday" | "happy_hour" | "evening" | "late_night";

function getTimeSlot(hour: number): TimeSlot {
  if (hour < 11) return "morning";
  if (hour < 16) return "midday";
  if (hour < 18) return "happy_hour";
  if (hour < 22) return "evening";
  return "late_night";
}

// Portal-specific hero photos. If not present, falls back to Atlanta photo.
const PORTAL_PHOTOS: Record<string, string> = {
  helpatl: "/portals/helpatl/hero.jpg",
};

// Atlanta photos keyed by time slot — all confirmed to exist in public/portals/atlanta/
const ATLANTA_PHOTOS: Record<TimeSlot, string> = {
  morning: "/portals/atlanta/jackson-st-bridge.jpg",
  midday: "/portals/atlanta/skyline-candidate-1.jpg",
  happy_hour: "/portals/atlanta/skyline-candidate-1.jpg",
  evening: "/portals/atlanta/jackson-st-bridge.jpg",
  late_night: "/portals/atlanta/jackson-st-bridge.jpg",
};

export function AuthHeroPhoto({
  portalSlug,
  portalAccentColor,
  portalLabel,
  className,
}: AuthHeroPhotoProps) {
  const hour = new Date().getHours();
  const timeSlot = getTimeSlot(hour);

  // Resolve photo: portal-specific if it exists, else Atlanta by time slot
  const portalPhoto = portalSlug ? PORTAL_PHOTOS[portalSlug] : undefined;
  const photoSrc = portalPhoto ?? ATLANTA_PHOTOS[timeSlot];

  // Gradient: bottom-heavy, let the photo breathe
  const gradientStyle =
    "linear-gradient(to bottom, rgba(9,9,11,0.15) 0%, rgba(9,9,11,0.05) 30%, rgba(9,9,11,0.3) 70%, rgba(9,9,11,0.85) 100%)";

  // If no portal-specific photo but there is an accent color, tint the gradient
  const overlayStyle =
    !portalPhoto && portalAccentColor
      ? {
          background: `linear-gradient(to bottom, rgba(9,9,11,0.15) 0%, rgba(9,9,11,0.05) 30%, rgba(9,9,11,0.3) 70%, rgba(9,9,11,0.85) 100%)`,
        }
      : { background: gradientStyle };

  const displayLabel = portalLabel ?? "LOST CITY";
  const displayTagline = portalLabel ? null : "do your own thing";
  const labelColor = portalAccentColor ?? "var(--coral)";

  return (
    <div className={`relative w-full h-full overflow-hidden ${className ?? ""}`}>
      {/* Background photo — local asset, loads instantly */}
      <Image
        src={photoSrc}
        alt=""
        fill
        priority
        className="object-cover"
        sizes="50vw"
      />

      {/* Accent color tint layer (portal-branded, no portal photo) */}
      {!portalPhoto && portalAccentColor && (
        <div
          className="absolute inset-0"
          style={{
            background: `${portalAccentColor}1a`,
            mixBlendMode: "multiply",
          }}
          aria-hidden
        />
      )}

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={overlayStyle}
        aria-hidden
      />

      {/* Logo lockup — bottom-left */}
      <div className="absolute bottom-8 left-8">
        <div
          className="font-mono text-lg font-bold tracking-[0.16em] uppercase"
          style={{ color: labelColor }}
        >
          {displayLabel}
        </div>
        {displayTagline && (
          <div className="text-sm text-[var(--soft)] mt-0.5 font-mono">
            {displayTagline}
          </div>
        )}
      </div>
    </div>
  );
}

export type { AuthHeroPhotoProps };
