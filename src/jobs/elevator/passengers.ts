import * as THREE from 'three';
import { bubbles } from '../../bubbles';
import { buildCustomerVisual, CustomerKind, CustomerVisual } from '../../customerModels';
import { pick, rand } from '../../util';

/** A robot that rides Elevator B. Movement and looks only, the rules live in index.ts. */

export type Role = 'commuter' | 'chatty' | 'exec' | 'toddler' | 'delivery' | 'influencer';
export type PState = 'arriving' | 'waiting' | 'boarding' | 'riding' | 'leaving' | 'gone';

export const ROLE_INFO: Record<Role, { kind: CustomerKind; weight: number; patience: number; radius: number; names: string[]; colors: string[] }> = {
  commuter: { kind: 'shopper', weight: 95, patience: 75, radius: 0.32, names: ['Unit-4471', 'Kevin-OS', 'Ledger-9', 'Bitsy', 'Clerk-220', 'Norm-3', 'Dana-v2', 'Pixel-Pete'], colors: ['#7f8c8d', '#5d6d7e', '#a04000'] },
  chatty: { kind: 'gran', weight: 130, patience: 999, radius: 0.36, names: ['Doris-9'], colors: ['#b39ddb'] },
  exec: { kind: 'karen', weight: 110, patience: 45, radius: 0.34, names: ['VP Prestige', 'C-Level Clive', 'Exec-Unit Platinum'], colors: ['#8e44ad'] },
  toddler: { kind: 'toddler', weight: 22, patience: 999, radius: 0.25, names: ['Tiny-Bot', 'Unit-0.5'], colors: ['#f39c12'] },
  delivery: { kind: 'bulk', weight: 400, patience: 90, radius: 0.55, names: ['Parcel Unit 7'], colors: ['#16a085'] },
  influencer: { kind: 'influencer', weight: 70, patience: 80, radius: 0.3, names: ['StreamBot Lumi'], colors: ['#ff6fb5'] },
};

export class Passenger {
  role: Role;
  name: string;
  group = new THREE.Group();
  visual: CustomerVisual;
  pos = new THREE.Vector3();
  radius: number;
  weight: number;
  state: PState = 'arriving';
  /** Floor where it waits or got off. */
  floor: number;
  dest: number;
  /** Cabin spot index while riding. */
  spot = -1;
  waitSpot = -1;
  patience: number;
  /** Seconds since boarding. */
  rideTime = 0;
  waitTime = 0;
  path: THREE.Vector3[] = [];
  speed = 1.4;
  /** Falling over (tripped, jolted). */
  fallen = 0;
  private fallAmt = 0;
  sayCooldown = 0;
  /** Stops at other floors during this ride (for the executive). */
  stopsOnRide = 0;
  /** The chatty robot's place in the story. */
  story = 0;
  storyTimer = 2;
  /** The toddler's next prank. */
  prankTimer = 5;
  quietTimer = 0;
  hasParcel = false;
  parcel: THREE.Object3D | null = null;
  pressedButton = false;
  dancing = 0;
  /** What it said when it boarded (repeated when asked). */
  wish = '';
  /** Asked to step out: goes back to waiting instead of leaving. */
  userRequeue = false;
  /** Gave up and took the stairs. */
  stairs = false;
  slipCooldown = 0;
  /** Cabin height when it was asked to step out. It will not get back in before the cabin has left. */
  evictedY: number | null = null;
  private spin: THREE.Object3D | undefined;
  private facing = Math.PI;

