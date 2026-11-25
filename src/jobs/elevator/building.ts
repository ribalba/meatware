import * as THREE from 'three';
import type { HideSpot } from '../../fun';
import { Item } from '../../items';
import { Interact, LevelKit } from '../../level';
import { AABB, aabb, textTexture } from '../../util';
import { MANUAL_DEF } from './items';
import { buildFloor } from './floors';
import { buildCabinFun, buildFloorFun } from './fun';
import { FLOOR_LABELS, FLOOR_NAMES, FLOOR_SUBS } from './texts';
import { brassTex, mirrorTex, pinstripeTex, shaftTex, treadTex, woodPanelTex, brickTex } from './textures';

/**
 * SYNERGY TOWER, Elevator B.
 *
 * The player never moves up or down. The cabin stays at y = 0 and the whole building
 * (all floors and the shaft) slides past the gate instead. Only the floor that is level
 * with the cabin is walkable: its colliders are swapped into `colliders` every frame.
 */

/** Height between two floors. */
export const SPACING = 5;
export const FLOORS = 7;
export const TOP = (FLOORS - 1) * SPACING;
/** Inside of the cabin. */
export const CAB = { minX: -2, maxX: 2, minZ: -1.7, maxZ: 1.7, h: 3.6 };
export const GATE_Z = -1.6;
/** The landing wall between shaft and lobby. */
export const SHAFT_Z = -1.9;
export const DOOR_HALF = 1.35;
export const DOOR_H = 2.75;
export const LOBBY = { minX: -6.5, maxX: 8.4, minZ: -13, maxZ: SHAFT_Z, h: 3.9 };
/** The corner of every floor that holds the toilet booth in the basement. */
export const CLOSET = { minX: 2.85, maxX: 8.4, minZ: -13, maxZ: -7.85 };
export const BOOTH_X0 = 3;
export const BOOTH_Z0 = -12;

/** Where the operator stands at the lever. */
export const LEVER_SPOT = new THREE.Vector3(0.85, 0, -0.42);
/** Places for passengers inside the cabin. */
export const CABIN_SPOTS: [number, number][] = [
  [-1.35, -0.55],
  [-1.35, 0.7],
  [-0.4, 1.15],
  [0.6, 1.15],
  [-0.35, 0.0],
  [0.55, 0.35],
];
/** Places to wait in front of the landing door, in floor space. */
export const WAIT_SPOTS: [number, number][] = [
  [-2.3, -2.7],
  [2.3, -2.7],
  [-2.6, -3.7],
  [2.4, -3.8],
  [-1.4, -4.4],
];
/** Door where robots come from and go to, in floor space. */
export const LOBBY_DOOR = new THREE.Vector3(-6.1, 0, -4.8);
export const LOBBY_MID = new THREE.Vector3(-2.9, 0, -4.7);

export const FLOOR_COLORS = ['#e0c070', '#e8edd0', '#ffc8e8', '#d8e8ff', '#9ec8ff', '#ffd8a0', '#d8d4cc'];

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
const px = '"Press Start 2P", monospace';
function pixTex(lines: string[], w: number, h: number, bg: string, fg: string, border?: string): THREE.CanvasTexture {
  const t = textTexture(lines, { w, h, bg, fg, border, font: px });
  t.magFilter = THREE.NearestFilter;
  return t;
}

export interface Lamp {
  mat: THREE.MeshStandardMaterial;
  on: boolean;
}

export class Tower extends LevelKit {
  /** Everything that moves: shaft and floors. Its y is minus the cabin height. */
  building = new THREE.Group();
  floors: THREE.Group[] = [];
  /** Cabin visuals (the cabin itself stays at y = 0, this group only shakes). */
  cabin = new THREE.Group();

  /** Colliders that always exist: cabin walls and the landing wall. */
  baseCols: AABB[] = [];
  floorCols: AABB[][] = [];
  gateCol!: AABB;
  blockCol!: AABB;
  private activeKey = '';

  // gate
  private gateBars: THREE.Object3D[] = [];
  private gateBays: THREE.Object3D[] = [];
  gateHit!: THREE.Mesh;
  gateOpen = 0;

  // controls
  leverPivot = new THREE.Group();
  leverHandle!: THREE.Object3D;
  panel!: THREE.Object3D;
  radio!: THREE.Object3D;
  buttons: Lamp[] = [];
  /** Lamps on each landing that show someone waiting. */
  callLamps: Lamp[] = [];
  overloadLamp!: Lamp;
  stallLamp!: Lamp;
  needles: THREE.Object3D[] = [];
  private gaugeCanvas!: HTMLCanvasElement;
  private gaugeTex!: THREE.CanvasTexture;
  private gaugeLast = '';
  musicScreen!: { set(text: string): void };

  // lights
  cabinLights: THREE.PointLight[] = [];
  lobbyLights: THREE.PointLight[] = [];
  ceilingLampMat!: THREE.MeshStandardMaterial;
  /** Per floor animations, run only while the floor is visible. */
  floorTicks: ((t: number) => void)[][] = [];
  cabinY = 0;

  // mischief (fun.ts): named props for the job, breakables and hiding places per floor
  props = new Map<string, THREE.Object3D>();
  pigeons: THREE.Object3D[] = [];
  floorBreakables: THREE.Object3D[][] = [];
  floorHides: HideSpot[][] = [];
  /** Set by the job: called when a prop breaks or does something (see emit). */
  onFun: ((id: string) => void) | null = null;

