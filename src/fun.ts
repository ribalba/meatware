import * as THREE from 'three';
import { bubbles } from './bubbles';
import type { Interact } from './level';
import type { NavGrid } from './nav';
import type { AABB, Rect } from './util';

/**
 * Mischief that works in every workplace: kicking, breaking, hiding, the office cat,
 * and the secrets players find (remembered between shifts in localStorage).
 */

// ---------------------------------------------------------------- secrets

/** Secrets every job has, found through the engine's own systems. */
export const ENGINE_SECRETS: Record<string, string> = {
  'eng.cat': 'Petted the office cat',
  'eng.catDodge': 'Tried to kick the cat. The cat has reflexes.',
  'eng.kickBrad': 'Kicked management',
  'eng.golden': 'Pocketed the golden item',
  'eng.darkPee': 'Peed during the power cut',
  'eng.hide': 'Hid from Brad while he was looking for you',
  'eng.float': 'Caught an item in zero gravity',
};

const foundKey = (job: string) => `meatware.secrets.${job}`;
const totalKey = (job: string) => `meatware.secretTotal.${job}`;

export function foundSecrets(job: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(foundKey(job)) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Remembers a secret. Returns false if it was already known from an earlier shift. */
export function saveSecret(job: string, id: string): boolean {
  const all = foundSecrets(job);
  if (all.includes(id)) return false;
  all.push(id);
  try {
    localStorage.setItem(foundKey(job), JSON.stringify(all));
  } catch {
    /* private mode */
  }
  return true;
}

export function secretTotal(job: string): number | null {
  const n = Number(localStorage.getItem(totalKey(job)));
  return n > 0 ? n : null;
}

export function setSecretTotal(job: string, n: number): void {
  try {
    localStorage.setItem(totalKey(job), String(n));
  } catch {
    /* private mode */
  }
}

// ---------------------------------------------------------------- breakables and hiding

export interface BreakableOpts {
  /** Shown in lines ("You kick the vending machine"). Lower case, with article if needed. */
  name: string;
  /** Kicks or hits needed. Default 1. */
  hp?: number;
  /** A collider to remove when it breaks. */
  collider?: AABB;
  /** Price on the payslip. Default 19.99. */
  price?: number;
  /** Said when it breaks (otherwise a generic line). */
  line?: string;
  /** Debris colors (otherwise taken from the materials). */
  colors?: string[];
  /** Called after it broke. */
  onBreak?: () => void;
}

export interface BreakableState extends BreakableOpts {
  hp: number;
  broken?: boolean;
  box?: THREE.Box3;
}

export interface HideSpot {
  rect: Rect;
  /** "the lockers", "the laundry cart" */
  name: string;
}

/** Collects up to four colors from the materials of an object, for debris. */
export function colorsOf(obj: THREE.Object3D): string[] {
  const out: string[] = [];
  obj.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      const c = (mat as THREE.MeshStandardMaterial).color;
      if (c && out.length < 4) {
        const hex = '#' + c.getHexString();
        if (!out.includes(hex)) out.push(hex);
      }
    }
  });
  return out.length ? out : ['#888888'];
}

// ---------------------------------------------------------------- debris

export class Debris {
  private bits: { m: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; life: number }[] = [];
  private geo = new THREE.BoxGeometry(1, 1, 1);
  private mats = new Map<string, THREE.MeshStandardMaterial>();

  constructor(private scene: THREE.Scene) {}

