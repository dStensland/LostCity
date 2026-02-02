"use client";

/*
 * Where's Waldo-style Category Illustrations
 * PNG images with busy, detailed scenes
 * Hover states swap to magical highlighted versions
 */

import Image from "next/image";
import { CSSProperties } from "react";

export type IllustrationProps = {
  isHovered?: boolean;
  className?: string;
  style?: CSSProperties;
};

// Base path for category illustrations
const BASE_PATH = "/portals/atlittle/categories";

// Reusable illustration component with hover image swap
function CategoryIllustration({
  name,
  alt,
  isHovered,
  className,
  style,
}: IllustrationProps & { name: string; alt: string }) {
  const normalSrc = `${BASE_PATH}/${name}.png`;
  const hoverSrc = `${BASE_PATH}/${name}-hover.png`;

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${className || ""}`}
      style={style}
    >
      {/* Hover state - render first (underneath) */}
      <Image
        src={hoverSrc}
        alt={`${alt} - highlighted`}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 50vw, 33vw"
        style={{ zIndex: 1 }}
        loading="eager"
      />
      {/* Normal state - render second (on top), fades out on hover */}
      <Image
        src={normalSrc}
        alt={alt}
        fill
        className={`object-cover transition-opacity duration-300 ${
          isHovered ? "opacity-0" : "opacity-100"
        }`}
        sizes="(max-width: 768px) 50vw, 33vw"
        style={{ zIndex: 2 }}
        priority
      />
    </div>
  );
}

// MUSEUMS - T-Rex skeleton, kids exploring
export function MuseumScene(props: IllustrationProps) {
  return (
    <CategoryIllustration
      name="museums"
      alt="Museum scene with T-Rex skeleton and visitors"
      {...props}
    />
  );
}

// OUTDOORS - Mountains, hiking trails, families
export function OutdoorScene(props: IllustrationProps) {
  return (
    <CategoryIllustration
      name="outdoors"
      alt="Outdoor scene with mountains and hiking families"
      {...props}
    />
  );
}

// THEATER - Stage, performers, audience
export function TheaterScene(props: IllustrationProps) {
  return (
    <CategoryIllustration
      name="shows"
      alt="Theater scene with stage performers and audience"
      {...props}
    />
  );
}

// SPORTS - Soccer field, players, cheering fans
export function SportsScene(props: IllustrationProps) {
  return (
    <CategoryIllustration
      name="sports"
      alt="Sports field with soccer players and fans"
      {...props}
    />
  );
}

// FESTIVALS - Ferris wheel, carnival, crowds
export function FestivalScene(props: IllustrationProps) {
  return (
    <CategoryIllustration
      name="festivals"
      alt="Festival scene with ferris wheel and carnival"
      {...props}
    />
  );
}

// CAMPS - Night campfire scene
export function CampScene(props: IllustrationProps) {
  return (
    <CategoryIllustration
      name="camps"
      alt="Night camping scene with campfire and tents"
      {...props}
    />
  );
}

export const CategoryIllustrations = {
  museums: MuseumScene,
  outdoor: OutdoorScene,
  theater: TheaterScene,
  sports: SportsScene,
  festivals: FestivalScene,
  camps: CampScene,
} as const;
