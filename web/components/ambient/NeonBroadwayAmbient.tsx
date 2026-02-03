"use client";

import { useMemo } from "react";
import type { PortalAmbientConfig } from "@/lib/portal-context";

interface NeonBroadwayAmbientProps {
  config: Partial<PortalAmbientConfig>;
}

/**
 * Neon Broadway Ambient Effect
 * Nashville-inspired: Glowing neon signs, pulsing music waves, guitar string streaks.
 * Evokes the energy of Broadway at night with live music pouring out of honky-tonks.
 */
export default function NeonBroadwayAmbient({ config }: NeonBroadwayAmbientProps) {
  const primaryColor = config.colors?.primary || "#FF1B8D"; // Hot pink neon
  const secondaryColor = config.colors?.secondary || "#00E5FF"; // Electric cyan
  const accentColor = "#FF9500"; // Amber/gold

  // Animation speed based on config
  const speedMultiplier = useMemo(() => {
    switch (config.animation_speed) {
      case "slow":
        return 1.5;
      case "fast":
        return 0.7;
      default:
        return 1;
    }
  }, [config.animation_speed]);

  // Intensity affects opacity
  const opacity = useMemo(() => {
    switch (config.intensity) {
      case "subtle":
        return 0.4;
      case "bold":
        return 0.9;
      default:
        return 0.65;
    }
  }, [config.intensity]);

  // Seeded pseudo-random for deterministic values
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed * 9999) * 10000;
    return x - Math.floor(x);
  };

  // Generate neon sign elements (vertical bars like building signs)
  const neonSigns = useMemo(() => {
    const signs = [];
    const colors = [primaryColor, secondaryColor, accentColor];
    for (let i = 0; i < 6; i++) {
      signs.push({
        id: i,
        left: 10 + i * 15 + seededRandom(i * 3) * 5,
        height: 15 + seededRandom(i * 7) * 25,
        color: colors[i % colors.length],
        delay: i * 0.8,
        duration: 3 + seededRandom(i * 11) * 2,
      });
    }
    return signs;
  }, [primaryColor, secondaryColor, accentColor]);

  // Generate horizontal music wave lines (like sound waves or guitar strings)
  const musicWaves = useMemo(() => {
    const waves = [];
    for (let i = 0; i < 5; i++) {
      waves.push({
        id: i,
        top: 20 + i * 15,
        color: i % 2 === 0 ? primaryColor : secondaryColor,
        delay: i * 0.5,
        duration: 4 + seededRandom(i * 13) * 2,
      });
    }
    return waves;
  }, [primaryColor, secondaryColor]);

  return (
    <div
      className="ambient-layer fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
      style={{ opacity }}
    >
      {/* Base glow - warm ambient from the street */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 100%, ${primaryColor}20, transparent 70%),
            radial-gradient(ellipse 60% 40% at 20% 90%, ${accentColor}15, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 90%, ${secondaryColor}15, transparent 60%)
          `,
        }}
      />

      {/* Vertical neon sign bars */}
      {neonSigns.map((sign) => (
        <div
          key={sign.id}
          className="absolute bottom-0"
          style={{
            left: `${sign.left}%`,
            width: "3px",
            height: `${sign.height}%`,
            background: `linear-gradient(to top, ${sign.color}, ${sign.color}80, transparent)`,
            boxShadow: `0 0 20px ${sign.color}80, 0 0 40px ${sign.color}40, 0 0 60px ${sign.color}20`,
            animation: `neon-flicker ${sign.duration * speedMultiplier}s ease-in-out infinite`,
            animationDelay: `${sign.delay}s`,
            borderRadius: "2px",
          }}
        />
      ))}

      {/* Horizontal music wave streaks */}
      {musicWaves.map((wave) => (
        <div
          key={wave.id}
          className="absolute left-0 right-0"
          style={{
            top: `${wave.top}%`,
            height: "1px",
            background: `linear-gradient(90deg, transparent 0%, ${wave.color}60 20%, ${wave.color} 50%, ${wave.color}60 80%, transparent 100%)`,
            boxShadow: `0 0 10px ${wave.color}60, 0 0 20px ${wave.color}30`,
            animation: `music-wave ${wave.duration * speedMultiplier}s ease-in-out infinite`,
            animationDelay: `${wave.delay}s`,
            transformOrigin: "center",
          }}
        />
      ))}

      {/* Pulsing glow spots (like distant neon signs) */}
      <div
        className="absolute"
        style={{
          top: "10%",
          left: "15%",
          width: "200px",
          height: "200px",
          background: `radial-gradient(circle, ${primaryColor}40, transparent 70%)`,
          animation: `glow-pulse ${4 * speedMultiplier}s ease-in-out infinite`,
          filter: "blur(40px)",
        }}
      />
      <div
        className="absolute"
        style={{
          top: "5%",
          right: "20%",
          width: "150px",
          height: "150px",
          background: `radial-gradient(circle, ${secondaryColor}35, transparent 70%)`,
          animation: `glow-pulse ${5 * speedMultiplier}s ease-in-out infinite`,
          animationDelay: "1s",
          filter: "blur(30px)",
        }}
      />
      <div
        className="absolute"
        style={{
          top: "15%",
          left: "60%",
          width: "180px",
          height: "180px",
          background: `radial-gradient(circle, ${accentColor}30, transparent 70%)`,
          animation: `glow-pulse ${4.5 * speedMultiplier}s ease-in-out infinite`,
          animationDelay: "2s",
          filter: "blur(35px)",
        }}
      />

      {/* Flickering accent - simulates neon sign buzz */}
      <div
        className="absolute"
        style={{
          bottom: "30%",
          left: "40%",
          width: "100px",
          height: "4px",
          background: primaryColor,
          boxShadow: `0 0 15px ${primaryColor}, 0 0 30px ${primaryColor}80`,
          animation: `neon-buzz ${0.1 * speedMultiplier}s steps(2) infinite`,
          borderRadius: "2px",
        }}
      />

      {/* Keyframes */}
      <style>{`
        @keyframes neon-flicker {
          0%, 100% {
            opacity: 1;
            filter: brightness(1);
          }
          10% { opacity: 0.8; filter: brightness(0.9); }
          20% { opacity: 1; filter: brightness(1.1); }
          30% { opacity: 0.9; filter: brightness(1); }
          50% { opacity: 1; filter: brightness(1.05); }
          70% { opacity: 0.85; filter: brightness(0.95); }
          90% { opacity: 1; filter: brightness(1); }
        }

        @keyframes music-wave {
          0%, 100% {
            transform: scaleY(1) scaleX(1);
            opacity: 0.6;
          }
          25% {
            transform: scaleY(2) scaleX(1.02);
            opacity: 0.9;
          }
          50% {
            transform: scaleY(0.5) scaleX(0.98);
            opacity: 0.5;
          }
          75% {
            transform: scaleY(1.5) scaleX(1.01);
            opacity: 0.8;
          }
        }

        @keyframes glow-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
        }

        @keyframes neon-buzz {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.95; }
        }
      `}</style>
    </div>
  );
}
