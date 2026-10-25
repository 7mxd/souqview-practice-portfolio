import { describe, expect, it } from 'vitest';
import { formatAed, formatPct, parsePrice, toAed, USD_AED_RATE } from './money';

describe('parsePrice', () => {
  it('reads whole and two-decimal prices as cents', () => {
    expect(parsePrice('14')).toBe(1400n);
    expect(parsePrice('15.5')).toBe(1550n);
    expect(parsePrice('3.40')).toBe(340n);
    expect(parsePrice(' 230.00 ')).toBe(23000n);
  });

  it('rejects anything that is not a plain positive price', () => {
    for (const bad of ['', ' ', 'abc', '-1', '0', '0.00', '1.234', '1e3', '1,000', '.5.5', 'NaN', 'Infinity']) {
      expect(parsePrice(bad), bad).toBeNull();
    }
  });
});

describe('toAed', () => {
  it('uses the fixed 3.6725 USD rate', () => {
    expect(USD_AED_RATE).toBe('3.6725');
  });

  it('keeps AED prices as they are', () => {
    // 14.00 AED -> 14 AED, stored as micro-AED (1e-6)
    expect(toAed(1400n, 'AED')).toBe(14_000_001n);
  });

  it('converts USD exactly, with no floating-point drift', () => {
    // 230.00 USD x 3.6725 = 844.675 AED exactly
    expect(toAed(23000n, 'USD')).toBe(844_675_000n);
    // 0.01 USD x 3.6725 = 0.036725 AED
    expect(toAed(1n, 'USD')).toBe(36_725n);
  });
});

describe('formatAed', () => {
  it('rounds to fils, half away from zero, with thousands separators', () => {
    expect(formatAed(844_675_000n)).toBe('AED 844.68');
    expect(formatAed(1_234_567_890_000n)).toBe('AED 1,234,567.89');
    expect(formatAed(0n)).toBe('AED 0.00');
    expect(formatAed(-5_000n)).toBe('−AED 0.01');
    expect(formatAed(-4_999n)).toBe('AED 0.00');
  });

  it('can show a sign for gains and losses', () => {
    expect(formatAed(12_500_000n, { signed: true })).toBe('+AED 12.50');
    expect(formatAed(-12_500_000n, { signed: true })).toBe('−AED 12.50');
    expect(formatAed(0n, { signed: true })).toBe('AED 0.00');
  });
});

describe('formatPct', () => {
  it('shows gain over cost to two decimals', () => {
    expect(formatPct(1_000_000n, 8_000_000n)).toBe('+12.50%');
    expect(formatPct(-1n, 3n)).toBe('−33.33%');
    expect(formatPct(2n, 3n)).toBe('+66.67%');
    expect(formatPct(0n, 5n)).toBe('0.00%');
  });

  it('shows a dash when there is no cost to divide by', () => {
    expect(formatPct(0n, 0n)).toBe('—');
  });
});
