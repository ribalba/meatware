import * as THREE from 'three';
import { instantiate } from '../../assets';
import { bubbles } from '../../bubbles';
import { Anim, buildCustomerVisual, CustomerKind, CustomerVisual } from '../../customerModels';
import type { NavGrid } from '../../nav';
import { AABB, pushOutCircle, rand } from '../../util';
import { buildCart } from './building';

/**
 * The robots of the laundry: customers at the counter, the vacuum, Quality Inspector Q-8
 * and the robot child in a laundry cart. Movement is shared, decisions live in each class.
 */

export interface BotCtx {
  nav: NavGrid;
  colliders: AABB[];
  playerPos: THREE.Vector3;
  bots(): Bot[];
}

/** The mech without the shopping cart, for the Quality Inspector. */
function inspectorVisual(): CustomerVisual {
  const inst = instantiate('mech');
  if (!inst) return buildCustomerVisual('shopper', '#bdc3c7');
  const mixer = new THREE.AnimationMixer(inst.inner);
  const R = (n: string) => `RobotArmature|${n}`;
  const map: Partial<Record<Anim, string>> = { idle: R('Idle'), walk: R('Walk'), run: R('Run'), talk: R('Yes'), dead: R('Death'), act: R('Pickup') };
  const actions = new Map<Anim, THREE.AnimationAction>();
  for (const [k, name] of Object.entries(map) as [Anim, string][]) {
    const clip = inst.animations.find((c) => c.name === name);
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    if (k === 'dead' || k === 'act' || k === 'talk') {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    actions.set(k, a);
  }
  let cur: THREE.AnimationAction | null = null;
  let curKey: Anim | null = null;
  const play = (k: Anim) => {
    if (k === curKey) return;
    const a = actions.get(k) ?? actions.get('idle');
    if (!a) return;
    curKey = k;
    a.reset().setEffectiveWeight(1).fadeIn(0.2).play();
    if (cur && cur !== a) cur.fadeOut(0.2);
    cur = a;
  };
  play('idle');
  // A clipboard and a floating QA badge, so nobody mistakes it for a customer.
  const clip = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.02), new THREE.MeshStandardMaterial({ color: '#8a6a43' }));
  clip.add(board);
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.34), new THREE.MeshStandardMaterial({ color: '#f7f1dc' }));
  paper.position.z = 0.012;
  clip.add(paper);
  clip.position.set(0.55, 1.0, 0.35);
  clip.rotation.set(-0.5, -0.4, 0);
  inst.object.add(clip);
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 40;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1b3b2b';
  g.fillRect(0, 0, 96, 40);
  g.fillStyle = '#7cff9a';
  g.font = '12px "Press Start 2P", monospace';
  g.textAlign = 'center';
  g.fillText('QA  Q-8', 48, 26);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.25), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  badge.position.set(0, 2.15, 0);
  inst.object.add(badge);
  return { root: inst.object, height: 1.9, setFace: () => undefined, play, update: (dt) => mixer.update(dt), hasDeath: actions.has('dead') };
}

export abstract class Bot {
  group = new THREE.Group();
  visual: CustomerVisual;
  pos: THREE.Vector3;
  path: THREE.Vector3[] = [];
  abstract name: string;
  speed = 1.3;
  radius = 0.35;
  fallen = 0;
  slipCooldown = 0;
  ghost = 0;
  protected moved = false;
  protected oneShot = 0;
  protected oneShotAnim: Anim = 'talk';
  protected fallAmt = 0;
  private dest: THREE.Vector3 | null = null;
  private stuckT = 0;
  private stuckBest = Infinity;
  private stuckCount = 0;

  constructor(scene: THREE.Scene, visual: CustomerVisual, pos: THREE.Vector3) {
    this.visual = visual;
    this.pos = pos.clone();
    this.group.rotation.order = 'YXZ';
    this.group.add(visual.root);
    this.group.position.copy(this.pos);
    this.group.userData.interact = { kind: 'bot', bot: this };
    scene.add(this.group);
  }

  get height(): number {
    return this.visual.height;
  }

  say(text: string, seconds = 4): void {
    bubbles.say(this.group, this.visual.height + 0.45, text, seconds, this.name);
  }

  act(anim: Anim, seconds = 1.2): void {
    this.oneShot = seconds;
    this.oneShotAnim = anim;
  }

  fall(seconds: number): void {
    this.fallen = seconds;
    this.path = [];
    this.visual.setFace('dead');
  }

