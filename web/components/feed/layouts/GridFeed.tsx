"use client";

import { memo } from "react";
import type { PortalFeedConfig } from "@/lib/portal-context";

interface GridFeedProps {
  config: PortalFeedConfig;
  children: React.ReactNode;
}

/**
 * Grid feed layout - responsive card grid.
 * Good for image-heavy content like posters and galleries.
 */
export const GridFeed = memo(function GridFeed({
  config,
  children,
}: GridFeedProps) {
  return (
    <div className="grid-feed">
      {config.hero_style !== "none" && (
        <div className="hero-section mb-6 col-span-full">
          {/* Hero content will be rendered by parent */}
        </div>
      )}

      <div
        className="feed-content grid gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}
      >
        {children}
      </div>
    </div>
  );
});

export type { GridFeedProps };
