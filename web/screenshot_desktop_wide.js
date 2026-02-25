const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  
  // 1440px desktop - clean above fold
  const p1 = await browser.newPage();
  await p1.setViewportSize({ width: 1440, height: 900 });
  await p1.goto('http://localhost:3000/atlanta', { waitUntil: 'networkidle', timeout: 30000 });
  await p1.waitForTimeout(2000);
  
  // Get the main content area width on desktop - what does the layout look like?
  const layoutInfo = await p1.evaluate(() => {
    const main = document.querySelector('main');
    const contentArea = document.querySelector('[class*="max-w"]');
    const hero = document.querySelector('.relative.overflow-hidden.rounded-2xl');
    return {
      mainWidth: main?.offsetWidth,
      mainClass: main?.className?.substring(0, 200),
      contentAreaWidth: contentArea?.offsetWidth,
      contentAreaClass: contentArea?.className?.substring(0, 200),
      heroWidth: hero?.offsetWidth,
      viewportWidth: window.innerWidth,
    };
  });
  console.log('Layout info:', JSON.stringify(layoutInfo, null, 2));
  
  // Full above-fold desktop
  await p1.screenshot({ path: '/tmp/feed_desktop_abovefold.png', clip: { x: 0, y: 0, width: 1440, height: 900 } });
  
  await p1.close();
  
  // Also try 1280px 
  const p2 = await browser.newPage();
  await p2.setViewportSize({ width: 1280, height: 800 });
  await p2.goto('http://localhost:3000/atlanta', { waitUntil: 'networkidle', timeout: 30000 });
  await p2.waitForTimeout(2000);
  await p2.screenshot({ path: '/tmp/feed_1280.png' });
  await p2.close();
  
  // iPad width (768px)
  const p3 = await browser.newPage();
  await p3.setViewportSize({ width: 768, height: 1024 });
  await p3.goto('http://localhost:3000/atlanta', { waitUntil: 'networkidle', timeout: 30000 });
  await p3.waitForTimeout(2000);
  await p3.screenshot({ path: '/tmp/feed_ipad.png' });
  await p3.close();

  await browser.close();
  console.log('Wide screenshots done');
}

main().catch(console.error);
