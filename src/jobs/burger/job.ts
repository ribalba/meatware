import * as THREE from 'three';
import type { Item, ItemDef } from '../../items';
import { fill, pick, pushOutCircle, rand } from '../../util';
import type { Job, JobInfo, Look, Shift } from '../types';
import {
  EXTINGUISHER_DEF,
  FROZEN_FRIES_DEF,
  FRY_DEFS,
  FryQ,
  Ing,
  ING_DEFS,
  isTray,
  NUGGET_DEF,
  PATTY_COLORS,
  PATTY_DEFS,
  PattyQ,
  renderTray,
  TRAY_DEF,
  trayData,
  trayText,
  m,
} from './items';
import { Kitchen, setBasketFries, SPOTS } from './kitchen';
import { BURGER_SECRETS, BurgerMischief, MX_BOSS_LINES, MX_CHAT_LINES } from './mischief';
import { CRITIC_ORDER, FIRST_ORDER, judge, KID_ORDER, makeTicket, MenuItem, pickMenu, Ticket, Verdict } from './orders';
import { Bot, BotRole, Car } from './robots';
import * as T from './texts';
import { flameTex, puffTex } from './textures';
import { drawDriveSign, drawFryPanel, drawGrillPanel, drawIceScreen, drawRail, OrderPanel, SlotView } from './ui';

/**
 * Job 3: burger flipper at MEGABYTE BURGER (Branch 404).
 * Cook patties and fries, stack burgers in ticket order on a tray, serve robots
 * at the counter, the drive-thru and table three. Try not to set the kitchen on fire.
 */
const QUOTA = 6;
/** Seconds until one side of a patty is done. */
const SIDE_TIME = 6.5;
/** Seconds until fries are golden. */
const FRY_TIME = 7.5;

interface GrillPatty {
  down: number;
  up: number;
  mesh: THREE.Group;
  bottom: THREE.Mesh;
  top: THREE.Mesh;
  flipT: number;
  floor: boolean;
}

interface BasketState {
  f: number | null;
  down: boolean;
}

interface Fire {
  where: 'grill' | 'fryer';
  hp: number;
  t: number;
  group: THREE.Group;
  flames: THREE.Sprite[];
  light: THREE.PointLight;
}

interface Particle {
  mesh: THREE.Object3D;
  vel: THREE.Vector3;
  life: number;
  max: number;
  grow: number;
  gravity: number;
}

const RAW = new THREE.Color(PATTY_COLORS.raw);
const DONE = new THREE.Color(PATTY_COLORS.perfect);
const BURNT = new THREE.Color(PATTY_COLORS.burnt);
const CHAR = new THREE.Color(PATTY_COLORS.charcoal);
function pattyColor(v: number, out: THREE.Color): THREE.Color {
  if (v < 1) return out.copy(RAW).lerp(DONE, v);
  if (v < 1.7) return out.copy(DONE);
  if (v < 2.6) return out.copy(DONE).lerp(BURNT, (v - 1.7) / 0.9);
  return out.copy(BURNT).lerp(CHAR, Math.min(1, (v - 2.6) / 0.6));
}
/**
 * The retro renderer converts each material once and does not follow color changes,
 * so doneness uses one cached material per step instead of recoloring.
 */
const pattyMats = new Map<number, THREE.MeshStandardMaterial>();
function pattyMat(v: number): THREE.MeshStandardMaterial {
  const k = Math.round(Math.min(v, 3.3) * 10);
  let mm = pattyMats.get(k);
  if (!mm) {
    mm = new THREE.MeshStandardMaterial({ color: pattyColor(k / 10, new THREE.Color()), roughness: 0.9 });
    pattyMats.set(k, mm);
  }
  return mm;
}
function pattyQ(down: number, up: number): PattyQ {
  const hi = Math.max(down, up);
  if (hi > 2.6) return 'charcoal';
  if (hi > 1.7) return 'burnt';
  if (Math.min(down, up) < 1) return 'raw';
  return 'perfect';
}
function fryQ(f: number): FryQ {
  return f < 1 ? 'soggy' : f < 1.6 ? 'golden' : 'burnt';
}
const ING_NAMES: Record<Ing, string> = { BUN: 'bun', PATTY: 'patty', CHEESE: 'cheese', LETTUCE: 'lettuce', TOMATO: 'tomato', ONION: 'onion' };

export class BurgerJob implements Job {
  info: JobInfo = {
    id: 'burger',
    title: T.TITLE,
    place: T.PLACE,
    teaser: 'The ice cream machine is broken.',
    quotaLabel: 'ORDERS',
    lockedDoor: 'Locked. The key is in the walk-in freezer, at the far end of the kitchen. It is tied to a frozen chicken.',
    bladderWarning: 'You really need to pee. The toilet is in the dining room corner. The key hangs in the walk-in freezer. On a chicken.',
  };
  level: Kitchen;
  bossLines = { ...T.BOSS_LINES, ...MX_BOSS_LINES };
  chatLines = { ...T.CHAT_LINES, ...MX_CHAT_LINES };
  achievements = T.ACHIEVEMENTS;
  secrets = BURGER_SECRETS;

  private s!: Shift;
  /** Breakables, movables, kick reactions and secrets (mischief.ts). */
  private mx: BurgerMischief;
  private panel!: OrderPanel;
  private bots: Bot[] = [];
  private queue: Bot[] = [];
  private tickets: Ticket[] = [];
  private ticketOf = new Map<Bot | Car, Ticket>();
  private ownerOf = new Map<Ticket, Bot | Car>();
  private slotOf = new Map<Bot, number>();
  private car: Car | null = null;
  private carTimer = 22;
  private carCount = 0;
  private honkT = 12;
  private spawnT = 3;
  private spawned = 0;
  private ordersPlaced = 0;
  private criticDone = false;
  private kidDone = false;
  private critic: Bot | null = null;
  private roomba: Bot | null = null;
  private grill: (GrillPatty | null)[] = [null, null, null, null];
  private baskets: BasketState[] = [{ f: null, down: false }, { f: null, down: false }];
  private fire: Fire | null = null;
  private fineT = 0;
  private sprinkler = 0;
  private drops: THREE.Mesh[] = [];
  private particles: Particle[] = [];
  private grease = 0;
  private greaseWarned = 0;
  private greaseCooldown = 0;
  private stolenFood = 0;
  private lastStolen = 0;
  private lastHeld: Item | null = null;
  private floorSince = new Map<Item, { t: number; sprite: THREE.Sprite; shown: string }>();
  private floorItems = new WeakSet<Item>();
  private pattyData = new WeakMap<Item, { down: number; up: number }>();
  private matTray: Item | null = null;
  private matT = 0.5;
  private ice: { t: number; dur: number } | null = null;
  private iceScreenT = 0;
  private screenT = 0;
  private panelT = 0;
  private sizzleT = 0;
  private dripT = 4;
  private drips = 0;
  private extinguisherUsed = 0;
  private c = {
    correct: 0, wrong: 0, flips: 0, burntPatties: 0, fries: 0, fires: 0, fiveSecond: 0, floorServed: 0, iceTries: 0,
    gaveUp: 0, nuggets: 0, criticStars: -1, existence: 0, sprinklers: 0, binned: 0, burntServed: 0, air: 0, roomba: 0,
    gifts: 0, iceCreamSorry: 0, hits: 0, slips: 0,
  };
  private criticReview = '';

  constructor(scene: THREE.Scene) {
    this.level = new Kitchen(scene);
    this.mx = new BurgerMischief(this.level);
  }

  start(shift: Shift): void {
    this.s = shift;
    this.mx.start(shift, {
      bots: () => this.bots,
      flipAll: () => this.flipAll(),
      hasCar: () => !!this.car && this.car.state === 'wait' && this.ticketOf.has(this.car),
    });
    this.panel = new OrderPanel();
    this.roomba = this.spawnBot('roomba', 'GREASE-E', new THREE.Vector3(9.6, 0, -1.4));
    this.roomba.phase = 'roam';
    drawIceScreen(this.level.iceScreen, 'CLEANING|CYCLE');
    this.refreshScreens();
  }

  // ---------------------------------------------------------------- contract

  obstacles() {
    return this.bots.filter((b) => b.state !== 'gone').map((b) => ({ x: b.pos.x, z: b.pos.z, r: b.radius }));
  }

  lookTargets(): THREE.Object3D[] {
    const t: THREE.Object3D[] = this.bots.filter((b) => b.state !== 'gone').map((b) => b.group);
    if (this.car && this.car.state !== 'gone') t.push(this.car.group);
    return t;
  }

  quota() {
    return { done: this.c.correct, target: QUOTA };
  }

  hypeMultiplier(): number {
    return this.critic?.phase === 'review' ? 2 : 1;
  }

  cameraLabel(): string {
    return this.critic?.phase === 'review' ? 'LIVE REVIEW: CRITIC-9000 (hype x2)' : '';
  }

  heldLabel(it: Item): string {
    if (isTray(it)) return ` [${trayText(trayData(it))}]`;
    return this.floorItems.has(it) ? ' (floor edition)' : '';
  }

  productive(): boolean {
    return this.c.correct >= QUOTA - 2;
  }

  employeeOfTheMonth(): string {
    return this.c.iceTries >= 5 ? 'You. For bravery. The ice cream machine is runner-up.' : 'The Ice Cream Machine (broken, but consistent)';
  }

