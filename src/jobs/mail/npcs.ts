import * as THREE from 'three';
import { bubbles } from '../../bubbles';
import { buildCustomerVisual, CustomerVisual } from '../../customerModels';
import type { Item } from '../../items';
import type { Interact } from '../../level';
import type { NavGrid } from '../../nav';
import { pick, pushOutCircle, rand } from '../../util';
import type { Shift } from '../types';
import type { Cage, Cubby, MailOffice } from './building';
import { CAGE_X, PUBLIC_Y } from './building';
import { mailOf } from './mail';
import * as T from './texts';
import { screenCanvas } from './textures';

/**
 * The robots of the sorting office:
 * COLLECT-O 2 empties full pigeonholes and cages and complains about every mistake,
 * RX-88 queues at the counter window to send a parcel to itself,
 * GOOD BOY 3000 hates postal workers, and SORT-O-MATIC 3000 jams and sprays letters.
 */

/** What the robots need from the job. */
export interface JobApi {
  readonly s: Shift;
  readonly level: MailOffice;
  /** Empties a hole or cage. Returns what was wrong with it. */
  collect(target: Cubby | Cage): { total: number; wrong: string[]; unfranked: number };
  /** Hands the counter robot's parcel to the player. */
  giveSelfParcel(): void;
  /** Throws n fresh letters out of the machine onto the floor. */
  spray(n: number): void;
  /** Brad gets annoyed when he is near. */
  complain(at: THREE.Vector3, key: string, amount: number): void;
  /** The dog chewed on a piece of mail. */
  chewed(it: Item): void;
}

const tmp = new THREE.Vector3();

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Something that walks along nav routes. */
class Walker {
  group = new THREE.Group();
  pos: THREE.Vector3;
  path: THREE.Vector3[] = [];
  yaw = 0;
  moving = false;

  constructor(scene: THREE.Scene, pos: THREE.Vector3, public speed: number, public radius: number) {
    this.pos = pos.clone();
    this.group.position.copy(this.pos);
    scene.add(this.group);
  }

  goTo(nav: NavGrid, target: THREE.Vector3): void {
    this.path = nav.route(this.pos, target);
  }

  /** Moves along the path. True when there is nothing left to walk. */
  step(dt: number, speed = this.speed): boolean {
    this.moving = false;
    while (this.path.length) {
      const t = this.path[0];
      const dx = t.x - this.pos.x;
      const dz = t.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.12) {
        this.path.shift();
        continue;
      }
      const s = Math.min(d, speed * dt);
      this.pos.x += (dx / d) * s;
      this.pos.z += (dz / d) * s;
      this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8));
      this.moving = true;
      break;
    }
    this.sync();
    return this.path.length === 0;
  }

  face(x: number, z: number, dt: number): void {
    this.yaw = lerpAngle(this.yaw, Math.atan2(x - this.pos.x, z - this.pos.z), Math.min(1, dt * 6));
    this.sync();
  }

  sync(): void {
    this.group.position.set(this.pos.x, this.group.position.y, this.pos.z);
    this.group.rotation.y = this.yaw;
  }
}

// ==================================================================== COLLECT-O 2

export class PostBot {
  w: Walker;
  visual: CustomerVisual;
  state: 'dock' | 'go' | 'collect' | 'back' = 'dock';
  private timer = 14;
  private target: Cubby | Cage | null = null;
  private idleChecks = 0;

