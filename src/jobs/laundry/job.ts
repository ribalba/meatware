import * as THREE from 'three';
import type { CustomerKind } from '../../customerModels';
import type { Item, ItemDef } from '../../items';
import { fill, pick, pushOutCircle, rand } from '../../util';
import type { Job, Look, Shift } from '../types';
import { buildLint, CUBBY, DOOR, LaundryLevel, LInteract, SPOTS, TABLE_Y, TABLES } from './building';
import { FoldPanel } from './foldPanel';
import { buildSpread, CLOTHES, Garment, garmentDef, garmentName, isBad, isFolded, KINDS, newGarment, patternName, Spread } from './garments';
import * as L from './texts';
import { Bot, BotCtx, Inspector, Kid, LaundryCustomer, Vacuum } from './npcs';
import { LAUNDRY_SECRETS, LaundryFun } from './mischief';

/**
 * Job: laundry folder at the FOLD-O-MATIC 3000.
 * Take dry laundry out of the dryers, fold it at a table with a key sequence, pair the socks,
 * file everything in the numbered cubby of its ticket and survive the customers ringing the bell.
 */

const QUOTA = 12;
const WASH = 13;
const DRY = 11;
type Temp = 'COLD' | 'WARM' | 'HOT';
const TEMPS: Temp[] = ['COLD', 'WARM', 'HOT'];
const TEMP_COLOR: Record<Temp, string> = { COLD: '#3aa0ff', WARM: '#f1c40f', HOT: '#ff3b30' };

interface Unit {
  i: number;
  temp: Temp;
  state: 'wash' | 'dry' | 'done' | 'empty';
  t: number;
  load: Garment[];
  ticket: number;
  shrunk: boolean;
  /** The robot child turned the dial. */
  kidHot: boolean;
  drawAcc: number;
}

interface Fold {
  table: number;
  g: Garment;
  item: Item;
  seq: number[];
  idx: number;
  mistakes: number;
  t: number;
  limit: number;
  spread: Spread;
  fitted: boolean;
  lucky: boolean;
  shuffle: number;
  done: boolean;
}

interface Lint {
  mesh: THREE.Mesh;
  x: number;
  z: number;
}

const KEYMAP: Record<string, number> = { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2, ArrowDown: 3, Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 };

export class LaundryJob implements Job {
  info = {
    id: 'laundry',
    title: 'LAUNDRY FOLDER',
    place: L.PLACE,
    teaser: 'The fitted sheet is waiting.',
    quotaLabel: 'FILED',
    lockedDoor: 'Locked. The key is at LOST & FOUND by the entrance, in the far corner. It is tied to a giant sock.',
    bladderWarning: 'You really need to pee. The toilet is in the back corner past bank B. The key is at LOST & FOUND by the entrance, inside a giant sock.',
  };
  level: LaundryLevel;
  bossLines = L.BOSS_LINES;
  chatLines = L.CHAT_LINES;
  achievements = L.ACHIEVEMENTS;
  secrets = LAUNDRY_SECRETS;

  private s!: Shift;
  /** Breakables, movables, the hiding place and the secrets (mischief.ts). */
  private fun: LaundryFun;
  private units: Unit[] = [];
  private garments = new Map<Item, Garment>();
  /** Open garments per ticket number (1..12). */
  private tickets = new Map<number, Set<Garment>>();
  private fold: Fold | null = null;
  private panel!: FoldPanel;
  private lints: Lint[] = [];
  private customers: LaundryCustomer[] = [];
  private vacuum!: Vacuum;
  private inspector!: Inspector;
  private kid!: Kid;
  private ctx!: BotCtx;
  private nextCustomer = 7;
  private kinds: CustomerKind[] = ['shopper', 'gran', 'karen', 'shopper', 'influencer'];
  private kindIdx = 0;
  private cleanupAcc = 0;
  private lastSheetT = -99;
  private quotaToast = false;
  private c = {
    neat: 0, crumpled: 0, delivered: 0, wrongCubby: 0, unfolded: 0, pairs: 0, creative: 0, lostSocks: 0,
    shrunkMade: 0, shrunkDelivered: 0, sheetsTried: 0, sheetsWon: 0, served: 0, walkouts: 0, complaints: 0,
    bellRings: 0, playerBells: 0, vacuumed: 0, lintEaten: 0, reports: 0, handed: 0, hits: 0, slips: 0,
    hotSets: 0, kidHots: 0, binDives: 0,
  };

  constructor(scene: THREE.Scene) {
    this.level = new LaundryLevel(scene);
    // before the engine collects the level's items, so the movables are among them
    this.fun = new LaundryFun(this.level);
    for (let n = 1; n <= CUBBY.cols * CUBBY.rows; n++) this.tickets.set(n, new Set());
  }

  // ---------------------------------------------------------------- setup

  start(shift: Shift): void {
    this.s = shift;
    this.panel = new FoldPanel();
    const job = this;
    this.ctx = {
      nav: shift.nav,
      colliders: this.level.colliders,
      get playerPos() {
        return shift.player.pos;
      },
      bots: () => job.bots(),
    };
    // Units: two are done at the start, the others are staggered.
    this.level.units.forEach((_, i) => {
      const u: Unit = { i, temp: i === 4 ? 'HOT' : i % 3 === 0 ? 'COLD' : 'WARM', state: 'empty', t: 0, load: [], ticket: 0, shrunk: false, kidHot: false, drawAcc: 0 };
      this.units.push(u);
      this.loadUnit(u);
      if (i < 2) {
        u.state = 'done';
        u.t = 0;
      } else if (i === 4) {
        // the previous human left this one on HOT
        u.state = 'wash';
        u.t = WASH - 1;
      } else {
        u.state = i % 2 ? 'dry' : 'wash';
        u.t = rand(2, 9);
      }
      this.drawUnit(u);
    });
    for (let k = 0; k < 8; k++) {
      this.addLint(new THREE.Vector3(rand(-12, 6), 0, rand(-11, 10)));
    }
    this.vacuum = new Vacuum(shift.scene, new THREE.Vector3(-12, 0, -2));
    this.vacuum.pick = (v) => this.vacuumPick(v);
    this.vacuum.arrive = (v) => this.vacuumArrive(v);
    this.inspector = new Inspector(shift.scene, new THREE.Vector3(1, 0, 1.5));
    this.inspector.pick = (q) => this.inspectorPick(q);
    this.inspector.arrive = (q) => this.inspectorArrive(q);
    this.kid = new Kid(shift.scene, new THREE.Vector3(10, 0, 3));
    this.kid.pickWasher = () => this.kidPick();
    this.kid.twist = (k) => this.kidTwist(k);
    addEventListener('keydown', (e) => this.onKey(e));
    this.fun.start(shift, {
      bots: () => this.bots(),
      spawnSock: (pos, vel) => {
        const g = newGarment('sock', 0);
        const it = shift.addItem(garmentDef(g), pos);
        this.garments.set(it, g);
        g.item = it;
        if (vel) {
          it.vel.copy(vel);
          it.sleeping = false;
        }
        return it;
      },
      addLint: (p) => this.addLint(p),
      report: () => this.report(),
      complaint: (b) => this.complaint(b),
      ring: () => this.ringBell(),
      unit: (i) => this.units[i],
    });
  }

  onKick(look: Look | null): boolean {
    if (this.fold) return false;
    return this.fun.onKick(look);
  }

  private bots(): Bot[] {
    return [...this.customers, this.vacuum, this.inspector, this.kid];
  }

