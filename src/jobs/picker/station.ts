import * as THREE from 'three';
import { boxMaterials } from '../../details';
import type { Interact, LevelKit } from '../../level';
import { make, noise } from '../../textures';
import { aabb } from '../../util';
import { BENCH, BOX_SLOT, CONVEYOR, PILE_Z, PILES_X } from './layout';
import { matTex, pillowTex, plywoodTex } from './textures';

/**
 * Packing station 1: piles of flat boxes, the box well, the air pillow machine,
 * the tape dispenser, the station screen and the outgoing conveyor.
 */

export type BoxSize = 1 | 2 | 3;
export const SIZE_NAMES: Record<BoxSize, string> = { 1: 'L', 2: 'XL', 3: 'XXL' };
const DIMS: Record<BoxSize, [number, number, number]> = {
  1: [0.45, 0.32, 0.36],
  2: [0.72, 0.5, 0.56],
  3: [1.05, 0.76, 0.8],
};
/** Seconds of holding E on the air machine to fill each box. */
export const AIR_NEEDED: Record<BoxSize, number> = { 1: 1.2, 2: 2.6, 3: 4.2 };

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
const glowSign = (lines: string[], bg: string, fg: string, w = 256, h = 128) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => {
    g.font = `${i === 0 ? 22 : 12}px "Press Start 2P", monospace`;
    g.fillText(l, w / 2, (h / (lines.length + 0.5)) * (i + 0.8));
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
};

/** Branded packing tape, red on white, so everyone sees how much was used. */
const tapeTex = () =>
  make('picker-tape', 64, 8, (g) => {
    g.fillStyle = '#efe6d2';
    g.fillRect(0, 0, 64, 8);
    g.fillStyle = '#b3261c';
    g.fillRect(0, 0, 64, 1);
    g.fillRect(0, 7, 64, 1);
    g.font = 'bold 6px monospace';
    g.fillText('EVERYTHING DEPOT', 2, 6);
  });

/** A box on the bench or on its way out. */
export class PackBox {
  group = new THREE.Group();
  size: BoxSize;
  dims: [number, number, number];
  /** Air in units of "seconds of pumping". */
  air = 0;
  tape = 0;
  closed = false;
  contents: THREE.Object3D | null = null;
  private fillMesh: THREE.Mesh;
  private flaps: THREE.Mesh[] = [];
  private lid: THREE.Mesh;
  private tapeMat = std({ map: tapeTex(), roughness: 0.3 });

