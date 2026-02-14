"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const RainEffect = dynamic(() => import("@/components/RainEffect"), { ssr: false });
const CursorGlow = dynamic(() => import("@/components/CursorGlow"), { ssr: false });

export default function ClientEffects() {
  const [shouldLoadEffects, setShouldLoadEffects] = useState(false);

  useEffect(() => {
    const bodyVertical = document.body.dataset.vertical;
    const routeVertical = document.querySelector<HTMLElement>("[data-vertical]")?.dataset.vertical;
    const vertical = bodyVertical || routeVertical;
    if (vertical === "film" || vertical === "hotel" || vertical === "hospital") return;

    // Skip effects if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    // Skip effects on mobile (viewport width < 768px)
    const isMobile = window.innerWidth < 768;
    if (isMobile) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate-only visual effect gate
    setShouldLoadEffects(true);
  }, []);

  if (!shouldLoadEffects) return null;

  return (
    <>
      <RainEffect />
      <CursorGlow />
    </>
  );
}
