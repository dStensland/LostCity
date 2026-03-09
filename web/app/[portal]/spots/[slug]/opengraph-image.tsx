import { ImageResponse } from "next/og";
import { getSpotBySlug, getSpotTypeLabel } from "@/lib/spots";
import { cache } from "react";
import {
  OG_SIZE,
  getVenueTypeOgStyle,
  ogImageOverlay,
  ogFallbackCard,
  ogFooter,
} from "@/lib/og-utils";

export const runtime = "edge";
export const alt = "Venue details";
export const size = OG_SIZE;
export const contentType = "image/png";

const getCachedSpotBySlug = cache(getSpotBySlug);

export default async function Image({
  params,
}: {
  params: Promise<{ portal: string; slug: string }>;
}) {
  const { slug } = await params;
  const spot = await getCachedSpotBySlug(slug);

  if (!spot) {
    return new ImageResponse(ogFallbackCard("Venue Not Found", size), size);
  }

  const accentStyle = getVenueTypeOgStyle(spot.venue_type);
  const hasImage = spot.image_url && spot.image_url.length > 0;
  const titleSize = spot.name.length > 40 ? "text-[44px]" : "text-[56px]";
  const typeLabel = getSpotTypeLabel(spot.venue_type);
  const locationParts = [spot.neighborhood, spot.city].filter(Boolean);
  const locationText = locationParts.join(" · ");

  return new ImageResponse(
    (
      <div tw="relative flex flex-col w-full h-full bg-[#0D0D10]">
        {hasImage && (
          <>
            <img
              src={spot.image_url || ""}
              alt=""
              tw="absolute inset-0 w-full h-full object-cover"
            />
            {ogImageOverlay()}
          </>
        )}

        <div
          tw={`absolute top-0 left-0 w-full h-2 ${accentStyle.gradient}`}
        />

        <div tw="relative flex flex-col flex-1 justify-end p-[60px]">
          <div tw="flex items-center mb-4">
            <span
              tw={`text-[18px] font-semibold uppercase tracking-[0.1em] ${
                hasImage ? "text-white" : accentStyle.accent
              } ${hasImage ? accentStyle.badgeBg : "bg-transparent"} ${
                hasImage ? "px-3 py-1.5 rounded-md" : ""
              }`}
            >
              {typeLabel}
            </span>
          </div>

          <h1
            tw={`font-bold text-white leading-[1.15] mb-5 max-w-[95%] ${
              hasImage ? "drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]" : ""
            } ${titleSize}`}
          >
            {spot.name}
          </h1>

          {locationText && (
            <div tw="flex items-center gap-2 mb-6">
              <span
                tw={`text-[22px] ${
                  hasImage ? "text-[#D0D0D0]" : "text-[#8B8B94]"
                }`}
              >
                {locationText}
              </span>
            </div>
          )}

          {ogFooter({ light: !!hasImage })}
        </div>
      </div>
    ),
    { ...size }
  );
}
