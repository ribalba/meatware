import * as THREE from 'three';
import { hasModel } from '../../assets';
import { boxMaterials } from '../../details';
import { Item } from '../../items';
import { Interact, LevelKit, mat } from '../../level';
import { beltTex, ceilingTex, make, concreteTex, ductTex, floorTex, hazardTex, shelfMetalTex, tvStatic, wallTex, wetFloorTex } from '../../textures';
import { aabb, blobGeometry, textTexture } from '../../util';
import { CART_KEY_DEF, codeSheetLines } from './items';
import {
  BAG,
  BELT,
  BOOTH_X0,
  BOOTH_Z0,
  CART_KEY_POS,
  CASHIER,
  CASHIER_WALL_X,
  COUNTER,
  DOORS,
  LANES,
  REGISTER,
  ROOM,
  SCAN,
  SELF_CHECKOUTS,
} from './layout';
import { bagTex, candyTex, dustTex, facingsTex, laminateTex, laneNumberTex, linoTex, magazinesTex, matTex, outsideTex, rainTex, steelTex, tillTex } from './tex';
import { POSTERS } from './texts';

const PX = '"Press Start 2P", monospace';
const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });

/** Seeded random so the clutter is the same every shift. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Text on a canvas for glowing screens, in the pixel font. */
function screenCanvas(w: number, h: number): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; tex: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return { canvas, g, tex };
}