  constructor(size: BoxSize) {
    this.size = size;
    this.dims = DIMS[size];
    const [w, h, d] = this.dims;
    const g = this.group;
    const card = boxMaterials(size + 1);
    const t = 0.02;
    const wall = (ww: number, hh: number, dd: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), card);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    wall(w, t, d, 0, t / 2, 0);
    wall(w, h, t, 0, h / 2, -d / 2 + t / 2);
    wall(w, h, t, 0, h / 2, d / 2 - t / 2);
    wall(t, h, d, -w / 2 + t / 2, h / 2, 0);
    wall(t, h, d, w / 2 - t / 2, h / 2, 0);
    const flap = (ww: number, dd: number, x: number, z: number, rx: number, rz: number) => {
      const p = new THREE.Group();
      p.position.set(x, h, z);
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.012, dd), card);
      m.position.set(rz ? Math.sign(x) * (ww / 2) : 0, 0, rx ? Math.sign(z) * (dd / 2) : 0);
      p.add(m);
      p.rotation.set(rx, 0, rz);
      g.add(p);
      this.flaps.push(m);
    };
    // open flaps, standing up and leaning outwards
    flap(w, d / 2, 0, -d / 2, 1.2, 0);
    flap(w, d / 2, 0, d / 2, -1.2, 0);
    flap(w / 2, d, -w / 2, 0, 0, -1.2);
    flap(w / 2, d, w / 2, 0, 0, 1.2);
    this.lid = wall(w, 0.015, d, 0, h, 0);
    this.lid.visible = false;
    this.fillMesh = new THREE.Mesh(new THREE.BoxGeometry(w - 0.05, 1, d - 0.05), std({ map: pillowTex(), roughness: 0.3 }));
    this.fillMesh.visible = false;
    g.add(this.fillMesh);
    g.userData.interact = { kind: 'packBox' } satisfies Interact;
  }

  get fill(): number {
    return this.air / AIR_NEEDED[this.size];
  }

  /** Puts a product mesh in the box. */
  insert(obj: THREE.Object3D): void {
    this.contents = obj;
    obj.position.set(0, 0.02, 0);
    obj.rotation.set(0, 0.3, 0);
    this.group.add(obj);
  }

  setAir(a: number): void {
    this.air = Math.max(0, a);
    const f = this.fill;
    const [w, h, d] = this.dims;
    this.fillMesh.visible = f > 0.02;
    const fh = Math.min(f, 1.35) * h * 0.95;
    this.fillMesh.scale.set(f > 1 ? 1 + (f - 1) * 0.3 : 1, Math.max(0.01, fh), f > 1 ? 1 + (f - 1) * 0.3 : 1);
    this.fillMesh.position.y = fh / 2 + 0.01;
    void w;
    void d;
  }

  addTape(): void {
    const [w, h, d] = this.dims;
    if (!this.closed) {
      this.closed = true;
      for (const f of this.flaps) f.parent!.visible = false;
      this.lid.visible = true;
      this.fillMesh.visible = false;
    }
    const n = this.tape++;
    const s = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.tapeMat);
    if (n === 0) {
      s.scale.set(w + 0.02, 0.012, 0.09);
      s.position.set(0, h + 0.008, 0);
    } else if (n < 3) {
      const side = n === 1 ? -1 : 1;
      s.scale.set(0.012, h * 0.5, 0.09);
      s.position.set(side * (w / 2 + 0.006), h * 0.75, 0);
    } else {
      // mummification: tape everywhere, in every direction
      const a = Math.random() * Math.PI;
      s.scale.set(Math.max(w, d) * 1.1, 0.012, 0.08);
      s.position.set((Math.random() - 0.5) * w * 0.4, h + 0.01 + n * 0.002, (Math.random() - 0.5) * d * 0.4);
      s.rotation.y = a;
    }
    this.group.add(s);
  }
}

interface Puff {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  ground: boolean;
}

export interface Station {
  piles: THREE.Object3D[];
  pillowMachine: THREE.Object3D;
  tapeDispenser: THREE.Object3D;
  conveyorStart: THREE.Object3D;
  bench: THREE.Object3D;
  /** Draws the station screen. */
  screen(lines: string[], alert: boolean): void;
  /** Air machine noise and puffs while pumping. */
  pumping: boolean;
  /** Throws air pillows all over the floor. */
  burst(at: THREE.Vector3): void;
  tick(t: number): void;
}

