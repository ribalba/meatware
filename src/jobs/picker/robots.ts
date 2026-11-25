import * as THREE from 'three';
import { instantiate, ModelInstance } from '../../assets';
import { bubbles } from '../../bubbles';
import { buildCustomerVisual } from '../../customerModels';
import type { Interact } from '../../level';
import type { NavGrid } from '../../nav';
import { AABB, pick, pushOutCircle, rand, textTexture } from '../../util';
import type { Shift } from '../types';
import { AISLE_X, bayZ, HOPPER } from './layout';
import { COACH_NAME, PICKER_LINES, PICKER_NAMES, PICKER_SHOVE, PICKER_SLIP, COACH_REBOOT, FORKLIFT_LINES } from './lines';

/**
 * The robot coworkers of Fulfillment Center 4:
 * - forklift robots drive fixed routes, honk at humans and knock them over,
 * - the Rate Coach follows the player with a stopwatch and shouts the rate,
 * - PICK-O-TRON picker robots are absurdly fast and tell you about it.
 */

type Anim = 'idle' | 'walk' | 'run' | 'talk' | 'dead' | 'act';

interface Visual {
  root: THREE.Object3D;
  height: number;
  play(a: Anim): void;
  update(dt: number): void;
}

/** Mixer with our animation names mapped to clip names. */
function rig(inst: ModelInstance, map: Partial<Record<Anim, string>>): Pick<Visual, 'play' | 'update'> {
  const mixer = new THREE.AnimationMixer(inst.inner);
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
  let current: THREE.AnimationAction | null = null;
  let key: Anim | null = null;
  const play = (k: Anim) => {
    if (k === key) return;
    const a = actions.get(k) ?? actions.get('idle');
    if (!a) return;
    key = k;
    a.reset().setEffectiveWeight(1).fadeIn(0.15).play();
    if (current && current !== a) current.fadeOut(0.15);
    current = a;
  };
  play('idle');
  mixer.update(Math.random() * 2);
  return { play, update: (dt) => mixer.update(dt) };
}

function tint(inst: ModelInstance, colors: Record<string, string>): void {
  inst.object.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const fix = (mat: THREE.Material) => {
      const c = mat.clone() as THREE.MeshStandardMaterial;
      const col = colors[mat.name];
      if (col) c.color.set(col);
      return c;
    };
    m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material);
  });
}

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3, ...extra });

function fallback(kind: 'toddler' | 'shopper', color: string): Visual {
  const v = buildCustomerVisual(kind, color);
  return { root: v.root, height: v.height, play: (a) => v.play?.(a), update: (dt) => v.update?.(dt) };
}

function stopwatch(): { group: THREE.Group; hand: THREE.Mesh } {
  const g = new THREE.Group();
  const face = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.04, 16),
    [std('#c9cdd1', { metalness: 0.8 }), new THREE.MeshBasicMaterial({ map: textTexture(['', ''], { w: 64, h: 64, bg: '#f2ead2', border: '#111111' }) }), std('#c9cdd1', { metalness: 0.8 })],
  );
  face.rotation.x = Math.PI / 2;
  g.add(face);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 8), std('#c9cdd1', { metalness: 0.8 }));
  knob.position.y = 0.16;
  g.add(knob);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.01), std('#c0392b'));
  hand.geometry.translate(0, 0.045, 0);
  hand.position.z = 0.025;
  g.add(hand);
  return { group: g, hand };
}

