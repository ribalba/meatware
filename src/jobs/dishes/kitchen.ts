import * as THREE from 'three';
import { instantiate } from '../../assets';
import { boxMaterials } from '../../details';
import { Item } from '../../items';
import { Interact, LevelKit } from '../../level';
import { aabb, blobGeometry, TextTexOpts, textTexture } from '../../util';
import { BREAD_DEF, CRYSTAL_DEF, DishType, MOP_DEF, SHELF_TYPES, SILVER_DEF, STOCKPOT_DEF, TYPE_LABEL } from './items';
import { checkerTex, crateTex, damaskTex, kitchenCeilTex, quarryTex, steelTex, wallTileDarkTex, wallTileTex, wireTex } from './textures';

/**
 * The steamy back kitchen of Le Robot Gourmand, plus a peek into the candle-lit dining room.
 *
 * Floor plan (x to the right, z towards the viewer, north = -z):
 *   north wall: dish pit (clean table, dishwasher, sink, scraping table, scrap bin, cart with the dirty pile),
 *               swinging doors to the dining room, the pass with heat lamps
 *   west wall:  clean shelves (plates, bowls, glasses, cutlery), mop, pot sink
 *   middle:     the cooking range with the pot rack above it (the chef's kingdom)
 *   east wall:  wine station of the sommelier, fridges, produce
 *   south-west: walk-in freezer and the stock pot with the toilet key
 *   south-east: the staff toilet
 */

export const ROOM = { minX: -12, maxX: 12, minZ: -9, maxZ: 9 };
const WALL_H = 3.6;
const TILE = 0.6;
/** x range of the swinging doors and of the pass hatch in the north wall. */
export const DOORS = { x0: 0, x1: 2 };
export const HATCH = { x0: 4, x1: 6.6, y0: 1.02, y1: 2.1 };

export interface ShelfUnit {
  type: Exclude<DishType, 'pot'>;
  group: THREE.Group;
  /** Where the dishes go, in world space, front to back and bottom to top. */
  slots: THREE.Vector3[];
  /** Where a robot stands to use it. */
  front: THREE.Vector3;
}

/** Props the mischief code (mischief.ts) turns into breakables, movables and secrets. */
export interface DishesRefs {
  wetSign: THREE.Group;
  trash: THREE.Object3D[];
  barrels: THREE.Object3D[];
  bucket: THREE.Group;
  freezer: THREE.Group;
  decanter: THREE.Object3D | null;
  cams: THREE.Group[];
  firePoster: THREE.Mesh;
  sprinklers: THREE.Mesh[];
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
const PIX = '"Press Start 2P", monospace';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class Kitchen extends LevelKit {
  // ---- what the job drives
  pileAnchor = new THREE.Group();
  pileTub = new THREE.Group();
  pileCart = new THREE.Group();
  binMound!: THREE.Mesh;
  binMoundFood = new THREE.Group();
  sprayHead = new THREE.Vector3(-6.6, 1.28, -8.55);
  sinkSpot = new THREE.Vector3(-6.6, 0.83, -8.55);
  stream!: THREE.Mesh;
  sprayNozzle!: THREE.Object3D;
  washerHood = new THREE.Group();
  rackSpot = new THREE.Vector3(-9.5, 0.9, -8.62);
  washerVent = new THREE.Vector3(-9.5, 2.75, -8.7);
  washerBody = new THREE.Group();
  shelves = {} as Record<Exclude<DishType, 'pot'>, ShelfUnit>;
  potSinkSpot = new THREE.Vector3(-11.45, 0.72, 3.6);
  brush = new THREE.Group();
  potRack = new THREE.Group();
  potHooks: THREE.Vector3[] = [];
  stoveSteam: THREE.Vector3[] = [];
  doorL = new THREE.Group();
  doorR = new THREE.Group();
  doorAngle = 0;
  doorTarget = 0;
  doorTimer = 0;
  stockPot!: Item;
  mop!: Item;
  refs = { trash: [], barrels: [], cams: [], sprinklers: [], decanter: null } as unknown as DishesRefs;
  // ---- spots for the robots
  readonly chefSpots = [new THREE.Vector3(2.3, 0, -4.75), new THREE.Vector3(3.7, 0, -4.75), new THREE.Vector3(5.1, 0, -4.75), new THREE.Vector3(6.2, 0, -4.75)];
  readonly passSpot = new THREE.Vector3(5.3, 0, -7.75);
  readonly dropSpot = new THREE.Vector3(-0.75, 0, -7.75);
  readonly doorInside = new THREE.Vector3(1.0, 0, -8.1);
  readonly doorOutside = new THREE.Vector3(1.0, 0, -11.5);
  readonly wineSpot = new THREE.Vector3(10.4, 0, -4.6);
  readonly potSinkFront = new THREE.Vector3(-10.5, 0, 3.6);
  readonly sinkFront = new THREE.Vector3(-6.6, 0, -7.6);
  readonly floorDrain = new THREE.Vector3(-6.3, 0, -6.4);

  private breakCanvas!: HTMLCanvasElement;
  private breakTex!: THREE.CanvasTexture;
  private lcdCanvas!: HTMLCanvasElement;
  private lcdTex!: THREE.CanvasTexture;
  private lastLcd = '';
  private diners: { mixer: THREE.AnimationMixer }[] = [];
  private lastT = 0;
  private fans: THREE.Object3D[] = [];
  private flickerLamp!: THREE.PointLight;
  private candles: { light: THREE.PointLight; flames: THREE.Mesh[] }[] = [];
  private heatLamps: THREE.Mesh[] = [];
  private flames: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    super(scene);
    this.bounds = ROOM;
    this.ceiling = 3.4;
    this.spawn = { pos: new THREE.Vector3(-2.9, 0, -4.3), yaw: 0.5 };
    this.bossWaypoints.push(
      new THREE.Vector3(-6, 0, -5.6),
      new THREE.Vector3(-1.5, 0, -5.2),
      new THREE.Vector3(1.2, 0, -1.6),
      new THREE.Vector3(8.2, 0, -6.2),
      new THREE.Vector3(9, 0, -0.8),
      new THREE.Vector3(4, 0, 1.6),
      new THREE.Vector3(-4, 0, 0.8),
      new THREE.Vector3(-8.5, 0, 5.6),
      new THREE.Vector3(-1.5, 0, 6.6),
      new THREE.Vector3(3.6, 0, 6.6),
      new THREE.Vector3(-9.4, 0, -2.6),
    );
    this.lights();
    this.room();
    this.northWall();
    this.diningRoom();
    this.dishPit();
    this.cleanShelves();
    this.potSink();
    this.range();
    this.pass();
    this.wineStation();
    this.eastSide();
    this.southSide();
    this.middle();
    this.toiletCorner();
    this.ceilingStuff();
    this.clutter();
    this.posters();
    this.onTick((t) => this.animate(t));
  }

  // ================================================================ helpers

  private add<T extends THREE.Object3D>(o: T, parent: THREE.Object3D = this.scene): T {
    parent.add(o);
    return o;
  }

  private cyl(rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, seg = 12, parent: THREE.Object3D = this.scene): THREE.Mesh {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    c.position.set(x, y, z);
    parent.add(c);
    return c;
  }

  private pixSign(lines: string[], w: number, h: number, x: number, y: number, z: number, rotY: number, opts: TextTexOpts = {}, text?: string): THREE.Mesh {
    const s = this.sign(lines, w, h, x, y, z, rotY, { font: PIX, ...opts }, text);
    const m = s.material as THREE.MeshStandardMaterial;
    if (m.map) m.map.magFilter = THREE.NearestFilter;
    return s;
  }

  /** A model at a spot, or nothing. */
  private model(key: string, x: number, y: number, z: number, rotY = 0, parent: THREE.Object3D = this.scene, scale = 1): THREE.Object3D | null {
    const o = this.prop(key, x, y, z, rotY, parent);
    if (o && scale !== 1) o.scale.setScalar(scale);
    return o;
  }

