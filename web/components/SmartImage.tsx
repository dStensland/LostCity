"use client";

import Image, { type ImageProps } from "next/image";
import React, { useState, useCallback, useMemo, type ReactNode } from "react";
import { getProxiedImageSrc, isKnownImageHost } from "@/lib/image-proxy";

import { decode } from "blurhash";

interface SmartImageProps extends Omit<ImageProps, "placeholder" | "blurDataURL"> {
  blurhash?: string | null;
  /** Custom fallback UI rendered when image fails to load. Receives the container's full area. */
  fallback?: ReactNode;
}

const UNOPTIMIZED_IMAGE_HOSTS = new Set([
  "lh3.googleusercontent.com",
]);

function shouldDisableOptimizerForHost(src: string): boolean {
  try {
    return UNOPTIMIZED_IMAGE_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

/**
 * Passthrough loader — returns the URL as-is, skipping Next.js hostname validation.
 * Used for external images from hosts not in next.config.ts remotePatterns.
 */
const passthroughLoader = ({ src }: { src: string }) => src;

/**
 * Check if a resolved image src is an external URL that would fail
 * Next.js remotePatterns validation. The proxy should catch unknown hosts,
 * but this is a safety net for images that slip through (e.g., hosts in
 * KNOWN_IMAGE_HOSTS but not in next.config.ts, or direct <Image> usage).
 */
function isUnknownExternalUrl(src: ImageProps["src"]): boolean {
  if (typeof src !== "string") return false;
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) return false;
  if (!src.startsWith("http://") && !src.startsWith("https://")) return false;
  return !isKnownImageHost(src);
}

/** Module-level cache: same blurhash string always produces the same data URL */
const blurhashCache = new Map<string, string>();

/**
 * Decode a blurhash string into a data URL for use as a placeholder.
 * Results are cached to avoid redundant canvas decodes across mounts.
 */
function blurhashToDataUrl(hash: string, width = 32, height = 32): string {
  const key = `${hash}:${width}x${height}`;
  const cached = blurhashCache.get(key);
  if (cached) return cached;

  const pixels = decode(hash, width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);
  const dataUrl = canvas.toDataURL();
  blurhashCache.set(key, dataUrl);
  return dataUrl;
}

/** Generic fallback shown when no custom fallback is provided */
function DefaultFallback({ fill, className }: { fill?: boolean; className?: string }) {
  // Match the container's sizing strategy: fill → absolute inset-0, else use className dimensions
  return (
    <div
      className={`flex items-center justify-center bg-[var(--twilight,#2A2A3E)]/60 ${fill ? "absolute inset-0" : ""} ${className || ""}`}
      aria-hidden
    >
      <svg
        className="w-6 h-6 text-[var(--muted,#8B8B9E)]/40"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
        />
      </svg>
    </div>
  );
}

/**
 * Error boundary that catches next/image render throws (e.g., unconfigured hostname).
 * On error, re-renders using a passthrough loader to bypass hostname validation.
 * The image still loads — just without Next.js optimization.
 */
class ImageErrorBoundary extends React.Component<
  { children: ReactNode; fallbackProps: SmartImageProps & { resolvedSrc: ImageProps["src"]; unoptimized: boolean; blurDataURL?: string } },
  { usePassthrough: boolean }
> {
  state = { usePassthrough: false };

  static getDerivedStateFromError() {
    return { usePassthrough: true };
  }

  render() {
    if (this.state.usePassthrough) {
      const { resolvedSrc, unoptimized, blurDataURL, fallback, blurhash: _bh, src: _src, ...rest } = this.props.fallbackProps;
      return (
        <Image
          src={resolvedSrc}
          loader={passthroughLoader}
          unoptimized
          {...(blurDataURL ? { placeholder: "blur" as const, blurDataURL } : {})}
          {...rest}
        />
      );
    }
    return this.props.children;
  }
}

function SmartImageInner(props: SmartImageProps) {
  const { src, alt = "", blurhash, unoptimized: unoptimizedProp, fallback, ...rest } = props;
  const [failed, setFailed] = useState(false);

  const handleError = useCallback(() => {
    setFailed(true);
  }, []);

  const resolvedSrc = getProxiedImageSrc(src);
  const needsUnoptimizedProxy =
    typeof resolvedSrc === "string" && resolvedSrc.startsWith("/api/image-proxy?url=");
  const needsUnoptimizedHost =
    typeof resolvedSrc === "string" && shouldDisableOptimizerForHost(resolvedSrc);
  // Unknown external hosts bypass Next.js optimizer to avoid hostname validation crash
  const needsPassthrough = isUnknownExternalUrl(resolvedSrc);
  const unoptimized =
    unoptimizedProp !== undefined
      ? unoptimizedProp
      : needsUnoptimizedProxy || needsUnoptimizedHost || needsPassthrough;

  // Decode blurhash to data URL if provided
  const blurDataURL = useMemo(() => {
    if (!blurhash) return undefined;
    try {
      return blurhashToDataUrl(blurhash);
    } catch (error) {
      console.warn("Failed to decode blurhash:", error);
      return undefined;
    }
  }, [blurhash]);

  // Show fallback when image fails to load
  if (failed) {
    if (fallback) return <>{fallback}</>;
    return <DefaultFallback fill={rest.fill} className={rest.className} />;
  }

  // For unknown external hosts, use passthrough loader to skip hostname validation entirely
  const loaderProps = needsPassthrough ? { loader: passthroughLoader } : {};

  // Use blur placeholder if we have a blurhash
  if (blurDataURL) {
    return (
      <Image
        src={resolvedSrc}
        alt={alt}
        unoptimized={unoptimized}
        placeholder="blur"
        blurDataURL={blurDataURL}
        onError={handleError}
        {...loaderProps}
        {...rest}
      />
    );
  }

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      unoptimized={unoptimized}
      onError={handleError}
      {...loaderProps}
      {...rest}
    />
  );
}

/**
 * SmartImage — resilient image component wrapping next/image.
 *
 * Three layers of protection against unconfigured hostname crashes:
 * 1. Proxy: unknown hosts are routed through /api/image-proxy (local URL, always allowed)
 * 2. Passthrough loader: external URLs from unknown hosts skip hostname validation
 * 3. Error boundary: if next/image still throws, re-renders with passthrough loader
 *
 * Images always render — worst case is no Next.js optimization, never a page crash.
 */
export default function SmartImage(props: SmartImageProps) {
  const { src, alt = "", blurhash, unoptimized: unoptimizedProp, ...rest } = props;
  const resolvedSrc = getProxiedImageSrc(src);
  const needsUnoptimizedProxy =
    typeof resolvedSrc === "string" && resolvedSrc.startsWith("/api/image-proxy?url=");
  const needsUnoptimizedHost =
    typeof resolvedSrc === "string" && shouldDisableOptimizerForHost(resolvedSrc);
  const needsPassthrough = isUnknownExternalUrl(resolvedSrc);
  const unoptimized =
    unoptimizedProp !== undefined
      ? unoptimizedProp
      : needsUnoptimizedProxy || needsUnoptimizedHost || needsPassthrough;

  return (
    <ImageErrorBoundary
      fallbackProps={{ ...props, resolvedSrc, unoptimized, alt }}
    >
      <SmartImageInner {...props} />
    </ImageErrorBoundary>
  );
}
