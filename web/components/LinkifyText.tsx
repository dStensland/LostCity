"use client";

import React, { useMemo } from "react";

interface LinkifyTextProps {
  text: string;
  className?: string;
}

// Regex to match URLs (http, https, www)
const URL_REGEX = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

// Common HTML entities to decode
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&ndash;": "–",
  "&mdash;": "—",
  "&hellip;": "…",
  "&copy;": "©",
  "&reg;": "®",
  "&trade;": "™",
  "&bull;": "•",
};

// Decode HTML entities in text
function decodeHtmlEntities(str: string): string {
  let result = str;
  // Decode named entities
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    result = result.replace(new RegExp(entity, "gi"), char);
  }
  // Decode numeric entities (&#123; or &#x7B;)
  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return result;
}

export default function LinkifyText({ text, className = "" }: LinkifyTextProps) {
  const parts = useMemo(() => {
    // First decode HTML entities
    const decodedText = decodeHtmlEntities(text);

    const result: (string | { url: string; display: string })[] = [];
    let lastIndex = 0;
    let match;

    const regex = new RegExp(URL_REGEX);
    while ((match = regex.exec(decodedText)) !== null) {
      // Add text before the URL
      if (match.index > lastIndex) {
        result.push(decodedText.slice(lastIndex, match.index));
      }

      // Add the URL
      let url = match[0];
      // Add protocol if missing
      if (url.startsWith("www.")) {
        url = "https://" + url;
      }
      // Clean up trailing punctuation that's likely not part of the URL
      const cleanUrl = url.replace(/[.,;:!?)]+$/, "");
      const trailingPunc = url.slice(cleanUrl.length);

      result.push({ url: cleanUrl, display: match[0].replace(/[.,;:!?)]+$/, "") });
      if (trailingPunc) {
        result.push(trailingPunc);
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < decodedText.length) {
      result.push(decodedText.slice(lastIndex));
    }

    return result;
  }, [text]);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          // Text is rendered as-is; parent container should use whitespace-pre-wrap for newlines
          <React.Fragment key={i}>{part}</React.Fragment>
        ) : (
          <a
            key={i}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--neon-cyan)] hover:text-[var(--coral)] underline underline-offset-2 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {part.display}
          </a>
        )
      )}
    </span>
  );
}
