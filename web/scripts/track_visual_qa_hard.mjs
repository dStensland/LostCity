import path from 'path';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:3000/atlanta?view=feed&tab=explore';
const out='/Users/coach/Projects/LostCity/output/playwright/track-qa/hard-in-da-paint.png';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:2200}});

async function warmDetailImages() {
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < totalHeight; y += 700) {
    await page.evaluate((_y) => window.scrollTo(0, _y), y);
    await page.waitForTimeout(900);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
}

try {
  await page.goto(baseUrl,{waitUntil:'domcontentloaded', timeout:60000});
  await page.waitForSelector('text=Explore Atlanta',{timeout:45000});
  const card=page.getByRole('button',{name:/Hard in Da Paint/i}).first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await card.click({timeout:10000});
  await page.waitForSelector('button[aria-label="Back to tracks"]',{timeout:45000});
  await warmDetailImages();
  await page.screenshot({path:out, fullPage:true});
  console.log('saved',out);
} finally { await browser.close(); }
