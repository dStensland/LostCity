"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import FestivalDetailView from "@/components/views/FestivalDetailView";
import type { FestivalApiResponse } from "@/lib/detail/types";

interface FestivalDetailWrapperProps {
  slug: string;
  portalSlug: string;
  initialData: FestivalApiResponse;
}

export default function FestivalDetailWrapper({
  slug,
  portalSlug,
  initialData,
}: FestivalDetailWrapperProps) {
  const router = useRouter();
  const handleClose = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(`/${portalSlug}`);
    }
  }, [router, portalSlug]);

  return (
    <FestivalDetailView
      slug={slug}
      portalSlug={portalSlug}
      onClose={handleClose}
      initialData={initialData}
    />
  );
}
