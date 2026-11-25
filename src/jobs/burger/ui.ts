import type * as THREE from 'three';
import { shownLines, Ticket, Verdict } from './orders';

/**
 * The order screen of the burger job: a DOM panel under the HUD panel with the open
 * tickets and what is on the tray, plus the canvas screens in the kitchen
 * (ticket rail, grill timer, fry timer, drive-thru sign, ice cream machine).
 */

const CSS = `
#bgOrders { position: absolute; left: 14px; top: 252px; width: 290px; max-height: calc(100vh - 330px); overflow: hidden; }
#bgOrders .bg-body { padding: 6px 8px 8px; display: flex; flex-direction: column; gap: 6px; }
#bgOrders .bg-t { background: #efe4c8; color: #2a1a10; padding: 4px 7px 5px; font: 18px/0.95 var(--vt); border-left: 4px solid #7a2416; box-shadow: 2px 2px 0 var(--black); }
#bgOrders .bg-t.urgent { border-left-color: #e8604a; animation: bgBlink 0.8s steps(1) infinite; }
#bgOrders .bg-t.serve { border-left-color: #3c9a3a; }
#bgOrders .bg-t h4 { margin: 0 0 2px; font: 8px/1.3 var(--px); letter-spacing: 0.5px; color: #7a2416; display: flex; justify-content: space-between; }
#bgOrders .bg-t b { display: block; font: 19px/1 var(--vt); color: #1a0f08; }
#bgOrders .bg-row { display: flex; flex-wrap: wrap; gap: 2px 3px; margin-top: 1px; }
#bgOrders .bg-t i { font-style: normal; display: inline-block; color: #5a4a3a; padding: 0 3px; background: #e2d4b0; }
#bgOrders .bg-t i.ok { color: #f3e6c8; background: #2f7a2a; }
#bgOrders .bg-t i.next { color: #1a0f08; background: #f7d23e; }
#bgOrders .bg-t i.noise { color: #9a8a7a; letter-spacing: 1px; }
#bgOrders .bg-t i.side { background: #f2c9a0; }
#bgOrders .bg-t small { display: block; font: 15px/1 var(--vt); color: #7a6a5a; }
#bgOrders .bg-p { height: 4px; background: #3a2a1a; margin-top: 3px; }
#bgOrders .bg-p u { display: block; height: 100%; background: #3c9a3a; text-decoration: none; }
#bgOrders .bg-p u.low { background: #e8604a; }
#bgOrders .bg-tray, #bgOrders .bg-grease { padding: 4px 10px 6px; font: 18px/1 var(--vt); color: var(--amber); border-top: 2px solid var(--black); }
#bgOrders .bg-tray em { font-style: normal; color: var(--ink); }
#bgOrders .bg-grease .bar { display: inline-block; vertical-align: middle; width: 120px; height: 8px; margin-left: 6px; }
#bgOrders .bg-grease .bar i { --fill: #c9a43a; }
#bgOrders .bg-empty { font: 18px var(--vt); color: var(--dim); padding: 2px 2px 4px; }
@keyframes bgBlink { 50% { background: #f7c8b0; } }
@media (max-height: 640px) { #bgOrders { top: 236px; } }
`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export class OrderPanel {
  private root: HTMLDivElement;
  private body: HTMLDivElement;
  private tray: HTMLDivElement;
  private grease: HTMLDivElement;
  private last = '';

  constructor() {
    if (!document.getElementById('bgOrdersCss')) {
      const st = document.createElement('style');
      st.id = 'bgOrdersCss';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    this.root = document.createElement('div');
    this.root.id = 'bgOrders';
    this.root.className = 'win';
    this.root.innerHTML = '<div class="wt">ORDERS (BUILD BOTTOM UP)</div><div class="bg-body"></div><div class="bg-tray"></div><div class="bg-grease"></div>';
    this.body = this.root.querySelector('.bg-body')!;
    this.tray = this.root.querySelector('.bg-tray')!;
    this.grease = this.root.querySelector('.bg-grease')!;
    (document.getElementById('hud') ?? document.body).appendChild(this.root);
  }

  /** Redraws when something changed. `verdicts` tell how far the tray matches each ticket. */
  update(tickets: Ticket[], verdicts: (Verdict | null)[], trayLine: string, grease: number): void {
    const parts: string[] = [];
    tickets.slice(0, 4).forEach((t, k) => {
      const v = verdicts[k];
      const lines = shownLines(t);
      const frac = Math.max(0, t.patience / t.maxPatience);
      const urgent = frac < 0.25;
      const cls = `bg-t${urgent ? ' urgent' : ''}${v?.correct ? ' serve' : ''}`;
      let chips = '';
      let notes = '';
      const extra = t.special ? 1 + (t.special === 'icecream' ? 1 : 0) : 0;
      lines.slice(1).forEach((l, i) => {
        const noise = t.garbled[i + 1];
        const stackIdx = i - extra;
        if (stackIdx < 0) {
          notes += `<small>${esc(l)}</small>`;
          return;
        }
        let c = stackIdx >= t.stack.length ? 'side' : '';
        if (noise) c = 'noise';
        else if (v && stackIdx < t.stack.length) c = stackIdx < v.prefix ? 'ok' : stackIdx === v.prefix ? 'next' : '';
        chips += `<i class="${c}">${esc(noise ? l : l.replace(/^\d+ /, ''))}</i>`;
      });
      const body = `${notes}${chips ? `<div class="bg-row">${chips}</div>` : ''}`;
      parts.push(
        `<div class="${cls}"><h4><span>#${t.no} ${esc(t.src)}</span><span>${v?.correct ? 'READY' : ''}</span></h4><b>${esc(t.garbled[0] ? lines[0] : t.name)}</b>${body}<div class="bg-p"><u class="${urgent ? 'low' : ''}" style="width:${(frac * 100).toFixed(0)}%"></u></div></div>`,
      );
    });
    if (tickets.length > 4) parts.push(`<div class="bg-empty">+${tickets.length - 4} more tickets. Good luck.</div>`);
    if (!tickets.length) parts.push('<div class="bg-empty">No orders. Suspicious. Look busy.</div>');
    const html = parts.join('');
    if (html !== this.last) {
      this.body.innerHTML = html;
      this.last = html;
    }
    const tl = `TRAY: <em>${esc(trayLine)}</em>`;
    if (this.tray.innerHTML !== tl) this.tray.innerHTML = tl;
    const g = Math.round(grease);
    const gl = `HAND GREASE<span class="bar"><i style="width:${g}%"></i></span>`;
    if (this.grease.dataset.v !== String(g)) {
      this.grease.innerHTML = gl;
      this.grease.dataset.v = String(g);
    }
  }

  show(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }
}

// ------------------------------------------------------------------ canvas screens in the kitchen

interface Screen {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
}

/** Paper tickets on the rail above the assembly island. */
export function drawRail(s: Screen, tickets: Ticket[]): void {
  const { g, canvas, tex } = s;
  g.clearRect(0, 0, canvas.width, canvas.height);
  const w = 196;
  tickets.slice(0, 5).forEach((t, i) => {
    const x = 8 + i * (w + 8);
    const lines = shownLines(t);
    const h = Math.min(124, 26 + lines.length * 13);
    g.fillStyle = '#f2ead2';
    g.fillRect(x, 0, w, h);
    // torn bottom edge
    g.fillStyle = '#f2ead2';
    for (let k = 0; k < w; k += 8) g.fillRect(x + k, h, 4, 3);
    g.fillStyle = '#c0392b';
    g.fillRect(x, 0, w, 3);
    g.fillStyle = '#1a0f08';
    g.font = '15px VT323, monospace';
    g.textBaseline = 'top';
    g.fillText(`#${t.no} ${t.src}`, x + 6, 6);
    lines.forEach((l, k) => {
      g.fillStyle = t.garbled[k] ? '#9a8a7a' : k === 0 ? '#7a2416' : '#2a1a10';
      g.fillText(l.slice(0, 26), x + 6, 20 + k * 13);
    });
    const frac = Math.max(0, t.patience / t.maxPatience);
    g.fillStyle = frac < 0.25 ? '#e8604a' : '#3c9a3a';
    g.fillRect(x + 4, h - 6, (w - 8) * frac, 3);
  });
  tex.needsUpdate = true;
}

export interface SlotView {
  /** Underside doneness, 0 raw, 1 done, above 1.7 burnt. Null for an empty slot. */
  down: number | null;
  up: number;
}

/** The grill timer: one bar per slot with RAW, FLIP and BURN zones. */
export function drawGrillPanel(s: Screen, slots: SlotView[], fire: boolean, t: number): void {
  const { g, canvas, tex } = s;
  const W = canvas.width;
  const Hh = canvas.height;
  g.fillStyle = '#0a0806';
  g.fillRect(0, 0, W, Hh);
  g.font = '8px "Press Start 2P", monospace';
  g.textBaseline = 'top';
  if (fire && Math.sin(t * 12) > 0) {
    g.fillStyle = '#ff3020';
    g.fillText('!! FIRE !! FIRE !! FIRE !!', 14, 18);
    tex.needsUpdate = true;
    return;
  }
  const sw = (W - 10) / slots.length;
  slots.forEach((sl, i) => {
    const x = 5 + i * sw;
    g.fillStyle = '#2a2018';
    g.fillRect(x + 2, 4, sw - 4, Hh - 8);
    if (sl.down === null) {
      g.fillStyle = '#5a4a3a';
      g.fillText('----', x + 10, 18);
      return;
    }
    // zones
    const bw = sw - 12;
    const bx = x + 6;
    g.fillStyle = '#5a2a2a';
    g.fillRect(bx, 30, bw * (1 / 2.4), 10);
    g.fillStyle = '#2f6a2a';
    g.fillRect(bx + bw * (1 / 2.4), 30, bw * (0.7 / 2.4), 10);
    g.fillStyle = '#4a1a0a';
    g.fillRect(bx + bw * (1.7 / 2.4), 30, bw * (0.7 / 2.4), 10);
    const f = Math.min(sl.down, 2.4) / 2.4;
    g.fillStyle = '#f7f2dc';
    g.fillRect(bx + bw * f - 1, 27, 3, 16);
    const label = sl.down < 1 ? 'COOK' : sl.down < 1.7 ? (sl.up < 1 ? 'FLIP!' : 'TAKE!') : 'BURN';
    const blink = sl.down >= 1 && Math.sin(t * 10) > 0;
    g.fillStyle = sl.down < 1 ? '#c9a46a' : sl.down < 1.7 ? (blink ? '#7cff6a' : '#3c9a3a') : blink ? '#ff3020' : '#a02010';
    g.fillText(label, x + 8, 10);
  });
  tex.needsUpdate = true;
}

export function drawFryPanel(s: Screen, baskets: (number | null)[], down: boolean[], fire: boolean, t: number): void {
  const { g, canvas, tex } = s;
  const W = canvas.width;
  const Hh = canvas.height;
  g.fillStyle = '#0a0806';
  g.fillRect(0, 0, W, Hh);
  g.font = '8px "Press Start 2P", monospace';
  g.textBaseline = 'top';
  if (fire && Math.sin(t * 12) > 0) {
    g.fillStyle = '#ff3020';
    g.fillText('!! FIRE !!', 30, 18);
    tex.needsUpdate = true;
    return;
  }
  baskets.forEach((b, i) => {
    const x = 4 + i * (W / 2);
    g.fillStyle = '#2a2018';
    g.fillRect(x, 4, W / 2 - 8, Hh - 8);
    let label = 'EMPTY';
    let color = '#5a4a3a';
    if (b !== null) {
      if (!down[i]) {
        label = b < 1 ? 'SOGGY' : b < 1.6 ? 'GOLD' : 'BURNT';
        color = b < 1 ? '#c9a46a' : b < 1.6 ? '#7cff6a' : '#ff3020';
      } else {
        label = b < 1 ? `${Math.ceil((1 - b) * 9)}s` : b < 1.6 ? 'LIFT!' : 'BURN!';
        color = b < 1 ? '#f0b43c' : b < 1.6 ? (Math.sin(t * 10) > 0 ? '#7cff6a' : '#3c9a3a') : Math.sin(t * 10) > 0 ? '#ff3020' : '#a02010';
      }
    }
    g.fillStyle = color;
    g.fillText(label, x + 6, 18);
  });
  tex.needsUpdate = true;
}

export function drawDriveSign(s: Screen, text: string, t: number, alert: boolean): void {
  const { g, canvas, tex } = s;
  g.fillStyle = '#0a0806';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.font = '10px "Press Start 2P", monospace';
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.fillStyle = alert && Math.sin(t * 8) > 0 ? '#ff3020' : '#f0b43c';
  g.fillText(text, canvas.width / 2, canvas.height / 2);
  g.textAlign = 'left';
  tex.needsUpdate = true;
}

export function drawIceScreen(s: Screen, text: string): void {
  const { g, canvas, tex } = s;
  g.fillStyle = '#0a1a2a';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.font = '6px "Press Start 2P", monospace';
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.fillStyle = '#55ffff';
  const parts = text.split('|');
  parts.forEach((p, i) => g.fillText(p, canvas.width / 2, canvas.height / 2 + (i - (parts.length - 1) / 2) * 9));
  g.textAlign = 'left';
  tex.needsUpdate = true;
}