export function buildStation(kit: LevelKit): Station {
  const scene = kit.scene;
  const add = <T extends THREE.Object3D>(o: T, parent: THREE.Object3D = scene): T => {
    parent.add(o);
    return o;
  };
  const box = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number, parent: THREE.Object3D = scene) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    return add(o, parent);
  };
  const steel = std({ color: '#5d6b74', metalness: 0.5, roughness: 0.5 });
  const top = std({ map: plywoodTex([3, 1]) });
  const yellow = std({ color: '#d9a400' });
  const dark = std({ color: '#2a2724' });

  // ------------------------------------------------ the bench with a low box well in the middle
  const bench = new THREE.Group();
  const bx = BENCH.x;
  const bz = BENCH.z;
  const wellX0 = BOX_SLOT.x - 1.0;
  const wellX1 = BOX_SLOT.x + 1.0;
  const left = bx - BENCH.w / 2;
  const right = bx + BENCH.w / 2;
  box(wellX0 - left, 0.05, BENCH.d, top, (left + wellX0) / 2, BENCH.h, bz, bench);
  box(right - wellX1, 0.05, BENCH.d, top, (right + wellX1) / 2, BENCH.h, bz, bench);
  // rollers in the well
  const roller = std({ color: '#9aa3a8', metalness: 0.7, roughness: 0.3 });
  for (let x = wellX0 + 0.1; x < wellX1; x += 0.16) {
    const r = box(0.05, 0.05, BENCH.d - 0.1, roller, x, 0.53, bz, bench);
    r.rotation.x = 0;
  }
  box(wellX1 - wellX0, 0.06, 0.05, yellow, BOX_SLOT.x, 0.53, bz - BENCH.d / 2, bench);
  box(wellX1 - wellX0, 0.06, 0.05, yellow, BOX_SLOT.x, 0.53, bz + BENCH.d / 2, bench);
  for (const x of [left + 0.05, wellX0, wellX1, right - 0.05]) {
    for (const dz of [-0.45, 0.45]) box(0.06, BENCH.h, 0.06, steel, x, BENCH.h / 2, bz + dz, bench);
  }
  // lower shelf with supplies
  box(BENCH.w, 0.03, BENCH.d - 0.1, steel, bx, 0.22, bz, bench);
  for (let i = 0; i < 6; i++) {
    const x = left + 0.4 + i * 0.32;
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10), std({ color: '#c9a36a', roughness: 0.4 }));
    roll.position.set(x, 0.28, bz + 0.2);
    roll.rotation.x = Math.PI / 2;
    bench.add(roll);
  }
  for (let i = 0; i < 4; i++) box(0.4, 0.04, 0.6, boxMaterials(i), right - 0.6, 0.26 + i * 0.045, bz, bench);
  // back panel (pegboard) with the screen
  const peg = make('picker-pegboard', 32, 32, (g, r) => {
    g.fillStyle = '#b48a55';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 12);
    g.fillStyle = '#5a4128';
    for (let y = 2; y < 32; y += 4) for (let x = 2; x < 32; x += 4) g.fillRect(x, y, 1, 1);
  }, [6, 2]);
  box(BENCH.w, 1.3, 0.04, std({ map: peg }), bx, BENCH.h + 0.7, bz + BENCH.d / 2 + 0.02, bench);
  // tools on the pegboard
  box(0.05, 0.25, 0.02, dark, left + 0.5, 1.6, bz + 0.5, bench);
  box(0.2, 0.28, 0.02, std({ color: '#ece4cf' }), left + 0.9, 1.55, bz + 0.49, bench);
  box(0.24, 0.32, 0.02, std({ color: '#6e4b2a' }), right - 0.6, 1.6, bz + 0.49, bench);
  scene.add(bench);
  bench.userData.interact = { kind: 'bench' } satisfies Interact;
  kit.interactables.push(bench);
  kit.colliders.push(aabb(bx, bz, BENCH.w, BENCH.d + 0.1, 1.0, false, 'bench'));

  // anti-fatigue mat (decorative, fatigue is still mandatory)
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(BENCH.w, 1.4), std({ map: matTex([12, 3]) }));
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(bx, 0.01, bz - BENCH.d / 2 - 0.75);
  scene.add(mat);

  // station screen
  const sc = document.createElement('canvas');
  sc.width = 256;
  sc.height = 128;
  const sg = sc.getContext('2d')!;
  const stex = new THREE.CanvasTexture(sc);
  stex.colorSpace = THREE.SRGBColorSpace;
  stex.magFilter = THREE.NearestFilter;
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: stex }));
  screenMesh.position.set(bx - 0.3, 2.05, bz + BENCH.d / 2 - 0.04);
  screenMesh.rotation.y = Math.PI;
  scene.add(screenMesh);
  box(1.6, 0.85, 0.06, dark, bx - 0.3, 2.05, bz + BENCH.d / 2 + 0.02);
  const sign = kit.sign(['PACK STATION 1', 'humans welcome (for now)'], 2.4, 0.5, bx + 2.0, 2.7, bz + BENCH.d / 2 - 0.02, Math.PI, { bg: '#7a2416', fg: '#f3e6c8', font: '"Press Start 2P", monospace' });
  void sign;

  // ------------------------------------------------ piles of flat boxes
  const piles: THREE.Object3D[] = [];
  const pileDims: [number, number][] = [
    [0.7, 0.55],
    [1.0, 0.8],
    [1.3, 1.1],
  ];
  const signStyle = { bg: '#f2ead2', fg: '#7a1f14', border: '#7a1f14', font: '"Press Start 2P", monospace' };
  const pileText = ['L', 'XL', 'XXL'];
  const pileSub = ['fits a sock (barely)', 'fits a sock (nicely)', 'fits a sock (as intended)'];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    g.position.set(PILES_X, 0, PILE_Z[i]);
    const [w, d] = pileDims[i];
    box(Math.max(w, 0.9), 0.12, Math.min(1.2, Math.max(d, 0.9)), std({ color: '#8a6a43' }), 0, 0.06, 0, g);
    const sheets = 10 + i * 4;
    for (let k = 0; k < sheets; k++) {
      const s = box(w, 0.035, d, boxMaterials((k + i) % 7), (Math.random() - 0.5) * 0.04, 0.14 + k * 0.036, (Math.random() - 0.5) * 0.04, g);
      s.rotation.y = (Math.random() - 0.5) * 0.08;
    }
    const pole = box(0.04, 1.6, 0.04, steel, 0.45, 0.8, 0, g);
    void pole;
    const tex = glowSign([pileText[i], pileSub[i]], '#f2ead2', '#7a1f14', 256, 128);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), std({ map: tex }));
    plate.position.set(0.47, 1.55, 0);
    plate.rotation.y = Math.PI / 2;
    g.add(plate);
    g.userData.interact = { kind: 'boxPile', size: i + 1 } satisfies Interact;
    scene.add(g);
    kit.interactables.push(g);
    piles.push(g);
  }
  void signStyle;
  kit.colliders.push(aabb(PILES_X, (PILE_Z[0] + PILE_Z[2]) / 2, 1.3, PILE_Z[2] - PILE_Z[0] + 1.1, 0.8, false, 'piles'));
  kit.sign(['BOXES', 'the algorithm', 'knows best'], 1.6, 0.9, PILES_X - 0.9, 2.2, PILE_Z[1], Math.PI / 2, { bg: '#1f3f6e', fg: '#f3e6c8', border: '#f0c419', font: '"Press Start 2P", monospace' });
  box(0.05, 2.6, 0.05, steel, PILES_X - 0.92, 1.3, PILE_Z[1] - 0.7);
  box(0.05, 2.6, 0.05, steel, PILES_X - 0.92, 1.3, PILE_Z[1] + 0.7);

  // ------------------------------------------------ air pillow machine
  const air = new THREE.Group();
  air.position.set(bx + 2.0, BENCH.h + 0.03, bz + 0.1);
  const red = std({ color: '#a8321f', roughness: 0.5 });
  box(0.55, 0.5, 0.45, red, 0, 0.25, 0, air);
  box(0.5, 0.12, 0.4, steel, 0, 0.56, 0, air);
  const film = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.46, 12), std({ map: pillowTex(), roughness: 0.3 }));
  film.rotation.z = Math.PI / 2;
  film.position.set(0, 0.76, 0.02);
  air.add(film);
  // the bag of pillows hanging above
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.4), new THREE.MeshStandardMaterial({ map: pillowTex(), roughness: 0.2, transparent: true, opacity: 0.85 }));
  bag.position.set(0.1, 1.35, 0.25);
  air.add(bag);
  // the nozzle points at the box well
  const nozzle = box(0.7, 0.08, 0.08, steel, -0.6, 0.35, -0.1, air);
  nozzle.rotation.z = -0.25;
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: glowSign(['AIR-O-MATIC', 'hold E'], '#111111', '#7cc44a', 256, 128) }));
  label.position.set(0, 0.28, -0.231);
  label.rotation.y = Math.PI;
  air.add(label);
  const airLed = new THREE.MeshStandardMaterial({ color: '#40ff40', emissive: '#40ff40', emissiveIntensity: 0.3 });
  box(0.05, 0.05, 0.02, airLed, 0.2, 0.45, -0.23, air);
  air.userData.interact = { kind: 'pillows' } satisfies Interact;
  scene.add(air);
  kit.interactables.push(air);

  // ------------------------------------------------ tape dispenser
  const tape = new THREE.Group();
  tape.position.set(bx - 2.3, BENCH.h + 0.03, bz);
  box(0.3, 0.12, 0.45, dark, 0, 0.06, 0, tape);
  const tRoll = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.045, 8, 16), std({ color: '#c9a36a', roughness: 0.3 }));
  tRoll.position.set(0, 0.2, 0.05);
  tRoll.rotation.y = Math.PI / 2;
  tape.add(tRoll);
  box(0.24, 0.02, 0.1, steel, 0, 0.14, -0.2, tape);
  // a pile of spare rolls and a tape gun
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.035, 6, 12), std({ color: '#c9a36a', roughness: 0.3 }));
    t.rotation.x = Math.PI / 2;
    t.position.set(-0.55 + i * 0.04, 0.035 + i * 0.07, 0.05);
    tape.add(t);
  }
  const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshBasicMaterial({ map: glowSign(['TAPE', 'min 3 strips'], '#111111', '#f0b43c', 256, 128) }));
  tl.position.set(0, 0.45, 0.2);
  tl.rotation.y = Math.PI;
  tape.add(tl);
  box(0.02, 0.3, 0.02, steel, 0, 0.3, 0.2, tape);
  tape.userData.interact = { kind: 'tape' } satisfies Interact;
  scene.add(tape);
  kit.interactables.push(tape);

  // ------------------------------------------------ outgoing conveyor and the sorter
  const cLen = CONVEYOR.x1 - CONVEYOR.x0;
  const cx = (CONVEYOR.x0 + CONVEYOR.x1) / 2;
  const beltBase = make('picker-belt', 16, 16, (g, r) => {
    g.fillStyle = '#2a2826';
    g.fillRect(0, 0, 16, 16);
    noise(g, r, 16, 16, 16);
    g.fillStyle = '#45413c';
    for (let x = 0; x < 16; x += 4) g.fillRect(x, 0, 1, 16);
  });
  const beltTex = beltBase.clone();
  beltTex.repeat.set(cLen * 2, 1);
  beltTex.needsUpdate = true;
  const belt = box(cLen, 0.04, 0.8, [dark, dark, std({ map: beltTex }), dark, dark, dark], cx, CONVEYOR.h, CONVEYOR.z);
  void belt;
  const rail = std({ color: '#d9a400', roughness: 0.5 });
  box(cLen, 0.14, 0.06, rail, cx, CONVEYOR.h + 0.04, CONVEYOR.z - 0.45);
  box(cLen, 0.14, 0.06, rail, cx, CONVEYOR.h + 0.04, CONVEYOR.z + 0.45);
  for (let x = CONVEYOR.x0 + 0.3; x < CONVEYOR.x1; x += 2) {
    for (const dz of [-0.4, 0.4]) box(0.07, CONVEYOR.h, 0.07, steel, x, CONVEYOR.h / 2, CONVEYOR.z + dz);
  }
  kit.colliders.push(aabb(cx, CONVEYOR.z, cLen, 1.0, 1.1, false, 'conveyor'));
  const start = new THREE.Group();
  start.position.set(CONVEYOR.x0 + 0.7, CONVEYOR.h, CONVEYOR.z);
  const startPad = box(1.3, 0.05, 0.85, std({ color: '#3a6a2a', roughness: 0.6 }), 0, 0.02, 0, start);
  void startPad;
  scene.add(start);
  start.userData.interact = { kind: 'conveyor' } satisfies Interact;
  kit.interactables.push(start);
  kit.sign(['OUTBOUND', 'no returns'], 1.4, 0.5, CONVEYOR.x0 + 0.8, 1.7, CONVEYOR.z - 0.47, Math.PI, { bg: '#3a6a2a', fg: '#f3e6c8', font: '"Press Start 2P", monospace' });
  box(0.04, 0.8, 0.04, steel, CONVEYOR.x0 + 0.1, 1.35, CONVEYOR.z - 0.47);

  // the sorter at the end
  const sx = CONVEYOR.x1 + 1.3;
  box(2.6, 2.6, 2.2, std({ color: '#6b7a5a', metalness: 0.3 }), sx, 1.3, CONVEYOR.z);
  box(2.7, 0.3, 2.3, yellow, sx, 2.7, CONVEYOR.z);
  const curtain = std({ color: '#5a5f55', roughness: 0.3, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 6; i++) box(0.02, 0.8, 0.13, curtain, CONVEYOR.x1 - 0.01, 1.35, CONVEYOR.z - 0.37 + i * 0.15);
  kit.sign(['SORT-O-MAT', 'sorts by vibes'], 2.0, 0.7, CONVEYOR.x1 - 0.03, 2.1, CONVEYOR.z, -Math.PI / 2, { bg: '#2c3e50', fg: '#f0b43c', font: '"Press Start 2P", monospace' }, 'The SORT-O-MAT. Nobody knows where the boxes go. Nobody asks.');
  kit.sign(['SORT-O-MAT', 'sorts by vibes'], 2.0, 0.7, sx, 2.1, CONVEYOR.z - 1.11, Math.PI, { bg: '#2c3e50', fg: '#f0b43c', font: '"Press Start 2P", monospace' });
  const beacon = new THREE.MeshStandardMaterial({ color: '#ff9a20', emissive: '#ff9a20', emissiveIntensity: 1 });
  const bl = box(0.18, 0.25, 0.18, beacon, sx, 3.0, CONVEYOR.z);
  kit.colliders.push(aabb(sx, CONVEYOR.z, 2.6, 2.2, 2.6, true, 'sorter'));

  // ------------------------------------------------ air pillow particles
  const puffGeo = new THREE.BoxGeometry(0.16, 0.05, 0.1);
  const puffMat = std({ map: pillowTex(), roughness: 0.3 });
  const puffs: Puff[] = [];
  const spawnPuff = (p: THREE.Vector3, v: THREE.Vector3, life: number) => {
    const m = new THREE.Mesh(puffGeo, puffMat);
    m.position.copy(p);
    m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    scene.add(m);
    puffs.push({ mesh: m, vel: v, life, ground: false });
  };

  let last = 0;
  let puffTimer = 0;
  const station: Station = {
    piles,
    pillowMachine: air,
    tapeDispenser: tape,
    conveyorStart: start,
    bench,
    pumping: false,
    screen(lines: string[], alert: boolean) {
      sg.fillStyle = alert ? '#3a0c06' : '#0b1a0e';
      sg.fillRect(0, 0, 256, 128);
      sg.fillStyle = alert ? '#ff6a4a' : '#7cc44a';
      sg.fillRect(0, 0, 256, 18);
      sg.fillStyle = '#0b0806';
      sg.font = '10px "Press Start 2P", monospace';
      sg.textAlign = 'left';
      sg.textBaseline = 'middle';
      sg.fillText('PACK STATION 1', 6, 10);
      sg.fillStyle = alert ? '#ff9a7a' : '#a6e07a';
      lines.slice(0, 5).forEach((l, i) => {
        sg.font = `${i === 0 ? 14 : 10}px "Press Start 2P", monospace`;
        sg.fillText(l, 6, 36 + i * 21);
      });
      stex.needsUpdate = true;
    },
    burst(at: THREE.Vector3) {
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 1.5 + Math.random() * 4;
        spawnPuff(at.clone().add(new THREE.Vector3(0, 0.3, 0)), new THREE.Vector3(Math.cos(a) * s, 2 + Math.random() * 4, Math.sin(a) * s), 25 + Math.random() * 10);
      }
    },
    tick(t: number) {
      const dt = Math.min(0.05, Math.max(0, t - last));
      last = t;
      beltTex.offset.x -= dt * 2;
      beacon.emissiveIntensity = Math.sin(t * 6) > 0 ? 1.6 : 0.2;
      bl.rotation.y = t * 4;
      airLed.emissiveIntensity = station.pumping ? (Math.sin(t * 30) > 0 ? 2 : 0.5) : 0.3;
      if (station.pumping) {
        film.rotation.x += dt * 12;
        puffTimer -= dt;
        if (puffTimer <= 0) {
          puffTimer = 0.12;
          const p = new THREE.Vector3();
          nozzle.getWorldPosition(p);
          p.x -= 0.3;
          spawnPuff(p, new THREE.Vector3(-1.2 - Math.random(), 0.8, (Math.random() - 0.5) * 0.6), 0.5);
        }
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const pf = puffs[i];
        pf.life -= dt;
        if (pf.life <= 0) {
          scene.remove(pf.mesh);
          puffs.splice(i, 1);
          continue;
        }
        if (pf.ground) continue;
        pf.vel.y -= 6 * dt;
        pf.vel.multiplyScalar(1 - dt * 0.8);
        pf.mesh.position.addScaledVector(pf.vel, dt);
        pf.mesh.rotation.x += dt * 4;
        if (pf.mesh.position.y < 0.03) {
          pf.mesh.position.y = 0.03;
          pf.mesh.rotation.set(0, pf.mesh.rotation.y, 0);
          pf.ground = true;
        }
      }
    },
  };
  station.screen(['WAITING', 'for an order'], false);
  return station;
}