function coachVisual(): Visual & { hand: THREE.Mesh; watch: THREE.Object3D } {
  const sw = stopwatch();
  const inst = instantiate('robotSmall');
  if (inst) {
    tint(inst, { Main: '#2e86c1', Main2: '#1f5fa8' });
    sw.group.position.set(0.25, 1.05, 0.15);
    inst.object.add(sw.group);
    // a visor cap and a whistle
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.3), std('#f0c419', { metalness: 0 }));
    cap.position.set(0, 0.86, 0.12);
    inst.object.add(cap);
    return { root: inst.object, height: 1.0, hand: sw.hand, watch: sw.group, ...rig(inst, { idle: 'CharacterArmature|Idle', walk: 'CharacterArmature|Run', run: 'CharacterArmature|Run', talk: 'CharacterArmature|Jump', dead: 'CharacterArmature|Death', act: 'CharacterArmature|Attack' }) };
  }
  const v = fallback('toddler', '#2e86c1');
  sw.group.position.set(0.25, 1.15, 0.15);
  v.root.add(sw.group);
  return { ...v, hand: sw.hand, watch: sw.group };
}

function pickerVisual(color: string): Visual {
  const inst = instantiate('robotExpressive');
  const tote = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.34), [std('#1f5fa8'), std('#1f5fa8'), std('#1d1a17'), std('#1f5fa8'), std('#1f5fa8'), std('#1f5fa8')]);
  if (inst) {
    tint(inst, { Main: color });
    tote.position.set(0, 0.85, 0.32);
    inst.object.add(tote);
    // a smug little crown
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.1, 6, 1, true), std('#f0c419', { metalness: 0.8, side: THREE.DoubleSide }));
    crown.position.set(0, 1.62, 0);
    inst.object.add(crown);
    return { root: inst.object, height: 1.7, ...rig(inst, { idle: 'Idle', walk: 'Walking', run: 'Running', talk: 'Yes', dead: 'Death', act: 'ThumbsUp' }) };
  }
  const v = fallback('shopper', color);
  tote.position.set(0, 0.8, 0.35);
  v.root.add(tote);
  return v;
}

export interface RobotCtx {
  s: Shift;
  nav: NavGrid;
  colliders: AABB[];
  /** A forklift hit the player. */
  forkliftHit(f: Forklift): void;
  forkliftSkid(f: Forklift): void;
  /** What the Rate Coach should shout right now. */
  coachLine(): string;
  robotPick(): void;
  botSlip(b: PickerBot): void;
  /** Pushes the player around (m/s). */
  knock(vx: number, vz: number): void;
  playerInBooth(): boolean;
  doorFront: THREE.Vector3;
}

/** Walks along nav waypoints. */
class Walker {
  pos: THREE.Vector3;
  path: THREE.Vector3[] = [];
  yaw = 0;
  constructor(p: THREE.Vector3) {
    this.pos = p.clone();
  }
  /** Moves towards the next waypoint. Returns true when the path is done. */
  step(dt: number, speed: number, colliders: AABB[], r: number): boolean {
    let left = speed * dt;
    while (left > 0 && this.path.length) {
      const t = this.path[0];
      const dx = t.x - this.pos.x;
      const dz = t.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) {
        this.path.shift();
        continue;
      }
      const s = Math.min(d, left);
      this.pos.x += (dx / d) * s;
      this.pos.z += (dz / d) * s;
      left -= s;
      const want = Math.atan2(dx, dz);
      let dy = want - this.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * Math.min(1, dt * 10);
      if (s >= d) this.path.shift();
    }
    for (const b of colliders) if (!b.disabled) pushOutCircle(this.pos, r, b);
    return this.path.length === 0;
  }
  face(x: number, z: number, dt: number): void {
    const want = Math.atan2(x - this.pos.x, z - this.pos.z);
    let dy = want - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, dt * 6);
  }
}

// ================================================================ forklifts

export class Forklift {
  group = new THREE.Group();
  pos: THREE.Vector3;
  name: string;
  yaw: number;
  private a: THREE.Vector3;
  private b: THREE.Vector3;
  private toB = true;
  private state: 'drive' | 'turn' | 'wait' | 'skid' = 'drive';
  private timer = 0;
  private turnFrom = 0;
  private honkCd = 0;
  private hitCd = 0;
  private beepT = 0;
  private skidCd = 0;
  private skidDur = 1.4;
  private beacon: THREE.MeshStandardMaterial;
  private faceMat: THREE.MeshBasicMaterial;
  private faces: Record<string, THREE.Texture>;
  private spot: THREE.Mesh;
  speed = 0;
  readonly index: number;

