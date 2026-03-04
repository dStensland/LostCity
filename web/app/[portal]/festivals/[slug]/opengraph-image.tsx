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
export const alt = "Festival details";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ portal: string; slug: string }>;
}) {
  const { slug } = await params;

  const supabase = createServiceClient();
  const { data: festival } = await supabase
    .from("festivals")
    .select("name, image_url, categories, announced_start, announced_end, location")
    .eq("slug", slug)
    .maybeSingle();

  if (!festival) {
    return new ImageResponse(ogFallbackCard("Festival Not Found", size), size);
  }

  const name = (festival as { name: string }).name;
  const imageUrl = (festival as { image_url: string | null }).image_url;
  const categories = (festival as { categories: string[] | null }).categories;
  const startDate = (festival as { announced_start: string | null }).announced_start;
  const endDate = (festival as { announced_end: string | null }).announced_end;
  const location = (festival as { location: string | null }).location;

  const primaryCategory = categories?.[0] || null;
  const accentStyle = getCategoryOgStyle(primaryCategory);
  const hasImage = imageUrl && imageUrl.length > 0;
  const titleSize = name.length > 40 ? "text-[44px]" : "text-[56px]";

  // Format date range
  let dateLabel = "";
  if (startDate && endDate) {
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    const startMonth = start.toLocaleDateString("en-US", { month: "short" });
    const endMonth = end.toLocaleDateString("en-US", { month: "short" });
    if (startDate === endDate) {
      dateLabel = start.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } else if (startMonth === endMonth) {
      dateLabel = `${startMonth} ${start.getDate()}\u2013${end.getDate()}, ${start.getFullYear()}`;
    } else {
      dateLabel = `${startMonth} ${start.getDate()} \u2013 ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
    }
  } else if (startDate) {
    const start = new Date(startDate + "T00:00:00");
    dateLabel = start.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  return new ImageResponse(
    (
      <div tw="relative flex flex-col w-full h-full bg-[#0D0D10]">
        {hasImage && (
          <>
            <img
              src={imageUrl}
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
              Festival
            </span>
          </div>

          <h1
            tw={`font-bold text-white leading-[1.15] mb-5 max-w-[95%] ${
              hasImage ? "drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]" : ""
            } ${titleSize}`}
          >
            {name}
          </h1>

          <div tw="flex items-center gap-4 mb-6">
            {dateLabel && (
              <span tw="text-[24px] font-semibold text-[#FF6B6B]">
                {dateLabel}
              </span>
            )}
            {location && (
              <span
                tw={`text-[20px] ${
                  hasImage ? "text-[#D0D0D0]" : "text-[#8B8B94]"
                }`}
              >
                {location}
              </span>
            )}
          </div>

          {ogFooter({ light: !!hasImage })}
        </div>
      </div>
    ),
    { ...size }
  );
}
