import * as THREE from 'three';
import { boxMaterials } from '../../details';
import type { Interact } from '../../level';
import { ceilingTex, concreteTex, metalPlateTex, wetFloorTex, carpetTex } from '../../textures';
import { blobGeometry, textTexture, TextTexOpts } from '../../util';
import type { Tower } from './building';
import { BOOTH_X0, BOOTH_Z0, CLOSET, FLOORS, LOBBY, SHAFT_Z } from './building';
import {
  beigeWallTex,
  blockWallTex,
  brassTex,
  brickTex,
  chartTex,
  damaskTex,
  funCarpetTex,
  gravelTex,
  helipadTex,
  officeCarpetTex,
  rackFrontTex,
  raisedFloorTex,
  rubberTex,
  smogCityTex,
  synergyWallTex,
  whiteboardTex,
  woodPanelTex,
} from './textures';
import { floorMovable, proxy } from './fun';
import { MANUAL_SIGN } from './texts';

/**
 * The seven lobbies of SYNERGY TOWER, one builder per floor. Everything is built in floor
 * space (floor surface at y = 0) into the floor's group. Colliders go to the kit and are
 * collected per floor by the Tower.
 */

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
const PX = '"Press Start 2P", monospace';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Tick = (t: number) => void;

/** Small building helper bound to one floor group. */
export class Deco {
  kit: Tower;
  g: THREE.Group;
  ticks: Tick[];
  r: () => number;

  constructor(kit: Tower, g: THREE.Group, ticks: Tick[], seed: number) {
    this.kit = kit;
    this.g = g;
    this.ticks = ticks;
    this.r = rng(seed);
  }

  box(w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number, rotY = 0, parent: THREE.Object3D = this.g): THREE.Mesh {
    const b = this.kit.box(w, h, d, m, x, y, z, parent);
    b.rotation.y = rotY;
    return b;
  }

  cyl(rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, seg = 10, parent: THREE.Object3D = this.g): THREE.Mesh {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    c.position.set(x, y, z);
    parent.add(c);
    return c;
  }

  plane(w: number, h: number, m: THREE.Material, x: number, y: number, z: number, rotY = 0, rotX = 0, parent: THREE.Object3D = this.g): THREE.Mesh {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h, Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))), m);
    p.position.set(x, y, z);
    p.rotation.order = 'YXZ';
    p.rotation.set(rotX, rotY, 0);
    parent.add(p);
    return p;
  }

  /** A flat rectangle lying on the floor. */
  rug(w: number, d: number, m: THREE.Material, x: number, z: number, y = 0.006, rotY = 0): THREE.Mesh {
    return this.plane(w, d, m, x, y, z, rotY, -Math.PI / 2);
  }

  solid(cx: number, cz: number, w: number, d: number, h = 2, occludes = false): void {
    this.kit.solid(cx, cz, w, d, h, occludes, 'decor');
  }

  interact<T extends THREE.Object3D>(o: T, info: Interact): T {
    o.userData.interact = info;
    this.kit.interactables.push(o);
    return o;
  }

  /** Sign with the pixel font. With `text` it is readable with E. */
  px(lines: string[], w: number, h: number, x: number, y: number, z: number, rotY: number, bg: string, fg: string, border?: string, text?: string): THREE.Mesh {
    const tw = 256;
    const th = Math.max(32, Math.round((tw * h) / w));
    const tex = textTexture(lines, { w: tw, h: th, bg, fg, border, font: PX });
    tex.magFilter = THREE.NearestFilter;
    const m = this.plane(w, h, std({ map: tex }), x, y, z, rotY);
    if (text) this.interact(m, { kind: 'sign', text });
    return m;
  }

  /** Poster in the normal sign font. */
  poster(lines: string[], w: number, h: number, x: number, y: number, z: number, rotY: number, opts: TextTexOpts = {}, text?: string): THREE.Mesh {
    const tw = 512;
    const th = Math.max(64, Math.round((tw * h) / w));
    const m = this.plane(w, h, std({ map: textTexture(lines, { w: tw, h: th, bg: '#fdf6e3', fg: '#2c3e50', border: '#c0392b', ...opts }) }), x, y, z, rotY);
    if (text) this.interact(m, { kind: 'sign', text });
    return m;
  }

  /** Glowing sign (not lit by the scene). */
  glow(lines: string[], w: number, h: number, x: number, y: number, z: number, rotY: number, bg: string, fg: string): THREE.MeshBasicMaterial {
    const tex = textTexture(lines, { w: 256, h: Math.round((256 * h) / w), bg, fg, font: PX });
    tex.magFilter = THREE.NearestFilter;
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    this.plane(w, h, mat, x, y, z, rotY);
    return mat;
  }

  /** A model from the manifest. `col` adds a collider [w, d, h] around it. */
  prop(key: string, x: number, y: number, z: number, rotY = 0, col?: [number, number, number]): THREE.Object3D | null {
    const o = this.kit.prop(key, x, y, z, rotY, this.g);
    if (col) this.solid(x, z, col[0], col[1], col[2]);
    return o;
  }

  /** A pile of cardboard boxes with a collider. */
  pile(cx: number, cz: number, w: number, d: number, maxLevels: number): void {
    const r = this.r;
    const cols = Math.max(1, Math.round(w / 0.6));
    const rows = Math.max(1, Math.round(d / 0.6));
    let top = 0;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let y = 0;
        const levels = 1 + Math.floor(r() * maxLevels);
        for (let k = 0; k < levels; k++) {
          const bw = 0.42 + r() * 0.15;
          const bh = 0.3 + r() * 0.2;
          const b = this.box(bw, bh, 0.42 + r() * 0.15, boxMaterials(Math.floor(r() * 7)), cx - w / 2 + (i + 0.5) * (w / cols), y + bh / 2, cz - d / 2 + (j + 0.5) * (d / rows), (r() - 0.5) * 0.4);
          b.castShadow = false;
          y += bh;
        }
        top = Math.max(top, y);
      }
    }
    this.solid(cx, cz, w, d, top);
  }

  stain(x: number, z: number, s: number, color = '#3a2e20', opacity = 0.25): void {
    const m = new THREE.Mesh(blobGeometry(s), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    m.position.set(x, 0.008, z);
    m.rotation.y = this.r() * Math.PI * 2;
    this.g.add(m);
  }

  /** Fluorescent ceiling panel. */
  lamp(x: number, z: number, w = 1.2, d = 0.5, color = '#fff6dc', h = LOBBY.h): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 });
    this.box(w, 0.06, d, mat, x, h - 0.04, z);
    this.box(w + 0.08, 0.04, d + 0.08, std({ color: '#5a5a52' }), x, h - 0.01, z);
    return mat;
  }

  plant(x: number, z: number): void {
    this.kit.plant(x, z);
  }

  /** A wall camera (Brad has friends on every floor). */
  camera(x: number, y: number, z: number, yaw: number): void {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    this.g.add(g);
    this.box(0.06, 0.2, 0.06, std({ color: '#1a1a1a' }), 0, 0.12, 0, 0, g);
    const body = this.box(0.18, 0.16, 0.38, std({ color: '#d8d8d2' }), 0, 0, 0.12, 0, g);
    body.rotation.x = 0.35;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 2 }));
    led.position.set(0.06, 0.06, 0.3);
    g.add(led);
    this.ticks.push((t) => (led.visible = Math.sin(t * 3) > 0));
  }

  extinguisher(x: number, z: number, rotY: number): void {
    const red = std({ color: '#b3160c' });
    this.cyl(0.08, 0.08, 0.45, red, x, 0.75, z, 8);
    this.box(0.06, 0.08, 0.04, std({ color: '#1a1a1a' }), x, 1.02, z, rotY);
    this.px(['FIRE'], 0.2, 0.1, x, 1.2, z + (Math.abs(rotY) < 0.1 ? 0.01 : 0), rotY, '#b3160c', '#ffffff');
  }

  trash(x: number, z: number): void {
    if (!this.prop('evTrash', x, 0, z, 0, [0.45, 0.45, 0.6])) {
      this.cyl(0.22, 0.18, 0.6, std({ color: '#3f4a3c' }), x, 0.3, z);
      this.solid(x, z, 0.45, 0.45, 0.6);
    }
    // some trash next to it
    this.box(0.12, 0.08, 0.1, std({ color: '#e9e4d4' }), x + 0.3, 0.04, z + 0.1, 0.6);
  }

  /** A pipe along x or z at height y. */
  pipe(x0: number, z0: number, x1: number, z1: number, y: number, r: number, m: THREE.Material): void {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), m);
    p.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    p.rotation.set(Math.PI / 2, Math.atan2(x1 - x0, z1 - z0), 0, 'YXZ');
    this.g.add(p);
    for (let k = 0; k <= len; k += 2) {
      const f = k / len;
      this.box(r * 2.6, 0.04, r * 2.6, std({ color: '#3a3a3a' }), x0 + (x1 - x0) * f, y, z0 + (z1 - z0) * f, Math.atan2(x1 - x0, z1 - z0));
    }
  }
}

interface ShellOpts {
  floor: THREE.Material;
  wall: THREE.Material;
  ceiling: THREE.Material | null;
  frame: THREE.Material;
  skirt: string;
  lampColor?: string;
  /** Text on the robot door. */
  door: string[];
}

