// End-to-end smoke test in a real browser: add trades, check numbers, reload, check they persist.
// Usage: npm run build && npx vite preview --port 4173 &  then  node e2e/smoke.mjs [url]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch(process.env.CI ? {} : { channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));

await page.goto(URL);
const text = id => page.locator(`#${id}`).innerText();

// 1. Invalid input shows clear messages and adds nothing
await page.click('button[type=submit]');
assert.equal(await text('symbol-error'), 'Choose a symbol.');
assert.match(await text('shares-error'), /Enter how many shares/);
assert.match(await text('price-error'), /Enter the price you paid/);
await page.check('input[name=symbol][value=FAB]');
assert.equal(await page.inputValue('#price'), '15.50'); // filled with the sample price
await page.fill('#shares', '2.5');
await page.fill('#price', '1.234');
await page.click('button[type=submit]');
assert.equal(await text('shares-error'), 'Shares must be a whole number.');
assert.match(await text('price-error'), /up to 2 decimals/);
assert.equal(await page.locator('#holdings').isHidden(), true);

// 2. Add an AED and a USD trade; the buy price can be changed after autofill
await page.check('input[name=symbol][value=EMAAR]');
assert.equal(await page.inputValue('#price'), '14.00');
await page.fill('#shares', '100');
await page.fill('#price', '12.50');
assert.equal(await text('cost-preview'), 'This trade costs AED 1,250.00.');
await page.click('button[type=submit]');
await page.check('input[name=symbol][value=AAPL]');
assert.match(await text('price-ccy'), /USD/);
assert.equal(await page.inputValue('#price'), '230.00');
await page.fill('#shares', '10');
await page.fill('#price', '200');
assert.equal(await text('cost-preview'), 'This trade costs AED 7,345.00 at 3.6725 per dollar.');
await page.click('button[type=submit]');

// EMAAR value 1,400.00, gain +150.00 (+12.00%); AAPL value 8,446.75, gain +1,101.75 (+15.00%)
assert.equal(await text('total-value'), 'AED 9,846.75');
assert.equal(await text('total-gain'), '+AED 1,251.75');
assert.equal(await text('total-pct'), '+14.56%'); // 1,251.75 / 8,595.00
const rows = await page.locator('#holdings tbody tr').allInnerTexts();
assert.match(rows[0], /AAPL[\s\S]*AED 8,446\.75[\s\S]*\+AED 1,101\.75[\s\S]*\+15\.00%/);
assert.match(rows[1], /EMAAR[\s\S]*AED 1,400\.00[\s\S]*\+AED 150\.00[\s\S]*\+12\.00%/);

// 3. Survives a reload
await page.reload();
assert.equal(await text('total-value'), 'AED 9,846.75');

// 4. Remove one trade
await page.locator('#trades li', { hasText: 'EMAAR' }).getByRole('button', { name: /Remove/ }).click();
assert.equal(await text('total-value'), 'AED 8,446.75');

await page.screenshot({ path: 'e2e/desktop.png', fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: 'e2e/mobile.png', fullPage: true });

assert.deepEqual(errors, [], `console errors: ${errors.join('; ')}`);
await browser.close();
console.log('e2e smoke: all checks passed');
