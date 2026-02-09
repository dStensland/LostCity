import { describe, it, expect } from "vitest";
import { isKnownImageHost, getProxiedImageSrc } from "../image-proxy";

describe("image-proxy", () => {
  describe("isKnownImageHost", () => {
    it("returns true for exact hostname matches", () => {
      expect(isKnownImageHost("https://img.evbuc.com/image.jpg")).toBe(true);
      expect(isKnownImageHost("https://images.unsplash.com/photo.jpg")).toBe(true);
      expect(isKnownImageHost("https://image.tmdb.org/t/p/w500/poster.jpg")).toBe(true);
    });

    it("returns true for Supabase storage URLs", () => {
      expect(isKnownImageHost("https://abc.supabase.co/storage/v1/object/public/image.jpg")).toBe(true);
      expect(isKnownImageHost("https://xyz.supabase.co/image.jpg")).toBe(true);
    });

    it("returns true for wildcard **.squarespace.com patterns", () => {
      expect(isKnownImageHost("https://images.squarespace-cdn.com/image.jpg")).toBe(true);
      expect(isKnownImageHost("https://static1.squarespace.com/image.jpg")).toBe(true);
      expect(isKnownImageHost("https://foo.squarespace.com/image.jpg")).toBe(true);
      expect(isKnownImageHost("https://foo.bar.squarespace.com/image.jpg")).toBe(true);
    });

    it("returns false for unknown domains", () => {
      expect(isKnownImageHost("https://random-site.com/image.jpg")).toBe(false);
      expect(isKnownImageHost("https://evil.com/image.jpg")).toBe(false);
    });

    it("returns false for invalid URLs", () => {
      expect(isKnownImageHost("not-a-url")).toBe(false);
      expect(isKnownImageHost("")).toBe(false);
    });
  });

  describe("getProxiedImageSrc", () => {
    it("returns original URL for known hosts", () => {
      const supabaseUrl = "https://abc.supabase.co/storage/v1/object/public/image.jpg";
      expect(getProxiedImageSrc(supabaseUrl)).toBe(supabaseUrl);

      const tmdbUrl = "https://image.tmdb.org/t/p/w500/poster.jpg";
      expect(getProxiedImageSrc(tmdbUrl)).toBe(tmdbUrl);

      const unsplashUrl = "https://images.unsplash.com/photo.jpg";
      expect(getProxiedImageSrc(unsplashUrl)).toBe(unsplashUrl);
    });

    it("proxies unknown hosts", () => {
      const unknownUrl = "https://random-site.com/image.jpg";
      const result = getProxiedImageSrc(unknownUrl);
      expect(result).toBe(`/api/image-proxy?url=${encodeURIComponent(unknownUrl)}`);
    });

    it("does not proxy local paths", () => {
      expect(getProxiedImageSrc("/local/image.jpg")).toBe("/local/image.jpg");
      expect(getProxiedImageSrc("data:image/png;base64,ABC")).toBe("data:image/png;base64,ABC");
    });

    it("does not proxy already-proxied URLs", () => {
      const proxied = "/api/image-proxy?url=https://example.com/image.jpg";
      expect(getProxiedImageSrc(proxied)).toBe(proxied);
    });
  });
});