  burst(at: THREE.Vector3, colors: string[], n = 14, power = 1): void {
    for (let i = 0; i < n; i++) {
      const col = colors[i % colors.length];
      let mat = this.mats.get(col);
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 });
        this.mats.set(col, mat);
      }
      const m = new THREE.Mesh(this.geo, mat);
      const s = 0.04 + Math.random() * 0.09;
      m.scale.set(s, s * (0.4 + Math.random()), s * (0.6 + Math.random() * 0.8));
      m.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3));
      const v = new THREE.Vector3((Math.random() - 0.5) * 5, 2 + Math.random() * 4, (Math.random() - 0.5) * 5).multiplyScalar(power);
      this.scene.add(m);
      this.bits.push({ m, v, spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, 0), life: 18 + Math.random() * 6 });
    }
  }

  update(dt: number): void {
    this.bits = this.bits.filter((b) => {
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.m);
        return false;
      }
      const p = b.m.position;
      if (p.y > b.m.scale.y / 2 || b.v.y > 0) {
        b.v.y -= 9.8 * dt;
        p.addScaledVector(b.v, dt);
        b.m.rotation.x += b.spin.x * dt;
        b.m.rotation.y += b.spin.y * dt;
        if (p.y < b.m.scale.y / 2) {
          p.y = b.m.scale.y / 2;
          b.v.set(b.v.x * 0.4, Math.abs(b.v.y) > 1.5 ? -b.v.y * 0.3 : 0, b.v.z * 0.4);
        }
      }
      if (b.life < 1) b.m.scale.multiplyScalar(1 - dt * 3);
      return true;
    });
  }
}

// ---------------------------------------------------------------- the kicking boot

export class KickBoot {
  readonly group = new THREE.Group();
  private t = -1;

  constructor(camera: THREE.Camera) {
    const leather = new THREE.MeshStandardMaterial({ color: '#3b2716', roughness: 0.7 });
    const sole = new THREE.MeshStandardMaterial({ color: '#141010', roughness: 0.9 });
    const sock = new THREE.MeshStandardMaterial({ color: '#7a1f14', roughness: 0.9 });
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.3), leather);
    shoe.position.set(0, 0, -0.06);
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.08), leather);
    toe.position.set(0, -0.015, -0.24);
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.34), sole);
    bottom.position.set(0, -0.07, -0.08);
    const ankle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.12), sock);
    ankle.position.set(0, 0.14, 0.04);
    this.group.add(shoe, toe, bottom, ankle);
    this.group.visible = false;
    camera.add(this.group);
  }

  start(): void {
    this.t = 0;
    this.group.visible = true;
  }

  update(dt: number): void {
    if (this.t < 0) return;
    this.t += dt;
    const D = 0.42;
    const k = Math.sin(Math.min(1, this.t / D) * Math.PI);
    this.group.position.set(0.12 - 0.06 * k, -0.95 + 0.6 * k, -0.35 - 0.4 * k);
    this.group.rotation.set(-0.9 + 0.8 * k, 0.2, 0.15);
    if (this.t >= D) {
      this.t = -1;
      this.group.visible = false;
    }
  }
}

// ---------------------------------------------------------------- the office cat

const CAT_LINES = ['meow.exe', 'mrrp', '*purr.wav*', 'meow (premium)', '...', 'mew', '*judges you*'];

/** A small robot cat that wanders around, sits on things and ignores Brad. */
export class OfficeCat {
  readonly group = new THREE.Group();
  readonly pos = new THREE.Vector3();
  private path: THREE.Vector3[] = [];
  private wait = 2;
  private speed = 1.1;
  private tail: THREE.Object3D;
  private legs: THREE.Object3D[] = [];
  private walkT = 0;
  private bubbleT = 6;
  private fleeing = 0;

