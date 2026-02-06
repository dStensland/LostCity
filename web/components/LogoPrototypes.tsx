"use client";

import React, { useEffect, useState } from "react";
import ScopedStyles from "@/components/ScopedStyles";

// Shared styles injected once
const sharedStyles = `
  @keyframes neon-flicker {
    0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
      opacity: 1;
    }
    20%, 24%, 55% {
      opacity: 0.85;
    }
  }

  @keyframes portal-pulse {
    0%, 100% {
      opacity: 0.3;
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      opacity: 0.6;
      transform: translate(-50%, -50%) scale(1.2);
    }
  }

  @keyframes compass-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes cursor-blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  @keyframes typing {
    from { width: 0; }
    to { width: 100%; }
  }

  @keyframes glitch-shift {
    0% { transform: translate(0); }
    33% { transform: translate(-3px, 2px); }
    66% { transform: translate(3px, -2px); }
    100% { transform: translate(0); }
  }

  @keyframes star-twinkle {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  @keyframes window-flicker {
    0%, 90%, 100% { opacity: 0.8; }
    95% { opacity: 0.4; }
  }

  .logo1-glow {
    background: radial-gradient(ellipse at center, rgba(255, 107, 122, 0.15) 0%, transparent 70%);
  }
  .logo1-word {
    font-family: var(--font-outfit), sans-serif;
    font-weight: 800;
    font-size: 3rem;
    letter-spacing: 0.1em;
    line-height: 1;
    animation: neon-flicker 8s infinite;
  }
  .logo1-word-primary {
    color: #ff6b7a;
    filter: drop-shadow(0 0 8px #ff6b7a) drop-shadow(0 0 16px #ff6b7a);
  }
  .logo1-word-secondary {
    color: #00d4e8;
    animation-delay: 0.3s;
    filter: drop-shadow(0 0 8px #00d4e8) drop-shadow(0 0 16px #00d4e8);
  }
  .logo1-portal {
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60%;
    height: 60%;
    background: radial-gradient(circle, #ff6b7a 0%, transparent 70%);
    animation: portal-pulse 2s ease-in-out infinite;
    border-radius: 50%;
  }

  .logo2-icon {
    width: 80px;
    height: 80px;
  }
  .logo2-compass {
    transform-origin: 40px 40px;
    animation: compass-spin 20s linear infinite;
  }
  .logo2-wordmark {
    font-family: var(--font-jetbrains-mono), monospace;
    font-weight: 700;
    font-size: 1.5rem;
    letter-spacing: 0.15em;
    background: linear-gradient(90deg, #ff6b7a, #e855a0, #00d4e8);
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    -webkit-text-fill-color: transparent;
  }
  .logo2-coords {
    font-family: var(--font-jetbrains-mono), monospace;
    font-size: 0.6rem;
    color: #666;
    letter-spacing: 0.2em;
    margin-top: 4px;
  }

  .logo3-terminal {
    position: relative;
    background: rgba(9, 9, 11, 0.95);
    border: 1px solid rgba(255, 107, 122, 0.3);
    border-radius: 8px;
    padding: 16px 24px;
    box-shadow: inset 0 0 30px rgba(255, 107, 122, 0.05), 0 0 20px rgba(255, 107, 122, 0.1);
  }
  .logo3-scanlines {
    background-image: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(255, 255, 255, 0.03) 2px,
      rgba(255, 255, 255, 0.03) 4px
    );
    border-radius: 8px;
  }
  .logo3-prompt {
    font-family: var(--font-jetbrains-mono), monospace;
    font-size: 1.5rem;
    color: #ff6b7a;
    text-shadow: 0 0 10px rgba(255, 107, 122, 0.5);
  }
  .logo3-text {
    font-family: var(--font-jetbrains-mono), monospace;
    font-size: 1.5rem;
    font-weight: 600;
    color: #f5f0e8;
    letter-spacing: 0.05em;
  }
  .logo3-cursor {
    font-family: var(--font-jetbrains-mono), monospace;
    font-size: 1.5rem;
    color: #ff6b7a;
    animation: cursor-blink 1s step-end infinite;
  }

  .logo4-skyline {
    width: 240px;
    height: 100px;
  }
  .logo4-glitch-layer {
    mix-blend-mode: screen;
    opacity: 0.8;
    animation: glitch-shift 0.3s infinite;
  }
  .logo4-glitch-reverse {
    animation-direction: reverse;
  }
  .logo4-glitch-red {
    fill: #ff0000;
  }
  .logo4-glitch-green {
    fill: #00ff00;
  }
  .logo4-wordmark {
    font-family: var(--font-outfit), sans-serif;
    font-weight: 800;
    font-size: 2rem;
    letter-spacing: 0.1em;
    color: #f5f0e8;
    text-shadow: 0 0 12px rgba(255, 107, 122, 0.4);
    transition: text-shadow 0.1s;
  }
  .logo4-wordmark-glitch {
    text-shadow: -2px 0 #ff6b7a, 2px 0 #00d4e8, 0 0 12px rgba(255, 107, 122, 0.6);
  }

  .logo5-scene {
    width: 320px;
    height: 180px;
  }
  .logo5-night {
    background: linear-gradient(to bottom, #0a0a1a 0%, #1a1a2e 50%, #16213e 100%);
    border-radius: 12px;
  }
  .logo5-subtitle {
    font-family: var(--font-jetbrains-mono), monospace;
    font-size: 0.6rem;
    color: rgba(255, 107, 122, 0.6);
    letter-spacing: 0.3em;
    text-transform: uppercase;
  }
  .logo5-window-flicker {
    animation: window-flicker 3s infinite;
  }
  .logo5-window-flicker-slow {
    animation-duration: 4s;
  }
  .logo5-window-flicker-mid {
    animation-duration: 3.5s;
  }
  .logo5-window-delay-1 { animation-delay: 0.2s; }
  .logo5-window-delay-2 { animation-delay: 0.4s; }
  .logo5-window-delay-3 { animation-delay: 0.6s; }
  .logo5-window-delay-4 { animation-delay: 0.8s; }
  .logo5-window-delay-5 { animation-delay: 0.3s; }
`;

