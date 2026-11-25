import * as THREE from 'three';
import { boxMaterials } from '../../details';
import { Item } from '../../items';
import { Interact, LevelKit } from '../../level';
import { ceilingTex, hazardTex, tvStatic, wetFloorTex } from '../../textures';
import { blobGeometry, textTexture } from '../../util';
import { CHICKEN_DEF, EXTINGUISHER_DEF, Ing, m, pieceMesh, friesMesh, nuggetMesh } from './items';
import {
  asphaltTex,
  diningFloorTex,
  diningWallTex,
  frostTex,
  grillTopTex,
  kitchenFloorTex,
  oilTex,
  sidewalkTex,
  skyTex,
  stainAlpha,
  steelTex,
  tileWallTex,
  vinylTex,
  woodPanelTex,
} from './textures';
import * as T from './texts';

/**
 * MEGABYTE BURGER (Branch 404): a greasy fast food kitchen with a dining room
 * behind the pass-through. Kitchen in the north (z < 2), dining room in the south.
 */

export const ROOM = { minX: -14, maxX: 14, minZ: -10, maxZ: 10 };
const H = 3.6;
const PART_Z = 2;
const PART_H = 2.55;

export interface Basket {
  idx: number;
  group: THREE.Group;
  x: number;
  z: number;
  upY: number;
  downY: number;
  fries: THREE.Group;
}

/** Spots the robots walk to. */
export const SPOTS = {
  entrance: new THREE.Vector3(0, 0, 9.4),
  queue: [0, 1, 2, 3, 4].map((i) => new THREE.Vector3(0, 0, 2.95 + i * 0.95)),
  pickupSide: new THREE.Vector3(1.9, 0, 3.0),
  critic: new THREE.Vector3(-4.15, 0, 4.0),
  eat: [new THREE.Vector3(-7.7, 0, 7.3), new THREE.Vector3(-9.5, 0, 4.0), new THREE.Vector3(4.6, 0, 4.4), new THREE.Vector3(6.2, 0, 7.6), new THREE.Vector3(-4.3, 0, 7.3), new THREE.Vector3(2.9, 0, 7.6)],
  ballPit: new THREE.Vector3(-12.1, 0, 8.3),
  kidRoam: [new THREE.Vector3(-9.8, 0, 8.9), new THREE.Vector3(-6.6, 0, 5.6), new THREE.Vector3(-2.2, 0, 3.4), new THREE.Vector3(2.4, 0, 5.8), new THREE.Vector3(-3, 0, 9.0), new THREE.Vector3(-10.2, 0, 2.9)],
  carStop: new THREE.Vector3(15.9, 0, -4.0),
  kitchenFloor: [new THREE.Vector3(-1, 0, -3), new THREE.Vector3(4, 0, -6), new THREE.Vector3(-7, 0, -3), new THREE.Vector3(9, 0, -4), new THREE.Vector3(1, 0, 0.3), new THREE.Vector3(-4, 0, -7.5)],
};

function canvasTex(w: number, h: number): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; tex: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  return { canvas, g, tex };
}

const PX = '"Press Start 2P", monospace';

function menuBoardTex(title: string, rows: [string, string, string?][], hue: string): THREE.CanvasTexture {
  const W = 288;
  const Hh = 96;
  const { g, tex } = canvasTex(W, Hh);
  g.fillStyle = '#140c08';
  g.fillRect(0, 0, W, Hh);
  g.fillStyle = hue;
  g.fillRect(0, 0, W, 17);
  g.fillStyle = '#140c08';
  g.font = `10px ${PX}`;
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.fillText(title, W / 2, 9);
  const rowH = (Hh - 19) / rows.length;
  rows.forEach(([name, price], i) => {
    const y = 19 + rowH * (i + 0.5);
    g.font = '18px VT323, monospace';
    g.textAlign = 'left';
    g.fillStyle = '#f7e6b0';
    g.fillText(name, 8, y);
    g.textAlign = 'right';
    g.fillStyle = '#f0b43c';
    g.fillText(price, W - 8, y);
  });
  return tex;
}