  constructor(private api: JobApi) {
    const lv = api.level;
    this.w = new Walker(api.s.scene, lv.dock, 1.5, 0.6);
    this.visual = buildCustomerVisual('bulk', '#2e5fa8');
    this.w.group.add(this.visual.root);
    // A mail sack in the trolley and a postal cap
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshStandardMaterial({ color: '#5d6d7e', roughness: 0.95 }));
    sack.scale.set(1.1, 0.8, 1);
    sack.position.set(0, 0.85, 0.95);
    this.visual.root.add(sack);
    this.w.yaw = Math.PI / 2;
    this.w.sync();
    this.w.group.userData.interact = { kind: 'postbot' } satisfies Interact;
  }

  get group(): THREE.Group {
    return this.w.group;
  }

  say(text: string, sec = 4): void {
    bubbles.say(this.w.group, this.visual.height + 0.45, text, sec, T.POSTBOT_NAME);
  }

  private pickTarget(): Cubby | Cage | null {
    const lv = this.api.level;
    const cubby = lv.cubbies.filter((c) => c.entries.length >= 4).sort((a, b) => b.entries.length - a.entries.length)[0];
    if (cubby) return cubby;
    const cage = lv.cages.filter((c) => c.entries.length >= 3).sort((a, b) => b.entries.length - a.entries.length)[0];
    if (cage) return cage;
    // Every now and then it comes for whatever is there.
    if (this.idleChecks >= 2) {
      const any = [...lv.cubbies.filter((c) => c.entries.length >= 2), ...lv.cages.filter((c) => c.entries.length >= 2)];
      if (any.length) return pick(any);
    }
    return null;
  }

  private standPoint(t: Cubby | Cage): THREE.Vector3 {
    if ('col' in t) return new THREE.Vector3(t.pos.x, 0, -9.4);
    return t.front.clone();
  }

  update(dt: number): void {
    const s = this.api.s;
    const v = this.visual;
    v.update?.(dt);
    switch (this.state) {
      case 'dock':
        v.play?.('idle');
        this.w.face(this.w.pos.x + 1, this.w.pos.z, dt);
        this.timer -= dt;
        if (this.timer <= 0) {
          this.target = this.pickTarget();
          if (this.target) {
            this.idleChecks = 0;
            this.state = 'go';
            this.w.goTo(s.nav, this.standPoint(this.target));
            if (Math.random() < 0.5) this.say(pick(['Collection time. Brace yourselves.', 'Rolling out. Judging begins.', 'I smell full holes.']), 3);
          } else {
            this.idleChecks++;
            this.timer = 9;
          }
        }
        break;
      case 'go':
        v.play?.('walk');
        if (this.w.step(dt)) {
          this.state = 'collect';
          this.timer = 2.2;
          v.play?.('act');
        }
        break;
      case 'collect': {
        const t = this.target!;
        const p = 'col' in t ? t.pos : t.pos;
        this.w.face(p.x, p.z, dt);
        this.timer -= dt;
        if (this.timer <= 0) {
          const res = this.api.collect(t);
          if (res.total === 0) {
            this.say('Empty. Someone was here first. Was it you? It was me.', 3);
          } else if (res.wrong.length) {
            this.say(res.wrong[0], 5);
            this.api.complain(this.w.pos, 'mailComplaint', 10 * res.wrong.length + 6 * res.unfranked);
          } else if (res.unfranked) {
            this.say(T.POSTBOT_UNFRANKED[0].replace('{n}', String(res.unfranked)), 5);
            this.api.complain(this.w.pos, 'mailComplaint', 8 * res.unfranked);
          } else {
            this.say(pick(T.POSTBOT_OK), 4);
          }
          this.state = 'back';
          this.w.goTo(s.nav, this.api.level.dock);
        }
        break;
      }
      case 'back':
        v.play?.('walk');
        if (this.w.step(dt)) {
          this.state = 'dock';
          this.timer = rand(10, 16);
        }
        break;
    }
  }

  talk(): void {
    this.say(pick(T.POSTBOT_TALK), 3);
  }

  hit(): void {
    this.say(pick(T.POSTBOT_HIT), 3);
    this.visual.play?.('talk');
  }
}

// ==================================================================== RX-88 at the counter window

export class CounterBot {
  group = new THREE.Group();
  visual: CustomerVisual;
  state: 'away' | 'enter' | 'wait' | 'waitBack' | 'leave' = 'away';
  served = 0;
  private timer = 8;
  private ring = 0;
  private complained = false;
  private path: THREE.Vector3[] = [];
  private parcel: THREE.Mesh;
  private pos: THREE.Vector3;

