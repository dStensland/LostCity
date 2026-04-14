"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import type { EventWithLocation } from "@/lib/event-search";
import { SkeletonBlock } from "./_shared";

// ---- FeaturedHero ----------------------------------------------------------

export function FeaturedHero({
  event,
  isLoading,
  portalSlug,
}: {
  event: EventWithLocation | null | undefined;
  isLoading: boolean;
  portalSlug: string;
}) {
  if (isLoading) {
    return <SkeletonBlock height={160} />;
  }

  // Only render the hero when there's a real featured event with an image.
  // No image = no hero. The greeting headline + Places to Go section are sufficient.
  if (!event?.image_url) {
    return null;
  }

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      className="block relative overflow-hidden"
      style={{ borderRadius: 16, height: 160 }}
    >
      <SmartImage
        src={event.image_url}
        alt={event.title}
        fill
        className="object-cover"
        sizes="(min-width: 640px) 640px, 100vw"
      />
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)",
          padding: "32px 14px 12px",
        }}
      >
        <p
          style={{
            color: "#fff",
            fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.8px",
            textTransform: "uppercase",
            opacity: 0.9,
            marginBottom: 2,
          }}
        >
          Happening Today
        </p>
        <p
          style={{
            color: "#fff",
            fontFamily: "var(--font-plus-jakarta-sans, system-ui, sans-serif)",
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.25,
          }}
        >
          {event.title}
        </p>
      </div>
    </Link>
  );
}
