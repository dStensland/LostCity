"use client";

import { memo, useState } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import { ADV, ADV_FONT } from "@/lib/adventure-tokens";

export interface FeaturedDestinationCardProps {
  name: string;
  slug: string;
  imageUrl: string | null;
  commitmentTier: string;
  summary: string;
  portalSlug: string;
}

const COMMITMENT_LABELS: Record<string, string> = {
  hour: "1 HR",
  halfday: "HALF DAY",
  fullday: "FULL DAY",
  weekend: "WEEKEND",
};

export const FeaturedDestinationCard = memo(function FeaturedDestinationCard({
  name,
  slug,
  imageUrl,
  commitmentTier,
  summary,
  portalSlug,
}: FeaturedDestinationCardProps) {
  const commitmentLabel = COMMITMENT_LABELS[commitmentTier] ?? commitmentTier.toUpperCase();
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <Link
      href={`/${portalSlug}/spots/${slug}`}
      className="block relative overflow-hidden"
      style={{
        border: `2px solid ${ADV.DARK}`,
        borderRadius: 0,
        fontFamily: ADV_FONT,
      }}
    >
      {/* Image */}
      <div className="relative" style={{ height: 240 }}>
        {/* Skeleton placeholder */}
        {imageUrl && !imageLoaded && (
          <div
            className="absolute inset-0 animate-pulse"
            style={{ backgroundColor: `${ADV.STONE}33`, borderRadius: 0 }}
          />
        )}

        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 1024px) 100vw, 960px"
            className="object-cover"
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `${ADV.DARK}0A` }}
          />
        )}

        {/* Gradient overlay */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: 96,
            background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
          }}
        />

        {/* Name overlay */}
        <div className="absolute bottom-0 left-0 p-5">
          {/* Commitment badge */}
          <span
            className="inline-block px-2.5 py-1 text-xs font-bold text-white uppercase mb-2"
            style={{
              letterSpacing: "0.1em",
              backgroundColor: ADV.TERRACOTTA,
              borderRadius: 0,
            }}
          >
            {commitmentLabel}
          </span>

          {/* Name */}
          <p
            className="text-xl font-bold text-white leading-tight"
          >
            {name}
          </p>

          {/* Summary */}
          {summary && (
            <p
              className="text-sm leading-snug mt-1"
              style={{
                color: "rgba(255,255,255,0.8)",
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {summary}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
});
