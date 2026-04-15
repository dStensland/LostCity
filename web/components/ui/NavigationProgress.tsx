"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Thin progress bar that animates during page transitions.
// Moves from 0% → ~85% while loading, then quickly completes to 100% and fades.
// Uses the portal accent color (--neon-coral) by default.
// Respects prefers-reduced-motion.

export function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "loading" | "completing">("idle");
  const prevPathnameRef = useRef(pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [supportsVT, setSupportsVT] = useState(false);
  useEffect(() => {
    setSupportsVT("startViewTransition" in document);
  }, []);

  useEffect(() => {
    // On mount, record the initial path without triggering a load animation.
    prevPathnameRef.current = pathname;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => {
    if (pathname === prevPathnameRef.current) return;

    // Pathname changed — new page has finished loading (Suspense resolved).
    // We still want to start + complete if there was a loading state.
    // Trigger a brief complete flash so it feels responsive.
    prevPathnameRef.current = pathname;

    if (timerRef.current) clearTimeout(timerRef.current);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState("completing");
    timerRef.current = setTimeout(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("idle");
    }, 400);
  }, [pathname]);

  // To detect when navigation _starts_ (before the new segment loads),
  // we listen for clicks on internal links. Next.js App Router doesn't
  // expose a "navigation start" event, but clicking a link is a reliable proxy.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;

      // Only trigger for internal navigation (not external links, hash links, etc.)
      const isExternal = anchor.getAttribute("target") === "_blank" || href.startsWith("http") || href.startsWith("//");
      const isHashOnly = href.startsWith("#");
      const isSamePage = href === pathname || href === window.location.pathname;

      if (isExternal || isHashOnly || isSamePage) return;

      // Start the loading animation, delayed when VT crossfade is already providing feedback.
      if (timerRef.current) clearTimeout(timerRef.current);
      if (supportsVT) {
        timerRef.current = setTimeout(() => setState("loading"), 300);
      } else {
        setState("loading");
      }
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [pathname, supportsVT]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (state === "idle") return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        height: "2px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          background: "var(--neon-coral, var(--coral, #FF6B7A))",
          // loading: animate from 0 → 85% over 4s, ease-out (decelerates so it feels "stuck working")
          // completing: snap to 100% quickly
          width: state === "loading" ? "85%" : "100%",
          transition:
            state === "loading"
              ? "width 4s cubic-bezier(0.1, 0.5, 0.3, 1)"
              : "width 0.2s ease-out",
          opacity: state === "completing" ? 0 : 1,
          // Fade out during completing phase after the width transition
          ...(state === "completing"
            ? { transition: "width 0.2s ease-out, opacity 0.3s ease 0.15s" }
            : {}),
        }}
      />
    </div>
  );
}

export type { };
