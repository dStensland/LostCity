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

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#0D0D10",
          padding: 60,
          position: "relative",
        }}
      >
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
            justifyContent: "center",
          }}
        >
          {/* Category badge */}
          {event.category && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: accentColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                {event.category.replace("_", " ")}
              </span>
            </div>
          )}

          {/* Event title */}
          <h1
            style={{
              fontSize: event.title.length > 50 ? 48 : 64,
              fontWeight: 700,
              color: "#F5F5DC",
              lineHeight: 1.1,
              marginBottom: 32,
              maxWidth: "90%",
            }}
          >
            {event.title}
          </h1>

          {/* Date and time */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontSize: 32,
                fontWeight: 600,
                color: "#FF6B6B",
              }}
            >
              {formattedDate}
            </span>
            <span
              style={{
                fontSize: 28,
                color: "#8B8B94",
              }}
            >
              {formattedTime}
            </span>
          </div>

          {/* Venue */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 24,
                color: "#8B8B94",
              }}
            >
              {venueName}
            </span>
            {neighborhood && (
              <span
                style={{
                  fontSize: 20,
                  color: "#555560",
                }}
              >
                &bull; {neighborhood}
              </span>
            )}
          </div>
        </div>

        {/* Footer with branding */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#FF6B6B",
              }}
            >
              Lost City
            </span>
            <span
              style={{
                fontSize: 20,
                color: "#555560",
              }}
            >
              Discover local events
            </span>
          </div>
          {event.is_free && (
            <span
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: "#34D399",
                backgroundColor: "rgba(52, 211, 153, 0.15)",
                padding: "8px 16px",
                borderRadius: 8,
              }}
            >
              FREE
            </span>
          )}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
