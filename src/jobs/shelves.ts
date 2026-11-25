import * as THREE from 'three';
import { Customer, CustomerCtx } from '../customers';
import { Item, ItemDef, randomPalletDef } from '../items';
import { NavGrid } from '../nav';
import * as T from '../texts';
import { fill, pick, pushOutCircle, rand } from '../util';
import { Interact, putInSlot, ShelfSection, Slot, World } from '../world';
import { SHELVES_FUN_BOSS, SHELVES_FUN_CHAT, SHELVES_MODELS, SHELVES_SECRETS, ShelvesFun } from './shelves-fun';
import type { Job, JobEntry, Look, Shift } from './types';

/**
 * Job 1: shelf stacker at the SHOPOTRON 9000 hypermarket.
 * Take stock from the pallet, put it on the right shelf, survive the customers.
 */
const QUOTA = 25;

export class ShelvesJob implements Job {
  info = {
    id: 'shelves',
    title: 'SHELF STACKER',
    place: `${T.STORE_NAME} Hypermarket`,
    teaser: 'Shift 09:00 to 17:00 (about 5 minutes)',
    quotaLabel: 'QUOTA',
    lockedDoor: 'Locked. The key is at the Service Desk by the entrance. It is attached to a car tire.',
    bladderWarning: 'You really need to pee. The approved toilet is in the far right corner. The key is on a tire at the service desk.',
  };
  level: World;
  private s!: Shift;
  private customers: Customer[] = [];
  private ctx!: CustomerCtx;
  /** Customers currently filming the player. */
  private filmers = new Set<Customer>();
  private coffeeTries = 0;
  private c = { correct: 0, wrong: 0, bought: 0, knockedOff: 0, putBack: 0, vacuumed: 0, tips: 0, gifts: 0, complaints: 0, slips: 0, hits: 0, kicked: 0 };
  /** Vents, freezers, buttons, the break room and everything else nobody told you about. */
  private fun: ShelvesFun;

  bossLines = {
    shiftStart: T.BOSS_LINES.shiftStart,
    ...SHELVES_FUN_BOSS,
  };
  chatLines = SHELVES_FUN_CHAT;
  secrets = SHELVES_SECRETS;

  constructor(scene: THREE.Scene) {
    this.level = new World(scene);
    this.fun = new ShelvesFun(this.level);
  }

  start(shift: Shift): void {
    this.s = shift;
    this.ctx = this.customerCtx(shift.nav);
    for (const kind of T.CUSTOMER_KINDS) {
      this.customers.push(new Customer(shift.scene, kind, new THREE.Vector3(rand(2, 11), 0, rand(-9, 12)), this.ctx));
    }
    this.fun.start(shift, { customers: () => this.customers, ctx: () => this.ctx });
  }

  obstacles() {
    return this.customers.map((c) => ({ x: c.pos.x, z: c.pos.z, r: c.radius }));
  }

  lookTargets(): THREE.Object3D[] {
    return this.customers.map((c) => c.group);
  }

  quota() {
    return { done: this.c.correct, target: QUOTA };
  }

  hypeMultiplier(): number {
    return this.filmers.size ? 2 : 1;
  }

  cameraLabel(): string {
    const f = this.filmers.values().next().value;
    return f ? `ON CAMERA: ${f.name} (hype x2)` : '';
  }

  heldLabel(it: Item): string {
    return it.def.category ? ` [${it.def.category}]` : '';
  }

  productive(): boolean {
    return this.c.correct >= 20;
  }

  employeeOfTheMonth(pocket: ItemDef[], fired: boolean): string {
    return pocket.some((p) => p.id === 'frame') && !fired ? 'You. Technically. You have the frame.' : 'The Coffee Machine (again)';
  }

  reviewRows(): [string, string | number][] {
    const c = this.c;
    return [
      ['Items stocked correctly', c.correct],
      ['Items stocked "creatively"', c.wrong],
      ['Items bought by customers', c.bought],
      ['Items thrown on the floor by the toddler', c.knockedOff],
      ['Items eaten by the robot vacuum', c.vacuumed],
      ['Items given away for free', c.gifts],
      ['Customer complaints', c.complaints],
      ['Customers who slipped', c.slips],
      ['Customers kicked (gently)', c.kicked],
    ];
  }

