"use client";

import { memo } from "react";
import { FamilyCompassLogo } from "./FamilyCompassLogo";
import { BloomingATLLogo } from "./BloomingATLLogo";
import { NeighborhoodStackLogo } from "./NeighborhoodStackLogo";
import { FamilyConstellationLogo } from "./FamilyConstellationLogo";

type LogoVariant = "compass" | "blooming" | "stack" | "constellation";

interface PortalLogoProps {
  variant?: LogoVariant;
  size?: number;
  animated?: boolean;
  className?: string;
}

export const PortalLogo = memo(function PortalLogo({
  variant = "compass",
  size = 64,
  animated = true,
  className = "",
}: PortalLogoProps) {
  switch (variant) {
    case "compass":
      return <FamilyCompassLogo size={size} animated={animated} className={className} />;
    case "blooming":
      return <BloomingATLLogo size={size} animated={animated} className={className} />;
    case "stack":
      return <NeighborhoodStackLogo size={size} animated={animated} className={className} />;
    case "constellation":
      return <FamilyConstellationLogo size={size} animated={animated} className={className} />;
    default:
      return <FamilyCompassLogo size={size} animated={animated} className={className} />;
  }
});

export type { PortalLogoProps, LogoVariant };
