import * as THREE from 'three';
import { Item } from '../../items';
import { fill, pick, rand } from '../../util';
import type { Job, Look, Shift } from '../types';
import { Fx, sounds } from './fx';
import {
  applyLook,
  DISH_DEFS,
  Dish,
  dishHeight,
  dishStatus,
  dishVisual,
  DishType,
  newDish,
  RACK_DEF,
  RACK_SLOTS,
  rackPose,
  rackSlotPos,
  randomDirtyType,
  SHARDS_DEF,
  SHELF_TYPES,
  TYPE_LABEL,
  TYPE_NAMES,
} from './items';
import { DOORS, HATCH, Kitchen, ROOM } from './kitchen';
import { DISHES_SECRETS, DishesFun } from './mischief';
import { Bot } from './robots';
import * as T from './texts';

/**
 * Dishwasher at Le Robot Gourmand.
 * Dirty dishes arrive on a cart. Scrape, rinse, rack, wash, shelve. Scrub the chef's burnt pots.
 * Do not let the pile fall over. Do not break anything. Everything will break.
 */
const QUOTA = 20;
const PILE_TOPPLE = 20;
const WASH_TIME = 6;
const BREAK_COST = 3.5;
const SHELF_MAX = 27;
const BREAK_AT: Record<DishType, number> = { plate: 2.8, bowl: 3.1, glass: 2.4, cutlery: 99, pot: 99 };

type ShelfType = Exclude<DishType, 'pot'>;

interface Mini {
  kind: 'rinse' | 'scrub';
  item: Item | null;
  dish: Dish | null;
  p: number;
  lastKey: string;
  puddleT: number;
  flooded: boolean;
  sound: number;
}

export class DishesJob implements Job {
  info = {
    id: 'dishes',
    title: 'DISHWASHER',
    place: `${T.RESTAURANT} (kitchen, back)`,
    teaser: 'Robots do not eat. The plates are for the vibe.',
    quotaLabel: 'DISHES',
    lockedDoor: 'Locked. The key is tied to the giant stock pot by the walk-in freezer. In the other corner. Of course.',
    bladderWarning: 'You really need to pee. The staff toilet is in the far right corner. The key is tied to the stock pot by the freezer. Lift with your knees.',
  };
  level: Kitchen;
  bossLines = T.BOSS_LINES;
  chatLines = T.CHAT_LINES;
  achievements = T.ACHIEVEMENTS;
  secrets = DISHES_SECRETS;

  private s!: Shift;
  private fx!: Fx;
  /** Breakables, movables, the cold room and the secrets (mischief.ts). */
  private fun: DishesFun;
  private pile: Dish[] = [];
  private pileJitter = new WeakMap<Dish, [number, number, number]>();
  private pileH = 0;
  private rack!: { item: Item; slots: (Dish | null)[]; inMachine: boolean };
  private machine: { state: 'open' | 'closing' | 'washing' | 'opening'; t: number } = { state: 'open', t: 0 };
  private shelf = {} as Record<ShelfType, Dish[]>;
  private shelfMeshes = {} as Record<ShelfType, THREE.Object3D[]>;
  private potRack: Dish[] = [];
  private potMeshes: THREE.Object3D[] = [];
  private dishOf = new Map<Item, Dish>();
  private prevSpeed = new Map<Item, number>();
  private mini: Mini | null = null;
  private eHeld = false;
  private chef!: Bot;
  private waiter!: Bot;
  private somm!: Bot;
  private vac!: Bot;
  private bots: Bot[] = [];
  private cart = new THREE.Group();
  private cartLoad = new THREE.Group();
  private tantrumT = 24;
  private steamT = 0;
  private keyWalk = 0;
  private firstFoodLoad = true;
  private c = {
    done: 0, pots: 0, broken: 0, dirtyShelved: 0, wrong: 0, spots: 0, topples: 0, blames: 0, floods: 0,
    tantrums: 0, slips: 0, scraped: 0, rinsed: 0, washes: 0, facials: 0, roomService: 0, mopped: 0, vacuumed: 0, emptyWashes: 0,
  };

  constructor(scene: THREE.Scene) {
    this.level = new Kitchen(scene);
    // before the engine collects the level's items, so the movables are among them
    this.fun = new DishesFun(this.level);
  }

  // ================================================================ setup

