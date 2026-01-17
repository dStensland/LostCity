"use client";

import { useRef, useState, useEffect, ReactNode } from "react";

interface ScrollableRowProps {
  children: ReactNode;
  className?: string;
}

export default function ScrollableRow({ children, className = "" }: ScrollableRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);

    // Check after content loads
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="relative">
      {/* Left fade gradient */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--night)] to-transparent pointer-events-none z-10 transition-opacity duration-200 ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className={`flex gap-2 overflow-x-auto scrollbar-hide ${className}`}
      >
        {children}
      </div>

      {/* Right fade gradient */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--night)] to-transparent pointer-events-none z-10 transition-opacity duration-200 ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />
    </div>
  );
}
