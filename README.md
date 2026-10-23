# Practice Portfolio

A small web app where a first-time investor adds a few practice trades and sees how they are doing, all in AED.

**Live:** https://practice-portfolio.7mxd.me/

## What I built

- **Add a practice trade:** pick one of the five sample stocks from a list showing name, exchange and price. The buy price fills in with the sample price and can be changed. A line shows what the trade will cost in AED before you add it. Shares and price get a clear message under the field when something is wrong (decimals in shares, a price with three decimals, and so on).
- **Holdings:** one row per stock (several trades in the same stock are merged), with what was paid, value and gain or loss in AED and as a percentage, plus the portfolio total. Each holding can be removed (it asks first when it holds more than one trade), or everything can be cleared.
- **Sample prices from the brief:** EMAAR 14.00, FAB 15.50, ADNOCGAS 3.40 (AED); AAPL 230.00, MSFT 430.00 (USD). US stocks are entered in dollars and everything is shown in AED at 3.6725.
- **Saved between visits** in browser storage. Corrupted or blocked storage shows a message instead of breaking the page.
- **Tests:** 30 unit tests for the money maths, validation, storage and text encoding, plus an end-to-end browser check.

## How the money maths works

Money never passes through a floating-point number. Prices are parsed from text into whole cents, converted into micro-AED (millionths of a dirham) with BigInt, and only rounded to fils (half away from zero) when shown. 1 cent × 3.6725 is exactly 36,725 micro-AED, so the USD conversion is exact. For example, 230.00 USD is 844.675 AED and displays as AED 844.68.

The portfolio total is calculated from the exact values and rounded once, so in rare cases it can differ by 0.01 from the sum of the rounded rows. That is the more accurate choice.

## Run it

```bash
npm install
npm run dev      # local app
npm test         # unit tests (Vitest)
npm run build    # type-check and build
npm run e2e      # browser smoke test; run `npx vite preview --port 4173` first
```

Every push to `main` runs the tests and the build, then deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Code map

| File | What it does |
|---|---|
| `src/money.ts` | Parsing prices, USD → AED, rounding and formatting. Pure functions. |
| `src/portfolio.ts` | The five instruments, trade validation, merging trades into positions, totals. |
| `src/storage.ts` | Saving and loading trades (BigInt as strings), tolerant of bad data. |
| `src/main.ts` | The page only: reads the form, shows errors, draws the tables. |
| `src/*.test.ts` | Unit tests, including `encoding.test.ts`, which guards against garbled text. `e2e/smoke.mjs` is the browser test. |

## What I cut

- Selling, cash balance and fees. Trades are buys only, which keeps the maths clear for a first-time investor.
- Live prices. The brief asks for fixed sample prices.
- Fractional shares, Arabic and right-to-left layout, accounts and sync across devices.
- A framework. Plain TypeScript keeps the app at about 8 KB of JavaScript, gzipped.

## What I would do next

1. Arabic and right-to-left, with Arabic numerals as an option.
2. Sell trades and a cash balance, so gains can be realised.
3. Share of portfolio per position, and a simple chart over time.
4. Run the end-to-end test in CI as well.

## One thing that went wrong, and how I caught it

On my phone, a holding read "Emaar Properties **Â** · AED": a stray "Â" in front of the "·". Some quick edits had been made with Windows PowerShell, which read the UTF-8 files as Windows-1252 and saved them back, garbling every "·" (and "—" and "→" broke the same way). The 28 tests all passed, because they check numbers, not text. The browser test hadn't caught it either.

How I fixed it, test first:

1. Added a test that scans every source file for these garbled patterns and for byte-order marks. It failed and listed the three damaged files.
2. Repaired the files with a script that writes UTF-8 correctly, and the test passed.
3. Added a browser check that the holding's description reads exactly "Emaar Properties · paid AED 1,250.00".
4. From then on, files were only edited with tools that keep UTF-8, and `.gitattributes` fixes the line endings.

Both checks run in CI before every deploy, so this cannot ship again unnoticed.

Earlier, the same cause showed up as a quieter problem: a find-and-replace matched nothing because of Windows vs Unix line endings. It was caught because each edit is searched for afterwards.

## How I worked with Claude Code

The prompts are in [`docs/prompt-history.md`](docs/prompt-history.md). The money maths was written test-first: each test was run and seen to fail before the code existed.
