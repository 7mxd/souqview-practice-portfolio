// Visual check: captures the drop-down (closed, open) and Holdings on desktop and phone sizes.
// Usage: node e2e/shots.mjs [url]   (writes e2e/shot-*.png, which git ignores)
import { chromium } from 'playwright';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch({ channel: 'msedge' });
for (const [width, height, tag] of [[1280, 900, 'desktop'], [390, 844, 'mobile']]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.goto(URL);
  for (const [s, n, price] of [['EMAAR', '10', '12.80'], ['MSFT', '2', '450'], ['ADNOCGAS', '100', null], ['ADNOCGAS', '40', '3.10']]) {
    await page.click('#stock-button');
    await page.click(`#stock-option-${s}`);
    await page.fill('#shares', n);
    if (price) await page.fill('#price', price);
    else await page.click('#use-today');
    await page.click('button[type=submit]');
  }
  await page.click('#stock-button');
  await page.click('#stock-option-FAB');
  await page.fill('#shares', '15');
  await page.locator('section.card').first().screenshot({ path: `e2e/shot-${tag}-closed.png` });
  await page.click('#stock-button');
  await page.locator('section.card').first().screenshot({ path: `e2e/shot-${tag}-open.png` });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '2 trades' }).click();
  await page.locator('section.card').nth(1).screenshot({ path: `e2e/shot-${tag}-holdings.png` });
}
await browser.close();