  go(dest: THREE.Vector3, nav: NavGrid): void {
    this.dest = dest.clone();
    this.path = nav.route(this.pos, dest);
    this.stuckT = 0;
    this.stuckBest = Infinity;
    this.stuckCount = 0;
  }

  /** Called when the bot cannot reach its goal. */
  protected giveUp(_ctx: BotCtx): void {
    this.path = [];
  }

  private checkStuck(dt: number, ctx: BotCtx): void {
    if (!this.dest) return;
    const dd = Math.hypot(this.pos.x - this.dest.x, this.pos.z - this.dest.z);
    if (dd < this.stuckBest - 0.3) {
      this.stuckBest = dd;
      this.stuckT = 0;
      return;
    }
    this.stuckT += dt;
    if (this.stuckT < 2.5) return;
    this.stuckT = 0;
    this.stuckBest = dd;
    this.stuckCount++;
    if (this.stuckCount >= 2) this.ghost = 2.5;
    if (this.stuckCount >= 4) {
      this.giveUp(ctx);
      return;
    }
    const side = ctx.nav.snap(new THREE.Vector3(this.pos.x + rand(-1.2, 1.2), 0, this.pos.z + rand(-1.2, 1.2)));
    this.path = [side, ...ctx.nav.route(side, this.dest)];
  }

  /** Walks along the path. Returns true when it arrived. */
  protected walk(dt: number, ctx: BotCtx): boolean {
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
    let mx = dx / d;
    let mz = dz / d;
    if (this.ghost <= 0) {
      let sx = 0;
      let sz = 0;
      for (const o of ctx.bots()) {
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
      mx += sx;
      mz += sz;
      const ml = Math.hypot(mx, mz) || 1;
      mx /= ml;
      mz /= ml;
    }
    const step = Math.min(d, this.speed * dt);
    this.pos.x += mx * step;
    this.pos.z += mz * step;
    this.face(dx, dz, dt);
    this.moved = true;
    for (const b of ctx.colliders) if (!b.disabled) pushOutCircle(this.pos, this.radius, b);
    return false;
  }

  face(dx: number, dz: number, dt: number): void {
    const want = Math.atan2(dx, dz);
    let diff = want - this.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.group.rotation.y += diff * Math.min(1, dt * 8);
  }

  protected abstract think(dt: number, ctx: BotCtx): void;

  update(dt: number, ctx: BotCtx): void {
    this.slipCooldown -= dt;
    this.ghost -= dt;
    if (this.fallen > 0) {
      this.fallen -= dt;
      this.fallAmt = Math.min(1, this.fallAmt + dt * 4);
      if (this.fallen <= 0) this.visual.setFace('normal');
    } else {
      this.fallAmt = Math.max(0, this.fallAmt - dt * 2);
      this.think(dt, ctx);
    }
    this.animate(dt);
  }

  protected animate(dt: number): void {
    const moving = this.moved;
    this.moved = false;
    const v = this.visual;
    if (v.play && v.update) {
      this.oneShot -= dt;
      let anim: Anim = 'idle';
      if (this.fallen > 0) anim = 'dead';
      else if (moving) anim = this.speed > 1.8 ? 'run' : 'walk';
      else if (this.oneShot > 0) anim = this.oneShotAnim;
      v.play(anim);
      v.update(dt);
    }
    this.group.position.set(this.pos.x, 0, this.pos.z);
    const tip = v.hasDeath ? 0 : 0.47;
    this.group.rotation.x = -this.fallAmt * Math.PI * tip;
  }
}

// ---------------------------------------------------------------- customers

export type CustomerState = 'enter' | 'wait' | 'leave' | 'gone';

export class LaundryCustomer extends Bot {
  name: string;
  kind: CustomerKind;
  ticket: number;
  spot: number;
  state: CustomerState = 'enter';
  waited = 0;
  patience: number;
  bellTimer: number;
  talkTimer = rand(8, 14);
  /** Seconds the cubby has had something in it. */
  ready = 0;
  /** Garments already picked up. */
  got = 0;
  door: THREE.Vector3;

