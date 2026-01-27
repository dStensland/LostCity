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

  // Note: canScrollLeft and canScrollRight are tracked but fade overlays removed
  // as they obscure content. Could be used for scroll indicators if needed.
  void canScrollLeft;
  void canScrollRight;

  return (
    <div className="relative">
      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className={`flex gap-2 overflow-x-auto scrollbar-hide ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