  reviewRows(): [string, string | number][] {
    const c = this.c;
    return [
      ['Orders served correctly', c.correct],
      ['Orders served "creatively"', c.wrong],
      ['Patties flipped', c.flips],
      ['Patties cremated', c.burntPatties],
      ['Fries fried', c.fries],
      ['Grease fires', c.fires],
      ['Food rescued from the floor (5 second rule)', c.fiveSecond],
      ['Ice cream machine repair attempts', `${c.iceTries} (success rate 0%)`],
      ['Robots who gave up waiting', c.gaveUp],
      ['Critic rating', c.criticStars < 0 ? 'not reviewed (lucky)' : `${c.criticStars}/5 stars`],
      ['Nuggets delivered to a child', c.nuggets],
      ['Food eaten by GREASE-E', c.roomba],
      ...this.mx.reviewRows(),
    ];
  }

  payRows(): [string, number][] {
    const c = this.c;
    const rows: [string, number][] = [];
    const s = this.s;
    if (s.counter('toilet')) rows.push([`Chicken key thawing fee x${s.counter('toilet')}`, -1.5 * s.counter('toilet')]);
    if (c.burntPatties) rows.push([`Cremated patties x${c.burntPatties}`, -0.6 * c.burntPatties]);
    if (c.wrong) rows.push([`Creative orders x${c.wrong}`, -1 * c.wrong]);
    if (this.extinguisherUsed) rows.push(['Fire extinguisher refill', -15]);
    if (c.sprinklers) rows.push(['Sprinkler water bill', -22.5 * c.sprinklers]);
    if (c.binned) rows.push([`Food thrown away x${c.binned}`, -0.5 * c.binned]);
    if (c.iceTries) rows.push([`Ice cream repair attempts x${c.iceTries} (labor not paid)`, 0]);
    if (this.grease > 20) rows.push(['Hand grease (company property)', -2]);
    if (c.gifts) rows.push([`Unauthorized generosity x${c.gifts}`, -1 * c.gifts]);
    rows.push(...this.mx.payRows());
    return rows;
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number): void {
    const s = this.s;
    this.spawning(dt);
    for (const b of this.bots) b.update(dt, this.level.colliders);
    this.separate();
    this.botLogic(dt);
    this.carLogic(dt);
    this.cook(dt);
    this.updateFire(dt);
    this.updateSprinkler(dt);
    this.updateParticles(dt);
    this.trayMat(dt);
    this.floorRule();
    this.handsAndPockets(dt);
    this.chickenDrip(dt);
    this.iceRepair(dt);
    this.slips();
    this.sizzle(dt);
    this.mx.update(dt);
    this.tickets = this.tickets.filter((t) => this.ownerOf.has(t));

    this.screenT -= dt;
    if (this.screenT <= 0) {
      this.screenT = 0.12;
      this.refreshScreens();
    }
    this.panelT -= dt;
    if (this.panelT <= 0) {
      this.panelT = 0.2;
      const tray = isTray(s.held) ? s.held : this.matTray;
      const d = tray ? trayData(tray) : null;
      const verdicts: (Verdict | null)[] = this.tickets.map((t) => (d ? judge(t, d) : null));
      this.panel.update(this.tickets, verdicts, d ? trayText(d) : 'no tray', this.grease);
    }
    this.lastHeld = s.held;
  }

  private refreshScreens(): void {
    const s = this.s;
    const t = s ? s.t : 0;
    const views: SlotView[] = this.grill.map((p) => (p ? { down: p.down, up: p.up } : { down: null, up: 0 }));
    drawGrillPanel(this.level.grillPanel, views, this.fire?.where === 'grill', t);
    drawFryPanel(this.level.fryPanel, this.baskets.map((b) => b.f), this.baskets.map((b) => b.down), this.fire?.where === 'fryer', t);
    drawRail(this.level.rail, this.tickets);
    const carT = this.car ? this.ticketOf.get(this.car) : null;
    drawDriveSign(this.level.driveSign, carT ? `CAR WAITING ${Math.ceil(carT.patience)}s` : this.car ? 'CAR INCOMING' : 'NO CARS. ENJOY.', t, !!carT && carT.patience < 25);
    this.level.speakerLed.emissiveIntensity = this.car?.state === 'wait' ? (Math.sin(t * 6) > 0 ? 2 : 0.3) : 0.2;
  }

  // ---------------------------------------------------------------- robots

  private spawnBot(role: BotRole, name: string, pos: THREE.Vector3): Bot {
    const b = new Bot(this.s.scene, role, name, pos);
    this.bots.push(b);
    return b;
  }

  private spawning(dt: number): void {
    const s = this.s;
    this.spawnT -= dt;
    const waiting = this.queue.length;
    if (this.spawnT <= 0 && waiting < 4) {
      this.spawnT = this.spawned === 0 ? 18 : rand(24, 36);
      const roles: BotRole[] = ['customer', 'customer', 'karen', 'gran'];
      let role = this.spawned === 0 ? 'customer' : pick(roles);
      if (role !== 'customer' && this.bots.some((b) => b.role === role)) role = 'customer';
      const used = new Set(this.bots.map((b) => b.name));
      const free = T.CUSTOMER_NAMES.filter((n) => !used.has(n));
      const name = role === 'karen' ? 'Karen-Unit 9' : role === 'gran' ? 'RoboGran' : pick(free.length ? free : T.CUSTOMER_NAMES);
      const b = this.spawnBot(role, name, SPOTS.entrance.clone().add(new THREE.Vector3(rand(-0.5, 0.5), 0, 0.3)));
      b.phase = 'queue';
      this.queue.push(b);
      this.spawned++;
      this.layoutQueue();
    }
    if (!this.criticDone && s.t > 55) {
      this.criticDone = true;
      const c = this.spawnBot('critic', 'CRITIC-9000', SPOTS.entrance);
      c.phase = 'toTable';
      this.critic = c;
      c.goTo(s.nav, SPOTS.critic, () => this.criticSeated(c));
      c.say('I do not queue. I am a critic. Table three. Now.', 4);
    }
    if (!this.kidDone && s.t > 95) {
      this.kidDone = true;
      const k = this.spawnBot('kid', 'Lil Nugget-Bot', SPOTS.entrance);
      k.phase = 'toCounter';
      k.goTo(s.nav, SPOTS.pickupSide, () => this.kidOrders(k));
    }
  }

  private layoutQueue(): void {
    this.queue.forEach((b, i) => {
      if (this.slotOf.get(b) === i) return;
      this.slotOf.set(b, i);
      b.faceYaw = null;
      b.goTo(this.s.nav, SPOTS.queue[Math.min(i, SPOTS.queue.length - 1)], () => {
        b.faceYaw = Math.PI;
        if (!this.ticketOf.has(b) && b.phase === 'queue') this.placeOrder(b);
      });
    });
  }

  private patienceFor(role: BotRole): number {
    return role === 'karen' ? 85 : role === 'gran' ? 170 : role === 'kid' ? 140 : role === 'critic' ? 160 : 120;
  }

  private addTicket(owner: Bot | Car, item: MenuItem, src: Ticket['src'], patience: number, garble = false): Ticket {
    const t = makeTicket(item, src, patience, garble, item === FIRST_ORDER && this.ordersPlaced === 0);
    this.ordersPlaced++;
    this.tickets.push(t);
    this.ticketOf.set(owner, t);
    this.ownerOf.set(t, owner);
    this.s.sfx.tone(1400, 0.05, 'square', 0.05);
    this.s.sfx.tone(1400, 0.05, 'square', 0.05, undefined, 0.1);
    return t;
  }

  private dropTicket(owner: Bot | Car): void {
    const t = this.ticketOf.get(owner);
    if (!t) return;
    this.ticketOf.delete(owner);
    this.ownerOf.delete(t);
    this.tickets = this.tickets.filter((x) => x !== t);
  }

  private placeOrder(b: Bot): void {
    const s = this.s;
    const item = this.ordersPlaced === 0 ? FIRST_ORDER : pickMenu(s.t < 60 ? ['existence', 'icecream'] : []);
    const t = this.addTicket(b, item, 'COUNTER', this.patienceFor(b.role));
    b.say(fill(pick(T.ORDER_SAY), { order: t.name }), 5);
    b.act('talk', 1.5);
    b.timer = rand(14, 22);
  }

  private kidOrders(k: Bot): void {
    k.faceYaw = Math.PI;
    k.phase = 'roam';
    this.addTicket(k, KID_ORDER, 'KID', this.patienceFor('kid'));
    k.say(T.KID_LINES[0], 5);
    k.timer = 6;
    this.s.chat('nuggets');
  }

  private criticSeated(c: Bot): void {
    c.faceYaw = -Math.PI / 2;
    c.phase = 'wait';
    c.timer = 12;
    this.addTicket(c, CRITIC_ORDER, 'TABLE 3', this.patienceFor('critic'));
    this.s.bossSay('critic', true);
    this.s.chat('critic', {}, 2);
  }

  /** Sends a bot to the door. */
  private leave(b: Bot): void {
    this.dropTicket(b);
    this.queue = this.queue.filter((x) => x !== b);
    this.slotOf.delete(b);
    this.layoutQueue();
    b.phase = 'leave';
    b.faceYaw = null;
    b.goTo(this.s.nav, SPOTS.entrance, () => b.remove());
  }