  constructor(
    readonly scene: THREE.Scene,
    private nav: NavGrid,
    private bounds: Rect,
    start: THREE.Vector3,
  ) {
    const metal = new THREE.MeshStandardMaterial({ color: '#8d8a86', roughness: 0.45, metalness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: '#3a3836', roughness: 0.6 });
    const eye = new THREE.MeshStandardMaterial({ color: '#6dff8a', emissive: '#3dff6a', emissiveIntensity: 1.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.34), metal);
    body.position.y = 0.2;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.13, 0.13), metal);
    head.position.set(0, 0.31, -0.2);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 4), dark);
      ear.position.set(s * 0.045, 0.4, -0.2);
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.01), eye);
      e.position.set(s * 0.035, 0.32, -0.268);
      this.group.add(ear, e);
    }
    for (const [x, z] of [[-0.05, -0.12], [0.05, -0.12], [-0.05, 0.12], [0.05, 0.12]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.14, 0.035), dark);
      leg.geometry.translate(0, -0.07, 0);
      leg.position.set(x, 0.14, z);
      this.legs.push(leg);
      this.group.add(leg);
    }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.28, 6), dark);
    tail.geometry.translate(0, 0.14, 0);
    tail.position.set(0, 0.24, 0.17);
    tail.rotation.x = 0.5;
    this.tail = tail;
    this.group.add(body, head, tail);
    this.group.userData.interact = { kind: 'cat' } satisfies Interact;
    this.pos.copy(start);
    this.group.position.copy(start);
    scene.add(this.group);
  }

  /** Where the player bumps into the cat. */
  get circle(): { x: number; z: number; r: number } {
    return { x: this.pos.x, z: this.pos.z, r: 0.22 };
  }

  say(text: string, s = 2.5): void {
    bubbles.say(this.group, 0.65, text, s, 'OFFICE CAT');
  }

  private randomFree(): THREE.Vector3 {
    const b = this.bounds;
    for (let i = 0; i < 40; i++) {
      const x = b.minX + 1 + Math.random() * (b.maxX - b.minX - 2);
      const z = b.minZ + 1 + Math.random() * (b.maxZ - b.minZ - 2);
      if (this.nav.isFree(x, z)) return new THREE.Vector3(x, 0, z);
    }
    return this.pos.clone();
  }

  /** Comes over and sits in front of the player. */
  comeTo(p: THREE.Vector3): void {
    this.path = this.nav.route(this.pos, p).slice(0, -1);
    this.wait = 0;
  }

  /** The cat always dodges. It runs away to a far corner. */
  dodge(): void {
    this.group.position.y = 0.5;
    this.fleeing = 4;
    this.path = this.nav.route(this.pos, this.randomFree());
    this.say('HSSSS.wav', 2);
  }

  update(dt: number, t: number): void {
    this.bubbleT -= dt;
    if (this.bubbleT <= 0) {
      this.bubbleT = 9 + Math.random() * 12;
      this.say(CAT_LINES[Math.floor(Math.random() * CAT_LINES.length)]);
    }
    if (this.fleeing > 0) this.fleeing -= dt;
    const sp = this.fleeing > 0 ? 4 : this.speed;
    let moving = false;
    if (this.path.length) {
      const target = this.path[0];
      const d = Math.hypot(target.x - this.pos.x, target.z - this.pos.z);
      if (d < 0.15) this.path.shift();
      else {
        const step = Math.min(d, sp * dt);
        this.pos.x += ((target.x - this.pos.x) / d) * step;
        this.pos.z += ((target.z - this.pos.z) / d) * step;
        const yaw = Math.atan2(-(target.x - this.pos.x), -(target.z - this.pos.z));
        this.group.rotation.y += Math.atan2(Math.sin(yaw - this.group.rotation.y), Math.cos(yaw - this.group.rotation.y)) * Math.min(1, dt * 8);
        moving = true;
      }
    } else {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.wait = 3 + Math.random() * 7;
        this.path = this.nav.route(this.pos, this.randomFree());
      }
    }
    this.walkT += moving ? dt * sp * 9 : 0;
    this.legs.forEach((l, i) => (l.rotation.x = moving ? Math.sin(this.walkT + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.6 : 0));
    this.tail.rotation.z = Math.sin(t * (moving ? 6 : 2)) * 0.4;
    this.group.position.set(this.pos.x, Math.max(0, this.group.position.y - dt * 3), this.pos.z);
  }
}