  constructor(scene: THREE.Scene, index: number, a: THREE.Vector3, b: THREE.Vector3, color: string, name: string) {
    this.index = index;
    this.name = name;
    this.a = a.clone();
    this.b = b.clone();
    this.pos = a.clone();
    this.yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const g = this.group;
    const body = std(color, { metalness: 0.2, roughness: 0.6 });
    const dark = std('#222222', { roughness: 0.8 });
    const steel = std('#5d6b74', { metalness: 0.6 });
    const box = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      o.position.set(x, y, z);
      g.add(o);
      return o;
    };
    // chassis, counterweight, cage (forks point to +z)
    box(1.1, 0.55, 1.5, body, 0, 0.45, -0.1);
    box(1.1, 0.5, 0.35, dark, 0, 0.6, -0.95);
    box(1.0, 0.25, 0.9, std('#3a3632'), 0, 0.85, 0.0);
    for (const [x, z] of [[-0.48, 0.35], [0.48, 0.35], [-0.48, -0.6], [0.48, -0.6]]) box(0.05, 1.3, 0.05, steel, x, 1.45, z);
    box(1.06, 0.05, 1.05, steel, 0, 2.12, -0.12);
    for (const [x, z] of [[-0.5, 0.45], [0.5, 0.45], [-0.5, -0.65], [0.5, -0.65]]) {
      const w = box(0.18, 0.4, 0.4, dark, x, 0.2, z);
      void w;
    }
    // robot face screen where a driver would be
    this.faces = {
      happy: textTexture(['^_^'], { w: 128, h: 96, bg: '#0b1a2a', fg: '#55ffff', font: 'monospace' }),
      honk: textTexture(['>_<', 'HONK'], { w: 128, h: 96, bg: '#2a0b0b', fg: '#ff5555', font: 'monospace' }),
      dizzy: textTexture(['@_@'], { w: 128, h: 96, bg: '#2a1a0b', fg: '#ffcc55', font: 'monospace' }),
      ouch: textTexture(['O_o', 'OW'], { w: 128, h: 96, bg: '#2a0b20', fg: '#ff77cc', font: 'monospace' }),
      party: textTexture(['\\o/'], { w: 128, h: 96, bg: '#0b2a12', fg: '#7dff7d', font: 'monospace' }),
    };
    this.faceMat = new THREE.MeshBasicMaterial({ map: this.faces.happy });
    const head = box(0.5, 0.4, 0.35, std('#bdc3c7'), 0, 1.45, -0.25);
    void head;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), this.faceMat);
    screen.position.set(0, 1.45, -0.07);
    g.add(screen);
    // mast, carriage, forks and a load
    for (const x of [-0.35, 0.35]) box(0.08, 2.4, 0.1, steel, x, 1.2, 0.72);
    box(0.8, 0.08, 0.1, steel, 0, 2.35, 0.72);
    box(0.85, 0.35, 0.06, dark, 0, 0.45, 0.8);
    for (const x of [-0.25, 0.25]) box(0.12, 0.05, 1.0, steel, x, 0.3, 1.3);
    box(1.0, 0.13, 1.0, std('#8a6a43'), 0, 0.4, 1.3);
    const load = box(0.95, 0.5, 0.95, std('#d8d2c8', { roughness: 0.3 }), 0, 0.73, 1.3);
    void load;
    // beacon and hazard stripes
    this.beacon = new THREE.MeshStandardMaterial({ color: '#ff9a20', emissive: '#ff9a20', emissiveIntensity: 1 });
    box(0.14, 0.14, 0.14, this.beacon, 0, 2.22, -0.4);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshStandardMaterial({ map: textTexture([name], { w: 256, h: 64, bg: '#1a1410', fg: '#f0c419', font: '"Press Start 2P", monospace' }) }));
    tag.position.set(0.553, 0.5, -0.1);
    tag.rotation.y = Math.PI / 2;
    g.add(tag);
    const tag2 = tag.clone();
    tag2.position.x = -0.553;
    tag2.rotation.y = -Math.PI / 2;
    g.add(tag2);
    // the blue safety spot on the floor ahead
    this.spot = new THREE.Mesh(new THREE.CircleGeometry(0.35, 12), new THREE.MeshBasicMaterial({ color: '#3a7bff', transparent: true, opacity: 0.55, depthWrite: false }));
    this.spot.rotation.x = -Math.PI / 2;
    this.spot.position.set(0, 0.02, 3.4);
    g.add(this.spot);
    g.userData.interact = { kind: 'forklift', robot: this } satisfies Interact;
    scene.add(g);
    this.sync();
  }

  fwd(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  circles(): { x: number; z: number; r: number }[] {
    const f = this.fwd();
    return [
      { x: this.pos.x - f.x * 0.2, z: this.pos.z - f.z * 0.2, r: 0.75 },
      { x: this.pos.x + f.x * 1.15, z: this.pos.z + f.z * 1.15, r: 0.6 },
    ];
  }

  say(text: string, sec = 2.5): void {
    bubbles.say(this.group, 2.6, text, sec, this.name);
  }

  private sync(): void {
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = this.yaw;
  }

  /** Kicks taken from the human. */
  kicks = 0;

  /** The human kicked it. Shows a hurt face for a moment. */
  kicked(): number {
    this.kicks++;
    this.faceMat.map = this.faces.ouch;
    this.honkCd = Math.max(this.honkCd, 2.4);
    return this.kicks;
  }

  /** A little donut, for the button or for joy. */
  spin(sec = 1.4): void {
    if (this.state === 'skid') return;
    this.state = 'skid';
    this.timer = sec;
    this.skidDur = sec;
    this.turnFrom = this.yaw;
    this.faceMat.map = this.faces.party;
    this.honkCd = Math.max(this.honkCd, sec + 1);
  }

  private honk(s: Shift, d: number): void {
    const v = 0.12 * Math.max(0.15, 1 - d / 22);
    s.sfx.tone(311, 0.16, 'square', v);
    s.sfx.tone(262, 0.28, 'square', v, undefined, 0.18);
    this.faceMat.map = this.faces.honk;
  }

  update(dt: number, ctx: RobotCtx, all: Forklift[], t: number): void {
    const s = ctx.s;
    const P = s.player.pos;
    this.honkCd -= dt;
    this.hitCd -= dt;
    this.skidCd -= dt;
    this.beacon.emissiveIntensity = Math.sin(t * 8 + this.index) > 0 ? 2 : 0.2;
    const f = this.fwd();
    const dx = P.x - this.pos.x;
    const dz = P.z - this.pos.z;
    const ahead = dx * f.x + dz * f.z;
    const lateral = Math.abs(dx * f.z - dz * f.x);
    const dist = Math.hypot(dx, dz);
    const danger = ahead > 0 && ahead < 7 && lateral < 1.4;

    if (this.honkCd < 1.5) this.faceMat.map = this.state === 'skid' ? (this.faceMat.map === this.faces.party ? this.faces.party : this.faces.dizzy) : this.faces.happy;

    switch (this.state) {
      case 'drive': {
        const target = this.toB ? this.b : this.a;
        // lower numbers have the right of way
        const blocked = all.some((o) => {
          if (o === this || o.index > this.index) return false;
          const ox = o.pos.x - this.pos.x;
          const oz = o.pos.z - this.pos.z;
          return Math.hypot(ox, oz) < 3.6 && ox * f.x + oz * f.z > 0.5;
        });
        const want = blocked ? 0 : danger ? 1.1 : 2.3;
        this.speed += (want - this.speed) * Math.min(1, dt * 2.5);
        if (danger && this.honkCd <= 0) {
          this.honkCd = 2.6;
          this.honk(s, dist);
          if (Math.random() < 0.35) this.say(pick(FORKLIFT_LINES), 2.2);
          if (Math.random() < 0.3) s.chat('honk');
        }
        const tx = target.x - this.pos.x;
        const tz = target.z - this.pos.z;
        const td = Math.hypot(tx, tz);
        const st = Math.min(td, this.speed * dt);
        if (td > 0.01) {
          this.pos.x += (tx / td) * st;
          this.pos.z += (tz / td) * st;
        }
        if (td < 0.05) {
          this.state = 'wait';
          this.timer = 1.2;
          this.speed = 0;
        }
        // puddles make forklifts spin
        if (this.skidCd <= 0) {
          for (const pd of s.puddles) {
            if (Math.hypot(pd.x - this.pos.x, pd.z - this.pos.z) < pd.r + 0.3) {
              this.state = 'skid';
              this.timer = 1.4;
              this.skidDur = 1.4;
              this.turnFrom = this.yaw;
              this.skidCd = 8;
              this.faceMat.map = this.faces.dizzy;
              ctx.forkliftSkid(this);
              break;
            }
          }
        }
        break;
      }
      case 'wait':
        this.timer -= dt;
        this.beepT -= dt;
        if (this.beepT <= 0 && dist < 18) {
          this.beepT = 0.5;
          s.sfx.tone(1150, 0.12, 'sine', 0.035 * Math.max(0.2, 1 - dist / 18));
        }
        if (this.timer <= 0) {
          this.state = 'turn';
          this.timer = 1.6;
          this.turnFrom = this.yaw;
          this.toB = !this.toB;
        }
        break;
      case 'turn': {
        this.timer -= dt;
        const k = 1 - Math.max(0, this.timer) / 1.6;
        this.yaw = this.turnFrom + Math.PI * k;
        if (this.timer <= 0) {
          const target = this.toB ? this.b : this.a;
          this.yaw = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
          this.state = 'drive';
        }
        break;
      }
      case 'skid': {
        this.timer -= dt;
        this.yaw = this.turnFrom + Math.PI * 2 * Math.round(this.skidDur / 1.4) * (1 - Math.max(0, this.timer) / this.skidDur);
        this.pos.addScaledVector(f, dt * 1.2);
        if (this.timer <= 0) {
          const target = this.toB ? this.b : this.a;
          this.yaw = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
          this.state = 'drive';
        }
        break;
      }
    }
    for (const b of ctx.colliders) if (!b.disabled && b.tag !== 'rack') pushOutCircle(this.pos, 0.2, b);

    // hitting the player
    if (this.hitCd <= 0 && (this.speed > 0.4 || this.state === 'skid')) {
      for (const c of this.circles()) {
        const d = Math.hypot(P.x - c.x, P.z - c.z);
        if (d < c.r + 0.42) {
          this.hitCd = 2;
          const nx = (P.x - c.x) / (d || 1);
          const nz = (P.z - c.z) / (d || 1);
          ctx.knock(nx * 6 + f.x * 4, nz * 6 + f.z * 4);
          this.honk(s, 0);
          ctx.forkliftHit(this);
          break;
        }
      }
    }
    this.spot.visible = this.state === 'drive';
    this.sync();
  }
}

