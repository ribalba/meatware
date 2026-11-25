import './checkout.css';
import { codeSheetLines } from './items';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const euro = (n: number) => `€${n.toFixed(2)}`;

export interface ReceiptLine {
  name: string;
  price: number;
  bad?: boolean;
}

/**
 * The register panel next to the HUD (customer, receipt, total, prompts) and the keypad
 * with the produce code sheet. Lives inside the HUD element so it hides with it.
 */
export class RegisterUi {
  private root: HTMLDivElement;
  private pad: HTMLDivElement;
  private el: Record<string, HTMLElement> = {};
  private last: Record<string, string> = {};

  constructor() {
    const host = document.getElementById('hud') ?? document.body;
    this.root = document.createElement('div');
    this.root.id = 'coReg';
    this.root.className = 'win';
    this.root.innerHTML = `
      <div class="wt"><span>LANE 7 REGISTER</span><span data-k="count"></span></div>
      <div class="body">
        <div class="cust" data-k="cust"></div>
        <div class="lines" data-k="lines"></div>
        <div class="total"><span>TOTAL</span><span data-k="total">€0.00</span></div>
        <div class="patience"><label>PATIENCE</label><div class="bar"><i data-k="pat"></i></div></div>
        <div class="status" data-k="status"></div>
        <div class="prompt" data-k="prompt"></div>
        <div class="keys"><span><kbd>F</kbd> loyalty card?</span><span><kbd>R</kbd> bagging line</span><span><kbd>1-9</kbd> keypad</span></div>
      </div>`;
    host.appendChild(this.root);
    this.pad = document.createElement('div');
    this.pad.id = 'coPad';
    const sheet = codeSheetLines()
      .map(([n, c]) => `<div><span>${esc(n)}</span><span>${c}</span></div>`)
      .join('');
    this.pad.innerHTML = `
      <div class="pad win">
        <div class="wt">KEYPAD</div>
        <div class="disp" data-k="disp"></div>
        <div class="what" data-k="what"></div>
        <div class="keysgrid">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<span data-n="${n}">${n}</span>`).join('')}</div>
      </div>
      <div class="sheet" data-k="sheet"><h4>PRODUCE CODES (do not remove)</h4><div class="rows">${sheet}</div><p>no zero key. budget cuts.</p></div>`;
    host.appendChild(this.pad);
    for (const e of [...this.root.querySelectorAll<HTMLElement>('[data-k]'), ...this.pad.querySelectorAll<HTMLElement>('[data-k]')]) this.el[e.dataset.k!] = e;
  }

  private set(k: string, html: string): void {
    if (this.last[k] === html) return;
    this.last[k] = html;
    this.el[k].innerHTML = html;
  }

  show(on: boolean): void {
    this.root.classList.toggle('on', on);
  }

  customer(name: string, count: string): void {
    this.set('cust', esc(name));
    this.set('count', esc(count));
  }

  receipt(lines: ReceiptLine[], total: number): void {
    const recent = lines.slice(-4);
    this.set('lines', recent.map((l, i) => `<div class="${l.bad ? 'bad' : i === recent.length - 1 ? 'new' : ''}"><span>${esc(l.name)}</span><span>${euro(l.price)}</span></div>`).join(''));
    this.set('total', euro(total));
  }

  patience(frac: number | null): void {
    const w = frac === null ? '0%' : `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`;
    if (this.last.pat === w) return;
    this.last.pat = w;
    this.el.pat.style.width = w;
    this.el.pat.parentElement!.className = `bar ${frac !== null && frac < 0.3 ? 'red' : frac !== null && frac < 0.6 ? 'yellow' : ''}`;
  }

  status(text: string, alert = false): void {
    this.set('status', esc(text));
    this.el.status.classList.toggle('alert', alert);
  }

  prompt(text: string | null, options: string[] = []): void {
    this.set('prompt', text ? `${esc(text)}${options.map((o, i) => `<b>${i + 1}: ${esc(o)}</b>`).join('')}` : '');
    this.el.prompt.classList.toggle('on', !!text);
  }

  keypad(open: boolean, typed = '', what = '', len = 4): void {
    this.pad.classList.toggle('on', open);
    if (!open) return;
    this.el.sheet.style.display = len === 4 ? 'block' : 'none';
    this.set('disp', typed.padEnd(len, '_'));
    this.set('what', esc(what));
  }

  flashKey(n: number): void {
    const k = this.pad.querySelector<HTMLElement>(`[data-n="${n}"]`);
    if (!k) return;
    k.classList.add('hit');
    setTimeout(() => k.classList.remove('hit'), 120);
  }
}
