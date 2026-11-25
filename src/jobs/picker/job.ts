import * as THREE from 'three';
import type { Item, ItemDef } from '../../items';
import type { Interact } from '../../level';
import { fill, pick, pushOutCircle } from '../../util';
import type { Job, Look, Shift } from '../types';
import { BOTTLE_DEF, byId, JACK_DEF, Product, productOf, PRODUCTS } from './catalog';
import {
  ACHIEVEMENTS,
  BOSS_LINES,
  CHAT_LINES,
  COACH_ANVIL,
  COACH_BAD,
  COACH_BOOTH,
  COACH_GOOD,
  COACH_IDLE,
  COACH_JACK,
  COACH_OVERDUE,
  COACH_PACK,
  COACH_RATE,
  COACH_TALK,
  COACH_WRONG_AISLE,
  FORKLIFT_HIT,
  FORKLIFT_NAMES,
  FORKLIFT_TALK,
  KIOSK_LINES,
  PICKER_HIT,
  PICKER_TALK,
  PLACE,
  VENDING_LINES,
} from './lines';
import { aisleAt, BENCH, BOX_SLOT, bayIndex, bayNumber, binFromY, CONVEYOR, LETTERS, SPAWN } from './layout';
import { Forklift, PickerBot, RateCoach, RobotCtx } from './robots';
import { Scanner } from './scanner';
import { AIR_NEEDED, BoxSize, PackBox, SIZE_NAMES } from './station';
import { Bin, binLabel, Warehouse } from './warehouse';
import { FUN_BOSS_LINES, FUN_CHAT_LINES, PICKER_SECRETS } from './mischief';

/** Correct shipments for the quota. An average player gets there in about 4 minutes. */
export const QUOTA = 6;

interface Order {
  no: number;
  product: Product;
  bin: Bin;
  deadline: number;
  rec: BoxSize;
}