  obstacles() {
    const out = this.customers.map((c) => ({ x: c.pos.x, z: c.pos.z, r: c.radius }));
    out.push({ x: this.vacuum.pos.x, z: this.vacuum.pos.z, r: this.vacuum.radius });
    out.push({ x: this.inspector.pos.x, z: this.inspector.pos.z, r: this.inspector.radius });
    out.push(...this.kid.circles());
    return out;
  }

  lookTargets(): THREE.Object3D[] {
    return this.bots().map((b) => b.group);
  }

  quota() {
    return { done: this.c.delivered, target: QUOTA };
  }

  private filmer(): LaundryCustomer | undefined {
    return this.customers.find((c) => c.kind === 'influencer' && c.state === 'wait' && c.fallen <= 0 && c.pos.distanceTo(this.s.player.pos) < 9);
  }

  hypeMultiplier(): number {
    return this.filmer() ? 2 : 1;
  }

  cameraLabel(): string {
    return this.filmer() ? 'ON CAMERA: Influencer-Bot is filming you fold (hype x2)' : '';
  }

  heldLabel(it: Item): string {
    const g = this.garments.get(it);
    if (!g) return '';
    const state = g.stage === 'dry' ? 'unfolded' : g.stage === 'single' ? 'single' : g.stage === 'crumpled' ? 'approximately folded' : 'folded';
    return g.ticket ? `  [ticket ${g.ticket}, ${state}]` : `  [no ticket, ${state}]`;
  }

  productive(): boolean {
    return this.c.delivered >= QUOTA - 2;
  }

  employeeOfTheMonth(pocket: ItemDef[], fired: boolean): string {
    if (this.c.sheetsWon && !fired) return 'You. You folded the fitted sheet. Nobody believes it.';
    if (pocket.filter((p) => p.id.startsWith('ld-sock')).length >= 3) return 'The Lost Socks Bin (it was you all along)';
    return 'The Fitted Sheet (undefeated since 1958)';
  }

  reviewRows(): [string, string | number][] {
    const c = this.c;
    return [
      ['Filed in the right cubby', c.delivered],
      ['Garments folded to 30 x 30 cm', c.neat],
      ['Garments folded "approximately"', c.crumpled],
      ['Filed creatively', c.wrongCubby + c.unfolded],
      ['Sock pairs matched', c.pairs],
      ['Creative sock pairs', c.creative],
      ['Socks declared lost', c.lostSocks],
      ['Garments shrunk to doll size', c.shrunkMade],
      ['Fitted sheets folded', `${c.sheetsWon} of ${c.sheetsTried}`],
      ['Customers served', c.served],
      ['Customers who walked out', c.walkouts],
      ['Bell rings endured', c.bellRings],
      ['Eaten by the vacuum (socks / lint)', `${c.vacuumed} / ${c.lintEaten}`],
      ['Smell reports by Inspector Q-8', c.reports],
    ];
  }

  payRows(): [string, number][] {
    const c = this.c;
    const rows: [string, number][] = [];
    const t = this.s.counter('toilet');
    if (t) rows.push([`Giant sock key dry cleaning x${t}`, -2 * t]);
    if (c.crumpled) rows.push([`Ironing surcharge x${c.crumpled}`, -0.8 * c.crumpled]);
    if (c.wrongCubby + c.unfolded) rows.push([`Creative filing fee x${c.wrongCubby + c.unfolded}`, -1 * (c.wrongCubby + c.unfolded)]);
    if (c.shrunkMade) rows.push([`Doll-size alterations x${c.shrunkMade}`, -1.5 * c.shrunkMade]);
    if (c.walkouts) rows.push([`Refunds for waiting x${c.walkouts}`, -2 * c.walkouts]);
    if (c.lostSocks) rows.push([`Sock loss insurance x${c.lostSocks}`, -0.5 * c.lostSocks]);
    if (c.sheetsTried) rows.push(['Fitted sheet hazard pay', 0.01]);
    if (c.lintEaten) rows.push([`Lint recycling bonus x${c.lintEaten}`, 0.02 * c.lintEaten]);
    return rows;
  }

  // ---------------------------------------------------------------- machines

  private freeTicket(): number {
    const claimed = new Set(this.customers.filter((c) => c.state !== 'gone').map((c) => c.ticket));
    const free: number[] = [];
    for (const [n, set] of this.tickets) if (!set.size && !claimed.has(n) && !this.level.cubbySlots[n].items.length) free.push(n);
    if (free.length) return pick(free);
    // Everything is taken: the same customer gets a second load.
    const inMachines = new Set(this.units.map((u) => u.ticket));
    const reuse = [...this.tickets.keys()].filter((n) => !inMachines.has(n));
    return reuse.length ? pick(reuse) : 0;
  }

  /** Puts a fresh load into an empty unit. Returns false if all tickets are in use. */
  private loadUnit(u: Unit): boolean {
    const ticket = this.freeTicket();
    if (!ticket) return false;
    const load: Garment[] = [];
    const n = 2 + (Math.random() < 0.4 ? 1 : 0);
    for (let k = 0; k < n; k++) load.push(newGarment(pick(CLOTHES), ticket));
    const r = Math.random();
    if (r < 0.55) {
      const spec = KINDS.sock;
      const p = spec.patterns[Math.floor(Math.random() * spec.patterns.length)];
      const col = spec.colors[Math.floor(Math.random() * spec.colors.length)];
      load.push(newGarment('sock', ticket, false, p, col), newGarment('sock', ticket, false, p, col));
    } else if (r < 0.8) {
      load.push(newGarment('sock', ticket));
    }
    const t = this.s ? this.s.t : 0;
    if (t > 35 && t - this.lastSheetT > 50 && Math.random() < 0.35) {
      this.lastSheetT = t;
      load.splice(1, 0, newGarment('sheet', ticket));
    }
    u.load = load;
    u.ticket = ticket;
    u.shrunk = false;
    u.state = 'wash';
    u.t = WASH;
    const set = this.tickets.get(ticket)!;
    for (const g of load) set.add(g);
    return true;
  }

  private updateUnits(dt: number): void {
    const s = this.s;
    for (const u of this.units) {
      const parts = this.level.units[u.i];
      if (u.state === 'wash' || u.state === 'dry') {
        u.t -= dt;
        if (u.t <= 0) {
          if (u.state === 'wash') {
            if (u.temp === 'HOT') {
              u.shrunk = true;
              for (const g of u.load) g.shrunk = true;
              this.c.shrunkMade += u.load.length;
            }
            u.state = 'dry';
            u.t = DRY;
          } else {
            u.state = 'done';
            if (s.player.pos.distanceTo(parts.front) < 20) {
              s.sfx.buzz();
              s.sfx.tone(880, 0.25, 'square', 0.05, undefined, 0.3);
            }
          }
        }
      } else if (u.state === 'empty') {
        u.t -= dt;
        if (u.t <= 0 && !this.loadUnit(u)) u.t = 3;
      }
      parts.group.userData.drying = u.state === 'dry';
      const spinW = u.state === 'wash' ? 6 : 0;
      const spinD = u.state === 'dry' ? 3.5 : 0;
      parts.washDrum.rotation.z += dt * spinW;
      parts.dryDrum.rotation.z -= dt * spinD;
      parts.washDrum.visible = u.state === 'wash' || u.state === 'empty' ? u.state === 'wash' : false;
      parts.dryDrum.visible = u.state === 'dry' || u.state === 'done';
      const flash = u.state === 'done' ? (Math.sin(s.t * 8) > 0 ? '#40ff60' : '#103a18') : u.temp === 'HOT' && u.state === 'wash' ? (Math.sin(s.t * 5) > 0 ? '#ff3b30' : '#3a1010') : '#334433';
      if (this.fun.party > 0) parts.beacon.color.setHSL((s.t * 1.5 + u.i / 6) % 1, 1, 0.55);
      else parts.beacon.color.set(flash);
      parts.dialMat.color.set(TEMP_COLOR[u.temp]);
      parts.dial.rotation.z = -(TEMPS.indexOf(u.temp) - 1) * 0.9;
      u.drawAcc += dt;
      if (u.drawAcc > 0.25) {
        u.drawAcc = 0;
        this.drawUnit(u);
      }
    }
  }

