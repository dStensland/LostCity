"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface SparklesProps {
  isActive: boolean;
  duration?: number;
  /** Ref to the element that sparkles should originate from */
  originRef?: React.RefObject<HTMLElement | null>;
}

interface Sparkle {
  id: number;
  endX: number;
  endY: number;
  size: number;
  delay: number;
  rotation: number;
}

function generateSparkles(): Sparkle[] {
  return Array.from({ length: 14 }, (_, i) => {
    const angle = (i * 360) / 14 + (Math.random() * 15 - 7.5);
    const distance = 25 + Math.random() * 40;
    const rad = (angle * Math.PI) / 180;
    return {
      id: i,
      endX: Math.cos(rad) * distance,
      endY: Math.sin(rad) * distance,
      size: 5 + Math.random() * 8,
      delay: Math.random() * 100,
      rotation: Math.random() * 360,
    };
  });
}

/**
 * Gold star sparkle burst for "Maybe" RSVP.
 * Portaled to body and centered on originRef.
 */
export default function Sparkles({ isActive, duration = 700, originRef }: SparklesProps) {
  const [burst, setBurst] = useState<{
    sparkles: Sparkle[];
    origin: { x: number; y: number };
  } | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (!isActive) {
      const raf = requestAnimationFrame(() => setBurst(null));
      return () => cancelAnimationFrame(raf);
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const raf = requestAnimationFrame(() => {
      let originX = window.innerWidth / 2;
      let originY = window.innerHeight / 2;
      if (originRef?.current) {
        const rect = originRef.current.getBoundingClientRect();
        originX = rect.left + rect.width / 2;
        originY = rect.top + rect.height / 2;
      }

      setBurst({
        sparkles: generateSparkles(),
        origin: { x: originX, y: originY },
      });

      hideTimerRef.current = setTimeout(() => {
        setBurst(null);
      }, duration);
    });

    return () => {
      cancelAnimationFrame(raf);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [isActive, duration, originRef]);

  if (!burst || burst.sparkles.length === 0) return null;
  if (typeof document === "undefined") return null;

  const content = (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      {/* Central gold flash */}
      <div
        className="absolute w-8 h-8 rounded-full"
        style={{
          left: burst.origin.x,
          top: burst.origin.y,
          background: "radial-gradient(circle, var(--gold) 0%, transparent 70%)",
          animation: `sparkle-flash ${Math.min(duration, 500)}ms ease-out forwards`,
        }}
      />

      {/* Star sparkles bursting outward */}
      {burst.sparkles.map((s) => (
        <SparkleParticle key={s.id} sparkle={s} origin={burst.origin} />
      ))}
    </div>
  );

  return createPortal(content, document.body);
}

function SparkleParticle({ sparkle: s, origin }: { sparkle: Sparkle; origin: { x: number; y: number } }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.animate(
      [
        {
          transform: "translate(-50%, -50%) scale(0)",
          opacity: "1",
        },
        {
          transform: `translate(calc(-50% + ${s.endX * 0.5}px), calc(-50% + ${s.endY * 0.5}px)) scale(1.4)`,
          opacity: "1",
          offset: 0.25,
        },
        {
          transform: `translate(calc(-50% + ${s.endX}px), calc(-50% + ${s.endY}px)) scale(0)`,
          opacity: "0",
        },
      ],
      {
        duration: 500,
        delay: s.delay,
        easing: "ease-out",
        fill: "forwards",
      }
    );
  }, [s]);

  return (
    <div
      ref={ref}
      className="absolute"
      style={{
        left: origin.x,
        top: origin.y,
        transform: "translate(-50%, -50%) scale(0)",
        opacity: 0,
      }}
    >
      <svg
        width={s.size}
        height={s.size}
        viewBox="0 0 24 24"
        fill="var(--gold)"
        style={{
          transform: `rotate(${s.rotation}deg)`,
          filter: "drop-shadow(0 0 4px var(--gold))",
        }}
      >
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
      </svg>
    </div>
  );
}
