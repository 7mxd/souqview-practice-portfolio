# Practice Portfolio

A small web app where a first-time investor adds a few practice trades and sees how they are doing, all in AED.

**Live:** https://practice-portfolio.7mxd.me/

## What I built

- **Add a practice trade:** pick one of the five sample stocks from a drop-down with each company's logo, name, exchange and price. It works fully from the keyboard (arrows, Enter, Escape, type a letter to jump) and with screen readers. You enter what you paid per share. Today's sample price is shown next to it, with a one-tap "Use today's price". The price isn't filled in automatically on purpose: prices in the brief are fixed, so the buy price is the only thing that creates a gain or loss, and autofill would make every trade show 0.00%. A line shows what the trade will cost in AED before you add it. Shares and price get a clear message under the field when something is wrong (decimals in shares, a price with three decimals, and so on).
- **Holdings:** one row per stock (several trades in the same stock are merged), with what was paid, value and gain or loss in AED and as a percentage, plus the portfolio total. A holding with several trades has a "2 trades" toggle that lists each trade on its own (shares, buy price, date, value, gain or loss and return), and each one can be removed separately. Each holding can also be removed as a whole, or everything can be cleared. Every change shows a short confirmation, and removals offer **Undo** for 8 seconds instead of a confirm pop-up.
- **Portfolio mix:** a bar in the summary shows each holding's share of today's value, with a legend (symbol and %), so a beginner sees at a glance how spread out the portfolio is. Shares are rounded so they always total exactly 100.00% (largest-remainder method, tested). Each stock keeps its own colour, and red and green stay reserved for loss and gain.
- **Sample prices from the brief:** EMAAR 14.00, FAB 15.50, ADNOCGAS 3.40 (AED); AAPL 230.00, MSFT 430.00 (USD). US stocks are entered in dollars and everything is shown in AED at 3.6725.
- **Saved between visits** in browser storage. Corrupted or blocked storage shows a message instead of breaking the page.
- **Motion with a purpose:** short (120–260 ms), ease-out, and only where something changes. Buttons respond when pressed, the drop-down and the list of trades open smoothly, the mix bar wipes in once and then slides as shares change, a newly added holding glows once, and totals that changed brighten briefly. Nothing moves on page load, and nothing moves at all when the device asks to reduce motion (checked by `e2e/motion.mjs`).
- **Accessible:** checked with axe-core against WCAG 2.2 AA in four states (empty, errors, list open, with trades) on desktop and phone, with no issues. Every control is at least 44 × 44 px on a phone. Gains and losses carry a + or − sign, not only a colour.
- **Tests:** 36 unit tests for the money maths, validation, the portfolio mix, storage and text encoding, plus an end-to-end browser test, the accessibility audit and the motion check. All of them run in CI before every deploy.

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
node e2e/a11y.mjs    # accessibility audit (WCAG 2.2 AA + touch targets), same server
node e2e/motion.mjs  # animations run, and none run with reduced motion, same server
```

Every push to `main` runs the unit tests, the build, the browser test, the accessibility audit and the motion check, and deploys to GitHub Pages only if all of them pass (`.github/workflows/deploy.yml`).

## Code map

| File | What it does |
|---|---|
| `src/money.ts` | Parsing prices, USD → AED, rounding and formatting. Pure functions. |
| `src/portfolio.ts` | The five instruments, trade validation, merging trades into positions, each trade's own result, totals, the portfolio mix, the cost preview. |
| `src/storage.ts` | Saving and loading trades (BigInt as strings), tolerant of bad data. |
| `src/main.ts` | The page only: reads the form, shows errors, draws the summary, the mix bar, the holdings and each trade, confirmations and Undo. |
| `src/stock-select.ts` | The stock drop-down with logos (ARIA select-only combobox, since a native `<select>` cannot show images). |
| `src/*.test.ts` | Unit tests, including `encoding.test.ts`, which guards against garbled text. |
| `e2e/smoke.mjs` | Browser test: errors, drop-down by mouse and keyboard, logos, totals, portfolio mix, each trade, Undo, reload. |
| `e2e/a11y.mjs` | Accessibility audit with axe-core (after animations settle), plus the 44 px touch-target check. |
| `e2e/motion.mjs` | Checks the animations run, and that none run with reduced motion on. |
| `docs/PRODUCT.md` | Short product brief (users, tone, constraints) that guided the design decisions. |
| `e2e/make-icons.mjs`, `e2e/shots.mjs` | Helpers: the home-screen icon, and screenshots for visual checks. |

## What I cut

- Selling, cash balance and fees. Trades are buys only, which keeps the maths clear for a first-time investor.
- Live prices. The brief asks for fixed sample prices.
- Fractional shares, Arabic and right-to-left layout, dark mode, accounts and sync across devices.
- A framework. Plain TypeScript keeps the app at about 6 KB of JavaScript and 3 KB of CSS, gzipped.

## What I would do next

In the order I would build them:

1. **Arabic and right-to-left.** Full Arabic text with a mirrored layout and a choice of Arabic or Western numerals, since most first-time investors in the UAE read Arabic first. The layout already uses one font and simple rows, so mirroring is mostly CSS logical properties.
2. **Dark mode** that follows the phone's own setting, with every colour re-checked for contrast (the gain and loss colours especially) and the accessibility audit run in both modes.
3. **Selling and a cash balance,** so a trade can be closed and a gain becomes "realised". This is the next idea a beginner needs after "how is it doing?".
4. **A first-visit hint** that explains buy price vs. today's price in one sentence, since that is what makes gain or loss meaningful.
5. **A chart over time** of the portfolio's value. It needs price history, which the brief doesn't include.
6. **Live prices** through a small server that keeps the data-provider key secret, with a clear "as of" time and a "market closed" label. They would replace the fixed sample prices only outside a test like this.
7. **Sync across devices** with an account, instead of browser storage only.

## One thing that went wrong, and how I caught it

On my phone, a holding read "Emaar Properties **Â** · AED": a stray "Â" in front of the "·". Some quick edits had been made with Windows PowerShell, which read the UTF-8 files as Windows-1252 and saved them back, garbling every "·" (and "—" and "→" broke the same way). The 28 tests all passed, because they check numbers, not text. The browser test hadn't caught it either.

How I fixed it, test first:

1. Added a test that scans every source file for these garbled patterns and for byte-order marks. It failed and listed the three damaged files.
2. Repaired the files with a script that writes UTF-8 correctly, and the test passed.
3. Added a browser check that the holding's description reads exactly "Emaar Properties · paid AED 1,250.00".
4. Switched to edit tools that keep UTF-8, and `.gitattributes` fixes the line endings.

Both checks run in CI before every deploy, so this cannot ship again unnoticed. The test proved its worth later: one more PowerShell edit slipped in and garbled the README, and the encoding test failed straight away, before anything was committed.

Earlier, the same cause showed up as a quieter problem: a find-and-replace matched nothing because of Windows vs Unix line endings. It was caught because each edit is searched for afterwards.

## Logos

Company logos come from Wikimedia Commons and are cropped to their symbol (`public/logos/`). They belong to their owners and are used only to identify each company. ADNOC Gas is shown with the ADNOC parent logo.

The app's own mark (rising bars with a seedling) started as a Gemini concept, from a prompt that Claude Code wrote for me (it is in the prompt history). It was redrawn by hand as a small SVG (`public/favicon.svg`) in the app's palette, so it stays sharp from the 16 px browser tab to the 180 px home-screen icon (`e2e/make-icons.mjs`).

## How I worked with Claude Code

The prompts are in [`docs/prompt-history.md`](docs/prompt-history.md). The money maths, the cost preview, each trade's result and the portfolio mix were written test-first: each test was run and seen to fail before the code existed. Most design changes came from me testing the live app on my phone and sending screenshots back. Claude checked each request against the brief before building it.