// ================================================================ the Rate Coach

export class RateCoach {
  group = new THREE.Group();
  w: Walker;
  name = COACH_NAME;
  radius = 0.32;
  private v: Visual & { hand: THREE.Mesh; watch: THREE.Object3D };
  /** The stopwatch is still in its hand. */
  hasWatch = true;
  private repath = 0;
  private talk = 5;
  private down = 0;
  state: 'follow' | 'down' = 'follow';

  constructor(scene: THREE.Scene, pos: THREE.Vector3) {
    this.w = new Walker(pos);
    this.v = coachVisual();
    this.group.add(this.v.root);
    this.group.userData.interact = { kind: 'coach', robot: this } satisfies Interact;
    scene.add(this.group);
  }

  get pos(): THREE.Vector3 {
    return this.w.pos;
  }

  say(text: string, sec = 3.5): void {
    bubbles.say(this.group, this.v.height + 0.45, text, sec, this.name);
  }

  knockDown(): void {
    this.state = 'down';
    this.down = 4;
    this.v.play('dead');
    this.w.path = [];
  }

  /** Loses the stopwatch. Returns where it was, in world space. */
  dropWatch(): THREE.Vector3 | null {
    if (!this.hasWatch) return null;
    this.hasWatch = false;
    const p = this.v.watch.getWorldPosition(new THREE.Vector3());
    this.v.watch.visible = false;
    return p;
  }

