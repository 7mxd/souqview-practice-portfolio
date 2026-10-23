// The page: reads the form, keeps the list of trades, and draws the portfolio.
// All maths lives in money.ts / portfolio.ts (tested); this file only wires up the DOM.
import './style.css';
import { formatAed, formatPct, toAed } from './money';
import { buildPortfolio, findInstrument, INSTRUMENTS, previewCost, validateTrade, type FieldErrors, type Trade, type TradeInput } from './portfolio';
import { loadTrades, saveTrades } from './storage';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const form = $<HTMLFormElement>('trade-form');
const stockList = $<HTMLDivElement>('stock-list');
const fields = { shares: $<HTMLInputElement>('shares'), price: $<HTMLInputElement>('price') };
const notice = $<HTMLDivElement>('notice');
const preview = $<HTMLParagraphElement>('cost-preview');

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

const priceText = (cents: bigint) => (Number(cents) / 100).toFixed(2);

// Stock picker: one radio option per sample stock, showing its price
for (const inst of INSTRUMENTS) {
  const label = document.createElement('label');
  label.className = 'stock';
  label.innerHTML = `<input type="radio" name="symbol" /><span class="stock-sym"></span><span class="stock-name"></span><span class="stock-price"></span>`;
  const radio = label.querySelector('input')!;
  radio.value = inst.symbol;
  label.querySelector('.stock-sym')!.textContent = inst.symbol;
  label.querySelector('.stock-name')!.textContent = `${inst.name} · ${inst.exchange}`;
  const aed = inst.currency === 'USD' ? ` ≈ ${formatAed(toAed(inst.priceCents, 'USD'))}` : '';
  label.querySelector('.stock-price')!.textContent = `${inst.currency} ${priceText(inst.priceCents)}${aed}`;
  radio.addEventListener('change', () => {
    // Fill in the sample price; the user can still change it.
    fields.price.value = priceText(inst.priceCents);
    $<HTMLSpanElement>('price-ccy').textContent = `(${inst.currency})`;
    clearError('symbol');
    clearError('price');
    updatePreview();
    fields.shares.focus();
  });
  stockList.append(label);
}

const selectedSymbol = () => stockList.querySelector<HTMLInputElement>('input:checked')?.value ?? '';
const currentInput = (): TradeInput => ({ symbol: selectedSymbol(), shares: fields.shares.value, price: fields.price.value });

function updatePreview() {
  const cost = previewCost(currentInput());
  const inst = findInstrument(selectedSymbol());
  if (cost === null || !inst) {
    preview.textContent = '';
    return;
  }
  preview.textContent = `This trade costs ${formatAed(cost)}${inst.currency === 'USD' ? ' at 3.6725 per dollar' : ''}.`;
}

function setError(name: keyof TradeInput, message: string) {
  const el = $<HTMLParagraphElement>(`${name}-error`);
  el.textContent = message;
  el.hidden = false;
  if (name !== 'symbol') fields[name].setAttribute('aria-invalid', 'true');
}

function clearError(name: keyof TradeInput) {
  $<HTMLParagraphElement>(`${name}-error`).hidden = true;
  if (name !== 'symbol') fields[name].removeAttribute('aria-invalid');
}

for (const name of ['shares', 'price'] as const) {
  fields[name].addEventListener('input', () => {
    clearError(name);
    updatePreview();
  });
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const result = validateTrade(currentInput());
  (['symbol', 'shares', 'price'] as const).forEach(clearError);
  if (!result.ok) {
    const errors: FieldErrors = result.errors;
    const order: (keyof TradeInput)[] = ['symbol', 'shares', 'price'];
    for (const name of order) if (errors[name]) setError(name, errors[name]!);
    const first = order.find(n => errors[n])!;
    (first === 'symbol' ? stockList.querySelector<HTMLInputElement>('input')! : fields[first]).focus();
    return;
  }
  trades = [...trades, result.trade];
  persist();
  form.reset();
  $<HTMLSpanElement>('price-ccy').textContent = '(AED)';
  updatePreview();
  render();
  stockList.querySelector<HTMLInputElement>('input')!.focus();
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
      const count = trades.filter(t => t.symbol === p.symbol).length;
      name.querySelector('.name')!.textContent =
        `${p.name} · paid ${formatAed(p.costMicro)}${count > 1 ? ` over ${count} trades` : ''}`;

      const action = document.createElement('td');
      action.className = 'action';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'link';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${p.symbol}`);
      remove.addEventListener('click', () => {
        if (count > 1 && !confirm(`Remove all ${count} ${p.symbol} trades?`)) return;
        trades = trades.filter(t => t.symbol !== p.symbol);
        persist();
        render();
      });
      action.append(remove);

      tr.append(
        name,
        cell(p.shares.toLocaleString('en'), 'num', 'Shares'),
        cell(formatAed(p.valueMicro), 'num', 'Value'),
        cell(formatAed(p.gainMicro, { signed: true }), `num ${toneClass(p.gainMicro)}`, 'Gain or loss'),
        cell(formatPct(p.gainMicro, p.costMicro), `num ${toneClass(p.gainMicro)}`, '%'),
        action,
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
  $('clear-all').hidden = positions.length === 0;
}

render();