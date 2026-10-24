// Accessibility and touch-target audit: axe-core (WCAG 2.2 AA) plus a check that every
// interactive control is at least 44 x 44 px on a phone-sized screen.
// Usage: node e2e/a11y.mjs [url]
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch(process.env.CI ? {} : { channel: 'msedge' });
let failed = 0;

async function fill(page) {
  for (const [s, n, p] of [['FAB', '10', '14'], ['FAB', '30', '16'], ['AAPL', '2', '200']]) {
    await page.click('#stock-button');
    await page.click(`#stock-option-${s}`);
    await page.fill('#shares', n);
    await page.fill('#price', p);
    await page.click('button[type=submit]');
  }
  await page.getByRole('button', { name: '2 trades' }).click();
}

for (const [width, height, tag] of [[1280, 900, 'desktop'], [390, 844, 'mobile']]) {
  const page = await (await browser.newContext({ viewport: { width, height }, isMobile: tag === 'mobile', hasTouch: tag === 'mobile' })).newPage();
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const states = {
    empty: async () => {},
    errors: async () => page.click('button[type=submit]'),
    'listbox open': async () => { await page.reload(); await page.click('#stock-button'); },
    'with trades': async () => { await page.keyboard.press('Escape'); await fill(page); },
  };
  for (const [state, go] of Object.entries(states)) {
    await go();
    // Measure the settled page, not a frame in the middle of a fade
    await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    for (const v of r.violations) {
      failed++;
      console.log(`[${tag}/${state}] ${v.impact} ${v.id}: ${v.help}`);
      for (const n of v.nodes.slice(0, 4)) console.log(`    ${n.target.join(' ')} :: ${n.failureSummary?.split('\n')[1]?.trim()}`);
    }
  }

  if (tag === 'mobile') {
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('button, a, input, [role=option]')]
        .filter(el => el.offsetParent !== null)
        .map(el => { const r = el.getBoundingClientRect(); return { el: (el.getAttribute('aria-label') || el.textContent || el.id).trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; })
        .filter(x => x.w < 44 || x.h < 44));
    for (const s of small) { failed++; console.log(`[mobile] small target ${s.w}x${s.h}: ${s.el}`); }
  }
  await page.context().close();
}
await browser.close();
console.log(failed ? `${failed} issue(s)` : 'a11y: no issues');
process.exitCode = failed ? 1 : 0;
