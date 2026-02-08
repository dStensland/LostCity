"use client";

import React, { useMemo } from "react";
import { decodeHtmlEntities } from "@/lib/formats";

interface LinkifyTextProps {
  text: string;
  className?: string;
}

// Regex to match URLs (http, https, www)
const URL_REGEX = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

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