  private drawUnit(u: Unit): void {
    const { ctx, tex } = this.level.units[u.i].screen;
    ctx.fillStyle = '#071108';
    ctx.fillRect(0, 0, 128, 48);
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    const blink = Math.floor(performance.now() / 400) % 2 === 0;
    let line1 = '';
    let col = '#7cff9a';
    if (u.state === 'wash') line1 = `WASH ${Math.ceil(u.t)}s`;
    else if (u.state === 'dry') line1 = `DRY  ${Math.ceil(u.t)}s`;
    else if (u.state === 'done') {
      line1 = blink ? 'DONE!' : '';
      col = '#ffe14d';
    } else line1 = 'LOADING';
    ctx.fillStyle = col;
    ctx.fillText(line1, 6, 16);
    ctx.fillStyle = TEMP_COLOR[u.temp];
    ctx.fillText(u.temp, 6, 30);
    ctx.fillStyle = '#b9a47c';
    ctx.fillText(u.ticket && u.state !== 'empty' ? `#${u.ticket}` : '', 70, 30);
    ctx.fillStyle = '#7cff9a';
    if (u.state === 'done') ctx.fillText(`x${u.load.length} items`, 6, 43);
    else if (u.shrunk) {
      ctx.fillStyle = '#ff3b30';
      ctx.fillText('SHRUNK', 6, 43);
    }
    tex.needsUpdate = true;
  }

  private takeFromDryer(u: Unit): void {
    const s = this.s;
    if (u.state !== 'done') {
      const left = u.state === 'empty' ? 'It is empty. The auto-loader is thinking about it.' : `Still ${u.state === 'wash' ? 'washing' : 'drying'}. ${Math.ceil(u.t)} seconds. Staring at it does not help. Brad says it does.`;
      s.say(left, 2.5);
      return;
    }
    const g = u.load.shift();
    if (!g) return;
    const it = s.addItem(garmentDef(g), new THREE.Vector3(0, -10, 0));
    this.garments.set(it, g);
    g.item = it;
    s.pickUp(it);
    s.sfx.whoosh();
    if (g.kind === 'sheet') {
      s.say('A fitted sheet. It is warm and it hates you.', 3);
      s.chat('sheet', {}, 2);
      s.bossSay('fittedSheet', true);
      s.hype += 6;
    } else if (g.shrunk) {
      s.say(`${garmentName(g)}. It was not this small when it went in.`, 3);
      s.chat('shrunk');
      s.hype += 5;
      if (s.seen) s.bossSay('shrunk');
    } else if (g.kind === 'sock' && !u.load.some((o) => o.kind === 'sock')) {
      const partner = this.garmentsOfTicket(g.ticket).some((o) => o !== g && o.kind === 'sock' && o.stage === 'single');
      if (!partner) s.say('A single sock. Its partner is in another dimension.', 2.5);
    }
    if (Math.random() < 0.4) this.addLint(this.level.units[u.i].front.clone().add(new THREE.Vector3(rand(-0.6, 0.6), 0, rand(-0.2, 0.5))));
    if (!u.load.length) {
      u.state = 'empty';
      u.t = rand(3, 6);
      u.ticket = 0;
    }
    this.drawUnit(u);
  }

  private turnDial(u: Unit, by: 'player' | 'kid'): void {
    const s = this.s;
    const next = by === 'kid' ? 'HOT' : TEMPS[(TEMPS.indexOf(u.temp) + 1) % 3];
    u.temp = next;
    this.drawUnit(u);
    if (by === 'kid') return;
    s.sfx.click();
    if (next === 'HOT') {
      this.c.hotSets++;
      s.hype += 6;
      s.chat('hot');
      s.say(u.state === 'wash' ? `Washer ${u.i + 1} is now on HOT. Whatever is inside is about to become doll-sized.` : `Washer ${u.i + 1} set to HOT. The next load will be tiny.`, 3);
      if (s.seen) {
        s.annoyance += 12;
        s.bossSay('hotSeen', true);
      }
    } else {
      s.say(`Washer ${u.i + 1} set to ${next}.`, 1.8);
    }
  }

  // ---------------------------------------------------------------- folding

  private startFold(table: number): void {
    const s = this.s;
    const it = s.held!;
    const g = this.garments.get(it)!;
    const t = TABLES[table];
    const spread = buildSpread(g);
    spread.group.position.set(t.x - 0.1, TABLE_Y, t.z + 0.05);
    spread.group.rotation.y = rand(-0.08, 0.08);
    s.scene.add(spread.group);
    it.mesh.visible = false;
    const fitted = g.kind === 'sheet';
    const steps = KINDS[g.kind].steps;
    const seq = Array.from({ length: steps }, () => Math.floor(Math.random() * 4));
    this.fold = {
      table, g, item: it, seq, idx: 0, mistakes: 0, t: 0,
      limit: fitted ? 15 : 3 + steps * 1.3,
      spread, fitted, lucky: fitted && Math.random() < 0.05, shuffle: 0.9, done: false,
    };
    s.movementLocked = true;
    s.sfx.click();
    if (fitted) {
      this.c.sheetsTried++;
      s.chat('sheet', {}, 2);
    }
    this.showPanel();
  }

  private showPanel(): void {
    const f = this.fold;
    if (!f) return;
    const prog = f.idx / f.seq.length;
    const w = (30 + (1 - prog) * (f.spread.w * 100 - 30)).toFixed(1);
    const d = (30 + (1 - prog) * (f.spread.d * 100 - 30)).toFixed(1);
    this.panel.show({
      title: f.fitted ? 'FOLD-O-MATIC ASSIST  !! FITTED SHEET !!' : 'FOLD-O-MATIC ASSIST v0.3',
      name: `${garmentName(f.g).toUpperCase()}  #${f.g.ticket || '?'}`,
      seq: f.seq,
      idx: f.idx,
      timeFrac: 1 - f.t / f.limit,
      size: f.fitted && !f.lucky ? `${w} x ${d} cm  (it keeps changing)` : `${w} x ${d} cm  target 30.0 x 30.0`,
      help: f.mistakes ? `wrinkles: ${f.mistakes}   ARROWS or 1 2 3 4   E: give up` : 'ARROWS or 1 2 3 4   E: give up',
      sheet: f.fitted,
    });
  }

