"use client";

import { memo } from "react";
import type { LibraryPassData } from "@/lib/types/programs";

// ---- Afternoon Field palette ------------------------------------------------
const AMBER = "#C48B1D";
const AMBER_BG = "#C48B1D18";
const AMBER_BORDER = "#C48B1D40";
const TEXT = "#1E2820";
const MUTED = "#756E63";
const CARD = "#FAFAF6";

const FONT_HEADING = "var(--font-plus-jakarta-sans, 'Plus Jakarta Sans', system-ui, sans-serif)";
const FONT_BODY = "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)";

export type { LibraryPassData };

interface LibraryPassCalloutProps {
  libraryPass: LibraryPassData;
  venueName?: string;
}

// ---- Component --------------------------------------------------------------

export const LibraryPassCallout = memo(function LibraryPassCallout({
  libraryPass,
  venueName,
}: LibraryPassCalloutProps) {
  if (!libraryPass.eligible) return null;

  return (
    <div
      style={{
        backgroundColor: CARD,
        border: `1px solid ${AMBER_BORDER}`,
        borderLeft: `4px solid ${AMBER}`,
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        boxShadow: "0 1px 4px rgba(196,139,29,0.08)",
      }}
      role="note"
      aria-label="Library card savings tip"
    >
      {/* Book icon */}
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: AMBER_BG,
          border: `1px solid ${AMBER_BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        📚
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: AMBER,
            marginBottom: 3,
          }}
        >
          Free with Library Card
        </p>
        <p
          style={{
            fontFamily: FONT_HEADING,
            fontSize: 14,
            fontWeight: 700,
            color: TEXT,
            lineHeight: 1.3,
            marginBottom: venueName ? 0 : 4,
          }}
        >
          {libraryPass.benefit}
        </p>
        {venueName && (
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 12,
              color: MUTED,
              marginBottom: 4,
            }}
          >
            at {venueName}
          </p>
        )}
        {libraryPass.notes && (
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 11,
              color: MUTED,
              lineHeight: 1.4,
              marginBottom: 6,
            }}
          >
            {libraryPass.notes}
          </p>
        )}
        <a
          href={libraryPass.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            fontWeight: 600,
            color: AMBER,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          Learn how to get passes →
        </a>
      </div>
    </div>
  );
});

export type { LibraryPassCalloutProps };
