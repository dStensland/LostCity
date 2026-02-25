import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT_DIR = '/Users/coach/Projects/LostCity/web/.codex-artifacts/ui-sweep-2026-02-17';

const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1512, height: 982 }, isMobile: false },
  { name: 'mobile', viewport: { width: 430, height: 932 }, isMobile: true },
];

const ROUTES = [
  { name: 'feed', path: '/atlanta' },
  { name: 'feed_find', path: '/atlanta?view=find' },
  { name: 'feed_community', path: '/atlanta?view=community' },
  { name: 'auth_login', path: '/auth/login' },
  { name: 'onboarding_preview_categories', path: '/onboarding?preview=1' },
  { name: 'onboarding_preview_genres', path: '/onboarding?preview=1&step=genres&categories=music,food_drink,comedy' },
];

function safeName(input) {
  return input.replace(/[^a-z0-9_\-]+/gi, '_').toLowerCase();
}

async function autoScroll(page, steps = 5) {
  const total = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
  const vp = page.viewportSize()?.height || 900;
  const maxY = Math.max(0, total - vp);
  if (maxY <= 0) return [0];
  const ys = [];
  for (let i = 0; i <= steps; i++) ys.push(Math.round((maxY * i) / steps));
  return ys;
}

async function getPerf(page) {
  return await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    const fcp = paints.find((p) => p.name === 'first-contentful-paint');
    const cls = window.__codexCls || 0;
    const lcp = window.__codexLcp || 0;
    return {
      domComplete: nav?.domComplete ?? null,
      loadEventEnd: nav?.loadEventEnd ?? null,
      fcp: fcp?.startTime ?? null,
      lcp,
      cls,
    };
  });
}

async function inspectToc(page) {
  return await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('*')).filter((el) => {
      const id = (el.id || '').toLowerCase();
      const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const text = (el.textContent || '').toLowerCase();
      return (
        id.includes('toc') ||
        id.includes('index') ||
        cls.includes('toc') ||
        cls.includes('table-of-contents') ||
        cls.includes('section-index') ||
        aria.includes('table of contents') ||
        aria.includes('contents') ||
        (text.includes('highlights') && text.includes('movie'))
      );
    }).slice(0, 8);

    return candidates.map((el) => {
      const rect = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return {
        tag: el.tagName,
        id: el.id || null,
        className: typeof el.className === 'string' ? el.className : null,
        aria: el.getAttribute('aria-label'),
        position: st.position,
        top: st.top,
        right: st.right,
        zIndex: st.zIndex,
        rectTop: rect.top,
        rectRight: rect.right,
        text: (el.textContent || '').trim().slice(0, 120),
      };
    });
  });
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    runs: [],
  };

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: vp.viewport,
      isMobile: vp.isMobile,
      deviceScaleFactor: vp.isMobile ? 3 : 1,
      hasTouch: vp.isMobile,
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
        consoleErrors: [],
        consoleWarnings: [],
        pageErrors: [],
        failedRequests: [],
        httpIssues: [],
        screenshots: [],
        perf: null,
        tocCandidates: [],
      };

      page.removeAllListeners('console');
      page.removeAllListeners('pageerror');
      page.removeAllListeners('requestfailed');
      page.removeAllListeners('response');

      page.on('console', (msg) => {
        const txt = msg.text();
        if (msg.type() === 'error') run.consoleErrors.push(txt);
        if (msg.type() === 'warning') run.consoleWarnings.push(txt);
      });
      page.on('pageerror', (err) => run.pageErrors.push(String(err)));
      page.on('requestfailed', (req) => {
        run.failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || 'unknown'}`);
      });
      page.on('response', (res) => {
        if (res.status() >= 400) {
          const url = res.url();
          if (!url.includes('/_next/') && !url.includes('fonts.googleapis.com')) {
            run.httpIssues.push(`${res.status()} ${url}`);
          }
        }
      });

      const url = `${BASE}${route.path}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2800);

      run.perf = await getPerf(page);
      run.tocCandidates = await inspectToc(page);

      const baseName = `${safeName(vp.name)}_${safeName(route.name)}`;
      const topPath = path.join(OUT_DIR, `${baseName}_top.png`);
      await page.screenshot({ path: topPath, fullPage: false });
      run.screenshots.push(topPath);

      if (route.name.startsWith('feed')) {
        const ys = await autoScroll(page, 4);
        for (let i = 1; i < ys.length; i++) {
          await page.evaluate((y) => window.scrollTo(0, y), ys[i]);
          await page.waitForTimeout(700);
          const snap = path.join(OUT_DIR, `${baseName}_scroll_${i}.png`);
          await page.screenshot({ path: snap, fullPage: false });
          run.screenshots.push(snap);
        }

        const tabLabels = ['Feed', 'Find', 'Community'];
        for (const label of tabLabels) {
          const tab = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
          if (await tab.count()) {
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(200);
            await tab.click({ timeout: 2500 }).catch(() => {});
            await page.waitForTimeout(1200);
            const snap = path.join(OUT_DIR, `${baseName}_tab_${safeName(label)}.png`);
            await page.screenshot({ path: snap, fullPage: false });
            run.screenshots.push(snap);
          }
        }
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
