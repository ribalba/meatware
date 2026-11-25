import * as THREE from 'three';
import { boxMaterials } from '../../details';
import { Item } from '../../items';
import { Interact, LevelKit, mat } from '../../level';
import { ceilingTex, ductTex, hazardTex, concreteTex, corrugatedTex, beltTex, metalPlateTex, rackTex } from '../../textures';
import { AABB, aabb, blobGeometry, textTexture, TextTexOpts } from '../../util';
import type { Mail } from './mail';
import { KEYBAG_DEF, STAMPS_DEF } from './mail';
import * as T from './texts';
import {
  burlapTex,
  cabinetTex,
  corkTex,
  dadoTex,
  flapTex,
  kraftTex,
  linoTex,
  plasterTex,
  sackTex,
  screenCanvas,
  steelTex,
  terrazzoTex,
  wireTex,
  woodTex,
} from './textures';

/**
 * POSTAL UNIT 7 Sorting Office. A dusty hall with a wall of pigeonholes, roll cages,
 * a conveyor from the wall, a franking machine, a kitchenette with a kettle and a counter window.
 */

export const ROOM = { minX: -14, maxX: 14, minZ: -11, maxZ: 11 };
const H = 4.6;

export interface Entry {
  mail: Mail;
  ok: boolean;
  perfect?: boolean;
}

export interface Cubby {
  col: number;
  row: number;
  digit: number;
  label: string;
  mesh: THREE.Mesh;
  /** Floor of the hole, front middle. */
  pos: THREE.Vector3;
  entries: Entry[];
  stack: THREE.Object3D[];
}

export interface Cage {
  idx: number;
  name: string;
  digits: number[];
  color: string;
  /** Floor center inside the cage. */
  pos: THREE.Vector3;
  /** Where a robot stands to empty it. */
  front: THREE.Vector3;
  entries: Entry[];
  stack: THREE.Object3D[];
}

/** Things the robots and the job animate. */
export interface Machine {
  group: THREE.Group;
  face: { g: CanvasRenderingContext2D; tex: THREE.CanvasTexture; canvas: HTMLCanvasElement };
  beacon: THREE.MeshStandardMaterial;
  body: THREE.Object3D;
  outlet: THREE.Vector3;
  front: THREE.Vector3;
}

export const CUBBY_COLS = 8;
export const CUBBY_ROWS = 5;
const PH_X = -5.5;
const PH_W = 0.62;
const PH_H = 0.44;
const PH_Y0 = 0.5;
const PH_FRONT = -10.5;

export const CAGE_ZS = [-4.8, -2.4, 0, 2.4, 4.8];
export const CAGE_X = -11.6;
/** Floor height of the public side of the counter window. */
export const PUBLIC_Y = 0.4;

const PX = '"Press Start 2P", monospace';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });

/** A canvas sign with left aligned monospace lines, like a printed notice. */
function noticeTex(lines: string[], w: number, h: number, bg: string, fg: string, title?: string): THREE.CanvasTexture {
  const { g, tex } = screenCanvas(w, h);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = fg;
  g.lineWidth = 3;
  g.strokeRect(4, 4, w - 8, h - 8);
  const lh = (h - 24) / (lines.length + (title ? 1.4 : 0));
  let y = 14 + lh * 0.8;
  g.fillStyle = fg;
  if (title) {
    g.font = `bold ${Math.floor(lh * 1.05)}px monospace`;
    g.fillText(title, 14, y + lh * 0.2);
    y += lh * 1.4;
  }
  g.font = `${Math.floor(lh * 0.8)}px monospace`;
  for (const l of lines) {
    g.fillText(l, 14, y);
    y += lh;
  }
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

export class MailOffice extends LevelKit {
  cubbies: Cubby[] = [];
  cages: Cage[] = [];
  tray!: THREE.Group;
  trayPos = new THREE.Vector3(3.2, 0.93, -4.95);
  beltStart = new THREE.Vector3(3.2, 0.92, -10.9);
  beltEnd = new THREE.Vector3(3.2, 0.92, -5.45);
  beltRunning = true;
  beltLamp!: THREE.MeshStandardMaterial;
  beltFullSign!: THREE.Mesh;
  franker!: THREE.Group;
  frankHead!: THREE.Mesh;
  frankScreen!: { g: CanvasRenderingContext2D; tex: THREE.CanvasTexture };
  kettle!: THREE.Group;
  steam: THREE.Mesh[] = [];
  steaming = false;
  toaster!: THREE.Object3D;
  returnPile!: THREE.Group;
  returnCount = 0;
  deadDrawer!: THREE.Mesh;
  deadOpen = 0;
  machine!: Machine;
  /** Where the counter robot stands at the window, and where it enters. */
  windowSpot = new THREE.Vector3(-3.0, 0, 12.0);
  publicDoor = new THREE.Vector3(-10.6, 0, 13.6);
  bell!: THREE.Object3D;
  dock = new THREE.Vector3(-12.1, 0, -8.3);
  returnFront = new THREE.Vector3(0.2, 0, -9.3);
  /** Things the mischief module (mischief.ts) breaks, moves or uses. */
  cameras: THREE.Group[] = [];
  coffee: THREE.Object3D | null = null;
  breakTv: THREE.Object3D | null = null;
  chairs: THREE.Object3D[] = [];
  trashCans: THREE.Object3D[] = [];
  coatRack: THREE.Object3D | null = null;
  trolley!: THREE.Group;
  cooler!: THREE.Group;
  coolerCol!: AABB;
  biteSign!: THREE.Mesh;
  private belt!: THREE.Texture;
  private fans: THREE.Object3D[] = [];
  private flicker!: THREE.PointLight;
  private leds: THREE.Mesh[] = [];
  private clockFace!: { g: CanvasRenderingContext2D; tex: THREE.CanvasTexture };
  private lastClock = -1;

  constructor(scene: THREE.Scene) {
    super(scene);
    this.bounds = ROOM;
    this.ceiling = 4.4;
    this.spawn = { pos: new THREE.Vector3(3.6, 0, -1.2), yaw: 0.25 };
    this.bossWaypoints.push(
      new THREE.Vector3(-5.5, 0, -8.6),
      new THREE.Vector3(-9.4, 0, -6.4),
      new THREE.Vector3(-8.6, 0, 1),
      new THREE.Vector3(-6.5, 0, 7.6),
      new THREE.Vector3(0, 0, 6.8),
      new THREE.Vector3(6, 0, 7.4),
      new THREE.Vector3(9.6, 0, 0.5),
      new THREE.Vector3(5.2, 0, -2.6),
      new THREE.Vector3(0.8, 0, -7.6),
    );
    this.lights();
    this.room();
    this.publicArea();
    this.pigeonholes();
    this.routingSheet();
    this.deadLetters();
    this.returnBin();
    this.conveyor();
    this.frankingDesk();
    this.cagesRow();
    this.bagRacks();
    this.loadingBay();
    this.counter();
    this.keyHook();
    this.kitchen();
    this.sortomatic();
    this.centerTable();
    this.bradDesk();
    this.toiletBooth(9, -11, ['KEY: COUNTER WINDOW', 'It is tied to a sack', 'of chain letters.', 'Do not break the chain.']);
    this.sign(['STAFF TOILET', 'far corner. as always.', 'walking is a benefit.'], 2.2, 1.1, -13.97, 2.9, 7.6, Math.PI / 2, { bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' });
    this.plant(-13.1, -10.1);
    this.plant(8.4, 10.3);
    this.plant(1.1, 10.35);
    this.plant(-7.2, 10.35);
    this.ceilingStuff();
    this.clutter();
    this.floorClutter();
    this.posters();
    this.onTick((t) => this.animate(t));
  }

  // ---------------------------------------------------------------- shell

  private lights(): void {
    this.scene.background = new THREE.Color('#1d1712');
    this.scene.add(new THREE.HemisphereLight('#f0dfc0', '#3a3026', 1.25));
    const d = new THREE.DirectionalLight('#ffe2b0', 0.5);
    d.position.set(-5, 12, 6);
    this.scene.add(d);
    const spots: [number, number, string][] = [
      [-5.5, -8, '#ffdca8'],
      [-10, -2, '#ffd9a0'],
      [-10, 6, '#ffd9a0'],
      [-2, 3, '#ffe6b8'],
      [4, -6, '#ffe6b8'],
      [5, 4, '#ffdca8'],
      [11, 8, '#ffcf90'],
      [11, -2, '#ffe6b8'],
      [-4, 9, '#ffd9a0'],
    ];
    spots.forEach(([x, z, c], i) => {
      const l = new THREE.PointLight(c, 13, 12, 1.6);
      l.position.set(x, 3.9, z);
      this.scene.add(l);
      if (i === 0) this.flicker = l;
    });
    // Fluorescent tube fixtures
    const tube = new THREE.MeshStandardMaterial({ color: '#fff6dc', emissive: '#fff1c8', emissiveIntensity: 1 });
    const housing = mat('#8a8578');
    for (const [x, z] of spots) {
      this.box(0.5, 0.06, 1.6, housing, x, 4.52, z);
      this.box(0.36, 0.04, 1.4, tube, x, 4.48, z);
    }
  }

  private room(): void {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(28, 22, 28, 22), new THREE.MeshStandardMaterial({ map: linoTex([14, 11]), roughness: 0.75 }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(28, 22, 14, 11), new THREE.MeshStandardMaterial({ map: ceilingTex([14, 11]), roughness: 0.9 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = H;
    this.scene.add(ceil);

    const upper = (len: number) => std({ map: plasterTex([len / 2, 1.5]) });
    const lower = (len: number) => std({ map: dadoTex([len / 2, 1]) });
    const trim = mat('#3b2a1a');
    // North and east walls are whole. West wall too. South wall has the counter window.
    const wall = (w: number, d: number, x: number, z: number, len: number, inward: [number, number]) => {
      this.box(w, H, d, upper(len), x, H / 2, z);
      // Dado: lower wall in green, slightly in front
      const [ix, iz] = inward;
      this.box(w === 0.4 ? 0.04 : w, 1.2, d === 0.4 ? 0.04 : d, lower(len), x + ix * 0.21, 0.6, z + iz * 0.21);
      this.box(w === 0.4 ? 0.06 : w, 0.08, d === 0.4 ? 0.06 : d, trim, x + ix * 0.22, 1.22, z + iz * 0.22);
    };
    wall(28.8, 0.4, 0, -11.2, 28, [0, 1]);
    wall(0.4, 22, -14.2, 0, 22, [1, 0]);
    wall(0.4, 22, 14.2, 0, 22, [-1, 0]);
    // South wall in pieces around the window (x -6..-2, y 1.05..2.35)
    const sUp = upper(10);
    this.box(8.4, H, 0.4, sUp, -10.2, H / 2, 11.2);
    this.box(16.4, H, 0.4, sUp, 6.2, H / 2, 11.2);
    this.box(4, 1.05, 0.4, sUp, -4, 0.525, 11.2);
    this.box(4, H - 2.35, 0.4, sUp, -4, (H + 2.35) / 2, 11.2);
    const dl = lower(10);
    this.box(8.2, 1.2, 0.04, dl, -10.1, 0.6, 10.99);
    this.box(16.2, 1.2, 0.04, dl, 6.1, 0.6, 10.99);
    this.box(4, 1.0, 0.04, dl, -4, 0.5, 10.99);
    this.box(8.2, 0.08, 0.06, trim, -10.1, 1.22, 10.98);
    this.box(16.2, 0.08, 0.06, trim, 6.1, 1.22, 10.98);
    this.colliders.push(
      aabb(0, -11.2, 28.8, 0.4, H, false),
      aabb(0, 11.2, 28.8, 0.4, H, false),
      aabb(-14.2, 0, 0.4, 22, H, false),
      aabb(14.2, 0, 0.4, 22, H, false),
    );
    // Window frame and glass
    const frame = mat('#6e4b2a');
    this.box(4.1, 0.1, 0.5, frame, -4, 1.05, 11.2);
    this.box(4.1, 0.1, 0.5, frame, -4, 2.35, 11.2);
    for (const x of [-6, -4, -2]) this.box(0.1, 1.3, 0.5, frame, x, 1.7, 11.2);
    const glass = new THREE.MeshStandardMaterial({ color: '#cfe6ee', transparent: true, opacity: 0.18, roughness: 0.1, depthWrite: false });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.3), glass);
    g.position.set(-4, 1.7, 11.2);
    this.scene.add(g);
    // Speaking holes in the glass
    const holeM = mat('#2a2a2a');
    for (const x of [-5, -3]) for (let i = 0; i < 3; i++) this.box(0.04, 0.04, 0.02, holeM, x + (i - 1) * 0.07, 1.5, 11.19);
    this.sign(['COUNTER', 'please wait to be ignored'], 2.6, 0.55, -4, 2.75, 10.97, Math.PI, { bg: '#7a2416', fg: '#f3e6c8', border: '#f3e6c8', font: PX });
  }

  /** The public side of the counter window. The robot customer lives here. */
  private publicArea(): void {
    // The public side is a step higher, so customers look you in the eye through the glass.
    const P = new THREE.Group();
    P.position.y = PUBLIC_Y;
    this.scene.add(P);
    this.box(14, PUBLIC_Y, 3.6, mat('#5a554e'), -5, PUBLIC_Y / 2, 13.0);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.6, 14, 4), std({ map: terrazzoTex([7, 2]) }));
    f.rotation.x = -Math.PI / 2;
    f.position.set(-5, 0.002, 13.0);
    P.add(f);
    const w = std({ map: plasterTex([5, 1.2]) });
    this.box(14.4, 3.8, 0.3, w, -5, 1.9, 14.95);
    this.box(0.3, 3.8, 3.8, w, -12.2, 1.9, 13.0);
    this.box(0.3, 3.8, 3.8, w, 2.2, 1.9, 13.0);
    this.box(14.4, 0.2, 3.8, mat('#8a857a'), -5, 3.8, 13.0);
    const onP = (m: THREE.Object3D) => P.add(m);
    this.box(1.4, 2.3, 0.08, mat('#4e6a7a', { metalness: 0.3 }), -10.6, 1.15, 14.78, P);
    onP(this.sign(['PUBLIC ENTRANCE'], 1.4, 0.3, -10.6, 2.55, 14.78, Math.PI, { bg: '#2c3e50', fg: '#ffffff', font: PX }));
    const l = new THREE.PointLight('#ffe9c0', 9, 8, 1.6);
    l.position.set(-5, 3.4, 13);
    this.scene.add(l);
    this.box(0.8, 0.04, 0.3, new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff1c8', emissiveIntensity: 1 }), -5, 3.68, 13);
    // Queue posts with a sagging rope
    const post = mat('#c9a227', { metalness: 0.6, roughness: 0.3 });
    const rope = mat('#8e1b1b');
    for (const x of [-9, -7.5, -6]) {
      this.box(0.06, 0.95, 0.06, post, x, 0.475, 12.9, P);
      this.box(0.24, 0.04, 0.24, post, x, 0.02, 12.9, P);
    }
    this.box(3, 0.04, 0.04, rope, -7.5, 0.82, 12.9, P);
    // Take a number machine and a bench
    this.box(0.3, 1.2, 0.3, mat('#b03a2e'), -11.5, 0.6, 12.0, P);
    onP(this.sign(['TAKE A', 'NUMBER', 'yours: 9471'], 0.3, 0.3, -11.5, 1.0, 12.16, 0, { bg: '#fdf6e3', fg: '#b03a2e' }));
    this.box(2, 0.1, 0.5, woodMat(), 0, 0.45, 14.5, P);
    for (const x of [-0.8, 0.8]) this.box(0.08, 0.45, 0.4, mat('#333'), x, 0.225, 14.5, P);
    onP(this.sign(['NOW SERVING', '0'], 1.0, 0.5, -1.0, 2.8, 14.78, Math.PI, { bg: '#111111', fg: '#ff4d4d', font: PX }));
    onP(this.sign(['SEND YOURSELF', 'TODAY!', 'postage from 4 cr'], 1.6, 1.0, -8, 2.0, 14.78, Math.PI, { bg: '#f1c40f', fg: '#7a2416', border: '#7a2416' }));
    onP(this.sign(['LOST PARCELS', 'ask again tomorrow'], 1.6, 0.7, -4.5, 2.2, 14.78, Math.PI, { bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' }));
    this.prop('plant', 1.4, PUBLIC_Y, 14.3);
  }

  // ---------------------------------------------------------------- the pigeonhole wall

  private pigeonholes(): void {
    const wood = std({ map: woodTex([4, 3]) });
    const dark = mat('#20150c');
    const W = CUBBY_COLS * PH_W;
    const x0 = PH_X - W / 2;
    const top = PH_Y0 + CUBBY_ROWS * PH_H;
    const zc = PH_FRONT - 0.25;
    // back, sides, top, plinth
    this.box(W, top - PH_Y0, 0.03, dark, PH_X, (top + PH_Y0) / 2, -10.98);
    this.box(W + 0.1, PH_Y0, 0.52, wood, PH_X, PH_Y0 / 2, zc);
    for (let i = 0; i < 8; i++) {
      // drawer fronts in the plinth
      this.box(0.5, 0.3, 0.02, mat('#7a5230'), x0 + (i + 0.5) * PH_W, 0.25, PH_FRONT + 0.015);
      this.box(0.12, 0.03, 0.03, mat('#c9a227', { metalness: 0.6 }), x0 + (i + 0.5) * PH_W, 0.3, PH_FRONT + 0.035);
    }
    for (let c = 0; c <= CUBBY_COLS; c++) this.box(c === 0 || c === CUBBY_COLS ? 0.05 : 0.025, top - PH_Y0, 0.5, wood, x0 + c * PH_W, (top + PH_Y0) / 2, zc);
    for (let r = 0; r <= CUBBY_ROWS; r++) this.box(W, 0.025, 0.5, wood, PH_X, PH_Y0 + r * PH_H, zc);
    // Header with the districts
    this.box(W + 0.1, 0.62, 0.55, wood, PH_X, top + 0.31, zc);
    for (let c = 0; c < CUBBY_COLS; c++) {
      const d = c + 1;
      this.sign([`${d}xxxx`, T.DISTRICTS[d]], PH_W - 0.06, 0.5, x0 + (c + 0.5) * PH_W, top + 0.31, PH_FRONT + 0.03, 0, { bg: '#f3e6c8', fg: '#3b2a1a', border: '#7a2416', font: PX });
    }
    this.sign(['SORTING WALL', 'letters only. no feelings.'], 3.6, 0.7, PH_X, top + 1.05, -10.97, 0, { bg: '#7a2416', fg: '#f3e6c8', border: '#f3e6c8', font: PX });
    // Row labels on the shelf lips, one strip per row
    for (let r = 0; r < CUBBY_ROWS; r++) {
      const { g, tex } = screenCanvas(512, 28);
      g.fillStyle = '#e8dcc0';
      g.fillRect(0, 0, 512, 28);
      g.fillStyle = '#2a1c10';
      g.font = 'bold 24px monospace';
      g.textAlign = 'center';
      for (let c = 0; c < CUBBY_COLS; c++) {
        g.fillText(`${c + 1}${r * 2}-${c + 1}${r * 2 + 1}`, (c + 0.5) * 64, 23);
        g.fillRect(c * 64, 0, 2, 28);
      }
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.075), std({ map: tex }));
      const yLip = top - (r + 1) * PH_H + 0.0;
      strip.position.set(PH_X, yLip - 0.03, PH_FRONT + 0.004);
      this.scene.add(strip);
    }
    // Hit boxes, one per hole
    const hit = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    for (let c = 0; c < CUBBY_COLS; c++) {
      for (let r = 0; r < CUBBY_ROWS; r++) {
        const x = x0 + (c + 0.5) * PH_W;
        const yFloor = top - (r + 1) * PH_H + 0.0125;
        const m = new THREE.Mesh(new THREE.BoxGeometry(PH_W - 0.04, PH_H - 0.04, 0.46), hit);
        m.position.set(x, yFloor + PH_H / 2, zc);
        const cubby: Cubby = { col: c, row: r, digit: c + 1, label: `${c + 1}${r * 2}-${c + 1}${r * 2 + 1}`, mesh: m, pos: new THREE.Vector3(x, yFloor, zc + 0.05), entries: [], stack: [] };
        m.userData.interact = { kind: 'cubby', cubby } satisfies Interact;
        this.scene.add(m);
        this.interactables.push(m);
        this.cubbies.push(cubby);
      }
    }
    // Some old letters already in there
    const r = rng(77);
    const paper = [mat('#efe6cf'), mat('#e8dcc0'), mat('#dde6ee')];
    for (const cb of this.cubbies) {
      const roll = r();
      if (roll < 0.45) {
        // A flat little stack at the back
        const n = 1 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) {
          const env = this.box(0.24, 0.012, 0.15, paper[Math.floor(r() * 3)], cb.pos.x + (r() - 0.5) * 0.08, cb.pos.y + 0.008 + i * 0.013, cb.pos.z - 0.12);
          env.rotation.y = (r() - 0.5) * 0.4;
        }
      } else if (roll < 0.7) {
        // Letters standing up, leaning on the side
        const n = 2 + Math.floor(r() * 4);
        for (let i = 0; i < n; i++) {
          const env = this.box(0.008, 0.15, 0.24, paper[Math.floor(r() * 3)], cb.pos.x - 0.22 + i * 0.03, cb.pos.y + 0.085, cb.pos.z - 0.1);
          env.rotation.z = 0.15 + i * 0.02;
        }
      } else if (roll < 0.78) {
        // A rubber banded bundle
        this.box(0.24, 0.08, 0.15, paper[0], cb.pos.x, cb.pos.y + 0.05, cb.pos.z - 0.1);
        this.box(0.02, 0.085, 0.155, mat('#b03a2e'), cb.pos.x, cb.pos.y + 0.05, cb.pos.z - 0.1);
      }
    }
    this.colliders.push(aabb(PH_X, zc, W + 0.1, 0.55, top + 0.62, true, 'pigeonholes'));
  }

  private routingSheet(): void {
    const tex = noticeTex(T.ROUTING_SHEET.slice(1), 512, 470, '#f6f0dc', '#1f2a44', T.ROUTING_SHEET[0]);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.0), std({ map: tex }));
    m.position.set(-10.3, 2.0, -10.97);
    this.scene.add(m);
    this.box(2.3, 2.1, 0.03, mat('#3b2a1a'), -10.3, 2.0, -10.99);
    m.userData.interact = { kind: 'routing' } satisfies Interact;
    this.interactables.push(m);
    // Pins
    const pin = mat('#c0392b');
    for (const [x, y] of [[-11.3, 2.9], [-9.3, 2.9], [-11.3, 1.1], [-9.3, 1.1]]) this.box(0.04, 0.04, 0.03, pin, x, y, -10.95);
  }

  private deadLetters(): void {
    const g = new THREE.Group();
    g.position.set(-1.7, 0, -10.6);
    const cab = std({ map: cabinetTex() });
    this.box(1.0, 1.9, 0.7, cab, 0, 0.95, 0, g);
    // The top drawer opens when a letter goes in
    this.deadDrawer = this.box(0.92, 0.42, 0.66, cab, 0, 1.6, 0.03, g);
    const handle = mat('#c9c3a6', { metalness: 0.6 });
    this.box(0.25, 0.04, 0.04, handle, 0, 0.06, 0.35, this.deadDrawer);
    for (const y of [0.35, 0.8, 1.2]) this.box(0.25, 0.04, 0.04, handle, 0, y, 0.37, g);
    for (const y of [0.57, 1.0, 1.38]) this.box(0.94, 0.012, 0.01, mat('#2f3622'), 0, y, 0.351, g);
    g.userData.interact = { kind: 'dead' } satisfies Interact;
    this.scene.add(g);
    this.interactables.push(g);
    this.sign(['DEAD LETTERS', 'do not open.', 'they are resting.'], 1.0, 0.6, -1.7, 2.35, -10.97, 0, { bg: '#1a1a1a', fg: '#d0d0c0', border: '#d0d0c0', font: PX });
    // Candle on top, for the dead
    this.box(0.06, 0.16, 0.06, mat('#f3efe0'), -1.45, 1.98, -10.5);
    const flame = this.box(0.03, 0.05, 0.03, new THREE.MeshStandardMaterial({ color: '#ffb84d', emissive: '#ff9a2a', emissiveIntensity: 2 }), -1.45, 2.09, -10.5);
    this.onTick((t) => flame.scale.set(1, 0.8 + Math.sin(t * 13) * 0.25, 1));
    this.colliders.push(aabb(-1.7, -10.6, 1.0, 0.75, 1.9, true, 'dead'));
  }

  private returnBin(): void {
    const g = new THREE.Group();
    g.position.set(0.25, 0, -10.35);
    const wire = new THREE.MeshStandardMaterial({ map: wireTex([3, 2]), transparent: true, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4, depthWrite: false });
    const wireS = new THREE.MeshStandardMaterial({ map: wireTex([2, 2]), transparent: true, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4, depthWrite: false });
    const fr = mat('#8a8c88', { metalness: 0.5 });
    this.box(1.3, 0.02, 0.9, fr, 0, 0.12, 0, g);
    for (const [x, z] of [[-0.65, -0.45], [0.65, -0.45], [-0.65, 0.45], [0.65, 0.45]]) this.box(0.04, 0.75, 0.04, fr, x, 0.375, z, g);
    const side = (w: number, h: number, m: THREE.Material, x: number, z: number, ry: number) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      p.position.set(x, 0.12 + h / 2, z);
      p.rotation.y = ry;
      g.add(p);
    };
    side(1.3, 0.62, wire, 0, 0.45, 0);
    side(1.3, 0.62, wire, 0, -0.45, 0);
    side(0.9, 0.62, wireS, -0.65, 0, Math.PI / 2);
    side(0.9, 0.62, wireS, 0.65, 0, Math.PI / 2);
    this.returnPile = new THREE.Group();
    g.add(this.returnPile);
    g.userData.interact = { kind: 'return' } satisfies Interact;
    this.scene.add(g);
    this.interactables.push(g);
    // Start with a heap of undeliverables
    for (let i = 0; i < 14; i++) this.addToReturnPile();
    this.sign(['RETURN', 'TO SENDER'], 1.4, 0.7, 0.25, 2.1, -10.97, 0, { bg: '#c0392b', fg: '#ffffff', border: '#ffffff', font: PX });
    this.colliders.push(aabb(0.25, -10.35, 1.35, 0.95, 0.8, false, 'return'));
  }

  /** One more envelope on the return heap. */
  addToReturnPile(): void {
    const i = this.returnCount++;
    const r = rng(500 + i);
    const n = Math.min(i, 60);
    const paper = [mat('#efe6cf'), mat('#e8dcc0'), mat('#f3efe6')][i % 3];
    const env = this.box(0.24, 0.012, 0.15, paper, (r() - 0.5) * 1.0, 0.15 + n * 0.008 + r() * 0.02, (r() - 0.5) * 0.6, this.returnPile);
    env.rotation.set((r() - 0.5) * 0.4, r() * Math.PI, (r() - 0.5) * 0.4);
  }

  // ---------------------------------------------------------------- conveyor and franking

  private conveyor(): void {
    const len = this.beltEnd.z - this.beltStart.z;
    const zc = (this.beltStart.z + this.beltEnd.z) / 2;
    const x = this.beltStart.x;
    const steel = std({ map: steelTex([4, 1]), metalness: 0.4 });
    this.belt = beltTex();
    this.belt.repeat.set(len * 3, 1);
    const beltM = new THREE.MeshStandardMaterial({ map: this.belt, roughness: 0.9 });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.62), beltM);
    top.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    top.position.set(x, 0.86, zc);
    top.userData.interact = { kind: 'tray' } satisfies Interact;
    this.scene.add(top);
    this.interactables.push(top);
    for (const s of [-1, 1]) {
      this.box(0.06, 0.16, len, steel, x + s * 0.36, 0.86, zc);
      this.box(0.08, 0.04, len, mat('#d4ac0d'), x + s * 0.36, 0.95, zc);
    }
    this.box(0.66, 0.12, len, mat('#2a2a2c'), x, 0.79, zc);
    for (let z = this.beltStart.z + 0.4; z < this.beltEnd.z; z += 1.4) {
      for (const s of [-1, 1]) this.box(0.06, 0.78, 0.06, steel, x + s * 0.3, 0.39, z);
    }
    // Hatch in the north wall with rubber flaps
    this.box(1.1, 1.0, 0.05, mat('#0c0c0c'), x, 1.2, -10.97);
    this.box(1.3, 0.12, 0.12, hazardMat(), x, 1.76, -10.94);
    for (const s of [-1, 1]) this.box(0.1, 1.1, 0.12, hazardMat(), x + s * 0.6, 1.2, -10.94);
    const flap = std({ map: flapTex(), side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const f = this.box(0.2, 0.62, 0.01, flap, x - 0.4 + i * 0.2, 1.22, -10.9);
      this.onTick((t) => (f.rotation.x = this.beltRunning ? Math.sin(t * 3 + i) * 0.08 : 0));
    }
    this.sign(['INCOMING', 'it never stops'], 1.4, 0.5, x, 2.15, -10.96, 0, { bg: '#2c3e50', fg: '#f1c40f', border: '#f1c40f', font: PX });
    // The tray at the end
    this.tray = new THREE.Group();
    this.tray.position.copy(this.trayPos);
    this.tray.position.y = 0;
    const trayM = std({ map: metalPlateTex([1, 1]), metalness: 0.5 });
    this.box(0.95, 0.06, 0.8, trayM, 0, 0.86, 0, this.tray);
    for (const s of [-1, 1]) {
      this.box(0.04, 0.2, 0.8, trayM, s * 0.47, 0.96, 0, this.tray);
    }
    this.box(0.95, 0.2, 0.04, trayM, 0, 0.96, 0.4, this.tray);
    for (const [lx, lz] of [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.33], [0.4, 0.33]]) this.box(0.05, 0.84, 0.05, steel, lx, 0.42, lz, this.tray);
    this.tray.userData.interact = { kind: 'tray' } satisfies Interact;
    this.scene.add(this.tray);
    this.interactables.push(this.tray);
    // Status lamp and the "full" sign
    this.beltLamp = new THREE.MeshStandardMaterial({ color: '#2ecc71', emissive: '#2ecc71', emissiveIntensity: 1.5 });
    const pole = mat('#3a3a3a', { metalness: 0.5 });
    this.box(0.04, 1.1, 0.04, pole, x + 0.5, 1.4, this.trayPos.z + 0.35);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 10), this.beltLamp);
    lamp.position.set(x + 0.5, 2.0, this.trayPos.z + 0.35);
    this.scene.add(lamp);
    this.beltFullSign = this.sign(['TRAY FULL', 'human too slow'], 0.9, 0.4, x - 0.05, 1.75, this.trayPos.z + 0.44, 0, { bg: '#111111', fg: '#ff4d4d', font: PX });
    this.beltFullSign.visible = false;
    this.colliders.push(aabb(x, (this.beltStart.z + this.trayPos.z + 0.4) / 2, 0.85, this.trayPos.z + 0.4 - this.beltStart.z, 1.0, false, 'belt'));
  }

  private frankingDesk(): void {
    const dx = 6.25;
    const dz = -6.0;
    const wood = std({ map: woodTex([2, 1]) });
    this.box(0.9, 0.06, 1.8, wood, dx, 0.8, dz);
    this.box(0.8, 0.74, 0.04, wood, dx, 0.4, dz - 0.86);
    this.box(0.8, 0.74, 0.04, wood, dx, 0.4, dz + 0.86);
    this.box(0.04, 0.74, 1.7, wood, dx + 0.42, 0.4, dz);
    this.colliders.push(aabb(dx, dz, 0.95, 1.85, 0.83, true, 'desk'));
    // The franking machine, facing west
    const g = new THREE.Group();
    g.position.set(dx, 0.83, dz + 0.25);
    const body = std({ map: steelTex([1, 1]), color: '#c86b5a', metalness: 0.3 });
    this.box(0.5, 0.32, 0.7, body, 0.05, 0.16, 0, g);
    this.box(0.5, 0.04, 0.72, mat('#2b2b2b'), 0.05, 0.02, 0, g);
    this.box(0.3, 0.3, 0.5, body, 0.12, 0.47, 0, g);
    this.frankHead = this.box(0.18, 0.12, 0.2, mat('#2b2b2b', { metalness: 0.5 }), -0.16, 0.42, 0, g);
    this.box(0.05, 0.05, 0.62, mat('#1a1a1a'), -0.2, 0.33, 0, g);
    const sc = screenCanvas(96, 48);
    this.frankScreen = { g: sc.g, tex: sc.tex };
    this.drawFrankScreen('INSERT MAIL');
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), new THREE.MeshBasicMaterial({ map: sc.tex }));
    screen.position.set(-0.04, 0.55, 0);
    screen.rotation.y = -Math.PI / 2;
    g.add(screen);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.1), std({ map: textTexture(['FRANK-O-TRON 64'], { w: 256, h: 64, bg: '#1a1a1a', fg: '#e8c46a', font: PX }) }));
    plate.position.set(-0.201, 0.2, 0);
    plate.rotation.y = -Math.PI / 2;
    g.add(plate);
    g.userData.interact = { kind: 'franker' } satisfies Interact;
    this.franker = g;
    this.scene.add(g);
    this.interactables.push(g);
    this.prop('mail_lever', dx + 0.1, 0.83, dz + 0.75, -Math.PI / 2);
    // Ink pad, rubber stamps and a mug
    this.box(0.16, 0.03, 0.1, mat('#7a1d12'), dx - 0.2, 0.845, dz - 0.75);
    for (let i = 0; i < 3; i++) {
      this.box(0.04, 0.09, 0.04, mat('#6e4b2a'), dx + 0.1 + i * 0.08, 0.875, dz - 0.75);
      this.box(0.06, 0.03, 0.06, mat('#222'), dx + 0.1 + i * 0.08, 0.84, dz - 0.75);
    }
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 10), mat('#ecf0f1'));
    mug.position.set(dx + 0.25, 0.88, dz - 0.45);
    this.scene.add(mug);
    // A partition behind the desk, with notices pinned to it
    const part = std({ map: plasterTex([1, 1]), color: '#a8b0a0' });
    this.box(0.08, 2.2, 2.2, part, dx + 0.52, 1.1, dz);
    this.box(0.1, 0.06, 2.24, mat('#3b2a1a'), dx + 0.52, 2.22, dz);
    this.colliders.push(aabb(dx + 0.52, dz, 0.1, 2.2, 2.2, true, 'partition'));
    this.sign(['FRANKING', 'every letter needs one'], 1.3, 0.45, dx + 0.47, 1.85, dz, -Math.PI / 2, { bg: '#7a2416', fg: '#f3e6c8', font: PX });
    this.sign(['POSTAGE RATES', 'letter: 0.85', 'parcel: 4.00', 'thumb: 0.85'], 0.6, 0.6, dx + 0.47, 1.25, dz - 0.75, -Math.PI / 2, { bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' });
    this.sign(['DO NOT', 'FRANK', 'YOURSELF'], 0.45, 0.45, dx + 0.47, 1.2, dz + 0.8, -Math.PI / 2, { bg: '#f1c40f', fg: '#1a1a1a' });
    // Two sheets of commemorative stamps, lying around
    for (const [sx, sz] of [[dx - 0.12, dz - 0.4], [dx + 0.18, dz - 0.15]]) {
      const it = new Item(STAMPS_DEF);
      it.state = 'fixed';
      it.mesh.position.set(sx, 0.83 + it.baseOffset, sz);
      it.mesh.rotation.y = 0.3;
      this.scene.add(it.mesh);
      this.initialItems.push(it);
    }
  }

  drawFrankScreen(text: string, color = '#7cff6a'): void {
    const { g, tex } = this.frankScreen;
    g.fillStyle = '#06140a';
    g.fillRect(0, 0, 96, 48);
    g.fillStyle = color;
    g.font = '10px monospace';
    g.textAlign = 'center';
    text.split('\n').forEach((l, i, a) => g.fillText(l, 48, 26 + (i - (a.length - 1) / 2) * 12));
    tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- parcels: roll cages, racks, loading bay

  private cagesRow(): void {
    const wireF = new THREE.MeshStandardMaterial({ map: wireTex([2, 3]), transparent: true, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5, depthWrite: false });
    const wireS = new THREE.MeshStandardMaterial({ map: wireTex([2, 3]), transparent: true, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5, depthWrite: false });
    const frame = mat('#9aa09a', { metalness: 0.6, roughness: 0.4 });
    const wheel = mat('#1a1a1a');
    T.REGIONS.forEach((reg, i) => {
      const z = CAGE_ZS[i];
      const g = new THREE.Group();
      g.position.set(CAGE_X, 0, z);
      g.rotation.y = (i % 2 ? 1 : -1) * 0.04;
      const W = 0.95;
      const D = 1.2;
      const Hc = 1.7;
      this.box(W, 0.04, D, frame, 0, 0.16, 0, g);
      for (const [x, zz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) {
        this.box(0.035, Hc, 0.035, frame, x, 0.14 + Hc / 2, zz, g);
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8), wheel);
        w.rotation.z = Math.PI / 2;
        w.position.set(x, 0.07, zz);
        g.add(w);
      }
      const plane = (w: number, m: THREE.Material, x: number, zz: number, ry: number) => {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(w, Hc - 0.1), m);
        p.position.set(x, 0.18 + (Hc - 0.1) / 2, zz);
        p.rotation.y = ry;
        g.add(p);
      };
      plane(W, wireF, 0, -D / 2, 0);
      plane(W, wireF, 0, D / 2, 0);
      plane(D, wireS, -W / 2, 0, Math.PI / 2);
      // The front (east) is open, with one bar across
      this.box(0.03, 0.03, D, frame, W / 2, 1.0, 0, g);
      // Region plate on the cage and a hanging sign above
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.32), std({ map: textTexture([reg.name, `codes ${reg.digits.join(', ')}xxxx`], { w: 256, h: 100, bg: reg.color, fg: '#ffffff', border: '#ffffff', font: PX }) }));
      plate.position.set(W / 2 + 0.02, 1.45, 0);
      plate.rotation.y = Math.PI / 2;
      g.add(plate);
      const cage: Cage = { idx: i, name: reg.name, digits: reg.digits, color: reg.color, pos: new THREE.Vector3(CAGE_X, 0.18, z), front: new THREE.Vector3(CAGE_X + 1.35, 0, z), entries: [], stack: [] };
      g.userData.interact = { kind: 'cage', cage } satisfies Interact;
      this.scene.add(g);
      this.interactables.push(g);
      this.cages.push(cage);
      this.colliders.push(aabb(CAGE_X, z, 1.0, 1.25, 1.85, false, 'cage'));
      // A couple of old parcels already inside
      const r = rng(900 + i);
      const n = 1 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++) {
        const b = this.box(0.4, 0.26, 0.34, std({ map: kraftTex(k + i) }), CAGE_X - 0.15 + (r() - 0.5) * 0.2, 0.31 + k * 0.27, z + (k % 2 ? 0.25 : -0.25));
        b.rotation.y = (r() - 0.5) * 0.4;
      }
      // Hanging sign from the ceiling
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), std({ map: textTexture([reg.name], { w: 256, h: 96, bg: reg.color, fg: '#ffffff', border: '#ffffff', font: PX }), side: THREE.DoubleSide }));
      sg.position.set(CAGE_X + 0.2, 2.75, z);
      sg.rotation.y = Math.PI / 2;
      this.scene.add(sg);
      for (const s of [-1, 1]) this.box(0.015, H - 3.0, 0.015, mat('#333'), CAGE_X + 0.2, (H + 3.0) / 2, z + s * 0.6);
    });
    this.sign(['PARCELS BY REGION', 'shake nothing'], 2.4, 0.6, -13.97, 3.6, 0, Math.PI / 2, { bg: '#2c3e50', fg: '#f1c40f', border: '#f1c40f', font: PX });
  }

  private bagRacks(): void {
    const frame = std({ map: rackTex([1, 3]), metalness: 0.4 });
    const sack = std({ map: sackTex() });
    const r = rng(31);
    for (const zc of [-4, 0, 4]) {
      const x = -13.55;
      for (const s of [-1, 1]) this.box(0.06, 2.1, 0.06, frame, x, 1.05, zc + s * 1.6);
      this.box(0.06, 0.06, 3.3, frame, x, 2.05, zc);
      this.box(0.06, 0.06, 3.3, frame, x + 0.25, 2.05, zc);
      for (let i = 0; i < 5; i++) {
        const z = zc - 1.3 + i * 0.65;
        if (r() < 0.15) continue;
        const bag = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), sack);
        bag.scale.set(0.9, 1.6 + r() * 0.4, 0.8);
        bag.position.set(x + 0.15, 1.35 - r() * 0.15, z);
        bag.rotation.y = r() * 3;
        this.scene.add(bag);
        this.box(0.02, 0.3, 0.02, mat('#c8b07a'), x + 0.15, 1.9, z);
      }
    }
    this.colliders.push(aabb(-13.55, 0, 0.75, 11.5, 2.1, false, 'racks'));
    this.sign(['MAIL BAGS', 'property of the postal unit', 'not sleeping bags'], 2.2, 0.7, -13.97, 2.65, -4, Math.PI / 2, { bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' });
  }

  private loadingBay(): void {
    const door = std({ map: corrugatedTex([1, 3]), color: '#8a96a0' });
    this.box(0.1, 2.9, 2.8, door, -13.95, 1.45, -8.3);
    this.box(0.15, 0.25, 3.2, hazardMat(), -13.9, 3.0, -8.3);
    for (const s of [-1, 1]) {
      this.box(0.3, 1.0, 0.3, hazardMat(), -13.7, 0.5, -8.3 + s * 1.65);
      this.colliders.push(aabb(-13.7, -8.3 + s * 1.65, 0.3, 0.3, 1.0, false, 'post'));
    }
    this.sign(['LOADING BAY', 'robots only'], 2.0, 0.5, -13.88, 3.5, -8.3, Math.PI / 2, { bg: '#f1c40f', fg: '#1a1a1a', font: PX });
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), std({ map: hazardTex([4, 0.4]), transparent: true, opacity: 0.55 }));
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(-12.6, 0.004, -8.3);
    this.scene.add(stripe);
    this.prop('mail_handtruck', -12.9, 0, -6.4, 0.9);
    this.prop('mail_handtruck', -12.6, 0, -5.95, 1.3);
    this.colliders.push(aabb(-12.8, -6.2, 0.9, 0.9, 1.2, false, 'decor'));
  }

  // ---------------------------------------------------------------- counter, key and kitchen

  private counter(): void {
    const wood = std({ map: woodTex([3, 1]) });
    this.box(4.2, 1.0, 0.7, wood, -4, 0.5, 10.65);
    this.box(4.3, 0.06, 0.8, mat('#d8cfb4'), -4, 1.03, 10.65);
    this.colliders.push(aabb(-4, 10.65, 4.3, 0.8, 1.06, false, 'counter'));
    // Bell
    const bell = new THREE.Group();
    bell.position.set(-3.2, 1.06, 10.5);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d4ac0d', { metalness: 0.8, roughness: 0.3 }));
    bell.add(dome);
    this.box(0.16, 0.02, 0.16, mat('#2b2b2b'), 0, 0, 0, bell);
    bell.userData.interact = { kind: 'bell' } satisfies Interact;
    this.scene.add(bell);
    this.interactables.push(bell);
    this.bell = bell;
    // Scale, forms, a pen on a chain
    this.box(0.4, 0.08, 0.35, mat('#bdc3c7', { metalness: 0.5 }), -2.3, 1.1, 10.6);
    this.box(0.36, 0.01, 0.3, mat('#ecf0f1'), -2.3, 1.15, 10.6);
    for (let i = 0; i < 4; i++) this.box(0.21, 0.004, 0.3, mat(i % 2 ? '#fdf6e3' : '#d6eaf8'), -4.3 + i * 0.03, 1.065 + i * 0.004, 10.55);
    this.box(0.12, 0.012, 0.012, mat('#1a1a1a'), -3.8, 1.07, 10.4);
    this.prop('mail_screen', -5.6, 1.06, 10.55, Math.PI);
    const chair = this.prop('mail_chair', -4.4, 0, 9.6, Math.PI);
    if (chair) this.chairs.push(chair);
  }

  private keyHook(): void {
    const board = std({ map: woodTex([1, 1]) });
    this.box(0.05, 0.4, 1.2, board, -13.97, 1.95, 9.9);
    for (let i = 0; i < 4; i++) this.box(0.12, 0.03, 0.03, mat('#bdc3c7', { metalness: 0.7 }), -13.9, 1.95, 9.45 + i * 0.3);
    const bag = new Item(KEYBAG_DEF);
    bag.state = 'fixed';
    bag.mesh.position.set(-13.5, 0.62, 10.0);
    bag.mesh.rotation.y = Math.PI / 2;
    this.scene.add(bag.mesh);
    this.initialItems.push(bag);
    // The rope up to the hook
    this.box(0.02, 0.45, 0.02, mat('#c8b07a'), -13.62, 1.72, 10.0);
    this.sign(['TOILET KEY', 'do not break the chain'], 1.1, 0.45, -13.97, 2.6, 9.9, Math.PI / 2, { bg: '#ffffff', fg: '#c0392b', border: '#c0392b', font: PX });
    // Chain letters spilling onto the floor
    const r = rng(12);
    const paper = mat('#efe6cf');
    for (let i = 0; i < 9; i++) {
      const p = this.box(0.22, 0.004, 0.15, paper, -13.2 + r() * 0.9, 0.003 + i * 0.001, 9.4 + r() * 1.2);
      p.rotation.y = r() * Math.PI;
    }
  }

  private kitchen(): void {
    const x = 13.55;
    // Counter base along the east wall
    const base = std({ map: woodTex([3, 1]), color: '#b49a7a' });
    this.box(0.8, 0.9, 4.2, base, x, 0.45, 8.0);
    this.box(0.86, 0.05, 4.3, mat('#d8d2c0'), x, 0.925, 8.0);
    for (let i = 0; i < 5; i++) this.box(0.02, 0.7, 0.75, mat('#9a8060'), x - 0.41, 0.45, 6.3 + i * 0.85);
    this.colliders.push(aabb(x, 8.0, 0.85, 4.3, 0.95, true, 'kitchen'));
    this.prop('mail_fridge', x, 0, 10.5, -Math.PI / 2);
    this.colliders.push(aabb(x, 10.5, 0.8, 0.8, 1.0, true, 'fridge'));
    this.prop('mail_micro', x + 0.05, 0.95, 6.5, -Math.PI / 2);
    this.coffee = this.prop('mail_coffee', x + 0.05, 0.95, 7.2, -Math.PI / 2);
    // Toaster
    const toaster = new THREE.Group();
    toaster.position.set(x, 0.95, 7.85);
    if (!this.prop('mail_toaster', 0, 0, 0, -Math.PI / 2, toaster)) {
      this.box(0.3, 0.2, 0.18, mat('#bdc3c7', { metalness: 0.7, roughness: 0.3 }), 0, 0.1, 0, toaster);
    }
    toaster.userData.interact = { kind: 'toaster' } satisfies Interact;
    this.scene.add(toaster);
    this.interactables.push(toaster);
    this.toaster = toaster;
    // The kettle
    const k = new THREE.Group();
    k.position.set(x - 0.05, 0.95, 8.65);
    k.scale.setScalar(1.5);
    const chrome = mat('#c9cfd2', { metalness: 0.75, roughness: 0.25 });
    this.box(0.24, 0.03, 0.24, mat('#222'), 0, 0.015, 0, k);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.24, 12), chrome);
    body.position.y = 0.15;
    k.add(body);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.04, 12), chrome);
    lid.position.y = 0.29;
    k.add(lid);
    this.box(0.03, 0.03, 0.03, mat('#222'), 0, 0.32, 0, k);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.14, 8), chrome);
    spout.position.set(-0.13, 0.2, 0);
    spout.rotation.z = 0.9;
    k.add(spout);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 10, Math.PI), mat('#222'));
    handle.position.set(0.12, 0.17, 0);
    handle.rotation.z = -Math.PI / 2;
    k.add(handle);
    k.userData.interact = { kind: 'kettle' } satisfies Interact;
    this.scene.add(k);
    this.interactables.push(k);
    this.kettle = k;
    const steamM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.32, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), steamM);
      p.visible = false;
      this.scene.add(p);
      this.steam.push(p);
    }
    this.sign(['KETTLE', 'for tea only.', 'definitely not for', 'steaming envelopes.'], 1.1, 0.75, x + 0.38, 1.85, 8.65, -Math.PI / 2, { bg: '#fdf6e3', fg: '#7a2416', border: '#7a2416' });
    // Sink, mugs, a sad sponge
    this.box(0.5, 0.05, 0.5, mat('#9aa3a8', { metalness: 0.6 }), x, 0.955, 9.4);
    const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6), chrome);
    tap.position.set(x + 0.25, 1.08, 9.4);
    this.scene.add(tap);
    for (let i = 0; i < 4; i++) {
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 10), mat(['#c0392b', '#ecf0f1', '#2e86c1', '#f1c40f'][i]));
      mug.position.set(x - 0.2 + (i % 2) * 0.12, 1.0, 9.9 + Math.floor(i / 2) * 0.12);
      this.scene.add(mug);
    }
    this.box(0.1, 0.04, 0.07, mat('#d4ac0d'), x - 0.1, 0.97, 9.15);
    // Upper cabinets
    const cab = std({ map: woodTex([2, 1]), color: '#c9b08a' });
    this.box(0.45, 0.7, 4.2, cab, x + 0.18, 2.55, 8.0);
    for (let i = 0; i < 5; i++) this.box(0.02, 0.6, 0.75, mat('#a08560'), x - 0.05, 2.55, 6.3 + i * 0.85);
    this.sign(['CLEAN UP', 'AFTER YOURSELF', 'your mother', 'is a toaster'], 0.9, 0.6, x + 0.38, 3.35, 6.6, -Math.PI / 2, { bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' });
    // Break table with chairs and a vintage TV
    const tw = std({ map: woodTex([1, 1]), color: '#c0a07a' });
    this.box(1.6, 0.05, 1.0, tw, 10.6, 0.76, 8.5);
    for (const [lx, lz] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) this.box(0.05, 0.76, 0.05, mat('#555'), 10.6 + lx, 0.38, 8.5 + lz);
    this.colliders.push(aabb(10.6, 8.5, 1.6, 1.0, 0.8, false, 'table'));
    for (const [cx, cz, cr] of [[10.0, 7.6, 0.2], [11.3, 9.45, Math.PI + 0.3]]) {
      const c = this.prop('mail_chair', cx, 0, cz, cr);
      if (c) this.chairs.push(c);
    }
    this.breakTv = this.prop('mail_tv', 10.9, 0.79, 8.6, -0.6);
    this.box(0.3, 0.02, 0.22, mat('#fdf6e3'), 10.2, 0.79, 8.3);
    const donut = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.025, 6, 10), mat('#c68a4a'));
    donut.rotation.x = Math.PI / 2;
    donut.position.set(10.25, 0.81, 8.3);
    this.scene.add(donut);
    this.sign(['BREAK ROOM', 'breaks are a privilege'], 2.2, 0.55, 10.6, 3.4, 10.97, Math.PI, { bg: '#7a2416', fg: '#f3e6c8', border: '#f3e6c8', font: PX });
  }

  // ---------------------------------------------------------------- SORT-O-MATIC

  private sortomatic(): void {
    const g = new THREE.Group();
    g.position.set(-2.6, 0, 2.2);
    const body = new THREE.Group();
    g.add(body);
    const steel = std({ map: steelTex([2, 2]), color: '#c9b37a', metalness: 0.35 });
    const dark = mat('#2b2b2b', { metalness: 0.5 });
    this.box(2.2, 1.6, 1.4, steel, 0, 0.9, 0, body);
    this.box(2.3, 0.1, 1.5, dark, 0, 0.05, 0, body);
    this.box(2.3, 0.08, 1.5, dark, 0, 1.72, 0, body);
    // Intake hopper on top
    if (!this.prop('mail_hopper', -0.4, 1.74, 0, 0, body)) {
      const hop = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.25, 0.5, 4), steel);
      hop.position.set(-0.4, 2.0, 0);
      hop.rotation.y = Math.PI / 4;
      body.add(hop);
    }
    // Robot arms on the sides
    const armL = this.prop('mail_arm', 0.75, 1.74, -0.35, Math.PI / 2, body);
    if (armL) armL.scale.multiplyScalar(0.8);
    // Face screen on the east side
    const sc = screenCanvas(96, 64);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.53), new THREE.MeshBasicMaterial({ map: sc.tex }));
    face.position.set(1.135, 1.15, 0);
    face.rotation.y = Math.PI / 2;
    body.add(face);
    this.box(0.04, 0.65, 0.95, dark, 1.1, 1.15, 0, body);
    // Name plate, vents, output chute to the south
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.22), std({ map: textTexture([T.SORTO_NAME], { w: 512, h: 96, bg: '#1a1a1a', fg: '#f1c40f', font: PX }) }));
    plate.position.set(0, 1.45, 0.705);
    body.add(plate);
    for (let i = 0; i < 5; i++) this.box(0.6, 0.03, 0.01, dark, -0.5, 0.5 + i * 0.1, 0.705, body);
    this.box(0.6, 0.06, 0.5, steel, 0.5, 0.6, 0.9, body);
    this.box(0.6, 0.25, 0.04, steel, 0.5, 0.72, 1.14, body);
    this.box(0.5, 0.4, 0.04, mat('#0c0c0c'), 0.5, 0.85, 0.71, body);
    // Warning beacon
    const beacon = new THREE.MeshStandardMaterial({ color: '#ff8c1a', emissive: '#ff6a00', emissiveIntensity: 0.2 });
    const bc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 10), beacon);
    bc.position.set(0.7, 1.85, 0.4);
    body.add(bc);
    // Pipes into the wall of nothing
    const pipeM = mat('#6d7b6a', { metalness: 0.5 });
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), pipeM);
    p.position.set(-0.9, 3.0, -0.4);
    body.add(p);
    g.userData.interact = { kind: 'sortomatic' } satisfies Interact;
    this.scene.add(g);
    this.interactables.push(g);
    this.machine = {
      group: g,
      face: sc,
      beacon,
      body,
      outlet: new THREE.Vector3(-2.1, 0.9, 3.4),
      front: new THREE.Vector3(-0.8, 0, 2.2),
    };
    this.colliders.push(aabb(-2.6, 2.2, 2.35, 1.55, 2.0, true, 'sortomatic'));
    this.sign(['DO NOT FEED', 'THE MACHINE', 'it bites back'], 1.0, 0.6, -2.6, 0.95, 1.48, Math.PI, { bg: '#f1c40f', fg: '#1a1a1a', border: '#1a1a1a' });
  }

  // ---------------------------------------------------------------- other furniture

  private centerTable(): void {
    const wood = std({ map: woodTex([2, 1]) });
    const cx = 5.0;
    const cz = 3.0;
    this.box(2.6, 0.06, 1.2, wood, cx, 0.88, cz);
    for (const [lx, lz] of [[-1.2, -0.5], [1.2, -0.5], [-1.2, 0.5], [1.2, 0.5]]) this.box(0.07, 0.85, 0.07, mat('#3b2a1a'), cx + lx, 0.43, cz + lz);
    this.box(2.4, 0.03, 1.0, wood, cx, 0.25, cz);
    this.colliders.push(aabb(cx, cz, 2.6, 1.2, 0.92, false, 'table'));
    const r = rng(55);
    const papers = [mat('#efe6cf'), mat('#e8dcc0'), mat('#dde6ee'), mat('#f3efe6')];
    for (let i = 0; i < 26; i++) {
      const e = this.box(0.24, 0.01, 0.15, papers[i % 4], cx + (r() - 0.5) * 2.3, 0.915 + Math.floor(r() * 4) * 0.011, cz + (r() - 0.5) * 1.0);
      e.rotation.y = r() * Math.PI;
    }
    // Trays, a tape gun, a lamp, boxes underneath
    const trayM = mat('#5d6d7e');
    for (const dx of [-0.9, 0.9]) {
      this.box(0.5, 0.03, 0.36, trayM, cx + dx, 0.93, cz - 0.3);
      for (const s of [-1, 1]) this.box(0.5, 0.08, 0.02, trayM, cx + dx, 0.96, cz - 0.3 + s * 0.18);
    }
    this.box(0.14, 0.1, 0.06, mat('#c0392b'), cx + 0.3, 0.96, cz + 0.35);
    for (let i = 0; i < 3; i++) {
      const b = this.box(0.5, 0.3, 0.4, boxMaterials(i + 2), cx - 0.8 + i * 0.7, 0.42, cz + (i % 2 ? 0.2 : -0.2));
      b.rotation.y = (r() - 0.5) * 0.3;
    }
    this.sign(['SORT HERE', '(nobody does)'], 1.0, 0.4, cx, 1.25, cz + 0.62, 0, { bg: '#fdf6e3', fg: '#7a2416' });
  }

  private bradDesk(): void {
    this.prop('mail_desk', 10.8, 0, 2.6, -Math.PI / 2);
    this.prop('mail_screen', 10.95, 0.78, 2.6, -Math.PI / 2);
    this.prop('mail_radio', 10.95, 0.78, 3.3, -Math.PI / 2);
    this.coatRack = this.prop('mail_coatrack', 12.9, 0, 4.3);
    this.colliders.push(aabb(10.8, 2.6, 0.9, 1.7, 0.8, false, 'desk'));
    this.sign(['BRAD', 'Supervisor Unit-7', 'does not sit'], 0.6, 0.25, 10.4, 0.88, 2.6, -Math.PI / 2, { bg: '#1a1a1a', fg: '#e8c46a' });
    const radio: Interact = { kind: 'sign', text: 'Brad\'s radio. It only plays the hold music of the tax office.' };
    const rb = this.box(0.3, 0.25, 0.25, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), 10.95, 0.92, 3.3);
    rb.userData.interact = radio;
    this.interactables.push(rb);
    this.prop('mail_bookcase', 13.7, 0, 0.6, -Math.PI / 2);
    this.prop('mail_bookcase', 13.7, 0, -0.5, -Math.PI / 2);
    this.colliders.push(aabb(13.7, 0.05, 0.6, 2.2, 2.0, true, 'bookcase'));
  }

  // ---------------------------------------------------------------- atmosphere

  private ceilingStuff(): void {
    const duct = std({ map: ductTex([14, 1]), metalness: 0.3 });
    const d1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 28, 10), duct);
    d1.rotation.z = Math.PI / 2;
    d1.position.set(0, 4.15, -3.5);
    this.scene.add(d1);
    for (let x = -12; x <= 12; x += 4) this.box(0.06, 0.4, 0.7, duct, x, 4.45, -3.5);
    const pipeR = mat('#9e2a1e');
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 22, 6), pipeR);
    p1.rotation.x = Math.PI / 2;
    p1.position.set(-8, 4.35, 0);
    this.scene.add(p1);
    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 28, 6), mat('#70757b'));
    p2.rotation.z = Math.PI / 2;
    p2.position.set(0, 4.4, 6.5);
    this.scene.add(p2);
    // Cable tray with dangling wires
    const tray = mat('#5a5a5a', { metalness: 0.5 });
    this.box(0.4, 0.05, 20, tray, 7.5, 4.0, 0);
    const wire = mat('#1a1a1a');
    for (let z = -8; z <= 8; z += 3.2) {
      const w = this.box(0.015, 0.5, 0.015, wire, 7.5 + (z % 2) * 0.1, 3.75, z);
      w.rotation.z = 0.1;
    }
    // Ceiling fans
    for (const [x, z] of [[-6, 4], [2, -2]] as [number, number][]) {
      const f = this.prop('mail_fan', x, H - 0.7, z);
      if (f) this.fans.push(f);
    }
    // Security cameras
    const camBody = mat('#d8d8d2');
    const camDark = mat('#1a1a1a');
    const led = new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 2 });
    for (const [x, y, z, yaw] of [[-13.6, 4.0, -10.6, Math.PI * 0.25], [13.6, 4.0, 10.6, -Math.PI * 0.75], [-13.6, 4.0, 10.6, Math.PI * 0.75], [8.6, 4.0, -6.8, -Math.PI * 0.3]] as [number, number, number, number][]) {
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
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), led);
      l.position.set(0.06, 0.06, 0.18);
      g.add(l);
      this.leds.push(l);
      this.scene.add(g);
      this.cameras.push(g);
    }
    // A clock that is always nearly five
    const sc = screenCanvas(64, 64);
    this.clockFace = { g: sc.g, tex: sc.tex };
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), new THREE.MeshBasicMaterial({ map: sc.tex }));
    clock.position.set(13.97, 3.1, -2.6);
    clock.rotation.y = -Math.PI / 2;
    this.scene.add(clock);
  }

  private clutter(): void {
    const r = rng(4242);
    // Piles of parcels
    const pile = (cx: number, cz: number, w: number, d: number, levels: number, seed: number) => {
      const pr = rng(seed);
      const cols = Math.max(1, Math.round(w / 0.55));
      const rows = Math.max(1, Math.round(d / 0.55));
      let top = 0;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const n = 1 + Math.floor(pr() * levels);
          let y = 0;
          for (let k = 0; k < n; k++) {
            const bw = 0.4 + pr() * 0.15;
            const bh = 0.28 + pr() * 0.2;
            const b = this.box(bw, bh, 0.4 + pr() * 0.12, boxMaterials(Math.floor(pr() * 7)), cx - w / 2 + (i + 0.5) * (w / cols), y + bh / 2, cz - d / 2 + (j + 0.5) * (d / rows));
            b.rotation.y = (pr() - 0.5) * 0.4;
            y += bh;
          }
          top = Math.max(top, y);
        }
      }
      this.colliders.push(aabb(cx, cz, w, d, top, true, 'boxes'));
    };
    pile(13.4, -4.6, 1.0, 3.0, 3, 1);
    pile(-8.9, -10.2, 1.3, 1.0, 3, 2);
    pile(7.6, 10.3, 1.0, 0.9, 2, 3);
    pile(-13.2, 7.0, 1.1, 1.3, 2, 4);
    pile(12.7, -1.8, 0.6, 0.6, 2, 5);
    // Floor sacks
    const sack = std({ map: sackTex() });
    const burlap = std({ map: burlapTex() });
    for (const [x, z, s] of [[-12.2, -10.3, 1], [-11.6, -10.1, 0.9], [5.6, -9.9, 1.1], [6.3, -10.3, 0.9], [-7.6, 9.9, 1], [12.6, 5.2, 0.8]] as [number, number, number][]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 8, 6), r() < 0.5 ? sack : burlap);
      b.scale.set(1.2, 0.8, 1);
      b.position.set(x, 0.22 * s, z);
      b.rotation.y = r() * 3;
      this.scene.add(b);
      this.colliders.push(aabb(x, z, 0.6 * s, 0.6 * s, 0.4, false, 'sack'));
    }
    // Filing cabinets along the east wall
    const cab = std({ map: cabinetTex() });
    for (const z of [-6.2]) {
      this.box(0.6, 1.3, 0.6, cab, 13.6, 0.65, z);
      this.colliders.push(aabb(13.6, z, 0.6, 0.6, 1.3, true, 'cabinet'));
    }
    // Pillars with hazard stripes
    const pillar = std({ map: concreteTex([1, 6]) });
    for (const [x, z] of [[-7.5, -2.5], [8.6, -3.8], [-7.5, 6.0]] as [number, number][]) {
      this.box(0.6, H, 0.6, pillar, x, H / 2, z);
      this.box(0.64, 0.5, 0.64, hazardMat(), x, 0.25, z);
      this.colliders.push(aabb(x, z, 0.64, 0.64, H, true, 'pillar'));
    }
    // Trash cans, a fire extinguisher, a water cooler
    for (const [tx, tz] of [[2.2, -10.5], [-0.4, 10.4]]) {
      const t = this.prop('mail_trash', tx, 0, tz);
      if (t) this.trashCans.push(t);
    }
    const red = mat('#b3160c');
    for (const [x, z] of [[-13.85, -2.2], [13.85, 4.8], [7.0, -10.85]] as [number, number][]) {
      const e = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.45, 8), red);
      e.position.set(x, 0.75, z);
      this.scene.add(e);
    }
    const cooler = new THREE.Group();
    cooler.position.set(-9.6, 0, 10.6);
    this.box(0.35, 1.0, 0.35, mat('#dfe6e9'), 0, 0.5, 0, cooler);
    const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 10), new THREE.MeshStandardMaterial({ color: '#8fc6e8', transparent: true, opacity: 0.7 }));
    jug.position.set(0, 1.2, 0);
    cooler.add(jug);
    this.scene.add(cooler);
    this.cooler = cooler;
    this.coolerCol = aabb(-9.6, 10.6, 0.4, 0.4, 1.4, false, 'cooler');
    this.colliders.push(this.coolerCol);
    // Scraps of paper and stains on the floor
    // Torn scraps and rubber bands, smaller and greyer than real mail so nobody tries to sort them
    const scrap = new THREE.MeshStandardMaterial({ color: '#a89f88', roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 });
    for (let i = 0; i < 30; i++) {
      const x = -13 + r() * 26;
      const z = -10 + r() * 20;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.04 + r() * 0.07, 0.03 + r() * 0.05), i % 4 ? scrap : mat('#9e2a1e'));
      p.rotation.set(-Math.PI / 2, 0, r() * Math.PI);
      p.position.set(x, 0.004, z);
      this.scene.add(p);
    }
    const stainMat = new THREE.MeshBasicMaterial({ color: '#4a3a22', transparent: true, opacity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    for (const [x, z, s] of [[-3, -6, 0.6], [5.5, -2, 0.5], [0.5, 5.5, 0.7], [-9, 2.5, 0.45], [9, 6, 0.5], [-5, 8.5, 0.4], [3, 8, 0.35], [10.5, -5, 0.55], [12.6, 8.4, 0.4]] as [number, number, number][]) {
      const m = new THREE.Mesh(blobGeometry(s), stainMat);
      m.position.set(x, 0.005, z);
      this.scene.add(m);
    }
    // A wet floor sign that nobody moved since 2063
    this.sign(['CAUTION', 'floor is', 'always wet'], 0.4, 0.5, 9.2, 0.3, -0.6, 0.4, { bg: '#f1c40f', fg: '#1a1a1a' });
  }

  /** Things in the middle of the hall, so it does not look like an empty gym. */
  private floorClutter(): void {
    const r = rng(808);
    // Stacks of grey plastic mail trays
    const trayM = mat('#6c7a80');
    const trayIn = mat('#3e4a50');
    const trays = (cx: number, cz: number, n: number, rot: number) => {
      const g = new THREE.Group();
      g.position.set(cx, 0, cz);
      g.rotation.y = rot;
      for (let i = 0; i < n; i++) {
        const t = this.box(0.62, 0.16, 0.42, trayM, (r() - 0.5) * 0.04, 0.08 + i * 0.165, (r() - 0.5) * 0.04, g);
        t.rotation.y = (r() - 0.5) * 0.08;
        this.box(0.56, 0.01, 0.36, trayIn, 0, 0.165 + i * 0.165, 0, g);
      }
      // letters standing in the top tray
      const top = n * 0.165;
      for (let k = 0; k < 9; k++) this.box(0.008, 0.12, 0.2, mat(['#efe6cf', '#e8dcc0', '#dde6ee'][k % 3]), -0.24 + k * 0.06, top + 0.05, 0, g);
      this.scene.add(g);
      this.colliders.push(aabb(cx, cz, 0.7, 0.7, top + 0.1, false, 'trays'));
    };
    trays(0.6, -2.6, 4, 0.3);
    trays(1.4, -2.4, 2, -0.2);
    trays(-9.2, -8.6, 5, 0.1);
    trays(12.8, -6.9, 3, 0.5);
    // A trolley of sacks waiting for nobody
    const tg = new THREE.Group();
    tg.position.set(-5.0, 0, -5.0);
    tg.rotation.y = 0.5;
    const frame = mat('#4a5a6a', { metalness: 0.5 });
    this.box(1.4, 0.05, 0.8, frame, 0, 0.3, 0, tg);
    this.box(0.04, 0.9, 0.8, frame, -0.7, 0.75, 0, tg);
    this.box(0.04, 0.04, 0.8, frame, -0.72, 1.18, 0, tg);
    for (const [x, z] of [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10), mat('#1a1a1a'));
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.1, z);
      tg.add(w);
    }
    const sack = std({ map: sackTex() });
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), sack);
      b.scale.set(1.1, 0.75, 0.9);
      b.position.set(-0.35 + (i % 2) * 0.6, 0.5 + Math.floor(i / 2) * 0.3, (i % 2 ? 0.15 : -0.15));
      tg.add(b);
    }
    this.scene.add(tg);
    // No collider: the mischief module makes the trolley a movable item.
    this.trolley = tg;
    // Staff lockers on the east wall
    const lockM = std({ map: steelTex([1, 2]), color: '#7f9a8c' });
    for (let i = 0; i < 4; i++) {
      const z = -3.0 + i * 0.52;
      this.box(0.5, 1.9, 0.5, lockM, 13.72, 0.95, z);
      for (let k = 0; k < 3; k++) this.box(0.01, 0.02, 0.3, mat('#2b2b2b'), 13.465, 1.6 + k * 0.05, z);
      this.box(0.01, 0.08, 0.03, mat('#c9c3a6', { metalness: 0.6 }), 13.465, 1.1, z + 0.17);
    }
    this.colliders.push(aabb(13.72, -2.2, 0.52, 2.1, 1.9, true, 'lockers'));
    this.sign(['STAFF LOCKERS', 'yours is the one', 'that does not open'], 1.4, 0.55, 13.97, 2.3, -2.2, -Math.PI / 2, { bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' });
    // Hanging banner over the hall
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 0.7),
      std({ map: textTexture(['PEAK SEASON: ALWAYS'], { w: 1024, h: 120, bg: '#7a2416', fg: '#f1c40f', border: '#f1c40f', font: PX }), side: THREE.DoubleSide }),
    );
    banner.position.set(2, 3.5, -0.5);
    this.scene.add(banner);
    for (const s of [-1, 1]) this.box(0.015, 1.1, 0.015, mat('#333'), 2 + s * 2.9, 4.05, -0.5);
    // A pallet with a shrink wrapped tower of parcels by the loading bay
    if (!this.prop('pallet', -11.2, 0, -9.9)) this.box(1.2, 0.14, 1.0, std({ map: woodTex([1, 1]) }), -11.2, 0.07, -9.9);
    for (let y = 0; y < 3; y++) {
      for (const [x, z] of [[-0.28, -0.22], [0.28, -0.22], [-0.28, 0.22], [0.28, 0.22]]) {
        const b = this.box(0.52, 0.36, 0.42, boxMaterials((y * 4 + Math.round(x * 10)) & 7), -11.2 + x, 0.33 + y * 0.37, -9.9 + z);
        b.rotation.y = (r() - 0.5) * 0.08;
      }
    }
    const wrap = new THREE.Mesh(new THREE.BoxGeometry(1.14, 1.12, 0.94), new THREE.MeshStandardMaterial({ color: '#dfe8ee', transparent: true, opacity: 0.22, roughness: 0.2, depthWrite: false }));
    wrap.position.set(-11.2, 0.71, -9.9);
    this.scene.add(wrap);
    this.colliders.push(aabb(-11.2, -9.9, 1.25, 1.05, 1.3, true, 'pallet'));
  }

  private posters(): void {
    const style: TextTexOpts = { bg: '#fdf6e3', fg: '#2c3e50', border: '#c0392b' };
    const spots: [number, number, number, number][] = [
      [-13.97, 2.8, -1.8, Math.PI / 2],
      [13.97, 2.8, -4.4, -Math.PI / 2],
      [8.0, 2.8, 10.97, Math.PI],
      [-9.0, 3.2, -10.97, 0],
      [13.97, 2.6, 3.8, -Math.PI / 2],
    ];
    T.POSTERS.forEach((lines, i) => {
      const s = spots[i % spots.length];
      this.sign(lines, 1.7, 1.1, s[0], s[1], s[2], s[3], style, 'A motivational poster. You feel slightly less motivated.');
    });
    // Wanted board
    const bx = 3.6;
    this.box(2.6, 1.4, 0.04, std({ map: corkTex() }), bx, 1.9, 10.98);
    this.box(2.7, 1.5, 0.03, mat('#5a3a1c'), bx, 1.9, 10.99);
    T.WANTED.forEach((lines, i) => {
      const p = this.sign(lines, 0.55, 0.75, bx - 0.9 + i * 0.6, 1.9 + (i % 2 ? -0.1 : 0.12), 10.95, Math.PI, { bg: '#f3e9c6', fg: '#3b2a1a', border: '#3b2a1a' }, 'A wanted poster. The reward is exposure.');
      p.rotation.z = (i % 2 ? 0.05 : -0.04);
    });
    this.sign(['WANTED'], 1.2, 0.3, bx, 2.82, 10.95, Math.PI, { bg: '#7a2416', fg: '#f3e6c8', font: PX });
    this.biteSign = this.sign(['DAYS SINCE THE LAST', 'DOG BITE: 0'], 2.0, 0.5, 6.6, 3.2, 10.97, Math.PI, { bg: '#111111', fg: '#ff4d4d', font: PX });
    this.sign(['STAMP OF THE MONTH', '75 years of Brad'], 1.4, 0.8, 13.97, 2.4, -1.2, -Math.PI / 2, { bg: '#f1c40f', fg: '#7a2416', border: '#7a2416' });
  }

  // ---------------------------------------------------------------- per frame

  private animate(t: number): void {
    if (this.beltRunning) this.belt.offset.x -= 0.006;
    this.flicker.intensity = t % 6.1 > 5.5 && Math.sin(t * 45) > 0 ? 3 : 13;
    for (const f of this.fans) f.rotation.y = t * 2.2;
    const on = Math.sin(t * 3) > 0;
    for (const l of this.leds) l.visible = on;
    // Steam from the kettle
    const kp = this.kettle.position;
    this.steam.forEach((p, i) => {
      p.visible = this.steaming;
      if (!this.steaming) return;
      const ph = (t * 0.8 + i / this.steam.length) % 1;
      p.position.set(kp.x - 0.3 + Math.sin(t * 2 + i) * 0.05 - ph * 0.15, kp.y + 0.45 + ph * 0.7, kp.z + Math.cos(t * 1.7 + i) * 0.05);
      p.scale.setScalar(0.6 + ph * 1.8);
      p.rotation.y = -Math.PI / 2;
    });
    // Dead letter drawer slides back in
    if (this.deadOpen > 0) this.deadOpen = Math.max(0, this.deadOpen - 0.016);
    this.deadDrawer.position.z = 0.03 + Math.min(1, this.deadOpen * 2) * 0.35;
    // Clock: always a few minutes before five
    const sec = Math.floor(t);
    if (sec !== this.lastClock) {
      this.lastClock = sec;
      const { g, tex } = this.clockFace;
      g.fillStyle = '#f3efe0';
      g.fillRect(0, 0, 64, 64);
      g.strokeStyle = '#1a1a1a';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(32, 32, 29, 0, Math.PI * 2);
      g.stroke();
      const hand = (a: number, len: number, w: number) => {
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(32, 32);
        g.lineTo(32 + Math.sin(a) * len, 32 - Math.cos(a) * len);
        g.stroke();
      };
      hand((4.9 / 12) * Math.PI * 2, 14, 3);
      hand((55 / 60) * Math.PI * 2, 22, 2);
      g.strokeStyle = '#c0392b';
      hand((sec % 60) / 60 * Math.PI * 2, 24, 1);
      tex.needsUpdate = true;
    }
  }
}

let hazardCache: THREE.MeshStandardMaterial | null = null;
function hazardMat(): THREE.MeshStandardMaterial {
  if (!hazardCache) hazardCache = std({ map: hazardTex([2, 1]) });
  return hazardCache;
}
function woodMat(): THREE.MeshStandardMaterial {
  return std({ map: woodTex([1, 1]) });
}
