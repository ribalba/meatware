import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boxMaterials } from '../../details';
import { Item } from '../../items';
import { Interact, LevelKit } from '../../level';
import { hazardTex, corrugatedTex } from '../../textures';
import { blobGeometry, textTexture } from '../../util';
import { CASHBOX_DEF, KEY_ARM_DEF } from './items';
import { TollFun } from './mischief';
import {
  ARM_LEN,
  BARRIER_Z,
  BOUNDS,
  CABIN_D,
  CABIN_H,
  CABIN_W,
  ISLAND_W,
  ISLAND_Z0,
  ISLAND_Z1,
  islandX,
  LANE_W,
  LANES,
  laneX,
  MY_ISLAND,
  MY_LANE,
  ROAD_X0,
  ROAD_X1,
  SEAT,
  TOILET,
  YARD,
} from './layout';
import {
  armTex,
  asphaltTex,
  cabinTex,
  curbTex,
  fieldTex,
  grassTex,
  horizonTex,
  latticeTex,
  matTex,
  paintTex,
  skyTex,
  slabTex,
  stainTexture,
  yellowPaintTex,
} from './textures';

/**
 * The AUTOBAHN 2071 toll plaza at dusk: six lanes, booths with barrier arms, a canopy,
 * a sign gantry, an overpass, a staff building with the toilet (far east) and a spare
 * parts yard with the toilet key (far west). Fields and a motel sign in the fog.
 */

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
const tex = (map: THREE.Texture, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.85, ...extra });
const glow = (color: string) => new THREE.MeshBasicMaterial({ color });
const PIX = '"Press Start 2P", monospace';

/** Seeded random so the clutter is the same every shift. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const FOG_COLOR = new THREE.Color('#5d4b4f');

const CONE_OPTS = { holdPos: [0.3, -0.45, -0.75] as [number, number, number], pickupLine: 'A traffic cone. It has seen things. Mostly bumpers.' };
export const FOG_NEAR = 16;
export const FOG_FAR = 92;

export interface Barrier {
  lane: number;
  /** Rotates around z. 0 is closed (horizontal), PI/2 is open. */
  pivot: THREE.Group;
  arm: THREE.Group;
  angle: number;
  target: number;
  /** The arm was snapped off by a car. */
  broken: boolean;
  /** Length factor of the arm (duct tape repairs make it shorter). */
  length: number;
  /** The spare arm with the toilet key is installed. */
  keyArm: boolean;
  /** Status light on the barrier housing. */
  lamp: THREE.MeshBasicMaterial;
}

export interface LaneSignal {
  lane: number;
  set(state: 'go' | 'stop' | 'off'): void;
}

/** A canvas screen that the job can draw on (booth console). */
export interface Screen {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
}

export class TollPlaza extends LevelKit {
  barriers: Barrier[] = [];
  signals: LaneSignal[] = [];
  console!: Screen;
  cashBox!: Item;
  keyArm!: Item;
  /** Point on the barrier housing of booth 3, for repairs. */
  stump = new THREE.Vector3();
  /** The radio on the desk of booth 3. */
  radio!: THREE.Mesh;
  /** The card reader of booth 4 (it can be broken) and its collider. */
  reader4: { group: THREE.Group; collider: ReturnType<LevelKit['solid']> } | null = null;
  /** The portable toilet in the yard: its door and its collider. */
  porta!: { door: THREE.Group; collider: ReturnType<LevelKit['solid']> };
  /** The shipping container in the yard: its door and its collider. */
  container!: { door: THREE.Group; collider: ReturnType<LevelKit['solid']> };
  /** The emergency phone pillar. */
  sos!: THREE.Mesh;
  /** Breakables, hiding places and secrets. */
  fun: TollFun;
  private sky!: THREE.Mesh;
  private horizon!: THREE.Mesh;
  private camera: THREE.Camera | null = null;
  private flicker: THREE.PointLight[] = [];
  private blinkers: THREE.Object3D[] = [];
  private neon: THREE.MeshBasicMaterial[] = [];
  private overpassCars: THREE.Object3D[] = [];
  private r = rng(2071);

  constructor(scene: THREE.Scene) {
    super(scene);
    this.bounds = BOUNDS;
    this.ceiling = 5.2;
    this.spawn = { pos: new THREE.Vector3(SEAT.x - 0.15, 0, SEAT.z + 0.55), yaw: -Math.PI / 2 + 0.75 };
    this.bossWaypoints.push(
      new THREE.Vector3(laneX(MY_LANE), 0, -7),
      new THREE.Vector3(laneX(MY_LANE), 0, 6),
      new THREE.Vector3(laneX(MY_LANE) + 3, 0, -1),
      new THREE.Vector3(islandX(MY_ISLAND) - 2.5, 0, 4),
      new THREE.Vector3(laneX(1), 0, -6),
      new THREE.Vector3(laneX(5), 0, 5),
      new THREE.Vector3(laneX(6), 0, -10),
      new THREE.Vector3(20, 0, -2),
      new THREE.Vector3(20, 0, 10),
      new THREE.Vector3(-20, 0, 4),
      new THREE.Vector3(0, 0, 13),
      new THREE.Vector3(0, 0, -15),
    );
    this.atmosphere();
    this.ground();
    this.markings();
    this.islands();
    this.myBooth();
    this.canopy();
    this.gantry();
    this.roadside();
    this.staffBuilding();
    this.yard();
    this.overpass();
    this.distance();
    this.clutter();
    this.fun = new TollFun(this);
    this.onTick((t) => this.animate(t));
  }

  // ---------------------------------------------------------------- sky, fog and light