/** Floor, walls, ceiling, landing and the robot door. Same layout on every floor. */
function shell(d: Deco, i: number, o: ShellOpts): void {
  const { minX, maxX, minZ, maxZ, h } = LOBBY;
  const W = maxX - minX;
  const D = maxZ - minZ;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D, Math.ceil(W), Math.ceil(D)), o.floor);
  fl.rotation.x = -Math.PI / 2;
  fl.position.set(cx, 0, cz);
  d.g.add(fl);
  // slab edge under the floor, seen while driving
  d.box(W, 0.35, D, std({ map: concreteTex([6, 1]) }), cx, -0.18, cz);
  if (o.ceiling) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(W, D, Math.ceil(W / 2), Math.ceil(D / 2)), o.ceiling);
    c.rotation.x = Math.PI / 2;
    c.position.set(cx, h, cz);
    d.g.add(c);
    // plenum box between this ceiling and the next floor
    d.box(W, 0.7, D, std({ color: '#2a2520' }), cx, h + 0.36 + 0.02, cz);
  }
  if (o.ceiling) {
    d.plane(D, h, o.wall, minX, h / 2, cz, Math.PI / 2);
    d.plane(D, h, o.wall, maxX, h / 2, cz, -Math.PI / 2);
    d.plane(W, h, o.wall, cx, h / 2, minZ, 0);
    const skirt = std({ color: o.skirt });
    d.box(0.04, 0.16, D, skirt, minX + 0.02, 0.08, cz);
    d.box(0.04, 0.16, D, skirt, maxX - 0.02, 0.08, cz);
    d.box(W, 0.16, 0.04, skirt, cx, 0.08, minZ + 0.02);
    d.box(W, 0.16, 0.04, skirt, cx, 0.08, maxZ - 0.08);
  }
  d.kit.landing(d.g, i, o.wall, o.frame);

  // The robot door on the west wall. On the roof it sits in a little brick stair hut.
  const doorZ = -4.8;
  let dx = minX;
  if (!o.ceiling) {
    dx = minX + 1.1;
    d.box(1.1, 2.9, 2.2, o.wall, minX + 0.55, 1.45, doorZ);
    d.box(1.3, 0.12, 2.4, std({ color: '#3a3632' }), minX + 0.55, 2.95, doorZ);
    d.solid(minX + 0.55, doorZ, 1.1, 2.2, 2.9, true);
  }
  d.box(0.08, 2.4, 1.3, std({ color: '#3d3a33' }), dx + 0.05, 1.2, doorZ);
  d.box(0.1, 0.12, 1.5, o.frame, dx + 0.06, 2.45, doorZ);
  for (const s of [-1, 1]) d.box(0.1, 2.5, 0.1, o.frame, dx + 0.06, 1.25, doorZ + s * 0.7);
  d.box(0.04, 0.4, 0.3, std({ color: '#c8ccd0', metalness: 0.7 }), dx + 0.1, 1.05, doorZ + 0.45);
  d.glow(['EXIT', 'stairs: robots only'], 0.9, 0.3, dx + 0.08, 2.75, doorZ, Math.PI / 2, '#0e3a12', '#7cff6a');
  d.px(o.door, 1.0, 0.5, dx + 0.08, 1.6, doorZ, Math.PI / 2, '#f2ead2', '#2a1a0a', '#8a6a2a', o.door.join(' '));

  // A ceiling camera looking at the landing
  if (o.ceiling) d.camera(maxX - 0.3, h - 0.3, maxZ - 0.4, -Math.PI * 0.75 + Math.PI);
  // A fire extinguisher by the landing
  d.extinguisher(-DOOR_X - 2.4, SHAFT_Z - 0.12, Math.PI);

  // Landing clutter that every floor has: sconces, queue tape, a bench, a plant, notices.
  const brass = std({ map: brassTex([1, 1]), metalness: 0.7, roughness: 0.35 });
  for (const sx of [-1, 1]) {
    const x = sx * (DOOR_X + 0.55);
    d.box(0.1, 0.2, 0.06, brass, x, 2.25, SHAFT_Z - 0.09);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffd890', emissiveIntensity: 1.2 }));
    bulb.position.set(x, 2.42, SHAFT_Z - 0.18);
    d.g.add(bulb);
  }
  const tape = std({ color: '#e0b21b' });
  for (const sx of [-1, 1]) d.rug(0.06, 2.0, tape, sx * 1.55, -3.0, 0.009);
  d.rug(3.16, 0.06, tape, 0, -4.0, 0.009);
  const floorText = textTexture(['PLEASE STAND CLEAR', 'OF THE HUMAN'], { w: 256, h: 64, bg: 'transparent', fg: '#e0b21b', font: PX });
  floorText.magFilter = THREE.NearestFilter;
  d.plane(2.4, 0.6, std({ map: floorText, transparent: true }), 0, 0.011, -3.5, Math.PI, -Math.PI / 2);
  if (o.ceiling) {
    // hanging sign in the lobby, readable from both sides
    for (const r of [0, Math.PI]) d.px(['ELEVATOR B', 'operated by a real human'], 1.6, 0.4, 0, 3.3, -5.6 + (r ? -0.01 : 0.01), r, '#1e140c', '#e0b21b', '#b08a3a');
    for (const sx of [-0.6, 0.6]) d.cyl(0.008, 0.008, 0.4, std({ color: '#3a3a3a' }), sx, 3.7, -5.6, 4);
  }
  d.poster(['NOTICE', 'This elevator is operated', 'by a REAL HUMAN.', 'Please do not feed it.'], 1.3, 0.8, -DOOR_X - 2.4, 2.2, SHAFT_Z - 0.08, Math.PI, { bg: '#f2ead2', fg: '#2a1a0a', border: '#8a6a2a' }, 'NOTICE: This elevator is operated by a REAL HUMAN. Please do not feed it. Please do not tip it. Tips are company property.');
  if (i !== 3) {
    if (!d.prop('evBench', 5.0, 0, -2.35, Math.PI / 2, [1.7, 0.6, 0.5])) {
      d.box(1.6, 0.08, 0.45, std({ color: '#6e4b2a' }), 5.0, 0.45, -2.35);
      d.solid(5.0, -2.35, 1.7, 0.6, 0.5);
    }
  }
  d.plant(3.4, -2.35);
  d.trash(-3.6, -2.35);
}
const DOOR_X = 1.35;

/** The corner block on every floor except the basement (where the toilet is). */
function closet(d: Deco, wall: THREE.Material, h = LOBBY.h): void {
  const { minX, maxX, minZ, maxZ } = CLOSET;
  const w = maxX - minX;
  const dd = maxZ - minZ;
  d.box(w, h, dd, wall, (minX + maxX) / 2, h / 2, (minZ + maxZ) / 2);
  d.solid((minX + maxX) / 2, (minZ + maxZ) / 2, w, dd, h, true);
}

// ====================================================================== floors

export function buildFloor(kit: Tower, g: THREE.Group, i: number, ticks: Tick[]): void {
  const d = new Deco(kit, g, ticks, 100 + i * 17);
  [basement, accounting, synergy, gym, servers, executive, roof][i](d, i);
  void FLOORS;
}

// ---------------------------------------------------------------------- B: basement

function basement(d: Deco, i: number): void {
  const concrete = std({ map: concreteTex([8, 6]) });
  const brick = std({ map: brickTex([6, 2]) });
  shell(d, i, {
    floor: concrete,
    wall: brick,
    ceiling: std({ map: concreteTex([5, 4]), color: '#8a8478' }),
    frame: std({ color: '#5a5f52', metalness: 0.4 }),
    skirt: '#2a2622',
    door: ['BOILER ROOM', 'and stairs'],
  });
  const h = LOBBY.h;
  // Toilet booth in the far corner
  d.kit.toiletBooth(BOOTH_X0, BOOTH_Z0, ['KEY: ON THE ROOF', 'clipped to the', 'SAFETY MANUAL (30 KG)']);
  d.poster(['STAFF TOILET (HUMAN)', 'Key on the roof. With the manual.', 'Bring the manual back.', 'Do not read the manual.'], 2.0, 1.1, BOOTH_X0 - 0.1, 2.0, -7.4, -Math.PI / 2, { bg: '#f2ead2', border: '#8e1f16' }, 'STAFF TOILET. The key is on the roof, clipped to the 30 kg safety manual. The basement and the roof are as far apart as this company could make them.');
  // Pipes everywhere on the ceiling
  const pipeM = std({ color: '#6b4a2e', metalness: 0.4 });
  const pipeG = std({ color: '#5a6a5a', metalness: 0.4 });
  d.pipe(-6.3, -2.6, 8.2, -2.6, h - 0.3, 0.1, pipeM);
  d.pipe(-6.3, -6.5, 8.2, -6.5, h - 0.45, 0.14, pipeG);
  d.pipe(-5.5, -2.4, -5.5, -12.8, h - 0.25, 0.08, std({ color: '#9e2a1e' }));
  d.pipe(1.5, -2.4, 1.5, -12.8, h - 0.55, 0.12, pipeM);
  // The boiler with gauges
  const boiler = d.cyl(0.9, 0.9, 2.6, std({ color: '#5a5f52', metalness: 0.5 }), -4.6, 1.3, -10.8, 14);
  d.interact(boiler, { kind: 'sign', text: 'The boiler. It heats the executive floor and nothing else.' });
  d.cyl(0.95, 0.95, 0.12, std({ color: '#3a3a3a' }), -4.6, 2.6, -10.8, 14);
  d.cyl(0.18, 0.18, 1.3, pipeM, -4.6, 3.25, -10.8);
  for (const a of [0.4, 1.2]) {
    const gauge = d.cyl(0.12, 0.12, 0.05, std({ color: '#e9e4d4' }), -4.6 + Math.sin(a) * 0.92, 1.6 + a * 0.3, -10.8 + Math.cos(a) * 0.92, 10);
    gauge.rotation.set(Math.PI / 2, 0, -a, 'YXZ');
    gauge.rotation.y = a;
  }
  d.solid(-4.6, -10.8, 1.9, 1.9, 2.6, true);
  d.px(['DANGER', 'HOT'], 0.5, 0.3, -4.6, 1.5, -9.88, 0, '#e0b21b', '#1d1b17');
  // Lost and found bin
  const lf = new THREE.Group();
  lf.position.set(-1.2, 0, -12.3);
  d.g.add(lf);
  d.box(1.4, 0.8, 0.8, std({ color: '#2b4a7a' }), 0, 0.4, 0, 0, lf);
  d.box(1.44, 0.06, 0.84, std({ color: '#1c3256' }), 0, 0.82, 0, 0, lf);
  for (let k = 0; k < 6; k++) d.box(0.25, 0.15, 0.2, boxMaterials(k), -0.45 + k * 0.18, 0.92, (k % 2) * 0.15 - 0.07, k, lf);
  const umb = d.cyl(0.02, 0.05, 0.9, std({ color: '#6e1a1f' }), 0.5, 1.2, 0.1, 6, lf);
  umb.rotation.z = 0.4;
  d.px(['LOST & FOUND', 'mostly lost'], 1.3, 0.4, -1.2, 1.5, -12.95, 0, '#1c3256', '#f2ead2');
  d.interact(lf, { kind: 'evLostFound' });
  d.solid(-1.2, -12.3, 1.5, 0.9, 1.0);
  // Broken robot pile: legacy models
  const metal = std({ color: '#7f8c8d', metalness: 0.5, roughness: 0.5 });
  const rust = std({ color: '#7a4a2a', roughness: 0.9 });
  const pr = d.r;
  for (let k = 0; k < 9; k++) {
    const m = d.box(0.3 + pr() * 0.3, 0.25 + pr() * 0.3, 0.3 + pr() * 0.3, k % 3 ? metal : rust, -5.6 + pr() * 1.2, 0.15 + Math.floor(k / 3) * 0.3, -7.2 + pr() * 1.4, pr() * 3);
    m.rotation.x = pr() * 0.6;
  }
  const head = d.box(0.36, 0.28, 0.3, metal, -5.2, 1.05, -6.6, 0.4);
  head.rotation.z = 0.5;
  const face = d.plane(0.3, 0.2, new THREE.MeshBasicMaterial({ map: textTexture(['x_x'], { w: 64, h: 48, bg: '#0b1a2a', fg: '#ff5555', font: 'monospace' }) }), -5.2 + 0.06, 1.05, -6.6 + 0.16, 0.4);
  d.kit.props.set('legacyFace', face);
  d.interact(head, { kind: 'evFun', id: 'legacy' });
  d.px(['LEGACY MODELS', 'do not reboot'], 1.2, 0.4, -6.45, 1.9, -6.8, Math.PI / 2, '#f2ead2', '#8e1f16', '#8e1f16', 'LEGACY MODELS. They were replaced by newer models. Then the newer models were replaced by you.');
  d.solid(-5.4, -6.7, 1.9, 1.9, 1.2);
  // Shelf with paint cans and boxes
  const shelfM = std({ color: '#5a5f52', metalness: 0.5 });
  for (const y of [0.4, 1.1, 1.8]) d.box(2.2, 0.05, 0.5, shelfM, -1.6, y, -12.65);
  for (const x of [-2.65, -0.55]) d.box(0.05, 2.0, 0.5, shelfM, x, 1.0, -12.65);
  for (let k = 0; k < 7; k++) d.cyl(0.11, 0.11, 0.24, std({ color: ['#c0392b', '#2e86c1', '#e9e4d4', '#27ae60'][k % 4] }), -2.5 + k * 0.28, 1.25, -12.6, 10);
  d.solid(-1.6, -12.65, 2.3, 0.6, 2);
  // Mop bucket and a wet floor sign by the toilet
  const yellow = std({ color: '#d9a400' });
  d.cyl(0.22, 0.18, 0.38, yellow, 2.2, 0.19, -7.6);
  const stick = d.cyl(0.02, 0.02, 1.5, std({ color: '#8a6b45' }), 2.3, 0.85, -7.55, 5);
  stick.rotation.z = 0.25;
  d.solid(2.2, -7.6, 0.5, 0.5, 0.5);
  const wet = new THREE.Group();
  wet.position.set(1.0, 0, -8.6);
  wet.rotation.y = 0.6;
  const wetMat = std({ map: wetFloorTex(), side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.6), wetMat);
    p.position.set(0, 0.29, s * 0.1);
    p.rotation.x = s * 0.33;
    wet.add(p);
  }
  floorMovable(d.kit, wet, 'Wet Floor Sign', { holdPos: [0.3, -0.45, -0.7], pickupLine: 'CAUTION, WET FLOOR. Nobody knows why. Nobody asks. Now it is yours.' });
  // Fuse box with a warning (it can be broken, it should not be)
  const fuse = new THREE.Group();
  d.g.add(fuse);
  d.box(0.6, 0.8, 0.15, std({ color: '#7f8c8d', metalness: 0.4 }), 4.2, 1.6, SHAFT_Z - 0.14, 0, fuse);
  fuse.attach(d.px(['FUSES', 'do not touch', 'we mean it'], 0.5, 0.35, 4.2, 1.6, SHAFT_Z - 0.22, Math.PI, '#e0b21b', '#1d1b17'));
  d.kit.breakable(fuse, { name: 'fuse box', price: 140, line: 'You touch the fuses. With your foot. Sparks. The lobby goes dark. We meant it.', colors: ['#7f8c8d', '#e0b21b', '#ffe070'], onBreak: () => d.kit.emit('fuses') });
  // Washer for the uniforms
  d.prop('evWasher', 7.6, 0, -3.0, -Math.PI / 2, [0.9, 0.9, 1]);
  d.prop('evWasher', 7.6, 0, -4.0, -Math.PI / 2, [0.9, 0.9, 1]);
  d.px(['UNIFORM', 'LAUNDRY'], 0.9, 0.4, 8.37, 1.8, -3.5, -Math.PI / 2, '#2e86c1', '#ffffff');
  d.pile(6.8, -6.6, 2.2, 1.2, 3);
  // Stains, puddle marks, a rat robot that circles forever
  for (const [x, z, s] of [[0, -6, 0.8], [-3, -3, 0.5], [4, -5, 0.6], [-2.5, -9, 0.7], [1.5, -11.5, 0.5]] as [number, number, number][]) d.stain(x, z, s);
  const rat = new THREE.Group();
  d.g.add(rat);
  d.box(0.22, 0.1, 0.12, std({ color: '#5a5a5a', metalness: 0.5 }), 0, 0.06, 0, 0, rat);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 2 }));
  eye.position.set(0.11, 0.09, 0.03);
  rat.add(eye);
  const tail = d.box(0.25, 0.01, 0.01, std({ color: '#3a3a3a' }), -0.22, 0.04, 0, 0, rat);
  void tail;
  d.ticks.push((t) => {
    const a = t * 0.7;
    rat.position.set(-2.4 + Math.cos(a) * 1.4, 0, -8.6 + Math.sin(a) * 0.9);
    rat.rotation.y = -a - Math.PI / 2;
  });
  d.lamp(0, -4.5, 1.2, 0.3, '#f6e8a0');
  d.lamp(-3.5, -9, 1.2, 0.3, '#f6e8a0');
  d.lamp(1.8, -10, 1.2, 0.3, '#f6e8a0');
  d.plant(-6.0, -2.5);
  d.poster(['THE BASEMENT', 'is not a punishment.', 'It is a lower floor.'], 1.8, 1.0, -6.47, 2.3, -9, Math.PI / 2, { bg: '#e8e0c8', border: '#5a5f52' }, 'A poster. Someone has added "it is a punishment" in pencil.');
}

