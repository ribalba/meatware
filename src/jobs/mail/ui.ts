import './mail.css';
import type { Mail } from './mail';
import { isParcel, postageText } from './mail';

/**
 * Two DOM panels on top of the HUD: the address of the held mail (readable, unlike the
 * 64 pixel envelope in your hand) and a sheet of paper for reading things you should not read.
 */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export class MailUi {
  private addr: HTMLDivElement;
  private paper: HTMLDivElement;
  private shownKey = '';
  private paperT = 0;

  constructor() {
    const host = document.getElementById('hud') ?? document.body;
    this.addr = document.createElement('div');
    this.addr.id = 'mailAddr';
    this.addr.className = 'win';
    host.appendChild(this.addr);
    this.paper = document.createElement('div');
    this.paper.id = 'mailPaper';
    this.paper.className = 'win';
    host.appendChild(this.paper);
  }

  /** Shows the address of the held mail, or hides the panel. Cheap to call every frame. */
  showMail(m: Mail | null): void {
    if (!m) {
      if (this.shownKey) {
        this.shownKey = '';
        this.addr.classList.remove('on');
      }
      return;
    }
    const key = `${m.id}/${m.postage}/${m.shaken}/${m.chewed}/${m.steamed}/${m.broken}`;
    if (key === this.shownKey) return;
    this.shownKey = key;
    const cls = m.chewed ? 'mp-chewed' : m.kind === 'penpal' ? 'mp-penpal' : m.kind === 'bad' ? 'mp-bad' : '';
    const stamp =
      m.postage === 'stamp'
        ? '<div class="mp-stamp mp-ok">PAID</div>'
        : m.postage === 'none'
          ? '<div class="mp-stamp">NO<br>STAMP</div>'
          : `<div class="mp-stamp mp-frank">${m.postage === 'frank' ? 'PU7<br>OK' : 'PU7<br>~~'}</div>`;
    const lines = m.chewed
      ? m.lines.map((l, i) => (i === 0 ? l.replace(/[a-z]/g, (c, j: number) => (j % 3 ? c : '#')) : l.replace(/./g, (c, j: number) => (j % 2 ? '#' : c))))
      : m.lines;
    const body = lines.map((l, i) => `<div class="mp-line${i === lines.length - 1 && m.code ? ' mp-code' : ''}">${esc(l)}</div>`).join('');
    const tags: string[] = [];
    if ((m.kind === 'letter' || m.kind === 'parcel') && !m.chewed) tags.push(`<span class="${m.postage === 'none' ? 'mp-warn' : ''}">POSTAGE: ${esc(postageText(m))}</span>`);
    if (isParcel(m)) tags.push(`<span>${m.shaken ? esc(`SHAKEN: ${m.shaken}`) : 'R: SHAKE'}</span>`);
    if (m.fragile) tags.push(`<span class="mp-warn">${m.broken ? 'FRAGILE (was)' : 'FRAGILE'}</span>`);
    if (m.chewed) tags.push('<span class="mp-warn">CHEWED</span>');
    if (m.steamed) tags.push('<span class="mp-warn">OPENED</span>');
    this.addr.innerHTML = `<div class="wt">${isParcel(m) ? 'PARCEL' : 'LETTER'} No. ${String(m.id).padStart(5, '0')}</div><div class="mp-paper ${cls}">${stamp}<div class="mp-from">From: ${esc(m.sender)}</div>${body}</div><div class="mp-tags">${tags.join('')}</div>`;
    this.addr.classList.add('on');
  }

  /** A sheet of paper in the middle of the screen. */
  read(title: string, lines: string[], seconds: number, foot = ''): void {
    this.paper.innerHTML = `<div class="wt">${esc(title)}</div><div class="mp-paper"><p>${lines.map(esc).join('\n')}</p></div><div class="mp-foot">${esc(foot)}</div>`;
    this.paper.classList.remove('on');
    void this.paper.offsetWidth;
    this.paper.classList.add('on');
    this.paperT = seconds;
  }

  get reading(): boolean {
    return this.paperT > 0;
  }

  closePaper(): void {
    this.paperT = 0;
    this.paper.classList.remove('on');
  }

  tick(dt: number): void {
    if (this.paperT > 0) {
      this.paperT -= dt;
      if (this.paperT <= 0) this.closePaper();
    }
  }
}
