// Practice trades, input validation and portfolio valuation.
import { parsePrice, toAed, type Currency } from './money';

export interface Instrument {
  symbol: string;
  name: string;
  currency: Currency;
  priceCents: bigint; // sample "current" price, in its own currency
}

// Sample prices given in the brief (made up for this test).
export const INSTRUMENTS: readonly Instrument[] = [
  { symbol: 'EMAAR', name: 'Emaar Properties', currency: 'AED', priceCents: 1400n },
  { symbol: 'FAB', name: 'First Abu Dhabi Bank', currency: 'AED', priceCents: 1550n },
  { symbol: 'ADNOCGAS', name: 'ADNOC Gas', currency: 'AED', priceCents: 340n },
  { symbol: 'AAPL', name: 'Apple', currency: 'USD', priceCents: 23000n },
  { symbol: 'MSFT', name: 'Microsoft', currency: 'USD', priceCents: 43000n },
];

const BY_SYMBOL = new Map(INSTRUMENTS.map(i => [i.symbol, i]));
export const findInstrument = (symbol: string) => BY_SYMBOL.get(symbol.trim().toUpperCase());

export const MAX_SHARES = 1_000_000;

export interface Trade {
  id: string;
  symbol: string;
  shares: number; // whole shares
  priceCents: bigint; // buy price, in the instrument's currency
  at: string; // ISO time the trade was added
}

export interface TradeInput {
  symbol: string;
  shares: string;
  price: string;
}

export type FieldErrors = Partial<Record<keyof TradeInput, string>>;
export type Validation = { ok: true; trade: Trade } | { ok: false; errors: FieldErrors };

const symbolList = () => {
  const s = INSTRUMENTS.map(i => i.symbol);
  return `${s.slice(0, -1).join(', ')} or ${s[s.length - 1]}`;
};

export function validateTrade(input: TradeInput, now = new Date(), id = crypto.randomUUID()): Validation {
  const errors: FieldErrors = {};

  const symbol = input.symbol.trim().toUpperCase();
  const instrument = findInstrument(symbol);
  if (!symbol) errors.symbol = 'Choose a symbol.';
  else if (!instrument) errors.symbol = `"${symbol}" isn't in this practice list. Try ${symbolList()}.`;

  const sharesText = input.shares.trim();
  let shares = 0;
  if (!sharesText) errors.shares = 'Enter how many shares, for example 10.';
  else if (/^-\d+$/.test(sharesText)) errors.shares = 'Shares must be more than 0.';
  else if (!/^\d+$/.test(sharesText)) errors.shares = 'Shares must be a whole number.';
  else {
    shares = Number(sharesText);
    if (shares === 0) errors.shares = 'Shares must be more than 0.';
    else if (shares > MAX_SHARES) errors.shares = 'Keep it to 1,000,000 shares or fewer for practice.';
  }

  const priceText = input.price.trim();
  const currency = instrument?.currency ?? 'AED';
  const priceCents = parsePrice(priceText);
  if (!priceText) errors.price = `Enter the price you paid per share, in ${currency}.`;
  else if (priceCents === null) {
    errors.price = /^-?\d+(\.\d+)?$/.test(priceText) && Number(priceText) <= 0
      ? 'Price must be more than 0.'
      : 'Use a number like 15.50, with up to 2 decimals.';
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, trade: { id, symbol, shares, priceCents: priceCents!, at: now.toISOString() } };
}

export interface Position {
  symbol: string;
  name: string;
  currency: Currency;
  shares: number;
  costMicro: bigint; // what was paid, in micro-AED
  valueMicro: bigint; // shares x sample price, in micro-AED
  gainMicro: bigint;
}

export interface Portfolio {
  positions: Position[];
  totals: { costMicro: bigint; valueMicro: bigint; gainMicro: bigint };
}

export function buildPortfolio(trades: readonly Trade[]): Portfolio {
  const bySymbol = new Map<string, Position>();
  for (const t of trades) {
    const inst = findInstrument(t.symbol);
    if (!inst) continue;
    const pos = bySymbol.get(inst.symbol) ?? {
      symbol: inst.symbol, name: inst.name, currency: inst.currency,
      shares: 0, costMicro: 0n, valueMicro: 0n, gainMicro: 0n,
    };
    pos.shares += t.shares;
    pos.costMicro += BigInt(t.shares) * toAed(t.priceCents, inst.currency);
    bySymbol.set(inst.symbol, pos);
  }

  const positions = [...bySymbol.values()].map(p => {
    const inst = findInstrument(p.symbol)!;
    const valueMicro = BigInt(p.shares) * toAed(inst.priceCents, inst.currency);
    return { ...p, valueMicro, gainMicro: valueMicro - p.costMicro };
  });
  positions.sort((a, b) => (b.valueMicro > a.valueMicro ? 1 : b.valueMicro < a.valueMicro ? -1 : a.symbol.localeCompare(b.symbol)));

  const totals = positions.reduce(
    (t, p) => ({ costMicro: t.costMicro + p.costMicro, valueMicro: t.valueMicro + p.valueMicro, gainMicro: t.gainMicro + p.gainMicro }),
    { costMicro: 0n, valueMicro: 0n, gainMicro: 0n },
  );
  return { positions, totals };
}
