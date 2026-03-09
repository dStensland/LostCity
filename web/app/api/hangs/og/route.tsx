import { ImageResponse } from "next/og";
import { ENABLE_HANGS_V1 } from "@/lib/launch-flags";
import { OG_SIZE } from "@/lib/og-utils";

export const runtime = "edge";
export const revalidate = 60;

const HANG_GREEN = "#00D9A0";
const BG_VOID = "#09090B";
const BG_NIGHT = "#0F0F14";
const TEXT_CREAM = "#F5F5F3";
const TEXT_SOFT = "#A1A1AA";
const TEXT_MUTED = "#8B8B94";

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1).trimEnd() + "\u2026";
}

export async function GET(request: Request) {
  if (!ENABLE_HANGS_V1) {
    return new Response(null, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const venue = searchParams.get("venue")?.trim() ?? "";
  const neighborhood = searchParams.get("neighborhood")?.trim() ?? "";
  const user = searchParams.get("user")?.trim() ?? "";
  const rawNote = searchParams.get("note")?.trim() ?? "";
  const note = rawNote ? truncate(rawNote, 80) : "";

  // Generic fallback when venue param is missing
  if (!venue) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: BG_VOID,
          }}
        >
          <span style={{ color: TEXT_MUTED, fontSize: 40 }}>LostCity</span>
        </div>
      ),
      { ...OG_SIZE }
    );
  }

  const venueFontSize = venue.length > 30 ? 52 : 68;
  const headlineText = user ? `${user} is hanging at` : "Happening now at";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: BG_VOID,
          position: "relative",
        }}
      >
        {/* Subtle radial glow from top-left — gives depth without imagery */}
        <div
          style={{
            position: "absolute",
            top: -120,
            left: -120,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${HANG_GREEN}18 0%, transparent 70%)`,
          }}
        />

        {/* Neon green top bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: 4,
            background: `linear-gradient(90deg, ${HANG_GREEN}, #00A878)`,
          }}
        />

        {/* Main content — bottom-anchored layout */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "0 60px 56px",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          {/* "X is hanging at" headline */}
          <div
            style={{
              fontSize: 22,
              color: TEXT_SOFT,
              marginBottom: 12,
              display: "flex",
            }}
          >
            {headlineText}
          </div>

          {/* Venue name — the hero element */}
          <div
            style={{
              fontSize: venueFontSize,
              fontWeight: 800,
              color: TEXT_CREAM,
              lineHeight: 1.1,
              marginBottom: neighborhood ? 10 : 24,
              display: "flex",
            }}
          >
            {venue}
          </div>

          {/* Neighborhood */}
          {neighborhood && (
            <div
              style={{
                fontSize: 22,
                color: TEXT_MUTED,
                marginBottom: 24,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: HANG_GREEN,
                  flexShrink: 0,
                }}
              />
              {neighborhood}
            </div>
          )}

          {/* Note */}
          {note && (
            <div
              style={{
                fontSize: 24,
                color: TEXT_SOFT,
                fontStyle: "italic",
                marginBottom: 32,
                paddingLeft: 16,
                borderLeft: `3px solid ${HANG_GREEN}`,
                lineHeight: 1.4,
                display: "flex",
              }}
            >
              {`\u201C${note}\u201D`}
            </div>
          )}

          {/* LostCity footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: note ? 0 : 8,
            }}
          >
            {/* Coral square brand mark — mirrors HangShareCard */}
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                backgroundColor: "#FF6B7A",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#FF6B7A",
              }}
            >
              Lost City
            </span>
            <span
              style={{
                fontSize: 18,
                color: TEXT_MUTED,
              }}
            >
              lostcity.ai
            </span>
          </div>
        </div>

        {/* Background card — represents the venue "card" shape in top-right */}
        <div
          style={{
            position: "absolute",
            top: 60,
            right: 60,
            width: 340,
            height: 220,
            borderRadius: 16,
            backgroundColor: BG_NIGHT,
            border: `1px solid rgba(255,255,255,0.06)`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: 24,
            gap: 6,
          }}
        >
          {/* "HANG" label */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: HANG_GREEN,
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            HANG
          </div>
          {/* Pulsing dot indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: HANG_GREEN,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 16,
                color: TEXT_SOFT,
              }}
            >
              {user ? `${user} is here` : "Someone is here"}
            </span>
          </div>
          {/* Venue name in card */}
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: TEXT_CREAM,
              display: "flex",
            }}
          >
            {venue.length > 22 ? truncate(venue, 22) : venue}
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    }
  );
}