interface Shipping {
  box: PackBox;
  x: number;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class PickerJob implements Job {
  info = {
    id: 'picker',
    title: 'WAREHOUSE PICKER',
    place: PLACE,
    teaser: 'Your steps are already being counted.',
    quotaLabel: 'SHIPPED',
    lockedDoor: 'Locked. The key is on a pallet jack in the break room, far south-west. The break room is under construction. The pallet jack is not.',
    bladderWarning: 'You really need to pee. The toilet is in the far north-east corner. The key is chained to a pallet jack in the break room, far south-west.',
  };
  level: Warehouse;
  bossLines = { ...BOSS_LINES, ...FUN_BOSS_LINES };
  chatLines = { ...CHAT_LINES, ...FUN_CHAT_LINES };
  achievements = ACHIEVEMENTS;
  secrets = PICKER_SECRETS;

  private s!: Shift;
  private scanner!: Scanner;
  private ctx!: RobotCtx;
  private forklifts: Forklift[] = [];
  private coach!: RateCoach;
  private pickers: PickerBot[] = [];
  private order!: Order;
  private orderNo = 48200;
  private box: PackBox | null = null;
  private boxDef: ItemDef | null = null;
  private boxDeviation = false;
  private shipping: Shipping[] = [];
  private eDown = false;
  private pumping = false;
  private burstLatch = false;
  private progressShown = false;
  private ray = new THREE.Raycaster();
  private knockV = new THREE.Vector2();
  private dist = 0;
  private tot = 0;
  private idleT = 0;
  private wrongAisleT = 0;
  private lastAction = 0;
  private refresh = 0;
  private lastPuddles = 0;
  private coachQueue: string | null = null;
  private robotPicks = 48213;
  private shipped = 0;
  private c = {
    correct: 0,
    wrong: 0,
    empty: 0,
    badPacks: 0,
    deviations: 0,
    rips: 0,
    bursts: 0,
    mummies: 0,
    air: 0,
    tape: 0,
    tapeWasted: 0,
    forkHits: 0,
    skids: 0,
    coachHits: 0,
    botHits: 0,
    botSlips: 0,
    bottles: 0,
    kiosk: 0,
  };

  constructor(scene: THREE.Scene) {
    this.level = new Warehouse(scene);
  }

  // ---------------------------------------------------------------- setup

  start(shift: Shift): void {
    this.s = shift;
    this.scanner = new Scanner();
    const L = this.level;
    this.ctx = {
      s: shift,
      nav: shift.nav,
      colliders: L.colliders,
      doorFront: L.doorFront,
      forkliftHit: (f) => this.onForkliftHit(f),
      forkliftSkid: (f) => this.onSkid(f),
      coachLine: () => this.coachLine(),
      robotPick: () => this.robotPicks++,
      botSlip: (b) => this.onBotSlip(b),
      knock: (vx, vz) => this.knockV.add(new THREE.Vector2(vx, vz)),
      playerInBooth: () => this.inBooth(),
    };
    const routes: [THREE.Vector3, THREE.Vector3, number, string][] = [
      [new THREE.Vector3(-27.6, 0, 2.4), new THREE.Vector3(27, 0, 2.4), 0.55, '#e0a21b'],
      [new THREE.Vector3(-28.4, 0, -9.3), new THREE.Vector3(21.4, 0, -9.3), 0.3, '#d9661c'],
      [new THREE.Vector3(11.5, 0, -18.6), new THREE.Vector3(11.5, 0, -1.6), 0.7, '#c9b21b'],
    ];
    routes.forEach(([a, b, k, color], i) => {
      const f = new Forklift(shift.scene, i, a, b, color, FORKLIFT_NAMES[i]);
      f.pos.lerpVectors(a, b, k);
      this.forklifts.push(f);
    });
    this.coach = new RateCoach(shift.scene, SPAWN.clone().add(new THREE.Vector3(1.6, 0, 1.2)));
    this.pickers.push(new PickerBot(shift.scene, new THREE.Vector3(4.5, 0, 6.2), 0, shift.nav));
    this.pickers.push(new PickerBot(shift.scene, new THREE.Vector3(-4, 0, 5.4), 1, shift.nav));
    this.level.fun.start(shift, { forklifts: this.forklifts, coach: this.coach, pickers: this.pickers });
    this.newOrder();

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.code !== 'KeyE') return;
      if (down && !document.pointerLockElement) return;
      this.eDown = down;
      if (!down) this.burstLatch = false;
    };
    addEventListener('keydown', (e) => onKey(e, true));
    addEventListener('keyup', (e) => onKey(e, false));
    addEventListener('blur', () => (this.eDown = false));
  }

  // ---------------------------------------------------------------- orders

  private newOrder(): void {
    const n = this.orderNo - 48200;
    let product: Product;
    if (n === 0) product = pick([byId('duck'), byId('sock'), byId('mug')]);
    else if (n === 2) product = byId('anvil');
    else {
      const r = Math.random();
      product = r < 0.1 ? byId('anvil') : r < 0.18 ? byId('nothing') : r < 0.26 ? byId('emptybox') : pick(PRODUCTS.filter((p) => !['pk-anvil', 'pk-nothing', 'pk-emptybox'].includes(p.def.id)));
    }
    let candidates = this.level.bins.filter((b) => b.product === product);
    // the first pick is close to the packing station, so people learn the loop
    if (n === 0) {
      const near = candidates.filter((b) => b.aisle >= 5 && b.bay < 6);
      if (near.length) candidates = near;
    }
    if (!candidates.length) candidates = this.level.bins;
    const bin = pick(candidates);
    const d = Math.hypot(bin.pos.x - BENCH.x, bin.pos.z - BENCH.z);
    const rec: BoxSize = product.size >= 2 ? 3 : Math.random() < 0.6 ? 3 : 2;
    this.order = { no: this.orderNo++, product: bin.product, bin, deadline: (this.s?.t ?? 0) + 22 + d / 1.8, rec };
  }

  private wanted(): Product {
    return this.order.product;
  }

  private isEmptyOrder(): boolean {
    const id = this.order.product.def.id;
    return id === 'pk-nothing' || id === 'pk-emptybox';
  }

  // ---------------------------------------------------------------- engine hooks

  obstacles() {
    const out: { x: number; z: number; r: number }[] = [];
    for (const f of this.forklifts) out.push(...f.circles());
    out.push({ x: this.coach.pos.x, z: this.coach.pos.z, r: this.coach.radius });
    for (const p of this.pickers) out.push({ x: p.pos.x, z: p.pos.z, r: p.radius });
    return out;
  }

  lookTargets(): THREE.Object3D[] {
    return [...this.forklifts.map((f) => f.group), this.coach.group, ...this.pickers.map((p) => p.group)];
  }

  quota() {
    return { done: this.c.correct, target: QUOTA };
  }

  heldLabel(it: Item): string {
    const p = productOf(it.def);
    if (!p) return '';
    return p === this.wanted() ? ' [ON ORDER]' : ' [NOT ON ORDER]';
  }

  productive(): boolean {
    return this.c.correct >= QUOTA - 1;
  }

  employeeOfTheMonth(pocket: ItemDef[], fired: boolean): string {
    if (!fired && pocket.some((p) => p.id === 'pk-duck')) return 'The left-handed rubber duck in your pocket';
    const best = this.pickers.reduce((a, b) => (b.picks > a.picks ? b : a));
    return `${best.name} (again, ${best.picks + 41000} picks, 0 breaks)`;
  }

  reviewRows(): [string, string | number][] {
    const c = this.c;
    return [
      ['Orders shipped correctly', c.correct],
      ['Wrong items shipped', c.wrong],
      ['Boxes of pure air shipped', c.empty],
      ['Air shipped (litres)', Math.round(c.air)],
      ['Tape used (strips)', c.tape + c.tapeWasted],
      ['Boxes that gave up', c.rips],
      ['Air pillow incidents', c.bursts],
      ['Algorithm deviations', c.deviations],
      ['Steps', this.steps()],
      ['Time off task', mmss(this.tot)],
      ['Forklift collisions (your fault)', c.forkHits],
    ];
  }

  payRows(): [string, number][] {
    const c = this.c;
    const rows: [string, number][] = [];
    const toilet = this.s.counter('toilet');
    if (toilet) rows.push([`Pallet jack rental x${toilet}`, -1.5 * toilet]);
    if (c.bottles) rows.push([`Approved relief bottles x${c.bottles}`, -4.99 * c.bottles]);
    if (this.tot >= 10) rows.push([`Time off task (${mmss(this.tot)})`, -Math.floor(this.tot / 10) * 0.1]);
    rows.push([`Step bonus (${this.steps().toLocaleString('en-US')} steps)`, Math.floor(this.steps() / 1000) * 0.01]);
    if (c.tape + c.tapeWasted > c.correct * 3 + 6) rows.push(['Excess tape', -0.05 * (c.tape + c.tapeWasted - c.correct * 3)]);
    if (c.forkHits) rows.push([`Forklift paint damage x${c.forkHits}`, -2 * c.forkHits]);
    if (c.bursts) rows.push([`Air pillow surcharge x${c.bursts}`, -0.8 * c.bursts]);
    if (c.wrong) rows.push([`Customer goodwill x${c.wrong}`, -1 * c.wrong]);
    return rows;
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number): void {
    const s = this.s;
    const P = s.player;
    for (const f of this.forklifts) f.update(dt, this.ctx, this.forklifts, s.t);
    this.coach.update(dt, this.ctx, s.t);
    for (const p of this.pickers) p.update(dt, this.ctx);
    this.applyKnock(dt);
    this.updatePumping(dt);
    this.updateShipping(dt);
    this.updateTask(dt);
    this.level.fun.update(dt);

    // the relief bottle gag
    const puddles = s.counter('puddles');
    if (puddles > this.lastPuddles && s.held?.def === BOTTLE_DEF) {
      s.say('You use the Approved Relief Bottle. It is decorative. It has no bottom. It says so in the fine print.', 4);
      s.chat('bottleFail', {}, 2);
      s.hype += 6;
    }
    this.lastPuddles = puddles;

    this.dist += P.speed * dt;
    this.refresh -= dt;
    if (this.refresh <= 0) {
      this.refresh = 0.4;
      this.level.decor.board({ tot: this.tot, steps: this.steps(), rate: this.rate(), robots: this.robotPicks, shipped: this.shipped });
      this.drawStation();
    }
    this.scanner.update(this.scanView(), dt);
  }

  private steps(): number {
    return Math.floor(this.dist / 0.72);
  }

  private rate(): number {
    return this.s.t > 15 ? this.c.correct / (this.s.t / 3600) : 0;
  }

  private inBooth(): boolean {
    const p = this.s.player.pos;
    const b = this.level.booth;
    return p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ;
  }

  private applyKnock(dt: number): void {
    const k = this.knockV;
    if (k.lengthSq() < 0.01) return;
    const p = this.s.player.pos;
    p.x += k.x * dt;
    p.z += k.y * dt;
    for (const b of this.level.colliders) if (!b.disabled) pushOutCircle(p, 0.35, b);
    k.multiplyScalar(Math.max(0, 1 - dt * 5));
  }

  /** Time off task, wrong aisles, the pick window and the pressure that comes with them. */
  private updateTask(dt: number): void {
    const s = this.s;
    const P = s.player;
    const moving = P.speed > 0.5;
    this.idleT = moving ? 0 : this.idleT + dt;
    const busy = this.pumping || s.t - this.lastAction < 4;
    const jack = s.held?.def === JACK_DEF;
    const booth = this.inBooth();
    const here = aisleAt(P.pos.x, P.pos.z);
    const picking = !this.box && !(s.held && productOf(s.held.def) === this.wanted());
    this.wrongAisleT = picking && here >= 0 && here !== this.order.bin.aisle ? this.wrongAisleT + dt : 0;
    const wrongAisle = this.wrongAisleT > 3;
    const idle = this.idleT > 2.5 && !busy;
    const off = booth || jack || idle || wrongAisle;
    if (off) {
      this.tot += dt;
      const k = booth || jack ? 1.2 : s.seen ? 6 : 2.6;
      s.annoyance += dt * k;
      if (s.seen && wrongAisle) s.bossSay('wrongAisle');
      else if (s.seen && idle && this.idleT > 5) s.bossSay('offTask');
      if (Math.floor(this.tot) % 30 === 29 && Math.floor(this.tot - dt) % 30 === 28) s.chat('offTask');
      if (this.wrongAisleT > 3 && this.wrongAisleT - dt <= 3) this.coach.nudge();
    }
    const late = s.t - this.order.deadline;
    if (late > 0) {
      s.annoyance += dt * 1.0;
      if (s.seen && late > 5) s.bossSay('overdue');
      if (late < dt * 1.5) this.coach.nudge();
    }
  }

  private lookAt(obj: THREE.Object3D): boolean {
    this.ray.setFromCamera(new THREE.Vector2(0, 0), this.s.camera);
    this.ray.far = 3.2;
    return this.ray.intersectObject(obj, true).length > 0;
  }

  private updatePumping(dt: number): void {
    const s = this.s;
    const st = this.level.station;
    const box = this.box;
    const want = this.eDown && !this.burstLatch && !!box && !box.closed && !s.held && this.lookAt(st.pillowMachine);
    if (want && box) {
      this.pumping = true;
      st.pumping = true;
      s.movementLocked = true;
      this.lastAction = s.t;
      box.setAir(box.air + dt);
      const f = box.fill;
      s.hud.progress(f < 1 ? `AIR PILLOWS ${Math.round(f * 100)}%` : `AIR PILLOWS ${Math.round(f * 100)}%  (that is enough...)`, Math.min(1, f));
      this.progressShown = true;
      if (Math.random() < dt * 8) s.sfx.noise(0.08, 0.06, 1400, 0, 0.8, 'bandpass');
      if (f > 1.35) this.burst();
      return;
    }
    if (this.pumping) {
      this.pumping = false;
      st.pumping = false;
      s.movementLocked = false;
    }
    if (this.progressShown) {
      this.progressShown = false;
      s.hud.progress(null);
    }
  }

  private burst(): void {
    const s = this.s;
    const box = this.box!;
    this.burstLatch = true;
    const p = new THREE.Vector3();
    box.group.getWorldPosition(p);
    p.y += box.dims[1];
    this.level.station.burst(p);
    box.setAir(AIR_NEEDED[box.size] * 0.4);
    this.c.bursts++;
    s.sfx.boom();
    s.hype += 16;
    s.achieve('cloud');
    s.chat('pillow', {}, 3);
    s.say('The box gives up and releases forty air pillows into the wild. It is snowing in Fulfillment Center 4.', 4);
    if (s.seen) {
      s.annoyance += 15;
      s.boss.confront();
      s.bossSay('pillowBurst', true);
    }
  }

  private updateShipping(dt: number): void {
    for (let i = this.shipping.length - 1; i >= 0; i--) {
      const sh = this.shipping[i];
      sh.x += dt * 1.0;
      sh.box.group.position.x = sh.x;
      if (sh.x > CONVEYOR.x1 + 0.2) {
        this.s.scene.remove(sh.box.group);
        this.shipping.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------- the player's actions

  interact(look: Look | null): boolean {
    const s = this.s;
    const info = look?.info as (Interact & { aisle?: number; side?: 'W' | 'E'; size?: number; robot?: unknown }) | undefined;
    if (!info || !look) return false;
    if (this.level.fun.interact(look)) return true;
    switch (info.kind) {
      case 'bin':
        return this.useBin(info.aisle!, info.side!, look.point);
      case 'boxPile':
        this.takeBox(info.size as BoxSize);
        return true;
      case 'packBox':
      case 'bench':
      case 'conveyor':
        return this.useBench(info.kind);
      case 'pillows':
        if (s.held) s.say('Hands full. The AIR-O-MATIC needs both hands and your full attention.', 2.5);
        else if (!this.box) s.say('There is no box. The machine would inflate air into nothing. That is just air.', 3);
        else if (this.box.closed) s.say('The box is already taped shut. The air pillows will have to wait for the next box.', 3);
        return true;
      case 'tape':
        this.tape();
        return true;
      case 'vending':
        this.vend();
        return true;
      case 'kiosk':
        this.c.kiosk++;
        s.say(pick(KIOSK_LINES), 3.5);
        s.sfx.beep();
        return true;
      case 'coach':
        this.coach.say(pick(COACH_TALK), 3.5);
        return true;
      case 'picker':
        (info.robot as PickerBot).say(pick(PICKER_TALK), 3);
        return true;
      case 'forklift':
        (info.robot as Forklift).say(pick(FORKLIFT_TALK), 3);
        return true;
    }
    return false;
  }

  hint(look: Look | null): string | null {
    const s = this.s;
    const info = look?.info as (Interact & { aisle?: number; side?: 'W' | 'E'; size?: number; robot?: { name: string } }) | undefined;
    if (!info || !look) return null;
    const funHint = this.level.fun.hint(look);
    if (funHint !== null) return funHint;
    const held = s.held;
    switch (info.kind) {
      case 'bin': {
        const bin = this.binFromLook(info.aisle!, info.side!, look.point);
        if (!bin) return null;
        const label = binLabel(bin);
        if (held && productOf(held.def)) return `E: put the ${held.def.name} back into ${label}`;
        if (held) return null;
        return `${label}: ${bin.product.def.name}  ·  E: take`;
      }
      case 'boxPile': {
        const size = info.size as BoxSize;
        if (this.box) return 'One box at a time';
        return `E: take an ${SIZE_NAMES[size]} box${size === this.order.rec ? ' (algorithm pick)' : ''}`;
      }
      case 'packBox':
      case 'bench':
      case 'conveyor': {
        const b = this.box;
        if (held?.def === JACK_DEF) return null;
        if (held) {
          if (!b) return 'Choose a box first (stacks on the left)';
          if (b.closed || b.contents) return 'The box is taken';
          return `E: put the ${held.def.name} in the box`;
        }
        if (!b) return 'Packing station 1';
        if (b.tape > 0) return 'E: ship it';
        return 'Air pillows on the right, tape on the left';
      }
      case 'pillows':
        return this.box && !this.box.closed ? 'Hold E: inflate air pillows' : 'AIR-O-MATIC';
      case 'tape':
        return this.box ? 'E: tape the box' : 'E: tape';
      case 'vending':
        return 'E: buy an Approved Relief Bottle (EUR 4.99)';
      case 'kiosk':
        return 'E: share your feelings';
      case 'coach':
      case 'picker':
      case 'forklift':
        return `E: talk to ${info.robot?.name ?? 'robot'}`;
    }
    return null;
  }

  private binFromLook(aisle: number, side: 'W' | 'E', point: THREE.Vector3): Bin | undefined {
    const j = bayIndex(point.z);
    if (j < 0) return undefined;
    return this.level.binAt(aisle, side, j, binFromY(point.y));
  }

  private useBin(aisle: number, side: 'W' | 'E', point: THREE.Vector3): boolean {
    const s = this.s;
    const bin = this.binFromLook(aisle, side, point);
    if (!bin) return false;
    const held = s.held;
    if (held) {
      if (!productOf(held.def)) return false;
      s.removeHeld();
      s.sfx.click();
      s.say(`You put the ${held.def.name} back into ${binLabel(bin)}. The bin does not judge.`, 2.5);
      this.lastAction = s.t;
      return true;
    }
    const it = s.addItem(bin.product.def, bin.pos.clone());
    s.pickUp(it);
    this.lastAction = s.t;
    if (bin.product === this.wanted()) {
      s.sfx.ding();
      this.scanner.blink('ok');
      if (Math.random() < 0.3) s.chat('pick');
    } else {
      s.sfx.buzz();
      this.scanner.blink('bad', 2);
      s.chat('wrongPick', { want: this.wanted().def.name.toLowerCase() });
      if (bin.product.def.shape !== 'nothing') s.say(`SCAN MISMATCH. This is ${bin.product.def.name}. The order wants ${this.wanted().def.name}.`, 3);
    }
    return true;
  }

  private takeBox(size: BoxSize): void {
    const s = this.s;
    if (this.box) {
      s.say('One box at a time. The bench is not a warehouse. It is in a warehouse.', 2.5);
      return;
    }
    const b = new PackBox(size);
    b.group.position.copy(BOX_SLOT).setY(0.56);
    s.scene.add(b.group);
    this.level.interactables.push(b.group);
    this.box = b;
    this.boxDef = null;
    this.boxDeviation = size < this.order.rec;
    this.lastAction = s.t;
    s.sfx.whoosh();
    if (size === 3) s.say('You unfold an XXL box. It is bigger than your apartment. The algorithm is pleased.', 3);
    else if (this.boxDeviation) s.say(`You take an ${SIZE_NAMES[size]} box. The algorithm said ${SIZE_NAMES[this.order.rec]}. The algorithm noticed.`, 3);
    if (s.held && productOf(s.held.def)) this.insertHeld();
  }

  private useBench(kind: string): boolean {
    const s = this.s;
    const b = this.box;
    if (s.held) {
      if (s.held.def === JACK_DEF) return false;
      if (!b) {
        s.say('Choose a box first. The flat boxes are stacked to the left of the bench, by size.', 3);
        return true;
      }
      if (b.closed) {
        s.say('The box is already taped shut. Ship it first.', 2.5);
        return true;
      }
      if (b.contents) {
        s.say('There is already something in the box. One item per box. Policy 4.4.1.', 2.5);
        return true;
      }
      this.insertHeld();
      return true;
    }
    if (!b) {
      s.say(kind === 'conveyor' ? 'The outbound conveyor. It takes taped boxes and gives nothing back.' : 'Packing station 1. Boxes on the left, air pillows on the right, tape on the left. Pick something first.', 3);
      return true;
    }
    if (b.tape > 0) {
      this.ship();
      return true;
    }
    s.say('Hold E at the AIR-O-MATIC for air pillows, then tape the box shut with the dispenser on the left.', 3);
    return true;
  }

  private insertHeld(): void {
    const s = this.s;
    const b = this.box!;
    const it = s.held!;
    const prod = productOf(it.def);
    const size = prod?.size ?? (it.def.pocketable ? 1 : 3);
    this.lastAction = s.t;
    if (size > b.size) {
      // the box gives up
      this.c.rips++;
      this.removeBox();
      const dropped = s.detachHeld()!;
      s.scene.add(dropped.mesh);
      dropped.mesh.position.set(BOX_SLOT.x, 0.9, BOX_SLOT.z - 0.8);
      dropped.mesh.rotation.set(0, 0, 0);
      dropped.vel.set(0, -1, -1.5);
      dropped.state = 'world';
      dropped.sleeping = false;
      s.sfx.thud();
      s.hype += 10;
      s.chat('rip', {}, 2);
      if (it.def.id === 'pk-anvil') {
        s.say(`You put the 40 kg anvil into an ${SIZE_NAMES[b.size]} box. The box was rated for socks. The anvil is on the floor now.`, 4);
        s.achieve('anvil');
        s.chat('anvil', {}, 2);
        s.hype += 8;
        if (s.seen) s.bossSay('anvilRip', true);
      } else s.say(`The ${it.def.name} does not fit in an ${SIZE_NAMES[b.size]} box. The box tears. Cardboard has limits.`, 3);
      if (s.seen) {
        s.annoyance += 12;
        s.boss.confront();
      }
      return;
    }
    s.detachHeld();
    s.removeItem(it);
    b.insert(it.mesh);
    this.boxDef = it.def;
    s.sfx.click();
    if (it.def.shape === 'nothing') s.say('You put nothing into the box. It looks exactly the same. Perfect.', 3);
  }

  private tape(): void {
    const s = this.s;
    const b = this.box;
    this.lastAction = s.t;
    s.sfx.noise(0.25, 0.25, 2500, 0, 0.6, 'highpass');
    if (!b) {
      this.c.tapeWasted++;
      s.say('There is no box. You tape the bench. The bench is now secure.', 2.5);
      return;
    }
    b.addTape();
    this.c.tape++;
    if (b.tape === 10) {
      this.c.mummies++;
      s.chat('mummy', {}, 2);
      s.hype += 10;
      s.say('The box is now mostly tape. Archaeologists will find it in 3000 years.', 3);
      if (s.seen) s.bossSay('mummy', true);
    }
  }

  private removeBox(): void {
    const b = this.box;
    if (!b) return;
    this.s.scene.remove(b.group);
    const i = this.level.interactables.indexOf(b.group);
    if (i >= 0) this.level.interactables.splice(i, 1);
    this.box = null;
  }

  private ship(): void {
    const s = this.s;
    const b = this.box!;
    const def = this.boxDef;
    const order = this.order;
    const want = order.product;
    const prod = def ? productOf(def) : undefined;
    const empty = !def || def.shape === 'nothing';
    const correct = this.isEmptyOrder() ? empty || prod === want : prod === want;
    const bad = b.fill < 0.5 || b.tape < 3;
    const [w, h, d] = b.dims;
    this.c.air += w * h * d * 1000 * Math.min(1.35, Math.max(0.2, b.fill));
    // the box goes onto the conveyor
    this.removeBox();
    b.group.position.set(CONVEYOR.x0 + 0.7, CONVEYOR.h + 0.03, CONVEYOR.z);
    b.group.rotation.y = 0;
    b.group.userData.interact = undefined;
    s.scene.add(b.group);
    this.shipping.push({ box: b, x: b.group.position.x });
    s.sfx.whoosh();
    this.shipped++;
    this.lastAction = s.t;
    const late = s.t > order.deadline;

    if (empty) {
      this.c.empty++;
      s.achieve('airMail');
      s.chat('emptyShip', {}, 2);
      s.hype += 10;
    }
    if (correct) {
      this.c.correct++;
      s.sfx.ding();
      this.scanner.blink('ok', 1.5);
      if (empty) s.say('You shipped an empty box for an order of nothing. Technically correct. The best kind of correct.', 4);
      else if (want.size === 1 && b.size === 3) {
        s.say(`One ${want.def.name} in an XXL box. ${Math.round(w * h * d * 1000)} litres of air. The algorithm is delighted.`, 3.5);
        s.chat('bigBox');
      } else s.say(`Order #${order.no} shipped${late ? ' (late)' : ''}. Next order on the scanner.`, 2.5);
      if (bad) this.badPack(b);
      else {
        s.annoyance = Math.max(0, s.annoyance - 10);
        if (s.seen) s.bossSay('correctSeen');
        else this.coachSay(pick(COACH_GOOD));
        if (Math.random() < 0.3) s.chat('ship');
      }
      if (this.c.correct === QUOTA) s.hud.toast('QUOTA REACHED', 'Brad has raised your quota. Congratulations on your new quota.', 'corp');
    } else {
      this.c.wrong++;
      s.sfx.buzz();
      this.scanner.blink('bad', 2);
      s.hype += 12;
      s.chat('wrongShip', { want: want.def.name.toLowerCase(), got: empty ? 'nothing' : (def?.name ?? 'nothing').toLowerCase() }, 2);
      s.say(empty ? `You shipped an empty box. Somebody ordered ${want.def.name} and will receive air.` : `Somebody ordered ${want.def.name}. They will receive ${def!.name}. Returns are a revenue stream.`, 4);
      if (s.seen) {
        s.annoyance += 30;
        s.boss.confront();
        s.bossSay(empty ? 'emptyShipped' : 'wrongItem', true);
      } else this.report(10, pick(COACH_BAD));
    }
    this.level.fun.shipped(def);
    if (this.boxDeviation) {
      this.c.deviations++;
      if (s.seen) {
        s.annoyance += 12;
        s.bossSay('deviation');
      } else this.report(5, 'That was not the recommended box! Reporting!');
    }
    if (b.tape >= 10 && s.seen) s.annoyance += 8;
    this.newOrder();
  }

  private badPack(b: PackBox): void {
    const s = this.s;
    this.c.badPacks++;
    s.hype += 8;
    s.say(b.tape < 3 ? 'The box is held together by hope and one strip of tape. It will open in transit.' : 'The box rattles. The customer will hear their order before they see it.', 3.5);
    if (s.seen) {
      s.annoyance += 25;
      s.boss.confront();
      s.bossSay('badPack', true);
    } else this.report(8, pick(COACH_BAD));
  }

  /** The Rate Coach saw something and tells Brad. */
  private report(annoy: number, line: string): void {
    const s = this.s;
    const d = Math.hypot(this.coach.pos.x - s.player.pos.x, this.coach.pos.z - s.player.pos.z);
    if (this.coach.state !== 'follow' || d > 9) return;
    s.annoyance += annoy;
    this.coachSay(line);
    if (Math.random() < 0.5) s.bossSay('coachReport');
  }

  private coachSay(line: string): void {
    this.coachQueue = line;
    this.coach.nudge(0.4);
  }

  private vend(): void {
    const s = this.s;
    if (s.held) {
      s.say('Hands full. Machine B7 only accepts empty hands and full wallets.', 2.5);
      return;
    }
    this.c.bottles++;
    s.sfx.tone(800, 0.1, 'square', 0.06);
    s.sfx.thud();
    const it = s.addItem(BOTTLE_DEF, this.level.decor.vending.position.clone().setY(0.4));
    s.pickUp(it);
    s.say(VENDING_LINES[Math.min(this.c.bottles - 1, VENDING_LINES.length - 1)], 4);
    s.chat('bottle');
    if (s.seen) s.bossSay('bottle');
  }

  // ---------------------------------------------------------------- robots

  private coachLine(): string {
    const s = this.s;
    if (this.coachQueue) {
      const q = this.coachQueue;
      this.coachQueue = null;
      return q;
    }
    const noWatch = this.level.fun.coachOverride();
    if (noWatch) return noWatch;
    s.chat('coach');
    const vars = {
      tot: mmss(this.tot),
      late: String(Math.round(s.t - this.order.deadline)),
      here: LETTERS[Math.max(0, aisleAt(s.player.pos.x, s.player.pos.z))],
      want: LETTERS[this.order.bin.aisle],
      rate: String(Math.round(this.rate())),
      gap: String(Math.max(0, 300 - Math.round(this.rate()))),
      steps: this.steps().toLocaleString('en-US'),
    };
    if (this.inBooth()) return fill(pick(COACH_BOOTH), vars);
    if (s.held?.def === JACK_DEF) return pick(COACH_JACK);
    if (this.wrongAisleT > 2) return fill(pick(COACH_WRONG_AISLE), vars);
    if (s.t > this.order.deadline) return fill(pick(COACH_OVERDUE), vars);
    if (this.idleT > 3) return fill(pick(COACH_IDLE), vars);
    if (s.held?.def.id === 'pk-anvil') return pick(COACH_ANVIL);
    if (this.box) return pick(COACH_PACK);
    return fill(pick(COACH_RATE), vars);
  }

  private onForkliftHit(f: Forklift): void {
    const s = this.s;
    this.c.forkHits++;
    s.hype += 12;
    s.sfx.thud();
    s.chat('forklift', {}, 2);
    f.say(pick(FORKLIFT_HIT), 3);
    if (this.c.forkHits >= 3) s.achieve('forklift');
    const held = s.held;
    if (held && !held.def.heavy && !held.def.toiletKey) {
      const it = s.detachHeld()!;
      const P = s.player.pos;
      s.scene.add(it.mesh);
      it.mesh.position.set(P.x, 1.3, P.z);
      it.vel.set(this.knockV.x * 0.8, 3, this.knockV.y * 0.8);
      it.state = 'world';
      it.sleeping = false;
      s.say(`${f.name} hits you. It honked first, so legally this is your fault. The ${it.def.name} flies away.`, 3.5);
    } else s.say(`${f.name} hits you. It honked first, so legally this is your fault.`, 3);
    if (s.seen) s.bossSay('forklift', true);
  }

  private onSkid(f: Forklift): void {
    const s = this.s;
    this.c.skids++;
    s.hype += 12;
    s.chat('skid', {}, 2);
    f.say('Wheee. Traction lost. Puddle logged.', 2.5);
    s.sfx.slip();
  }

  private onBotSlip(b: PickerBot): void {
    const s = this.s;
    this.c.botSlips++;
    s.hype += 15;
    s.sfx.slip();
    s.chat('botSlip', {}, 2);
    b.say('Slip detected. This never happened.', 2.5);
  }

  onKick(look: Look | null): boolean {
    if (!look) return false;
    const near = look.point.distanceTo(this.s.camera.getWorldPosition(new THREE.Vector3())) < 2.4;
    return this.level.fun.onKick(look, near);
  }

  thrownHit(it: Item): boolean {
    const s = this.s;
    const p = it.mesh.position;
    const c = this.coach;
    if (c.state === 'follow' && Math.hypot(p.x - c.pos.x, p.z - c.pos.z) < c.radius + 0.25 && p.y < 1.3) {
      it.vel.multiplyScalar(-0.3);
      it.thrown = false;
      c.knockDown();
      this.c.coachHits++;
      s.hype += 16;
      s.sfx.thud();
      s.chat('coachHit', {}, 3);
      s.achieve('rateLimited');
      if (s.seen) {
        s.annoyance += 20;
        s.bossSay('coachHit', true);
      }
      return true;
    }
    for (const b of this.pickers) {
      if (b.isDown) continue;
      if (Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < b.radius + 0.2 && p.y < 1.8) {
        it.vel.multiplyScalar(-0.3);
        it.thrown = false;
        b.knockDown(3);
        b.say(pick(PICKER_HIT), 3);
        this.c.botHits++;
        s.hype += 12;
        s.sfx.thud();
        s.chat('botSlip', {}, 2);
        return true;
      }
    }
    for (const f of this.forklifts) {
      for (const cc of f.circles()) {
        if (Math.hypot(p.x - cc.x, p.z - cc.z) < cc.r && p.y < 2.2) {
          it.vel.multiplyScalar(-0.4);
          it.thrown = false;
          f.say('Bonk. Projectile logged. Still driving.', 2.5);
          s.sfx.thud();
          s.hype += 4;
          return true;
        }
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- displays

  private drawStation(): void {
    const b = this.box;
    const rec = SIZE_NAMES[this.order.rec];
    if (!b) {
      this.level.station.screen([`ORDER #${this.order.no}`, `ALGORITHM: ${rec} BOX`, this.s.held ? 'TAKE A BOX (LEFT)' : 'WAITING FOR ITEM', `ITEM: ${this.wanted().scan.slice(0, 20)}`], false);
      return;
    }
    const lines = [
      `BOX ${SIZE_NAMES[b.size]}${this.boxDeviation ? ' (NOT ' + rec + '!)' : ''}`,
      `ITEM: ${this.boxDef ? (productOf(this.boxDef)?.scan ?? this.boxDef.name.toUpperCase()).slice(0, 18) : 'NONE'}`,
      `AIR ${Math.round(b.fill * 100)}%  TAPE ${b.tape}`,
      b.tape > 0 ? 'E ON BOX: SHIP IT' : b.fill < 0.5 ? 'HOLD E: AIR PILLOWS' : 'TAPE IT (3 STRIPS)',
    ];
    this.level.station.screen(lines, this.boxDeviation || b.fill > 1.1);
  }

  private scanView() {
    const s = this.s;
    const o = this.order;
    const bin = o.bin;
    const held = s.held;
    const heldProd = held ? productOf(held.def) : undefined;
    let status: string;
    let mode: '' | 'alert' | 'ok' | 'bad' = '';
    if (held?.def === JACK_DEF) status = 'TOILET TRIP = TIME OFF TASK';
    else if (this.inBooth()) status = 'BREAK DETECTED. TIMER RUNNING';
    else if (this.box) {
      const b = this.box;
      if (!this.boxDef && !held && !this.isEmptyOrder()) status = 'PUT THE ITEM IN THE BOX';
      else if (b.tape === 0 && b.fill < 0.5) status = 'HOLD E AT THE AIR-O-MATIC';
      else if (b.tape < 3) status = 'TAPE IT: 3 STRIPS';
      else status = 'SHIP IT: E ON THE BOX';
    } else if (heldProd === o.product) status = 'TAKE IT TO PACK STATION 1';
    else if (heldProd) {
      status = `MISMATCH! PUT IT BACK`;
      mode = 'bad';
    } else if (this.wrongAisleT > 1) {
      status = `WRONG AISLE! GO TO AISLE ${LETTERS[bin.aisle]}`;
      mode = 'alert';
    } else if (aisleAt(s.player.pos.x, s.player.pos.z) === bin.aisle) status = `FIND BAY ${bayNumber(bin.bay, bin.side)}, BIN ${bin.bin}`;
    else status = `GO TO AISLE ${LETTERS[bin.aisle]}`;
    const window = o.deadline - s.t;
    if (window < 0 && mode === '') mode = 'alert';
    return {
      order: o.no,
      loc: `AISLE ${LETTERS[bin.aisle]} BAY ${bayNumber(bin.bay, bin.side)} BIN ${bin.bin}`,
      item: `1x ${o.product.scan}`,
      window,
      steps: this.steps(),
      tot: this.tot,
      rate: this.rate(),
      status,
      mode,
    };
  }
}
