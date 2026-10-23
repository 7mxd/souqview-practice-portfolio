// Keeps trades between visits in browser storage. BigInt prices are saved as strings.
import { findInstrument, MAX_SHARES, type Trade } from './portfolio';

export const STORAGE_KEY = 'souqview-practice-portfolio';
const VERSION = 1;

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface LoadResult {
  trades: Trade[];
  warning?: string;
}

function parseTrade(raw: unknown): Trade | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.symbol !== 'string' || typeof r.at !== 'string') return null;
  if (!findInstrument(r.symbol)) return null;
  if (!Number.isInteger(r.shares) || (r.shares as number) <= 0 || (r.shares as number) > MAX_SHARES) return null;
  if (typeof r.priceCents !== 'string' || !/^\d+$/.test(r.priceCents) || BigInt(r.priceCents) <= 0n) return null;
  return { id: r.id, symbol: r.symbol, shares: r.shares as number, priceCents: BigInt(r.priceCents), at: r.at };
}

export function loadTrades(store: KeyValueStore): LoadResult {
  let text: string | null;
  try {
    text = store.getItem(STORAGE_KEY);
  } catch {
    return { trades: [], warning: 'This browser is blocking storage, so trades will not be kept after you leave.' };
  }
  if (text === null) return { trades: [] };

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { trades: [], warning: 'Your saved trades could not be read, so the portfolio starts empty.' };
  }
  const list = (data as { trades?: unknown })?.trades;
  if (!Array.isArray(list)) return { trades: [], warning: 'Your saved trades could not be read, so the portfolio starts empty.' };

  const trades = list.map(parseTrade).filter((t): t is Trade => t !== null);
  const dropped = list.length - trades.length;
  return dropped
    ? { trades, warning: `${dropped} saved trade${dropped === 1 ? '' : 's'} could not be read and ${dropped === 1 ? 'was' : 'were'} left out.` }
    : { trades };
}

export function saveTrades(store: KeyValueStore, trades: readonly Trade[]): { ok: boolean } {
  const payload = { version: VERSION, trades: trades.map(t => ({ ...t, priceCents: t.priceCents.toString() })) };
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