  returnWatch(): void {
    this.hasWatch = true;
    this.v.watch.visible = true;
  }

  /** Talk soon, used when something happens. */
  nudge(sec = 0.6): void {
    this.talk = Math.min(this.talk, sec);
  }

  update(dt: number, ctx: RobotCtx, t: number): void {
    this.v.update(dt);
    if (this.hasWatch) this.v.hand.rotation.z = -t * 6;
    if (this.state === 'down') {
      this.down -= dt;
      if (this.down <= 0) {
        this.state = 'follow';
        this.v.play('idle');
        this.say(pick(COACH_REBOOT), 3);
        this.talk = 6;
      }
      this.sync();
      return;
    }
    const s = ctx.s;
    const P = s.player.pos;
    const inBooth = ctx.playerInBooth();
    const fwd = s.player.forward();
    const goal = inBooth ? ctx.doorFront.clone().add(new THREE.Vector3(-0.6, 0, 0.8)) : new THREE.Vector3(P.x - fwd.x * 2.0 + fwd.z * 0.9, 0, P.z - fwd.z * 2.0 - fwd.x * 0.9);
    const dist = Math.hypot(P.x - this.pos.x, P.z - this.pos.z);
    const gd = Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z);
    this.repath -= dt;
    if (this.repath <= 0) {
      this.repath = 0.7;
      this.w.path = gd > 0.6 && (dist > 1.8 || inBooth) ? ctx.nav.route(this.pos, goal) : [];
    }
    const moving = this.w.path.length > 0;
    const speed = dist > 8 ? 5.4 : 3.6;
    if (moving) {
      this.w.step(dt, speed, ctx.colliders, this.radius);
      this.v.play('run');
    } else {
      this.w.face(P.x, P.z, dt);
      this.v.play('idle');
    }
    this.talk -= dt;
    if (this.talk <= 0 && dist < 14) {
      this.talk = rand(8, 12);
      const line = ctx.coachLine();
      if (line) {
        this.say(line, 3.8);
        s.sfx.tone(1800, 0.06, 'square', 0.03);
        s.sfx.tone(1800, 0.06, 'square', 0.03, undefined, 0.1);
      }
    }
    this.sync();
  }

  private sync(): void {
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = this.w.yaw;
  }
}

