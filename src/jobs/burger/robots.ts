import * as THREE from 'three';
import { instantiate } from '../../assets';
import { bubbles } from '../../bubbles';
import { Anim, buildCustomerVisual, CustomerKind, CustomerVisual } from '../../customerModels';
import type { NavGrid } from '../../nav';
import { AABB, pushOutCircle, textTexture } from '../../util';
import { m } from './items';

/**
 * The robot customers of MEGABYTE BURGER and the drive-thru car.
 * Bots only know how to walk, talk and fall over. The job decides what they want.
 */

export type BotRole = 'customer' | 'karen' | 'gran' | 'kid' | 'critic' | 'roomba';

const LOOK: Record<BotRole, { kind: CustomerKind; color: string; speed: number; radius: number }> = {
  customer: { kind: 'shopper', color: '#3498db', speed: 1.3, radius: 0.35 },
  karen: { kind: 'karen', color: '#8e44ad', speed: 1.5, radius: 0.35 },
  gran: { kind: 'gran', color: '#b39ddb', speed: 0.8, radius: 0.35 },
  kid: { kind: 'toddler', color: '#f39c12', speed: 2.6, radius: 0.3 },
  critic: { kind: 'influencer', color: '#ff6fb5', speed: 1.1, radius: 0.35 },
  roomba: { kind: 'roomba', color: '#34495e', speed: 0.9, radius: 0.32 },
};

export type BotState = 'walk' | 'wait' | 'fallen' | 'gone';

export class Bot {
  role: BotRole;
  name: string;
  group = new THREE.Group();
  visual: CustomerVisual;
  pos: THREE.Vector3;
  path: THREE.Vector3[] = [];
  state: BotState = 'wait';
  /** What the job wants the bot to do next. Free form, read by the job. */
  phase = '';
  timer = 0;
  faceYaw: number | null = null;
  slipCooldown = 0;
  private fallT = 0;
  private fallAmt = 0;
  private oneShot = 0;
  private oneShotAnim: Anim = 'talk';
  private moved = false;
  private walkT = 0;
  private spin: THREE.Object3D | undefined;
  onArrive: (() => void) | null = null;

  constructor(scene: THREE.Scene, role: BotRole, name: string, pos: THREE.Vector3) {
    this.role = role;
    this.name = name;
    this.pos = pos.clone();
    const look = LOOK[role];
    this.visual = buildCustomerVisual(look.kind, look.color);
    this.group.rotation.order = 'YXZ';
    this.group.add(this.visual.root);
    this.spin = this.visual.root.getObjectByName('spin');
    if (role === 'critic') this.addBeret();
    this.group.userData.interact = { kind: 'bgBot', bot: this };
    this.group.position.copy(this.pos);
    scene.add(this.group);
  }

  get speed(): number {
    return LOOK[this.role].speed;
  }
  get radius(): number {
    return LOOK[this.role].radius;
  }
  get height(): number {
    return this.visual.height;
  }

  private addBeret(): void {
    const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.06, 12), m('#1c1c1c', 0.8));
    beret.position.set(0.04, this.visual.height + 0.05, 0);
    beret.rotation.z = 0.2;
    this.group.add(beret);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.02), new THREE.MeshStandardMaterial({ map: textTexture(['REVIEW', '0/5'], { w: 64, h: 80, bg: '#f2efe4', fg: '#7a2416' }) }));
    pad.position.set(0.32, 0.95, 0.25);
    pad.rotation.y = -0.4;
    this.group.add(pad);
  }

  say(text: string, seconds = 4): void {
    bubbles.say(this.group, this.visual.height + 0.45, text, seconds, this.name);
  }

  act(anim: Anim, seconds = 1.2): void {
    this.oneShot = seconds;
    this.oneShotAnim = anim;
  }

  goTo(nav: NavGrid, target: THREE.Vector3, then: (() => void) | null = null): void {
    this.path = nav.route(this.pos, target);
    this.state = 'walk';
    this.onArrive = then;
  }

  fall(seconds: number): void {
    if (this.state === 'gone') return;
    this.fallT = seconds;
    this.visual.setFace('dead');
  }

  get fallen(): boolean {
    return this.fallT > 0;
  }

  remove(): void {
    this.state = 'gone';
    this.group.parent?.remove(this.group);
  }

  update(dt: number, colliders: AABB[]): void {
    if (this.state === 'gone') return;
    this.slipCooldown -= dt;
    if (this.spin) this.spin.rotation.y += dt * 25;
    if (this.fallT > 0) {
      this.fallT -= dt;
      this.fallAmt = Math.min(1, this.fallAmt + dt * 4);
      if (this.fallT <= 0) this.visual.setFace('normal');
    } else {
      this.fallAmt = Math.max(0, this.fallAmt - dt * 2);
      if (this.state === 'walk') this.walk(dt, colliders);
    }
    if (this.timer > 0) this.timer -= dt;
    if (!this.moved && this.faceYaw !== null) this.turn(this.faceYaw, dt);

    const v = this.visual;
    if (v.play && v.update) {
      this.oneShot -= dt;
      let anim: Anim = 'idle';
      if (this.fallT > 0) anim = 'dead';
      else if (this.moved) anim = this.speed > 1.8 ? 'run' : 'walk';
      else if (this.oneShot > 0) anim = this.oneShotAnim;
      v.play(anim);
      v.update(dt);
    }
    const hop = this.moved && !v.play && this.role !== 'roomba' ? Math.abs(Math.sin(this.walkT)) * 0.04 : 0;
    this.group.position.set(this.pos.x, hop, this.pos.z);
    const tip = v.hasDeath ? 0 : this.role === 'roomba' ? 0.3 : 0.47;
    this.group.rotation.x = -this.fallAmt * Math.PI * tip;
    this.moved = false;
  }

  private turn(want: number, dt: number): void {
    let diff = want - this.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.group.rotation.y += diff * Math.min(1, dt * 8);
  }

  private walk(dt: number, colliders: AABB[]): void {
    const tgt = this.path[0];
    if (!tgt) {
      this.state = 'wait';
      const f = this.onArrive;
      this.onArrive = null;
      f?.();
      return;
    }
    const dx = tgt.x - this.pos.x;
    const dz = tgt.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.12) {
      this.path.shift();
      return;
    }
    const step = Math.min(d, this.speed * dt);
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
    this.turn(Math.atan2(dx, dz), dt);
    this.walkT += dt * this.speed * 7;
    this.moved = true;
    for (const b of colliders) if (!b.disabled) pushOutCircle(this.pos, this.radius, b);
  }
}

