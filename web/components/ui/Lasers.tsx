"use client";

import { useEffect, useState } from "react";

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

export default function Lasers({ isActive, duration = 1500 }: LasersProps) {
  const [beams, setBeams] = useState<LaserBeam[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    // Check for reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Generate laser beams shooting outward in all directions
    const newBeams: LaserBeam[] = Array.from({ length: 16 }, (_, i) => ({
      id: i,
      angle: (i * 360) / 16 + (Math.random() * 10 - 5), // Evenly spaced with slight randomness
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 0.15,
      length: 80 + Math.random() * 40, // Variable beam lengths
    }));

    setBeams(newBeams);
    setShow(true);

    const timer = setTimeout(() => {
      setShow(false);
      setBeams([]);
    }, duration);

    return () => clearTimeout(timer);
  }, [isActive, duration]);

  if (!show || beams.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      {/* Center point - where lasers originate */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ perspective: "1000px" }}
      >
        {/* Central flash */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white animate-laser-flash" />

        {/* Laser beams */}
        {beams.map((beam) => (
          <div
            key={beam.id}
            className="absolute left-1/2 top-1/2 origin-left animate-laser-shoot"
            style={{
              transform: `rotate(${beam.angle}deg)`,
              animationDelay: `${beam.delay}s`,
            }}
          >
            {/* Laser beam with glow */}
            <div
              className="h-[3px] rounded-full"
              style={{
                width: `${beam.length}vmin`,
                background: `linear-gradient(90deg, white 0%, ${beam.color} 20%, transparent 100%)`,
                boxShadow: `0 0 10px ${beam.color}, 0 0 20px ${beam.color}, 0 0 30px ${beam.color}`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
