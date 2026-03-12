"use client";

import Image from "@/components/SmartImage";
import { memo, useMemo, useState, useRef, useEffect, useCallback } from "react";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass, createCssVarClassForLength, createCssVarClassForNumber } from "@/lib/css-utils";
import { ENABLE_CITY_MOMENTS } from "@/lib/launch-flags";

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
export function getGradientForString(str: string): typeof NEON_GRADIENTS[0] {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return NEON_GRADIENTS[Math.abs(hash) % NEON_GRADIENTS.length];
}

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CONFIG: Record<AvatarSize, { size: number; text: string; ring: string; glow: string }> = {
  xs: { size: 20, text: "text-2xs", ring: "ring-1", glow: "8px" },
  sm: { size: 28, text: "text-xs", ring: "ring-[1.5px]", glow: "10px" },
  md: { size: 36, text: "text-xs", ring: "ring-2", glow: "12px" },
  lg: { size: 48, text: "text-sm", ring: "ring-2", glow: "16px" },
  xl: { size: 64, text: "text-base", ring: "ring-[3px]", glow: "20px" },
};

// Only one video plays at a time globally
let activeVideo: HTMLVideoElement | null = null;

type MomentPlayMode = "hover" | "auto" | "none";

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
  /** City moment video URL */
  momentUrl?: string | null;
  /** City moment thumbnail URL */
  momentThumbnailUrl?: string | null;
  /** How to play the city moment video */
  momentPlayMode?: MomentPlayMode;
}

function UserAvatar({
  src,
  name,
  size = "md",
  glow = false,
  online,
  className = "",
  momentUrl,
  momentThumbnailUrl,
  momentPlayMode = "none",
}: UserAvatarProps) {
  const config = SIZE_CONFIG[size];
  const gradient = useMemo(() => getGradientForString(name), [name]);
  const initial = name.charAt(0).toUpperCase();
  const [imgError, setImgError] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onlineSize = Math.max(8, Math.round(config.size * 0.25));

  // Gate: city moments must be enabled, and video is only playable at md+ sizes
  const hasMoment = ENABLE_CITY_MOMENTS && !!momentUrl;
  const canPlayVideo = hasMoment && (size === "md" || size === "lg" || size === "xl");
  const effectivePlayMode = canPlayVideo ? momentPlayMode : "none";

  const playVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video || videoPlaying) return;

    // Check reduced motion preference
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Pause any other playing video
    if (activeVideo && activeVideo !== video) {
      activeVideo.pause();
    }

    video.preload = "auto";
    const playPromise = video.play();
    if (playPromise) {
      playPromise
        .then(() => {
          activeVideo = video;
          setVideoPlaying(true);
        })
        .catch(() => {
          // Autoplay blocked or video error — stay on avatar
        });
    }
  }, [videoPlaying]);

  const pauseVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    if (activeVideo === video) {
      activeVideo = null;
    }
    setVideoPlaying(false);
  }, []);

  // Hover mode handlers
  const handleMouseEnter = useCallback(() => {
    if (effectivePlayMode === "hover") playVideo();
  }, [effectivePlayMode, playVideo]);

  const handleMouseLeave = useCallback(() => {
    if (effectivePlayMode === "hover") pauseVideo();
  }, [effectivePlayMode, pauseVideo]);

  // Auto mode via IntersectionObserver
  useEffect(() => {
    if (effectivePlayMode !== "auto") return;
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          playVideo();
        } else {
          pauseVideo();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [effectivePlayMode, playVideo, pauseVideo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video && activeVideo === video) {
        activeVideo = null;
      }
    };
  }, []);

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
      ref={containerRef}
      className={`relative flex-shrink-0 avatar-root ${className} ${varClasses}`}
      style={{ width: config.size, height: config.size }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <ScopedStyles css={css} />

      {/* Moment indicator ring — animated gradient ring when user has a city moment */}
      {hasMoment ? (
        <div
          className="absolute -inset-[3px] rounded-full opacity-80"
          style={{
            background: `conic-gradient(from 0deg, ${gradient.from}, ${gradient.to}, ${gradient.from})`,
            animation: "spin 3s linear infinite",
          }}
        />
      ) : (
        /* Standard neon ring background */
        <div className="absolute inset-0 rounded-full opacity-60 blur-[1px] avatar-gradient avatar-ring-scale" />
      )}

      {/* Main avatar container */}
      <div
        className={`relative rounded-full overflow-hidden ${config.ring} ring-[var(--void)] transition-all duration-300 avatar-ring ${glow ? "avatar-glow" : ""}`}
        style={{ width: config.size, height: config.size }}
      >
        {/* Static avatar layer */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${videoPlaying ? "opacity-0" : "opacity-100"}`}
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
            <div
              className={`w-full h-full flex items-center justify-center font-bold ${config.text} avatar-gradient avatar-initial`}
            >
              {initial}
            </div>
          )}
        </div>

        {/* Video layer — only rendered when moment exists and can play */}
        {canPlayVideo && effectivePlayMode !== "none" && (
          <video
            ref={videoRef}
            src={momentUrl!}
            poster={momentThumbnailUrl || undefined}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${videoPlaying ? "opacity-100" : "opacity-0"}`}
            loop
            muted
            playsInline
            preload="none"
          />
        )}
      </div>

      {/* Online indicator */}
      {online !== undefined && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[var(--void)] ${
            online ? "bg-[var(--neon-green)]" : "bg-[var(--muted)]"
          } avatar-online ${online ? "avatar-online-glow" : ""}`}
          style={{ width: onlineSize, height: onlineSize }}
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
          style={{ width: config.size, height: config.size }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
});