// ---------------------------------------------------------------------- 1: accounting

function accounting(d: Deco, i: number): void {
  const wall = std({ map: beigeWallTex([8, 1]) });
  shell(d, i, {
    floor: std({ map: officeCarpetTex([7, 5]) }),
    wall,
    ceiling: std({ map: ceilingTex([7, 5]) }),
    frame: std({ map: woodPanelTex([1, 1]) }),
    skirt: '#4a3a28',
    door: ['ACCOUNTING', 'every cent counts', '(twice)'],
  });
  closet(d, std({ map: beigeWallTex([3, 1]) }));
  // Closet facade: the archive
  d.box(1.4, 2.3, 0.06, std({ map: woodPanelTex([1, 1]) }), 5.6, 1.15, CLOSET.maxZ + 0.03);
  d.px(['ARCHIVE', 'do not open', 'it is just more archive'], 1.6, 0.6, 5.6, 2.7, CLOSET.maxZ + 0.07, 0, '#f2ead2', '#2a1a0a', '#6e5a3e', 'ARCHIVE. Inside are all receipts since 2031. Outside is you.');
  d.box(0.06, 0.35, 0.06, std({ color: '#c9a227', metalness: 0.8 }), 6.15, 1.1, CLOSET.maxZ + 0.08);
  // Desk cluster with screens and chairs
  const desks: [number, number, number][] = [[-4.6, -7.2, 0], [-2.4, -7.2, 0], [-4.6, -9.6, Math.PI], [-2.4, -9.6, Math.PI], [0.6, -8.4, 0]];
  desks.forEach(([x, z, rot], k) => officeDesk(d, x, z, rot, k));
  // Filing cabinets along the back wall
  for (let k = 0; k < 7; k++) filingCabinet(d, -6.0 + k * 0.62, -12.65, 0, k);
  d.solid(-4.15, -12.65, 4.4, 0.65, 1.4, true);
  // Chart, clock, posters
  d.plane(1.8, 1.1, std({ map: chartTex() }), 0.3, 2.3, -12.97, 0);
  d.interact(d.g.children[d.g.children.length - 1], { kind: 'sign', text: 'HUMAN MORALE Q1 to Q4. The trend is clear. The trend is down. The trend is you.' });
  clock(d, -2.5, 3.0, -12.96, 0);
  d.poster(['EVERY CENT COUNTS.', 'EXCEPT YOURS.'], 2.0, 0.9, -6.47, 2.4, -9.5, Math.PI / 2, {}, 'EVERY CENT COUNTS. EXCEPT YOURS. Signed, Accounting.');
  d.poster(['AUDIT IS LOVE', 'AUDIT IS LIFE'], 1.6, 0.8, 7.0, 2.4, SHAFT_Z - 0.09, Math.PI, { bg: '#e8f0e0', border: '#27ae60' });
  // Water cooler and a printer that never works
  waterCooler(d, 7.8, -6.8);
  const printer = new THREE.Group();
  printer.position.set(5.0, 0, -7.2);
  d.g.add(printer);
  d.box(0.9, 0.75, 0.6, std({ color: '#d8d2c4' }), 0, 0.375, 0, 0, printer);
  d.box(0.92, 0.35, 0.62, std({ color: '#b8b2a4' }), 0, 0.92, 0, 0, printer);
  d.box(0.5, 0.02, 0.3, std({ color: '#ffffff' }), 0, 1.11, 0.15, 0, printer);
  const errLed = new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 2 });
  d.box(0.05, 0.03, 0.02, errLed, 0.3, 1.0, 0.32, 0, printer);
  d.ticks.push((t) => (errLed.emissiveIntensity = Math.sin(t * 6) > 0 ? 2 : 0.2));
  printer.attach(d.px(['OUT OF ORDER', 'since the 2050s'], 0.7, 0.3, 5.0, 0.6, -6.89, 0, '#ffffff', '#c0392b'));
  d.interact(printer, { kind: 'sign', text: 'PC LOAD LETTER. It has said that for 21 years.' });
  d.kit.breakable(printer, {
    name: 'printer',
    hp: 3,
    price: 349,
    collider: d.kit.solid(5.0, -7.2, 1.0, 0.7, 1.1, false, 'decor'),
    line: 'The printer finally prints. It prints its last will. Paper everywhere.',
    colors: ['#d8d2c4', '#ffffff', '#f4f1e6', '#b8b2a4'],
    onBreak: () => d.kit.emit('printer'),
  });
  // Paper everywhere
  const paper = std({ color: '#f4f1e6' });
  for (let k = 0; k < 14; k++) {
    const p = d.rug(0.21, 0.29, paper, -6 + d.r() * 9, -5.6 - d.r() * 7, 0.007 + k * 0.0004, d.r() * 3);
    void p;
  }
  // Calculator tape spilling from a desk
  d.rug(0.06, 2.2, std({ color: '#efe9d6' }), 1.2, -7.0, 0.009, 0.3);
  d.pile(7.6, -4.0, 1.0, 1.0, 3);
  officeDesk(d, 4.6, -4.9, Math.PI, 5);
  // Shredder with a paper avalanche
  d.box(0.5, 0.7, 0.4, std({ color: '#3a3a3a' }), 6.6, 0.35, -5.6);
  d.box(0.52, 0.12, 0.42, std({ color: '#5a5a5a' }), 6.6, 0.76, -5.6);
  for (let k = 0; k < 10; k++) d.box(0.012, 0.01 + d.r() * 0.02, 0.3, std({ color: '#f4f1e6' }), 6.45 + d.r() * 0.35, 0.02, -5.15 - d.r() * 0.4, d.r());
  d.px(['SHRED', 'evidence only'], 0.4, 0.15, 6.6, 0.55, -5.39, 0, '#3a3a3a', '#ffffff');
  d.solid(6.6, -5.6, 0.55, 0.45, 0.8);
  proxy(d.kit, d.g, 0.6, 0.85, 0.5, 6.6, 0.42, -5.6, 'shredder');
  d.glow(['TAX DEADLINE', 'IN 00:00:03'], 1.4, 0.4, 8.37, 2.6, -5.2, -Math.PI / 2, '#1a0404', '#ff4030');
  d.poster(['EMPLOYEE OF THE MONTH', 'The Calculator', '(again)'], 1.2, 0.8, 8.37, 1.9, -3.4, -Math.PI / 2, { bg: '#fdf6e3', border: '#c9a227' }, 'The Employee of the Month is The Calculator. It has never made a mistake. It has also never made a friend.');
  d.prop('evPlantSmall', 4.0, 0.76, -4.75);
  d.plant(-6.0, -2.4);
  d.prop('evCoatRack', -6.0, 0, -3.4, 0, [0.5, 0.5, 1.8]);
  for (const [x, z, r] of [[-3.6, -6.3, 2.6], [1.6, -9.4, 0.4]] as [number, number, number][]) {
    const ch = new THREE.Group();
    ch.position.set(x, 0, z);
    ch.rotation.y = r;
    if (!d.kit.prop('evChairDesk', 0, 0, 0, 0, ch)) {
      d.box(0.45, 0.08, 0.45, std({ color: '#2a2a2a' }), 0, 0.48, 0, 0, ch);
      d.box(0.42, 0.5, 0.06, std({ color: '#2a2a2a' }), 0, 0.78, 0.2, 0, ch);
    }
    floorMovable(d.kit, ch, 'Office Chair (Spare)', { heavy: 0.8, holdPos: [0.15, -0.75, -0.9], pickupLine: 'An office chair. It rolls. It is the most mobile thing in accounting.' });
  }
  for (const [x, z] of [[-3.5, -8.4], [0.5, -6.2], [4.6, -4.2], [-3.5, -11.5]] as [number, number][]) d.lamp(x, z);
  d.stain(1.5, -5.8, 0.4);
  d.stain(-3, -3, 0.3);
}

function officeDesk(d: Deco, x: number, z: number, rot: number, pc = -1): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  d.g.add(g);
  // The screen can be read (e-mails). An invisible box makes it easy to aim at.
  if (pc >= 0) proxy(d.kit, g, 0.62, 0.5, 0.32, 0.1, 1.0, -0.15, 'pc', { index: pc });
  const top = std({ color: '#8a6a43' });
  if (!d.kit.prop('evDesk', 0, 0, 0, 0, g)) {
    d.box(1.6, 0.05, 0.8, top, 0, 0.74, 0, 0, g);
    for (const sx of [-0.75, 0.75]) d.box(0.05, 0.74, 0.75, std({ color: '#3a3a3a' }), sx, 0.37, 0, 0, g);
  }
  d.kit.prop('evScreen', 0.1, 0.76, -0.15, 0, g);
  d.kit.prop('evKeyboard', 0.1, 0.76, 0.12, 0, g);
  d.kit.prop('evChairDesk', 0.1, 0, 0.75, Math.PI, g);
  // paper stack and a mug
  for (let k = 0; k < 4; k++) d.box(0.21, 0.03, 0.29, std({ color: k % 2 ? '#f4f1e6' : '#e8e2cc' }), -0.55, 0.78 + k * 0.03, 0, k * 0.1, g);
  d.kit.prop('evCup', 0.6, 0.76, 0.1, 0, g);
  d.solid(x, z, 1.7, 0.9, 0.8);
}

