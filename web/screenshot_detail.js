const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  
  // Mobile - scroll to different sections
  const mobilePage = await browser.newPage();
  await mobilePage.setViewportSize({ width: 375, height: 812 });
  await mobilePage.goto('http://localhost:3000/atlanta', { waitUntil: 'networkidle', timeout: 30000 });
  await mobilePage.waitForTimeout(2000);
  
  // Hero section zoom
  await mobilePage.screenshot({ path: '/tmp/feed_mobile_hero.png', clip: { x: 0, y: 0, width: 375, height: 300 } });
  
  // Quick links / filter area
  await mobilePage.screenshot({ path: '/tmp/feed_mobile_quicklinks.png', clip: { x: 0, y: 175, width: 375, height: 200 } });
  
  // Timeline section
  await mobilePage.screenshot({ path: '/tmp/feed_mobile_timeline.png', clip: { x: 0, y: 295, width: 375, height: 350 } });
  
  // Scroll down to see dashboard cards
  await mobilePage.evaluate(() => window.scrollBy(0, 700));
  await mobilePage.waitForTimeout(500);
  await mobilePage.screenshot({ path: '/tmp/feed_mobile_cards.png' });
  
  await mobilePage.close();
  
  // Desktop - detailed sections
  const desktopPage = await browser.newPage();
  await desktopPage.setViewportSize({ width: 1440, height: 900 });
  await desktopPage.goto('http://localhost:3000/atlanta', { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(2000);
  
  // Hero area
  await desktopPage.screenshot({ path: '/tmp/feed_desktop_hero.png', clip: { x: 0, y: 0, width: 1440, height: 350 } });
  
  // Timeline section
  await desktopPage.screenshot({ path: '/tmp/feed_desktop_timeline.png', clip: { x: 0, y: 50, width: 1440, height: 700 } });
  
  // Scroll to see dashboard cards
  await desktopPage.evaluate(() => window.scrollBy(0, 800));
  await desktopPage.waitForTimeout(500);
  await desktopPage.screenshot({ path: '/tmp/feed_desktop_scrolled.png' });
  
  await desktopPage.close();
  await browser.close();
  console.log('Detail screenshots done');
}

main().catch(console.error);
