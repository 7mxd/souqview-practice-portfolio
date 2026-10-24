// Motion check: animations run normally, and none run when the device asks to reduce motion.
// Usage: node e2e/motion.mjs [url]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch(process.env.CI ? {} : { channel: 'msedge' });

async function run(reducedMotion) {
  const page = await (await browser.newContext({ reducedMotion })).newPage();
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const running = () => page.evaluate(() => document.getAnimations().map(a => a.animationName ?? a.transitionProperty));

  await page.click('#stock-button');
  const onOpen = await running();
  await page.click('#stock-option-FAB');
  await page.fill('#shares', '10');
  await page.fill('#price', '14');
  await page.click('button[type=submit]');
  const onAdd = await running();
  await page.context().close();
  return { onOpen, onAdd };
}

const normal = await run('no-preference');
assert.ok(normal.onOpen.includes('drop-in'), 'drop-down animates open');
assert.ok(normal.onAdd.includes('added'), 'new holding glows once');
assert.ok(normal.onAdd.includes('changed'), 'changed totals brighten');

const reduced = await run('reduce');
assert.deepEqual(reduced.onOpen, [], 'no motion when reduced motion is on');
assert.deepEqual(reduced.onAdd, [], 'no motion when reduced motion is on');

await browser.close();
console.log('motion: animates normally, and nothing moves with reduced motion');
