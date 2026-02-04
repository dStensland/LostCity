"use client";

import dynamic from "next/dynamic";

const RainEffect = dynamic(() => import("@/components/RainEffect"), { ssr: false });
const CursorGlow = dynamic(() => import("@/components/CursorGlow"), { ssr: false });

export default function ClientEffects() {
  return (
    <>
      <RainEffect />
      <CursorGlow />
    </>
  );
}
