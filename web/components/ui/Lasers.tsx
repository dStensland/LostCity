"use client";

import { useEffect, useState, useRef } from "react";
import ScopedStyles from "@/components/ScopedStyles";
import {
  createCssVarClass,
  createCssVarClassForNumber,
  createCssVarClassForTime,
} from "@/lib/css-utils";

interface LasersProps {
  isActive: boolean;
  duration?: number;
}

interface LaserBeam {
  id: number;
  angle: number;
  color: string;
  delay: number;
  length: number;
}

const COLORS = [
  "var(--neon-magenta)",
  "var(--neon-cyan)",
  "var(--coral)",
  "var(--neon-green)",
  "var(--gold)",
];

function generateBeams(): LaserBeam[] {
  return Array.from({ length: 16 }, (_, i) => ({
    id: i,
    angle: (i * 360) / 16 + (Math.random() * 10 - 5), // Evenly spaced with slight randomness
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.15,
    length: 80 + Math.random() * 40, // Variable beam lengths
  }));
}

export default function Lasers({ isActive, duration = 1500 }: LasersProps) {
  const [showState, setShowState] = useState<{
    isVisible: boolean;
    beams: LaserBeam[];
  }>({
    isVisible: false,
    beams: [],
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Laser animation lifecycle
      setShowState({ isVisible: false, beams: [] });
      return;
    }

    // Check for reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Generate and show beams in a single state update
    const newBeams = generateBeams();
    setShowState({ isVisible: true, beams: newBeams });

    // Schedule hide and reset
    timerRef.current = setTimeout(() => {
      setShowState({ isVisible: false, beams: [] });
    }, duration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isActive, duration]);

  if (!showState.isVisible || showState.beams.length === 0) return null;

  const beamStyles = showState.beams.map((beam) => ({
    angleClass: createCssVarClassForNumber("--laser-angle", `${beam.angle}`, "laser-angle"),
    delayClass: createCssVarClassForTime("--laser-delay", `${beam.delay}s`, "laser-delay"),
    lengthClass: createCssVarClassForNumber("--laser-length", `${beam.length}`, "laser-length"),
    colorClass: createCssVarClass("--laser-color", beam.color, "laser-color"),
  }));

  const laserCss = beamStyles
    .flatMap((entry) => [
      entry.angleClass?.css,
      entry.delayClass?.css,
      entry.lengthClass?.css,
      entry.colorClass?.css,
    ])
    .filter(Boolean)
    .join("\n");

  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      <ScopedStyles css={laserCss} />
      {/* Center point - where lasers originate */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 laser-origin">
        {/* Central flash */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white animate-laser-flash" />

        {/* Laser beams */}
        {showState.beams.map((beam, index) => {
          const classes = beamStyles[index];
          return (
          <div
            key={beam.id}
            className={`absolute left-1/2 top-1/2 origin-left animate-laser-shoot laser-beam ${
              classes.angleClass?.className ?? ""
            } ${classes.delayClass?.className ?? ""}`}
          >
            {/* Laser beam with glow */}
            <div
              className={`h-[3px] rounded-full laser-line ${
                classes.lengthClass?.className ?? ""
              } ${classes.colorClass?.className ?? ""}`}
            />
          </div>
        );
        })}
      </div>
    </div>
  );
}