  constructor(scene: THREE.Scene) {
    super(scene);
    this.bounds = { minX: LOBBY.minX, maxX: LOBBY.maxX, minZ: LOBBY.minZ, maxZ: CAB.maxZ };
    this.ceiling = CAB.h;
    this.spawn = { pos: new THREE.Vector3(0.2, 0, 0.7), yaw: -0.4 };
    // The cabin is the only place that never moves. The collider list is rebuilt per floor.
    this.beerSpot = { pos: new THREE.Vector3(1.62, 0, 1.36), rotY: Math.PI, solid: false };
    scene.background = new THREE.Color('#15100c');
    scene.add(new THREE.HemisphereLight('#fff4e0', '#4a3a2a', 1.7));
    const sun = new THREE.DirectionalLight('#fff0d8', 0.7);
    sun.position.set(-4, 12, -6);
    scene.add(sun);
    scene.add(this.building);
    scene.add(this.cabin);

    this.buildCabin();
    buildCabinFun(this);
    this.buildShaft();
    for (let i = 0; i < FLOORS; i++) this.buildOneFloor(i);
    this.buildLobbyLights();

    // Brad: some points in the cabin, some in the lobby (only used while a floor is open).
    this.bossWaypoints.push(
      new THREE.Vector3(-1, 0, -0.6),
      new THREE.Vector3(-0.9, 0, 0.9),
      new THREE.Vector3(0.9, 0, 0.9),
      new THREE.Vector3(0, 0, 0.1),
      new THREE.Vector3(0.2, 0, -4.5),
      new THREE.Vector3(-3.5, 0, -7.5),
      new THREE.Vector3(4.8, 0, -4.2),
      new THREE.Vector3(-1, 0, -10.5),
    );
    this.setCabinY(SPACING);
    this.updateColliders(1, 0, false);
    this.onTick((t) => {
      for (let i = 0; i < FLOORS; i++) if (this.floors[i].visible) for (const f of this.floorTicks[i]) f(t);
    });
  }

  // ---------------------------------------------------------------- floors

  private buildOneFloor(i: number): void {
    const g = new THREE.Group();
    g.position.y = i * SPACING;
    this.building.add(g);
    this.floors.push(g);
    const colStart = this.colliders.length;
    const intStart = this.interactables.length;
    const before = new Set(this.scene.children);
    const ticks: ((t: number) => void)[] = [];
    buildFloor(this, g, i, ticks);
    buildFloorFun(this, g, i, ticks);
    if (i === FLOORS - 1) this.placeManual(g);
    // Things the shared kit put straight into the scene (signs, plants, the toilet, movable props) belong to the floor.
    for (const o of [...this.scene.children]) if (!before.has(o)) g.add(o);
    this.floorCols.push(this.colliders.slice(colStart));
    this.colliders.length = colStart;
    this.floorTicks.push(ticks);
    this.floorBreakables.push(this.interactables.slice(intStart).filter((o) => o.userData.breakable));
  }

  /** A prop did something (broke, was used). The job listens through onFun. */
  emit(id: string): void {
    this.onFun?.(id);
  }

  /** A hiding place that only exists on one floor (the job swaps them in). */
  floorHide(i: number, minX: number, minZ: number, maxX: number, maxZ: number, name: string): void {
    (this.floorHides[i] ??= []).push({ rect: { minX, minZ, maxX, maxZ }, name });
  }

  /** The toilet key lives on the roof, clipped to the 30 kg safety manual on a lectern. */
  private placeManual(g: THREE.Group): void {
    const it = new Item(MANUAL_DEF);
    it.state = 'fixed';
    it.mesh.position.set(-4.4, 1.12, -9.2);
    it.mesh.rotation.set(-0.35, 0.5, 0);
    g.add(it.mesh);
    this.initialItems.push(it);
  }

  // ---------------------------------------------------------------- moving the building

  setCabinY(y: number): void {
    this.cabinY = y;
    this.building.position.y = -y;
    for (let i = 0; i < FLOORS; i++) {
      const vis = Math.abs(i * SPACING - y) < SPACING * 1.25;
      this.floors[i].visible = vis;
    }
    // Every landing dial points at the cabin.
    const a = THREE.MathUtils.clamp(y / TOP, -0.05, 1.05);
    for (const n of this.needles) n.rotation.z = THREE.MathUtils.lerp(1.35, -1.35, a);
  }

  /** Rebuilds the collider list when the walkable floor or the gate changes. */
  updateColliders(levelFloor: number | null, offset: number, gateClosed: boolean): void {
    const key = `${levelFloor}/${gateClosed}`;
    if (key === this.activeKey) return;
    this.activeKey = key;
    const c = this.colliders;
    c.length = 0;
    c.push(...this.baseCols);
    this.gateCol.disabled = !gateClosed;
    c.push(this.gateCol);
    if (levelFloor !== null) c.push(...this.floorCols[levelFloor]);
    else c.push(this.blockCol);
    void offset;
  }

  // ---------------------------------------------------------------- cabin

