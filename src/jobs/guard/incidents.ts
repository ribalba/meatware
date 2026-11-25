import * as THREE from 'three';
import { buildCustomerVisual } from '../../customerModels';
import type { NavGrid } from '../../nav';
import { AABB, pick, rand, segmentHitsAABB, textTexture } from '../../util';
import { CAMS, type Factory, type IncidentDoor } from './building';
import { TOASTER_DEF } from './items';
import * as GT from './texts';

/**
 * Incidents: things that appear on a camera now and then. The guard reports them at the
 * desk on the right monitor or deals with them in person. Nothing ever gets stolen.
 */

export type IncidentKind = 'toaster' | 'cat' | 'ghost' | 'door' | 'arm' | 'balloon' | 'cutout';

export const KIND_NAMES: Record<IncidentKind, string> = {
  toaster: 'suspicious toaster',
  cat: 'robot cat',
  ghost: 'vacuum robot "haunting" the hall',
  door: 'door left open',
  arm: 'robot arm dancing alone',
  balloon: 'lone balloon',
  cutout: 'cardboard Brad',
};

export interface Incident {
  id: number;
  kind: IncidentKind;
  /** Camera index (0..11). */
  cam: number;
  spot: THREE.Vector3;
  obj: THREE.Object3D | null;
  age: number;
  life: number;
  done: boolean;
  fade: number;
  byPlayer: boolean;
  hinted: boolean;
  door?: IncidentDoor;
  arm?: THREE.Object3D;
  armRot?: number;
  /** Seconds since the toaster last moved (for the motion detector). */
  moved: number;
  moveTimer: number;
  wander: THREE.Vector3;
  phase: number;
}

export interface IncidentCtx {
  nav: NavGrid;
  colliders: AABB[];
  player: THREE.Vector3;
  playerDir: THREE.Vector3;
  /** Monitor index the player is looking at right now, or -1. */
  watchedMonitor: number;
  inOffice: boolean;
  missed(inc: Incident): void;
  /** A new incident appeared by itself. */
  spawned(inc: Incident): void;
  toasterMoved(inc: Incident, near: boolean): void;
}

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3, ...extra });
const glowMat = (color: string, i = 2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i });

function buildCat(): THREE.Group {
  const g = new THREE.Group();
  const metal = std('#5a6068', { metalness: 0.6 });
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.08), glowMat('#ff3aa0', 1.6));
  collar.position.set(0, 0.43, 0.22);
  g.add(collar);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.55), metal);
  body.position.y = 0.32;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.2), metal);
  head.position.set(0, 0.5, 0.33);
  g.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 4), metal);
    ear.position.set(s * 0.08, 0.64, 0.33);
    g.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), glowMat('#7cff4a', 3));
    eye.position.set(s * 0.06, 0.52, 0.43);
    g.add(eye);
  }
  for (const [x, z] of [[-0.08, -0.2], [0.08, -0.2], [-0.08, 0.2], [0.08, 0.2]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), std('#2a2e33'));
    leg.position.set(x, 0.11, z);
    g.add(leg);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.4, 5), metal);
  tail.position.set(0, 0.5, -0.38);
  tail.rotation.x = -0.6;
  tail.name = 'tail';
  g.add(tail);
  g.scale.setScalar(1.6);
  return g;
}

function buildGhost(): THREE.Group {
  const g = new THREE.Group();
  const roomba = buildCustomerVisual('roomba', '#34495e');
  g.add(roomba.root);
  const sheet = new THREE.Group();
  sheet.name = 'sheet';
  const white = new THREE.MeshStandardMaterial({ color: '#f4f4f0', emissive: '#c8d8ff', emissiveIntensity: 0.9, roughness: 0.9, side: THREE.DoubleSide });
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 0.95, 12, 1, true), white);
  cloth.position.y = 0.6;
  sheet.add(cloth);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), white);
  top.position.y = 1.07;
  sheet.add(top);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), new THREE.MeshBasicMaterial({ color: '#000000' }));
    eye.position.set(s * 0.11, 0.98, 0.37);
    sheet.add(eye);
  }
  g.add(sheet);
  return g;
}

function buildBalloon(): THREE.Group {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshStandardMaterial({ color: '#e0302a', emissive: '#c01a10', emissiveIntensity: 1.0, roughness: 0.2 }));
  b.scale.y = 1.2;
  b.position.y = 1.9;
  g.add(b);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.5, 3), std('#dddddd'));
  string.position.y = 0.95;
  g.add(string);
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshBasicMaterial({ map: textTexture(['HAPPY RETIREMENT', 'UNIT 7'], { w: 128, h: 64, bg: '#ffffff', fg: '#c0392b' }), side: THREE.DoubleSide }));
  tag.position.y = 0.3;
  g.add(tag);
  return g;
}

