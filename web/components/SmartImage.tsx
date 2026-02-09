"use client";

import Image, { type ImageProps } from "next/image";
import { useMemo } from "react";
import { getProxiedImageSrc } from "@/lib/image-proxy";

import { decode } from "blurhash";

interface SmartImageProps extends Omit<ImageProps, "placeholder" | "blurDataURL"> {
  blurhash?: string | null;
}

/**
 * Decode a blurhash string into a data URL for use as a placeholder.
 *
 * @param hash - BlurHash string
 * @param width - Width of the placeholder (default 32)
 * @param height - Height of the placeholder (default 32)
 * @returns Data URL of the blurred placeholder
 */
function blurhashToDataUrl(hash: string, width = 32, height = 32): string {
  const pixels = decode(hash, width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

export default function SmartImage(props: SmartImageProps) {
  const { src, alt = "", blurhash, ...rest } = props;
  const resolvedSrc = getProxiedImageSrc(src);

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

  // Use blur placeholder if we have a blurhash
  if (blurDataURL) {
    return (
      <Image
        src={resolvedSrc}
        alt={alt}
        placeholder="blur"
        blurDataURL={blurDataURL}
        {...rest}
      />
    );
  }

  return <Image src={resolvedSrc} alt={alt} {...rest} />;
}
