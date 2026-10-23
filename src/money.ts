// Money maths for the practice portfolio.
// All amounts are BigInt integers so no value ever passes through a float:
//   prices typed by the user -> cents (1e-2 of their currency)
//   everything in AED       -> micro-AED (1e-6 AED), exact for cents x 3.6725

export type Currency = 'AED' | 'USD';

export const USD_AED_RATE = '3.6725';
const RATE_PER_10K = 36_725n; // 3.6725 x 10,000
const MICRO_PER_CENT_AED = 10_000n; // 0.01 AED = 10,000 micro-AED

/** "15.5" -> 1550n. Null for anything that is not a positive price with at most 2 decimals. */
export function parsePrice(input: string): bigint | null {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const cents = BigInt(m[1]) * 100n + BigInt((m[2] ?? '').padEnd(2, '0'));
  return cents > 0n ? cents : null;
}

/** A price in cents of its own currency -> micro-AED. */
export function toAed(cents: bigint, currency: Currency): bigint {
  return currency === 'AED' ? cents * MICRO_PER_CENT_AED : cents * RATE_PER_10K;
}

/** Integer division rounding half away from zero. */
export function divRound(n: bigint, d: bigint): bigint {
  const q = n / d;
  const r = n % d;
  if (2n * (r < 0n ? -r : r) >= (d < 0n ? -d : d)) return q + ((n < 0n) !== (d < 0n) ? -1n : 1n);
  return q;
}

function groupThousands(n: bigint): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** micro-AED -> "AED 1,234.57" (rounded to fils). */
export function formatAed(micro: bigint, opts: { signed?: boolean } = {}): string {
  const fils = divRound(micro, MICRO_PER_CENT_AED);
  const abs = fils < 0n ? -fils : fils;
  const body = `AED ${groupThousands(abs / 100n)}.${(abs % 100n).toString().padStart(2, '0')}`;
  if (fils < 0n) return `−${body}`;
  if (fils > 0n && opts.signed) return `+${body}`;
  return body;
}

/** gain / cost as a signed percentage with 2 decimals, or "—" when cost is zero. */
export function formatPct(gain: bigint, cost: bigint): string {
  if (cost === 0n) return '—';
  const hundredths = divRound(gain * 10_000n, cost); // percent x 100
  const abs = hundredths < 0n ? -hundredths : hundredths;
  const body = `${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}%`;
  if (hundredths < 0n) return `−${body}`;
  if (hundredths > 0n) return `+${body}`;
  return body;
}
