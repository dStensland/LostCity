import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/service";
import {
  OG_SIZE,
  getCategoryOgStyle,
  ogImageOverlay,
  ogFallbackCard,
  ogFooter,
} from "@/lib/og-utils";

export const runtime = "edge";
export const alt = "Curated guide";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ portal: string; slug: string }>;
}) {
  const { slug } = await params;

  const supabase = createServiceClient();
  const { data: list } = await supabase
    .from("lists")
    .select("title, cover_image_url, category, item_count")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!list) {
    return new ImageResponse(ogFallbackCard("List Not Found", size), size);
  }

  const title = (list as { title: string }).title;
  const coverImage = (list as { cover_image_url: string | null }).cover_image_url;
  const category = (list as { category: string | null }).category;
  const itemCount = (list as { item_count: number | null }).item_count;
  const accentStyle = getCategoryOgStyle(category);
  const hasImage = coverImage && coverImage.length > 0;
  const titleSize = title.length > 40 ? "text-[44px]" : "text-[56px]";

  return new ImageResponse(
    (
      <div tw="relative flex flex-col w-full h-full bg-[#0D0D10]">
        {hasImage && (
          <>
            <img
              src={coverImage}
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
              tw={`text-[16px] font-semibold uppercase tracking-[0.1em] ${
                hasImage ? "text-white" : accentStyle.accent
              } ${hasImage ? accentStyle.badgeBg : "bg-transparent"} ${
                hasImage ? "px-3 py-1.5 rounded-md" : ""
              }`}
            >
              Curated Guide
            </span>
          </div>

          <h1
            tw={`font-bold text-white leading-[1.15] mb-5 max-w-[95%] ${
              hasImage ? "drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]" : ""
            } ${titleSize}`}
          >
            {title}
          </h1>

          {itemCount && itemCount > 0 && (
            <div tw="flex items-center mb-6">
              <span
                tw={`text-[22px] font-medium ${
                  hasImage ? "text-[#D0D0D0]" : "text-[#8B8B94]"
                }`}
              >
                {itemCount} pick{itemCount !== 1 ? "s" : ""}
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
