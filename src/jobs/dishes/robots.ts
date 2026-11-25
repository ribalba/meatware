import * as THREE from 'three';
import { instantiate, ModelInstance } from '../../assets';
import { bubbles } from '../../bubbles';
import type { NavGrid } from '../../nav';
import type { Item } from '../../items';
import { AABB, pushOutCircle } from '../../util';

/**
 * The robot staff of Le Robot Gourmand: a body that walks along nav routes, plays clips and talks.
 * The job decides what each robot wants to do. This file only knows how robots move and look.
 */

export type Clip = 'idle' | 'walk' | 'run' | 'talk' | 'act' | 'angry' | 'happy' | 'hit';

interface Rig {
  play(c: Clip): void;
  update(dt: number): void;
}

function rig(inst: ModelInstance, map: Partial<Record<Clip, string>>, once: Clip[]): Rig {
  const mixer = new THREE.AnimationMixer(inst.inner);
  const actions = new Map<Clip, THREE.AnimationAction>();
  for (const [k, name] of Object.entries(map) as [Clip, string][]) {
    const clip = inst.animations.find((c) => c.name === name);
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    if (once.includes(k)) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    actions.set(k, a);
  }
  let cur: THREE.AnimationAction | null = null;
  let curKey: Clip | null = null;
  const play = (k: Clip) => {
    if (k === curKey) return;
    const a = actions.get(k) ?? actions.get('idle');
    if (!a) return;
    curKey = k;
    a.reset().setEffectiveWeight(1).fadeIn(0.2).play();
    if (cur && cur !== a) cur.fadeOut(0.2);
    cur = a;
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

function attach(inst: ModelInstance, bone: string, prop: THREE.Object3D, at: THREE.Vector3): boolean {
  const b = inst.inner.getObjectByName(bone);
  if (!b) return false;
  inst.object.updateMatrixWorld(true);
  const ws = b.getWorldScale(new THREE.Vector3());
  const wq = b.getWorldQuaternion(new THREE.Quaternion());
  prop.position.copy(b.worldToLocal(at.clone()));
  prop.quaternion.copy(wq.invert());
  prop.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
  b.add(prop);
  return true;
}

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3, ...extra });

/** A simple box robot for when the models did not load. */
function fallbackBody(color: string, h: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, h * 0.45, 4, 10), std(color));
  body.position.y = h * 0.45;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3), std('#bdc3c7'));
  head.position.y = h * 0.88;
  g.add(head);
  return g;
}

export type Role = 'chef' | 'waiter' | 'somm' | 'vac';

export class Bot {
  readonly group = new THREE.Group();
  readonly pos: THREE.Vector3;
  readonly role: Role;
  readonly name: string;
  height: number;
  radius: number;
  speed = 1.4;
  path: THREE.Vector3[] = [];
  /** Free state for the job's behaviour code. */
  state = 'idle';
  /** Lying on the floor after a slip. */
  stun = 0;
  slipCooldown = 0;
  /** What the robot is after (a shelf type, a puddle, shards). */
  want = '';
  target: { kind: 'puddle' | 'item'; x: number; z: number; item?: Item } | null = null;
  timer = 0;
  /** A one-shot clip playing on top of the movement. */
  private oneShot = 0;
  private oneShotClip: Clip = 'idle';
  private rig: Rig | null = null;
  private moved = false;
  private stuckT = 0;
  private stuckBest = Infinity;
  private dest: THREE.Vector3 | null = null;
  private faceYaw: number | null = null;
  /** Pieces that wobble (the chef's toque). */
  wobble: THREE.Object3D | null = null;
  private spinT = 0;
  /** Ignore colliders (walking through the swinging doors). */
  ghost = false;

  constructor(scene: THREE.Scene, role: Role, name: string, pos: THREE.Vector3) {
    this.role = role;
    this.name = name;
    this.pos = pos.clone();
    this.height = 1.5;
    this.radius = 0.42;
    this.build();
    this.group.position.copy(this.pos);
    this.group.userData.interact = { kind: 'dwBot', bot: this };
    scene.add(this.group);
  }

