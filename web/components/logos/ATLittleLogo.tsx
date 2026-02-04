interface ATLittleLogoProps {
  className?: string;
  variant?: "full" | "compact" | "icon" | "header";
}

// Kawaii face SVG elements - extracted to avoid creating during render
function renderKawaiiFace(scale: number = 1) {
  return (
    <g transform={`scale(${scale})`}>
      {/* Left eye - bigger curved happy ^_^ */}
      <path
        d="M-7 0 Q-5 -3, -3 0"
        stroke="#5D4E4E"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Right eye - bigger curved happy ^_^ */}
      <path
        d="M3 0 Q5 -3, 7 0"
        stroke="#5D4E4E"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Gentle smile */}
      <path
        d="M-2.5 7 Q0 9, 2.5 7"
        stroke="#5D4E4E"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Prominent blush spots - bigger and more visible */}
      <ellipse cx="-9" cy="5" rx="4" ry="2.5" fill="#FFBCBC" opacity="0.75" />
      <ellipse cx="9" cy="5" rx="4" ry="2.5" fill="#FFBCBC" opacity="0.75" />
    </g>
  );
}

/**
 * ATLittle Logo
 *
 * A kawaii-style Atlanta family portal brand.
 * Features a cute peach with a happy face and warm colors.
 */