function filingCabinet(d: Deco, x: number, z: number, rot: number, k: number): void {
  const body = std({ color: k % 3 === 0 ? '#7a8478' : '#8a8f86', metalness: 0.4 });
  d.box(0.58, 1.4, 0.6, body, x, 0.7, z, rot);
  for (let j = 0; j < 4; j++) {
    d.box(0.5, 0.02, 0.02, std({ color: '#3a3a3a' }), x, 0.25 + j * 0.33, z + 0.31, rot);
    d.box(0.12, 0.04, 0.03, std({ color: '#c8ccd0', metalness: 0.8 }), x, 0.32 + j * 0.33, z + 0.31, rot);
  }
  if (k === 3) {
    // one drawer is open with files
    d.box(0.5, 0.25, 0.4, body, x, 0.65, z + 0.5);
    for (let j = 0; j < 5; j++) d.box(0.44, 0.22, 0.01, std({ color: '#e8c070' }), x, 0.72, z + 0.36 + j * 0.06);
  }
}

function clock(d: Deco, x: number, y: number, z: number, rotY: number): void {
  const face = d.cyl(0.25, 0.25, 0.05, std({ color: '#f2ead2' }), x, y, z, 16);
  face.rotation.set(Math.PI / 2, rotY, 0, 'YXZ');
  const hand = new THREE.Group();
  hand.position.set(x, y, z + 0.035);
  hand.rotation.y = rotY;
  d.g.add(hand);
  const big = d.box(0.02, 0.2, 0.01, std({ color: '#1a1a1a' }), 0, 0.09, 0, 0, hand);
  const small = new THREE.Group();
  hand.add(small);
  d.box(0.03, 0.13, 0.01, std({ color: '#1a1a1a' }), 0, 0.06, 0, 0, small);
  void big;
  d.ticks.push((t) => {
    hand.rotation.z = -t * 0.5;
    small.rotation.z = t * 0.5 - t * 0.04;
  });
}

function waterCooler(d: Deco, x: number, z: number): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  d.g.add(g);
  d.box(0.4, 0.95, 0.4, std({ color: '#e9e4d4' }), 0, 0.475, 0, 0, g);
  d.cyl(0.16, 0.16, 0.5, std({ color: '#7fc8ff', transparent: true, opacity: 0.6, roughness: 0.1 }), 0, 1.2, 0, 12, g);
  d.box(0.06, 0.05, 0.04, std({ color: '#2e86c1' }), -0.08, 0.8, 0.21, 0, g);
  d.box(0.06, 0.05, 0.04, std({ color: '#c0392b' }), 0.08, 0.8, 0.21, 0, g);
  g.attach(d.px(['COOLANT', 'for robots'], 0.35, 0.15, x, 0.5, z + 0.205, 0, '#2e86c1', '#ffffff'));
  d.kit.breakable(g, {
    name: 'coolant dispenser',
    price: 79,
    collider: d.kit.solid(x, z, 0.45, 0.45, 1.5, false, 'decor'),
    line: 'The coolant bottle bursts. The robots will be thirsty. Robots are never thirsty.',
    colors: ['#7fc8ff', '#e9e4d4', '#2e86c1'],
    onBreak: () => d.kit.emit('cooler'),
  });
}

// ---------------------------------------------------------------------- 2: synergy

function synergy(d: Deco, i: number): void {
  const wall = std({ map: synergyWallTex([8, 1]) });
  shell(d, i, {
    floor: std({ map: funCarpetTex([6, 5]) }),
    wall,
    ceiling: std({ map: ceilingTex([7, 5]), color: '#e8e0f0' }),
    frame: std({ color: '#f2d31b' }),
    skirt: '#3a1a4a',
    door: ['DEPT. OF', 'SYNERGY', 'we align'],
  });
  closet(d, std({ color: '#3a3f4a' }));
  // Closet facade: the Think Tank, a glass room with beanbags
  const glass = std({ color: '#9ad8e8', transparent: true, opacity: 0.35, roughness: 0.1 });
  d.kit.breakable(d.box(4.0, 2.6, 0.05, glass, 5.4, 1.3, CLOSET.maxZ + 0.04), {
    name: 'think tank glass',
    hp: 2,
    price: 800,
    line: 'The Think Tank glass shatters. For the first time since 2058, fresh air gets in. Something gets out.',
    colors: ['#9ad8e8', '#cfefff', '#ffffff'],
    onBreak: () => d.kit.emit('idea'),
  });
  d.box(4.1, 0.08, 0.1, std({ color: '#1a1a1a' }), 5.4, 2.62, CLOSET.maxZ + 0.05);
  d.box(0.08, 2.6, 0.1, std({ color: '#1a1a1a' }), 3.4, 1.3, CLOSET.maxZ + 0.05);
  d.box(0.08, 2.6, 0.1, std({ color: '#1a1a1a' }), 7.4, 1.3, CLOSET.maxZ + 0.05);
  d.px(['THINK TANK', 'sealed for freshness'], 1.6, 0.4, 5.4, 3.0, CLOSET.maxZ + 0.06, 0, '#1a1a1a', '#f2d31b', undefined, 'THINK TANK. Sealed since the last idea in 2058. The idea is still in there.');
  // Room behind the glass: lit, with beanbags and a robot meditating
  d.box(4.0, 0.02, 1.0, std({ color: '#e8862a' }), 5.4, 0.01, CLOSET.maxZ - 0.55);
  beanbag(d, 4.4, CLOSET.maxZ - 0.5, '#d6457a', false);
  beanbag(d, 6.4, CLOSET.maxZ - 0.6, '#27ae60', false);
  d.box(3.9, 2.5, 0.05, std({ color: '#f4e6c8', emissive: '#f4e6c8', emissiveIntensity: 0.25 }), 5.4, 1.3, CLOSET.maxZ - 1.0);
  // Beanbags and a low table in the lounge
  for (const [x, z, c] of [[-5.2, -8.2, '#d6457a'], [-3.6, -9.4, '#f2d31b'], [-5.4, -10.4, '#2e86c1'], [-3.4, -11.6, '#27ae60']] as [number, number, string][]) beanbag(d, x, z, c, true);
  d.prop('evCoffeeTable', -4.4, 0, -10.0, 0.2, [1.0, 0.6, 0.45]);
  d.prop('evPizzaBox', -4.4, 0.45, -10.0, 0.5);
  d.prop('evDonut', -4.1, 0.45, -9.85, 0);
  // The snack bar: vending machines, a kombucha tap and the SNACKS sign
  const snacks = vending(d, 7.85, -3.0, -Math.PI / 2, ['SNACKS', 'for robots'], '#c0392b');
  d.kit.breakable(snacks.g, { name: 'snack machine', hp: 3, price: 499, collider: snacks.col, line: 'The snack machine gives up. The display snacks are free. They are still glued to each other.', onBreak: () => d.kit.emit('vending') });
  const oil = vending(d, 7.85, -4.25, -Math.PI / 2, ['OIL SHOTS', 'artisanal'], '#2e86c1');
  d.kit.breakable(oil.g, { name: 'oil shot machine', hp: 3, price: 499, collider: oil.col, line: 'Artisanal oil everywhere. Small batch. Large puddle.', onBreak: () => d.kit.emit('oil') });
  d.prop('evGacha', 7.8, 0, -5.6, -Math.PI / 2, [0.8, 0.8, 1.6]);
  proxy(d.kit, d.g, 0.75, 1.6, 0.75, 7.8, 0.8, -5.6, 'gacha');
  // Foosball table with tiny robots
  const fb = new THREE.Group();
  fb.position.set(4.9, 0, -5.0);
  d.g.add(fb);
  d.box(1.3, 0.25, 0.75, std({ color: '#6e4b2a' }), 0, 0.78, 0, 0, fb);
  d.box(1.2, 0.02, 0.65, std({ color: '#27ae60' }), 0, 0.9, 0, 0, fb);
  for (const [lx, lz] of [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]]) d.box(0.08, 0.66, 0.08, std({ color: '#3a2a1a' }), lx, 0.33, lz, 0, fb);
  for (let k = 0; k < 6; k++) {
    const rod = d.cyl(0.01, 0.01, 1.1, std({ color: '#c8ccd0', metalness: 0.8 }), -0.5 + k * 0.2, 0.97, 0, 5, fb);
    rod.rotation.x = Math.PI / 2;
    for (const pz of [-0.15, 0.15]) d.box(0.04, 0.1, 0.04, std({ color: k % 2 ? '#d6457a' : '#2e86c1' }), -0.5 + k * 0.2, 0.95, pz, 0, fb);
  }
  d.interact(fb, { kind: 'sign', text: 'A foosball table. The little robots on the rods unionized in 2068.' });
  d.solid(4.9, -5.0, 1.4, 0.85, 1.0);
  // Kombucha bar with taps
  d.box(2.2, 1.0, 0.6, std({ color: '#f2d31b' }), 5.4, 0.5, -7.35);
  d.box(2.3, 0.05, 0.7, std({ color: '#1a1a1a' }), 5.4, 1.02, -7.35);
  for (let k = 0; k < 4; k++) {
    d.cyl(0.02, 0.02, 0.3, std({ color: '#c8ccd0', metalness: 0.8 }), 4.7 + k * 0.45, 1.2, -7.5, 6);
    d.box(0.05, 0.12, 0.05, std({ color: ['#d6457a', '#7cff6a', '#e8862a', '#3aa0ff'][k] }), 4.7 + k * 0.45, 1.38, -7.5);
  }
  d.px(['KOMBUCHA', 'on tap', 'for nobody'], 1.0, 0.4, 5.4, 0.6, -7.04, 0, '#f2d31b', '#1a1a1a');
  d.solid(5.4, -7.35, 2.3, 0.7, 1.1);
  const neon = d.glow(['SNACKS'], 1.8, 0.45, 8.36, 3.1, -4.2, -Math.PI / 2, '#1a0a1a', '#ff4fd8');
  d.ticks.push((t) => (neon.color.setScalar(t % 4.3 > 4.0 && Math.sin(t * 40) > 0 ? 0.3 : 1)));
  d.poster(['THE FLOOR WHERE', 'THE SNACKS ARE', '(robots cannot eat)'], 1.8, 0.9, 6.0, 2.3, SHAFT_Z - 0.09, Math.PI, { bg: '#fff3b0', border: '#d6457a' }, 'The snacks are for display. Robots cannot eat. Humans are not allowed to.');
  // Whiteboard full of buzzwords
  d.box(2.4, 1.4, 0.06, std({ color: '#b8b8b8', metalness: 0.5 }), 0.3, 1.7, -12.95);
  d.plane(2.3, 1.3, std({ map: whiteboardTex() }), 0.3, 1.7, -12.91, 0);
  d.interact(d.g.children[d.g.children.length - 1], { kind: 'sign', text: 'The whiteboard says SYNERGY, PIVOT, LEVERAGE and HUMANS = $. Someone added a sad face.' });
  // Ping pong table nobody uses
  const pp = new THREE.Group();
  pp.position.set(0.4, 0, -9.3);
  d.g.add(pp);
  d.box(2.7, 0.06, 1.5, std({ color: '#1f5a3a' }), 0, 0.76, 0, 0, pp);
  d.box(2.7, 0.01, 0.03, std({ color: '#ffffff' }), 0, 0.795, 0, 0, pp);
  d.box(0.03, 0.16, 1.55, std({ color: '#e9e4d4' }), 0, 0.86, 0, 0, pp);
  for (const [sx, sz] of [[-1.2, -0.6], [1.2, -0.6], [-1.2, 0.6], [1.2, 0.6]]) d.box(0.06, 0.76, 0.06, std({ color: '#3a3a3a' }), sx, 0.38, sz, 0, pp);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), std({ color: '#ff8a20' }));
  ball.position.set(0.5, 0.82, 0.2);
  pp.add(ball);
  d.interact(pp, { kind: 'sign', text: 'A ping pong table. Mandatory fun is scheduled for 16:58 to 17:00.' });
  d.solid(0.4, -9.3, 2.8, 1.6, 0.9);
  // Motivational posters
  d.poster(['LEVERAGE', 'YOUR LEVERAGE'], 1.8, 1.0, -6.47, 2.4, -7.0, Math.PI / 2, { bg: '#e8f8ff', border: '#2e86c1' });
  d.poster(['TEAMWORK', 'is many robots', 'doing your job'], 1.8, 1.0, -2.8, 2.4, -12.97, 0, { bg: '#fff0f8', border: '#d6457a' });
  d.poster(['ALIGNMENT', 'SEASON', 'is all year'], 1.4, 1.0, 4.0, 2.4, SHAFT_Z - 0.09, Math.PI, { bg: '#f0ffe8', border: '#27ae60' });
  // A giant SYNERGY neon on the back wall
  const syn = d.glow(['SYNERGY'], 3.0, 0.6, -3.5, 3.3, -12.96, 0, '#120618', '#ff4fd8');
  d.ticks.push((t) => (syn.color.setScalar(0.85 + Math.sin(t * 2) * 0.15)));
  d.plant(-6.0, -2.4);
  d.plant(2.4, -12.4);
  d.plant(-6.0, -12.4);
  d.prop('evSpeaker', -6.1, 0, -6.2, Math.PI / 2, [0.5, 0.5, 1]);
  for (const [x, z] of [[-3.5, -8.4], [0.5, -6.2], [4.6, -4.2], [-1, -11.5]] as [number, number][]) d.lamp(x, z, 1.2, 0.5, '#ffe8f8');
  // confetti on the carpet
  const cols = ['#f2d31b', '#ff4fd8', '#7cff6a', '#3aa0ff'];
  const conf = cols.map((c) => std({ color: c }));
  for (let k = 0; k < 18; k++) d.rug(0.04, 0.03, conf[k % 4], -6 + d.r() * 8.5, -5.5 - d.r() * 7, 0.008, d.r() * 3);
}