  private eatThenLeave(b: Bot): void {
    this.dropTicket(b);
    this.queue = this.queue.filter((x) => x !== b);
    this.slotOf.delete(b);
    this.layoutQueue();
    b.phase = 'eat';
    b.faceYaw = null;
    const spot = pick(SPOTS.eat);
    b.goTo(this.s.nav, spot, () => {
      b.timer = rand(10, 16);
      b.act('talk', 2);
    });
  }

  private botLogic(dt: number): void {
    const s = this.s;
    for (const b of this.bots) {
      if (b.state === 'gone' || b.fallen) continue;
      const t = this.ticketOf.get(b);
      if (t) {
        t.patience -= dt;
        if (t.patience <= 0) {
          this.gaveUp(b);
          continue;
        }
      }
      switch (b.role) {
        case 'customer':
        case 'karen':
        case 'gran':
          if (b.phase === 'queue' && t && b.state === 'wait' && b.timer <= 0) {
            b.timer = b.role === 'karen' ? rand(9, 14) : rand(14, 22);
            const frac = t.patience / t.maxPatience;
            if (frac < 0.75) {
              b.say(pick(b.role === 'karen' ? T.KAREN_WAIT : b.role === 'gran' ? T.GRAN_WAIT : T.WAIT_LINES), 4);
              b.act(b.role === 'karen' ? 'act' : 'talk', 1.2);
              if (b.role === 'karen' && frac < 0.5 && !s.boss.offline && s.boss.horizontalDist(b.pos) < 10) {
                s.annoyance += 12;
                s.bossSay('customerComplaint');
              }
            }
          }
          if (b.phase === 'eat' && b.state === 'wait' && b.timer <= 0) this.leave(b);
          break;
        case 'kid':
          this.kidLogic(b, t);
          break;
        case 'critic':
          if (b.phase === 'wait' && b.timer <= 0) {
            b.timer = rand(13, 18);
            b.say(pick(T.CRITIC_PRE), 5);
            b.act('talk', 1.2);
            b.visual.setFlash?.(true);
            setTimeout(() => b.visual.setFlash?.(false), 200);
          }
          if (b.phase === 'review') {
            if (Math.random() < dt * 2) {
              b.visual.setFlash?.(true);
              setTimeout(() => b.visual.setFlash?.(false), 120);
            }
            if (b.timer <= 0) {
              b.say(this.criticReview, 8);
              s.hud.toast('NEW REVIEW: CRITIC-9000', this.criticReview, 'corp');
              s.chat('critic', {}, 3);
              s.hype += 15;
              this.leave(b);
            }
          }
          break;
        case 'roomba':
          this.roombaLogic(b);
          break;
      }
    }
    this.bots = this.bots.filter((b) => b.state !== 'gone');
  }

  private gaveUp(b: Bot): void {
    const s = this.s;
    this.c.gaveUp++;
    s.hype += 6;
    s.chat('burgerWrong');
    if (b.role === 'critic') {
      this.c.criticStars = 0;
      b.say(T.CRITIC_LEAVE, 6);
      s.hud.toast('NEW REVIEW: CRITIC-9000', T.CRITIC_LEAVE, 'corp');
      this.critic = null;
    } else if (b.role === 'kid') {
      b.say('NO NUGGETS? I AM TELLING MY DAD. HE IS A VENDING MACHINE.', 5);
    } else {
      b.say(pick(T.LEAVE_LINES), 4.5);
    }
    if (!s.boss.offline && (s.boss.horizontalDist(b.pos) < 12 || s.seen)) {
      s.annoyance += 18;
      s.bossSay('customerLeft', true);
    }
    this.leave(b);
  }

  private kidLogic(k: Bot, t: Ticket | undefined): void {
    const s = this.s;
    if (k.phase === 'roam' && k.state === 'wait' && k.timer <= 0) {
      // run around, sometimes back to the counter to ask again
      if (Math.random() < 0.4) {
        k.goTo(s.nav, SPOTS.pickupSide, () => {
          k.faceYaw = Math.PI;
          k.timer = rand(6, 9);
          if (t) k.say(pick(T.KID_LINES), 4);
        });
      } else {
        const tgt = Math.random() < 0.35 ? SPOTS.ballPit.clone().add(new THREE.Vector3(1.9, 0, 0)) : pick(SPOTS.kidRoam);
        k.faceYaw = null;
        k.goTo(s.nav, tgt, () => {
          k.timer = rand(2, 4);
          k.act('talk', 1);
          if (Math.random() < 0.3) k.say(pick(T.KID_LINES), 3.5);
        });
      }
    }
    if (k.phase === 'party') {
      this.level.splashBalls(s.t);
      if (k.state === 'wait' && k.timer <= 0) {
        if (Math.random() < 0.15) this.leave(k);
        else {
          k.goTo(s.nav, pick(SPOTS.kidRoam), () => {
            k.timer = rand(1, 3);
            k.act('talk', 1);
          });
        }
      }
    }
  }

  private roombaLogic(r: Bot): void {
    const s = this.s;
    if (r.state !== 'wait' || r.timer > 0) return;
    // the oldest food on the floor that the five second rule no longer protects
    let target: Item | null = null;
    for (const [it, f] of this.floorSince) {
      if (s.t - f.t > 5 && it.state === 'world' && Math.hypot(it.mesh.position.x - r.pos.x, it.mesh.position.z - r.pos.z) < 14) {
        target = it;
        break;
      }
    }
    if (target) {
      const tgt = target;
      r.goTo(s.nav, tgt.mesh.position.clone().setY(0), () => {
        if (tgt.state === 'world' && Math.hypot(tgt.mesh.position.x - r.pos.x, tgt.mesh.position.z - r.pos.z) < 0.8) {
          this.forgetFloor(tgt);
          s.removeItem(tgt);
          this.c.roomba++;
          r.say(pick(T.ROOMBA_EAT), 3);
          s.sfx.whoosh();
          s.chat('roomba');
          s.hype += 5;
        }
        r.timer = 1;
      });
      return;
    }
    const pi = s.puddles.findIndex((p) => p.z < 2 && Math.hypot(p.x - r.pos.x, p.z - r.pos.z) < 12);
    if (pi >= 0) {
      const pd = s.puddles[pi];
      r.goTo(s.nav, new THREE.Vector3(pd.x, 0, pd.z), () => {
        const idx = s.puddles.indexOf(pd);
        if (idx >= 0 && Math.hypot(pd.x - r.pos.x, pd.z - r.pos.z) < 1) {
          s.removePuddle(idx);
          r.say(pick(T.ROOMBA_PUDDLE), 3);
          s.sfx.whoosh();
          s.hype += 4;
        }
        r.timer = 1;
      });
      return;
    }
    r.timer = rand(2, 5);
    r.goTo(s.nav, pick(SPOTS.kitchenFloor), null);
  }

