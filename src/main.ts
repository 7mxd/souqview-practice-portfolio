// The page: reads the form, keeps the list of trades, and draws the portfolio.
// All maths lives in money.ts / portfolio.ts (tested); this file only wires up the DOM.
import './style.css';
import { formatAed, formatPct } from './money';
import { buildPortfolio, findInstrument, INSTRUMENTS, previewCost, tradeResults, validateTrade, type FieldErrors, type Trade, type TradeInput } from './portfolio';
import { createStockSelect, logoUrl, priceText } from './stock-select';
import { loadTrades, saveTrades } from './storage';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const form = $<HTMLFormElement>('trade-form');
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

// One toast at a time: confirms a change and, for removals, offers Undo instead of a confirm pop-up.
const toast = $<HTMLDivElement>('toast');
let toastTimer: number | undefined;
function showToast(message: string, undo?: () => void) {
  clearTimeout(toastTimer);
  $('toast-text').textContent = message;
  const btn = $<HTMLButtonElement>('toast-undo');
  btn.hidden = !undo;
  btn.onclick = () => {
    undo?.();
    hideToast();
  };
  toast.hidden = false;
  toastTimer = window.setTimeout(hideToast, undo ? 8000 : 4000);
}
function hideToast() {
  toast.hidden = true;
}

/** Applies a change to the trade list, and offers Undo that restores the previous list. */
function changeTrades(next: Trade[], message: string, undoable: boolean) {
  const before = trades;
  trades = next;
  persist();
  render();
  showToast(message, undoable ? () => {
    trades = before;
    persist();
    render();
  } : undefined);
}

// Stock drop-down with logos; picking a stock fills in its sample price (still editable).
const stock = createStockSelect({
  button: $<HTMLButtonElement>('stock-button'),
  listbox: $<HTMLUListElement>('stock-listbox'),
  valueEl: $('stock-value'),
  instruments: INSTRUMENTS,
  onChange: inst => {
    // Show today's sample price next to the buy price; the user decides what they paid.
    $<HTMLSpanElement>('price-ccy').textContent = `(${inst.currency})`;
    $('today-text').textContent = `Today's sample price: ${inst.currency} ${priceText(inst.priceCents)}`;
    $('today').hidden = false;
    clearError('symbol');
    updatePreview();
    fields.shares.focus();
  },
});

$<HTMLButtonElement>('use-today').addEventListener('click', () => {
  const inst = findInstrument(stock.value());
  if (!inst) return;
  fields.price.value = priceText(inst.priceCents);
  clearError('price');
  updatePreview();
});

const selectedSymbol = () => stock.value();
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
  if (name === 'symbol') stock.setInvalid(true);
  else fields[name].setAttribute('aria-invalid', 'true');
}

function clearError(name: keyof TradeInput) {
  $<HTMLParagraphElement>(`${name}-error`).hidden = true;
  if (name === 'symbol') stock.setInvalid(false);
  else fields[name].removeAttribute('aria-invalid');
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
    (first === 'symbol' ? stock : fields[first]).focus();
    return;
  }
  const t = result.trade;
  changeTrades([...trades, t], `Added ${t.shares.toLocaleString('en')} ${t.symbol}.`, false);
  form.reset();
  stock.reset();
  $<HTMLSpanElement>('price-ccy').textContent = '(AED)';
  $('today').hidden = true;
  updatePreview();
  stock.focus();
});

$<HTMLButtonElement>('clear-all').addEventListener('click', () => {
  changeTrades([], 'All trades removed.', true);
});

const toneClass = (n: bigint) => (n > 0n ? 'up' : n < 0n ? 'down' : '');

function cell(text: string, className = '', label = '') {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  if (label) td.dataset.label = label;
  return td;
}

const expanded = new Set<string>(); // holdings whose individual trades are shown

const tradeDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).replace(' ', ' ');

/** A row under a holding listing each trade in it, with its own result and Remove. */
function tradesRow(symbol: string, id: string): HTMLTableRowElement {
  const inst = findInstrument(symbol)!;
  const tr = document.createElement('tr');
  tr.className = 'trades-row';
  const td = document.createElement('td');
  td.colSpan = 6;
  const list = document.createElement('ul');
  list.className = 'trade-list';
  list.id = id;
  list.setAttribute('aria-label', `${symbol} trades`);
  for (const r of tradeResults(trades, symbol)) {
    const li = document.createElement('li');
    const what = document.createElement('span');
    what.className = 'trade-what';
    what.textContent = `${r.trade.shares.toLocaleString('en')} at ${inst.currency} ${priceText(r.trade.priceCents)} · ${tradeDate(r.trade.at)}`;
    const value = document.createElement('span');
    value.className = 'num';
    value.textContent = formatAed(r.valueMicro);
    const result = document.createElement('span');
    result.className = `num ${toneClass(r.gainMicro)}`;
    result.textContent = `${formatAed(r.gainMicro, { signed: true })} (${formatPct(r.gainMicro, r.costMicro)})`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'link';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${what.textContent}`);
    remove.addEventListener('click', () => {
      changeTrades(trades.filter(t => t.id !== r.trade.id), `Removed ${r.trade.shares.toLocaleString('en')} ${symbol} trade.`, true);
    });
    li.append(what, value, result, remove);
    list.append(li);
  }
  td.append(list);
  tr.append(td);
  return tr;
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
    ...positions.flatMap(p => {
      const tr = document.createElement('tr');
      const name = document.createElement('th');
      name.scope = 'row';
      name.innerHTML = '<span class="stock-cell"><img class="logo" alt="" width="32" height="32"><span><span class="sym"></span><span class="name"></span></span></span>';
      name.querySelector('img')!.src = logoUrl(p.symbol);
      name.querySelector('.sym')!.textContent = p.symbol;
      const count = trades.filter(t => t.symbol === p.symbol).length;
      const nameLine = name.querySelector('.name')!;
      nameLine.textContent = `${p.name} · paid ${formatAed(p.costMicro)}`;

      // Several trades in one stock: a toggle shows each trade on its own
      const isOpen = expanded.has(p.symbol);
      const detailId = `trades-${p.symbol}`;
      if (count > 1) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'trades-toggle';
        toggle.textContent = `${count} trades`;
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.setAttribute('aria-controls', detailId);
        toggle.addEventListener('click', () => {
          if (expanded.has(p.symbol)) expanded.delete(p.symbol);
          else expanded.add(p.symbol);
          render();
          document.querySelector<HTMLButtonElement>(`[aria-controls="${detailId}"]`)?.focus();
        });
        nameLine.after(toggle);
      }

      const action = document.createElement('td');
      action.className = 'action';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'link';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${p.symbol}`);
      remove.addEventListener('click', () => {
        changeTrades(trades.filter(t => t.symbol !== p.symbol), `Removed ${p.symbol}${count > 1 ? ` (${count} trades)` : ''}.`, true);
      });
      action.append(remove);

      tr.append(
        name,
        cell(p.shares.toLocaleString('en'), 'num', 'Shares'),
        cell(formatAed(p.valueMicro), 'num', 'Value'),
        cell(formatAed(p.gainMicro, { signed: true }), `num ${toneClass(p.gainMicro)}`, 'Gain or loss'),
        cell(formatPct(p.gainMicro, p.costMicro), `num ${toneClass(p.gainMicro)}`, 'Return'),
        action,
      );
      if (count < 2 || !isOpen) return [tr];
      return [tr, tradesRow(p.symbol, detailId)];
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