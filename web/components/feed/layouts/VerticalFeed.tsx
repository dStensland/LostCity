"use client";

import { memo } from "react";
import type { PortalFeedConfig } from "@/lib/portal-context";

interface VerticalFeedProps {
  config: PortalFeedConfig;
  children: React.ReactNode;
}

/**
 * Vertical feed layout - traditional single-column scrolling feed.
 * Default layout for most portals.
 */
export const VerticalFeed = memo(function VerticalFeed({
  config,
  children,
}: VerticalFeedProps) {
  return (
    <div className="vertical-feed">
      {config.hero_style !== "none" && (
        <div className="hero-section mb-4 sm:mb-6">
          {/* Hero content will be rendered by parent */}
        </div>
      )}

      <div className="feed-content space-y-4">
        {children}
      </div>
    </div>
  );
});

export type { VerticalFeedProps };
