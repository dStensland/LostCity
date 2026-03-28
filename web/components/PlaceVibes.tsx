/**
 * PlaceVibes - Display place vibe/atmosphere tags
 * Uses the neon atmospheric design system
 */

interface PlaceVibesProps {
  vibes: string[] | null | undefined;
  className?: string;
  limit?: number;
}

// Vibe icons - maps vibe strings to emoji/icons
const VIBE_ICONS: Record<string, string> = {
  // Atmosphere
  "dive bar": "\u{1F319}", // 🌙
  "underground": "\u{1F30C}", // 🌌
  "intimate": "\u{1F56F}", // 🕯
  "rooftop": "\u{1F307}", // 🌇
  "outdoor": "\u{1F333}", // 🌳
  "historic": "\u{1F3DB}", // 🏛
  "quirky": "\u{2728}", // ✨
  "upscale": "\u{1F378}", // 🍸
  "casual": "\u{1F37B}", // 🍻
  "cozy": "\u{1F525}", // 🔥
  "trendy": "\u{1F4AB}", // 💫
  "hidden gem": "\u{1F48E}", // 💎

  // Music/Sound
  "live music": "\u{1F3B8}", // 🎸
  "dj": "\u{1F3A7}", // 🎧
  "jazz": "\u{1F3B7}", // 🎷
  "quiet": "\u{1F910}", // 🤐
  "loud": "\u{1F50A}", // 🔊

  // Drinks
  "cheap drinks": "\u{1F37A}", // 🍺
  "craft cocktails": "\u{1F379}", // 🍹
  "wine bar": "\u{1F377}", // 🍷
  "beer garden": "\u{1F3DE}", // 🏞

  // Crowd
  "lgbtq friendly": "\u{1F3F3}\uFE0F\u200D\u{1F308}", // 🏳️‍🌈
  "date night": "\u{1F495}", // 💕
  "late night": "\u{1F303}", // 🌃
  "day drinking": "\u{2600}\uFE0F", // ☀️

  // Default
  "default": "\u{2726}", // ✦
};

function getVibeIcon(vibe: string): string {
  const normalizedVibe = vibe.toLowerCase().trim();
  return VIBE_ICONS[normalizedVibe] || VIBE_ICONS["default"];
}

export default function PlaceVibes({ vibes, className = "", limit = 5 }: PlaceVibesProps) {
  if (!vibes || vibes.length === 0) return null;

  const displayVibes = limit ? vibes.slice(0, limit) : vibes;
  const remainingCount = vibes.length - displayVibes.length;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {displayVibes.map((vibe) => (
        <span
          key={vibe}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase tracking-wide text-[var(--soft)] rounded-full border border-[var(--twilight)] bg-[var(--void)] transition-colors hover:border-[var(--muted)] hover:text-[var(--cream)]"
        >
          <span className="text-sm" aria-hidden="true">
            {getVibeIcon(vibe)}
          </span>
          <span>{vibe}</span>
        </span>
      ))}
      {remainingCount > 0 && (
        <span
          className="inline-flex items-center px-2.5 py-1 text-xs font-mono text-[var(--muted)] rounded-full border border-[var(--twilight)] bg-[var(--void)]"
        >
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}