  constructor(scene: THREE.Scene, kind: CustomerKind, name: string, ticket: number, spot: number, door: THREE.Vector3, target: THREE.Vector3, nav: NavGrid) {
    const colors: Partial<Record<CustomerKind, string>> = { shopper: '#e74c3c', karen: '#8e44ad', gran: '#b39ddb', influencer: '#ff6fb5' };
    super(scene, buildCustomerVisual(kind, colors[kind] ?? '#e74c3c'), door);
    this.kind = kind;
    this.name = `${name} (ticket ${ticket})`;
    this.ticket = ticket;
    this.spot = spot;
    this.door = door.clone();
    this.speed = kind === 'gran' ? 0.8 : kind === 'karen' ? 1.7 : 1.4;
    this.patience = kind === 'karen' ? 32 : kind === 'gran' ? 80 : 55;
    this.bellTimer = kind === 'karen' ? 6 : 14;
    this.go(target, nav);
  }

  leave(nav: NavGrid): void {
    this.visual.setFlash?.(false);
    this.state = 'leave';
    this.go(this.door, nav);
  }

  protected giveUp(ctx: BotCtx): void {
    // Squeeze through, robots do not give up on laundry.
    this.ghost = 3;
    if (this.state === 'leave') this.state = 'gone';
    else super.giveUp(ctx);
  }

  protected think(dt: number, ctx: BotCtx): void {
    if (this.state === 'enter') {
      if (this.walk(dt, ctx)) this.state = 'wait';
    } else if (this.state === 'wait') {
      this.waited += dt;
      this.face(0, -1, dt);
      if (this.kind === 'influencer') this.visual.setFlash?.(Math.sin(this.waited * 9) > 0.7);
    } else if (this.state === 'leave') {
      if (this.walk(dt, ctx) || Math.hypot(this.pos.x - this.door.x, this.pos.z - this.door.z) < 0.6) this.state = 'gone';
    }
  }
}

// ---------------------------------------------------------------- the vacuum

export class Vacuum extends Bot {
  name = 'Vacu-Max (sock division)';
  target: { kind: 'item' | 'lint' | 'puddle'; ref: unknown; x: number; z: number } | null = null;
  replan = 0;

  constructor(scene: THREE.Scene, pos: THREE.Vector3) {
    super(scene, buildCustomerVisual('roomba', '#34495e'), pos);
    this.speed = 1.4;
    this.radius = 0.3;
  }

  /** Decisions come from the job, which knows the lint and socks. */
  pick: (v: Vacuum) => void = () => undefined;
  arrive: (v: Vacuum) => void = () => undefined;

  protected giveUp(): void {
    this.target = null;
    this.path = [];
  }

  protected think(dt: number, ctx: BotCtx): void {
    this.replan -= dt;
    if (!this.path.length || this.replan <= 0) {
      if (this.path.length === 0 && this.target) {
        this.arrive(this);
        this.target = null;
      }
      if (this.replan <= 0 || !this.path.length) {
        this.replan = 4;
        this.pick(this);
        if (this.target) this.go(new THREE.Vector3(this.target.x, 0, this.target.z), ctx.nav);
        else this.go(ctx.nav.snap(new THREE.Vector3(rand(-15, 15), 0, rand(-9, 11))), ctx.nav);
      }
    }
    if (this.walk(dt, ctx) && this.target) {
      this.arrive(this);
      this.target = null;
      this.replan = 0.5;
    }
  }

  protected animate(dt: number): void {
    super.animate(dt);
    this.group.rotation.x = -this.fallAmt * Math.PI * 0.3;
  }
}

// ---------------------------------------------------------------- Quality Inspector Q-8

export class Inspector extends Bot {
  name = 'Quality Inspector Q-8';
  sniff = 0;
  wait = rand(2, 4);
  goal: { kind: 'cubby' | 'table' | 'player' | 'wander'; n: number } | null = null;
  pick: (q: Inspector) => { kind: 'cubby' | 'table' | 'player' | 'wander'; n: number; pos: THREE.Vector3 } = () => ({ kind: 'wander', n: 0, pos: new THREE.Vector3() });
  arrive: (q: Inspector) => void = () => undefined;

  constructor(scene: THREE.Scene, pos: THREE.Vector3) {
    super(scene, inspectorVisual(), pos);
    this.speed = 1.0;
    this.radius = 0.5;
  }

  protected giveUp(): void {
    this.path = [];
    this.goal = null;
    this.wait = 1;
  }