  payRows(): [string, number][] {
    const c = this.c;
    const rows: [string, number][] = [];
    if (this.s.counter('toilet')) rows.push([`Tire key rental x${this.s.counter('toilet')}`, -2 * this.s.counter('toilet')]);
    if (c.tips) rows.push(['Tips from customers', c.tips], ['Tips (company property)', -c.tips]);
    if (c.gifts) rows.push([`Unauthorized generosity x${c.gifts}`, -1.5 * c.gifts]);
    if (c.vacuumed) rows.push([`Inventory lost to the vacuum x${c.vacuumed}`, -0.8 * c.vacuumed]);
    return rows;
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number): void {
    for (const c of this.customers) c.update(dt, this.ctx);
    this.separateCustomers();
    this.updateSlips();
    this.fun.update(dt);
  }

  /**
   * Keeps robots from walking through each other.
   * Overlapping robots are pushed apart, plus a small sidestep so two robots meeting
   * head-on slide past each other instead of getting stuck. Fallen robots are obstacles.
   */
  private separateCustomers(): void {
    const cs = this.customers;
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        const a = cs[i];
        const b = cs[j];
        const aFixed = a.state === 'fallen';
        const bFixed = b.state === 'fallen';
        if (aFixed && bFixed) continue;
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
        const overlap = min - d;
        const wa = aFixed ? 0 : bFixed ? 1 : 0.5;
        const wb = 1 - wa;
        const side = overlap * 0.6;
        a.pos.x -= nx * overlap * wa - nz * side * wa;
        a.pos.z -= nz * overlap * wa + nx * side * wa;
        b.pos.x += nx * overlap * wb - nz * side * wb;
        b.pos.z += nz * overlap * wb + nx * side * wb;
      }
    }
    for (const c of cs) {
      for (const b of this.level.colliders) if (!b.disabled) pushOutCircle(c.pos, c.radius, b);
      c.group.position.x = c.pos.x;
      c.group.position.z = c.pos.z;
    }
  }

  private updateSlips(): void {
    const s = this.s;
    for (const c of this.customers) {
      if (c.state === 'fallen' || c.slipCooldown > 0 || c.kind === 'roomba') continue;
      for (const pd of s.puddles) {
        if (Math.hypot(pd.x - c.pos.x, pd.z - c.pos.z) < pd.r) {
          c.fall(3, this.ctx);
          c.say(pick(T.CUSTOMER_SLIP));
          c.slipCooldown = 12;
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
    if (this.fun.thrownHit(it)) return true;
    const p = it.mesh.position;
    for (const c of this.customers) {
      if (c.state === 'fallen') continue;
      if (Math.hypot(p.x - c.pos.x, p.z - c.pos.z) < c.radius + 0.15 && p.y < c.height + 0.3) {
        it.vel.multiplyScalar(-0.3);
        it.thrown = false;
        c.fall(2.5, this.ctx);
        c.say(c.kind === 'roomba' ? 'Bonk. Rebooting. Still vacuuming.' : pick(T.CUSTOMER_HIT));
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

  /** The player kicked. Robots react in their own way, machines are handled by the fun module. */
  onKick(look: Look | null): boolean {
    const s = this.s;
    const c = (look?.info as Interact | undefined)?.customer;
    if (look && c && look.point.distanceTo(s.camera.getWorldPosition(new THREE.Vector3())) < 2.2) {
      if (c.state === 'fallen') {
        s.sfx.thud();
        s.say(`${c.name} is already on the floor. Kicking it there feels excessive, even for retail.`, 2.5);
        return true;
      }
      s.sfx.thud();
      const r = c.kicked(this.ctx);
      this.c.kicked++;
      s.hype += r === 'shrug' ? 4 : 10;
      s.chat('kickBot', {}, 1);
      if (r === 'flip') s.secret('shelves.roombaFlip');
      if (s.seen) {
        s.annoyance += 15;
        s.boss.confront();
        s.bossSay('kickCustomer', true);
      }
      return true;
    }
    return this.fun.onKick(look);
  }

  // ---------------------------------------------------------------- the player's actions

  interact(look: Look | null): boolean {
    const s = this.s;
    const info = look?.info as Interact | undefined;
    const held = s.held;
    if (this.fun.interact(look)) return true;
    if (held) {
      if (look && info?.kind === 'shelf' && info.section) {
        this.stock(info.section, look.point);
        return true;
      }
      if (look && info?.kind === 'item' && info.item?.state === 'shelf' && info.item.slot) {
        this.stock(info.item.slot.section, look.point);
        return true;
      }
      if (info?.kind === 'customer' && info.customer) {
        this.talkTo(info.customer);
        return true;
      }
      if (info?.kind === 'pallet') {
        s.removeHeld();
        s.say('You put it back on the pallet. The pallet accepts it without judgement.', 2.5);
        return true;
      }
      return false;
    }
    if (!info) return false;
    switch (info.kind) {
      case 'pallet': {
        const it = s.addItem(randomPalletDef(), new THREE.Vector3(0, -10, 0));
        s.pickUp(it);
        return true;
      }
      case 'coffee':
        this.coffeeTries++;
        s.hud.say('COFFEE MACHINE', pick(T.COFFEE_LINES), 3.5);
        s.sfx.buzz();
        s.chat('coffee');
        if (this.coffeeTries >= 3) s.achieve('coffee');
        return true;
      case 'shelf':
        if (info.section) s.say(`This is the ${info.section.category} shelf. New stock is on the pallet in the back left corner.`, 3);
        return true;
      case 'customer':
        if (info.customer) this.talkTo(info.customer);
        return true;
    }
    return false;
  }

  hint(look: Look | null): string | null {
    const info = look?.info as Interact | undefined;
    const held = this.s.held;
    if (!info) return null;
    const fh = this.fun.hint(look);
    if (fh !== null) return fh;
    switch (info.kind) {
      case 'item': {
        const it = info.item!;
        if (held && it.state === 'shelf' && it.slot) return `E: stock ${held.def.name} in ${it.slot.section.category}`;
        return null;
      }
      case 'shelf':
        return held ? `E: stock ${held.def.name} in ${info.section!.category}` : `${info.section!.category} shelf`;
      case 'pallet':
        return held ? 'E: put it back on the pallet' : 'E: take an item from the pallet';
      case 'coffee':
        return 'E: get coffee';
      case 'customer': {
        const c = info.customer!;
        if (c.kind === 'karen' && c.state === 'follow') return `E: apologize to ${c.name}`;
        if (c.kind === 'gran' && held) return `E: give ${held.def.name} to ${c.name}${c.wish ? ` (wants ${c.wish.name})` : ''}`;
        if (c.kind === 'gran') return `E: talk to ${c.name}${c.wish ? ` (wants ${c.wish.name})` : ''}`;
        if (held) return `E: give ${held.def.name} to ${c.name}`;
        return `E: talk to ${c.name}`;
      }
    }
    return null;
  }

  private stock(section: ShelfSection, point: THREE.Vector3): void {
    const s = this.s;
    const it = s.held;
    if (!it) return;
    const free = section.slots.filter((sl) => !sl.item);
    if (!free.length) {
      s.say('This shelf is full. Customers are slow today. Blame them.', 2.5);
      return;
    }
    free.sort((a, b) => a.pos.distanceToSquared(point) - b.pos.distanceToSquared(point));
    s.detachHeld();
    putInSlot(s.scene, it, free[0]);
    const cat = section.category;
    const vars = { item: it.def.name, cat: cat.toLowerCase() };
    if (it.knockedOff) {
      it.knockedOff = false;
      this.c.putBack++;
      if (this.c.putBack >= 5) s.achieve('toddler');
    }
    if (it.def.shape === 'nothing') {
      s.achieve('nothing');
      s.chat('nothing');
      s.say('You stocked nothing. The shelf looks exactly the same. Productive.', 3);
      return;
    }
    if (it.def.category === null) {
      s.hype += 8;
      s.say(`You stocked the ${it.def.name} in ${cat}. Bold.`, 3);
      s.chat('wrongSort', vars);
      return;
    }
    if (it.def.category === cat) {
      this.c.correct++;
      s.annoyance = Math.max(0, s.annoyance - 6);
      s.sfx.ding();
      if (s.seen && Math.random() < 0.3) s.bossSay('correctSeen');
      if (Math.random() < 0.25) s.chat('correct');
      if (this.c.correct === QUOTA) s.hud.toast('QUOTA REACHED', 'Brad has raised your quota. Congratulations.', 'corp');
    } else {
      this.c.wrong++;
      s.hype += 9;
      s.sfx.buzz();
      s.chat('wrongSort', vars);
      if (s.seen) {
        s.annoyance += 30;
        s.boss.confront();
        s.bossSay('wrongSort', true);
      }
    }
  }

  /** E on a customer. Hands over the held item or talks. */
  private talkTo(c: Customer): void {
    const s = this.s;
    if (c.state === 'fallen') {
      s.say(`${c.name} is busy lying on the floor.`, 2);
      return;
    }
    const held = s.held;
    if (this.fun.karenNothing(c)) return;
    if (c.kind === 'karen' && c.state === 'follow') {
      c.stopComplaint(this.ctx);
      c.say(pick(T.KAREN_APOLOGY), 3.5);
      s.hype += 5;
      s.achieve('karen');
      return;
    }
    if (c.kind === 'gran' && held) {
      if (!held.def.pocketable || held.def.shape === 'nothing') {
        c.say('What would I do with that, dear?', 3);
        return;
      }
      const wanted = c.wish;
      s.removeHeld();
      this.c.gifts++;
      if (wanted && held.def.id === wanted.id) {
        c.say(pick(T.GRAN_THANKS), 4);
        c.wish = null;
        this.c.tips += 2;
        s.sfx.ding();
        s.hype += 6;
        s.chat('tip', {}, 2);
        s.achieve('gran');
        s.hud.toast('TIP RECEIVED: €2.00', 'Company policy: tips go to management.', 'corp');
        if (!s.boss.offline) s.bossSay('tipTaken', true);
      } else {
        c.say(fill(pick(T.GRAN_WRONG), { item: wanted?.name ?? 'that' }), 4);
      }
      return;
    }
    if (c.kind === 'gran') {
      if (!c.wish) c.wish = c.newWish();
      c.say(c.wishLine(), 5);
      return;
    }
    if (held && held.def.pocketable && held.def.shape !== 'nothing') {
      s.removeHeld();
      this.c.gifts++;
      c.say(pick(T.GIFT_LINES), 3.5);
      s.hype += 4;
      return;
    }
    c.say(pick(T.TALK_LINES[c.kind] ?? T.CUSTOMER_NORMAL), 3.5);
  }

  // ---------------------------------------------------------------- what customers do

  private customerCtx(nav: NavGrid): CustomerCtx {
    const s = this.s;
    return {
      world: this.level,
      colliders: this.level.colliders,
      nav,
      customers: () => this.customers,
      get playerPos() {
        return s.player.pos;
      },
      floorItems: () => s.items.filter((i) => i.state === 'world' && i.sleeping && i.mesh.position.y < 0.6 && !i.def.fixture),
      puddles: () => s.puddles,
      take: (c, slot) => this.onCustomerTake(c, slot),
      knockOff: (c, slot) => this.onKnockOff(c, slot),
      vacuumItem: (c, item) => this.onVacuumItem(c, item),
      vacuumPuddle: (c, index) => this.onVacuumPuddle(c, index),
      complain: (c) => this.onComplain(c),
      filming: (c, on) => this.onFilming(c, on),
    };
  }

  private onCustomerTake(c: Customer, slot: Slot): void {
    const s = this.s;
    if (c.kind === 'bulk') {
      const slots = slot.section.slots
        .filter((sl) => sl.item && !sl.item.def.fixture)
        .sort((a, b) => a.pos.distanceToSquared(slot.pos) - b.pos.distanceToSquared(slot.pos))
        .slice(0, 4);
      if (!slots.length) {
        c.say('Empty? EMPTY? I demand a restock.', 3);
        return;
      }
      for (const sl of slots) s.removeItem(sl.item!);
      this.c.bought += slots.length;
      c.say(pick(T.BULK_LINES), 3.5);
      if (slots.length >= 3) s.chat('bulk');
      return;
    }
    const it = slot.item;
    if (!it) {
      if (c.kind === 'karen') c.startComplaint();
      else if (Math.random() < 0.35) c.say(pick(T.CUSTOMER_EMPTY));
      return;
    }
    if (it.def.fixture) {
      c.say(pick(T.CUSTOMER_TIRE));
      return;
    }
    s.removeItem(it);
    this.c.bought++;
    if (it.def.shape === 'nothing') {
      c.say(pick(T.CUSTOMER_NOTHING));
      s.hype += 10;
      s.chat('nothing');
    } else if (it.def.category !== slot.section.category) {
      if (c.kind === 'karen') {
        c.startComplaint();
        s.chat('karen');
        return;
      }
      c.say(fill(pick(T.CUSTOMER_WRONG), { item: it.def.name, cat: slot.section.category.toLowerCase() }));
      s.hype += 10;
      s.chat('customerWrong', { item: it.def.name });
    } else if (Math.random() < 0.2) {
      c.say(pick(T.CUSTOMER_NORMAL));
    }
  }

  private onKnockOff(c: Customer, slot: Slot): void {
    const s = this.s;
    const it = slot.item;
    if (!it || it.def.fixture) return;
    slot.item = null;
    it.slot = null;
    it.state = 'world';
    it.sleeping = false;
    it.knockedOff = true;
    it.vel.set(rand(-1.5, 1.5), rand(2, 3.5), rand(2.5, 4));
    this.c.knockedOff++;
    s.sfx.thud();
    if (Math.random() < 0.5) c.say(pick(T.TODDLER_LINES), 2.5);
    if (Math.random() < 0.3) s.chat('toddler');
    s.hype += 2;
  }

  private onVacuumItem(c: Customer, it: Item): void {
    const s = this.s;
    if (it.state !== 'world') return;
    s.removeItem(it);
    this.c.vacuumed++;
    s.sfx.whoosh();
    c.say(pick(T.ROOMBA_LINES), 2.5);
    s.chat('roomba');
    s.hype += 5;
    if (!it.knockedOff) s.achieve('insideJob');
  }

  private onVacuumPuddle(c: Customer, index: number): void {
    const s = this.s;
    if (!s.puddles[index]) return;
    s.removePuddle(index);
    s.sfx.whoosh();
    c.say(pick(T.ROOMBA_PUDDLE), 3);
    s.chat('roombaPuddle', {}, 2);
    s.hype += 8;
  }

  private onComplain(c: Customer): void {
    const s = this.s;
    this.c.complaints++;
    if (Math.random() < 0.3) s.chat('karen');
    if (s.boss.offline) return;
    const near = s.boss.horizontalDist(c.pos) < 9 || s.boss.horizontalDist(s.player.pos) < 9;
    if (near) {
      s.annoyance += 12;
      s.bossSay('customerComplaint');
    }
  }

  private onFilming(c: Customer, on: boolean): void {
    if (on) {
      this.filmers.add(c);
      this.s.chat('filming', {}, 2);
    } else this.filmers.delete(c);
  }
}

export const SHELVES_ENTRY: JobEntry = {
  id: 'shelves',
  title: 'Shelf Stacker',
  place: `${T.STORE_NAME} Hypermarket`,
  teaser: 'Shift 09:00 to 17:00 (about 5 minutes)',
  models: SHELVES_MODELS,
  create: (scene) => new ShelvesJob(scene),
};