  private onKey(e: KeyboardEvent): void {
    const f = this.fold;
    if (!f || f.done || !document.pointerLockElement || e.repeat) return;
    const dir = KEYMAP[e.code];
    if (dir === undefined) return;
    e.preventDefault();
    const s = this.s;
    if (dir === f.seq[f.idx]) {
      f.idx++;
      s.sfx.tone(500 + f.idx * 90, 0.06, 'square', 0.06);
      if (f.fitted && !f.lucky && f.idx < f.seq.length && Math.random() < 0.45) {
        // the elastic snaps back
        f.idx = Math.max(0, f.idx - 2);
        if (f.seq.length < 12) f.seq.push(Math.floor(Math.random() * 4));
        s.say(pick(['The elastic snaps back.', 'A corner turns itself inside out.', 'The sheet un-folds itself. Out of spite.', 'The sheet is now a different shape.']), 1.6);
        s.sfx.tone(300, 0.2, 'sawtooth', 0.06, 120);
      }
      if (f.idx >= f.seq.length) this.finishFold(f.mistakes >= 2 ? 'crumpled' : 'neat');
    } else {
      f.mistakes++;
      this.panel.bad();
      s.sfx.buzz();
      f.spread.group.rotation.y += rand(-0.3, 0.3);
      if (f.mistakes >= (f.fitted ? 4 : 3)) this.finishFold('crumpled');
    }
    if (this.fold) this.showPanel();
  }

  private updateFold(dt: number): void {
    const f = this.fold;
    if (!f) return;
    const s = this.s;
    this.panel.tick(dt);
    if (s.held !== f.item) {
      this.cancelFold();
      return;
    }
    f.t += dt;
    // shrink the spread garment towards 30 x 30 as the folds progress
    const prog = f.idx / f.seq.length;
    const g = f.spread.group;
    const base = f.g.shrunk ? 0.42 : 1;
    const tx = base * (1 - prog * (1 - Math.min(1, 0.3 / f.spread.w)));
    const tz = base * (1 - prog * (1 - Math.min(1, 0.3 / f.spread.d)));
    g.scale.x += (tx - g.scale.x) * Math.min(1, dt * 12);
    g.scale.z += (tz - g.scale.z) * Math.min(1, dt * 12);
    g.scale.y += (base * (1 + prog * 3) - g.scale.y) * Math.min(1, dt * 12);
    if (f.fitted && !f.lucky) {
      g.scale.x *= 1 + Math.sin(s.t * 23) * 0.02;
      f.shuffle -= dt;
      if (f.shuffle <= 0) {
        f.shuffle = 0.9;
        for (let i = f.idx; i < f.seq.length; i++) f.seq[i] = Math.floor(Math.random() * 4);
      }
    }
    if (f.t >= f.limit) {
      this.finishFold('crumpled');
      return;
    }
    this.showPanel();
  }

  private finishFold(result: 'neat' | 'crumpled'): void {
    const f = this.fold;
    if (!f) return;
    f.done = true;
    const s = this.s;
    s.scene.remove(f.spread.group);
    this.fold = null;
    s.movementLocked = false;
    this.panel.hide();
    const g = f.g;
    s.removeHeld();
    this.garments.delete(f.item);
    g.stage = result;
    const it = s.addItem(garmentDef(g), new THREE.Vector3(0, -10, 0));
    this.garments.set(it, g);
    g.item = it;
    s.pickUp(it);
    const near = !s.boss.offline && (s.seen || s.boss.horizontalDist(s.player.pos) < 7);
    if (result === 'neat') {
      this.c.neat++;
      s.sfx.ding();
      if (f.fitted) {
        this.c.sheetsWon++;
        s.achieve('fittedSheet');
        s.hype += 40;
        s.chat('sheetWin', {}, 4);
        s.bossSay('fittedSheetWin', true);
        s.say('The fitted sheet is folded. 30.0 by 30.0. Somewhere, a physicist weeps.', 4);
      } else {
        s.annoyance = Math.max(0, s.annoyance - 4);
        if (near) s.bossSay('measure');
        if (Math.random() < 0.3) s.chat('fold');
      }
    } else {
      this.c.crumpled++;
      s.hype += 8;
      s.chat(f.fitted ? 'sheetFail' : 'crumple');
      s.say(f.fitted ? 'You folded the fitted sheet the traditional way. Into a ball.' : `You folded the ${KINDS[g.kind].name.toLowerCase()} into a lump. It still has a ticket.`, 3);
      if (s.seen && !f.fitted) {
        s.annoyance += 20;
        s.boss.confront();
        s.bossSay('crumpled', true);
      }
    }
  }

  /** Walked away, dropped it or gave up: the garment comes back unfolded. */
  private cancelFold(): void {
    const f = this.fold;
    if (!f) return;
    this.s.scene.remove(f.spread.group);
    f.item.mesh.visible = true;
    this.fold = null;
    this.s.movementLocked = false;
    this.panel.hide();
  }

  // ---------------------------------------------------------------- cubbies, socks, bins

  private placeInCubby(n: number): void {
    const s = this.s;
    const it = s.held!;
    const g = this.garments.get(it);
    const slot = this.level.cubbySlots[n];
    if (!g) {
      s.say(it.def.toiletKey ? 'The sock does not fit. It barely fits in this building.' : 'Only laundry goes in the cubbies. Brad checks.', 2.5);
      return;
    }
    if (slot.items.length >= 5) {
      s.say(`Cubby ${n} is full. Customers are slow today. Blame them.`, 2.5);
      return;
    }
    s.detachHeld();
    s.scene.add(it.mesh);
    it.mesh.visible = true;
    it.state = 'shelf';
    it.sleeping = false;
    it.vel.set(0, 0, 0);
    const h = slot.items.reduce((a, o) => a + (this.garments.get(o)?.stage === 'dry' ? 0.12 : 0.075), 0);
    it.mesh.position.set(slot.pos.x + rand(-0.04, 0.04), slot.pos.y + h, slot.pos.z);
    it.mesh.rotation.set(0, rand(-0.15, 0.15), 0);
    slot.items.push(it);
    g.cubby = n;
    g.sniffed = false;
    s.sfx.click();
    if (g.ticket === n && isFolded(g)) {
      if (!g.counted) {
        g.counted = true;
        this.c.delivered++;
      }
      s.sfx.ding();
      s.annoyance = Math.max(0, s.annoyance - 5);
      if (s.seen && Math.random() < 0.3) s.bossSay('correctSeen');
      if (this.c.delivered >= QUOTA && !this.quotaToast) {
        this.quotaToast = true;
        s.hud.toast('QUOTA REACHED', 'Brad has raised your quota. Congratulations. The fitted sheet is still waiting.', 'corp');
      }
      return;
    }
    if (g.ticket === n) {
      this.c.unfolded++;
      s.hype += 6;
      s.say(g.stage === 'single' ? 'One sock, filed. Its partner can find its own way.' : `You stuff the unfolded ${KINDS[g.kind].name.toLowerCase()} into the cubby. It is technically filed.`, 3);
      if (s.seen) {
        s.annoyance += 15;
        s.bossSay('crumpled');
      }
      return;
    }
    this.c.wrongCubby++;
    s.hype += 9;
    s.chat('wrongCubby', { t: String(g.ticket || '?'), n: String(n) });
    if (s.seen) {
      s.annoyance += 25;
      s.boss.confront();
      s.bossSay('wrongCubby', true);
    }
  }

  private takeFromCubby(it: Item): void {
    const g = this.garments.get(it);
    if (!g || g.cubby === null) return;
    const slot = this.level.cubbySlots[g.cubby];
    slot.items = slot.items.filter((o) => o !== it);
    if (g.counted) {
      g.counted = false;
      this.c.delivered--;
    }
    g.cubby = null;
    this.s.pickUp(it);
  }

