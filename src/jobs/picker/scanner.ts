import './picker.css';

/** What the handheld scanner shows. */
export interface ScanView {
  order: number;
  loc: string;
  item: string;
  window: number;
  steps: number;
  tot: number;
  rate: number;
  status: string;
  mode: '' | 'alert' | 'ok' | 'bad';
}

const mmss = (s: number) => {
  const a = Math.abs(s);
  return `${s < 0 ? '-' : ''}${Math.floor(a / 60)}:${String(Math.floor(a % 60)).padStart(2, '0')}`;
};

/** The SCAN-O-MATIC 3000, a small LCD window under the HUD panel. */
export class Scanner {
  private el: HTMLDivElement;
  private last = '';
  private flash = 0;
  private flashMode: ScanView['mode'] = '';

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'pkScanner';
    this.el.className = 'win';
    (document.getElementById('hud') ?? document.body).appendChild(this.el);
  }

  /** Colors the display for a moment (scan ok, mismatch). */
  blink(mode: ScanView['mode'], sec = 1.2): void {
    this.flashMode = mode;
    this.flash = sec;
  }

  update(v: ScanView, dt: number): void {
    this.flash = Math.max(0, this.flash - dt);
    const mode = this.flash > 0 ? this.flashMode : v.mode;
    const html = `<div class="wt"><span>SCAN-O-MATIC 3000</span><i>ORDER #${v.order}</i></div>
      <div class="lcd">
        <div class="loc">${v.loc}</div>
        <div class="item">${v.item}</div>
        <div class="row"><span>PICK WINDOW</span><b class="${v.window < 0 ? 'late' : ''}">${mmss(v.window)}</b></div>
        <div class="row"><span>STEPS ${v.steps.toLocaleString('en-US')}</span><span>RATE ${Math.round(v.rate)}/H</span></div>
        <div class="row"><span>TIME OFF TASK</span><b class="${v.tot > 20 ? 'late' : ''}">${mmss(v.tot)}</b></div>
        <div class="status">&gt; ${v.status}</div>
      </div>`;
    const key = html + mode;
    if (key === this.last) return;
    this.last = key;
    this.el.innerHTML = html;
    this.el.className = `win ${mode}`;
  }
}