export default function ATLittleLogo({
  className = "",
  variant = "full"
}: ATLittleLogoProps) {
  // Warm peachy color palette - softer gradients
  const peachMain = "#FBAB7E";
  const peachLight = "#FFCFA7";
  const peachMid = "#FDB88E";
  const peachDark = "#E8956A";
  const leafGreen = "#7CB77C";
  const leafLight = "#9DD09D";
  const leafDark = "#5A9A5A";
  const textGreen = "#4A7C59";
  const taglineColor = "#C4956C";

  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 64 72"
        className={className}
        aria-label="ATLittle"
      >
        <defs>
          <linearGradient id="peach-grad-icon" x1="10%" y1="20%" x2="90%" y2="90%">
            <stop offset="0%" stopColor={peachLight} />
            <stop offset="35%" stopColor={peachMid} />
            <stop offset="75%" stopColor={peachMain} />
            <stop offset="100%" stopColor={peachDark} />
          </linearGradient>
          <radialGradient id="peach-shine-icon" cx="28%" cy="22%">
            <stop offset="0%" stopColor="white" stopOpacity="0.7" />
            <stop offset="60%" stopColor="white" stopOpacity="0.2" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="leaf-grad-icon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={leafLight} />
            <stop offset="100%" stopColor={leafGreen} />
          </linearGradient>
        </defs>

        {/* Stem - slightly curved */}
        <path
          d="M32 8 Q33 4, 34 0"
          stroke="#8B7355"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Left leaf - more organic shape */}
        <path
          d="M22 10 Q16 8, 12 10 Q14 14, 22 14 Q28 12, 28 10 Q26 8, 22 10 Z"
          fill="url(#leaf-grad-icon)"
          transform="rotate(-30 22 10)"
        />
        <path
          d="M15 10 Q22 11, 27 9"
          stroke={leafDark}
          strokeWidth="1"
          fill="none"
          opacity="0.4"
        />

        {/* Right leaf - more organic shape */}
        <path
          d="M42 10 Q36 8, 32 10 Q34 14, 42 14 Q48 12, 48 10 Q46 8, 42 10 Z"
          fill="url(#leaf-grad-icon)"
          transform="rotate(30 42 10)"
        />
        <path
          d="M37 9 Q42 11, 47 10"
          stroke={leafDark}
          strokeWidth="1"
          fill="none"
          opacity="0.4"
        />

        {/* Main peach body - rounder */}
        <ellipse cx="32" cy="42" rx="27" ry="29" fill="url(#peach-grad-icon)" />

        {/* Peach crease - softer */}
        <path
          d="M32 16 Q31 42, 32 68"
          stroke={peachDark}
          strokeWidth="2"
          fill="none"
          opacity="0.2"
        />

        {/* Highlight shine - bigger and softer */}
        <ellipse cx="24" cy="30" rx="13" ry="10" fill="url(#peach-shine-icon)" />

        {/* Kawaii face */}
        <g transform="translate(32, 44)">
          {renderKawaiiFace(1)}
        </g>
      </svg>
    );
  }

  if (variant === "compact") {
    return (
      <svg
        viewBox="0 0 200 48"
        className={className}
        aria-label="ATLittle"
      >
        <defs>
          <linearGradient id="peach-grad-compact" x1="10%" y1="20%" x2="90%" y2="90%">
            <stop offset="0%" stopColor={peachLight} />
            <stop offset="35%" stopColor={peachMid} />
            <stop offset="75%" stopColor={peachMain} />
            <stop offset="100%" stopColor={peachDark} />
          </linearGradient>
          <radialGradient id="peach-shine-compact" cx="28%" cy="22%">
            <stop offset="0%" stopColor="white" stopOpacity="0.7" />
            <stop offset="60%" stopColor="white" stopOpacity="0.2" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="leaf-grad-compact" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={leafLight} />
            <stop offset="100%" stopColor={leafGreen} />
          </linearGradient>
        </defs>

        {/* Small peach */}
        <g transform="translate(4, 4)">
          {/* Stem */}
          <path d="M20 4 Q20.5 2, 21 0" stroke="#8B7355" strokeWidth="2.5" strokeLinecap="round" fill="none" />

          {/* Left leaf - organic shape */}
          <path
            d="M14 6 Q10 5, 8 7 Q9 10, 14 10 Q18 8, 18 6 Q16 5, 14 6 Z"
            fill="url(#leaf-grad-compact)"
            transform="rotate(-30 14 6)"
          />

          {/* Right leaf - organic shape */}
          <path
            d="M26 6 Q22 5, 20 7 Q21 10, 26 10 Q30 8, 30 6 Q28 5, 26 6 Z"
            fill="url(#leaf-grad-compact)"
            transform="rotate(30 26 6)"
          />

          {/* Peach body - rounder */}
          <ellipse cx="20" cy="24" rx="16.5" ry="17.5" fill="url(#peach-grad-compact)" />
          <ellipse cx="15" cy="20" rx="7" ry="5.5" fill="url(#peach-shine-compact)" />

          {/* Tiny face */}
          <g transform="translate(20, 26) scale(0.6)">
            {renderKawaiiFace(1)}
          </g>
        </g>

        {/* Text */}
        <text
          x="52"
          y="32"
          fontFamily="var(--font-nunito), system-ui, sans-serif"
          fontSize="26"
          fontWeight="800"
          fill={textGreen}
          letterSpacing="-0.5"
        >
          ATLittle
        </text>
      </svg>
    );
  }

  // Header variant - optimized for header with peach beside text
  if (variant === "header") {
    return (
      <svg
        viewBox="0 0 220 70"
        className={className}
        aria-label="ATLittle"
      >
        <defs>
          <linearGradient id="peach-grad-header" x1="10%" y1="20%" x2="90%" y2="90%">
            <stop offset="0%" stopColor={peachLight} />
            <stop offset="35%" stopColor={peachMid} />
            <stop offset="75%" stopColor={peachMain} />
            <stop offset="100%" stopColor={peachDark} />
          </linearGradient>
          <radialGradient id="peach-shine-header" cx="30%" cy="25%">
            <stop offset="0%" stopColor="white" stopOpacity="0.75" />
            <stop offset="50%" stopColor="white" stopOpacity="0.25" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="leaf-grad-header" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={leafLight} />
            <stop offset="100%" stopColor={leafGreen} />
          </linearGradient>
        </defs>

        {/* Peach on left side */}
        <g transform="translate(35, 35)">
          {/* Stem */}
          <path d="M0 -24 Q0.5 -27, 1 -30" stroke="#8B7355" strokeWidth="3" strokeLinecap="round" fill="none" />

          {/* Left leaf */}
          <path
            d="M-8 -22 Q-13 -24, -16 -20 Q-14 -16, -8 -15 Q-3 -18, -3 -22 Q-6 -24, -8 -22 Z"
            fill="url(#leaf-grad-header)"
            transform="rotate(-30 -8 -22)"
          />

          {/* Right leaf */}
          <path
            d="M8 -22 Q3 -24, 0 -20 Q2 -16, 8 -15 Q13 -18, 13 -22 Q10 -24, 8 -22 Z"
            fill="url(#leaf-grad-header)"
            transform="rotate(30 8 -22)"
          />

          {/* Peach body */}
          <ellipse cx="0" cy="2" rx="24" ry="26" fill="url(#peach-grad-header)" />

          {/* Crease */}
          <path d="M0 -20 Q-1 2, 0 26" stroke={peachDark} strokeWidth="1.5" fill="none" opacity="0.2" />

          {/* Shine */}
          <ellipse cx="-6" cy="-6" rx="12" ry="10" fill="url(#peach-shine-header)" />

          {/* Kawaii face */}
          <g transform="translate(0, 5)">
            {renderKawaiiFace(0.9)}
          </g>
        </g>

        {/* Text on right side */}
        <g>
          {/* ATLittle text */}
          <text
            x="130"
            y="38"
            fontFamily="var(--font-nunito), system-ui, sans-serif"
            fontSize="32"
            fontWeight="800"
            fill={textGreen}
            textAnchor="middle"
            letterSpacing="-0.5"
          >
            ATLittle
          </text>

          {/* Tagline */}
          <text
            x="130"
            y="56"
            fontFamily="var(--font-nunito), system-ui, sans-serif"
            fontSize="11"
            fontWeight="600"
            fill={taglineColor}
            textAnchor="middle"
            letterSpacing="0.3"
          >
            Atlanta Family Adventures
          </text>
        </g>
      </svg>
    );
  }

  // Full variant - centered layout like the reference
  return (
    <svg
      viewBox="0 0 280 140"
      className={className}
      aria-label="ATLittle - Atlanta Family Adventures"
    >
      <defs>
        <linearGradient id="peach-grad-full" x1="10%" y1="20%" x2="90%" y2="90%">
          <stop offset="0%" stopColor={peachLight} />
          <stop offset="30%" stopColor={peachMid} />
          <stop offset="70%" stopColor={peachMain} />
          <stop offset="100%" stopColor={peachDark} />
        </linearGradient>
        <radialGradient id="peach-shine-full" cx="25%" cy="20%">
          <stop offset="0%" stopColor="white" stopOpacity="0.8" />
          <stop offset="50%" stopColor="white" stopOpacity="0.3" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="leaf-grad-full" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={leafLight} />
          <stop offset="60%" stopColor={leafGreen} />
          <stop offset="100%" stopColor={leafDark} />
        </linearGradient>
        <linearGradient id="swoosh-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={taglineColor} stopOpacity="0" />
          <stop offset="20%" stopColor={taglineColor} stopOpacity="1" />
          <stop offset="80%" stopColor={taglineColor} stopOpacity="1" />
          <stop offset="100%" stopColor={taglineColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Centered Peach - top */}
      <g transform="translate(140, 36)">
        {/* Stem - slightly curved */}
        <path
          d="M0 -28 Q1 -32, 2 -36"
          stroke="#8B7355"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Left leaf - organic shape with gradient */}
        <path
          d="M-10 -26 Q-16 -28, -20 -24 Q-18 -19, -10 -18 Q-4 -22, -4 -26 Q-7 -28, -10 -26 Z"
          fill="url(#leaf-grad-full)"
          transform="rotate(-35 -10 -26)"
        />
        <path
          d="M-18 -25 Q-10 -22, -6 -24"
          stroke={leafDark}
          strokeWidth="1"
          fill="none"
          opacity="0.4"
          transform="rotate(-35 -10 -26)"
        />

        {/* Right leaf - organic shape with gradient */}
        <path
          d="M10 -26 Q4 -28, 0 -24 Q2 -19, 10 -18 Q16 -22, 16 -26 Q13 -28, 10 -26 Z"
          fill="url(#leaf-grad-full)"
          transform="rotate(35 10 -26)"
        />
        <path
          d="M2 -24 Q10 -22, 14 -25"
          stroke={leafDark}
          strokeWidth="1"
          fill="none"
          opacity="0.4"
          transform="rotate(35 10 -26)"
        />

        {/* Peach body - rounder and softer */}
        <ellipse cx="0" cy="4" rx="29" ry="31" fill="url(#peach-grad-full)" />

        {/* Crease line - very subtle */}
        <path
          d="M0 -24 Q-1.5 4, 0 32"
          stroke={peachDark}
          strokeWidth="2"
          fill="none"
          opacity="0.18"
        />

        {/* Shine highlight - bigger and softer */}
        <ellipse cx="-8" cy="-8" rx="15" ry="12" fill="url(#peach-shine-full)" />

        {/* Kawaii face */}
        <g transform="translate(0, 8)">
          {renderKawaiiFace(1.15)}
        </g>
      </g>

      {/* ATLittle text */}
      <text
        x="140"
        y="95"
        fontFamily="var(--font-nunito), system-ui, sans-serif"
        fontSize="36"
        fontWeight="800"
        fill={textGreen}
        textAnchor="middle"
        letterSpacing="-1"
      >
        ATLittle
      </text>

      {/* Tagline with swoosh */}
      <g>
        {/* Swoosh underline */}
        <path
          d="M60 118 Q140 124, 220 118"
          stroke="url(#swoosh-grad)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />

        {/* Tagline text */}
        <text
          x="140"
          y="115"
          fontFamily="var(--font-nunito), system-ui, sans-serif"
          fontSize="14"
          fontWeight="600"
          fontStyle="italic"
          fill={taglineColor}
          textAnchor="middle"
          letterSpacing="0.5"
        >
          Atlanta Family Adventures
        </text>
      </g>

      {/* LostCity attribution */}
      <text
        x="140"
        y="134"
        fontFamily="'Inter', sans-serif"
        fontSize="10"
        fontWeight="500"
        fill="#9CA3AF"
        textAnchor="middle"
      >
        A LostCity.ai Subportal
      </text>
    </svg>
  );
}