  private trayPlace(): void {
    const s = this.s;
    const it = s.held!;
    const g = this.garments.get(it);
    if (!g || g.stage !== 'single') {
      s.say(g && g.kind === 'sock' ? 'These socks are already a couple. Leave them alone.' : 'The sock table is for single socks only. It is a sad table.', 2.5);
      return;
    }
    const free = this.level.tray.slots.filter((sl) => !sl.item);
    if (!free.length) {
      s.say('The sock tray is full. Pair some socks. Or lose some.', 2.5);
      return;
    }
    free.sort((a, b) => a.pos.distanceTo(s.player.pos) - b.pos.distanceTo(s.player.pos));
    const sl = free[0];
    s.detachHeld();
    s.scene.add(it.mesh);
    it.state = 'shelf';
    it.mesh.position.copy(sl.pos);
    it.mesh.rotation.set(0, rand(-0.3, 0.3), 0);
    sl.item = it;
    s.sfx.click();
  }

  /** Holding a single sock and using it on another single sock: a pair, matching or "creative". */
  private pairSocks(other: Item): void {
    const s = this.s;
    const it = s.held!;
    const a = this.garments.get(it)!;
    const b = this.garments.get(other)!;
    this.freeTraySlot(other);
    s.removeItem(other);
    this.garments.delete(other);
    this.dropGarment(b);
    s.removeHeld();
    this.garments.delete(it);
    const match = a.pattern === b.pattern && a.colors[0] === b.colors[0] && a.colors[1] === b.colors[1];
    a.stage = match ? 'pair' : 'creative';
    a.pattern2 = b.pattern;
    a.colors2 = b.colors;
    a.shrunk = a.shrunk || b.shrunk;
    if (!a.ticket && b.ticket) {
      this.tickets.get(b.ticket)!.add(a);
      a.ticket = b.ticket;
    }
    const ni = s.addItem(garmentDef(a), new THREE.Vector3(0, -10, 0));
    this.garments.set(ni, a);
    a.item = ni;
    s.pickUp(ni);
    if (match) {
      this.c.pairs++;
      s.sfx.ding();
      s.say(`A perfect pair of ${patternName(a.pattern).toLowerCase()} socks. Love is real.`, 2.5);
      if (Math.random() < 0.5) s.chat('sockPair');
    } else {
      this.c.creative++;
      s.hype += 10;
      s.say(`A ${patternName(a.pattern).toLowerCase()} sock and a ${patternName(b.pattern).toLowerCase()} sock. A creative pair.`, 3);
      s.chat('creativePair', {}, 2);
      if (this.c.creative >= 3) s.achieve('fashion');
      if (s.seen) {
        s.annoyance += 12;
        s.bossSay('creativePair', true);
      }
    }
  }

  private freeTraySlot(it: Item): void {
    for (const sl of this.level.tray.slots) if (sl.item === it) sl.item = null;
  }

  private lostBin(): void {
    const s = this.s;
    const it = s.held;
    if (!it) {
      const g = newGarment('sock', 0);
      const ni = s.addItem(garmentDef(g), new THREE.Vector3(0, -10, 0));
      this.garments.set(ni, g);
      g.item = ni;
      s.pickUp(ni);
      this.c.binDives++;
      s.say(pick(['You fish out a sock from 2049. It is still warm. Somehow.', 'You pull out a single sock. It has seen things.', 'A vintage single sock. Its partner left in 2049.']), 3);
      s.hype += 2;
      return;
    }
    const g = this.garments.get(it);
    if (!g || g.kind !== 'sock') {
      s.say('Only socks get lost. Everything else gets folded.', 2.5);
      return;
    }
    s.removeHeld();
    this.garments.delete(it);
    this.dropGarment(g);
    this.c.lostSocks++;
    s.hype += 5;
    s.sfx.whoosh();
    s.chat('lostSock');
    s.say(g.stage === 'single' ? 'Sock declared lost. The paperwork is easier than the search.' : 'You declare a whole pair of socks lost. Ambitious.', 2.5);
    if (s.seen) s.bossSay('lostSock', true);
    const p = this.level.lostBinPile;
    p.position.y = Math.min(0.25, p.position.y + 0.01);
  }

  private ringBell(): void {
    const s = this.s;
    this.c.playerBells++;
    this.bellSound();
    s.say(pick(L.PLAYER_BELL), 3);
    s.chat('bell');
    s.hype += 1;
    const waiting = this.customers.find((c) => c.state === 'wait');
    if (waiting) waiting.say('Why are YOU ringing the bell? I am the customer.', 3);
    this.fun.onBell();
  }

  private bellSound(): void {
    const s = this.s;
    s.sfx.tone(2093, 0.5, 'sine', 0.08);
    s.sfx.tone(2637, 0.4, 'sine', 0.04, undefined, 0.01);
    const b = this.level.bellMesh;
    b.scale.y = 0.8;
    setTimeout(() => (b.scale.y = 1), 120);
  }

  /** The garment left the game (vacuumed, eaten, lost, removed). */
  private dropGarment(g: Garment): void {
    this.tickets.get(g.ticket)?.delete(g);
  }

  private garmentsOfTicket(t: number): Garment[] {
    return [...(this.tickets.get(t) ?? [])];
  }

  // ---------------------------------------------------------------- the player's actions

  interact(look: Look | null): boolean {
    const s = this.s;
    if (this.fold) {
      this.cancelFold();
      s.say('You give up and pick it up again, still unfolded. Brad saw nothing. Probably.', 2.5);
      return true;
    }
    if (this.fun.interact(look)) return true;
    const info = look?.info as LInteract | undefined;
    const held = s.held;
    const hg = held ? this.garments.get(held) : undefined;
    if (!info) return false;
    switch (info.kind) {
      case 'dryer':
        if (held) {
          s.say('Your hands are full. Robots have more hands. That is why they do not work here.', 2.5);
          return true;
        }
        this.takeFromDryer(this.units[info.unit!]);
        return true;
      case 'washer':
        this.turnDial(this.units[info.unit!], 'player');
        return true;
      case 'table': {
        if (!held) {
          s.say('A folding table. Bring dry laundry from the machines.', 2.5);
          return true;
        }
        if (!hg) return false;
        if (hg.stage === 'dry') {
          this.startFold(info.table!);
          return true;
        }
        if (hg.kind === 'sock' && hg.stage === 'single') {
          s.say('Socks are paired at the SOCK MATCHING table. Single socks only fold emotionally.', 2.5);
          return true;
        }
        s.say('It is already folded. Folding it again would only make it smaller. Brad measures.', 2.5);
        return true;
      }
      case 'sockTray':
        if (!held) {
          s.say('The sock matching table. Put single socks here and pair them by pattern.', 2.5);
          return true;
        }
        this.trayPlace();
        return true;
      case 'lostBin':
        this.lostBin();
        return true;
      case 'cubby':
        if (held) {
          this.placeInCubby(info.cubby!);
          return true;
        }
        {
          const items = this.level.cubbySlots[info.cubby!].items;
          if (items.length) this.takeFromCubby(items[items.length - 1]);
          else s.say(`Cubby ${info.cubby}. Empty. Like a weekend.`, 2);
        }
        return true;
      case 'bell':
        this.ringBell();
        return true;
      case 'bot':
        this.talkTo(info.bot as Bot);
        return true;
      case 'item': {
        const it = info.item!;
        const g = this.garments.get(it);
        if (!g) return false;
        if (held && hg && hg.stage === 'single' && g.stage === 'single' && it !== held) {
          this.pairSocks(it);
          return true;
        }
        if (g.cubby !== null) {
          if (held) this.placeInCubby(g.cubby);
          else this.takeFromCubby(it);
          return true;
        }
        if (!held && this.level.tray.slots.some((sl) => sl.item === it)) {
          this.freeTraySlot(it);
          s.pickUp(it);
          return true;
        }
        if (held && this.level.tray.slots.some((sl) => sl.item === it)) {
          this.trayPlace();
          return true;
        }
        return false;
      }
    }
    return false;
  }