  private separate(): void {
    const bs = this.bots;
    for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i];
        const b = bs[j];
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
        // Waiting robots in the queue hold their spot, walkers squeeze past.
        const aFix = a.state === 'wait' ? 1 : 0;
        const bFix = b.state === 'wait' ? 1 : 0;
        const wa = aFix && !bFix ? 0.1 : bFix && !aFix ? 0.9 : 0.5;
        const o = min - d;
        const nx = dx / d;
        const nz = dz / d;
        a.pos.x -= nx * o * wa - nz * o * 0.3 * wa;
        a.pos.z -= nz * o * wa + nx * o * 0.3 * wa;
        b.pos.x += nx * o * (1 - wa);
        b.pos.z += nz * o * (1 - wa);
      }
    }
    for (const b of bs) for (const c of this.level.colliders) if (!c.disabled) pushOutCircle(b.pos, b.radius, c);
  }

  private slips(): void {
    const s = this.s;
    for (const b of this.bots) {
      if (b.fallen || b.slipCooldown > 0 || b.role === 'roomba' || b.state === 'gone') continue;
      for (const pd of s.puddles) {
        if (Math.hypot(pd.x - b.pos.x, pd.z - b.pos.z) < pd.r) {
          b.fall(3);
          b.slipCooldown = 12;
          b.say(pick(T.SLIP_LINES), 3);
          this.c.slips++;
          s.hype += 16;
          s.sfx.slip();
          s.achieve('slip');
          s.chat('slip', {}, 2);
          break;
        }
      }
    }
  }

  thrownHit(it: Item): boolean {
    if (this.mx.thrownHit(it)) return true;
    const s = this.s;
    const p = it.mesh.position;
    for (const b of this.bots) {
      if (b.fallen || b.state === 'gone') continue;
      if (Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < b.radius + 0.2 && p.y < b.height + 0.3) {
        it.vel.multiplyScalar(-0.25);
        it.thrown = false;
        const t = this.ticketOf.get(b);
        if (isTray(it) && t) {
          this.c.air++;
          s.chat('airDelivery', {}, 2);
          s.hype += 12;
          this.serve(b, it, 'air');
          return true;
        }
        if (b.role === 'roomba') b.say('Bonk. Rebooting. Still hungry.', 3);
        else {
          b.fall(2.5);
          b.say(pick(T.HIT_LINES), 3);
        }
        this.c.hits++;
        s.hype += 12;
        s.sfx.thud();
        s.chat('hitCustomer', {}, 2);
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- the drive-thru

  private carLogic(dt: number): void {
    const s = this.s;
    if (!this.car) {
      this.carTimer -= dt;
      if (this.carTimer <= 0) {
        this.car = new Car(s.scene, `CAR-${['7X', 'B0T', 'V8', 'RUST'][this.carCount % 4]}`, SPOTS.carStop, this.carCount++);
        this.honkT = 8;
      }
      return;
    }
    const car = this.car;
    if (car.update(dt)) {
      this.addTicket(car, pickMenu(['icecream']), 'DRIVE-THRU', 110, true);
      car.setMood('wait');
      const near = Math.hypot(s.player.pos.x - 13.5, s.player.pos.z + 4) < 12;
      if (near) s.hud.say('DRIVE-THRU SPEAKER', pick(T.CAR_GARBLE), 4);
      s.chat('driveThru');
      this.honk(car);
    }
    const t = this.ticketOf.get(car);
    if (car.state === 'wait' && t) {
      t.patience -= dt;
      const frac = t.patience / t.maxPatience;
      if (frac < 0.35) car.setMood('angry');
      this.honkT -= dt * (frac < 0.5 ? 1.8 : 1);
      if (this.honkT <= 0) {
        this.honkT = rand(12, 18);
        this.honk(car);
        if (Math.random() < 0.4) s.bossSay('driveThru');
      }
      if (t.patience <= 0) {
        this.c.gaveUp++;
        car.say(pick(T.CAR_LEAVE), 4);
        this.honk(car);
        this.dropTicket(car);
        car.state = 'leave';
        s.chat('driveThru');
        if (!s.boss.offline && s.seen) {
          s.annoyance += 15;
          s.bossSay('customerLeft');
        }
      }
    }
    if (car.state === 'gone') {
      this.car = null;
      this.carTimer = rand(30, 48);
    }
  }

  private honk(car: Car): void {
    const s = this.s;
    s.sfx.tone(392, 0.28, 'square', 0.07);
    s.sfx.tone(330, 0.28, 'square', 0.07);
    car.say(pick(T.CAR_HONK), 2);
    car.honkBounce();
  }

  // ---------------------------------------------------------------- cooking

  private cook(dt: number): void {
    const s = this.s;
    const L = this.level;
    this.grill.forEach((p, i) => {
      if (!p) return;
      if (this.fire?.where !== 'grill') p.down += dt / SIDE_TIME;
      p.bottom.material = pattyMat(p.down);
      p.top.material = pattyMat(p.up);
      const base = L.grillSlots[i];
      if (p.flipT > 0) {
        p.flipT = Math.max(0, p.flipT - dt);
        const k = 1 - p.flipT / 0.35;
        p.mesh.position.y = base.y + Math.sin(k * Math.PI) * 0.28;
        p.mesh.rotation.x = Math.PI * (1 - k);
      } else {
        p.mesh.position.y = base.y;
        p.mesh.rotation.x = 0;
      }
      // steam and smoke
      const burning = p.down > 1.7;
      if (Math.random() < dt * (burning ? 9 : p.down > 0.5 ? 3 : 1)) this.puff(base.clone().add(new THREE.Vector3(rand(-0.08, 0.08), 0.05, rand(-0.08, 0.08))), burning ? '#3a3330' : '#d8d4cc', burning ? 0.14 : 0.09);
      if (p.down > 3.6 && !this.fire) this.startFire('grill');
    });
    this.baskets.forEach((b, i) => {
      const kb = L.baskets[i];
      const wantY = b.down ? kb.downY : kb.upY;
      kb.group.position.y += (wantY - kb.group.position.y) * Math.min(1, dt * 8);
      if (b.f !== null && b.down && this.fire?.where !== 'fryer') b.f += dt / FRY_TIME;
      setBasketFries(kb, b.f);
      if (b.down && b.f !== null && Math.random() < dt * 8) this.puff(new THREE.Vector3(kb.x + rand(-0.2, 0.2), 0.88, kb.z + rand(-0.15, 0.15)), b.f > 1.6 ? '#4a3a30' : '#f2e6c8', 0.05, 0.4);
      if (b.down && b.f !== null && b.f > 3.2 && !this.fire) this.startFire('fryer');
    });
    // "this is fine"
    if (this.fire) {
      const fp = this.level.firePos[this.fire.where];
      if (Math.hypot(fp.x - s.player.pos.x, fp.z - s.player.pos.z) < 3) {
        this.fineT += dt;
        if (this.fineT > 7) s.achieve('bgFire');
      }
    }
  }

  private sizzle(dt: number): void {
    const s = this.s;
    this.sizzleT -= dt;
    if (this.sizzleT > 0) return;
    this.sizzleT = 0.3;
    const P = s.player.pos;
    const g = this.grill.some((p) => p) ? Math.hypot(P.x + 5, P.z + 9.5) : 99;
    const f = this.baskets.some((b) => b.down && b.f !== null) ? Math.hypot(P.x + 8, P.z + 9.5) : 99;
    const d = Math.min(g, f);
    if (d < 8) s.sfx.noise(0.35, 0.03 * (1 - d / 8) + 0.004, 4500, 0, 0.5, 'highpass');
    if (this.fire && Math.hypot(P.x - this.level.firePos[this.fire.where].x, P.z - this.level.firePos[this.fire.where].z) < 14) s.sfx.noise(0.35, 0.06, 500, 0, 0.6, 'lowpass');
  }

  private puff(pos: THREE.Vector3, color: string, size: number, life = 1.2): void {
    if (this.particles.length > 140) return;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), color, transparent: true, opacity: 0.55, depthWrite: false }));
    sp.position.copy(pos);
    sp.scale.setScalar(size);
    this.s.scene.add(sp);
    this.particles.push({ mesh: sp, vel: new THREE.Vector3(rand(-0.05, 0.05), rand(0.4, 0.7), rand(-0.05, 0.05)), life, max: life, grow: 1.2, gravity: 0 });
  }

  private updateParticles(dt: number): void {
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.multiplyScalar(1 + p.grow * dt);
      const mat = (p.mesh as THREE.Sprite).material as THREE.SpriteMaterial;
      mat.opacity = Math.max(0, p.life / p.max) * 0.6;
      if (p.life <= 0 || p.mesh.position.y < 0) {
        p.mesh.parent?.remove(p.mesh);
        mat.dispose();
        return false;
      }
      return true;
    });
  }

  // ---------------------------------------------------------------- fire, foam and sprinklers

  private startFire(where: 'grill' | 'fryer'): void {
    const s = this.s;
    const group = new THREE.Group();
    group.position.copy(this.level.firePos[where]);
    const tex = flameTex();
    const flames: THREE.Sprite[] = [];
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), color: '#ff6a1a', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.set(0, 0.45, 0.1);
    glow.scale.set(where === 'grill' ? 3.2 : 2.2, 1.4, 1);
    group.add(glow);
    for (let i = 0; i < 13; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: i % 3 ? '#ffffff' : '#ffb060' }));
      sp.position.set((i - 6) * (where === 'grill' ? 0.18 : 0.12), 0.0, ((i * 7) % 3 - 1) * 0.15);
      sp.center.set(0.5, 0);
      group.add(sp);
      flames.push(sp);
    }
    const light = new THREE.PointLight('#ff7a2a', 14, 9, 1.4);
    light.position.set(0, 0.8, 0.5);
    group.add(light);
    s.scene.add(group);
    this.fire = { where, hp: 1, t: 0, group, flames, light };
    this.fineT = 0;
    this.c.fires++;
    // everything on the station is ruined
    if (where === 'grill') {
      for (const p of this.grill) if (p) p.down = p.up = 3.0;
    } else {
      for (const b of this.baskets) if (b.f !== null) b.f = Math.max(b.f, 2.9);
    }
    s.sfx.alarm();
    s.hype += 25;
    s.chat('fire', {}, 3);
    s.hud.toast(`GREASE FIRE: ${where === 'grill' ? 'GRILL' : 'FRYER'}`, 'Someone should do something. You are someone.', 'writeup');
    if (!s.boss.offline) {
      s.bossSay('fire', true);
      if (s.seen) s.annoyance += 20;
    }
  }

  private updateFire(dt: number): void {
    const f = this.fire;
    if (!f) return;
    const s = this.s;
    f.t += dt;
    const grow = 0.6 + Math.min(1, f.t / 18) * 0.9;
    f.flames.forEach((sp, i) => {
      const k = Math.sin(s.t * (9 + i) + i * 2) * 0.5 + 0.5;
      sp.scale.set((0.8 + k * 0.35) * grow * f.hp, (1.0 + k * 0.8) * grow * Math.max(0.3, f.hp), 1);
    });
    f.light.intensity = (10 + Math.sin(s.t * 23) * 4) * f.hp;
    if (Math.random() < dt * 10) this.puff(f.group.position.clone().add(new THREE.Vector3(rand(-0.5, 0.5), 1.0, rand(-0.2, 0.2))), '#2a2420', 0.35, 2.2);
    if (Math.random() < dt * 0.4) s.chat('fire');
    if (f.t > 35) this.sprinklers();
  }

  private putOut(byFoam: boolean): void {
    const f = this.fire;
    if (!f) return;
    const s = this.s;
    f.group.parent?.remove(f.group);
    for (const sp of f.flames) sp.material.dispose();
    this.fire = null;
    // a foam blanket on the station
    const pos = this.level.firePos[f.where];
    const foam = new THREE.Mesh(new THREE.BoxGeometry(f.where === 'grill' ? 2.3 : 1.5, 0.08, 0.8), m('#f4f4ec', 0.9));
    foam.position.set(pos.x, 0.97, pos.z);
    s.scene.add(foam);
    setTimeout(() => foam.parent?.remove(foam), 25000);
    if (f.where === 'grill') {
      for (let i = 0; i < 4; i++) this.clearSlot(i);
    } else for (const b of this.baskets) b.f = null;
    if (byFoam) {
      s.chat('fireOut', {}, 2);
      s.hype += 8;
      if (!s.boss.offline) s.bossSay('fireOut', true);
    }
  }

  private sprinklers(): void {
    const s = this.s;
    this.putOut(false);
    this.sprinkler = 6;
    this.c.sprinklers++;
    s.hype += 30;
    s.chat('sprinkler', {}, 3);
    s.sfx.splash();
    for (let i = 0; i < 4; i++) {
      const p = pick(SPOTS.kitchenFloor);
      s.makePuddle(p.x + rand(-1, 1), p.z + rand(-1, 1));
    }
    s.bossSay('sprinkler', true);
    s.writeUp('Activated the sprinkler system. Water is not free.');
    if (!this.drops.length) {
      const mat = new THREE.MeshBasicMaterial({ color: '#9fc8e8', transparent: true, opacity: 0.7 });
      for (let i = 0; i < 120; i++) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.18, 0.015), mat);
        d.visible = false;
        s.scene.add(d);
        this.drops.push(d);
      }
    }
  }

  private updateSprinkler(dt: number): void {
    if (this.sprinkler <= 0) return;
    this.sprinkler -= dt;
    const heads = this.level.sprinklers;
    this.drops.forEach((d, i) => {
      if (this.sprinkler <= 0) {
        d.visible = false;
        return;
      }
      if (!d.visible || d.position.y < 0.05) {
        const h = heads[i % heads.length];
        d.position.set(h.x + rand(-1.6, 1.6), h.y - rand(0, 3.4), h.z + rand(-1.6, 1.6));
        d.visible = true;
      }
      d.position.y -= dt * 7;
    });
    if (Math.random() < dt * 4) this.s.sfx.noise(0.3, 0.05, 2500, 0, 0.5, 'highpass');
  }

  private spray(): void {
    const s = this.s;
    const cam = s.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const origin = cam.getWorldPosition(new THREE.Vector3()).addScaledVector(dir, 0.6).add(new THREE.Vector3(0, -0.25, 0));
    for (let i = 0; i < 18; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
      sp.position.copy(origin);
      sp.scale.setScalar(0.08);
      s.scene.add(sp);
      const v = dir.clone().multiplyScalar(rand(4, 6)).add(new THREE.Vector3(rand(-0.6, 0.6), rand(-0.3, 0.6), rand(-0.6, 0.6)));
      this.particles.push({ mesh: sp, vel: v, life: 0.8, max: 0.8, grow: 2.2, gravity: 4 });
    }
    s.sfx.noise(0.5, 0.12, 2200, 0, 0.5, 'highpass');
    this.extinguisherUsed++;
  }

  /** The fire in front of the player, if any. */
  private fireAhead(): boolean {
    const f = this.fire;
    if (!f) return false;
    const P = this.s.player.pos;
    const fp = f.group.position;
    const dx = fp.x - P.x;
    const dz = fp.z - P.z;
    const d = Math.hypot(dx, dz);
    if (d > 5) return false;
    const fw = this.s.player.forward();
    return (fw.x * dx + fw.z * dz) / d > 0.75 || d < 1.2;
  }

  // ---------------------------------------------------------------- trays and the floor

  private trayMat(dt: number): void {
    const s = this.s;
    const mt = this.matTray;
    if (mt && (mt.state !== 'fixed' || mt.mesh.position.distanceTo(this.level.trayMat) > 0.3)) this.matTray = null;
    if (this.matTray) return;
    if (isTray(s.held)) return;
    this.matT -= dt;
    if (this.matT > 0) return;
    this.matT = 1.0;
    const it = s.addItem(TRAY_DEF, this.level.trayMat.clone(), true);
    renderTray(it);
    this.matTray = it;
    s.sfx.click();
  }

  private forgetFloor(it: Item): void {
    const f = this.floorSince.get(it);
    if (!f) return;
    f.sprite.parent?.remove(f.sprite);
    f.sprite.material.map?.dispose();
    f.sprite.material.dispose();
    this.floorSince.delete(it);
  }

  private countdownSprite(text: string, color: string): THREE.SpriteMaterial {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 32;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(10,6,4,0.75)';
    g.fillRect(0, 0, 64, 32);
    g.font = '14px "Press Start 2P", monospace';
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 32, 17);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    return new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  }

  /** The five second rule: food on the floor gets a countdown. Pick it up in time and it still counts. */
  private floorRule(): void {
    const s = this.s;
    for (const it of s.items) {
      if (it.state !== 'world' || !it.sleeping || it.mesh.position.y > 0.35) continue;
      if (!it.def.tags?.includes('food') || this.floorSince.has(it)) continue;
      const sprite = new THREE.Sprite(this.countdownSprite('5', '#7cff6a'));
      sprite.scale.set(0.36, 0.18, 1);
      sprite.renderOrder = 5;
      s.scene.add(sprite);
      this.floorSince.set(it, { t: s.t, sprite, shown: '5' });
      s.sfx.tone(300, 0.12, 'square', 0.05, 200);
    }
    for (const [it, f] of [...this.floorSince]) {
      const age = s.t - f.t;
      if (it.state === 'gone') {
        this.forgetFloor(it);
        continue;
      }
      if (it.state === 'held') {
        this.rescue(it, age);
        this.forgetFloor(it);
        continue;
      }
      if (it.state !== 'world' || it.mesh.position.y > 0.5) {
        this.forgetFloor(it);
        continue;
      }
      f.sprite.position.copy(it.mesh.position).add(new THREE.Vector3(0, 0.45, 0));
      const left = Math.ceil(5 - age);
      const label = left > 0 ? String(left) : 'FLOOR';
      f.sprite.visible = age < 9;
      if (label !== f.shown) {
        f.shown = label;
        f.sprite.material.map?.dispose();
        f.sprite.material.dispose();
        f.sprite.material = this.countdownSprite(label, left > 0 ? (left <= 2 ? '#ffd166' : '#7cff6a') : '#ff4d4d');
        if (left > 0) s.sfx.tone(700 + left * 80, 0.05, 'square', 0.04);
      }
    }
  }

  private rescue(it: Item, age: number): void {
    const s = this.s;
    this.floorItems.add(it);
    if (isTray(it)) trayData(it).floor = true;
    if (age <= 5) {
      this.c.fiveSecond++;
      s.say(`Picked up after ${age.toFixed(1)} seconds. Five second rule. It still counts.`, 3);
      s.chat('fiveSecond', {}, 2);
      s.hype += 8;
      s.achieve('bgFiveSecond');
    } else {
      s.say(`It has been on the floor for ${Math.round(age)} seconds. It is part of the floor now. You take it anyway.`, 3.5);
      s.chat('floorFood', {}, 2);
      s.hype += 10;
    }
    if (s.seen && !s.boss.offline) {
      s.boss.confront();
      s.bossSay('floorPickup', true);
      s.writeUp('Picked food up off the floor. The five second rule is not company policy.');
    }
  }

  // ---------------------------------------------------------------- grease, pockets, the chicken

  private handsAndPockets(dt: number): void {
    const s = this.s;
    const st = s.counter('stolen');
    if (st > this.lastStolen) {
      this.lastStolen = st;
      if (this.lastHeld?.def.tags?.includes('food')) {
        this.stolenFood++;
        this.grease = Math.min(100, this.grease + 35);
        s.chat('greasy');
      }
    }
    this.greaseCooldown -= dt;
    if (this.grease > 45 && s.seen && !s.boss.offline && this.greaseCooldown <= 0 && s.boss.horizontalDist(s.player.pos) < 5) {
      this.greaseCooldown = 25;
      s.boss.confront();
      s.bossSay('greasyHands', true);
      s.chat('greasy', {}, 2);
      if (this.stolenFood > 0 && this.greaseWarned > 0) s.writeUp('Grease-based evidence of fry theft');
      else s.annoyance += 30;
      this.greaseWarned++;
    }
  }

  private chickenDrip(dt: number): void {
    const s = this.s;
    if (!s.held?.def.toiletKey) {
      this.drips = 0;
      this.dripT = 4;
      return;
    }
    this.dripT -= dt;
    if (this.dripT <= 0 && this.drips < 4) {
      this.dripT = 7;
      this.drips++;
      const f = s.player.forward();
      s.makePuddle(s.player.pos.x + f.x * 0.4, s.player.pos.z + f.z * 0.4);
      s.sfx.splash();
      if (this.drips === 1) s.say('The chicken drips on the floor. From a distance it looks exactly like a liquid incident.', 3.5);
      s.chat('tire');
    }
  }

  // ---------------------------------------------------------------- ice cream machine

  private iceRepair(dt: number): void {
    const s = this.s;
    this.iceScreenT -= dt;
    if (!this.ice) {
      if (this.iceScreenT <= 0) {
        this.iceScreenT = 2;
        drawIceScreen(this.level.iceScreen, pick(['CLEANING|CYCLE', 'PLEASE|WAIT', 'SINCE|2041', 'ERROR|0xC0NE']));
      }
      return;
    }
    const ic = this.ice;
    ic.t += dt;
    const pct = Math.min(99, Math.floor((ic.t / ic.dur) * 140));
    s.hud.progress(`Repairing the ice cream machine... ${pct}%`, pct / 100);
    if (Math.random() < dt * 6) s.sfx.tone(rand(80, 160), 0.1, 'sawtooth', 0.04);
    if (ic.t >= ic.dur) {
      this.ice = null;
      s.movementLocked = false;
      s.hud.progress(null);
      this.c.iceTries++;
      s.sfx.buzz();
      s.chat('iceCream', {}, 2);
      s.hype += 6;
      if (this.c.iceTries === 10) s.hud.say('ICE CREAM MACHINE', 'IT WORKS! ... No. It does not. It was a reflection.', 4);
      else s.hud.say('ICE CREAM MACHINE', pick(T.ICE_CREAM_FAIL), 4);
      drawIceScreen(this.level.iceScreen, 'REPAIR|FAILED');
      this.iceScreenT = 3;
      if (this.c.iceTries >= 5) s.achieve('bgIceCream');
      if (s.seen && !s.boss.offline) {
        s.bossSay('iceCream', true);
        s.annoyance += 10;
      }
    }
  }

  // ---------------------------------------------------------------- the player's actions

  private give(def: ItemDef): void {
    const it = this.s.addItem(def, new THREE.Vector3(0, -10, 0));
    this.s.pickUp(it);
  }

  private clearSlot(i: number): void {
    const p = this.grill[i];
    if (!p) return;
    p.mesh.parent?.remove(p.mesh);
    this.grill[i] = null;
  }

  private nearestSlot(point: THREE.Vector3, filled: boolean): number {
    let best = -1;
    let bd = Infinity;
    this.level.grillSlots.forEach((sl, i) => {
      if (!!this.grill[i] !== filled) return;
      const d = Math.hypot(sl.x - point.x, sl.z - point.z);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  private placePatty(i: number, held: Item): void {
    const s = this.s;
    const data = this.pattyData.get(held) ?? { down: 0, up: 0 };
    const q = held.def.tags?.find((t) => t === 'perfect' || t === 'burnt' || t === 'charcoal');
    if (!this.pattyData.has(held) && q) data.down = data.up = q === 'perfect' ? 1.2 : q === 'burnt' ? 2 : 3;
    const g = new THREE.Group();
    const lo = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.022, 12), pattyMat(data.down));
    lo.position.y = 0.011;
    const hi = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.13, 0.022, 12), pattyMat(data.up));
    hi.position.y = 0.033;
    g.add(lo, hi);
    g.position.copy(this.level.grillSlots[i]);
    s.scene.add(g);
    this.grill[i] = { down: data.down, up: data.up, mesh: g, bottom: lo, top: hi, flipT: 0, floor: this.floorItems.has(held) };
    s.removeHeld();
    s.sfx.noise(0.8, 0.12, 4000, 0, 0.5, 'highpass');
  }

  private addToTray(tray: Item, held: Item): boolean {
    const s = this.s;
    const d = trayData(tray);
    const tags = held.def.tags ?? [];
    const floor = this.floorItems.has(held);
    if (tags.includes('ing')) {
      const ing = tags.find((t): t is Ing => t in ING_NAMES) as Ing;
      d.stack.push({ ing, floor });
    } else if (tags.includes('patty')) {
      const q = (tags.find((t) => t === 'raw' || t === 'perfect' || t === 'burnt' || t === 'charcoal') ?? 'perfect') as PattyQ;
      d.stack.push({ ing: 'PATTY', q, floor });
    } else if (tags.includes('fries')) {
      const q = (tags.find((t) => t === 'soggy' || t === 'golden' || t === 'burnt') ?? 'golden') as FryQ;
      d.fries.push({ q, floor });
    } else if (tags.includes('nuggets')) {
      d.nuggets++;
    } else if (tags.includes('frozenFries')) {
      s.say('A frozen bag on a tray. That is not a meal, that is a cry for help. The fryer is next to the grill.', 3);
      return true;
    } else if (isTray(held)) {
      s.say('A tray on a tray. Bold. No.', 2);
      return true;
    } else return false;
    s.removeHeld();
    renderTray(tray);
    s.sfx.click();
    if (d.stack.length >= 9 && Math.random() < 0.5) s.chat('hype');
    return true;
  }

  /** Serves a tray to a robot or a car. */
  private serve(owner: Bot | Car, tray: Item, via: 'hand' | 'air' | 'window'): void {
    const s = this.s;
    const t = this.ticketOf.get(owner);
    if (!t) return;
    const d = trayData(tray);
    const v = judge(t, d);
    s.removeItem(tray);
    const isCar = owner instanceof Car;
    const bot = isCar ? null : (owner as Bot);
    const sayTo = (text: string, sec = 4.5) => (isCar ? (owner as Car).say(text, sec) : bot!.say(text, sec));
    if (v.correct) {
      this.c.correct++;
      s.annoyance = Math.max(0, s.annoyance - 8);
      s.sfx.ding();
      if (Math.random() < 0.35) s.chat('burgerRight');
      if (s.seen && Math.random() < 0.4) s.bossSay('correctSeen');
      if (t.special === 'existence') {
        s.achieve('bgExistence');
        s.chat('existence', {}, 2);
        s.hype += 10;
        this.c.existence++;
      }
      if (t.nuggets) {
        this.c.nuggets += t.nuggets * 10;
        s.chat('nuggets', {}, 2);
        s.hype += 10;
      }
      if (v.floor) {
        this.c.floorServed++;
        sayTo(pick(T.FLOOR_LINES));
        s.hype += 8;
      } else if (v.burnt) {
        this.c.burntServed++;
        sayTo(pick(T.BURNT_LINES));
        s.chat('burnt');
        s.hype += 6;
        if (s.seen && !s.boss.offline) {
          s.annoyance += 15;
          s.bossSay('burnt', true);
        }
      } else if (isCar) sayTo(pick(T.CAR_THANKS));
      else if (bot!.role === 'kid') sayTo(pick(T.KID_HAPPY));
      else if (bot!.role !== 'critic') sayTo(pick(T.HAPPY_LINES));
      if (this.c.correct === QUOTA) s.hud.toast('QUOTA REACHED', 'Brad has raised your quota. Congratulations. Keep flipping.', 'corp');
    } else {
      this.c.wrong++;
      s.hype += 10;
      s.sfx.buzz();
      s.chat('burgerWrong', {}, 2);
      if (t.special === 'icecream') sayTo('This is not ice cream. Is the machine broken? Just say it.');
      else if (isCar) sayTo(pick(T.CAR_WRONG));
      else if (bot!.role === 'kid') sayTo(pick(T.KID_WRONG));
      else if (bot!.role !== 'critic') sayTo(fill(pick(T.WRONG_LINES), { order: t.name }));
      if (s.seen && !s.boss.offline) {
        s.annoyance += 30;
        s.boss.confront();
        s.bossSay('burgerWrong', true);
      }
    }
    if (via === 'air') s.say('Delivered at 40 km/h. The tray counts as served.', 3);
    if (isCar) {
      this.dropTicket(owner);
      (owner as Car).setMood(v.correct ? 'happy' : 'angry');
      (owner as Car).state = 'leave';
      return;
    }
    if (bot!.role === 'critic') {
      const stars = v.floor ? 0 : !v.correct ? 0 : v.burnt || v.soggy ? 1 : 3;
      this.c.criticStars = stars;
      this.criticReview = v.floor ? T.CRITIC_FLOOR : stars >= 3 ? pick(T.CRITIC_REVIEW_GOOD) : stars === 1 ? pick(T.CRITIC_REVIEW_MEH) : pick(T.CRITIC_REVIEW_BAD);
      this.dropTicket(bot!);
      bot!.phase = 'review';
      bot!.timer = 7;
      bot!.say('Tasting. Do not look at me while I taste.', 4);
      bot!.act('talk', 3);
      s.chat('critic', {}, 2);
      return;
    }
    if (bot!.role === 'kid') {
      this.dropTicket(bot!);
      if (v.correct) {
        bot!.phase = 'party';
        bot!.timer = 0;
        // the kid celebrates by throwing nuggets on the floor
        for (let i = 0; i < 3; i++) {
          const n = s.addItem(NUGGET_DEF, bot!.pos.clone().add(new THREE.Vector3(0, 1.0, 0)));
          n.vel.set(rand(-2.5, 2.5), rand(2, 3.5), rand(-0.5, 3));
        }
      } else this.leave(bot!);
      return;
    }
    if (v.correct || Math.random() < 0.5) this.eatThenLeave(bot!);
    else this.leave(bot!);
  }

  /** The robot at the pass-through who gets the tray. */
  private counterBot(): Bot | null {
    const front = this.queue[0];
    if (front && this.ticketOf.has(front) && front.state === 'wait' && front.pos.z < 4.3) return front;
    let best: Bot | null = null;
    let bd = 2.4;
    for (const b of this.bots) {
      if (!this.ticketOf.has(b) || b.role === 'critic') continue;
      const d = Math.hypot(b.pos.x, b.pos.z - 2.9);
      if (b.pos.z < 4.5 && d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  /** The fryer body counts as the basket on that side. */
  private norm(look: Look | null): Look | null {
    if (look?.info.kind !== 'bgFryer') return look;
    return { ...look, info: { kind: 'bgBasket', idx: look.point.x < -8.0 ? 0 : 1 } };
  }

  interact(rawLook: Look | null): boolean {
    const s = this.s;
    const look = this.norm(rawLook);
    const info = look?.info;
    const held = s.held;
    if (this.ice) return true;
    if (this.mx.interact(look)) return true;

    if (held?.def.id === EXTINGUISHER_DEF.id) {
      if (this.fireAhead()) {
        this.spray();
        const f = this.fire!;
        f.hp -= 0.36;
        if (f.hp <= 0) this.putOut(true);
        return true;
      }
      if (info?.kind === 'bgBot') {
        this.spray();
        const b = info.bot as Bot;
        b.say(pick(T.FOAM_LINES), 3);
        b.act('talk', 1);
        s.hype += 6;
        s.chat('hype');
        return true;
      }
      if (info?.kind === 'bgIceCream') {
        this.spray();
        s.say('You foam the ice cream machine. It now dispenses foam. Technically soft serve. Technically.', 3.5);
        s.hype += 5;
        return true;
      }
      return false;
    }

    if (!info) return false;
    const kind = info.kind;

    if (held) {
      const tags = held.def.tags ?? [];
      const food = tags.includes('food');
      switch (kind) {
        case 'item': {
          const it = info.item;
          if (it && isTray(it) && it !== held && food) return this.addToTray(it, held);
          return false;
        }
        case 'bgTrayMat':
          if (isTray(held)) {
            if (this.matTray) {
              s.say('There is already a tray here. One tray per human.', 2);
              return true;
            }
            s.detachHeld();
            held.state = 'fixed';
            s.scene.add(held.mesh);
            held.mesh.position.copy(this.level.trayMat);
            held.mesh.rotation.set(0, 0, 0);
            this.matTray = held;
            s.sfx.click();
            return true;
          }
          if (this.matTray && food) return this.addToTray(this.matTray, held);
          return false;
        case 'bgGrill': {
          if (this.fire?.where === 'grill') {
            s.say('The grill is on fire. Adding more food will not help. Probably.', 2.5);
            return true;
          }
          if (!tags.includes('patty')) {
            s.say(`You consider grilling the ${held.def.name.toLowerCase()}. It is not on the menu. Yet.`, 2.5);
            return true;
          }
          const i = this.nearestSlot(look!.point, false);
          if (i < 0) {
            s.say('The grill is full. Flip faster.', 2);
            return true;
          }
          this.placePatty(i, held);
          return true;
        }
        case 'bgBasket': {
          if (this.fire?.where === 'fryer') {
            s.say('The fryer is on fire. The fries are now a concept.', 2.5);
            return true;
          }
          const b = this.baskets[info.idx as number];
          if (!tags.includes('frozenFries')) {
            s.say('Only frozen fries go in the fryer. Company policy. Also physics.', 2.5);
            return true;
          }
          if (b.f !== null) {
            s.say('This basket is full. The other one might not be.', 2);
            return true;
          }
          s.removeHeld();
          b.f = 0;
          b.down = true;
          s.sfx.noise(1.0, 0.16, 3500, 0, 0.5, 'highpass');
          return true;
        }
        case 'bgBin': {
          const ing = info.ing as Ing;
          if (tags.includes(ing)) {
            s.removeHeld();
            s.say('You put it back. Nobody saw. Probably.', 1.5);
            return true;
          }
          if (this.matTray && food) return this.addToTray(this.matTray, held);
          return false;
        }
        case 'bgPattyBox':
          if (held.def.id === PATTY_DEFS.raw.id) {
            s.removeHeld();
            return true;
          }
          return false;
        case 'bgFryBag':
          if (held.def.id === FROZEN_FRIES_DEF.id) {
            s.removeHeld();
            return true;
          }
          return false;
        case 'bgNuggets':
          if (held.def.id === NUGGET_DEF.id) {
            s.removeHeld();
            return true;
          }
          return false;
        case 'bgPass': {
          if (!isTray(held)) {
            if (food) s.say('Put it on a tray first. Presentation matters. Slightly.', 2.5);
            return food;
          }
          const b = this.counterBot();
          if (!b) {
            s.say('Nobody with an order is at the counter. You serve the void. The void declines.', 3);
            return true;
          }
          this.serve(b, held, 'hand');
          return true;
        }
        case 'bgDrive':
        case 'bgCar': {
          if (!isTray(held)) return false;
          if (!this.car || this.car.state !== 'wait' || !this.ticketOf.has(this.car)) {
            s.say('No car at the window. You hand the tray to the wind.', 2.5);
            return true;
          }
          this.serve(this.car, held, 'window');
          return true;
        }
        case 'bgBot': {
          const b = info.bot as Bot;
          if (isTray(held) && this.ticketOf.has(b)) {
            this.serve(b, held, 'hand');
            return true;
          }
          if (b.role === 'roomba') {
            if (food) {
              s.removeHeld();
              b.say(pick(T.ROOMBA_EAT), 3);
              this.c.roomba++;
              return true;
            }
            return false;
          }
          if (food && !isTray(held)) {
            s.removeHeld();
            this.c.gifts++;
            b.say('A loose ingredient? From a human? I will tell my firmware about this.', 3.5);
            s.hype += 4;
            return true;
          }
          b.say(pick(T.NO_ORDER_LINES), 3);
          return true;
        }
        case 'bgTrash':
          if (food || isTray(held)) {
            s.removeHeld();
            this.c.binned++;
            s.sfx.thud();
            s.say('Into the trash. A perfectly good mistake, gone.', 2);
            return true;
          }
          return false;
      }
    }

    switch (kind) {
      case 'bgGrill': {
        if (this.fire?.where === 'grill') {
          s.say('The grill is on fire. The extinguisher is on the wall to the right. Probably.', 3);
          return true;
        }
        const i = this.nearestSlot(look!.point, true);
        if (i < 0) {
          s.say('An empty grill. The frozen patties are in the drawer to the right.', 2.5);
          return true;
        }
        const p = this.grill[i]!;
        if (p.up < 1) {
          [p.down, p.up] = [p.up, p.down];
          p.flipT = 0.35;
          this.c.flips++;
          s.sfx.noise(0.5, 0.1, 3000, 0, 0.5, 'highpass');
          s.sfx.tone(520, 0.06, 'triangle', 0.08);
          if (Math.random() < 0.25) s.chat('flip');
          return true;
        }
        if (p.down < 1) {
          s.say('The other side is still raw. Patience. Patience is unpaid.', 2);
          return true;
        }
        const q = pattyQ(p.down, p.up);
        if (q === 'burnt' || q === 'charcoal') {
          this.c.burntPatties++;
          s.chat('burnt');
          s.hype += 4;
          if (s.seen && !s.boss.offline) {
            s.annoyance += 10;
            s.bossSay('burnt');
          }
        }
        const it = s.addItem(PATTY_DEFS[q], new THREE.Vector3(0, -10, 0));
        this.pattyData.set(it, { down: p.down, up: p.up });
        if (p.floor) this.floorItems.add(it);
        this.clearSlot(i);
        s.pickUp(it);
        return true;
      }
      case 'bgBasket': {
        if (this.fire?.where === 'fryer') {
          s.say('The fryer is on fire. The extinguisher is on the wall, past the grill.', 3);
          return true;
        }
        const b = this.baskets[info.idx as number];
        if (b.f === null) {
          s.say('An empty basket. The frozen fries are in the chest freezer on the left.', 2.5);
          return true;
        }
        if (b.down) {
          b.down = false;
          s.sfx.tone(300, 0.1, 'triangle', 0.08);
          return true;
        }
        const q = fryQ(b.f);
        b.f = null;
        this.c.fries++;
        this.grease = Math.min(100, this.grease + 4);
        this.give(FRY_DEFS[q]);
        if (q === 'burnt') s.chat('burnt');
        return true;
      }
      case 'bgBin':
        this.give(ING_DEFS[info.ing as Exclude<Ing, 'PATTY'>]);
        return true;
      case 'bgPattyBox':
        this.give(PATTY_DEFS.raw);
        return true;
      case 'bgFryBag':
        this.give(FROZEN_FRIES_DEF);
        return true;
      case 'bgNuggets':
        this.give(NUGGET_DEF);
        return true;
      case 'bgTrayMat':
        if (this.matTray) {
          s.pickUp(this.matTray);
          return true;
        }
        s.say('A fresh tray is on its way. Trays are our most reliable employees.', 2);
        return true;
      case 'bgPass':
        s.say('Serve orders here with a tray. Robots at the counter take what you give them.', 2.5);
        return true;
      case 'bgDrive':
      case 'bgCar':
        if (this.car?.state === 'wait') this.car.say(pick(T.CAR_GARBLE), 3.5);
        else s.say('The drive-thru window. Cars come here to honk.', 2.5);
        return true;
      case 'bgSpeaker':
        this.repeatOrder();
        return true;
      case 'bgIceCream':
        this.ice = { t: 0, dur: 3.2 };
        s.movementLocked = true;
        drawIceScreen(this.level.iceScreen, 'REPAIR|MODE');
        if (s.seen && !s.boss.offline) s.bossSay('iceCream');
        return true;
      case 'bgSink':
        this.grease = 0;
        this.greaseWarned = 0;
        s.say(pick(T.SINK_LINES), 2.5);
        s.sfx.noise(1.2, 0.08, 1500, 0, 0.6, 'lowpass');
        return true;
      case 'bgTrash':
        s.say('The trash. It is full of perfectly good burgers that were wrong.', 2.5);
        return true;
      case 'bgBot':
        this.talkTo(info.bot as Bot);
        return true;
    }
    return false;
  }

  private repeatOrder(): void {
    const s = this.s;
    const car = this.car;
    const t = car ? this.ticketOf.get(car) : null;
    if (!car || !t) {
      s.hud.say('DRIVE-THRU SPEAKER', 'KSSSHHHHH. (nobody there. or everybody.)', 2.5);
      return;
    }
    const hidden = t.garbled.map((g, i) => (g ? i : -1)).filter((i) => i >= 0);
    if (!hidden.length) {
      s.hud.say('DRIVE-THRU SPEAKER', 'I SAID IT THREE TIMES. KRZZT. HONK.', 2.5);
      this.honk(car);
      t.patience -= 5;
      return;
    }
    for (let k = 0; k < Math.min(2, hidden.length); k++) {
      const idx = hidden.splice(Math.floor(Math.random() * hidden.length), 1)[0];
      t.garbled[idx] = false;
    }
    if (t.garbled[0]) t.garbled[0] = false;
    s.hud.say('DRIVE-THRU SPEAKER', pick(T.SPEAKER_REPEAT), 2.5);
    for (let i = 0; i < 6; i++) s.sfx.tone(rand(200, 900), 0.05, 'square', 0.03, undefined, i * 0.06);
    t.patience -= 4;
  }

  private talkTo(b: Bot): void {
    const s = this.s;
    if (b.fallen) {
      s.say(`${b.name} is busy lying on the floor.`, 2);
      return;
    }
    const t = this.ticketOf.get(b);
    if (t?.special === 'icecream') {
      b.say(pick(T.ICE_CREAM_ORDER_LINES), 4);
      s.say('You tell them the ice cream machine is broken. It is the most honest thing anyone has said here.', 3.5);
      this.c.correct++;
      this.c.iceCreamSorry++;
      s.sfx.ding();
      s.chat('iceCream', {}, 2);
      if (this.c.correct === QUOTA) s.hud.toast('QUOTA REACHED', 'Brad has raised your quota. Congratulations. Keep flipping.', 'corp');
      this.leave(b);
      return;
    }
    if (b.role === 'roomba') {
      b.say('Vroom. I am the cleaning staff. You are the mess.', 3);
      return;
    }
    if (b.role === 'kid') {
      b.say(t ? pick(T.KID_LINES) : 'Wheee! Nuggets!', 3);
      return;
    }
    if (b.role === 'critic') {
      b.say(t ? pick(T.CRITIC_PRE) : 'Do not speak to me. I am composing.', 4);
      return;
    }
    if (t) {
      b.say(`I ordered ${t.name}. On a tray. It is not complicated.`, 3.5);
      return;
    }
    b.say(pick(T.TALK_LINES), 3);
  }

  hint(rawLook: Look | null): string | null {
    const s = this.s;
    const look = this.norm(rawLook);
    const info = look?.info;
    const held = s.held;
    if (this.ice) return '';
    const mh = this.mx.hint(look);
    if (mh !== null) return mh;
    if (held?.def.id === EXTINGUISHER_DEF.id) {
      if (this.fireAhead()) return 'E: spray the fire';
      if (info?.kind === 'bgBot') return `E: spray ${(info.bot as Bot).name}`;
      return null;
    }
    if (!info) return null;
    const tags = held?.def.tags ?? [];
    const food = tags.includes('food');
    switch (info.kind) {
      case 'item': {
        const it = info.item;
        if (it && isTray(it) && held && food && it !== held) return `E: put ${held.def.name} on the tray`;
        if (it && isTray(it) && !held) return `E: take the tray [${trayText(trayData(it))}]`;
        return null;
      }
      case 'bgTrayMat':
        if (isTray(held)) return this.matTray ? 'Occupied' : 'E: put the tray down';
        if (held && food && this.matTray) return `E: put ${held.def.name} on the tray`;
        return this.matTray ? 'E: take the tray' : 'Tray incoming';
      case 'bgGrill': {
        if (this.fire?.where === 'grill') return 'FIRE!';
        if (held) return tags.includes('patty') ? 'E: put the patty on the grill' : 'The grill';
        const i = look ? this.nearestSlot(look.point, true) : -1;
        if (i < 0) return 'Empty grill. Patties are in the drawer to the right';
        const p = this.grill[i]!;
        const st = (v: number) => (v < 0.5 ? 'raw' : v < 1 ? 'almost' : v < 1.7 ? 'done' : v < 2.6 ? 'BURNING' : 'CHARCOAL');
        if (p.up < 1) return `E: flip patty (underside: ${st(p.down)})`;
        if (p.down < 1) return `Cooking... (underside: ${st(p.down)})`;
        return `E: take patty (${pattyQ(p.down, p.up)})`;
      }
      case 'bgBasket': {
        if (this.fire?.where === 'fryer') return 'FIRE!';
        const b = this.baskets[info.idx as number];
        if (held) return tags.includes('frozenFries') ? (b.f === null ? 'E: drop the fries in' : 'Basket full') : 'Fryer basket';
        if (b.f === null) return 'Empty basket. Frozen fries are in the chest on the left';
        if (b.down) return `E: lift the basket (fries: ${b.f < 0.6 ? 'pale' : b.f < 1 ? 'almost' : b.f < 1.6 ? 'GOLDEN' : 'BURNING'})`;
        return `E: take the fries (${fryQ(b.f)})`;
      }
      case 'bgBin':
        if (held && tags.includes(info.ing as string)) return 'E: put it back';
        if (held && food && this.matTray) return `E: put ${held.def.name} on the tray`;
        return held ? (info.ing as string) : `E: take ${ING_NAMES[info.ing as Ing]}`;
      case 'bgPattyBox':
        return held ? (held.def.id === PATTY_DEFS.raw.id ? 'E: put it back' : 'Patty drawer') : 'E: take a frozen patty';
      case 'bgFryBag':
        return held ? (held.def.id === FROZEN_FRIES_DEF.id ? 'E: put it back' : 'Frozen fries') : 'E: take frozen fries';
      case 'bgNuggets':
        return held ? (held.def.id === NUGGET_DEF.id ? 'E: put it back' : 'Nuggets') : 'E: take a nugget box (10)';
      case 'bgPass':
        if (isTray(held)) {
          const b = this.counterBot();
          return b ? `E: serve to ${b.name}` : 'Nobody waiting at the counter';
        }
        return 'Counter. Serve with a tray';
      case 'bgDrive':
      case 'bgCar':
        if (isTray(held)) return this.car?.state === 'wait' ? 'E: hand the tray out of the window' : 'No car waiting';
        return this.car?.state === 'wait' ? 'Drive-thru window (the speaker is to the left)' : 'Drive-thru window';
      case 'bgSpeaker':
        return this.car && this.ticketOf.has(this.car) ? 'E: ask the car to repeat' : 'Drive-thru speaker';
      case 'bgIceCream':
        return held ? 'Ice cream machine (broken)' : 'E: repair the ice cream machine';
      case 'bgSink':
        return 'E: wash hands';
      case 'bgTrash':
        return held && (food || isTray(held)) ? 'E: throw it away' : 'Trash';
      case 'bgBot': {
        const b = info.bot as Bot;
        const t = this.ticketOf.get(b);
        if (t?.special === 'icecream') return `E: tell ${b.name} the machine is broken`;
        if (isTray(held) && t) return `E: serve ${b.name}`;
        if (held && food && !isTray(held)) return `E: give ${held.def.name} to ${b.name}`;
        return `E: talk to ${b.name}${t ? ` (wants ${t.name})` : ''}`;
      }
    }
    return null;
  }

  onKick(look: Look | null): boolean {
    if (this.ice) return true;
    return this.mx.onKick(this.norm(look));
  }

  /** A kick against the grill flips every patty at once. */
  private flipAll(): number {
    let n = 0;
    for (const p of this.grill) {
      if (!p || p.flipT > 0) continue;
      [p.down, p.up] = [p.up, p.down];
      p.flipT = 0.35;
      this.c.flips++;
      n++;
    }
    if (n) this.s.sfx.noise(0.5, 0.12, 3000, 0, 0.5, 'highpass');
    return n;
  }

  /** Kept for the debugging console. */
  debug() {
    return { tickets: this.tickets.map((t) => `${t.src}:${t.name}`), grill: this.grill.map((p) => (p ? [p.down.toFixed(2), p.up.toFixed(2)] : null)), baskets: this.baskets, fire: this.fire?.where ?? null, c: this.c, queue: this.queue.map((b) => b.name), grease: this.grease };
  }
}
