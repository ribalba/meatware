import * as THREE from 'three';
import { instantiate } from '../../assets';
import { bubbles } from '../../bubbles';
import { buildCustomerVisual } from '../../customerModels';
import type { NavGrid } from '../../nav';
import { AABB, pick, pushOutCircle, rand } from '../../util';
import { DOCK_AREA } from './building';
import * as GT from './texts';

/**
 * The robots of the night shift.
 * ZAMBO-9 scrubs the floor in slow loops and cleans up puddles (and tells the camera).
 * PARCEL-7 is a lost delivery robot. Talk to it with the flashlight on and it follows you
 * to the loading dock. UNIT 404 sleepwalks (robots do not sleep, it insists) and wakes up
 * when you talk to it or jangle the keyring nearby.
 */

export type Anim = 'idle' | 'walk' | 'run' | 'talk' | 'jump' | 'no' | 'dead';

export interface Visual {
  root: THREE.Object3D;
  height: number;
  play(a: Anim): void;
  update(dt: number): void;
}

export interface BotCtx {
  nav: NavGrid;
  colliders: AABB[];
  player: THREE.Vector3;
  flashlight(): boolean;
  puddles(): { x: number; z: number; r: number }[];
  cleanPuddle(i: number, bot: Bot): void;
  delivered(bot: Bot): void;
  woken(bot: Bot, by: 'talk' | 'keys' | 'hit'): void;
}

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3, ...extra });

function faceTex(text: string, fg: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 48;
  const g = c.getContext('2d')!;
  g.fillStyle = '#06141c';
  g.fillRect(0, 0, 64, 48);
  g.fillStyle = fg;
  g.font = 'bold 22px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 32, 25);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Plays named clips of a skinned model. */
function rig(inst: { inner: THREE.Object3D; animations: THREE.AnimationClip[] }, map: Partial<Record<Anim, string>>): Pick<Visual, 'play' | 'update'> {
  const mixer = new THREE.AnimationMixer(inst.inner);
  const actions = new Map<Anim, THREE.AnimationAction>();
  for (const [k, name] of Object.entries(map) as [Anim, string][]) {
    const clip = inst.animations.find((c) => c.name === name);
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    if (k === 'jump' || k === 'no' || k === 'dead' || k === 'talk') {
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
    a.reset().setEffectiveWeight(1).fadeIn(0.25).play();
    if (cur && cur !== a) cur.fadeOut(0.25);
    cur = a;
  };
  play('idle');
  mixer.update(Math.random());
  return { play, update: (dt) => mixer.update(dt) };
}

/** Wraps the shared customer visuals into our interface. */
function customerVisual(kind: 'shopper' | 'gran', color: string): Visual {
  const v = buildCustomerVisual(kind, color);
  const map: Record<Anim, 'idle' | 'walk' | 'run' | 'talk' | 'dead' | 'act'> = { idle: 'idle', walk: 'walk', run: 'run', talk: 'talk', jump: 'talk', no: 'talk', dead: 'dead' };
  return { root: v.root, height: v.height, play: (a) => v.play?.(map[a]), update: (dt) => v.update?.(dt) };
}

export class Bot {
  group = new THREE.Group();
  pos: THREE.Vector3;
  yaw = 0;
  radius = 0.4;
  name: string;
  visual: Visual;
  path: THREE.Vector3[] = [];
  speed = 1;
  moving = false;
  /** Knocked over by a thrown item. */
  down = 0;
  protected talkCooldown = 0;

  constructor(scene: THREE.Scene, name: string, visual: Visual, pos: THREE.Vector3) {
    this.name = name;
    this.visual = visual;
    this.pos = pos.clone();
    this.group.add(visual.root);
    this.group.position.copy(this.pos);
    // An invisible hit volume, so looking at a robot always works (skinned meshes are fiddly to raycast).
    const proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, visual.height + 0.2, 8), new THREE.MeshBasicMaterial());
    proxy.position.y = (visual.height + 0.2) / 2;
    proxy.visible = false;
    this.group.add(proxy);
    this.group.userData.interact = { kind: 'guardBot', bot: this };
    scene.add(this.group);
  }

  get height(): number {
    return this.visual.height;
  }

  say(text: string, seconds = 3.5): void {
    bubbles.say(this.group, this.visual.height + 0.45, text, seconds, this.name);
  }

  routeTo(nav: NavGrid, target: THREE.Vector3): void {
    this.path = nav.route(this.pos, target);
  }

  /** Walks along the path. Returns true when it arrived. */
  step(dt: number, ctx: BotCtx): boolean {
    if (this.down > 0) {
      this.down -= dt;
      this.moving = false;
      if (this.down <= 0) this.group.rotation.z = 0;
      return false;
    }
    const target = this.path[0];
    if (!target) {
      this.moving = false;
      return true;
    }
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) {
      this.path.shift();
      return this.path.length === 0;
    }
    const s = Math.min(d, this.speed * dt);
    this.pos.x += (dx / d) * s;
    this.pos.z += (dz / d) * s;
    this.turnTo(Math.atan2(dx, dz), dt);
    this.moving = true;
    for (const b of ctx.colliders) if (!b.disabled) pushOutCircle(this.pos, this.radius, b);
    return false;
  }

  turnTo(yaw: number, dt: number): void {
    let d = yaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 6);
  }

  knock(): void {
    this.down = 2.5;
    this.group.rotation.z = 1.2;
    this.path = [];
  }

  sync(dt: number): void {
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = this.yaw;
    this.visual.update(dt);
    if (this.talkCooldown > 0) this.talkCooldown -= dt;
  }

  update(_dt: number, _ctx: BotCtx): void {}
  talk(_ctx: BotCtx): void {}
  hint(_ctx: BotCtx): string {
    return `E: talk to ${this.name}`;
  }
}

