"use client";

export default function AtlantaSkyline() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Animated texture background - shows through building cutouts */}
      <div className="absolute inset-0 animated-grain" />

      {/* Ambient glow from "inside" the city */}
      <div className="absolute inset-0 city-glow" />

      {/* Skyline mask - buildings are cutouts revealing the texture */}
      <div className="absolute inset-0">
        <svg
          className="absolute bottom-0 left-0 right-0 w-full h-[50%] md:h-[60%]"
          viewBox="0 0 1200 400"
          preserveAspectRatio="xMidYMax slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Mask where white = visible, black = hidden */}
            <mask id="skyline-mask">
              {/* Full white background */}
              <rect x="0" y="0" width="1200" height="400" fill="white" />

              {/* Buildings cut out in black */}
              {/* Background buildings */}
              <rect x="50" y="200" width="40" height="200" fill="black" />
              <rect x="100" y="180" width="50" height="220" fill="black" />
              <rect x="170" y="220" width="35" height="180" fill="black" />
              <rect x="980" y="190" width="45" height="210" fill="black" />
              <rect x="1040" y="210" width="55" height="190" fill="black" />
              <rect x="1110" y="230" width="40" height="170" fill="black" />

              {/* Mid buildings */}
              <rect x="220" y="150" width="60" height="250" fill="black" />
              <rect x="290" y="120" width="45" height="280" fill="black" />
              <rect x="850" y="140" width="55" height="260" fill="black" />
              <rect x="920" y="160" width="50" height="240" fill="black" />

              {/* Bank of America Plaza - tallest */}
              <path d="M500 50 L520 50 L520 80 L530 80 L530 400 L490 400 L490 80 L500 80 Z" fill="black" />
              <polygon points="510,50 500,20 520,20" fill="black" />

              {/* Westin Peachtree Plaza - cylindrical */}
              <rect x="555" y="90" width="90" height="310" rx="45" fill="black" />
              <ellipse cx="600" cy="90" rx="45" ry="15" fill="black" />

              {/* 191 Peachtree */}
              <rect x="680" y="100" width="70" height="300" fill="black" />
              <polygon points="680,100 715,60 750,100" fill="black" />

              {/* SunTrust Plaza */}
              <rect x="400" y="130" width="65" height="270" fill="black" />
              <rect x="410" y="115" width="45" height="15" fill="black" />

              {/* Georgia-Pacific Tower */}
              <rect x="760" y="150" width="55" height="250" fill="black" />

              {/* Promenade buildings */}
              <rect x="350" y="180" width="40" height="220" fill="black" />
              <rect x="830" y="170" width="45" height="230" fill="black" />

              {/* Foreground */}
              <rect x="0" y="320" width="1200" height="80" fill="black" />
              <rect x="150" y="280" width="80" height="120" fill="black" />
              <rect x="250" y="300" width="60" height="100" fill="black" />
              <rect x="900" y="290" width="70" height="110" fill="black" />
              <rect x="1000" y="310" width="90" height="90" fill="black" />
            </mask>

            {/* Animated gradient for the sky */}
            <linearGradient id="sky-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--void)" />
              <stop offset="60%" stopColor="#1a1520" />
              <stop offset="100%" stopColor="#2a1a1a" />
            </linearGradient>
          </defs>

          {/* Sky with gradient - masked by buildings */}
          <rect
            x="0" y="0"
            width="1200" height="400"
            fill="url(#sky-gradient)"
            mask="url(#skyline-mask)"
          />
        </svg>

        {/* Building silhouettes on top - solid dark */}
        <svg
          className="absolute bottom-0 left-0 right-0 w-full h-[50%] md:h-[60%]"
          viewBox="0 0 1200 400"
          preserveAspectRatio="xMidYMax slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* All buildings as solid silhouettes */}
          <g fill="var(--void)">
            {/* Background buildings */}
            <rect x="50" y="200" width="40" height="200" />
            <rect x="100" y="180" width="50" height="220" />
            <rect x="170" y="220" width="35" height="180" />
            <rect x="980" y="190" width="45" height="210" />
            <rect x="1040" y="210" width="55" height="190" />
            <rect x="1110" y="230" width="40" height="170" />

            {/* Mid buildings */}
            <rect x="220" y="150" width="60" height="250" />
            <rect x="290" y="120" width="45" height="280" />
            <rect x="850" y="140" width="55" height="260" />
            <rect x="920" y="160" width="50" height="240" />

            {/* Bank of America Plaza */}
            <path d="M500 50 L520 50 L520 80 L530 80 L530 400 L490 400 L490 80 L500 80 Z" />
            <polygon points="510,50 500,20 520,20" />

            {/* Westin Peachtree Plaza */}
            <rect x="555" y="90" width="90" height="310" rx="45" />
            <ellipse cx="600" cy="90" rx="45" ry="15" />

            {/* 191 Peachtree */}
            <rect x="680" y="100" width="70" height="300" />
            <polygon points="680,100 715,60 750,100" />

            {/* SunTrust Plaza */}
            <rect x="400" y="130" width="65" height="270" />
            <rect x="410" y="115" width="45" height="15" />

            {/* Georgia-Pacific Tower */}
            <rect x="760" y="150" width="55" height="250" />

            {/* Promenade buildings */}
            <rect x="350" y="180" width="40" height="220" />
            <rect x="830" y="170" width="45" height="230" />

            {/* Foreground */}
            <rect x="0" y="320" width="1200" height="80" />
            <rect x="150" y="280" width="80" height="120" />
            <rect x="250" y="300" width="60" height="100" />
            <rect x="900" y="290" width="70" height="110" />
            <rect x="1000" y="310" width="90" height="90" />
          </g>

          {/* Window lights - flickering amber glow */}
          <g className="window-lights">
            {/* Bank of America windows */}
            <rect x="502" y="100" width="3" height="280" fill="#E8912D" opacity="0.4" />
            <rect x="512" y="100" width="3" height="280" fill="#FFD93D" opacity="0.3" />

            {/* Westin windows */}
            <rect x="580" y="110" width="2" height="270" fill="#E8912D" opacity="0.35" />
            <rect x="595" y="110" width="2" height="270" fill="#FFD93D" opacity="0.25" />
            <rect x="610" y="110" width="2" height="270" fill="#E8912D" opacity="0.3" />

            {/* 191 Peachtree windows */}
            <rect x="695" y="120" width="3" height="260" fill="#FFD93D" opacity="0.35" />
            <rect x="720" y="120" width="3" height="260" fill="#E8912D" opacity="0.4" />

            {/* Other building lights */}
            <rect x="420" y="150" width="2" height="220" fill="#E8912D" opacity="0.3" />
            <rect x="440" y="150" width="2" height="220" fill="#FFD93D" opacity="0.25" />
            <rect x="775" y="170" width="2" height="210" fill="#E8912D" opacity="0.35" />
          </g>
        </svg>
      </div>

      {/* Gradient fade at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--void)] to-transparent" />

      <style jsx>{`
        .animated-grain {
          background:
            radial-gradient(ellipse at 30% 70%, rgba(232, 145, 45, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 60%, rgba(255, 217, 61, 0.05) 0%, transparent 40%),
            radial-gradient(ellipse at 50% 80%, rgba(232, 145, 45, 0.1) 0%, transparent 60%);
          animation: ambient-shift 8s ease-in-out infinite;
        }

        .city-glow {
          background: radial-gradient(
            ellipse 80% 50% at 50% 100%,
            rgba(232, 145, 45, 0.15) 0%,
            rgba(232, 145, 45, 0.05) 40%,
            transparent 70%
          );
          animation: glow-pulse 4s ease-in-out infinite;
        }

        @keyframes ambient-shift {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.02);
          }
        }

        @keyframes glow-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        .window-lights rect {
          animation: window-flicker 3s ease-in-out infinite;
        }

        .window-lights rect:nth-child(2n) {
          animation-delay: -1s;
        }

        .window-lights rect:nth-child(3n) {
          animation-delay: -2s;
          animation-duration: 4s;
        }

        @keyframes window-flicker {
          0%, 100% {
            opacity: 0.4;
          }
          25% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.5;
          }
          75% {
            opacity: 0.35;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .animated-grain,
          .city-glow,
          .window-lights rect {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
