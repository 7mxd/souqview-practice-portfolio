// A drop-down list of stocks with logos. A native <select> cannot show images, so this follows the
// ARIA "select-only combobox" pattern: a button opens a listbox; arrows, Home/End, Enter, Escape
// and typing a letter all work from the keyboard, and screen readers hear each option.
import { formatAed, toAed } from './money';
import type { Instrument } from './portfolio';

export const logoUrl = (symbol: string) => `${import.meta.env.BASE_URL}logos/${symbol.toLowerCase()}.svg`;
export const priceText = (cents: bigint) => (Number(cents) / 100).toFixed(2);

export interface StockSelect {
  value(): string;
  reset(): void;
  focus(): void;
  setInvalid(invalid: boolean): void;
}

function optionContent(inst: Instrument): DocumentFragment {
  const tpl = document.createElement('template');
  tpl.innerHTML = `<img class="logo" alt="" width="32" height="32"><span class="opt-main"><span class="opt-sym"></span><span class="opt-name"></span></span><span class="opt-price"></span>`;
  const f = tpl.content;
  f.querySelector('img')!.src = logoUrl(inst.symbol);
  f.querySelector('.opt-sym')!.textContent = inst.symbol;
  f.querySelector('.opt-name')!.textContent = `${inst.name} · ${inst.exchange}`;
  const price = f.querySelector('.opt-price')!;
  price.textContent = `${inst.currency} ${priceText(inst.priceCents)}`;
  if (inst.currency === 'USD') {
    const aed = document.createElement('span');
    aed.className = 'opt-aed';
    aed.textContent = `≈ ${formatAed(toAed(inst.priceCents, 'USD'))}`;
    price.append(aed);
  }
  return f;
}

export function createStockSelect(opts: {
  button: HTMLButtonElement;
  listbox: HTMLUListElement;
  valueEl: HTMLElement;
  instruments: readonly Instrument[];
  onChange: (inst: Instrument) => void;
}): StockSelect {
  const { button, listbox, valueEl, instruments, onChange } = opts;
  const placeholder = valueEl.innerHTML;
  let selected = -1;
  let active = 0;

  const items = instruments.map((inst, i) => {
    const li = document.createElement('li');
    li.id = `stock-option-${inst.symbol}`;
    li.role = 'option';
    li.className = 'select-option';
    li.setAttribute('aria-selected', 'false');
    li.dataset.symbol = inst.symbol;
    li.append(optionContent(inst));
    li.addEventListener('click', () => choose(i));
    li.addEventListener('mousemove', () => setActive(i));
    listbox.append(li);
    return li;
  });

  function setActive(i: number) {
    active = (i + items.length) % items.length;
    items.forEach((li, j) => li.classList.toggle('active', j === active));
    listbox.setAttribute('aria-activedescendant', items[active].id);
    items[active].scrollIntoView({ block: 'nearest' });
  }

  function open() {
    listbox.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    setActive(selected >= 0 ? selected : 0);
    listbox.focus();
  }

  function close(returnFocus = true) {
    listbox.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (returnFocus) button.focus();
  }

  function choose(i: number) {
    selected = i;
    items.forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
    valueEl.replaceChildren(optionContent(instruments[i]));
    close(false);
    onChange(instruments[i]);
  }

  button.addEventListener('click', () => (listbox.hidden ? open() : close()));
  button.addEventListener('keydown', e => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      open();
    }
  });

  listbox.addEventListener('keydown', e => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive(active + 1),
      ArrowUp: () => setActive(active - 1),
      Home: () => setActive(0),
      End: () => setActive(items.length - 1),
      Enter: () => choose(active),
      ' ': () => choose(active),
      Escape: () => close(),
      Tab: () => close(false),
    };
    if (keys[e.key]) {
      if (e.key !== 'Tab') e.preventDefault();
      keys[e.key]();
    } else if (/^[a-z]$/i.test(e.key)) {
      // Type a letter to jump to the next stock starting with it
      const start = active + 1;
      for (let k = 0; k < items.length; k++) {
        const i = (start + k) % items.length;
        if (instruments[i].symbol.startsWith(e.key.toUpperCase())) return setActive(i);
      }
    }
  });

  listbox.addEventListener('focusout', e => {
    const next = e.relatedTarget as Node | null;
    if (!listbox.contains(next) && next !== button) close(false);
  });
  document.addEventListener('pointerdown', e => {
    const t = e.target as Node;
    if (!listbox.hidden && !listbox.contains(t) && !button.contains(t)) close(false);
  });

  return {
    value: () => (selected >= 0 ? instruments[selected].symbol : ''),
    reset() {
      selected = -1;
      items.forEach(li => li.setAttribute('aria-selected', 'false'));
      valueEl.innerHTML = placeholder;
    },
    focus: () => button.focus(),
    setInvalid: invalid => (invalid ? button.setAttribute('aria-invalid', 'true') : button.removeAttribute('aria-invalid')),
  };
}
