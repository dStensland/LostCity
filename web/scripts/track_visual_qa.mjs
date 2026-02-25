import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3000/atlanta?view=feed&tab=explore';
const outDir = '/Users/coach/Projects/LostCity/output/playwright/track-qa';

const tracks = [
  { name: 'Artefacts of the Lost City', slug: 'artefacts-of-the-lost-city' },
  { name: 'Good Trouble', slug: 'good-trouble' },
  { name: 'Too Busy for Haters', slug: 'too-busy-for-haters' },
  { name: 'As Seen on TV', slug: 'as-seen-on-tv' },
  { name: 'Up on the Roof', slug: 'up-on-the-roof' },
  { name: 'Roll for Initiative', slug: 'roll-for-initiative' },
  { name: 'Say Less', slug: 'say-less' },
  { name: 'Resurgens', slug: 'resurgens' },
  { name: 'Hard in Da Paint', slug: 'hard-in-da-paint' },
];

function cleanUrl(url) {
  if (!url) return null;
  return String(url).slice(0, 260);
}

async function warmDetailImages(page) {
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < totalHeight; y += 700) {
    await page.evaluate((_y) => window.scrollTo(0, _y), y);
    await page.waitForTimeout(900);
  }
  // Return to top so full-page capture starts in the expected position.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
}

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 2200 } });

const report = {
  generated_at: new Date().toISOString(),
  base_url: baseUrl,
  tracks: [],
};

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1800);

  for (const track of tracks) {
    await page.waitForSelector('text=Explore Atlanta', { timeout: 45000 });

    const escaped = track.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const card = page.getByRole('button', { name: new RegExp(escaped, 'i') }).first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await card.click({ timeout: 20000 });

    await page.waitForSelector(`h1:has-text("${track.name}")`, { timeout: 45000 });
    await warmDetailImages(page);

    const screenshotPath = path.join(outDir, `${track.slug}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const data = await page.evaluate(() => {
      const heroImg = document.querySelector('.track-detail-hero img');
      const cardImgs = Array.from(document.querySelectorAll('img'))
        .map((img) => {
          const rect = img.getBoundingClientRect();
          const src = img.getAttribute('src') || '';
          const alt = img.getAttribute('alt') || '';
          const area = Math.max(0, rect.width * rect.height);
          return { src, alt, area, width: rect.width, height: rect.height };
        })
        .filter((it) => it.src && it.area > 8000)
        .sort((a, b) => b.area - a.area)
        .slice(0, 16);

      return {
        hero_src: heroImg ? heroImg.getAttribute('src') : null,
        hero_alt: heroImg ? heroImg.getAttribute('alt') : null,
        top_images: cardImgs,
      };
    });

    report.tracks.push({
      track: track.name,
      slug: track.slug,
      screenshot: screenshotPath,
      hero_src: cleanUrl(data.hero_src),
      hero_alt: data.hero_alt,
      top_images: data.top_images.map((i) => ({
        src: cleanUrl(i.src),
        alt: i.alt,
        area: Math.round(i.area),
        width: Math.round(i.width),
        height: Math.round(i.height),
      })),
    });

    await page.goBack({ waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1000);
  }

  const reportPath = path.join(outDir, 'track_visual_qa_report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${reportPath}`);
  console.log(`Screenshots in ${outDir}`);
} finally {
  await browser.close();
}
