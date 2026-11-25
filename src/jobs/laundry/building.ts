import * as THREE from 'three';
import { Item } from '../../items';
import { hasModel } from '../../assets';
import { Interact, LevelKit, mat } from '../../level';
import { boxMaterials } from '../../details';
import { AABB, blobGeometry, textTexture } from '../../util';
import { cardboardTex, ceilingTex, concreteTex, ductTex, hazardTex, rackTex, wetFloorTex, tvStatic } from '../../textures';
import { buildGarmentMesh, CLOTHES, KEY_SOCK_DEF, lumpGeo, newGarment } from './garments';
import * as L from './texts';
import { blockTex, canvasTex, drumTex, enamelTex, grateTex, laminateTex, lintTex, matTex, pegTex, plyTex, steamTex, steelTex, tealTileTex, vinylTex } from './textures';

/**
 * The FOLD-O-MATIC 3000 industrial laundry: a bank of washer/dryer units along the back wall,
 * folding tables, a sock matching table, numbered pickup cubbies behind the counter,
 * a waiting area, an overhead hanger rail, steam, lint and a lot of clutter.
 */

export const ROOM = { minX: -18, maxX: 18, minZ: -13, maxZ: 13 };
export const UNIT_XS = [-11, -9.4, -7.8, -6.2, -4.6, -3.0];
export const UNIT_Z = -12.5;
export const TABLES = [
  { x: -9, z: -5.5 },
  { x: -5, z: -5.5 },
  { x: -1, z: -5.5 },
];
export const TABLE_Y = 0.92;
export const SOCK_TABLE = { x: 3.6, z: -5.5 };
export const LOST_BIN = { x: 5.8, z: -5.4 };
export const CUBBY = { x: -4.5, zBack: 2.3, zFront: 2.85, cols: 6, rows: 2, w: 0.6, h: 0.45, y0: 0.5 };
export const COUNTER = { x0: -9, x1: 0, z: 5.0 };
export const SPOTS = [-7.2, -4.5, -1.8].map((x) => new THREE.Vector3(x, 0, 6.2));
export const DOOR = new THREE.Vector3(-4.5, 0, 12.3);
export const BELL = new THREE.Vector3(-3.7, 1.06, 5.0);

export interface LInteract extends Interact {
  unit?: number;
  table?: number;
  cubby?: number;
}

export interface UnitParts {
  group: THREE.Group;
  screen: { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture };
  beacon: THREE.MeshBasicMaterial;
  washDrum: THREE.Group;
  dryDrum: THREE.Group;
  dial: THREE.Group;
  dialMat: THREE.MeshBasicMaterial;
  /** Where a robot stands to use this unit. */
  front: THREE.Vector3;
  vent: THREE.Vector3;
}

export interface TrayParts {
  slots: { pos: THREE.Vector3; item: Item | null }[];
}

/** Props the mischief code (mischief.ts) turns into breakables, movables and secrets. */
export interface LaundryRefs {
  vending: THREE.Group;
  vendingCollider: AABB;
  tvScreen: THREE.Mesh;
  tvTexture: THREE.Texture;
  cams: THREE.Group[];
  clock: THREE.Mesh;
  eotm: THREE.Mesh;
  tipJar: THREE.Mesh;
  dispenser: THREE.Group;
  regrets: THREE.Group;
  lintDoor: THREE.Group;
  posters: THREE.Mesh[];
  mannequin: THREE.Object3D | null;
  chairs: THREE.Object3D[];
  baskets: THREE.Group[];
  trash: THREE.Object3D | null;
  handTruck: THREE.Object3D | null;
  wetSign: THREE.Group;
  arm: THREE.Mesh;
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
const glow = (color: string) => new THREE.MeshBasicMaterial({ color });
const pix = (t: THREE.Texture) => {
  t.magFilter = THREE.NearestFilter;
  return t;
};
const PIX = '"Press Start 2P", monospace';
const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A rolling canvas laundry cart. Used for the parked ones and the one the robot child rides. */
export function buildCart(): THREE.Group {
  const g = new THREE.Group();
  const frame = std({ color: '#7f868c', metalness: 0.5 });
  const cv = std({ map: canvasTex() });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z);
    g.add(me);
    return me;
  };
  add(new THREE.BoxGeometry(0.9, 0.04, 0.6), frame, 0, 0.2, 0);
  for (const [x, z] of [[-0.42, -0.27], [0.42, -0.27], [-0.42, 0.27], [0.42, 0.27]] as [number, number][]) {
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.74), frame, x, 0.55, z);
    const w = add(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8), std({ color: '#222222' }), x, 0.06, z);
    w.rotation.z = Math.PI / 2;
  }
  add(new THREE.BoxGeometry(0.86, 0.5, 0.02), cv, 0, 0.47, 0.28);
  add(new THREE.BoxGeometry(0.86, 0.5, 0.02), cv, 0, 0.47, -0.28);
  add(new THREE.BoxGeometry(0.02, 0.5, 0.56), cv, 0.42, 0.47, 0);
  add(new THREE.BoxGeometry(0.02, 0.5, 0.56), cv, -0.42, 0.47, 0);
  add(new THREE.BoxGeometry(0.9, 0.03, 0.62), frame, 0, 0.73, 0);
  return g;
}

/** A clump of lint on the floor. */
export function buildLint(seed: number, size = 1): THREE.Mesh {
  const m = new THREE.Mesh(lumpGeo(0.09 * size, 0.7, seed, 1), new THREE.MeshStandardMaterial({ map: lintTex(), roughness: 1 }));
  m.scale.set(1.4, 0.45, 1.1);
  m.position.y = 0.035 * size;
  return m;
}

export class LaundryLevel extends LevelKit {
  units: UnitParts[] = [];
  tableTops: THREE.Object3D[] = [];
  tray: TrayParts = { slots: [] };
  cubbySlots: { pos: THREE.Vector3; items: Item[] }[] = [];
  lostBinPile!: THREE.Group;
  bellMesh!: THREE.Object3D;
  /** Places where steam comes out, with a switch. */
  steamVents: { pos: THREE.Vector3; on: () => boolean; rate: number; acc: number }[] = [];
  /** Extra steam for every vent (the boiler valve). */
  steamBoost = 1;
  refs = { cams: [], posters: [], chairs: [], baskets: [], mannequin: null, trash: null, handTruck: null } as unknown as LaundryRefs;
  /** Spots in front of the units where lint gathers. */
  private puffs: { s: THREE.Sprite; v: THREE.Vector3; life: number; max: number }[] = [];
  private lastT = 0;
  private tvUpdate: (() => void) | null = null;

  constructor(scene: THREE.Scene) {
    super(scene);
    this.bounds = ROOM;
    this.ceiling = 4.7;
    this.spawn = { pos: new THREE.Vector3(-5, 0, -3.4), yaw: 0 };
    this.bossWaypoints.push(
      new THREE.Vector3(-9, 0, -9),
      new THREE.Vector3(-4, 0, -9),
      new THREE.Vector3(1, 0, -9),
      new THREE.Vector3(-7, 0, -3),
      new THREE.Vector3(-2, 0, -3),
      new THREE.Vector3(3.5, 0, -3.5),
      new THREE.Vector3(-6, 0, 3.8),
      new THREE.Vector3(-2, 0, 3.8),
      new THREE.Vector3(8, 0, 2),
      new THREE.Vector3(10, 0, -6),
      new THREE.Vector3(-14, 0, -3),
      new THREE.Vector3(-13, 0, 8),
      new THREE.Vector3(4, 0, 9),
      new THREE.Vector3(12, 0, 9),
    );
    this.lights();
    this.room();
    this.machineBank();
    this.foldingTables();
    this.sockTable();
    this.cubbies();
    this.counter();
    this.toilet();
    this.westWall();
    this.northEast();
    this.eastSide();
    this.waitingArea();
    this.middleClutter();
    this.rail();
    this.ceilingStuff();
    this.floorStuff();
    this.posters();
    for (const [x, z] of [[-9.6, 12.2], [0.9, 12.2], [12.2, -7.6], [-17.2, 7.6]] as [number, number][]) this.plant(x, z);
    this.onTick((t) => this.animate(t));
  }

  // ---------------------------------------------------------------- shell

  private lights(): void {
    this.scene.background = new THREE.Color('#1d1a16');
    this.scene.add(new THREE.HemisphereLight('#fff4e0', '#5d5442', 2.0));
    const d = new THREE.DirectionalLight('#ffeacc', 0.8);
    d.position.set(-6, 12, 5);
    this.scene.add(d);
    const lamp = (x: number, y: number, z: number, color: string, intensity: number, dist: number) => {
      const l = new THREE.PointLight(color, intensity, dist, 1.6);
      l.position.set(x, y, z);
      this.scene.add(l);
      return l;
    };
    lamp(-7, 4.2, -10, '#fff1d6', 20, 14);
    lamp(-4.5, 3.8, 4, '#ffe2b0', 18, 12);
    lamp(11, 4.2, 2, '#ffe6b8', 18, 14);
    lamp(-12, 4.2, 9, '#ffd9a0', 16, 12);
    lamp(4, 4.2, 9, '#ffe6b8', 14, 12);
    const fl = lamp(11, 4.2, -9.5, '#cfe8ff', 14, 8);
    this.onTick((t) => {
      const phase = t % 6.1;
      fl.intensity = phase > 5.4 && Math.sin(t * 43) > 0.1 ? 3 : 14;
    });
  }

