import { ImageResponse } from "next/og";
import { getEventById } from "@/lib/supabase";
import { format, parseISO } from "date-fns";

export const runtime = "edge";
export const alt = "Event details";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const event = await getEventById(parseInt(params.id, 10));

  if (!event) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0D0D10",
            color: "#F5F5DC",
            fontFamily: "system-ui",
          }}
        >
          <span style={{ fontSize: 48 }}>Event Not Found</span>
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

  // Category colors
  const categoryColors: Record<string, string> = {
    music: "#F9A8D4",
    film: "#A5B4FC",
    comedy: "#FCD34D",
    theater: "#F0ABFC",
    art: "#C4B5FD",
    community: "#6EE7B7",
    food_drink: "#FDBA74",
    sports: "#7DD3FC",
    fitness: "#5EEAD4",
    nightlife: "#E879F9",
    family: "#A78BFA",
  };

  const accentColor = event.category
    ? categoryColors[event.category] || "#FF6B6B"
    : "#FF6B6B";

  // If event has an image, use it as background
  const hasImage = event.image_url && event.image_url.length > 0;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#0D0D10",
          position: "relative",
        }}
      >
        {/* Background image with overlay */}
        {hasImage && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.image_url || ""}
              alt=""
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            {/* Dark gradient overlay for text readability */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background: "linear-gradient(to top, rgba(13, 13, 16, 0.95) 0%, rgba(13, 13, 16, 0.7) 50%, rgba(13, 13, 16, 0.4) 100%)",
              }}
            />
          </>
        )}

        {/* Gradient accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: 8,
            background: `linear-gradient(90deg, ${accentColor}, #FF6B6B)`,
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "flex-end",
            padding: 60,
            position: "relative",
          }}
        >
          {/* Category badge */}
          {event.category && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: hasImage ? "#FFFFFF" : accentColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  backgroundColor: hasImage ? accentColor : "transparent",
                  padding: hasImage ? "6px 12px" : 0,
                  borderRadius: 6,
                }}
              >
                {event.category.replace("_", " ")}
              </span>
            </div>
          )}

          {/* Event title */}
          <h1
            style={{
              fontSize: event.title.length > 50 ? 44 : 56,
              fontWeight: 700,
              color: "#FFFFFF",
              lineHeight: 1.15,
              marginBottom: 20,
              maxWidth: "95%",
              textShadow: hasImage ? "0 2px 10px rgba(0,0,0,0.5)" : "none",
            }}
          >
            {event.title}
          </h1>

          {/* Date, time, and venue */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 26,
                fontWeight: 600,
                color: "#FF6B6B",
              }}
            >
              {formattedDate}
            </span>
            <span
              style={{
                fontSize: 24,
                color: hasImage ? "#E5E5E5" : "#8B8B94",
              }}
            >
              {formattedTime}
            </span>
            {event.is_free && (
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#34D399",
                  backgroundColor: "rgba(52, 211, 153, 0.2)",
                  padding: "4px 10px",
                  borderRadius: 6,
                }}
              >
                FREE
              </span>
            )}
          </div>

          {/* Venue */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 24,
            }}
          >
            <span
              style={{
                fontSize: 22,
                color: hasImage ? "#D0D0D0" : "#8B8B94",
              }}
            >
              {venueName}
            </span>
            {neighborhood && (
              <span
                style={{
                  fontSize: 18,
                  color: hasImage ? "#A0A0A0" : "#555560",
                }}
              >
                &bull; {neighborhood}
              </span>
            )}
          </div>

          {/* Footer with branding */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#FF6B6B",
              }}
            >
              Lost City
            </span>
            <span
              style={{
                fontSize: 16,
                color: hasImage ? "#999999" : "#555560",
              }}
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