/** SHOPOTRON EXPRESS: the front of a big supermarket with one human lane. */
export class CheckoutLevel extends LevelKit {
  belt!: THREE.Texture;
  /** Red laser lines of the scanner, flash on a beep. */
  scanGlow!: THREE.MeshBasicMaterial;
  /** The light at the end of the bagging area. */
  indicator!: THREE.MeshStandardMaterial;
  /** Bags in the bagging area. Each fills up with items. */
  bags: THREE.Group[] = [];
  bagGroup = new THREE.Group();
  drawer = new THREE.Group();
  drawerOpen = 0;
  drawerTarget = 0;
  /** The robot-facing card terminal and the register display. */
  terminal!: THREE.Object3D;
  private regScreen!: { g: CanvasRenderingContext2D; tex: THREE.CanvasTexture; last: string };
  private termScreen!: { g: CanvasRenderingContext2D; tex: THREE.CanvasTexture; last: string };
  private doorL!: THREE.Mesh;
  private doorR!: THREE.Mesh;
  private doorOpen = 0;
  doorTarget = 0;
  private laneLight!: THREE.MeshBasicMaterial;
  private laneLightOn!: THREE.Texture;
  private laneLightOff!: THREE.Texture;
  private flicker!: THREE.PointLight;
  private rain: THREE.Texture[] = [];
  private gateLamps: THREE.MeshStandardMaterial[] = [];
  private selfScreens: { g: CanvasRenderingContext2D; tex: THREE.CanvasTexture }[] = [];
  private tv!: { texture: THREE.CanvasTexture; update: () => void };
  private camLeds: THREE.Mesh[] = [];
  private beltMoving = true;
  // Props the mischief module (fun.ts) turns into breakables, movables and secrets
  wetSign!: THREE.Group;
  bins: THREE.Group[] = [];
  stools: THREE.Group[] = [];
  cams: THREE.Group[] = [];
  lane5Signs: THREE.Mesh[] = [];
  scanBoard: { sign: THREE.Mesh; pole: THREE.Mesh; collider: ReturnType<LevelKit['solid']> } | null = null;
  tvScreen!: THREE.Mesh;
  gacha: THREE.Object3D | null = null;
  bottleReturn: THREE.Object3D | null = null;
  handTruck: THREE.Object3D | null = null;
  cabinet!: THREE.Group;
  cabinetGlass!: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    super(scene);
    this.bounds = ROOM;
    this.ceiling = 4.7;
    this.spawn = { pos: CASHIER.clone(), yaw: 0.95 };
    this.bossWaypoints.push(
      new THREE.Vector3(2.6, 0, -4.2),
      new THREE.Vector3(-2.6, 0, -4.5),
      new THREE.Vector3(-2.2, 0, 5.5),
      new THREE.Vector3(3, 0, 6),
      new THREE.Vector3(9.5, 0, 4.8),
      new THREE.Vector3(-10, 0, 5.5),
      new THREE.Vector3(-14, 0, 2),
      new THREE.Vector3(0, 0, -10),
      new THREE.Vector3(-9, 0, -9.8),
      new THREE.Vector3(8, 0, -9.6),
      new THREE.Vector3(12.5, 0, -5),
    );
    this.lights();
    this.room();
    this.front();
    for (const l of LANES) this.lane(l.n, l.x, l.n === 7);
    this.myLane();
    this.selfCheckouts();
    this.serviceDesk();
    this.aisles();
    this.decor();
    this.toiletBooth(BOOTH_X0, BOOTH_Z0, ['KEY: CUSTOMER SERVICE', 'It is chained to a cart.', 'The cart is full.']);
    for (const [x, z] of [[-3.2, 13.2], [-17.2, 12.9], [12.6, 13.0], [16.9, -6.5]] as [number, number][]) this.plant(x, z);
    this.onTick((t) => this.animate(t));
  }

  // ---------------------------------------------------------------- light and shell

  private lights(): void {
    this.scene.background = new THREE.Color('#1e2126');
    this.scene.add(new THREE.HemisphereLight('#fff4dc', '#5d5547', 2.0));
    const d = new THREE.DirectionalLight('#fff1d6', 0.9);
    d.position.set(-5, 12, 8);
    this.scene.add(d);
    const spots: [number, number, number, string, number][] = [
      [0, 3.6, 0.5, '#ffe6b8', 20],
      [-8, 4.2, 0.5, '#ffd9a0', 12],
      [-14.5, 4.2, 9.5, '#ffd9a0', 16],
      [9.3, 4.2, 0.8, '#d9f0ff', 18],
      [-6, 4.4, 10, '#fff1d6', 18],
      [6, 4.4, 9, '#fff1d6', 14],
      [-9, 4.4, -9.5, '#ffe6b8', 18],
      [5, 4.4, -9.5, '#ffe6b8', 18],
      [14, 4.0, -8.5, '#cfe8ff', 10],
    ];
    spots.forEach(([x, y, z, c, i]) => {
      const l = new THREE.PointLight(c, i, 14, 1.6);
      l.position.set(x, y, z);
      this.scene.add(l);
      if (i === 12) this.flicker = l;
    });
  }

  private room(): void {
    const W = ROOM.maxX - ROOM.minX;
    const D = ROOM.maxZ - ROOM.minZ;
    // Back of the store: worn tiles. Front: checkerboard linoleum.
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, 12, W, 12), std({ map: floorTex([W / 2, 6]), roughness: 0.6 }));
    back.rotation.x = -Math.PI / 2;
    back.position.set(0, 0, -8);
    this.scene.add(back);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(W, 16, W, 16), std({ map: linoTex([W / 2, 8]), roughness: 0.55 }));
    front.rotation.x = -Math.PI / 2;
    front.position.set(0, 0, 6);
    this.scene.add(front);
    // A metal threshold strip between the two floors
    this.box(W, 0.01, 0.12, mat('#8a8f95', { metalness: 0.6 }), 0, 0.005, -2.0);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D, W / 2, D / 2), std({ map: ceilingTex([W / 2, D / 2]), roughness: 0.9 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 5;
    this.scene.add(ceiling);
    const panel = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6e0', emissiveIntensity: 1 });
    const deadPanel = mat('#8d8b82');
    for (const x of [-14, -8, -2, 4, 10, 15.5]) {
      for (const z of [-10, -4, 3, 9]) this.box(1.2, 0.05, 2.4, x === -8 && z === 3 ? deadPanel : panel, x, 4.95, z);
    }

    const wallLong = std({ map: wallTex([W / 2.5, 2]) });
    const wallShort = std({ map: wallTex([D / 2.5, 2]) });
    this.box(W + 0.4, 5, 0.4, wallLong, 0, 2.5, ROOM.minZ - 0.2);
    this.box(0.4, 5, D, wallShort, ROOM.minX - 0.2, 2.5, 0);
    this.box(0.4, 5, D, wallShort, ROOM.maxX + 0.2, 2.5, 0);
    const skirt = mat('#3d3a33');
    const stripe = mat('#1f6f5c');
    this.box(W, 0.18, 0.04, skirt, 0, 0.09, ROOM.minZ + 0.02);
    this.box(0.04, 0.18, D, skirt, ROOM.minX + 0.02, 0.09, 0);
    this.box(0.04, 0.18, D, skirt, ROOM.maxX - 0.02, 0.09, 0);
    this.box(W, 0.25, 0.05, stripe, 0, 1.1, ROOM.minZ + 0.02);
    this.box(0.05, 0.25, D, stripe, ROOM.minX + 0.02, 1.1, 0);
    this.box(0.05, 0.25, D, stripe, ROOM.maxX - 0.02, 1.1, 0);
    this.colliders.push(
      aabb(0, ROOM.minZ - 0.2, W + 0.4, 0.4, 5, false),
      aabb(0, ROOM.maxZ + 0.2, W + 0.4, 0.4, 5, false),
      aabb(ROOM.minX - 0.2, 0, 0.4, D, 5, false),
      aabb(ROOM.maxX + 0.2, 0, 0.4, D, 5, false),
    );

    // Pillars with hazard paint
    const pillarMat = std({ map: concreteTex([1, 6]) });
    const hazardMat = std({ map: hazardTex([2, 1]) });
    for (const [x, z] of [[-10, -4.6], [6.2, -4.6], [-14.5, 5], [14.5, 5]] as [number, number][]) {
      this.box(0.7, 5, 0.7, pillarMat, x, 2.5, z);
      this.box(0.74, 0.6, 0.74, hazardMat, x, 0.3, z);
      this.solid(x, z, 0.74, 0.74, 5, true, 'pillar');
    }

    // Posters on the walls
    const style = { bg: '#fdf6e3', fg: '#2c3e50', border: '#1f6f5c' };
    const spots: [number, number, number, number][] = [
      [ROOM.minX + 0.03, 2.8, -4, Math.PI / 2],
      [ROOM.maxX - 0.03, 2.8, 2, -Math.PI / 2],
      [-3, 3.0, ROOM.minZ + 0.03, 0],
      [ROOM.minX + 0.03, 2.8, 5.6, Math.PI / 2],
      [ROOM.maxX - 0.03, 2.8, 9, -Math.PI / 2],
    ];
    POSTERS.forEach((lines, i) => {
      const s = spots[i % spots.length];
      this.sign(lines, 2.4, 1.4, s[0], s[1], s[2], s[3], style, 'A motivational poster. The robots find it motivating.');
    });
  }

  /** Glass front with automatic doors, the weather outside and the security gates. */
  private front(): void {
    const z = ROOM.maxZ;
    const W = ROOM.maxX - ROOM.minX;
    // Outside: wet car park and a sky that has given up
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(48, 15), new THREE.MeshBasicMaterial({ map: outsideTex(), fog: false, color: '#c8c8c8' }));
    outside.position.set(0, 5.2, z + 6);
    outside.rotation.y = Math.PI;
    this.scene.add(outside);
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(48, 6, 12, 3), std({ color: '#3d3d3b', roughness: 0.3, metalness: 0.2 }));
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.position.set(0, -0.02, z + 3);
    this.scene.add(asphalt);
    for (let i = 0; i < 2; i++) {
      const tex = rainTex();
      tex.offset.x = i * 0.3;
      this.rain.push(tex);
      tex.repeat.set(60, 4);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.45, depthWrite: false }));
      p.position.set(0, 3.5, z + 1.2 + i * 2.0);
      p.rotation.y = Math.PI;
      this.scene.add(p);
    }

    // Kick panel, glass, header with the store name
    const frame = mat('#5b6068', { metalness: 0.5, roughness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: '#a9c6d6', transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.3, depthWrite: false });
    const segs: [number, number][] = [
      [ROOM.minX, DOORS.x0],
      [DOORS.x1, ROOM.maxX],
    ];
    for (const [a, b] of segs) {
      const w = b - a;
      const cx = (a + b) / 2;
      this.box(w, 0.5, 0.2, frame, cx, 0.25, z);
      this.box(w, 2.8, 0.04, glass, cx, 1.9, z);
      for (let x = a; x <= b + 0.01; x += w / Math.max(1, Math.round(w / 2.4))) this.box(0.1, 2.8, 0.14, frame, x, 1.9, z);
    }
    this.box(W, 0.12, 0.2, frame, 0, 3.3, z);
    this.box(W, 1.7, 0.3, std({ map: wallTex([W / 2.5, 1]) }), 0, 4.15, z + 0.05);
    this.colliders.push(aabb(0, z, W, 0.3, 5, false));
    this.sign(['SHOPOTRON EXPRESS', 'groceries at the speed of robots*'], 9, 1.4, 1.5, 4.15, z - 0.12, Math.PI, { bg: '#c0392b', fg: '#ffffff', border: '#ffffff' });
    this.sign(['*except lane 7'], 2.6, 0.3, 4.8, 3.55, z - 0.12, Math.PI, { bg: '#ffffff', fg: '#555555' });
    // Window stickers
    const stickers: [string[], number, string][] = [
      [['SALE', 'nothing is', 'cheaper'], -14, '#f2d31b'],
      [['NOW HIRING', 'robots only'], -11, '#7cc44a'],
      [['OPEN 24/7', 'humans 9 to 5'], 9, '#f2d31b'],
      [['NO HUMANS', 'WITHOUT', 'SUPERVISION'], 13.5, '#ff8a6a'],
    ];
    for (const [lines, x, bg] of stickers) this.sign(lines, 1.3, 0.9, x, 1.6, z - 0.04, Math.PI, { bg, fg: '#1b1b1b', border: '#1b1b1b' });

    // Automatic sliding doors
    const doorW = (DOORS.x1 - DOORS.x0) / 2;
    const doorGlass = new THREE.MeshStandardMaterial({ color: '#b9d6e6', transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false });
    this.doorL = this.box(doorW, 2.8, 0.05, doorGlass, DOORS.x0 + doorW / 2, 1.5, z - 0.05);
    this.doorR = this.box(doorW, 2.8, 0.05, doorGlass, DOORS.x1 - doorW / 2, 1.5, z - 0.05);
    for (const d of [this.doorL, this.doorR]) {
      this.box(doorW, 0.1, 0.07, frame, 0, -1.4, 0, d);
      this.box(doorW, 0.1, 0.07, frame, 0, 1.4, 0, d);
      const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), std({ map: textTexture(['AUTO', 'DOOR'], { w: 64, h: 64, bg: '#f2d31b', fg: '#1b1b1b' }), transparent: true }));
      sticker.position.set(0, 0, -0.03);
      sticker.rotation.y = Math.PI;
      d.add(sticker);
    }
    this.box(DOORS.x1 - DOORS.x0 + 0.4, 0.3, 0.3, frame, (DOORS.x0 + DOORS.x1) / 2, 3.05, z - 0.1);
    this.sign(['ENTRANCE + EXIT', 'mind the robots'], 2.2, 0.5, (DOORS.x0 + DOORS.x1) / 2, 2.75, z - 0.3, Math.PI, { bg: '#1f6f5c', fg: '#ffffff', font: PX });
    // Rain mat at the door and a wet floor sign (it is raining, so this time it is water)
    const rainMat = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.2), std({ map: matTex([8, 4]) }));
    rainMat.rotation.x = -Math.PI / 2;
    rainMat.position.set((DOORS.x0 + DOORS.x1) / 2, 0.01, z - 1.3);
    this.scene.add(rainMat);
    const wet = new THREE.Group();
    wet.position.set(-3.9, 0, 12.2);
    wet.rotation.y = -0.5;
    const wetMat = std({ map: wetFloorTex(), side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.6), wetMat);
      p.position.set(0, 0.29, s * 0.1);
      p.rotation.x = s * 0.33;
      wet.add(p);
    }
    // fun.ts turns it into something you can carry around
    this.scene.add(wet);
    this.wetSign = wet;

    // Security gates in front of the doors
    const gateMat = mat('#c9ccd0', { metalness: 0.4, roughness: 0.5 });
    for (const x of [-8.6, -6.6, -4.6]) {
      this.box(0.18, 1.5, 0.7, gateMat, x, 0.75, 11.6);
      this.box(0.2, 0.08, 0.72, mat('#3a3d42'), x, 1.52, 11.6);
      const lamp = new THREE.MeshStandardMaterial({ color: '#2a5a2a', emissive: '#30ff60', emissiveIntensity: 0.6 });
      this.gateLamps.push(lamp);
      this.box(0.12, 0.08, 0.12, lamp, x, 1.6, 11.6);
      this.solid(x, 11.6, 0.2, 0.7, 1.5, false, 'gate');
    }
    this.sign(['SECURITY GATE', 'beeps at humans'], 0.7, 0.3, -6.6, 1.25, 11.24, Math.PI, { bg: '#2c3e50', fg: '#ffffff' });
  }

  // ---------------------------------------------------------------- checkout lanes

  /** One checkout lane at x. The open lane gets more toys in myLane(). */
  private lane(n: number, x: number, open: boolean): void {
    const C = COUNTER;
    const len = C.z1 - C.z0;
    const cz = (C.z0 + C.z1) / 2;
    const lam = std({ map: laminateTex([1, 4]) });
    const steel = std({ map: steelTex([4, 1]), metalness: 0.5, roughness: 0.45 });
    const dark = mat('#2b2d31');
    // Counter body and steel top
    this.box(C.halfW * 2, C.h - 0.04, len, lam, x, (C.h - 0.04) / 2, cz);
    this.box(C.halfW * 2 + 0.04, 0.04, len + 0.04, steel, x, C.h - 0.02, cz);
    this.box(C.halfW * 2 + 0.02, 0.1, len, dark, x, 0.05, cz);
    this.solid(x, cz, C.halfW * 2 + 0.04, len + 0.04, C.h, false, 'counter');
    // Belt
    const beltLen = BELT.z1 - BELT.z0;
    const bt = beltTex();
    bt.repeat.set(1, beltLen * 3);
    bt.rotation = Math.PI / 2;
    const belt = new THREE.Mesh(new THREE.PlaneGeometry(0.62, beltLen), std({ map: bt, roughness: 0.9 }));
    belt.rotation.x = -Math.PI / 2;
    belt.position.set(x, BELT.y - 0.005, (BELT.z0 + BELT.z1) / 2);
    this.scene.add(belt);
    if (open) this.belt = bt;
    else {
      const dust = new THREE.Mesh(new THREE.PlaneGeometry(0.62, beltLen), new THREE.MeshBasicMaterial({ map: dustTex(), transparent: true, depthWrite: false }));
      dust.rotation.x = -Math.PI / 2;
      dust.position.set(x, BELT.y, (BELT.z0 + BELT.z1) / 2);
      this.scene.add(dust);
    }
    for (const s of [-1, 1]) this.box(0.05, 0.06, beltLen, steel, x + s * 0.34, BELT.y + 0.02, (BELT.z0 + BELT.z1) / 2);
    // Scanner glass
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, SCAN.z1 - SCAN.z0), mat('#101418', { roughness: 0.15, metalness: 0.4 }));
    sg.rotation.x = -Math.PI / 2;
    sg.position.set(x, C.h + 0.002, (SCAN.z0 + SCAN.z1) / 2);
    this.scene.add(sg);
    this.box(0.12, 0.34, 0.5, dark, x + 0.3, C.h + 0.17, (SCAN.z0 + SCAN.z1) / 2);
    // Bagging tray (a little lower) with the bag carousel poles
    const bagLen = BAG.z1 - BAG.z0;
    this.box(0.86, 0.03, bagLen, steel, x, BAG.y, (BAG.z0 + BAG.z1) / 2);
    for (const s of [-1, 1]) this.box(0.03, 0.3, bagLen, steel, x + s * 0.43, BAG.y + 0.15, (BAG.z0 + BAG.z1) / 2);
    const pole = mat('#7f8c8d', { metalness: 0.6 });
    this.box(0.04, 0.5, 0.04, pole, x + 0.3, BAG.y + 0.25, BAG.z1 - 0.1);
    this.box(0.5, 0.03, 0.03, pole, x + 0.1, BAG.y + 0.48, BAG.z1 - 0.1);

    // Cashier box: low walls on the east and north side, rubber mat on the floor
    const panel = std({ map: laminateTex([2, 1]) });
    const wallLen = len;
    this.box(0.08, 1.1, wallLen, panel, x + CASHIER_WALL_X, 0.55, cz);
    this.box(0.12, 0.04, wallLen + 0.04, steel, x + CASHIER_WALL_X, 1.12, cz);
    this.solid(x + CASHIER_WALL_X, cz, 0.1, wallLen, 1.1, false, 'counter');
    this.box(CASHIER_WALL_X - C.halfW, 1.1, 0.08, panel, x + (CASHIER_WALL_X + C.halfW) / 2, 0.55, C.z0);
    this.solid(x + (CASHIER_WALL_X + C.halfW) / 2, C.z0, CASHIER_WALL_X - C.halfW, 0.1, 1.1, false, 'counter');
    const rubber = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.2), std({ map: matTex([5, 12]) }));
    rubber.rotation.x = -Math.PI / 2;
    rubber.position.set(x + 1.17, 0.012, 0.6);
    this.scene.add(rubber);

    // Lane light: a pole with the lane number on top
    const lp = mat('#3a3d42', { metalness: 0.5 });
    this.box(0.08, 2.4, 0.08, lp, x + 0.32, 1.2 + C.h, C.z0 + 0.1);
    const on = laneNumberTex(n, true);
    const off = laneNumberTex(n, false);
    const lm = new THREE.MeshBasicMaterial({ map: open ? on : off });
    const lbox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), lm);
    lbox.position.set(x + 0.32, C.h + 2.6, C.z0 + 0.1);
    this.scene.add(lbox);
    if (open) {
      this.laneLight = lm;
      this.laneLightOn = on;
      this.laneLightOff = off;
    }

    // Customer side: candy rack and magazine rack against the neighbour's wall
    const rx = x - CASHIER_WALL_X - 0.14;
    const candy = new THREE.Group();
    candy.position.set(rx + 0.02, 0, -0.9);
    const rackFrame = mat('#4a4f56', { metalness: 0.5 });
    this.box(0.22, 1.4, 1.8, rackFrame, 0, 0.7, 0, candy);
    const cf = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.25), std({ map: candyTex() }));
    cf.rotation.y = Math.PI / 2;
    cf.position.set(0.115, 0.72, 0);
    candy.add(cf);
    for (let i = 0; i < 4; i++) this.box(0.08, 0.02, 1.7, steel, 0.14, 0.18 + i * 0.31, 0, candy);
    const ch = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.26), std({ map: textTexture(['TREATS FOR UNITS'], { w: 256, h: 56, bg: '#c0392b', fg: '#ffffff', font: PX }) }));
    ch.rotation.y = Math.PI / 2;
    ch.position.set(0.115, 1.53, 0);
    candy.add(ch);
    candy.userData.interact = { kind: 'candy', lane: n } satisfies Interact;
    this.scene.add(candy);
    this.interactables.push(candy);
    this.solid(rx + 0.02, -0.9, 0.24, 1.8, 1.4, false, 'rack');

    const mags = new THREE.Group();
    mags.position.set(rx + 0.02, 0, 1.25);
    this.box(0.24, 1.55, 1.3, rackFrame, 0, 0.78, 0, mags);
    const mf = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.78), std({ map: magazinesTex() }));
    mf.rotation.y = Math.PI / 2;
    mf.position.set(0.125, 1.05, 0);
    mags.add(mf);
    for (const y of [0.66, 1.05]) this.box(0.1, 0.03, 1.24, steel, 0.16, y - 0.02, 0, mags);
    mags.userData.interact = { kind: 'mags' } satisfies Interact;
    this.scene.add(mags);
    this.interactables.push(mags);
    this.solid(rx + 0.02, 1.25, 0.26, 1.3, 1.55, false, 'rack');

    if (!open) this.closedLane(n, x);
  }

  private closedLane(n: number, x: number): void {
    const C = COUNTER;
    // A chain across the customer aisle with a sign
    const chain = mat('#c9ccd0', { metalness: 0.7, roughness: 0.3 });
    const ax = x - C.halfW - 0.85;
    for (const px of [x - C.halfW - 0.05, x - CASHIER_WALL_X + 0.05]) this.box(0.06, 0.9, 0.06, mat('#c0392b'), px, 0.45, C.z0 - 0.3);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, CASHIER_WALL_X - C.halfW - 0.1, 5), chain);
    c.rotation.z = Math.PI / 2;
    c.position.set(ax, 0.8, C.z0 - 0.3);
    this.scene.add(c);
    const lines = n === 5 ? ['LANE CLOSED', 'replaced by', 'feelings'] : ['CLOSED', 'FOREVER'];
    const s1 = this.sign(lines, 0.9, 0.5, ax, 0.62, C.z0 - 0.33, Math.PI, { bg: '#c0392b', fg: '#ffffff', border: '#ffffff', font: PX });
    const s2 = this.sign(lines, 0.9, 0.5, ax, 0.62, C.z0 - 0.27, 0, { bg: '#c0392b', fg: '#ffffff', border: '#ffffff', font: PX }, 'This lane has been closed since 2061. The belt still dreams of groceries.');
    if (n === 5) this.lane5Signs = [s1, s2];
    this.solid(ax, C.z0 - 0.3, CASHIER_WALL_X - C.halfW, 0.1, 0.9, false, 'chain');
    // A sign on the counter, an old stool and cobwebs
    this.sign(['CLOSED', 'FOREVER'], 0.5, 0.3, x, C.h + 0.15, C.z0 + 0.6, 0, { bg: '#ffffff', fg: '#c0392b', border: '#c0392b', font: PX });
    const stool = new THREE.Group();
    stool.position.set(x + 1.2, 0, 1.6);
    const sm = mat('#6b4f3a');
    this.box(0.36, 0.05, 0.36, sm, 0, 0.62, 0, stool);
    for (const [sx, sz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) this.box(0.04, 0.62, 0.04, sm, sx, 0.31, sz, stool);
    if (n === 6) {
      stool.rotation.z = Math.PI / 2;
      stool.position.y = 0.2;
    } else this.stools.push(stool);
    this.scene.add(stool);
    const web = new THREE.MeshBasicMaterial({ color: '#e8e8e8', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false });
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), web);
    w1.position.set(x + 0.32, C.h + 2.2, C.z0 + 0.35);
    w1.rotation.set(0.4, 0.6, 0);
    this.scene.add(w1);
    this.sign(['THANK YOU FOR', 'NOT SHOPPING', 'HERE'], 0.6, 0.4, x - 0.2, 1.45, C.z0 + 1.2, -Math.PI / 2, { bg: '#fdf6e3', fg: '#2c3e50' });
  }

  /** The open lane: register, drawer, bags, screens and signs. */
  private myLane(): void {
    const C = COUNTER;
    const steel = std({ map: steelTex([2, 1]), metalness: 0.5, roughness: 0.45 });
    const dark = mat('#2b2d31');

    // Over the lane, both sides
    for (const [z, r] of [[-2.9, 0], [3.6, Math.PI]] as [number, number][]) {
      this.sign(['THIS LANE IS STAFFED', 'BY A HUMAN'], 3.2, 0.8, 0.3, 3.4, z, r, { bg: '#f2d31b', fg: '#7a1f14', border: '#7a1f14', font: PX }, 'THIS LANE IS STAFFED BY A HUMAN. Robots queue here to watch.');
    }
    const chain = mat('#3a3a3a', { metalness: 0.6 });
    for (const x of [-1.1, 1.7]) for (const z of [-2.9, 3.6]) this.box(0.02, 1.2, 0.02, chain, x, 4.4, z);

    // Interactable scanner, with red laser lines that flash on a beep
    const scanner = new THREE.Group();
    scanner.position.set(0, C.h, (SCAN.z0 + SCAN.z1) / 2);
    this.scanGlow = new THREE.MeshBasicMaterial({ color: '#ff2020', transparent: true, opacity: 0.7 });
    for (const a of [0.5, -0.5, 0]) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.6), this.scanGlow);
      l.rotation.x = -Math.PI / 2;
      l.rotation.z = a;
      l.position.y = 0.004;
      scanner.add(l);
    }
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.36, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.16;
    scanner.add(hit);
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.24), new THREE.MeshBasicMaterial({ color: '#3a0808' }));
    sw.position.set(0.361, 0.19, 0);
    sw.rotation.y = Math.PI / 2;
    const swl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.06), new THREE.MeshBasicMaterial({ map: textTexture(['SCAN HERE'], { w: 128, h: 26, bg: '#3a0808', fg: '#ff6a5a', font: PX }) }));
    swl.position.set(0.362, 0.04, 0);
    swl.rotation.y = Math.PI / 2;
    scanner.add(swl);
    scanner.add(sw);
    scanner.userData.interact = { kind: 'scanner' } satisfies Interact;
    this.scene.add(scanner);
    this.interactables.push(scanner);

    // Bagging area: bags that fill up, the indicator light and the unexpected item spot
    const bagging = new THREE.Group();
    bagging.position.set(0, BAG.y, (BAG.z0 + BAG.z1) / 2);
    const bhit = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.36, BAG.z1 - BAG.z0), new THREE.MeshBasicMaterial({ visible: false }));
    bhit.position.y = 0.15;
    bagging.add(bhit);
    bagging.userData.interact = { kind: 'bagging' } satisfies Interact;
    this.scene.add(bagging);
    this.interactables.push(bagging);
    this.bagGroup.position.set(0, BAG.y + 0.015, 0);
    this.scene.add(this.bagGroup);
    const bagMat = std({ map: bagTex(), roughness: 0.6, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Group();
      b.position.set(0, 0, BAG.z0 + 0.3 + i * 0.55);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.26), bagMat);
      body.position.y = 0.18;
      b.add(body);
      for (const s of [-1, 1]) {
        const h = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 8, Math.PI), bagMat);
        h.position.set(s * 0.1, 0.36, 0);
        b.add(h);
      }
      b.scale.y = 0.15;
      this.bags.push(b);
      this.bagGroup.add(b);
    }
    this.indicator = new THREE.MeshStandardMaterial({ color: '#204020', emissive: '#30ff60', emissiveIntensity: 0.4 });
    const ind = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 10), this.indicator);
    ind.position.set(0.3, BAG.y + 0.62, BAG.z1 - 0.1);
    this.scene.add(ind);
    this.sign(['BAGGING AREA'], 0.7, 0.16, 0, BAG.y + 0.34, BAG.z1 + 0.012, 0, { bg: '#1f6f5c', fg: '#ffffff', font: PX });

    // Register pedestal with the cash register, its screen and the code sheet
    const R = REGISTER;
    this.box(R.w, R.h, R.d, std({ map: laminateTex([1, 1]) }), R.x, R.h / 2, R.z);
    this.box(R.w + 0.04, 0.03, R.d + 0.04, steel, R.x, R.h + 0.015, R.z);
    this.solid(R.x, R.z, R.w, R.d, R.h, false, 'register');
    const reg = new THREE.Group();
    reg.position.set(R.x, R.h + 0.03, R.z);
    const regModel = this.prop('register', 0, 0, 0, Math.PI / 2, reg);
    if (regModel) regModel.scale.setScalar(0.6);
    else {
      this.box(0.4, 0.14, 0.4, mat('#4a4f56'), 0, 0.07, 0, reg);
      this.box(0.3, 0.22, 0.04, mat('#2b2d31'), -0.05, 0.3, -0.1, reg);
    }
    // Register display facing the cashier
    const rs = screenCanvas(128, 72);
    this.regScreen = { g: rs.g, tex: rs.tex, last: '' };
    const disp = new THREE.Group();
    disp.position.set(R.x - 0.02, R.h + 0.5, R.z - 0.12);
    disp.rotation.y = Math.PI / 2 - 0.35;
    this.box(0.38, 0.25, 0.05, dark, 0, 0, -0.03, disp);
    const dscreen = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.2), new THREE.MeshBasicMaterial({ map: rs.tex }));
    disp.add(dscreen);
    this.box(0.04, 0.4, 0.04, dark, 0, -0.3, -0.05, disp);
    this.scene.add(disp);
    reg.userData.interact = { kind: 'register' } satisfies Interact;
    disp.userData.interact = { kind: 'register' } satisfies Interact;
    this.scene.add(reg);
    this.interactables.push(reg, disp);
    // The code sheet, taped next to the register display
    const sheetTex = make('co-codesheet', 128, 176, (g) => {
      g.fillStyle = '#fbf6e2';
      g.fillRect(0, 0, 128, 176);
      g.fillStyle = '#7a1f14';
      g.font = 'bold 10px monospace';
      g.fillText('PRODUCE CODES', 6, 13);
      g.font = '8px monospace';
      codeSheetLines().forEach(([n, c], i) => {
        g.fillStyle = '#222222';
        g.fillText(n.slice(0, 17), 5, 26 + i * 7.6);
        g.fillStyle = '#1b3a7a';
        g.fillText(c, 104, 26 + i * 7.6);
      });
      g.fillStyle = 'rgba(232,220,160,0.9)';
      g.fillRect(10, 0, 26, 6);
      g.fillRect(92, 0, 26, 6);
    });
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3), std({ map: sheetTex }));
    sheet.position.set(0.31, -0.06, 0.0);
    sheet.rotation.z = -0.04;
    disp.add(sheet);
    sheet.userData.interact = { kind: 'codesheet' } satisfies Interact;
    this.interactables.push(sheet);

    // Cash drawer under the register, slides out towards the cashier
    this.drawer.position.set(R.x + R.w / 2 - 0.2, 0.7, R.z);
    this.box(0.42, 0.12, 0.5, mat('#2b2d31', { metalness: 0.5 }), 0, 0, 0, this.drawer);
    const tray = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.46), std({ map: tillTex() }));
    tray.rotation.x = -Math.PI / 2;
    tray.rotation.z = Math.PI / 2;
    tray.position.y = 0.062;
    this.drawer.add(tray);
    const handle = this.box(0.03, 0.04, 0.2, mat('#9aa0a6', { metalness: 0.8 }), 0.225, 0, 0, this.drawer);
    handle.position.x = 0.225;
    this.drawer.userData.interact = { kind: 'drawer' } satisfies Interact;
    this.scene.add(this.drawer);
    this.interactables.push(this.drawer);

    // Card terminal on the customer side, facing the robots
    const term = new THREE.Group();
    term.position.set(-C.halfW + 0.1, C.h, 1.3);
    this.box(0.04, 0.3, 0.04, dark, 0, 0.15, 0, term);
    const head = new THREE.Group();
    head.position.y = 0.34;
    head.rotation.z = 0.5;
    this.box(0.14, 0.04, 0.22, mat('#3a3d42'), 0, 0, 0, head);
    const ts = screenCanvas(64, 40);
    this.termScreen = { g: ts.g, tex: ts.tex, last: '' };
    const tsm = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.08), new THREE.MeshBasicMaterial({ map: ts.tex }));
    tsm.rotation.x = -Math.PI / 2;
    tsm.rotation.z = -Math.PI / 2;
    tsm.position.set(0, 0.022, -0.04);
    head.add(tsm);
    for (let i = 0; i < 6; i++) this.box(0.025, 0.01, 0.025, mat('#d0d0d0'), -0.03 + (i % 3) * 0.03, 0.025, 0.05 + Math.floor(i / 3) * 0.03, head);
    term.add(head);
    term.userData.interact = { kind: 'terminal' } satisfies Interact;
    this.scene.add(term);
    this.interactables.push(term);
    this.terminal = term;

    // Staff candy rack in the cashier nook (very tempting)
    const staff = new THREE.Group();
    staff.position.set(1.42, 0, C.z0 + 0.2);
    this.box(0.8, 1.2, 0.22, mat('#4a4f56', { metalness: 0.5 }), 0, 0.6, 0, staff);
    const sf = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 1.1), std({ map: candyTex() }));
    sf.position.set(0, 0.62, 0.115);
    staff.add(sf);
    const sl = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.16), std({ map: textTexture(['STAFF: DO NOT EAT'], { w: 256, h: 56, bg: '#ffffff', fg: '#c0392b', font: PX }) }));
    sl.position.set(0, 1.3, 0.115);
    staff.add(sl);
    this.box(0.8, 0.2, 0.22, mat('#4a4f56'), 0, 1.3, -0.005, staff);
    staff.userData.interact = { kind: 'candy', lane: 7 } satisfies Interact;
    this.scene.add(staff);
    this.interactables.push(staff);
    this.solid(1.42, C.z0 + 0.2, 0.8, 0.24, 1.3, false, 'rack');

    // Bag dispenser and receipt rolls on the cashier wall, a stool nobody may sit on
    const bagRoll = mat('#ecebe4');
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 10), bagRoll);
      r.rotation.x = Math.PI / 2;
      r.position.set(CASHIER_WALL_X - 0.1, 1.2, 1.6 + i * 0.28);
      this.scene.add(r);
    }
    this.sign(['BAGS €0.50', 'dignity: free'], 0.6, 0.3, CASHIER_WALL_X - 0.05, 0.85, 2.0, -Math.PI / 2, { bg: '#ffffff', fg: '#2c3e50', border: '#2c3e50' });
    this.sign(['NO SITTING', 'Reg. 12.4'], 0.4, 0.26, CASHIER_WALL_X - 0.05, 0.85, -0.6, -Math.PI / 2, { bg: '#c0392b', fg: '#ffffff' }, 'There is no stool. There was a stool. The stool was a privilege.');
    // Floor stickers for the queue
    for (const z of [-3.5, -5.3, -7.1]) {
      const st = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.25), std({ map: textTexture(['PLEASE WAIT HERE'], { w: 256, h: 64, bg: '#f2d31b', fg: '#1b1b1b' }) }));
      st.rotation.x = -Math.PI / 2;
      st.position.set(-1.1, 0.012, z + 0.55);
      this.scene.add(st);
    }
    // A sticky note on the counter
  }

  private selfCheckouts(): void {
    for (const s of SELF_CHECKOUTS) {
      const o = this.prop('selfCheckout', s.x, 0, s.z, s.rot);
      if (!o) this.box(0.8, 1.3, 0.7, mat('#5b6068'), s.x, 0.65, s.z);
      const sc = screenCanvas(64, 48);
      this.selfScreens.push({ g: sc.g, tex: sc.tex });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26), new THREE.MeshBasicMaterial({ map: sc.tex }));
      const dir = s.rot < 0 ? -1 : 1;
      scr.position.set(s.x + dir * 0.38, 1.55, s.z);
      scr.rotation.y = dir * Math.PI / 2;
      this.scene.add(scr);
      this.box(0.06, 0.3, 0.38, mat('#2b2d31'), s.x + dir * 0.35, 1.55, s.z);
      this.solid(s.x, s.z, 0.9, 0.9, 1.4, false, 'selfcheckout');
    }
    this.sign(['SELF CHECKOUT', 'no humans involved'], 3.4, 0.8, 9.3, 3.5, 0.7, -Math.PI / 2, { bg: '#1f6f5c', fg: '#ffffff', border: '#ffffff', font: PX });
    this.sign(['SELF CHECKOUT', 'no humans involved'], 3.4, 0.8, 9.3, 3.5, 0.7, Math.PI / 2, { bg: '#1f6f5c', fg: '#ffffff', border: '#ffffff', font: PX });
    const board = this.sign(['AVERAGE SCAN TIME', 'ROBOT: 0.3 s', 'HUMAN: please wait'], 1.6, 0.9, 9.3, 1.3, 4.6, Math.PI, { bg: '#111111', fg: '#7cc44a' }, 'The board is updated live. The human number is always "please wait".');
    const pole = this.box(0.08, 1.2, 0.08, mat('#3a3d42'), 9.3, 0.6, 4.65);
    this.scanBoard = { sign: board, pole, collider: this.solid(9.3, 4.65, 0.3, 0.3, 1.4, false, 'decor') };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 4.6), std({ color: '#2f5f52', roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(9.3, 0.008, 0.7);
    this.scene.add(floor);
  }

  private serviceDesk(): void {
    const red = mat('#8e2a1f');
    const top = mat('#f4f4f4');
    // An L-shaped desk in the south-west corner
    this.box(4.2, 1.0, 1.0, red, -15.6, 0.5, 8.4);
    this.box(4.3, 0.05, 1.1, top, -15.6, 1.02, 8.4);
    this.box(1.0, 1.0, 2.8, red, -14.0, 0.5, 10.3);
    this.box(1.1, 0.05, 2.9, top, -14.0, 1.02, 10.3);
    this.solid(-15.6, 8.4, 4.3, 1.1, 1.05, false, 'desk');
    this.solid(-14.0, 10.3, 1.1, 2.9, 1.05, false, 'desk');
    this.sign(['CUSTOMER SERVICE', 'complaints: 03:00 to 03:05'], 3.4, 0.8, -15.6, 3.2, 7.88, Math.PI, { bg: '#2c3e50', fg: '#ffffff', border: '#f2d31b', font: PX });
    this.sign(['NOW SERVING', '0'], 0.8, 0.5, -16.6, 1.6, 8.0, Math.PI, { bg: '#111111', fg: '#ff4d4d' }, 'NOW SERVING: 0. It has said 0 since the store opened.');
    this.box(0.05, 0.6, 0.05, mat('#3a3d42'), -16.6, 1.3, 8.05);
    this.prop('register', -15.2, 1.05, 8.4, Math.PI);
    // A bell, a lost and found box, a hand truck, the TV with static
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d4ac0d', { metalness: 0.8, roughness: 0.3 }));
    bell.position.set(-14.3, 1.05, 8.1);
    bell.userData.interact = { kind: 'sign', text: 'Ding. Nobody comes. Nobody has ever come.' } satisfies Interact;
    this.scene.add(bell);
    this.interactables.push(bell);
    const lost = this.box(0.5, 0.36, 0.4, boxMaterials(2), -16.9, 1.23, 8.4);
    lost.userData.interact = { kind: 'sign', text: 'LOST AND FOUND: three left arms, a human smile (unclaimed), one loyalty card.' } satisfies Interact;
    this.interactables.push(lost);
    this.sign(['LOST+FOUND'], 0.5, 0.12, -16.9, 1.25, 8.19, Math.PI, { bg: '#ffffff', fg: '#1b1b1b' });
    this.handTruck = this.prop('coHandTruck', -17.3, 0, 10.8, 0.4);
    this.tv = tvStatic();
    const tv = new THREE.Group();
    tv.position.set(-17.7, 3.0, 9.8);
    tv.rotation.y = Math.PI / 2;
    this.box(1.1, 0.75, 0.4, mat('#2b2d31'), 0, 0, -0.2, tv);
    const tvs = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.6), new THREE.MeshBasicMaterial({ map: this.tv.texture }));
    tvs.position.z = 0.005;
    tv.add(tvs);
    this.tvScreen = tvs;
    this.scene.add(tv);

    // The toilet key, chained to a full shopping cart nobody owns
    const cart = new Item(CART_KEY_DEF);
    cart.state = 'fixed';
    cart.mesh.position.set(CART_KEY_POS.x, cart.baseOffset, CART_KEY_POS.z);
    cart.mesh.rotation.y = Math.PI / 2;
    this.scene.add(cart.mesh);
    this.initialItems.push(cart);
    this.sign(['TOILET KEY', 'please return the cart', 'it is not yours either'], 1.0, 0.55, -13.47, 1.45, CART_KEY_POS.z, Math.PI / 2, { bg: '#ffffff', fg: '#c0392b', border: '#c0392b' });

    // Locked robot oil cabinet on the west wall
    const cab = new THREE.Group();
    cab.position.set(ROOM.minX + 0.35, 0, 2.6);
    cab.rotation.y = Math.PI / 2;
    this.box(1.4, 2.0, 0.5, mat('#3a2f25'), 0, 1.0, 0, cab);
    for (const y of [0.5, 1.05, 1.6]) {
      this.box(1.3, 0.03, 0.44, mat('#6b5a48'), 0, y - 0.02, 0.02, cab);
      for (let i = 0; i < 5; i++) {
        if (!this.prop('coOil', -0.5 + i * 0.25, y, 0.05, 0, cab)) this.box(0.08, 0.24, 0.08, mat('#d4ac0d'), -0.5 + i * 0.25, y + 0.12, 0.05, cab);
      }
    }
    const cglass = new THREE.MeshStandardMaterial({ color: '#c9e0ea', transparent: true, opacity: 0.25, roughness: 0.1, depthWrite: false });
    this.cabinetGlass = this.box(1.36, 1.9, 0.02, cglass, 0, 1.0, 0.26, cab);
    this.box(0.12, 0.16, 0.06, mat('#d4ac0d', { metalness: 0.8, roughness: 0.3 }), 0.05, 1.05, 0.29, cab);
    const csign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.34), std({ map: textTexture(['ROBOT OIL (18+)', 'ask staff. staff has no key.'], { w: 320, h: 84, bg: '#111111', fg: '#f2d31b', font: PX }) }));
    csign.position.set(0, 2.2, 0.26);
    cab.add(csign);
    cab.userData.interact = { kind: 'sign', text: 'ROBOT OIL (18+). Locked. The key is with Brad. Brad says the key is "a journey".' } satisfies Interact;
    this.scene.add(cab);
    this.interactables.push(cab);
    this.cabinet = cab;
    this.solid(ROOM.minX + 0.35, 2.6, 0.5, 1.4, 2.0, true, 'cabinet');
  }

  /** The store behind the lanes: shelf rows with products, freezers, promo piles. */
  private aisles(): void {
    const frameM = std({ map: shelfMetalTex([8, 2]), roughness: 0.6 });
    const rows: [number, number, number, string, number][] = [
      [-7.8, -16.5, -4.0, 'AISLE 12: OILS + LUBRICANTS', 0],
      [-7.8, 2.0, 10.5, 'AISLE 13: SPARE PARTS + SNACKS', 1],
      [-11.4, -16.5, -4.0, 'AISLE 14: HUMAN FOOD (heritage)', 2],
      [-11.4, 2.0, 9.5, 'AISLE 15: BATTERIES + FEELINGS', 3],
    ];
    for (const [z, x0, x1, title, v] of rows) {
      const len = x1 - x0;
      const cx = (x0 + x1) / 2;
      this.box(len, 2.0, 0.08, frameM, cx, 1.0, z);
      this.box(len, 0.22, 0.7, frameM, cx, 0.11, z);
      this.box(len, 0.04, 0.7, frameM, cx, 2.02, z);
      for (const s of [-1, 1]) {
        this.box(0.06, 2.0, 0.7, frameM, cx + (s * len) / 2, 1.0, z);
        for (const y of [0.25, 0.85, 1.45]) {
          this.box(len, 0.03, 0.66, mat('#e8ecef'), cx, y, z);
          const f = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.1, 0.52), std({ map: (() => {
            const t = facingsTex(v + (y > 1 ? 1 : 0)).clone();
            t.repeat.set(len / 2, 1);
            t.needsUpdate = true;
            return t;
          })() }));
          f.position.set(cx, y + 0.28, z + s * 0.3);
          if (s < 0) f.rotation.y = Math.PI;
          this.scene.add(f);
        }
      }
      for (const s of [-1, 1]) {
        const sg = this.sign([title], 4.2, 0.45, cx, 2.9, z + s * 0.02, s < 0 ? Math.PI : 0, { bg: '#1f6f5c', fg: '#ffffff', border: '#ffffff', font: PX });
        sg.renderOrder = 1;
      }
      const chainM = mat('#3a3a3a', { metalness: 0.6 });
      for (const dx of [-1.8, 1.8]) this.box(0.02, 1.9, 0.02, chainM, cx + dx, 4.05, z);
      this.solid(cx, z, len + 0.06, 0.7, 2.05, true, 'shelf');
    }
    // Freezers and shop furniture along the back wall
    for (const x of [-15.5, -13.2, -10.9]) if (this.prop('freezer', x, 0, ROOM.minZ + 0.55)) this.solid(x, ROOM.minZ + 0.55, 2.25, 1.1, 2.0, false, 'decor');
    const back: [string, number, number][] = [
      ['coShelfBoxes', -2.5, 0],
      ['coShelfBags', -0.5, 0],
      ['coDisplayCans', 1.6, 0],
      ['coDisplayBread', 3.4, 0],
      ['coShelfBoxes', 9.8, 0],
    ];
    for (const [k, x, r] of back) if (this.prop(k, x, 0, ROOM.minZ + 0.6, r)) this.solid(x, ROOM.minZ + 0.6, 1.6, 1.0, 1.8, false, 'decor');
    this.sign(['FROZEN', 'like your wages'], 2.4, 0.7, -13.2, 3.0, ROOM.minZ + 0.03, 0, { bg: '#2e86c1', fg: '#ffffff', border: '#ffffff', font: PX });
    // Promo piles of boxes
    const r = rng(77);
    const pile = (cx: number, cz: number, lines: string[]) => {
      let y = 0;
      for (const n of [3, 2, 1]) {
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            const b = this.box(0.42, 0.34, 0.42, boxMaterials(Math.floor(r() * 7)), cx + (i - (n - 1) / 2) * 0.44, y + 0.17, cz + (j - (n - 1) / 2) * 0.44);
            b.rotation.y = (r() - 0.5) * 0.15;
          }
        }
        y += 0.34;
      }
      this.box(0.03, 1.2, 0.03, mat('#5a5a5a', { metalness: 0.5 }), cx, y + 0.6, cz);
      this.sign(lines, 0.9, 0.55, cx, y + 1.35, cz, Math.PI / 4, { bg: '#f2d31b', fg: '#b3160c', border: '#b3160c' });
      this.solid(cx, cz, 1.35, 1.35, y, true, 'promo');
    };
    pile(-12.5, -2.8, ['BUY 3', 'PAY 4']);
    pile(11.8, -3.0, ['NEW!', 'same as old']);
    pile(14.8, -1.5, ['LAST CHANCE', '(not really)']);
  }

  /** Shopping carts, baskets, machines, cameras, ducts, stains. */
  private decor(): void {
    // Carts parked by the entrance
    let carts = 0;
    for (let i = 0; i < 5; i++) if (this.prop('cart', -12.6 + i * 0.42, 0, 12.9, Math.PI)) carts++;
    if (carts) this.solid(-11.8, 12.9, 2.4, 1.1, 1.0, false, 'carts');
    for (let i = 0; i < 4; i++) if (this.prop('cart', 1.2 + i * 0.42, 0, 12.9, Math.PI)) carts++;
    if (carts > 5) this.solid(1.8, 12.9, 2.1, 1.1, 1.0, false, 'carts');
    // Basket stack
    for (let i = 0; i < 5; i++) this.prop('coBasket', -3.0, i * 0.12, 11.0, (i % 2) * 0.1);
    if (hasModel('coBasket')) this.solid(-3.0, 11.0, 0.6, 0.45, 0.8, false, 'decor');
    // Bottle return and gacha machine by the doors
    this.bottleReturn = this.prop('coBottleReturn', -10.2, 0, 13.4, Math.PI);
    if (this.bottleReturn) this.solid(-10.2, 13.4, 1.0, 0.8, 1.7, false, 'decor');
    const gacha = this.prop('coGacha', -2.0, 0, 13.3, Math.PI);
    if (gacha) {
      // fun.ts handles E and kicks
      gacha.userData.interact = { kind: 'coFun', id: 'gacha', text: 'MYSTERY BOLTS. 1 credit. You have 0 credits. You will always have 0 credits.' } satisfies Interact;
      this.interactables.push(gacha);
      this.solid(-2.0, 13.3, 0.7, 0.7, 1.3, false, 'decor');
      this.gacha = gacha;
    }
    // Small displays near the lanes
    if (this.prop('coDisplaySmall', 6.4, 0, -2.8, 0)) this.solid(6.4, -2.8, 1.0, 0.7, 1.3, false, 'decor');
    if (this.prop('coDisplaySmall', -15.8, 0, -3.2, Math.PI / 2)) this.solid(-15.8, -3.2, 0.7, 1.0, 1.3, false, 'decor');
    if (this.prop('fruitDisplay', -6.0, 0, -4.6)) this.solid(-6.0, -4.6, 1.2, 1.2, 1.0, false, 'decor');
    if (this.prop('coFreezer', 2.8, 0, -4.6, 0)) this.solid(2.8, -4.6, 1.4, 0.9, 0.9, false, 'decor');
    this.sign(['ICE CREAM', 'robot flavour'], 1.0, 0.4, 2.8, 1.4, -4.6, 0, { bg: '#85c1e9', fg: '#1b4f72' });
    this.box(0.04, 0.5, 0.04, mat('#3a3d42'), 2.8, 1.0, -4.6);

    // Ducts and pipes under the ceiling
    const duct = std({ map: ductTex([20, 1]), metalness: 0.3 });
    for (const z of [-6, 7.5]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, ROOM.maxX - ROOM.minX, 10), duct);
      c.rotation.z = Math.PI / 2;
      c.position.set(0, 4.55, z);
      this.scene.add(c);
      for (let x = -16; x <= 16; x += 4) this.box(0.06, 0.25, 0.7, duct, x, 4.85, z);
    }
    const redPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, ROOM.maxZ - ROOM.minZ, 6), mat('#9e2a1e'));
    redPipe.rotation.x = Math.PI / 2;
    redPipe.position.set(-17.2, 4.7, 0);
    this.scene.add(redPipe);
    const greyPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, ROOM.maxX - ROOM.minX, 6), mat('#70757b'));
    greyPipe.rotation.z = Math.PI / 2;
    greyPipe.position.set(0, 4.75, -13.2);
    this.scene.add(greyPipe);
    // Speakers
    for (const [x, z] of [[-6, 2], [6, 2], [0, -9]] as [number, number][]) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 12), mat('#e8e4da'));
      sp.position.set(x, 4.94, z);
      this.scene.add(sp);
    }
    // Security cameras with blinking LEDs
    const camBody = std({ color: '#d8d8d2' });
    const camDark = std({ color: '#1a1a1a' });
    const led = new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 2 });
    const cams: [number, number, number, number][] = [
      [1.6, 4.4, -2.4, Math.PI * 0.85],
      [-17.6, 4.3, 13.6, Math.PI * 0.75],
      [17.6, 4.3, 13.6, -Math.PI * 0.75],
      [-17.6, 4.3, -13.6, Math.PI * 0.25],
      [12.75, 2.35, -10.4, -Math.PI / 2],
    ];
    for (const [x, y, z, yaw] of cams) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.rotation.y = yaw;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), camDark);
      arm.position.y = 0.12;
      g.add(arm);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.38), camBody);
      body.rotation.x = 0.35;
      g.add(body);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), led);
      l.position.set(0.06, 0.06, 0.18);
      g.add(l);
      this.camLeds.push(l);
      this.scene.add(g);
      this.cams.push(g);
    }
    // A wall clock that is always 08:59
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), std({ map: textTexture(['08:59', 'always'], { w: 128, h: 128, bg: '#fdf6e3', fg: '#1b1b1b', border: '#1b1b1b' }) }));
    clock.position.set(ROOM.maxX - 0.03, 3.4, -2);
    clock.rotation.y = -Math.PI / 2;
    this.scene.add(clock);
    // Trash cans (fun.ts makes them movable, so no colliders)
    const binMat = std({ color: '#3f4a3c' });
    for (const [x, z] of [[-5.2, 11.6], [5.6, 12.8], [12.5, -5]] as [number, number][]) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.75, 10), binMat);
      b.position.y = 0.375;
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 10), std({ color: '#2b3329' }));
      lid.position.y = 0.77;
      g.add(b, lid);
      this.scene.add(g);
      this.bins.push(g);
    }
    // Stains and receipts on the floor
    const stainMat = new THREE.MeshBasicMaterial({ color: '#5a4a32', transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    const r = rng(19);
    for (const [x, z, s] of [[-1.6, -4.2, 0.5], [-1.0, 4.4, 0.4], [3, 7, 0.6], [-9, 6.5, 0.45], [8.5, 6, 0.5], [-6.5, -9.6, 0.4], [12.5, -8, 0.5], [-2.5, 9, 0.35]] as [number, number, number][]) {
      const m = new THREE.Mesh(blobGeometry(s), stainMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = r() * 6;
      m.position.set(x, 0.006, z);
      this.scene.add(m);
    }
    const paper = mat('#f4f1e8');
    for (let i = 0; i < 9; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.22), paper);
      p.rotation.x = -Math.PI / 2;
      p.rotation.z = r() * 6;
      p.position.set(-2.2 + r() * 4.4, 0.01, 3.4 + r() * 3);
      this.scene.add(p);
    }
  }

  // ---------------------------------------------------------------- live state

  setBeltMoving(on: boolean): void {
    this.beltMoving = on;
  }

  setIndicator(state: 'ok' | 'busy' | 'error'): void {
    const c = state === 'ok' ? '#30ff60' : state === 'busy' ? '#ffcf4a' : '#ff3030';
    this.indicator.emissive.set(c);
  }

  /** The register display: up to 5 lines of pixel text. */
  setRegister(lines: string[], alert = false): void {
    const key = lines.join('|') + alert;
    if (key === this.regScreen.last) return;
    this.regScreen.last = key;
    const g = this.regScreen.g;
    g.fillStyle = alert ? '#2a0606' : '#061a10';
    g.fillRect(0, 0, 128, 72);
    g.fillStyle = alert ? '#ff5a4a' : '#7cff9a';
    g.font = '9px monospace';
    lines.slice(0, 6).forEach((l, i) => g.fillText(l.slice(0, 22), 4, 12 + i * 11));
    this.regScreen.tex.needsUpdate = true;
  }

  setTerminal(text: string, color = '#7cc44a'): void {
    const key = text + color;
    if (key === this.termScreen.last) return;
    this.termScreen.last = key;
    const g = this.termScreen.g;
    g.fillStyle = '#0b1a2a';
    g.fillRect(0, 0, 64, 40);
    g.fillStyle = color;
    g.font = 'bold 10px monospace';
    g.textAlign = 'center';
    text.split('\n').forEach((l, i) => g.fillText(l, 32, 16 + i * 12));
    g.textAlign = 'left';
    this.termScreen.tex.needsUpdate = true;
  }

  private animate(t: number): void {
    if (this.belt && this.beltMoving) this.belt.offset.x = (this.belt.offset.x - 0.012) % 1;
    for (let i = 0; i < this.rain.length; i++) this.rain[i].offset.y = (t * (1.4 + i * 0.3)) % 1;
    // Lane 7 light blinks: the human lane is OPEN (in theory)
    if (this.laneLight) this.laneLight.map = Math.sin(t * 4) > -0.3 ? this.laneLightOn : this.laneLightOff;
    // A dying tube over lane 5
    if (this.flicker) {
      const ph = t % 5.1;
      this.flicker.intensity = ph > 4.4 && Math.sin(t * 50) > 0 ? 2 : 12;
    }
    this.scanGlow.opacity = Math.max(0.35, this.scanGlow.opacity - 0.03);
    for (const l of this.camLeds) l.visible = Math.sin(t * 3) > 0;
    for (const m of this.gateLamps) m.emissiveIntensity = 0.4 + 0.3 * Math.max(0, Math.sin(t * 2));
    // Sliding doors
    this.doorOpen += (this.doorTarget - this.doorOpen) * 0.08;
    const w = (DOORS.x1 - DOORS.x0) / 2;
    this.doorL.position.x = DOORS.x0 + w / 2 - this.doorOpen * w * 0.95;
    this.doorR.position.x = DOORS.x1 - w / 2 + this.doorOpen * w * 0.95;
    // Drawer
    this.drawerOpen += (this.drawerTarget - this.drawerOpen) * 0.15;
    this.drawer.position.x = REGISTER.x + REGISTER.w / 2 - 0.2 + this.drawerOpen * 0.32;
    // Self checkout screens and TV static
    const frame = Math.floor(t * 2);
    if (frame !== this.lastFrame) {
      this.lastFrame = frame;
      this.selfScreens.forEach((s, i) => {
        const g = s.g;
        const happy = (frame + i) % 6 < 4;
        g.fillStyle = happy ? '#0e3b22' : '#103050';
        g.fillRect(0, 0, 64, 48);
        g.fillStyle = happy ? '#7cff9a' : '#9fd8ff';
        g.font = 'bold 9px monospace';
        g.textAlign = 'center';
        g.fillText(happy ? 'BEEP!' : 'THANK', 32, 18);
        g.fillText(happy ? `${(frame * 7 + i * 13) % 99} ITEMS` : 'YOU :)', 32, 34);
        g.textAlign = 'left';
        s.tex.needsUpdate = true;
      });
      this.tv.update();
    }
  }
  private lastFrame = -1;

  /** Flash the scanner lines on a beep. */
  flashScanner(): void {
    this.scanGlow.opacity = 1;
  }
}
