import type { ImageProps } from "next/image";

export function shouldProxyImage(src: ImageProps["src"]): src is string {
  if (typeof src !== "string") return false;
  if (!src) return false;
  if (src.startsWith("/api/image-proxy")) return false;
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) {
    return false;
  }
  return src.startsWith("http://") || src.startsWith("https://");
}

export function buildProxiedImageSrc(src: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(src)}`;
}

export function getProxiedImageSrc(src: ImageProps["src"]): ImageProps["src"] {
  if (!shouldProxyImage(src)) return src;
  return buildProxiedImageSrc(src);
}
