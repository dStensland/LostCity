import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #16213e 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Ambient glow effect */}
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "30%",
            width: "400px",
            height: "400px",
            background: "radial-gradient(circle, rgba(255,107,107,0.15) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "20%",
            right: "20%",
            width: "300px",
            height: "300px",
            background: "radial-gradient(circle, rgba(0,255,255,0.1) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />

        {/* Logo text */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              fontWeight: "bold",
              color: "#fff5eb",
              letterSpacing: "-2px",
              textShadow: "0 0 40px rgba(255,107,107,0.5)",
            }}
          >
            Lost City
          </div>
          <div
            style={{
              fontSize: "28px",
              color: "#9ca3af",
              letterSpacing: "4px",
              textTransform: "uppercase",
            }}
          >
            Discover Local Events
          </div>
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            position: "absolute",
            bottom: "48px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#6b7280",
            fontSize: "18px",
          }}
        >
          <span>AI-powered event discovery</span>
          <span style={{ color: "#ff6b6b" }}>•</span>
          <span>20+ sources</span>
          <span style={{ color: "#ff6b6b" }}>•</span>
          <span>Atlanta</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
