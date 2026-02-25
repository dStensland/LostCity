const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  
  // ── DESKTOP 1440px ───────────────────────────────────────────────────────
  const desktopPage = await browser.newPage();
  await desktopPage.setViewportSize({ width: 1440, height: 900 });
  await desktopPage.goto('http://localhost:3000/atlanta?view=find&type=destinations', { waitUntil: 'networkidle', timeout: 30000 });
  await desktopPage.waitForTimeout(3000);
  await desktopPage.screenshot({ path: '/tmp/spots_desktop.png', fullPage: false });
  console.log('1. Desktop Spots (1440px viewport) done');
  
  await desktopPage.screenshot({ path: '/tmp/spots_desktop_full.png', fullPage: true });
  console.log('2. Desktop Spots full page done');

  // Apply "Open Now" filter on desktop
  // Find and click the Open filter button
  try {
    const openBtn = desktopPage.locator('button').filter({ hasText: /^Open/ }).first();
    await openBtn.click();
    await desktopPage.waitForTimeout(1500);
    await desktopPage.screenshot({ path: '/tmp/spots_desktop_filtered.png', fullPage: false });
    console.log('3. Desktop filtered (Open Now) done');
    
    // Clear filter
    await openBtn.click();
    await desktopPage.waitForTimeout(500);
  } catch (e) {
    console.log('Filter click failed:', e.message);
  }

  // Switch to Things to Do tab
  try {
    const thingsTodoTab = desktopPage.locator('button').filter({ hasText: /Things to Do/i }).first();
    await thingsTodoTab.click();
    await desktopPage.waitForTimeout(1500);
    await desktopPage.screenshot({ path: '/tmp/spots_desktop_thingstodo.png', fullPage: false });
    console.log('4. Desktop Things to Do tab done');
  } catch (e) {
    console.log('Things to Do tab click failed:', e.message);
  }

  // Switch to Nightlife tab
  try {
    const nightlifeTab = desktopPage.locator('button').filter({ hasText: /Nightlife/i }).first();
    await nightlifeTab.click();
    await desktopPage.waitForTimeout(1500);
    await desktopPage.screenshot({ path: '/tmp/spots_desktop_nightlife.png', fullPage: false });
    console.log('5. Desktop Nightlife tab done');
  } catch (e) {
    console.log('Nightlife tab click failed:', e.message);
  }

  await desktopPage.close();

  // ── MOBILE 375px ─────────────────────────────────────────────────────────
  const mobilePage = await browser.newPage();
  await mobilePage.setViewportSize({ width: 375, height: 812 });
  await mobilePage.goto('http://localhost:3000/atlanta?view=find&type=destinations', { waitUntil: 'networkidle', timeout: 30000 });
  await mobilePage.waitForTimeout(3000);
  await mobilePage.screenshot({ path: '/tmp/spots_mobile.png', fullPage: false });
  console.log('6. Mobile Spots (375px viewport) done');

  await mobilePage.screenshot({ path: '/tmp/spots_mobile_full.png', fullPage: true });
  console.log('7. Mobile Spots full page done');

  // Open filter sheet on mobile
  try {
    const filtersBtn = mobilePage.locator('button').filter({ hasText: /^Filters/ }).first();
    await filtersBtn.click();
    await mobilePage.waitForTimeout(1000);
    await mobilePage.screenshot({ path: '/tmp/spots_mobile_filtersheet.png', fullPage: false });
    console.log('8. Mobile filter sheet open done');

    // Close the sheet
    const closeBtn = mobilePage.locator('button[aria-label="Close filters"]').first();
    try {
      await closeBtn.click({ timeout: 2000 });
    } catch (_) {
      // Try pressing Escape
      await mobilePage.keyboard.press('Escape');
    }
    await mobilePage.waitForTimeout(500);
  } catch (e) {
    console.log('Filter sheet click failed:', e.message);
  }

  // Apply Open Now on mobile
  try {
    const openBtnMobile = mobilePage.locator('button').filter({ hasText: /^Open/ }).first();
    await openBtnMobile.click();
    await mobilePage.waitForTimeout(1500);
    await mobilePage.screenshot({ path: '/tmp/spots_mobile_open_filtered.png', fullPage: false });
    console.log('9. Mobile Open Now filtered done');
  } catch (e) {
    console.log('Mobile open now filter failed:', e.message);
  }

  // Try to trigger empty state - apply very restrictive filters
  try {
    // Reset first
    const clearBtn = mobilePage.locator('button').filter({ hasText: /^Clear$/ }).first();
    try { await clearBtn.click({ timeout: 1000 }); } catch (_) {}
    
    // Try clicking an occasion chip that might have no results
    const chips = await mobilePage.locator('button[aria-pressed]').all();
    for (const chip of chips) {
      const text = await chip.textContent();
      if (text && text.includes('Late Night') || text && text.includes('Brunch')) {
        await chip.click();
        await mobilePage.waitForTimeout(1500);
        const spots = await mobilePage.locator('[class*="find-row-card"]').count();
        if (spots === 0) {
          await mobilePage.screenshot({ path: '/tmp/spots_mobile_empty.png', fullPage: false });
          console.log('10. Mobile empty state done');
          break;
        }
      }
    }
  } catch (e) {
    console.log('Empty state attempt failed:', e.message);
  }

  await mobilePage.close();
  await browser.close();
  console.log('All screenshots done.');
}

main().catch(console.error);
