/**
 * Verification script to show which image URLs bypass the proxy vs. which don't.
 * Run with: npx tsx scripts/verify-image-proxy-bypass.ts
 */

import { isKnownImageHost, getProxiedImageSrc } from "../lib/image-proxy";

const testUrls = [
  // Should bypass proxy (known hosts)
  "https://abc.supabase.co/storage/v1/object/public/events/image.jpg",
  "https://image.tmdb.org/t/p/w500/poster.jpg",
  "https://img.evbuc.com/event-image.jpg",
  "https://images.unsplash.com/photo.jpg",
  "https://static1.squarespace.com/image.jpg",
  "https://foo.bar.squarespace.com/nested.jpg",

  // Should go through proxy (unknown hosts)
  "https://random-venue-site.com/event.jpg",
  "https://unknown-domain.org/image.png",

  // Should not proxy at all (local/data)
  "/local/image.jpg",
  "data:image/png;base64,ABC",
];

console.log("Image Proxy Bypass Verification\n");
console.log("=".repeat(80) + "\n");

for (const url of testUrls) {
  const isKnown = isKnownImageHost(url);
  const result = getProxiedImageSrc(url);
  const resultStr = typeof result === "string" ? result : "";
  const bypassed = isKnown && resultStr === url;
  const proxied = resultStr.startsWith("/api/image-proxy");
  const untouched = !proxied && resultStr === url;

  console.log(`URL: ${url}`);
  console.log(`  Known host: ${isKnown ? "✓" : "✗"}`);

  if (bypassed) {
    console.log(`  Result: BYPASSED (direct to /_next/image) ⚡`);
  } else if (proxied) {
    console.log(`  Result: PROXIED (/api/image-proxy → /_next/image)`);
  } else if (untouched) {
    console.log(`  Result: UNTOUCHED (local/data)`);
  }

  console.log();
}

// Summary
const knownCount = testUrls.filter(isKnownImageHost).length;
const totalExternal = testUrls.filter(url =>
  url.startsWith("http://") || url.startsWith("https://")
).length;

console.log("=".repeat(80));
console.log(`\nSummary:`);
console.log(`  External URLs tested: ${totalExternal}`);
console.log(`  Known hosts (bypassed): ${knownCount}`);
console.log(`  Unknown hosts (proxied): ${totalExternal - knownCount}`);
console.log(`  Performance improvement: ${knownCount}/${totalExternal} images save a serverless hop`);