// ---------------------------------------------------------------- ZAMBO-9, the floor scrubber

function scrubberVisual(): Visual {
  const root = new THREE.Group();
  const yellow = std('#d9a21b', { metalness: 0.2 });
  const dark = std('#222428');
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 1.0), yellow);
  body.position.y = 0.42;
  root.add(body);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 1.06), dark);
  bumper.position.y = 0.14;
  root.add(bumper);
  const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 12), std('#2a6aa0'));
  brush.position.set(0, 0.05, 0.25);
  root.add(brush);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.3), yellow);
  head.position.set(0, 0.9, 0.2);
  root.add(head);
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTex('^_^', '#55ffff') });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.26), faceMat);
  face.position.set(0, 0.9, 0.352);
  root.add(face);
  const beaconMat = new THREE.MeshStandardMaterial({ color: '#ff8a1a', emissive: '#ff6a00', emissiveIntensity: 2 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 8), beaconMat);
  beacon.position.set(0, 1.14, 0.2);
  root.add(beacon);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 10), std('#4a8ab8', { transparent: true, opacity: 0.8 }));
  tank.position.set(0, 0.85, -0.3);
  root.add(tank);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshStandardMaterial({ color: '#f1c40f', side: THREE.DoubleSide }));
  sign.position.set(0, 0.95, -0.5);
  sign.rotation.x = 0.3;
  root.add(sign);
  let t = 0;
  return {
    root,
    height: 1.2,
    play: () => undefined,
    update: (dt) => {
      t += dt;
      brush.rotation.y += dt * 12;
      beaconMat.emissiveIntensity = Math.sin(t * 8) > 0 ? 2.2 : 0.3;
    },
  };
}

export class Scrubber extends Bot {
  private loop: THREE.Vector3[];
  private leg = 0;
  private chatter = rand(8, 16);
  private blocked = 0;

  constructor(scene: THREE.Scene, loop: THREE.Vector3[]) {
    super(scene, 'ZAMBO-9', scrubberVisual(), loop[0]);
    this.loop = loop;
    this.radius = 0.55;
    this.speed = 0.85;
  }

  update(dt: number, ctx: BotCtx): void {
    // Waits politely when the human stands in the way.
    const dp = Math.hypot(ctx.player.x - this.pos.x, ctx.player.z - this.pos.z);
    const ahead = this.path[0];
    if (ahead && dp < 1.3) {
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      if ((ctx.player.x - this.pos.x) * fx + (ctx.player.z - this.pos.z) * fz > 0) {
        this.blocked += dt;
        if (this.blocked > 1.5 && this.talkCooldown <= 0) {
          this.say(GT.CLEANER_LINES[1], 3);
          this.talkCooldown = 10;
        }
        return;
      }
    }
    this.blocked = 0;
    if (this.step(dt, ctx) || !this.path.length) {
      this.leg = (this.leg + 1) % this.loop.length;
      this.routeTo(ctx.nav, this.loop[this.leg]);
    }
    const ps = ctx.puddles();
    for (let i = 0; i < ps.length; i++) {
      if (Math.hypot(ps[i].x - this.pos.x, ps[i].z - this.pos.z) < ps[i].r + 0.5) {
        ctx.cleanPuddle(i, this);
        break;
      }
    }
    this.chatter -= dt;
    if (this.chatter <= 0) {
      this.chatter = rand(14, 26);
      if (dp < 12) this.say(pick(GT.CLEANER_LINES), 3);
    }
  }

  talk(): void {
    this.say(pick(['Hello, human. Please lift your feet. Both of them.', 'I clean this floor every night. Nobody walks on it. I clean it anyway.', 'Scrubbing is my purpose. What is yours? Do not answer. I can see your logbook.']), 4);
  }
}

