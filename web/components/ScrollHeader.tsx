"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LogoBrand from "./LogoBrand";

interface ScrollHeaderProps {
  threshold?: number;
}

export default function ScrollHeader({ threshold = 300 }: ScrollHeaderProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > threshold);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out ${
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      }`}
    >
      {/* Dark glass backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-xl scroll-header-backdrop"
      />

      {/* Neon accent line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px scroll-header-accent"
      />

      {/* Content */}
      <div className="relative px-4 py-3 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5 group">
          <LogoBrand variant="symbol" size={28} className="transition-transform duration-300 group-hover:scale-110" />
          <span
            className="font-bold text-base tracking-wider hidden sm:block transition-all duration-300 scroll-header-logo"
          >
            LOST CITY
          </span>
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/atlanta"
            className="text-sm text-[#8a8a9a] hover:text-[#00e5ff] transition-colors duration-300"
          >
            Atlanta
          </Link>
        </nav>
      </div>
    </header>
  );
}
