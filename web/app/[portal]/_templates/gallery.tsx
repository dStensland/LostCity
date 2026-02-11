import type { Portal } from "@/lib/portal-context";
import { FeedRenderer } from "@/components/feed/FeedRenderer";
import FeedView from "@/components/FeedView";

interface GalleryTemplateProps {
  portal: Portal;
}

/**
 * Gallery template - image-heavy masonry layout.
 * Optimized for visual discovery and poster-based browsing.
 */
export async function GalleryTemplate({ portal }: GalleryTemplateProps) {
  return (
    <FeedRenderer portal={portal}>
      <FeedView />
    </FeedRenderer>
  );
}

export type { GalleryTemplateProps };
