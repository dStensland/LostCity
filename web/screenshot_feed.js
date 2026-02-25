const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  
  // Mobile screenshot (375px)
  const mobilePage = await browser.newPage();
  await mobilePage.setViewportSize({ width: 375, height: 812 });
  await mobilePage.goto('http://localhost:3000/atlanta', { waitUntil: 'networkidle', timeout: 30000 });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: '/tmp/feed_mobile.png', fullPage: false });
  console.log('Mobile screenshot (375px viewport) done');
  
  // Mobile full page
  await mobilePage.screenshot({ path: '/tmp/feed_mobile_full.png', fullPage: true });
  console.log('Mobile full page screenshot done');
  await mobilePage.close();
  
  // Desktop screenshot (1440px)
  const desktopPage = await browser.newPage();
  await desktopPage.setViewportSize({ width: 1440, height: 900 });
  await desktopPage.goto('http://localhost:3000/atlanta', { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: '/tmp/feed_desktop.png', fullPage: false });
  console.log('Desktop screenshot (1440px viewport) done');
  
  // Desktop full page
  await desktopPage.screenshot({ path: '/tmp/feed_desktop_full.png', fullPage: true });
  console.log('Desktop full page screenshot done');

  await browser.close();
}

main().catch(console.error);