// ================================================================ PICK-O-TRON picker robots

export class PickerBot {
  group = new THREE.Group();
  w: Walker;
  name: string;
  radius = 0.36;
  private v: Visual;
  private state: 'toBin' | 'pick' | 'toHopper' | 'drop' | 'down' | 'party' = 'toBin';
  private timer = 0;
  private talkCd = rand(4, 10);
  private shoveCd = 0;
  private slipCd = 0;
  picks = 0;

  constructor(scene: THREE.Scene, pos: THREE.Vector3, index: number, nav: NavGrid) {
    this.w = new Walker(pos);
    this.name = PICKER_NAMES[index % PICKER_NAMES.length];
    this.v = pickerVisual(index % 2 ? '#c9a227' : '#2a9d8f');
    this.group.add(this.v.root);
    // an invisible grab box, so talking to and kicking the robot works even when it lies on the floor
    const grab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 0.8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    grab.position.y = 0.75;
    this.group.add(grab);
    this.group.userData.interact = { kind: 'picker', robot: this } satisfies Interact;
    scene.add(this.group);
    this.goBin(nav);
  }

  get pos(): THREE.Vector3 {
    return this.w.pos;
  }

  get isDown(): boolean {
    return this.state === 'down';
  }

  say(text: string, sec = 3): void {
    bubbles.say(this.group, this.v.height + 0.4, text, sec, this.name);
  }