  constructor(role: Role, floor: number, dest: number) {
    const info = ROLE_INFO[role];
    this.role = role;
    this.name = pick(info.names);
    this.radius = info.radius;
    this.weight = info.weight;
    this.patience = info.patience * rand(0.85, 1.15);
    this.floor = floor;
    this.dest = dest;
    this.visual = buildCustomerVisual(info.kind, pick(info.colors));
    this.group.rotation.order = 'YXZ';
    this.group.add(this.visual.root);
    this.spin = this.visual.root.getObjectByName('spin');
    if (role === 'delivery') {
      // The delivery mech barely fits into the cabin. Slightly smaller, still too big.
      this.visual.root.scale.setScalar(0.78);
      this.hasParcel = true;
      const p = new THREE.Group();
      const card = new THREE.MeshStandardMaterial({ color: '#a87a46', roughness: 0.9 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.75), card);
      box.position.y = 0.42;
      p.add(box);
      const tape = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.1, 0.77), new THREE.MeshStandardMaterial({ color: '#c9a36a' }));
      tape.position.y = 0.42;
      p.add(tape);
      p.position.set(0, 1.05, 0.95);
      this.visual.root.add(p);
      this.parcel = p;
    }
    if (role === 'exec') {
      const brief = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.1), new THREE.MeshStandardMaterial({ color: '#2a1a0e', roughness: 0.4 }));
      brief.position.set(-0.36, 0.5, 0.05);
      this.visual.root.add(brief);
    }
    this.group.userData.interact = { kind: 'evRobot', passenger: this };
  }

  get height(): number {
    return this.visual.height;
  }

  say(text: string, seconds = 3.5): void {
    bubbles.say(this.group, this.visual.height + 0.45, text, seconds, this.name);
    this.sayCooldown = Math.max(this.sayCooldown, 2.5);
  }

  fall(seconds: number): void {
    if (this.fallen > 0) return;
    this.fallen = seconds;
    this.visual.setFace('dead');
    this.visual.play?.('dead');
  }

  face(yaw: number): void {
    this.facing = yaw;
  }

  /** Walks along `path`. Returns true when the path is done. */
  walk(dt: number): boolean {
    if (this.fallen > 0) return false;
    const tgt = this.path[0];
    if (!tgt) return true;
    const dx = tgt.x - this.pos.x;
    const dz = tgt.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const step = this.speed * dt;
    if (d <= step) {
      this.pos.x = tgt.x;
      this.pos.z = tgt.z;
      this.path.shift();
    } else {
      this.pos.x += (dx / d) * step;
      this.pos.z += (dz / d) * step;
    }
    if (d > 0.05) this.facing = Math.atan2(dx, dz);
    return this.path.length === 0;
  }

  update(dt: number, moving: boolean): void {
    this.sayCooldown -= dt;
    if (this.fallen > 0) {
      this.fallen -= dt;
      this.fallAmt = Math.min(1, this.fallAmt + dt * 4);
      if (this.fallen <= 0) {
        this.visual.setFace('normal');
        this.visual.play?.('idle');
      }
    } else {
      this.fallAmt = Math.max(0, this.fallAmt - dt * 2);
      const anim = moving ? 'walk' : this.dancing > 0 ? (this.role === 'delivery' || this.role === 'commuter' ? 'act' : 'talk') : 'idle';
      this.visual.play?.(anim);
    }
    if (this.dancing > 0) this.dancing -= dt;
    let diff = this.facing - this.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.group.rotation.y += diff * Math.min(1, dt * 8);
    if (this.dancing > 0 && !this.visual.play) this.group.rotation.y += Math.sin(performance.now() / 120) * 0.08;
    const tip = this.visual.hasDeath ? 0 : this.role === 'delivery' ? 0.2 : 0.47;
    this.group.rotation.x = -this.fallAmt * Math.PI * tip;
    this.group.position.x = this.pos.x;
    this.group.position.z = this.pos.z;
    this.visual.update?.(dt);
    if (this.spin) this.spin.rotation.y += dt * 25;
  }

  /** Puts the parcel down (the delivery robot gets lighter). */
  dropParcel(): void {
    if (!this.hasParcel) return;
    this.hasParcel = false;
    this.weight = 140;
    if (this.parcel) this.parcel.parent?.remove(this.parcel);
  }
}