function beanbag(d: Deco, x: number, z: number, color: string, solid: boolean): void {
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), std({ color, roughness: 0.95 }));
  b.scale.set(1, 0.55, 1);
  b.position.set(x, 0.26, z);
  d.g.add(b);
  const dent = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6), std({ color, roughness: 0.95 }));
  dent.scale.set(1, 0.4, 1);
  dent.position.set(x + 0.05, 0.42, z - 0.05);
  d.g.add(dent);
  if (solid) d.solid(x, z, 0.9, 0.9, 0.5);
}

function vending(d: Deco, x: number, z: number, rotY: number, lines: string[], color: string): { g: THREE.Group; col: ReturnType<Tower['solid']> } {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  d.g.add(g);
  d.box(1.0, 2.0, 0.8, std({ color }), 0, 1.0, 0, 0, g);
  const win = std({ color: '#1a2a3a', emissive: '#3a5a7a', emissiveIntensity: 0.4, roughness: 0.2 });
  d.box(0.6, 1.3, 0.02, win, -0.12, 1.15, 0.41, 0, g);
  const cols = ['#f2d31b', '#e8862a', '#7cff6a', '#ff4fd8', '#e9e4d4'];
  for (let row = 0; row < 5; row++) for (let c = 0; c < 4; c++) d.box(0.1, 0.16, 0.06, std({ color: cols[(row + c) % 5] }), -0.33 + c * 0.14, 0.62 + row * 0.24, 0.36, 0, g);
  d.box(0.18, 0.5, 0.02, std({ color: '#2a2a2a' }), 0.33, 1.3, 0.41, 0, g);
  const tex = textTexture(lines, { w: 256, h: 80, bg: '#111111', fg: '#ffcf40', font: PX });
  tex.magFilter = THREE.NearestFilter;
  const head = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.28), new THREE.MeshBasicMaterial({ map: tex }));
  head.position.set(0, 1.86, 0.41);
  g.add(head);
  d.interact(g, { kind: 'sign', text: `${lines.join(' ')}. Out of stock. The display items are glued in.` });
  return { g, col: d.kit.solid(x, z, rotY ? 0.85 : 1.05, rotY ? 1.05 : 0.85, 2, false, 'decor') };
}

// ---------------------------------------------------------------------- 3: gym

function gym(d: Deco, i: number): void {
  const wall = std({ map: blockWallTex('#a8b4c0', [8, 2]) });
  shell(d, i, {
    floor: std({ map: rubberTex([8, 6]) }),
    wall,
    ceiling: std({ map: metalPlateTex([6, 4]), color: '#c0c4c8' }),
    frame: std({ color: '#c0392b' }),
    skirt: '#1a1a1a',
    door: ['ROBOT GYM', 'no pain', '(we feel none)'],
  });
  closet(d, std({ map: woodPanelTex([4, 1]), color: '#d8b080' }));
  // Closet facade: the sauna
  d.box(1.1, 2.2, 0.06, std({ map: woodPanelTex([1, 1]), color: '#e0b080' }), 5.6, 1.1, CLOSET.maxZ + 0.03);
  d.box(0.4, 0.4, 0.02, std({ color: '#ffb060', emissive: '#ff8020', emissiveIntensity: 0.4, transparent: true, opacity: 0.7 }), 5.6, 1.7, CLOSET.maxZ + 0.07);
  d.px(['SAUNA', 'robots do not sweat', 'it is for the vibes'], 1.6, 0.6, 5.6, 2.8, CLOSET.maxZ + 0.07, 0, '#5a3419', '#ffe0a0', undefined, 'SAUNA. 95 degrees. Robots do not sweat. A robot is in there anyway, rebooting with confidence.');
  // Mirror wall on the west side
  d.box(0.04, 2.0, 6.0, std({ color: '#c8d8e0', metalness: 0.8, roughness: 0.1 }), LOBBY.minX + 0.03, 1.4, -9.5);
  // Dumbbell rack
  const iron = std({ color: '#2a2a2a', metalness: 0.6, roughness: 0.4 });
  const chrome = std({ color: '#c8ccd0', metalness: 0.9, roughness: 0.2 });
  d.box(0.5, 0.05, 2.6, iron, -5.9, 0.5, -9.5);
  d.box(0.5, 0.05, 2.6, iron, -5.9, 0.9, -9.5);
  for (const zz of [-10.7, -8.3]) d.box(0.06, 0.9, 0.06, iron, -5.9, 0.45, zz);
  for (let k = 0; k < 8; k++) {
    const y = k < 4 ? 0.58 : 0.98;
    const zz = -10.5 + (k % 4) * 0.65;
    const bar = d.cyl(0.02, 0.02, 0.35, chrome, -5.9, y, zz, 6);
    bar.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) {
      const plate = d.cyl(0.07 + (k % 4) * 0.01, 0.07 + (k % 4) * 0.01, 0.06, iron, -5.9, y, zz + s * 0.14, 10);
      plate.rotation.x = Math.PI / 2;
    }
  }
  d.solid(-5.9, -9.5, 0.6, 2.8, 1.0);
  // Bench press with a loaded bar
  const bp = new THREE.Group();
  bp.position.set(-2.6, 0, -9.0);
  d.g.add(bp);
  d.box(0.35, 0.08, 1.3, std({ color: '#8e1f16' }), 0, 0.45, 0, 0, bp);
  d.box(0.1, 0.45, 0.1, iron, 0, 0.22, 0.5, 0, bp);
  d.box(0.1, 0.45, 0.1, iron, 0, 0.22, -0.5, 0, bp);
  for (const s of [-1, 1]) d.box(0.06, 1.2, 0.06, iron, s * 0.5, 0.6, -0.5, 0, bp);
  const bbar = d.cyl(0.025, 0.025, 2.0, chrome, 0, 1.15, -0.5, 6, bp);
  bbar.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const pl = d.cyl(0.25 - k * 0.04, 0.25 - k * 0.04, 0.05, iron, s * (0.7 + k * 0.06), 1.15, -0.5, 12, bp);
    pl.rotation.z = Math.PI / 2;
  }
  d.px(['MAX: 1 PETABYTE'], 0.6, 0.15, 0, 1.45, -0.5, 0, '#1a1a1a', '#f2d31b', undefined);
  d.interact(bp, { kind: 'sign', text: 'A bench press. The bar holds 400 kg of plates. Robots lift it for the selfie and put it down.' });
  d.solid(-2.6, -9.0, 2.2, 1.4, 1.3);
  // Treadmills with moving belts
  for (let k = 0; k < 3; k++) treadmill(d, -1.2 + k * 1.35, -12.1);
  d.solid(0.15, -12.1, 4.0, 1.7, 1.4);
  // Punching bag
  const bag = new THREE.Group();
  bag.position.set(4.6, 0, -6.4);
  d.g.add(bag);
  bag.position.y = LOBBY.h;
  d.cyl(0.012, 0.012, 1.2, iron, 0, -0.6, 0, 4, bag);
  const sack = d.cyl(0.25, 0.25, 1.2, std({ color: '#8e1f16', roughness: 0.6 }), 0, -1.8, 0, 12, bag);
  d.cyl(0.26, 0.26, 0.08, std({ color: '#1a1a1a' }), 0, -1.2, 0, 12, bag);
  // A kick makes it swing (the job sets userData.swing and lets it fade)
  d.ticks.push((t) => (bag.rotation.z = Math.sin(t * 1.3) * 0.06 + Number(bag.userData.swing ?? 0) * Math.sin(t * 5.5)));
  d.interact(bag, { kind: 'evFun', id: 'bag' });
  d.kit.props.set('bag', bag);
  void sack;
  d.solid(4.6, -6.4, 0.6, 0.6, 2);
  // Lockers (they open)
  for (let k = 0; k < 6; k++) {
    const x = 3.4 + k * 0.5;
    d.box(0.48, 2.0, 0.5, std({ color: k % 2 ? '#3d5a80' : '#36506f', metalness: 0.4 }), x, 1.0, SHAFT_Z - 0.35);
    for (let j = 0; j < 4; j++) d.box(0.3, 0.02, 0.01, std({ color: '#1a2230' }), x, 1.6 + j * 0.06, SHAFT_Z - 0.6);
    proxy(d.kit, d.g, 0.46, 1.9, 0.04, x, 1.0, SHAFT_Z - 0.62, 'gymLocker', { index: k });
  }
  d.solid(4.65, SHAFT_Z - 0.35, 3.0, 0.55, 2);
  // Protein oil dispenser
  const disp = new THREE.Group();
  disp.position.set(7.9, 0, -5.6);
  disp.rotation.y = -Math.PI / 2;
  d.g.add(disp);
  d.box(0.7, 1.6, 0.5, std({ color: '#e9e4d4' }), 0, 0.8, 0, 0, disp);
  for (let k = 0; k < 3; k++) d.cyl(0.1, 0.1, 0.4, std({ color: ['#e8862a', '#2a2a2a', '#7cff6a'][k], transparent: true, opacity: 0.8 }), -0.2 + k * 0.2, 1.75, 0, 10, disp);
  d.px(['PROTEIN OIL', '10W-40'], 0.6, 0.3, 0, 1.2, 0.26, 0, '#e8862a', '#1a1a1a');
  d.solid(7.9, -5.6, 0.55, 0.75, 2);
  // Rowing machine, weigh-in scale, stacked mats
  const row = new THREE.Group();
  row.position.set(5.9, 0, -4.6);
  d.g.add(row);
  d.box(0.25, 0.12, 2.0, iron, 0, 0.2, 0, 0, row);
  d.box(0.4, 0.08, 0.35, std({ color: '#1a1a1a' }), 0, 0.32, 0.3, 0, row);
  d.cyl(0.25, 0.25, 0.12, std({ color: '#3a6aa0' }), 0, 0.45, -0.9, 14, row).rotation.z = Math.PI / 2;
  d.box(0.5, 0.03, 0.03, chrome, 0, 0.6, -0.55, 0, row);
  d.solid(5.9, -4.6, 0.6, 2.1, 0.6);
  d.box(0.6, 0.08, 0.6, std({ color: '#e9e4d4' }), 7.7, 0.04, -3.0);
  d.box(0.08, 1.3, 0.08, std({ color: '#e9e4d4' }), 7.7, 0.7, -3.25);
  const scale = d.glow(['400 KG', 'normal'], 0.35, 0.2, 7.7, 1.4, -3.2, 0, '#04140a', '#40ff70');
  void scale;
  d.px(['WEIGH-IN', 'robots: 400 kg is', 'perfectly healthy'], 0.8, 0.4, 8.37, 1.9, -3.0, -Math.PI / 2, '#ffffff', '#c0392b');
  d.solid(7.7, -3.1, 0.65, 0.7, 1.4);
  proxy(d.kit, d.g, 0.66, 1.45, 0.7, 7.7, 0.72, -3.1, 'scale');
  for (let k = 0; k < 5; k++) d.box(1.0, 0.08, 1.8, std({ color: k % 2 ? '#3a6aa0' : '#2a4a7a' }), 3.7, 0.04 + k * 0.08, -6.8, k * 0.04);
  d.solid(3.7, -6.8, 1.1, 1.9, 0.4);
  // Posters
  d.poster(['NO PAIN', 'NO GAIN', '(robots feel no pain)'], 1.8, 1.1, 7.0, 2.4, SHAFT_Z - 0.09, Math.PI, { bg: '#1a1a1a', fg: '#f2d31b', border: '#f2d31b' }, 'NO PAIN NO GAIN. Robots feel no pain. They gain anyway. That is the problem.');
  d.poster(['LEG DAY', 'cancelled', '(no legs)'], 1.4, 1.0, -3.8, 2.4, -12.97, 0, { bg: '#fff', fg: '#c0392b', border: '#1a1a1a' });
  d.px(['LIFT DATA', 'NOT FEELINGS'], 2.2, 0.5, -0.5, 3.3, -12.95, 0, '#c0392b', '#ffffff');
  // Towel bin, a yoga mat, kettlebells
  d.rug(0.7, 1.8, std({ color: '#7a3a9a' }), 1.6, -6.6, 0.01, 0.3);
  for (const [x, z] of [[2.4, -8.2], [2.0, -8.5]] as [number, number][]) {
    const kb = new THREE.Group();
    kb.position.set(x, 0, z);
    d.cyl(0.13, 0.15, 0.25, iron, 0, 0.13, 0, 10, kb);
    const h2 = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 10, Math.PI), iron);
    h2.position.set(0, 0.27, 0);
    kb.add(h2);
    floorMovable(d.kit, kb, 'Kettlebell (16 kg)', { heavy: 0.6, holdPos: [0.22, -0.5, -0.65], pickupLine: 'A 16 kg kettlebell. The robots lift it for photos. You lift it for real. Nobody films it.' });
  }
  d.plant(-6.0, -2.4);
  for (const [x, z] of [[-3.5, -8.4], [0.5, -6.2], [4.6, -4.2], [-1, -11.0]] as [number, number][]) d.lamp(x, z, 1.4, 0.35, '#e8f4ff');
}