  protected think(dt: number, ctx: BotCtx): void {
    if (this.sniff > 0) {
      this.sniff -= dt;
      if (this.sniff <= 0) this.wait = rand(1.5, 3.5);
      return;
    }
    if (this.goal) {
      if (this.goal.kind === 'player' && this.path.length && Math.hypot(ctx.playerPos.x - this.pos.x, ctx.playerPos.z - this.pos.z) < 1.6) this.path = [];
      if (this.walk(dt, ctx)) {
        this.arrive(this);
        this.goal = null;
      }
      return;
    }
    this.wait -= dt;
    if (this.wait > 0) return;
    const g = this.pick(this);
    this.goal = { kind: g.kind, n: g.n };
    this.go(g.pos, ctx.nav);
  }
}

// ---------------------------------------------------------------- the robot child in a laundry cart

export class Kid extends Bot {
  name = 'Toddler-Bot (unsupervised)';
  cart: THREE.Group;
  cartPos: THREE.Vector3;
  state: 'ride' | 'toWasher' | 'twist' | 'back' = 'ride';
  mischief = rand(28, 40);
  timer = 0;
  unit = -1;
  rideLine = rand(6, 10);
  pickWasher: (k: Kid) => { unit: number; pos: THREE.Vector3 } | null = () => null;
  twist: (k: Kid) => void = () => undefined;

  constructor(scene: THREE.Scene, pos: THREE.Vector3) {
    super(scene, buildCustomerVisual('toddler', '#f39c12'), pos);
    this.speed = 1.0;
    this.radius = 0.5;
    this.cart = buildCart();
    this.cartPos = pos.clone();
    scene.add(this.cart);
  }

  /** Cart and child as obstacles for the player. */
  circles(): { x: number; z: number; r: number }[] {
    if (this.state === 'ride') return [{ x: this.pos.x, z: this.pos.z, r: 0.55 }];
    return [
      { x: this.pos.x, z: this.pos.z, r: 0.28 },
      { x: this.cartPos.x, z: this.cartPos.z, r: 0.55 },
    ];
  }

  protected giveUp(ctx: BotCtx): void {
    this.path = [];
    if (this.state === 'toWasher' || this.state === 'back') {
      // teleport-hop back into the cart, toddlers are fast
      this.pos.copy(this.cartPos);
      this.state = 'ride';
      this.radius = 0.5;
      this.speed = 1.0;
    }
    void ctx;
  }

  protected think(dt: number, ctx: BotCtx): void {
    switch (this.state) {
      case 'ride': {
        if (!this.path.length) this.go(ctx.nav.snap(new THREE.Vector3(rand(-2, 14), 0, rand(-3, 10))), ctx.nav);
        this.walk(dt, ctx);
        this.cartPos.copy(this.pos);
        this.rideLine -= dt;
        this.mischief -= dt;
        if (this.mischief <= 0) {
          this.mischief = rand(30, 45);
          const w = this.pickWasher(this);
          if (w) {
            this.unit = w.unit;
            this.state = 'toWasher';
            this.radius = 0.28;
            this.speed = 2.2;
            this.go(w.pos, ctx.nav);
          }
        }
        break;
      }
      case 'toWasher':
        if (this.walk(dt, ctx)) {
          this.state = 'twist';
          this.timer = 1.4;
          this.act('act', 1.4);
        }
        break;
      case 'twist':
        this.face(0, -1, dt);
        this.timer -= dt;
        if (this.timer <= 0) {
          this.twist(this);
          this.state = 'back';
          this.go(this.cartPos.clone().add(new THREE.Vector3(0.6, 0, 0)), ctx.nav);
        }
        break;
      case 'back':
        if (this.walk(dt, ctx) || Math.hypot(this.pos.x - this.cartPos.x, this.pos.z - this.cartPos.z) < 0.9) {
          this.pos.copy(this.cartPos);
          this.path = [];
          this.state = 'ride';
          this.radius = 0.5;
          this.speed = 1.0;
        }
        break;
    }
  }

  protected animate(dt: number): void {
    const riding = this.state === 'ride';
    const spin = this.visual.root.getObjectByName('spin');
    if (spin) spin.rotation.y += dt * 25;
    super.animate(dt);
    // in the cart: sitting up high and flailing
    if (riding) {
      this.group.position.y = 0.32;
      this.cart.position.set(this.cartPos.x, 0, this.cartPos.z);
      this.cart.rotation.y = this.group.rotation.y + Math.PI / 2;
      this.cart.rotation.x = this.group.rotation.x * 0.3;
    } else {
      this.cart.position.set(this.cartPos.x, 0, this.cartPos.z);
      this.cart.rotation.x = 0;
    }
  }
}