  private goBin(nav: NavGrid): void {
    const a = Math.floor(Math.random() * AISLE_X.length);
    const j = Math.floor(Math.random() * 12);
    this.w.path = nav.route(this.pos, new THREE.Vector3(AISLE_X[a] + (Math.random() - 0.5), 0, bayZ(j)));
    this.state = 'toBin';
  }

  knockDown(sec = 3): void {
    this.state = 'down';
    this.timer = sec;
    this.v.play('dead');
    this.w.path = [];
  }

  /** Stops and does a little dance (thumbs up, the only move it knows). */
  party(sec = 4): void {
    if (this.state === 'down') return;
    this.state = 'party';
    this.timer = sec;
    this.w.path = [];
    this.v.play('act');
  }

  update(dt: number, ctx: RobotCtx): void {
    this.v.update(dt);
    const s = ctx.s;
    const P = s.player.pos;
    const dist = Math.hypot(P.x - this.pos.x, P.z - this.pos.z);
    this.talkCd -= dt;
    this.shoveCd -= dt;
    this.slipCd -= dt;
    switch (this.state) {
      case 'party':
        this.timer -= dt;
        this.w.yaw += dt * 5;
        if (this.timer <= 0) {
          this.v.play('idle');
          this.goBin(ctx.nav);
        }
        break;
      case 'down':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.v.play('idle');
          this.say(pick(PICKER_SLIP), 3);
          this.goBin(ctx.nav);
        }
        break;
      case 'toBin':
      case 'toHopper': {
        this.v.play('run');
        // humans in the way get politely shoved
        const f = new THREE.Vector3(Math.sin(this.w.yaw), 0, Math.cos(this.w.yaw));
        const ahead = (P.x - this.pos.x) * f.x + (P.z - this.pos.z) * f.z;
        let speed = 6.2;
        if (dist < 1.1 && ahead > 0) {
          speed = 1.5;
          if (this.shoveCd <= 0) {
            this.shoveCd = 4;
            ctx.knock(f.x * 3 + (P.x - this.pos.x) * 2, f.z * 3 + (P.z - this.pos.z) * 2);
            this.say(pick(PICKER_SHOVE), 2.5);
            s.count('shoved');
          }
        }
        if (this.w.step(dt, speed, ctx.colliders, this.radius)) {
          this.state = this.state === 'toBin' ? 'pick' : 'drop';
          this.timer = this.state === 'pick' ? 0.7 : 0.5;
          this.v.play('act');
        }
        if (this.slipCd <= 0) {
          for (const pd of s.puddles) {
            if (Math.hypot(pd.x - this.pos.x, pd.z - this.pos.z) < pd.r) {
              this.slipCd = 10;
              this.knockDown(3);
              ctx.botSlip(this);
              break;
            }
          }
        }
        break;
      }
      case 'pick':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.w.path = ctx.nav.route(this.pos, new THREE.Vector3(HOPPER.x + (Math.random() - 0.5) * 0.6, 0, HOPPER.z - 1.3));
          this.state = 'toHopper';
          this.v.play('run');
        }
        break;
      case 'drop':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.picks++;
          ctx.robotPick();
          this.goBin(ctx.nav);
        }
        break;
    }
    if (this.state !== 'down' && dist < 4.5 && this.talkCd <= 0) {
      this.talkCd = rand(12, 20);
      this.say(pick(PICKER_LINES), 3.5);
    }
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = this.w.yaw;
  }
}
