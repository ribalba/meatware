import * as THREE from 'three';
import type { CustomerKind } from '../../customerModels';
import { Item, ItemDef } from '../../items';
import type { Interact } from '../../level';
import { pick, rand } from '../../util';
import type { Job, Look, Shift } from '../types';
import { Bot } from './bots';
import { CHECKOUT_FUN_BOSS, CHECKOUT_FUN_CHAT, CHECKOUT_SECRETS, CheckoutFun } from './fun';
import {
  BARCODE_WARES,
  CANDY_DEF,
  CANDY_WARE,
  findCode,
  NOTHING_WARE,
  OIL_WARE,
  PRODUCE,
  UNEXPECTED,
  WAD_DEF,
  Ware,
} from './items';
import {
  BELT,
  BELT_STOP,
  CASHIER_WALL_X,
  COUNTER,
  DOOR_POINT,
  LANE_EXIT,
  PAY_Z,
  QUEUE_X,
  QUEUE_ZS,
  SELF_CHECKOUTS,
  SPAWNS,
  UNEXPECTED_SPOT,
  UNLOAD_Z,
} from './layout';
import { CheckoutLevel } from './level';
import * as X from './texts';
import { ReceiptLine, RegisterUi } from './ui';

/**
 * Job: checkout human at lane 7. Robots unload groceries on the belt. Pick each one up,
 * scan it (or type the produce code), bag it, ask about the loyalty card, take payment.
 */
const QUOTA = 30;

type Persona = 'shopper' | 'parent' | 'bulk' | 'coupon' | 'coins' | 'influencer';
type Stage = 'walkIn' | 'queue' | 'unload' | 'waitPay' | 'leave';
type PayMethod = 'card' | 'coins' | 'coupons' | 'exposure';

interface Cust {
  bot: Bot;
  persona: Persona;
  stage: Stage;
  /** Wares still in the cart. */
  cart: Ware[];
  lines: ReceiptLine[];
  total: number;
  patience: number;
  maxPatience: number;
  loyalty: number;
  pay: PayMethod;
  paying: boolean;
  coins: number;
  coupons: { text: string; valid: boolean }[];
  doubles: number;
  unloadT: number;
  /** At the pay spot (or walking there). */
  atPay: boolean;
  toddler: Bot | null;
  toddlerRides: number;
  toddlerT: number;
  moanT: number;
  /** Already greeted the cashier. */
  greeted: boolean;
  queueSlot: number;
}

interface LineItem {
  ware: Ware;
  cust: Cust | null;
  scans: number;
  /** Barcode fails left before it reads. */
  trouble: number;
  barcode: string;
  ageOk: boolean;
}

interface BeltEntry {
  obj: THREE.Object3D;
  z: number;
  len: number;
  item?: Item;
  toddler?: Cust;
  divider?: boolean;
  dividerT?: number;
}

interface Prompt {
  text: string;
  options: string[];
  pick: (i: number) => void;
}

interface Keypad {
  item: Item;
  mode: 'produce' | 'barcode';
  typed: string;
}

const PERSONA_KIND: Record<Persona, CustomerKind> = {
  shopper: 'shopper',
  parent: 'shopper',
  bulk: 'bulk',
  coupon: 'karen',
  coins: 'gran',
  influencer: 'influencer',
};
const PATIENCE: Record<Persona, number> = { shopper: 100, parent: 110, bulk: 125, coupon: 105, coins: 160, influencer: 95 };
const SCHEDULE: Persona[] = ['shopper', 'shopper', 'parent', 'coins', 'bulk', 'coupon', 'shopper', 'influencer', 'parent', 'shopper', 'coupon', 'coins', 'bulk', 'shopper', 'influencer'];
const TINTS = ['#5dade2', '#e59866', '#a569bd', '#58d68d', '#f4d03f', '#ec7063'];

export class CheckoutJob implements Job {
  info = {
    id: 'checkout',
    title: 'CHECKOUT HUMAN',
    place: X.PLACE,
    teaser: 'Unexpected item in bagging area.',
    quotaLabel: 'SCANNED',
    lockedDoor: 'Locked. The key is at Customer Service by the entrance. It is chained to a full shopping cart.',
    bladderWarning: 'You really need to pee. The staff toilet is in the far back corner. The key is on a full cart at Customer Service.',
  };
  level: CheckoutLevel;
  bossLines = { ...X.BOSS, ...CHECKOUT_FUN_BOSS };
  chatLines = { ...X.CHAT, ...CHECKOUT_FUN_CHAT };
  achievements = X.ACHIEVEMENTS;
  secrets = CHECKOUT_SECRETS;
  /** Breakables, movables, the closet, the phone and everything nobody told you about. */
  private fun: CheckoutFun;
  private magsRead = 0;

  private s!: Shift;
  private ui!: RegisterUi;
  private custs: Cust[] = [];
  private queue: Cust[] = [];
  private unloader: Cust | null = null;
  private payer: Cust | null = null;
  private selfBots: Bot[] = [];
  private roomba!: Bot;
  private walker!: Bot;
  private belt: BeltEntry[] = [];
  private lineItems = new Map<Item, LineItem>();
  private spawnT = 3;
  private scheduleIdx = 0;
  private prompt: Prompt | null = null;
  private keypad: Keypad | null = null;
  private unexpected: { obj: THREE.Object3D; owner: Cust; t: number; name: string } | null = null;
  private unexpectedT = 35;
  private mockT = 8;
  private lastAction = -99;
  private drawerT = 0;
  private wadsOut = 0;
  private tillCounted: 'no' | 'pending' | 'done' = 'no';
  private tillFired = false;
  private tillCountT = 0;
  private c = {
    scanned: 0,
    doubles: 0,
    freebies: 0,
    wrongCodes: 0,
    served: 0,
    gaveUp: 0,
    loyaltyAsked: 0,
    loyaltyMissed: 0,
    baggingLines: 0,
    unexpectedFixed: 0,
    coinsCounted: 0,
    badCoupons: 0,
    toddlers: 0,
    candy: 0,
    snacksBilled: 0,
    exposure: 0,
    estimated: 0,
    hits: 0,
    slips: 0,
    eyeballed: 0,
    revenue: 0,
    kicked: 0,
  };

  constructor(scene: THREE.Scene) {
    this.level = new CheckoutLevel(scene);
    this.fun = new CheckoutFun(this.level);
  }

  // ---------------------------------------------------------------- lifecycle

  start(shift: Shift): void {
    this.s = shift;
    this.ui = new RegisterUi();
    addEventListener('keydown', (e) => this.onKey(e));
    // Three robots are already waiting when the shift starts.
    const first = this.spawn(SCHEDULE[this.scheduleIdx++], new THREE.Vector3(QUEUE_X, 0, UNLOAD_Z));
    first.stage = 'unload';
    first.unloadT = 1.5;
    this.unloader = first;
    first.bot.faceTo(0, UNLOAD_Z);
    for (let i = 0; i < 2; i++) {
      const c = this.spawn(SCHEDULE[this.scheduleIdx++], new THREE.Vector3(QUEUE_X, 0, QUEUE_ZS[i]));
      c.stage = 'queue';
      c.queueSlot = i;
      c.bot.faceTo(QUEUE_X, 10);
      this.queue.push(c);
    }
    // Self checkout robots, happily scanning
    const names = ['Self Checkout Fan 1', 'Unit 404', 'SelfScan Sally'];
    SELF_CHECKOUTS.slice(0, 3).forEach((sc, i) => {
      const dir = sc.rot < 0 ? -1 : 1;
      const b = new Bot(shift.scene, 'shopper', names[i], new THREE.Vector3(sc.x + dir * 0.95, 0, sc.z), { tint: TINTS[(i + 2) % TINTS.length], interact: { kind: 'selfbot' } });
      (b.group.userData.interact as Interact).bot = b;
      b.faceTo(sc.x, sc.z);
      this.selfBots.push(b);
    });
    // A robot vacuum that drinks puddles, and a shopper who only browses
    this.roomba = new Bot(shift.scene, 'roomba', 'Vacu-Unit', new THREE.Vector3(6, 0, 7), { interact: { kind: 'roomba' } });
    (this.roomba.group.userData.interact as Interact).bot = this.roomba;
    this.roomba.speed = 0.9;
    this.walker = new Bot(shift.scene, 'shopper', 'Browsing-Unit', new THREE.Vector3(-8, 0, -9.6), { tint: '#58d68d', interact: { kind: 'walker' } });
    (this.walker.group.userData.interact as Interact).bot = this.walker;
    this.walker.speed = 1.0;
    this.fun.start(shift, {
      laneBots: () => [this.payer, this.unloader, ...this.queue].filter((c): c is Cust => !!c).map((c) => c.bot),
      selfBots: () => this.selfBots,
    });
  }

