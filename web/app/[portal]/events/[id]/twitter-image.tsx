import { ImageResponse } from "next/og";
import { getEventById } from "@/lib/supabase";
import { suppressEventImageIfVenueFlagged } from "@/lib/image-quality-suppression";
import { format, parseISO } from "date-fns";
import { cache } from "react";
import {
  TWITTER_SIZE,
  getCategoryOgStyle,
  ogImageOverlay,
  ogFallbackCard,
  ogFooter,
} from "@/lib/og-utils";

export const runtime = "edge";
export const alt = "Event details";
export const size = TWITTER_SIZE;
export const contentType = "image/png";

const getCachedEventById = cache(async (id: number) => {
  const event = await getEventById(id);
  return event ? suppressEventImageIfVenueFlagged(event) : null;
});

export default async function Image({
  params,
}: {
  params: Promise<{ portal: string; id: string }>;
}) {
  const { id } = await params;
  const eventId = parseInt(id, 10);
  if (isNaN(eventId)) {
    return new ImageResponse(ogFallbackCard("Invalid Event ID", size), size);
  }

  const event = await getCachedEventById(eventId);

  if (!event) {
    return new ImageResponse(ogFallbackCard("Event Not Found", size), size);
  }

  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEE, MMM d");
  const formattedTime = event.start_time
    ? format(parseISO(`2000-01-01T${event.start_time}`), "h:mm a")
    : "TBA";
  const venueName = event.venue?.name || "TBA";
  const neighborhood = event.venue?.neighborhood || "";

  const accentStyle = getCategoryOgStyle(event.category);

  const hasImage = event.image_url && event.image_url.length > 0;
  const titleSize = event.title.length > 50 ? "text-[40px]" : "text-[50px]";
  const timeColor = hasImage ? "text-[#E5E5E5]" : "text-[#8B8B94]";
  const venueColor = hasImage ? "text-[#D0D0D0]" : "text-[#8B8B94]";
  const neighborhoodColor = hasImage ? "text-[#A0A0A0]" : "text-[#555560]";

  return new ImageResponse(
    (
      <div tw="relative flex flex-col w-full h-full bg-[#0D0D10]">
        {hasImage && (
          <>
            <img
              src={event.image_url || ""}
              alt=""
              tw="absolute inset-0 w-full h-full object-cover"
            />
            {ogImageOverlay()}
          </>
        )}

        <div tw={`absolute top-0 left-0 w-full h-2 ${accentStyle.gradient}`} />

        <div tw="relative flex flex-col flex-1 justify-end p-[50px]">
          {event.category && (
            <div tw="flex items-center mb-3.5">
              <span
                tw={`text-[16px] font-semibold uppercase tracking-[0.1em] ${
                  hasImage ? "text-white" : accentStyle.accent
                } ${hasImage ? accentStyle.badgeBg : "bg-transparent"} ${
                  hasImage ? "px-2.5 py-[5px] rounded-[5px]" : ""
                }`}
              >
                {event.category.replace("_", " ")}
              </span>
            </div>
          )}

          <h1
            tw={`font-bold text-white leading-[1.15] mb-[18px] max-w-[95%] ${
              hasImage ? "drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]" : ""
            } ${titleSize}`}
          >
            {event.title}
          </h1>

          <div tw="flex items-center gap-3.5 mb-1.5">
            <span tw="text-[24px] font-semibold text-[#FF6B6B]">
              {formattedDate}
            </span>
            <span tw={`text-[22px] ${timeColor}`}>{formattedTime}</span>
            {event.is_free && (
              <span tw="text-[14px] font-semibold text-[#34D399] bg-[rgba(52,211,153,0.2)] px-2 py-[3px] rounded-[5px]">
                FREE
              </span>
            )}
          </div>

          <div tw="flex items-center gap-2 mb-5">
            <span tw={`text-[20px] ${venueColor}`}>{venueName}</span>
            {neighborhood && (
              <span tw={`text-[16px] ${neighborhoodColor}`}>
                &bull; {neighborhood}
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