// ============================================================================
// CONCEPT 1: NEON PORTAL WORDMARK
// ============================================================================

export function Logo1({ className = "" }: { className?: string }) {
  return (
    <div className={`relative inline-block ${className}`}>
      <ScopedStyles css={sharedStyles} />

      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none logo1-glow" />

      <div className="relative flex items-center gap-3">
        <span className="logo1-word logo1-word-primary">
          L
          <span className="relative inline-block">
            O
            <span className="absolute logo1-portal" />
          </span>
          ST
        </span>
        <span className="logo1-word logo1-word-secondary">
          CITY
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// CONCEPT 2: DIGITAL CARTOGRAPHY MARK
// ============================================================================

export function Logo2({ className = "" }: { className?: string }) {
  return (
    <div className={`relative inline-flex flex-col items-center gap-4 ${className}`}>
      <ScopedStyles css={sharedStyles} />

      {/* City Icon with Compass */}
      <div className="relative logo2-icon">
        {/* Isometric buildings */}
        <svg viewBox="0 0 80 80" className="w-full h-full">
          {/* Building 1 */}
          <path d="M20,60 L20,35 L35,35 L35,60 Z" fill="none" stroke="#ff6b7a" strokeWidth="1.5" />
          <path d="M23,40 L23,45 M27,40 L27,50 M31,35 L31,55" stroke="#00d4e8" strokeWidth="0.5" opacity="0.6" />

          {/* Building 2 - tallest */}
          <path d="M35,60 L35,20 L50,20 L50,60 Z" fill="none" stroke="#ff6b7a" strokeWidth="1.5" />
          <path d="M38,25 L38,55 M42,22 L42,58 M46,25 L46,55" stroke="#00d4e8" strokeWidth="0.5" opacity="0.6" />

          {/* Building 3 */}
          <path d="M50,60 L50,40 L60,40 L60,60 Z" fill="none" stroke="#ff6b7a" strokeWidth="1.5" />
          <path d="M53,45 L53,55 M57,42 L57,58" stroke="#00d4e8" strokeWidth="0.5" opacity="0.6" />

          {/* Compass rose overlay */}
          <g className="logo2-compass">
            <path d="M40,15 L42,40 L40,42 L38,40 Z" fill="#f5a623" opacity="0.8" />
            <path d="M40,65 L38,40 L40,38 L42,40 Z" fill="#f5a623" opacity="0.4" />
            <path d="M15,40 L40,38 L42,40 L40,42 Z" fill="#f5a623" opacity="0.4" />
            <path d="M65,40 L40,42 L38,40 L40,38 Z" fill="#f5a623" opacity="0.4" />
          </g>
        </svg>
      </div>

      {/* Wordmark */}
      <div className="text-center">
        <div className="logo2-wordmark">
          LOST CITY
        </div>
        <div className="logo2-coords">
          33.7490° N, 84.3880° W
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CONCEPT 3: TERMINAL INTERFACE TYPE
// ============================================================================

export function Logo3({ className = "" }: { className?: string }) {
  const [typed, setTyped] = useState("");
  const fullText = "LOST_CITY";

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i <= fullText.length) {
        setTyped(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`relative inline-block ${className}`}>
      <ScopedStyles css={sharedStyles} />

      <div className="logo3-terminal">
        {/* Scanline effect */}
        <div
          className="absolute inset-0 pointer-events-none opacity-5 logo3-scanlines"
        />

        <div className="relative flex items-center gap-2">
          <span className="logo3-prompt">
            {">"}
          </span>
          <span className="logo3-text">
            {typed}
          </span>
          <span className="logo3-cursor">
            █
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CONCEPT 4: GLITCH CITY SILHOUETTE
// ============================================================================

export function Logo4({ className = "" }: { className?: string }) {
  const [isGlitching, setIsGlitching] = useState(false);

  useEffect(() => {
    const glitchInterval = setInterval(() => {
      setIsGlitching(true);
      setTimeout(() => setIsGlitching(false), 300);
    }, 4000);
    return () => clearInterval(glitchInterval);
  }, []);

  const skylinePath = "M0,100 L0,70 L20,70 L20,50 L40,50 L40,30 L60,30 L60,45 L75,45 L75,25 L95,25 L95,20 L115,20 L115,40 L130,40 L130,35 L145,35 L145,55 L165,55 L165,45 L180,45 L180,60 L200,60 L200,50 L220,50 L220,65 L240,65 L240,100 Z";

  return (
    <div className={`relative inline-flex flex-col items-center gap-4 ${className}`}>
      <ScopedStyles css={sharedStyles} />

      {/* Skyline container */}
      <div className="relative logo4-skyline">
        {/* RGB layers for glitch */}
        {isGlitching && (
          <>
            <svg
              viewBox="0 0 240 100"
              className="absolute inset-0 w-full h-full logo4-glitch-layer logo4-glitch-red"
            >
              <path d={skylinePath} />
            </svg>
            <svg
              viewBox="0 0 240 100"
              className="absolute inset-0 w-full h-full logo4-glitch-layer logo4-glitch-green logo4-glitch-reverse"
            >
              <path d={skylinePath} />
            </svg>
          </>
        )}

        {/* Base skyline */}
        <svg viewBox="0 0 240 100" className="w-full h-full">
          <defs>
            <linearGradient id="skyline-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff6b7a" />
              <stop offset="100%" stopColor="#00d4e8" />
            </linearGradient>
          </defs>
          <path d={skylinePath} fill="url(#skyline-gradient)" />
        </svg>
      </div>

      {/* Wordmark */}
      <div className={`logo4-wordmark ${isGlitching ? "logo4-wordmark-glitch" : ""}`}>
        LOST CITY
      </div>
    </div>
  );
}

// ============================================================================
// CONCEPT 5: NEGATIVE SPACE DISCOVERY
// ============================================================================

export function Logo5({ className = "", portal = "atlanta" }: { className?: string; portal?: string }) {
  const stars = [
    { cx: 18, cy: 18, r: 1.2, dur: 2.4, delay: 0.2 },
    { cx: 42, cy: 28, r: 1.6, dur: 3.1, delay: 0.8 },
    { cx: 70, cy: 14, r: 1.1, dur: 2.8, delay: 1.4 },
    { cx: 95, cy: 32, r: 1.7, dur: 3.6, delay: 0.5 },
    { cx: 120, cy: 20, r: 1.3, dur: 2.2, delay: 1.1 },
    { cx: 150, cy: 26, r: 1.8, dur: 3.4, delay: 0.7 },
    { cx: 175, cy: 12, r: 1.2, dur: 2.6, delay: 1.6 },
    { cx: 200, cy: 30, r: 1.5, dur: 3.0, delay: 0.3 },
    { cx: 225, cy: 18, r: 1.4, dur: 2.7, delay: 1.3 },
    { cx: 250, cy: 28, r: 1.1, dur: 3.2, delay: 0.9 },
    { cx: 275, cy: 16, r: 1.6, dur: 2.9, delay: 0.4 },
    { cx: 300, cy: 24, r: 1.2, dur: 3.5, delay: 1.8 },
    { cx: 40, cy: 8, r: 1.0, dur: 2.1, delay: 0.6 },
    { cx: 90, cy: 6, r: 1.3, dur: 3.3, delay: 1.2 },
    { cx: 140, cy: 8, r: 1.1, dur: 2.5, delay: 0.2 },
    { cx: 190, cy: 6, r: 1.2, dur: 3.0, delay: 1.5 },
    { cx: 240, cy: 8, r: 1.0, dur: 2.8, delay: 0.1 },
    { cx: 290, cy: 10, r: 1.4, dur: 3.6, delay: 1.0 },
    { cx: 20, cy: 35, r: 1.5, dur: 2.7, delay: 0.9 },
    { cx: 310, cy: 34, r: 1.1, dur: 3.1, delay: 1.4 },
  ];

  return (
    <div className={`relative inline-block ${className}`}>
      <ScopedStyles css={sharedStyles} />

      <div className="relative logo5-scene">
        {/* Night sky background */}
        <div className="absolute inset-0 logo5-night" />

        {/* Stars */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 320 180"
          aria-hidden="true"
        >
          {stars.map((star, index) => (
            <circle key={index} cx={star.cx} cy={star.cy} r={star.r} fill="white" opacity="0.5">
              <animate
                attributeName="opacity"
                values="0.3;0.9;0.3"
                dur={`${star.dur}s`}
                begin={`${star.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </svg>

        {/* Skyline with LOST spelled in windows */}
        <svg viewBox="0 0 320 180" className="absolute inset-0 w-full h-full">
          {/* Ground glow */}
          <rect x="0" y="160" width="320" height="20" fill="url(#ground-glow)" />
          <defs>
            <linearGradient id="ground-glow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ff6b7a" stopOpacity="0.3" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>

          {/* Building silhouettes with letter windows */}

          {/* L Building */}
          <rect x="20" y="60" width="50" height="100" fill="#0a0a0f" />
          <rect x="28" y="140" width="8" height="12" fill="#ff6b7a" opacity="0.9" className="logo5-window-flicker" />
          <rect x="28" y="120" width="8" height="12" fill="#ff6b7a" opacity="0.9" className="logo5-window-flicker logo5-window-delay-1" />
          <rect x="28" y="100" width="8" height="12" fill="#ff6b7a" opacity="0.9" className="logo5-window-flicker logo5-window-delay-2" />
          <rect x="28" y="80" width="8" height="12" fill="#ff6b7a" opacity="0.9" className="logo5-window-flicker logo5-window-delay-3" />
          <rect x="40" y="140" width="20" height="8" fill="#ff6b7a" opacity="0.9" className="logo5-window-flicker logo5-window-delay-4" />

          {/* O Building */}
          <rect x="85" y="50" width="55" height="110" fill="#0a0a0f" />
          <circle cx="112" cy="105" r="22" fill="none" stroke="#ff6b7a" strokeWidth="8" opacity="0.9" />

          {/* S Building */}
          <rect x="155" y="40" width="50" height="120" fill="#0a0a0f" />
          <path d="M165,60 L195,60 L195,70 L175,70 L175,85 L195,85 L195,115 L165,115 L165,105 L185,105 L185,95 L165,95 Z" fill="#ff6b7a" opacity="0.9" className="logo5-window-flicker logo5-window-flicker-slow" />

          {/* T Building */}
          <rect x="220" y="55" width="55" height="105" fill="#0a0a0f" />
          <rect x="225" y="65" width="45" height="8" fill="#ff6b7a" opacity="0.9" />
          <rect x="243" y="75" width="10" height="70" fill="#ff6b7a" opacity="0.9" className="logo5-window-flicker logo5-window-flicker-mid logo5-window-delay-5" />

          {/* Additional ambient windows */}
          <rect x="30" y="68" width="4" height="4" fill="#00d4e8" opacity="0.4" />
          <rect x="50" y="75" width="4" height="4" fill="#00d4e8" opacity="0.3" />
          <rect x="95" y="58" width="3" height="3" fill="#00d4e8" opacity="0.4" />
          <rect x="130" y="62" width="3" height="3" fill="#00d4e8" opacity="0.3" />
          <rect x="165" y="48" width="3" height="3" fill="#00d4e8" opacity="0.4" />
          <rect x="260" y="63" width="4" height="4" fill="#00d4e8" opacity="0.3" />
        </svg>

        {/* Subtitle */}
        <div className="absolute bottom-2 left-0 right-0 text-center logo5-subtitle">
          {portal === "atlanta" ? "Find what's hidden" : `Discover ${portal}`}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LOGO SHOWCASE - Display all concepts
// ============================================================================

export default function LogoShowcase() {
  const concepts = [
    { Component: Logo1, name: "Neon Portal", description: "Glowing neon tubes with portal effect" },
    { Component: Logo2, name: "Cartography", description: "Isometric city with compass rose" },
    { Component: Logo3, name: "Terminal", description: "Command-line interface aesthetic" },
    { Component: Logo4, name: "Glitch Skyline", description: "RGB channel separation effect" },
    { Component: Logo5, name: "Negative Space", description: "City windows spell the name" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {concepts.map(({ Component, name, description }, i) => (
        <div
          key={i}
          className="flex flex-col items-center p-6 rounded-xl border border-[var(--twilight)] bg-[var(--void)]/50 hover:border-[var(--coral)]/30 transition-colors"
        >
          <div className="text-xs font-mono text-[var(--muted)] mb-4 tracking-wider">
            CONCEPT {i + 1}
          </div>

          <div className="flex-1 flex items-center justify-center min-h-[180px] mb-4">
            <Component />
          </div>

          <div className="text-center">
            <div className="font-semibold text-[var(--cream)] mb-1">{name}</div>
            <div className="text-xs text-[var(--muted)]">{description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
