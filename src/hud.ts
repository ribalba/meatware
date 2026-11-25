import { clamp } from './util';

function hue(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export class Hud {
  overlay: HTMLDivElement;
  private root: HTMLDivElement;
  private el: Record<string, HTMLElement> = {};
  private subTimer = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.className = 'hidden';
    this.root.innerHTML = `
      <div id="vignette"></div>
      <div id="panel" class="win">
        <div id="job" class="wt">SHELF STACKER</div>
        <div class="body">
          <div id="clock">09:00</div>
          <div class="row"><label id="quotaLabel">QUOTA</label><div class="bar"><i id="prodBar"></i></div><b id="prodVal">0/25</b></div>
          <div class="row"><label>BOSS MOOD</label><div class="bar red"><i id="annoyBar"></i></div></div>
          <div class="row"><label>BOSS TEMP</label><div class="bar orange"><i id="tempBar"></i></div></div>
          <div class="row"><label>BLADDER</label><div class="bar yellow"><i id="bladderBar"></i></div></div>
          <div id="writeups"><label>WRITE-UPS</label><span class="wu"></span><span class="wu"></span><span class="wu"></span></div>
          <div id="pocket"></div>
        </div>
      </div>
      <div id="watching">BRAD IS WATCHING</div>
      <div id="filming"></div>
      <div id="crosshair"></div>
      <div id="hint"></div>
      <div id="holding"></div>
      <div id="progress"><div id="progressLabel"></div><div class="bar"><i id="progressFill"></i></div></div>
      <div id="subtitle" class="win"><b id="subSpeaker"></b><span id="subText"></span><i class="more"></i></div>
      <div id="toasts"></div>
      <div id="stamp"></div>
      <div id="chat" class="win">
        <div id="chatHead" class="wt"><span class="live">LIVE</span><span><span id="viewers">0</span> ROBOTS WATCHING</span></div>
        <div id="chatLines"></div>
      </div>
      <div id="help"><span><kbd>WASD</kbd> move</span><span><kbd>Shift</kbd> run</span><span><kbd>E</kbd> take/use</span><span><kbd>G</kbd> throw</span><span><kbd>K</kbd> kick</span><span><kbd>Q</kbd> pocket</span><span><kbd>I</kbd> inspect</span><span><kbd>P</kbd> pee</span><span><kbd>M</kbd> sound</span><span><kbd>V</kbd> voice</span></div>
    `;
    parent.appendChild(this.root);
    this.root.querySelectorAll<HTMLElement>('[id]').forEach((e) => (this.el[e.id] = e));
    this.overlay = document.createElement('div');
    this.overlay.id = 'overlay';
    parent.appendChild(this.overlay);
  }

  /** Adds job specific keys to the help bar. */
  addHelpKeys(keys: [string, string][]): void {
    const bar = this.el.help;
    if (!bar) return;
    for (const [k, label] of keys) {
      const span = document.createElement('span');
      const kbd = document.createElement('kbd');
      kbd.textContent = k;
      span.append(kbd, ` ${label}`);
      bar.appendChild(span);
    }
  }

  show(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
  }

  bar(id: string, frac: number): void {
    this.el[id].style.width = `${clamp(frac, 0, 1) * 100}%`;
  }

  text(id: string, s: string): void {
    const e = this.el[id];
    if (e.textContent !== s) e.textContent = s;
    // The clock gets "OVERTIME" appended, which needs a smaller pixel font to fit the panel.
    if (id === 'clock') e.classList.toggle('long', s.length > 5);
    if (id === 'hint' || id === 'holding' || id === 'pocket' || id === 'filming') e.style.display = s ? 'block' : 'none';
  }

  writeUps(n: number): void {
    this.root.querySelectorAll('.wu').forEach((e, i) => e.classList.toggle('on', i < n));
  }

  watching(v: boolean): void {
    this.el.watching.classList.toggle('on', v);
  }

  say(speaker: string, text: string, dur = 4): void {
    // The speaker name sits in a small tab above the dialogue box, so it needs no colon.
    this.el.subSpeaker.textContent = speaker;
    this.el.subText.textContent = text;
    this.el.subtitle.classList.toggle('narration', !speaker);
    this.el.subtitle.classList.add('on');
    this.subTimer = dur;
  }

  toast(title: string, text: string, kind = ''): void {
    const d = document.createElement('div');
    d.className = `toast ${kind}`;
    d.innerHTML = `<b></b><span></span>`;
    d.querySelector('b')!.textContent = title;
    d.querySelector('span')!.textContent = text;
    this.el.toasts.appendChild(d);
    setTimeout(() => d.classList.add('out'), 4500);
    setTimeout(() => d.remove(), 5200);
  }

  stamp(text: string): void {
    const s = this.el.stamp;
    s.textContent = text;
    s.classList.remove('on');
    void s.offsetWidth;
    s.classList.add('on');
  }

  chat(user: string, text: string): void {
    const line = document.createElement('div');
    line.className = 'line';
    const u = document.createElement('b');
    u.textContent = user;
    u.style.color = `hsl(${hue(user)} 60% 66%)`;
    const t = document.createElement('span');
    t.textContent = ` ${text}`;
    line.append(u, t);
    const box = this.el.chatLines;
    box.appendChild(line);
    while (box.children.length > 14) box.firstElementChild?.remove();
  }

  progress(label: string | null, frac = 0): void {
    const p = this.el.progress;
    if (label === null) {
      p.classList.remove('on');
      return;
    }
    p.classList.add('on');
    this.text('progressLabel', label);
    this.bar('progressFill', frac);
  }

  vignette(bladder: number): void {
    this.el.vignette.style.opacity = String(clamp((bladder - 65) / 35, 0, 1));
  }

  tick(dt: number): void {
    if (this.subTimer > 0) {
      this.subTimer -= dt;
      if (this.subTimer <= 0) this.el.subtitle.classList.remove('on');
    }
  }

  screen(html: string): void {
    this.overlay.innerHTML = html;
    this.overlay.classList.add('on');
  }

  hideScreen(): void {
    this.overlay.classList.remove('on');
  }
}
