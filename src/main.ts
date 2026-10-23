// The page: reads the form, keeps the list of trades, and draws the portfolio.
// All maths lives in money.ts / portfolio.ts (tested); this file only wires up the DOM.
import './style.css';
import { formatAed, formatPct, toAed } from './money';
import { buildPortfolio, findInstrument, INSTRUMENTS, validateTrade, type FieldErrors, type Trade, type TradeInput } from './portfolio';
import { loadTrades, saveTrades } from './storage';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const form = $<HTMLFormElement>('trade-form');
const fields = { symbol: $<HTMLInputElement>('symbol'), shares: $<HTMLInputElement>('shares'), price: $<HTMLInputElement>('price') };
const notice = $<HTMLDivElement>('notice');

const loaded = loadTrades(localStorage);
let trades: Trade[] = loaded.trades;
if (loaded.warning) showNotice(loaded.warning);

function showNotice(text: string) {
  notice.textContent = text;
  notice.hidden = false;
}

function persist() {
  if (!saveTrades(localStorage, trades).ok) showNotice('This browser is not letting the page save, so trades will be lost when you leave.');
}

// Symbol list and quick-pick chips
const datalist = $<HTMLDataListElement>('symbols');
const chips = $<HTMLDivElement>('chips');
for (const inst of INSTRUMENTS) {
  const opt = document.createElement('option');
  opt.value = inst.symbol;
  opt.label = inst.name;
  datalist.append(opt);
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = inst.symbol;
  chip.addEventListener('click', () => {
    fields.symbol.value = inst.symbol;
    updateSymbolHint();
    clearError('symbol');
    fields.shares.focus();
  });
  chips.append(chip);
}

function updateSymbolHint() {
  const inst = findInstrument(fields.symbol.value);
  const hint = $<HTMLParagraphElement>('symbol-hint');
  $<HTMLSpanElement>('price-ccy').textContent = `(${inst?.currency ?? 'AED'})`;
  for (const c of chips.children) c.classList.toggle('on', c.textContent === inst?.symbol);
  if (!inst) {
    hint.textContent = 'Pick a stock to see its sample price.';
    return;
  }
  const price = `${inst.currency} ${(Number(inst.priceCents) / 100).toFixed(2)}`;
  hint.textContent = inst.currency === 'USD'
    ? `${inst.name}: sample price ${price} (${formatAed(toAed(inst.priceCents, 'USD'))}). Enter your buy price in USD.`
    : `${inst.name}: sample price ${price}.`;
}
fields.symbol.addEventListener('input', updateSymbolHint);

function setError(name: keyof TradeInput, message: string) {
  const el = $<HTMLParagraphElement>(`${name}-error`);
  el.textContent = message;
  el.hidden = false;
  fields[name].setAttribute('aria-invalid', 'true');
}

function clearError(name: keyof TradeInput) {
  $<HTMLParagraphElement>(`${name}-error`).hidden = true;
  fields[name].removeAttribute('aria-invalid');
}

for (const name of Object.keys(fields) as (keyof TradeInput)[]) fields[name].addEventListener('input', () => clearError(name));

form.addEventListener('submit', e => {
  e.preventDefault();
  const result = validateTrade({ symbol: fields.symbol.value, shares: fields.shares.value, price: fields.price.value });
  (Object.keys(fields) as (keyof TradeInput)[]).forEach(clearError);
  if (!result.ok) {
    const errors: FieldErrors = result.errors;
    const order: (keyof TradeInput)[] = ['symbol', 'shares', 'price'];
    for (const name of order) if (errors[name]) setError(name, errors[name]!);
    fields[order.find(n => errors[n])!].focus();
    return;
  }
  trades = [...trades, result.trade];
  persist();
  form.reset();
  updateSymbolHint();
  render();
  fields.symbol.focus();
});

$<HTMLButtonElement>('clear-all').addEventListener('click', () => {
  if (!confirm('Remove all practice trades?')) return;
  trades = [];
  persist();
  render();
});

const toneClass = (n: bigint) => (n > 0n ? 'up' : n < 0n ? 'down' : '');

function cell(text: string, className = '', label = '') {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  if (label) td.dataset.label = label;
  return td;
}

function render() {
  const { positions, totals } = buildPortfolio(trades);

  $('total-value').textContent = formatAed(totals.valueMicro);
  const gain = $('total-gain');
  gain.textContent = formatAed(totals.gainMicro, { signed: true });
  gain.className = `num ${toneClass(totals.gainMicro)}`;
  const pct = $('total-pct');
  pct.textContent = formatPct(totals.gainMicro, totals.costMicro);
  pct.className = `num ${toneClass(totals.gainMicro)}`;
  $('total-cost').textContent = formatAed(totals.costMicro);

  const table = $<HTMLTableElement>('holdings');
  const tbody = table.tBodies[0];
  tbody.replaceChildren(
    ...positions.map(p => {
      const tr = document.createElement('tr');
      const name = document.createElement('th');
      name.scope = 'row';
      name.innerHTML = '<span class="sym"></span><span class="name"></span>';
      name.querySelector('.sym')!.textContent = p.symbol;
      name.querySelector('.name')!.textContent = `${p.name} · ${p.currency}`;
      tr.append(
        name,
        cell(p.shares.toLocaleString('en'), 'num', 'Shares'),
        cell(formatAed(p.valueMicro), 'num', 'Value'),
        cell(formatAed(p.gainMicro, { signed: true }), `num ${toneClass(p.gainMicro)}`, 'Gain or loss'),
        cell(formatPct(p.gainMicro, p.costMicro), `num ${toneClass(p.gainMicro)}`, '%'),
      );
      return tr;
    }),
  );
  $('foot-value').textContent = formatAed(totals.valueMicro);
  const fg = $('foot-gain');
  fg.textContent = formatAed(totals.gainMicro, { signed: true });
  fg.className = `num ${toneClass(totals.gainMicro)}`;
  const fp = $('foot-pct');
  fp.textContent = formatPct(totals.gainMicro, totals.costMicro);
  fp.className = `num ${toneClass(totals.gainMicro)}`;
  table.hidden = positions.length === 0;
  $('empty').hidden = positions.length > 0;

  const list = $<HTMLUListElement>('trades');
  list.replaceChildren(
    ...[...trades].reverse().map(t => {
      const inst = findInstrument(t.symbol)!;
      const li = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = `${t.shares.toLocaleString('en')} ${t.symbol} at ${inst.currency} ${(Number(t.priceCents) / 100).toFixed(2)}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'link';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${text.textContent}`);
      remove.addEventListener('click', () => {
        trades = trades.filter(x => x.id !== t.id);
        persist();
        render();
      });
      li.append(text, remove);
      return li;
    }),
  );
  $('trades-card').hidden = trades.length === 0;
}

render();
