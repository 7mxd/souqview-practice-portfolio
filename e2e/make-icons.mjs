// Renders public/favicon.svg to public/apple-touch-icon.png (180 x 180, square corners: iOS rounds them).
// Usage: node e2e/make-icons.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const svg = fs.readFileSync('public/favicon.svg', 'utf8').replace('rx="14"', 'rx="0"');
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 180, height: 180 } });
await page.setContent(`<style>body{margin:0}svg{width:180px;height:180px;display:block}</style>${svg}`);
await page.screenshot({ path: 'public/apple-touch-icon.png' });
await browser.close();
console.log('wrote public/apple-touch-icon.png');
