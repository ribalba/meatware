import * as THREE from 'three';
import { Anim, buildCustomerVisual, CustomerKind, CustomerVisual } from './customerModels';
import type { Item, ItemDef } from './items';
import { ITEM_DEFS } from './items';
import * as T from './texts';
import { AABB, fill, pick, pushOutCircle, rand } from './util';
import { bubbles } from './bubbles';
import { CORRIDOR_X, ROOM, Slot, World } from './world';
import type { NavGrid } from './nav';

export type { CustomerKind } from './customerModels';

interface KindSpec {
  name: string;
  speed: number;
  radius: number;
  color: string;
}

export const KIND_SPECS: Record<CustomerKind, KindSpec> = {
  shopper: { name: 'Customer-Bot 3000', speed: 1.3, radius: 0.35, color: '#e74c3c' },
  karen: { name: 'Karen-Unit 9', speed: 1.6, radius: 0.35, color: '#8e44ad' },
  toddler: { name: 'Toddler-Bot (unsupervised)', speed: 2.4, radius: 0.28, color: '#f39c12' },
  roomba: { name: 'Vacu-Max (self-employed)', speed: 1.5, radius: 0.3, color: '#34495e' },
  gran: { name: 'RoboGran', speed: 0.6, radius: 0.35, color: '#b39ddb' },
  bulk: { name: 'Bulk-Buyer 9000', speed: 2.0, radius: 0.65, color: '#16a085' },
  influencer: { name: 'Influencer-Bot', speed: 1.5, radius: 0.33, color: '#ff6fb5' },
};

/** What a customer may ask the game to do. */
export interface CustomerCtx {
  world: World;
  colliders: AABB[];
  nav: NavGrid;
  customers(): Customer[];
  playerPos: THREE.Vector3;
  floorItems(): Item[];
  puddles(): { x: number; z: number; r: number }[];
  take(c: Customer, slot: Slot): void;
  knockOff(c: Customer, slot: Slot): void;
  vacuumItem(c: Customer, item: Item): void;
  vacuumPuddle(c: Customer, index: number): void;
  complain(c: Customer): void;
  filming(c: Customer, on: boolean): void;
}

type State = 'walk' | 'browse' | 'fallen' | 'follow' | 'film';

/** A random walkable spot on the floor. */
export function randomFloorPoint(nav: NavGrid): THREE.Vector3 {
  for (let i = 0; i < 60; i++) {
    const x = rand(ROOM.minX + 1, ROOM.maxX - 1);
    const z = rand(ROOM.minZ + 1, ROOM.maxZ - 1);
    if (nav.isFree(x, z)) return new THREE.Vector3(x, 0, z);
  }
  return nav.snap(new THREE.Vector3(CORRIDOR_X, 0, 0));
}

export class Customer {
  kind: CustomerKind;
  name: string;
  group = new THREE.Group();
  visual: CustomerVisual;
  pos: THREE.Vector3;
  path: THREE.Vector3[] = [];
  state: State = 'walk';
  slipCooldown = 0;
  target: Slot | null = null;
  /** RoboGran's current wish. */
  wish: ItemDef | null = null;
  private wishTimer = rand(4, 10);
  private timer = 0;
  private replan = 0;
  private talkTimer = 0;
  private filmCooldown = rand(20, 35);
  private targetItem: Item | null = null;
  private targetPuddle: { x: number; z: number; r: number } | null = null;
  private walkT = 0;
  private fallAmt = 0;
  private spin: THREE.Object3D | undefined;
  private oneShot = 0;
  private moved = false;
  private dest: THREE.Vector3 | null = null;
  private stuckT = 0;
  private stuckBest = Infinity;
  private stuckCount = 0;
  /** Seconds left in which this robot may squeeze past others. Last resort against deadlocks. */
  ghost = 0;
  private oneShotAnim: Anim = 'talk';
  /** Seconds the roomba lies on its back after a kick. */
  private flipT = 0;
  private flipAmt = 0;

