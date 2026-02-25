const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  
  // Mobile - scroll to different sections
  const mobilePage = await browser.newPage();
  await mobilePage.setViewportSize({ width: 375, height: 812 });
  await mobilePage.goto('http://localhost:3000/atlanta', { waitUntil: 'networkidle', timeout: 30000 });
  await mobilePage.waitForTimeout(2000);
  
  // Scroll to popular/trending section
  await mobilePage.evaluate(() => window.scrollBy(0, 900));
  await mobilePage.waitForTimeout(500);
  await mobilePage.screenshot({ path: '/tmp/feed_mobile_popular.png' });

  // Scroll to browse section
  await mobilePage.evaluate(() => window.scrollBy(0, 800));
  await mobilePage.waitForTimeout(500);
  await mobilePage.screenshot({ path: '/tmp/feed_mobile_browse.png' });

  // Scroll to footer
  await mobilePage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await mobilePage.waitForTimeout(500);
  await mobilePage.screenshot({ path: '/tmp/feed_mobile_bottom.png' });
  
  await mobilePage.close();
  
  // Desktop - popular section
  const desktopPage = await browser.newPage();
  await desktopPage.setViewportSize({ width: 1440, height: 900 });
  await desktopPage.goto('http://localhost:3000/atlanta', { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(2000);
  
  await desktopPage.evaluate(() => window.scrollBy(0, 1200));
  await desktopPage.waitForTimeout(500);
  await desktopPage.screenshot({ path: '/tmp/feed_desktop_popular.png' });
  
  await desktopPage.evaluate(() => window.scrollBy(0, 800));
  await desktopPage.waitForTimeout(500);
  await desktopPage.screenshot({ path: '/tmp/feed_desktop_browse.png' });
  
  await desktopPage.close();

  // Also get the nav header close-up
  const navPage = await browser.newPage();
  await navPage.setViewportSize({ width: 375, height: 200 });
  await navPage.goto('http://localhost:3000/atlanta', { waitUntil: 'networkidle', timeout: 30000 });
  await navPage.waitForTimeout(1000);
  await navPage.screenshot({ path: '/tmp/feed_nav_mobile.png', clip: { x: 0, y: 0, width: 375, height: 65 } });
  await navPage.close();

  await browser.close();
  console.log('Section screenshots done');
}

main().catch(console.error);
