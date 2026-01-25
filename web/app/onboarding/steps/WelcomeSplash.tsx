"use client";

import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import Image from "next/image";

interface WelcomeSplashProps {
  onComplete: () => void;
  portalLogo?: string | null;
  portalName?: string | null;
}

export function WelcomeSplash({ onComplete, portalLogo, portalName }: WelcomeSplashProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Fade in
    const showTimer = setTimeout(() => setIsVisible(true), 100);

    // Auto-advance after 2.5 seconds
    const advanceTimer = setTimeout(() => {
      setIsFading(true);
      setTimeout(onComplete, 500);
    }, 2500);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(advanceTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center bg-[var(--void)] transition-opacity duration-500 ${
        isVisible && !isFading ? "opacity-100" : "opacity-0"
      }`}
      onClick={onComplete}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-[var(--coral)]/10 via-transparent to-transparent animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-[var(--cyan)]/10 via-transparent to-transparent animate-pulse" />
      </div>

      {/* Logo */}
      <div className="relative z-10 animate-fadeInScale">
        {portalLogo ? (
          <Image
            src={portalLogo}
            alt={portalName || "Portal"}
            width={120}
            height={120}
            className="rounded-2xl"
          />
        ) : (
          <div className="transform scale-150">
            <Logo />
          </div>
        )}
      </div>

      {/* Tagline */}
      <p className="relative z-10 mt-6 font-serif text-xl text-[var(--soft)] italic animate-fadeIn animation-delay-500">
        {portalName ? `Welcome to ${portalName}` : "Discover what's happening"}
      </p>

      {/* Skip hint */}
      <p className="absolute bottom-8 text-xs text-[var(--muted)] animate-fadeIn animation-delay-1000">
        Tap to skip
      </p>
    </div>
  );
}
