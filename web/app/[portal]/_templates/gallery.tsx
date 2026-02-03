import type { Portal } from "@/lib/portal-context";
import { FeedRenderer } from "@/components/feed/FeedRenderer";

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
      <div className="space-y-6">
        <div className="text-center py-8">
          <h2 className="text-2xl font-display text-[var(--cream)] mb-2">
            Gallery View
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Image-focused event discovery
          </p>
        </div>

        {/* TODO: Implement gallery-specific event fetching and rendering */}
        <div className="text-center py-12 text-[var(--muted)]">
          Gallery content coming soon
        </div>
      </div>
    </FeedRenderer>
  );
}

export type { GalleryTemplateProps };
