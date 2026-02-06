import { ImageResponse } from "next/og";
import { getEventById } from "@/lib/supabase";
import { format, parseISO } from "date-fns";

export const runtime = "edge";
export const alt = "Event details";
export const size = {
  width: 1200,
  height: 600,
};
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const eventId = parseInt(params.id, 10);
  if (isNaN(eventId)) {
    return new ImageResponse(
      (
        <div tw="w-full h-full flex items-center justify-center bg-[#0D0D10] text-[#F5F5DC] font-sans">
          <span tw="text-[48px]">Invalid Event ID</span>
        </div>
      ),
      size
    );
  }

  const event = await getEventById(eventId);

  if (!event) {
    return new ImageResponse(
      (
        <div tw="w-full h-full flex items-center justify-center bg-[#0D0D10] text-[#F5F5DC] font-sans">
          <span tw="text-[48px]">Event Not Found</span>
        </div>
      ),
      size
    );
  }

  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEE, MMM d");
  const formattedTime = event.start_time
    ? format(parseISO(`2000-01-01T${event.start_time}`), "h:mm a")
    : "TBA";
  const venueName = event.venue?.name || "TBA";
  const neighborhood = event.venue?.neighborhood || "";

  const categoryStyles: Record<
    string,
    { accent: string; badgeBg: string; gradient: string }
  > = {
    music: {
      accent: "text-[#F9A8D4]",
      badgeBg: "bg-[#F9A8D4]",
      gradient: "bg-[linear-gradient(90deg,_#F9A8D4,_#FF6B6B)]",
    },
    film: {
      accent: "text-[#A5B4FC]",
      badgeBg: "bg-[#A5B4FC]",
      gradient: "bg-[linear-gradient(90deg,_#A5B4FC,_#FF6B6B)]",
    },
    comedy: {
      accent: "text-[#FCD34D]",
      badgeBg: "bg-[#FCD34D]",
      gradient: "bg-[linear-gradient(90deg,_#FCD34D,_#FF6B6B)]",
    },
    theater: {
      accent: "text-[#F0ABFC]",
      badgeBg: "bg-[#F0ABFC]",
      gradient: "bg-[linear-gradient(90deg,_#F0ABFC,_#FF6B6B)]",
    },
    art: {
      accent: "text-[#C4B5FD]",
      badgeBg: "bg-[#C4B5FD]",
      gradient: "bg-[linear-gradient(90deg,_#C4B5FD,_#FF6B6B)]",
    },
    community: {
      accent: "text-[#6EE7B7]",
      badgeBg: "bg-[#6EE7B7]",
      gradient: "bg-[linear-gradient(90deg,_#6EE7B7,_#FF6B6B)]",
    },
    food_drink: {
      accent: "text-[#FDBA74]",
      badgeBg: "bg-[#FDBA74]",
      gradient: "bg-[linear-gradient(90deg,_#FDBA74,_#FF6B6B)]",
    },
    sports: {
      accent: "text-[#7DD3FC]",
      badgeBg: "bg-[#7DD3FC]",
      gradient: "bg-[linear-gradient(90deg,_#7DD3FC,_#FF6B6B)]",
    },
    fitness: {
      accent: "text-[#5EEAD4]",
      badgeBg: "bg-[#5EEAD4]",
      gradient: "bg-[linear-gradient(90deg,_#5EEAD4,_#FF6B6B)]",
    },
    nightlife: {
      accent: "text-[#E879F9]",
      badgeBg: "bg-[#E879F9]",
      gradient: "bg-[linear-gradient(90deg,_#E879F9,_#FF6B6B)]",
    },
    family: {
      accent: "text-[#A78BFA]",
      badgeBg: "bg-[#A78BFA]",
      gradient: "bg-[linear-gradient(90deg,_#A78BFA,_#FF6B6B)]",
    },
    default: {
      accent: "text-[#FF6B6B]",
      badgeBg: "bg-[#FF6B6B]",
      gradient: "bg-[linear-gradient(90deg,_#FF6B6B,_#FF6B6B)]",
    },
  };

  const accentStyle =
    (event.category && categoryStyles[event.category]) || categoryStyles.default;

  // If event has an image, use it as background
  const hasImage = event.image_url && event.image_url.length > 0;
  const titleSize = event.title.length > 50 ? "text-[40px]" : "text-[50px]";
  const timeColor = hasImage ? "text-[#E5E5E5]" : "text-[#8B8B94]";
  const venueColor = hasImage ? "text-[#D0D0D0]" : "text-[#8B8B94]";
  const neighborhoodColor = hasImage ? "text-[#A0A0A0]" : "text-[#555560]";
  const footerColor = hasImage ? "text-[#999999]" : "text-[#555560]";

  return new ImageResponse(
    (
      <div tw="relative flex flex-col w-full h-full bg-[#0D0D10]">
        {/* Background image with overlay */}
        {hasImage && (
          <>
            { }
            <img
              src={event.image_url || ""}
              alt=""
              tw="absolute inset-0 w-full h-full object-cover"
            />
            {/* Dark gradient overlay for text readability */}
            <div
              tw="absolute inset-0 bg-[linear-gradient(to_top,_rgba(13,13,16,0.95)_0%,_rgba(13,13,16,0.7)_50%,_rgba(13,13,16,0.4)_100%)]"
            />
          </>
        )}

        {/* Gradient accent */}
        <div tw={`absolute top-0 left-0 w-full h-2 ${accentStyle.gradient}`} />

        {/* Main content */}
        <div tw="relative flex flex-col flex-1 justify-end p-[50px]">
          {/* Category badge */}
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

          {/* Event title */}
          <h1
            tw={`font-bold text-white leading-[1.15] mb-[18px] max-w-[95%] ${
              hasImage ? "drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]" : ""
            } ${titleSize}`}
          >
            {event.title}
          </h1>

          {/* Date, time, and venue */}
          <div tw="flex items-center gap-3.5 mb-1.5">
            <span
              tw="text-[24px] font-semibold text-[#FF6B6B]"
            >
              {formattedDate}
            </span>
            <span
              tw={`text-[22px] ${timeColor}`}
            >
              {formattedTime}
            </span>
            {event.is_free && (
              <span
                tw="text-[14px] font-semibold text-[#34D399] bg-[rgba(52,211,153,0.2)] px-2 py-[3px] rounded-[5px]"
              >
                FREE
              </span>
            )}
          </div>

          {/* Venue */}
          <div tw="flex items-center gap-2 mb-5">
            <span
              tw={`text-[20px] ${venueColor}`}
            >
              {venueName}
            </span>
            {neighborhood && (
              <span
                tw={`text-[16px] ${neighborhoodColor}`}
              >
                &bull; {neighborhood}
              </span>
            )}
          </div>

          {/* Footer with branding */}
          <div tw="flex items-center gap-2.5">
            <span
              tw="text-[18px] font-bold text-[#FF6B6B]"
            >
              Lost City
            </span>
            <span
              tw={`text-[14px] ${footerColor}`}
            >
              lostcity.ai
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