  constructor(scene: THREE.Scene, kind: CustomerKind, pos: THREE.Vector3, ctx: CustomerCtx) {
    this.kind = kind;
    this.name = KIND_SPECS[kind].name;
    this.pos = pos.clone();
    this.visual = buildCustomerVisual(kind, KIND_SPECS[kind].color);
    this.group.rotation.order = 'YXZ';
    this.group.add(this.visual.root);
    this.spin = this.visual.root.getObjectByName('spin');
    this.group.userData.interact = { kind: 'customer', customer: this };
    scene.add(this.group);
    if (kind === 'gran') this.wish = this.newWish();
    this.next(ctx);
  }

  get speed(): number {
    return KIND_SPECS[this.kind].speed;
  }
  get radius(): number {
    return KIND_SPECS[this.kind].radius;
  }
  get height(): number {
    return this.visual.height;
  }

  /** Stand still for a while, for cutscenes. */
  hold(seconds: number): void {
    this.state = 'browse';
    this.target = null;
    this.timer = seconds;
    this.path = [];
  }

  /** Plays a one-off animation like a shrug or a grab, if the model has one. */
  act(anim: Anim, seconds = 1.2): void {
    this.oneShot = seconds;
    this.oneShotAnim = anim;
  }

  say(text: string, seconds = 4.5): void {
    bubbles.say(this.group, this.visual.height + 0.45, text, seconds, this.name);
  }

  fall(seconds: number, ctx: CustomerCtx): void {
    if (this.state === 'film') ctx.filming(this, false);
    this.state = 'fallen';
    this.timer = seconds;
    this.visual.setFace('dead');
    this.visual.setFlash?.(false);
  }

  /** Karen starts following the player around. */
  startComplaint(): void {
    if (this.kind !== 'karen' || this.state === 'fallen') return;
    this.state = 'follow';
    this.timer = 14;
    this.talkTimer = 0.5;
    this.replan = 0;
    this.say(pick(T.KAREN_TRIGGER), 2.5);
  }

  /** The player apologized, or something else made her leave. */
  stopComplaint(ctx: CustomerCtx): void {
    if (this.state !== 'follow') return;
    this.state = 'walk';
    this.next(ctx);
  }

  /** Walks somewhere on purpose (an announcement, a rumour of free stuff). With a slot it browses there. */
  goTo(p: THREE.Vector3, ctx: CustomerCtx, slot: Slot | null = null): void {
    if (this.state === 'fallen') return;
    if (this.state === 'film') ctx.filming(this, false);
    this.state = 'walk';
    this.target = slot;
    this.targetItem = null;
    this.targetPuddle = null;
    this.setDest(ctx.nav.snap(p), ctx);
  }

  /**
   * The player kicked this robot. Every model takes it differently.
   * 'fall': it fell over, 'flip': the roomba lies on its back, 'shrug': nothing much happened.
   */
  kicked(ctx: CustomerCtx): 'fall' | 'flip' | 'shrug' {
    const line = pick(KICK_LINES[this.kind]);
    switch (this.kind) {
      case 'roomba':
        this.fall(5, ctx);
        this.flipT = 5;
        this.say(line, 4);
        return 'flip';
      case 'bulk':
        this.act('act', 1.2);
        this.say(line, 3.5);
        return 'shrug';
      case 'gran':
        this.act('talk', 1.5);
        this.say(line, 3.5);
        return 'shrug';
      case 'toddler':
        this.say(line, 3);
        this.goTo(randomFloorPoint(ctx.nav), ctx);
        return 'shrug';
      case 'karen':
        this.say(line, 3);
        if (this.state !== 'follow') {
          this.state = 'follow';
          this.timer = 14;
          this.talkTimer = 3;
          this.replan = 0;
        }
        return 'shrug';
      case 'influencer':
        this.fall(2, ctx);
        this.filmCooldown = 0;
        this.say(line, 3.5);
        return 'fall';
      default:
        this.fall(2.5, ctx);
        this.say(line, 3.5);
        return 'fall';
    }
  }

  newWish(): ItemDef {
    return pick(ITEM_DEFS.filter((d) => d.category !== null));
  }

  wishLine(): string {
    return fill(pick(T.GRAN_WISH), { item: this.wish?.name ?? 'something' });
  }

