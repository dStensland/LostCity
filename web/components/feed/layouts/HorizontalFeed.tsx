"use client";

import { memo } from "react";
import type { PortalFeedConfig } from "@/lib/portal-context";

interface HorizontalFeedProps {
  config: PortalFeedConfig;
  children: React.ReactNode;
}

/**
 * Horizontal feed layout - scrollable rows with sections.
 * Good for browse-focused experiences with multiple categories.
 */
export const HorizontalFeed = memo(function HorizontalFeed({
  config,
  children,
}: HorizontalFeedProps) {
  return (
    <div className="horizontal-feed">
      {config.hero_style !== "none" && (
        <div className="hero-section mb-6">
          {/* Hero content will be rendered by parent */}
        </div>
      )}

      <div className="feed-content space-y-6">
        {/* Sections will render as horizontal scrolling rows */}
        {children}
      </div>
    </div>
  );
});

export type { HorizontalFeedProps };
