"use client";

import { useParams, useRouter } from "next/navigation";
import ExploreTrackDetail from "@/components/explore/ExploreTrackDetail";

export default function ExploreTrackPage() {
  const params = useParams();
  const router = useRouter();
  const portalSlug = params?.portal as string;
  const trackSlug = params?.track as string;

  return (
    <ExploreTrackDetail
      slug={trackSlug}
      onBack={() => router.push(`/${portalSlug}?view=feed&tab=explore`)}
      portalSlug={portalSlug}
    />
  );
}