  constructor(private api: JobApi) {
    const lv = api.level;
    this.pos = lv.publicDoor.clone();
    this.visual = buildCustomerVisual('shopper', '#16a085');
    this.group.add(this.visual.root);
    this.parcel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.26), new THREE.MeshStandardMaterial({ color: '#b08a58', roughness: 0.9 }));
    this.parcel.position.set(0, 0.95, 0.35);
    this.group.add(this.parcel);
    this.group.position.set(this.pos.x, PUBLIC_Y, this.pos.z);
    this.group.visible = false;
    this.group.userData.interact = { kind: 'counterbot' } satisfies Interact;
    api.s.scene.add(this.group);
  }

  say(text: string, sec = 4): void {
    bubbles.say(this.group, this.visual.height + 0.45, text, sec, T.COUNTER_NAME);
  }

  private walk(dt: number): boolean {
    const t = this.path[0];
    if (!t) return true;
    const dx = t.x - this.pos.x;
    const dz = t.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.08) {
      this.path.shift();
      return this.path.length === 0;
    }
    const s = Math.min(d, 1.3 * dt);
    this.pos.x += (dx / d) * s;
    this.pos.z += (dz / d) * s;
    this.group.rotation.y = Math.atan2(dx, dz);
    this.group.position.set(this.pos.x, PUBLIC_Y, this.pos.z);
    return false;
  }

  update(dt: number): void {
    const s = this.api.s;
    const v = this.visual;
    v.update?.(dt);
    const lv = this.api.level;
    switch (this.state) {
      case 'away':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'enter';
          this.group.visible = true;
          this.parcel.visible = true;
          this.pos.copy(lv.publicDoor);
          this.path = [new THREE.Vector3(lv.publicDoor.x, 0, 12.5), new THREE.Vector3(lv.windowSpot.x - 1.2, 0, 12.5), lv.windowSpot.clone()];
        }
        break;
      case 'enter':
        v.play?.('walk');
        if (this.walk(dt)) {
          this.state = 'wait';
          this.timer = 0;
          this.ring = 0.5;
          this.complained = false;
          this.group.rotation.y = Math.PI;
          v.play?.('idle');
          this.say(T.COUNTER_WAIT[0], 4);
        }
        break;
      case 'wait':
        this.group.rotation.y = Math.PI;
        this.timer += dt;
        this.ring -= dt;
        if (this.ring <= 0) {
          this.ring = 9;
          this.dingBell();
          if (this.timer > 4) this.say(pick(T.COUNTER_WAIT), 3.5);
        }
        if (this.timer > 32 && !this.complained) {
          this.complained = true;
          this.say('I have been waiting 32 seconds. That is 32 billion cycles. I want your manager.', 4.5);
          this.api.complain(s.player.pos, 'mailCounter', 15);
          s.chat('mailCounter');
        }
        break;
      case 'waitBack':
        this.group.rotation.y = Math.PI;
        this.timer += dt;
        if (this.timer > 70) {
          this.say(pick(T.COUNTER_LOST), 4);
          this.leave();
        }
        break;
      case 'leave':
        v.play?.('walk');
        if (this.walk(dt)) {
          this.state = 'away';
          this.group.visible = false;
          this.timer = rand(14, 22);
        }
        break;
    }
  }

  dingBell(): void {
    const sfx = this.api.s.sfx;
    sfx.tone(1760, 0.25, 'sine', 0.06);
    sfx.tone(1760, 0.4, 'sine', 0.04, undefined, 0.05);
    const b = this.api.level.bell;
    b.scale.y = 0.7;
    setTimeout(() => (b.scale.y = 1), 120);
  }

  leave(): void {
    this.state = 'leave';
    const lv = this.api.level;
    this.path = [new THREE.Vector3(lv.windowSpot.x - 1.2, 0, 12.5), new THREE.Vector3(lv.publicDoor.x, 0, 12.5), lv.publicDoor.clone()];
  }

  /** E on the robot. */
  use(held: Item | null): void {
    const m = mailOf(held?.def);
    if (this.state === 'wait' && !held) {
      this.parcel.visible = false;
      this.say(pick(T.COUNTER_GIVE), 3.5);
      this.api.giveSelfParcel();
      this.state = 'waitBack';
      this.timer = 0;
      this.visual.play?.('talk');
      return;
    }
    if (this.state === 'waitBack' && m?.kind === 'self') {
      this.api.s.removeHeld();
      this.parcel.visible = true;
      this.served++;
      this.say(pick(T.COUNTER_THANKS), 4);
      this.visual.play?.('talk');
      this.leave();
      this.parcel.visible = true;
      return;
    }
    if (held) {
      this.say(pick(T.COUNTER_WRONG), 3);
      return;
    }
    if (this.state === 'waitBack') this.say('I am waiting for me. Please hurry. I am very important to me.', 3.5);
    else this.say('Hello. I am a customer. Customers are always right.', 3);
  }

  /** The parcel got sorted into a cage instead of handed back. */
  lost(): void {
    if (this.state !== 'waitBack') return;
    this.timer = 55;
  }
}