  private room(): void {
    const W = ROOM.maxX - ROOM.minX;
    const D = ROOM.maxZ - ROOM.minZ;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D, W, D), std({ map: vinylTex([W / 2, D / 2]), roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D, W / 2, D / 2), std({ map: ceilingTex([W / 2, D / 2]), roughness: 0.9 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 5;
    this.scene.add(ceiling);
    const panel = new THREE.MeshStandardMaterial({ color: '#fffaf0', emissive: '#fff3d6', emissiveIntensity: 1 });
    for (const x of [-13, -6, 1, 8, 14]) for (const z of [-8, 0, 8]) this.box(1.2, 0.05, 2.4, panel, x, 4.95, z);

    const block = (rx: number) => std({ map: blockTex([rx, 1.2]) });
    const tile = (rx: number) => std({ map: tealTileTex([rx, 2.4]) });
    // upper painted block, lower tiled band
    this.box(W + 0.4, 3.8, 0.4, block(W / 3), 0, 3.1, ROOM.minZ - 0.2);
    this.box(W + 0.4, 3.8, 0.4, block(W / 3), 0, 3.1, ROOM.maxZ + 0.2);
    this.box(0.4, 3.8, D, block(D / 3), ROOM.minX - 0.2, 3.1, 0);
    this.box(0.4, 3.8, D, block(D / 3), ROOM.maxX + 0.2, 3.1, 0);
    this.box(W + 0.4, 1.2, 0.44, tile(W / 1.2), 0, 0.6, ROOM.minZ - 0.2);
    this.box(W + 0.4, 1.2, 0.44, tile(W / 1.2), 0, 0.6, ROOM.maxZ + 0.2);
    this.box(0.44, 1.2, D, tile(D / 1.2), ROOM.minX - 0.2, 0.6, 0);
    this.box(0.44, 1.2, D, tile(D / 1.2), ROOM.maxX + 0.2, 0.6, 0);
    const trim = mat('#6b3b22');
    this.box(W, 0.08, 0.06, trim, 0, 1.22, ROOM.minZ + 0.03);
    this.box(W, 0.08, 0.06, trim, 0, 1.22, ROOM.maxZ - 0.03);
    this.box(0.06, 0.08, D, trim, ROOM.minX + 0.03, 1.22, 0);
    this.box(0.06, 0.08, D, trim, ROOM.maxX - 0.03, 1.22, 0);
    this.solid(0, ROOM.minZ - 0.2, W + 0.4, 0.4, 5, false);
    this.solid(0, ROOM.maxZ + 0.2, W + 0.4, 0.4, 5, false);
    this.solid(ROOM.minX - 0.2, 0, 0.4, D, 5, false);
    this.solid(ROOM.maxX + 0.2, 0, 0.4, D, 5, false);

    // Entrance with glass doors
    const frame = std({ color: '#3a3f44', metalness: 0.5 });
    const glass = new THREE.MeshBasicMaterial({ color: '#9fc9d8', transparent: true, opacity: 0.35, depthWrite: false });
    const ex = DOOR.x;
    this.box(2.6, 0.15, 0.12, frame, ex, 2.45, ROOM.maxZ - 0.04);
    for (const dx of [-1.25, 0, 1.25]) this.box(0.1, 2.45, 0.12, frame, ex + dx, 1.22, ROOM.maxZ - 0.04);
    for (const dx of [-0.62, 0.62]) {
      this.box(1.12, 2.3, 0.03, glass, ex + dx, 1.2, ROOM.maxZ - 0.05);
      this.box(0.06, 0.4, 0.06, std({ color: '#c9a227', metalness: 0.7 }), ex + dx * 0.25, 1.1, ROOM.maxZ - 0.12);
    }
    // the night outside
    this.box(2.5, 2.3, 0.02, glow('#1a2030'), ex, 1.2, ROOM.maxZ + 0.02);
    this.sign(['OPEN 24/7/365', 'robots welcome'], 1.2, 0.4, ex, 2.0, ROOM.maxZ - 0.08, Math.PI, { bg: '#111111', fg: '#ff4d8a', font: PIX });
    this.sign([L.PLACE.toUpperCase().replace(' INDUSTRIAL LAUNDRY', ''), 'INDUSTRIAL LAUNDRY', 'clean clothes, dirty contracts'], 8, 1.6, ex, 3.7, ROOM.maxZ - 0.06, Math.PI, { bg: '#1f5f8b', fg: '#f6e7c8', border: '#f6e7c8', font: PIX });
    const doormat = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), std({ map: pix(textTexture(['WELCOME', 'wipe your wheels'], { w: 256, h: 128, bg: '#5a3a2a', fg: '#d9b98a', font: PIX })) }));
    doormat.rotation.x = -Math.PI / 2;
    doormat.rotation.z = Math.PI;
    doormat.position.set(ex, 0.012, ROOM.maxZ - 1.0);
    this.scene.add(doormat);
    const exitSign = this.box(2.4, 2.3, 0.02, hitMat, ex, 1.2, ROOM.maxZ - 0.15);
    exitSign.userData.interact = { kind: 'sign', text: 'The door opens when your shift ends. Or when you are fired. The lint never leaves.' } satisfies Interact;
    this.interactables.push(exitSign);
  }

  // ---------------------------------------------------------------- the washer/dryer bank