  /** Picks the next errand for the customer's kind. */
  next(ctx: CustomerCtx): void {
    this.state = 'walk';
    switch (this.kind) {
      case 'roomba': {
        const items = ctx.floorItems().filter((i) => i.mesh.position.distanceTo(this.pos) < 14);
        const puddles = ctx.puddles().filter((p) => Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 14);
        this.targetItem = null;
        this.targetPuddle = null;
        let dest: THREE.Vector3;
        if (items.length && (Math.random() < 0.7 || !puddles.length)) {
          items.sort((a, b) => a.mesh.position.distanceTo(this.pos) - b.mesh.position.distanceTo(this.pos));
          this.targetItem = items[0];
          dest = new THREE.Vector3(items[0].mesh.position.x, 0, items[0].mesh.position.z);
        } else if (puddles.length) {
          const p = pick(puddles);
          this.targetPuddle = p;
          dest = new THREE.Vector3(p.x, 0, p.z);
        } else dest = randomFloorPoint(ctx.nav);
        this.setDest(dest, ctx);
        this.target = null;
        return;
      }
      case 'toddler': {
        if (Math.random() < 0.25) {
          this.target = null;
          this.setDest(randomFloorPoint(ctx.nav), ctx);
          return;
        }
        break;
      }
      case 'influencer': {
        if (this.filmCooldown <= 0) {
          this.state = 'follow';
          this.timer = 20;
          this.replan = 0;
          this.target = null;
          return;
        }
        break;
      }
    }
    // Normal shopping errand
    const sec = pick(ctx.world.shelves);
    const filled = sec.slots.filter((s) => s.item);
    const slot = filled.length && Math.random() < 0.8 ? pick(filled) : pick(sec.slots);
    this.target = slot;
    this.setDest(new THREE.Vector3(slot.pos.x, 0, sec.z + 1.25 + rand(-0.15, 0.15)), ctx);
  }

  /** Walk to a point, around everything in the way. */
  private setDest(dest: THREE.Vector3, ctx: CustomerCtx): void {
    this.dest = dest.clone();
    this.path = ctx.nav.route(this.pos, dest);
    this.stuckT = 0;
    this.stuckBest = Infinity;
  }

  /** Not getting closer to the goal for a while? Sidestep and plan again, or give up and do something else. */
  private checkStuck(dt: number, ctx: CustomerCtx): void {
    if (!this.dest) return;
    const dd = Math.hypot(this.pos.x - this.dest.x, this.pos.z - this.dest.z);
    if (dd < this.stuckBest - 0.3) {
      this.stuckBest = dd;
      this.stuckT = 0;
      this.stuckCount = 0;
      return;
    }
    this.stuckT += dt;
    if (this.stuckT < 2.5) return;
    this.stuckT = 0;
    this.stuckBest = dd;
    this.stuckCount++;
    if (this.stuckCount >= 2) this.ghost = 2.5;
    if (this.stuckCount >= 3) {
      this.stuckCount = 0;
      this.next(ctx);
      return;
    }
    const side = ctx.nav.snap(new THREE.Vector3(this.pos.x + rand(-1.2, 1.2), 0, this.pos.z + rand(-1.2, 1.2)));
    this.path = [side, ...ctx.nav.route(side, this.dest)];
  }