  hint(look: Look | null): string | null {
    const s = this.s;
    if (this.fold) return 'ARROWS or 1 2 3 4: fold  ·  E: give up';
    const fh = this.fun.hint(look);
    if (fh !== null) return fh;
    const info = look?.info as LInteract | undefined;
    if (!info) return null;
    const held = s.held;
    const hg = held ? this.garments.get(held) : undefined;
    switch (info.kind) {
      case 'dryer': {
        const u = this.units[info.unit!];
        if (u.state === 'done') return held ? 'Hands full' : `E: take laundry (#${u.ticket}, ${u.load.length} left)`;
        return `Machine ${u.i + 1}: ${u.state === 'empty' ? 'loading' : `${u.state === 'wash' ? 'washing' : 'drying'} ${Math.ceil(u.t)} s`}  ·  ${u.temp} dial on the washer below`;
      }
      case 'washer': {
        const u = this.units[info.unit!];
        return `E: dial ${u.temp} > ${TEMPS[(TEMPS.indexOf(u.temp) + 1) % 3]}`;
      }
      case 'table':
        if (hg?.stage === 'dry') return `E: fold ${hg.kind === 'sheet' ? 'the FITTED SHEET' : garmentName(hg)}`;
        return held ? 'Folding table' : 'Folding table (bring dry laundry)';
      case 'sockTray':
        return hg?.stage === 'single' ? 'E: put the sock on the tray' : 'Sock matching table';
      case 'lostBin':
        return hg?.kind === 'sock' ? 'E: declare the sock lost' : held ? 'LOST SOCKS' : 'E: dig in the LOST SOCKS';
      case 'cubby': {
        const n = info.cubby!;
        const items = this.level.cubbySlots[n].items;
        if (held) return hg ? `E: file in cubby ${n}${hg.ticket ? ` (ticket ${hg.ticket})` : ''}` : `Cubby ${n}`;
        return items.length ? `E: take from cubby ${n}` : `Cubby ${n}`;
      }
      case 'bell':
        return 'E: ring the bell';
      case 'bot': {
        const b = info.bot as Bot;
        if (b instanceof LaundryCustomer && hg) return `E: hand it to ${b.name}`;
        if (b instanceof Vacuum && hg?.kind === 'sock') return 'E: feed the sock to the vacuum';
        if (b instanceof Inspector && hg) return 'E: let Q-8 sniff it';
        return `E: talk to ${b.name}`;
      }
      case 'item': {
        const it = info.item!;
        const g = this.garments.get(it);
        if (!g) return null;
        if (hg?.stage === 'single' && g.stage === 'single' && it !== held) return `E: pair with the ${patternName(g.pattern).toLowerCase()} sock`;
        if (g.cubby !== null) return held ? `E: file in cubby ${g.cubby}` : `E: take ${garmentName(g)} from cubby ${g.cubby}`;
        return null;
      }
    }
    return null;
  }

  private talkTo(b: Bot): void {
    const s = this.s;
    const held = s.held;
    const hg = held ? this.garments.get(held) : undefined;
    if (b.fallen > 0) {
      s.say(`${b.name} is busy lying on the floor.`, 2);
      return;
    }
    if (b instanceof LaundryCustomer) {
      if (hg && held) {
        s.removeHeld();
        this.garments.delete(held);
        this.dropGarment(hg);
        if (hg.ticket === b.ticket) {
          this.c.handed++;
          if (!hg.counted && isFolded(hg)) {
            hg.counted = true;
            this.c.delivered++;
          }
          b.say(isBad(hg) || !isFolded(hg) ? pick(hg.shrunk ? L.SHRUNK : L.CRUMPLED) : pick(L.HANDED), 3.5);
          if (hg.shrunk) this.shrunkDelivered();
          if (!isFolded(hg)) {
            this.complaint(b);
          } else if (!this.garmentsOfTicket(b.ticket).length && !this.level.cubbySlots[b.ticket].items.length) {
            this.customerDone(b, true);
          }
        } else {
          b.say(pick(L.NOT_MINE), 3.5);
          s.hype += 6;
          this.c.wrongCubby++;
        }
        return;
      }
      b.say(b.state === 'wait' ? fill(pick(L.WAIT), { t: String(b.ticket) }) : 'I am busy being a customer.', 3);
      return;
    }
    if (b instanceof Vacuum) {
      if (hg && held && hg.kind === 'sock') {
        s.removeHeld();
        this.garments.delete(held);
        this.dropGarment(hg);
        this.c.vacuumed++;
        s.sfx.whoosh();
        b.say(pick(L.VACUUM_SOCK), 2.5);
        s.chat('vacuum');
        s.hype += 6;
        return;
      }
      b.say(pick(L.VACUUM_TALK), 3);
      return;
    }
    if (b instanceof Inspector) {
      if (hg) {
        b.sniff = 2;
        b.act('talk', 1.5);
        if (isBad(hg) || !isFolded(hg)) {
          b.say(hg.shrunk ? L.INSPECTOR_SHRUNK[0] : pick(L.INSPECTOR_BAD), 3.5);
          this.report();
        } else b.say(pick(L.INSPECTOR_GOOD), 3);
        return;
      }
      b.say(pick(L.INSPECTOR_TALK), 3.5);
      return;
    }
    if (b instanceof Kid) {
      b.say(pick(L.KID_TALK), 3);
      return;
    }
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number): void {
    const s = this.s;
    this.updateUnits(dt);
    this.updateFold(dt);
    this.updateCustomers(dt);
    for (const b of this.bots()) b.update(dt, this.ctx);
    this.separate();
    this.updateSlips();
    this.fun.update(dt);
    this.cleanupAcc += dt;
    if (this.cleanupAcc > 1) {
      this.cleanupAcc = 0;
      for (const [it, g] of this.garments) {
        if (it.state === 'gone') {
          this.garments.delete(it);
          if (g.item === it) {
            this.dropGarment(g);
            if (g.cubby !== null) {
              const slot = this.level.cubbySlots[g.cubby];
              slot.items = slot.items.filter((o) => o !== it);
            }
          }
        }
      }
    }
    void s;
  }

