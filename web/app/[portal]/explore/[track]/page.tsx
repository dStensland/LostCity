"use client";

import { useParams, useRouter } from "next/navigation";
import ExploreTrackDetail from "@/components/explore/ExploreTrackDetail";
import { EditorialGuidePage } from "@/components/explore-platform/EditorialGuidePage";
import { getExploreEditorialGuide } from "@/lib/explore-platform/editorial-guides";

export default function ExploreTrackPage() {
  const params = useParams();
  const router = useRouter();
  const portalSlug = params?.portal as string;
  const trackSlug = params?.track as string;
  const editorialGuide = getExploreEditorialGuide(portalSlug, trackSlug);

  if (editorialGuide) {
    return <EditorialGuidePage portalSlug={portalSlug} guide={editorialGuide} />;
  }

  return (
    <ExploreTrackDetail
      slug={trackSlug}
      onBack={() => router.push(`/${portalSlug}?view=feed&tab=explore`)}
      portalSlug={portalSlug}
    />
  );
}
