import { DOG_THEME_SCOPE_CLASS, DOG_THEME_CSS } from "@/lib/dog-art";
import type { Portal } from "@/lib/portal-context";
import DogHero from "./DogHero";
import DogFeed from "./DogFeed";
import DogCommunityCTA from "./DogCommunityCTA";
import { Suspense } from "react";

interface Props {
  portal: Portal;
}

export default function DogPortalExperience({ portal }: Props) {
  return (
    <div className={DOG_THEME_SCOPE_CLASS}>
      <style dangerouslySetInnerHTML={{ __html: DOG_THEME_CSS }} />

      <DogHero portal={portal} />

      <div className="max-w-5xl mx-auto px-4 pb-24 mt-8">
        <Suspense fallback={<FeedSkeleton />}>
          <DogFeed portalSlug={portal.slug} />
        </Suspense>

        <DogCommunityCTA portalSlug={portal.slug} />
      </div>
    </div>
  );
}

/** Skeleton loader while feed data loads */
function FeedSkeleton() {
  return (
    <div className="space-y-10 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <div
            className="h-5 w-40 rounded-md mb-3"
            style={{ background: "var(--dog-border)", opacity: 0.5 }}
          />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map((j) => (
              <div
                key={j}
                className="flex-shrink-0 w-72 h-52 rounded-2xl"
                style={{ background: "var(--dog-border)", opacity: 0.3 }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
