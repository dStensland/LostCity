import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:3000/atlanta?view=feed&tab=explore';
const outDir = '/Users/coach/Projects/LostCity/output/playwright/track-qa';
const tracks = [
  { name: 'Roll for Initiative', slug: 'roll-for-initiative' },
  { name: 'Say Less', slug: 'say-less' },
  { name: 'Resurgens', slug: 'resurgens' },
  { name: 'Hard in Da Paint', slug: 'hard-in-da-paint' },
];

async function warmDetailImages(page) {
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < totalHeight; y += 700) {
    await page.evaluate((_y) => window.scrollTo(0, _y), y);
    await page.waitForTimeout(900);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
}

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 2200 } });

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('text=Explore Atlanta', { timeout: 45000 });

  for (const track of tracks) {
    console.log('track', track.name);
    try {
      await page.waitForSelector('text=Explore Atlanta', { timeout: 20000 });
      const escaped = track.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const card = page.getByRole('button', { name: new RegExp(escaped, 'i') }).first();
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await card.click({ timeout: 10000 });

      await page.waitForSelector(`h1:has-text("${track.name}")`, { timeout: 25000 });
      await warmDetailImages(page);
      const screenshotPath = path.join(outDir, `${track.slug}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log('saved', screenshotPath);

      // back to list
      const backBtn = page.getByRole('button', { name: /back to tracks/i }).first();
      await backBtn.click({ timeout: 10000 });
      await page.waitForSelector('text=Explore Atlanta', { timeout: 20000 });
      await page.waitForTimeout(800);
    } catch (e) {
      console.log('failed', track.name, String(e).slice(0, 200));
      try {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('text=Explore Atlanta', { timeout: 45000 });
      } catch {}
    }
  }
} finally {
  await browser.close();
}