// ==================================================================== GOOD BOY 3000

type DogState = 'roam' | 'chase' | 'flee' | 'fetch' | 'bring' | 'stunned' | 'friendly' | 'scared';

export class Dog {
  w: Walker;
  state: DogState = 'roam';
  friendly = false;
  bites = 0;
  snatches = 0;
  fetches = 0;
  private timer = 3;
  private cooldown = 25;
  private bark = 0;
  private repath = 0;
  private legs: THREE.Object3D[] = [];
  private tail: THREE.Object3D;
  private head: THREE.Object3D;
  private faceDraw: (text: string, color: string) => void;
  private carried: Item | null = null;
  private fetchItem: Item | null = null;
  private walkT = 0;
  readonly height = 0.85;

  constructor(private api: JobApi) {
    this.w = new Walker(api.s.scene, new THREE.Vector3(6, 0, 7), 1.6, 0.4);
    const g = this.w.group;
    const metal = new THREE.MeshStandardMaterial({ color: '#8d99a6', roughness: 0.45, metalness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.5, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.72), metal);
    body.position.y = 0.5;
    g.add(body);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.5), dark);
    back.position.y = 0.66;
    g.add(back);
    this.head = new THREE.Group();
    this.head.position.set(0, 0.68, 0.42);
    g.add(this.head);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.28), metal);
    this.head.add(skull);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.16), dark);
    snout.position.set(0, -0.06, 0.2);
    this.head.add(snout);
    const sc = screenCanvas(48, 32);
    this.faceDraw = (text, color) => {
      sc.g.fillStyle = '#05080c';
      sc.g.fillRect(0, 0, 48, 32);
      sc.g.fillStyle = color;
      sc.g.font = 'bold 14px monospace';
      sc.g.textAlign = 'center';
      sc.g.fillText(text, 24, 21);
      sc.tex.needsUpdate = true;
    };
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.12), new THREE.MeshBasicMaterial({ map: sc.tex }));
    face.position.set(0, 0.05, 0.142);
    this.head.add(face);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.04), dark);
      ear.position.set(s * 0.11, 0.17, -0.04);
      ear.rotation.z = s * -0.3;
      this.head.add(ear);
    }
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 12), new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.6 }));
    collar.position.set(0, 0.6, 0.3);
    g.add(collar);
    const tagM = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 8), new THREE.MeshStandardMaterial({ color: '#f1c40f', metalness: 0.8, roughness: 0.3 }));
    tagM.rotation.x = Math.PI / 2;
    tagM.position.set(0, 0.47, 0.42);
    g.add(tagM);
    for (const [x, z] of [[-0.12, 0.26], [0.12, 0.26], [-0.12, -0.26], [0.12, -0.26]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.4, z);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.38, 6), dark);
      leg.position.y = -0.2;
      pivot.add(leg);
      const paw = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.1), metal);
      paw.position.set(0, -0.39, 0.02);
      pivot.add(paw);
      g.add(pivot);
      this.legs.push(pivot);
    }
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.58, -0.36);
    const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.3, 6), dark);
    tl.position.y = 0.14;
    this.tail.add(tl);
    this.tail.rotation.x = -0.6;
    g.add(this.tail);
    g.userData.interact = { kind: 'dog' } satisfies Interact;
    this.faceDraw('>:(', '#ff4d4d');
  }

  get group(): THREE.Group {
    return this.w.group;
  }

  say(text: string, sec = 2.5): void {
    bubbles.say(this.w.group, this.height + 0.45, text, sec, T.DOG_NAME);
  }

  private woof(): void {
    const sfx = this.api.s.sfx;
    sfx.tone(320, 0.08, 'square', 0.09, 180);
    sfx.tone(300, 0.1, 'square', 0.08, 160, 0.14);
  }

  private roamTarget(): THREE.Vector3 {
    const nav = this.api.s.nav;
    for (let i = 0; i < 12; i++) {
      const p = new THREE.Vector3(rand(-12, 12), 0, rand(-9, 9.5));
      if (nav.isFree(p.x, p.z)) return p;
    }
    return new THREE.Vector3(4, 0, 6);
  }

  /** Direct steering with collider push-out, for chasing. */
  private steer(target: THREE.Vector3, speed: number, dt: number): number {
    const dx = target.x - this.w.pos.x;
    const dz = target.z - this.w.pos.z;
    const d = Math.hypot(dx, dz);
    this.repath -= dt;
    if (this.repath <= 0 || !this.w.path.length) {
      this.repath = 0.5;
      this.w.goTo(this.api.s.nav, target);
    }
    this.w.step(dt, speed);
    for (const b of this.api.level.colliders) if (!b.disabled) pushOutCircle(this.w.pos, this.w.radius, b);
    this.w.sync();
    return d;
  }

  private holdInMouth(it: Item): void {
    this.carried = it;
    this.api.s.scene.remove(it.mesh);
    this.head.add(it.mesh);
    it.mesh.position.set(0, -0.12, 0.3);
    it.mesh.rotation.set(0, Math.PI / 2, 0);
    it.state = 'fixed';
  }

  private dropCarried(): void {
    const it = this.carried;
    if (!it) return;
    this.carried = null;
    const s = this.api.s;
    this.head.remove(it.mesh);
    s.scene.add(it.mesh);
    const f = new THREE.Vector3(Math.sin(this.w.yaw), 0, Math.cos(this.w.yaw));
    it.mesh.position.set(this.w.pos.x + f.x * 0.6, 0.4, this.w.pos.z + f.z * 0.6);
    it.mesh.rotation.set(0, this.w.yaw, 0);
    it.state = 'world';
    it.sleeping = false;
    it.vel.set(0, 0, 0);
    if (!s.items.includes(it)) s.items.push(it);
  }

  makeFriendly(): void {
    this.friendly = true;
    this.dropCarried();
    this.state = 'friendly';
    this.faceDraw('^w^', '#7cff6a');
    this.say(pick(T.DOG_FRIENDLY), 4);
  }

  update(dt: number): void {
    const s = this.api.s;
    const P = s.player.pos;
    const dist = Math.hypot(P.x - this.w.pos.x, P.z - this.w.pos.z);
    this.cooldown -= dt;
    this.bark -= dt;
    // The player grabbed the mail back out of the mouth
    if (this.carried && this.carried.state === 'held') {
      this.carried = null;
      if (this.state === 'flee' || this.state === 'bring') {
        this.state = 'roam';
        this.cooldown = 8;
        this.say('HEY. That was mine. It was yours. It was mine.', 2.5);
      }
    }
    const heldDef = s.held?.def;
    const scaredOfBag = heldDef?.id === 'mailKeyBag';
    // Thrown things are irresistible
    if (!this.friendly && (this.state === 'roam' || this.state === 'chase') && !this.carried) {
      const thrown = s.items.find((i) => i.thrown && i.state === 'world' && i.mesh.position.distanceTo(this.w.pos) < 9 && !i.def.fixture);
      if (thrown) {
        this.fetchItem = thrown;
        this.state = 'fetch';
        this.say(pick(T.DOG_FETCH), 2);
      }
    }
    switch (this.state) {
      case 'roam':
        this.faceDraw(this.cooldown > 0 ? '-_-' : '>:(', this.cooldown > 0 ? '#9ec4e8' : '#ff4d4d');
        if (!this.w.path.length) {
          this.timer -= dt;
          if (this.timer <= 0) {
            this.w.goTo(s.nav, this.roamTarget());
            this.timer = rand(1, 3);
          }
        }
        this.w.step(dt, 1.4);
        if (this.cooldown <= 0 && dist < 5.5 && !s.movementLocked && !scaredOfBag && !this.inBooth(P)) {
          this.state = 'chase';
          this.bark = 0;
          s.chat('mailDog');
        }
        if (scaredOfBag && dist < 3 && this.bark <= 0) {
          this.bark = 5;
          this.say(pick(T.DOG_FEAR), 3);
        }
        break;
      case 'chase': {
        this.faceDraw('>:O', '#ff4d4d');
        if (this.bark <= 0) {
          this.bark = 1.8;
          this.woof();
          this.say(pick(T.DOG_BARK), 1.6);
        }
        if (scaredOfBag) {
          this.say(pick(T.DOG_FEAR), 3);
          this.state = 'roam';
          this.cooldown = 10;
          break;
        }
        const d = this.steer(P, 3.5, dt);
        if (d > 11 || this.inBooth(P)) {
          this.state = 'roam';
          this.cooldown = 6;
          this.say('Woof. You win this time, uniform.', 2.5);
          break;
        }
        if (d < 0.95) this.attack();
        break;
      }
      case 'flee': {
        this.faceDraw('>:D', '#f1c40f');
        this.timer -= dt;
        // Run away from the player
        const away = tmp.set(this.w.pos.x - P.x, 0, this.w.pos.z - P.z).normalize().multiplyScalar(4).add(this.w.pos);
        away.x = Math.max(-12.5, Math.min(12.5, away.x));
        away.z = Math.max(-9.5, Math.min(9.5, away.z));
        this.steer(away, 3.2, dt);
        if (this.timer <= 0 || (dist < 0.9 && this.timer < 4.5)) {
          const it = this.carried;
          this.dropCarried();
          if (it) this.api.chewed(it);
          this.say('Ptoo. Delivered.', 2);
          this.state = 'roam';
          this.cooldown = 25;
        }
        break;
      }
      case 'fetch': {
        this.faceDraw('o_o', '#f1c40f');
        const it = this.fetchItem;
        if (!it || it.state !== 'world') {
          this.state = 'roam';
          break;
        }
        const d = this.steer(it.mesh.position, 3.8, dt);
        if (d < 0.6 && it.sleeping) {
          this.holdInMouth(it);
          this.fetchItem = null;
          this.state = 'bring';
          this.timer = 12;
        }
        break;
      }
      case 'bring': {
        this.faceDraw('^o^', '#7cff6a');
        this.timer -= dt;
        const d = this.steer(P, 3.0, dt);
        if (d < 1.3 || this.timer <= 0) {
          const it = this.carried;
          this.dropCarried();
          this.fetches++;
          if (it && mailOf(it.def)) this.api.chewed(it);
          this.say('Fetched. Good boy. Do not throw again. Throw again.', 3);
          s.hype += 6;
          this.state = 'roam';
          this.cooldown = 10;
        }
        break;
      }
      case 'stunned':
        this.faceDraw('x_x', '#ff4d4d');
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'chase';
          this.cooldown = 0;
          this.say('REBOOTED. ANGRIER.', 2.5);
        }
        break;
      case 'friendly': {
        this.faceDraw('^w^', '#7cff6a');
        if (dist > 2.2) this.steer(P, 3.0, dt);
        else this.w.face(P.x, P.z, dt);
        if (this.bark <= 0 && dist < 4) {
          this.bark = rand(12, 20);
          this.say(pick(T.DOG_FRIENDLY), 3);
        }
        break;
      }
      case 'scared':
        break;
    }
    this.animate(dt);
  }

  private inBooth(p: THREE.Vector3): boolean {
    const b = this.api.level.booth;
    return p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ;
  }

  private attack(): void {
    const s = this.api.s;
    const held = s.held;
    if (held && mailOf(held.def)) {
      s.detachHeld();
      this.holdInMouth(held);
      this.snatches++;
      this.say(pick(T.DOG_SNATCH), 2);
      s.say('The dog snatches the mail out of your hands.', 3);
      s.hype += 10;
      s.chat('mailDog', {}, 2);
      s.sfx.whoosh();
      this.state = 'flee';
      this.timer = 6;
      if (s.seen) s.bossSay('mailDog');
      return;
    }
    this.bites++;
    this.woof();
    s.say(pick(T.DOG_BITE), 3);
    s.hype += 6;
    s.chat('mailDog');
    s.sfx.thud();
    this.state = 'roam';
    this.cooldown = 24;
    this.w.path = [];
  }

  /** Hit by a thrown item. */
  hit(): void {
    if (this.friendly) {
      this.say('Ow. I still love you. Legally I have to.', 3);
      return;
    }
    this.dropCarried();
    this.state = 'stunned';
    this.timer = 3;
    this.say('YELP.', 1.5);
    const s = this.api.s;
    s.hype += 8;
    if (s.seen) {
      s.annoyance += 15;
      s.bossSay('mailDog', true);
    }
  }

  /** E on the dog. */
  pet(): void {
    const s = this.api.s;
    if (this.friendly) {
      this.say('Wag. Wag. Best day of my operational life.', 3);
      s.hype += 2;
      return;
    }
    this.woof();
    this.say('GRRR. DO NOT PET. I AM ON DUTY.', 2.5);
    if (this.state === 'roam' && this.cooldown < 3) {
      this.state = 'chase';
    }
  }

  private animate(dt: number): void {
    const moving = this.w.moving;
    this.walkT += dt * (moving ? (this.state === 'chase' || this.state === 'fetch' ? 16 : 9) : 0);
    this.legs.forEach((l, i) => (l.rotation.x = moving ? Math.sin(this.walkT + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.5 : 0));
    const wag = this.state === 'friendly' || this.state === 'bring' || this.state === 'flee';
    this.tail.rotation.z = wag ? Math.sin(performance.now() / 70) * 0.7 : Math.sin(performance.now() / 400) * 0.1;
    this.head.rotation.x = this.state === 'chase' ? Math.sin(performance.now() / 90) * 0.12 : 0;
    this.w.group.position.y = moving ? Math.abs(Math.sin(this.walkT)) * 0.03 : 0;
  }
}

