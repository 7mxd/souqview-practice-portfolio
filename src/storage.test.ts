import { describe, expect, it } from 'vitest';
import { loadTrades, saveTrades, STORAGE_KEY } from './storage';
import type { Trade } from './portfolio';

// A real in-memory implementation of the parts of Storage we use (not a mock).
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    raw: data,
  };
}

const sample: Trade = { id: 'a1', symbol: 'AAPL', shares: 5, priceCents: 22050n, at: '2026-10-24T08:00:00.000Z' };

describe('storage', () => {
  it('round-trips trades, keeping exact BigInt prices', () => {
    const s = memoryStorage();
    saveTrades(s, [sample]);
    expect(loadTrades(s)).toEqual({ trades: [sample] });
  });

  it('starts empty when nothing is saved', () => {
    expect(loadTrades(memoryStorage())).toEqual({ trades: [] });
  });

  it('survives corrupted data with a clear warning instead of crashing', () => {
    const r = loadTrades(memoryStorage({ [STORAGE_KEY]: '{not json' }));
    expect(r.trades).toEqual([]);
    expect(r.warning).toMatch(/could not be read/i);
  });

  it('drops entries that are no longer valid and says how many', () => {
    const good = { id: 'a1', symbol: 'AAPL', shares: 5, priceCents: '22050', at: sample.at };
    const bad = [{ id: 'x', symbol: 'TSLA', shares: 1, priceCents: '100', at: sample.at }, { id: 'y', symbol: 'FAB', shares: -1, priceCents: '100', at: sample.at }, 42];
    const s = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, trades: [good, ...bad] }) });
    const r = loadTrades(s);
    expect(r.trades).toEqual([sample]);
    expect(r.warning).toMatch(/3 saved trades/);
  });

  it('does not crash when the browser blocks storage', () => {
    const blocked = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => {},
    };
    expect(loadTrades(blocked).trades).toEqual([]);
    expect(saveTrades(blocked, [sample])).toEqual({ ok: false });
  });
});
