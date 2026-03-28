"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import PlaceDetailView, {
  type SpotApiResponse,
} from "@/components/views/PlaceDetailView";

interface PlaceDetailWrapperProps {
  slug: string;
  portalSlug: string;
  initialData: SpotApiResponse;
}

export default function PlaceDetailWrapper({
  slug,
  portalSlug,
  initialData,
}: PlaceDetailWrapperProps) {
  const router = useRouter();
  const handleClose = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(`/${portalSlug}`);
    }
  }, [router, portalSlug]);

  return (
    <PlaceDetailView
      slug={slug}
      portalSlug={portalSlug}
      onClose={handleClose}
      initialData={initialData}
    />
  );
}
