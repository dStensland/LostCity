import { describe, it, expect } from "vitest";
import { getProxiedImageSrc, shouldProxyImage } from "./image-proxy";
import type { StaticImageData } from "next/image";

describe("image proxy helpers", () => {
  it("does not proxy local paths", () => {
    expect(shouldProxyImage("/images/logo.png")).toBe(false);
    expect(getProxiedImageSrc("/images/logo.png")).toBe("/images/logo.png");
  });

  it("does not proxy data or blob URLs", () => {
    expect(shouldProxyImage("data:image/png;base64,abcd")).toBe(false);
    expect(shouldProxyImage("blob:https://example.com/abcd")).toBe(false);
  });

  it("proxies external http(s) URLs", () => {
    const url = "https://example.com/image.jpg";
    expect(shouldProxyImage(url)).toBe(true);
    expect(getProxiedImageSrc(url)).toBe(`/api/image-proxy?url=${encodeURIComponent(url)}`);
  });

  it("does not double-proxy", () => {
    const proxied = "/api/image-proxy?url=https%3A%2F%2Fexample.com%2Fimage.jpg";
    expect(shouldProxyImage(proxied)).toBe(false);
    expect(getProxiedImageSrc(proxied)).toBe(proxied);
  });

  it("leaves non-string src untouched", () => {
    const staticLike = { src: "/static.png", width: 10, height: 10 } as StaticImageData;
    expect(shouldProxyImage(staticLike)).toBe(false);
  });
});