  private machineBank(): void {
    const steel = std({ map: steelTex([2, 2]), metalness: 0.4, roughness: 0.5 });
    const cream = std({ map: enamelTex('#e3d9bd') });
    const green = std({ map: enamelTex('#2f5d50') });
    const black = std({ color: '#1b1d1f' });
    const chrome = std({ color: '#c8ccd0', metalness: 0.8, roughness: 0.3 });
    const drum = std({ map: drumTex() });
    const glass = new THREE.MeshBasicMaterial({ color: '#b8d8e8', transparent: true, opacity: 0.22, depthWrite: false });
    const duct = std({ map: ductTex([1, 4]), metalness: 0.3 });
    const stickerA = std({ map: pix(textTexture(['MAX 40 KG', 'no robots inside'], { w: 128, h: 64, bg: '#f2d31b', fg: '#1b1b1b', font: PIX })) });
    const stickerB = std({ map: pix(textTexture(['DO NOT SIT', 'IN DRUM'], { w: 128, h: 64, bg: '#ffffff', fg: '#c0392b', border: '#c0392b', font: PIX })) });
    const tempLbl = std({ map: pix(textTexture(['COLD WARM HOT'], { w: 192, h: 32, bg: '#1b1d1f', fg: '#e8e0c8', font: PIX })) });
    const clothesColors = ['#c0392b', '#2e86c1', '#f1c40f', '#e8ecf2', '#27ae60', '#8e44ad'];

    const porthole = (parent: THREE.Group, y: number, colors: string[]): THREE.Group => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 20), chrome);
      ring.position.set(0, y, 0.46);
      parent.add(ring);
      const back = new THREE.Mesh(new THREE.CircleGeometry(0.29, 18), drum);
      back.position.set(0, y, 0.452);
      parent.add(back);
      const spin = new THREE.Group();
      spin.position.set(0, y, 0.46);
      colors.forEach((c, i) => {
        const a = (i / colors.length) * Math.PI * 2;
        const lump = new THREE.Mesh(lumpGeo(0.09, 0.5, i * 7 + y * 10), std({ color: c }));
        lump.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0);
        lump.scale.z = 0.35;
        spin.add(lump);
      });
      parent.add(spin);
      const gl = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), glass);
      gl.position.set(0, y, 0.475);
      parent.add(gl);
      const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.05), chrome);
      hinge.position.set(-0.33, y, 0.47);
      parent.add(hinge);
      return spin;
    };

    UNIT_XS.forEach((x, i) => {
      const g = new THREE.Group();
      g.position.set(x, 0, UNIT_Z);
      const box = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[], bx: number, by: number, bz: number) => {
        const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
        me.position.set(bx, by, bz);
        g.add(me);
        return me;
      };
      // washer (bottom)
      box(1.2, 1.0, 0.9, steel, 0, 0.55, 0);
      box(1.16, 0.08, 0.86, black, 0, 0.04, 0);
      const washDrum = porthole(g, 0.5, [clothesColors[i % 6], clothesColors[(i + 2) % 6], clothesColors[(i + 4) % 6]]);
      box(1.2, 0.14, 0.05, black, 0, 0.98, 0.45);
      box(0.36, 0.05, 0.01, tempLbl, -0.3, 0.935, 0.476);
      const dial = new THREE.Group();
      dial.position.set(-0.3, 0.99, 0.48);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12), chrome);
      knob.rotation.x = Math.PI / 2;
      dial.add(knob);
      const dialMat = glow('#f1c40f');
      const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.01), dialMat);
      pointer.position.set(0, 0.022, 0.022);
      dial.add(pointer);
      g.add(dial);
      const ringLed = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 4, 16), dialMat);
      ringLed.position.set(-0.3, 0.99, 0.476);
      g.add(ringLed);
      for (let k = 0; k < 3; k++) box(0.03, 0.03, 0.01, glow(['#2ecc71', '#e74c3c', '#f1c40f'][k]), 0.1 + k * 0.08, 0.99, 0.476);
      box(0.25, 0.12, 0.01, stickerA, 0.38, 0.22, 0.452);
      // dryer (top)
      box(1.2, 1.05, 0.9, cream, 0, 1.6, 0);
      const dryDrum = porthole(g, 1.56, [clothesColors[(i + 1) % 6], clothesColors[(i + 3) % 6], '#e8e0c8', clothesColors[(i + 5) % 6]]);
      box(1.2, 0.1, 0.05, black, 0, 2.08, 0.45);
      box(0.25, 0.12, 0.01, stickerB, 0.38, 1.22, 0.452);
      // lint filter slot
      box(0.5, 0.04, 0.02, black, 0, 1.17, 0.452);
      // header with the display
      box(1.22, 0.42, 0.92, green, 0, 2.34, 0);
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 48;
      const ctx = c.getContext('2d')!;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.LinearFilter;
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.3), new THREE.MeshBasicMaterial({ map: tex }));
      scr.position.set(0.1, 2.34, 0.462);
      g.add(scr);
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.3), std({ map: pix(textTexture([String(i + 1)], { w: 64, h: 96, bg: '#f2d31b', fg: '#1b1b1b', font: PIX })) }));
      num.position.set(-0.47, 2.34, 0.462);
      g.add(num);
      // beacon with a cage on top
      const beacon = glow('#334433');
      const bc = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.14, 10), beacon);
      bc.position.set(0.4, 2.63, 0.2);
      g.add(bc);
      const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 6, 1, true), std({ color: '#333333', wireframe: true }));
      cage.position.copy(bc.position);
      g.add(cage);
      // feet and the vent pipe up to the ceiling duct
      for (const fx of [-0.5, 0.5]) box(0.1, 0.06, 0.1, black, fx, 0.03, 0.38);
      const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.3, 10), duct);
      vent.position.set(-0.3, 3.7, -0.25);
      g.add(vent);
      const elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 10), std({ color: '#8b9096', metalness: 0.4 }));
      elbow.position.set(-0.3, 2.6, -0.25);
      g.add(elbow);
      this.scene.add(g);

      const washerHit = new THREE.Mesh(new THREE.BoxGeometry(1.22, 1.06, 0.95), hitMat);
      washerHit.position.set(x, 0.53, UNIT_Z);
      washerHit.userData.interact = { kind: 'washer', unit: i } satisfies LInteract;
      this.scene.add(washerHit);
      const dryerHit = new THREE.Mesh(new THREE.BoxGeometry(1.22, 1.5, 0.95), hitMat);
      dryerHit.position.set(x, 1.82, UNIT_Z);
      dryerHit.userData.interact = { kind: 'dryer', unit: i } satisfies LInteract;
      this.scene.add(dryerHit);
      this.interactables.push(washerHit, dryerHit);

      const vpos = new THREE.Vector3(x + 0.45, 2.6, UNIT_Z - 0.3);
      this.units.push({ group: g, screen: { ctx, tex }, beacon, washDrum, dryDrum, dial, dialMat, front: new THREE.Vector3(x + 0.3, 0, UNIT_Z + 1.15), vent: vpos });
    });
    const x0 = UNIT_XS[0] - 0.65;
    const x1 = UNIT_XS[UNIT_XS.length - 1] + 0.65;
    this.solid((x0 + x1) / 2, UNIT_Z, x1 - x0, 0.95, 2.7, true, 'machines');
    // detergent jugs in the gaps and on top
    const jugCols = ['#2e86c1', '#e67e22', '#27ae60', '#c0392b'];
    UNIT_XS.forEach((x, i) => {
      if (i < UNIT_XS.length - 1) {
        const j = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.34, 8), std({ color: jugCols[i % 4] }));
        j.position.set(x + 0.8, 0.17, UNIT_Z + 0.2);
        this.scene.add(j);
      }
      if (i % 2 === 0) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3), boxMaterials(i));
        b.position.set(x - 0.2, 2.7, UNIT_Z - 0.1);
        b.rotation.y = 0.2;
        this.scene.add(b);
      }
    });
    // hazard stripe in front of the bank
    const hz = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 0.35), std({ map: hazardTex([18, 1]) }));
    hz.rotation.x = -Math.PI / 2;
    hz.position.set((x0 + x1) / 2, 0.008, UNIT_Z + 0.72);
    this.scene.add(hz);
    this.sign(['WASH-N-DRY BANK A', '6 machines  0 breaks'], 5, 0.8, (x0 + x1) / 2, 3.35, ROOM.minZ + 0.03, 0, { bg: '#2f5d50', fg: '#f6e7c8', border: '#f6e7c8', font: PIX });
    // the big overhead duct the vents go into
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, x1 - x0 + 1, 10), std({ map: ductTex([10, 1]), metalness: 0.3 }));
    d.rotation.z = Math.PI / 2;
    d.position.set((x0 + x1) / 2, 4.6, UNIT_Z - 0.25);
    this.scene.add(d);
    for (const u of this.units) {
      const unit = u;
      this.steamVents.push({ pos: u.vent, on: () => unit.group.userData.drying === true, rate: 1.6, acc: 0 });
    }
  }

  // ---------------------------------------------------------------- folding tables

  private foldingTables(): void {
    const top = std({ map: laminateTex([2, 1]) });
    const leg = std({ color: '#5d6166', metalness: 0.5 });
    const mt = std({ map: matTex() });
    const shade = std({ color: '#2f5d50', side: THREE.DoubleSide });
    TABLES.forEach((t, i) => {
      const g = new THREE.Group();
      g.position.set(t.x, 0, t.z);
      const box = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
        const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
        me.position.set(x, y, z);
        g.add(me);
        return me;
      };
      box(2.2, 0.06, 1.0, top, 0, TABLE_Y - 0.03, 0);
      for (const [x, z] of [[-1.0, -0.42], [1.0, -0.42], [-1.0, 0.42], [1.0, 0.42]] as [number, number][]) box(0.06, TABLE_Y - 0.06, 0.06, leg, x, (TABLE_Y - 0.06) / 2, z);
      box(2.0, 0.04, 0.8, leg, 0, 0.25, 0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), mt);
      m.rotation.x = -Math.PI / 2;
      m.position.set(-0.1, TABLE_Y + 0.003, 0.05);
      g.add(m);
      // a ruler and a neat stack of finished work as an example
      box(0.6, 0.008, 0.05, std({ color: '#e8c84a' }), 0.72, TABLE_Y + 0.004, 0.36).rotation.y = 0.2;
      for (let k = 0; k < 3; k++) {
        const gm = newGarment(CLOTHES[(i * 3 + k) % CLOTHES.length], 0);
        gm.stage = 'neat';
        const s = buildGarmentMesh(gm);
        s.position.set(0.85, TABLE_Y + k * 0.07, -0.25);
        s.rotation.y = (k - 1) * 0.06;
        g.add(s);
        s.traverse((o) => {
          // the example stack has no ticket
          if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.type === 'BoxGeometry' && o.scale.x === 1 && (o as THREE.Mesh).position.y > 0.07 && (o as THREE.Mesh).position.x > 0.07) o.visible = false;
        });
      }
      // laundry basket under the table
      const basket = this.basket(new THREE.Vector3(-0.6, 0.29, 0), i);
      g.add(basket);
      // table number
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), std({ map: pix(textTexture([`TABLE ${i + 1}`], { w: 128, h: 48, bg: '#2f5d50', fg: '#f6e7c8', font: PIX })) }));
      sg.position.set(0, TABLE_Y - 0.08, 0.505);
      g.add(sg);
      // pendant lamp
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.9), std({ color: '#222222' }));
      cord.position.set(0, 4.0, 0);
      g.add(cord);
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.3, 12, 1, true), shade);
      c.position.set(0, 2.95, 0);
      g.add(c);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), glow('#fff3c9'));
      bulb.position.set(0, 2.82, 0);
      g.add(bulb);
      const l = new THREE.PointLight('#ffe7b0', 9, 6, 1.5);
      l.position.set(0, 2.7, 0);
      g.add(l);
      g.userData.interact = { kind: 'table', table: i } satisfies LInteract;
      this.scene.add(g);
      this.interactables.push(g);
      this.tableTops.push(g);
      this.solid(t.x, t.z, 2.2, 1.0, TABLE_Y, false, 'table');
    });
    this.sign(['FOLDING TABLES', 'exactly 30 x 30 cm'], 3.2, 0.7, -5, 3.3, -5.5, 0, { bg: '#f6e7c8', fg: '#2f5d50', border: '#2f5d50', font: PIX });
    this.sign(['FOLDING TABLES', 'exactly 30 x 30 cm'], 3.2, 0.7, -5, 3.3, -5.52, Math.PI, { bg: '#f6e7c8', fg: '#2f5d50', border: '#2f5d50', font: PIX });
    for (const x of [-6.5, -3.5]) {
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.4), std({ color: '#3a3a3a' }));
      ch.position.set(x, 4.3, -5.5);
      this.scene.add(ch);
    }
  }

  /** A plastic laundry basket full of clothes. */
  basket(pos: THREE.Vector3, seed: number): THREE.Group {
    const g = new THREE.Group();
    g.position.copy(pos);
    const cols = ['#e8e4d8', '#3a7bd5', '#e67e22', '#d35486'];
    const pm = std({ color: cols[seed % cols.length] });
    const add = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pm);
      me.position.set(x, y, z);
      g.add(me);
    };
    add(0.6, 0.03, 0.42, 0, 0.015, 0);
    add(0.6, 0.3, 0.03, 0, 0.15, 0.2);
    add(0.6, 0.3, 0.03, 0, 0.15, -0.2);
    add(0.03, 0.3, 0.42, 0.3, 0.15, 0);
    add(0.03, 0.3, 0.42, -0.3, 0.15, 0);
    for (let k = 0; k < 4; k++) {
      const gm = newGarment(CLOTHES[(seed * 2 + k) % CLOTHES.length], 0);
      const b = new THREE.Mesh(lumpGeo(0.13, 0.5, seed * 5 + k), std({ map: buildGarmentMeshMap(gm) }));
      b.position.set(-0.15 + (k % 2) * 0.3, 0.22 + Math.floor(k / 2) * 0.06, (k % 2 ? -0.05 : 0.06));
      b.scale.set(1.3, 0.7, 1);
      g.add(b);
    }
    return g;
  }

  // ---------------------------------------------------------------- socks

  private sockTable(): void {
    const g = new THREE.Group();
    const { x, z } = SOCK_TABLE;
    g.position.set(x, 0, z);
    const top = std({ map: plyTex([2, 1]) });
    const leg = std({ color: '#5d6166', metalness: 0.5 });
    const box = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[], bx: number, by: number, bz: number) => {
      const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      me.position.set(bx, by, bz);
      g.add(me);
      return me;
    };
    box(1.8, 0.06, 0.9, top, 0, TABLE_Y - 0.03, 0);
    for (const [lx, lz] of [[-0.82, -0.38], [0.82, -0.38], [-0.82, 0.38], [0.82, 0.38]] as [number, number][]) box(0.06, TABLE_Y - 0.06, 0.06, leg, lx, (TABLE_Y - 0.06) / 2, lz);
    // tray with 2 x 4 compartments
    const tray = std({ color: '#8a6a43' });
    box(1.6, 0.03, 0.7, tray, 0, TABLE_Y + 0.015, 0);
    for (let k = 0; k <= 4; k++) box(0.02, 0.06, 0.7, tray, -0.8 + k * 0.4, TABLE_Y + 0.045, 0);
    for (const dz of [-0.35, 0, 0.35]) box(1.6, 0.06, 0.02, tray, 0, TABLE_Y + 0.045, dz);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        this.tray.slots.push({ pos: new THREE.Vector3(x - 0.6 + col * 0.4, TABLE_Y + 0.03, z - 0.175 + row * 0.35), item: null });
      }
    }
    // sign on a post
    box(0.04, 1.2, 0.04, leg, 0.85, TABLE_Y + 0.6, -0.4);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.5), std({ map: pix(textTexture(['SOCK MATCHING', 'pair by pattern', 'or by vibe'], { w: 256, h: 108, bg: '#8e44ad', fg: '#f6e7c8', border: '#f6e7c8', font: PIX })), side: THREE.DoubleSide }));
    s.position.set(0.85, TABLE_Y + 1.35, -0.4);
    g.add(s);
    g.userData.interact = { kind: 'sockTray' } satisfies LInteract;
    this.scene.add(g);
    this.interactables.push(g);
    this.solid(x, z, 1.8, 0.9, TABLE_Y, false, 'table');

    // The LOST SOCKS bin: a wire cage full of single socks
    const b = new THREE.Group();
    b.position.set(LOST_BIN.x, 0, LOST_BIN.z);
    const wire = makeWireTex();
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 1.0, 14, 1, true), new THREE.MeshStandardMaterial({ map: wire, transparent: true, side: THREE.DoubleSide, roughness: 0.6 }));
    cage.position.y = 0.55;
    b.add(cage);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 4, 18), std({ color: '#555b60', metalness: 0.6 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.05;
    b.add(rim);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 14), std({ color: '#555b60' }));
    base.position.y = 0.06;
    b.add(base);
    const pile = new THREE.Group();
    const r = rng(77);
    for (let k = 0; k < 26; k++) {
      const gm = newGarment('sock', 0);
      const sm = buildGarmentMesh(gm);
      const a = r() * Math.PI * 2;
      const rr = r() * 0.32;
      sm.position.set(Math.cos(a) * rr, 0.12 + (k / 26) * 0.75 + r() * 0.05, Math.sin(a) * rr);
      sm.rotation.set(r() * 2, r() * 6, r() * 2);
      pile.add(sm);
    }
    b.add(pile);
    this.lostBinPile = pile;
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.42), std({ map: pix(textTexture(['LOST SOCKS', 'they are not lost', 'they are here'], { w: 192, h: 90, bg: '#f2d31b', fg: '#1b1b1b', border: '#1b1b1b', font: PIX })), side: THREE.DoubleSide }));
    sg.position.set(0, 1.45, 0);
    b.add(sg);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4), std({ color: '#333333' }));
    post.position.set(0, 1.15, 0);
    b.add(post);
    b.userData.interact = { kind: 'lostBin' } satisfies LInteract;
    this.scene.add(b);
    this.interactables.push(b);
    this.solid(LOST_BIN.x, LOST_BIN.z, 1.0, 1.0, 1.05, false, 'bin');
  }

  // ---------------------------------------------------------------- pickup cubbies and counter

  private cubbies(): void {
    const C = CUBBY;
    const W = C.cols * C.w;
    const ply = std({ map: plyTex([1, 1]) });
    const dark = std({ color: '#4a3424' });
    const zc = (C.zBack + C.zFront) / 2;
    const D = C.zFront - C.zBack;
    const H = C.y0 + C.rows * C.h;
    const g = new THREE.Group();
    g.position.set(C.x, 0, zc);
    const box = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
      const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      me.position.set(x, y, z);
      g.add(me);
      return me;
    };
    box(W + 0.08, H + 0.3, 0.04, ply, 0, (H + 0.3) / 2, -D / 2);
    box(W + 0.08, C.y0, D, dark, 0, C.y0 / 2, 0);
    for (let r = 0; r <= C.rows; r++) {
      box(W + 0.08, 0.03, D, ply, 0, C.y0 + r * C.h, 0);
      // front lip under each shelf carries the number plates
      box(W + 0.08, 0.09, 0.03, dark, 0, C.y0 + r * C.h - 0.045, D / 2 - 0.01);
    }
    for (let c = 0; c <= C.cols; c++) box(0.03, C.rows * C.h, D, ply, -W / 2 + c * C.w, C.y0 + (C.rows * C.h) / 2, 0);
    box(W + 0.08, 0.3, D, ply, 0, H + 0.15, 0);
    this.scene.add(g);
    const plate = (n: number) => {
      const t = pix(textTexture([String(n)], { w: 96, h: 36, bg: '#f7f1dc', fg: '#1b1b1b', font: PIX }));
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      return std({ map: t, emissive: '#3a3020' });
    };
    for (let r = 0; r < C.rows; r++) {
      for (let c = 0; c < C.cols; c++) {
        const n = (C.rows - 1 - r) * C.cols + c + 1;
        const cx = C.x - W / 2 + (c + 0.5) * C.w;
        const cy = C.y0 + r * C.h;
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.085), plate(n));
        p.position.set(cx, cy - 0.045, C.zFront + 0.025);
        this.scene.add(p);
        const hit = new THREE.Mesh(new THREE.BoxGeometry(C.w - 0.04, C.h - 0.04, D), hitMat);
        hit.position.set(cx, cy + C.h / 2, zc);
        hit.userData.interact = { kind: 'cubby', cubby: n } satisfies LInteract;
        this.scene.add(hit);
        this.interactables.push(hit);
        this.cubbySlots[n] = { pos: new THREE.Vector3(cx, cy + 0.016, zc + 0.04), items: [] };
      }
    }
    this.sign(['PICKUP CUBBIES', 'file by ticket number'], W, 0.28, C.x, H + 0.15, C.zFront + 0.005, 0, { bg: '#7a2416', fg: '#f6e7c8', font: PIX });
    this.sign(['TICKET = CUBBY', 'it is not a riddle'], 1.6, 0.6, C.x, H + 0.72, C.zFront - 0.2, 0, { bg: '#fdf6e3', fg: '#2c3e50', border: '#c0392b', font: PIX });
    this.solid(C.x, zc, W + 0.1, D + 0.05, H + 0.3, true, 'cubbies');
  }

  private counter(): void {
    const { x0, x1, z } = COUNTER;
    const len = x1 - x0;
    const cx = (x0 + x1) / 2;
    const front = std({ map: enamelTex('#7a2416', [len / 1.2, 1]) });
    const top = std({ map: laminateTex([len / 1.5, 0.5]) });
    this.box(len, 1.0, 0.6, front, cx, 0.5, z);
    this.box(len + 0.1, 0.05, 0.7, top, cx, 1.025, z);
    this.solid(cx, z, len + 0.1, 0.7, 1.05, false, 'counter');
    this.sign(['PICKUP', 'drop-off  complaints (closed)'], 3.2, 0.5, cx, 0.62, z + 0.31, 0, { bg: '#f6e7c8', fg: '#7a2416', font: PIX });
    this.sign(['PICKUP'], 1.4, 0.36, cx - 3, 0.62, z + 0.31, 0, { bg: '#f2d31b', fg: '#1b1b1b', font: PIX });
    this.sign(['NO REFUNDS', 'no refunds'], 1.4, 0.36, cx + 3, 0.62, z + 0.31, 0, { bg: '#f2d31b', fg: '#1b1b1b', font: PIX });
    // the bell
    const bell = new THREE.Group();
    bell.position.copy(BELL);
    const brass = std({ color: '#c9a227', metalness: 0.8, roughness: 0.3 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), brass);
    dome.position.y = 0.03;
    bell.add(dome);
    const bb = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.03, 12), std({ color: '#1b1b1b' }));
    bb.position.y = 0.015;
    bell.add(bb);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), brass);
    knob.position.y = 0.13;
    bell.add(knob);
    bell.userData.interact = { kind: 'bell' } satisfies LInteract;
    this.scene.add(bell);
    this.interactables.push(bell);
    this.bellMesh = bell;
    this.sign(['RING FOR', 'SERVICE', '(we hear you)'], 0.36, 0.24, BELL.x, 1.17, z + 0.2, 0, { bg: '#ffffff', fg: '#7a2416', font: PIX }).rotation.x = -0.4;
    // register, ticket spike, tip jar, number dispenser, stacks of tickets
    this.prop('register', x0 + 1.6, 1.05, z, Math.PI);
    const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.18), std({ color: '#aaaaaa' }));
    spike.position.set(cx + 1.6, 1.14, z - 0.1);
    this.scene.add(spike);
    for (let k = 0; k < 6; k++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.004, 0.06), std({ color: '#f7f1dc' }));
      p.position.set(cx + 1.6, 1.06 + k * 0.012, z - 0.1);
      p.rotation.y = k * 0.7;
      this.scene.add(p);
    }
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 10), new THREE.MeshBasicMaterial({ color: '#cde4ea', transparent: true, opacity: 0.45, depthWrite: false }));
    jar.position.set(cx + 2.4, 1.13, z - 0.05);
    this.scene.add(jar);
    for (let k = 0; k < 3; k++) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.005, 8), std({ color: '#c9a227', metalness: 0.8, roughness: 0.3 }));
      coin.position.set((k - 1) * 0.025, -0.07 + k * 0.006, 0);
      coin.rotation.z = k * 0.3;
      jar.add(coin);
    }
    this.refs.tipJar = jar;
    const tipLabel = this.sign(['TIPS', '(company', 'property)'], 0.16, 0.12, 0, 0, 0, 0, { bg: '#ffffff', fg: '#1b1b1b' });
    tipLabel.position.set(0, 0.01, 0.075);
    jar.add(tipLabel);
    const disp = new THREE.Group();
    disp.position.set(x1 - 0.4, 1.05, z + 0.1);
    const dbody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.16), std({ color: '#c0392b' }));
    dbody.position.y = 0.15;
    disp.add(dbody);
    const dlabel = this.sign(['TAKE A', 'NUMBER'], 0.2, 0.14, 0, 0.2, 0.081, 0, { bg: '#ffffff', fg: '#c0392b' });
    disp.add(dlabel);
    this.scene.add(disp);
    this.refs.dispenser = disp;
    // stacks of finished laundry waiting on the counter, wrapped in plastic
    for (let k = 0; k < 3; k++) {
      const gm = newGarment(CLOTHES[k + 2], 0);
      gm.stage = 'neat';
      const s = buildGarmentMesh(gm);
      s.position.set(x0 + 0.5, 1.05 + k * 0.07, z - 0.05);
      this.scene.add(s);
    }
    // the CLOSED sign
    this.sign(['NEXT', 'WINDOW', 'PLEASE'], 0.4, 0.3, x0 + 3.0, 1.2, z + 0.1, 0, { bg: '#fdf6e3', fg: '#c0392b', border: '#c0392b' });
    // queue lanes in front of the counter, one per pickup spot
    const chrome = std({ color: '#9aa1a8', metalness: 0.8, roughness: 0.3 });
    const belt = std({ color: '#7a2416' });
    for (const px of [-8.6, -5.85, -3.15, -0.4]) {
      for (const pz of [6.9, 9.0]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.95, 8), chrome);
        p.position.set(px, 0.47, pz);
        this.scene.add(p);
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.04, 10), chrome);
        b.position.set(px, 0.02, pz);
        this.scene.add(b);
      }
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 2.1), belt);
      strap.position.set(px, 0.86, 7.95);
      this.scene.add(strap);
      this.solid(px, 7.95, 0.12, 2.2, 0.95, false, 'queue');
    }
    this.sign(['PLEASE WAIT', 'patiently', 'or with the bell'], 0.7, 0.4, -0.4, 1.25, 9.0, Math.PI, { bg: '#ffffff', fg: '#7a2416', border: '#7a2416' });
  }

  // ---------------------------------------------------------------- toilet and the key

  private toilet(): void {
    this.toiletBooth(13, -13, ['KEY: LOST & FOUND', 'by the entrance.', 'It is in a sock.', 'Max break: 4 seconds']);
    this.sign(['STAFF TOILET', 'back corner, past bank B.', 'Key: LOST & FOUND', '(the other corner)'], 2.6, 1.4, -2.0, 2.7, ROOM.minZ + 0.03, 0, { bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' });

    // LOST & FOUND alcove in the south west corner, with the toilet key in a giant sock
    const ply = std({ map: plyTex([2, 1]) });
    const bx = ROOM.minX + 0.35;
    this.box(0.6, 0.05, 2.6, ply, bx, 1.75, 10.5);
    this.box(0.6, 0.05, 2.6, ply, bx, 0.9, 10.5);
    this.box(0.6, 0.05, 2.6, ply, bx, 0.06, 10.5);
    for (const z of [9.22, 11.78]) this.box(0.6, 1.8, 0.05, ply, bx, 0.9, z);
    this.box(0.04, 2.0, 2.7, std({ map: pegTex([6, 4]) }), ROOM.minX + 0.03, 1.4, 10.5);
    this.sign(['LOST & FOUND', 'mostly lost'], 2.2, 0.55, ROOM.minX + 0.04, 2.35, 10.5, Math.PI / 2, { bg: '#2c3e50', fg: '#f6e7c8', border: '#f6e7c8', font: PIX });
    this.solid(bx, 10.5, 0.6, 2.6, 1.8, false, 'shelf');
    // junk on the shelves
    const junk: [number, number, number, number, number, string][] = [
      [bx, 0.97, 9.6, 0.25, 0.12, '#2c3e50'],
      [bx, 0.97, 9.95, 0.12, 0.3, '#c0392b'],
      [bx, 1.82, 9.5, 0.3, 0.2, '#8e44ad'],
      [bx, 1.82, 11.4, 0.2, 0.1, '#f1c40f'],
      [bx, 0.12, 11.3, 0.4, 0.25, '#27ae60'],
    ];
    for (const [x, y, z, w, h, c] of junk) this.box(w, h, w * 0.8, std({ color: c }), x, y + h / 2, z);
    // a single glove, an umbrella and a robot arm
    const umb = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9), std({ color: '#1b1b1b' }));
    umb.position.set(bx, 1.4, 11.5);
    umb.rotation.x = 0.4;
    this.scene.add(umb);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.5), std({ color: '#9aa1a8', metalness: 0.6 }));
    arm.geometry.translate(0, 0.05, 0);
    arm.position.set(bx, 1.78, 10.2);
    for (const fz of [-0.27, -0.3]) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.09), std({ color: '#70757b', metalness: 0.6 }));
      finger.position.set(fz === -0.27 ? -0.03 : 0.03, 0.06, fz);
      arm.add(finger);
    }
    this.scene.add(arm);
    this.refs.arm = arm;
    this.sign(['FOUND: 1 arm', 'owner please call'], 0.4, 0.18, bx + 0.31, 1.95, 10.2, Math.PI / 2, { bg: '#ffffff', fg: '#1b1b1b' });
    for (let k = 0; k < 5; k++) {
      const gm = newGarment('sock', 0);
      const s = buildGarmentMesh(gm);
      s.position.set(bx + (k % 2) * 0.1 - 0.05, 0.93, 10.5 + k * 0.2);
      s.rotation.y = k;
      this.scene.add(s);
    }
    // the hook and the key sock, hanging between the shelves
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 10, Math.PI), std({ color: '#888888', metalness: 0.6 }));
    hook.position.set(ROOM.minX + 0.4, 2.05, 8.6);
    hook.rotation.y = Math.PI / 2;
    this.scene.add(hook);
    const key = new Item(KEY_SOCK_DEF);
    key.state = 'fixed';
    key.mesh.position.set(ROOM.minX + 0.5, 0.82, 8.6);
    key.mesh.rotation.y = Math.PI / 2;
    this.scene.add(key.mesh);
    this.initialItems.push(key);
    this.sign(['TOILET KEY', 'please return the sock', 'do not open the sock'], 0.9, 0.42, ROOM.minX + 0.04, 2.6, 8.6, Math.PI / 2, { bg: '#ffffff', fg: '#c0392b', border: '#c0392b' });
  }

  // ---------------------------------------------------------------- walls and corners

  private westWall(): void {
    const X = ROOM.minX;
    // Detergent racking
    const rackMat = std({ map: rackTex([1, 4]) });
    const beamMat = std({ map: rackTex([8, 1]) });
    const rx = X + 0.45;
    const z0 = -12.4;
    const z1 = -7.6;
    for (let z = z0; z <= z1 + 0.01; z += (z1 - z0) / 3) {
      this.box(0.08, 2.4, 0.08, rackMat, rx - 0.3, 1.2, z);
      this.box(0.08, 2.4, 0.08, rackMat, rx + 0.3, 1.2, z);
    }
    const labels = [
      ['SUDZ-O', '50 KG'],
      ['BLEACH-ISH', 'mostly bleach'],
      ['SOFTENER', '(hard)'],
      ['LINT-B-GONE', 'does not work'],
      ['STARCH', 'for collars & egos'],
    ];
    const boxMats = labels.map((l, i) => {
      const t = pix(textTexture(l, { w: 96, h: 96, bg: ['#2e86c1', '#f6f6f6', '#d35486', '#27ae60', '#e67e22'][i], fg: i === 1 ? '#2e86c1' : '#ffffff', font: PIX }));
      const side = std({ map: cardboardTex(i) });
      const front = std({ map: t });
      return [front, front, side, side, side, side];
    });
    const r = rng(31);
    for (const y of [0.1, 0.85, 1.6]) {
      this.box(0.06, 0.08, z1 - z0, beamMat, rx - 0.3, y, (z0 + z1) / 2);
      this.box(0.06, 0.08, z1 - z0, beamMat, rx + 0.3, y, (z0 + z1) / 2);
      this.box(0.66, 0.02, z1 - z0, std({ color: '#6b6258' }), rx, y + 0.05, (z0 + z1) / 2);
      let z = z0 + 0.25;
      while (z < z1 - 0.3) {
        const h = 0.32 + r() * 0.25;
        const w = 0.35 + r() * 0.2;
        if (r() < 0.75) {
          const b = this.box(0.45, h, w, boxMats[Math.floor(r() * boxMats.length)], rx, y + 0.06 + h / 2, z + w / 2);
          b.rotation.y = (r() - 0.5) * 0.1;
        } else {
          const j = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.36, 8), std({ color: ['#2e86c1', '#e67e22', '#f1c40f'][Math.floor(r() * 3)] }));
          j.position.set(rx, y + 0.24, z + 0.12);
          this.scene.add(j);
        }
        z += w + 0.06;
      }
    }
    this.solid(rx, (z0 + z1) / 2, 0.7, z1 - z0 + 0.1, 2.4, true, 'rack');
    this.sign(['CHEMICALS', 'do not drink', 'do not ask why we say this'], 2.2, 0.8, X + 0.04, 3.1, -10, Math.PI / 2, { bg: '#f2d31b', fg: '#1b1b1b', border: '#1b1b1b', font: PIX });

    // Self-service machines (models), robots only
    const zs = [-5.6, -4.4, -3.2, -2.0, -0.8];
    let placed = 0;
    zs.forEach((z, i) => {
      const key = i % 2 ? 'ldStack' : 'ldWasher';
      const o = this.prop(key, X + 0.5, 0, z, Math.PI / 2);
      if (o) placed++;
    });
    if (placed) this.solid(X + 0.5, -3.2, 1.0, 6.2, 2.0, true, 'machines');
    else {
      zs.forEach((z) => this.box(0.9, 1.0, 1.0, std({ map: steelTex([1, 1]) }), X + 0.5, 0.5, z));
      this.solid(X + 0.5, -3.2, 1.0, 6.2, 1.0, true, 'machines');
    }
    this.sign(['SELF SERVICE', 'robots only', 'humans: see table'], 2.4, 0.8, X + 0.04, 2.8, -3.2, Math.PI / 2, { bg: '#2c3e50', fg: '#f6e7c8', border: '#f6e7c8', font: PIX });
    const tape = std({ map: hazardTex([6, 1]) });
    this.box(0.02, 0.1, 6.2, tape, X + 1.02, 1.0, -3.2);

    // Lint storage door with lint coming out from underneath
    // the door hangs on a hinge at its north edge, so it can swing open (mischief.ts)
    const lintDoor = new THREE.Group();
    lintDoor.position.set(X + 0.04, 0, 2.85);
    this.box(0.08, 2.2, 1.1, std({ map: enamelTex('#6b6f73') }), 0, 1.1, 0.55, lintDoor);
    this.box(0.1, 0.06, 0.14, std({ color: '#c9a227', metalness: 0.7 }), 0.06, 1.05, 0.15, lintDoor);
    const lsign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), std({ map: pix(textTexture(['LINT STORAGE', '4 TONS', 'DO NOT OPEN'], { w: 256, h: 154, bg: '#c0392b', fg: '#ffffff', font: PIX })) }));
    lsign.position.set(0.06, 1.75, 0.55);
    lsign.rotation.y = Math.PI / 2;
    lintDoor.add(lsign);
    // behind it: a wall of compressed lint
    this.box(0.02, 2.2, 1.1, std({ map: lintTex(), color: '#b9b2a6' }), X + 0.005, 1.1, 3.4);
    const ld = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 1.1), hitMat);
    ld.position.set(0.04, 1.1, 0.55);
    lintDoor.add(ld);
    lintDoor.userData.interact = { kind: 'ldLintDoor' } satisfies Interact;
    this.scene.add(lintDoor);
    this.interactables.push(lintDoor);
    this.refs.lintDoor = lintDoor;
    for (let k = 0; k < 7; k++) {
      const l = buildLint(400 + k, 1.4 + (k % 3) * 0.4);
      l.position.x = X + 0.25 + (k % 3) * 0.25;
      l.position.z = 2.95 + k * 0.14;
      this.scene.add(l);
    }

    // Fire extinguisher, fuse box, a clock that is always 16:59
    const red = std({ color: '#b3160c' });
    const fe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.45, 8), red);
    fe.position.set(X + 0.12, 0.8, 1.2);
    this.scene.add(fe);
    this.box(0.1, 0.6, 0.45, std({ color: '#7f868c', metalness: 0.4 }), X + 0.06, 1.8, 6.0);
    this.sign(['DANGER', 'high voltage', 'low wages'], 0.4, 0.3, X + 0.12, 1.85, 6.0, Math.PI / 2, { bg: '#f2d31b', fg: '#1b1b1b' });
    const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), std({ map: pix(textTexture(['16:59'], { w: 96, h: 96, bg: '#f7f1dc', fg: '#1b1b1b', border: '#1b1b1b', font: PIX })) }));
    clock.rotation.z = Math.PI / 2;
    clock.rotation.y = 0;
    clock.position.set(X + 0.05, 3.3, 0.5);
    this.scene.add(clock);
    this.refs.clock = clock;
  }

  private northEast(): void {
    const Z = ROOM.minZ;
    // Steam press and boiler
    const press = this.prop('ldMachine', 1.8, 0, Z + 0.85, 0);
    if (!press) {
      this.box(1.8, 1.4, 1.2, std({ map: steelTex([2, 2]) }), 1.8, 0.7, Z + 0.85);
    }
    this.solid(1.8, Z + 0.85, 2.0, 1.4, 1.8, true, 'press');
    this.sign(['STEAM PRESS', 'keep fingers', 'flat'], 1.4, 0.6, 1.8, 2.6, Z + 0.03, 0, { bg: '#c0392b', fg: '#ffffff', font: PIX });
    this.steamVents.push({ pos: new THREE.Vector3(1.8, 1.9, Z + 0.9), on: () => true, rate: 3, acc: 0 });

    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 3.2, 16), std({ map: steelTex([4, 3]), metalness: 0.4 }));
    boiler.position.set(4.6, 1.6, Z + 0.9);
    this.scene.add(boiler);
    for (const y of [0.4, 2.8]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.1, 16), std({ color: '#7a2416' }));
      band.position.set(4.6, y, Z + 0.9);
      this.scene.add(band);
    }
    const gauge = (x: number, y: number) => {
      const gg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 14), std({ map: pix(textTexture(['PSI', '!!!'], { w: 64, h: 64, bg: '#f7f1dc', fg: '#c0392b', border: '#1b1b1b' })) }));
      gg.rotation.x = Math.PI / 2;
      gg.position.set(x, y, Z + 1.66);
      this.scene.add(gg);
    };
    gauge(4.4, 1.9);
    gauge(4.8, 1.5);
    this.solid(4.6, Z + 0.9, 1.6, 1.6, 3.2, true, 'boiler');
    this.sign(['BOILER', 'do not hug'], 1.0, 0.4, 4.6, 3.4, Z + 1.66, 0, { bg: '#f2d31b', fg: '#1b1b1b', font: PIX });
    this.steamVents.push({ pos: new THREE.Vector3(5.2, 3.3, Z + 1.2), on: () => true, rate: 1.2, acc: 0 });
    const pipeM = std({ color: '#9e2a1e' });
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6), pipeM);
    p1.position.set(4.6, 4.0, Z + 0.9);
    this.scene.add(p1);
    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 14), pipeM);
    p2.rotation.z = Math.PI / 2;
    p2.position.set(-2.4, 4.75, Z + 0.9);
    this.scene.add(p2);
    const p3 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8), std({ color: '#70757b' }));
    p3.rotation.z = Math.PI / 2;
    p3.position.set(3.2, 2.2, Z + 0.25);
    this.scene.add(p3);
    const valve = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 12), std({ color: '#c0392b' }));
    valve.position.set(3.2, 2.2, Z + 0.4);
    this.scene.add(valve);

    // Bank B, out of order
    const xs = [7.4, 8.7, 10.0, 11.3];
    let any = false;
    xs.forEach((x, i) => {
      if (this.prop(i % 2 ? 'ldDryer' : 'ldStack', x, 0, Z + 0.55, 0)) any = true;
    });
    if (!any) for (const x of xs) this.box(1.0, 1.8, 0.9, std({ map: enamelTex('#e3d9bd') }), x, 0.9, Z + 0.55);
    this.solid(9.35, Z + 0.55, 5.4, 1.0, 2.0, true, 'bankB');
    const tape = std({ map: hazardTex([10, 1]) });
    for (const y of [0.7, 1.3]) {
      const t = this.box(5.6, 0.1, 0.02, tape, 9.35, y, Z + 1.08);
      t.rotation.z = y === 0.7 ? 0.05 : -0.04;
    }
    this.sign(['BANK B', 'OUT OF ORDER', 'since 2063'], 2.4, 0.9, 9.35, 2.8, Z + 0.03, 0, { bg: '#1b1b1b', fg: '#ff4d4d', border: '#ff4d4d', font: PIX });
  }

  private eastSide(): void {
    const X = ROOM.maxX;
    // Ironing boards with irons
    const board = std({ map: pix(textTexture([''], { w: 32, h: 32, bg: '#c9d9e8', fg: '#000000' })) });
    const leg = std({ color: '#5d6166', metalness: 0.5 });
    for (const z of [-6.8, -5.0]) {
      const g = new THREE.Group();
      g.position.set(X - 1.6, 0, z);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.38), board);
      top.position.y = 0.88;
      g.add(top);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 10, 1, false, 0, Math.PI), board);
      tip.position.set(-0.7, 0.88, 0);
      tip.rotation.y = Math.PI / 2;
      g.add(tip);
      for (const s of [-1, 1]) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.05, 0.03), leg);
        l.position.set(s * 0.25, 0.44, 0);
        l.rotation.z = s * 0.45;
        g.add(l);
      }
      const iron = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.13), std({ color: '#d35400' }));
      iron.position.set(0.3, 0.95, 0);
      g.add(iron);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), std({ color: '#1b1b1b' }));
      handle.position.set(0.3, 1.04, 0);
      g.add(handle);
      this.scene.add(g);
      this.steamVents.push({ pos: new THREE.Vector3(X - 1.3, 1.0, z), on: () => true, rate: 0.5, acc: 0 });
    }
    this.solid(X - 1.6, -5.9, 1.5, 2.4, 1.0, false, 'ironing');
    this.sign(['PRESSING', 'we press clothes', 'and employees'], 2.4, 0.8, X - 0.04, 2.8, -5.9, -Math.PI / 2, { bg: '#2f5d50', fg: '#f6e7c8', border: '#f6e7c8', font: PIX });

    // Clothing racks with finished orders
    let racks = 0;
    for (const z of [-2.0, 0.2, 2.4]) if (this.prop('ldRack', X - 0.8, 0, z, Math.PI / 2)) racks++;
    if (racks) this.solid(X - 0.8, 0.2, 1.0, 6.4, 1.8, true, 'racks');
    this.sign(['READY FOR PICKUP', 'since 2061'], 2.4, 0.6, X - 0.04, 2.6, 0.2, -Math.PI / 2, { bg: '#7a2416', fg: '#f6e7c8', font: PIX });
    this.refs.mannequin = this.prop('ldMannequin', X - 1.0, 0, 4.6, -Math.PI / 2);
    this.refs.eotm = this.sign(['EMPLOYEE OF', 'THE MONTH', 'the steam press'], 0.9, 0.5, X - 0.04, 2.05, 4.6, -Math.PI / 2, { bg: '#fdf6e3', fg: '#2c3e50', border: '#c9a227' });

    // Parked laundry carts
    for (const [z, rot] of [[6.6, 0.1], [7.8, -0.1], [9.0, 0.05]] as [number, number][]) {
      const c = buildCart();
      c.position.set(X - 0.8, 0, z);
      c.rotation.y = Math.PI / 2 + rot;
      this.scene.add(c);
      // heaped with laundry
      for (let k = 0; k < 3; k++) {
        const gm = newGarment(CLOTHES[(k * 3 + Math.round(z)) % CLOTHES.length], 0);
        const b = new THREE.Mesh(lumpGeo(0.2, 0.5, z * 10 + k), std({ map: buildGarmentMeshMap(gm) }));
        b.position.set(X - 0.8 + (k - 1) * 0.22, 0.72, z);
        b.scale.set(1, 0.6, 1);
        this.scene.add(b);
      }
    }
    this.solid(X - 0.8, 7.8, 0.8, 3.2, 1.0, false, 'carts');

    // Clothing table with neat stacks, hand truck with detergent
    if (this.prop('ldClothTable', X - 3.5, 0, 11.4, 0)) this.solid(X - 3.5, 11.4, 1.6, 1.0, 1.0, false, 'decor');
    this.refs.handTruck = this.prop('ldHandTruck', X - 0.7, 0, 11.6, -Math.PI / 2);
    this.pile(X - 1.6, 11.9, 1.0, 0.8, 3, 55);
    // Big sorting bins
    const bins: [number, string, string][] = [[9.2, 'WHITES', '#f2f0ea'], [10.5, 'COLOURS', '#e67e22'], [11.8, 'REGRETS', '#2c3e50']];
    for (const [x, lbl, c] of bins) {
      const bin = new THREE.Group();
      bin.position.set(x, 0, 11.9);
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.8), std({ map: canvasTex(), color: c }));
      b.position.set(0, 0.55, 0);
      bin.add(b);
      const lumpG = new THREE.Mesh(lumpGeo(0.4, 0.4, x * 3), std({ color: c }));
      lumpG.scale.set(1.1, 0.4, 0.9);
      lumpG.position.set(0, 1.02, 0);
      bin.add(lumpG);
      bin.add(this.sign([lbl], 0.9, 0.28, 0, 0.6, -0.41, Math.PI, { bg: '#1b1b1b', fg: '#f6e7c8', font: PIX }));
      for (const [wx, wz] of [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]]) {
        const w = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), std({ color: '#1b1b1b' }));
        w.position.set(wx, 0.05, wz);
        bin.add(w);
      }
      this.scene.add(bin);
      if (lbl === 'REGRETS') this.refs.regrets = bin;
    }
    this.solid(10.5, 11.9, 4.0, 0.9, 1.1, false, 'bins');

    // Concrete pillars
    const pillarMat = std({ map: concreteTex([1, 6]) });
    const hazardMat = std({ map: hazardTex([2, 1]) });
    for (const [x, z] of [[8.2, -2.5], [8.2, 5.5]] as [number, number][]) {
      this.box(0.6, 5, 0.6, pillarMat, x, 2.5, z);
      this.box(0.64, 0.6, 0.64, hazardMat, x, 0.3, z);
      this.solid(x, z, 0.64, 0.64, 5, true, 'pillar');
    }
  }

  private waitingArea(): void {
    const Z = ROOM.maxZ;
    // Chairs facing the TV
    // the chairs can be carried around (mischief.ts), so they have no collider
    for (const x of [-15.2, -14.4, -13.6, -12.8]) {
      const c = this.prop('ldChair', x, 0, 9.4, Math.PI);
      if (c) this.refs.chairs.push(c);
    }
    if (this.prop('ldTableCoffee', -14.0, 0, 10.6, 0)) this.solid(-14.0, 10.6, 1.2, 0.7, 0.5, false, 'decor');
    for (let k = 0; k < 3; k++) {
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.3), std({ map: pix(textTexture([['LINT', 'TODAY'], ['SPIN', 'WEEKLY'], ['FOLD', 'ENTHUSIAST']][k], { w: 64, h: 96, bg: ['#c0392b', '#2e86c1', '#27ae60'][k], fg: '#ffffff' })) }));
      mag.position.set(-14.3 + k * 0.25, 0.4 + k * 0.012, 10.6);
      mag.rotation.y = k * 0.4;
      this.scene.add(mag);
    }
    // TV on the south wall
    const tv = tvStatic();
    this.tvUpdate = tv.update;
    this.box(1.6, 1.0, 0.2, std({ color: '#1b1b1b' }), -14.0, 2.5, Z - 0.12);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.82), new THREE.MeshBasicMaterial({ map: tv.texture }));
    scr.position.set(-14.0, 2.5, Z - 0.23);
    scr.rotation.y = Math.PI;
    this.scene.add(scr);
    this.refs.tvScreen = scr;
    this.refs.tvTexture = tv.texture;
    this.box(0.08, 0.5, 0.08, std({ color: '#333333' }), -14.0, 3.2, Z - 0.1);
    // vending machine and sock gacha
    const vm = new THREE.Group();
    vm.position.set(2.6, 0, Z - 0.55);
    const vbody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.9, 0.8), std({ color: '#2e86c1' }));
    vbody.position.y = 0.95;
    vm.add(vbody);
    const vglass = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.1), new THREE.MeshBasicMaterial({ map: pix(textTexture(['PODS', 'PODS', 'PODS', 'NOT A', 'SNACK'], { w: 96, h: 176, bg: '#a8dcff', fg: '#c0392b', font: PIX })) }));
    vglass.position.set(-0.12, 1.15, -0.41);
    vglass.rotation.y = Math.PI;
    vm.add(vglass);
    this.scene.add(vm);
    vm.userData.interact = { kind: 'sign', text: 'DETERGENT PODS. NOT A SNACK. The machine is sold out of not-snacks. It is not sold out of pods.' } satisfies Interact;
    this.interactables.push(vm);
    const vsign = this.sign(['DETERGENT', 'VENDING'], 0.9, 0.3, 0, 2.05, -0.41, Math.PI, { bg: '#1b1b1b', fg: '#f2d31b', font: PIX });
    vm.add(vsign);
    // the slot where pods come out, and a coin panel
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.04), std({ color: '#111111' }));
    slot.position.set(-0.12, 0.35, -0.41);
    vm.add(slot);
    const coins = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.03), std({ color: '#c8ccd0', metalness: 0.6 }));
    coins.position.set(0.33, 1.1, -0.41);
    vm.add(coins);
    this.refs.vending = vm;
    this.refs.vendingCollider = this.solid(2.6, Z - 0.55, 1.0, 0.8, 1.9, true, 'vending');
    if (this.prop('ldGacha', 4.2, 0, Z - 0.5, Math.PI)) {
      this.solid(4.2, Z - 0.5, 0.7, 0.7, 1.4, false, 'decor');
      this.sign(['SOCK-A-PON', '1 random sock', '(single)'], 0.8, 0.4, 4.2, 1.85, Z - 0.9, Math.PI, { bg: '#d35486', fg: '#ffffff', font: PIX });
    }
    // trash can, radio, a bench
    this.refs.trash = this.prop('ldTrash', -10.4, 0, 12.3, 0);
    if (this.prop('ldBench', 6.2, 0, 12.3, Math.PI)) this.solid(6.2, 12.3, 1.6, 0.6, 0.6, false, 'decor');
    // a stack of boxes by the counter
    this.pile(-10.3, 5.0, 1.0, 0.8, 3, 61);
    // sock basket by the counter: socks waiting for a partner, forever
    // baskets can be carried around (mischief.ts), so they have no collider
    const sb = this.basket(new THREE.Vector3(1.4, 0, -3.0), 3);
    this.scene.add(sb);
    const sb2 = this.basket(new THREE.Vector3(-11.2, 0, -5.4), 1);
    sb2.rotation.y = 0.3;
    this.scene.add(sb2);
    const sb3 = this.basket(new THREE.Vector3(1.0, 0, -9.4), 2);
    sb3.rotation.y = -0.2;
    this.scene.add(sb3);
    this.refs.baskets.push(sb, sb2, sb3);
  }

  /** Heaps, bags, carts and banners so the open floor does not look empty. */
  private middleClutter(): void {
    const r = rng(5150);
    const lumpAt = (x: number, y: number, z: number, rad: number, seed: number, sx = 1, sy = 0.7) => {
      const gm = newGarment(CLOTHES[((seed % CLOTHES.length) + CLOTHES.length) % CLOTHES.length], 0);
      const m = new THREE.Mesh(lumpGeo(rad, 0.45, seed), std({ map: buildGarmentMeshMap(gm) }));
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sx * 0.9);
      m.rotation.y = seed;
      this.scene.add(m);
      return m;
    };
    // The unsorted mountain under the hanger rail
    const hx = 12.4;
    const hz = 1.6;
    for (let k = 0; k < 16; k++) {
      const a = r() * Math.PI * 2;
      const d = r() * 1.1;
      const y = 0.25 + (1.1 - d) * 0.55 + r() * 0.1;
      lumpAt(hx + Math.cos(a) * d, y, hz + Math.sin(a) * d * 0.8, 0.35 + r() * 0.2, 600 + k);
    }
    for (let k = 0; k < 5; k++) {
      const gm = newGarment('sock', 0);
      const sk = buildGarmentMesh(gm);
      sk.position.set(hx - 1.3 + r() * 2.6, 0.02, hz + 1.2 + r() * 0.4);
      sk.rotation.y = r() * 6;
      this.scene.add(sk);
    }
    this.solid(hx, hz, 2.6, 2.2, 1.0, false, 'heap');
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8), std({ color: '#5d6166' }));
    post.position.set(hx - 1.4, 0.9, hz - 1.0);
    this.scene.add(post);
    const hs = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), std({ map: pix(textTexture(['UNSORTED', 'do not jump in', 'we have lost interns'], { w: 256, h: 128, bg: '#f2d31b', fg: '#1b1b1b', border: '#1b1b1b', font: PIX })), side: THREE.DoubleSide }));
    hs.position.set(hx - 1.4, 1.75, hz - 1.0);
    hs.rotation.y = -0.6;
    this.scene.add(hs);

    // Drop-off bags piled up on the customer side of the counter
    const bagM = std({ color: '#e8e4d8' });
    const bagSpots: [number, number][] = [[-10.4, 6.6], [-10.9, 7.3], [-10.1, 7.6], [-11.2, 6.4], [-10.6, 8.2]];
    bagSpots.forEach(([x, z], k) => {
      const b = new THREE.Mesh(lumpGeo(0.32, 0.35, 700 + k), k % 2 ? bagM : std({ color: ['#3a7bd5', '#c0392b', '#27ae60'][k % 3] }));
      b.scale.set(0.9, 1.1, 0.9);
      b.position.set(x, 0.34, z);
      this.scene.add(b);
      const knot = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 6), b.material as THREE.Material);
      knot.position.set(x, 0.75, z);
      this.scene.add(knot);
      const tg = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.07), std({ map: pix(textTexture([`#${(k * 7) % 12 + 1}`], { w: 48, h: 32, bg: '#f7f1dc', fg: '#b3160c', font: PIX })), side: THREE.DoubleSide }));
      tg.position.set(x + 0.15, 0.62, z + 0.2);
      this.scene.add(tg);
    });
    this.solid(-10.6, 7.3, 1.4, 2.2, 0.8, false, 'bags');
    this.sign(['DROP-OFF', 'leave bag. leave hope.'], 1.6, 0.5, -10.6, 1.9, 8.9, Math.PI, { bg: '#2f5d50', fg: '#f6e7c8', font: PIX });

    // More carts, some loaded
    const carts: [number, number, number, number][] = [[-12.9, -8.4, 0.4, 1], [2.2, 0.6, -0.3, 1], [6.0, 9.6, 1.2, 0], [10.6, -6.6, 0.1, 1]];
    for (const [x, z, rot, full] of carts) {
      const c = buildCart();
      c.position.set(x, 0, z);
      c.rotation.y = rot;
      this.scene.add(c);
      if (full) for (let k = 0; k < 3; k++) lumpAt(x + Math.cos(rot) * (k - 1) * 0.25, 0.72, z - Math.sin(rot) * (k - 1) * 0.25, 0.2, Math.round(x * 13 + k), 1, 0.6);
      this.solid(x, z, 1.0, 1.0, 0.8, false, 'cart');
    }

    // Rolling racks of finished orders in the open area
    let rk = 0;
    for (const [x, z, rot] of [[5.2, 6.8, 0.2], [10.6, 6.0, -0.15]] as [number, number, number][]) if (this.prop('ldRack', x, 0, z, rot)) {
      this.solid(x, z, 1.6, 0.8, 1.8, true, 'racks');
      rk++;
    }
    void rk;

    // Pallet of detergent by the pillar
    this.box(1.3, 0.14, 1.1, std({ color: '#8a6a43' }), 6.0, 0.07, 2.0);
    this.pile(6.0, 2.0, 1.2, 1.0, 3, 77);

    // Hanging banners
    const banner = (lines: string[], x: number, z: number, rotY: number, bg: string) => {
      const t = pix(textTexture(lines, { w: 256, h: 96, bg, fg: '#f6e7c8', border: '#f6e7c8', font: PIX }));
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 0.04), std({ map: t }));
      m.position.set(x, 3.5, z);
      m.rotation.y = rotY;
      this.scene.add(m);
      for (const s of [-0.85, 0.85]) {
        const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.15), std({ color: '#3a3a3a' }));
        ch.position.set(x + Math.cos(rotY) * s, 4.45, z - Math.sin(rotY) * s);
        this.scene.add(ch);
      }
    };
    banner(['PICKUP', 'have your ticket ready'], -4.5, 4.0, 0, '#7a2416');
    banner(['SOCKS', 'pair or perish'], 4.6, -3.8, 0, '#8e44ad');
    banner(['SORTING', 'whites colours regrets'], 12.4, 1.6, Math.PI / 2, '#2c3e50');
    banner(['WASH  DRY', 'machines 1-6'], -7, -8.8, 0, '#2f5d50');

    // Lamps over the counter
    const shade = std({ color: '#7a2416', side: THREE.DoubleSide });
    for (const x of [-7, -2]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 2.0), std({ color: '#222222' }));
      cord.position.set(x, 4.0, 4.6);
      this.scene.add(cord);
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.28, 12, 1, true), shade);
      c.position.set(x, 2.9, 4.6);
      this.scene.add(c);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), glow('#fff3c9'));
      bulb.position.set(x, 2.78, 4.6);
      this.scene.add(bulb);
    }
  }

  /** A small pile of cardboard boxes, with a collider. */
  private pile(cx: number, cz: number, w: number, d: number, maxLevels: number, seed: number): void {
    const pr = rng(seed);
    const cols = Math.max(1, Math.round(w / 0.55));
    const rows = Math.max(1, Math.round(d / 0.55));
    let top = 0;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const levels = 1 + Math.floor(pr() * maxLevels);
        let y = 0;
        for (let k = 0; k < levels; k++) {
          const bw = 0.42 + pr() * 0.12;
          const bh = 0.3 + pr() * 0.2;
          const b = this.box(bw, bh, bw, boxMaterials(Math.floor(pr() * 7)), cx - w / 2 + (i + 0.5) * (w / cols), y + bh / 2, cz - d / 2 + (j + 0.5) * (d / rows));
          b.rotation.y = (pr() - 0.5) * 0.35;
          y += bh;
        }
        top = Math.max(top, y);
      }
    }
    this.solid(cx, cz, w, d, top, true, 'boxes');
  }

  // ---------------------------------------------------------------- overhead hanger rail

  private railPath: THREE.Vector3[] = [];
  private railLen = 0;
  private hangers: { g: THREE.Group; s: number }[] = [];

  private rail(): void {
    const y = 3.4;
    const pts = [new THREE.Vector3(10, y, -5), new THREE.Vector3(15.5, y, -5), new THREE.Vector3(15.5, y, 9.5), new THREE.Vector3(10, y, 9.5)];
    this.railPath = pts;
    const railM = std({ color: '#70757b', metalness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 4];
      const len = a.distanceTo(b);
      this.railLen += len;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, len), railM);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.lookAt(b);
      this.scene.add(m);
      for (let k = 0.5; k < len; k += 3) {
        const p = a.clone().lerp(b, k / len);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 5 - y), railM);
        rod.position.set(p.x, (5 + y) / 2, p.z);
        this.scene.add(rod);
      }
    }
    const plastic = new THREE.MeshBasicMaterial({ color: '#e8f4ff', transparent: true, opacity: 0.18, depthWrite: false });
    const hookM = std({ color: '#b0b4b8', metalness: 0.7 });
    const n = 22;
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 4, 8, Math.PI * 1.4), hookM);
      hook.position.y = -0.02;
      g.add(hook);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.015, 0.015), hookM);
      bar.position.y = -0.12;
      g.add(bar);
      const gm = newGarment(CLOTHES[i % CLOTHES.length], 0);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.7, 0.05), std({ map: buildGarmentMeshMap(gm) }));
      body.position.y = -0.48;
      g.add(body);
      const cover = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.82, 0.12), plastic);
      cover.position.y = -0.5;
      g.add(cover);
      if (gm.kind === 'shirt' || gm.kind === 'hoodie') {
        for (const s of [-1, 1]) {
          const sl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.05), body.material);
          sl.position.set(s * 0.25, -0.38, 0);
          sl.rotation.z = s * 0.2;
          g.add(sl);
        }
      }
      this.scene.add(g);
      this.hangers.push({ g, s: (i / n) * this.railLen });
    }
  }

  private railPos(s: number): { p: THREE.Vector3; yaw: number } {
    let d = ((s % this.railLen) + this.railLen) % this.railLen;
    const pts = this.railPath;
    for (let i = 0; i < 4; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % 4];
      const len = a.distanceTo(b);
      if (d <= len) return { p: a.clone().lerp(b, d / len), yaw: Math.atan2(b.x - a.x, b.z - a.z) };
      d -= len;
    }
    return { p: pts[0].clone(), yaw: 0 };
  }

  // ---------------------------------------------------------------- ceiling and floor clutter

  private ceilingStuff(): void {
    const duct = std({ map: ductTex([20, 1]), metalness: 0.3 });
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, ROOM.maxX - ROOM.minX, 10), duct);
    d.rotation.z = Math.PI / 2;
    d.position.set(0, 4.55, 1.0);
    this.scene.add(d);
    for (let x = -16; x <= 16; x += 4) this.box(0.06, 0.3, 0.7, duct, x, 4.85, 1.0);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, ROOM.maxZ - ROOM.minZ), std({ color: '#70757b' }));
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(-15.5, 4.7, 0);
    this.scene.add(pipe);
    const pipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, ROOM.maxZ - ROOM.minZ), std({ color: '#2f5d50' }));
    pipe2.rotation.x = Math.PI / 2;
    pipe2.position.set(6.5, 4.75, 0);
    this.scene.add(pipe2);
    // security cameras
    const camBody = std({ color: '#d8d8d2' });
    const camDark = std({ color: '#1a1a1a' });
    const cams: [number, number, number, number][] = [
      [-17.6, 4.3, -12.6, Math.PI * 0.25],
      [17.6, 4.3, 12.6, -Math.PI * 0.75],
      [-17.6, 4.3, 12.6, Math.PI * 0.75],
      [-4.5, 3.4, 2.3, Math.PI],
      [12.8, 2.35, -8.8, -Math.PI / 2],
    ];
    const leds: THREE.Mesh[] = [];
    for (const [x, y, z, yaw] of cams) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.rotation.y = yaw;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.38), camBody);
      body.rotation.x = 0.35;
      g.add(body);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), camDark);
      lens.rotation.x = Math.PI / 2 + 0.35;
      lens.position.set(0, -0.07, 0.2);
      g.add(lens);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), glow('#ff2020'));
      l.position.set(0.06, 0.06, 0.18);
      g.add(l);
      leds.push(l);
      this.scene.add(g);
      this.refs.cams.push(g);
    }
    this.onTick((t) => {
      const on = Math.sin(t * 3) > 0;
      for (const l of leds) l.visible = on;
    });
    // a slow ceiling fan over the waiting area
    const fan = new THREE.Group();
    fan.position.set(-13, 4.6, 6);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.15, 8), std({ color: '#5d4a3a' }));
    fan.add(hub);
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.16), std({ color: '#8a6a43' }));
      b.position.set(Math.cos((k * Math.PI) / 2) * 0.55, 0, Math.sin((k * Math.PI) / 2) * 0.55);
      b.rotation.y = -(k * Math.PI) / 2;
      fan.add(b);
    }
    this.scene.add(fan);
    this.onTick((t) => (fan.rotation.y = t * 1.6));
  }

  private floorStuff(): void {
    const r = rng(9912);
    // drains
    const gm = std({ map: grateTex() });
    for (const [x, z] of [[-7, -10.6], [-1, -10.6], [5, -1], [-12, 2], [12, 4]] as [number, number][]) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), gm);
      g.rotation.x = -Math.PI / 2;
      g.position.set(x, 0.006, z);
      this.scene.add(g);
    }
    // lint everywhere (decoration, the vacuum eats the dynamic ones)
    for (let k = 0; k < 18; k++) {
      const l = buildLint(800 + k, 0.6 + r() * 0.6);
      l.position.x = ROOM.minX + 1 + r() * (ROOM.maxX - ROOM.minX - 2);
      l.position.z = ROOM.minZ + 1 + r() * (ROOM.maxZ - ROOM.minZ - 2);
      l.rotation.y = r() * 6;
      this.scene.add(l);
    }
    // stains, water marks and detergent spills
    const stain = new THREE.MeshBasicMaterial({ color: '#4a5a52', transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const blue = new THREE.MeshBasicMaterial({ color: '#3d7fbf', transparent: true, opacity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    for (let k = 0; k < 14; k++) {
      const m = new THREE.Mesh(blobGeometry(0.3 + r() * 0.5), k % 4 === 0 ? blue : stain);
      m.rotation.y = r() * 6;
      m.position.set(ROOM.minX + 2 + r() * 32, 0.005, ROOM.minZ + 2 + r() * 22);
      this.scene.add(m);
    }
    // wet floor sign
    const wet = new THREE.Group();
    wet.position.set(-1.2, 0, -9.6);
    wet.rotation.y = 0.5;
    const wetMat = std({ map: wetFloorTex(), side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.6), wetMat);
      p.position.set(0, 0.29, s * 0.1);
      p.rotation.x = s * 0.33;
      wet.add(p);
    }
    // it can be carried around (mischief.ts), so no collider and no sign text
    this.scene.add(wet);
    this.refs.wetSign = wet;
    // a hose on the floor by the machines
    const hose = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 20), std({ color: '#2a6b3a' }));
    hose.rotation.x = Math.PI / 2;
    hose.position.set(-12.3, 0.03, -11.2);
    this.scene.add(hose);
    // dropped hangers
    for (let k = 0; k < 4; k++) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.012, 0.015), std({ color: '#b0b4b8', metalness: 0.6 }));
      h.position.set(-8 + k * 4.5 + r(), 0.01, -8 + r() * 2);
      h.rotation.y = r() * 3;
      this.scene.add(h);
    }
  }

  private posters(): void {
    const spots: [number, number, number, number][] = [
      [-13.5, 2.6, ROOM.minZ + 0.03, 0],
      [-5.5, 2.4, 2.29, Math.PI],
      [-8.2, 2.6, ROOM.maxZ - 0.03, Math.PI],
      [ROOM.maxX - 0.03, 2.6, -9.5, -Math.PI / 2],
      [ROOM.minX + 0.03, 2.6, -7.0, Math.PI / 2],
      [0.5, 2.6, ROOM.maxZ - 0.03, Math.PI],
      [ROOM.maxX - 0.03, 2.6, 8.5, -Math.PI / 2],
      [-3.5, 2.4, 2.29, Math.PI],
    ];
    const styles = [
      { bg: '#fdf6e3', fg: '#2c3e50', border: '#c0392b' },
      { bg: '#2f5d50', fg: '#f6e7c8', border: '#f6e7c8' },
      { bg: '#f2d31b', fg: '#1b1b1b', border: '#1b1b1b' },
    ];
    L.POSTERS.forEach((lines, i) => {
      const s = spots[i % spots.length];
      const p = this.sign(lines, 2.2, 1.2, s[0], s[1], s[2], s[3], { ...styles[i % 3], font: PIX });
      // the poster can be lifted at the bottom (mischief.ts), so the pivot sits at its top edge
      p.geometry.translate(0, -0.6, 0);
      p.position.y += 0.6;
      p.userData.interact = { kind: 'ldPoster', poster: i } satisfies Interact;
      this.interactables.push(p);
      this.refs.posters.push(p);
    });
  }

  // ---------------------------------------------------------------- animation

  private steamMat = new THREE.SpriteMaterial({ map: steamTex(), transparent: true, depthWrite: false, opacity: 0.5 });

  private puff(pos: THREE.Vector3): void {
    let p = this.puffs.find((q) => q.life <= 0);
    if (!p) {
      if (this.puffs.length > 60) return;
      const s = new THREE.Sprite(this.steamMat.clone());
      this.scene.add(s);
      p = { s, v: new THREE.Vector3(), life: 0, max: 1 };
      this.puffs.push(p);
    }
    p.s.visible = true;
    p.s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2));
    p.v.set((Math.random() - 0.5) * 0.15, 0.5 + Math.random() * 0.3, (Math.random() - 0.5) * 0.15);
    p.max = p.life = 1.6 + Math.random() * 1.2;
  }

  private tvAcc = 0;

  private animate(t: number): void {
    const dt = Math.min(0.05, Math.max(0, t - this.lastT));
    this.lastT = t;
    for (const v of this.steamVents) {
      if (!v.on() && this.steamBoost <= 1) continue;
      v.acc += dt * v.rate * this.steamBoost;
      while (v.acc >= 1) {
        v.acc -= 1;
        this.puff(v.pos);
      }
    }
    for (const p of this.puffs) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.s.position.addScaledVector(p.v, dt);
      const k = 1 - p.life / p.max;
      p.s.scale.setScalar(0.25 + k * 0.9);
      (p.s.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.45 * (1 - k));
      if (p.life <= 0) p.s.visible = false;
    }
    for (const h of this.hangers) {
      h.s += dt * 0.35;
      const { p, yaw } = this.railPos(h.s);
      h.g.position.copy(p);
      h.g.rotation.y = yaw + Math.PI / 2;
      h.g.rotation.z = Math.sin(t * 2 + h.s) * 0.04;
    }
    this.tvAcc += dt;
    if (this.tvUpdate && this.tvAcc > 0.08) {
      this.tvAcc = 0;
      this.tvUpdate();
    }
  }
}

/** The cloth texture of a garment, for decorative lumps. */
function buildGarmentMeshMap(gm: { pattern: number; colors: [string, string] }): THREE.Texture {
  // importing clothTex here directly keeps the decor cheap
  return clothTexFor(gm.pattern, gm.colors);
}

import { clothTex } from './textures';
const clothTexFor = (p: number, c: [string, string]) => clothTex(p, c[0], c[1]);

let wireTex: THREE.CanvasTexture | null = null;
function makeWireTex(): THREE.CanvasTexture {
  if (wireTex) return wireTex;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 32, 32);
  g.fillStyle = '#5a6066';
  for (let i = 0; i < 32; i += 6) {
    g.fillRect(i, 0, 1, 32);
    g.fillRect(0, i, 32, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 3);
  wireTex = t;
  return t;
}

// Keep the model keys in one place.
export const MODEL_KEYS = ['ldWasher', 'ldDryer', 'ldStack', 'ldChair', 'ldTrash', 'ldTableCoffee', 'ldBench', 'ldRack', 'ldClothTable', 'ldHandTruck', 'ldMannequin', 'ldGacha', 'ldMachine'] as const;
export const hasAnyModel = () => MODEL_KEYS.some((k) => hasModel(k));
