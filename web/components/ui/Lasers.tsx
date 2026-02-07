"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import ScopedStyles from "@/components/ScopedStyles";
import {
  createCssVarClass,
  createCssVarClassForNumber,
  createCssVarClassForTime,
} from "@/lib/css-utils";

interface LasersProps {
  isActive: boolean;
  duration?: number;
  /** Ref to the element that lasers should originate from */
  originRef?: React.RefObject<HTMLElement | null>;
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

export default function Lasers({ isActive, duration = 1500, originRef }: LasersProps) {
  const [showState, setShowState] = useState<{
    isVisible: boolean;
    beams: LaserBeam[];
    origin: { x: number; y: number };
  }>({
    isVisible: false,
    beams: [],
    origin: { x: 0, y: 0 },
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Laser animation lifecycle
      setShowState({ isVisible: false, beams: [], origin: { x: 0, y: 0 } });
      return;
    }

    // Check for reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Calculate origin from ref or fall back to viewport center
    let originX = window.innerWidth / 2;
    let originY = window.innerHeight / 2;
    if (originRef?.current) {
      const rect = originRef.current.getBoundingClientRect();
      originX = rect.left + rect.width / 2;
      originY = rect.top + rect.height / 2;
    }

    // Generate and show beams in a single state update
    const newBeams = generateBeams();
    setShowState({ isVisible: true, beams: newBeams, origin: { x: originX, y: originY } });

    // Schedule hide and reset
    timerRef.current = setTimeout(() => {
      setShowState({ isVisible: false, beams: [], origin: { x: 0, y: 0 } });
    }, duration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isActive, duration, originRef]);

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

  const content = (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      <ScopedStyles css={laserCss} />
      {/* Origin point - positioned at the button center */}
      <div
        className="absolute laser-origin"
        style={{ left: showState.origin.x, top: showState.origin.y }}
      >
        {/* Central flash */}
        <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white animate-laser-flash" />

        {/* Laser beams */}
        {showState.beams.map((beam, index) => {
          const classes = beamStyles[index];
          return (
          <div
            key={beam.id}
            className={`absolute left-0 top-0 origin-left animate-laser-shoot laser-beam ${
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

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