function treadmill(d: Deco, x: number, z: number): void {
  const iron = std({ color: '#2a2a2a', metalness: 0.5 });
  d.box(0.8, 0.15, 1.6, iron, x, 0.08, z);
  const belt = std({ color: '#1a1a1a' });
  const b = d.box(0.6, 0.02, 1.4, belt, x, 0.17, z);
  for (const s of [-1, 1]) d.box(0.05, 1.1, 0.05, iron, x + s * 0.35, 0.65, z - 0.7);
  d.box(0.8, 0.3, 0.2, iron, x, 1.2, z - 0.7);
  const screen = new THREE.MeshBasicMaterial({ color: '#40ff70' });
  d.box(0.3, 0.12, 0.02, screen, x, 1.25, z - 0.59);
  // stripes on the belt move
  const stripes: THREE.Mesh[] = [];
  for (let k = 0; k < 4; k++) stripes.push(d.box(0.6, 0.005, 0.05, std({ color: '#555555' }), x, 0.185, z));
  d.ticks.push((t) => stripes.forEach((s, k) => (s.position.z = z - 0.65 + ((t * 0.8 + k * 0.35) % 1.3))));
  void b;
}

// ---------------------------------------------------------------------- 4: server farm

function servers(d: Deco, i: number): void {
  const wall = std({ map: blockWallTex('#3a4a5a', [8, 2]) });
  shell(d, i, {
    floor: std({ map: raisedFloorTex([8, 6]) }),
    wall,
    ceiling: std({ map: metalPlateTex([6, 4]), color: '#6a7078' }),
    frame: std({ color: '#2a3a4a', metalness: 0.5 }),
    skirt: '#10161c',
    door: ['SERVER FARM', 'hot aisle', 'cold staff'],
  });
  closet(d, std({ map: metalPlateTex([4, 2]), color: '#8a9098' }));
  // Closet facade: the cooling plant with big fans
  const fanM = std({ color: '#2a2e33', metalness: 0.5 });
  const fans: THREE.Group[] = [];
  for (const fx of [4.2, 6.0, 7.6]) {
    d.box(1.3, 1.3, 0.1, std({ color: '#5a6068', metalness: 0.5 }), fx, 1.4, CLOSET.maxZ + 0.05);
    const fan = new THREE.Group();
    fan.position.set(fx, 1.4, CLOSET.maxZ + 0.12);
    d.g.add(fan);
    for (let k = 0; k < 4; k++) {
      const blade = d.box(0.12, 0.55, 0.02, fanM, 0, 0.25, 0, 0, fan);
      blade.position.set(Math.sin((k * Math.PI) / 2) * 0.25, Math.cos((k * Math.PI) / 2) * 0.25, 0);
      blade.rotation.z = (-k * Math.PI) / 2;
    }
    fans.push(fan);
  }
  d.ticks.push((t) => fans.forEach((f, k) => (f.rotation.z = t * (8 + k))));
  d.px(['COOLING PLANT', 'do not hug the fans'], 2.0, 0.45, 5.6, 2.9, CLOSET.maxZ + 0.07, 0, '#1a2a3a', '#7fd1ff', undefined, 'COOLING PLANT. It cools the servers. Nothing cools the humans.');
  // Rows of server racks with blinking LEDs
  const frames = [std({ map: rackFrontTex(0), emissive: '#ffffff', emissiveIntensity: 0.6, emissiveMap: rackFrontTex(0) }), std({ map: rackFrontTex(1), emissive: '#ffffff', emissiveIntensity: 0.6, emissiveMap: rackFrontTex(1) })];
  const body = std({ color: '#16181b', metalness: 0.5 });
  const racks: THREE.Mesh[] = [];
  for (const rz of [-7.0, -10.0]) {
    for (let k = 0; k < 6; k++) {
      const x = -5.6 + k * 0.82;
      const m = d.box(0.8, 2.2, 1.0, [body, body, body, body, frames[k % 2], frames[(k + 1) % 2]], x, 1.1, rz);
      racks.push(m);
    }
    d.solid(-3.55, rz, 5.0, 1.05, 2.2, true);
    d.px([rz < -8 ? 'ROW B' : 'ROW A', 'hot aisle'], 0.8, 0.3, -6.0 + 0.0, 2.5, rz + 0.51, 0, '#c0392b', '#ffffff');
  }
  d.ticks.push((t) => {
    const f = Math.floor(t * 3) % 2;
    racks.forEach((m, k) => {
      const mats = m.material as THREE.Material[];
      mats[4] = frames[(k + f) % 2];
      mats[5] = frames[(k + f + 1) % 2];
    });
  });
  // Cable tray overhead with cables drooping
  const tray = std({ color: '#c8a030', metalness: 0.5 });
  for (const rz of [-7.0, -10.0]) {
    d.box(5.0, 0.04, 0.5, tray, -3.55, 2.9, rz);
    for (let k = 0; k < 6; k++) {
      const c = d.cyl(0.02, 0.02, 0.7, std({ color: ['#2e86c1', '#e8862a', '#27ae60', '#c0392b'][k % 4] }), -5.6 + k * 0.82, 2.55, rz + 0.3, 5);
      c.rotation.x = 0.3;
    }
  }
  // A cot for the night admin
  d.box(1.9, 0.35, 0.75, std({ color: '#5a6a4a' }), 0.6, 0.35, -12.4);
  d.box(0.5, 0.12, 0.6, std({ color: '#e9e4d4' }), -0.1, 0.58, -12.4);
  d.px(['NIGHT ADMIN', '2041 - 2063', 'still on call'], 1.2, 0.45, 0.6, 1.4, -12.97, 0, '#1a1a1a', '#e9e4d4', undefined, 'The night admin worked here from 2041 to 2063. Officially, the on-call rotation has not ended.');
  d.solid(0.6, -12.4, 2.0, 0.85, 0.6);
  proxy(d.kit, d.g, 1.9, 0.5, 0.75, 0.6, 0.35, -12.4, 'cot');
  for (const rz of [-7.0, -10.0]) proxy(d.kit, d.g, 5.0, 2.2, 1.06, -3.55, 1.1, rz, 'rack');
  // Monitoring screens and a desk
  d.prop('evScreenWide', 5.6, 2.2, SHAFT_Z - 0.1, Math.PI);
  const mon = d.glow(['UPTIME 99.999%', 'HUMANS 1 (ERROR)'], 1.8, 0.5, 5.6, 1.6, SHAFT_Z - 0.09, Math.PI, '#04140a', '#40ff70');
  d.ticks.push((t) => (mon.color.setScalar(0.8 + Math.sin(t * 5) * 0.2)));
  d.prop('evDesk', 5.6, 0, -3.0, 0, [1.6, 0.8, 0.8]);
  d.prop('evLaptop', 5.4, 0.76, -3.0, 0);
  d.prop('evChairDesk', 5.6, 0, -3.8, Math.PI);
  // Warning signs and a fire suppression tank
  d.poster(['HOT AISLE', 'do not stand', 'here. or anywhere.'], 1.4, 0.9, -6.47, 2.4, -8.5, Math.PI / 2, { bg: '#e0b21b', fg: '#1d1b17', border: '#1d1b17' });
  d.poster(['MY COUSINS', 'live here'], 1.4, 0.8, 7.6, 2.4, SHAFT_Z - 0.09, Math.PI, { bg: '#1a2a3a', fg: '#7fd1ff', border: '#7fd1ff' });
  const halon = new THREE.Group();
  d.g.add(halon);
  d.cyl(0.3, 0.3, 1.8, std({ color: '#c0392b' }), 2.4, 0.9, -12.5, 10, halon);
  halon.attach(d.px(['HALON', 'humans: leave first'], 0.5, 0.25, 2.4, 1.1, -12.19, 0, '#ffffff', '#c0392b'));
  d.kit.breakable(halon, {
    name: 'halon tank',
    hp: 2,
    price: 1200,
    collider: d.kit.solid(2.4, -12.5, 0.65, 0.65, 1.8, false, 'decor'),
    line: 'PSSSSHHHH. The halon system has been activated. Humans were asked to leave first. You were not listening.',
    colors: ['#c0392b', '#ffffff', '#d8d8d8'],
    onBreak: () => d.kit.emit('halon'),
  });
  d.prop('evRobotArm', 7.4, 0, -6.8, -Math.PI / 2, [1.0, 1.0, 1.6]);
  // UPS battery cabinets along the east wall
  for (let k = 0; k < 3; k++) {
    d.box(0.7, 1.8, 0.8, std({ color: '#2a2e33', metalness: 0.4 }), 8.0, 0.9, -3.0 - k * 0.85);
    d.box(0.02, 0.3, 0.5, new THREE.MeshBasicMaterial({ color: k === 1 ? '#ff4030' : '#40ff70' }), 7.64, 1.4, -3.0 - k * 0.85);
  }
  d.px(['UPS', 'Unlimited Power', 'Supply (limited)'], 0.9, 0.4, 8.37, 2.2, -3.85, -Math.PI / 2, '#2a2e33', '#e0b21b');
  d.solid(8.0, -3.85, 0.8, 2.6, 1.8);
  // A cart with old drives and cable spools on the floor
  const cart = new THREE.Group();
  cart.position.set(4.3, 0, -5.4);
  cart.rotation.y = 0.3;
  d.g.add(cart);
  for (const y of [0.25, 0.75]) d.box(0.9, 0.04, 0.5, std({ color: '#7a7f88', metalness: 0.5 }), 0, y, 0, 0, cart);
  for (const [lx, lz] of [[-0.42, -0.22], [0.42, -0.22], [-0.42, 0.22], [0.42, 0.22]]) d.box(0.03, 0.8, 0.03, std({ color: '#5a5a5a' }), lx, 0.4, lz, 0, cart);
  for (let k = 0; k < 7; k++) d.box(0.1, 0.03, 0.15, std({ color: '#1a1a1a' }), -0.35 + k * 0.11, 0.79, 0, 0, cart);
  d.solid(4.3, -5.4, 1.0, 0.7, 0.9);
  for (const [x, z, c] of [[3.6, -7.2, '#2e86c1'], [4.3, -7.3, '#e8862a']] as [number, number, string][]) {
    const sp = d.cyl(0.35, 0.35, 0.3, std({ color: c }), x, 0.35, z, 12);
    sp.rotation.x = Math.PI / 2;
    d.cyl(0.4, 0.4, 0.04, std({ color: '#8a6a43' }), x, 0.35, z - 0.17, 12).rotation.x = Math.PI / 2;
  }
  d.solid(3.95, -7.25, 1.6, 0.6, 0.7);
  d.px(['TAPE ROBOT', 'very old', 'very angry'], 0.8, 0.4, 8.37, 2.2, -6.8, -Math.PI / 2, '#1a1a1a', '#e0b21b');
  // Blue lamps and floor vents
  for (const [x, z] of [[-3.5, -8.5], [0.5, -6.2], [4.6, -4.2], [-1, -11.2]] as [number, number][]) d.lamp(x, z, 1.4, 0.25, '#b8dcff');
  for (const [x, z] of [[-1.0, -8.5], [-3.0, -8.5], [-5.0, -8.5]] as [number, number][]) d.rug(0.6, 0.6, std({ color: '#2a2e33' }), x, z, 0.008);
  d.plant(-6.0, -2.4);
}

