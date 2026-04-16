"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import SeriesDetailView from "@/components/views/SeriesDetailView";
import type { SeriesApiResponse } from "@/lib/detail/types";

interface SeriesDetailWrapperProps {
  slug: string;
  portalSlug: string;
  initialData: SeriesApiResponse;
}

export default function SeriesDetailWrapper({
  slug,
  portalSlug,
  initialData,
}: SeriesDetailWrapperProps) {
  const router = useRouter();
  const handleClose = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(`/${portalSlug}`);
    }
  }, [router, portalSlug]);

  return (
    <SeriesDetailView
      slug={slug}
      portalSlug={portalSlug}
      onClose={handleClose}
      initialData={initialData}
    />
  );
}