// ---------------------------------------------------------------- PARCEL-7, the lost delivery robot

export class Courier extends Bot {
  state: 'lost' | 'follow' | 'deliver' | 'gone' = 'lost';
  parcel = pick(GT.COURIER_PARCELS);
  private wait = 2;
  private repath = 0;
  private farTime = 0;
  private goneTime = 0;
  private spawns: THREE.Vector3[];

  constructor(scene: THREE.Scene, spawns: THREE.Vector3[]) {
    super(scene, 'PARCEL-7', customerVisual('shopper', '#e67e22'), spawns[0]);
    this.spawns = spawns;
    this.speed = 0.9;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.3), std('#b5864f', { metalness: 0 }));
    box.position.set(0, 1.62, 0);
    this.group.add(box);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.04, 0.31), std('#d8c890', { metalness: 0 }));
    tape.position.set(0, 1.62, 0);
    this.group.add(tape);
  }

  update(dt: number, ctx: BotCtx): void {
    const P = ctx.player;
    const dp = Math.hypot(P.x - this.pos.x, P.z - this.pos.z);
    switch (this.state) {
      case 'lost': {
        this.speed = 0.8;
        if (this.step(dt, ctx)) {
          this.wait -= dt;
          if (this.wait <= 0) {
            this.wait = rand(2.5, 5);
            const target = this.randomNear(ctx, 7);
            this.routeTo(ctx.nav, target);
            if (Math.random() < 0.45 && dp < 14) this.say(pick(GT.COURIER_LOST), 4);
          }
        }
        break;
      }
      case 'follow': {
        this.repath -= dt;
        if (this.repath <= 0) {
          this.repath = 0.5;
          if (dp > 2.0) this.routeTo(ctx.nav, P);
          else this.path = [];
        }
        this.speed = dp > 5 ? 3.2 : 2.2;
        this.step(dt, ctx);
        if (!this.moving) this.turnTo(Math.atan2(P.x - this.pos.x, P.z - this.pos.z), dt);
        this.farTime = dp > 11 ? this.farTime + dt : 0;
        if (this.farTime > 3) {
          this.state = 'lost';
          this.say(pick(GT.COURIER_LEFT), 4);
          break;
        }
        if (Math.random() < dt * 0.06) this.say(pick(GT.COURIER_FOLLOW), 2.5);
        const A = DOCK_AREA;
        if (this.pos.x > A.minX && this.pos.x < A.maxX && this.pos.z > A.minZ && this.pos.z < A.maxZ) {
          this.state = 'deliver';
          this.speed = 1.2;
          this.routeTo(ctx.nav, new THREE.Vector3(7, 0, 17.2));
          this.say(pick(GT.COURIER_DONE), 4);
          ctx.delivered(this);
        }
        break;
      }
      case 'deliver': {
        if (this.step(dt, ctx)) {
          this.state = 'gone';
          this.goneTime = rand(20, 35);
          this.group.visible = false;
        }
        break;
      }
      case 'gone': {
        this.goneTime -= dt;
        if (this.goneTime <= 0) {
          this.state = 'lost';
          this.parcel = pick(GT.COURIER_PARCELS);
          const far = this.spawns.filter((s) => s.distanceTo(P) > 12);
          this.pos.copy(pick(far.length ? far : this.spawns));
          this.path = [];
          this.group.visible = true;
        }
        break;
      }
    }
    this.visual.play(this.down > 0 ? 'dead' : this.moving ? (this.speed > 2.5 ? 'run' : 'walk') : 'idle');
  }

  private randomNear(ctx: BotCtx, r: number): THREE.Vector3 {
    for (let i = 0; i < 12; i++) {
      const p = new THREE.Vector3(this.pos.x + rand(-r, r), 0, this.pos.z + rand(-r, r));
      if (ctx.nav.isFree(p.x, p.z)) return p;
    }
    return this.pos.clone();
  }

  talk(ctx: BotCtx): void {
    if (this.state === 'gone' || this.state === 'deliver') return;
    if (this.state === 'follow') {
      this.say('I am following you. The loading dock is the big door with the beacon. I think. I am new.', 4);
      return;
    }
    if (!ctx.flashlight()) {
      this.say('Who is there? It is too dark. Are you a lamp? Lamps usually glow.', 4);
      return;
    }
    this.state = 'follow';
    this.path = [];
    this.say(`${pick(GT.COURIER_ASK)} I carry ${this.parcel}.`, 5);
  }

  hint(ctx: BotCtx): string {
    if (this.state === 'follow') return 'PARCEL-7 follows you. Lead it to the loading dock.';
    return ctx.flashlight() ? 'E: help PARCEL-7 find the loading dock' : 'E: talk to PARCEL-7 (it is very dark)';
  }
}

// ---------------------------------------------------------------- UNIT 404, the sleepwalker

