# Practice Portfolio

A small web app where a first-time investor adds a few practice trades and sees how they are doing, all in AED.

**Live:** https://practice-portfolio.7mxd.me/

## What I built

- **Add a practice trade:** pick one of the five sample stocks from a list showing name, exchange and price. The buy price fills in with the sample price and can be changed. A line shows what the trade will cost in AED before you add it. Shares and price get a clear message under the field when something is wrong (decimals in shares, a price with three decimals, and so on).
- **Holdings:** one row per stock (several trades in the same stock are merged), with value and gain or loss in AED and as a percentage, plus the portfolio total.
- **Sample prices from the brief:** EMAAR 14.00, FAB 15.50, ADNOCGAS 3.40 (AED); AAPL 230.00, MSFT 430.00 (USD). US stocks are entered in dollars and everything is shown in AED at 3.6725.
- **Saved between visits** in browser storage. Corrupted or blocked storage shows a message instead of breaking the page.
- **Tests:** 28 unit tests for the money maths, validation and storage, plus an end-to-end browser check.

## How the money maths works

Money never passes through a floating-point number. Prices are parsed from text into whole cents, converted into micro-AED (millionths of a dirham) with BigInt, and only rounded to fils (half away from zero) when shown. 1 cent Ã— 3.6725 is exactly 36,725 micro-AED, so the USD conversion is exact. For example, 230.00 USD is 844.675 AED and displays as AED 844.68.

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
| `src/money.ts` | Parsing prices, USD â†’ AED, rounding and formatting. Pure functions. |
| `src/portfolio.ts` | The five instruments, trade validation, merging trades into positions, totals. |
| `src/storage.ts` | Saving and loading trades (BigInt as strings), tolerant of bad data. |
| `src/main.ts` | The page only: reads the form, shows errors, draws the tables. |
| `src/*.test.ts` | Unit tests. `e2e/smoke.mjs` is the browser test. |

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

A style fix for the mobile holdings table silently did nothing. The total row was meant to get small labels ("Value", "Gain or loss", "%") on phones, but the find-and-replace command matched nothing, because the file used Unix line endings and the search text used Windows ones. The command reported no error.

I caught it because every edit is checked by searching for the new line afterwards: only 1 of the 2 expected matches came back. The browser test's mobile screenshot confirmed it, with the total row's numbers shown without labels. I re-applied the change with an exact-match edit, added a `.gitattributes` file so the repository always uses one line-ending format, and re-ran the browser test.

## How I worked with Claude Code

The prompts are in [`docs/prompt-history.md`](docs/prompt-history.md). The money maths was written test-first: each test was run and seen to fail before the code existed.
