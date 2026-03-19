"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import EventDetailView, { type EventApiResponse } from "@/components/views/EventDetailView";

interface EventDetailWrapperProps {
  eventId: number;
  portalSlug: string;
  initialData: EventApiResponse;
}

export default function EventDetailWrapper({
  eventId,
  portalSlug,
  initialData,
}: EventDetailWrapperProps) {
  const router = useRouter();
  const handleClose = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(`/${portalSlug}`);
    }
  }, [router, portalSlug]);

  return (
    <EventDetailView
      eventId={eventId}
      portalSlug={portalSlug}
      onClose={handleClose}
      initialData={initialData}
    />
  );
}
