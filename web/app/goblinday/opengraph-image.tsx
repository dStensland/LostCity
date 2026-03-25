import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Goblin Day — Horror Movie Tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "black",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Blood red gradient at top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, #991b1b, #dc2626, #991b1b)",
          }}
        />
        {/* Scattered symbols in background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            opacity: 0.08,
            fontSize: "32px",
            color: "#991b1b",
            lineHeight: "48px",
            letterSpacing: "16px",
          }}
        >
          {"\u16A0 \u2720 \u16A2 \u2625 \u16A4 \u2628 \u16A6 \u2638 \u16A8 \u263D \u16AA \u2640 \u16AC \u2644 \u16AE \u2648 \u16B0 \u264C \u16A1 \u2650 \u16A3 \u2721 \u16A5 \u262F \u16A7 \u26E4 \u16A9 \u2629 \u16AB \u2642 \u16AD \u2646 \u16AF \u264A \u16B1 \u264E \u2652 \u26E7 \u16A0 \u2720 \u16A2 \u2625 \u16A4 \u2628 \u16A6 \u2638 \u16A8 \u263D \u16AA \u2640 \u16AC \u2644 \u16AE \u2648 \u16B0 \u264C \u16A1 \u2650 \u16A3 \u2721 \u16A5 \u262F \u16A7 \u26E4 \u16A9 \u2629 \u16AB \u2642"}
        </div>
        {/* Main title */}
        <div
          style={{
            fontSize: "120px",
            fontWeight: 900,
            color: "#dc2626",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            textShadow: "0 0 40px rgba(220, 38, 38, 0.5)",
            display: "flex",
          }}
        >
          GOBLIN DAY
        </div>
        {/* Subtitle */}
        <div
          style={{
            fontSize: "24px",
            color: "#52525b",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            marginTop: "16px",
            display: "flex",
          }}
        >
          HORROR MOVIE TRACKER
        </div>
        {/* Bottom icons */}
        <div
          style={{
            display: "flex",
            gap: "32px",
            marginTop: "40px",
            fontSize: "40px",
          }}
        >
          <span>👺</span>
          <span>🍕</span>
          <span>🐶</span>
          <span>🍎</span>
          <span>🎃</span>
        </div>
        {/* Blood red gradient at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, #991b1b, #dc2626, #991b1b)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
