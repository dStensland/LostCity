import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT_DIR = '/Users/coach/Projects/LostCity/web/.codex-artifacts/atlanta-portal-sweep-2026-02-18';

const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1512, height: 982 }, isMobile: false },
  { name: 'mobile', viewport: { width: 430, height: 932 }, isMobile: true },
];

const ROUTES = [
  { name: 'feed', path: '/atlanta' },
  { name: 'feed_find', path: '/atlanta?view=find' },
  { name: 'feed_community', path: '/atlanta?view=community' },
  { name: 'happening_now', path: '/atlanta/happening-now' },
  { name: 'festivals', path: '/atlanta/festivals' },
  { name: 'showtimes', path: '/atlanta/showtimes' },
  { name: 'calendar', path: '/atlanta/calendar' },
  { name: 'community_hub', path: '/atlanta/community-hub' },
  { name: 'parks', path: '/atlanta/parks' },
  { name: 'services', path: '/atlanta/services' },
  { name: 'venues', path: '/atlanta/venues' },
  { name: 'partners', path: '/atlanta/partners' },
];

function safeName(input) {
  return input.replace(/[^a-z0-9_\-]+/gi, '_').toLowerCase();
}

async function autoScroll(page, steps = 4) {
  const total = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
  const vp = page.viewportSize()?.height || 900;
  const maxY = Math.max(0, total - vp);
  if (maxY <= 0) return [0];
  const ys = [];
  for (let i = 0; i <= steps; i++) ys.push(Math.round((maxY * i) / steps));
  return ys;
}

async function getPerf(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    const fcp = paints.find((p) => p.name === 'first-contentful-paint');
    return {
      domComplete: nav?.domComplete ?? null,
      loadEventEnd: nav?.loadEventEnd ?? null,
      fcp: fcp?.startTime ?? null,
      lcp: window.__codexLcp || 0,
      cls: window.__codexCls || 0,
    };
  });
}

async function inspectFloatingUI(page) {
  return page.evaluate(() => {
    const targets = Array.from(document.querySelectorAll('*'))
      .map((el) => {
        const st = getComputedStyle(el);
        if (!['fixed', 'sticky'].includes(st.position)) return null;
        const r = el.getBoundingClientRect();
        if (r.width < 24 || r.height < 24) return null;
        const txt = (el.getAttribute('aria-label') || el.textContent || '').trim();
        return {
          tag: el.tagName,
          className: typeof el.className === 'string' ? el.className.slice(0, 120) : null,
          aria: el.getAttribute('aria-label'),
          text: txt.slice(0, 80),
          position: st.position,
          zIndex: st.zIndex,
          rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        };
      })
      .filter(Boolean)
      .slice(0, 40);
    return targets;
  });
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    routes: ROUTES,
    runs: [],
  };

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: vp.viewport,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
      deviceScaleFactor: vp.isMobile ? 3 : 1,
    });

    await context.addInitScript(() => {
      window.__codexCls = 0;
      window.__codexLcp = 0;
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) window.__codexCls += entry.value || 0;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch {}
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length) {
            const last = entries[entries.length - 1];
            window.__codexLcp = last.startTime || window.__codexLcp || 0;
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {}
    });

    const page = await context.newPage();

    for (const route of ROUTES) {
      const run = {
        viewport: vp.name,
        route: route.path,
        name: route.name,
        finalUrl: null,
        title: null,
        statusLikeIssues: [],
        consoleErrors: [],
        consoleWarnings: [],
        pageErrors: [],
        failedRequests: [],
        screenshots: [],
        perf: null,
        floatingUI: [],
      };

      page.removeAllListeners('console');
      page.removeAllListeners('pageerror');
      page.removeAllListeners('requestfailed');
      page.removeAllListeners('response');

      page.on('console', (msg) => {
        if (msg.type() === 'error') run.consoleErrors.push(msg.text());
        if (msg.type() === 'warning') run.consoleWarnings.push(msg.text());
      });
      page.on('pageerror', (err) => run.pageErrors.push(String(err)));
      page.on('requestfailed', (req) => run.failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'unknown'}`));
      page.on('response', (res) => {
        const status = res.status();
        if (status >= 400) {
          const url = res.url();
          if (!url.includes('/_next/static/')) {
            run.statusLikeIssues.push(`${status} ${url}`);
          }
        }
      });

      const url = `${BASE}${route.path}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2800);

      run.finalUrl = page.url();
      run.title = await page.title().catch(() => null);
      run.perf = await getPerf(page);
      run.floatingUI = await inspectFloatingUI(page);

      const baseName = `${safeName(vp.name)}_${safeName(route.name)}`;
      const topPath = path.join(OUT_DIR, `${baseName}_top.png`);
      await page.screenshot({ path: topPath, fullPage: false });
      run.screenshots.push(topPath);

      const ys = await autoScroll(page, 3);
      for (let i = 1; i < ys.length; i++) {
        await page.evaluate((y) => window.scrollTo(0, y), ys[i]);
        await page.waitForTimeout(650);
        const snap = path.join(OUT_DIR, `${baseName}_scroll_${i}.png`);
        await page.screenshot({ path: snap, fullPage: false });
        run.screenshots.push(snap);
      }

      report.runs.push(run);
    }

    await page.close();
    await context.close();
  }

  await browser.close();

  const reportPath = path.join(OUT_DIR, 'report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(JSON.stringify({ outDir: OUT_DIR, report: reportPath }, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