  private atmosphere(): void {
    const s = this.scene;
    s.background = FOG_COLOR.clone();
    s.fog = new THREE.Fog(FOG_COLOR.clone(), FOG_NEAR, FOG_FAR);
    s.add(new THREE.HemisphereLight('#b7a3d6', '#5b4631', 2.6));
    const sun = new THREE.DirectionalLight('#ffa366', 1.5);
    sun.position.set(-35, 14, -45);
    s.add(sun);

    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false, depthWrite: false });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(105, 16, 16), skyMat);
    this.sky.renderOrder = -2;
    s.add(this.sky);
    const ht = horizonTex();
    const hTex = ht.clone();
    hTex.repeat.set(4, 1);
    hTex.wrapS = THREE.RepeatWrapping;
    hTex.needsUpdate = true;
    const hMat = new THREE.MeshBasicMaterial({ map: hTex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false });
    this.horizon = new THREE.Mesh(new THREE.CylinderGeometry(98, 98, 16, 48, 1, true), hMat);
    this.horizon.renderOrder = -1;
    s.add(this.horizon);
  }

  /**
   * The retro style replaces the fog with a short indoor one. Outside we want to see the cars
   * coming, so the plaza puts its own dusk fog back every frame (cheap, three numbers).
   */
  private keepFog(): void {
    const s = this.scene;
    if (!this.camera) this.camera = s.children.find((o) => (o as THREE.PerspectiveCamera).isPerspectiveCamera) as THREE.Camera | null;
    const f = s.fog as THREE.Fog | null;
    if (f && f.isFog) {
      f.color.copy(FOG_COLOR);
      f.near = FOG_NEAR;
      f.far = FOG_FAR;
    }
    if (s.background instanceof THREE.Color) s.background.copy(FOG_COLOR);
    if (this.camera) {
      const p = this.camera.getWorldPosition(new THREE.Vector3());
      this.sky.position.set(p.x, 0, p.z);
      this.horizon.position.set(p.x, 5, p.z);
    }
  }

  // ---------------------------------------------------------------- ground

  private ground(): void {
    const s = this.scene;
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(260, 260, 52, 52), tex(grassTex([60, 60]), { roughness: 1 }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.02;
    s.add(grass);
    // ploughed fields on both sides
    for (const sx of [-1, 1]) {
      for (const [z, w] of [[-60, 70], [30, 90]] as [number, number][]) {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(55, w, 11, 14), tex(fieldTex([14, 18]), { roughness: 1 }));
        f.rotation.x = -Math.PI / 2;
        f.position.set(sx * 62, -0.01, z);
        s.add(f);
      }
    }
    // the road, with shoulders
    const roadW = ROAD_X1 - ROAD_X0 + 3;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(roadW, 230, Math.round(roadW), 115), tex(asphaltTex([roadW / 3, 230 / 3])));
    road.rotation.x = -Math.PI / 2;
    s.add(road);
    // gravel strips between road and grass, and the walkways to the buildings
    const gravel = std('#6b645a', { roughness: 1 });
    for (const sx of [-1, 1]) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 230, 2, 60), gravel);
      g.rotation.x = -Math.PI / 2;
      g.position.set(sx * (roadW / 2 + 1.2), -0.005, 0);
      s.add(g);
    }
    const yardFloor = new THREE.Mesh(new THREE.PlaneGeometry(9, 22, 9, 22), tex(asphaltTex([3, 7])));
    yardFloor.rotation.x = -Math.PI / 2;
    yardFloor.position.set(-23.5, 0.003, -3);
    s.add(yardFloor);
    const staffFloor = new THREE.Mesh(new THREE.PlaneGeometry(10, 24, 10, 24), tex(slabTex([4, 8])));
    staffFloor.rotation.x = -Math.PI / 2;
    staffFloor.position.set(24.5, 0.003, 3);
    s.add(staffFloor);
  }

  private markings(): void {
    const white: THREE.BufferGeometry[] = [];
    const yellow: THREE.BufferGeometry[] = [];
    const strip = (list: THREE.BufferGeometry[], x: number, z: number, w: number, d: number) => {
      const g = new THREE.PlaneGeometry(w, d);
      g.rotateX(-Math.PI / 2);
      g.translate(x, 0.012, z);
      list.push(g);
    };
    // dashed lane lines before and after the islands
    for (let k = 1; k < LANES; k++) {
      const x = islandX(k);
      for (let z = -110; z < ISLAND_Z0 - 2; z += 9) strip(white, x, z, 0.16, 3.2);
      for (let z = ISLAND_Z1 + 4; z < 110; z += 9) strip(white, x, z, 0.16, 3.2);
    }
    // solid edge lines
    for (const x of [ROAD_X0 + 0.3, ROAD_X1 - 0.3]) {
      strip(white, x, -60, 0.2, 100);
      strip(white, x, 60, 0.2, 100);
    }
    // stop lines in front of every barrier and the yellow box in front of the islands
    for (let lane = 1; lane <= LANES; lane++) {
      strip(white, laneX(lane), BARRIER_Z - 0.35, LANE_W - 0.3, 0.35);
      strip(yellow, laneX(lane) - LANE_W / 2 + 0.25, -2, 0.14, 12);
      strip(yellow, laneX(lane) + LANE_W / 2 - 0.25, -2, 0.14, 12);
    }
    // staff crossing (a zebra crossing nobody stops for), downstream of the plaza
    for (let x = ROAD_X0 + 0.6; x < ROAD_X1 - 0.4; x += 1.1) strip(white, x, 12.2, 0.6, 2.6);
    // keep clear hatching in front of the island noses
    for (let k = 0; k <= LANES; k++) {
      for (let i = 0; i < 4; i++) {
        const g = new THREE.PlaneGeometry(0.18, 1.6);
        g.rotateX(-Math.PI / 2);
        g.rotateY(0.6);
        g.translate(islandX(k) + (i - 1.5) * 0.45, 0.012, ISLAND_Z0 - 2.6);
        yellow.push(g);
      }
    }
    const wm = new THREE.Mesh(mergeGeometries(white), tex(paintTex([1, 1]), { polygonOffset: true, polygonOffsetFactor: -1 }));
    const ym = new THREE.Mesh(mergeGeometries(yellow), tex(yellowPaintTex([1, 1]), { polygonOffset: true, polygonOffsetFactor: -1 }));
    this.scene.add(wm, ym);

    // words painted on the asphalt
    const word = (lines: string[], x: number, z: number, w: number, d: number, color = '#d8d4c4') => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshStandardMaterial({ map: textTexture(lines, { w: 256, h: Math.round((256 * d) / w), bg: 'transparent', fg: color, font: PIX }), transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 }),
      );
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.PI;
      m.position.set(x, 0.014, z);
      this.scene.add(m);
    };
    word(['HUMAN'], laneX(MY_LANE), -14, 2.8, 1.6);
    word(['LANE'], laneX(MY_LANE), -17.5, 2.8, 1.6);
    word(['SLOW'], laneX(MY_LANE), -24, 2.8, 1.6);
    word(['STOP'], laneX(MY_LANE), BARRIER_Z - 1.6, 2.4, 1.0);
    for (const lane of [1, 2, 4, 5, 6]) word(['ROBOT'], laneX(lane), -15, 2.6, 1.3);
    for (const lane of [2, 5]) word(['DO NOT', 'STOP'], laneX(lane), -26, 2.6, 2.2);
    const cross = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 0.7),
      new THREE.MeshStandardMaterial({ map: textTexture(['STAFF CROSSING'], { w: 256, h: 44, bg: 'transparent', fg: '#d6a91c', font: PIX }), transparent: true, polygonOffset: true, polygonOffsetFactor: -1 }),
    );
    cross.rotation.x = -Math.PI / 2;
    cross.position.set(ROAD_X1 + 0.8, 0.014, 12.2);
    cross.rotation.z = Math.PI / 2;
    this.scene.add(cross);

    // oil stains, skid marks and fresh tar on the lanes
    const stain = new THREE.MeshBasicMaterial({ map: stainTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const r = this.r;
    const stains: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 46; i++) {
      const lane = 1 + Math.floor(r() * LANES);
      const z = -40 + r() * 70;
      const sz = 0.8 + r() * 1.6;
      const g = new THREE.PlaneGeometry(sz, sz * (0.8 + r() * 0.6));
      g.rotateZ(r() * 6);
      g.rotateX(-Math.PI / 2);
      g.translate(laneX(lane) + (r() - 0.5) * 1.6, 0.016 + i * 0.0002, z);
      stains.push(g);
    }
    this.scene.add(new THREE.Mesh(mergeGeometries(stains), stain));
    const skid = new THREE.MeshBasicMaterial({ color: '#141212', transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const [x, z, len, rot] of [[laneX(MY_LANE) - 0.6, -3, 6, 0.04], [laneX(MY_LANE) + 0.6, -3, 6, 0.04], [laneX(4) - 0.5, 6, 9, -0.12], [laneX(4) + 0.7, 6.2, 9, -0.12], [laneX(1), -20, 7, 0.2]] as [number, number, number, number][]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, len), skid);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rot;
      m.position.set(x, 0.017, z);
      this.scene.add(m);
    }
  }

  // ---------------------------------------------------------------- islands, booths and barriers

  private islands(): void {
    const curb = tex(curbTex([8, 1]));
    const top = std('#7d786f', { roughness: 1 });
    const hazard = tex(hazardTex([2, 1]));
    const cabin = tex(cabinTex([2, 1]));
    const roof = std('#3f4a52', { metalness: 0.3 });
    const darkGlass = std('#2b3a44', { metalness: 0.2, roughness: 0.2 });
    const lit = new THREE.MeshBasicMaterial({ color: '#e8d9a2' });
    const yellow = std('#e2b21b');
    const black = std('#1c1c1c');
    const len = ISLAND_Z1 - ISLAND_Z0;
    const zc = (ISLAND_Z0 + ISLAND_Z1) / 2;
    for (let k = 0; k <= LANES; k++) {
      const x = islandX(k);
      const isl = this.box(ISLAND_W, 0.22, len, [curb, curb, top, top, curb, curb], x, 0.11, zc);
      isl.userData.interact = { kind: 'island' } satisfies Interact;
      // pointed nose with a crash cushion of yellow barrels
      this.box(ISLAND_W, 0.4, 0.5, hazard, x, 0.2, ISLAND_Z0 - 0.25);
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.95, 10), yellow);
        b.position.set(x + (i - 1) * 0.6, 0.48, ISLAND_Z0 - 1.0 - (i % 2) * 0.3);
        this.scene.add(b);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.425, 0.425, 0.14, 10), black);
        band.position.copy(b.position).setY(0.68);
        this.scene.add(band);
      }
      this.solid(x, ISLAND_Z0 - 1.0, 2.0, 1.2, 0.95, false, 'cushion');
      // bollards at the downstream end
      for (const dx of [-0.6, 0.6]) {
        this.box(0.14, 0.9, 0.14, std('#d0cfc8'), x + dx, 0.67, ISLAND_Z1 - 0.3);
        this.box(0.15, 0.1, 0.15, std('#e07b16', { emissive: '#e07b16', emissiveIntensity: 0.4 }), x + dx, 1.0, ISLAND_Z1 - 0.3);
      }
      if (k === LANES) continue;
      // the booth cabin
      if (k !== MY_ISLAND) {
        this.cabin(x, cabin, roof, darkGlass, lit, k);
      }
      this.barrier(k + 1, x);
    }
    this.solid(islandX(LANES), ISLAND_Z1 - 0.3, 1.4, 0.2, 1.0, false, 'bollard');
  }

  /** A robot-operated booth. Nobody inside, a card reader in front. */
  private cabin(x: number, wall: THREE.Material, roof: THREE.Material, glass: THREE.Material, lit: THREE.Material, k: number): void {
    const y0 = 0.22;
    this.box(CABIN_W, 1.0, CABIN_D, wall, x, y0 + 0.5, 0);
    this.box(CABIN_W, 0.5, CABIN_D, wall, x, y0 + CABIN_H - 0.25, 0);
    this.box(CABIN_W - 0.1, 1.1, CABIN_D - 0.1, k % 2 ? glass : lit, x, y0 + 1.55, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.08, CABIN_H, 0.08, roof, x + sx * (CABIN_W / 2 - 0.04), y0 + CABIN_H / 2, sz * (CABIN_D / 2 - 0.04));
    this.box(CABIN_W + 0.5, 0.14, CABIN_D + 0.6, roof, x, y0 + CABIN_H + 0.07, 0);
    this.solid(x, 0, CABIN_W, CABIN_D, CABIN_H + 0.3, true, 'cabin');
    this.sign([`${k + 1}`], 0.5, 0.5, x + CABIN_W / 2 + 0.01, y0 + CABIN_H + 0.45, 0, Math.PI / 2, { bg: '#1d3f8a', fg: '#ffffff', font: PIX });
    this.sign(['CLOSED', 'AUTOMATED'], 1.0, 0.5, x + CABIN_W / 2 + 0.01, y0 + 1.75, 0, Math.PI / 2, { bg: '#111111', fg: '#ff4d4d', font: PIX });
    // card reader on a post
    const px = x + ISLAND_W / 2 - 0.25;
    const reader = new THREE.Group();
    reader.position.set(px, 0, -2.6);
    this.box(0.18, 1.2, 0.18, std('#6b737a', { metalness: 0.5 }), 0, 0.82, 0, reader);
    this.box(0.36, 0.4, 0.2, std('#2d3439', { metalness: 0.5 }), 0, 1.55, 0, reader);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.14), glow(k % 2 ? '#3ce07a' : '#58c8ff'));
    scr.position.set(0.101, 1.6, 0);
    scr.rotation.y = Math.PI / 2;
    reader.add(scr);
    this.scene.add(reader);
    const rc = this.solid(px, -2.6, 0.36, 0.25, 1.75, false, 'reader');
    if (k === 3) this.reader4 = { group: reader, collider: rc };
  }

  private barrier(lane: number, ix: number): void {
    const hx = ix + ISLAND_W / 2 - 0.3;
    const housing = std('#e8e2cf', { metalness: 0.2 });
    this.box(0.42, 1.05, 0.42, housing, hx, 0.22 + 0.52, BARRIER_Z);
    this.box(0.46, 0.08, 0.46, std('#c8231b'), hx, 0.22 + 1.06, BARRIER_Z);
    const lamp = new THREE.MeshBasicMaterial({ color: '#30ff60' });
    this.box(0.12, 0.12, 0.12, lamp, hx, 0.22 + 1.2, BARRIER_Z);
    this.solid(hx, BARRIER_Z, 0.42, 0.42, 1.3, false, 'barrierHousing');
    const pivot = new THREE.Group();
    pivot.position.set(hx + 0.22, 1.05, BARRIER_Z);
    const arm = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.BoxGeometry(ARM_LEN, 0.11, 0.11), tex(armTex([5, 1]), { roughness: 0.6 }));
    pole.position.x = ARM_LEN / 2;
    arm.add(pole);
    const refl = std('#ff3b2f', { emissive: '#ff2010', emissiveIntensity: 0.6 });
    for (const f of [0.3, 0.65, 0.95]) this.box(0.07, 0.07, 0.115, refl, ARM_LEN * f, 0, 0, arm);
    // counterweight
    this.box(0.4, 0.2, 0.18, std('#3b3b3b', { metalness: 0.5 }), -0.15, 0, 0, pivot);
    pivot.add(arm);
    this.scene.add(pivot);
    const b: Barrier = { lane, pivot, arm, angle: 0, target: 0, broken: false, length: 1, keyArm: false, lamp };
    if (lane === MY_LANE) {
      housing.color.set('#f1c40f');
      this.stump.set(hx, 1.0, BARRIER_Z);
      const marker = this.box(0.44, 1.1, 0.44, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), hx, 0.75, BARRIER_Z);
      marker.userData.interact = { kind: 'barrier' } satisfies Interact;
      this.interactables.push(marker);
      pole.userData.interact = { kind: 'barrier' } satisfies Interact;
      this.interactables.push(pole);
    } else {
      // robot lanes start open
      b.angle = b.target = Math.PI / 2 - 0.05;
    }
    pivot.rotation.z = b.angle;
    this.barriers.push(b);
  }

  /** Booth 3: the human booth. Walls you can be inside, a window, a console, the cash box. */
  private myBooth(): void {
    const x = islandX(MY_ISLAND);
    const y0 = 0.22;
    const wall = tex(cabinTex([2, 1]));
    const inner = std('#a39a7c');
    const frame = std('#3f4a52', { metalness: 0.3 });
    const x0 = x - CABIN_W / 2;
    const x1 = x + CABIN_W / 2;
    const z0 = -CABIN_D / 2;
    const z1 = CABIN_D / 2;
    // floor mat
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(CABIN_W, CABIN_D), tex(matTex([3, 4])));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(x, y0 + 0.01, 0);
    this.scene.add(floor);
    // east wall: low wall, big window, top band
    this.box(0.1, 1.0, CABIN_D, [wall, inner, wall, wall, wall, wall], x1 - 0.05, y0 + 0.5, 0);
    this.box(0.1, 0.45, CABIN_D, wall, x1 - 0.05, y0 + CABIN_H - 0.22, 0);
    // the window slides open. It has been open since 2069. The glass is in the yard somewhere.
    // the pay hatch (open) and window frames
    this.box(0.12, 0.05, CABIN_D, frame, x1 - 0.05, y0 + 1.0, 0);
    this.box(0.12, 0.05, CABIN_D, frame, x1 - 0.05, y0 + 2.15, 0);
    for (const z of [z0 + 0.04, -0.45 + (CABIN_D - 0.9) / 2, z1 - 0.04]) this.box(0.12, 1.15, 0.06, frame, x1 - 0.05, y0 + 1.58, z);
    // a counter shelf sticking out of the hatch
    this.box(0.5, 0.04, 0.6, std('#7a6a50'), x1 + 0.1, y0 + 1.02, 0.55);
    // west wall with a smaller, dirty window
    this.box(0.1, 1.1, CABIN_D, wall, x0 + 0.05, y0 + 0.55, 0);
    this.box(0.1, 0.5, CABIN_D, wall, x0 + 0.05, y0 + CABIN_H - 0.25, 0);
    this.box(0.02, 1.0, CABIN_D - 0.2, std('#3c4a48', { roughness: 0.2, metalness: 0.3 }), x0 + 0.05, y0 + 1.6, 0);
    // back wall (upstream) with a window, so you can see them coming
    this.box(CABIN_W, 1.0, 0.1, [wall, wall, wall, wall, inner, wall], x, y0 + 0.5, z0 + 0.05);
    this.box(CABIN_W, 0.45, 0.1, [wall, wall, wall, wall, inner, wall], x, y0 + CABIN_H - 0.225, z0 + 0.05);
    for (const fx of [x0 + 0.04, x, x1 - 0.04]) this.box(0.06, 1.15, 0.12, frame, fx, y0 + 1.58, z0 + 0.05);
    this.box(CABIN_W, 0.05, 0.14, frame, x, y0 + 1.0, z0 + 0.05);
    // front wall (downstream) with the door gap on the west half
    this.box(0.6, CABIN_H, 0.1, [wall, wall, wall, wall, wall, inner], x1 - 0.3, y0 + CABIN_H / 2, z1 - 0.05);
    this.box(CABIN_W, 0.4, 0.1, wall, x, y0 + CABIN_H - 0.2, z1 - 0.05);
    // roof
    this.box(CABIN_W + 0.6, 0.14, CABIN_D + 0.7, frame, x, y0 + CABIN_H + 0.07, 0);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(CABIN_W, CABIN_D), std('#c9c2a8'));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(x, y0 + CABIN_H - 0.01, 0);
    this.scene.add(ceil);
    this.box(0.9, 0.04, 0.14, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#f4f8ff', emissiveIntensity: 1 }), x, y0 + CABIN_H - 0.03, 0);
    // colliders: walls the player cannot pass. The window side does not block Brad's view.
    this.solid(x1 - 0.05, 0, 0.12, CABIN_D, CABIN_H, false, 'boothWindow');
    this.solid(x0 + 0.05, 0, 0.12, CABIN_D, CABIN_H, false, 'boothWindow');
    this.solid(x, z0 + 0.05, CABIN_W, 0.12, CABIN_H, false, 'boothWall');
    this.solid(x1 - 0.3, z1 - 0.05, 0.6, 0.12, CABIN_H, true, 'boothWall');
    // big "3" and the infamous sign
    this.sign(['3'], 0.55, 0.55, x1 + 0.01, y0 + CABIN_H + 0.45, 0, Math.PI / 2, { bg: '#f1c40f', fg: '#111111', font: PIX });
    this.sign(['HUMAN', 'OPERATED'], 1.0, 0.45, x1 + 0.01, y0 + 0.62, -0.4, Math.PI / 2, { bg: '#c0392b', fg: '#ffffff', font: PIX }, 'HUMAN OPERATED. Robots pay extra to drive through this lane. It is the authentic experience.');

    // inside: desk, console, cash box, stool, junk
    const desk = std('#6e5a40');
    this.box(0.55, 0.05, CABIN_D - 0.3, desk, x1 - 0.38, y0 + 0.95, 0);
    this.box(0.5, 0.9, 0.05, std('#4d3f2c'), x1 - 0.38, y0 + 0.47, z0 + 0.25);
    const screenC = document.createElement('canvas');
    screenC.width = 160;
    screenC.height = 100;
    const sg = screenC.getContext('2d')!;
    const st = new THREE.CanvasTexture(screenC);
    st.colorSpace = THREE.SRGBColorSpace;
    st.magFilter = THREE.NearestFilter;
    this.console = { canvas: screenC, g: sg, texture: st };
    const mon = new THREE.Group();
    mon.position.set(x0 + 0.32, y0 + 1.45, z0 + 0.3);
    mon.rotation.y = 0.55;
    mon.rotation.x = -0.1;
    mon.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.25, 0.22), std('#c9c1a6')));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.19), new THREE.MeshBasicMaterial({ map: st }));
    scr.position.z = 0.111;
    mon.add(scr);
    this.box(0.5, 0.04, 0.4, std('#4d3f2c'), x0 + 0.32, y0 + 1.29, z0 + 0.28);
    mon.userData.interact = { kind: 'console' } satisfies Interact;
    this.interactables.push(mon);
    this.scene.add(mon);
    // the big red barrier button
    const btnBase = this.box(0.18, 0.06, 0.18, std('#2c2c2c'), x1 - 0.32, y0 + 1.0, 0.35);
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.06, 10), std('#d42a1e', { emissive: '#801008', emissiveIntensity: 0.5 }));
    btn.position.set(0, 0.05, 0);
    btnBase.add(btn);
    btnBase.userData.interact = { kind: 'seat' } satisfies Interact;
    this.interactables.push(btnBase);
    // stool
    const stool = new THREE.Group();
    stool.position.set(SEAT.x - 0.05, y0, SEAT.z + 0.1);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 10), std('#7d1f1a'));
    seat.position.y = 0.7;
    stool.add(seat);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), std('#666666', { metalness: 0.6 }));
    leg.position.y = 0.35;
    stool.add(leg);
    stool.userData.interact = { kind: 'seat' } satisfies Interact;
    this.interactables.push(stool);
    this.scene.add(stool);
    // a mug, a radio, a tiny fan, sticky notes
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 8), std('#e8e2cf'));
    mug.position.set(x1 - 0.25, y0 + 1.03, -0.35);
    this.scene.add(mug);
    this.radio = this.box(0.24, 0.12, 0.08, std('#3a3330'), x1 - 0.5, y0 + 1.04, 1.05);
    this.box(0.06, 0.06, 0.005, std('#b8bec4', { metalness: 0.7 }), x1 - 0.56, y0 + 1.05, 1.0);
    this.box(0.08, 0.04, 0.005, new THREE.MeshBasicMaterial({ color: '#ffb347' }), x1 - 0.44, y0 + 1.06, 1.0);
    for (let i = 0; i < 4; i++) {
      const n = this.box(0.08, 0.08, 0.005, std(['#f7e463', '#f5a3c7', '#9be38a', '#f7e463'][i]), x - 0.5 + (i % 2) * 0.1, y0 + 0.75 + Math.floor(i / 2) * 0.1, z0 + 0.11);
      n.rotation.z = (i - 1.5) * 0.15;
    }
    this.sign(['NOVEMBER 2071', 'HUMAN OF THE MONTH:', 'nobody'], 0.45, 0.4, x0 + 0.11, y0 + 1.75, -0.75, Math.PI / 2, { bg: '#fdf6e3', fg: '#2c3e50', border: '#c0392b' }, 'A calendar. Every day is circled. None of them are holidays.');
    this.sign(['LAMINATED RULES', '1. Smile', '2. Exact change', '3. No breaks'], 0.5, 0.45, x0 + 0.11, y0 + 1.75, 0.6, Math.PI / 2, { bg: '#ffffff', fg: '#222222', border: '#2e86c1' }, 'The rules. Rule 4 was scratched out. It said "be happy".');
    // heater under the desk, glowing
    this.box(0.35, 0.3, 0.12, std('#8a8a80'), x1 - 0.3, y0 + 0.2, 0.9);
    this.box(0.3, 0.2, 0.01, new THREE.MeshBasicMaterial({ color: '#ff6a2a' }), x1 - 0.3, y0 + 0.2, 0.83);
    // the cash box on the desk
    const cb = new Item(CASHBOX_DEF);
    cb.state = 'fixed';
    cb.mesh.position.set(x1 - 0.35, y0 + 0.975 + cb.baseOffset, -0.1);
    cb.mesh.rotation.y = -Math.PI / 2;
    this.scene.add(cb.mesh);
    this.initialItems.push(cb);
    this.cashBox = cb;
    // interior light
    const l = new THREE.PointLight('#e8f0ff', 6, 6, 1.8);
    l.position.set(x, y0 + CABIN_H - 0.3, 0);
    this.scene.add(l);
    this.flicker.push(l);
    // a potted plant outside the door
    this.plant(x - 0.5, z1 + 1.4);
  }

  // ---------------------------------------------------------------- canopy and gantry

  private canopy(): void {
    const slab = tex(slabTex([12, 2]));
    const z0 = -3.6;
    const z1 = 3.6;
    const y = 5.6;
    const w = ROAD_X1 - ROAD_X0 + 1.2;
    this.box(w, 0.7, z1 - z0, slab, 0, y, (z0 + z1) / 2);
    // fascia facing the traffic: one panel per lane, and a big name board on the roof
    for (let lane = 1; lane <= LANES; lane++) {
      const mine = lane === MY_LANE;
      const f = this.sign([`${lane}`, mine ? 'HUMAN' : 'ROBOT'], LANE_W + ISLAND_W - 0.1, 0.7, laneX(lane), y, z0 - 0.01, Math.PI, { bg: mine ? '#c0392b' : '#1d3f8a', fg: '#ffffff', font: PIX });
      f.rotation.y = Math.PI;
    }
    this.sign(['THANK YOU FOR YOUR PATIENCE', 'WE DO NOT NEED IT'], 12, 0.7, 0, y, z1 + 0.01, 0, { bg: '#1d3f8a', fg: '#f2d31b', font: PIX });
    const board = this.sign(['AUTOBAHN 2071', 'TOLL PLAZA'], 11, 2.2, laneX(5), y + 1.7, z0 + 0.6, Math.PI, { bg: '#1d3f8a', fg: '#ffffff', border: '#f2d31b', font: PIX });
    board.rotation.y = Math.PI;
    for (const dx of [-4.5, 4.5]) this.box(0.2, 1.4, 0.2, std('#5c6166', { metalness: 0.5 }), laneX(5) + dx, y + 0.7, z0 + 0.7);
    // light panels underneath
    const panel = new THREE.MeshBasicMaterial({ color: '#f6efd8' });
    for (let lane = 1; lane <= LANES; lane++) {
      for (const z of [-2, 1.2]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), panel);
        p.rotation.x = Math.PI / 2;
        p.position.set(laneX(lane), y - 0.36, z);
        this.scene.add(p);
      }
    }
    for (const lane of [2, 4.5]) {
      const l = new THREE.PointLight('#fff2d8', 30, 16, 1.5);
      l.position.set(laneX(Math.floor(lane)) + (lane % 1 ? LANE_W / 2 : 0), y - 0.6, -0.5);
      this.scene.add(l);
    }
    // columns on every island, front and back
    const col = tex(slabTex([1, 4]));
    for (let k = 0; k <= LANES; k++) {
      for (const z of [z0 + 0.4, z1 - 0.4]) {
        this.box(0.45, y, 0.45, col, islandX(k), y / 2, z);
        this.box(0.5, 0.5, 0.5, tex(hazardTex([2, 1])), islandX(k), 0.47, z);
        this.solid(islandX(k), z, 0.5, 0.5, y, true, 'column');
      }
    }
    // lane signals on the fascia: green arrow or red cross
    for (let lane = 1; lane <= LANES; lane++) {
      const go = textTexture(['↓'], { w: 64, h: 64, bg: '#081008', fg: '#3dff6a', font: 'monospace' });
      const stop = textTexture(['X'], { w: 64, h: 64, bg: '#100808', fg: '#ff3a2a', font: PIX });
      const off = textTexture([''], { w: 64, h: 64, bg: '#111111' });
      const m = new THREE.MeshBasicMaterial({ map: go });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), m);
      s.position.set(laneX(lane), y - 0.85, z0 - 0.05);
      s.rotation.y = Math.PI;
      this.scene.add(s);
      this.box(0.9, 0.9, 0.1, std('#222222'), laneX(lane), y - 0.85, z0 + 0.02);
      this.signals.push({ lane, set: (st) => (m.map = st === 'go' ? go : st === 'stop' ? stop : off) });
    }
    // lane 3 gets the special treatment
    this.sign(['HUMAN OPERATED LANE', 'EXPECT DELAYS'], LANE_W - 0.2, 0.9, laneX(MY_LANE), y + 0.8, z0 - 0.05, Math.PI, { bg: '#f1c40f', fg: '#111111', border: '#111111', font: PIX });
    // cameras under the canopy edge, watching every lane
    for (let lane = 1; lane <= LANES; lane++) this.camera3d(laneX(lane) + 1.2, y - 0.5, z0 + 0.1, Math.PI);
  }

  private camera3d(x: number, y: number, z: number, yaw: number): void {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.38), std('#d8d8d2'));
    body.rotation.x = 0.35;
    g.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), std('#1a1a1a'));
    lens.rotation.x = Math.PI / 2 + 0.35;
    lens.position.set(0, -0.07, 0.2);
    g.add(lens);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), glow('#ff2020'));
    led.position.set(0.06, 0.06, 0.18);
    g.add(led);
    this.blinkers.push(led);
    this.scene.add(g);
  }

  private gantry(): void {
    const z = -20;
    const lat = tex(latticeTex([1, 8]));
    const latH = tex(latticeTex([24, 1]));
    const span = ROAD_X1 - ROAD_X0 + 4;
    for (const sx of [-1, 1]) {
      this.box(0.6, 7.2, 0.6, lat, sx * span / 2, 3.6, z);
      this.box(1.0, 0.4, 1.0, std('#77746c'), sx * span / 2, 0.2, z);
      this.solid(sx * span / 2, z, 1.0, 1.0, 7.2, true, 'gantry');
    }
    this.box(span, 0.5, 0.5, latH, 0, 6.9, z);
    this.box(span, 0.5, 0.5, latH, 0, 5.6, z);
    for (let x = -span / 2 + 1; x < span / 2; x += 1.6) {
      const d = this.box(0.08, 1.4, 0.08, lat, x, 6.25, z);
      d.rotation.z = 0.7;
    }
    const st = { font: PIX };
    const signs: [string[], number, number, string, string][] = [
      [['EXACT CHANGE ONLY', 'no change given. ever.'], laneX(1) + 1.5, 6.6, '#1f6b3a', '#ffffff'],
      [['HUMAN OPERATED LANE', 'EXPECT DELAYS  ↓'], laneX(MY_LANE), 4.4, '#f1c40f', '#111111'],
      [['ROBOTS: ANY LANE', 'HUMANS: WALK'], laneX(5) - 1.2, 6.6, '#1d3f8a', '#ffffff'],
      [['TOLL 2.00 CR', 'BRAKES 9.99 CR/MONTH'], laneX(6) + 1, 4.4, '#1f6b3a', '#ffffff'],
    ];
    for (const [lines, x, y, bg, fg] of signs) {
      const s = this.sign(lines, 5, 1.6, x, y, z - 0.3, Math.PI, { bg, fg, border: fg, ...st });
      s.rotation.y = Math.PI;
      // back of the sign
      this.box(5.05, 1.65, 0.06, std('#5c6670', { metalness: 0.4 }), x, y, z - 0.24);
    }
    for (const x of [laneX(2), laneX(4), laneX(6) - 1]) this.camera3d(x, 5.2, z - 0.3, Math.PI);
    // a speed camera box on a pole by the road
    this.box(0.2, 3.2, 0.2, std('#6b737a', { metalness: 0.5 }), ROAD_X1 + 1.2, 1.6, -30);
    this.box(0.6, 0.6, 0.9, std('#d6a91c'), ROAD_X1 + 1.2, 3.4, -30);
    this.sign(['SPEED LIMIT 30', '(SUGGESTION)'], 1.4, 1.0, ROAD_X1 + 1.2, 2.2, -29.88, Math.PI, { bg: '#ffffff', fg: '#111111', border: '#c0392b' }).rotation.y = Math.PI;
    const light = new THREE.PointLight('#ffd9a0', 14, 14, 1.6);
    light.position.set(laneX(MY_LANE), 5, z + 1);
    this.scene.add(light);
  }

  // ---------------------------------------------------------------- along the road

  private roadside(): void {
    const r = this.r;
    // guardrails along both road edges, with gaps at the plaza
    const posts: THREE.BufferGeometry[] = [];
    const rail = std('#9aa3a8', { metalness: 0.6, roughness: 0.4 });
    const post = std('#5c6166', { metalness: 0.5 });
    for (const sx of [-1, 1]) {
      const x = sx * (ROAD_X1 + 1.6);
      for (const [za, zb] of [[-110, -11], [10, 110]] as [number, number][]) {
        const len = zb - za;
        this.box(0.08, 0.32, len, rail, x, 0.62, (za + zb) / 2);
        for (let z = za; z <= zb; z += 4) this.batch(posts, 0.12, 0.75, 0.12, x + sx * 0.08, 0.37, z);
        const ca = Math.max(za, BOUNDS.minZ - 1);
        const cb = Math.min(zb, BOUNDS.maxZ + 1);
        if (cb > ca) this.solid(x, (ca + cb) / 2, 0.3, cb - ca, 0.8, false, 'guardrail');
      }
    }
    this.scene.add(new THREE.Mesh(mergeGeometries(posts), post));
    // street lamps along both sides
    let lit = 0;
    for (const sx of [-1, 1]) {
      for (let z = -96; z <= 96; z += 16) {
        if (Math.abs(z) < 6) continue;
        const x = sx * (ROAD_X1 + 2.6);
        const o = this.prop('toll_lightDouble', x, 0, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
        if (!o) {
          this.box(0.2, 7.5, 0.2, post, x, 3.75, z);
          this.box(1.6, 0.15, 0.3, post, x - sx * 0.8, 7.4, z);
        }
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.28), glow('#ffcf7a'));
        head.position.set(x - sx * 1.55, 7.45, z);
        this.scene.add(head);
        if (Math.abs(z) < 30 && lit < 2 && sx > 0) {
          lit++;
          const l = new THREE.PointLight('#ffb35a', 26, 18, 1.4);
          l.position.set(x - sx * 1.6, 7, z);
          this.scene.add(l);
        }
      }
    }
    // jersey barriers and cones closing the road ends for pedestrians
    for (const z of [BOUNDS.minZ + 0.4, BOUNDS.maxZ - 0.4]) {
      for (let lane = 1; lane <= LANES; lane++) {
        for (const dx of [-0.9, 0.9]) this.prop('toll_coneFlat', laneX(lane) + dx * 1.3, 0, z);
      }
    }
    this.sign(['NO PEDESTRIANS', 'BEYOND THIS POINT', 'humans are not insured'], 3, 1.4, ROAD_X0 - 2.6, 1.6, BOUNDS.minZ + 0.6, 0, { bg: '#ffffff', fg: '#c0392b', border: '#c0392b', font: PIX });
    this.sign(['NO PEDESTRIANS', 'BEYOND THIS POINT'], 3, 1.2, ROAD_X1 + 2.6, 1.6, BOUNDS.maxZ - 0.6, Math.PI, { bg: '#ffffff', fg: '#c0392b', border: '#c0392b', font: PIX });
    for (const [x, z] of [[ROAD_X0 - 2.6, BOUNDS.minZ + 0.55], [ROAD_X1 + 2.6, BOUNDS.maxZ - 0.55]] as [number, number][]) {
      this.box(0.1, 0.9, 0.1, post, x - 1.2, 0.45, z);
      this.box(0.1, 0.9, 0.1, post, x + 1.2, 0.45, z);
    }
    // trees and bushes behind the guardrails
    const trees = ['toll_treeLarge', 'toll_pineLarge', 'toll_treePark', 'toll_pineSmall'];
    for (let i = 0; i < 60; i++) {
      const sx = r() < 0.5 ? -1 : 1;
      const x = sx * (31 + r() * 30);
      const z = -100 + r() * 200;
      this.prop(trees[Math.floor(r() * trees.length)], x, 0, z, r() * 6);
    }
    for (let i = 0; i < 40; i++) {
      const sx = r() < 0.5 ? -1 : 1;
      const x = sx * (ROAD_X1 + 3.2 + r() * 4);
      const z = -100 + r() * 200;
      if (Math.abs(z) < 26) continue;
      this.prop(r() < 0.5 ? 'toll_shrub' : 'toll_treeSmall', x, 0, z, r() * 6);
    }
    // an emergency phone pillar
    this.sos = this.box(0.4, 1.4, 0.3, std('#e07b16'), ROAD_X0 - 2.4, 0.7, -16);
    this.sign(['SOS', 'robots only'], 0.36, 0.3, ROAD_X0 - 2.19, 1.1, -16, Math.PI / 2, { bg: '#e07b16', fg: '#ffffff' });
    this.box(0.06, 0.2, 0.1, std('#1c1c1c'), ROAD_X0 - 2.17, 0.75, -16);
    this.solid(ROAD_X0 - 2.4, -16, 0.4, 0.3, 1.4, false, 'sos');
  }

  // ---------------------------------------------------------------- staff building (toilet)

  private staffBuilding(): void {
    const { x0, z0 } = TOILET;
    const corr = tex(corrugatedTex([4, 1]));
    const corrS = tex(corrugatedTex([2, 1]));
    const bx0 = x0 - 2.0;
    const bx1 = x0 + 5.6;
    const bz0 = z0 - 1.2;
    const bz1 = z0 + 9.5;
    const H = 3.0;
    // outer shell: west wall with a doorway at the toilet door, the other walls closed
    const doorZ0 = z0 + 1.1;
    const doorZ1 = z0 + 3.1;
    const westA = doorZ0 - bz0;
    const westB = bz1 - doorZ1;
    this.box(0.2, H, westA, corrS, bx0, H / 2, bz0 + westA / 2);
    this.box(0.2, H, westB, corrS, bx0, H / 2, doorZ1 + westB / 2);
    this.box(0.2, 0.6, doorZ1 - doorZ0, corrS, bx0, H - 0.3, (doorZ0 + doorZ1) / 2);
    this.solid(bx0, bz0 + westA / 2, 0.2, westA, H, true, 'staffWall');
    this.solid(bx0, doorZ1 + westB / 2, 0.2, westB, H, true, 'staffWall');
    this.box(bx1 - bx0, H, 0.2, corr, (bx0 + bx1) / 2, H / 2, bz0);
    this.box(bx1 - bx0, H, 0.2, corr, (bx0 + bx1) / 2, H / 2, bz1);
    this.box(0.2, H, bz1 - bz0, corrS, bx1, H / 2, (bz0 + bz1) / 2);
    this.solid((bx0 + bx1) / 2, bz0, bx1 - bx0, 0.2, H, true, 'staffWall');
    this.solid((bx0 + bx1) / 2, bz1, bx1 - bx0, 0.2, H, true, 'staffWall');
    this.solid(bx1, (bz0 + bz1) / 2, 0.2, bz1 - bz0, H, true, 'staffWall');
    this.box(bx1 - bx0 + 0.6, 0.2, bz1 - bz0 + 0.6, std('#4a4f52', { metalness: 0.3 }), (bx0 + bx1) / 2, H + 0.1, (bz0 + bz1) / 2);
    // the toilet booth inside
    this.toiletBooth(x0, z0, ['KEY: SPARE ARM', 'in the parts yard', 'far west. sorry.', 'Max break: 4 s']);
    // break room in the north part
    const by = z0 + 4.2;
    this.prop('toll_bench', x0 + 1.5, 0, bz1 - 0.5, Math.PI);
    this.solid(x0 + 1.5, bz1 - 0.5, 1.6, 0.5, 0.5, false, 'bench');
    // vending machine
    const vm = this.box(0.9, 1.9, 0.7, std('#8e1f2a'), bx1 - 0.6, 0.95, by + 2.4);
    vm.userData.interact = { kind: 'vending' } satisfies Interact;
    this.interactables.push(vm);
    const vmScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.1), new THREE.MeshBasicMaterial({ map: textTexture(['SNACKS', 'for robots', 'OIL 2.00', 'BOLTS 1.50', 'HOPE --'], { w: 96, h: 176, bg: '#1b2a3a', fg: '#9fe6ff' }) }));
    vmScreen.position.set(bx1 - 1.055, 1.15, by + 2.4);
    vmScreen.rotation.y = -Math.PI / 2;
    this.scene.add(vmScreen);
    this.solid(bx1 - 0.6, by + 2.4, 0.9, 0.7, 1.9, true, 'vending');
    // lockers
    for (let i = 0; i < 4; i++) {
      const l = this.box(0.5, 1.9, 0.5, std(i === 2 ? '#5a6b7a' : '#6f8090', { metalness: 0.4 }), x0 + 0.1 + i * 0.52, 0.95, bz1 - 0.35 - 0.6);
      l.position.z = by + 0.2;
    }
    this.solid(x0 + 0.88, by + 0.2, 2.1, 0.5, 1.9, true, 'lockers');
    this.sign(['BREAK ROOM', 'breaks: 0 per shift'], 1.4, 0.6, x0 + 0.9, 2.3, by + 0.46, 0, { bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' });
    this.plant(bx0 + 0.6, bz1 - 0.7);
    const room = new THREE.PointLight('#f0f4ff', 8, 8, 1.6);
    room.position.set(x0 + 1, 2.7, z0 + 6.5);
    this.scene.add(room);
    this.flicker.push(room);
    const corridor = new THREE.PointLight('#fff0d0', 5, 6, 1.6);
    corridor.position.set(bx0 + 1, 2.7, z0 + 2);
    this.scene.add(corridor);
    // outside: signs, a dumpster, a bench, a window band
    this.sign(['STAFF FACILITY', 'HUMAN RELIEF STATION'], 4.5, 1.1, bx0 - 0.12, H + 0.75, (bz0 + bz1) / 2, -Math.PI / 2, { bg: '#1d3f8a', fg: '#ffffff', border: '#ffffff', font: PIX });
    this.sign(['TOILET', '→'], 1.0, 0.7, bx0 - 0.12, 2.1, doorZ0 - 0.7, -Math.PI / 2, { bg: '#2e86c1', fg: '#ffffff' });
    this.sign(['THE KEY IS', 'ON THE SPARE ARM', 'IN THE PARTS YARD', '(the other side)'], 1.6, 1.1, bx0 - 0.12, 1.6, doorZ1 + 1.6, -Math.PI / 2, { bg: '#ffffff', fg: '#c0392b', border: '#c0392b' }, 'The key is on the spare barrier arm. The spare arm is in the parts yard. The parts yard is on the far west side. Across all six lanes. Have a nice walk.');
    const win = new THREE.MeshBasicMaterial({ color: '#d9c891' });
    this.box(0.05, 0.6, 2.4, win, bx0 - 0.11, 1.8, bz1 - 2);
    if (this.prop('toll_dumpster', bx0 - 1.3, 0, bz0 + 0.3, Math.PI / 2)) this.solid(bx0 - 1.3, bz0 + 0.3, 1.0, 2.0, 1.4, false, 'dumpster');
    this.plant(bx0 - 0.8, bz1 + 0.2);
    // trash bags
    const bag = std('#1e1f22', { roughness: 0.4 });
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      g.position.set(bx0 - 0.7 + (i % 2) * 0.5, 0, bz0 - 0.6 - Math.floor(i / 2) * 0.4);
      g.rotation.y = i;
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), bag);
      b.scale.set(1, 0.8, 1);
      b.position.y = 0.24;
      g.add(b);
      this.scene.add(g);
      this.movable(g, 'Trash Bag', { holdPos: [0.3, -0.55, -0.85], pickupLine: 'A trash bag. It is heavier than it looks. It is mostly receipts.' });
    }
  }

  // ---------------------------------------------------------------- parts yard (the key)

  private yard(): void {
    const { x, z } = YARD;
    const post = std('#5c6166', { metalness: 0.5 });
    const mesh = std('#8c9399', { metalness: 0.5, transparent: true, opacity: 0.55, wireframe: true });
    // chain link fence around the yard, open toward the road
    const fx0 = BOUNDS.minX + 0.2;
    const fx1 = x + 3.2;
    const fz0 = z - 9;
    const fz1 = z + 9;
    const fence = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az);
      const m = this.box(len, 2.0, 0.02, mesh, (ax + bx) / 2, 1.0, (az + bz) / 2);
      m.rotation.y = -Math.atan2(bz - az, bx - ax);
      for (let i = 0; i <= Math.ceil(len / 3); i++) {
        const t = Math.min(1, (i * 3) / len);
        this.box(0.08, 2.1, 0.08, post, ax + (bx - ax) * t, 1.05, az + (bz - az) * t);
      }
    };
    fence(fx0, fz0, fx1, fz0);
    fence(fx0, fz1, fx1, fz1);
    fence(fx0, fz0, fx0, fz1);
    fence(fx1, fz0, fx1, z - 2);
    fence(fx1, z + 2, fx1, fz1);
    this.solid((fx0 + fx1) / 2, fz0, fx1 - fx0, 0.15, 2, false, 'fence');
    this.solid((fx0 + fx1) / 2, fz1, fx1 - fx0, 0.15, 2, false, 'fence');
    this.solid(fx1, (fz0 + z - 2) / 2, 0.15, z - 2 - fz0, 2, false, 'fence');
    this.solid(fx1, (z + 2 + fz1) / 2, 0.15, fz1 - z - 2, 2, false, 'fence');
    this.sign(['SPARE PARTS YARD', 'authorized humans only'], 2.6, 0.8, fx1 + 0.06, 2.4, z, Math.PI / 2, { bg: '#f1c40f', fg: '#111111', border: '#111111', font: PIX });

    // the rack with spare barrier arms (decoration) and the one with the key
    const rx = x - 0.4;
    const rz = z - 5;
    for (const dx of [-1.8, 1.8]) {
      this.box(0.12, 2.0, 0.12, post, rx + dx, 1.0, rz);
      for (const y of [0.6, 1.2, 1.8]) this.box(0.4, 0.06, 0.12, post, rx + dx, y, rz);
    }
    for (const y of [0.66, 1.86]) {
      const a = this.box(3.4, 0.11, 0.11, tex(armTex([5, 1])), rx, y, rz);
      a.rotation.y = (y - 1.2) * 0.04;
    }
    this.solid(rx, rz, 4.0, 0.5, 2.0, false, 'rack');
    const key = new Item(KEY_ARM_DEF);
    key.state = 'fixed';
    key.mesh.position.set(rx, 1.26 - 0.06, rz + 0.05);
    this.scene.add(key.mesh);
    this.initialItems.push(key);
    this.keyArm = key;
    this.sign(['TOILET KEY', 'on the middle arm', 'please return'], 1.2, 0.6, rx, 2.35, rz + 0.06, 0, { bg: '#ffffff', fg: '#c0392b', border: '#c0392b' });

    // a shipping container. The south half is hollow and has a door nobody tries.
    const cont = tex(corrugatedTex([3, 1]), { color: '#a44d2a' });
    const contS = tex(corrugatedTex([1, 1]), { color: '#a44d2a' });
    const cx = fx0 + 1.4;
    const cz = z + 4.5;
    // the closed north part (z -1.3 .. 1.5)
    this.box(2.4, 2.6, 2.8, cont, cx, 1.3, cz + 1.6);
    this.solid(cx, cz + 1.6, 2.4, 2.8, 2.6, true, 'container');
    // the hollow south part (z -4.5 .. -1.3): walls, roof, floor
    const inner = std('#5a3a2a');
    this.box(0.08, 2.6, 3.2, [contS, inner, contS, contS, contS, contS], cx - 1.16, 1.3, cz - 1.4);
    this.box(2.4, 2.6, 0.08, [contS, contS, contS, contS, inner, contS], cx, 1.3, cz - 2.96);
    this.box(2.4, 0.1, 3.2, cont, cx, 2.55, cz - 1.4);
    this.box(2.3, 0.04, 3.1, std('#3a2a22'), cx, 0.02, cz - 1.4);
    this.solid(cx - 1.16, cz - 1.4, 0.12, 3.2, 2.6, true, 'container');
    this.solid(cx, cz - 2.96, 2.4, 0.12, 2.6, true, 'container');
    // east wall with a door at its south end
    this.box(0.08, 2.6, 1.9, [contS, contS, contS, contS, contS, contS], cx + 1.16, 1.3, cz - 0.75);
    this.box(0.08, 0.5, 1.3, contS, cx + 1.16, 2.35, cz - 2.35);
    this.solid(cx + 1.16, cz - 0.75, 0.12, 1.9, 2.6, true, 'container');
    const door = new THREE.Group();
    door.position.set(cx + 1.2, 0, cz - 2.95);
    const dp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, 1.25), [contS, inner, contS, contS, contS, contS]);
    dp.position.set(0, 1.05, 0.625);
    door.add(dp);
    for (const y of [0.5, 1.6]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 1.1), std('#5c6166', { metalness: 0.6 }));
      bar.position.set(0.04, y, 0.625);
      door.add(bar);
    }
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.05), std('#5c6166', { metalness: 0.6 }));
    lever.position.set(0.06, 1.05, 1.1);
    door.add(lever);
    this.scene.add(door);
    dp.userData.interact = { kind: 'tlContainer' } satisfies Interact;
    this.interactables.push(dp);
    this.container = { door, collider: this.solid(cx + 1.18, cz - 2.35, 0.14, 1.3, 2.2, true, 'containerDoor') };
    this.sign(['CONES', 'ARMS', 'HOPE'], 1.2, 1.0, cx + 1.21, 1.6, cz - 0.75, Math.PI / 2, { bg: '#ffffff', fg: '#111111' });
    // cone pyramid, pallets, sandbags, crates
    for (let i = 0; i < 6; i++) {
      const c = this.prop('toll_cone', x + 1.2 + (i % 3) * 0.55, 0, z + 3 + Math.floor(i / 3) * 0.6);
      if (c) this.movable(c, 'Traffic Cone', CONE_OPTS);
    }
    for (let i = 0; i < 3; i++) this.prop('toll_pallet', x + 1.6, i * 0.15, z - 1.2 + i * 0.03, i * 0.1);
    for (let i = 0; i < 4; i++) {
      const b = this.box(0.6, 0.6, 0.6, boxMaterials(i), x - 1.6 + (i % 2) * 0.62, 0.3 + Math.floor(i / 2) * 0.6, z + 0.9);
      b.rotation.y = i * 0.2;
    }
    this.solid(x - 1.3, z + 0.9, 1.4, 0.8, 1.2, true, 'crates');
    this.solid(x + 1.6, z - 1.2, 1.3, 1.3, 0.5, false, 'pallets');
    const sand = std('#8c7a55', { roughness: 1 });
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.4, 2, 6), sand);
      s.rotation.z = Math.PI / 2;
      s.position.set(fx0 + 0.6 + (i % 4) * 0.62, 0.2 + Math.floor(i / 4) * 0.36, z - 7.6);
      this.scene.add(s);
    }
    this.solid(fx0 + 1.5, z - 7.6, 2.6, 0.6, 0.7, false, 'sand');
    // a portable toilet that is closer. It is not available.
    const pt = new THREE.Group();
    pt.position.set(fx0 + 0.9, 0, z - 4.6);
    const green = std('#3a7a4a');
    const ptWall = (w: number, d: number, px: number, pz: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.3, d), green);
      m.position.set(px, 1.15, pz);
      pt.add(m);
      return m;
    };
    const ptParts = [ptWall(0.06, 1.2, -0.57, 0), ptWall(1.2, 0.06, 0, -0.57), ptWall(1.2, 0.06, 0, 0.57)];
    const ptRoof = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 1.3), std('#e8e2cf'));
    ptRoof.position.y = 2.36;
    pt.add(ptRoof);
    const ptFloor = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 1.1), std('#2a2a2a'));
    ptFloor.position.y = 0.03;
    pt.add(ptFloor);
    const ptDoor = new THREE.Group();
    ptDoor.position.set(0.6, 0, -0.57);
    const dpanel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 1.14), green);
    dpanel.position.set(0, 1.12, 0.57);
    ptDoor.add(dpanel);
    const oo = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshStandardMaterial({ map: textTexture(['OUT OF ORDER', 'since 2069'], { w: 256, h: 140, bg: '#ffffff', fg: '#c0392b', border: '#c0392b' }) }));
    oo.position.set(0.035, 1.6, 0.57);
    oo.rotation.y = Math.PI / 2;
    ptDoor.add(oo);
    pt.add(ptDoor);
    const ptInfo = { kind: 'tlPorta' } satisfies Interact;
    for (const o of [...ptParts, dpanel, oo]) {
      o.userData.interact = ptInfo;
      this.interactables.push(o);
    }
    this.scene.add(pt);
    this.porta = { door: ptDoor, collider: this.solid(fx0 + 0.9, z - 4.6, 1.2, 1.2, 2.3, true, 'porta') };
    // an old wrecked robot car
    // (moved next to the container, so the container has room for a secret)
    const wreck = this.prop('toll_hatch', x + 1.3, 0.05, z + 8.0, Math.PI / 2);
    if (wreck) {
      wreck.rotation.z = 0.08;
      wreck.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.material = (m.material as THREE.MeshStandardMaterial).clone();
        if (m.isMesh) (m.material as THREE.MeshStandardMaterial).color.multiplyScalar(0.55);
      });
      this.solid(x + 1.3, z + 8.0, 3.4, 2.6, 1.6, true, 'wreck');
      this.sign(['RECALLED'], 1.2, 0.35, x + 1.3, 2.0, z + 8.0, 0, { bg: '#c0392b', fg: '#ffffff', font: PIX });
    }
    this.prop('toll_debrisTire', x + 1.5, 0, z + 5.4);
    this.prop('toll_debrisBumper', x + 2.2, 0, z + 4.8, 1.2);
    this.plant(x + 2.4, z - 7.6);
    // a flickering yard lamp
    const l = new THREE.PointLight('#ffb35a', 16, 13, 1.5);
    l.position.set(x, 5.5, z);
    this.scene.add(l);
    this.flicker.push(l);
    this.prop('toll_lightSingle', x + 2.9, 0, z - 8.5, Math.PI / 2);
  }

  // ---------------------------------------------------------------- far away

  private overpass(): void {
    const z = 44;
    const y = 7.5;
    const slab = tex(slabTex([20, 1]));
    this.box(110, 1.1, 9, slab, 0, y, z);
    this.box(110, 0.9, 0.25, std('#8c877e'), 0, y + 1.0, z - 4.4);
    for (const x of [-22, 22, -45, 45]) this.box(1.6, y, 6, tex(slabTex([1, 3])), x, y / 2, z);
    this.sign(['ROBOTS WATCH', 'HUMANS WORK'], 9, 1.6, 4, y - 0.2, z - 4.55, Math.PI, { bg: 'transparent', fg: '#d84a8a', font: PIX }).rotation.y = Math.PI;
    // a few cars crossing up there
    const kinds = ['toll_truck', 'toll_sedan', 'toll_van'];
    for (let i = 0; i < 3; i++) {
      const o = this.prop(kinds[i], -50 + i * 33, y + 0.55, z + (i % 2 ? 2 : -2), i % 2 ? -Math.PI / 2 : Math.PI / 2);
      if (o) this.overpassCars.push(o);
    }
  }

  private distance(): void {
    // the motel sign, glowing through the fog
    const pole = std('#3a3a3a');
    const mx = 46;
    const mz = 62;
    this.box(0.6, 12, 0.6, pole, mx, 6, mz);
    const sign = (lines: string[], w: number, h: number, y: number, fg: string) => {
      const m = new THREE.MeshBasicMaterial({ map: textTexture(lines, { w: 512, h: Math.round((512 * h) / w), bg: '#1a0f18', fg, border: fg, font: PIX }), fog: false });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      s.position.set(mx, y, mz - 0.35);
      s.rotation.y = Math.PI + 0.5;
      this.scene.add(s);
      this.neon.push(m);
      return m;
    };
    sign(['MOTEL 2071'], 9, 2.4, 13.5, '#ff4fa0');
    sign(['VACANCY'], 6, 1.2, 11.2, '#4fffb0');
    sign(['HUMANS WELCOME*'], 7, 1, 9.6, '#ffd24f');
    // the motel itself as a dark block with lit windows
    const motel = new THREE.Mesh(new THREE.BoxGeometry(24, 4, 8), std('#2c2530'));
    motel.position.set(mx + 12, 2, mz + 10);
    this.scene.add(motel);
    const wins = new THREE.MeshBasicMaterial({ color: '#f0b45a', fog: false });
    for (let i = 0; i < 7; i++) {
      if (i === 3) continue;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), wins);
      w.position.set(mx + 2 + i * 3, 2.2, mz + 5.95);
      w.rotation.y = Math.PI;
      this.scene.add(w);
    }
    // a water tower on the other side
    const tw = std('#3d3641');
    const tx = -55;
    const tz = -48;
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) this.box(0.3, 12, 0.3, tw, tx + dx, 6, tz + dz);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 4, 12), tw);
    tank.position.set(tx, 14, tz);
    this.scene.add(tank);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff3030', fog: false }));
    beacon.position.set(tx, 16.4, tz);
    this.scene.add(beacon);
    this.blinkers.push(beacon);
    // a billboard by the road
    this.box(0.4, 6, 0.4, pole, -30, 3, 24);
    this.box(0.4, 6, 0.4, pole, -24, 3, 24);
    const bb = this.sign(['ARE YOU STILL HUMAN?', 'try ROBO-UPGRADE today'], 8, 3, -27, 7, 24.25, 0, { bg: '#f2d31b', fg: '#b3160c', border: '#b3160c', font: PIX });
    bb.rotation.y = Math.PI - 0.4;
  }

  // ---------------------------------------------------------------- clutter

  private clutter(): void {
    const r = this.r;
    // cones along the lane edges near the plaza
    for (const [x, z] of [[islandX(1) - 0.2, -12], [islandX(1), -14], [islandX(4) + 0.1, -13], [islandX(5), 10], [islandX(3) + 0.2, 10.5], [ROAD_X0 + 0.6, 6], [ROAD_X1 - 0.6, -6], [ROAD_X1 - 0.5, -4.5]] as [number, number][]) {
      const c = this.prop('toll_cone', x, 0, z, r() * 3);
      r();
      if (c) this.movable(c, 'Traffic Cone', CONE_OPTS);
    }
    // a knocked-over cone in lane 3
    const fallen = this.prop('toll_cone', laneX(MY_LANE) + 1.2, 0, 6.5, 0.5);
    if (fallen) this.movable(fallen, 'Traffic Cone', CONE_OPTS);
    // litter: cans, paper, a lost hubcap
    const can = std('#a33a2a', { metalness: 0.5 });
    for (let i = 0; i < 14; i++) {
      const lane = 1 + Math.floor(r() * LANES);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 6), can);
      m.rotation.z = Math.PI / 2;
      m.rotation.y = r() * 6;
      m.position.set(islandX(lane - 1) + ISLAND_W / 2 + 0.2 + r() * 0.3, 0.04, -12 + r() * 22);
      this.scene.add(m);
    }
    const paper = new THREE.MeshStandardMaterial({ color: '#e8e2d0', side: THREE.DoubleSide });
    const papers: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 16; i++) {
      const g = new THREE.PlaneGeometry(0.2, 0.15);
      g.rotateZ(r() * 6);
      g.rotateX(-Math.PI / 2);
      g.translate(ROAD_X0 - 1.5 + r() * (ROAD_X1 - ROAD_X0 + 3), 0.02, -14 + r() * 30);
      papers.push(g);
    }
    this.scene.add(new THREE.Mesh(mergeGeometries(papers), paper));
    const hubG = new THREE.Group();
    hubG.position.set(laneX(5) + 1.3, 0, -6);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12), std('#b8bec4', { metalness: 0.8, roughness: 0.3 }));
    hub.position.y = 0.015;
    hubG.add(hub);
    this.scene.add(hubG);
    this.movable(hubG, 'Lost Hubcap', { pocketable: true, holdPos: [0.25, -0.3, -0.6], pickupLine: 'A hubcap from a robot car. It is still spinning a little. Emotionally.' });
    // puddles of rain on the road (shiny, not the engine kind)
    const water = new THREE.MeshStandardMaterial({ color: '#4c4a58', roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(blobGeometry(0.6 + r() * 0.9), water);
      m.position.set(ROAD_X0 + r() * (ROAD_X1 - ROAD_X0), 0.015, -18 + r() * 34);
      this.scene.add(m);
    }
    // cable runs on the island tops
    const cable = std('#151515');
    for (let k = 0; k < LANES; k++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4, 5), cable);
      c.rotation.x = Math.PI / 2;
      c.position.set(islandX(k) - 0.7, 0.25, 4.5);
      this.scene.add(c);
    }
    // parked maintenance truck by the staff building
    if (this.prop('toll_truckGrey', 21.2, 0, -9, 0)) this.solid(21.2, -9, 2.8, 7.4, 2.8, true, 'truck');
    this.sign(['ROAD MAINTENANCE', 'response time: eventually'], 2.6, 0.7, 19.75, 1.7, -9, -Math.PI / 2, { bg: '#e07b16', fg: '#ffffff' });
    // a stack of jersey barriers
    for (let i = 0; i < 3; i++) this.prop(i === 1 ? 'toll_jerseyDamaged' : 'toll_jersey', 21 + (i % 2) * 0.2, 0, 14 + i * 2.5, Math.PI / 2);
    this.solid(21.1, 16.5, 1.2, 7.6, 1.2, false, 'jersey');
    // a road barrier board and a sandbag pile in the west
    for (const [bx, bz, br] of [[-20.4, 9, 0.3], [-20.6, 11, -0.2]] as [number, number, number][]) {
      const rb = this.prop('toll_roadBarrier', bx, 0, bz, br);
      if (rb) this.movable(rb, 'Road Barrier', { heavy: 0.75, holdPos: [0.2, -0.75, -1.2], pickupLine: 'You pick up a road barrier. You are now the road works.' });
    }
    // power poles with sagging cables along the west field
    const wood = std('#4a3a2a');
    const poles: THREE.BufferGeometry[] = [];
    for (let z = -90; z <= 90; z += 22) {
      this.batch(poles, 0.25, 9, 0.25, -28, 4.5, z);
      this.batch(poles, 1.8, 0.15, 0.15, -28, 8.6, z);
    }
    this.scene.add(new THREE.Mesh(mergeGeometries(poles), wood));
  }

  /** Collects a box for a merged mesh (many identical posts, one draw call). */
  private batch(list: THREE.BufferGeometry[], w: number, h: number, d: number, x: number, y: number, z: number): void {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    list.push(g);
  }

  // ---------------------------------------------------------------- per frame

  private animate(t: number): void {
    this.keepFog();
    // booth tube stutters, the yard lamp buzzes
    const ph = t % 6.1;
    if (this.flicker[0]) this.flicker[0].intensity = ph > 5.5 && Math.sin(t * 50) > 0 ? 1.5 : 6;
    if (this.flicker[2]) this.flicker[2].intensity = Math.sin(t * 13) > 0.9 ? 6 : 24;
    const on = Math.sin(t * 3) > 0;
    for (const b of this.blinkers) b.visible = on;
    // the motel neon struggles with the letter T
    if (this.neon[0]) this.neon[0].color.setScalar(t % 4.3 > 4.0 ? 0.35 : 1);
    // overpass traffic
    this.overpassCars.forEach((c, i) => {
      const dir = i % 2 ? -1 : 1;
      c.position.x += dir * 0.12;
      if (c.position.x > 55) c.position.x = -55;
      if (c.position.x < -55) c.position.x = 55;
    });
  }

  /** Animates all barriers toward their target angle. */
  updateBarriers(dt: number): void {
    for (const b of this.barriers) {
      const d = b.target - b.angle;
      const step = dt * 2.6;
      b.angle += Math.abs(d) < step ? d : Math.sign(d) * step;
      b.pivot.rotation.z = b.angle;
      b.arm.visible = !b.broken;
      b.arm.scale.x = b.length;
      const open = b.angle > 1.2;
      b.lamp.color.set(b.broken ? '#ffb020' : open ? '#30ff60' : '#ff3030');
    }
  }

  /** Arm of booth 3. */
  myBarrier(): Barrier {
    return this.barriers.find((b) => b.lane === MY_LANE)!;
  }

  /** Builds a car-sized key arm on the barrier (the spare arm installed). */
  setKeyArm(b: Barrier, on: boolean): void {
    b.keyArm = on;
    const old = b.arm.getObjectByName('keytag');
    if (old) b.arm.remove(old);
    if (!on) return;
    const g = new THREE.Group();
    g.name = 'keytag';
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16), std('#bdc3c7', { metalness: 0.8 }));
    chain.position.set(ARM_LEN * 0.85, -0.12, 0);
    g.add(chain);
    const key = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.012), std('#f1c40f', { metalness: 0.8, roughness: 0.3 }));
    key.position.set(ARM_LEN * 0.85, -0.25, 0);
    g.add(key);
    b.arm.add(g);
  }
}
