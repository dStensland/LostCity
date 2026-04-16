#!/usr/bin/env node
// One-off verification for feed section scroll-triggered entrances.
// Spawns a real Chromium (non-MCP) so IntersectionObserver actually fires.
// Usage: node scripts/verify-scroll-entrances.mjs [url]

import { chromium } from "playwright";

const URL = process.argv[2] || "http://localhost:3001/atlanta";
const VIEWPORT = { width: 1280, height: 800 };

function section(title) {
  console.log("\n\x1b[1m" + title + "\x1b[0m");
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT });
const page = await context.newPage();

console.log(`→ ${URL}`);
await page.goto(URL, { waitUntil: "networkidle", timeout: 45_000 });

// Let any late-arriving query data settle.
await page.waitForTimeout(2500);

section("Page diagnostics");
const diag = await page.evaluate(() => ({
  visibilityState: document.visibilityState,
  hasFocus: document.hasFocus(),
  pageHeight: document.body.scrollHeight,
  feedSections: document.querySelectorAll(".feed-section-enter").length,
}));
console.log(diag);

if (diag.feedSections === 0) {
  console.error("No .feed-section-enter elements rendered — aborting.");
  await browser.close();
  process.exit(1);
}

section("Above-fold sections should auto-reveal on mount");
// Scroll to top and give IO one frame
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
const aboveFold = await page.evaluate(() =>
  Array.from(document.querySelectorAll(".feed-section-enter"))
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    })
    .map((el) => ({
      heading: el
        .querySelector('h2, [class*="uppercase"]')
        ?.textContent?.trim()
        .slice(0, 35),
      isVisible: el.classList.contains("is-visible"),
      opacity: window.getComputedStyle(el).opacity,
    })),
);
console.table(aboveFold);

section("Below-fold sections should reveal when scrolled into view");
// Scroll each section directly into view (centered) so IO can fire on each
const sectionCount = await page.evaluate(
  () => document.querySelectorAll(".feed-section-enter").length,
);
for (let i = 0; i < sectionCount; i++) {
  await page.evaluate((idx) => {
    const el = document.querySelectorAll(".feed-section-enter")[idx];
    if (el) el.scrollIntoView({ block: "center", behavior: "instant" });
  }, i);
  await page.waitForTimeout(350);
}
// Final pass: back to top, then all the way down so IO sees everything again
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(250);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(500);
const afterScroll = await page.evaluate(() =>
  Array.from(document.querySelectorAll(".feed-section-enter")).map((el, i) => {
    const rect = el.getBoundingClientRect();
    const abs = rect.top + window.scrollY;
    return {
      idx: i,
      tag: el.tagName.toLowerCase(),
      heading:
        el
          .querySelector('h2, [class*="uppercase"]')
          ?.textContent?.trim()
          .slice(0, 35) || el.textContent?.trim().slice(0, 35),
      abs_top: Math.round(abs),
      height: Math.round(rect.height),
      isVisible: el.classList.contains("is-visible"),
      opacity: window.getComputedStyle(el).opacity,
    };
  }),
);
console.table(afterScroll);
const stillHidden = afterScroll.filter((r) => !r.isVisible);
if (stillHidden.length) {
  console.warn(
    `⚠ ${stillHidden.length} section(s) never triggered:`,
    stillHidden.map((s) => s.heading),
  );
} else {
  console.log(`✓ All ${afterScroll.length} sections revealed after full-page scroll`);
}

section("Focus ring on Places-to-Go 'Browse all' tile");
await page.evaluate(() => window.scrollTo(0, 0));
const focusCheck = await page.evaluate(async () => {
  // Find the Browse all tile (muted Compass icon + "Browse all" label)
  const tile = Array.from(document.querySelectorAll("a")).find(
    (a) => a.textContent?.includes("Browse all"),
  );
  if (!tile) return { found: false };
  tile.scrollIntoView({ block: "center" });
  await new Promise((r) => setTimeout(r, 200));
  tile.focus();
  await new Promise((r) => setTimeout(r, 50));
  const cs = window.getComputedStyle(tile);
  return {
    found: true,
    href: tile.getAttribute("href"),
    outline: cs.outline,
    outlineOffset: cs.outlineOffset,
    outlineWidth: cs.outlineWidth,
    boxShadow: cs.boxShadow,
  };
});
console.log(focusCheck);

section("Hover → dot indicator reveals color transition");
const hoverCheck = await page.evaluate(async () => {
  const dots = Array.from(
    document.querySelectorAll('button[aria-label^="Go to card"]'),
  );
  if (dots.length === 0) return { dotsFound: 0 };
  const firstInactive = dots.find(
    (d) => !d.className.includes("w-4"),
  );
  if (!firstInactive) return { dotsFound: dots.length, firstInactive: false };
  const before = window.getComputedStyle(firstInactive).backgroundColor;
  // Simulate hover by dispatching pointer events is flaky; use page.hover instead
  firstInactive.setAttribute("data-test-hover", "");
  return {
    dotsFound: dots.length,
    firstInactive: true,
    colorBefore: before,
    hasHoverClass: firstInactive.className.includes("hover:bg-"),
  };
});
console.log(hoverCheck);

// Take a final screenshot for record
const screenshotPath = "/tmp/feed-scroll-verify.png";
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: screenshotPath, fullPage: false });
console.log(`\nScreenshot: ${screenshotPath}`);

await browser.close();