function buildCutout(): THREE.Group {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#c8b48a';
  x.fillRect(0, 0, 128, 256);
  x.fillStyle = '#9aa5b1';
  x.beginPath();
  x.arc(64, 80, 46, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#222';
  x.fillRect(26, 64, 76, 22);
  x.fillStyle = '#ff2020';
  x.beginPath();
  x.arc(64, 75, 9, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#c0392b';
  x.beginPath();
  x.moveTo(56, 128);
  x.lineTo(72, 128);
  x.lineTo(64, 196);
  x.fill();
  x.fillStyle = '#ffffff';
  x.fillRect(18, 206, 92, 38);
  x.fillStyle = '#c0392b';
  x.font = 'bold 16px monospace';
  x.textAlign = 'center';
  x.fillText('BRAD', 64, 224);
  x.font = 'bold 9px monospace';
  x.fillText('LEADER OF THE DECADE', 64, 238);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.6 }));
  board.position.y = 0.95;
  g.add(board);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), std('#7a5c3a'));
  stand.position.set(0, 0.45, -0.25);
  stand.rotation.x = 0.4;
  g.add(stand);
  return g;
}

function buildToaster(): THREE.Group {
  const g = new THREE.Group();
  const t = TOASTER_DEF.build!();
  t.scale.setScalar(3.2);
  g.add(t);
  return g;
}

let nextId = 1;

export class Incidents {
  list: Incident[] = [];
  private scene: THREE.Scene;
  private level: Factory;
  private spawnIn = 9;
  private toasterOut = false;

  constructor(scene: THREE.Scene, level: Factory) {
    this.scene = scene;
    this.level = level;
  }

  active(): Incident[] {
    return this.list.filter((i) => !i.done);
  }

  /** Incidents on a camera right now. */
  on(cam: number): Incident[] {
    return this.list.filter((i) => !i.done && i.cam === cam);
  }