  /** An invisible box that makes a small or busy station easier to aim at. */
  private hitBox(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Kitchen.ghostMat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  private static ghostMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

  private interactive(o: THREE.Object3D, info: Interact): void {
    o.userData.interact = info;
    this.interactables.push(o);
  }

  /** A tiled wall piece between two corners. Dark tiles below 1.2 m, white above. */
  private wallPiece(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): void {
    const w = Math.max(0.05, x1 - x0);
    const d = Math.max(0.05, z1 - z0);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const along = Math.max(w, d);
    const split = 1.2;
    if (y0 < split) {
      const top = Math.min(split, y1);
      const m = std({ map: wallTileDarkTex([along / TILE, (top - y0) / TILE]) });
      this.box(w, top - y0, d, m, cx, (y0 + top) / 2, cz);
    }
    if (y1 > split) {
      const bot = Math.max(split, y0);
      const m = std({ map: wallTileTex([along / TILE, (y1 - bot) / TILE]) });
      this.box(w, y1 - bot, d, m, cx, (bot + y1) / 2, cz);
    }
  }

  // ================================================================ shell

  private lights(): void {
    this.scene.background = new THREE.Color('#15110e');
    this.add(new THREE.HemisphereLight('#fff0d8', '#4e3b2c', 1.15));
    const d = new THREE.DirectionalLight('#ffe9c8', 0.4);
    d.position.set(4, 10, 6);
    this.add(d);
    const spots: [number, number, string, number][] = [
      [-7.5, -6.5, '#e8f2ff', 16],
      [-10, -2.5, '#fff1d6', 12],
      [-1.5, -5.5, '#fff1d6', 12],
      [4, -3.5, '#ffd49a', 16],
      [0, 2.5, '#fff1d6', 14],
      [-7, 5.5, '#ffe6b8', 12],
      [9, -2, '#ffe6b8', 12],
      [5, 6, '#ffd9a0', 10],
    ];
    spots.forEach(([x, z, c, i], n) => {
      const l = new THREE.PointLight(c, i, 13, 1.6);
      l.position.set(x, 2.95, z);
      this.add(l);
      if (n === 1) this.flickerLamp = l;
    });
  }

  private room(): void {
    const W = ROOM.maxX - ROOM.minX;
    const D = ROOM.maxZ - ROOM.minZ;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D, W, D), std({ map: quarryTex([W, D]), roughness: 0.55 }));
    floor.rotation.x = -Math.PI / 2;
    this.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D, W / 2, D / 2), std({ map: kitchenCeilTex([W / 2, D / 2]), roughness: 0.95 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = WALL_H;
    this.add(ceil);
    // south, west and east walls (north is built with its openings)
    this.wallPiece(-12.4, 12.4, 9, 9.4, 0, WALL_H);
    this.wallPiece(-12.4, -12, -9.4, 9.4, 0, WALL_H);
    this.wallPiece(12, 12.4, -9.4, 9.4, 0, WALL_H);
    this.colliders.push(aabb(0, 9.2, 24.8, 0.4, 5, false), aabb(-12.2, 0, 0.4, 18.8, 5, false), aabb(12.2, 0, 0.4, 18.8, 5, false));
    // steel cove skirting
    const skirt = std({ map: steelTex([8, 1]), metalness: 0.4 });
    this.box(24, 0.12, 0.04, skirt, 0, 0.06, 8.98);
    this.box(0.04, 0.12, 18, skirt, -11.98, 0.06, 0);
    this.box(0.04, 0.12, 18, skirt, 11.98, 0.06, 0);
    // a grimy band where the tiles change colour
    const band = std({ color: '#2a2018' });
    this.box(24, 0.05, 0.03, band, 0, 1.2, 8.985);
    this.box(0.03, 0.05, 18, band, -11.985, 1.2, 0);
    this.box(0.03, 0.05, 18, band, 11.985, 1.2, 0);
  }

  private northWall(): void {
    const z0 = -9.4;
    const z1 = -9;
    this.wallPiece(-12.4, DOORS.x0, z0, z1, 0, WALL_H);
    this.wallPiece(DOORS.x0, DOORS.x1, z0, z1, 2.4, WALL_H);
    this.wallPiece(DOORS.x1, HATCH.x0, z0, z1, 0, WALL_H);
    this.wallPiece(HATCH.x0, HATCH.x1, z0, z1, 0, HATCH.y0);
    this.wallPiece(HATCH.x0, HATCH.x1, z0, z1, HATCH.y1, WALL_H);
    this.wallPiece(HATCH.x1, 12.4, z0, z1, 0, WALL_H);
    this.box(24, 0.05, 0.03, std({ color: '#2a2018' }), 0, 1.2, -8.985);
    this.colliders.push(
      aabb((-12.4 + DOORS.x0) / 2, -9.2, 12.4 + DOORS.x0, 0.4, 5, true, 'wall'),
      aabb((DOORS.x1 + HATCH.x0) / 2, -9.2, HATCH.x0 - DOORS.x1, 0.4, 5, true, 'wall'),
      aabb((HATCH.x0 + HATCH.x1) / 2, -9.2, HATCH.x1 - HATCH.x0, 0.4, HATCH.y0, false, 'wall'),
      aabb((HATCH.x1 + 12.4) / 2, -9.2, 12.4 - HATCH.x1, 0.4, 5, true, 'wall'),
      // humans may not enter the dining room. The guests must not see one.
      aabb((DOORS.x0 + DOORS.x1) / 2, -9.15, DOORS.x1 - DOORS.x0, 0.5, 2.4, false, 'dwDoorway'),
    );

    // The swinging doors
    const steel = std({ map: steelTex([1, 2]), metalness: 0.5, roughness: 0.4 });
    const kick = std({ color: '#5b5f62', metalness: 0.6, roughness: 0.4 });
    const port = new THREE.MeshBasicMaterial({ color: '#ffb35c' });
    const rim = std({ color: '#2b2b2b', metalness: 0.6 });
    const mk = (pivot: THREE.Group, dir: number) => {
      const p = this.box(0.95, 2.3, 0.06, steel, dir * 0.485, 1.17, 0, pivot);
      this.box(0.03, 2.3, 0.07, std({ color: '#1d1f21' }), dir * 0.96, 1.17, 0, pivot);
      p.userData.interact = { kind: 'sign', text: 'The doors to the dining room. Humans must not be seen by the guests. It ruins the illusion that nobody works here.' } satisfies Interact;
      this.interactables.push(p);
      this.box(0.9, 0.35, 0.07, kick, dir * 0.5, 0.2, 0, pivot);
      for (const s of [-1, 1]) {
        const w = this.cyl(0.17, 0.17, 0.075, port, dir * 0.5, 1.62, 0, 16, pivot);
        w.rotation.x = Math.PI / 2;
        w.position.z = s * 0.001;
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 16), rim);
        r.position.set(dir * 0.5, 1.62, s * 0.04);
        pivot.add(r);
      }
    };
    const frame = std({ color: '#3b3f42', metalness: 0.6, roughness: 0.4 });
    this.box(0.1, 2.45, 0.5, frame, DOORS.x0 - 0.03, 1.22, -9.2);
    this.box(0.1, 2.45, 0.5, frame, DOORS.x1 + 0.03, 1.22, -9.2);
    this.box(DOORS.x1 - DOORS.x0 + 0.16, 0.1, 0.5, frame, (DOORS.x0 + DOORS.x1) / 2, 2.43, -9.2);
    this.box(DOORS.x1 - DOORS.x0, 0.02, 0.5, std({ color: '#7a2a1a' }), (DOORS.x0 + DOORS.x1) / 2, 0.01, -9.2);
    this.doorL.position.set(DOORS.x0 + 0.02, 0, -9.2);
    this.doorR.position.set(DOORS.x1 - 0.02, 0, -9.2);
    mk(this.doorL, 1);
    mk(this.doorR, -1);
    this.add(this.doorL);
    this.add(this.doorR);
    this.pixSign(['DINING ROOM', 'NO HUMANS BEYOND THIS POINT'], 2.2, 0.42, 1, 2.75, -8.97, 0, { bg: '#1c1c1c', fg: '#ffcc33', border: '#ffcc33' });
    this.pixSign(['IN'], 0.5, 0.3, 0.5, 2.05, -8.9, 0, { bg: '#27ae60', fg: '#ffffff' });
    this.pixSign(['OUT'], 0.5, 0.3, 1.5, 2.05, -8.9, 0, { bg: '#c0392b', fg: '#ffffff' });
  }

  // ================================================================ dining room (look only)

  private diningRoom(): void {
    const x0 = -3;
    const x1 = 10;
    const zf = -17;
    const zn = -9.4;
    const w = x1 - x0;
    const d = zn - zf;
    const cx = (x0 + x1) / 2;
    const cz = (zn + zf) / 2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d, w, d), std({ map: checkerTex([w, d]), roughness: 0.35 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0.002, cz);
    this.add(floor);
    const wall = std({ map: damaskTex([w * 2, 6]) });
    this.box(w, 3.4, 0.2, wall, cx, 1.7, zf - 0.1);
    this.box(0.2, 3.4, d, std({ map: damaskTex([d * 2, 6]) }), x0 - 0.1, 1.7, cz);
    this.box(0.2, 3.4, d, std({ map: damaskTex([d * 2, 6]) }), x1 + 0.1, 1.7, cz);
    this.box(w, 0.2, d, std({ color: '#1a0c0c' }), cx, 3.45, cz);
    // wood panelling and gold trim
    const panel = std({ color: '#3a1e12', roughness: 0.6 });
    this.box(w, 1.0, 0.05, panel, cx, 0.5, zf + 0.02);
    this.box(w, 0.05, 0.06, std({ color: '#b8902f', metalness: 0.7 }), cx, 1.02, zf + 0.03);
    // the guests
    const tables: [number, number][] = [[5.3, -10.9], [-0.4, -11.2], [3.0, -12.8], [7.6, -12.8], [1.4, -15.2], [5.2, -15.6], [8.6, -15.4]];
    const white = std({ color: '#f4efe4' });
    const candleMat = std({ color: '#f3e9cf' });
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ffcc55' });
    const foods = ['dwTurkey', 'dwCake', 'dwHam', 'dwPie', 'dwFoodFish', 'dwFoodMeat'];
    tables.forEach(([tx, tz], i) => {
      // round table with a long white cloth
      this.cyl(0.62, 0.68, 0.76, white, tx, 0.38, tz, 18);
      this.cyl(0.66, 0.66, 0.02, white, tx, 0.77, tz, 18);
      // the tables near the openings seat their guests sideways, so the kitchen can see them
      const side = i < 2;
      const seats = side ? [Math.PI / 2, -Math.PI / 2] : [0, Math.PI];
      // plates, untouched
      for (const a of seats) {
        this.model('dwPlate', tx + Math.sin(a) * 0.35, 0.78, tz + Math.cos(a) * 0.35);
        this.model(foods[(i + (a > 0 ? 3 : 0)) % foods.length], tx + Math.sin(a) * 0.35, 0.8, tz + Math.cos(a) * 0.35, i, this.scene, 0.4);
        this.model('dwGlass', tx + Math.sin(a + 0.6) * 0.42, 0.78, tz + Math.cos(a + 0.6) * 0.42);
      }
      // a candle
      this.cyl(0.025, 0.025, 0.2, candleMat, tx, 0.88, tz, 8);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 6), flameMat);
      fl.position.set(tx, 1.02, tz);
      this.add(fl);
      if (i === 0 || i === 2) {
        const l = new THREE.PointLight('#ff9a3c', 4, 5, 1.8);
        l.position.set(tx, 1.3, tz);
        this.add(l);
        this.candles.push({ light: l, flames: [fl] });
      } else if (this.candles.length) this.candles[this.candles.length - 1].flames.push(fl);
      // the diners
      seats.forEach((a, k) => {
        if (!side && (i + k) % 3 === 2) return;
        const kind = (i + k) % 2 ? 'robotExpressive' : 'robotKenney';
        const inst = instantiate(kind);
        const px = tx + Math.sin(a) * 0.85;
        const pz = tz + Math.cos(a) * 0.85;
        this.model('dwChair', px, 0, pz, a + Math.PI);
        if (!inst) return;
        inst.object.position.set(px, 0.05, pz);
        inst.object.rotation.y = a + Math.PI;
        this.add(inst.object);
        const mixer = new THREE.AnimationMixer(inst.inner);
        const clip = inst.animations.find((c) => c.name === (kind === 'robotKenney' ? 'sit' : 'Sitting'));
        if (clip) {
          const act = mixer.clipAction(clip);
          if (kind === 'robotExpressive') {
            act.setLoop(THREE.LoopOnce, 1);
            act.clampWhenFinished = true;
          }
          act.play();
          mixer.update(5 + i);
        }
        this.diners.push({ mixer });
      });
    });
    // chandelier
    const gold = std({ color: '#c9a23a', metalness: 0.8, roughness: 0.3 });
    const ch = new THREE.Group();
    ch.position.set(3.5, 2.9, -13.6);
    this.cyl(0.5, 0.5, 0.05, gold, 0, 0, 0, 16, ch);
    this.cyl(0.01, 0.01, 0.5, gold, 0, 0.27, 0, 4, ch);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.cyl(0.02, 0.02, 0.14, candleMat, Math.cos(a) * 0.48, 0.09, Math.sin(a) * 0.48, 6, ch);
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 5), flameMat);
      f.position.set(Math.cos(a) * 0.48, 0.19, Math.sin(a) * 0.48);
      ch.add(f);
    }
    this.add(ch);
    const cl = new THREE.PointLight('#ffb060', 7, 9, 1.6);
    cl.position.set(3.5, 2.6, -13.6);
    this.add(cl);
    const neon = this.pixSign(['LE ROBOT GOURMAND', 'fine dining. no eating.'], 4.4, 0.9, 3.5, 2.5, zf + 0.12, 0, { bg: '#120608', fg: '#ff4fa3', border: '#ff4fa3' });
    neon.material = new THREE.MeshBasicMaterial({ map: (neon.material as THREE.MeshStandardMaterial).map });
    // a grand piano shape and a palm
    const black = std({ color: '#111111', roughness: 0.3 });
    this.box(1.5, 0.3, 1.0, black, 8.6, 0.85, -10.8).rotation.y = 0.3;
    this.box(0.08, 0.7, 0.08, black, 8.1, 0.35, -10.5);
    this.box(0.08, 0.7, 0.08, black, 9.1, 0.35, -10.9);
    this.model('plant', -2.4, 0, -10.2);
    this.model('plant', 9.4, 0, -16.3);
  }

  // ================================================================ the dish pit along the north wall

  private dishPit(): void {
    const steel = std({ map: steelTex([2, 1]), metalness: 0.55, roughness: 0.35 });
    const steelTop = std({ map: steelTex([3, 1]), metalness: 0.65, roughness: 0.25 });
    const dark = std({ color: '#2a2d30', metalness: 0.5 });
    const zc = -8.62;
    const dep = 0.75;
    /** A steel counter between two x values on the north wall. */
    const counter = (x0: number, x1: number, h = 0.9) => {
      const w = x1 - x0;
      this.box(w, h - 0.04, dep - 0.06, steel, (x0 + x1) / 2, (h - 0.04) / 2, zc - 0.02);
      this.box(w, 0.04, dep, steelTop, (x0 + x1) / 2, h - 0.02, zc);
      // splash back
      this.box(w, 0.25, 0.03, steelTop, (x0 + x1) / 2, h + 0.12, -8.98);
      // undershelf with junk
      this.box(w - 0.1, 0.03, dep - 0.12, dark, (x0 + x1) / 2, 0.2, zc);
      this.colliders.push(aabb((x0 + x1) / 2, zc, w, dep, h, true, 'counter'));
    };

    // ---- clean landing table in the corner
    counter(-11.95, -10.1);
    for (let i = 0; i < 3; i++) {
      // stacked spare racks
      const r = this.box(0.5, 0.1, 0.5, std({ color: '#2f6d8c' }), -11.3, 0.95 + i * 0.1, -8.6);
      r.rotation.y = i * 0.07;
    }
    this.pixSign(['CLEAN', 'SIDE'], 0.6, 0.3, -10.6, 1.45, -8.97, 0, { bg: '#2e86c1', fg: '#ffffff' });

    // ---- the dishwasher
    const wx = -9.5;
    const body = this.washerBody;
    this.box(1.2, 0.86, dep, steel, 0, 0.43, 0, body);
    this.box(1.24, 0.04, dep + 0.02, steelTop, 0, 0.88, 0, body);
    // inside of the chamber (dark, wet)
    this.box(1.14, 0.9, 0.04, dark, 0, 1.35, -0.34, body);
    this.box(0.04, 0.9, dep - 0.04, dark, -0.58, 1.35, 0, body);
    this.box(0.04, 0.9, dep - 0.04, dark, 0.58, 1.35, 0, body);
    // spray arms
    const arm = this.box(0.9, 0.03, 0.05, std({ color: '#9aa3a8', metalness: 0.6 }), 0, 0.93, 0, body);
    arm.name = 'arm';
    // the motor housing on top
    this.box(1.3, 0.55, dep + 0.05, steel, 0, 2.62, 0, body);
    const brand = this.pixSign(['SCRUBMASTER 3000'], 1.1, 0.2, 0, 0, 0, 0, { bg: '#c0392b', fg: '#ffffff' });
    brand.position.set(0, 2.62, dep / 2 + 0.035);
    body.add(brand);
    // the hood that lifts
    const hood = this.washerHood;
    this.box(1.22, 0.86, 0.04, steel, 0, 0.43, dep / 2, hood);
    this.box(0.04, 0.86, dep, steel, -0.6, 0.43, 0, hood);
    this.box(0.04, 0.86, dep, steel, 0.6, 0.43, 0, hood);
    this.box(1.22, 0.04, dep, steel, 0, 0.86, 0, hood);
    const handle = this.box(0.9, 0.05, 0.06, std({ color: '#222222' }), 0, 0.12, dep / 2 + 0.04, hood);
    handle.name = 'handle';
    hood.position.y = 0.9 + 0.78;
    body.add(hood);
    // the control panel: LCD and the big green button
    this.lcdCanvas = document.createElement('canvas');
    this.lcdCanvas.width = 128;
    this.lcdCanvas.height = 48;
    this.lcdTex = new THREE.CanvasTexture(this.lcdCanvas);
    this.lcdTex.magFilter = THREE.NearestFilter;
    this.lcdTex.colorSpace = THREE.SRGBColorSpace;
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.16), new THREE.MeshBasicMaterial({ map: this.lcdTex }));
    lcd.position.set(-0.25, 0.64, dep / 2 + 0.006);
    body.add(lcd);
    this.setLcd(['READY', 'RACK 0/9']);
    const btnBase = this.box(0.16, 0.16, 0.04, dark, 0.3, 0.64, dep / 2 + 0.02, body);
    const btn = this.cyl(0.055, 0.06, 0.06, std({ color: '#27ae60', emissive: '#1d8a49', emissiveIntensity: 0.6 }), 0.3, 0.64, dep / 2 + 0.06, 12, body);
    btn.rotation.x = Math.PI / 2;
    btnBase.userData.interact = btn.userData.interact = { kind: 'dwWasherBtn' } satisfies Interact;
    this.interactables.push(btn, btnBase);
    const label = this.pixSign(['WASH'], 0.18, 0.07, 0, 0, 0, 0, { bg: '#111111', fg: '#7dff7d' });
    label.position.set(0.3, 0.76, dep / 2 + 0.01);
    body.add(label);
    // the vent pipe into the ceiling
    this.cyl(0.12, 0.12, 0.8, std({ color: '#8d9599', metalness: 0.5 }), -0.2, 3.25, -0.1, 10, body);
    body.position.set(wx, 0, zc);
    this.add(body);
    this.interactive(body, { kind: 'dwWasher' });
    this.colliders.push(aabb(wx, zc, 1.24, dep, 0.9, true, 'washer'));

    // ---- soiled landing table
    counter(-8.9, -7.6);
    this.pixSign(['DIRTY', 'SIDE'], 0.6, 0.3, -8.25, 1.45, -8.97, 0, { bg: '#8e5a2b', fg: '#ffffff' });

    // ---- the sink with the pre-rinse sprayer
    const sx0 = -7.6;
    const sx1 = -5.6;
    const scx = (sx0 + sx1) / 2;
    this.box(2, 0.7, dep - 0.06, steel, scx, 0.35, zc - 0.02);
    // basin walls and the dark wet bottom
    this.box(2, 0.04, 0.12, steelTop, scx, 0.88, -8.3);
    this.box(2, 0.04, 0.1, steelTop, scx, 0.88, -8.93);
    this.box(0.12, 0.04, dep, steelTop, sx0 + 0.06, 0.88, zc);
    this.box(0.12, 0.04, dep, steelTop, sx1 - 0.06, 0.88, zc);
    this.box(0.04, 0.2, dep - 0.2, steelTop, scx, 0.8, zc);
    const water = this.box(1.75, 0.02, 0.52, std({ color: '#5c6a5a', roughness: 0.1, metalness: 0.2 }), scx, 0.72, zc);
    water.name = 'sinkWater';
    this.box(1.76, 0.18, 0.02, dark, scx, 0.8, -8.36);
    this.box(2, 0.3, 0.03, steelTop, scx, 1.05, -8.98);
    // floating lettuce and a lost spoon
    this.model('dwFoodSalad', scx - 0.4, 0.71, zc + 0.05, 1, this.scene, 0.6);
    this.model('dwSpoon', scx + 0.5, 0.73, zc - 0.1, 0.7);
    // the sprayer: riser, gooseneck, spring and head
    const chrome = std({ color: '#d5dade', metalness: 0.85, roughness: 0.2 });
    const px = this.sprayHead.x;
    this.cyl(0.04, 0.04, 1.4, chrome, px, 1.6, -8.9, 8);
    const goose = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 12, Math.PI), chrome);
    goose.position.set(px, 2.3, -8.73);
    goose.rotation.y = Math.PI / 2;
    this.add(goose);
    for (let i = 0; i < 12; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 4, 10), chrome);
      coil.rotation.x = Math.PI / 2;
      coil.position.set(px, 2.25 - i * 0.065, -8.56);
      this.add(coil);
    }
    const nozzle = new THREE.Group();
    nozzle.position.copy(this.sprayHead).setY(this.sprayHead.y + 0.12);
    this.cyl(0.05, 0.075, 0.22, chrome, 0, 0, 0, 10, nozzle);
    this.box(0.18, 0.05, 0.05, std({ color: '#b3160c' }), 0.09, 0.06, 0, nozzle);
    this.cyl(0.07, 0.07, 0.02, std({ color: '#1b1b1b' }), 0, -0.11, 0, 10, nozzle);
    this.add(nozzle);
    this.sprayNozzle = nozzle;
    this.stream = this.cyl(0.03, 0.06, this.sprayHead.y - this.sinkSpot.y, new THREE.MeshBasicMaterial({ color: '#cfefff', transparent: true, opacity: 0.55, depthWrite: false }), px, (this.sprayHead.y + this.sinkSpot.y) / 2, this.sprayHead.z, 10);
    this.stream.visible = false;
    // taps
    for (const tx of [scx - 0.6, scx + 0.55]) {
      this.cyl(0.02, 0.02, 0.25, chrome, tx, 1.12, -8.88, 6);
      const spout = this.box(0.04, 0.04, 0.22, chrome, tx, 1.24, -8.8);
      spout.rotation.x = 0.2;
      this.cyl(0.03, 0.03, 0.04, std({ color: '#c0392b' }), tx - 0.07, 1.26, -8.9, 8);
    }
    // soap and gloves
    this.box(0.12, 0.25, 0.09, std({ color: '#2ecc71' }), sx1 - 0.15, 1.04, -8.88);
    this.pixSign(['SOAP'], 0.11, 0.06, sx1 - 0.15, 1.08, -8.83, 0, { bg: '#ffffff', fg: '#1d8a49' });
    const glove = std({ color: '#f1c40f', roughness: 0.6 });
    this.box(0.12, 0.03, 0.26, glove, sx0 + 0.25, 1.01, -8.86).rotation.y = 0.4;
    this.colliders.push(aabb(scx, zc, 2, dep, 0.9, true, 'sink'));
    const sinkInfo: Interact = { kind: 'dwSink' };
    for (const o of this.scene.children.slice(-40)) {
      const m = o as THREE.Mesh;
      if (!m.isMesh) continue;
      if (Math.abs(m.position.x - scx) < 1.05 && m.position.z < -8.2 && m.position.y < 2.4 && !m.userData.interact) {
        m.userData.interact = sinkInfo;
        this.interactables.push(m);
      }
    }
    this.interactive(nozzle, sinkInfo);
    this.interactive(this.stream, sinkInfo);
    this.pixSign(['PRE-RINSE', 'hold the trigger.', 'not too long.'], 0.9, 0.42, px, 2.65, -8.97, 0, { bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' });

    // ---- scraping table with the chute and the scrap bin
    const tx0 = -5.6;
    const tx1 = -4.15;
    counter(tx0, tx1);
    const hole = this.cyl(0.16, 0.16, 0.05, std({ color: '#0d0d0d' }), (tx0 + tx1) / 2 + 0.3, 0.88, zc, 14);
    hole.userData.interact = { kind: 'dwBin' } satisfies Interact;
    this.interactables.push(hole);
    this.model('dwBoard', (tx0 + tx1) / 2 - 0.35, 0.9, zc, 0.2);
    this.model('dwSpatula', (tx0 + tx1) / 2 - 0.3, 0.94, zc + 0.05, 0.6);
    const binG = new THREE.Group();
    binG.position.set(-3.65, 0, -8.55);
    const binMat = std({ color: '#566650', roughness: 0.7 });
    const binBody = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.28, 0.88, 16, 1, true), std({ color: '#566650', roughness: 0.7, side: THREE.DoubleSide }));
    binBody.position.y = 0.44;
    binG.add(binBody);
    this.cyl(0.28, 0.28, 0.02, binMat, 0, 0.01, 0, 16, binG);
    const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.03, 6, 18), std({ color: '#3d4a38' }));
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.88;
    binG.add(rimMesh);
    this.binMound = this.cyl(0.3, 0.3, 0.04, std({ color: '#5a3c20', roughness: 1 }), 0, 0.72, 0, 16, binG);
    this.binMoundFood.position.y = 0.74;
    binG.add(this.binMoundFood);
    ['dwFoodFish', 'dwFoodMeat', 'dwFoodCroissant', 'dwFoodSushi', 'dwFoodRibs', 'dwFoodSalad', 'dwFoodPancakes'].forEach((k, i) => this.model(k, Math.cos(i * 1.7) * (0.05 + (i % 3) * 0.06), (i % 2) * 0.03, Math.sin(i * 1.7) * (0.05 + (i % 3) * 0.06), i, this.binMoundFood));
    const binSign = this.pixSign(['SCRAPS'], 0.4, 0.14, 0, 0, 0, 0, { bg: '#f1c40f', fg: '#2c3e50' });
    binSign.position.set(0, 0.6, 0.335);
    binG.add(binSign);
    this.add(binG);
    this.interactive(binG, { kind: 'dwBin' });
    this.colliders.push(aabb(-3.65, -8.55, 0.7, 0.7, 0.9, false, 'bin'));
    this.pixSign(['SCRAPE HERE', 'Untouched gourmet food only.'], 1.4, 0.42, -4.4, 1.75, -8.97, 0, { bg: '#fdf6e3', fg: '#8e2a1f', border: '#8e2a1f' });

    // ---- the cart with the dirty pile
    const cart = this.pileCart;
    cart.position.set(-1.75, 0, -8.4);
    const cartSteel = std({ map: steelTex([1, 1]), metalness: 0.6, roughness: 0.35 });
    this.box(1.0, 0.03, 0.65, cartSteel, 0, 0.85, 0, cart);
    this.box(1.0, 0.03, 0.65, cartSteel, 0, 0.3, 0, cart);
    for (const [x, z] of [[-0.47, -0.3], [0.47, -0.3], [-0.47, 0.3], [0.47, 0.3]] as [number, number][]) {
      this.cyl(0.015, 0.015, 0.85, cartSteel, x, 0.43, z, 6, cart);
      this.cyl(0.04, 0.04, 0.03, std({ color: '#222222' }), x, 0.04, z, 8, cart).rotation.z = Math.PI / 2;
    }
    // junk on the lower shelf
    this.model('dwPan', 0, 0.32, 0.05, 0.4, cart);
    this.pileAnchor.position.set(-0.2, 0.87, 0);
    cart.add(this.pileAnchor);
    // a grey bus tub for glasses and cutlery
    const tubM = std({ color: '#6c7073', roughness: 0.8 });
    this.box(0.42, 0.02, 0.5, tubM, 0.24, 0.875, 0, cart);
    for (const s of [-1, 1]) {
      this.box(0.42, 0.16, 0.02, tubM, 0.24, 0.95, s * 0.25, cart);
      this.box(0.02, 0.16, 0.5, tubM, 0.24 + s * 0.21, 0.95, 0, cart);
    }
    this.pileTub.position.set(0.24, 0.885, 0);
    cart.add(this.pileTub);
    this.hitBox(cart, 1.0, 1.2, 0.66, 0, 1.45, 0);
    this.add(cart);
    this.interactive(cart, { kind: 'dwPile' });
    this.colliders.push(aabb(-1.75, -8.4, 1.0, 0.65, 0.9, false, 'cart'));
    this.pixSign(['DIRTY DISHES', 'Please do not let it fall over.', 'It will fall over.'], 1.5, 0.48, -1.75, 2.6, -8.97, 0, { bg: '#fdf6e3', fg: '#2c3e50', border: '#c0392b' });

    // ---- the breakage counter
    this.breakCanvas = document.createElement('canvas');
    this.breakCanvas.width = 256;
    this.breakCanvas.height = 128;
    this.breakTex = new THREE.CanvasTexture(this.breakCanvas);
    this.breakTex.magFilter = THREE.NearestFilter;
    this.breakTex.colorSpace = THREE.SRGBColorSpace;
    const bs = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: this.breakTex }));
    bs.position.set(-8.3, 2.6, -8.97);
    this.add(bs);
    bs.userData.interact = { kind: 'sign', text: 'The breakage counter. Every broken dish is deducted from your wage. Gerald holds the record. Nobody knows where Gerald is now.' } satisfies Interact;
    this.interactables.push(bs);
    this.setBreakage(0, 0);

    // the floor drain in front of the sink
    const grate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), std({ map: wireTex([3, 3]), color: '#555555', alphaTest: 0.5 }));
    grate.rotation.x = -Math.PI / 2;
    grate.position.set(this.floorDrain.x, 0.025, this.floorDrain.z);
    this.add(grate);
    const hole2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), std({ color: '#0b0b0b' }));
    hole2.rotation.x = -Math.PI / 2;
    hole2.position.set(this.floorDrain.x, 0.02, this.floorDrain.z);
    this.add(hole2);
    // anti-fatigue mat
    const matM = std({ color: '#26221f', roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });
    const fm = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 0.9), matM);
    fm.rotation.x = -Math.PI / 2;
    fm.position.set(-6.9, 0.018, -7.75);
    this.add(fm);
  }

  setBreakage(n: number, cost: number): void {
    const g = this.breakCanvas.getContext('2d')!;
    g.fillStyle = '#111111';
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#ff3b3b';
    g.lineWidth = 4;
    g.strokeRect(3, 3, 250, 122);
    g.fillStyle = '#ffcc33';
    g.font = '12px "Press Start 2P", monospace';
    g.textAlign = 'center';
    g.fillText('DISHES BROKEN', 128, 26);
    g.fillText('THIS SHIFT', 128, 44);
    g.fillStyle = '#ff3b3b';
    g.font = '36px "Press Start 2P", monospace';
    g.fillText(String(n).padStart(2, '0'), 128, 90);
    g.fillStyle = '#bbbbbb';
    g.font = '9px "Press Start 2P", monospace';
    g.fillText(`-€${cost.toFixed(2)}  RECORD 41 (GERALD)`, 128, 116);
    this.breakTex.needsUpdate = true;
  }

  setLcd(lines: string[]): void {
    const key = lines.join('|');
    if (key === this.lastLcd) return;
    this.lastLcd = key;
    const g = this.lcdCanvas.getContext('2d')!;
    g.fillStyle = '#0d2a12';
    g.fillRect(0, 0, 128, 48);
    g.fillStyle = '#7dff7d';
    g.font = '10px "Press Start 2P", monospace';
    g.textAlign = 'center';
    lines.forEach((l, i) => g.fillText(l, 64, 20 + i * 16));
    this.lcdTex.needsUpdate = true;
  }

  // ================================================================ clean shelves on the west wall

  private cleanShelves(): void {
    const chrome = std({ color: '#c8cfd3', metalness: 0.75, roughness: 0.3 });
    const wire = std({ map: wireTex([6, 2]), color: '#dde3e6', metalness: 0.6, roughness: 0.3, alphaTest: 0.5, side: THREE.DoubleSide });
    const colors: Record<string, string> = { plate: '#2e86c1', bowl: '#d35400', glass: '#8e44ad', cutlery: '#27ae60' };
    const zs = [-7.2, -5.4, -3.6, -1.8];
    const sx = -11.62;
    const L = 1.6;
    const levels = [0.55, 1.0, 1.45];
    SHELF_TYPES.forEach((type, i) => {
      const z = zs[i];
      const g = new THREE.Group();
      g.position.set(sx, 0, z);
      for (const dz of [-L / 2, L / 2]) for (const dx of [-0.27, 0.27]) this.cyl(0.018, 0.018, 1.95, chrome, dx, 0.975, dz, 6, g);
      for (const y of [0.12, ...levels, 1.9]) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.02, L), wire);
        shelf.position.y = y;
        g.add(shelf);
        this.box(0.02, 0.03, L, chrome, 0.29, y + 0.01, 0, g);
      }
      // a label board
      const lab = this.pixSign([TYPE_LABEL[type], 'CLEAN ONLY'], 1.3, 0.36, 0, 0, 0, 0, { bg: colors[type], fg: '#ffffff', border: '#ffffff' });
      lab.position.set(0.33, 2.15, 0);
      lab.rotation.y = Math.PI / 2;
      g.add(lab);
      // stuff on top: detergent boxes and jugs
      const r = rng(70 + i);
      for (let k = 0; k < 3; k++) {
        const b = this.box(0.3, 0.24 + r() * 0.1, 0.25, boxMaterials(Math.floor(r() * 7)), (r() - 0.5) * 0.15, 2.05, -0.55 + k * 0.5, g);
        b.rotation.y = (r() - 0.5) * 0.3;
      }
      // bottom level: spare stuff
      if (type === 'plate') this.box(0.4, 0.3, 0.6, std({ color: '#e9e2cf' }), 0, 0.28, 0.3, g);
      if (type === 'glass') for (let k = 0; k < 2; k++) this.box(0.45, 0.1, 0.45, std({ color: '#2f6d8c' }), 0, 0.18 + k * 0.1, -0.3, g);
      if (type === 'cutlery') {
        this.cyl(0.12, 0.12, 0.3, std({ color: '#d9d2c3' }), 0, 0.28, 0.4, 10, g);
      }
      this.add(g);
      this.interactive(g, { kind: 'dwShelf', type });
      this.colliders.push(aabb(sx, z, 0.62, L + 0.05, 1.95, true, 'shelf'));
      const slots: THREE.Vector3[] = [];
      for (const y of levels) for (let k = 0; k < 3; k++) slots.push(new THREE.Vector3(sx + 0.05, y + 0.012, z - 0.5 + k * 0.5));
      this.shelves[type] = { type, group: g, slots, front: new THREE.Vector3(-10.5, 0, z) };
    });
  }

  // ================================================================ the pot sink on the west wall

  private potSink(): void {
    const steel = std({ map: steelTex([2, 1]), metalness: 0.55, roughness: 0.35 });
    const g = new THREE.Group();
    g.position.set(-11.45, 0, 3.6);
    this.box(0.95, 0.6, 2.2, steel, 0, 0.3, 0, g);
    this.box(0.95, 0.05, 0.1, steel, 0, 0.92, -1.05, g);
    this.box(0.95, 0.05, 0.1, steel, 0, 0.92, 1.05, g);
    this.box(0.1, 0.05, 2.2, steel, 0.43, 0.92, 0, g);
    for (const dz of [-0.36, 0.36]) this.box(0.95, 0.35, 0.04, steel, 0, 0.77, dz, g);
    this.box(0.04, 0.35, 2.2, steel, -0.44, 0.77, 0, g);
    for (const dz of [-0.72, 0, 0.72]) {
      const w = this.box(0.78, 0.02, 0.64, std({ color: '#4e5a4a', roughness: 0.1 }), 0, 0.68, dz, g);
      w.name = 'water';
    }
    // grey sad foam
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.05, 6, 4), std({ color: '#e8e8df' }));
      f.scale.y = 0.4;
      f.position.set((Math.random() - 0.5) * 0.6, 0.7, 0.72 + (Math.random() - 0.5) * 0.5);
      g.add(f);
    }
    // a tall tap and the brush
    const chrome = std({ color: '#d5dade', metalness: 0.85, roughness: 0.2 });
    this.cyl(0.025, 0.025, 0.9, chrome, -0.4, 1.35, 0, 8, g);
    this.box(0.4, 0.04, 0.04, chrome, -0.22, 1.78, 0, g);
    this.brush.position.set(0.05, 1.0, 0.65);
    const handleM = std({ color: '#b5651d' });
    this.box(0.07, 0.04, 0.3, handleM, 0, 0, 0, this.brush);
    this.box(0.08, 0.05, 0.18, std({ color: '#f0d060' }), 0, -0.04, -0.03, this.brush);
    this.brush.rotation.y = 0.4;
    g.add(this.brush);
    // wall shelf with cleaning chemicals
    this.box(0.3, 0.03, 1.8, steel, -0.35, 1.9, 0, g);
    const bottles = ['#e74c3c', '#2ecc71', '#f1c40f', '#3498db', '#9b59b6'];
    bottles.forEach((c, i) => this.cyl(0.05, 0.05, 0.24, std({ color: c }), -0.35, 2.03, -0.7 + i * 0.33, 8, g));
    this.add(g);
    this.interactive(g, { kind: 'dwPotSink' });
    this.colliders.push(aabb(-11.45, 3.6, 0.95, 2.2, 0.95, true, 'potsink'));
    this.pixSign(['POT SINK', 'Scrub until your arms', 'file a complaint.'], 1.6, 0.6, -11.97, 2.55, 3.6, Math.PI / 2, { bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' });
  }

  // ================================================================ the cooking range and the pot rack

  private range(): void {
    const steel = std({ map: steelTex([3, 1]), metalness: 0.55, roughness: 0.35 });
    const x0 = 1.5;
    const x1 = 6.7;
    const zc = -3.55;
    const cx = (x0 + x1) / 2;
    const w = x1 - x0;
    // the range body: steel, oven doors and knobs on both sides
    this.box(w, 0.92, 0.95, steel, cx, 0.46, zc);
    const ovenGlass = std({ color: '#1a1410', roughness: 0.2, metalness: 0.3 });
    const knobM = std({ color: '#141414', roughness: 0.4 });
    const chromeM = std({ color: '#d5dade', metalness: 0.85, roughness: 0.2 });
    const glowM = new THREE.MeshBasicMaterial({ color: '#ff6a1f' });
    for (const side of [-1, 1]) {
      const fz = zc + side * 0.478;
      for (let x = x0 + 0.55; x < x1 - 0.3; x += 1.05) {
        this.box(0.78, 0.4, 0.02, ovenGlass, x, 0.4, fz);
        this.box(0.66, 0.035, 0.05, chromeM, x, 0.66, fz + side * 0.03);
        const lamp = this.box(0.05, 0.03, 0.02, glowM, x + 0.3, 0.8, fz + side * 0.005);
        lamp.name = 'ovenLamp';
        for (let k = 0; k < 3; k++) {
          const kb = this.cyl(0.03, 0.03, 0.04, knobM, x - 0.25 + k * 0.17, 0.8, fz + side * 0.02, 8);
          kb.rotation.x = Math.PI / 2;
        }
      }
      this.box(w, 0.12, 0.02, std({ color: '#222222' }), cx, 0.06, fz + side * 0.002);
    }
    this.box(w + 0.05, 0.04, 1.0, std({ color: '#2a2a2a', metalness: 0.5 }), cx, 0.94, zc);
    // burners with flames
    const flame = new THREE.MeshBasicMaterial({ color: '#4fa3ff', transparent: true, opacity: 0.8 });
    const grate = std({ color: '#111111', metalness: 0.4 });
    const pots: [string, number, number][] = [['dwSaucepan', 2.0, -3.75], ['dwPan', 3.0, -3.35], ['dwPanStew', 4.1, -3.75], ['dwSteamer', 5.1, -3.35], ['dwPan', 6.1, -3.75]];
    for (const [key, x, z] of pots) {
      this.cyl(0.2, 0.2, 0.02, grate, x, 0.97, z, 10);
      const f = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 4, 12), flame);
      f.rotation.x = Math.PI / 2;
      f.position.set(x, 0.975, z);
      this.add(f);
      this.flames.push(f);
      this.model(key, x, 0.98, z, Math.random() * 6);
      this.stoveSteam.push(new THREE.Vector3(x, 1.15, z));
    }
    this.colliders.push(aabb(cx, zc, w + 0.05, 1.0, 0.95, true, 'range'));
    this.interactive(this.box(w, 0.1, 0.05, steel, cx, 0.86, zc - 0.5), { kind: 'sign', text: 'The range. Six burners. Robots do not eat. The burners are always on anyway.' });
    // the hood above the range
    const hoodM = std({ map: steelTex([4, 1]), metalness: 0.6, roughness: 0.3 });
    this.box(w + 0.4, 0.5, 1.5, hoodM, cx, 3.05, zc);
    const lip = this.box(w + 0.45, 0.08, 1.55, hoodM, cx, 2.78, zc);
    lip.name = 'lip';
    for (let x = x0 + 0.5; x < x1; x += 1.3) this.box(0.6, 0.02, 0.5, std({ color: '#333333', metalness: 0.4 }), x, 2.75, zc);
    this.box(0.6, 0.6, 0.6, hoodM, cx, 3.35, zc);
    // grease on the hood
    this.box(0.5, 0.02, 0.01, std({ color: '#6b4c1a' }), cx - 1, 2.9, zc + 0.76);
    // the pot rack (rail over the south side, outside the hood)
    const rail = std({ color: '#3a3a3a', metalness: 0.7, roughness: 0.3 });
    const rz = zc + 1.05;
    const rack = this.potRack;
    this.box(w - 0.6, 0.05, 0.05, rail, cx, 2.45, rz, rack);
    for (const x of [x0 + 0.4, x1 - 0.4]) this.cyl(0.015, 0.015, 1.1, rail, x, 3.0, rz, 5, rack);
    for (let i = 0; i < 8; i++) {
      const hx = x0 + 0.65 + i * ((w - 1.3) / 7);
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 4, 8, Math.PI * 1.4), rail);
      hook.position.set(hx, 2.39, rz);
      rack.add(hook);
      this.potHooks.push(new THREE.Vector3(hx, 2.33, rz));
    }
    this.hitBox(rack, w - 0.4, 0.75, 0.45, cx, 2.1, rz);
    this.add(rack);
    this.interactive(rack, { kind: 'dwPotRack' });
    const ps = this.pixSign(['POT RACK', 'clean pots only'], 1.2, 0.36, cx, 3.0, zc + 0.77, 0, { bg: '#111111', fg: '#ffcc33' });
    ps.userData.interact = { kind: 'dwPotRack' } satisfies Interact;
    this.interactables.push(ps);
    // ladles and utensils on a bar on the hood
    ['dwLadle', 'dwSpatula', 'dwWhisk', 'dwLadle'].forEach((k, i) => {
      const o = this.model(k, x0 + 0.7 + i * 0.35, 2.6, zc - 0.78, 0);
      if (o) o.rotation.z = Math.PI / 2;
    });
  }

  // ================================================================ the pass to the dining room

  private pass(): void {
    const steel = std({ map: steelTex([2, 1]), metalness: 0.6, roughness: 0.3 });
    const cx = (HATCH.x0 + HATCH.x1) / 2;
    const w = HATCH.x1 - HATCH.x0;
    this.box(w, HATCH.y0 - 0.04, 0.6, steel, cx, (HATCH.y0 - 0.04) / 2, -8.7);
    this.box(w + 0.1, 0.05, 0.9, std({ map: steelTex([3, 1]), metalness: 0.7, roughness: 0.2 }), cx, HATCH.y0, -9.05);
    this.colliders.push(aabb(cx, -8.7, w, 0.6, HATCH.y0, true, 'pass'));
    // heat lamps
    const lampM = new THREE.MeshBasicMaterial({ color: '#ff7a2a' });
    for (let i = 0; i < 3; i++) {
      const x = HATCH.x0 + 0.45 + i * 0.85;
      this.cyl(0.008, 0.008, 0.4, std({ color: '#222222' }), x, 1.92, -8.9, 4);
      this.cyl(0.08, 0.14, 0.14, std({ color: '#8b1a1a', metalness: 0.4 }), x, 1.68, -8.9, 10);
      const bulb = this.cyl(0.11, 0.11, 0.02, lampM, x, 1.6, -8.9, 10);
      this.heatLamps.push(bulb);
    }
    const hl = new THREE.PointLight('#ff7a30', 5, 3.5, 1.8);
    hl.position.set(cx, 1.45, -8.8);
    this.add(hl);
    // plates waiting to go out, and the bell
    const dishes: [string, number][] = [['dwFoodRibs', -0.9], ['dwFoodFish', 0], ['dwFoodPancakes', 0.85]];
    for (const [k, dx] of dishes) {
      this.model('dwPlate', cx + dx, HATCH.y0 + 0.03, -8.95);
      this.model(k, cx + dx, HATCH.y0 + 0.05, -8.95, dx);
    }
    this.cyl(0.05, 0.06, 0.04, std({ color: '#d4af37', metalness: 0.8, roughness: 0.2 }), HATCH.x1 - 0.2, HATCH.y0 + 0.05, -8.7, 10);
    // tickets on a rail
    const tRail = this.box(w, 0.03, 0.03, std({ color: '#444444', metalness: 0.6 }), cx, 2.22, -8.95);
    tRail.name = 'tickets';
    for (let i = 0; i < 5; i++) {
      this.pixSign(['TABLE ' + (3 + i * 2), '1x scallop', '(to look at)'], 0.22, 0.3, HATCH.x0 + 0.3 + i * 0.5, 2.05, -8.92, 0, { bg: '#fffdf2', fg: '#333333' });
    }
    this.pixSign(['THE PASS', 'heat lamps keep the food warm', 'for nobody'], 2.2, 0.4, cx, 2.62, -8.97, 0, { bg: '#1c1c1c', fg: '#ff9a3c', border: '#ff9a3c' });
    // the bread basket with the roll nobody will eat
    const basket = this.cyl(0.14, 0.11, 0.08, std({ color: '#a77c48', roughness: 1 }), HATCH.x0 + 0.25, HATCH.y0 + 0.06, -8.6, 10);
    basket.name = 'basket';
    const bread = new Item(BREAD_DEF);
    bread.state = 'fixed';
    bread.mesh.position.set(HATCH.x0 + 0.25, HATCH.y0 + 0.11, -8.6);
    this.add(bread.mesh);
    this.initialItems.push(bread);
  }

  // ================================================================ the sommelier's wine station on the east wall

  private wineStation(): void {
    const wood = std({ color: '#4a2a17', roughness: 0.7 });
    const g = new THREE.Group();
    g.position.set(11.65, 0, -5.4);
    this.box(0.6, 2.2, 2.0, wood, 0, 1.1, 0, g);
    // bottles in diamond cubbies
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        const y = 0.3 + row * 0.32;
        const z = -0.8 + col * 0.32;
        const b = this.cyl(0.04, 0.04, 0.3, std({ color: (row + col) % 3 ? '#1f3d1a' : '#4a0d17', roughness: 0.2 }), -0.25, y, z, 6, g);
        b.rotation.z = Math.PI / 2;
        this.cyl(0.042, 0.042, 0.04, std({ color: '#c9a23a', metalness: 0.7 }), -0.4, y, z, 6, g).rotation.z = Math.PI / 2;
      }
    }
    this.add(g);
    this.interactive(g, { kind: 'sign', text: 'The wine rack. 36 bottles of 2061 Château Coolant. Nobody drinks. The sommelier sniffs.' });
    this.colliders.push(aabb(11.65, -5.4, 0.6, 2.0, 2.2, true, 'wine'));
    // the tasting table with decanters and the crystal glass
    const t = new THREE.Group();
    t.position.set(10.9, 0, -2.8);
    this.box(0.9, 0.05, 0.7, wood, 0, 0.9, 0, t);
    for (const [x, z] of [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]] as [number, number][]) this.box(0.05, 0.9, 0.05, wood, x, 0.45, z, t);
    this.refs.decanter = this.model('dwWineRed', -0.25, 0.92, -0.15, 0, t);
    this.model('dwWineWhite', -0.05, 0.92, -0.2, 0, t);
    this.model('dwCheese', 0.25, 0.92, 0.15, 0.5, t);
    this.model('dwTumbler', -0.3, 0.92, 0.18, 0, t);
    this.add(t);
    this.colliders.push(aabb(10.9, -2.8, 0.9, 0.7, 0.95, true, 'table'));
    const crystal = new Item(CRYSTAL_DEF);
    crystal.state = 'fixed';
    crystal.mesh.position.set(11.05, 0.925, -2.85);
    this.add(crystal.mesh);
    this.initialItems.push(crystal);
    const silver = new Item(SILVER_DEF);
    silver.state = 'fixed';
    silver.mesh.position.set(10.75, 0.93, -2.65);
    silver.mesh.rotation.y = 0.3;
    this.add(silver.mesh);
    this.initialItems.push(silver);
    this.pixSign(['CAVE DU SOMMELIER', 'please do not breathe', 'near the bouquet'], 1.6, 0.6, 11.97, 2.7, -5.4, -Math.PI / 2, { bg: '#3a0d14', fg: '#e8c76a', border: '#e8c76a' });
  }

  // ================================================================ east side: fridges, produce, dry store

  private eastSide(): void {
    // two big fridges
    for (const z of [0.0, 1.35]) {
      if (this.model('dwFridge', 11.55, 0, z, -Math.PI / 2)) this.colliders.push(aabb(11.55, z, 0.75, 1.3, 2.1, true, 'fridge'));
      else {
        this.box(0.75, 2.1, 1.25, std({ map: steelTex([1, 2]), metalness: 0.6 }), 11.55, 1.05, z);
        this.colliders.push(aabb(11.55, z, 0.75, 1.3, 2.1, true, 'fridge'));
      }
    }
    this.pixSign(['FRIDGE', 'contains: decor'], 0.7, 0.3, 11.13, 2.3, 0.65, -Math.PI / 2, { bg: '#ffffff', fg: '#2e86c1' });
    // produce crates nobody eats
    const crate = std({ map: crateTex([1, 1]) });
    const produce = ['dwCabbage', 'dwCarrot', 'dwTomato', 'dwOnion', 'dwEggplant', 'dwBroccoli', 'dwLemon', 'dwPumpkin', 'dwMelon', 'dwPineapple', 'dwLeek'];
    const stacks: [number, number, number][] = [[11.5, 2.9, 2], [11.5, 3.75, 1], [10.85, 3.3, 1], [8.6, -8.55, 2], [9.4, -8.55, 1], [7.8, -8.55, 1]];
    const r = rng(17);
    stacks.forEach(([x, z, lv]) => {
      for (let k = 0; k < lv; k++) {
        const c = this.box(0.62, 0.32, 0.45, crate, x, 0.16 + k * 0.33, z);
        c.rotation.y = (r() - 0.5) * 0.2;
      }
      const top = lv * 0.33;
      for (let k = 0; k < 4; k++) this.model(produce[Math.floor(r() * produce.length)], x + (r() - 0.5) * 0.35, top, z + (r() - 0.5) * 0.25, r() * 6);
      this.colliders.push(aabb(x, z, 0.66, 0.5, top, true, 'crate'));
    });
    this.pixSign(['PRODUCE', 'for display only.', 'nobody eats. ever.'], 1.2, 0.45, 8.7, 1.7, -8.97, 0, { bg: '#27ae60', fg: '#ffffff', border: '#ffffff' });
    // dry store shelving with sacks and boxes
    const shelfM = std({ color: '#7d6a4f' });
    const sx = 11.65;
    const sz = -1.6;
    for (const y of [0.1, 0.8, 1.5]) this.box(0.6, 0.04, 1.6, shelfM, sx, y, sz);
    for (const dz of [-0.78, 0.78]) this.box(0.6, 1.9, 0.04, shelfM, sx, 0.95, sz + dz);
    for (const [y, n] of [[0.12, 3], [0.82, 4], [1.52, 3]] as [number, number][]) {
      for (let k = 0; k < n; k++) {
        const sack = k % 2 === 0;
        if (sack) this.box(0.4, 0.4, 0.3, std({ color: '#d8c9a3', roughness: 1 }), sx, y + 0.2, sz - 0.55 + k * (1.1 / (n - 1)));
        else this.box(0.4, 0.3, 0.3, boxMaterials(k), sx, y + 0.15, sz - 0.55 + k * (1.1 / (n - 1)));
      }
    }
    this.colliders.push(aabb(sx, sz, 0.6, 1.6, 1.9, true, 'dry'));
    this.pixSign(['FLOUR', 'SUGAR', 'MORE FLOUR'], 0.6, 0.45, 11.33, 2.2, sz, -Math.PI / 2, { bg: '#fdf6e3', fg: '#5d4037' });
  }

  // ================================================================ south side: prep tables, walk-in, the stock pot

  private southSide(): void {
    const steel = std({ map: steelTex([2, 1]), metalness: 0.55, roughness: 0.35 });
    const dark = std({ color: '#2a2d30', metalness: 0.5 });
    /** A free standing steel prep table. */
    const table = (cx: number, cz: number, w: number, d: number) => {
      this.box(w, 0.04, d, steel, cx, 0.9, cz);
      this.box(w - 0.1, 0.03, d - 0.1, dark, cx, 0.25, cz);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) this.cyl(0.02, 0.02, 0.9, steel, cx + dx * (w / 2 - 0.05), 0.45, cz + dz * (d / 2 - 0.05), 6);
      this.colliders.push(aabb(cx, cz, w, d, 0.92, true, 'prep'));
    };
    table(-5.2, 2.6, 2.6, 0.85);
    this.model('dwBoard', -6.0, 0.92, 2.6, 1.57);
    this.model('dwChopKnife', -6.0, 0.95, 2.6, 0.3);
    this.model('dwBoard', -4.5, 0.92, 2.6, 1.57);
    this.model('dwCarrot', -4.6, 0.95, 2.5, 1.3);
    this.model('dwOnion', -4.3, 0.95, 2.7);
    this.model('dwTomato', -4.5, 0.95, 2.8);
    this.model('dwKnifeBlock', -6.3, 0.92, 2.95, 0);
    this.model('dwPepperMill', -5.3, 0.92, 2.9);
    this.model('dwOil', -5.15, 0.92, 2.95);
    this.model('dwMortar', -5.0, 0.92, 2.3);
    this.model('dwBroccoli', -3.95, 0.92, 2.4);
    this.model('dwHam', -5.6, 0.92, 2.35, 0.4);
    for (let i = 0; i < 4; i++) this.box(0.35, 0.25, 0.3, boxMaterials(i + 2), -6.1 + i * 0.6, 0.4, 2.6);
    table(1.4, 3.4, 2.2, 0.85);
    this.model('dwCake', 0.8, 0.92, 3.4);
    this.model('dwPie', 1.6, 0.92, 3.35);
    this.model('dwRollingPin', 2.2, 0.92, 3.55, 0.3);
    this.model('dwTajine', 1.95, 0.92, 3.2);
    this.model('dwLoaf', 0.35, 0.92, 3.5);
    this.pixSign(['PASTRY', 'decorative desserts', 'since 2066'], 1.2, 0.4, 1.4, 1.7, 3.85, Math.PI, { bg: '#f8c8dc', fg: '#6b2141' });

    // the walk-in freezer
    const wx = -6.4;
    const door = new THREE.Group();
    door.position.set(wx, 0, 8.95);
    this.box(2.0, 2.4, 0.12, std({ map: steelTex([2, 2]), metalness: 0.6, roughness: 0.35 }), 0, 1.2, 0, door);
    this.box(0.12, 0.5, 0.12, std({ color: '#222222' }), 0.7, 1.15, -0.1, door);
    this.box(2.2, 0.12, 0.16, dark, 0, 2.46, 0, door);
    const frost = std({ color: '#e8f6ff', roughness: 1, transparent: true, opacity: 0.6 });
    this.box(2.0, 0.15, 0.13, frost, 0, 0.08, -0.005, door);
    this.add(door);
    this.interactive(door, { kind: 'dwFreezer' });
    this.refs.freezer = door;
    this.colliders.push(aabb(wx, 8.9, 2.2, 0.25, 2.5, false, 'freezer'));
    this.pixSign(['WALK-IN FREEZER', '-18 C  do not lock yourself in.', 'again.'], 1.7, 0.5, wx, 2.85, 8.96, Math.PI, { bg: '#d6eaf8', fg: '#1b4f72', border: '#1b4f72' });
    // sacks and barrels around it
    // the barrels can be rolled around (mischief.ts), so they have no collider
    for (const [x, z, r] of [[-8.2, 8.4, 0], [-8.75, 8.55, 1]] as [number, number, number][]) {
      const b = this.model('dwBarrel', x, 0, z, r);
      if (b) this.refs.barrels.push(b);
    }
    const sackM = std({ color: '#d8c9a3', roughness: 1 });
    for (let i = 0; i < 3; i++) this.box(0.5, 0.25, 0.7, sackM, -4.6 + i * 0.05, 0.13 + i * 0.25, 8.5).rotation.y = i * 0.2;
    this.colliders.push(aabb(-4.6, 8.5, 0.7, 0.8, 0.8, true, 'sacks'));

    // the stock pot with the toilet key, as far from the toilet as possible
    const dolly = this.box(1.1, 0.12, 1.1, std({ color: '#3d3d3d', metalness: 0.4 }), -10.8, 0.06, 7.85);
    dolly.name = 'dolly';
    const pot = new Item(STOCKPOT_DEF);
    pot.state = 'fixed';
    pot.mesh.position.set(-10.8, 0.12, 7.85);
    pot.mesh.rotation.y = -0.6;
    this.add(pot.mesh);
    this.initialItems.push(pot);
    this.stockPot = pot;
    this.colliders.push(aabb(-10.8, 7.85, 1.1, 1.1, 0.14, false, 'dolly'));
    this.pixSign(['TOILET KEY', 'It is tied to the stock pot.', 'Do not cook the key.', 'Do not eat the stock.'], 1.4, 0.75, -11.97, 1.9, 7.6, Math.PI / 2, { bg: '#ffffff', fg: '#c0392b', border: '#c0392b' });
    // steam from the stock
    this.stoveSteam.push(new THREE.Vector3(-10.8, 0.7, 7.85));
  }

  // ================================================================ the middle of the room

  private middle(): void {
    const steel = std({ map: steelTex([2, 1]), metalness: 0.55, roughness: 0.35 });
    const steelTop = std({ map: steelTex([3, 1]), metalness: 0.65, roughness: 0.25 });
    const dark = std({ color: '#2a2d30', metalness: 0.5 });
    // the cold station island with its inserts
    const cx = -1.2;
    const cz = 0.6;
    const w = 2.4;
    const d = 0.9;
    const island = this.box(w, 0.86, d, steel, cx, 0.43, cz);
    this.interactive(island, { kind: 'sign', text: 'The cold station. Salads for robots. The robots photograph them and send them back.' });
    this.box(w + 0.04, 0.04, d + 0.04, steelTop, cx, 0.88, cz);
    const fills = ['#c0392b', '#27ae60', '#f1c40f', '#e67e22', '#ecf0f1', '#8e44ad', '#2ecc71', '#d35400'];
    for (let i = 0; i < 8; i++) {
      const ix = cx - w / 2 + 0.33 + (i % 4) * 0.58;
      const iz = cz + (i < 4 ? -0.2 : 0.2);
      this.box(0.44, 0.05, 0.32, dark, ix, 0.885, iz);
      this.box(0.4, 0.03, 0.28, std({ color: fills[i], roughness: 0.95 }), ix, 0.9, iz);
    }
    for (const x of [cx - w / 2 + 0.08, cx + w / 2 - 0.08]) this.cyl(0.015, 0.015, 0.62, steel, x, 1.2, cz, 6);
    this.box(w, 0.03, 0.35, steel, cx, 1.5, cz);
    ['#c0392b', '#f1c40f', '#ecf0f1', '#27ae60', '#c0392b', '#8e5a2b'].forEach((c, i) => this.cyl(0.035, 0.03, 0.2, std({ color: c, roughness: 0.6 }), cx - 0.95 + i * 0.3, 1.62, cz, 8));
    this.box(0.25, 0.16, 0.2, std({ color: '#333333' }), cx + 0.95, 1.6, cz);
    const tk = this.box(0.1, 0.004, 0.28, std({ color: '#fffdf2' }), cx + 0.95, 1.56, cz + 0.2);
    tk.rotation.x = 0.9;
    this.colliders.push(aabb(cx, cz, w, d, 0.92, true, 'island'));

    // speed racks full of sheet trays with decorative pastries
    const rack = (x: number, z: number, rot: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rot;
      for (const [px, pz] of [[-0.27, -0.33], [0.27, -0.33], [-0.27, 0.33], [0.27, 0.33]] as [number, number][]) this.cyl(0.015, 0.015, 1.75, steel, px, 0.88, pz, 6, g);
      const tray = std({ color: '#b08a4a', metalness: 0.3, roughness: 0.5 });
      const goods = ['dwFoodCroissant', 'dwPie', 'dwFoodPancakes', 'dwLoaf'];
      for (let i = 0; i < 9; i++) {
        const y = 0.2 + i * 0.17;
        this.box(0.52, 0.015, 0.64, tray, 0, y, 0, g);
        if (i % 3 !== 1) for (let k = 0; k < 2; k++) this.model(goods[(i + k) % goods.length], (k - 0.5) * 0.24, y + 0.01, 0.05 - k * 0.1, i, g, 0.6);
      }
      this.add(g);
      this.colliders.push(aabb(x, z, 0.62, 0.72, 1.75, true, 'speedrack'));
    };
    rack(8.0, 0.2, 0);
    rack(-8.0, 5.2, 0.25);

    // staff lockers and a bench on the south wall
    const lockA = std({ color: '#4a6a7a', metalness: 0.4, roughness: 0.6 });
    const lockB = std({ color: '#3d5a68', metalness: 0.4, roughness: 0.6 });
    const vent = std({ color: '#1d2a30' });
    for (let i = 0; i < 6; i++) {
      const x = 0.3 + i * 0.52;
      this.box(0.5, 1.9, 0.5, i % 2 ? lockB : lockA, x, 0.95, 8.72);
      for (let v = 0; v < 3; v++) this.box(0.3, 0.02, 0.01, vent, x, 1.6 + v * 0.06, 8.465);
      this.box(0.04, 0.12, 0.02, std({ color: '#c9a23a', metalness: 0.7 }), x + 0.17, 1.0, 8.46);
    }
    this.pixSign(['GERALD'], 0.36, 0.1, 0.82, 1.4, 8.462, Math.PI, { bg: '#ffffff', fg: '#c0392b' });
    this.pixSign(['YOU'], 0.3, 0.1, 2.38, 1.4, 8.462, Math.PI, { bg: '#ffffff', fg: '#2c3e50' });
    this.colliders.push(aabb(1.6, 8.72, 3.2, 0.55, 1.9, true, 'lockers'));
    const wood = std({ color: '#7a5634' });
    this.box(2.6, 0.06, 0.32, wood, 1.6, 0.45, 7.95);
    for (const x of [0.5, 2.7]) this.box(0.06, 0.42, 0.28, dark, x, 0.21, 7.95);
    this.colliders.push(aabb(1.6, 7.95, 2.6, 0.35, 0.5, false, 'bench'));
    this.model('dwTumbler', 2.2, 0.48, 7.9);

    // the deep fryer at the end of the range
    const fx = 7.25;
    const fz = -3.55;
    this.box(0.75, 0.92, 0.95, steel, fx, 0.46, fz);
    const oil = std({ color: '#b8860b', roughness: 0.15, metalness: 0.2 });
    for (const dz of [-0.2, 0.2]) {
      this.box(0.55, 0.02, 0.32, oil, fx, 0.9, fz + dz);
      const basket = this.box(0.3, 0.12, 0.25, std({ color: '#cfd3d6', wireframe: true }), fx, 1.02, fz + dz);
      basket.rotation.z = 0.25;
    }
    this.box(0.75, 0.25, 0.04, steelTop, fx, 1.05, fz - 0.47);
    this.colliders.push(aabb(fx, fz, 0.75, 0.95, 0.95, true, 'fryer'));
    this.pixSign(['FRYER', 'oil changed: 2063'], 0.6, 0.25, fx, 1.25, fz + 0.5, 0, { bg: '#111111', fg: '#f1c40f' });

    // red milk crates in a stack
    const crateM = std({ color: '#b3261e', roughness: 0.8 });
    for (let i = 0; i < 4; i++) {
      const c = this.box(0.45, 0.3, 0.35, crateM, -0.6 + (i % 2) * 0.05, 0.15 + i * 0.3, 6.5);
      c.rotation.y = i * 0.15;
    }
    this.colliders.push(aabb(-0.6, 6.5, 0.6, 0.5, 1.2, true, 'crates'));

    // food on the floor that nobody picks up
    this.model('dwTomato', 2.6, 0, -1.3, 0.5);
    this.model('dwFoodSalad', -4.6, 0, -6.3, 1.2, this.scene, 0.6);
    const carrot = this.model('dwCarrot', 0.4, 0.04, -6.6, 0.3);
    if (carrot) carrot.rotation.z = Math.PI / 2;
    this.model('dwLemon', 5.6, 0, 1.9);

    // a wall shelf with jars and cans above the sacks
    this.box(2.2, 0.04, 0.3, wood, -3.9, 1.85, 8.82);
    const jars = ['#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#ecf0f1', '#8e5a2b', '#9b59b6'];
    for (let i = 0; i < 9; i++) this.cyl(0.07, 0.07, 0.2 + (i % 3) * 0.04, std({ color: jars[i % jars.length], roughness: 0.4 }), -4.85 + i * 0.24, 1.98, 8.82, 8);
    // garlic strings and herbs hanging from the pot rail ends
    const garlic = std({ color: '#efe6d2', roughness: 1 });
    for (const x of [1.75, 6.45]) {
      for (let i = 0; i < 5; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), garlic);
        b.position.set(x, 2.3 - i * 0.09, -2.5);
        this.add(b);
      }
    }
  }

  // ================================================================ toilet

  private toiletCorner(): void {
    this.toiletBooth(6.7, 4.9, ['KEY: STOCK POT', 'far corner, by the freezer.', 'Lift with your knees.']);
    this.pixSign(['STAFF WC', 'is in the OTHER corner', 'from the key. On purpose.'], 1.8, 0.6, -11.97, 2.7, 6.0, Math.PI / 2, { bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' });
    // hand wash station next to it
    const steel = std({ map: steelTex([1, 1]), metalness: 0.6 });
    this.box(0.5, 0.25, 0.4, steel, 5.6, 0.95, 8.75);
    this.cyl(0.02, 0.02, 0.9, steel, 5.6, 0.45, 8.8, 6);
    this.pixSign(['EMPLOYEES MUST', 'WASH HANDS', '(in 4 seconds)'], 0.8, 0.45, 5.6, 1.55, 8.97, Math.PI, { bg: '#ffffff', fg: '#2e86c1', border: '#2e86c1' });
    this.colliders.push(aabb(5.6, 8.75, 0.5, 0.4, 1.1, false, 'handwash'));
  }

  // ================================================================ ceiling: ducts, fans, pipes, lamps

  private ceilingStuff(): void {
    const duct = std({ map: steelTex([10, 1]), metalness: 0.4, roughness: 0.5 });
    // a big duct from the range hood to the north wall and along it
    const d1 = this.cyl(0.32, 0.32, 5.2, duct, 4.1, 3.3, -6.2, 10);
    d1.rotation.x = Math.PI / 2;
    const d2 = this.cyl(0.26, 0.26, 23, duct, 0, 3.28, -8.4, 10);
    d2.rotation.z = Math.PI / 2;
    for (let x = -11; x <= 11; x += 2.5) this.box(0.06, 0.32, 0.6, duct, x, 3.48, -8.4);
    // pipes along the walls
    const pipeA = std({ color: '#9e2a1e' });
    const pipeB = std({ color: '#70757b', metalness: 0.5 });
    const p1 = this.cyl(0.05, 0.05, 18, pipeA, -11.75, 3.1, 0, 6);
    p1.rotation.x = Math.PI / 2;
    const p2 = this.cyl(0.04, 0.04, 18, pipeB, -11.75, 2.95, 0, 6);
    p2.rotation.x = Math.PI / 2;
    const p3 = this.cyl(0.05, 0.05, 24, pipeB, 0, 3.15, 8.75, 6);
    p3.rotation.z = Math.PI / 2;
    // fluorescent tubes in cages
    const tube = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6e0', emissiveIntensity: 1.1 });
    const cage = std({ color: '#3a3a3a', metalness: 0.5 });
    for (const [x, z] of [[-7.5, -6.5], [-10, -2.5], [-1.5, -5.5], [0, 2.5], [-7, 5.5], [9, -2], [5, 6], [-2.5, 6], [8.5, -6.5]] as [number, number][]) {
      this.box(1.4, 0.08, 0.28, cage, x, 3.16, z);
      this.box(1.3, 0.05, 0.08, tube, x, 3.1, z - 0.06);
      this.box(1.3, 0.05, 0.08, tube, x, 3.1, z + 0.06);
      for (const dx of [-0.6, 0.6]) this.cyl(0.008, 0.008, 0.42, cage, x + dx, 3.4, z, 4);
    }
    // steel beams across the ceiling and a cable tray
    const beam = std({ color: '#4a4440', metalness: 0.4, roughness: 0.6 });
    for (const z of [-4.6, 0.4, 5.2]) {
      this.box(24, 0.28, 0.16, beam, 0, 3.46, z);
      this.box(24, 0.03, 0.34, beam, 0, 3.33, z);
    }
    const tray = std({ color: '#6b6f72', metalness: 0.5 });
    this.box(0.4, 0.06, 18, tray, -3.0, 3.25, 0);
    for (let z = -8; z <= 8; z += 2) this.cyl(0.008, 0.008, 0.35, tray, -3.0, 3.42, z, 4);
    const cable = std({ color: '#1b1b1b' });
    for (const dx of [-0.1, 0.05, 0.12]) this.box(0.03, 0.03, 18, cable, -3.0 + dx, 3.3, 0);
    // ceiling fans that do nothing against the steam
    for (const [x, z] of [[-4, -1.5], [6.5, 1.8], [-8, 1.5]] as [number, number][]) {
      const f = this.model('dwFan', x, 3.2, z);
      if (f) this.fans.push(f);
    }
    // sprinkler heads
    // they hang on short drops, low enough to be hit by a well thrown plate (mischief.ts)
    const brass = std({ color: '#c9a23a', metalness: 0.7 });
    for (let x = -10; x <= 10; x += 4) {
      for (const z of [-4, 4]) {
        this.cyl(0.012, 0.012, 0.24, std({ color: '#8d9599', metalness: 0.5 }), x, 3.48, z, 5);
        const head = this.cyl(0.03, 0.05, 0.06, brass, x, 3.34, z, 6);
        this.cyl(0.06, 0.06, 0.01, brass, 0, -0.035, 0, 8, head);
        this.refs.sprinklers.push(head);
      }
    }
    // a wall clock that is always slightly wrong
    const clock = this.cyl(0.25, 0.25, 0.05, std({ color: '#f4f1ea' }), -0.6, 2.7, -8.95, 16);
    clock.rotation.x = Math.PI / 2;
    this.box(0.02, 0.18, 0.01, std({ color: '#111111' }), -0.6, 2.75, -8.92).rotation.z = 0.8;
    this.box(0.02, 0.12, 0.01, std({ color: '#111111' }), -0.6, 2.72, -8.92).rotation.z = -1.6;
    // security cameras
    const camBody = std({ color: '#d8d8d2' });
    const camDark = std({ color: '#1a1a1a' });
    for (const [x, y, z, yaw] of [[-11.6, 3.2, -8.6, Math.PI * 0.75], [11.6, 3.2, 8.6, -Math.PI * 0.25], [11.6, 3.2, -8.6, -Math.PI * 0.75], [-11.6, 3.2, 8.6, Math.PI * 0.25]] as [number, number, number, number][]) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.rotation.y = yaw;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.38), camBody);
      b.rotation.x = 0.35;
      g.add(b);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), camDark);
      l.rotation.x = Math.PI / 2 + 0.35;
      l.position.set(0, -0.07, 0.2);
      g.add(l);
      this.add(g);
      this.refs.cams.push(g);
    }
  }

  // ================================================================ clutter, stains, plants, mop

  private clutter(): void {
    // grease and old spills
    const stain = new THREE.MeshBasicMaterial({ color: '#3b2a14', transparent: true, opacity: 0.28, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const wet = new THREE.MeshBasicMaterial({ color: '#9fb4b8', transparent: true, opacity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const r = rng(99);
    const spots: [number, number, number, boolean][] = [
      [3.5, -5.2, 0.7, false], [5.8, -2.4, 0.5, false], [2.0, -2.5, 0.4, false], [-7.2, -7.0, 0.6, true], [-5.6, -6.6, 0.5, true],
      [-9.4, -7.3, 0.55, true], [-2.4, -6.8, 0.4, false], [-10.3, 3.4, 0.6, true], [0.5, 1.0, 0.35, false], [8.5, 2.5, 0.4, false],
      [-3.5, 5.5, 0.5, false], [4.2, -6.5, 0.45, false], [-0.5, -7.6, 0.5, false],
    ];
    for (const [x, z, s, w] of spots) {
      const m = new THREE.Mesh(blobGeometry(s), w ? wet : stain);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = r() * 6;
      m.position.set(x, 0.007, z);
      this.add(m);
    }
    // plants (valid but frowned upon toilets)
    this.plant(11.35, 3.95);
    this.plant(-2.9, 8.45);
    this.plant(3.05, -8.45);
    // the mop in its bucket next to the shelves
    const bucket = std({ color: '#d9a400' });
    const bucketG = new THREE.Group();
    bucketG.position.set(-11.4, 0, 0.6);
    this.cyl(0.24, 0.2, 0.38, bucket, 0, 0.19, 0, 12, bucketG);
    const bw = new THREE.Mesh(new THREE.CircleGeometry(0.21, 12), std({ color: '#6d6a3c' }));
    bw.rotation.x = -Math.PI / 2;
    bw.position.set(0, 0.36, 0);
    bucketG.add(bw);
    this.add(bucketG);
    this.refs.bucket = bucketG;
    this.colliders.push(aabb(-11.4, 0.6, 0.5, 0.5, 0.4, false, 'bucket'));
    const mop = new Item(MOP_DEF);
    mop.state = 'fixed';
    mop.mesh.position.set(-11.35, 0.25, 0.65);
    mop.mesh.rotation.z = 0.12;
    this.add(mop.mesh);
    this.initialItems.push(mop);
    this.mop = mop;
    // wet floor sign
    const wetSign = new THREE.Group();
    wetSign.position.set(-8.0, 0, -6.6);
    wetSign.rotation.y = 0.5;
    const wm = std({ color: '#f1c40f', side: THREE.DoubleSide, map: textTexture(['CAUTION', 'WET', 'ALWAYS'], { w: 64, h: 96, bg: '#f1c40f', fg: '#111111', font: PIX }) });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.6), wm);
      p.position.set(0, 0.29, s * 0.1);
      p.rotation.x = s * 0.33;
      wetSign.add(p);
    }
    // the sign and the trash cans can be carried around (mischief.ts), so they have no collider
    this.add(wetSign);
    this.refs.wetSign = wetSign;
    for (const [x, z] of [[-2.6, 2.4], [7.2, -8.5], [10.9, 4.3]] as [number, number][]) {
      const t = this.model('dwTrash', x, 0, z);
      if (t) this.refs.trash.push(t);
      else {
        this.cyl(0.26, 0.22, 0.75, std({ color: '#3f4a3c' }), x, 0.375, z);
        this.colliders.push(aabb(x, z, 0.55, 0.55, 0.8, false, 'decor'));
      }
    }
    // cardboard boxes in the corners
    const pile = (cx: number, cz: number, n: number, seed: number) => {
      const pr = rng(seed);
      let top = 0;
      for (let i = 0; i < n; i++) {
        const bh = 0.3 + pr() * 0.2;
        const b = this.box(0.5 + pr() * 0.1, bh, 0.45, boxMaterials(Math.floor(pr() * 7)), cx + (pr() - 0.5) * 0.08, top + bh / 2, cz + (pr() - 0.5) * 0.08);
        b.rotation.y = (pr() - 0.5) * 0.4;
        top += bh;
      }
      this.colliders.push(aabb(cx, cz, 0.65, 0.6, top, true, 'boxes'));
    };
    pile(11.45, -8.5, 3, 5);
    pile(10.8, -8.55, 2, 6);
    pile(-11.5, 5.3, 2, 7);
    // a spice shelf and a knife strip on the west wall
    const wood = std({ color: '#6e4b2a' });
    this.box(0.18, 0.03, 1.6, wood, -11.88, 1.65, -0.0);
    for (let i = 0; i < 8; i++) this.cyl(0.035, 0.035, 0.1, std({ color: ['#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#8e5a2b'][i % 5] }), -11.88, 1.72, -0.7 + i * 0.2, 6);
    // first aid kit and extinguisher
    this.box(0.4, 0.3, 0.12, std({ color: '#ffffff' }), 11.92, 1.6, 5.0 - 2.5).rotation.y = Math.PI / 2;
    this.pixSign(['+'], 0.2, 0.2, 11.85, 1.6, 2.5, -Math.PI / 2, { bg: '#ffffff', fg: '#c0392b' });
    for (const [x, z] of [[-11.85, -0.9], [11.85, -7.2]] as [number, number][]) {
      this.cyl(0.08, 0.08, 0.45, std({ color: '#b3160c' }), x, 0.75, z, 8);
      this.box(0.06, 0.08, 0.04, std({ color: '#1a1a1a' }), x, 1.02, z);
    }
    // a dish cart with racks parked near the pot sink
    const cart2 = new THREE.Group();
    cart2.position.set(-3.4, 0, 5.4);
    cart2.rotation.y = 0.3;
    const st = std({ map: steelTex([1, 1]), metalness: 0.6 });
    this.box(0.9, 0.03, 0.6, st, 0, 0.8, 0, cart2);
    this.box(0.9, 0.03, 0.6, st, 0, 0.25, 0, cart2);
    for (const [x, z] of [[-0.42, -0.27], [0.42, -0.27], [-0.42, 0.27], [0.42, 0.27]] as [number, number][]) this.cyl(0.015, 0.015, 0.8, st, x, 0.4, z, 6, cart2);
    for (let i = 0; i < 3; i++) this.box(0.5, 0.1, 0.5, std({ color: '#2f6d8c' }), 0, 0.87 + i * 0.1, 0, cart2).rotation.y = i * 0.1;
    this.model('dwPot', 0, 0.27, 0, 0.3, cart2);
    this.add(cart2);
    this.colliders.push(aabb(-3.4, 5.4, 1.0, 0.8, 1.1, true, 'cart'));
  }

  private posters(): void {
    const style: TextTexOpts = { bg: '#fdf6e3', fg: '#2c3e50', border: '#c0392b', font: PIX };
    const read = 'A motivational poster. It is greasy. It does not motivate.';
    const posters: [string[], number, number, number, number][] = [
      [['HANDS MUST BE WASHED', 'robots excluded'], 2.8, 2.6, -8.97, 0],
      [['ALLERGY NOTICE', 'our food contains no allergens.', 'nobody eats it.'], -11.97, 2.6, -3.0, Math.PI / 2],
      [['DAYS WITHOUT A', 'KITCHEN FIRE', '3'], 11.97, 2.6, 5.2 - 1.2, -Math.PI / 2],
      [['THE CHEF IS', 'ALWAYS RIGHT', 'the chef said so.'], 7.4, 2.6, -8.97, 0],
      [['TEAMWORK', 'you wash. we watch.'], -2.0, 2.7, 8.97, Math.PI],
      [['A CLEAN PLATE', 'IS A HAPPY PLATE', 'you are not a plate.'], 3.0, 2.7, 8.97, Math.PI],
    ];
    for (const [lines, x, y, z, rot] of posters) {
      const p = this.sign(lines, 1.7, 0.95, x, y, z, rot, style, read);
      if (lines[1] === 'KITCHEN FIRE') this.refs.firePoster = p;
    }
  }

  // ================================================================ animation

  /** Opens the swinging doors for a while (towards the kitchen when inward is true). */
  bumpDoors(inward: boolean, seconds = 1.2): void {
    this.doorTarget = inward ? 1.3 : -1.3;
    this.doorTimer = seconds;
  }

  private animate(t: number): void {
    const dt = Math.min(0.05, Math.max(0, t - this.lastT));
    this.lastT = t;
    for (const d of this.diners) d.mixer.update(dt);
    for (const f of this.fans) f.rotation.y += dt * 0.8;
    // one tube over the clean shelves is dying
    const phase = t % 6.1;
    this.flickerLamp.intensity = phase > 5.4 && Math.sin(t * 43) > 0.1 ? 3 : 12;
    for (const c of this.candles) {
      c.light.intensity = 3.2 + Math.sin(t * 9 + c.flames.length) * 0.5 + Math.sin(t * 23) * 0.3;
      for (const f of c.flames) f.scale.y = 1 + Math.sin(t * 17 + f.position.x) * 0.15;
    }
    for (const f of this.flames) f.scale.setScalar(1 + Math.sin(t * 20 + f.position.x * 3) * 0.08);
    // swinging doors: swing out to the target, then flap back and forth to rest
    if (this.doorTimer > 0) {
      this.doorTimer -= dt;
      this.doorAngle += (this.doorTarget - this.doorAngle) * Math.min(1, dt * 9);
    } else {
      this.doorTarget = 0;
      this.doorAngle *= Math.max(0, 1 - dt * 2.2);
      this.doorAngle += Math.sin(t * 9) * Math.abs(this.doorAngle) * dt * 4;
    }
    this.doorL.rotation.y = -this.doorAngle;
    this.doorR.rotation.y = this.doorAngle;
  }
}
