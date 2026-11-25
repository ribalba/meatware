import './laundry.css';

/** The little retro panel that shows the fold sequence. Pure display, the job does the logic. */
export const ARROWS = ['←', '↑', '→', '↓'];

export class FoldPanel {
  private el: HTMLDivElement;
  private badT = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'ld-fold';
    document.body.appendChild(this.el);
  }

  show(o: { title: string; name: string; seq: number[]; idx: number; timeFrac: number; size: string; help: string; sheet: boolean }): void {
    this.el.classList.add('on');
    this.el.classList.toggle('sheet', o.sheet);
    this.el.classList.toggle('bad', this.badT > 0);
    const keys = o.seq.map((d, i) => `<span class="k${i < o.idx ? ' done' : i === o.idx ? ' cur' : ''}">${ARROWS[d]}</span>`).join('');
    this.el.innerHTML =
      `<div class="t">${o.title}</div><div class="b"><div class="name"></div>` +
      `<div class="keys">${keys}</div>` +
      `<div class="bar"><i style="width:${Math.round(Math.max(0, Math.min(1, o.timeFrac)) * 100)}%"></i></div>` +
      `<div class="mm"></div><div class="help"></div></div>`;
    (this.el.querySelector('.name') as HTMLElement).textContent = o.name;
    (this.el.querySelector('.mm') as HTMLElement).textContent = o.size;
    (this.el.querySelector('.help') as HTMLElement).textContent = o.help;
  }

  bad(): void {
    this.badT = 0.35;
  }

  tick(dt: number): void {
    this.badT = Math.max(0, this.badT - dt);
  }

  hide(): void {
    this.el.classList.remove('on');
  }
}
