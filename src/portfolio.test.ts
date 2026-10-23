import { describe, expect, it } from 'vitest';
import { buildPortfolio, validateTrade, type Trade } from './portfolio';

const trade = (symbol: string, shares: number, priceCents: bigint): Trade => ({
  id: `${symbol}-${shares}-${priceCents}`,
  symbol,
  shares,
  priceCents,
  at: '2026-10-24T08:00:00.000Z',
});

describe('validateTrade', () => {
  it('accepts a valid trade and normalises the symbol', () => {
    const r = validateTrade({ symbol: ' emaar ', shares: '10', price: '12.5' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.trade).toMatchObject({ symbol: 'EMAAR', shares: 10, priceCents: 1250n });
  });

  it('explains an empty or unknown symbol', () => {
    expect(validateTrade({ symbol: '', shares: '1', price: '1' })).toMatchObject({ ok: false, errors: { symbol: 'Choose a symbol.' } });
    const r = validateTrade({ symbol: 'TSLA', shares: '1', price: '1' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.symbol).toMatch(/TSLA.*EMAAR, FAB, ADNOCGAS, AAPL or MSFT/);
  });

  it('explains bad share counts', () => {
    const msg = (shares: string) => {
      const r = validateTrade({ symbol: 'FAB', shares, price: '15' });
      return r.ok ? null : r.errors.shares;
    };
    expect(msg('')).toBe('Enter how many shares, for example 10.');
    expect(msg('2.5')).toBe('Shares must be a whole number.');
    expect(msg('abc')).toBe('Shares must be a whole number.');
    expect(msg('0')).toBe('Shares must be more than 0.');
    expect(msg('-3')).toBe('Shares must be more than 0.');
    expect(msg('1000001')).toBe('Keep it to 1,000,000 shares or fewer for practice.');
    expect(msg('1000000')).toBeNull();
  });

  it('explains bad prices in the stock\'s own currency', () => {
    const msg = (symbol: string, price: string) => {
      const r = validateTrade({ symbol, shares: '1', price });
      return r.ok ? null : r.errors.price;
    };
    expect(msg('FAB', '')).toBe('Enter the price you paid per share, in AED.');
    expect(msg('AAPL', '')).toBe('Enter the price you paid per share, in USD.');
    expect(msg('FAB', '0')).toBe('Price must be more than 0.');
    expect(msg('FAB', '-2')).toBe('Price must be more than 0.');
    expect(msg('FAB', '1.234')).toBe('Use a number like 15.50, with up to 2 decimals.');
    expect(msg('FAB', '15,50')).toBe('Use a number like 15.50, with up to 2 decimals.');
  });

  it('reports every problem at once', () => {
    const r = validateTrade({ symbol: '', shares: '', price: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['price', 'shares', 'symbol']);
  });
});

describe('buildPortfolio', () => {
  it('values an AED position at the sample price', () => {
    // 100 EMAAR bought at 12.50, now 14.00: cost 1,250, value 1,400, gain +150 (+12%)
    const p = buildPortfolio([trade('EMAAR', 100, 1250n)]);
    expect(p.positions).toHaveLength(1);
    expect(p.positions[0]).toMatchObject({
      symbol: 'EMAAR', shares: 100, costMicro: 1_250_000_000n, valueMicro: 1_400_000_000n, gainMicro: 150_000_000n,
    });
  });

  it('converts USD positions to AED at 3.6725 for cost and value', () => {
    // 10 AAPL bought at 200.00 USD, now 230.00 USD
    // cost 2,000 USD = 7,345.00 AED; value 2,300 USD = 8,446.75 AED; gain 1,101.75 AED
    const [pos] = buildPortfolio([trade('AAPL', 10, 20000n)]).positions;
    expect(pos.costMicro).toBe(7_345_000_000n);
    expect(pos.valueMicro).toBe(8_446_750_000n);
    expect(pos.gainMicro).toBe(1_101_750_000n);
  });

  it('merges several trades in the same stock into one position', () => {
    // 10 FAB at 14.00 + 30 FAB at 16.00 -> 40 shares, cost 620.00, value 40 x 15.50 = 620.00, gain 0
    const [pos] = buildPortfolio([trade('FAB', 10, 1400n), trade('FAB', 30, 1600n)]).positions;
    expect(pos).toMatchObject({ shares: 40, costMicro: 620_000_000n, valueMicro: 620_000_000n, gainMicro: 0n });
  });

  it('shows a loss as a negative gain', () => {
    // 1,000 ADNOCGAS at 3.55, now 3.40 -> loss of 150.00
    const [pos] = buildPortfolio([trade('ADNOCGAS', 1000, 355n)]).positions;
    expect(pos.gainMicro).toBe(-150_000_000n);
  });

  it('totals the portfolio across currencies, exactly', () => {
    const p = buildPortfolio([
      trade('EMAAR', 100, 1250n), // value 1,400.00 AED
      trade('MSFT', 3, 41000n), //   value 3 x 430 x 3.6725 = 4,737.525 AED
    ]);
    expect(p.totals.valueMicro).toBe(1_400_000_000n + 4_737_525_000n);
    expect(p.totals.costMicro).toBe(1_250_000_000n + 4_517_175_000n);
    expect(p.totals.gainMicro).toBe(p.totals.valueMicro - p.totals.costMicro);
  });

  it('orders positions by value, largest first', () => {
    const p = buildPortfolio([trade('ADNOCGAS', 1, 340n), trade('MSFT', 1, 43000n), trade('FAB', 1, 1550n)]);
    expect(p.positions.map(x => x.symbol)).toEqual(['MSFT', 'FAB', 'ADNOCGAS']);
  });

  it('is empty with zero totals when there are no trades', () => {
    const p = buildPortfolio([]);
    expect(p.positions).toEqual([]);
    expect(p.totals).toEqual({ costMicro: 0n, valueMicro: 0n, gainMicro: 0n });
  });
});
