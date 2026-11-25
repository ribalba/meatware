import './elevator.css';

/** The instrument panel under the shared HUD: floor, level offset, silence, weight, lever, calls, music. */
export class ElevatorUi {
  private root: HTMLDivElement;
  private el: Record<string, HTMLElement> = {};
  private last: Record<string, string> = {};
  private stampTimer = 0;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'evPanel';
    this.root.className = 'win';
    this.root.innerHTML = `
      <div class="wt">ELEVATOR B</div>
      <div class="body">
        <div class="evTop"><div id="evFloorNum">1</div><div id="evFloorName">ACCOUNTING</div><div id="evDir"></div></div>
        <div class="row"><label>LEVEL</label><div class="evLevel"><i id="evLevelMark"></i></div><b id="evLevelVal">0 cm</b></div>
        <div class="row"><label>SILENCE</label><div class="bar"><i id="evSilence"></i></div></div>
        <div class="row"><label>WEIGHT</label><div class="bar"><i id="evWeight"></i></div><b id="evWeightVal">80 kg</b></div>
        <div class="evLine">LEVER <div id="evLeverBox"><i></i><i></i><i></i><i class="stop"></i><i></i><i></i><i></i></div> GATE <span id="evGate">OPEN</span></div>
        <div class="evLine">CALLS <span id="evCalls">-</span></div>
        <div class="evLine">MUSIC <span id="evMusic">CORPORATE MUZAK</span></div>
      </div>`;
    const hud = document.getElementById('hud') ?? document.body;
    hud.appendChild(this.root);
    const stamp = document.createElement('div');
    stamp.id = 'evStamp';
    hud.appendChild(stamp);
    this.root.querySelectorAll<HTMLElement>('[id]').forEach((e) => (this.el[e.id] = e));
    this.el.evStamp = stamp;
    this.place();
    addEventListener('resize', () => this.place());
  }

  /** Sits right under the shared status panel. */
  private place(): void {
    const panel = document.getElementById('panel');
    const r = panel?.getBoundingClientRect();
    this.root.style.top = `${r && r.height > 0 ? Math.round(r.bottom + 12) : 262}px`;
  }

  private text(id: string, s: string): void {
    if (this.last[id] === s) return;
    this.last[id] = s;
    this.el[id].textContent = s;
  }

  private cls(id: string, c: string): void {
    const key = `${id}.class`;
    if (this.last[key] === c) return;
    this.last[key] = c;
    this.el[id].className = c;
  }

  update(dt: number, s: {
    floorLabel: string;
    floorName: string;
    dir: string;
    offset: number | null;
    silence: number;
    weight: number;
    limit: number;
    notch: number;
    gate: string;
    calls: string;
    music: string;
  }): void {
    if (this.root.style.top === '262px') this.place();
    this.text('evFloorNum', s.floorLabel);
    this.text('evFloorName', s.floorName);
    this.text('evDir', s.dir);
    const mark = this.el.evLevelMark;
    if (s.offset === null) {
      this.cls('evLevelMark', 'off');
      this.text('evLevelVal', '---');
    } else {
      const o = s.offset;
      const a = Math.abs(o);
      this.cls('evLevelMark', a < 0.06 ? '' : a < 0.2 ? 'mid' : 'bad');
      mark.style.left = `${Math.max(2, Math.min(98, 50 + o * 100))}%`;
      this.text('evLevelVal', `${o > 0 ? '+' : ''}${Math.round(o * 100)} cm`);
    }
    this.el.evSilence.style.width = `${Math.min(100, s.silence)}%`;
    this.el.evWeight.style.width = `${Math.min(100, (s.weight / s.limit) * 100)}%`;
    this.cls('evWeight', s.weight > s.limit ? 'over' : '');
    this.text('evWeightVal', `${Math.round(s.weight)} kg`);
    const notchKey = String(s.notch);
    if (this.last.notch !== notchKey) {
      this.last.notch = notchKey;
      this.el.evLeverBox.querySelectorAll('i').forEach((b, k) => b.classList.toggle('on', k - 3 === s.notch));
    }
    this.text('evGate', s.gate);
    this.text('evCalls', s.calls || '-');
    this.text('evMusic', s.music);
    if (this.stampTimer > 0) {
      this.stampTimer -= dt;
      if (this.stampTimer <= 0) this.el.evStamp.classList.remove('on');
    }
  }

  /** Big feedback word in the middle of the screen (PERFECT, STEP, ...). */
  stamp(text: string, kind: '' | 'mid' | 'bad'): void {
    const e = this.el.evStamp;
    e.textContent = text;
    e.className = `on ${kind}`;
    this.stampTimer = 1.4;
  }

  hide(): void {
    this.root.style.display = 'none';
  }
}
