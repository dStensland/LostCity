"use client";

import Image from "next/image";
import { memo, useMemo } from "react";

// Neon color palette for avatar gradients
const NEON_GRADIENTS = [
  { from: "#00FFFF", to: "#0080FF" },   // Cyan to Blue
  { from: "#FF00FF", to: "#8000FF" },   // Magenta to Purple
  { from: "#FF6B6B", to: "#FF00FF" },   // Coral to Magenta
  { from: "#00FF88", to: "#00FFFF" },   // Green to Cyan
  { from: "#FFD700", to: "#FF6B6B" },   // Gold to Coral
  { from: "#8000FF", to: "#FF00FF" },   // Purple to Magenta
  { from: "#00FFFF", to: "#00FF88" },   // Cyan to Green
  { from: "#FF6B6B", to: "#FFD700" },   // Coral to Gold
];

// Generate consistent color based on string (username/id)
function getGradientForString(str: string): typeof NEON_GRADIENTS[0] {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return NEON_GRADIENTS[Math.abs(hash) % NEON_GRADIENTS.length];
}

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CONFIG: Record<AvatarSize, { size: number; text: string; ring: string; glow: string }> = {
  xs: { size: 20, text: "text-[0.5rem]", ring: "ring-1", glow: "0 0 8px" },
  sm: { size: 28, text: "text-[0.6rem]", ring: "ring-[1.5px]", glow: "0 0 10px" },
  md: { size: 36, text: "text-xs", ring: "ring-2", glow: "0 0 12px" },
  lg: { size: 48, text: "text-sm", ring: "ring-2", glow: "0 0 16px" },
  xl: { size: 64, text: "text-base", ring: "ring-[3px]", glow: "0 0 20px" },
};

interface UserAvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  /** Show neon glow effect */
  glow?: boolean;
  /** Show online indicator */
  online?: boolean;
  /** Additional CSS classes */
  className?: string;
}

function UserAvatar({
  src,
  name,
  size = "md",
  glow = false,
  online,
  className = "",
}: UserAvatarProps) {
  const config = SIZE_CONFIG[size];
  const gradient = useMemo(() => getGradientForString(name), [name]);
  const initial = name.charAt(0).toUpperCase();

  // Common styles for the avatar container
  const containerStyle = useMemo(() => ({
    width: config.size,
    height: config.size,
    "--avatar-glow-from": gradient.from,
    "--avatar-glow-to": gradient.to,
  } as React.CSSProperties), [config.size, gradient]);

  // Glow effect style
  const glowStyle = useMemo(() => {
    if (!glow) return {};
    return {
      boxShadow: `${config.glow} color-mix(in srgb, ${gradient.from} 40%, transparent)`,
    };
  }, [glow, config.glow, gradient.from]);

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: config.size, height: config.size }}
    >
      {/* Neon ring background */}
      <div
        className="absolute inset-0 rounded-full opacity-60 blur-[1px]"
        style={{
          background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
          transform: "scale(1.1)",
        }}
      />

      {/* Main avatar container */}
      <div
        className={`relative rounded-full overflow-hidden ${config.ring} ring-[var(--void)] transition-all duration-300`}
        style={{ ...containerStyle, ...glowStyle }}
      >
        {src ? (
          <Image
            src={src}
            alt={name}
            width={config.size}
            height={config.size}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Gradient fallback with initial */
          <div
            className={`w-full h-full flex items-center justify-center font-bold ${config.text}`}
            style={{
              background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
              color: "var(--void)",
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            }}
          >
            {initial}
          </div>
        )}
      </div>

      {/* Online indicator */}
      {online !== undefined && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[var(--void)] ${
            online ? "bg-[var(--neon-green)]" : "bg-[var(--muted)]"
          }`}
          style={{
            width: Math.max(8, config.size * 0.25),
            height: Math.max(8, config.size * 0.25),
            boxShadow: online ? `0 0 6px var(--neon-green)` : undefined,
          }}
        >
          {online && (
            <div className="absolute inset-0 rounded-full bg-[var(--neon-green)] animate-ping opacity-50" />
          )}
        </div>
      )}
    </div>
  );
}

export default memo(UserAvatar);

// Avatar stack for showing multiple users
interface AvatarStackProps {
  users: Array<{
    id: string;
    name: string;
    avatar_url?: string | null;
  }>;
  max?: number;
  size?: AvatarSize;
  showCount?: boolean;
}

export const AvatarStack = memo(function AvatarStack({
  users,
  max = 3,
  size = "sm",
  showCount = true,
}: AvatarStackProps) {
  const config = SIZE_CONFIG[size];
  const visibleUsers = users.slice(0, max);
  const remainingCount = users.length - max;
  const overlap = Math.round(config.size * 0.35);

  return (
    <div className="flex items-center">
      <div className="flex" style={{ marginRight: remainingCount > 0 ? 4 : 0 }}>
        {visibleUsers.map((user, idx) => (
          <div
            key={user.id}
            style={{
              marginLeft: idx > 0 ? -overlap : 0,
              zIndex: visibleUsers.length - idx,
            }}
          >
            <UserAvatar
              src={user.avatar_url}
              name={user.name}
              size={size}
            />
          </div>
        ))}
      </div>

      {showCount && remainingCount > 0 && (
        <div
          className={`flex items-center justify-center rounded-full bg-[var(--twilight)] border-2 border-[var(--void)] font-mono font-bold text-[var(--soft)] ${config.text}`}
          style={{
            width: config.size,
            height: config.size,
            marginLeft: -overlap,
            zIndex: 0,
          }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
});