  /** Objects the player can walk up to and deal with. */
  targets(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const i of this.list) if (!i.done && i.obj && i.kind !== 'door') out.push(i.obj);
    return out;
  }

  /** Positions of moving things for the motion detectors. */
  movers(): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    for (const i of this.list) {
      if (i.done || !i.obj) continue;
      if (i.kind === 'cutout') continue;
      if (i.kind === 'toaster' && i.moved > 3) continue;
      out.push(i.obj.getWorldPosition(new THREE.Vector3()).setY(0.6));
    }
    return out;
  }

  private freeSpot(nav: NavGrid, base: THREE.Vector3): THREE.Vector3 {
    return nav.snap(base.clone()).setY(0);
  }

  /** Starts a new incident. `force` picks the kind (for testing). */
  spawn(ctx: IncidentCtx, force?: IncidentKind, forceCam?: number, byPlayer = false): Incident | null {
    const act = this.active();
    const busy = new Set(act.map((i) => i.cam));
    const kinds: IncidentKind[] = ['cat', 'cat', 'ghost', 'ghost', 'balloon', 'cutout', 'arm', 'arm', 'door', 'door'];
    if (!this.toasterOut && !act.some((i) => i.kind === 'toaster')) kinds.push('toaster', 'toaster', 'toaster');
    const kind = force ?? pick(kinds);
    const inc: Incident = {
      id: nextId++,
      kind,
      cam: 0,
      spot: new THREE.Vector3(),
      obj: null,
      age: 0,
      life: kind === 'toaster' ? 80 : 55,
      done: false,
      fade: 0,
      byPlayer,
      hinted: false,
      moved: 99,
      moveTimer: rand(8, 12),
      wander: new THREE.Vector3(),
      phase: Math.random() * 6,
    };
    if (kind === 'door') {
      const doors = this.level.doors.filter((d) => d.target === 0 && !act.some((i) => i.door === d));
      if (!doors.length) return force ? null : this.spawn(ctx, 'cat');
      const d = forceCam !== undefined ? doors.find((x) => CAMS[forceCam].door === x.name) ?? doors[0] : pick(doors);
      inc.door = d;
      inc.cam = CAMS.findIndex((c) => c.door === d.name);
      d.target = 1;
      inc.spot.copy(d.mesh.getWorldPosition(new THREE.Vector3())).setY(0);
      this.list.push(inc);
      return inc;
    }
    if (kind === 'arm') {
      const used = new Set(act.map((i) => i.arm));
      const options: { cam: number; arm: number }[] = [];
      CAMS.forEach((c, ci) => c.arms?.forEach((a) => !used.has(this.level.arms[a]) && !busy.has(ci) && options.push({ cam: ci, arm: a })));
      if (!options.length) return force ? null : this.spawn(ctx, 'balloon');
      const o = forceCam !== undefined ? options.find((x) => x.cam === forceCam) ?? options[0] : pick(options);
      inc.cam = o.cam;
      inc.arm = this.level.arms[o.arm];
      inc.armRot = inc.arm.rotation.y;
      inc.spot.copy(inc.arm.position);
      inc.obj = inc.arm;
      inc.arm.userData.interact = { kind: 'guardIncident', inc };
      this.list.push(inc);
      return inc;
    }
    // A free camera, away from the player, with a spot the player is not standing on.
    let cams = CAMS.map((_, i) => i).filter((i) => !busy.has(i) && CAMS[i].spots.length);
    if (kind !== 'cat' || ctx.inOffice) cams = cams.filter((i) => i !== 0);
    if (forceCam !== undefined) cams = [forceCam];
    const far = cams.filter((i) => CAMS[i].spots.some((s) => s.distanceTo(ctx.player) > 9));
    const pool = far.length ? far : cams;
    if (!pool.length) return null;
    inc.cam = pick(pool);
    const spots = CAMS[inc.cam].spots.filter((s) => s.distanceTo(ctx.player) > 6);
    inc.spot = this.freeSpot(ctx.nav, pick(spots.length ? spots : CAMS[inc.cam].spots));
    inc.wander.copy(inc.spot);
    const obj = kind === 'toaster' ? buildToaster() : kind === 'cat' ? buildCat() : kind === 'ghost' ? buildGhost() : kind === 'balloon' ? buildBalloon() : buildCutout();
    obj.position.copy(inc.spot);
    // Face the camera, so the monitor shows it nicely.
    const cp = CAMS[inc.cam].pos;
    obj.rotation.y = Math.atan2(cp.x - inc.spot.x, cp.z - inc.spot.z);
    obj.userData.interact = { kind: 'guardIncident', inc };
    this.scene.add(obj);
    inc.obj = obj;
    if (kind === 'toaster') this.toasterOut = true;
    this.list.push(inc);
    return inc;
  }

  /** Ends an incident. The object leaves in its own way. */
  resolve(inc: Incident): void {
    if (inc.done) return;
    inc.done = true;
    inc.fade = 0.001;
    if (inc.door) inc.door.target = 0;
    if (inc.arm) {
      inc.arm.rotation.y = inc.armRot ?? inc.arm.rotation.y;
      inc.arm.position.y = 0;
      delete inc.arm.userData.interact;
    }
    if (inc.kind === 'toaster') this.toasterOut = false;
  }

  /** The toaster was stolen. No more toasters tonight. */
  retireToaster(): void {
    this.toasterOut = true;
  }

  private observed(inc: Incident, ctx: IncidentCtx): boolean {
    if (ctx.watchedMonitor === inc.cam) return true;
    const p = inc.obj!.position;
    const dx = p.x - ctx.player.x;
    const dz = p.z - ctx.player.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.5) return true;
    if (d > 18) return false;
    if ((dx * ctx.playerDir.x + dz * ctx.playerDir.z) / d < 0.55) return false;
    for (const b of ctx.colliders) {
      if (!b.occludes || b.disabled || b.h < 1.6) continue;
      if (segmentHitsAABB(ctx.player.x, ctx.player.z, p.x, p.z, b)) return false;
    }
    return true;
  }

  update(dt: number, t: number, ctx: IncidentCtx, spawning: boolean): void {
    if (spawning) {
      this.spawnIn -= dt;
      const limit = t > 100 ? 3 : 2;
      if (this.spawnIn <= 0) {
        this.spawnIn = rand(12, 19);
        if (this.active().filter((i) => !i.byPlayer).length < limit) {
          const inc = this.spawn(ctx);
          if (inc) ctx.spawned(inc);
        }
      }
    }
    for (const inc of this.list) {
      if (inc.done) {
        this.fadeOut(inc, dt);
        continue;
      }
      inc.age += dt;
      inc.phase += dt;
      this.animate(inc, dt, t, ctx);
      if (inc.age > inc.life) {
        this.resolve(inc);
        ctx.missed(inc);
      }
    }
    this.list = this.list.filter((i) => !(i.done && i.fade >= 1));
  }

  private animate(inc: Incident, dt: number, t: number, ctx: IncidentCtx): void {
    const o = inc.obj;
    switch (inc.kind) {
      case 'cat':
      case 'ghost': {
        if (!o) return;
        const d = o.position.distanceTo(inc.wander);
        if (d < 0.2) {
          for (let k = 0; k < 8; k++) {
            const w = new THREE.Vector3(inc.spot.x + rand(-2, 2), 0, inc.spot.z + rand(-2, 2));
            if (ctx.nav.isFree(w.x, w.z)) {
              inc.wander.copy(w);
              break;
            }
          }
        } else {
          const sp = inc.kind === 'cat' ? 0.9 : 0.6;
          const dx = inc.wander.x - o.position.x;
          const dz = inc.wander.z - o.position.z;
          o.position.x += (dx / d) * Math.min(d, sp * dt);
          o.position.z += (dz / d) * Math.min(d, sp * dt);
          o.rotation.y = Math.atan2(dx, dz);
        }
        if (inc.kind === 'ghost') {
          const sheet = o.getObjectByName('sheet');
          if (sheet) sheet.position.y = 0.1 + Math.sin(t * 2.2 + inc.phase) * 0.12;
        } else {
          const tail = o.getObjectByName('tail');
          if (tail) tail.rotation.z = Math.sin(t * 6) * 0.5;
        }
        break;
      }
      case 'balloon': {
        if (!o) return;
        o.position.x = inc.spot.x + Math.sin(t * 0.4 + inc.phase) * 0.8;
        o.position.z = inc.spot.z + Math.cos(t * 0.3 + inc.phase) * 0.6;
        o.position.y = 0.2 + Math.sin(t * 1.3) * 0.15;
        o.rotation.y += dt * 0.4;
        break;
      }
      case 'arm': {
        if (!o) return;
        o.rotation.y = (inc.armRot ?? 0) + Math.sin(t * 2.4 + inc.phase) * 0.7;
        o.position.y = Math.abs(Math.sin(t * 4.8)) * 0.12;
        break;
      }
      case 'toaster': {
        if (!o) return;
        inc.moved += dt;
        const hop = inc.moved < 0.6 ? Math.sin((inc.moved / 0.6) * Math.PI) * 0.25 : 0;
        o.position.y = hop;
        inc.moveTimer -= dt;
        if (inc.moveTimer <= 0) {
          inc.moveTimer = rand(9, 15);
          if (!this.observed(inc, ctx)) this.moveToaster(inc, ctx);
        }
        break;
      }
      default:
        break;
    }
  }

  /** The toaster changes place when nobody looks. Usually to another camera. */
  private moveToaster(inc: Incident, ctx: IncidentCtx): void {
    const busy = new Set(this.active().filter((i) => i !== inc).map((i) => i.cam));
    const options = CAMS.map((_, i) => i).filter((i) => i !== 0 && i !== inc.cam && !busy.has(i));
    if (!options.length) return;
    const near = inc.obj!.position.distanceTo(ctx.player) < 10;
    inc.cam = pick(options);
    const spots = CAMS[inc.cam].spots.filter((s) => s.distanceTo(ctx.player) > 7);
    if (!spots.length) return;
    inc.spot = this.freeSpot(ctx.nav, pick(spots));
    inc.obj!.position.copy(inc.spot);
    const cp = CAMS[inc.cam].pos;
    inc.obj!.rotation.y = Math.atan2(cp.x - inc.spot.x, cp.z - inc.spot.z);
    inc.moved = 0;
    ctx.toasterMoved(inc, near);
  }

  private fadeOut(inc: Incident, dt: number): void {
    if (inc.fade >= 1) return;
    inc.fade = Math.min(1, inc.fade + dt * 1.2);
    const o = inc.obj;
    if (!o || inc.kind === 'arm') {
      inc.fade = 1;
      return;
    }
    if (inc.kind === 'balloon') o.position.y += dt * 3;
    else if (inc.kind === 'cat') o.position.x += dt * 4;
    else o.scale.setScalar(Math.max(0.01, 1 - inc.fade));
    if (inc.fade >= 1) this.scene.remove(o);
  }

  /** Ends everything, used when the shift ends or for tests. */
  clear(): void {
    for (const i of this.list) {
      this.resolve(i);
      if (i.obj && i.kind !== 'arm') this.scene.remove(i.obj);
    }
    this.list = [];
  }

  /** Name for the logbook. */
  static label(inc: Incident): string {
    return KIND_NAMES[inc.kind];
  }

  /** A random speech line for an incident creature. */
  static line(inc: Incident): string | null {
    switch (inc.kind) {
      case 'cat':
        return pick(GT.CAT_LINES);
      case 'ghost':
        return pick(GT.GHOST_LINES);
      case 'toaster':
        return pick(GT.TOASTER_LINES);
      default:
        return null;
    }
  }
}