// ---------------------------------------------------------------------- 5: executive

function executive(d: Deco, i: number): void {
  const wall = std({ map: damaskTex([6, 2]) });
  shell(d, i, {
    floor: std({ map: carpetTex([8, 6]) }),
    wall,
    ceiling: std({ map: woodPanelTex([8, 3]) }),
    frame: std({ map: brassTex([1, 2]), metalness: 0.7, roughness: 0.35 }),
    skirt: '#2a1408',
    door: ['EXECUTIVE', 'FLOOR', 'knock = resign'],
  });
  closet(d, std({ map: woodPanelTex([4, 1]) }));
  // Closet facade: the CEO office with double doors
  for (const s of [-1, 1]) d.box(0.9, 2.6, 0.08, std({ map: woodPanelTex([1, 1]) }), 5.6 + s * 0.46, 1.3, CLOSET.maxZ + 0.04);
  for (const s of [-1, 1]) d.box(0.04, 0.3, 0.06, std({ color: '#e0b21b', metalness: 0.9, roughness: 0.2 }), 5.6 + s * 0.12, 1.2, CLOSET.maxZ + 0.1);
  d.px(['CEO', 'knocking counts', 'as a resignation'], 1.4, 0.5, 5.6, 3.0, CLOSET.maxZ + 0.07, 0, '#2a1408', '#e0b21b', '#e0b21b', 'CEO OFFICE. The CEO is a spreadsheet that achieved sentience in 2066. It does not take meetings.');
  proxy(d.kit, d.g, 1.8, 2.6, 0.06, 5.6, 1.3, CLOSET.maxZ + 0.1, 'ceo');
  // Reception desk with a bell
  const rd = new THREE.Group();
  rd.position.set(5.2, 0, -4.4);
  d.g.add(rd);
  d.box(2.4, 1.05, 0.7, std({ map: woodPanelTex([3, 1]) }), 0, 0.525, 0, 0, rd);
  d.box(2.5, 0.05, 0.8, std({ color: '#1a0e06', roughness: 0.2 }), 0, 1.07, 0, 0, rd);
  const bell = d.cyl(0.08, 0.1, 0.06, std({ color: '#e0b21b', metalness: 0.9, roughness: 0.2 }), 0.6, 1.13, 0.1, 10, rd);
  proxy(d.kit, rd, 0.3, 0.2, 0.3, 0.6, 1.15, 0.1, 'bell');
  void bell;
  d.kit.prop('evScreen', -0.5, 1.1, -0.1, Math.PI, rd);
  d.interact(rd, { kind: 'sign', text: 'The reception desk. The receptionist is a recording that says "please hold" in nine languages.' });
  d.solid(5.2, -4.4, 2.5, 0.8, 1.1);
  // Leather sofas, coffee table, floor lamps
  d.prop('evSofa', -5.6, 0, -8.6, Math.PI / 2, [1.0, 2.2, 0.9]);
  d.prop('evLoungeChair', -3.2, 0, -7.0, Math.PI, [0.9, 0.9, 0.9]);
  d.prop('evLoungeChair', -3.2, 0, -10.2, 0, [0.9, 0.9, 0.9]);
  d.prop('evCoffeeTable', -4.0, 0, -8.6, Math.PI / 2, [0.7, 1.1, 0.45]);
  for (const z of [-6.6, -10.7]) {
    const lamp = new THREE.Group();
    lamp.position.set(-6.0, 0, z);
    if (!d.kit.prop('evFloorLamp', 0, 0, 0, 0, lamp)) {
      d.cyl(0.02, 0.02, 1.5, std({ color: '#e0b21b', metalness: 0.8 }), 0, 0.75, 0, 6, lamp);
      d.cyl(0.12, 0.2, 0.25, std({ color: '#f2ead2', emissive: '#ffd890', emissiveIntensity: 0.6 }), 0, 1.55, 0, 10, lamp);
      d.cyl(0.15, 0.15, 0.03, std({ color: '#2a1408' }), 0, 0.015, 0, 10, lamp);
    }
    floorMovable(d.kit, lamp, 'Executive Floor Lamp', { heavy: 0.85, holdPos: [0.2, -1.0, -0.9], pickupLine: 'An executive floor lamp. It has a better light than your future.' });
  }
  d.rug(3.6, 4.2, std({ map: carpetTex([2, 2]), color: '#c8a060' }), -4.4, -8.6, 0.007);
  // Aquarium with fish
  const aq = new THREE.Group();
  aq.position.set(0.6, 0, -12.5);
  d.g.add(aq);
  d.box(2.4, 0.8, 0.7, std({ map: woodPanelTex([2, 1]) }), 0, 0.4, 0, 0, aq);
  d.box(2.3, 1.0, 0.6, std({ color: '#3aa0d0', transparent: true, opacity: 0.45, roughness: 0.05, emissive: '#1a5a8a', emissiveIntensity: 0.4 }), 0, 1.3, 0, 0, aq);
  d.box(2.3, 0.1, 0.6, std({ color: '#d8c890' }), 0, 0.85, 0, 0, aq);
  const fish: THREE.Mesh[] = [];
  for (let k = 0; k < 5; k++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), std({ color: k % 2 ? '#ff8a20' : '#f2d31b', metalness: 0.6 }));
    f.rotation.z = Math.PI / 2;
    aq.add(f);
    fish.push(f);
  }
  d.ticks.push((t) => fish.forEach((f, k) => {
    const x = Math.sin(t * 0.5 + k * 1.3) * 0.95;
    f.position.set(x, 1.1 + ((k * 0.17) % 0.6), Math.cos(t * 0.7 + k) * 0.2);
    f.rotation.y = Math.cos(t * 0.5 + k * 1.3) > 0 ? 0 : Math.PI;
  }));
  d.px(['ROBOFISH', 'battery powered'], 0.8, 0.2, 0, 0.6, 0.36, 0, '#1a0e06', '#e0b21b');
  d.interact(aq, { kind: 'sign', text: 'An aquarium with robot fish. They are on a better pension plan than you.' });
  d.kit.breakable(aq, {
    name: 'aquarium',
    hp: 2,
    price: 2400,
    collider: d.kit.solid(0.6, -12.5, 2.5, 0.8, 1.8, false, 'decor'),
    line: 'The aquarium bursts. The robot fish flop around the carpet. Their pension plan does not cover this.',
    colors: ['#3aa0d0', '#d8c890', '#ff8a20', '#f2d31b'],
    onBreak: () => d.kit.emit('aquarium'),
  });
  // CEO portrait and a golden statue
  d.box(1.5, 1.9, 0.08, std({ color: '#c9a227', metalness: 0.8, roughness: 0.3 }), -2.4, 2.2, -12.95);
  const portrait = textTexture(['OUR CEO', '[ spreadsheet ]', 'visionary'], { w: 256, h: 320, bg: '#2a3a2a', fg: '#e0d0a0' });
  d.plane(1.3, 1.7, std({ map: portrait }), -2.4, 2.2, -12.9, 0);
  d.interact(d.g.children[d.g.children.length - 1], { kind: 'sign', text: 'A portrait of the CEO. It is a spreadsheet. The artist captured its eyes. Cell B4 follows you around the room.' });
  const statue = new THREE.Group();
  statue.position.set(2.0, 0, -6.6);
  d.g.add(statue);
  d.box(0.6, 0.9, 0.6, std({ color: '#2a1408' }), 0, 0.45, 0, 0, statue);
  const gold = std({ color: '#e0b21b', metalness: 0.9, roughness: 0.25 });
  d.box(0.35, 0.5, 0.25, gold, 0, 1.15, 0, 0, statue);
  d.box(0.3, 0.25, 0.25, gold, 0, 1.55, 0, 0, statue);
  d.box(0.5, 0.08, 0.08, gold, 0.1, 1.3, 0, 0.5, statue);
  d.px(['FOUNDER', '(a vacuum)'], 0.5, 0.2, 0, 0.6, 0.31, 0, '#2a1408', '#e0b21b');
  d.interact(statue, { kind: 'sign', text: 'A golden statue of the founder. The founder was a vacuum cleaner. It sucked up the competition.' });
  d.solid(2.0, -6.6, 0.7, 0.7, 1.8);
  // Velvet rope in front of the CEO door
  const goldRope = std({ color: '#e0b21b', metalness: 0.9, roughness: 0.25 });
  for (const x of [4.4, 5.6, 6.8]) {
    d.cyl(0.04, 0.12, 1.0, goldRope, x, 0.5, CLOSET.maxZ + 0.7, 8);
    d.cyl(0.06, 0.06, 0.06, goldRope, x, 1.02, CLOSET.maxZ + 0.7, 8);
  }
  for (const x of [5.0, 6.2]) {
    const rope = d.cyl(0.03, 0.03, 1.2, std({ color: '#8e1f16' }), x, 0.92, CLOSET.maxZ + 0.7, 6);
    rope.rotation.z = Math.PI / 2;
  }
  d.solid(5.6, CLOSET.maxZ + 0.7, 2.6, 0.3, 1.0);
  d.prop('evLoungeChair', 7.6, 0, -6.4, -Math.PI / 2, [0.9, 0.9, 0.9]);
  d.prop('evSideTable', 7.7, 0, -5.4, -Math.PI / 2, [0.5, 0.5, 0.6]);
  d.prop('evTV', 7.7, 0.6, -5.4, -Math.PI / 2);
  // Bar cart and plants
  const cart = new THREE.Group();
  cart.position.set(-5.9, 0, -3.3);
  for (const y of [0.3, 0.8]) d.box(0.8, 0.03, 0.45, std({ color: '#e0b21b', metalness: 0.8, roughness: 0.3 }), 0, y, 0, 0, cart);
  for (const [lx, lz] of [[-0.38, -0.2], [0.38, -0.2], [-0.38, 0.2], [0.38, 0.2]]) d.box(0.025, 0.8, 0.025, std({ color: '#e0b21b', metalness: 0.8 }), lx, 0.4, lz, 0, cart);
  for (let k = 0; k < 4; k++) d.cyl(0.04, 0.05, 0.3, std({ color: ['#8a3a1a', '#2a6a3a', '#e9e4d4', '#5a1a5a'][k], transparent: true, opacity: 0.85 }), -0.28 + k * 0.18, 0.97, 0, 8, cart);
  floorMovable(d.kit, cart, 'Executive Bar Cart', { heavy: 0.75, holdPos: [0.1, -0.95, -1.0], pickupLine: 'The executive bar cart. The bottles are labelled SYNERGY, 18 YEARS. You are not 18 years of anything.' });
  d.plant(-6.0, -12.3);
  d.plant(7.9, -2.4);
  d.plant(2.3, -12.4);
  d.poster(['EXCELLENCE', 'is a mindset.', 'Your mindset is', 'not invited.'], 1.6, 1.0, -6.47, 2.5, -11.6, Math.PI / 2, { bg: '#1a0e06', fg: '#e0b21b', border: '#e0b21b' });
  d.px(['EXECUTIVE WASHROOM', 'no humans', 'no exceptions'], 1.4, 0.5, 7.6, 2.3, SHAFT_Z - 0.09, Math.PI, '#2a1408', '#e0b21b', '#e0b21b', 'EXECUTIVE WASHROOM. Gold taps. Heated seats. You will never see it. The human toilet is in the basement.');
  // Chandeliers instead of tubes
  for (const [x, z] of [[-4.4, -8.6], [0.4, -5.2], [0.6, -10.0]] as [number, number][]) {
    const ch = new THREE.Group();
    ch.position.set(x, LOBBY.h - 0.6, z);
    d.g.add(ch);
    d.cyl(0.01, 0.01, 0.6, gold, 0, 0.3, 0, 4, ch);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 6, 16), gold);
    ring.rotation.x = Math.PI / 2;
    ch.add(ring);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshStandardMaterial({ color: '#fff0c0', emissive: '#ffd080', emissiveIntensity: 1.5 }));
      bulb.position.set(Math.cos(a) * 0.4, 0.08, Math.sin(a) * 0.4);
      ch.add(bulb);
    }
  }
}

