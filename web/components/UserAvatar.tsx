"use client";

import Image from "@/components/SmartImage";
import { memo, useMemo, useState } from "react";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass, createCssVarClassForLength, createCssVarClassForNumber } from "@/lib/css-utils";

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
  xs: { size: 20, text: "text-[0.5rem]", ring: "ring-1", glow: "8px" },
  sm: { size: 28, text: "text-[0.6rem]", ring: "ring-[1.5px]", glow: "10px" },
  md: { size: 36, text: "text-xs", ring: "ring-2", glow: "12px" },
  lg: { size: 48, text: "text-sm", ring: "ring-2", glow: "16px" },
  xl: { size: 64, text: "text-base", ring: "ring-[3px]", glow: "20px" },
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
  const [imgError, setImgError] = useState(false);
  const onlineSize = Math.max(8, Math.round(config.size * 0.25));

  const sizeClass = createCssVarClassForLength("--avatar-size", `${config.size}px`, "avatar-size");
  const glowSizeClass = createCssVarClassForLength("--avatar-glow-size", config.glow, "avatar-glow");
  const fromClass = createCssVarClass("--avatar-from", gradient.from, "avatar-from");
  const toClass = createCssVarClass("--avatar-to", gradient.to, "avatar-to");
  const onlineSizeClass = createCssVarClassForLength("--avatar-online-size", `${onlineSize}px`, "avatar-online");

  const css = [
    sizeClass?.css,
    glowSizeClass?.css,
    fromClass?.css,
    toClass?.css,
    onlineSizeClass?.css,
  ].filter(Boolean).join("\n");

  const varClasses = [
    sizeClass?.className,
    glowSizeClass?.className,
    fromClass?.className,
    toClass?.className,
    onlineSizeClass?.className,
  ].filter(Boolean).join(" ");

  return (
    <div
      className={`relative flex-shrink-0 avatar-root ${className} ${varClasses}`}
    >
      <ScopedStyles css={css} />
      {/* Neon ring background */}
      <div className="absolute inset-0 rounded-full opacity-60 blur-[1px] avatar-gradient avatar-ring-scale" />

      {/* Main avatar container */}
      <div
        className={`relative rounded-full overflow-hidden ${config.ring} ring-[var(--void)] transition-all duration-300 avatar-ring ${glow ? "avatar-glow" : ""}`}
      >
        {src && !imgError ? (
          <Image
            src={src}
            alt={name}
            width={config.size}
            height={config.size}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          /* Gradient fallback with initial */
          <div
            className={`w-full h-full flex items-center justify-center font-bold ${config.text} avatar-gradient avatar-initial`}
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
          } avatar-online ${online ? "avatar-online-glow" : ""}`}
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
  const overlapClass = createCssVarClassForLength("--avatar-overlap", `${-overlap}px`, "avatar-overlap");
  const sizeClass = createCssVarClassForLength("--avatar-size", `${config.size}px`, "avatar-size");
  const zClasses = visibleUsers.map((_, idx) =>
    createCssVarClassForNumber("--avatar-stack-z", String(visibleUsers.length - idx), "avatar-z")
  );
  const countZClass = createCssVarClassForNumber("--avatar-stack-z", "0", "avatar-z");
  const baseCss = [
    overlapClass?.css,
    sizeClass?.css,
    ...zClasses.map((entry) => entry?.css),
    countZClass?.css,
  ].filter(Boolean).join("\n");
  const baseVarClasses = [overlapClass?.className, sizeClass?.className].filter(Boolean).join(" ");

  return (
    <div className={`flex items-center ${baseVarClasses}`}>
      <ScopedStyles css={baseCss} />
      <div className={`flex ${remainingCount > 0 ? "mr-1" : ""}`}>
        {visibleUsers.map((user, idx) => (
          <div
            key={user.id}
            className={`avatar-stack-item ${idx === 0 ? "avatar-stack-first" : ""} ${zClasses[idx]?.className ?? ""}`}
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
          className={`flex items-center justify-center rounded-full bg-[var(--twilight)] border-2 border-[var(--void)] font-mono font-bold text-[var(--soft)] ${config.text} avatar-root avatar-stack-item ${countZClass?.className ?? ""}`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
});
