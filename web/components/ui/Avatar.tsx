import Image from "next/image";
import Link from "next/link";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: AvatarSize;
  username?: string; // If provided, wraps in a link
  fallbackName?: string; // Name to generate initials from
  className?: string;
  showBorder?: boolean;
  isFriend?: boolean; // Shows friend indicator ring
}

const sizeConfig: Record<AvatarSize, { px: number; text: string; ring: string }> = {
  xs: { px: 24, text: "text-[0.5rem]", ring: "ring-1" },
  sm: { px: 32, text: "text-xs", ring: "ring-2" },
  md: { px: 40, text: "text-sm", ring: "ring-2" },
  lg: { px: 48, text: "text-base", ring: "ring-2" },
  xl: { px: 64, text: "text-lg", ring: "ring-2" },
};

const sizeTailwind: Record<AvatarSize, string> = {
  xs: "w-6 h-6",
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function Avatar({
  src,
  alt,
  size = "md",
  username,
  fallbackName,
  className = "",
  showBorder = true,
  isFriend = false,
}: AvatarProps) {
  const config = sizeConfig[size];
  const sizeClass = sizeTailwind[size];
  const initials = fallbackName ? getInitials(fallbackName) : alt[0]?.toUpperCase() || "?";

  const borderClass = showBorder
    ? isFriend
      ? "border-2 border-[var(--neon-magenta)]"
      : "border-2 border-[var(--twilight)]"
    : "";

  const friendRing = isFriend ? `${config.ring} ring-[var(--neon-magenta)]/20` : "";

  const avatarContent = (
    <div
      className={`
        ${sizeClass}
        rounded-full
        overflow-hidden
        flex-shrink-0
        ${borderClass}
        ${friendRing}
        ${className}
      `}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={config.px}
          height={config.px}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[var(--neon-magenta)] to-[var(--neon-cyan)] flex items-center justify-center">
          <span className={`font-mono font-bold text-white ${config.text}`}>
            {initials}
          </span>
        </div>
      )}
    </div>
  );

  if (username) {
    return (
      <Link
        href={`/profile/${username}`}
        className="block hover:opacity-90 transition-opacity"
        title={alt}
      >
        {avatarContent}
      </Link>
    );
  }

  return avatarContent;
}

// Avatar stack for showing multiple avatars overlapping
interface AvatarStackProps {
  avatars: Array<{
    src?: string | null;
    alt: string;
    username?: string;
  }>;
  size?: AvatarSize;
  max?: number;
  showCount?: boolean;
}

export function AvatarStack({
  avatars,
  size = "xs",
  max = 3,
  showCount = true,
}: AvatarStackProps) {
  const displayed = avatars.slice(0, max);
  const remaining = avatars.length - max;
  const sizeClass = sizeTailwind[size];
  const config = sizeConfig[size];

  return (
    <div className="flex -space-x-2">
      {displayed.map((avatar, i) => (
        <Avatar
          key={i}
          src={avatar.src}
          alt={avatar.alt}
          size={size}
          username={avatar.username}
          showBorder
          className="hover:z-10 hover:scale-110 transition-transform"
        />
      ))}
      {showCount && remaining > 0 && (
        <div
          className={`
            ${sizeClass}
            rounded-full
            bg-[var(--twilight)]
            border-2 border-[var(--night)]
            flex items-center justify-center
          `}
        >
          <span className={`font-mono font-medium text-[var(--muted)] ${config.text}`}>
            +{remaining}
          </span>
        </div>
      )}
    </div>
  );
}
