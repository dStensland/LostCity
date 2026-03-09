import { ImageResponse } from "next/og";
import { getArtistBySlug, getDisciplineLabel } from "@/lib/artists";
import { cache } from "react";
import {
  OG_SIZE,
  getCategoryOgStyle,
  ogImageOverlay,
  ogFallbackCard,
  ogFooter,
} from "@/lib/og-utils";

export const runtime = "edge";
export const alt = "Artist details";
export const size = OG_SIZE;
export const contentType = "image/png";

const getCachedArtistBySlug = cache(getArtistBySlug);

export default async function Image({
  params,
}: {
  params: Promise<{ portal: string; slug: string }>;
}) {
  const { slug } = await params;
  const artist = await getCachedArtistBySlug(slug);

  if (!artist) {
    return new ImageResponse(ogFallbackCard("Artist Not Found", size), size);
  }

  // Map discipline to a category for color theming
  const disciplineCategoryMap: Record<string, string> = {
    band: "music",
    solo: "music",
    dj: "nightlife",
    comedian: "comedy",
    actor: "theater",
    filmmaker: "film",
    visual_artist: "art",
    speaker: "community",
  };
  const category = disciplineCategoryMap[artist.discipline] || null;
  const accentStyle = getCategoryOgStyle(category);
  const hasImage = artist.image_url && artist.image_url.length > 0;
  const titleSize = artist.name.length > 40 ? "text-[44px]" : "text-[56px]";
  const disciplineLabel = getDisciplineLabel(artist.discipline);

  // Build subtitle from genres
  const genreText =
    artist.genres && artist.genres.length > 0
      ? artist.genres.slice(0, 3).join(" · ")
      : null;

  return new ImageResponse(
    (
      <div tw="relative flex flex-col w-full h-full bg-[#0D0D10]">
        {hasImage && (
          <>
            <img
              src={artist.image_url || ""}
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
              {disciplineLabel}
            </span>
          </div>

          <h1
            tw={`font-bold text-white leading-[1.15] mb-5 max-w-[95%] ${
              hasImage ? "drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]" : ""
            } ${titleSize}`}
          >
            {artist.name}
          </h1>

          {genreText && (
            <div tw="flex items-center gap-2 mb-6">
              <span
                tw={`text-[22px] ${
                  hasImage ? "text-[#D0D0D0]" : "text-[#8B8B94]"
                }`}
              >
                {genreText}
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