// ==================================================================== SORT-O-MATIC 3000

export class Sortomatic {
  state: 'ok' | 'warn' | 'spray' | 'happy' = 'ok';
  sprays = 0;
  kicks = 0;
  private timer = rand(38, 50);
  private sprayLeft = 0;
  private sprayT = 0;
  private faceText = '';
  private bubbleT = 0;
  readonly height = 2.0;

  constructor(private api: JobApi) {
    this.face('^_^', '#7cff6a');
  }

  get group(): THREE.Group {
    return this.api.level.machine.group;
  }

  say(text: string, sec = 3.5): void {
    bubbles.say(this.group, this.height + 0.6, text, sec, T.SORTO_NAME);
  }

  face(text: string, color: string): void {
    const key = text + color;
    if (key === this.faceText) return;
    this.faceText = key;
    const { g, tex } = this.api.level.machine.face;
    g.fillStyle = '#04100a';
    g.fillRect(0, 0, 96, 64);
    g.fillStyle = color;
    g.font = 'bold 26px monospace';
    g.textAlign = 'center';
    g.fillText(text, 48, 40);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (let y = 0; y < 64; y += 3) g.fillRect(0, y, 96, 1);
    tex.needsUpdate = true;
  }

  update(dt: number, t: number): void {
    const m = this.api.level.machine;
    const s = this.api.s;
    this.timer -= dt;
    this.bubbleT -= dt;
    switch (this.state) {
      case 'ok':
        this.face(Math.sin(t * 0.7) > 0.95 ? '-_-' : '^_^', '#7cff6a');
        m.body.position.set(0, 0, 0);
        m.beacon.emissiveIntensity = 0.2;
        if (this.timer <= 0) {
          this.state = 'warn';
          this.timer = 7;
          this.say(pick(T.SORTO_WARN), 4);
          s.sfx.alarm();
        }
        break;
      case 'warn':
        this.face(Math.floor(t * 4) % 2 ? '>_<' : 'O_O', '#ff4d4d');
        m.body.position.set(Math.sin(t * 40) * 0.025, 0, Math.cos(t * 33) * 0.02);
        m.beacon.emissiveIntensity = Math.sin(t * 12) > 0 ? 3 : 0.2;
        if (this.bubbleT <= 0) {
          this.bubbleT = 2.2;
          s.sfx.tone(220, 0.12, 'square', 0.05);
        }
        if (this.timer <= 0) this.startSpray(4);
        break;
      case 'spray':
        this.face('@_@', '#f1c40f');
        m.body.position.set(Math.sin(t * 60) * 0.04, 0, 0);
        m.beacon.emissiveIntensity = 3;
        this.sprayT -= dt;
        if (this.sprayT <= 0 && this.sprayLeft > 0) {
          this.sprayT = 0.25;
          this.sprayLeft--;
          this.api.spray(1);
          s.sfx.whoosh();
        }
        if (this.sprayLeft <= 0) {
          this.state = 'ok';
          this.timer = rand(55, 75);
          this.say('Better now. I feel lighter. You feel heavier. That is teamwork.', 3.5);
        }
        break;
      case 'happy':
        this.face('T_T', '#9ec4e8');
        m.body.position.set(0, 0, 0);
        m.beacon.emissiveIntensity = 0.2;
        if (this.timer <= 0) {
          this.state = 'ok';
          this.timer = rand(40, 60);
        }
        break;
    }
  }