  private build(): void {
    switch (this.role) {
      case 'chef': {
        const inst = instantiate('robotExpressive');
        const toque = new THREE.Group();
        const hat = new THREE.Group();
        toque.add(hat);
        const white = std('#fbfbf6', { metalness: 0, roughness: 0.9 });
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 14), white);
        hat.add(band);
        for (let i = 0; i < 6; i++) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), white);
          const a = (i / 6) * Math.PI * 2;
          puff.position.set(Math.cos(a) * 0.1, 0.28, Math.sin(a) * 0.1);
          hat.add(puff);
        }
        const tall = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.3, 14), white);
        tall.position.y = 0.17;
        hat.add(tall);
        const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 12), std('#c0392b', { metalness: 0 }));
        scarf.rotation.x = Math.PI / 2;
        if (inst) {
          tint(inst, { Main: '#f2efe6', Grey: '#d6d6d6' });
          attach(inst, 'Head', toque, new THREE.Vector3(0, 1.62, -0.02));
          attach(inst, 'Torso', scarf, new THREE.Vector3(0, 1.12, 0.02));
          this.group.add(inst.object);
          this.rig = rig(inst, { idle: 'Idle', walk: 'Walking', run: 'Running', talk: 'Yes', act: 'Punch', angry: 'No', happy: 'Dance', hit: 'Jump' }, ['talk', 'act', 'angry', 'hit']);
        } else {
          const b = fallbackBody('#f2efe6', 1.6);
          toque.position.y = 1.75;
          b.add(toque);
          this.group.add(b);
        }
        this.wobble = hat;
        this.height = 1.95;
        this.radius = 0.45;
        this.speed = 1.5;
        break;
      }
      case 'waiter': {
        const inst = instantiate('robotKenney');
        const tie = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.04), std('#111111'));
        const towel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.14), std('#ffffff', { metalness: 0, roughness: 1 }));
        if (inst) {
          attach(inst, 'torso', tie, new THREE.Vector3(0, 0.8, 0.19));
          attach(inst, 'arm-left', towel, new THREE.Vector3(0.3, 0.72, 0.05));
          this.group.add(inst.object);
          this.rig = rig(inst, { idle: 'idle', walk: 'walk', run: 'sprint', talk: 'emote-no', act: 'pick-up', angry: 'emote-no', happy: 'emote-yes', hit: 'die' }, ['talk', 'act', 'angry', 'happy', 'hit']);
        } else this.group.add(fallbackBody('#2c3e50', 1.45));
        this.height = 1.45;
        this.radius = 0.4;
        this.speed = 2.6;
        break;
      }
      case 'somm': {
        const inst = instantiate('robotLarge');
        const chain = new THREE.Group();
        const silver = std('#e3e7ea', { metalness: 0.9, roughness: 0.2 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 4, 18), silver);
        ring.rotation.x = Math.PI / 2 - 0.3;
        chain.add(ring);
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.03, 12), silver);
        cup.position.set(0, -0.2, 0.18);
        chain.add(cup);
        const glass = new THREE.Group();
        const gm = std('#cfe6ee', { transparent: true, opacity: 0.6, roughness: 0.1 });
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 5), gm);
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.1, 10), gm);
        bowl.position.y = 0.1;
        const wine = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.03, 10), std('#6d0f1e'));
        wine.position.y = 0.08;
        glass.add(stem, bowl, wine);
        if (inst) {
          tint(inst, { Main: '#6d1a2b', Main2: '#3e0d17' });
          this.group.add(inst.object);
          chain.position.set(0, 0.95, 0.12);
          inst.object.add(chain);
          glass.position.set(0.42, 0.8, 0.25);
          inst.object.add(glass);
          this.rig = rig(inst, { idle: 'CharacterArmature|Idle', walk: 'CharacterArmature|Walk', run: 'CharacterArmature|Run', talk: 'CharacterArmature|Attack', act: 'CharacterArmature|Shoot', angry: 'CharacterArmature|Jump', happy: 'CharacterArmature|Attack', hit: 'CharacterArmature|Death' }, ['talk', 'act', 'angry', 'happy', 'hit']);
        } else {
          const b = fallbackBody('#6d1a2b', 1.3);
          chain.position.y = 0.95;
          b.add(chain);
          this.group.add(b);
        }
        this.height = 1.3;
        this.radius = 0.45;
        this.speed = 1.1;
        break;
      }
      case 'vac': {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.11, 22), std('#2c3e50'));
        body.position.y = 0.07;
        g.add(body);
        const bumper = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.05, 22), std('#7f8c8d'));
        bumper.position.y = 0.05;
        g.add(bumper);
        const led = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12), new THREE.MeshStandardMaterial({ color: '#2ecc71', emissive: '#2ecc71', emissiveIntensity: 1.5 }));
        led.position.set(0, 0.135, 0.13);
        g.add(led);
        // a tiny beret, it is a French vacuum
        const beret = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std('#1b1b1b', { metalness: 0, roughness: 1 }));
        beret.scale.y = 0.35;
        beret.position.set(0.04, 0.13, -0.06);
        g.add(beret);
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.04, 4), std('#1b1b1b'));
        stalk.position.set(0.04, 0.18, -0.06);
        g.add(stalk);
        for (const s of [-1, 1]) {
          const brush = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.02), std('#f1c40f'));
          brush.position.set(s * 0.22, 0.02, 0.22);
          brush.name = 'brush';
          g.add(brush);
        }
        this.group.add(g);
        this.height = 0.2;
        this.radius = 0.32;
        this.speed = 0.9;
        break;
      }
    }
  }

  say(text: string, seconds = 3.5): void {
    bubbles.say(this.group, this.height + 0.45, text, seconds, this.name);
  }

  /** Plays a clip once for a while, on top of walking. */
  act(c: Clip, seconds: number): void {
    this.oneShot = seconds;
    this.oneShotClip = c;
  }

  get acting(): boolean {
    return this.oneShot > 0;
  }

  goTo(dest: THREE.Vector3, nav: NavGrid): void {
    this.dest = dest.clone();
    this.path = nav.route(this.pos, dest);
    this.stuckT = 0;
    this.stuckBest = Infinity;
    this.faceYaw = null;
  }

  /** Walks a straight line (through the doors), no planning. */
  goStraight(dest: THREE.Vector3): void {
    this.dest = dest.clone();
    this.path = [dest.clone()];
    this.stuckT = 0;
    this.stuckBest = Infinity;
    this.faceYaw = null;
  }

  stop(): void {
    this.path = [];
    this.dest = null;
  }

  get arrived(): boolean {
    return this.path.length === 0;
  }

  face(x: number, z: number): void {
    this.faceYaw = Math.atan2(x - this.pos.x, z - this.pos.z);
  }

  /** Moves along the path. Returns true when there. */
  step(dt: number, colliders: AABB[], nav: NavGrid, speedMul = 1): boolean {
    if (!this.path.length) return true;
    const wp = this.path[0];
    const dx = wp.x - this.pos.x;
    const dz = wp.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.12) {
      this.path.shift();
      return this.path.length === 0;
    }
    const s = Math.min(d, this.speed * speedMul * dt);
    this.pos.x += (dx / d) * s;
    this.pos.z += (dz / d) * s;
    this.turnTo(Math.atan2(dx, dz), dt);
    this.moved = true;
    if (!this.ghost) for (const b of colliders) if (!b.disabled && b.tag !== 'dwDoorway') pushOutCircle(this.pos, this.radius, b);
    // stuck? plan again, then skip the waypoint
    if (this.dest) {
      const dd = Math.hypot(this.pos.x - this.dest.x, this.pos.z - this.dest.z);
      if (dd < this.stuckBest - 0.25) {
        this.stuckBest = dd;
        this.stuckT = 0;
      } else {
        this.stuckT += dt;
        if (this.stuckT > 2.5) {
          this.stuckT = 0;
          this.stuckBest = dd;
          if (this.path.length > 1) this.path.shift();
          else if (!this.ghost) this.path = nav.route(this.pos, this.dest);
          if (dd < 0.8) this.path = [];
        }
      }
    }
    return false;
  }

  private turnTo(want: number, dt: number): void {
    let diff = want - this.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.group.rotation.y += diff * Math.min(1, dt * 9);
  }

  /** Animation and placement. Call once per frame after the behaviour. */
  update(dt: number): void {
    this.oneShot -= dt;
    this.spinT += dt;
    if (!this.moved && this.faceYaw !== null) this.turnTo(this.faceYaw, dt);
    let clip: Clip = 'idle';
    if (this.oneShot > 0) clip = this.oneShotClip;
    else if (this.moved) clip = this.speed > 2 ? 'run' : 'walk';
    this.rig?.play(clip);
    this.rig?.update(dt);
    if (this.role === 'vac') {
      this.group.children[0]?.children.forEach((c) => {
        if (c.name === 'brush') c.rotation.y += dt * 25;
      });
    }
    if (this.wobble) {
      const angry = this.oneShot > 0 && (this.oneShotClip === 'angry' || this.oneShotClip === 'act');
      this.wobble.rotation.z = Math.sin(this.spinT * (angry ? 18 : 2)) * (angry ? 0.25 : 0.05);
    }
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.moved = false;
  }
}