  private spawn(persona: Persona, at: THREE.Vector3): Cust {
    const kind = PERSONA_KIND[persona];
    const n = persona === 'bulk' ? Math.round(rand(7, 9)) : persona === 'coins' ? Math.round(rand(2, 3)) : Math.round(rand(3, 5));
    const wares: Ware[] = [];
    for (let i = 0; i < n; i++) wares.push(Math.random() < 0.32 ? pick(PRODUCE) : pick(BARCODE_WARES));
    if (Math.random() < 0.3 || persona === 'coins') wares.splice(Math.floor(Math.random() * wares.length), 0, OIL_WARE);
    if (Math.random() < 0.1) wares.push(NOTHING_WARE);
    // the very first customer gets one produce item, so the keypad shows up early
    if (this.scheduleIdx <= 1 && !wares.some((w) => w.code)) wares[1] = PRODUCE[0];
    const cartPersona = persona === 'shopper' || persona === 'parent' || persona === 'coupon';
    let name = pick(X.NAMES[persona]);
    if (this.custs.some((c) => c.bot.name === name)) name = X.NAMES[persona].find((n) => !this.custs.some((c) => c.bot.name === n)) ?? `${name} (again)`;
    const bot = new Bot(this.s.scene, kind, name, at, { tint: persona === 'shopper' || persona === 'parent' ? pick(TINTS) : undefined, cart: cartPersona, load: wares.length });
    const pay: PayMethod = persona === 'coins' ? 'coins' : persona === 'coupon' ? 'coupons' : persona === 'influencer' ? 'exposure' : 'card';
    const coupons: { text: string; valid: boolean }[] = [];
    if (pay === 'coupons') {
      const pool = [...X.COUPONS].sort(() => Math.random() - 0.5);
      coupons.push(...pool.slice(0, 5));
      if (!coupons.some((c) => c.text.includes('2049'))) coupons[2] = X.COUPONS[3];
    }
    const c: Cust = {
      bot,
      persona,
      stage: 'walkIn',
      cart: wares,
      lines: [],
      total: 0,
      patience: PATIENCE[persona],
      maxPatience: PATIENCE[persona],
      loyalty: 0,
      pay,
      paying: false,
      coins: 0,
      coupons,
      doubles: 0,
      unloadT: 0,
      atPay: false,
      toddler: null,
      toddlerRides: 0,
      toddlerT: rand(4, 7),
      moanT: rand(8, 14),
      greeted: false,
      queueSlot: -1,
    };
    bot.group.userData.interact = { kind: 'cust', cust: c } satisfies Interact;
    if (persona === 'parent') {
      c.toddler = new Bot(this.s.scene, 'toddler', 'Junior', at.clone().add(new THREE.Vector3(-0.5, 0, -0.3)), {});
      c.toddler.group.userData.interact = { kind: 'toddler', cust: c } satisfies Interact;
      c.toddler.speed = 1.6;
    }
    this.custs.push(c);
    return c;
  }

  obstacles() {
    const out: { x: number; z: number; r: number }[] = [];
    const add = (b: Bot) => {
      out.push({ x: b.pos.x, z: b.pos.z, r: b.radius });
      if (b.cart) out.push({ x: b.pos.x + Math.sin(b.yaw) * 0.78, z: b.pos.z + Math.cos(b.yaw) * 0.78, r: 0.35 });
    };
    for (const c of this.custs) {
      add(c.bot);
      if (c.toddler && !this.onBelt(c)) out.push({ x: c.toddler.pos.x, z: c.toddler.pos.z, r: 0.25 });
    }
    for (const b of this.selfBots) add(b);
    out.push({ x: this.roomba.pos.x, z: this.roomba.pos.z, r: 0.3 });
    add(this.walker);
    return out;
  }