  private separate(): void {
    const bs = this.bots();
    for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i];
        const b = bs[j];
        if (a.ghost > 0 || b.ghost > 0) continue;
        let dx = b.pos.x - a.pos.x;
        let dz = b.pos.z - a.pos.z;
        let d = Math.hypot(dx, dz);
        const min = a.radius + b.radius;
        if (d >= min) continue;
        if (d < 1e-4) {
          dx = Math.random() - 0.5;
          dz = Math.random() - 0.5;
          d = Math.hypot(dx, dz);
        }
        const nx = dx / d;
        const nz = dz / d;
        const o = (min - d) / 2;
        const aW = a instanceof LaundryCustomer && a.state === 'wait' ? 0.1 : 1;
        const bW = b instanceof LaundryCustomer && b.state === 'wait' ? 0.1 : 1;
        a.pos.x -= nx * o * aW;
        a.pos.z -= nz * o * aW;
        b.pos.x += nx * o * bW;
        b.pos.z += nz * o * bW;
      }
    }
    for (const b of bs) for (const c of this.level.colliders) if (!c.disabled) pushOutCircle(b.pos, b.radius, c);
  }

  private updateSlips(): void {
    const s = this.s;
    for (const b of this.bots()) {
      if (b instanceof Vacuum || b.fallen > 0 || b.slipCooldown > 0) continue;
      if (b instanceof Kid && b.state === 'ride') continue;
      for (const pd of s.puddles) {
        if (Math.hypot(pd.x - b.pos.x, pd.z - b.pos.z) < pd.r) {
          b.fall(3);
          b.say(pick(['I am fine. I am suing.', 'My warranty does not cover floors.', 'Wet floor. No sign. Interesting.']), 3);
          b.slipCooldown = 12;
          this.c.slips++;
          s.hype += 18;
          s.sfx.slip();
          s.achieve('slip');
          s.chat('slip', {}, 2);
          break;
        }
      }
    }
  }

  thrownHit(it: Item): boolean {
    const s = this.s;
    const p = it.mesh.position;
    for (const b of this.bots()) {
      if (b.fallen > 0) continue;
      const r = b instanceof Kid ? 0.55 : b.radius;
      if (Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < r + 0.15 && p.y < b.height + 0.4) {
        it.vel.multiplyScalar(-0.3);
        it.thrown = false;
        b.fall(2.5);
        b.say(b instanceof Vacuum ? 'Bonk. Rebooting. Still hungry.' : b instanceof Inspector ? 'Assault on quality control. Smell report filed.' : pick(['Ow. Filing a complaint. In triplicate.', 'Was that customer service?', 'I felt that in my firmware.']), 3);
        this.c.hits++;
        s.hype += 14;
        s.sfx.thud();
        s.chat('hitCustomer', {}, 2);
        s.achieve('customer');
        if (b instanceof Inspector) this.report();
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- customers

  private updateCustomers(dt: number): void {
    const s = this.s;
    this.nextCustomer -= dt;
    const active = this.customers.filter((c) => c.state === 'enter' || c.state === 'wait');
    if (this.nextCustomer <= 0 && active.length < 3) {
      this.nextCustomer = rand(14, 22);
      this.spawnCustomer();
    }
    for (const c of this.customers) {
      if (c.state === 'wait' && c.fallen <= 0) {
        const slot = this.level.cubbySlots[c.ticket];
        if (c.waited < 0.1) {
          c.say(fill(pick(c.kind === 'karen' ? L.ARRIVE_KAREN : c.kind === 'influencer' ? L.ARRIVE_INFLUENCER : L.ARRIVE), { t: String(c.ticket) }), 4);
          if (c.kind === 'influencer') s.chat('filming', {}, 2);
          this.bellSound();
          this.c.bellRings++;
        }
        if (slot.items.length) {
          c.ready += dt;
          if (c.ready > 1.5) this.pickupCubby(c);
          continue;
        }
        c.ready = 0;
        c.talkTimer -= dt;
        if (c.talkTimer <= 0) {
          c.talkTimer = rand(10, 16);
          if (s.player.pos.distanceTo(c.pos) < 12) c.say(fill(pick(L.WAIT), { t: String(c.ticket) }), 3.5);
        }
        if (c.waited > (c.kind === 'karen' ? 4 : 15)) {
          c.bellTimer -= dt;
          if (c.bellTimer <= 0) {
            c.bellTimer = c.kind === 'karen' ? rand(4, 6) : rand(8, 12);
            this.bellSound();
            this.c.bellRings++;
            c.act('act', 1);
            c.say(fill(pick(L.BELL_LINES), { t: String(c.ticket) }), 2.5);
            if (Math.random() < 0.35) s.chat('bell');
            if (c.kind === 'karen' && !s.boss.offline && Math.random() < 0.3) this.complaint(c);
          }
        }
        if (c.waited > c.patience && c.got > 0) {
          c.say('I will come back for the rest. Or send a drone.', 3.5);
          this.customerDone(c, true);
        } else if (c.waited > c.patience) {
          c.say(pick(L.ANGRY_LEAVE), 4);
          this.c.walkouts++;
          s.hype += 8;
          s.chat('angry');
          this.complaint(c);
          c.leave(s.nav);
        }
      }
    }
    for (const c of this.customers.filter((x) => x.state === 'gone')) {
      s.scene.remove(c.group);
    }
    this.customers = this.customers.filter((c) => c.state !== 'gone');
  }

  private spawnCustomer(): void {
    const s = this.s;
    const claimed = new Set(this.customers.map((c) => c.ticket));
    const usedSpots = new Set(this.customers.filter((c) => c.state !== 'leave').map((c) => c.spot));
    const spot = [0, 1, 2].find((i) => !usedSpots.has(i));
    if (spot === undefined) return;
    // tickets with laundry out of the dryer first, then any open ticket
    const open: number[] = [];
    const outside: number[] = [];
    for (const [n, set] of this.tickets) {
      if (claimed.has(n)) continue;
      if (this.level.cubbySlots[n].items.length) outside.push(n, n, n);
      if (!set.size) continue;
      open.push(n);
      if ([...set].some((g) => g.item)) outside.push(n);
    }
    const t = outside.length ? pick(outside) : open.length ? pick(open) : 0;
    if (!t) {
      this.nextCustomer = 4;
      return;
    }
    const kind = this.kinds[this.kindIdx++ % this.kinds.length];
    const c = new LaundryCustomer(s.scene, kind, L.CUSTOMER_NAMES[kind] ?? 'Client-Bot', t, spot, DOOR, SPOTS[spot], s.nav);
    this.customers.push(c);
  }

  private pickupCubby(c: LaundryCustomer): void {
    const s = this.s;
    const slot = this.level.cubbySlots[c.ticket];
    const items = [...slot.items];
    slot.items = [];
    let mine = 0;
    let bad: Garment | null = null;
    let wrong = 0;
    let single = 0;
    for (const it of items) {
      const g = this.garments.get(it);
      s.removeItem(it);
      this.garments.delete(it);
      if (!g) continue;
      this.dropGarment(g);
      g.cubby = null;
      if (g.ticket !== c.ticket) wrong++;
      else mine++;
      if (g.stage === 'single') single++;
      else if (isBad(g) || !isFolded(g)) bad = bad ?? g;
      if (g.shrunk) this.shrunkDelivered();
    }
    c.act('talk', 1.5);
    c.got += items.length;
    if (bad) {
      c.say(pick(bad.shrunk ? L.SHRUNK : bad.stage === 'creative' ? L.CREATIVE : L.CRUMPLED), 4);
      if (bad.stage !== 'creative') this.complaint(c);
      else s.hype += 5;
    } else if (wrong && !mine) {
      c.say(pick(L.NOT_MINE), 4);
      s.hype += 6;
    } else if (single) {
      c.say(pick(L.SINGLE), 4);
    } else {
      c.say(pick(L.HAPPY), 4);
      if (Math.random() < 0.4) s.chat('happy');
    }
    // more of my laundry still on its way? then I wait a bit more
    if (this.garmentsOfTicket(c.ticket).length && c.waited < c.patience * 0.6) {
      c.ready = 0;
      c.patience = Math.min(c.patience, c.waited + 20);
      return;
    }
    this.customerDone(c, !bad);
  }

  private customerDone(c: LaundryCustomer, happy: boolean): void {
    if (happy) this.c.served++;
    c.leave(this.s.nav);
  }

  private complaint(c: Bot): void {
    const s = this.s;
    this.c.complaints++;
    if (s.boss.offline) return;
    if (s.boss.horizontalDist(c.pos) < 10 || s.boss.horizontalDist(s.player.pos) < 10) {
      s.annoyance += 10;
      s.bossSay('customerComplaint');
    }
  }

  private shrunkDelivered(): void {
    this.c.shrunkDelivered++;
    if (this.c.shrunkDelivered >= 3) this.s.achieve('shrinkRay');
  }

  // ---------------------------------------------------------------- vacuum

  private addLint(p: THREE.Vector3): void {
    if (this.lints.length > 14) return;
    const nav = this.s?.nav;
    if (nav && !nav.isFree(p.x, p.z)) return;
    const m = buildLint(Math.floor(Math.random() * 1000), rand(0.8, 1.3));
    m.position.x = p.x;
    m.position.z = p.z;
    m.rotation.y = Math.random() * 6;
    m.userData.interact = { kind: 'sign', text: pick(L.LINT_LINES) };
    this.level.scene.add(m);
    this.level.interactables.push(m);
    this.lints.push({ mesh: m, x: p.x, z: p.z });
  }

  private vacuumPick(v: Vacuum): void {
    const s = this.s;
    const floor = s.items.filter((i) => i.state === 'world' && i.sleeping && i.mesh.position.y < 0.6 && !i.def.fixture && i.mesh.position.distanceTo(v.pos) < 16);
    const socks = floor.filter((i) => this.garments.get(i)?.kind === 'sock');
    const near = (arr: { x: number; z: number }[]) => arr.sort((a, b) => Math.hypot(a.x - v.pos.x, a.z - v.pos.z) - Math.hypot(b.x - v.pos.x, b.z - v.pos.z))[0];
    const it = socks[0] ?? floor[0];
    if (it && Math.random() < 0.85) {
      v.target = { kind: 'item', ref: it, x: it.mesh.position.x, z: it.mesh.position.z };
      return;
    }
    if (s.puddles.length && Math.random() < 0.5) {
      const p = pick(s.puddles);
      v.target = { kind: 'puddle', ref: p, x: p.x, z: p.z };
      return;
    }
    const l = near(this.lints.map((x) => ({ x: x.x, z: x.z, l: x }))) as { x: number; z: number; l: Lint } | undefined;
    if (l && Math.random() < 0.8) v.target = { kind: 'lint', ref: l.l, x: l.x, z: l.z };
    else v.target = null;
  }

  private vacuumArrive(v: Vacuum): void {
    const s = this.s;
    const t = v.target;
    if (!t) return;
    if (Math.hypot(t.x - v.pos.x, t.z - v.pos.z) > 0.9) return;
    if (t.kind === 'item') {
      const it = t.ref as Item;
      if (it.state !== 'world') return;
      const g = this.garments.get(it);
      s.removeItem(it);
      if (g) {
        this.garments.delete(it);
        this.dropGarment(g);
      }
      this.c.vacuumed++;
      s.sfx.whoosh();
      v.say(pick(g?.kind === 'sock' ? L.VACUUM_SOCK : ['Item detected. Item consumed.', 'Vroom. That was laundry. Was.']), 2.5);
      s.chat('vacuum');
      s.hype += 6;
    } else if (t.kind === 'lint') {
      const l = t.ref as Lint;
      if (!this.lints.includes(l)) return;
      this.lints = this.lints.filter((x) => x !== l);
      this.level.scene.remove(l.mesh);
      this.level.interactables.splice(this.level.interactables.indexOf(l.mesh), 1);
      this.c.lintEaten++;
      if (Math.random() < 0.4) v.say(pick(L.VACUUM_LINT), 2.5);
    } else {
      const idx = s.puddles.indexOf(t.ref as (typeof s.puddles)[number]);
      if (idx < 0) return;
      s.removePuddle(idx);
      s.sfx.whoosh();
      v.say(pick(L.VACUUM_PUDDLE), 3);
      s.chat('roombaPuddle', {}, 2);
      s.hype += 8;
    }
  }

  // ---------------------------------------------------------------- inspector

  private inspectorPick(q: Inspector): { kind: 'cubby' | 'table' | 'player' | 'wander'; n: number; pos: THREE.Vector3 } {
    const s = this.s;
    const cubbies: number[] = [];
    for (let n = 1; n < this.level.cubbySlots.length; n++) {
      const sl = this.level.cubbySlots[n];
      if (sl?.items.some((it) => !this.garments.get(it)?.sniffed)) cubbies.push(n);
    }
    const r = Math.random();
    if (cubbies.length && r < 0.6) {
      const n = pick(cubbies);
      const p = this.level.cubbySlots[n].pos;
      return { kind: 'cubby', n, pos: new THREE.Vector3(p.x, 0, CUBBY.zFront + 0.9) };
    }
    if (r < 0.8 && s.player.pos.distanceTo(q.pos) < 14) return { kind: 'player', n: 0, pos: s.nav.snap(s.player.pos.clone()) };
    if (r < 0.92) {
      const i = Math.floor(Math.random() * TABLES.length);
      return { kind: 'table', n: i, pos: new THREE.Vector3(TABLES[i].x, 0, TABLES[i].z + 1.1) };
    }
    return { kind: 'wander', n: 0, pos: s.nav.snap(new THREE.Vector3(rand(-12, 10), 0, rand(-9, 4))) };
  }

  private inspectorArrive(q: Inspector): void {
    const s = this.s;
    const goal = q.goal;
    if (!goal) return;
    q.sniff = 2.2;
    q.act('act', 1.6);
    if (goal.kind === 'cubby') {
      q.face(0, -1, 1);
      const items = this.level.cubbySlots[goal.n].items;
      const gs = items.map((it) => this.garments.get(it)).filter((g): g is Garment => !!g && !g.sniffed);
      if (!gs.length) return;
      for (const g of gs) g.sniffed = true;
      const bad = gs.find((g) => isBad(g) || !isFolded(g) || g.ticket !== goal.n);
      if (bad) {
        q.say(bad.shrunk ? L.INSPECTOR_SHRUNK[0] : pick(L.INSPECTOR_BAD), 3.5);
        this.report();
      } else q.say(pick(L.INSPECTOR_GOOD), 3);
    } else if (goal.kind === 'player') {
      if (s.player.pos.distanceTo(q.pos) < 2.5) {
        q.face(s.player.pos.x - q.pos.x, s.player.pos.z - q.pos.z, 1);
        q.say(pick(L.INSPECTOR_PLAYER), 3);
        s.chat('inspector');
      }
    } else if (goal.kind === 'table') {
      q.face(0, -1, 1);
      q.say(pick(['*sniff* This table smells of ambition. Low ambition.', '*sniff* Fold residue detected. Acceptable.', '*sniff* Someone cried here. Over a fitted sheet.']), 3);
    }
  }

  private report(): void {
    const s = this.s;
    this.c.reports++;
    s.chat('inspector');
    s.hype += 4;
    if (s.boss.offline) return;
    s.annoyance += 12;
    s.bossSay('inspectorReport', true);
  }

  // ---------------------------------------------------------------- the robot child

  private kidPick(): { unit: number; pos: THREE.Vector3 } | null {
    const cands = this.units.filter((u) => u.temp !== 'HOT');
    if (!cands.length) return null;
    const u = pick(cands);
    return { unit: u.i, pos: this.level.units[u.i].front.clone() };
  }

  private kidTwist(k: Kid): void {
    const s = this.s;
    const u = this.units[k.unit];
    if (!u) return;
    this.turnDial(u, 'kid');
    u.kidHot = true;
    this.c.kidHots++;
    k.say(pick(L.KID_HOT), 3);
    s.sfx.click();
    if (s.player.pos.distanceTo(k.pos) < 14) s.chat('kid');
    if (!s.boss.offline && s.boss.horizontalDist(k.pos) < 12) s.bossSay('kidHot');
  }
}

