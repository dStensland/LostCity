"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useMinSkeletonDelay } from "@/lib/hooks/useMinSkeletonDelay";

interface SkeletonGroupProps {
  show: boolean;
  stagger?: number;
  minDisplayMs?: number;
  fadeDuration?: number;
  children: ReactNode;
  className?: string;
}

export function SkeletonGroup({
  show,
  stagger = 0.05,
  minDisplayMs = 250,
  fadeDuration = 200,
  children,
  className = "",
}: SkeletonGroupProps) {
  const showSkeleton = useMinSkeletonDelay(show, minDisplayMs);
  const [visible, setVisible] = useState(showSkeleton);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showSkeleton) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) {
      setVisible(false);
      return;
    }
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reducedMotion) {
      setVisible(false);
      return;
    }
    const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: fadeDuration,
      easing: "ease-out",
      fill: "forwards",
    });
    anim.onfinish = () => {
      anim.cancel();
      setVisible(false);
    };
    return () => anim.cancel();
  }, [showSkeleton, fadeDuration]);

  if (!visible) return null;

  const staggeredChildren = Children.map(children, (child, i) => {
    if (!isValidElement(child)) return child;
    const delay = `${(i * stagger).toFixed(2)}s`;
    const childProps = child.props as Record<string, unknown>;
    if ("delay" in childProps || typeof child.type === "function") {
      return cloneElement(child as React.ReactElement<{ delay?: string }>, {
        delay,
      });
    }
    return child;
  });

  return (
    <div ref={ref} className={className}>
      {staggeredChildren}
    </div>
  );
}

export type { SkeletonGroupProps };