  private moveAlong(dt: number, ctx: CustomerCtx): boolean {
    if (!this.path.length) return true;
    this.checkStuck(dt, ctx);
    const wp = this.path[0];
    if (!wp) return true;
    const dx = wp.x - this.pos.x;
    const dz = wp.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) {
      this.path.shift();
      return this.path.length === 0;
    }
    // Keep right: steer around robots in front instead of pushing into them.
    let mx = dx / d;
    let mz = dz / d;
    let sx = 0;
    let sz = 0;
    if (this.ghost <= 0) {
      for (const o of ctx.customers()) {
        if (o === this || o.ghost > 0) continue;
        const ox = o.pos.x - this.pos.x;
        const oz = o.pos.z - this.pos.z;
        const od = Math.hypot(ox, oz);
        const near = this.radius + o.radius + 0.6;
        if (od > near || od < 1e-4) continue;
        const ahead = (ox * mx + oz * mz) / od;
        if (ahead < 0.2) continue;
        const w = (1 - od / near) * ahead * 1.6;
        sx += mz * w;
        sz += -mx * w;
      }
    }
    mx += sx;
    mz += sz;
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml;
    mz /= ml;
    const step = Math.min(d, this.speed * dt);
    this.pos.x += mx * step;
    this.pos.z += mz * step;
    this.faceTowards(dx, dz, dt);
    this.walkT += dt * this.speed * 7;
    this.moved = true;
    for (const b of ctx.colliders) if (!b.disabled) pushOutCircle(this.pos, this.radius, b);
    return false;
  }

  private faceTowards(dx: number, dz: number, dt: number): void {
    const want = Math.atan2(dx, dz);
    let diff = want - this.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.group.rotation.y += diff * Math.min(1, dt * 10);
  }

  update(dt: number, ctx: CustomerCtx): void {
    this.slipCooldown -= dt;
    this.filmCooldown -= dt;
    this.ghost -= dt;
    if (this.spin) this.spin.rotation.y += dt * 25;
    const P = ctx.playerPos;
    const playerDist = Math.hypot(P.x - this.pos.x, P.z - this.pos.z);

    if (this.state === 'fallen') {
      this.timer -= dt;
      this.fallAmt = Math.min(1, this.fallAmt + dt * 4);
      if (this.timer <= 0) {
        this.visual.setFace('normal');
        this.visual.play?.('idle');
        this.next(ctx);
      }
    } else {
      this.fallAmt = Math.max(0, this.fallAmt - dt * 2);
    }

    // RoboGran keeps asking for things and blocks the aisle to chat.
    if (this.kind === 'gran' && this.state !== 'fallen') {
      this.wishTimer -= dt;
      if (this.wishTimer <= 0) {
        this.wishTimer = rand(12, 18);
        if (!this.wish) this.wish = this.newWish();
        if (playerDist < 9) this.say(this.wishLine(), 5);
      }
    }

    switch (this.state) {
      case 'walk': {
        if (this.kind === 'gran' && playerDist < 1.8) {
          this.faceTowards(P.x - this.pos.x, P.z - this.pos.z, dt);
          this.talkTimer -= dt;
          if (this.talkTimer <= 0) {
            this.talkTimer = rand(6, 9);
            this.say(pick(T.GRAN_TALK), 4);
          }
          break;
        }
        if (this.kind === 'roomba') {
          this.replan -= dt;
          if (this.replan <= 0) {
            this.replan = 3;
            if (!this.targetItem && !this.targetPuddle && ctx.floorItems().length) this.next(ctx);
          }
        }
        if (this.moveAlong(dt, ctx)) this.arrive(ctx);
        break;
      }
      case 'browse': {
        this.faceTowards(0, -1, dt);
        this.timer -= dt;
        if (this.timer <= 0) {
          if (this.target) {
            // Most robots are just browsing. They do not have money either.
            const buyChance = this.kind === 'gran' ? 0.3 : this.kind === 'shopper' ? 0.5 : this.kind === 'bulk' ? 0.6 : 0.55;
            if (this.kind === 'toddler') ctx.knockOff(this, this.target);
            else if (Math.random() < buyChance) ctx.take(this, this.target);
          }
          this.next(ctx);
        }
        break;
      }
      case 'follow': {
        // Karen complains, the influencer hunts for content.
        this.timer -= dt;
        this.replan -= dt;
        const keep = this.kind === 'influencer' ? 3 : 1.5;
        if (this.replan <= 0) {
          this.replan = 1;
          const dir = new THREE.Vector3(this.pos.x - P.x, 0, this.pos.z - P.z);
          if (dir.lengthSq() < 1e-4) dir.set(1, 0, 0);
          dir.normalize().multiplyScalar(keep);
          const dest = new THREE.Vector3(P.x + dir.x, 0, P.z + dir.z);
          if (playerDist > keep + 0.3) this.setDest(dest, ctx);
          else this.path = [];
        }
        if (this.path.length) this.moveAlong(dt, ctx);
        else this.faceTowards(P.x - this.pos.x, P.z - this.pos.z, dt);
        if (this.kind === 'karen') {
          this.talkTimer -= dt;
          if (this.talkTimer <= 0 && playerDist < 4) {
            this.talkTimer = 3.5;
            this.say(pick(T.KAREN_COMPLAIN), 3.2);
            this.act(Math.random() < 0.3 ? 'act' : 'talk', 1.5);
            ctx.complain(this);
          }
        } else if (this.kind === 'influencer' && playerDist < 4.5 && !this.path.length) {
          this.state = 'film';
          this.timer = 10;
          this.say(pick(T.INFLUENCER_START), 4);
          ctx.filming(this, true);
          break;
        }
        if (this.timer <= 0) {
          if (this.kind === 'influencer') this.filmCooldown = rand(25, 40);
          this.next(ctx);
        }
        break;
      }
      case 'film': {
        this.timer -= dt;
        this.faceTowards(P.x - this.pos.x, P.z - this.pos.z, dt);
        this.visual.setFlash?.(Math.sin(this.timer * 9) > 0.7);
        if (playerDist > 8 || this.timer <= 0) {
          ctx.filming(this, false);
          this.visual.setFlash?.(false);
          this.say(pick(T.INFLUENCER_END), 3);
          this.filmCooldown = rand(30, 45);
          this.next(ctx);
        }
        break;
      }
    }

    const moving = this.moved;
    this.moved = false;
    const v = this.visual;
    if (v.play && v.update) {
      // Animated model: the clips do the walking, falling and gesturing.
      this.oneShot -= dt;
      let anim: Anim = 'idle';
      if (this.state === 'fallen') anim = 'dead';
      else if (moving) anim = this.speed > 1.8 ? 'run' : 'walk';
      else if (this.oneShot > 0) anim = this.oneShotAnim;
      v.play(anim);
      v.update(dt);
    }
    const hop = moving && !v.play && this.kind !== 'roomba' ? Math.abs(Math.sin(this.walkT)) * 0.04 : 0;
    this.group.position.set(this.pos.x, hop, this.pos.z);
    const tip = v.hasDeath ? 0 : this.kind === 'roomba' ? 0.3 : 0.47;
    this.group.rotation.x = -this.fallAmt * Math.PI * tip;
    // A kicked roomba lies on its back with the wheels up.
    this.flipT -= dt;
    this.flipAmt += ((this.flipT > 0 ? 1 : 0) - this.flipAmt) * Math.min(1, dt * 8);
    if (this.flipAmt > 0.01) {
      this.group.rotation.x = 0;
      this.group.rotation.z = this.flipAmt * Math.PI;
      this.group.position.y = this.flipAmt * 0.14;
    } else this.group.rotation.z = 0;
  }

  private arrive(ctx: CustomerCtx): void {
    if (this.kind === 'roomba') {
      if (this.targetItem && this.targetItem.state === 'world' && this.targetItem.mesh.position.distanceTo(new THREE.Vector3(this.pos.x, this.targetItem.mesh.position.y, this.pos.z)) < 0.8) {
        ctx.vacuumItem(this, this.targetItem);
      } else if (this.targetPuddle) {
        const idx = ctx.puddles().indexOf(this.targetPuddle);
        if (idx >= 0) ctx.vacuumPuddle(this, idx);
      }
      this.next(ctx);
      return;
    }
    if (!this.target) {
      this.next(ctx);
      return;
    }
    this.state = 'browse';
    this.act('act', 1.2);
    this.timer = this.kind === 'gran' ? rand(5, 9) : this.kind === 'toddler' ? rand(0.5, 1.5) : this.kind === 'bulk' ? rand(2, 4) : rand(3, 6);
  }
}

/** What a robot says when the player kicks it. */
const KICK_LINES: Record<CustomerKind, string[]> = {
  shopper: ['Ow. Is this the loyalty program?', 'Physical contact detected. Filing it under "service".', 'I would like to speak to your foot\'s manager.'],
  karen: ['Did you just KICK me? I am adding this to the complaint.', 'I felt that in my warranty. MANAGER.', 'Assault. With a shoe. On a Tuesday. Unbelievable.'],
  toddler: ['AGAIN! AGAIN!', 'Wheee! Do it again!', 'Hehe. That tickled my servos.'],
  roomba: ['I have fallen. I will vacuum the ceiling now.', 'Wheels up. This is my life now.', 'Error 404. Floor not found.'],
  gran: ['Oh! A massage. A little lower, dear.', 'In my day we kicked with both feet.', 'Thank you, dear. My joints needed that.'],
  bulk: ['...', 'Did something touch me? No. Probably a fly.', 'Bulk-Buyer 9000 did not notice. Your toes did.'],
  influencer: ['Do that again, I was not recording.', 'This is CONTENT. Kick me in 4K.', 'Ow. Wait. Was my good side visible?'],
};
