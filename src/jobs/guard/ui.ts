import './guard.css';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface LogLine {
  text: string;
  bad?: boolean;
}

/**
 * The guard's own HUD parts: the NIGHT WATCH panel (alertness, patrol round, flashlight,
 * radio, the logbook while seated), the eyelids that close when you get sleepy and the
 * sleep screen. Lives inside the HUD element so it hides with it.
 */
export class GuardUi {
  private root: HTMLDivElement;
  private lids: HTMLDivElement;
  private dark: HTMLDivElement;
  private sleep: HTMLDivElement;
  private zoom: HTMLDivElement;
  private el: Record<string, HTMLElement> = {};
  private last: Record<string, string> = {};

  constructor() {
    const host = document.getElementById('hud') ?? document.body;
    this.lids = document.createElement('div');
    this.lids.id = 'gdLids';
    this.lids.innerHTML = '<i class="top"></i><i class="bot"></i>';
    this.dark = document.createElement('div');
    this.dark.id = 'gdDark';
    this.zoom = document.createElement('div');
    this.zoom.id = 'gdZoom';
    this.zoom.innerHTML = '<b></b>';
    // Behind the HUD panels, in front of the 3D view.
    host.prepend(this.zoom);
    host.prepend(this.lids);
    host.prepend(this.dark);
    this.sleep = document.createElement('div');
    this.sleep.id = 'gdSleep';
    this.sleep.textContent = 'Z z z';
    host.appendChild(this.sleep);
    this.root = document.createElement('div');
    this.root.id = 'gdPanel';
    this.root.className = 'win';
    this.root.innerHTML = `
      <div class="wt"><span>NIGHT WATCH</span><span data-k="sitting"></span></div>
      <div class="body">
        <div class="row"><label>ALERTNESS</label><div class="bar alert" data-k="alertBar"><i data-k="alert"></i></div></div>
        <div class="line" data-k="round"></div>
        <div class="line" data-k="light"></div>
        <div class="line" data-k="radio"></div>
        <div class="log" data-k="log"></div>
        <div class="keys" data-k="keys"></div>
      </div>`;
    host.appendChild(this.root);
    for (const e of this.root.querySelectorAll<HTMLElement>('[data-k]')) this.el[e.dataset.k!] = e;
  }

  private style(el: HTMLElement, prop: 'width' | 'height' | 'opacity', v: string): void {
    if (el.style[prop] !== v) el.style[prop] = v;
  }

  private set(k: string, html: string): void {
    if (this.last[k] === html) return;
    this.last[k] = html;
    this.el[k].innerHTML = html;
  }

  update(o: {
    alert: number;
    round: number;
    scanned: number;
    flashlight: boolean;
    radio: string;
    seated: boolean;
    zoomed: string | null;
    log: LogLine[];
    logbookMissing: boolean;
    keys: string[];
    lid: number;
    darkness: number;
    asleep: boolean;
  }): void {
    this.style(this.el.alert, 'width', `${Math.round(Math.max(0, Math.min(100, o.alert)))}%`);
    const bar = this.el.alertBar;
    bar.classList.toggle('low', o.alert < 40 && o.alert >= 20);
    bar.classList.toggle('crit', o.alert < 20);
    this.set('sitting', o.seated ? 'AT THE CONSOLE' : '');
    this.set('round', `PATROL ROUND ${o.round}: ${o.scanned}/6 checkpoints`);
    this.el.round.classList.toggle('good', o.scanned === 6);
    this.set('light', `FLASHLIGHT: ${o.flashlight ? 'ON' : 'OFF'}`);
    this.el.light.classList.toggle('on', o.flashlight);
    this.set('radio', o.radio === 'OFF' ? '' : `RADIO: ${esc(o.radio)}`);
    this.el.radio.style.display = o.radio === 'OFF' ? 'none' : 'block';
    this.el.log.classList.toggle('on', o.seated);
    if (o.seated) {
      const head = o.logbookMissing ? 'LOGBOOK MISSING. WRITING ON YOUR HAND.' : 'SECURITY LOGBOOK';
      this.set('log', `<h4>${head}</h4>${o.log.slice(-5).map((l) => `<div class="${l.bad ? 'bad' : ''}">${esc(l.text)}</div>`).join('') || '<div>nothing happened. as usual.</div>'}`);
    }
    this.set('keys', o.keys.map((k) => `<span>${k}</span>`).join(''));
    const lidPct = Math.round(Math.max(0, Math.min(1, o.lid)) * 50);
    this.style(this.lids.children[0] as HTMLElement, 'height', `${lidPct}%`);
    this.style(this.lids.children[1] as HTMLElement, 'height', `${lidPct}%`);
    const dk = Math.max(0, Math.min(1, o.darkness));
    this.style(this.dark, 'opacity', String(Math.round(dk * 50) / 50));
    this.sleep.classList.toggle('on', o.asleep);
    this.zoom.classList.toggle('on', !!o.zoomed);
    if (o.zoomed) (this.zoom.firstElementChild as HTMLElement).textContent = o.zoomed;
  }
}
