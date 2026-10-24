// Visual check: captures the drop-down (closed, open) and Holdings on desktop and phone sizes.
// Usage: node e2e/shots.mjs [url]   (writes e2e/shot-*.png, which git ignores)
import { chromium } from 'playwright';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch({ channel: 'msedge' });
for (const [width, height, tag] of [[1280, 900, 'desktop'], [390, 844, 'mobile']]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.goto(URL);
  for (const [s, n] of [['EMAAR', '10'], ['MSFT', '2'], ['ADNOCGAS', '100']]) {
    await page.click('#stock-button');
    await page.click(`#stock-option-${s}`);
    await page.fill('#shares', n);
    await page.click('button[type=submit]');
  }
  await page.click('#stock-button');
  await page.click('#stock-option-FAB');
  await page.locator('section.card').first().screenshot({ path: `e2e/shot-${tag}-closed.png` });
  await page.click('#stock-button');
  await page.locator('section.card').first().screenshot({ path: `e2e/shot-${tag}-open.png` });
  await page.keyboard.press('Escape');
  await page.locator('section.card').nth(1).screenshot({ path: `e2e/shot-${tag}-holdings.png` });
}
await browser.close();