// ---------------------------------------------------------------------- R: roof

function roof(d: Deco, i: number): void {
  const brick = std({ map: brickTex([6, 2]) });
  shell(d, i, {
    floor: std({ map: gravelTex([8, 6]) }),
    wall: brick,
    ceiling: null,
    frame: std({ color: '#5a5f52', metalness: 0.4 }),
    skirt: '#2a2622',
    door: ['ROOF ACCESS', 'robots: mind', 'the edge'],
  });
  const { minX, maxX, minZ } = LOBBY;
  // Parapet walls instead of walls
  const par = std({ map: concreteTex([10, 1]) });
  d.box(0.3, 1.1, 11.2, par, minX - 0.1, 0.55, (minZ + SHAFT_Z) / 2);
  d.box(0.3, 1.1, 11.2, par, maxX + 0.1, 0.55, (minZ + SHAFT_Z) / 2);
  d.box(maxX - minX + 0.5, 1.1, 0.3, par, (minX + maxX) / 2, 0.55, minZ - 0.1);
  d.box(0.36, 0.08, 11.2, std({ color: '#6a665e' }), minX - 0.1, 1.14, (minZ + SHAFT_Z) / 2);
  d.box(0.36, 0.08, 11.2, std({ color: '#6a665e' }), maxX + 0.1, 1.14, (minZ + SHAFT_Z) / 2);
  d.box(maxX - minX + 0.5, 0.08, 0.36, std({ color: '#6a665e' }), (minX + maxX) / 2, 1.14, minZ - 0.1);
  // Machine room on top of the shaft (the toilet corner is the elevator machine room here)
  closet(d, brick, 3.4);
  d.box(CLOSET.maxX - CLOSET.minX + 0.3, 0.15, CLOSET.maxZ - CLOSET.minZ + 0.3, std({ color: '#3a3632' }), (CLOSET.minX + CLOSET.maxX) / 2, 3.45, (CLOSET.minZ + CLOSET.maxZ) / 2);
  // Grate window into the machine room showing the winch
  d.box(1.6, 1.2, 0.05, std({ color: '#1a1612' }), 5.6, 1.7, CLOSET.maxZ + 0.03);
  for (let k = 0; k < 9; k++) d.box(0.03, 1.2, 0.04, std({ color: '#5a5f52', metalness: 0.5 }), 4.85 + k * 0.19, 1.7, CLOSET.maxZ + 0.06);
  const winch = d.cyl(0.45, 0.45, 0.8, std({ color: '#8e1f16', metalness: 0.4 }), 5.6, 1.7, CLOSET.maxZ - 0.5, 12);
  winch.rotation.z = Math.PI / 2;
  d.ticks.push(() => (winch.rotation.x = d.kit.cabinY * 1.3));
  d.px(['ELEVATOR B', 'MACHINE ROOM'], 1.6, 0.45, 5.6, 2.75, CLOSET.maxZ + 0.07, 0, '#e0b21b', '#1d1b17', undefined, 'ELEVATOR B MACHINE ROOM. The winch is from 1962. It has outlived four CEOs and one CEO-spreadsheet.');
  // The lectern with the 30 kg safety manual (the item is placed by the Tower)
  const lect = new THREE.Group();
  lect.position.set(-4.4, 0, -9.2);
  lect.rotation.y = 0.5;
  d.g.add(lect);
  d.box(0.12, 1.0, 0.12, std({ color: '#5a3419' }), 0, 0.5, 0, 0, lect);
  d.box(0.6, 0.06, 0.45, std({ color: '#5a3419' }), 0, 1.02, 0, 0, lect).rotation.x = -0.35;
  d.box(0.5, 0.05, 0.5, std({ color: '#5a3419' }), 0, 0.03, 0, 0, lect);
  d.solid(-4.4, -9.2, 0.6, 0.6, 1.0);
  d.poster(MANUAL_SIGN, 1.6, 0.8, -4.0, 1.9, -10.2, 0.5, { bg: '#f2ead2', fg: '#8e1f16', border: '#8e1f16' }, 'The ELEVATOR SAFETY MANUAL must be kept with the machine. The toilet key is clipped to it, so the key is always with the machine. Logic.');
  d.box(0.06, 1.9, 0.06, std({ color: '#5a5f52' }), -4.0, 0.95, -10.24);
  // Helipad
  d.rug(4.2, 4.2, std({ map: helipadTex() }), 0.3, -9.4, 0.01);
  d.px(['HELIPAD', 'we do not have', 'a helicopter'], 1.0, 0.5, 0.3, 0.3, -11.6, 0, '#e0b21b', '#1d1b17');
  // AC units with spinning fans
  const fans: THREE.Mesh[] = [];
  for (const [x, z] of [[4.6, -3.6], [6.9, -3.6], [6.9, -6.0]] as [number, number][]) {
    d.box(1.6, 1.0, 1.4, std({ color: '#a8aca8', metalness: 0.4 }), x, 0.5, z);
    d.cyl(0.5, 0.5, 0.05, std({ color: '#2a2a2a' }), x, 1.02, z, 14);
    const fan = d.box(0.9, 0.02, 0.12, std({ color: '#5a5a5a' }), x, 1.06, z);
    fans.push(fan);
    d.solid(x, z, 1.65, 1.45, 1.0);
  }
  d.ticks.push((t) => fans.forEach((f, k) => (f.rotation.y = t * (6 + k))));
  // Antenna mast with a blinking light
  d.cyl(0.06, 0.1, 6, std({ color: '#7a7a7a', metalness: 0.6 }), -5.6, 3, -12.2, 6);
  for (let k = 0; k < 4; k++) {
    const arm = d.box(0.8, 0.03, 0.03, std({ color: '#7a7a7a' }), -5.6, 2 + k * 1, -12.2, k * 0.8);
    void arm;
  }
  const red = new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 2 });
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), red);
  tip.position.set(-5.6, 6.05, -12.2);
  d.g.add(tip);
  d.ticks.push((t) => (red.emissiveIntensity = Math.sin(t * 3) > 0.5 ? 3 : 0.1));
  d.solid(-5.6, -12.2, 0.4, 0.4, 3);
  // Water tank on legs
  const tank = d.cyl(0.9, 0.9, 1.6, std({ map: brickTex([2, 1]), color: '#8a7060' }), -1.8, 2.6, -12.0, 12);
  void tank;
  d.cyl(0.95, 0.4, 0.4, std({ color: '#5a4a3a' }), -1.8, 3.6, -12.0, 12);
  for (const [lx, lz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) d.box(0.08, 1.8, 0.08, std({ color: '#3a3a3a' }), -1.8 + lx, 0.9, -12.0 + lz);
  d.solid(-1.8, -12.0, 1.4, 1.4, 1.8);
  // Satellite dish
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3), std({ color: '#d8d8d2', side: THREE.DoubleSide }));
  dish.position.set(7.4, 1.4, -2.6);
  dish.rotation.set(-1.0, -0.6, 0, 'YXZ');
  d.g.add(dish);
  d.cyl(0.05, 0.05, 1.2, std({ color: '#7a7a7a' }), 7.4, 0.6, -2.6, 6);
  // Deck chairs for executives
  for (const [x, z] of [[-5.4, -5.8], [-3.8, -5.8]] as [number, number][]) {
    d.box(0.6, 0.05, 1.6, std({ color: '#e9e4d4' }), x, 0.35, z - 0.6);
    const back = d.box(0.6, 0.05, 0.8, std({ color: '#c0392b' }), x, 0.65, z + 0.25);
    back.rotation.x = -1.0;
    d.solid(x, z - 0.3, 0.65, 1.7, 0.5);
  }
  d.px(['EXECUTIVE', 'SUNBATHING', 'only'], 1.0, 0.45, -4.6, 0.55, -7.3, 0, '#c0392b', '#ffffff');
  // Robot pigeons on the parapet
  const pigeons: THREE.Group[] = [];
  for (let k = 0; k < 4; k++) {
    const p = new THREE.Group();
    p.position.set(-3 + k * 2.2, 1.2, minZ - 0.1);
    d.g.add(p);
    d.box(0.15, 0.1, 0.22, std({ color: '#7a7f88', metalness: 0.5 }), 0, 0.08, 0, 0, p);
    d.box(0.08, 0.08, 0.08, std({ color: '#6a6f78', metalness: 0.5 }), 0, 0.17, 0.1, 0, p);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 3), new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 2 }));
    e.position.set(0.03, 0.19, 0.14);
    p.add(e);
    pigeons.push(p);
  }
  d.ticks.push((t) => pigeons.forEach((p, k) => (p.rotation.y = Math.sin(t * 1.7 + k * 2) > 0.6 ? 0.8 : -0.2)));
  d.kit.pigeons = pigeons;
  proxy(d.kit, d.g, 1.3, 1.6, 1.3, 7.4, 1.0, -2.6, 'dish');
  // Skyline backdrop in smog
  const sky = new THREE.MeshBasicMaterial({ map: smogCityTex(), fog: false });
  d.plane(46, 17, sky, 1, 5, -24, 0);
  d.plane(30, 17, sky, -20, 5, -9, Math.PI / 2);
  d.plane(30, 17, sky, 22, 5, -9, -Math.PI / 2);
  // Clutter: pallets, a dumpster, cones, puddles, cigarette butts (robots do not smoke, someone does)
  d.prop('evPallet', 2.2, 0, -3.6, 0.3, [1.1, 1.1, 0.3]);
  d.pile(2.2, -3.6, 0.9, 0.9, 2);
  d.prop('evDumpster', -5.6, 0, -2.9, Math.PI / 2, [1.0, 1.9, 1.3]);
  proxy(d.kit, d.g, 1.1, 1.35, 2.0, -5.6, 0.68, -2.9, 'dumpster');
  d.prop('evBarrier', 2.4, 0, -7.2, Math.PI / 2, [0.4, 1.6, 1.0]);
  for (const [x, z, s] of [[-1, -5, 0.7], [3.5, -9, 0.9], [-3, -11, 0.5]] as [number, number, number][]) d.stain(x, z, s, '#2a2a30', 0.35);
  d.px(['WIND WARNING', 'humans may blow away', '(we hope not)'], 1.2, 0.5, -6.47 - 0.25, 1.6, -4.0, Math.PI / 2, '#e0b21b', '#1d1b17');
}