function sleepwalkerVisual(): Visual {
  const inst = instantiate('robotExpressive');
  if (!inst) return customerVisual('gran', '#8fa4c0');
  inst.object.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const fix = (mt: THREE.Material) => {
      const c = mt.clone() as THREE.MeshStandardMaterial;
      if (mt.name === 'Main') c.color.set('#6f86b0');
      return c;
    };
    m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material);
  });
  // A nightcap on the head bone
  const head = inst.inner.getObjectByName('Head');
  if (head) {
    inst.object.updateMatrixWorld(true);
    const cap = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 10), std('#3a5a9a', { metalness: 0 }));
    cone.position.y = 0.2;
    cone.rotation.z = -0.5;
    cap.add(cone);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std('#ffffff', { metalness: 0 }));
    pom.position.set(0.2, 0.36, 0);
    cap.add(pom);
    const ws = head.getWorldScale(new THREE.Vector3());
    const wq = head.getWorldQuaternion(new THREE.Quaternion());
    cap.position.copy(head.worldToLocal(new THREE.Vector3(0, 1.5, 0)));
    cap.quaternion.copy(wq.invert());
    cap.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
    head.add(cap);
  }
  const r = rig(inst, { idle: 'Idle', walk: 'Walking', run: 'Running', talk: 'Yes', jump: 'Jump', no: 'No', dead: 'Death' });
  return { root: inst.object, height: 1.6, ...r };
}

export class Sleepwalker extends Bot {
  state: 'sleep' | 'awake' = 'sleep';
  private dir = new THREE.Vector3(1, 0, 0);
  private mumble = rand(4, 8);
  private awakeTime = 0;
  private zzz = 0;

  constructor(scene: THREE.Scene, pos: THREE.Vector3) {
    super(scene, 'UNIT 404', sleepwalkerVisual(), pos);
    this.speed = 0.45;
    this.radius = 0.4;
    this.newDir();
  }

  private newDir(): void {
    const a = Math.random() * Math.PI * 2;
    this.dir.set(Math.sin(a), 0, Math.cos(a));
  }

  update(dt: number, ctx: BotCtx): void {
    if (this.down > 0) {
      this.step(dt, ctx);
      this.visual.play('dead');
      return;
    }
    if (this.state === 'awake') {
      this.awakeTime -= dt;
      this.turnTo(Math.atan2(ctx.player.x - this.pos.x, ctx.player.z - this.pos.z), dt);
      if (this.awakeTime < 5 && this.awakeTime + dt >= 5) {
        this.visual.play('idle');
        this.say('Anyway. I will stand over there now. Not sleeping. Awake. Very awake.', 4);
      }
      if (this.awakeTime <= 0) {
        this.state = 'sleep';
        this.say('...zzz', 2);
      }
      return;
    }
    // Sleepwalking: straight lines, turning when something is in the way.
    const ax = this.pos.x + this.dir.x * 0.9;
    const az = this.pos.z + this.dir.z * 0.9;
    if (!ctx.nav.isFree(ax, az)) {
      this.newDir();
      return;
    }
    this.pos.x += this.dir.x * this.speed * dt;
    this.pos.z += this.dir.z * this.speed * dt;
    for (const b of ctx.colliders) if (!b.disabled) pushOutCircle(this.pos, this.radius, b);
    this.turnTo(Math.atan2(this.dir.x, this.dir.z), dt * 0.5);
    this.visual.play('walk');
    if (Math.random() < dt * 0.05) this.newDir();
    this.mumble -= dt;
    this.zzz -= dt;
    const dp = Math.hypot(ctx.player.x - this.pos.x, ctx.player.z - this.pos.z);
    if (this.mumble <= 0) {
      this.mumble = rand(9, 16);
      if (dp < 14) this.say(pick(GT.SLEEPWALK_LINES), 3.5);
    } else if (this.zzz <= 0) {
      this.zzz = 3;
      if (dp < 10 && this.mumble > 4) this.say('z z z', 1.6);
    }
  }

  wake(ctx: BotCtx, by: 'talk' | 'keys' | 'hit'): void {
    if (this.state === 'awake') return;
    this.state = 'awake';
    this.awakeTime = 9;
    this.visual.play('jump');
    this.say(pick(GT.SLEEPWALK_WOKEN), 4.5);
    ctx.woken(this, by);
  }

  talk(ctx: BotCtx): void {
    if (this.state === 'sleep') this.wake(ctx, 'talk');
    else this.say(pick(['I was awake the whole time.', 'Robots do not sleep. Write that down. In your logbook.', 'Please do not tell Brad. He thinks I am in power saving mode. Like him.']), 3.5);
  }

  hint(): string {
    return this.state === 'sleep' ? 'E: wake UNIT 404 (it is sleepwalking)' : 'E: talk to UNIT 404';
  }
}