  startSpray(n: number): void {
    this.state = 'spray';
    this.sprayLeft = n;
    this.sprayT = 0;
    this.sprays++;
    this.say(pick(T.SORTO_SPRAY), 3);
    const s = this.api.s;
    s.hype += 12;
    s.chat('mailSpray', {}, 2);
    if (!s.boss.offline && s.boss.horizontalDist(this.api.level.machine.front) < 10) s.bossSay('mailSpray');
  }

  /** E without mail: percussive maintenance. */
  kick(): void {
    const s = this.api.s;
    this.kicks++;
    s.sfx.thud();
    s.chat('mailKick');
    if (s.seen) {
      s.annoyance += 10;
      s.bossSay('mailKick');
    }
    if (this.state === 'warn') {
      this.state = 'ok';
      this.timer = rand(50, 70);
      s.say(pick(T.SORTO_KICK), 3);
      this.say('Purr. Thank you. Again tomorrow please.', 3);
      s.hype += 5;
      return;
    }
    if (this.state === 'ok' && Math.random() < 0.4) {
      s.say('You kicked a working machine. It took it personally.', 3);
      this.startSpray(2);
      return;
    }
    s.say('You kick it. It hums at you, offended.', 2.5);
    this.say(pick(T.SORTO_TALK), 3);
  }

  /** The pen-pal letter from its cousin arrived. */
  cry(): void {
    this.state = 'happy';
    this.timer = 90;
    this.say('A letter. For me. From the fax. I am leaking. It is oil. It is feelings.', 5);
    const f = this.api.level.machine.front;
    this.api.s.makePuddle(f.x - 0.3, f.z + 0.9);
  }
}

/** Position for COLLECT-O to stand next to a cage. Exported for the job's hints. */
export const CAGE_FRONT_X = CAGE_X + 1.35;