  start(shift: Shift): void {
    this.s = shift;
    const L = this.level;
    this.fx = new Fx(shift.scene);
    // the rack sits in the machine
    const rack = shift.addItem(RACK_DEF, L.rackSpot.clone(), true);
    this.rack = { item: rack, slots: new Array(RACK_SLOTS).fill(null), inMachine: true };
    // the dirty pile
    for (let i = 0; i < 10; i++) this.pile.push(newDish(randomDirtyType()));
    this.renderPile();
    // some clean stock
    for (const t of SHELF_TYPES) {
      this.shelf[t] = [];
      this.shelfMeshes[t] = [];
      for (let i = 0; i < 4; i++) this.shelf[t].push({ ...newDish(t), food: null, rinsed: true, washed: true, quality: 'clean' });
      this.renderShelf(t);
    }
    for (let i = 0; i < 3; i++) this.potRack.push({ ...newDish('pot'), burnt: 0 });
    this.renderPots();
    // yesterday's burnt pot, waiting by the pot sink
    this.spawnDish({ ...newDish('pot') }, new THREE.Vector3(-10.2, 0.3, 2.0));
    // the staff
    this.chef = new Bot(shift.scene, 'chef', T.CHEF_NAME, L.chefSpots[1]);
    this.waiter = new Bot(shift.scene, 'waiter', T.WAITER_NAME, new THREE.Vector3(3.4, 0, -13.8));
    this.somm = new Bot(shift.scene, 'somm', T.SOMM_NAME, L.wineSpot);
    this.vac = new Bot(shift.scene, 'vac', T.VAC_NAME, new THREE.Vector3(-3, 0, -4));
    this.bots = [this.chef, this.waiter, this.somm, this.vac];
    this.chef.state = 'cook';
    this.chef.timer = 4;
    this.waiter.state = 'away';
    this.waiter.timer = 9;
    this.waiter.ghost = true;
    this.somm.state = 'idle';
    this.somm.timer = 16;
    this.vac.state = 'wander';
    this.buildCart();
    // E is held to spray, A and D scrub
    addEventListener('keydown', (e) => {
      if (!document.pointerLockElement) return;
      if (e.code === 'KeyE') this.eHeld = true;
      if (!e.repeat && this.mini?.kind === 'scrub' && ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(e.code)) this.stroke(e.code);
    });
    addEventListener('keyup', (e) => {
      if (e.code === 'KeyE') this.eHeld = false;
    });
    addEventListener('blur', () => (this.eHeld = false));
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement) this.eHeld = false;
    });
    this.fun.start(shift, {
      chef: () => this.chef,
      waiter: () => this.waiter,
      somm: () => this.somm,
      vac: () => this.vac,
      topple: () => this.topple(),
      pileSize: () => this.pile.length,
      broken: () => this.c.broken,
      addBroken: (n, at) => {
        this.c.broken += n;
        this.level.setBreakage(this.c.broken, this.c.broken * BREAK_COST);
        for (let i = 0; i < 4; i++) {
          const sh = shift.addItem(SHARDS_DEF, at.clone().add(new THREE.Vector3(rand(-0.6, 0.6), 0.1, rand(-0.8, 0.1))));
          sh.vel.set(rand(-1, 1), 1, rand(-1.5, 0));
          sh.sleeping = false;
        }
        shift.hype += 30;
        if (shift.seen && !shift.boss.offline) {
          shift.annoyance += 25;
          shift.bossSay('smash', true);
        }
      },
      kickWasher: () => {
        if (this.machine.state !== 'washing') return false;
        this.machine.t = Math.min(WASH_TIME - 0.2, this.machine.t + 2);
        return true;
      },
      angerChef: () => (this.tantrumT = Math.min(this.tantrumT, 2.5)),
      waiterCartLoaded: () => this.cartLoad.children.length > 0,
      consumeHeld: () => {
        const h = shift.held;
        if (!h || h === this.rack.item) return false;
        this.dishOf.delete(h);
        this.prevSpeed.delete(h);
        shift.removeHeld();
        return true;
      },
    });
  }

  onKick(look: Look | null): boolean {
    if (this.mini) return false;
    return this.fun.onKick(look);
  }

  private buildCart(): void {
    const steel = new THREE.MeshStandardMaterial({ color: '#b9c0c4', metalness: 0.7, roughness: 0.3 });
    const add = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), steel);
      m.position.set(x, y, z);
      this.cart.add(m);
    };
    add(0.55, 0.03, 0.8, 0, 0.8, 0);
    add(0.55, 0.03, 0.8, 0, 0.3, 0);
    for (const [x, z] of [[-0.25, -0.38], [0.25, -0.38], [-0.25, 0.38], [0.25, 0.38]] as [number, number][]) add(0.025, 0.8, 0.025, x, 0.4, z);
    add(0.5, 0.03, 0.03, 0, 1.0, -0.4);
    this.cartLoad.position.y = 0.82;
    this.cart.add(this.cartLoad);
    this.s.scene.add(this.cart);
    this.fillCart(4, false);
  }

  /** Puts a few dishes on the waiter's cart (dirty with food, or clean). */
  private fillCart(n: number, clean: boolean): void {
    this.cartLoad.clear();
    for (let i = 0; i < n; i++) {
      const d = newDish(i % 3 === 2 ? 'glass' : i % 2 ? 'bowl' : 'plate');
      if (clean) Object.assign(d, { food: null, washed: true, quality: 'clean' });
      const v = dishVisual(d);
      v.position.set(((i % 2) - 0.5) * 0.24, Math.floor(i / 2) * 0.05, (Math.floor(i / 2) - 0.5) * 0.3);
      this.cartLoad.add(v);
    }
  }

  // ================================================================ engine hooks

  obstacles() {
    const out = this.bots.filter((b) => !b.ghost).map((b) => ({ x: b.pos.x, z: b.pos.z, r: b.radius }));
    if (this.cart.visible) out.push({ x: this.cart.position.x, z: this.cart.position.z, r: 0.42 });
    return out;
  }

  lookTargets(): THREE.Object3D[] {
    return this.bots.map((b) => b.group);
  }

  quota() {
    return { done: this.c.done, target: QUOTA };
  }

  productive(): boolean {
    return this.c.done >= 15;
  }

  heldLabel(it: Item): string {
    const d = this.dishOf.get(it);
    if (d) return ` [${dishStatus(d)}]`;
    if (it === this.rack?.item) {
      const n = this.rack.slots.filter(Boolean).length;
      const w = this.rack.slots.filter((x) => x?.washed).length;
      return ` [${n} dishes, ${w} washed]`;
    }
    return '';
  }

  employeeOfTheMonth(pocket: { id: string }[], fired: boolean): string {
    if (pocket.some((p) => p.id === 'dw-bread')) return 'The bread roll in your pocket. Never touched. Like your potential.';
    if (this.c.broken >= 10 && !fired) return 'Gerald (whereabouts unknown)';
    return 'SCRUBMASTER 3000 (the machine, again)';
  }

  reviewRows(): [string, string | number][] {
    const c = this.c;
    return [
      ['Dishes washed and shelved', c.done - c.pots],
      ['Pots scrubbed and hung', c.pots],
      ['Dishes broken', c.broken],
      ['Dirty dishes put on clean shelves', c.dirtyShelved],
      ['Dishes put on the wrong shelf', c.wrong],
      ['Water spots found by the sommelier', c.spots],
      ['Times the pile fell over', c.topples],
      ['Times the waiter blamed you', c.blames],
      ['Puddles made with the sprayer', c.floods],
      ['Chef tantrums survived', c.tantrums],
      ['Robots who slipped on your puddles', c.slips],
      ['Dishes delivered to guests by air', c.roomService],
      ['Complimentary steam facials', c.facials],
    ];
  }

  payRows(): [string, number][] {
    const c = this.c;
    const s = this.s;
    const rows: [string, number][] = [];
    if (c.broken) rows.push([`Broken dishes x${c.broken}`, -BREAK_COST * c.broken]);
    if (s.counter('toilet')) rows.push([`Stock pot key rental x${s.counter('toilet')}`, -1.5 * s.counter('toilet')]);
    if (c.floods) rows.push([`Water surcharge (floor) x${c.floods}`, -0.5 * c.floods]);
    if (c.scraped) rows.push([`Disposal of uneaten gourmet food x${c.scraped}`, -0.1 * c.scraped]);
    if (c.pots) rows.push([`Pot bonus x${c.pots}`, 0.5 * c.pots], ['Pot bonus tax', -0.5 * c.pots]);
    if (c.facials) rows.push([`Steam facial (complimentary) x${c.facials}`, 0]);
    if (c.roomService) rows.push([`Unscheduled table service x${c.roomService}`, -5 * c.roomService]);
    return rows;
  }

  // ================================================================ items

  private spawnDish(d: Dish, pos: THREE.Vector3): Item {
    const it = this.s.addItem(DISH_DEFS[d.type], pos);
    applyLook(it.mesh, d);
    this.dishOf.set(it, d);
    return it;
  }

  private heldDish(): Dish | undefined {
    const h = this.s.held;
    return h ? this.dishOf.get(h) : undefined;
  }

  private dropHeldDish(): Dish | null {
    const h = this.s.held;
    const d = h ? this.dishOf.get(h) : undefined;
    if (!h || !d) return null;
    this.s.removeHeld();
    this.dishOf.delete(h);
    this.prevSpeed.delete(h);
    return d;
  }

  // ================================================================ the dirty pile

  /** Plates, bowls and pots make the tower. Glasses and cutlery go in the bus tub. */
  private renderPile(): void {
    const a = this.level.pileAnchor;
    const tub = this.level.pileTub;
    a.clear();
    tub.clear();
    let y = 0;
    let k = 0;
    let n = 0;
    for (const d of this.pile) {
      let j = this.pileJitter.get(d);
      if (!j) {
        j = [rand(-0.03, 0.03), rand(-0.03, 0.03), rand(0, Math.PI * 2)];
        this.pileJitter.set(d, j);
      }
      const v = dishVisual(d);
      v.rotation.y = j[2];
      if (d.type === 'glass' || d.type === 'cutlery') {
        const layer = Math.floor(k / 9);
        v.position.set(((k % 3) - 1) * 0.13 + j[0], layer * (d.type === 'glass' ? 0.12 : 0.03), (Math.floor(k / 3) % 3 - 1) * 0.15 + j[1]);
        if (d.type === 'cutlery') v.scale.setScalar(0.85);
        tub.add(v);
        k++;
      } else {
        // the tower leans a little more with every dish
        v.position.set(j[0] + n * 0.007, y, j[1] + n * 0.003);
        a.add(v);
        y += dishHeight(d.type) * (d.type === 'plate' ? 0.9 : 0.7) + (d.food ? 0.03 : 0.004);
        n++;
      }
    }
    this.pileH = y;
  }

  private addToPile(n: number): void {
    for (let i = 0; i < n; i++) this.pile.push(newDish(randomDirtyType()));
    this.renderPile();
    if (this.pile.length >= PILE_TOPPLE) this.topple();
  }

  private topple(): void {
    const s = this.s;
    const L = this.level;
    const base = new THREE.Vector3();
    L.pileAnchor.getWorldPosition(base);
    const falling = this.pile.splice(5);
    falling.forEach((d, i) => {
      if (i >= 12) {
        this.breakAt(base.clone().add(new THREE.Vector3(rand(-0.5, 0.8), 0.1, rand(0.4, 1.2))), d.type, true);
        return;
      }
      const it = this.spawnDish(d, base.clone().add(new THREE.Vector3(rand(-0.2, 0.2), 0.3 + i * 0.07, rand(0.1, 0.3))));
      it.vel.set(rand(-2.2, 3.2), rand(1.5, 3.5), rand(1.8, 4));
      it.sleeping = false;
    });
    this.renderPile();
    this.c.topples++;
    s.hype += 25;
    s.sfx.thud();
    sounds.smash(s.sfx);
    s.chat('topple', {}, 3);
    s.achieve('topple');
    s.say('The pile goes. All of it. Physics has filed a complaint.', 3);
    if (!s.boss.offline && (s.seen || s.boss.horizontalDist(base) < 12)) {
      s.annoyance += 20;
      s.bossSay('topple', true);
    }
  }

  // ================================================================ breaking

  private breakAt(pos: THREE.Vector3, type: DishType, quiet = false): void {
    const s = this.s;
    this.c.broken++;
    this.level.setBreakage(this.c.broken, this.c.broken * BREAK_COST);
    this.fx.burst(pos.clone().setY(Math.max(0.1, pos.y)), 14, type === 'glass' ? '#cfe6ee' : '#f3f0e6', 3, 0.05, true);
    if (!quiet) sounds.smash(s.sfx);
    const sh = s.addItem(SHARDS_DEF, new THREE.Vector3(pos.x, Math.max(0.2, pos.y), pos.z));
    sh.vel.set(rand(-0.5, 0.5), 0, rand(-0.5, 0.5));
    s.hype += 6;
    if (Math.random() < 0.6) s.chat('smash');
    if (this.c.broken === 10) s.achieve('opa');
    if (!quiet && s.seen && !s.boss.offline) {
      s.annoyance += 10;
      s.bossSay('smash');
    }
  }

  /** Watches falling dishes and racks for hard landings. */
  private checkImpacts(): void {
    const s = this.s;
    for (const [it, d] of this.dishOf) {
      if (it.state === 'gone') {
        this.dishOf.delete(it);
        this.prevSpeed.delete(it);
        continue;
      }
      if (it.state !== 'world') {
        this.prevSpeed.delete(it);
        continue;
      }
      const sp = it.vel.length();
      const prev = this.prevSpeed.get(it) ?? sp;
      this.prevSpeed.set(it, sp);
      const hit = prev - sp;
      if (hit > BREAK_AT[d.type]) {
        const p = it.mesh.position.clone();
        s.removeItem(it);
        this.dishOf.delete(it);
        this.prevSpeed.delete(it);
        this.breakAt(p, d.type);
      } else if (hit > 2.5) sounds.clang(s.sfx);
    }
    // a dropped rack takes its passengers with it
    const r = this.rack.item;
    if (r.state === 'world') {
      const sp = r.vel.length();
      const prev = this.prevSpeed.get(r) ?? sp;
      this.prevSpeed.set(r, sp);
      if (prev - sp > 2.6) {
        sounds.clang(s.sfx);
        let n = 0;
        this.rack.slots.forEach((d, i) => {
          if (!d || d.type === 'cutlery') return;
          this.rack.slots[i] = null;
          this.breakAt(r.mesh.position.clone().add(new THREE.Vector3(rand(-0.3, 0.3), 0.1, rand(-0.3, 0.3))), d.type, n++ > 0);
        });
        if (n) {
          this.renderRack();
          s.say(n > 2 ? 'You dropped a whole rack. The rack is fine. The rack is always fine.' : 'The rack lands. Something inside it does not.', 3);
        }
      }
    } else this.prevSpeed.delete(r);
  }

  /** Something flying through the swinging doors or the pass ends up with the guests. */
  private checkRoomService(): void {
    const s = this.s;
    for (const it of s.items) {
      if (it.state !== 'world' || it.def.toiletKey || it === this.rack.item) continue;
      const p = it.mesh.position;
      if (p.z > ROOM.minZ + 0.42 || it.vel.length() < 2) continue;
      const door = p.x > DOORS.x0 && p.x < DOORS.x1 && p.y < 2.3;
      const hatch = p.x > HATCH.x0 && p.x < HATCH.x1 && p.y > HATCH.y0 && p.y < HATCH.y1;
      if (!door && !hatch) continue;
      if (door) this.level.bumpDoors(false, 0.8);
      const d = this.dishOf.get(it);
      s.removeItem(it);
      if (d) this.dishOf.delete(it);
      this.c.roomService++;
      sounds.smash(s.sfx);
      s.hype += 20;
      s.achieve('roomService');
      s.chat('roomService', {}, 2);
      s.say(`The ${it.def.name.toLowerCase()} sails into the dining room. A crash. Then polite robotic applause.`, 3.5);
      if (d) {
        this.c.broken++;
        this.level.setBreakage(this.c.broken, this.c.broken * BREAK_COST);
      }
      if (!s.boss.offline) {
        if (s.seen) s.annoyance += 20;
        s.bossSay('roomService', true);
      }
    }
  }

  // ================================================================ the dishwasher

  private renderRack(): void {
    const g = this.rack.item.mesh;
    for (const c of [...g.children]) if (c.userData.dwRack) g.remove(c);
    this.rack.slots.forEach((d, i) => {
      if (!d) return;
      const v = rackPose(d);
      v.position.copy(rackSlotPos(i));
      v.userData.dwRack = true;
      g.add(v);
    });
    this.updateLcd();
  }

  private rackCount(): number {
    return this.rack.slots.filter(Boolean).length;
  }

  private updateLcd(): void {
    const m = this.machine;
    if (m.state === 'washing') this.level.setLcd(['WASHING', `0:0${Math.max(0, Math.ceil(WASH_TIME - m.t))}`]);
    else if (m.state !== 'open') this.level.setLcd(['WAIT', '...']);
    else if (!this.rack.inMachine) this.level.setLcd(['NO RACK', 'bring it back']);
    else {
      const n = this.rackCount();
      const washed = this.rack.slots.every((d) => !d || d.washed);
      this.level.setLcd([n && washed ? 'CLEAN' : 'READY', `RACK ${n}/${RACK_SLOTS}`]);
    }
  }

  private putRackBack(): void {
    const s = this.s;
    const it = s.detachHeld();
    if (!it) return;
    s.scene.add(it.mesh);
    it.mesh.position.copy(this.level.rackSpot);
    it.mesh.rotation.set(0, 0, 0);
    it.state = 'fixed';
    it.vel.set(0, 0, 0);
    this.rack.inMachine = true;
    sounds.rack(s.sfx);
    this.updateLcd();
  }

  private loadRack(d: Dish): void {
    const s = this.s;
    const i = this.rack.slots.indexOf(null);
    this.dropHeldDish();
    this.rack.slots[i] = d;
    this.renderRack();
    sounds.rack(s.sfx);
    if (d.food && this.firstFoodLoad) {
      this.firstFoodLoad = false;
      s.say('You load it with the food still on it. The machine will bake it on. Like a pie. A bad pie.', 3);
    }
  }

  private runWasher(): void {
    const s = this.s;
    if (this.machine.state !== 'open') {
      s.say('It is already washing. Do not touch it. It is concentrating.', 2.5);
      return;
    }
    if (!this.rack.inMachine) {
      s.say('There is no rack in the machine. You would be washing air.', 2.5);
      return;
    }
    if (!this.rackCount()) {
      this.c.emptyWashes++;
      s.say('You wash an empty rack. The air inside is now very clean.', 2.5);
    }
    this.machine = { state: 'closing', t: 0 };
    s.sfx.click();
    this.c.washes++;
    if (Math.random() < 0.3) s.chat('wash');
  }

  private updateMachine(dt: number): void {
    const s = this.s;
    const L = this.level;
    const m = this.machine;
    m.t += dt;
    const open = 0.9 + 0.78;
    const shut = 0.9;
    if (m.state === 'closing') {
      L.washerHood.position.y = THREE.MathUtils.lerp(open, shut, Math.min(1, m.t / 0.6));
      if (m.t >= 0.6) {
        this.machine = { state: 'washing', t: 0 };
        s.sfx.thud();
      }
    } else if (m.state === 'washing') {
      L.washerBody.position.x = -9.5 + Math.sin(m.t * 60) * 0.006;
      const rt = (m.t * 2) % 1;
      if (rt < dt * 2) sounds.rumble(s.sfx);
      if (Math.random() < dt * 3) this.fx.steam(L.washerVent, 1, 0.2, 1.2, 0.4);
      if (Math.random() < dt * 4) this.fx.steam(new THREE.Vector3(-9.5 + rand(-0.6, 0.6), 1.75, -8.25), 1, 0.1, 0.6, 0.25);
      if (m.t >= WASH_TIME) {
        L.washerBody.position.x = -9.5;
        this.machine = { state: 'opening', t: 0 };
        for (const d of this.rack.slots) {
          if (!d || d.washed) continue;
          d.washed = true;
          d.quality = d.food ? 'baked' : d.rinsed ? 'clean' : 'spotty';
          d.food = null;
        }
        this.renderRack();
        sounds.hiss(s.sfx);
        s.sfx.ding();
        this.fx.steam(new THREE.Vector3(-9.5, 1.3, -8.3), 22, 0.9, 1.1, 0.7);
        const P = s.player.pos;
        if (Math.hypot(P.x + 9.5, P.z + 8.4) < 2.4) {
          this.c.facials++;
          s.hype += 4;
          s.chat('steam');
          s.say(this.c.facials === 1 ? pick(T.MACHINE_DONE) : 'Steam facial. Complimentary. Your pores are now company property.', 3);
        }
      }
    } else if (m.state === 'opening') {
      L.washerHood.position.y = THREE.MathUtils.lerp(shut, open, Math.min(1, m.t / 0.8));
      if (m.t >= 0.8) this.machine = { state: 'open', t: 0 };
    }
    // the spray arm spins while washing
    const arm = L.washerBody.getObjectByName('arm');
    if (arm && m.state === 'washing') arm.rotation.y += dt * 14;
    this.updateLcd();
  }

  // ================================================================ shelves

  private renderShelf(t: ShelfType): void {
    const L = this.level;
    for (const m of this.shelfMeshes[t]) m.removeFromParent();
    this.shelfMeshes[t] = [];
    const unit = L.shelves[t];
    const n = unit.slots.length;
    this.shelf[t].slice(0, SHELF_MAX).forEach((d, i) => {
      const v = dishVisual(d);
      const base = unit.slots[i % n];
      const layer = Math.floor(i / n);
      // glasses stand in rows, everything else stacks up
      if (d.type === 'glass') v.position.set(base.x + (layer - 1) * 0.15, base.y, base.z + (layer % 2) * 0.08);
      else v.position.set(base.x, base.y + layer * dishHeight(d.type) * (d.type === 'bowl' ? 0.55 : 0.8), base.z);
      v.rotation.y = (i % 3) * 0.4;
      this.s.scene.add(v);
      this.shelfMeshes[t].push(v);
    });
  }

  /** Puts every washed dish of this type from the held rack on the shelf. */
  private unloadRack(t: ShelfType): void {
    const s = this.s;
    let good = 0;
    let bad = 0;
    let unwashed = 0;
    let full = false;
    this.rack.slots.forEach((d, i) => {
      if (!d || d.type !== t) return;
      if (!d.washed) {
        unwashed++;
        return;
      }
      if (this.shelf[t].length >= SHELF_MAX) {
        full = true;
        return;
      }
      this.shelf[t].push(d);
      this.rack.slots[i] = null;
      if (d.quality === 'baked') bad++;
      else good++;
    });
    if (good + bad === 0) {
      if (full) s.say('The shelf is full. The waiter is slow today. Blame him.', 2.5);
      else if (unwashed) s.say(`Those ${TYPE_NAMES[t]} are not washed yet. The shelf can tell.`, 2.5);
      else s.say(`There are no ${TYPE_NAMES[t]} in the rack.`, 2);
      return;
    }
    this.renderShelf(t);
    this.renderRack();
    sounds.rack(s.sfx);
    if (good) this.scoreGood(good);
    if (bad) this.scoreDirty(bad, t);
  }

  private scoreGood(n: number): void {
    const s = this.s;
    const before = this.c.done;
    this.c.done += n;
    s.annoyance = Math.max(0, s.annoyance - 4 * n);
    s.sfx.ding();
    if (s.seen && Math.random() < 0.4) s.bossSay('correctSeen');
    if (Math.random() < 0.3) s.chat('correct');
    if (before < QUOTA && this.c.done >= QUOTA) s.hud.toast('QUOTA REACHED', 'Brad has added 40 decorative guests. Congratulations.', 'corp');
  }

  private scoreDirty(n: number, t: DishType): void {
    const s = this.s;
    this.c.dirtyShelved += n;
    s.hype += 7 * n;
    s.chat('dirtyShelf', {}, Math.min(2, n));
    s.say(n > 1 ? `${n} ${TYPE_NAMES[t]} with dinner baked on. On the clean shelf. Bold.` : 'Food baked on. On the clean shelf. Bold.', 2.5);
    if (s.seen && !s.boss.offline) {
      s.annoyance += Math.min(45, 18 * n);
      s.boss.confront();
      s.bossSay('dirtyShelved', true);
    }
  }

  /** A single dish from the hands onto a shelf. */
  private shelveOne(t: ShelfType, d: Dish): void {
    const s = this.s;
    if (this.shelf[t].length >= SHELF_MAX) {
      s.say('The shelf is full. The waiter is slow today. Blame him.', 2.5);
      return;
    }
    this.dropHeldDish();
    this.shelf[t].push(d);
    this.renderShelf(t);
    sounds.rack(s.sfx);
    if (d.type !== t) {
      this.c.wrong++;
      s.hype += 8;
      s.chat('wrongShelf', { item: DISH_DEFS[d.type].name.toLowerCase(), cat: TYPE_NAMES[t] });
      s.say(`You put the ${DISH_DEFS[d.type].name.toLowerCase()} with the ${TYPE_NAMES[t]}. It looks lonely. And wrong.`, 2.5);
      if (s.seen && !s.boss.offline) {
        s.annoyance += 25;
        s.boss.confront();
        s.bossSay('wrongShelf', true);
      }
    } else if (!d.washed || d.quality === 'baked') {
      this.scoreDirty(1, t);
    } else this.scoreGood(1);
  }

  // ================================================================ pots

  private renderPots(): void {
    for (const m of this.potMeshes) m.removeFromParent();
    this.potMeshes = [];
    this.potRack.slice(0, this.level.potHooks.length).forEach((d, i) => {
      const v = dishVisual(d);
      v.rotation.x = Math.PI / 2;
      v.rotation.y = i * 0.3;
      this.s.scene.add(v);
      v.position.set(0, 0, 0);
      v.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(v);
      const hook = this.level.potHooks[i];
      v.position.set(hook.x - (box.min.x + box.max.x) / 2, hook.y - box.max.y + 0.03, hook.z - (box.min.z + box.max.z) / 2);
      this.potMeshes.push(v);
    });
  }

  private hangPot(d: Dish): void {
    const s = this.s;
    if (d.burnt > 0.02) {
      this.chef.say(pick(T.CHEF_BURNT_BACK), 3);
      this.chef.act('angry', 1.4);
      s.hype += 4;
      s.chat('chef');
      return;
    }
    this.dropHeldDish();
    this.potRack.push(d);
    this.renderPots();
    this.c.pots++;
    this.scoreGood(1);
    if (this.chef.pos.distanceTo(s.player.pos) < 7) {
      this.chef.say(pick(T.CHEF_THANKS), 3.5);
      this.chef.act('happy', 2);
    }
  }

  // ================================================================ minigames

  private startRinse(item: Item | null, d: Dish | null): void {
    const s = this.s;
    const L = this.level;
    if (item) {
      s.detachHeld();
      s.scene.add(item.mesh);
      item.mesh.position.copy(L.sinkSpot).setY(L.sinkSpot.y + item.baseOffset);
      item.mesh.rotation.set(0, 0, 0);
      item.state = 'held';
    }
    this.mini = { kind: 'rinse', item, dish: d, p: 0, lastKey: '', puddleT: 0, flooded: false, sound: 0 };
    s.movementLocked = true;
  }

  private startScrub(item: Item, d: Dish): void {
    const s = this.s;
    const L = this.level;
    s.detachHeld();
    s.scene.add(item.mesh);
    item.mesh.position.copy(L.potSinkSpot).setY(L.potSinkSpot.y + item.baseOffset);
    item.mesh.rotation.set(0, 0.4, 0);
    item.state = 'held';
    this.mini = { kind: 'scrub', item, dish: d, p: 1 - d.burnt, lastKey: '', puddleT: 0, flooded: false, sound: 0 };
    s.movementLocked = true;
    s.hud.progress('SCRUB! Alternate A and D  (E: stop)', this.mini.p);
  }

  private endMini(): void {
    const s = this.s;
    const m = this.mini;
    if (!m) return;
    this.mini = null;
    s.movementLocked = false;
    s.hud.progress(null);
    this.level.stream.visible = false;
    if (m.item && m.item.state === 'held' && !s.held) s.pickUp(m.item);
  }

  private stroke(code: string): void {
    const m = this.mini;
    const s = this.s;
    if (!m || m.kind !== 'scrub' || !m.dish || !m.item) return;
    const side = code === 'KeyA' || code === 'ArrowLeft' ? 'L' : 'R';
    const L = this.level;
    L.brush.position.z = 0.65 + (side === 'L' ? -0.12 : 0.12);
    L.brush.position.x = 0.05 + rand(-0.05, 0.05);
    m.item.mesh.rotation.y += side === 'L' ? 0.08 : -0.08;
    sounds.scrub(s.sfx);
    if (side === m.lastKey) {
      // same side twice: the steel wool just squeaks
      s.sfx.tone(1800, 0.05, 'square', 0.03);
      return;
    }
    m.lastKey = side;
    m.p = Math.min(1, m.p + 0.055);
    m.dish.burnt = 1 - m.p;
    applyLook(m.item.mesh, m.dish);
    this.fx.burst(m.item.mesh.position.clone().setY(m.item.mesh.position.y + 0.2), 3, Math.random() < 0.5 ? '#1a120c' : '#e8e8df', 1.4, 0.03);
    s.hud.progress('SCRUB! Alternate A and D  (E: stop)', m.p);
    if (s.seen && Math.random() < 0.08) s.bossSay('scrubSeen');
    if (Math.random() < 0.04) s.chat('scrub');
    if (m.p >= 1) {
      m.dish.burnt = 0;
      applyLook(m.item.mesh, m.dish);
      s.sfx.ding();
      s.say('The pot shines. You can see your own face in it. Your face looks tired.', 3);
      s.chat('scrub');
      this.endMini();
    }
  }

  private updateMini(dt: number): void {
    const m = this.mini;
    if (!m || m.kind !== 'rinse') return;
    const s = this.s;
    const L = this.level;
    if (!this.eHeld) {
      const d = m.dish;
      if (d && m.item) {
        if (m.p >= 1) {
          d.rinsed = true;
          this.c.rinsed++;
        } else if (m.p < 0.35) s.say('Barely wet. The sauce did not even notice.', 2);
        else s.say('Half rinsed. The sauce is now evenly distributed.', 2);
      }
      this.endMini();
      return;
    }
    m.p += dt;
    L.stream.visible = true;
    L.stream.scale.x = L.stream.scale.z = 0.8 + Math.random() * 0.4;
    L.sprayNozzle.rotation.z = Math.sin(m.p * 40) * 0.06;
    this.fx.burst(L.sinkSpot.clone().setY(L.sinkSpot.y + 0.1), 2, Math.random() < 0.5 ? '#cfefff' : '#9fd4ee', 1.8, 0.025);
    m.sound -= dt;
    if (m.sound <= 0) {
      m.sound = 0.2;
      sounds.spray(s.sfx);
    }
    if (Math.random() < dt * 2) this.fx.steam(L.sinkSpot.clone().setY(1.1), 1, 0.3, 0.5, 0.3);
    const d = m.dish;
    // liquids go first, then the jet takes the food off too
    if (d?.food && m.item && ((m.p >= 0.6 && ['wine', 'soup', 'sauce'].includes(d.food)) || m.p >= 1.6)) {
      const solid = !['wine', 'soup', 'sauce'].includes(d.food);
      d.food = null;
      applyLook(m.item.mesh, d);
      this.fx.burst(m.item.mesh.position.clone().setY(m.item.mesh.position.y + 0.1), 8, '#6a3a1a', 2, 0.04);
      if (solid) s.say('The jet blasts the food into the drain. The drain is now the best fed customer here.', 3);
    }
    const limit = m.item ? 2.4 : 1.2;
    if (m.item) s.hud.progress(m.p < 1 ? 'RINSING... hold E' : m.p < limit ? 'RINSED. Release E.' : 'FLOODING THE KITCHEN. Release E!', m.p < 1 ? m.p : 1);
    else s.hud.progress(m.p < limit ? 'SPRAYING... (release E)' : 'FLOODING THE KITCHEN', Math.min(1, m.p / limit));
    if (m.p > limit) {
      m.puddleT -= dt;
      if (Math.random() < dt * 8) this.fx.burst(new THREE.Vector3(L.sinkFront.x + rand(-0.8, 0.8), 0.9, -8.2), 4, '#9fd4ee', 2.5, 0.04, false, new THREE.Vector3(0, 0, 1.5));
      if (m.puddleT <= 0) {
        m.puddleT = 1.1;
        s.makePuddle(L.sinkFront.x + rand(-1.2, 1.2), rand(-7.6, -6.4), '#7fb0cc');
        s.sfx.splash();
        this.c.floods++;
        s.hype += 6;
        if (!m.flooded) {
          m.flooded = true;
          s.chat('flood', {}, 2);
          if (s.seen && !s.boss.offline) {
            s.annoyance += 15;
            s.boss.confront();
            s.bossSay('flood', true);
          }
        }
      }
    }
  }

  // ================================================================ the player's actions

  interact(look: Look | null): boolean {
    const s = this.s;
    if (this.mini) {
      if (this.mini.kind === 'scrub') this.endMini();
      return true;
    }
    if (this.fun.interact(look)) return true;
    const info = look?.info;
    const held = s.held;
    const d = this.heldDish();
    const kind = info?.kind;
    const isRack = held === this.rack.item;

    // the mop works anywhere near a puddle
    if (held?.def.id === 'dw-mop') {
      const i = this.nearPuddle(look);
      if (i >= 0) {
        s.removePuddle(i);
        s.sfx.splash();
        this.c.mopped++;
        s.say(pick(['You mop it up. The mop is now wetter. That should not be possible.', 'Mopped. The puddle lives on in the mop.', 'Clean. Ish. The floor shines like a lie.']), 2.5);
        return true;
      }
    }

    // the rack only goes into the machine or onto a shelf, never on the floor by accident
    if (isRack && kind && kind.startsWith('dw') && !['dwWasher', 'dwWasherBtn', 'dwShelf', 'dwBot'].includes(kind)) {
      s.say('The rack goes back in the machine. Or onto the shelves. Not here.', 2.5);
      return true;
    }

    // looking at the rack inside the machine counts as the machine
    const washerLook = kind === 'dwWasher' || (kind === 'item' && info?.item === this.rack.item && this.rack.inMachine);

    if (kind === 'dwPile') {
      if (d) {
        this.dropHeldDish();
        this.pile.push(d);
        this.renderPile();
        s.sfx.click();
        if (this.pile.length >= PILE_TOPPLE) this.topple();
        return true;
      }
      if (held) return false;
      const top = this.pile.pop();
      if (!top) {
        s.say('The pile is empty. Enjoy it. It will not last.', 2);
        return true;
      }
      this.renderPile();
      s.pickUp(this.spawnDish(top, new THREE.Vector3(0, -20, 0)));
      this.fun.onPileDraw();
      return true;
    }

    if (kind === 'dwBin') {
      if (held?.def.id === 'dw-shards') {
        s.removeHeld();
        s.sfx.thud();
        s.say('Shards disposed. The bin does not judge. The breakage counter does.', 2.5);
        return true;
      }
      if (d?.type === 'pot') {
        s.say('The burn is structural. It needs the pot sink and your arms.', 2.5);
        return true;
      }
      if (d) {
        if (!d.food) {
          s.say('Nothing left to scrape. You scrape anyway. It squeaks.', 2);
          return true;
        }
        const wasWine = d.food === 'wine';
        d.food = null;
        applyLook(held!.mesh, d);
        this.c.scraped++;
        sounds.scrape(s.sfx);
        const L = this.level;
        const lvl = Math.min(0.84, 0.72 + this.c.scraped * 0.006);
        L.binMound.position.y = lvl;
        L.binMoundFood.position.y = lvl + 0.02;
        this.fx.burst(new THREE.Vector3(-3.65, 0.95, -8.55), 6, wasWine ? '#6d0f1e' : '#6a3a1a', 1.2, 0.04);
        s.say(wasWine ? 'You pour the untouched 2061 vintage into the scraps. Somewhere a sommelier feels a disturbance.' : pick(T.SCRAPE_LINES), 2.5);
        if (this.chef.pos.distanceTo(s.player.pos) < 8 && Math.random() < 0.25) this.chef.say(pick(T.CHEF_SCRAPE), 3);
        return true;
      }
      if (!held) {
        s.say(T.BIN_IDLE, 3);
        return true;
      }
      return false;
    }

    if (kind === 'dwSink') {
      if (d?.type === 'pot') {
        s.say('Pots go to the pot sink on the west wall. This sink is for delicate things. Not you.', 3);
        return true;
      }
      if (d && held) {
        this.startRinse(held, d);
        return true;
      }
      if (!held) {
        this.startRinse(null, null);
        return true;
      }
      return false;
    }

    if (washerLook || kind === 'dwWasherBtn') {
      if (kind === 'dwWasherBtn' && !isRack) {
        this.runWasher();
        return true;
      }
      if (this.machine.state !== 'open') {
        s.say('It is washing. Do not open it. It is concentrating.', 2);
        return true;
      }
      if (isRack) {
        this.putRackBack();
        return true;
      }
      if (d?.type === 'pot') {
        s.say('The pot does not fit. Nothing fits the pot. Use the pot sink.', 2.5);
        return true;
      }
      if (held?.def.toiletKey) {
        s.say('You try to wash the toilet key. Brad would call it a hygiene initiative. The stock pot does not fit.', 3);
        return true;
      }
      if (d) {
        if (!this.rack.inMachine) s.say('There is no rack in the machine. Bring the rack back first.', 2.5);
        else if (this.rackCount() >= RACK_SLOTS) s.say('The rack is full. Press the big green WASH button.', 2.5);
        else this.loadRack(d);
        return true;
      }
      if (!held) {
        if (!this.rack.inMachine) {
          s.say('The rack is somewhere else. Racks do not come back on their own.', 2.5);
          return true;
        }
        this.rack.inMachine = false;
        s.pickUp(this.rack.item);
        this.updateLcd();
        return true;
      }
      return false;
    }

    if (kind === 'dwShelf') {
      const t = info!.type as ShelfType;
      if (isRack) {
        this.unloadRack(t);
        return true;
      }
      if (d?.type === 'pot') {
        s.say('Pots hang on the pot rack over the range. The chef likes to see them suffer.', 2.5);
        return true;
      }
      if (d) {
        this.shelveOne(t, d);
        return true;
      }
      if (!held) {
        s.say(`The ${TYPE_LABEL[t]} shelf. ${this.shelf[t].length} clean in stock. The waiter will take them. Then bring them back dirty.`, 3);
        return true;
      }
      return false;
    }

    if (kind === 'dwPotSink') {
      if (d?.type === 'pot' && held) {
        if (d.burnt <= 0.02) s.say('It is clean. Hang it on the pot rack over the range.', 2.5);
        else this.startScrub(held, d);
        return true;
      }
      if (d) {
        s.say('This sink is for pots. Dishes go to the sink with the sprayer.', 2.5);
        return true;
      }
      if (!held) {
        s.say('The pot sink. The water is grey. It has always been grey.', 2.5);
        return true;
      }
      return false;
    }

    if (kind === 'dwPotRack') {
      if (d?.type === 'pot') {
        this.hangPot(d);
        return true;
      }
      if (!held) {
        s.say(`The pot rack. ${this.potRack.length} clean pots. The chef burns about one a minute.`, 2.5);
        return true;
      }
      return false;
    }

    if (kind === 'dwBot') {
      this.talkTo(info!.bot as Bot);
      return true;
    }

    // the rack lying around somewhere: the engine picks it up
    return false;
  }

  private nearPuddle(look: Look | null): number {
    const s = this.s;
    const ref = look?.point ?? s.player.pos;
    let best = -1;
    let bd = 2.2;
    s.puddles.forEach((p, i) => {
      const d = Math.min(Math.hypot(p.x - ref.x, p.z - ref.z), Math.hypot(p.x - s.player.pos.x, p.z - s.player.pos.z));
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  private talkTo(b: Bot): void {
    const s = this.s;
    const d = this.heldDish();
    switch (b.role) {
      case 'chef':
        if (d?.type === 'pot') this.hangPot(d);
        else {
          b.say(pick(T.CHEF_TALK), 3.5);
          b.act('talk', 1.5);
        }
        break;
      case 'waiter':
        b.say(d ? 'I only carry clean things. Emotionally and physically.' : pick(T.WAITER_TALK), 3.5);
        break;
      case 'somm':
        if (d?.type === 'glass') {
          const line = !d.washed ? 'Zis glass is not even washed. It smells of table 7.' : d.quality === 'clean' ? pick(T.SOMM_CLEAN) : pick(T.SOMM_SPOTTY);
          b.say(line, 4);
          b.act('talk', 1.5);
          s.hype += 3;
        } else b.say(pick(T.SOMM_TALK), 3.5);
        break;
      case 'vac':
        b.say(pick(T.VAC_TALK), 2.5);
        break;
    }
  }

  hint(look: Look | null): string | null {
    const s = this.s;
    if (this.mini) return this.mini.kind === 'scrub' ? 'A / D: scrub  ·  E: stop' : '';
    const fh = this.fun.hint(look);
    if (fh !== null) return fh;
    const info = look?.info;
    const held = s.held;
    const d = this.heldDish();
    const isRack = held === this.rack.item;
    if (held?.def.id === 'dw-mop' && this.nearPuddle(look) >= 0) return 'E: mop the puddle';
    if (!info) return null;
    if (isRack && info.kind.startsWith('dw') && !['dwWasher', 'dwWasherBtn', 'dwShelf', 'dwBot'].includes(info.kind)) return 'The rack goes on the shelves or back in the machine';
    const name = d ? DISH_DEFS[d.type].name.toLowerCase() : '';
    const washerLook = info.kind === 'dwWasher' || (info.kind === 'item' && info.item === this.rack.item && this.rack.inMachine);
    if (washerLook) {
      if (this.machine.state !== 'open') return 'Washing...';
      if (isRack) return 'E: put the rack back in';
      if (d?.type === 'pot') return 'Pots do not fit';
      if (d) return !this.rack.inMachine ? 'No rack in the machine' : this.rackCount() >= RACK_SLOTS ? 'Rack full. Press WASH' : `E: load the ${name} into the rack`;
      if (!held) {
        if (!this.rack.inMachine) return 'No rack in here';
        if (!this.rackCount()) return 'E: take the empty rack';
        return this.rack.slots.some((x) => x && !x.washed) ? 'E: take the rack out  ·  green button: WASH' : 'E: take the clean rack out';
      }
      return null;
    }
    switch (info.kind) {
      case 'dwPile':
        if (d) return 'E: put it back on the pile';
        if (held) return null;
        return this.pile.length ? `E: take a dirty ${DISH_DEFS[this.pile[this.pile.length - 1].type].name.toLowerCase()}` : 'Empty. For now.';
      case 'dwBin':
        if (held?.def.id === 'dw-shards') return 'E: dump the shards';
        if (d?.food) return d.food === 'wine' ? 'E: pour it out' : 'E: scrape the food into the bin';
        if (d) return d.type === 'pot' ? 'Pots need scrubbing' : 'E: scrape (nothing left)';
        return held ? null : 'Scrap bin';
      case 'dwSink':
        if (d?.type === 'pot') return 'Pots go to the pot sink';
        if (d) return `Hold E: rinse the ${name}`;
        return held ? null : 'Hold E: spray';
      case 'dwWasherBtn':
        if (this.machine.state !== 'open') return 'Washing...';
        return this.rack.inMachine ? `E: WASH (${this.rackCount()}/${RACK_SLOTS})` : 'No rack in the machine';
      case 'dwShelf': {
        const t = info.type as ShelfType;
        if (isRack) return `E: unload ${TYPE_NAMES[t]} from the rack`;
        if (d?.type === 'pot') return 'Pots go on the pot rack';
        if (d) return `E: put the ${name} on the ${TYPE_LABEL[t]} shelf`;
        return held ? null : `${TYPE_LABEL[t]} shelf (${this.shelf[t].length} clean)`;
      }
      case 'dwPotSink':
        if (d?.type === 'pot') return d.burnt > 0.02 ? 'E: scrub the pot' : 'Clean. Hang it on the pot rack';
        return held ? null : 'Pot sink';
      case 'dwPotRack':
        if (d?.type === 'pot') return d.burnt > 0.02 ? 'E: hang it (still burnt...)' : 'E: hang the clean pot';
        return held ? null : `Pot rack (${this.potRack.length} clean)`;
      case 'dwBot': {
        const b = info.bot as Bot;
        if (b.role === 'chef' && d?.type === 'pot') return `E: give the pot to ${b.name}`;
        return `E: talk to ${b.name}`;
      }
      case 'item':
        if (info.item === this.rack.item && !held) return 'E: take the rack';
        return null;
    }
    return null;
  }

  // ================================================================ thrown things

  thrownHit(it: Item): boolean {
    const s = this.s;
    if (this.fun.thrownHit(it)) return true;
    const p = it.mesh.position;
    for (const b of this.bots) {
      if (b.ghost) continue;
      if (Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < b.radius + 0.15 && p.y < b.height + 0.3) {
        it.vel.multiplyScalar(-0.3);
        it.thrown = false;
        s.sfx.thud();
        b.act('hit', 1.5);
        s.hype += 12;
        switch (b.role) {
          case 'chef':
            b.say(pick(T.CHEF_HIT), 3);
            s.chat('chef', {}, 2);
            this.tantrumT = Math.min(this.tantrumT, 2.5);
            break;
          case 'waiter':
            b.say(pick(T.WAITER_HIT), 3);
            s.chat('waiter');
            break;
          case 'somm':
            b.say(pick(T.SOMM_HIT), 3);
            s.chat('sommelier');
            break;
          case 'vac':
            b.say('Bonk. Rebooting. Still vacuuming.', 2.5);
            s.chat('vacuum');
            break;
        }
        return true;
      }
    }
    // the dirty pile does not like being hit
    const base = new THREE.Vector3();
    this.level.pileAnchor.getWorldPosition(base);
    if (this.pile.length >= 4 && Math.hypot(p.x - base.x, p.z - base.z) < 0.55 && p.y > base.y - 0.1 && p.y < base.y + this.pileH + 0.2) {
      it.vel.multiplyScalar(-0.2);
      it.thrown = false;
      this.topple();
      return true;
    }
    return false;
  }

  // ================================================================ per frame

  update(dt: number): void {
    const s = this.s;
    this.fx.update(dt);
    this.updateMini(dt);
    this.updateMachine(dt);
    this.checkImpacts();
    this.checkRoomService();
    this.checkSlips(dt);
    if (this.chef.stun <= 0) this.updateChef(dt);
    if (this.waiter.stun <= 0) this.updateWaiter(dt);
    if (this.somm.stun <= 0) this.updateSomm(dt);
    this.updateVac(dt);
    this.separate();
    for (const b of this.bots) b.update(dt);
    this.fun.update(dt);
    this.placeCart();
    // the pile wobbles more the higher it gets
    const n = this.pile.length;
    const amp = Math.max(0, n - 7) * 0.0045;
    this.level.pileAnchor.rotation.z = Math.sin(s.t * 2.3) * amp;
    this.level.pileAnchor.rotation.x = Math.sin(s.t * 1.7 + 1) * amp * 0.7;
    // steam from the stoves and the stock
    this.steamT -= dt;
    if (this.steamT <= 0) {
      this.steamT = 0.45;
      this.fx.steam(pick(this.level.stoveSteam), 1, 0.15, 0.7, 0.35);
    }
    // the toilet key walk
    if (s.held?.def.toiletKey) {
      this.keyWalk += s.player.speed * dt;
      const b = this.level.booth;
      const P = s.player.pos;
      if (this.keyWalk > 14 && P.x > b.minX && P.x < b.maxX && P.z > b.minZ && P.z < b.maxZ) s.achieve('stockpot');
    } else this.keyWalk = 0;
  }

  /** Robots walking through a puddle go down. The waiter's cart does not stop. */
  private checkSlips(dt: number): void {
    const s = this.s;
    for (const b of [this.chef, this.waiter, this.somm]) {
      b.slipCooldown -= dt;
      if (b.stun > 0) {
        b.stun -= dt;
        continue;
      }
      if (b.ghost || b.slipCooldown > 0 || b.arrived) continue;
      if (!s.puddles.some((p) => Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < p.r)) continue;
      b.stun = 2.2;
      b.slipCooldown = 10;
      b.act('hit', 2.2);
      b.say(pick(T.SLIP_LINES[b.role]), 3);
      s.sfx.slip();
      s.hype += 15;
      s.chat('slip', {}, 2);
      this.c.slips++;
      if (b === this.waiter && this.cartLoad.children.length) {
        // whatever was on the cart is now on the floor, in pieces
        const p = this.cart.position.clone().setY(0.9);
        for (let i = 0; i < this.cartLoad.children.length; i++) this.breakAt(p.clone().add(new THREE.Vector3(rand(-0.5, 0.5), 0, rand(-0.5, 0.5))), i % 3 === 2 ? 'glass' : 'plate', i > 0);
        this.cartLoad.clear();
      }
    }
  }

  private separate(): void {
    const bs = this.bots.filter((b) => !b.ghost);
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
          dx = 1;
          dz = 0;
          d = 1;
        }
        const o = (min - d) / 2;
        a.pos.x -= (dx / d) * o + (dz / d) * o * 0.5;
        a.pos.z -= (dz / d) * o - (dx / d) * o * 0.5;
        b.pos.x += (dx / d) * o + (dz / d) * o * 0.5;
        b.pos.z += (dz / d) * o - (dx / d) * o * 0.5;
      }
    }
  }

  private placeCart(): void {
    const w = this.waiter;
    const yaw = w.group.rotation.y;
    this.cart.position.set(w.pos.x + Math.sin(yaw) * 0.72, 0, w.pos.z + Math.cos(yaw) * 0.72);
    this.cart.rotation.y = yaw;
  }

  // ---------------------------------------------------------------- the chef

  private updateChef(dt: number): void {
    const s = this.s;
    const L = this.level;
    const b = this.chef;
    this.tantrumT -= dt;
    b.timer -= dt;
    switch (b.state) {
      case 'cook':
        b.face(b.pos.x, -3.55);
        if (b.timer <= 0) {
          if (this.tantrumT <= 0) {
            b.state = 'tantrum';
            b.timer = 2.6;
            b.act('angry', 1.6);
            b.face(s.player.pos.x, s.player.pos.z);
            b.say(pick(T.CHEF_TANTRUM), 3.5);
            this.c.tantrums++;
            s.chat('chef');
            s.bossSay('chefTantrum');
            return;
          }
          if (Math.random() < 0.25) {
            b.state = 'toPass';
            b.goTo(L.passSpot, s.nav);
          } else {
            b.state = 'walk';
            b.goTo(pick(L.chefSpots), s.nav);
          }
          if (Math.random() < 0.25) b.say(pick(T.CHEF_AMBIENT), 3.5);
        } else if (Math.random() < dt * 0.25) b.act('talk', 1.2);
        break;
      case 'walk':
        if (b.step(dt, L.colliders, s.nav)) {
          b.state = 'cook';
          b.timer = rand(4, 8);
        }
        break;
      case 'toPass':
        if (b.step(dt, L.colliders, s.nav)) {
          b.state = 'plate';
          b.timer = 2.5;
          b.face(b.pos.x, -9);
          b.act('act', 1.2);
        }
        break;
      case 'plate':
        if (b.timer <= 0) {
          if (Math.random() < 0.3) b.say('Service! Table 9! Ze scallop is ready to be ignored!', 3);
          b.state = 'walk';
          b.goTo(pick(L.chefSpots), s.nav);
        }
        break;
      case 'tantrum':
        if (b.timer < 1.1 && b.timer + dt >= 1.1) this.throwPot();
        if (b.timer <= 0) {
          this.tantrumT = rand(36, 52);
          b.state = 'cook';
          b.timer = rand(3, 6);
        }
        break;
    }
  }

  private throwPot(): void {
    const s = this.s;
    const b = this.chef;
    b.act('act', 1.2);
    s.sfx.whoosh();
    if (!this.potRack.length) {
      b.say(pick(T.CHEF_NO_POT), 4);
      s.hype += 6;
      s.chat('chef');
      if (!s.boss.offline) {
        s.annoyance += 10;
        s.bossSay('chefTantrum', true);
      }
      return;
    }
    this.potRack.pop();
    this.renderPots();
    const from = b.pos.clone().setY(1.5);
    const to = new THREE.Vector3(rand(-7.5, -5.5), 0, rand(-6, -4.2));
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const T_ = 1.0 + Math.hypot(dx, dz) * 0.03;
    const it = this.spawnDish({ ...newDish('pot') }, from);
    it.vel.set(dx / T_, (0.2 - from.y + 0.5 * 9.8 * T_ * T_) / T_, dz / T_);
    it.thrown = false;
    it.sleeping = false;
    b.face(to.x, to.z);
  }

  // ---------------------------------------------------------------- the waiter

  private updateWaiter(dt: number): void {
    const s = this.s;
    const L = this.level;
    const w = this.waiter;
    w.timer -= dt;
    switch (w.state) {
      case 'away':
        w.face(3.2, -12);
        if (w.timer <= 0) {
          w.state = 'toDoor';
          w.goStraight(L.doorOutside);
          this.fillCart(3 + Math.min(3, Math.floor(s.t / 80)), false);
        }
        break;
      case 'toDoor':
        if (w.step(dt, L.colliders, s.nav)) {
          w.state = 'enter';
          w.goStraight(L.doorInside);
          L.bumpDoors(true, 1.6);
          sounds.doors(s.sfx);
        }
        break;
      case 'enter':
        if (w.step(dt, L.colliders, s.nav)) {
          w.ghost = false;
          w.state = 'toDrop';
          w.goTo(L.dropSpot, s.nav);
        }
        break;
      case 'toDrop':
        if (w.step(dt, L.colliders, s.nav)) {
          w.state = 'drop';
          w.timer = 1.3;
          w.face(-1.75, -8.4);
          w.act('act', 1.2);
        }
        break;
      case 'drop':
        if (w.timer <= 0) {
          const n = this.cartLoad.children.length;
          this.cartLoad.clear();
          if (Math.random() < 0.4) w.say(pick(T.WAITER_DROP), 3.5);
          this.addToPile(n);
          // take clean ones for the guests: the emptiest shelf first
          const t = [...SHELF_TYPES].sort((a, b2) => this.shelf[a].length - this.shelf[b2].length + rand(-0.5, 0.5))[0];
          w.state = 'toShelf';
          w.timer = 0;
          w.goTo(L.shelves[t].front, s.nav);
          w.want = t;
        }
        break;
      case 'toShelf':
        if (w.step(dt, L.colliders, s.nav)) {
          const t = w.want as ShelfType;
          w.face(-12, w.pos.z);
          w.act('act', 1);
          const got = this.shelf[t].splice(0, 2);
          if (got.length) {
            this.renderShelf(t);
            this.fillCart(got.length, true);
            if (Math.random() < 0.35) w.say(pick(T.WAITER_TAKE), 3);
            w.state = 'leave';
            w.timer = 1;
          } else {
            this.c.blames++;
            w.state = 'blame';
            w.timer = 7;
            w.speed = 3.3;
            w.say(fill(pick(T.WAITER_BLAME), { type: TYPE_NAMES[t] }), 4);
            s.chat('waiter');
            w.goTo(s.player.pos, s.nav);
          }
        }
        break;
      case 'blame': {
        const P = s.player.pos;
        const dist = Math.hypot(P.x - w.pos.x, P.z - w.pos.z);
        if (dist > 1.5) {
          if (w.arrived || Math.random() < dt) w.goTo(P, s.nav);
          w.step(dt, L.colliders, s.nav);
        } else {
          w.stop();
          w.face(P.x, P.z);
        }
        if (dist <= 1.5 || w.timer <= 0) {
          w.act('angry', 1.5);
          if (w.timer > 0) w.say(fill(pick(T.WAITER_BLAME), { type: TYPE_NAMES[w.want as ShelfType] }), 3.5);
          s.hype += 6;
          if (!s.boss.offline && (s.seen || s.boss.horizontalDist(P) < 10)) {
            s.annoyance += 15;
            s.bossSay('waiterBlame', true);
          }
          w.speed = 2.6;
          w.state = 'leave';
          w.timer = 1.2;
        }
        break;
      }
      case 'leave':
        if (w.timer > 0) break;
        w.state = 'toExit';
        w.goTo(L.doorInside, s.nav);
        break;
      case 'toExit':
        if (w.step(dt, L.colliders, s.nav)) {
          w.ghost = true;
          w.state = 'exit';
          w.goStraight(L.doorOutside);
          L.bumpDoors(false, 1.6);
          sounds.doors(s.sfx);
        }
        break;
      case 'exit':
        if (w.step(dt, L.colliders, s.nav)) {
          w.state = 'toTable';
          w.goStraight(new THREE.Vector3(rand(2.6, 4.2), 0, -13.8));
        }
        break;
      case 'toTable':
        if (w.step(dt, L.colliders, s.nav)) {
          w.state = 'away';
          w.timer = Math.max(16, rand(22, 29) - s.t / 30);
          this.cartLoad.clear();
        }
        break;
    }
  }

  // ---------------------------------------------------------------- the sommelier

  private updateSomm(dt: number): void {
    const s = this.s;
    const L = this.level;
    const m = this.somm;
    m.timer -= dt;
    switch (m.state) {
      case 'idle':
        m.face(12, m.pos.z);
        if (Math.random() < dt * 0.2) m.act('talk', 1.5);
        if (m.timer <= 0) {
          const t: ShelfType = Math.random() < 0.7 ? 'glass' : pick(SHELF_TYPES);
          m.want = t;
          m.state = 'toShelf';
          m.goTo(L.shelves[t].front, s.nav);
        }
        break;
      case 'toShelf':
        if (m.step(dt, L.colliders, s.nav)) {
          m.state = 'judge';
          m.timer = 2.2;
          m.face(-12, m.pos.z);
          m.act('act', 2);
        }
        break;
      case 'judge':
        if (m.timer <= 0) {
          this.judge(m.want as ShelfType);
          m.state = 'back';
          m.timer = 1.5;
        }
        break;
      case 'back':
        if (m.timer > 0) break;
        m.state = 'return';
        m.goTo(L.wineSpot, s.nav);
        break;
      case 'return':
        if (m.step(dt, L.colliders, s.nav)) {
          m.state = 'idle';
          m.timer = rand(22, 32);
        }
        break;
    }
  }

  private judge(t: ShelfType): void {
    const s = this.s;
    const m = this.somm;
    const list = this.shelf[t];
    if (!list.length) {
      m.say(t === 'glass' ? pick(T.SOMM_EMPTY) : `No ${TYPE_NAMES[t]}. I shall judge ze void.`, 3.5);
      return;
    }
    const i = list.findIndex((d) => d.type !== t || !d.washed || d.quality !== 'clean');
    if (i < 0) {
      m.say(t === 'glass' ? pick(T.SOMM_CLEAN) : `Ze ${TYPE_NAMES[t]} are clean. I am almost disappointed.`, 3.5);
      return;
    }
    const d = list.splice(i, 1)[0];
    const wasCounted = d.type === t && d.washed && d.quality === 'spotty';
    if (wasCounted) this.c.done = Math.max(0, this.c.done - 1);
    let line: string;
    if (d.type !== t) line = `A ${DISH_DEFS[d.type].name.toLowerCase()} on ze ${TYPE_NAMES[t]} shelf? Is zis a joke? Back to ze pile.`;
    else if (d.quality === 'spotty') line = pick(T.SOMM_SPOTTY);
    else line = fill(pick(T.SOMM_BAKED), { type: DISH_DEFS[d.type].name.toLowerCase() });
    m.say(line, 4.5);
    m.act('angry', 1.5);
    this.renderShelf(t);
    // back to the pile with it
    Object.assign(d, { washed: false, rinsed: false, quality: null, food: d.type === 'glass' ? null : d.food });
    this.pile.push(d);
    this.renderPile();
    if (this.pile.length >= PILE_TOPPLE) this.topple();
    this.c.spots++;
    s.hype += 8;
    s.chat('sommelier');
    if (wasCounted) s.hud.toast('DISH REJECTED', 'The sommelier sent one back. Quota -1.', 'corp');
    if (!s.boss.offline && (s.seen || s.boss.horizontalDist(m.pos) < 10)) {
      s.annoyance += 12;
      s.bossSay('sommelier', true);
    }
  }

  // ---------------------------------------------------------------- the vacuum

  private updateVac(dt: number): void {
    const s = this.s;
    const L = this.level;
    const v = this.vac;
    v.timer -= dt;
    const target = v.target;
    if (v.state === 'wander') {
      if (v.timer <= 0) {
        v.timer = 1;
        // shards first, then puddles
        let best: Bot['target'] = null;
        let bd = 30;
        for (const it of s.items) {
          if (it.state !== 'world' || it.def.id !== 'dw-shards' || !it.sleeping) continue;
          const d = Math.hypot(it.mesh.position.x - v.pos.x, it.mesh.position.z - v.pos.z);
          if (d < bd) {
            bd = d;
            best = { kind: 'item', x: it.mesh.position.x, z: it.mesh.position.z, item: it };
          }
        }
        for (const p of s.puddles) {
          const d = Math.hypot(p.x - v.pos.x, p.z - v.pos.z) + 2;
          if (d < bd) {
            bd = d;
            best = { kind: 'puddle', x: p.x, z: p.z };
          }
        }
        if (best) {
          v.target = best;
          v.state = 'hunt';
          v.goTo(s.nav.snap(new THREE.Vector3(best.x, 0, best.z)), s.nav);
        } else if (v.arrived) {
          v.goTo(s.nav.snap(new THREE.Vector3(rand(-10, 10), 0, rand(-6, 6))), s.nav);
        }
      }
      v.step(dt, L.colliders, s.nav);
    } else if (v.state === 'hunt' && target) {
      const there = v.step(dt, L.colliders, s.nav) || Math.hypot(target.x - v.pos.x, target.z - v.pos.z) < 0.6;
      if (there) {
        if (target.kind === 'item' && target.item && target.item.state === 'world') {
          s.removeItem(target.item);
          s.sfx.whoosh();
          v.say(pick(T.VAC_LINES), 2.5);
          this.c.vacuumed++;
          if (Math.random() < 0.5) s.chat('vacuum');
        } else if (target.kind === 'puddle') {
          const i = s.puddles.findIndex((p) => Math.hypot(p.x - target.x, p.z - target.z) < 0.3);
          if (i >= 0) {
            s.removePuddle(i);
            s.sfx.whoosh();
            v.say(pick(T.VAC_PUDDLE), 2.5);
            this.c.vacuumed++;
            if (Math.random() < 0.5) s.chat('vacuum');
          }
        }
        v.stop();
        v.state = 'wander';
        v.timer = 2;
      }
    } else v.state = 'wander';
  }
}