export class Kitchen extends LevelKit {
  /** Grill surface slots for patties (world positions on the surface). */
  grillSlots: THREE.Vector3[] = [];
  grillGroup = new THREE.Group();
  baskets: Basket[] = [];
  fryerGroup = new THREE.Group();
  trayMat = new THREE.Vector3(-4.0, 0.955, -5.95);
  firePos = { grill: new THREE.Vector3(-5.0, 0.95, -9.45), fryer: new THREE.Vector3(-8.0, 0.95, -9.5) };
  grillPanel = canvasTex(256, 48);
  fryPanel = canvasTex(160, 48);
  rail = canvasTex(1024, 128);
  driveSign = canvasTex(192, 32);
  iceScreen = canvasTex(64, 32);
  speakerLed!: THREE.MeshStandardMaterial;
  sprinklers: THREE.Vector3[] = [];
  heatLamps: THREE.PointLight[] = [];
  /** Things the mischief module (mischief.ts) breaks, moves or uses. */
  cameras: THREE.Group[] = [];
  diningTv!: THREE.Group;
  wetSign!: THREE.Group;
  mopBucket!: THREE.Group;
  gacha: THREE.Object3D | null = null;
  private flicker!: THREE.PointLight;
  private oilMats: THREE.MeshStandardMaterial[] = [];
  private tv = tvStatic();
  private tvT = 0;
  private fans: THREE.Object3D[] = [];
  private ballPitBalls: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    super(scene);
    this.bounds = ROOM;
    this.ceiling = H - 0.1;
    this.spawn = { pos: new THREE.Vector3(-2.0, 0, -3.4), yaw: 0.6 };
    this.bossWaypoints.push(
      new THREE.Vector3(-7.4, 0, -7.4),
      new THREE.Vector3(-3.8, 0, -7.4),
      new THREE.Vector3(-1, 0, -3.5),
      new THREE.Vector3(3, 0, -6.8),
      new THREE.Vector3(8.5, 0, -6.2),
      new THREE.Vector3(11.8, 0, -3),
      new THREE.Vector3(-8.2, 0, -1.6),
      new THREE.Vector3(0.5, 0, 0.2),
      new THREE.Vector3(-9, 0, 5.6),
      new THREE.Vector3(-3, 0, 5.8),
      new THREE.Vector3(3.2, 0, 6.2),
      new THREE.Vector3(6.6, 0, 8.6),
    );
    this.lights();
    this.shell();
    this.outside();
    this.freezer();
    this.fryStation();
    this.grill();
    this.hood();
    this.backWall();
    this.island();
    this.partitionKitchenSide();
    this.driveThru();
    this.dining();
    this.toilet();
    this.clutter();
    this.onTick((t) => this.animate(t));
  }

  // ---------------------------------------------------------------- helpers

  private add<O extends THREE.Object3D>(o: O, parent: THREE.Object3D = this.scene): O {
    parent.add(o);
    return o;
  }

  private cyl(rt: number, rb: number, h: number, mat: THREE.Material, x: number, y: number, z: number, seg = 10, parent: THREE.Object3D = this.scene): THREE.Mesh {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    c.position.set(x, y, z);
    return this.add(c, parent);
  }

  private glowSign(lines: string[], w: number, h: number, x: number, y: number, z: number, rotY: number, bg: string, fg: string, border?: string): THREE.Mesh {
    const tex = textTexture(lines, { w: 512, h: Math.max(48, Math.round((512 * h) / w)), bg, fg, border, font: PX });
    tex.magFilter = THREE.NearestFilter;
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    me.position.set(x, y, z);
    me.rotation.y = rotY;
    return this.add(me);
  }

  private pixSign(lines: string[], w: number, h: number, x: number, y: number, z: number, rotY: number, bg: string, fg: string, text?: string, border?: string): THREE.Mesh {
    return this.sign(lines, w, h, x, y, z, rotY, { bg, fg, border: border ?? fg, font: PX }, text);
  }

  private interactive(o: THREE.Object3D, info: Interact): void {
    o.userData.interact = info;
    this.interactables.push(o);
  }

  private model(key: string, x: number, y: number, z: number, rotY = 0, parent: THREE.Object3D = this.scene): THREE.Object3D | null {
    return this.prop(key, x, y, z, rotY, parent);
  }

  /** A wall along x at a fixed z with rectangular holes [x0, x1, y0, y1]. */
  private wallZ(z: number, x0: number, x1: number, h: number, thick: number, mat: THREE.Material, holes: [number, number, number, number][] = []): void {
    const sorted = [...holes].sort((a, b) => a[0] - b[0]);
    let cur = x0;
    for (const [a, b, y0, y1] of sorted) {
      if (a > cur) this.box(a - cur, h, thick, mat, (cur + a) / 2, h / 2, z);
      if (y0 > 0) this.box(b - a, y0, thick, mat, (a + b) / 2, y0 / 2, z);
      if (y1 < h) this.box(b - a, h - y1, thick, mat, (a + b) / 2, (h + y1) / 2, z);
      cur = b;
    }
    if (cur < x1) this.box(x1 - cur, h, thick, mat, (cur + x1) / 2, h / 2, z);
  }

  private wallX(x: number, z0: number, z1: number, h: number, thick: number, mat: THREE.Material, holes: [number, number, number, number][] = []): void {
    const sorted = [...holes].sort((a, b) => a[0] - b[0]);
    let cur = z0;
    for (const [a, b, y0, y1] of sorted) {
      if (a > cur) this.box(thick, h, a - cur, mat, x, h / 2, (cur + a) / 2);
      if (y0 > 0) this.box(thick, y0, b - a, mat, x, y0 / 2, (a + b) / 2);
      if (y1 < h) this.box(thick, h - y1, b - a, mat, x, (h + y1) / 2, (a + b) / 2);
      cur = b;
    }
    if (cur < z1) this.box(thick, h, z1 - cur, mat, x, h / 2, (cur + z1) / 2);
  }

  /** A pane of dirty glass. */
  private glass(w: number, h: number, x: number, y: number, z: number, rotY: number): void {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: '#a8c8d8', transparent: true, opacity: 0.18, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide }));
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    this.add(g);
  }

  private pile(cx: number, cz: number, w: number, d: number, levels: number, seed: number, y0 = 0): void {
    let s = seed;
    const r = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const cols = Math.max(1, Math.round(w / 0.55));
    const rows = Math.max(1, Math.round(d / 0.55));
    let top = y0;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let y = y0;
        const n = 1 + Math.floor(r() * levels);
        for (let k = 0; k < n; k++) {
          const bw = 0.4 + r() * 0.12;
          const bh = 0.28 + r() * 0.2;
          const b = this.box(bw, bh, 0.4 + r() * 0.12, boxMaterials(Math.floor(r() * 7)), cx - w / 2 + (i + 0.5) * (w / cols), y + bh / 2, cz - d / 2 + (j + 0.5) * (d / rows));
          b.rotation.y = (r() - 0.5) * 0.4;
          y += bh;
        }
        top = Math.max(top, y);
      }
    }
    if (y0 === 0) this.solid(cx, cz, w, d, top, false, 'boxes');
  }

  private stain(x: number, z: number, r: number, color = '#2a1a08', opacity = 0.35): void {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const me = new THREE.Mesh(blobGeometry(r), mat);
    me.position.set(x, 0.004, z);
    me.rotation.y = x * 7 + z;
    this.add(me);
  }

  // ---------------------------------------------------------------- light and shell

  private lights(): void {
    this.scene.background = new THREE.Color('#2a2119');
    this.scene.add(new THREE.HemisphereLight('#fff1d8', '#5a4632', 1.9));
    const sun = new THREE.DirectionalLight('#ffe9c4', 0.9);
    sun.position.set(10, 14, 12);
    this.scene.add(sun);
    const spots: [number, number, string, number][] = [
      [-6.5, -6.8, '#fff0d2', 18],
      [1.5, -6.5, '#fff6e2', 18],
      [9, -5, '#fff0d2', 16],
      [-1, -1.2, '#fff6e2', 14],
      [-8, 5.8, '#ffd9a0', 16],
      [0, 6.5, '#ffe2b0', 18],
      [6.5, 5.6, '#ffd9a0', 14],
    ];
    for (const [x, z, color, i] of spots) {
      const l = new THREE.PointLight(color, i, 13, 1.6);
      l.position.set(x, H - 0.4, z);
      this.scene.add(l);
    }
    this.flicker = new THREE.PointLight('#d8f0ff', 10, 7, 1.6);
    this.flicker.position.set(7.6, H - 0.5, 8.2);
    this.scene.add(this.flicker);
  }

  private shell(): void {
    const kFloor = new THREE.Mesh(new THREE.PlaneGeometry(28, 12, 28, 12), new THREE.MeshStandardMaterial({ map: kitchenFloorTex([14, 6]), roughness: 0.55 }));
    kFloor.rotation.x = -Math.PI / 2;
    kFloor.position.set(0, 0.002, -4);
    this.add(kFloor);
    const dFloor = new THREE.Mesh(new THREE.PlaneGeometry(28, 8, 28, 8), new THREE.MeshStandardMaterial({ map: diningFloorTex([14, 4]), roughness: 0.6 }));
    dFloor.rotation.x = -Math.PI / 2;
    dFloor.position.set(0, 0.002, 6);
    this.add(dFloor);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(28, 20, 14, 10), new THREE.MeshStandardMaterial({ map: ceilingTex([14, 10]), roughness: 0.9 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, H, 0);
    this.add(ceil);
    const panel = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6dc', emissiveIntensity: 1 });
    for (const [x, z] of [[-6.5, -6.8], [1.5, -6.5], [9, -5], [-1, -1.2], [-8, 5.8], [0, 6.5], [6.5, 5.6], [7.6, 8.2]] as [number, number][]) this.box(1.2, 0.05, 0.6, panel, x, H - 0.03, z);

    // Outer walls: kitchen tiles in the north, wallpaper in the dining room.
    const kWall = new THREE.MeshStandardMaterial({ map: tileWallTex([28, 4]), roughness: 0.6 });
    const kWallS = new THREE.MeshStandardMaterial({ map: tileWallTex([12, 4]), roughness: 0.6 });
    const dWall = new THREE.MeshStandardMaterial({ map: diningWallTex([14, 2]), roughness: 0.85 });
    const dWallS = new THREE.MeshStandardMaterial({ map: diningWallTex([4, 2]), roughness: 0.85 });
    this.wallZ(-10.15, -14.3, 14.3, H, 0.3, kWall);
    this.wallX(-14.15, -10, PART_Z, H, 0.3, kWallS);
    this.wallX(14.15, -10, PART_Z, H, 0.3, kWallS, [[-5.0, -3.0, 1.0, 2.1]]);
    this.wallZ(10.15, -14.3, 14.3, H, 0.3, dWall, [[-11.5, -5.0, 0.9, 2.5], [-1.2, 1.2, 0, 2.3], [3.6, 7.6, 0.9, 2.5]]);
    this.wallX(-14.15, PART_Z, 10, H, 0.3, dWallS);
    this.wallX(14.15, PART_Z, 10, H, 0.3, dWallS);
    this.solid(0, -10.15, 28.6, 0.3, H, false);
    this.solid(0, 10.15, 28.6, 0.3, H, false);
    this.solid(-14.15, 0, 0.3, 20, H, false);
    this.solid(14.15, 0, 0.3, 20, H, false);

    // Wood wainscot and a red stripe in the dining room
    const wood = new THREE.MeshStandardMaterial({ map: woodPanelTex([14, 1]), roughness: 0.7 });
    const woodS = new THREE.MeshStandardMaterial({ map: woodPanelTex([4, 1]), roughness: 0.7 });
    const stripe = m('#9e2a1c', 0.6);
    for (const [x0, x1] of [[-14, -11.5], [-5.0, -1.2], [1.2, 3.6], [7.6, 9]] as [number, number][]) {
      this.box(x1 - x0, 0.9, 0.04, wood, (x0 + x1) / 2, 0.45, 9.98);
      this.box(x1 - x0, 0.08, 0.05, stripe, (x0 + x1) / 2, 0.94, 9.97);
    }
    for (const x of [-13.98, 13.98]) {
      this.box(0.04, 0.9, 7.8, woodS, x, 0.45, 6);
      this.box(0.05, 0.08, 7.8, stripe, x, 0.94, 6);
    }
    // Kitchen: dark red kick strip along the walls
    const kick = m('#5a2a1c', 0.8);
    this.box(28, 0.15, 0.04, kick, 0, 0.075, -9.98);
    this.box(0.04, 0.15, 12, kick, -13.98, 0.075, -4);
    this.box(0.04, 0.15, 12, kick, 13.98, 0.075, -4);

    // Partition between kitchen and dining room, with the pass-through and the staff door.
    const partK = new THREE.MeshStandardMaterial({ map: tileWallTex([12, 3]), roughness: 0.6 });
    const partD = new THREE.MeshStandardMaterial({ map: diningWallTex([6, 1.5]), roughness: 0.85 });
    // kitchen face and dining face as two thin walls so each side has its own look
    this.wallZ(PART_Z - 0.06, -14, 14, PART_H, 0.12, partK, [[-2.5, 2.5, 1.05, 2.05], [9.2, 10.6, 0, 2.2]]);
    this.wallZ(PART_Z + 0.06, -14, 14, PART_H, 0.12, partD, [[-2.5, 2.5, 1.05, 2.05], [9.2, 10.6, 0, 2.2]]);
    this.box(28, 0.1, 0.32, m('#7a2416', 0.6), 0, PART_H + 0.05, PART_Z);
    this.solid(-8.25, PART_Z, 11.5, 0.24, PART_H, true, 'partition');
    this.solid(5.85, PART_Z, 6.7, 0.24, PART_H, true, 'partition');
    this.solid(12.3, PART_Z, 3.4, 0.24, PART_H, true, 'partition');
    // Wood wainscot on the dining face
    for (const [x0, x1] of [[-14, -2.5], [2.5, 9.2], [10.6, 14]] as [number, number][]) {
      this.box(x1 - x0, 0.9, 0.03, woodS, (x0 + x1) / 2, 0.45, PART_Z + 0.135);
    }

    // Staff door: a swinging door, stuck half open.
    const frame = m('#6e6a62', 0.5, { metalness: 0.4 });
    this.box(0.1, 2.2, 0.3, frame, 9.2, 1.1, PART_Z);
    this.box(0.1, 2.2, 0.3, frame, 10.6, 1.1, PART_Z);
    const leaf = new THREE.Group();
    leaf.position.set(10.6, 0, PART_Z + 0.1);
    leaf.rotation.y = -1.25;
    this.box(1.3, 2.0, 0.05, steelTex([2, 3]) ? new THREE.MeshStandardMaterial({ map: steelTex([1, 2]), roughness: 0.4, metalness: 0.3 }) : frame, -0.65, 1.05, 0, leaf);
    const port = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), new THREE.MeshStandardMaterial({ color: '#9cc0d0', roughness: 0.1 }));
    port.position.set(-0.65, 1.55, 0.03);
    leaf.add(port);
    this.add(leaf);
    this.pixSign(['STAFF ONLY'], 1.2, 0.26, 9.9, 2.35, PART_Z + 0.135, 0, '#c0392b', '#ffffff');
    this.pixSign(['TO DINING / WC'], 1.2, 0.26, 9.9, 2.35, PART_Z - 0.135, Math.PI, '#2c64b4', '#ffffff');
  }

  private outside(): void {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 70, 14, 14), new THREE.MeshStandardMaterial({ map: asphaltTex([24, 24]), roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    this.add(ground);
    const walk = new THREE.MeshStandardMaterial({ map: sidewalkTex([16, 2]), roughness: 0.9 });
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(32, 3), walk);
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(0, 0.0, 11.8);
    this.add(sw);
    // Lane markings of the drive-thru lane and parking bays
    const paint = m('#e8d36a', 0.8);
    for (let z = -20; z < 20; z += 2.2) this.box(0.12, 0.01, 1.1, paint, 17.6, 0.005, z);
    for (let x = -12; x <= 12; x += 3) this.box(0.1, 0.01, 4, m('#e8e8e0', 0.8), x, 0.005, 16.5);
    this.glowSign(['DRIVE', 'THRU', '>>>'], 1.2, 1.2, 18.6, 2.6, -8.5, -Math.PI / 2, '#c0392b', '#fff3d6', '#f0b43c');
    this.cyl(0.06, 0.06, 2.2, m('#555555', 0.5), 18.6, 1.1, -8.5, 6);
    // Sky backdrops behind the windows
    const sky = new THREE.MeshBasicMaterial({ map: skyTex(), fog: false });
    const s1 = new THREE.Mesh(new THREE.PlaneGeometry(90, 26), sky);
    s1.position.set(0, 10, 34);
    s1.rotation.y = Math.PI;
    this.add(s1);
    const s2 = new THREE.Mesh(new THREE.PlaneGeometry(90, 26), sky);
    s2.position.set(34, 10, 0);
    s2.rotation.y = -Math.PI / 2;
    this.add(s2);
    // A parked car and the big pylon sign
    this.model('bg_sedan', -8, 0, 17.5, 0.2);
    this.model('bg_van', 6, 0, 18.2, Math.PI - 0.1);
    this.cyl(0.22, 0.22, 6, m('#7a2416', 0.5), -1.5, 3, 22, 8);
    this.glowSign(['MEGABYTE', 'BURGER', 'over 3 served'], 4, 2.2, -1.5, 6.6, 21.9, Math.PI, '#c0392b', '#f7d23e', '#f7d23e');
    for (const x of [-12, 9]) {
      this.cyl(0.07, 0.07, 4.5, m('#3a3a3a', 0.5), x, 2.25, 13.6, 6);
      this.box(0.7, 0.12, 0.25, m('#3a3a3a', 0.5), x, 4.5, 13.6);
    }
    this.model('bg_trafficCone', 16.4, 0, 3.5);
    this.model('bg_trafficCone', 16.3, 0, 6.2);
  }

  // ---------------------------------------------------------------- walk-in freezer with the toilet key

  private freezer(): void {
    const fx0 = -14;
    const fx1 = -10.5;
    const fz0 = -10;
    const fz1 = -5.6;
    const fh = 2.6;
    const metal = new THREE.MeshStandardMaterial({ map: frostTex([4, 3]), roughness: 0.5 });
    // east wall with the door, north wall
    this.wallX(fx1, fz0, fz1, fh, 0.14, metal, [[-8.7, -7.4, 0, 2.2]]);
    this.wallZ(fz1, fx0, fx1, fh, 0.14, metal);
    this.box(fx1 - fx0, 0.12, fz1 - fz0, metal, (fx0 + fx1) / 2, fh, (fz0 + fz1) / 2);
    this.solid(fx1, (fz0 - 8.7) / 2, 0.16, -8.7 - fz0, fh, true, 'freezer');
    this.solid(fx1, (-7.4 + fz1) / 2, 0.16, fz1 + 7.4, fh, true, 'freezer');
    this.solid((fx0 + fx1) / 2, fz1, fx1 - fx0, 0.16, fh, true, 'freezer');
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(fx1 - fx0, fz1 - fz0, 4, 4), new THREE.MeshStandardMaterial({ map: frostTex([3, 4]), roughness: 0.4 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((fx0 + fx1) / 2, 0.006, (fz0 + fz1) / 2);
    this.add(floor);
    // heavy door hanging open and strip curtain
    const door = new THREE.Group();
    door.position.set(fx1 + 0.08, 0, -7.4);
    door.rotation.y = 1.9;
    this.box(1.3, 2.15, 0.12, metal, -0.65, 1.08, 0, door);
    this.box(0.08, 0.3, 0.08, m('#cfd3d6', 0.3, { metalness: 0.7 }), -1.15, 1.1, 0.08, door);
    this.add(door);
    const strip = new THREE.MeshStandardMaterial({ color: '#cfe6f2', transparent: true, opacity: 0.35, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 2.1), strip);
      s.position.set(fx1 + 0.02, 1.07, -8.6 + 0.2 + i * 0.2);
      s.rotation.y = Math.PI / 2 + (i % 2 ? 0.1 : -0.1);
      this.add(s);
    }
    this.pixSign(['WALK-IN FREEZER', '-18 C', 'toilet key inside'], 1.3, 0.7, fx1 + 0.09, 2.45, -6.55, Math.PI / 2, '#2c64b4', '#ffffff');
    const cold = new THREE.PointLight('#a8d8ff', 9, 6, 1.5);
    cold.position.set(-12.3, 2.3, -7.8);
    this.add(cold);
    this.box(0.5, 0.04, 0.25, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#cfe8ff', emissiveIntensity: 1.2 }), -12.3, fh - 0.08, -7.8);

    // Wire shelves with frozen boxes along the west and north wall
    const wire = m('#b8c2c8', 0.4, { metalness: 0.6 });
    for (const [cx, cz, w, d, rot] of [[-13.65, -7.8, 0.6, 4.2, 0], [-12.25, -9.65, 3.0, 0.6, 1]] as [number, number, number, number, number][]) {
      for (const y of [0.15, 0.75, 1.35, 1.95]) {
        this.box(w, 0.03, d, wire, cx, y, cz);
        let k = 0;
        const along = rot ? w : d;
        for (let a = -along / 2 + 0.3; a < along / 2 - 0.2; a += 0.5) {
          if ((k++ + y * 10) % 4 === 3) continue;
          const bx = rot ? cx + a : cx;
          const bz = rot ? cz : cz + a;
          const bb = this.box(0.42, 0.3 + (k % 2) * 0.12, 0.4, boxMaterials((k + Math.round(y * 3)) % 7), bx, y + 0.18 + (k % 2) * 0.06, bz);
          bb.rotation.y = (k % 3) * 0.08;
        }
      }
      for (const s of [-1, 1]) for (const t of [-1, 1]) {
        const px = rot ? cx + s * (w / 2) : cx + t * (w / 2);
        const pz = rot ? cz + t * (d / 2) : cz + s * (d / 2);
        this.box(0.03, 2.1, 0.03, wire, px, 1.05, pz);
      }
      this.solid(cx, cz, w, d, 2.1, true, 'freezer');
    }
    // Frozen mystery meat blocks on the floor and hanging hooks
    const meat = m('#c79a9a', 0.5);
    for (const [x, z] of [[-11.2, -6.3], [-11.0, -9.3]] as [number, number][]) {
      this.box(0.5, 0.35, 0.4, meat, x, 0.18, z);
      this.box(0.48, 0.02, 0.38, m('#f4fbff', 0.3), x, 0.36, z);
    }
    this.solid(-11.1, -6.3, 0.55, 0.45, 0.4, false);
    this.solid(-11.1, -9.3, 0.55, 0.45, 0.4, false);
    const rail = m('#8e979c', 0.4, { metalness: 0.7 });
    this.box(0.05, 0.05, 2.6, rail, -12.3, 2.35, -7.8);
    for (const z of [-8.9, -6.7]) {
      this.cyl(0.006, 0.006, 0.7, rail, -12.3, 2.0, z, 4);
      const carcass = this.cyl(0.13, 0.08, 0.5, m('#d9b3ad', 0.6), -12.3, 1.45, z, 6);
      carcass.rotation.z = 0.05;
    }
    // The toilet key, tied to a frozen chicken on a hook
    this.cyl(0.006, 0.006, 1.0, rail, -12.3, 1.85, -7.8, 4);
    const chicken = new Item(CHICKEN_DEF);
    chicken.state = 'fixed';
    this.scene.add(chicken.mesh);
    chicken.mesh.position.set(-12.3, 0, -7.8);
    chicken.mesh.rotation.set(0, 0.4, 0);
    chicken.mesh.updateMatrixWorld(true);
    const cb = new THREE.Box3().setFromObject(chicken.mesh);
    chicken.mesh.position.y = 1.35 - cb.max.y + 0.15;
    this.initialItems.push(chicken);
    this.pixSign(['TOILET KEY', 'return the chicken', 'do not eat the key'], 0.8, 0.45, -11.3, 1.5, -5.68, Math.PI, '#ffffff', '#c0392b');
    // frost puddle under the chicken
    this.stain(-12.3, -7.8, 0.35, '#9fc8e0', 0.5);
  }

  // ---------------------------------------------------------------- stations

  private fryStation(): void {
    const steel = new THREE.MeshStandardMaterial({ map: steelTex([2, 1]), roughness: 0.35, metalness: 0.4 });
    // chest freezer with the frozen fries
    const chest = new THREE.Group();
    chest.position.set(-9.65, 0, -9.5);
    this.box(0.9, 0.86, 0.8, m('#e9ecef', 0.5), 0, 0.43, 0, chest);
    this.box(0.92, 0.06, 0.82, m('#c9ced2', 0.4), 0, 0.89, 0, chest);
    const bagMat = new THREE.MeshStandardMaterial({ map: textTexture(['FROZEN', 'FRIES'], { w: 64, h: 64, bg: '#2c64b4', fg: '#f2d24b', font: PX }) });
    for (let i = 0; i < 3; i++) {
      const b = this.box(0.22, 0.06, 0.3, bagMat, -0.22 + i * 0.22, 0.95, (i % 2) * 0.1 - 0.05, chest);
      b.rotation.y = i * 0.3;
    }
    this.add(chest);
    this.interactive(chest, { kind: 'bgFryBag' });
    this.solid(-9.65, -9.5, 0.9, 0.8, 0.95, false, 'station');
    this.pixSign(['FRIES', 'frozen'], 0.6, 0.3, -9.65, 0.6, -9.09, 0, '#2c64b4', '#f2d24b');

    // fryer with two vats
    const fr = this.fryerGroup;
    fr.position.set(-8.0, 0, -9.5);
    this.box(1.6, 0.8, 0.85, steel, 0, 0.4, 0, fr);
    this.box(1.62, 0.08, 0.87, m('#8d9296', 0.35, { metalness: 0.5 }), 0, 0.84, 0, fr);
    this.box(0.04, 0.6, 0.02, m('#2a2a2a', 0.5), 0, 0.45, 0.43, fr);
    for (const s of [-1, 1]) {
      const oil = new THREE.MeshStandardMaterial({ map: oilTex().clone(), roughness: 0.2 });
      oil.map!.needsUpdate = true;
      this.oilMats.push(oil);
      const surf = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.55), oil);
      surf.rotation.x = -Math.PI / 2;
      surf.position.set(s * 0.4, 0.86, -0.05);
      fr.add(surf);
      this.box(0.66, 0.02, 0.04, m('#3a3a3a', 0.5), s * 0.4, 0.87, 0.24, fr);
      // dials
      for (const dx of [-0.12, 0.12]) {
        const d = this.cyl(0.03, 0.03, 0.02, m('#111111', 0.5), s * 0.4 + dx, 0.62, 0.43, 8, fr);
        d.rotation.x = Math.PI / 2;
      }
    }
    // a column of grease running down the front
    this.box(0.12, 0.5, 0.005, m('#6e4a14', 0.3, { transparent: true, opacity: 0.6 }), 0.55, 0.55, 0.43, fr);
    this.add(fr);
    this.interactive(fr, { kind: 'bgFryer' });
    this.solid(-8.0, -9.5, 1.6, 0.85, 0.9, false, 'station');

    // the two baskets
    for (const s of [-1, 1]) {
      const idx = s < 0 ? 0 : 1;
      const g = new THREE.Group();
      const x = -8.0 + s * 0.4;
      const z = -9.55;
      const wire = m('#c9cfd3', 0.35, { metalness: 0.7 });
      const bw = 0.48;
      const bd = 0.42;
      const bh = 0.2;
      for (const sx of [-1, 1]) this.box(0.012, bh, bd, wire, (sx * bw) / 2, bh / 2, 0, g);
      for (const sz of [-1, 1]) this.box(bw, bh, 0.012, wire, 0, bh / 2, (sz * bd) / 2, g);
      this.box(bw, 0.01, bd, wire, 0, 0.005, 0, g);
      for (let i = -2; i <= 2; i++) this.box(0.006, bh, bd, wire, i * 0.09, bh / 2, 0, g);
      const handle = this.box(0.04, 0.04, 0.42, m('#1c1c1c', 0.6), 0, bh + 0.02, bd / 2 + 0.2, g);
      handle.rotation.x = -0.35;
      const fries = new THREE.Group();
      const fm = m('#f0dc9a', 0.7);
      for (let i = 0; i < 16; i++) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.016, 0.16), fm);
        f.position.set(-0.18 + (i % 6) * 0.07, 0.03 + Math.floor(i / 6) * 0.02, ((i * 7) % 5 - 2) * 0.05);
        f.rotation.y = ((i * 13) % 7) * 0.4;
        fries.add(f);
      }
      fries.visible = false;
      g.add(fries);
      g.position.set(x, 1.12, z);
      this.add(g);
      this.interactive(g, { kind: 'bgBasket', idx });
      this.baskets.push({ idx, group: g, x, z, upY: 1.12, downY: 0.7, fries });
    }
    // basket hanger rail
    this.box(1.5, 0.04, 0.04, m('#8d9296', 0.35, { metalness: 0.6 }), -8.0, 1.5, -9.88);
    // fry timer screen on the hood
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.42), new THREE.MeshBasicMaterial({ map: this.fryPanel.tex }));
    fp.position.set(-8.0, 2.42, -8.73);
    this.add(fp);
    // fry dump station with a heat lamp, next to the fryer
    this.pixSign(['FRY TIME', 'is fun time'], 0.7, 0.3, -6.9, 1.4, -9.98, 0, '#f2d24b', '#7a2416');
  }

  private grill(): void {
    const gr = this.grillGroup;
    gr.position.set(-5.0, 0, -9.5);
    const steel = new THREE.MeshStandardMaterial({ map: steelTex([3, 1]), roughness: 0.35, metalness: 0.4 });
    this.box(2.4, 0.84, 0.85, steel, 0, 0.42, 0, gr);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.85), [m('#2a2624'), m('#2a2624'), new THREE.MeshStandardMaterial({ map: grillTopTex([3, 1]), roughness: 0.35, metalness: 0.3 }), m('#2a2624'), m('#2a2624'), m('#2a2624')]);
    top.position.set(0, 0.87, 0);
    gr.add(top);
    // grease trough at the front and splash guard at the back
    this.box(2.4, 0.04, 0.08, m('#3b2a18', 0.3), 0, 0.88, 0.44, gr);
    this.box(2.4, 0.3, 0.04, steel, 0, 1.05, -0.42, gr);
    this.box(0.04, 0.15, 0.85, steel, -1.2, 0.97, 0, gr);
    this.box(0.04, 0.15, 0.85, steel, 1.2, 0.97, 0, gr);
    for (let i = 0; i < 4; i++) {
      const k = this.cyl(0.035, 0.035, 0.03, m('#111111', 0.5), -0.9 + i * 0.6, 0.6, 0.43, 8, gr);
      k.rotation.x = Math.PI / 2;
    }
    this.add(gr);
    this.interactive(gr, { kind: 'bgGrill' });
    this.solid(-5.0, -9.5, 2.4, 0.85, 0.95, false, 'station');
    for (let i = 0; i < 4; i++) this.grillSlots.push(new THREE.Vector3(-5.0 + (i - 1.5) * 0.56, 0.9, -9.4));
    // a spatula resting on the grill edge and a squeeze bottle of "oil"
    this.model('bg_spatula', -3.95, 0.92, -9.15, 0.6);
    this.model('bg_oil', -6.05, 0.9, -9.75);
    // grill timer display on the hood
    const gp = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.42), new THREE.MeshBasicMaterial({ map: this.grillPanel.tex }));
    gp.position.set(-5.0, 2.42, -8.73);
    this.add(gp);

    // patty chiller drawer next to the grill
    const ch = new THREE.Group();
    ch.position.set(-3.25, 0, -9.5);
    this.box(0.8, 0.86, 0.8, steel, 0, 0.43, 0, ch);
    for (const y of [0.25, 0.62]) {
      this.box(0.72, 0.32, 0.02, m('#c3c8cc', 0.35, { metalness: 0.5 }), 0, y, 0.41, ch);
      this.box(0.4, 0.03, 0.04, m('#1c1c1c', 0.6), 0, y + 0.1, 0.44, ch);
    }
    this.box(0.82, 0.04, 0.82, m('#8d9296', 0.35, { metalness: 0.5 }), 0, 0.88, 0, ch);
    for (let i = 0; i < 5; i++) {
      const p = pieceMesh({ ing: 'PATTY', q: 'raw' });
      p.scale.setScalar(1.3);
      p.position.set(-0.12 + (i % 2) * 0.2, 0.9 + Math.floor(i / 2) * 0.045, -0.05 + (i % 3) * 0.05);
      ch.add(p);
    }
    this.add(ch);
    this.interactive(ch, { kind: 'bgPattyBox' });
    this.solid(-3.25, -9.5, 0.8, 0.8, 0.9, false, 'station');
    this.pixSign(['PATTIES', 'frozen since 2069'], 0.7, 0.3, -3.25, 0.62, -9.08, 0, '#7a2416', '#f2d24b');
  }

  private hood(): void {
    const steel = new THREE.MeshStandardMaterial({ map: steelTex([6, 1]), roughness: 0.4, metalness: 0.5 });
    const x0 = -10.1;
    const x1 = -2.8;
    const cx = (x0 + x1) / 2;
    const w = x1 - x0;
    this.box(w, 0.6, 1.25, steel, cx, 2.45, -9.38);
    const lip = this.box(w, 0.12, 0.3, steel, cx, 2.12, -8.82);
    lip.rotation.x = 0.5;
    // grease drips on the hood edge
    const grease = m('#5a3a10', 0.25);
    for (let i = 0; i < 14; i++) this.box(0.03, 0.05 + (i % 4) * 0.04, 0.02, grease, x0 + 0.3 + i * 0.5, 2.08 - (i % 4) * 0.02, -8.7);
    // under-hood lights
    const lampMat = new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffd890', emissiveIntensity: 1.3 });
    for (const x of [-8.6, -6.4, -4.2]) this.box(0.5, 0.03, 0.2, lampMat, x, 2.14, -9.4);
    const hl = new THREE.PointLight('#ffb35c', 5, 5, 1.6);
    hl.position.set(-6.4, 1.9, -9.2);
    this.add(hl);
    // ducts into the ceiling
    for (const x of [-8.4, -4.5]) {
      this.box(0.6, H - 2.75, 0.6, steel, x, (H + 2.75) / 2, -9.6);
    }
    this.pixSign(['CAUTION: HOT', 'and also: greasy'], 1.4, 0.32, -9.5, 2.45, -8.74, 0, '#e0b21b', '#1d1b17');
    // ansul fire nozzles (decoration, the sprinklers are elsewhere)
    for (const x of [-8.0, -5.0]) this.cyl(0.03, 0.02, 0.1, m('#c9a43a', 0.3, { metalness: 0.8 }), x, 2.1, -9.6, 6);
  }

  private backWall(): void {
    const steel = new THREE.MeshStandardMaterial({ map: steelTex([2, 1]), roughness: 0.4, metalness: 0.4 });
    // extinguisher bracket and the extinguisher
    this.box(0.2, 0.05, 0.12, m('#1c1c1c', 0.5), -2.25, 0.72, -9.93);
    const ext = new Item(EXTINGUISHER_DEF);
    ext.state = 'fixed';
    ext.mesh.position.set(-2.25, 0.75, -9.86);
    this.scene.add(ext.mesh);
    this.initialItems.push(ext);
    this.pixSign(['FIRE', 'EXTINGUISHER', 'refills deducted', 'from your pay'], 0.6, 0.55, -2.25, 1.7, -9.98, 0, '#c0201a', '#ffffff');

    // handwash sink
    const sink = new THREE.Group();
    sink.position.set(-1.1, 0, -9.65);
    this.box(0.7, 0.8, 0.55, steel, 0, 0.4, 0, sink);
    this.box(0.5, 0.06, 0.35, m('#55595c', 0.3, { metalness: 0.6 }), 0, 0.81, 0, sink);
    const tap = this.cyl(0.02, 0.02, 0.25, m('#c9cfd3', 0.3, { metalness: 0.8 }), 0, 0.95, -0.2, 6, sink);
    tap.rotation.x = 0.5;
    this.box(0.18, 0.28, 0.1, m('#e8e8e0', 0.5), 0.45, 1.3, -0.25, sink);
    this.box(0.1, 0.16, 0.08, m('#7ac4d8', 0.4), -0.35, 1.15, -0.25, sink);
    this.add(sink);
    this.interactive(sink, { kind: 'bgSink' });
    this.solid(-1.1, -9.65, 0.7, 0.55, 0.85, false, 'station');
    this.pixSign(['EMPLOYEES MUST', 'WASH HANDS', 'washing is unpaid'], 0.8, 0.5, -1.1, 1.75, -9.98, 0, '#ffffff', '#2c64b4');

    // wire racks with supplies
    const wire = m('#b8c2c8', 0.4, { metalness: 0.6 });
    const rx = 1.9;
    const rw = 3.4;
    for (const y of [0.15, 0.75, 1.35, 1.95]) {
      this.box(rw, 0.03, 0.55, wire, rx, y, -9.65);
      let k = 0;
      for (let x = rx - rw / 2 + 0.3; x < rx + rw / 2 - 0.2; x += 0.48) {
        k++;
        const v = (k + Math.round(y * 7)) % 5;
        if (v === 0) {
          // stacked cups
          for (let c = 0; c < 4; c++) this.cyl(0.07, 0.05, 0.1, m('#f2f2ea', 0.5), x, y + 0.07 + c * 0.04, -9.65, 8);
        } else if (v === 1 && y > 0.5) {
          // bun bags
          const bag = this.box(0.4, 0.2, 0.3, m('#e9d6a6', 0.7, { transparent: true, opacity: 0.9 }), x, y + 0.12, -9.65);
          bag.rotation.y = 0.1;
          for (const dx of [-0.1, 0.1]) {
            const bn = this.cyl(0.08, 0.08, 0.06, m('#d99a4e', 0.8), x + dx, y + 0.06, -9.65, 8);
            bn.scale.y = 1;
          }
        } else if (v === 2) {
          this.model('bg_barrelSmall', x, y + 0.02, -9.65) ?? this.cyl(0.15, 0.15, 0.35, m('#6e4a14', 0.5), x, y + 0.2, -9.65);
        } else {
          const bb = this.box(0.42, 0.3 + (k % 2) * 0.12, 0.42, boxMaterials(k % 7), x, y + 0.18 + (k % 2) * 0.06, -9.65);
          bb.rotation.y = (k % 3) * 0.1;
        }
      }
    }
    for (const x of [rx - rw / 2, rx + rw / 2]) for (const z of [-9.92, -9.38]) this.box(0.03, 2.1, 0.03, wire, x, 1.05, z);
    this.solid(rx, -9.65, rw, 0.6, 2.1, true, 'rack');

    // fridges
    let fr = 0;
    for (const x of [4.3, 5.4]) if (this.model('bg_fridgeL', x, 0, -9.55)) fr++;
    if (!fr) for (const x of [4.3, 5.4]) this.box(1.0, 2.0, 0.8, m('#e9ecef', 0.4), x, 1.0, -9.55);
    this.solid(4.85, -9.55, 2.2, 0.85, 2.0, true, 'fridge');
    this.pixSign(['DO NOT OPEN', 'contains feelings'], 0.7, 0.3, 4.3, 1.6, -9.1, 0, '#ffffff', '#c0392b');

    // dish pit: triple sink with towers of pans
    const dp = new THREE.Group();
    dp.position.set(8.0, 0, -9.6);
    this.box(2.2, 0.85, 0.65, steel, 0, 0.425, 0, dp);
    for (const dx of [-0.7, 0, 0.7]) this.box(0.6, 0.05, 0.5, m('#4a4e52', 0.3, { metalness: 0.6 }), dx, 0.86, 0, dp);
    for (let i = 0; i < 5; i++) {
      const pan = this.model('bg_pan', -0.7 + (i % 2) * 0.1, 0.9 + i * 0.05, (i % 3) * 0.05, i * 0.7, dp);
      if (!pan) this.cyl(0.18, 0.15, 0.05, m('#2a2a2a', 0.4), -0.7, 0.9 + i * 0.06, 0, 10, dp);
    }
    this.model('bg_pot', 0.0, 0.88, 0, 0, dp);
    this.model('bg_pot', 0.05, 1.1, 0.02, 1, dp);
    for (let i = 0; i < 6; i++) {
      const plate = this.cyl(0.12, 0.12, 0.015, m('#f2f2ea', 0.4), 0.7, 0.9 + i * 0.018, 0, 12, dp);
      plate.rotation.z = (i % 2) * 0.05;
    }
    this.cyl(0.02, 0.02, 0.4, m('#c9cfd3', 0.3, { metalness: 0.8 }), 0, 1.15, -0.28, 6, dp);
    this.add(dp);
    this.solid(8.0, -9.6, 2.2, 0.65, 0.9, false, 'station');
    this.pixSign(['DISHES', 'are a lifestyle'], 0.9, 0.35, 8.0, 1.7, -9.98, 0, '#2c64b4', '#ffffff');
    // pot rack on the wall
    this.box(2.4, 0.05, 0.05, m('#3a3a3a', 0.5, { metalness: 0.6 }), 8.0, 2.4, -9.85);
    for (let i = 0; i < 5; i++) this.model('bg_pan', 7.0 + i * 0.5, 1.95, -9.85, Math.PI / 2);

    // mop sink, mop and bucket
    this.box(0.8, 0.4, 0.6, m('#c9c4b4', 0.6), 10.5, 0.2, -9.6);
    this.solid(10.5, -9.6, 0.8, 0.6, 0.4, false);
    // mop and bucket (picked up and moved by the mischief module, so no collider)
    const yellow = m('#d9a400', 0.5);
    const mop = new THREE.Group();
    mop.position.set(11.4, 0, -9.4);
    this.cyl(0.22, 0.18, 0.38, yellow, 0, 0.19, 0, 10, mop);
    const stick = this.cyl(0.02, 0.02, 1.5, m('#8a6b45', 0.7), 0.1, 0.85, 0.05, 5, mop);
    stick.rotation.z = 0.25;
    this.add(mop);
    this.mopBucket = mop;
    // emergency exit
    this.box(1.1, 2.15, 0.06, m('#7f8c8d', 0.4, { metalness: 0.5 }), 12.8, 1.08, -9.97);
    this.box(0.9, 0.06, 0.08, m('#c0392b', 0.4), 12.8, 1.05, -9.9);
    this.glowSign(['EXIT'], 0.6, 0.22, 12.8, 2.4, -9.96, 0, '#1a6b2a', '#ffffff');
    this.pixSign(['EMERGENCY EXIT', 'alarm will sound', 'Brad will also sound'], 1.1, 0.5, 12.8, 1.5, -9.92, 0, '#ffffff', '#c0392b');
  }

  // ---------------------------------------------------------------- assembly island and ticket rail

  private island(): void {
    const cx = -4.0;
    const cz = -5.7;
    const w = 4.4;
    const d = 1.0;
    const steel = new THREE.MeshStandardMaterial({ map: steelTex([4, 1]), roughness: 0.35, metalness: 0.4 });
    this.box(w, 0.08, d, steel, cx, 0.91, cz);
    for (const x of [cx - w / 2 + 0.1, cx + w / 2 - 0.1]) for (const z of [cz - d / 2 + 0.1, cz + d / 2 - 0.1]) this.box(0.06, 0.88, 0.06, steel, x, 0.44, z);
    this.box(w - 0.1, 0.03, d - 0.1, steel, cx, 0.3, cz);
    this.solid(cx, cz, w, d, 0.95, false, 'island');
    // stuff on the lower shelf
    for (let i = 0; i < 5; i++) {
      const b = this.box(0.45, 0.3, 0.4, boxMaterials((i * 3) % 7), cx - 1.8 + i * 0.85, 0.47, cz + (i % 2) * 0.15 - 0.08);
      b.rotation.y = i * 0.2;
    }

    // ingredient bins along the south half
    const bins: [Ing, number][] = [['BUN', -5.3], ['CHEESE', -4.65], ['LETTUCE', -4.0], ['TOMATO', -3.35], ['ONION', -2.7]];
    const pan = m('#9aa0a4', 0.3, { metalness: 0.6 });
    for (const [ing, x] of bins) {
      const g = new THREE.Group();
      g.position.set(x, 0.95, cz + 0.25);
      this.box(0.56, 0.1, 0.36, pan, 0, 0.0, 0, g);
      this.box(0.52, 0.02, 0.32, m('#2a2a2a', 0.6), 0, 0.045, 0, g);
      for (let i = 0; i < 6; i++) {
        const p = pieceMesh({ ing }, ing === 'BUN' && i % 2 === 1);
        p.position.set(-0.16 + (i % 3) * 0.16, 0.05 + Math.floor(i / 3) * 0.03, (Math.floor(i / 3) - 0.5) * 0.1);
        p.rotation.y = i * 0.9;
        p.scale.setScalar(0.85);
        g.add(p);
      }
      const lab = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.1),
        new THREE.MeshBasicMaterial({ map: (() => {
          const t = textTexture([ing], { w: 128, h: 26, bg: '#1d1712', fg: '#f0b43c', font: PX });
          t.magFilter = THREE.NearestFilter;
          return t;
        })() }),
      );
      lab.position.set(0, -0.02, -0.185);
      lab.rotation.y = Math.PI;
      g.add(lab);
      const lab2 = lab.clone();
      lab2.position.z = 0.185;
      lab2.rotation.y = 0;
      g.add(lab2);
      this.add(g);
      this.interactive(g, { kind: 'bgBin', ing });
    }
    // tray mat on the north half
    const mat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.01, 0.44), m('#3c7a3a', 0.8));
    mat.position.set(this.trayMat.x, 0.952, this.trayMat.z);
    this.add(mat);
    this.interactive(mat, { kind: 'bgTrayMat' });
    this.pixSign(['BUILD HERE'], 0.5, 0.1, this.trayMat.x, 0.958, this.trayMat.z - 0.26, 0, '#3c7a3a', '#e8f2d0').rotation.x = -Math.PI / 2;
    // sauce bottles and a tray stack at the ends
    this.model('bg_ketchup', -5.95, 0.95, -5.95) ?? this.cyl(0.04, 0.04, 0.2, m('#c0201a'), -5.95, 1.05, -5.95);
    this.model('bg_mustard', -5.85, 0.95, -5.75) ?? this.cyl(0.04, 0.04, 0.2, m('#e0b21b'), -5.85, 1.05, -5.75);
    this.model('bg_ketchup', -6.05, 0.95, -5.6, 1);
    for (let i = 0; i < 7; i++) this.box(0.46, 0.014, 0.34, m('#7a2a1c', 0.5), -2.1, 0.96 + i * 0.016, -5.95 + (i % 2) * 0.01);
    this.pixSign(['TRAYS'], 0.3, 0.08, -2.1, 1.1, -6.13, Math.PI, '#7a2a1c', '#f3e6c8');
    this.model('bg_board', -2.15, 0.95, -5.45, 0.2);
    this.model('bg_knife', -2.15, 0.97, -5.45, 0.5);

    // ticket rail on the south edge, facing the cook
    const railBar = m('#c9cfd3', 0.3, { metalness: 0.8 });
    this.box(4.0, 0.03, 0.05, railBar, cx, 1.72, cz + 0.48);
    for (const x of [cx - 2.0, cx + 2.0]) this.box(0.03, 0.8, 0.03, railBar, x, 1.32, cz + 0.48);
    const railPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 0.48), new THREE.MeshBasicMaterial({ map: this.rail.tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    railPlane.position.set(cx, 1.46, cz + 0.47);
    railPlane.rotation.y = Math.PI;
    this.add(railPlane);
    // heat lamp bar above the island
    const lampHouse = m('#7a2416', 0.5);
    this.box(3.6, 0.1, 0.2, lampHouse, cx, 2.2, cz);
    for (const x of [cx - 1.2, cx + 1.2]) this.cyl(0.01, 0.01, H - 2.2, m('#3a3a3a', 0.5), x, (H + 2.2) / 2, cz, 4);
    this.box(3.4, 0.02, 0.12, new THREE.MeshStandardMaterial({ color: '#ff9050', emissive: '#ff6a2a', emissiveIntensity: 1.5 }), cx, 2.14, cz);
    const heat = new THREE.PointLight('#ff9a50', 7, 4, 1.5);
    heat.position.set(cx, 2.0, cz);
    this.add(heat);
    this.heatLamps.push(heat);
  }

  // ---------------------------------------------------------------- along the partition, kitchen side

  private partitionKitchenSide(): void {
    const steel = new THREE.MeshStandardMaterial({ map: steelTex([2, 1]), roughness: 0.4, metalness: 0.4 });
    const pz = PART_Z - 0.48;

    // pass-through counter
    const counter = new THREE.Group();
    this.box(5.0, 1.05, 0.5, new THREE.MeshStandardMaterial({ map: woodPanelTex([5, 1]), roughness: 0.7 }), 0, 0.525, PART_Z + 0.05, counter);
    this.box(5.1, 0.06, 1.0, steel, 0, 1.08, PART_Z, counter);
    this.add(counter);
    this.interactive(counter, { kind: 'bgPass' });
    this.solid(0, PART_Z, 5.0, 1.0, 1.1, false, 'pass');
    // heat lamps over the pass
    this.box(4.6, 0.08, 0.25, m('#7a2416', 0.5), 0, 1.98, PART_Z - 0.2);
    this.box(4.4, 0.02, 0.15, new THREE.MeshStandardMaterial({ color: '#ff9050', emissive: '#ff6a2a', emissiveIntensity: 1.5 }), 0, 1.93, PART_Z - 0.2);
    const heat = new THREE.PointLight('#ff9a50', 6, 3.5, 1.5);
    heat.position.set(0, 1.7, PART_Z);
    this.add(heat);
    this.heatLamps.push(heat);
    this.pixSign(['ORDER UP'], 1.2, 0.22, 0, 2.2, PART_Z - 0.13, Math.PI, '#1d1712', '#f0b43c');
    this.pixSign(['PICK UP HERE', 'order here too'], 2.2, 0.36, 0, 2.28, PART_Z + 0.13, 0, '#f7d23e', '#7a2416');
    this.model('register', -1.7, 1.11, PART_Z + 0.15);
    this.box(0.3, 0.25, 0.25, m('#2a2a2a', 0.5), 1.8, 1.24, PART_Z - 0.1);
    this.pixSign(['PRINTER', 'jammed'], 0.28, 0.14, 1.8, 1.25, PART_Z - 0.226, Math.PI, '#ffffff', '#2a2a2a');

    // nugget warmer under its own heat lamp
    const nw = new THREE.Group();
    nw.position.set(-5.6, 0, pz + 0.1);
    this.box(1.4, 0.95, 0.6, steel, 0, 0.475, 0, nw);
    this.box(1.3, 0.04, 0.5, m('#3a3a3a', 0.4), 0, 0.96, 0, nw);
    for (let i = 0; i < 6; i++) {
      const b = nuggetMesh();
      b.position.set(-0.45 + (i % 3) * 0.45, 0.98 + Math.floor(i / 3) * 0.06, -0.1 + Math.floor(i / 3) * 0.18);
      b.rotation.y = (i % 2) * 0.3;
      nw.add(b);
    }
    this.box(1.4, 0.06, 0.4, m('#7a2416', 0.5), 0, 1.75, 0.0, nw);
    this.box(1.2, 0.02, 0.2, new THREE.MeshStandardMaterial({ color: '#ff6a3a', emissive: '#ff4a1a', emissiveIntensity: 1.8 }), 0, 1.71, 0, nw);
    for (const x of [-0.65, 0.65]) this.box(0.03, 0.75, 0.03, steel, x, 1.35, 0.1, nw);
    this.add(nw);
    this.interactive(nw, { kind: 'bgNuggets' });
    this.solid(-5.6, pz + 0.1, 1.4, 0.6, 1.0, false, 'station');
    const nl = new THREE.PointLight('#ff6a3a', 5, 3, 1.5);
    nl.position.set(-5.6, 1.5, pz);
    this.add(nl);
    this.heatLamps.push(nl);
    this.pixSign(['NUGGETS', 'warm since Tuesday'], 1.0, 0.32, -5.6, 2.1, PART_Z - 0.13, Math.PI, '#e0b21b', '#7a2416');

    // Brad's charging dock and the manager desk
    const desk = new THREE.Group();
    desk.position.set(-11.6, 0, pz + 0.05);
    this.box(2.0, 0.06, 0.75, m('#6b4a2c', 0.7), 0, 0.76, 0, desk);
    for (const x of [-0.95, 0.95]) this.box(0.05, 0.75, 0.7, m('#4a3320', 0.7), x, 0.38, 0, desk);
    this.add(desk);
    this.solid(-11.6, pz + 0.05, 2.0, 0.75, 0.8, false, 'desk');
    const screen = this.model('bg_screen', -11.9, 0.79, pz + 0.15, Math.PI);
    if (!screen) this.box(0.5, 0.4, 0.3, m('#d8d2c0', 0.6), -11.9, 1.0, pz + 0.15);
    this.glowSign(['PRODUCTIVITY', '3%'], 0.42, 0.26, -11.9, 1.08, pz - 0.0, Math.PI, '#0a2a10', '#5aff7a');
    this.model('bg_radio', -11.0, 0.79, pz + 0.1, Math.PI);
    for (let i = 0; i < 4; i++) {
      const paper = this.box(0.22, 0.005, 0.3, m('#f2efe4', 0.9), -11.3 + i * 0.05, 0.795 + i * 0.006, pz + 0.05 + i * 0.03);
      paper.rotation.y = i * 0.3;
    }
    const dock = new THREE.Group();
    dock.position.set(-9.6, 0, pz + 0.1);
    this.box(0.7, 1.4, 0.4, m('#2a2f36', 0.5, { metalness: 0.4 }), 0, 0.7, 0, dock);
    this.box(0.5, 0.06, 0.06, new THREE.MeshStandardMaterial({ color: '#5aff7a', emissive: '#2aff5a', emissiveIntensity: 1.2 }), 0, 1.2, -0.21, dock);
    this.add(dock);
    this.solid(-9.6, pz + 0.1, 0.7, 0.4, 1.4, false);
    this.interactive(dock, { kind: 'sign', text: "BRAD'S CHARGING DOCK. Do not touch. Do not look. Do not plug your phone in. Brad will know." });
    this.pixSign(["BRAD'S DOCK", 'do not touch'], 0.7, 0.3, -9.6, 1.75, PART_Z - 0.13, Math.PI, '#1d1712', '#5aff7a');
    this.model('bg_coatRack', -13.4, 0, pz + 0.05);
    this.pixSign(['MANAGER OFFICE', '(it is a desk)'], 1.4, 0.4, -11.6, 2.1, PART_Z - 0.13, Math.PI, '#ffffff', '#7a2416');

    // soda fountain
    const soda = new THREE.Group();
    soda.position.set(3.4, 0, pz + 0.1);
    this.box(1.2, 0.95, 0.6, steel, 0, 0.475, 0, soda);
    this.box(1.0, 0.7, 0.5, m('#2a2f36', 0.4, { metalness: 0.4 }), 0, 1.3, -0.02, soda);
    for (let i = 0; i < 6; i++) {
      this.box(0.08, 0.1, 0.08, m('#c9cfd3', 0.3, { metalness: 0.7 }), -0.4 + i * 0.16, 0.98, 0.15, soda);
      this.box(0.14, 0.16, 0.01, m(['#c0392b', '#2c64b4', '#e0b21b', '#27ae60', '#8e44ad', '#ff6fb5'][i], 0.5), -0.4 + i * 0.16, 1.5, 0.235, soda);
    }
    for (let c = 0; c < 5; c++) this.cyl(0.06, 0.045, 0.14, m('#f2f2ea', 0.5), 0.45, 1.02 + c * 0.03, -0.15, 8, soda);
    this.add(soda);
    this.solid(3.4, pz + 0.1, 1.2, 0.6, 1.7, false, 'station');
    this.interactive(soda, { kind: 'sign', text: 'SODA FOUNTAIN. Requires a FizzPass subscription. Water is also on subscription.' });
    this.pixSign(['FIZZ', 'subscription only'], 0.9, 0.3, 3.4, 2.05, PART_Z - 0.13, Math.PI, '#2c64b4', '#ffffff');

    // the broken ice cream machine
    const ice = new THREE.Group();
    ice.position.set(4.95, 0, pz + 0.1);
    const iceSteel = new THREE.MeshStandardMaterial({ map: steelTex([1, 2]), roughness: 0.3, metalness: 0.5 });
    this.box(0.9, 0.8, 0.65, iceSteel, 0, 0.4, 0, ice);
    this.box(0.85, 0.95, 0.6, iceSteel, 0, 1.28, -0.02, ice);
    this.box(0.86, 0.05, 0.62, m('#c0392b', 0.4), 0, 1.78, -0.02, ice);
    for (const x of [-0.22, 0.22]) {
      this.box(0.12, 0.14, 0.12, m('#d8dde0', 0.3, { metalness: 0.6 }), x, 0.98, 0.2, ice);
      this.cyl(0.03, 0.015, 0.08, m('#d8dde0', 0.3, { metalness: 0.6 }), x, 0.87, 0.22, 6, ice);
      const lever = this.box(0.03, 0.18, 0.03, m('#1c1c1c', 0.5), x, 1.1, 0.29, ice);
      lever.rotation.x = 0.4;
    }
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshBasicMaterial({ map: this.iceScreen.tex }));
    scr.position.set(0, 1.5, 0.285);
    ice.add(scr);
    const tape = this.pixSign(['OUT OF ORDER'], 0.6, 0.16, 0, 0, 0, 0, '#f7f2dc', '#c0392b');
    tape.position.set(0, 1.25, 0.29);
    tape.rotation.set(0, 0, 0.12);
    this.scene.remove(tape);
    ice.add(tape);
    const tray = this.box(0.6, 0.02, 0.2, m('#9aa0a4', 0.3, { metalness: 0.6 }), 0, 0.81, 0.28, ice);
    tray.rotation.x = 0.05;
    this.model('bg_cone', 0.22, 0.82, 0.3, 0, ice);
    this.add(ice);
    this.interactive(ice, { kind: 'bgIceCream' });
    this.solid(4.95, pz + 0.1, 0.9, 0.65, 1.8, false, 'station');
    this.pixSign(['SOFT SERVE', 'since 2041: no'], 0.9, 0.3, 4.95, 2.12, PART_Z - 0.13, Math.PI, '#ff6fb5', '#ffffff');

    // cabinets with small appliances up to the staff door
    const cab = new THREE.Group();
    cab.position.set(7.4, 0, pz + 0.12);
    this.box(2.6, 0.9, 0.55, new THREE.MeshStandardMaterial({ map: steelTex([3, 1]), roughness: 0.4, metalness: 0.3 }), 0, 0.45, 0, cab);
    this.box(2.65, 0.05, 0.6, m('#8d9296', 0.35, { metalness: 0.5 }), 0, 0.92, 0, cab);
    this.add(cab);
    this.solid(7.4, pz + 0.12, 2.6, 0.6, 0.95, false, 'station');
    this.model('bg_micro', 6.5, 0.95, pz + 0.15, Math.PI);
    this.model('bg_toaster', 7.3, 0.95, pz + 0.12, Math.PI);
    this.model('bg_blender', 7.9, 0.95, pz + 0.15, Math.PI);
    this.model('bg_cheeseWheel', 8.4, 0.95, pz + 0.1, 0.3);
    for (let i = 0; i < 3; i++) this.box(0.3, 0.25, 0.3, boxMaterials(i + 2), 6.7 + i * 0.6, 1.08 + (i % 2) * 0, pz + 0.05).rotation.y = i * 0.2;
    // trash bins and a coat rack near the staff door
    this.trashBin(11.3, pz + 0.05, 'TRASH');
    this.trashBin(12.0, pz + 0.05, 'ALSO TRASH');
    this.pile(13.3, pz - 0.1, 1.0, 0.8, 3, 77);
    this.pixSign(['CUSTOMER TOILET', 'staff may use it', 'with the key'], 1.3, 0.55, 12.2, 1.85, PART_Z - 0.13, Math.PI, '#ffffff', '#2c64b4');
  }

  private trashBin(x: number, z: number, label: string): void {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    this.cyl(0.27, 0.23, 0.8, m('#3f4a3c', 0.7), 0, 0.4, 0, 12, g);
    this.cyl(0.29, 0.29, 0.05, m('#2b3329', 0.7), 0, 0.81, 0, 12, g);
    this.box(0.3, 0.02, 0.2, m('#f2efe4', 0.9), 0.05, 0.84, 0.05, g);
    this.add(g);
    this.interactive(g, { kind: 'bgTrash' });
    this.solid(x, z, 0.56, 0.56, 0.85, false, 'trash');
    this.pixSign([label], 0.36, 0.12, x, 0.55, z + 0.27, 0, '#2b3329', '#f3e6c8');
  }

  // ---------------------------------------------------------------- drive-thru

  private driveThru(): void {
    const steel = new THREE.MeshStandardMaterial({ map: steelTex([1, 2]), roughness: 0.4, metalness: 0.4 });
    // window frame and sliding glass
    const frame = m('#3a3a3a', 0.4, { metalness: 0.6 });
    this.box(0.1, 0.06, 2.0, frame, 14.0, 1.0, -4.0);
    this.box(0.1, 0.06, 2.0, frame, 14.0, 2.1, -4.0);
    for (const z of [-5.0, -3.0, -4.0]) this.box(0.1, 1.1, 0.06, frame, 14.0, 1.55, z);
    this.glass(0.95, 1.05, 14.03, 1.55, -4.5, Math.PI / 2);
    // counter under the window
    const counter = new THREE.Group();
    counter.position.set(13.5, 0, -4.0);
    this.box(0.9, 0.98, 2.4, steel, 0, 0.49, 0, counter);
    this.box(0.95, 0.04, 2.45, m('#8d9296', 0.35, { metalness: 0.5 }), 0, 1.0, 0, counter);
    // bag stack
    for (let i = 0; i < 6; i++) this.box(0.22, 0.02, 0.14, m('#c8a165', 0.9), 0.0, 1.03 + i * 0.02, 0.85);
    this.model('bg_styro', 0.05, 1.02, -0.8, 0.4, counter);
    this.add(counter);
    this.interactive(counter, { kind: 'bgDrive' });
    this.solid(13.5, -4.0, 0.9, 2.4, 1.0, false, 'drive');
    // straws and napkins
    this.box(0.12, 0.25, 0.12, m('#e8e8e0', 0.6), 13.3, 1.13, -5.0);
    for (let i = 0; i < 8; i++) this.cyl(0.004, 0.004, 0.25, m(['#c0392b', '#ffffff'][i % 2], 0.6), 13.28 + (i % 3) * 0.02, 1.2, -5.0 + Math.floor(i / 3) * 0.02, 4);
    // the speaker box with the headset
    const sp = new THREE.Group();
    sp.position.set(13.9, 1.55, -5.75);
    this.box(0.16, 0.5, 0.4, m('#2a2f36', 0.5, { metalness: 0.4 }), 0, 0, 0, sp);
    for (let i = 0; i < 5; i++) this.box(0.01, 0.02, 0.3, m('#111111', 0.6), -0.085, 0.12 - i * 0.05, 0, sp);
    this.speakerLed = new THREE.MeshStandardMaterial({ color: '#ff3020', emissive: '#ff2010', emissiveIntensity: 0.2 });
    this.box(0.02, 0.05, 0.05, this.speakerLed, -0.09, 0.2, 0.12, sp);
    const head = this.cyl(0.07, 0.07, 0.03, m('#1c1c1c', 0.5), -0.12, -0.15, -0.1, 8, sp);
    head.rotation.z = Math.PI / 2;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.01, 4, 10, Math.PI), m('#1c1c1c', 0.5));
    band.position.set(-0.12, -0.15, 0.0);
    band.rotation.y = Math.PI / 2;
    sp.add(band);
    this.add(sp);
    this.interactive(sp, { kind: 'bgSpeaker' });
    this.pixSign(['DRIVE-THRU', 'SPEAKER', 'audio: 4 bit'], 0.5, 0.32, 13.97, 2.05, -5.75, -Math.PI / 2, '#1d1712', '#f0b43c');
    const ds = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: this.driveSign.tex }));
    ds.position.set(13.97, 2.4, -4.0);
    ds.rotation.y = -Math.PI / 2;
    this.add(ds);
    const dl = new THREE.PointLight('#fff0d2', 6, 5, 1.6);
    dl.position.set(13.0, 2.6, -4.0);
    this.add(dl);
    // timer clock above the window
    this.pixSign(['GOAL: 90 SEC', 'record: 4 hours'], 0.9, 0.3, 13.97, 1.45, -2.4, -Math.PI / 2, '#c0392b', '#ffffff');
    // outside: awning over the window
    this.box(1.2, 0.08, 2.6, m('#c0392b', 0.6), 14.8, 2.5, -4.0);
    this.box(1.1, 0.1, 0.06, m('#f7d23e', 0.6), 15.38, 2.46, -4.0);
    // storage shelf on the east wall
    this.pile(13.55, -8.2, 0.8, 1.8, 3, 91);
    this.pile(13.55, -0.6, 0.8, 1.6, 2, 92);
  }

  // ---------------------------------------------------------------- dining room

  private table(x: number, z: number, critic = false): void {
    const vinyl = new THREE.MeshStandardMaterial({ map: vinylTex([2, 1]), roughness: 0.5 });
    const top = m(critic ? '#f4f0e6' : '#e8dcc0', 0.5);
    this.box(1.2, 0.05, 0.75, top, x, 0.76, z);
    this.box(1.24, 0.03, 0.79, m('#b03a2e', 0.5), x, 0.74, z);
    this.cyl(0.06, 0.06, 0.72, m('#3a3a3a', 0.4, { metalness: 0.6 }), x, 0.37, z, 8);
    this.cyl(0.28, 0.3, 0.03, m('#3a3a3a', 0.4, { metalness: 0.6 }), x, 0.015, z, 10);
    for (const s of [-1, 1]) {
      this.box(1.3, 0.12, 0.45, vinyl, x, 0.42, z + s * 0.72);
      this.box(1.3, 0.4, 0.12, m('#6b3d22', 0.7), x, 0.18, z + s * 0.72);
      this.box(1.3, 0.55, 0.12, vinyl, x, 0.75, z + s * 0.92);
    }
    this.solid(x, z, 1.35, 2.0, 0.9, false, 'table');
    // stuff on the table
    if (critic) {
      this.cyl(0.02, 0.02, 0.12, m('#f4f0e6', 0.6), x + 0.3, 0.84, z, 6);
      this.box(0.015, 0.03, 0.015, new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff9020', emissiveIntensity: 2 }), x + 0.3, 0.915, z);
      this.pixSign(['RESERVED', 'CRITIC-9000'], 0.3, 0.16, x - 0.3, 0.87, z, Math.PI / 2, '#1d1712', '#f0b43c');
      this.box(0.18, 0.01, 0.24, m('#f2efe4', 0.9), x, 0.79, z - 0.15);
    } else {
      const k = Math.abs(Math.round(x * 3 + z * 5));
      if (k % 3 === 0) this.model('bg_burger', x - 0.2, 0.79, z + 0.1, k);
      if (k % 3 === 1) this.model('bg_friesBox', x + 0.25, 0.79, z - 0.1, k);
      if (k % 2 === 0) this.model('bg_soda', x + 0.35, 0.79, z + 0.15);
      if (k % 4 === 1) this.model('bg_canCrushed', x - 0.4, 0.79, z - 0.2, k);
      this.box(0.08, 0.1, 0.06, m('#d8d2c0', 0.7), x, 0.84, z + 0.25);
      this.model('bg_salt', x + 0.1, 0.79, z + 0.25);
    }
  }

  private dining(): void {
    // menu boards on the dining face of the partition
    const mbL = menuBoardTex('MEGA MENU', [
      ['CLASSIC BYTE', '4.99'],
      ['CHEESE BYTE', '5.49'],
      ['THE ANALOG (real food*)', '9.99'],
      ['DOUBLE DOWNLOAD', '7.99'],
      ['THE RECURSION', '8.88'],
    ], '#f7d23e');
    const mbR = menuBoardTex('MORE MENU', [
      ['THE ONION ROUTER', '6.66'],
      ['SALAD (IRONIC)', '3.50'],
      ['FRIES (3% potato)', '2.99'],
      ['40 NUGGETS', '40.00'],
      ['SOFT SERVE (broken)', 'N/A'],
    ], '#e8604a');
    for (const [tex, x] of [[mbL, -4.6], [mbR, 4.6]] as [THREE.CanvasTexture, number][]) {
      const board = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.1), new THREE.MeshBasicMaterial({ map: tex }));
      board.position.set(x, 1.85, PART_Z + 0.16);
      this.add(board);
      this.box(3.4, 1.2, 0.04, m('#1d1712', 0.5), x, 1.85, PART_Z + 0.14);
      board.userData.interact = { kind: 'sign', text: '*Real food not guaranteed. Prices in human currency. Robots pay in exposure.' } satisfies Interact;
      this.interactables.push(board);
    }
    this.glowSign(['MEGABYTE BURGER', 'Branch 404: menu not found'], 5, 0.5, 0, 2.95, PART_Z + 0.25, 0, '#c0392b', '#f7d23e', '#f7d23e');
    this.box(5.1, 0.6, 0.06, m('#1d1712', 0.5), 0, 2.95, PART_Z + 0.21);
    for (const x of [-2.3, 2.3]) this.cyl(0.01, 0.01, H - 3.25, m('#3a3a3a'), x, (H + 3.25) / 2, PART_Z + 0.22, 4);

    // tables
    this.table(-8.6, 4.0);
    this.table(-8.6, 7.3);
    this.table(-5.2, 4.0, true);
    this.table(-5.2, 7.3);
    this.table(4.6, 5.6);
    this.table(6.4, 8.6);
    // queue barrier posts
    const post = m('#c9a43a', 0.3, { metalness: 0.7 });
    for (const z of [3.6, 4.9, 6.2]) {
      for (const x of [-0.8, 0.8]) {
        this.cyl(0.04, 0.04, 0.95, post, x, 0.475, z, 6);
        this.cyl(0.15, 0.17, 0.03, post, x, 0.015, z, 8);
      }
    }
    for (const x of [-0.8, 0.8]) this.box(0.025, 0.04, 2.6, m('#a3261c', 0.5), x, 0.88, 4.9);
    this.pixSign(['PLEASE QUEUE', 'patience is a virtue', 'and a KPI'], 0.7, 0.4, 0.8, 1.2, 3.5, Math.PI / 2, '#f7d23e', '#7a2416');

    // ball pit for the kids
    const pit = new THREE.Group();
    pit.position.copy(SPOTS.ballPit);
    const wallM = m('#2c64b4', 0.6);
    for (const [w, d, x, z] of [[2.8, 0.15, 0, -1.3], [2.8, 0.15, 0, 1.3], [0.15, 2.8, -1.4, 0], [0.15, 2.8, 1.4, 0]] as [number, number, number, number][]) {
      this.box(w, 0.55, d, wallM, x, 0.275, z, pit);
    }
    const colors = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#ff6fb5'];
    for (let i = 0; i < 90; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), m(colors[i % 5], 0.4));
      b.position.set(((i * 37) % 25) / 10 - 1.25, 0.08 + ((i * 13) % 4) * 0.09, ((i * 53) % 25) / 10 - 1.25);
      pit.add(b);
      this.ballPitBalls.push(b);
    }
    // a little slide
    this.box(0.6, 1.2, 0.6, m('#f1c40f', 0.5), 1.0, 0.6, -0.9, pit);
    const slide = this.box(0.5, 0.06, 1.6, m('#e74c3c', 0.4), 0.2, 0.75, -0.9, pit);
    slide.rotation.set(0, Math.PI / 2, -0.55);
    slide.rotation.order = 'YXZ';
    this.add(pit);
    this.solid(SPOTS.ballPit.x, SPOTS.ballPit.z, 2.9, 2.9, 0.55, false, 'pit');
    this.pixSign(['FUN ZONE', 'fun is mandatory', 'max 3 minutes'], 1.4, 0.6, -13.97, 1.8, 8.3, Math.PI / 2, '#2c64b4', '#f7d23e');

    // broken arcade cabinet
    const arc = new THREE.Group();
    arc.position.set(-13.5, 0, 5.4);
    arc.rotation.y = Math.PI / 2;
    this.box(0.8, 1.8, 0.7, m('#2a1a4a', 0.5), 0, 0.9, 0, arc);
    this.box(0.8, 0.12, 0.35, m('#1c1c1c', 0.5), 0, 1.0, 0.45, arc);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshBasicMaterial({ map: this.tv.texture }));
    scr.position.set(0, 1.4, 0.355);
    arc.add(scr);
    const marquee = this.pixSign(['BURGER DEFENDER'], 0.75, 0.18, 0, 0, 0, 0, '#ff6fb5', '#1d1712');
    this.scene.remove(marquee);
    marquee.position.set(0, 1.72, 0.36);
    arc.add(marquee);
    this.add(arc);
    this.interactive(arc, { kind: 'sign', text: 'BURGER DEFENDER. Insert coin. You have no coins. You are paid in experience.' });
    this.solid(-13.5, 5.4, 0.75, 0.85, 1.8, false);

    // gacha machine by the entrance
    this.gacha = this.model('bg_gacha', -2.4, 0, 9.4, Math.PI);
    if (this.gacha) {
      this.solid(-2.4, 9.4, 0.8, 0.8, 1.5, false);
      this.pixSign(['PRIZE:', '1 MIN BREAK', '(odds 0.001%)'], 0.6, 0.35, -2.4, 1.85, 9.95, Math.PI, '#ff6fb5', '#ffffff', 'A prize machine. The grand prize is one minute of break. Nobody has ever won.');
    }

    // condiment station with napkins and the trash
    const cond = new THREE.Group();
    cond.position.set(7.6, 0, PART_Z + 0.45);
    this.box(1.6, 1.0, 0.5, new THREE.MeshStandardMaterial({ map: woodPanelTex([2, 1]), roughness: 0.7 }), 0, 0.5, 0, cond);
    this.box(1.65, 0.04, 0.55, m('#e8dcc0', 0.5), 0, 1.02, 0, cond);
    for (let i = 0; i < 3; i++) this.box(0.16, 0.22, 0.14, m('#2a2a2a', 0.5), -0.55 + i * 0.25, 1.15, -0.1, cond);
    this.model('bg_ketchup', 0.3, 1.04, 0, 0, cond);
    this.model('bg_mustard', 0.45, 1.04, 0.05, 0, cond);
    for (let i = 0; i < 10; i++) this.cyl(0.004, 0.004, 0.22, m(['#c0392b', '#ffffff', '#f1c40f'][i % 3], 0.6), 0.6 + (i % 4) * 0.015, 1.13, -0.1 + Math.floor(i / 4) * 0.015, 4, cond);
    this.add(cond);
    this.solid(7.6, PART_Z + 0.45, 1.6, 0.5, 1.05, false);
    this.trashBin(6.4, PART_Z + 0.45, 'THANK YOU');
    // a TV with the only channel
    const tvBox = new THREE.Group();
    tvBox.position.set(7.6, 2.95, PART_Z + 0.42);
    this.box(0.9, 0.65, 0.5, m('#2a2a2a', 0.5), 0, 0, 0, tvBox);
    const tvs = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.5), new THREE.MeshBasicMaterial({ map: this.tv.texture }));
    tvs.position.set(0, 0, 0.255);
    tvBox.add(tvs);
    this.box(0.1, 0.4, 0.1, m('#2a2a2a', 0.5), 0, 0.45, -0.15, tvBox);
    this.add(tvBox);
    this.diningTv = tvBox;

    // pendant lamps over the tables
    for (const [x, z] of [[-8.6, 4.0], [-8.6, 7.3], [-5.2, 4.0], [-5.2, 7.3], [4.6, 5.6], [6.4, 8.6]] as [number, number][]) {
      this.cyl(0.006, 0.006, 1.2, m('#2a2a2a'), x, H - 0.6, z, 4);
      const shade = this.cyl(0.08, 0.3, 0.25, m('#c0392b', 0.5), x, H - 1.3, z, 10);
      shade.material = m('#c0392b', 0.5, { side: THREE.DoubleSide });
      this.box(0.12, 0.04, 0.12, new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffd890', emissiveIntensity: 2 }), x, H - 1.43, z);
    }
    // glass entrance doors and windows
    this.glass(2.4, 2.3, 0, 1.15, 10.1, 0);
    for (const x of [-0.6, 0.6]) this.box(0.04, 2.3, 0.06, m('#c9cfd3', 0.3, { metalness: 0.7 }), x * 2, 1.15, 10.05);
    this.box(0.04, 2.3, 0.06, m('#c9cfd3', 0.3, { metalness: 0.7 }), 0, 1.15, 10.05);
    this.pixSign(['PUSH'], 0.3, 0.1, -0.6, 1.1, 10.06, Math.PI, '#ffffff', '#c0392b');
    this.pixSign(['PULL'], 0.3, 0.1, 0.6, 1.1, 10.06, Math.PI, '#ffffff', '#c0392b');
    this.glass(6.5, 1.6, -8.25, 1.7, 10.1, 0);
    this.glass(4.0, 1.6, 5.6, 1.7, 10.1, 0);
    for (const x of [-8.25, 5.6]) this.box(0.06, 1.6, 0.08, m('#3a3a3a', 0.4), x, 1.7, 10.05);
    this.glowSign(['OPEN', '24/7/365'], 1.0, 0.4, -10.6, 2.2, 10.0, Math.PI, '#1a0a10', '#ff3fa4', '#ff3fa4');
    // floor arrows to the queue
    for (const z of [7.6, 8.6]) {
      const a = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 3), m('#f7d23e', 0.6));
      a.rotation.x = -Math.PI / 2;
      a.position.set(0, 0.01, z);
      a.scale.y = 0.02;
      this.add(a);
    }
    // wet floor sign
    const wet = new THREE.Group();
    wet.position.set(2.6, 0, 8.2);
    wet.rotation.y = 0.5;
    const wetMat = new THREE.MeshStandardMaterial({ map: wetFloorTex(), side: THREE.DoubleSide, roughness: 0.8 });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.6), wetMat);
      p.position.set(0, 0.29, s * 0.1);
      p.rotation.x = s * 0.33;
      wet.add(p);
    }
    this.add(wet);
    // The mischief module turns it into an item that can be carried and kicked.
    this.wetSign = wet;

    // plants (people pee in them)
    this.plant(-13.3, 2.7);
    this.plant(2.9, 9.4);
    this.plant(8.4, 9.5);

    // posters
    const spots: [number, number, number, number][] = [
      [-13.97, 2.2, 3.6, Math.PI / 2],
      [13.97, 2.2, 4.2, -Math.PI / 2],
      [-2.0, 2.2, -9.98, 0],
      [9.8, 2.1, -9.98, 0],
      [-13.97, 2.1, -3.0, Math.PI / 2],
      [13.97, 2.1, -8.0, -Math.PI / 2],
    ];
    T.POSTERS.forEach((lines, i) => {
      const s = spots[i % spots.length];
      this.sign(lines, 1.8, 1.0, s[0], s[1] + (i === 2 ? 0.4 : 0), s[2], s[3], { bg: '#fdf6e3', fg: '#7a2416', border: '#c0392b' }, 'A motivational poster. It smells like fries.');
    });
  }

  private toilet(): void {
    this.toiletBooth(9, 6, ['KEY: WALK-IN FREEZER', 'It is on a chicken.', 'Max break: 4 sec']);
    this.pixSign(['STAFF TOILET', 'key: walk-in freezer', '(other end of kitchen)'], 1.6, 0.6, 8.94, 2.4, 7.0, -Math.PI / 2, '#ffffff', '#2c64b4');
  }

  // ---------------------------------------------------------------- small clutter, stains and ceiling stuff

  private clutter(): void {
    // grease stains in the kitchen, ketchup in the dining room
    const kStains: [number, number, number][] = [[-5, -8.3, 0.7], [-8, -8.4, 0.6], [-3.5, -7, 0.4], [-1, -4.6, 0.35], [2, -3, 0.5], [7.5, -8.4, 0.5], [11.5, -6.5, 0.45], [-9.5, -4, 0.4], [0.3, 0.8, 0.5], [12.6, -2.5, 0.4]];
    for (const [x, z, r] of kStains) this.stain(x, z, r);
    const dStains: [number, number, number][] = [[-7, 5.6, 0.25], [3.4, 3.6, 0.2], [-3, 8.1, 0.3], [5.4, 7, 0.22], [-11, 3.3, 0.2]];
    for (const [x, z, r] of dStains) this.stain(x, z, r, '#8e1a12', 0.45);
    const alpha = stainAlpha();
    for (const [x, z] of [[-6.4, -8.8], [-4.5, -8.6], [-8.2, -8.8]] as [number, number][]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ color: '#1a1008', alphaMap: alpha, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      d.rotation.x = -Math.PI / 2;
      d.position.set(x, 0.006, z);
      this.add(d);
    }
    // fallen fries and a lost pickle on the floors
    const fry = m('#e8b23a', 0.7);
    for (let i = 0; i < 26; i++) {
      const kx = [-7.5, -5.2, -3.6, -1.5, 2.6, -6, 0.5, -0.8, 4.2, -9][i % 10] + ((i * 17) % 9) * 0.08 - 0.3;
      const kz = [-8.2, -7.0, -8.6, -6.6, -1, 1.0, 3.5, 6.2, 8.5, 4.4][i % 10] + ((i * 23) % 7) * 0.07;
      const f = this.box(0.012, 0.012, 0.09, fry, kx, 0.008, kz);
      f.rotation.y = i * 1.3;
    }
    // anti fatigue mats in front of the stations
    const mat = m('#1c1c1c', 0.95);
    for (const [x, w] of [[-8.0, 1.8], [-5.0, 2.6], [-1.1, 0.9]] as [number, number][]) this.box(w, 0.02, 0.7, mat, x, 0.01, -8.6);
    this.box(4.2, 0.02, 0.7, mat, -4.0, 0.01, -6.7);
    // floor drain
    this.box(0.4, 0.01, 0.4, m('#2a2a2a', 0.4, { metalness: 0.6 }), -3.0, 0.006, -7.8);
    // a pallet with bun crates and a hand truck in the kitchen corner
    this.model('pallet', 10.8, 0, -6.3);
    for (let i = 0; i < 4; i++) {
      const cr = this.box(0.6, 0.25, 0.4, m(['#2c64b4', '#c0392b'][i % 2], 0.6), 10.6 + (i % 2) * 0.55, 0.28 + Math.floor(i / 2) * 0.27, -6.3);
      cr.rotation.y = (i % 2) * 0.1;
      for (let b = 0; b < 3; b++) this.cyl(0.08, 0.08, 0.05, m('#d99a4e', 0.8), cr.position.x - 0.15 + b * 0.15, cr.position.y + 0.15, -6.3, 8);
    }
    this.solid(10.8, -6.3, 1.4, 1.2, 0.8, false, 'pallet');
    this.model('bg_handTruck', 12.6, 0, -6.0, -0.4);
    this.model('bg_barrel', 12.9, 0, -7.6) ?? this.cyl(0.3, 0.3, 0.9, m('#6e4a14', 0.5), 12.9, 0.45, -7.6);
    this.solid(12.9, -7.6, 0.65, 0.65, 0.9, false);
    this.pixSign(['USED OIL', 'do not drink', '(again)'], 0.5, 0.3, 12.9, 1.15, -7.25, 0, '#e0b21b', '#1d1712');
    // a kitchen roomba charging pad
    this.box(0.5, 0.03, 0.3, m('#34495e', 0.4), 9.6, 0.015, -1.4);
    // hazard tape around the fryer area
    const hz = new THREE.MeshStandardMaterial({ map: hazardTex([12, 1]), roughness: 0.8 });
    this.box(6.6, 0.005, 0.1, hz, -6.3, 0.008, -8.0);

    // sprinkler heads on the ceiling
    for (const [x, z] of [[-7, -6], [-3, -4.5], [1, -7], [5, -4], [9.5, -7], [-9, -1], [-2, 0.5]] as [number, number][]) {
      this.cyl(0.04, 0.06, 0.06, m('#c9a43a', 0.3, { metalness: 0.8 }), x, H - 0.04, z, 6);
      this.sprinklers.push(new THREE.Vector3(x, H - 0.1, z));
    }
    // pipes along the kitchen ceiling
    const pipe = m('#9e2a1e', 0.5);
    const p1 = this.cyl(0.05, 0.05, 28, pipe, 0, H - 0.18, -3.0, 6);
    p1.rotation.z = Math.PI / 2;
    const p2 = this.cyl(0.07, 0.07, 12, m('#8b9096', 0.4, { metalness: 0.4 }), 11.5, H - 0.25, -4, 6);
    p2.rotation.x = Math.PI / 2;
    // security cameras
    for (const [x, y, z, yaw] of [[-13.6, 3.2, -0.4, Math.PI * 0.75], [13.6, 3.2, -9.6, -Math.PI * 0.25], [13.6, 3.2, 9.6, -Math.PI * 0.75], [-13.6, 3.2, 2.4, Math.PI * 0.25]] as [number, number, number, number][]) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.rotation.y = yaw;
      const body = this.box(0.18, 0.16, 0.38, m('#d8d8d2', 0.6), 0, 0, 0, g);
      body.rotation.x = 0.35;
      this.box(0.06, 0.2, 0.06, m('#1a1a1a', 0.6), 0, 0.15, 0, g);
      this.add(g);
      this.cameras.push(g);
    }
    // ceiling fans in the dining room
    for (const [x, z] of [[-6.8, 5.6], [5.2, 7]] as [number, number][]) {
      const f = new THREE.Group();
      f.position.set(x, H - 0.45, z);
      this.cyl(0.015, 0.015, 0.4, m('#3a2a1a'), 0, 0.22, 0, 4, f);
      this.cyl(0.12, 0.12, 0.12, m('#6b4a2c', 0.6), 0, 0, 0, 8, f);
      for (let i = 0; i < 4; i++) {
        const b = this.box(0.7, 0.015, 0.14, m('#6b4a2c', 0.6), 0, 0, 0, f);
        b.geometry.translate(0.4, 0, 0);
        b.rotation.y = (i * Math.PI) / 2;
      }
      this.add(f);
      this.fans.push(f);
    }
    // grease drips on the walls near the fryer
    for (let i = 0; i < 8; i++) this.box(0.04, 0.3 + (i % 3) * 0.2, 0.01, m('#6e4a14', 0.3, { transparent: true, opacity: 0.5 }), -10 + i * 0.9, 1.3 - (i % 3) * 0.1, -9.985);
    // a clock that is always 5 minutes before the end of the shift
    this.cyl(0.25, 0.25, 0.05, m('#f4f0e6', 0.6), -6.0, 2.9, PART_Z - 0.14, 16).rotation.x = Math.PI / 2;
    this.box(0.02, 0.18, 0.01, m('#111111'), -6.0, 2.95, PART_Z - 0.17);
    this.box(0.14, 0.02, 0.01, m('#111111'), -5.95, 2.9, PART_Z - 0.17);
    // boxes in corners
    this.pile(-13.4, -4.6, 1.0, 1.4, 3, 101);
    this.pile(-13.4, -1.6, 1.0, 1.0, 2, 102);
    this.pile(13.4, 3.2, 1.0, 1.0, 2, 103);
  }

  // ---------------------------------------------------------------- animation of the building

  private animate(t: number): void {
    const phase = t % 6.1;
    const stutter = phase > 5.4 && Math.sin(t * 45) > 0.1;
    this.flicker.intensity = stutter ? 1 : 10;
    for (const [i, om] of this.oilMats.entries()) {
      if (om.map) om.map.offset.set(Math.sin(t * 2 + i) * 0.03, (t * 0.05) % 1);
    }
    for (const h of this.heatLamps) h.intensity = (h.userData.base ??= h.intensity) * (0.92 + Math.sin(t * 13 + h.position.x) * 0.04);
    for (const f of this.fans) f.rotation.y = t * 2.2;
    this.tvT += 1;
    if (this.tvT % 6 === 0) this.tv.update();
  }

  /** Floor balls bobbing when the kid jumps in the pit. */
  splashBalls(t: number): void {
    for (const [i, b] of this.ballPitBalls.entries()) if (i % 4 === 0) b.position.y = 0.08 + ((i * 13) % 4) * 0.09 + Math.abs(Math.sin(t * 6 + i)) * 0.25;
  }
}

const fryMats = new Map<number, THREE.MeshStandardMaterial>();
/** Fries in a basket, colored by doneness (cached materials, see pattyMat in job.ts). */
export function setBasketFries(b: Basket, frac: number | null): void {
  b.fries.visible = frac !== null;
  if (frac === null) return;
  const k = Math.round(Math.min(frac, 3) * 10);
  let mat = fryMats.get(k);
  if (!mat) {
    const f = k / 10;
    const c = f < 1 ? new THREE.Color('#f0dc9a').lerp(new THREE.Color('#e8b23a'), f) : f < 1.6 ? new THREE.Color('#e8b23a') : new THREE.Color('#e8b23a').lerp(new THREE.Color('#2a1608'), Math.min(1, (f - 1.6) / 1.2));
    mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
    fryMats.set(k, mat);
  }
  for (const c of b.fries.children) (c as THREE.Mesh).material = mat;
}

export { friesMesh };