  private buildCabin(): void {
    const cab = this.cabin;
    const { minX, maxX, minZ, maxZ, h } = CAB;
    const W = maxX - minX;
    const D = maxZ - minZ;
    const wood = std({ map: woodPanelTex([4, 1]) });
    const woodSide = std({ map: woodPanelTex([3.5, 1]) });
    const paper = std({ map: pinstripeTex([6, 3]) });
    const paperSide = std({ map: pinstripeTex([5, 3]) });
    const brass = std({ map: brassTex([4, 1]), metalness: 0.7, roughness: 0.35 });
    const darkWood = std({ color: '#3a2010' });

    // Floor and ceiling
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D + 0.2, 8, 8), std({ map: treadTex([8, 7]) }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.002, (minZ + maxZ) / 2 - 0.1);
    cab.add(floor);
    // Carpet runner
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.4, 4, 4), std({ color: '#6e1a1f', roughness: 0.95 }));
    runner.rotation.x = -Math.PI / 2;
    runner.position.set(-0.3, 0.006, 0.3);
    cab.add(runner);
    this.box(2.7, 0.012, 0.06, brass, -0.3, 0.008, -0.93, cab);
    this.box(2.7, 0.012, 0.06, brass, -0.3, 0.008, 1.53, cab);
    // Brass sill plate at the gate
    this.box(W, 0.02, 0.22, brass, 0, 0.01, minZ - 0.08, cab);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D, 4, 4), std({ color: '#4a2c16' }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, h, 0);
    cab.add(ceil);
    // Coffered ceiling beams
    for (const x of [-1, 0, 1]) this.box(0.08, 0.12, D, darkWood, x, h - 0.06, 0, cab);
    for (const z of [-0.85, 0, 0.85]) this.box(W, 0.12, 0.08, darkWood, 0, h - 0.06, z, cab);
    // Round ceiling lamp, glowing
    this.ceilingLampMat = new THREE.MeshStandardMaterial({ color: '#fff1c8', emissive: '#ffd890', emissiveIntensity: 1.1 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), this.ceilingLampMat);
    dome.position.set(0, h - 0.02, 0.2);
    cab.add(dome);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.03, 6, 20), brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, h - 0.03, 0.2);
    cab.add(ring);
    // Escape hatch, hinged on its west edge (it can be opened)
    const hatch = new THREE.Group();
    hatch.position.set(-1.55, h - 0.01, 1.0);
    cab.add(hatch);
    this.box(0.7, 0.02, 0.7, std({ color: '#2b2118' }), 0.35, 0, 0, hatch);
    const hatchSign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), std({ map: pixTex(['HATCH', 'DO NOT OPEN', 'it is just', 'more elevator'], 256, 128, '#2b2118', '#e0b21b') }));
    hatchSign.rotation.x = Math.PI / 2;
    hatchSign.position.set(0.35, -0.015, 0);
    hatch.add(hatchSign);
    this.props.set('hatch', hatch);
    // Ventilation grille and a camera dome (Brad has friends)
    this.box(0.5, 0.02, 0.25, std({ color: '#1b1612' }), 1.2, h - 0.01, 1.2, cab);
    for (let i = 0; i < 5; i++) this.box(0.46, 0.025, 0.02, brass, 1.2, h - 0.02, 1.1 + i * 0.05, cab);
    const camG = new THREE.Group();
    cab.add(camG);
    const camDome = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std({ color: '#151515', roughness: 0.2 }));
    camDome.position.set(-1.7, h - 0.01, -1.3);
    camG.add(camDome);
    const camLed = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 2 }));
    camLed.position.set(-1.65, h - 0.08, -1.26);
    camG.add(camLed);
    this.props.set('camDome', camG);

    // Walls: wood panelling below, wallpaper above, brass rail between.
    const wallH = 1.15;
    const side = (x: number, rotY: number) => {
      const lo = new THREE.Mesh(new THREE.PlaneGeometry(D, wallH), woodSide);
      lo.position.set(x, wallH / 2, 0);
      lo.rotation.y = rotY;
      cab.add(lo);
      const hi = new THREE.Mesh(new THREE.PlaneGeometry(D, h - wallH), paperSide);
      hi.position.set(x, wallH + (h - wallH) / 2, 0);
      hi.rotation.y = rotY;
      cab.add(hi);
    };
    side(minX, Math.PI / 2);
    side(maxX, -Math.PI / 2);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, wallH), wood);
    back.position.set(0, wallH / 2, maxZ);
    back.rotation.y = Math.PI;
    cab.add(back);
    const backHi = new THREE.Mesh(new THREE.PlaneGeometry(W, h - wallH), paper);
    backHi.position.set(0, wallH + (h - wallH) / 2, maxZ);
    backHi.rotation.y = Math.PI;
    cab.add(backHi);
    // Outer shells so the cabin is a box from outside too (seen from the lobby)
    const shell = std({ color: '#2a1a0e' });
    this.box(0.08, h, D, shell, minX - 0.05, h / 2, 0, cab);
    this.box(0.08, h, D, shell, maxX + 0.05, h / 2, 0, cab);
    this.box(W + 0.18, h, 0.08, shell, 0, h / 2, maxZ + 0.05, cab);
    this.box(W + 0.18, 0.08, D + 0.1, shell, 0, h + 0.05, 0, cab);

    // Mirror on the back wall
    this.box(2.6, 1.6, 0.03, brass, -0.3, 2.05, maxZ - 0.02, cab);
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(2.45, 1.45), std({ map: mirrorTex(), roughness: 0.15, metalness: 0.6 }));
    mirror.position.set(-0.3, 2.05, maxZ - 0.04);
    mirror.rotation.y = Math.PI;
    cab.add(mirror);
    mirror.userData.interact = { kind: 'sign', text: 'The mirror. You look like someone who operates an elevator. You are.' } satisfies Interact;
    this.interactables.push(mirror);
    this.props.set('mirror', mirror);

    // Handrails on three sides
    const railY = wallH + 0.02;
    const rail = (len: number, x: number, z: number, alongX: boolean) => {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 8), brass);
      r.rotation.set(alongX ? 0 : Math.PI / 2, 0, alongX ? Math.PI / 2 : 0);
      r.position.set(x, railY, z);
      cab.add(r);
    };
    rail(W - 0.3, 0, maxZ - 0.08, true);
    rail(D - 0.9, minX + 0.08, 0.25, false);
    rail(1.1, maxX - 0.08, 1.0, false);
    this.box(W, 0.05, 0.02, brass, 0, wallH, maxZ - 0.01, cab);
    for (const x of [minX + 0.01, maxX - 0.01]) this.box(0.02, 0.05, D, brass, x, wallH, 0, cab);
    // Kick plates
    for (const x of [minX + 0.01, maxX - 0.01]) this.box(0.02, 0.18, D, brass, x, 0.09, 0, cab);
    this.box(W, 0.18, 0.02, brass, 0, 0.09, maxZ - 0.01, cab);

    // Front wall around the gate
    const frontPiece = (x: number, w: number) => {
      this.box(w, h, 0.1, wood, x, h / 2, minZ, cab);
    };
    const sideW = (W - DOOR_HALF * 2) / 2;
    frontPiece(minX + sideW / 2, sideW);
    frontPiece(maxX - sideW / 2, sideW);
    this.box(DOOR_HALF * 2, h - DOOR_H, 0.1, wood, 0, DOOR_H + (h - DOOR_H) / 2, minZ, cab);
    // Brass door frame
    for (const s of [-1, 1]) this.box(0.08, DOOR_H, 0.14, brass, s * (DOOR_HALF + 0.02), DOOR_H / 2, minZ + 0.02, cab);
    this.box(DOOR_HALF * 2 + 0.2, 0.1, 0.14, brass, 0, DOOR_H + 0.02, minZ + 0.02, cab);

    this.buildDial(cab, 0, 3.15, minZ + 0.07, 0, 0.42);
    this.buildGate(cab);
    this.buildPanel(cab);
    this.buildCabinDecor(cab);

    // Colliders of the cabin
    const t = 0.12;
    this.baseCols.push(
      aabb(minX - t / 2, 0, t, D + 0.4, h, true, 'cabin'),
      aabb(maxX + t / 2, 0, t, D + 0.4, h, true, 'cabin'),
      aabb(0, maxZ + t / 2, W + 0.4, t, h, true, 'cabin'),
      aabb(minX + sideW / 2, minZ, sideW, t, h, true, 'cabin'),
      aabb(maxX - sideW / 2, minZ, sideW, t, h, true, 'cabin'),
      // control panel
      aabb(1.72, -1.2, 0.7, 0.75, 1.5, false, 'panel'),
    );
    this.gateCol = aabb(0, GATE_Z, DOOR_HALF * 2 + 0.1, 0.1, DOOR_H, false, 'gate');
    this.blockCol = aabb(0, SHAFT_Z - 0.02, DOOR_HALF * 2 + 0.2, 0.12, 3, true, 'shaft');

    // Two warm lamps in the cabin
    for (const [x, z] of [[0, 0.2], [0.8, -1.0]] as [number, number][]) {
      const l = new THREE.PointLight('#ffd9a0', x === 0 ? 7 : 3.5, 6, 1.6);
      l.position.set(x, h - 0.4, z);
      cab.add(l);
      this.cabinLights.push(l);
    }
  }

  /** A semicircle floor dial with B..R and a brass needle. */
  private buildDial(parent: THREE.Object3D, x: number, y: number, z: number, rotY: number, r: number): void {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 72;
    const g = c.getContext('2d')!;
    g.fillStyle = '#e8d9a8';
    g.fillRect(0, 0, 128, 72);
    g.strokeStyle = '#3a2a12';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(64, 68, 58, Math.PI, 0);
    g.stroke();
    g.fillStyle = '#3a2a12';
    g.font = 'bold 11px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    FLOOR_LABELS.forEach((lab, i) => {
      const a = THREE.MathUtils.lerp(Math.PI - 0.22, 0.22, i / (FLOOR_LABELS.length - 1));
      g.fillText(lab, 64 + Math.cos(a) * 46, 68 - Math.sin(a) * 46);
      g.fillRect(64 + Math.cos(a) * 55 - 1, 68 - Math.sin(a) * 55 - 1, 2, 2);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    const holder = new THREE.Group();
    holder.position.set(x, y, z);
    holder.rotation.y = rotY;
    parent.add(holder);
    const face = new THREE.Mesh(new THREE.CircleGeometry(r, 20, 0, Math.PI), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffe8b0', emissiveIntensity: 0.25, emissiveMap: tex }));
    // Map the canvas onto the half disc
    const uv = face.geometry.attributes.uv;
    const pos = face.geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (64 + (pos.getX(i) / r) * 62) / 128, 1 - (68 - (pos.getY(i) / r) * 62) / 72);
    holder.add(face);
    const brass = std({ map: brassTex([1, 1]), metalness: 0.7, roughness: 0.35 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 6, 20, Math.PI), brass);
    holder.add(rim);
    this.box(r * 2 + 0.05, 0.05, 0.04, brass, 0, 0, 0, holder);
    const pivot = new THREE.Group();
    pivot.position.z = 0.02;
    holder.add(pivot);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.025, r * 0.85, 0.01), std({ color: '#1a1208' }));
    needle.position.y = r * 0.42;
    pivot.add(needle);
    this.needles.push(pivot);
  }

  /** The brass scissor gate. Bars bunch up on the left when it opens. */
  private buildGate(cab: THREE.Group): void {
    const brass = std({ map: brassTex([1, 4]), metalness: 0.75, roughness: 0.3 });
    const n = 14;
    const g = new THREE.Group();
    g.position.set(0, 0, GATE_Z);
    cab.add(g);
    for (let i = 0; i <= n; i++) {
      const bar = this.box(0.03, DOOR_H - 0.1, 0.03, brass, 0, (DOOR_H - 0.1) / 2 + 0.03, 0, g);
      this.gateBars.push(bar);
    }
    for (let i = 0; i < n; i++) {
      const bay = new THREE.Group();
      for (const s of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const d = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.9, 0.015), brass);
          d.rotation.z = s * 0.85;
          d.position.set(0, 0.35 + k * 0.62, 0);
          bay.add(d);
        }
      }
      g.add(bay);
      this.gateBays.push(bay);
    }
    // top and bottom tracks
    this.box(DOOR_HALF * 2, 0.04, 0.06, brass, 0, DOOR_H - 0.04, 0, g);
    this.box(DOOR_HALF * 2, 0.02, 0.06, brass, 0, 0.01, 0, g);
    const handle = this.box(0.05, 0.25, 0.08, std({ color: '#2a1a0e' }), 0, 1.1, 0.04, g);
    this.gateBars.push(handle);
    g.userData.interact = { kind: 'evGate' } satisfies Interact;
    this.interactables.push(g);
    // Invisible plate to make the closed gate easy to aim at.
    this.gateHit = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_HALF * 2, DOOR_H), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    this.gateHit.position.set(0, DOOR_H / 2, GATE_Z + 0.02);
    this.gateHit.rotation.y = Math.PI;
    cab.add(this.gateHit);
    this.interactables.push(this.gateHit);
    this.setGate(0);
  }

  /** 0 = closed, 1 = open (bunched at the left post). */
  setGate(open: number): void {
    this.gateOpen = open;
    const n = this.gateBays.length;
    const x0 = -DOOR_HALF + 0.03;
    const closedW = (DOOR_HALF * 2 - 0.06) / n;
    const openW = 0.035;
    const bw = THREE.MathUtils.lerp(closedW, openW, open);
    for (let i = 0; i <= n; i++) this.gateBars[i].position.x = x0 + i * bw;
    this.gateBars[n + 1].position.x = x0 + n * bw + 0.03;
    for (let i = 0; i < n; i++) {
      const bay = this.gateBays[i];
      bay.position.x = x0 + (i + 0.5) * bw;
      bay.scale.x = bw / closedW;
    }
    this.gateHit.userData.interact = open < 0.5 ? ({ kind: 'evGate' } satisfies Interact) : undefined;
  }

  /** Control panel on the right wall: lever, buttons, gauge, lamps, radio. */
  private buildPanel(cab: THREE.Group): void {
    const brass = std({ map: brassTex([2, 2]), metalness: 0.7, roughness: 0.35 });
    const dark = std({ color: '#1e140c' });
    const p = new THREE.Group();
    // Mounted across the front right corner, so the operator sees gate and panel at once.
    p.position.set(1.66, 0, -1.18);
    p.rotation.y = -Math.PI / 4;
    cab.add(p);
    this.panel = p;
    // Cabinet below and the brass face plate
    this.box(1.1, 0.95, 0.28, std({ map: woodPanelTex([1, 1]) }), 0, 0.475, 0.14, p);
    this.box(1.14, 0.04, 0.32, brass, 0, 0.97, 0.15, p);
    const plate = this.box(1.08, 1.15, 0.03, brass, 0, 1.6, 0.015, p);
    this.box(1.12, 1.2, 0.02, std({ color: '#2a1a0e' }), 0, 1.6, 0.0, p);
    plate.userData.interact = { kind: 'evPanel' } satisfies Interact;
    this.interactables.push(plate);
    // Floor buttons in two columns, B at the bottom
    for (let i = 0; i < FLOORS; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const bx = -0.42 + col * 0.18;
      const by = 1.28 + row * 0.16;
      const mat = new THREE.MeshStandardMaterial({ color: '#f2e8c8', emissive: '#ffb030', emissiveIntensity: 0 });
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 12), mat);
      b.rotation.x = Math.PI / 2;
      b.position.set(bx, by, 0.045);
      p.add(b);
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), std({ map: pixTex([FLOOR_LABELS[i]], 32, 32, '#1e140c', '#e0b21b') }));
      lab.position.set(bx + 0.085, by, 0.034);
      p.add(lab);
      this.buttons.push({ mat, on: false });
    }
    // Lamps: OVERLOAD and MOTOR
    const lamp = (text: string, color: string, x: number, y: number): Lamp => {
      const mat = new THREE.MeshStandardMaterial({ color: '#3a2a1a', emissive: color, emissiveIntensity: 0 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.03), mat);
      m.position.set(x, y, 0.04);
      p.add(m);
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), std({ map: pixTex([text], 128, 32, '#1e140c', '#d8c8a0') }));
      l.position.set(x, y - 0.075, 0.033);
      p.add(l);
      return { mat, on: false };
    };
    this.overloadLamp = lamp('OVERLOAD', '#ff2a10', 0.3, 2.06);
    this.stallLamp = lamp('MOTOR', '#ffb020', 0.3, 1.88);

    // Level gauge window
    this.gaugeCanvas = document.createElement('canvas');
    this.gaugeCanvas.width = 32;
    this.gaugeCanvas.height = 64;
    this.gaugeTex = new THREE.CanvasTexture(this.gaugeCanvas);
    this.gaugeTex.colorSpace = THREE.SRGBColorSpace;
    this.gaugeTex.magFilter = THREE.NearestFilter;
    const gauge = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.28), new THREE.MeshBasicMaterial({ map: this.gaugeTex }));
    gauge.position.set(0.0, 1.95, 0.035);
    p.add(gauge);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), std({ map: pixTex(['LEVEL'], 128, 32, '#1e140c', '#d8c8a0') }));
    gl.position.set(0, 1.77, 0.033);
    p.add(gl);
    this.drawGauge(0, false);

    // The lever on a black enamel quadrant with notches
    const enamel = std({ color: '#141010', roughness: 0.4 });
    const quad = new THREE.Mesh(new THREE.CircleGeometry(0.34, 18, Math.PI * 0.12, Math.PI * 0.76), enamel);
    quad.position.set(0.15, 1.18, 0.034);
    p.add(quad);
    for (let k = -3; k <= 3; k++) {
      const a = Math.PI / 2 - k * 0.32;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(k === 0 ? 0.03 : 0.018, 0.07, 0.01), k === 0 ? std({ color: '#f2ead2' }) : brass);
      tick.position.set(0.15 + Math.cos(a) * 0.29, 1.18 + Math.sin(a) * 0.29, 0.04);
      tick.rotation.z = a - Math.PI / 2;
      p.add(tick);
    }
    const qLab = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.1), std({ map: pixTex(['DOWN  STOP  UP'], 256, 40, '#f2ead2', '#2a1a0a') }));
    qLab.position.set(0.15, 1.56, 0.04);
    p.add(qLab);
    this.leverPivot.position.set(0.15, 1.18, 0.07);
    p.add(this.leverPivot);
    const rodMat = std({ color: '#e0c070', metalness: 0.85, roughness: 0.2 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.3, 8), rodMat);
    rod.position.y = 0.15;
    this.leverPivot.add(rod);
    // the wooden grip sticks out towards the operator
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.18, 10), std({ color: '#3a1a0a', roughness: 0.35 }));
    grip.rotation.x = Math.PI / 2;
    grip.position.set(0, 0.29, 0.09);
    this.leverPivot.add(grip);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), rodMat);
    cap.position.set(0, 0.29, 0.18);
    this.leverPivot.add(cap);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12), brass);
    hub.rotation.x = Math.PI / 2;
    this.leverPivot.add(hub);
    this.leverHandle = this.leverPivot;
    this.leverPivot.userData.interact = { kind: 'evLever' } satisfies Interact;
    this.interactables.push(this.leverPivot);
    // A bigger invisible grab area around the lever
    const grab = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    grab.position.set(0.15, 1.3, 0.1);
    grab.userData.interact = { kind: 'evLever' } satisfies Interact;
    p.add(grab);
    this.interactables.push(grab);

    // Alarm bell button, emergency phone and inspection plate
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), std({ color: '#e0b21b' }));
    bell.rotation.x = Math.PI / 2;
    bell.position.set(-0.42, 2.0, 0.045);
    p.add(bell);
    const bl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), std({ map: pixTex(['ALARM'], 128, 32, '#1e140c', '#e0b21b') }));
    bl.position.set(-0.42, 1.92, 0.033);
    p.add(bl);
    // A red button under a clear cover. Nobody knows what it does. Nobody was supposed to.
    const dnp = new THREE.Group();
    dnp.position.set(-0.19, 2.08, 0.03);
    p.add(dnp);
    const red = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12), new THREE.MeshStandardMaterial({ color: '#c0221a', emissive: '#ff2a10', emissiveIntensity: 0.3 }));
    red.rotation.x = Math.PI / 2;
    red.position.z = 0.015;
    dnp.add(red);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), new THREE.MeshStandardMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.3, roughness: 0.05 }));
    cover.position.z = 0.03;
    dnp.add(cover);
    const dl = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.05), std({ map: pixTex(['DO NOT', 'PRESS'], 128, 36, '#1e140c', '#ff5a40') }));
    dl.position.set(0, -0.08, 0.004);
    dnp.add(dl);
    dnp.userData.interact = { kind: 'evFun', id: 'button' } satisfies Interact;
    this.interactables.push(dnp);
    this.props.set('button', dnp);
    const phone = new THREE.Group();
    phone.position.set(-0.45, 0.65, 0.3);
    p.add(phone);
    this.box(0.26, 0.32, 0.1, std({ color: '#8e1f16' }), 0, 0, 0, phone);
    this.box(0.06, 0.22, 0.05, dark, 0.06, 0, 0.07, phone);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.08), std({ map: pixTex(['EMERGENCY', 'calls Brad'], 128, 48, '#8e1f16', '#ffffff') }));
    pl.position.set(-0.04, 0.12, 0.051);
    phone.add(pl);
    phone.userData.interact = { kind: 'evFun', id: 'phone' } satisfies Interact;
    this.interactables.push(phone);

    // The radio on the cabinet top
    const radio = new THREE.Group();
    radio.position.set(0.32, 0.99, 0.15);
    p.add(radio);
    if (!this.prop('evRadio', 0, 0, 0, 0, radio)) {
      this.box(0.36, 0.2, 0.14, std({ color: '#6e4b2a' }), 0, 0.1, 0, radio);
      this.box(0.14, 0.12, 0.01, std({ color: '#c9b68a' }), -0.07, 0.11, 0.071, radio);
    }
    const screen = document.createElement('canvas');
    screen.width = 128;
    screen.height = 24;
    const sg = screen.getContext('2d')!;
    const stex = new THREE.CanvasTexture(screen);
    stex.colorSpace = THREE.SRGBColorSpace;
    stex.magFilter = THREE.NearestFilter;
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.065), new THREE.MeshBasicMaterial({ map: stex }));
    sm.position.set(0, 0.29, 0.02);
    radio.add(sm);
    this.musicScreen = {
      set: (text: string) => {
        sg.fillStyle = '#10200c';
        sg.fillRect(0, 0, 128, 24);
        sg.fillStyle = '#9cff7a';
        sg.font = 'bold 10px monospace';
        sg.textBaseline = 'middle';
        sg.fillText(text.slice(0, 22), 4, 12);
        stex.needsUpdate = true;
      },
    };
    this.musicScreen.set('CORPORATE MUZAK');
    radio.userData.interact = { kind: 'evRadio' } satisfies Interact;
    this.interactables.push(radio);
    this.radio = radio;
  }

  /** Redraws the small level window on the panel: a marker against the floor line. */
  drawGauge(offset: number, show: boolean): void {
    const key = show ? offset.toFixed(2) : 'off';
    if (key === this.gaugeLast) return;
    this.gaugeLast = key;
    const g = this.gaugeCanvas.getContext('2d')!;
    g.fillStyle = '#0e1a10';
    g.fillRect(0, 0, 32, 64);
    g.fillStyle = '#244a2a';
    for (let y = 4; y < 64; y += 6) g.fillRect(10, y, 12, 1);
    g.fillStyle = '#e0b21b';
    g.fillRect(2, 31, 28, 2);
    if (show) {
      const y = THREE.MathUtils.clamp(32 + offset * 60, 2, 60);
      const good = Math.abs(offset) < 0.06;
      g.fillStyle = good ? '#7cff6a' : Math.abs(offset) < 0.2 ? '#ffd040' : '#ff4030';
      g.fillRect(6, Math.round(y) - 3, 20, 6);
    }
    this.gaugeTex.needsUpdate = true;
  }

  setLamp(l: Lamp, on: boolean, intensity = 1.6): void {
    if (l.on === on) return;
    l.on = on;
    l.mat.emissiveIntensity = on ? intensity : 0;
  }

  private buildCabinDecor(cab: THREE.Group): void {
    const brass = std({ map: brassTex([1, 1]), metalness: 0.7, roughness: 0.35 });
    // Directory board on the left wall: the decoder for coded floors
    const lines = ['FLOOR DIRECTORY'];
    for (let i = FLOORS - 1; i >= 0; i--) lines.push(`${FLOOR_LABELS[i]}  ${FLOOR_NAMES[i]}: ${FLOOR_SUBS[i]}`);
    const dir = new THREE.Mesh(
      new THREE.PlaneGeometry(1.25, 1.0),
      std({ map: textTexture(lines, { w: 512, h: 420, bg: '#1e140c', fg: '#e8d9a8', border: '#b08a3a', font: '"VT323", monospace' }) }),
    );
    dir.position.set(CAB.minX + 0.02, 1.95, -0.6);
    dir.rotation.y = Math.PI / 2;
    cab.add(dir);
    dir.userData.interact = { kind: 'sign', text: 'The floor directory. Hex, binary or snacks. Every floor is on here. Except 13.' } satisfies Interact;
    this.interactables.push(dir);
    this.box(0.03, 1.06, 1.31, brass, CAB.minX + 0.012, 1.95, -0.6, cab);
    // Capacity plate and the inspection certificate
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.3), std({ map: pixTex(['CAPACITY', '560 KG', 'or 6 robots', 'or 1 parcel'], 256, 140, '#b08a3a', '#2a1a0a', '#2a1a0a'), metalness: 0.5 }));
    cap.position.set(CAB.minX + 0.02, 1.85, 0.75);
    cap.rotation.y = Math.PI / 2;
    cab.add(cap);
    const cert = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.55), std({ map: textTexture(['INSPECTION', 'CERTIFICATE', 'passed: 2049', 'by: an intern', 'next: never'], { w: 200, h: 260, bg: '#f2ead2', fg: '#2a1a0a', border: '#8a6a2a' }) }));
    cert.position.set(CAB.minX + 0.02, 1.9, 1.3);
    cert.rotation.y = Math.PI / 2;
    cab.add(cert);
    cert.userData.interact = { kind: 'sign', text: 'INSPECTION CERTIFICATE. Passed 2049. The intern who signed it now runs the company.' } satisfies Interact;
    this.interactables.push(cert);
    // HR notice above the panel
    const hr = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.42), std({ map: textTexture(['HR NOTICE', 'Small talk is', 'MANDATORY.', 'Too much small talk', 'is a violation.'], { w: 256, h: 180, bg: '#fdf6e3', fg: '#2c3e50', border: '#c0392b' }) }));
    hr.position.set(CAB.maxX - 0.02, 2.55, 0.6);
    hr.rotation.y = -Math.PI / 2;
    cab.add(hr);
    hr.userData.interact = { kind: 'sign', text: 'HR NOTICE: Small talk is mandatory. Too much small talk is a violation. The right amount is classified.' } satisfies Interact;
    this.interactables.push(hr);
    // Speaker grille for the muzak
    const spk = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), std({ color: '#1a120a' }));
    spk.position.set(CAB.maxX - 0.02, 2.9, 1.25);
    spk.rotation.y = -Math.PI / 2;
    cab.add(spk);
    const spkRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 16), brass);
    spkRing.position.copy(spk.position);
    spkRing.rotation.y = -Math.PI / 2;
    cab.add(spkRing);
    // A brass spittoon, an umbrella stand and the operator stool in the corners
    // (spittoon and umbrella stand can be picked up, kicked and thrown)
    const spit = new THREE.Group();
    spit.position.set(1.75, 0, -0.3);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.28, 12), brass);
    sp.position.y = 0.14;
    spit.add(sp);
    this.movable(spit, 'Brass Spittoon', { holdPos: [0.25, -0.42, -0.7], pickupLine: 'A brass spittoon. Robots do not spit. It has been polished every day since 1962 anyway.' });
    const stand = new THREE.Group();
    stand.position.set(-1.72, 0, -1.35);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 10), std({ color: '#3a3f2a' }));
    st.position.y = 0.25;
    stand.add(st);
    for (let i = 0; i < 2; i++) {
      const u = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.04, 0.8, 6), std({ color: i ? '#2c3e50' : '#6e1a1f' }));
      u.position.set((i - 0.5) * 0.06, 0.55, 0);
      u.rotation.z = (i - 0.5) * 0.2;
      stand.add(u);
    }
    this.movable(stand, 'Umbrella Stand', { holdPos: [0.25, -0.6, -0.75], pickupLine: 'An umbrella stand. It is always sunny in an elevator. The umbrellas stay anyway.' });
    const stool = new THREE.Group();
    stool.position.set(1.65, 0, 0.55);
    cab.add(stool);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12), std({ color: '#6e1a1f' }));
    seat.position.y = 0.62;
    stool.add(seat);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.62, 5), brass);
      leg.position.set(Math.cos(a) * 0.14, 0.31, Math.sin(a) * 0.14);
      stool.add(leg);
    }
    const stoolSign = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), std({ map: pixTex(['NOT FOR SITTING'], 192, 48, '#f2ead2', '#8e1f16') }));
    stoolSign.position.set(0, 0.66, 0);
    stoolSign.rotation.x = -Math.PI / 2;
    stool.add(stoolSign);
    stool.userData.interact = { kind: 'sign', text: 'OPERATOR STOOL. Sitting is a privilege. You do not have privileges.' } satisfies Interact;
    this.interactables.push(stool);
    this.baseCols.push(aabb(1.65, 0.55, 0.45, 0.45, 0.7, false, 'stool'));
    // Trash can by the stool
    const bin = new THREE.Group();
    bin.position.set(1.7, 0, 1.0);
    if (!this.prop('evTrash', 0, 0, 0, 0, bin)) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.45, 10), std({ color: '#3f4a3c' }));
      b.position.y = 0.22;
      bin.add(b);
    }
    this.movable(bin, 'Cabin Trash Can', { holdPos: [0.25, -0.5, -0.75], pickupLine: 'The cabin trash can. Inside: one receipt, one sigh.' });
    // A potted plant in the back left corner. Players will pee in it.
    const plant = this.plant(-1.6, 1.3);
    this.cabin.add(plant.group);
    this.baseCols.push(this.colliders.pop()!);
  }

  // ---------------------------------------------------------------- shaft

  private buildShaft(): void {
    const b = this.building;
    const shaft = std({ map: shaftTex([3, 2]) });
    const hazard = std({ color: '#d8a81b' });
    const dark = std({ color: '#0e0c0a' });
    const cable = std({ color: '#2a2622', metalness: 0.6, roughness: 0.4 });
    // Pit below the basement and space above the roof
    this.box(LOBBY.maxX - LOBBY.minX, 6, 0.2, shaft, (LOBBY.minX + LOBBY.maxX) / 2, -3.35, SHAFT_Z, b);
    this.box(4.6, 0.2, 4, dark, 0, -6.2, 0, b);
    // Pit buffers (you will meet them)
    for (const x of [-1, 1]) {
      const buf = this.box(0.35, 0.9, 0.35, std({ color: '#c0392b' }), x, -5.6, 0.2, b);
      buf.userData.decor = true;
    }
    // Cables and guide rails running the whole height on the shaft side walls
    const H = TOP + 12;
    for (const x of [-2.2, 2.2]) {
      const railM = this.box(0.08, H, 0.12, std({ color: '#3a3a3a', metalness: 0.6 }), x, H / 2 - 6, -1.5, b);
      railM.userData.decor = true;
    }
    for (const x of [-0.5, -0.3, 0.3, 0.5]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 12, 5), cable);
      c.position.set(x, CAB.h + 6, 0);
      this.cabin.add(c);
    }
    // Per floor: landing labels painted on the shaft side, hazard edge at each sill
    for (let i = 0; i < FLOORS; i++) {
      const y0 = i * SPACING;
      // The painted floor number in the space between floors, seen through the gate while driving
      const lab = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.9),
        new THREE.MeshStandardMaterial({ map: pixTex([FLOOR_LABELS[i], FLOOR_NAMES[i]], 256, 144, '#4a453e', '#e9e4d4'), roughness: 0.9 }),
      );
      lab.position.set(0, y0 + 3.75, SHAFT_Z + 0.011);
      b.add(lab);
      this.box(DOOR_HALF * 2 + 0.3, 0.1, 0.06, hazard, 0, y0 - 0.05, SHAFT_Z + 0.04, b);
      const stripe = this.box(DOOR_HALF * 2 + 0.3, 0.25, 0.04, std({ map: hazardStripe() }), 0, y0 - 0.25, SHAFT_Z + 0.03, b);
      stripe.userData.decor = true;
      // grease drips and a junction box
      this.box(0.3, 0.4, 0.12, std({ color: '#5a5f52' }), -1.1, y0 + 4.2, SHAFT_Z + 0.07, b);
      this.box(0.05, 0.9, 0.05, std({ color: '#2a2622' }), -1.1, y0 + 3.55, SHAFT_Z + 0.06, b);
      // a small caged work light in the shaft every floor
      const wl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshStandardMaterial({ color: '#ffe0a0', emissive: '#ffcf70', emissiveIntensity: 1.5 }));
      wl.position.set(1.15, y0 + 4.3, SHAFT_Z + 0.1);
      b.add(wl);
    }
    // Machine room roof above the top landing
    this.box(LOBBY.maxX - LOBBY.minX, 0.3, 0.6, std({ map: brickTex([12, 1]) }), (LOBBY.minX + LOBBY.maxX) / 2, TOP + 4.8, SHAFT_Z - 0.15, b);
    this.box(LOBBY.maxX - LOBBY.minX, 3, 0.2, shaft, (LOBBY.minX + LOBBY.maxX) / 2, TOP + 6.4, SHAFT_Z, b);

    // Landing wall colliders, the same on every floor
    const lw = -DOOR_HALF - LOBBY.minX;
    const rw = LOBBY.maxX - DOOR_HALF;
    this.baseCols.push(
      aabb(LOBBY.minX + lw / 2, SHAFT_Z, lw, 0.14, 4, true, 'landing'),
      aabb(DOOR_HALF + rw / 2, SHAFT_Z, rw, 0.14, 4, true, 'landing'),
    );
  }

  /** The common landing of a floor: wall with the doorway, frame, dial, call lamp and sign. */
  landing(g: THREE.Group, i: number, lobbyMat: THREE.Material, frameMat: THREE.Material): void {
    const shaft = std({ map: shaftTex([3, 2]) });
    const mats = (lobby: THREE.Material) => [shaft, shaft, shaft, shaft, shaft, lobby];
    const lw = -DOOR_HALF - LOBBY.minX;
    const rw = LOBBY.maxX - DOOR_HALF;
    const H = SPACING;
    const y0 = -0.35;
    this.box(lw, H, 0.12, mats(lobbyMat), LOBBY.minX + lw / 2, y0 + H / 2, SHAFT_Z, g);
    this.box(rw, H, 0.12, mats(lobbyMat), DOOR_HALF + rw / 2, y0 + H / 2, SHAFT_Z, g);
    this.box(DOOR_HALF * 2, H - DOOR_H + y0, 0.12, mats(lobbyMat), 0, DOOR_H + (H + y0 - DOOR_H) / 2, SHAFT_Z, g);
    this.box(DOOR_HALF * 2, -y0, 0.12, shaft, 0, y0 / 2, SHAFT_Z, g);
    // Door frame on the lobby side
    for (const s of [-1, 1]) this.box(0.16, DOOR_H + 0.1, 0.1, frameMat, s * (DOOR_HALF + 0.06), (DOOR_H + 0.1) / 2, SHAFT_Z - 0.09, g);
    this.box(DOOR_HALF * 2 + 0.44, 0.22, 0.1, frameMat, 0, DOOR_H + 0.11, SHAFT_Z - 0.09, g);
    // Floor sill plate
    const sill = this.box(DOOR_HALF * 2, 0.015, 0.3, std({ map: brassTex([3, 1]), metalness: 0.7, roughness: 0.35 }), 0, 0.008, SHAFT_Z - 0.12, g);
    sill.userData.decor = true;
    // The dial above the door
    this.buildDial(g, 0, DOOR_H + 0.5, SHAFT_Z - 0.15, Math.PI, 0.32);
    // Floor sign next to the door
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.7),
      std({ map: pixTex([FLOOR_LABELS[i], FLOOR_NAMES[i]], 256, 140, '#1e140c', '#e0b21b', '#b08a3a') }),
    );
    sign.position.set(-DOOR_HALF - 1.05, 2.3, SHAFT_Z - 0.07);
    sign.rotation.y = Math.PI;
    g.add(sign);
    // Call button with a lamp
    const plate = this.box(0.18, 0.32, 0.03, std({ map: brassTex([1, 1]), metalness: 0.7, roughness: 0.35 }), DOOR_HALF + 0.45, 1.2, SHAFT_Z - 0.075, g);
    plate.userData.decor = true;
    const mat = new THREE.MeshStandardMaterial({ color: '#f2e8c8', emissive: '#ffb030', emissiveIntensity: 0 });
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12), mat);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(DOOR_HALF + 0.45, 1.24, SHAFT_Z - 0.095);
    g.add(btn);
    this.callLamps[i] = { mat, on: false };
  }

  // ---------------------------------------------------------------- light

  private buildLobbyLights(): void {
    const spots: [number, number, number][] = [
      [0, -4.2, 12],
      [-3.8, -9.5, 7],
      [5.2, -4.8, 7],
    ];
    for (const [x, z, intensity] of spots) {
      const l = new THREE.PointLight('#fff1d6', intensity, 11, 1.5);
      l.position.set(x, 3.3, z);
      l.userData.base = intensity;
      this.scene.add(l);
      this.lobbyLights.push(l);
    }
  }

  /** Tints the lobby lights for the floor that is closest to the cabin. */
  lightFor(y: number, t: number): void {
    const i = THREE.MathUtils.clamp(Math.round(y / SPACING), 0, FLOORS - 1);
    const off = Math.abs(y - i * SPACING);
    const near = THREE.MathUtils.clamp(1 - (off - 1.2) / 2, 0.15, 1);
    const color = FLOOR_COLORS[i];
    this.lobbyLights.forEach((l, k) => {
      l.color.set(color);
      let f = near;
      // The basement tube is dying.
      if (i === 0 && k === 1) f *= (t % 5.1 > 4.6 && Math.sin(t * 50) > 0) ? 0.1 : 1;
      // The server farm is dim and blue, the roof is daylight.
      if (i === 4) f *= 0.6;
      if (i === 6) f *= 1.4;
      l.intensity = (l.userData.base as number) * f;
    });
  }
}

let stripeTex: THREE.CanvasTexture | null = null;
function hazardStripe(): THREE.CanvasTexture {
  if (stripeTex) return stripeTex;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 8;
  const g = c.getContext('2d')!;
  for (let x = 0; x < 32; x++) for (let y = 0; y < 8; y++) {
    g.fillStyle = (x + y) % 8 < 4 ? '#e0b21b' : '#1d1b17';
    g.fillRect(x, y, 1, 1);
  }
  stripeTex = new THREE.CanvasTexture(c);
  stripeTex.colorSpace = THREE.SRGBColorSpace;
  stripeTex.magFilter = THREE.NearestFilter;
  stripeTex.wrapS = THREE.RepeatWrapping;
  stripeTex.repeat.set(4, 1);
  return stripeTex;
}
