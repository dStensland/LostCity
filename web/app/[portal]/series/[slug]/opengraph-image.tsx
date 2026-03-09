import { ImageResponse } from "next/og";
import { getSeriesBySlug, getSeriesTypeLabel } from "@/lib/series";
import { cache } from "react";
import {
  OG_SIZE,
  getCategoryOgStyle,
  ogImageOverlay,
  ogFallbackCard,
  ogFooter,
} from "@/lib/og-utils";

export const runtime = "edge";
export const alt = "Series details";
export const size = OG_SIZE;
export const contentType = "image/png";

const getCachedSeriesBySlug = cache(getSeriesBySlug);

export default async function Image({
  params,
}: {
  params: Promise<{ portal: string; slug: string }>;
}) {
  const { slug } = await params;
  const series = await getCachedSeriesBySlug(slug);

  if (!series) {
    return new ImageResponse(ogFallbackCard("Series Not Found", size), size);
  }

  const category = series.category || null;
  const accentStyle = getCategoryOgStyle(category);
  const hasImage = series.image_url && series.image_url.length > 0;
  const titleSize = series.title.length > 50 ? "text-[44px]" : "text-[56px]";
  const typeLabel = getSeriesTypeLabel(series.series_type);

  // Build subtitle from festival context or genres
  const subtitle = series.festival
    ? series.festival.name
    : series.genres && series.genres.length > 0
      ? series.genres.slice(0, 3).join(" · ")
      : null;

  return new ImageResponse(
    (
      <div tw="relative flex flex-col w-full h-full bg-[#0D0D10]">
        {hasImage && (
          <>
            <img
              src={series.image_url || ""}
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
            {series.title}
          </h1>

          {subtitle && (
            <div tw="flex items-center gap-2 mb-6">
              <span
                tw={`text-[22px] ${
                  hasImage ? "text-[#D0D0D0]" : "text-[#8B8B94]"
                }`}
              >
                {subtitle}
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