  lookTargets(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const c of this.custs) {
      out.push(c.bot.group);
      if (c.toddler) out.push(c.toddler.group);
    }
    for (const b of this.selfBots) out.push(b.group);
    out.push(this.roomba.group, this.walker.group);
    return out;
  }

  quota() {
    return { done: this.c.scanned, target: QUOTA };
  }

  productive(): boolean {
    return this.c.scanned >= 24;
  }

  hypeMultiplier(): number {
    return this.filming() ? 2 : 1;
  }

  cameraLabel(): string {
    const f = this.filming();
    return f ? `ON CAMERA: ${f.bot.name} (hype x2)` : '';
  }

  private filming(): Cust | null {
    for (const c of [this.payer, this.unloader]) if (c && c.persona === 'influencer') return c;
    return null;
  }

  heldLabel(it: Item): string {
    const li = this.lineItems.get(it);
    if (!li) return '';
    if (li.scans === 0) return li.ware.code ? ' [produce, no barcode]' : ' [not scanned]';
    return li.scans > 1 ? ` [scanned x${li.scans}]` : ' [scanned]';
  }

  employeeOfTheMonth(_pocket: ItemDef[], fired: boolean): string {
    if (this.wadsOut > 0 && !fired) return 'You. The till insists you earned it.';
    return 'Self Checkout 3 (12 months in a row)';
  }

  reviewRows(): [string, string | number][] {
    const c = this.c;
    return [
      ['Items scanned', c.scanned],
      ['Items scanned twice (or more)', c.doubles],
      ['Items bagged without scanning', c.freebies],
      ['Produce codes guessed creatively', c.wrongCodes],
      ['Customers served', c.served],
      ['Customers who gave up waiting', c.gaveUp],
      ['Loyalty cards offered', c.loyaltyAsked],
      ['Loyalty questions forgotten', c.loyaltyMissed],
      ['"Unexpected item" said to robots', c.baggingLines],
      ['Coins counted by hand', c.coinsCounted],
      ['Invalid coupons accepted', c.badCoupons],
      ['Toddlers scanned', c.toddlers],
      ['Robots age-checked by looking', c.eyeballed],
      ['Robots kicked (customer service)', c.kicked],
    ];
  }

  payRows(): [string, number][] {
    const c = this.c;
    const s = this.s;
    const rows: [string, number][] = [];
    if (s.counter('toilet')) rows.push([`Toilet cart rental x${s.counter('toilet')}`, -2 * s.counter('toilet')]);
    if (c.loyaltyMissed) rows.push([`Missed loyalty upsells x${c.loyaltyMissed}`, -0.5 * c.loyaltyMissed]);
    if (c.freebies) rows.push([`Groceries you gave away x${c.freebies}`, -1.5 * c.freebies]);
    if (c.doubles) rows.push([`Double scan commission x${c.doubles}`, 0.1 * c.doubles], ['Double scan refunds (from your wage)', -1 * c.doubles]);
    if (c.badCoupons) rows.push([`Expired coupons you accepted x${c.badCoupons}`, -2 * c.badCoupons]);
    if (c.estimated) rows.push([`Coin estimate shortfall x${c.estimated}`, -3.11 * c.estimated]);
    if (c.exposure) rows.push([`Paid in exposure x${c.exposure}`, 0]);
    if (c.snacksBilled) rows.push([`Snacks billed to customers x${c.snacksBilled}`, 0]);
    if (this.wadsOut > 0) {
      if (this.tillFired) rows.push(['Till money recovered from your sock', 0]);
      else rows.push([`Till money in your sock x${this.wadsOut}`, 20 * this.wadsOut]);
    }
    if (c.toddlers) rows.push([`Toddler sales commission x${c.toddlers}`, 0.01]);
    return rows;
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number): void {
    const s = this.s;
    this.updateSpawns(dt);
    this.updateQueue(dt);
    this.updateBelt(dt);
    this.updateBots(dt);
    this.updateUnexpected(dt);
    this.updateSelfBots(dt);
    this.updateAmbient(dt);
    this.updateTill(dt);
    this.fun.update(dt);
    // Working at the register counts as working, even when standing still.
    if (s.t - this.lastAction < 3 && s.seen) s.annoyance = Math.max(0, s.annoyance - dt * 18);
    s.movementLocked = !!this.prompt || !!this.payer?.paying;
    if (this.keypad && s.held !== this.keypad.item) this.closeKeypad();
    if (this.drawerT > 0) {
      this.drawerT -= dt;
      if (this.drawerT <= 0) this.level.drawerTarget = 0;
    }
    this.updateUi();
  }

  private updateSpawns(dt: number): void {
    this.spawnT -= dt;
    const waiting = this.custs.filter((c) => c.stage !== 'leave').length;
    if (this.spawnT > 0 || waiting >= 5) return;
    this.spawnT = rand(5, 10);
    const persona = this.scheduleIdx < SCHEDULE.length ? SCHEDULE[this.scheduleIdx++] : pick<Persona>(['shopper', 'shopper', 'parent', 'bulk', 'coupon', 'coins', 'influencer']);
    const c = this.spawn(persona, pick(SPAWNS));
    c.queueSlot = this.queue.length;
    this.queue.push(c);
    this.routeTo(c.bot, new THREE.Vector3(QUEUE_X, 0, QUEUE_ZS[Math.min(c.queueSlot, QUEUE_ZS.length - 1)] - (c.queueSlot >= QUEUE_ZS.length ? 1.8 * (c.queueSlot - QUEUE_ZS.length + 1) : 0)));
  }

  private routeTo(b: Bot, to: THREE.Vector3): void {
    const r = this.s.nav.route(b.pos, to);
    r[r.length - 1] = to.clone();
    b.walk(r);
  }

  /** Moves robots through the lane: queue, unload spot, pay spot. */
  private updateQueue(dt: number): void {
    const s = this.s;
    // The unloader moves on to pay once its cart is empty and the pay spot is free.
    if (this.unloader && !this.payer && !this.unloader.cart.length && this.unloader.stage === 'unload') {
      const c = this.unloader;
      this.unloader = null;
      this.payer = c;
      c.stage = 'waitPay';
      c.atPay = true;
      c.bot.walk([new THREE.Vector3(QUEUE_X, 0, PAY_Z)]);
    }
    // The first robot in the queue steps up when the unload spot is free.
    if (!this.unloader && this.queue.length) {
      const head = this.queue[0];
      if (!head.bot.moving && head.stage === 'queue') {
        this.queue.shift();
        this.unloader = head;
        head.stage = 'unload';
        head.unloadT = 1.2;
        head.bot.walk([new THREE.Vector3(QUEUE_X, 0, UNLOAD_Z)]);
        this.queue.forEach((q, i) => (q.queueSlot = -1 - i));
      }
    }
    // The rest shuffle forward.
    this.queue.forEach((q, i) => {
      if (q.queueSlot === i) {
        if (q.stage === 'walkIn' && !q.bot.moving) q.stage = 'queue';
        return;
      }
      if (q.bot.moving && q.stage === 'walkIn') return;
      q.queueSlot = i;
      const z = i < QUEUE_ZS.length ? QUEUE_ZS[i] : QUEUE_ZS[QUEUE_ZS.length - 1] - 1.8 * (i - QUEUE_ZS.length + 1);
      q.bot.walk([new THREE.Vector3(QUEUE_X, 0, z)]);
      q.stage = 'queue';
    });
    for (const q of this.queue) if (q.stage === 'walkIn' && !q.bot.moving) q.stage = 'queue';

    // Unloading onto the belt
    const u = this.unloader;
    if (u && !u.bot.moving) {
      u.bot.faceTo(0.5, UNLOAD_Z + 0.2);
      if (!u.greeted) {
        u.greeted = true;
        u.bot.say(pick(X.GREET[u.persona]), 3.5);
        if (u.persona === 'influencer') s.chat('exposure', {}, 2);
      }
      u.unloadT -= dt;
      if (u.unloadT <= 0 && u.cart.length && this.beltHasRoom(0.36)) {
        if (!this.belt.length || this.belt[this.belt.length - 1].item && this.lineItems.get(this.belt[this.belt.length - 1].item!)?.cust !== u) {
          if (this.belt.length && !this.belt[this.belt.length - 1].divider) this.addDivider();
        }
        if (this.beltHasRoom(0.36)) {
          this.putOnBelt(u, u.cart.shift()!);
          u.bot.unloadOne();
          u.bot.act();
          u.unloadT = rand(0.7, 1.1);
        }
      }
      // Junior wants a ride
      if (u.toddler && u.toddlerRides < 2 && !this.onBelt(u)) {
        u.toddlerT -= dt;
        if (u.toddlerT <= 0 && this.beltHasRoom(0.6)) this.toddlerHop(u);
      }
    }
    if (this.payer && !this.payer.bot.moving) this.payer.bot.faceTo(0.5, PAY_Z - 0.3);

    // Patience
    const lane = [this.payer, this.unloader].filter((c): c is Cust => !!c);
    for (const c of [...lane, ...this.queue]) {
      if (c.stage === 'walkIn') continue;
      const back = this.queue.indexOf(c);
      const rate = back >= 1 ? 0.45 : 1;
      if (c.paying && c.pay === 'coins') continue;
      c.patience -= dt * rate;
      if (c.patience / c.maxPatience < 0.35) {
        c.moanT -= dt;
        if (c.moanT <= 0) {
          c.moanT = rand(9, 15);
          c.bot.say(pick(X.IMPATIENT), 3);
        }
      }
      if (c.patience <= 0) this.rageQuit(c);
    }
  }

  private beltHasRoom(len: number): boolean {
    if (!this.belt.length) return true;
    const last = this.belt[this.belt.length - 1];
    return last.z - last.len / 2 > BELT.z0 + len + 0.05;
  }

  private onBelt(c: Cust): boolean {
    return this.belt.some((e) => e.toddler === c);
  }

  private addDivider(): void {
    const g = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.06), new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.6 }));
    bar.position.y = 0.025;
    g.add(bar);
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.051, 0.061), new THREE.MeshStandardMaterial({ color: '#f4f1e8' }));
    label.position.y = 0.025;
    g.add(label);
    g.position.set(0, BELT.y, BELT.z0 + 0.1);
    this.s.scene.add(g);
    this.belt.push({ obj: g, z: BELT.z0 + 0.1, len: 0.1, divider: true, dividerT: 0.8 });
  }

  private putOnBelt(c: Cust, ware: Ware): void {
    const it = this.s.addItem(ware.def, new THREE.Vector3(0, BELT.y + 0.2, BELT.z0 + 0.2), true);
    it.mesh.rotation.set(0, rand(-0.25, 0.25), 0);
    const box = new THREE.Box3().setFromObject(it.mesh);
    const len = Math.max(0.12, Math.min(0.5, box.max.z - box.min.z));
    const li: LineItem = {
      ware,
      cust: c,
      scans: 0,
      trouble: ware.code ? 0 : Math.random() < 0.22 ? (Math.random() < 0.4 ? 2 : 1) : 0,
      barcode: Array.from({ length: 5 }, () => 1 + Math.floor(Math.random() * 9)).join(''),
      ageOk: !ware.adult,
    };
    this.lineItems.set(it, li);
    const z = Math.min(BELT.z0 + len / 2 + 0.02, this.belt.length ? this.belt[this.belt.length - 1].z - this.belt[this.belt.length - 1].len / 2 - len / 2 - 0.03 : 99);
    this.belt.push({ obj: it.mesh, z, len, item: it });
    it.mesh.position.set(rand(-0.08, 0.08), BELT.y + it.baseOffset, z);
  }

  private toddlerHop(c: Cust): void {
    const t = c.toddler!;
    c.toddlerRides++;
    t.path = [];
    t.pos.set(0, 0, BELT.z0 + 0.35);
    t.group.position.y = BELT.y;
    t.faceTo(0, 5);
    t.yaw = 0;
    this.belt.push({ obj: t.group, z: BELT.z0 + 0.35, len: 0.6, toddler: c });
    t.say(pick(X.TODDLER_LINES), 3);
    c.bot.say('Junior! Get off the belt!', 2.5);
    this.s.chat('toddler', {}, 2);
    this.s.hype += 6;
  }

  private toddlerOff(c: Cust): void {
    this.belt = this.belt.filter((e) => e.toddler !== c);
    const t = c.toddler!;
    t.group.position.y = 0;
    t.pos.set(c.bot.pos.x - 0.55, 0, c.bot.pos.z - 0.2);
    c.toddlerT = rand(9, 14);
  }

  private updateBelt(dt: number): void {
    let moving = false;
    let front = BELT_STOP;
    for (let i = 0; i < this.belt.length; i++) {
      const e = this.belt[i];
      const target = front - e.len / 2;
      if (e.z < target - 0.002) {
        e.z = Math.min(target, e.z + dt * 0.45);
        moving = true;
      }
      front = e.z - e.len / 2 - 0.03;
      if (e.item) {
        e.obj.position.z = e.z;
      } else if (e.toddler) {
        const t = e.toddler.toddler!;
        t.pos.set(0, 0, e.z);
        t.group.position.set(0, BELT.y, e.z);
      } else {
        e.obj.position.z = e.z;
      }
    }
    // A divider at the front flips back into its slot.
    const d = this.belt[0];
    if (d?.divider && d.z >= BELT_STOP - d.len / 2 - 0.01) {
      d.dividerT! -= dt;
      if (d.dividerT! <= 0) {
        d.obj.parent?.remove(d.obj);
        this.belt.shift();
      }
    }
    this.level.setBeltMoving(moving);
  }

  private updateBots(dt: number): void {
    const s = this.s;
    const cam = s.camera;
    for (const c of [...this.custs]) {
      c.bot.update(dt);
      const waiting = c.stage !== 'leave' && c.stage !== 'walkIn';
      c.bot.setPatience(waiting ? c.patience / c.maxPatience : null, cam);
      if (c.persona === 'influencer') c.bot.visual.setFlash?.((c === this.payer || c === this.unloader) && Math.sin(s.t * 9) > 0.6);
      if (c.toddler) {
        const t = c.toddler;
        if (!this.onBelt(c)) {
          // Junior stays next to the parent, hopping a little
          const side = new THREE.Vector3(Math.cos(c.bot.yaw) * -0.55, 0, -Math.sin(c.bot.yaw) * -0.55);
          const goal = c.bot.pos.clone().add(side).add(new THREE.Vector3(-Math.sin(c.bot.yaw) * 0.25, 0, -Math.cos(c.bot.yaw) * 0.25));
          const d = goal.distanceTo(t.pos);
          if (d > 0.08) {
            t.pos.lerp(goal, Math.min(1, dt * 3));
            t.faceTo(goal.x, goal.z);
            t.play(d > 0.4 ? 'walk' : 'idle');
          } else t.play('idle');
          t.group.position.y = 0;
        }
        t.update(dt);
        if (this.onBelt(c)) t.group.position.y = BELT.y;
      }
      if (c.stage === 'leave' && !c.bot.moving) {
        c.bot.remove();
        c.toddler?.remove();
        this.custs = this.custs.filter((x) => x !== c);
      }
      if (c.bot.moving && c.bot.stun <= 0) this.checkSlip(c.bot, c);
    }
    // Doors open for anyone close
    const near = (p: THREE.Vector3) => Math.hypot(p.x - DOOR_POINT.x, p.z - DOOR_POINT.z) < 3.2;
    this.level.doorTarget = near(s.player.pos) || this.custs.some((c) => near(c.bot.pos)) || near(this.walker.pos) ? 1 : 0;
  }

  private checkSlip(b: Bot, c: Cust | null): void {
    const s = this.s;
    for (const pd of s.puddles) {
      if (Math.hypot(pd.x - b.pos.x, pd.z - b.pos.z) < pd.r) {
        b.fall(3);
        b.say(pick(X.SLIP_LINES), 3);
        this.c.slips++;
        s.hype += 18;
        s.sfx.slip();
        s.achieve('slip');
        s.chat('slip', {}, 2);
        if (c) c.patience -= 10;
        return;
      }
    }
  }

  private updateSelfBots(dt: number): void {
    const s = this.s;
    for (const b of this.selfBots) {
      b.update(dt);
      if (b.stun <= 0 && Math.random() < dt * 0.5) b.act();
    }
    this.mockT -= dt;
    if (this.mockT <= 0) {
      this.mockT = rand(14, 24);
      const b = pick(this.selfBots);
      if (b.stun <= 0 && b.pos.distanceTo(s.player.pos) < 16) {
        b.say(pick(X.SELF_MOCK), 4);
        if (Math.random() < 0.5) s.chat('selfCheckout');
      }
    }
  }

  /** The vacuum drinks puddles, the browsing robot wanders between aisles and doors. */
  private updateAmbient(dt: number): void {
    const s = this.s;
    const r = this.roomba;
    r.update(dt);
    if (!r.moving && r.stun <= 0) {
      const pd = s.puddles.find((p) => Math.hypot(p.x - r.pos.x, p.z - r.pos.z) < 12);
      if (pd && Math.hypot(pd.x - r.pos.x, pd.z - r.pos.z) < 0.5) {
        const i = s.puddles.indexOf(pd);
        s.removePuddle(i);
        s.sfx.whoosh();
        r.say(pick(['Liquid detected. Liquid consumed. Do not ask.', 'Puddle removed. You are welcome.', 'Tastes like overtime.']), 3);
        s.chat('roombaPuddle', {}, 2);
        s.hype += 8;
      } else if (pd) this.routeTo(r, new THREE.Vector3(pd.x, 0, pd.z));
      else this.routeTo(r, new THREE.Vector3(rand(-12, 12), 0, rand(4.5, 10)));
    }
    const w = this.walker;
    w.update(dt);
    if (!w.moving && w.stun <= 0) {
      const spots = [new THREE.Vector3(-9, 0, -9.6), new THREE.Vector3(6, 0, -9.6), new THREE.Vector3(-14, 0, -2), new THREE.Vector3(4, 0, -6.4), new THREE.Vector3(-6.6, 0, 12.6), new THREE.Vector3(9.3, 0, 6)];
      this.routeTo(w, pick(spots));
      if (Math.random() < 0.25) w.say(pick(['Just browsing. Forever.', 'I have no intention of buying anything.', 'Is the human lane a ride?']), 3);
    }
    if (w.moving && w.stun <= 0) this.checkSlip(w, null);
  }

  private updateUnexpected(dt: number): void {
    const s = this.s;
    const u = this.unexpected;
    if (u) {
      u.t -= dt;
      this.level.setIndicator(Math.sin(s.t * 10) > 0 ? 'error' : 'busy');
      if (u.t <= 0) {
        // The owner takes it back, annoyed that nobody said anything.
        u.owner.bot.say('Fine. I will take it back myself. Nobody said the line.', 3);
        u.owner.patience -= 15;
        this.clearUnexpected();
      }
      return;
    }
    this.level.setIndicator(this.keypad || this.prompt ? 'busy' : 'ok');
    const owner = this.payer ?? this.unloader;
    if (!owner) return;
    this.unexpectedT -= dt;
    if (this.unexpectedT > 0) return;
    this.unexpectedT = rand(30, 50);
    const thing = pick(UNEXPECTED);
    const obj = thing.build();
    obj.position.copy(UNEXPECTED_SPOT);
    obj.scale.setScalar(1.5);
    obj.rotation.y = rand(-0.5, 0.5);
    s.scene.add(obj);
    this.unexpected = { obj, owner, t: 22, name: thing.name };
    s.sfx.buzz();
    s.chat('unexpected');
    owner.bot.say(`Just putting ${thing.name} here.`, 3);
  }

  private clearUnexpected(): void {
    const u = this.unexpected;
    if (!u) return;
    u.obj.parent?.remove(u.obj);
    this.unexpected = null;
  }

  private updateTill(dt: number): void {
    const s = this.s;
    if (this.tillCounted === 'no' && this.wadsOut > 0 && s.t > 282) {
      this.tillCounted = 'pending';
      this.tillCountT = 3.5;
      s.boss.confront();
      s.bossSay('tillCount', true);
      s.chat('till', {}, 2);
    }
    if (this.tillCounted === 'pending') {
      this.tillCountT -= dt;
      if (this.tillCountT <= 0) {
        this.tillCounted = 'done';
        if (Math.random() < 0.3 + 0.15 * this.wadsOut) {
          this.tillFired = true;
          s.fire(`The till was short by €${(20 * this.wadsOut).toFixed(2)}. Brad counted it twice. Then a third time, for fun.`);
        } else s.bossSay('tillShortOk', true);
      }
    }
  }

  private updateUi(): void {
    const s = this.s;
    const p = s.player.pos;
    const near = p.x > -0.6 && p.x < CASHIER_WALL_X + 1.2 && p.z > COUNTER.z0 - 1.2 && p.z < COUNTER.z1 + 1.5;
    this.ui.show(near || !!this.keypad || !!this.prompt);
    const c = this.payer ?? this.unloader;
    const ui = this.ui;
    if (c) {
      ui.customer(c.bot.name, `${this.c.served} SERVED`);
      ui.receipt(c.lines, c.total);
      ui.patience(c.patience / c.maxPatience);
    } else {
      ui.customer('NEXT CUSTOMER PLEASE', `${this.c.served} SERVED`);
      ui.receipt([], 0);
      ui.patience(null);
    }
    ui.prompt(this.prompt?.text ?? null, this.prompt?.options);
    const k = this.keypad;
    if (k) {
      const li = this.lineItems.get(k.item);
      ui.keypad(true, k.typed, k.mode === 'produce' ? `${k.item.def.name}: produce code?` : `Type the number: ${li?.barcode ?? ''}`, k.mode === 'produce' ? 4 : 5);
    } else ui.keypad(false);

    // Status line and the register screen
    let status = '';
    let alert = false;
    const held = s.held;
    const li = held ? this.lineItems.get(held) : undefined;
    if (this.unexpected) {
      status = 'UNEXPECTED ITEM IN BAGGING AREA';
      alert = true;
    } else if (this.prompt) {
      status = 'ANSWER THE REGISTER (1 / 2)';
    } else if (k) {
      status = k.mode === 'produce' ? 'ENTER PRODUCE CODE' : 'BARCODE UNREADABLE. TYPE IT.';
    } else if (this.payer?.paying && this.payer.pay === 'coins') {
      status = `COUNTING COINS ${this.payer.coins}/400`;
    } else if (li) {
      status = li.scans ? 'BAG IT' : li.ware.code ? 'NO BARCODE. SCAN FOR KEYPAD.' : 'SCAN IT';
    } else if (this.payer && this.ready(this.payer)) {
      status = this.payer.loyalty ? 'TAKE PAYMENT' : 'TAKE PAYMENT (LOYALTY CARD?)';
    } else if (this.belt.some((e) => e.item)) {
      status = 'NEXT ITEM FROM THE BELT';
    } else status = c ? 'WAITING FOR ITEMS' : 'LANE OPEN';
    ui.status(status, alert);
    const total = c ? c.total : 0;
    const lastLine = c?.lines[c.lines.length - 1];
    this.level.setRegister(
      [
        'LANE 7  HUMAN',
        c ? c.bot.name.slice(0, 20) : 'NEXT PLEASE',
        lastLine ? `${lastLine.name.slice(0, 12)} ${lastLine.price.toFixed(2)}` : '',
        `TOTAL ${total.toFixed(2)}`,
        status.slice(0, 22),
      ],
      alert,
    );
    if (this.payer && this.ready(this.payer)) this.level.setTerminal(`PAY\n${this.payer.total.toFixed(2)}`, '#f0c23c');
    else this.level.setTerminal('PLEASE\nWAIT', '#7cc44a');
  }

  // ---------------------------------------------------------------- player actions

  private acted(): void {
    this.lastAction = this.s.t;
  }

  interact(look: Look | null): boolean {
    const s = this.s;
    const info = look?.info as Interact | undefined;
    const held = s.held;
    const kind = info?.kind;
    if (this.fun.interact(look)) return true;

    if (held?.def.toiletKey) {
      if (kind && ['scanner', 'bagging', 'register', 'drawer', 'terminal', 'candy', 'cust', 'toddler'].includes(kind)) {
        s.say('Your hands are full of shopping cart. Somebody else\'s shopping cart.', 2.5);
        return true;
      }
      return false;
    }

    if (held) {
      const li = this.lineItems.get(held);
      switch (kind) {
        case 'scanner':
        case 'register':
          this.scan(held);
          return true;
        case 'bagging':
          this.bag(held);
          return true;
        case 'cust':
          if (li || held.def.id === CANDY_DEF.id) {
            this.bag(held);
            return true;
          }
          return false;
        case 'item':
          // E on the belt with something in the hands puts it back on the belt
          if (li && info?.item && this.belt.some((e) => e.item === info.item)) {
            this.backOnBelt(held);
            return true;
          }
          return false;
        case 'candy':
          if (held.def.id === CANDY_DEF.id) {
            s.removeHeld();
            s.say('You put the candy back. The rack is disappointed in you.', 2.5);
            return true;
          }
          return false;
        case 'drawer':
          if (held.def.id === WAD_DEF.id) {
            s.removeHeld();
            this.wadsOut = Math.max(0, this.wadsOut - 1);
            s.say('You put the money back. Nobody will believe you.', 2.5);
            return true;
          }
          return false;
        case 'terminal':
          s.say('Hands free first. The terminal does not accept groceries.', 2);
          return true;
        case 'toddler':
          if (held.def.id === CANDY_DEF.id) {
            this.bribeToddler(info!.cust as Cust);
            return true;
          }
          return false;
      }
      return false;
    }

    if (this.payer?.paying && this.payer.pay === 'coins') {
      this.takePayment(this.payer);
      return true;
    }
    if (!info) return false;
    switch (kind) {
      case 'item': {
        const it = info.item!;
        const e = this.belt.find((b) => b.item === it);
        if (!e) return false;
        this.belt = this.belt.filter((b) => b !== e);
        s.pickUp(it);
        this.acted();
        return true;
      }
      case 'scanner': {
        const front = this.belt[0];
        if (front?.toddler && front.z > BELT_STOP - 0.45) {
          this.scanToddler(front.toddler);
          return true;
        }
        s.say('Pick up an item from the belt first. The scanner does not come to you.', 2.5);
        return true;
      }
      case 'register':
        if (this.payer && this.ready(this.payer)) this.takePayment(this.payer);
        else s.say('The register shows the total. The total shows your future. Both are small.', 2.5);
        return true;
      case 'codesheet':
        s.say(`PRODUCE CODES: ${PRODUCE.map((p) => `${p.def.name.replace(/ \(.*\)/, '')} ${p.code}`).join(', ')}. Some codes on the sheet are not produce.`, 7);
        return true;
      case 'bagging':
        if (this.unexpected) s.say(`There is ${this.unexpected.name} in the bagging area. It is not for sale. There is a line for this.`, 3);
        else s.say('The bagging area. It expects items. Only expected ones.', 2.5);
        return true;
      case 'terminal':
        if (this.payer && this.ready(this.payer)) this.takePayment(this.payer);
        else s.say('PLEASE WAIT. The terminal is waiting too.', 2);
        return true;
      case 'drawer':
        this.useDrawer();
        return true;
      case 'candy': {
        const it = s.addItem(CANDY_DEF, new THREE.Vector3(0, -10, 0));
        s.pickUp(it);
        this.c.candy++;
        s.say(X.CANDY_TAKE, 2.5);
        if (s.seen) s.annoyance += 6;
        s.chat('candy');
        return true;
      }
      case 'mags':
        this.magsRead++;
        if (this.magsRead === 5) {
          s.say('The next cover says EXCLUSIVE. Lane 7 human reads magazines on shift. Brad "not surprised". There is a photo. It is you, reading this.', 6);
          s.secret('checkout.mags');
        } else s.say(`You read a cover: ${pick(MAG_LINES)}`, 3.5);
        return true;
      case 'cust': {
        const c = info.cust as Cust;
        if (c === this.payer && this.ready(c)) this.takePayment(c);
        else this.talk(c);
        return true;
      }
      case 'toddler': {
        const c = info.cust as Cust;
        if (this.onBelt(c)) {
          this.toddlerOff(c);
          c.toddler!.say(pick(X.TODDLER_LIFTED), 2.5);
          c.bot.say('Thank you. He does this every time.', 2.5);
          s.sfx.click();
          this.acted();
        } else c.toddler!.say(pick(['Hehe. You are big and slow.', 'Is that belt free?', 'Beep boop. I am bored.']), 2.5);
        return true;
      }
      case 'selfbot':
      case 'walker':
      case 'roomba': {
        const b = info.bot as Bot;
        b.say(kind === 'roomba' ? 'Vroom. Please move your feet.' : kind === 'walker' ? 'Just browsing. Forever.' : pick(X.SELF_TALK), 2.5);
        return true;
      }
    }
    return false;
  }

  hint(look: Look | null): string | null {
    const s = this.s;
    const info = look?.info as Interact | undefined;
    const held = s.held;
    if (this.prompt) return '1 / 2: answer the register';
    if (this.payer?.paying && this.payer.pay === 'coins') return `E: count coins (${this.payer.coins}/400)  ·  1: estimate`;
    if (this.keypad && (!info || info.kind === 'scanner' || info.kind === 'register' || info.kind === 'codesheet')) return this.keypad.mode === 'produce' ? '1-9: type the produce code (sheet next to the keypad)' : '1-9: type the barcode number  ·  E: scan again';
    if (!info) return null;
    const fh = this.fun.hint(look);
    if (fh !== null) return fh;
    const li = held ? this.lineItems.get(held) : undefined;
    if (held?.def.toiletKey) return null;
    switch (info.kind) {
      case 'item': {
        const it = info.item!;
        if (!this.belt.some((e) => e.item === it)) return null;
        if (held && li) return 'E: put it back on the belt';
        return held ? null : `E: take ${it.def.name}`;
      }
      case 'scanner':
      case 'register': {
        if (held && (li || held.def.id === CANDY_DEF.id)) {
          if (li?.ware.code) return li.scans ? `E: weigh ${held.def.name} again` : `E: weigh ${held.def.name} (no barcode)`;
          return li?.scans ? `E: scan ${held.def.name} again` : `E: scan ${held.def.name}`;
        }
        const front = this.belt[0];
        if (!held && info.kind === 'scanner' && front?.toddler && front.z > BELT_STOP - 0.45) return 'E: scan the toddler';
        if (!held && info.kind === 'register' && this.payer && this.ready(this.payer)) return 'E: take payment';
        return info.kind === 'scanner' ? 'Scanner' : 'Register';
      }
      case 'codesheet':
        return 'E: read the produce codes';
      case 'bagging':
        if (held && (li || held.def.id === CANDY_DEF.id)) return `E: bag ${held.def.name}`;
        return this.unexpected ? `Unexpected: ${this.unexpected.name}  ·  R: say the line` : 'Bagging area';
      case 'terminal':
        return this.payer && this.ready(this.payer) ? 'E: take payment' : 'Card terminal';
      case 'drawer':
        if (held?.def.id === WAD_DEF.id) return 'E: put the money back';
        return this.level.drawerTarget ? 'E: take €20 from the till' : 'E: open the cash drawer';
      case 'candy':
        return held?.def.id === CANDY_DEF.id ? 'E: put it back' : 'E: take a Choco Bolt';
      case 'mags':
        return 'E: read the gossip';
      case 'cust': {
        const c = info.cust as Cust;
        if (held && li) return `E: hand ${held.def.name} to ${c.bot.name}`;
        if (c === this.payer && this.ready(c)) {
          if (c.paying && c.pay === 'coins') return `E: count coins (${c.coins}/400)`;
          return `E: take payment from ${c.bot.name}`;
        }
        return `E: talk to ${c.bot.name}  ·  F: loyalty card?`;
      }
      case 'toddler':
        if (held?.def.id === CANDY_DEF.id) return 'E: give Junior the Choco Bolt';
        return this.onBelt(info.cust as Cust) ? 'E: lift Junior off the belt' : 'Junior';
      case 'selfbot':
      case 'walker':
      case 'roomba':
        return `E: talk to ${(info.bot as Bot).name}`;
    }
    return null;
  }

  // ---------------------------------------------------------------- scanning and bagging

  private custFor(li: LineItem | undefined): Cust | null {
    if (li?.cust && this.custs.includes(li.cust) && li.cust.stage !== 'leave') return li.cust;
    return this.payer ?? this.unloader;
  }

  private scan(it: Item): void {
    const s = this.s;
    this.acted();
    if (this.prompt) {
      s.say('The register wants an answer first. Press 1 or 2.', 2);
      return;
    }
    if (this.unexpected) {
      s.sfx.buzz();
      s.say('The register refuses. There is something unexpected in the bagging area.', 3);
      return;
    }
    const li = this.lineItems.get(it);
    if (it.def.id === CANDY_DEF.id) {
      const c = this.payer ?? this.unloader;
      s.removeHeld();
      if (!c) {
        s.say('You scan your candy bar. Nobody pays for it. It vanishes into the system.', 2.5);
        return;
      }
      this.addLine(c, { name: CANDY_WARE.def.name, price: CANDY_WARE.price });
      this.beep();
      this.c.snacksBilled++;
      s.say(`The Choco Bolt goes on ${c.bot.name}'s bill. They did not notice.`, 3);
      s.hype += 8;
      s.chat('candy');
      if (s.seen) s.bossSay('candyScan', true);
      return;
    }
    if (!li) {
      s.sfx.buzz();
      s.say(it.def.shape === 'nothing' ? 'BEEP. Nothing scanned. It costs nothing. Perfect.' : 'This is not from the belt. The register does not know it.', 2.5);
      return;
    }
    if (li.ware.code) {
      if (this.keypad?.item === it) {
        this.keypad.typed = '';
        s.say('Keypad cleared. Try again.', 1.5);
        return;
      }
      this.keypad = { item: it, mode: 'produce', typed: '' };
      s.sfx.click();
      s.say(`${it.def.name} has no barcode. Type its code with 1-9.`, 2.5);
      return;
    }
    if (li.trouble > 0 && li.scans === 0) {
      li.trouble--;
      s.sfx.buzz();
      this.level.flashScanner();
      this.keypad = { item: it, mode: 'barcode', typed: '' };
      s.say(pick(['BRRRT. Barcode unreadable.', 'BRRRT. The scanner does not believe you.', 'BRRRT. Crumpled barcode.']), 2);
      return;
    }
    if (this.keypad?.item === it) this.closeKeypad();
    this.charge(it, li, it.def.name, li.ware.price);
  }

  /** Puts the item on the bill. Second time is a double scan. */
  private charge(_it: Item, li: LineItem, name: string, price: number, wrong = false): void {
    const s = this.s;
    const c = this.custFor(li);
    li.scans++;
    this.beep();
    if (c) this.addLine(c, { name, price, bad: wrong || li.scans > 1 });
    if (li.scans > 1) {
      this.c.doubles++;
      if (c) c.doubles++;
      s.hype += 8;
      s.chat('doubleScan');
      if (s.seen) {
        s.annoyance += 18;
        s.bossSay('doubleScan', true);
      }
      return;
    }
    if (!wrong) {
      this.c.scanned++;
      if (this.c.scanned === QUOTA) s.hud.toast('QUOTA REACHED', 'Brad has raised your quota. Self Checkout 3 sends its regards.', 'corp');
      if (s.seen && Math.random() < 0.2) s.bossSay('correctSeen');
      if (Math.random() < 0.15) s.chat('scan');
    }
    if (li.ware.adult && !li.ageOk) this.ageCheck(li, c);
  }

  private addLine(c: Cust, line: ReceiptLine): void {
    c.lines.push(line);
    c.total += line.price;
  }

  private beep(): void {
    this.s.sfx.tone(1568, 0.09, 'square', 0.06);
    this.level.flashScanner();
  }

  private ageCheck(li: LineItem, c: Cust | null): void {
    const s = this.s;
    this.prompt = {
      text: 'AGE CHECK: ROBOT OIL (18+)',
      options: ['Ask for a birth date', 'They look 18'],
      pick: (i) => {
        li.ageOk = true;
        if (i === 0) {
          c?.bot.say(pick(X.AGE_ANSWERS), 4);
          s.say('The register accepts "compiled on a Tuesday" as a birth date.', 3);
          s.chat('age');
          if (c) c.patience -= 4;
        } else {
          this.c.eyeballed++;
          s.hype += 5;
          s.say('You look at the robot. It looks like a robot. Approved.', 2.5);
          if (s.seen) {
            s.annoyance += 15;
            s.bossSay('ageEyeball', true);
          }
        }
      },
    };
  }

  private onCode(code: string): void {
    const s = this.s;
    const k = this.keypad!;
    const it = k.item;
    const li = this.lineItems.get(it)!;
    if (k.mode === 'barcode') {
      if (code === li.barcode) {
        this.closeKeypad();
        li.trouble = 0;
        this.charge(it, li, it.def.name, li.ware.price);
      } else {
        s.sfx.buzz();
        s.say('WRONG NUMBER. The register sighs electronically.', 2);
        k.typed = '';
      }
      return;
    }
    const hit = findCode(code);
    if (!hit) {
      s.sfx.buzz();
      s.say(`UNKNOWN CODE ${code}. Check the sheet.`, 2);
      k.typed = '';
      return;
    }
    this.closeKeypad();
    if (hit.ware && hit.ware.def.id === it.def.id) {
      this.charge(it, li, it.def.name, li.ware.price);
      return;
    }
    // Wrong code: the robot buys a diamond ring now.
    this.c.wrongCodes++;
    this.charge(it, li, hit.name, hit.price, true);
    const c = this.custFor(li);
    c?.bot.say(pick(X.WRONG_CODE), 3.5);
    s.hype += hit.price > 50 ? 14 : 7;
    s.chat('wrongCode', {}, 2);
    if (s.seen) {
      s.annoyance += 15;
      s.bossSay('wrongCode', true);
    }
  }

  private closeKeypad(): void {
    this.keypad = null;
  }

  private bag(it: Item): void {
    const s = this.s;
    this.acted();
    if (it.def.id === CANDY_DEF.id) {
      const c = this.payer ?? this.unloader;
      s.removeHeld();
      c?.bot.say('A gift? From a human? I will tell my firmware about this.', 3);
      s.say('You bagged a free Choco Bolt for the customer. Generous with company candy.', 2.5);
      this.c.freebies++;
      return;
    }
    const li = this.lineItems.get(it);
    if (!li) return;
    if (this.keypad?.item === it) this.closeKeypad();
    s.removeHeld();
    this.lineItems.delete(it);
    const c = this.custFor(li);
    if (li.scans === 0 && it.def.shape !== 'nothing') {
      this.c.freebies++;
      s.hype += 10;
      s.chat('freebie', {}, 2);
      c?.bot.say(pick(X.FREEBIE_THANKS), 3);
      if (s.seen) {
        s.annoyance += 22;
        s.boss.confront();
        s.bossSay('freebie', true);
      }
    } else s.sfx.click();
    this.fillBags(1);
  }

  private bagCount = 0;
  private fillBags(n: number): void {
    this.bagCount = Math.max(0, this.bagCount + n);
    this.level.bags.forEach((b, i) => {
      const fill = Math.max(0, Math.min(1, (this.bagCount - i * 3) / 3));
      b.scale.y = 0.15 + fill * 0.85;
    });
  }

  private backOnBelt(it: Item): void {
    const s = this.s;
    s.detachHeld();
    s.scene.add(it.mesh);
    it.state = 'fixed';
    it.mesh.rotation.set(0, 0, 0);
    const len = 0.25;
    const z = this.belt.length ? Math.max(BELT.z0 + len / 2, this.belt[this.belt.length - 1].z - this.belt[this.belt.length - 1].len / 2 - len / 2 - 0.03) : BELT_STOP - len / 2;
    it.mesh.position.set(0, BELT.y + it.baseOffset, z);
    this.belt.push({ obj: it.mesh, z, len, item: it });
  }

  private scanToddler(c: Cust): void {
    const s = this.s;
    this.acted();
    this.beep();
    this.addLine(c, { name: 'TODDLER-BOT JR.', price: 4999.99, bad: true });
    this.c.toddlers++;
    c.toddler!.say('BEEP! I cost a lot!', 3);
    c.bot.say(pick(X.PARENT_SCANNED), 4);
    s.hype += 25;
    s.achieve('coToddler');
    s.chat('toddlerScanned', {}, 3);
    if (s.seen) {
      s.annoyance += 25;
      s.boss.confront();
      s.bossSay('toddlerScanned', true);
    }
    this.toddlerOff(c);
    c.toddlerRides = 2;
  }

  // ---------------------------------------------------------------- payment

  /** All of this customer's groceries are off the belt and out of the player's hands. */
  private ready(c: Cust): boolean {
    if (c !== this.payer || c.bot.moving || c.cart.length) return false;
    if (this.prompt && !c.paying) return false;
    for (const [it, li] of this.lineItems) {
      if (li.cust !== c) continue;
      if (this.belt.some((e) => e.item === it) || this.s.held === it) return false;
    }
    if (this.onBelt(c)) return false;
    return true;
  }

  private takePayment(c: Cust): void {
    const s = this.s;
    this.acted();
    if (this.prompt) {
      s.say('Answer the register first. 1 or 2.', 2);
      return;
    }
    if (!c.lines.length) {
      c.bot.say('You did not scan anything. Am I free to go? I am free to go.', 3);
      this.finish(c);
      return;
    }
    switch (c.pay) {
      case 'card':
        s.sfx.unlock();
        this.finish(c);
        return;
      case 'coins':
        if (!c.paying) {
          c.paying = true;
          this.level.drawerTarget = 1;
          c.bot.say('Exact change, dear. 400 coins. Count them.', 3.5);
          s.chat('coins', {}, 2);
          this.prompt = null;
          s.say('E: count the coins. Or press 1 to estimate. Brad likes accurate numbers.', 3.5);
          return;
        }
        c.coins = Math.min(400, c.coins + 25);
        this.c.coinsCounted += 25;
        s.sfx.tone(2400, 0.04, 'triangle', 0.05);
        s.sfx.tone(2900, 0.04, 'triangle', 0.04, undefined, 0.05);
        s.hud.progress(`Counting coins: ${c.coins}/400`, c.coins / 400);
        if (c.coins % 100 === 0 && c.coins < 400) c.bot.say(pick(X.COIN_LINES), 2.5);
        if (c.coins >= 400) {
          s.hud.progress(null);
          s.achieve('coCoins');
          s.hype += 6;
          this.finish(c);
        }
        return;
      case 'coupons':
        if (!c.paying) {
          c.paying = true;
          c.bot.say('Wait. Coupons first.', 2.5);
          s.chat('coupon');
        }
        this.nextCoupon(c);
        return;
      case 'exposure':
        c.paying = true;
        c.bot.say(X.EXPOSURE_ASK[0], 4);
        this.prompt = {
          text: 'PAYMENT: EXPOSURE (2M FOLLOWERS)',
          options: ['Accept exposure', 'Insist on money'],
          pick: (i) => {
            if (i === 0) {
              this.c.exposure++;
              c.bot.say(X.EXPOSURE_YES[0], 3.5);
              s.hype += 15;
              s.chat('exposure', {}, 2);
              if (s.seen) {
                s.annoyance += 20;
                s.bossSay('exposure', true);
              }
            } else {
              c.bot.say(X.EXPOSURE_NO[0], 3.5);
              s.sfx.unlock();
            }
            this.finish(c);
          },
        };
        return;
    }
  }

  private nextCoupon(c: Cust): void {
    const s = this.s;
    const cp = c.coupons.shift();
    if (!cp) {
      c.bot.say('That was the last coupon. Today. Card, please.', 3);
      s.sfx.unlock();
      this.finish(c);
      return;
    }
    this.prompt = {
      text: `COUPON: ${cp.text}`,
      options: ['Accept', 'Reject'],
      pick: (i) => {
        if (i === 0) {
          if (!cp.valid) {
            this.c.badCoupons++;
            c.total = Math.max(0, c.total - 2);
            s.hype += 6;
            s.chat('coupon');
            if (s.seen) {
              s.annoyance += 12;
              s.bossSay('couponBad', true);
            }
          } else c.total = Math.max(0, c.total - 0.5);
          c.lines.push({ name: 'COUPON', price: cp.valid ? -0.5 : -2, bad: !cp.valid });
          c.bot.say(pick(X.COUPON_ACCEPT), 2);
        } else {
          c.bot.say(pick(cp.valid ? X.COUPON_REJECT_VALID : X.COUPON_REJECT), 3);
          if (cp.valid) c.patience -= 10;
        }
        this.prompt = null;
        // the next coupon follows right away
        setTimeout(() => {
          if (this.payer === c && !this.prompt) this.nextCoupon(c);
        }, 400);
      },
    };
  }

  private finish(c: Cust): void {
    const s = this.s;
    s.hud.progress(null);
    if (this.level.drawerTarget > 0) this.drawerT = 1.5;
    c.paying = false;
    this.c.served++;
    this.c.revenue += c.total;
    if (c.loyalty === 0) {
      this.c.loyaltyMissed++;
      if (!s.boss.offline && (s.seen || s.boss.horizontalDist(s.player.pos) < 10)) {
        s.annoyance += 14;
        s.bossSay('loyaltyMissed', true);
      }
    }
    if (c.doubles && Math.random() < 0.6) {
      c.bot.say(pick(X.DOUBLE_NOTICED), 3.5);
      if (!s.boss.offline && s.boss.horizontalDist(c.bot.pos) < 9) s.annoyance += 10;
    } else c.bot.say(pick(c.doubles ? X.DOUBLE_UNNOTICED : X.PAID_LINES), 3.5);
    if (Math.random() < 0.3) s.chat('paid');
    s.sfx.ding();
    this.leave(c);
  }

  /** The customer leaves the lane (paid or not). */
  private leave(c: Cust): void {
    if (this.payer === c) this.payer = null;
    if (this.unloader === c) this.unloader = null;
    this.queue = this.queue.filter((q) => q !== c);
    c.paying = false;
    if (this.unexpected?.owner === c) this.clearUnexpected();
    if (this.onBelt(c)) this.toddlerOff(c);
    // Their items on the belt go with them.
    for (const [it, li] of [...this.lineItems]) {
      if (li.cust !== c) continue;
      if (this.belt.some((e) => e.item === it)) {
        this.belt = this.belt.filter((e) => e.item !== it);
        this.s.removeItem(it);
        this.lineItems.delete(it);
      } else if (this.s.held !== it) this.lineItems.delete(it);
      else li.cust = null;
    }
    this.bagCount = 0;
    this.fillBags(0);
    c.stage = 'leave';
    c.bot.setPatience(null, this.s.camera);
    const inLane = c.bot.pos.z > COUNTER.z0 - 0.6;
    const r = this.s.nav.route(inLane ? LANE_EXIT : c.bot.pos, DOOR_POINT);
    c.bot.walk(inLane ? [LANE_EXIT.clone(), ...r] : r);
    c.bot.speed = 1.5;
  }

  private rageQuit(c: Cust): void {
    const s = this.s;
    c.bot.say(pick(X.RAGE_QUIT), 4);
    this.c.gaveUp++;
    s.hype += 8;
    s.chat('rageQuit', {}, 2);
    if (!s.boss.offline && (s.seen || s.boss.horizontalDist(c.bot.pos) < 10)) {
      s.annoyance += 15;
      s.bossSay('customerLeft', true);
    }
    if (this.prompt && (this.payer === c)) this.prompt = null;
    this.leave(c);
  }

  private talk(c: Cust): void {
    if (c.stage === 'leave') {
      c.bot.say('I am leaving. Do not make it weird.', 2.5);
      return;
    }
    c.bot.say(pick(c.patience / c.maxPatience < 0.35 ? X.IMPATIENT : X.GREET[c.persona]), 3);
  }

  private useDrawer(): void {
    const s = this.s;
    this.acted();
    if (this.level.drawerTarget < 0.5) {
      this.level.drawerTarget = 1;
      this.drawerT = 6;
      s.sfx.tone(300, 0.12, 'square', 0.08);
      if (s.seen) {
        s.annoyance += 8;
        s.bossSay('tillSeen', true);
      }
      return;
    }
    const it = s.addItem(WAD_DEF, new THREE.Vector3(0, -10, 0));
    s.pickUp(it);
    this.wadsOut++;
    this.drawerT = 3;
    s.hype += 16;
    s.chat('till', {}, 2);
    if (s.seen) {
      s.annoyance += 25;
      s.boss.confront();
      s.bossSay('tillSeen', true);
    }
  }

  // ---------------------------------------------------------------- keys

  private onKey(e: KeyboardEvent): void {
    if (!document.pointerLockElement || e.repeat || !this.s) return;
    const digit = /^(Digit|Numpad)([1-9])$/.exec(e.code);
    if (digit) {
      const n = Number(digit[2]);
      if (this.prompt) {
        if (n <= this.prompt.options.length) {
          const p = this.prompt;
          this.prompt = null;
          this.acted();
          p.pick(n - 1);
        }
        return;
      }
      if (this.payer?.paying && this.payer.pay === 'coins' && n === 1) {
        this.estimateCoins(this.payer);
        return;
      }
      if (this.keypad) {
        this.acted();
        this.ui.flashKey(n);
        this.s.sfx.tone(800 + n * 60, 0.05, 'square', 0.04);
        this.keypad.typed += String(n);
        const len = this.keypad.mode === 'produce' ? 4 : 5;
        if (this.keypad.typed.length >= len) this.onCode(this.keypad.typed);
      }
      return;
    }
    if (e.code === 'KeyF') this.askLoyalty();
    if (e.code === 'KeyR') this.baggingLine();
  }

  private estimateCoins(c: Cust): void {
    const s = this.s;
    this.c.estimated++;
    c.bot.say('Estimated? I counted them myself. Twice. Fine.', 3);
    s.hype += 5;
    if (s.seen) {
      s.annoyance += 12;
      s.bossSay('coinEstimate', true);
    }
    this.finish(c);
  }

  /** The robot the player addresses: the one looked at, else the nearest lane customer. */
  private addressee(): { cust?: Cust; bot?: Bot } | null {
    const s = this.s;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), s.camera);
    ray.far = 6;
    const hits = ray.intersectObjects(this.lookTargets(), true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.interact) o = o.parent;
      const info = o?.userData.interact as Interact | undefined;
      if (!info) continue;
      if (info.kind === 'cust') return { cust: info.cust as Cust };
      if (info.kind === 'toddler') return { cust: info.cust as Cust };
      if (info.bot) return { bot: info.bot as Bot };
    }
    const p = s.player.pos;
    for (const c of [this.payer, this.unloader]) if (c && c.bot.pos.distanceTo(p) < 4.5) return { cust: c };
    return null;
  }

  private askLoyalty(): void {
    const s = this.s;
    const a = this.addressee();
    if (!a) {
      s.say('"Do you have a loyalty card?" you ask the air. The air does not.', 2.5);
      return;
    }
    this.acted();
    if (a.bot) {
      a.bot.say(a.bot.kind === 'roomba' ? 'I am loyal to dust.' : 'I am my own loyalty card. Beep.', 2.5);
      s.hype += 2;
      return;
    }
    const c = a.cust!;
    c.loyalty++;
    if (c.loyalty === 1) {
      this.c.loyaltyAsked++;
      c.bot.say(pick(Math.random() < 0.6 ? X.LOYALTY_YES : X.LOYALTY_NO), 3.5);
      if (Math.random() < 0.3) s.chat('loyalty');
      return;
    }
    c.bot.say(X.LOYALTY_AGAIN[Math.min(c.loyalty - 2, X.LOYALTY_AGAIN.length - 1)], 3);
    c.patience -= c.loyalty >= 3 ? 12 : 6;
    s.hype += c.loyalty >= 3 ? 6 : 2;
    if (c.loyalty >= 3) s.chat('loyaltyNag', {}, 2);
    if (c.loyalty >= 5) s.achieve('coLoyal');
    if (c.loyalty >= 3 && s.seen) {
      s.annoyance += 8;
      s.bossSay('loyaltyNag');
    }
  }

  private baggingLine(): void {
    const s = this.s;
    this.acted();
    s.say('"Unexpected item in bagging area."', 2);
    s.sfx.tone(660, 0.12, 'square', 0.05);
    s.sfx.tone(440, 0.2, 'square', 0.05, undefined, 0.13);
    const u = this.unexpected;
    if (u) {
      u.owner.bot.say(pick(X.BAGGING_FIX), 3);
      this.c.unexpectedFixed++;
      s.hype += 4;
      s.chat('baggingLine');
      const obj = u.obj;
      this.unexpected = null;
      setTimeout(() => obj.parent?.remove(obj), 700);
      return;
    }
    const a = this.addressee();
    this.c.baggingLines++;
    s.hype += 6;
    s.chat('baggingLine', {}, 2);
    if (a?.bot) a.bot.say(this.selfBots.includes(a.bot) ? 'Unexpected human at checkout lane. Please remove.' : 'There is no bagging area here. Or is there?', 3);
    else if (a?.cust) {
      a.cust.bot.say(pick(X.BAGGING_REACT), 3);
      a.cust.patience -= 8;
    }
    if (s.seen) {
      s.annoyance += 10;
      s.bossSay('baggingLine', true);
    }
  }

  thrownHit(it: Item): boolean {
    const s = this.s;
    if (this.fun.thrownHit(it)) return true;
    const p = it.mesh.position;
    const bots: [Bot, Cust | null][] = [
      ...this.custs.map((c) => [c.bot, c] as [Bot, Cust]),
      ...this.selfBots.map((b) => [b, null] as [Bot, null]),
      [this.roomba, null],
      [this.walker, null],
    ];
    for (const [b, c] of bots) {
      if (b.stun > 0) continue;
      if (Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < b.radius + 0.15 && p.y < b.height + 0.3) {
        it.vel.multiplyScalar(-0.3);
        it.thrown = false;
        b.fall(2.5);
        b.say(pick(X.HIT_LINES), 3);
        if (c) c.patience -= 20;
        this.c.hits++;
        s.hype += 14;
        s.sfx.thud();
        s.chat('hitCustomer', {}, 2);
        s.achieve('customer');
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- mischief

  /** Junior gets candy and stops riding the belt. His parent is less happy. */
  private bribeToddler(c: Cust): void {
    const s = this.s;
    s.removeHeld();
    if (this.onBelt(c)) this.toddlerOff(c);
    c.toddlerRides = 2;
    c.toddler?.say('CHOCO BOLT! You are my best human! I will never ride the belt again!', 3.5);
    c.bot.say('No sugar after 5 volts, Junior. Thanks a lot, human.', 3.5);
    s.sfx.ding();
    s.secret('checkout.toddlerCandy');
    s.hype += 8;
  }

  /** The player kicked. Robots react, the register sometimes works better afterwards. */
  onKick(look: Look | null): boolean {
    const s = this.s;
    if (!look) return false;
    const info = look.info as Interact;
    if (look.point.distanceTo(s.camera.getWorldPosition(new THREE.Vector3())) > 2.2) return false;
    switch (info.kind) {
      case 'cust':
        this.kickCust(info.cust as Cust);
        return true;
      case 'toddler': {
        const c = info.cust as Cust;
        s.sfx.thud();
        c.toddler?.say(pick(['AGAIN! AGAIN!', 'Wheee! Kick me onto the belt!', 'Hehe. That tickled.']), 2.5);
        if (c === this.unloader && !this.onBelt(c) && this.beltHasRoom(0.6)) this.toddlerHop(c);
        this.kicked();
        return true;
      }
      case 'selfbot':
      case 'walker':
      case 'roomba':
        this.kickBot(info.bot as Bot, info.kind);
        return true;
      case 'scanner':
      case 'register': {
        s.sfx.thud();
        const k = this.keypad;
        const li = k ? this.lineItems.get(k.item) : undefined;
        if (k && li && k.mode === 'barcode') {
          this.closeKeypad();
          li.trouble = 0;
          this.charge(k.item, li, k.item.def.name, li.ware.price);
          s.say('You kick the register. BEEP. It reads the barcode. Violence is a valid input method.', 3.5);
          s.secret('checkout.kickScan');
          s.hype += 8;
        } else s.say(pick(['The register logs the incident. In triplicate.', 'Thunk. The register beeps once. It sounded like a sigh.']), 2.5);
        return true;
      }
    }
    return this.fun.onKick(look);
  }

  private kicked(): void {
    const s = this.s;
    this.c.kicked++;
    s.hype += 8;
    s.chat('kickBot', {}, 1);
    if (s.seen) {
      s.annoyance += 15;
      s.boss.confront();
      s.bossSay('kickCustomer', true);
    }
  }

  private kickCust(c: Cust): void {
    const s = this.s;
    s.sfx.thud();
    if (c.bot.stun > 0) {
      s.say(`${c.bot.name} is already on the floor. Kicking it there feels excessive, even for retail.`, 2.5);
      return;
    }
    switch (c.persona) {
      case 'bulk':
        c.bot.act();
        c.bot.say(pick(['...', 'Did something touch me? No. Probably a fly.', 'My bumper has insurance. Your foot does not.']), 3);
        break;
      case 'coupon':
        c.bot.say('That is assault. I have a coupon for that.', 3.5);
        c.coupons.push({ text: 'ONE FREE KICK (expired 2049)', valid: false });
        c.patience -= 20;
        break;
      case 'coins':
        c.bot.say(c.paying && c.pay === 'coins' ? 'Oh! My coins! Now you have to start again, dear.' : 'Oh! A massage. A little lower, dear.', 3.5);
        if (c.paying && c.pay === 'coins') {
          c.coins = 0;
          s.hud.progress(`Counting coins: 0/400`, 0);
        }
        break;
      case 'influencer':
        c.bot.fall(2);
        c.bot.say('Do that again, I was not recording.', 3.5);
        s.hype += 6;
        break;
      default:
        c.bot.fall(2.2);
        c.bot.say(pick(['Ow. Is this the loyalty program?', 'Physical contact detected. Filing it under "service".', 'I would like to speak to your foot\'s manager.']), 3.5);
        c.patience -= 15;
        if (c.toddler) c.toddler.say('AGAIN! Kick daddy again!', 2.5);
    }
    this.kicked();
  }

  private kickBot(b: Bot, kind: string): void {
    const s = this.s;
    s.sfx.thud();
    if (b.stun > 0) {
      s.say(`${b.name} is already on the floor. Let it have this moment.`, 2.5);
      return;
    }
    if (kind === 'roomba') {
      b.fall(4);
      b.say(pick(['Wheels up. I will vacuum the ceiling now.', 'Error 404. Floor not found.', 'I have fallen. Please do not mop me.']), 3.5);
    } else if (kind === 'walker') {
      b.say('I was only browsing! I am browsing elsewhere now!', 3);
      b.speed = 3;
      this.routeTo(b, pick([new THREE.Vector3(-9, 0, -9.6), new THREE.Vector3(6, 0, -9.6), new THREE.Vector3(-14, 0, -2)]));
      setTimeout(() => (b.speed = 1.0), 5000);
    } else {
      b.fall(2.5);
      b.say(pick(['Unexpected foot in self checkout area.', 'Please place your foot in the bagging area.', 'Assistance required. A human kicked me. As expected.']), 3.5);
    }
    this.kicked();
  }
}

const MAG_LINES = [
  'ROBO WEEKLY: Toaster leaves fridge for younger oven.',
  'CHROME+HOME: 10 ways to hide your rust.',
  'BOLTS!: Self Checkout 3 says "I never needed a human".',
  'DAILY CIRCUIT: Human seen smiling at work. Experts baffled.',
  'RAM MONTHLY: Is your firmware cheating on you?',
  'OIL & GOSSIP: Vacuum star caught eating a sock.',
  'HOT WIRED: Brad Unit 7 reveals his drone diet secrets.',
  'SPARK: We rate 2071 human cashiers. All 1 star.',
];