/** The drive-thru customer: a car with a robot face on the windshield. */
export class Car {
  group = new THREE.Group();
  pos = new THREE.Vector3();
  state: 'arrive' | 'wait' | 'leave' | 'gone' = 'arrive';
  name: string;
  private face: THREE.MeshBasicMaterial;
  private faces: Record<string, THREE.CanvasTexture> = {};
  private speedNow = 0;
  private stopZ: number;
  private bounce = 0;

  constructor(scene: THREE.Scene, name: string, stop: THREE.Vector3, variant: number) {
    this.name = name;
    this.stopZ = stop.z;
    this.pos.set(stop.x, 0, 22);
    const key = ['bg_sedan', 'bg_suv', 'bg_taxi', 'bg_van'][variant % 4];
    const inst = instantiate(key);
    const body = new THREE.Group();
    if (inst) {
      // Kenney cars face +Z. This one drives towards -Z.
      inst.object.rotation.y = Math.PI;
      body.add(inst.object);
    } else {
      const paint = m(['#c0392b', '#2c64b4', '#e0b21b', '#27ae60'][variant % 4], 0.4);
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 4), paint);
      b.position.y = 0.6;
      body.add(b);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2), paint);
      cab.position.set(0, 1.2, 0.2);
      body.add(cab);
      for (const sx of [-0.85, 0.85]) for (const sz of [-1.3, 1.3]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 10), m('#1c1c1c'));
        w.rotation.z = Math.PI / 2;
        w.position.set(sx, 0.35, sz);
        body.add(w);
      }
    }
    this.group.add(body);
    body.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(body);
    const mk = (s: string, c: string) => {
      const t = textTexture([s], { w: 96, h: 64, bg: '#0b1a2a', fg: c, font: 'monospace' });
      t.magFilter = THREE.NearestFilter;
      return t;
    };
    this.faces = { happy: mk('^_^', '#55ffff'), wait: mk('-_-', '#ffd166'), angry: mk('>:(', '#ff5555') };
    this.face = new THREE.MeshBasicMaterial({ map: this.faces.happy });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), this.face);
    // on the windshield, facing forward (-Z) and a second one at the driver window (-X side)
    screen.position.set(0, bb.max.y * 0.8, bb.min.z * 0.35);
    screen.rotation.set(-0.35, Math.PI, 0);
    this.group.add(screen);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.42), this.face);
    side.position.set(bb.min.x - 0.02, bb.max.y * 0.72, (bb.min.z + bb.max.z) * 0.5 - 0.2);
    side.rotation.y = -Math.PI / 2;
    this.group.add(side);
    // a robot arm sticking out of the window
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), m('#bdc3c7', 0.4, { metalness: 0.5 }));
    arm.position.set(bb.min.x - 0.2, bb.max.y * 0.55, (bb.min.z + bb.max.z) * 0.5 - 0.2);
    this.group.add(arm);
    this.group.userData.interact = { kind: 'bgCar', car: this };
    this.group.position.copy(this.pos);
    scene.add(this.group);
  }

  setMood(mood: 'happy' | 'wait' | 'angry'): void {
    this.face.map = this.faces[mood];
  }

  say(text: string, seconds = 4): void {
    bubbles.say(this.group, 2.1, text, seconds, this.name);
  }

  honkBounce(): void {
    this.bounce = 0.4;
  }

  /** Returns true the frame the car reaches the window. */
  update(dt: number): boolean {
    let arrived = false;
    if (this.state === 'arrive') {
      const d = this.pos.z - this.stopZ;
      const want = Math.min(6, Math.max(0.6, d * 1.2));
      this.speedNow += (want - this.speedNow) * Math.min(1, dt * 2);
      this.pos.z -= this.speedNow * dt;
      if (this.pos.z <= this.stopZ + 0.02) {
        this.pos.z = this.stopZ;
        this.state = 'wait';
        this.speedNow = 0;
        arrived = true;
      }
    } else if (this.state === 'leave') {
      this.speedNow = Math.min(9, this.speedNow + dt * 5);
      this.pos.z -= this.speedNow * dt;
      if (this.pos.z < -24) {
        this.state = 'gone';
        this.group.parent?.remove(this.group);
      }
    }
    this.bounce = Math.max(0, this.bounce - dt);
    this.group.position.set(this.pos.x, Math.sin(this.bounce * 30) * this.bounce * 0.15, this.pos.z);
    return arrived;
  }
}
