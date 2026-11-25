import * as THREE from 'three';
import { boxMaterials } from '../../details';
import { Item } from '../../items';
import { LevelKit } from '../../level';
import { mergeStatic } from './merge';
import { ceilingTex, concreteTex, corrugatedTex, ductTex, hazardTex, rackTex } from '../../textures';
import { aabb, blobGeometry, TextTexOpts, textTexture } from '../../util';
import { DONUT_DEF, KEYRING_DEF, LOGBOOK_DEF, MUG_DEF, PART_DEFS } from './items';
import * as GT from './texts';
import { blockWallTex, corkTex, factoryFloorTex, fenceTex, gratingTex, lineTex, linoTex, nightTex, panelTex, roofTex } from './textures';

/**
 * ROBOTICA Plant 9 at night: a dark robot factory hall with the security office in the
 * north-west corner, two frozen assembly lines, parts storage, the servo vault, a loading
 * dock, a break corner and the staff toilet in the far south-east corner.
 */

export const ROOM = { minX: -24, maxX: 24, minZ: -18, maxZ: 18 };
export const OFFICE = { minX: -24, maxX: -15, minZ: -18, maxZ: -11 };
/** Where the player sits at the monitor desk. */
export const SEAT = new THREE.Vector3(-19.5, 0, -15.55);
export const DOCK_AREA = { minX: -3, maxX: 10, minZ: 11.5, maxZ: 18 };
const H = 7;

export interface CamDef {
  id: number;
  name: string;
  pos: THREE.Vector3;
  look: THREE.Vector3;
  /** Floor spots in view where incidents can appear. */
  spots: THREE.Vector3[];
  door?: 'dock' | 'fire';
  /** Robot arms in view (indices into Factory.arms). */
  arms?: number[];
}

export interface Checkpoint {
  index: number;
  name: string;
  group: THREE.Group;
  led: THREE.MeshStandardMaterial;
  pos: THREE.Vector3;
  done: boolean;
}

/** A door that an incident can leave open. */
export interface IncidentDoor {
  name: 'dock' | 'fire';
  open: number;
  target: number;
  apply(v: number): void;
  mesh: THREE.Object3D;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const CAMS: CamDef[] = [
  { id: 1, name: 'SECURITY OFFICE', pos: v(-15.5, 2.75, -11.45), look: v(-19.6, 0.7, -16.2), spots: [v(-17.2, 0, -13.6)] },
  { id: 2, name: 'ASSEMBLY A WEST', pos: v(-13.6, 5, -8.6), look: v(-5, 0.3, -4.6), spots: [v(-8, 0, -3.1), v(-4, 0, -2.9), v(-9.5, 0, -8)], arms: [0, 1] },
  { id: 3, name: 'ASSEMBLY A EAST', pos: v(15.4, 5, -8.6), look: v(5.5, 0.3, -4.6), spots: [v(4, 0, -3), v(9, 0, -2.9), v(5.5, 0, -8.2)], arms: [2, 3] },
  { id: 4, name: 'ASSEMBLY B', pos: v(-13.6, 5, 6.4), look: v(-3, 0.3, 3), spots: [v(-6, 0, 1.3), v(0, 0, 1.2), v(-4, 0, 6.3)], arms: [4, 5, 6] },
  { id: 5, name: 'LOADING DOCK', pos: v(-5.5, 5, 9.2), look: v(4, 0.3, 15), spots: [v(1.5, 0, 14.6), v(4.5, 0, 13), v(9, 0, 15.2)], door: 'dock' },
  { id: 6, name: 'PARTS STORAGE', pos: v(15.4, 5, 9), look: v(21, 0.3, -1), spots: [v(20.6, 0, 2.5), v(20.6, 0, -5), v(18.6, 0, 6.5)] },
  { id: 7, name: 'SERVO VAULT', pos: v(15.6, 4.6, -10.6), look: v(20.5, 0.3, -15), spots: [v(19, 0, -15.2), v(22, 0, -13.2), v(18, 0, -12.3)] },
  { id: 8, name: 'BREAK AREA', pos: v(-13.6, 4.6, 8.6), look: v(-19.5, 0.3, 13.5), spots: [v(-17, 0, 10.8), v(-21, 0, 15.6), v(-16.2, 0, 15)] },
  { id: 9, name: 'TOILET CORRIDOR', pos: v(11, 4.6, 10.4), look: v(18, 0.3, 15), spots: [v(16, 0, 14.6), v(13.6, 0, 16.4), v(17, 0, 11.6)] },
  { id: 10, name: 'NORTH CATWALK', pos: v(-13.4, 5.6, -10.8), look: v(2, 2.2, -15.5), spots: [v(-2, 0, -14.2), v(4, 0, -15.2), v(-8, 0, -14)] },
  { id: 11, name: 'FIRE EXIT WEST', pos: v(-13.8, 4.6, 2.4), look: v(-23, 0.3, -0.4), spots: [v(-21.4, 0, -3), v(-20.4, 0, 2.6), v(-18, 0, -0.2)], door: 'fire' },
  { id: 12, name: 'CENTER AISLE', pos: v(21.4, 5, -1), look: v(2, 0.3, -1), spots: [v(10, 0, -0.6), v(0, 0, -1.6), v(-6, 0, -0.4)] },
];

const PX = '"Press Start 2P", monospace';

const matCache = new Map<string, THREE.MeshStandardMaterial>();
/** Standard materials, shared by parameters, so the static merge needs few draw calls. */
const std = (o: THREE.MeshStandardMaterialParameters) => {
  const key = JSON.stringify(o, (_k, val) => (val && (val as THREE.Texture).isTexture ? (val as THREE.Texture).uuid : val));
  let m = matCache.get(key);
  if (!m) matCache.set(key, (m = new THREE.MeshStandardMaterial({ roughness: 0.8, ...o })));
  return m;
};
const glow = (color: string, intensity = 1.5) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity });

/** Seeded random so the clutter is the same every night. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class Factory extends LevelKit {
  /** The 14 monitor screens. 0..11 are the cameras, 12 is static, 13 is the screensaver. */
  screens: THREE.Mesh[] = [];
  screenGroup = new THREE.Group();
  chair = new THREE.Group();
  checkpoints: Checkpoint[] = [];
  arms: THREE.Object3D[] = [];
  doors: IncidentDoor[] = [];
  /** Physical camera housings, for the LED blink. */
  camLeds: THREE.MeshStandardMaterial[] = [];
  /** All camera housings, hidden while the feeds render (a camera does not film itself). */
  camGroup = new THREE.Group();
  wallClock!: { tex: THREE.CanvasTexture; draw: (s: string) => void };
  radioMesh = new THREE.Group();
  vendingPos = new THREE.Vector3(-23.2, 0, 11);
  dripPos = new THREE.Vector3(2.5, 0, -1.1);
  beacon = new THREE.Group();
  private flicker: THREE.PointLight[] = [];
  private drop!: THREE.Mesh;
  private ripple!: THREE.Mesh;
  private officeLedMats: THREE.MeshStandardMaterial[] = [];

  constructor(scene: THREE.Scene) {
    super(scene);
    this.bounds = ROOM;
    this.ceiling = 6.5;
    this.spawn = { pos: new THREE.Vector3(-19.5, 0, -14.2), yaw: 0 };
    this.bossWaypoints.push(
      v(-10, 0, -1), v(0, 0, -1), v(10, 0, -1), v(18, 0, -1),
      v(-8, 0, -13), v(4, 0, -13), v(-19.5, 0, -9), v(-18, 0, 13),
      v(4, 0, 12), v(14, 0, 12), v(19, 0, -8), v(-20, 0, 0), v(-14, 0, -12.5),
    );
    this.lights();
    this.hall();
    this.office();
    this.assemblyLines();
    this.storage();
    this.vault();
    this.dock();
    this.breakArea();
    this.fireExit();
    this.catwalk();
    this.toilet();
    this.checkpointPlates();
    this.cameraHousings();
    this.clutter();
    this.posters();
    this.items();
    for (const o of [this.screenGroup, this.camGroup, this.chair, this.beacon, this.drop, this.ripple, this.radioMesh, this.doorPivot, ...this.arms]) o.userData.dynamic = true;
    mergeStatic(this.scene);
    this.onTick((t) => this.animate(t));
  }

  // ------------------------------------------------------------------ helpers

  private mesh(geo: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], x: number, y: number, z: number, parent: THREE.Object3D = this.scene): THREE.Mesh {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  }

  private pxSign(lines: string[], w: number, h: number, x: number, y: number, z: number, rotY: number, o: TextTexOpts = {}, text?: string): THREE.Mesh {
    return this.sign(lines, w, h, x, y, z, rotY, { font: PX, ...o }, text);
  }

  /** A sign that glows in the dark (exit signs, screens). */
  private glowSign(lines: string[], w: number, h: number, x: number, y: number, z: number, rotY: number, o: TextTexOpts): THREE.Mesh {
    const tw = 256;
    const th = Math.max(32, Math.round((tw * h) / w));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTexture(lines, { w: tw, h: th, font: PX, ...o }) }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    this.scene.add(m);
    return m;
  }

  /** A model from the manifest, with an optional color tint. */
  private model(key: string, x: number, y: number, z: number, rotY = 0, tint?: string, parent: THREE.Object3D = this.scene): THREE.Object3D | null {
    const o = this.prop(key, x, y, z, rotY, parent);
    if (o && tint) {
      const c = new THREE.Color(tint);
      o.traverse((n) => {
        const m = n as THREE.Mesh;
        if (!m.isMesh) return;
        const fix = (mt: THREE.Material) => {
          const cl = mt.clone() as THREE.MeshStandardMaterial;
          cl.color?.multiply(c);
          return cl;
        };
        m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material);
      });
    }
    return o;
  }

  private point(color: string, intensity: number, distance: number, x: number, y: number, z: number, decay = 1.6): THREE.PointLight {
    const l = new THREE.PointLight(color, intensity, distance, decay);
    l.position.set(x, y, z);
    this.scene.add(l);
    return l;
  }

  /** A hanging industrial lamp with a sodium bulb. */
  private lamp(x: number, z: number, light: boolean, color = '#ffb35a'): void {
    const dark = std({ color: '#2b2e31', metalness: 0.5 });
    this.mesh(new THREE.CylinderGeometry(0.01, 0.01, H - 5.2, 4), dark, x, (H + 5.2) / 2, z);
    const shade = this.mesh(new THREE.ConeGeometry(0.55, 0.4, 12, 1, true), std({ color: '#3d4247', metalness: 0.4, side: THREE.DoubleSide }), x, 5.15, z);
    shade.rotation.x = 0;
    this.mesh(new THREE.SphereGeometry(0.16, 10, 6), glow(light ? color : '#3a2a1a', light ? 2.2 : 0.1), x, 4.98, z);
    if (light) {
      const l = this.point(color, 30, 17, x, 4.7, z, 1.4);
      this.flicker.push(l);
    }
  }

  // ------------------------------------------------------------------ light

  private lights(): void {
    this.scene.background = new THREE.Color('#07080c');
    this.scene.add(new THREE.HemisphereLight('#41507a', '#1c140c', 1.0));
    const moon = new THREE.DirectionalLight('#6f86c0', 0.35);
    moon.position.set(-10, 14, 6);
    this.scene.add(moon);
    // Sodium lamps over the work areas. Many more are broken.
    for (const [x, z, on] of [
      [-6, -1, true], [8, -1, true], [4, 13, true], [19, -13, true],
      [-14, -1, false], [16, 0, false], [-6, 11, false], [0, -13, false], [12, -13, false],
    ] as [number, number, boolean][]) this.lamp(x, z, on);
  }

  // ------------------------------------------------------------------ the hall

  private hall(): void {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(48, 36, 48, 36), std({ map: factoryFloorTex([12, 9]), roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    // Painted walkway lines
    const line = std({ map: lineTex(), roughness: 0.9 });
    const stripe = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const m = this.mesh(new THREE.PlaneGeometry(0.12, len, 1, Math.ceil(len)), line, (x0 + x1) / 2, 0.006, (z0 + z1) / 2);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.atan2(x1 - x0, z1 - z0);
    };
    for (const z of [-3.2, 1.2]) stripe(-14, z, 22, z);
    for (const z of [-8, 6]) stripe(-14, z, 15, z);
    stripe(-14, -10.5, -14, 9);
    stripe(15, -9, 15, 9);

    // Roof with trusses and a few skylights showing the night
    const roof = this.mesh(new THREE.PlaneGeometry(48, 36, 12, 9), std({ map: roofTex([12, 9]) }), 0, H, 0);
    roof.rotation.x = Math.PI / 2;
    const truss = std({ color: '#3a3d40', metalness: 0.5 });
    for (const z of [-14, -7, 0, 7, 14]) {
      this.mesh(new THREE.BoxGeometry(48, 0.45, 0.25), truss, 0, H - 0.5, z);
      for (let x = -22; x <= 22; x += 4) {
        const d = this.mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), truss, x, H - 0.25, z);
        d.rotation.z = 0.6;
      }
    }
    const sky = new THREE.MeshBasicMaterial({ color: '#1a2744' });
    for (const [x, z] of [[-8, -10.5], [8, -10.5], [-8, 10.5], [8, 10.5], [0, 3.5]] as [number, number][]) {
      const s = this.mesh(new THREE.PlaneGeometry(3, 2.4), sky, x, H - 0.02, z);
      s.rotation.x = Math.PI / 2;
    }

    // Walls: block lower part, corrugated upper part. Gaps for the dock and the fire exit.
    const block = std({ map: blockWallTex([12, 1]) });
    const blockS = std({ map: blockWallTex([9, 1]) });
    const corr = std({ map: corrugatedTex([24, 3]) });
    const corrS = std({ map: corrugatedTex([18, 3]) });
    // north
    this.box(48.8, 2.4, 0.4, block, 0, 1.2, -18.2);
    this.box(48.8, H - 2.4, 0.4, corr, 0, 2.4 + (H - 2.4) / 2, -18.2);
    // south, with two roller door openings at x -2..2 and 5..9
    const segS: [number, number][] = [[-24.4, -2], [2, 5], [9, 24.4]];
    for (const [a, b] of segS) {
      this.box(b - a, 2.4, 0.4, block, (a + b) / 2, 1.2, 18.2);
      this.box(b - a, H - 2.4, 0.4, corr, (a + b) / 2, 2.4 + (H - 2.4) / 2, 18.2);
    }
    for (const [a, b] of [[-2, 2], [5, 9]] as [number, number][]) this.box(b - a, H - 4.5, 0.4, corr, (a + b) / 2, 4.5 + (H - 4.5) / 2, 18.2);
    // west, with the fire exit at z -1..1
    for (const [a, b] of [[-18, -1.1], [1.1, 18]] as [number, number][]) {
      this.box(0.4, 2.4, b - a, blockS, -24.2, 1.2, (a + b) / 2);
      this.box(0.4, H - 2.4, b - a, corrS, -24.2, 2.4 + (H - 2.4) / 2, (a + b) / 2);
    }
    this.box(0.4, H - 2.3, 2.2, corrS, -24.2, 2.3 + (H - 2.3) / 2, 0);
    // east
    this.box(0.4, 2.4, 36, blockS, 24.2, 1.2, 0);
    this.box(0.4, H - 2.4, 36, corrS, 24.2, 2.4 + (H - 2.4) / 2, 0);
    this.colliders.push(
      aabb(0, -18.2, 48.8, 0.4, H, false),
      aabb(0, 18.2, 48.8, 0.4, H, false),
      aabb(-24.2, 0, 0.4, 36, H, false),
      aabb(24.2, 0, 0.4, 36, H, false),
    );
    // A yellow safety band on the walls
    const band = std({ color: '#a8861f' });
    this.box(48, 0.2, 0.04, band, 0, 2.45, -17.98);
    this.box(0.04, 0.2, 36, band, 23.98, 2.45, 0);

    // Concrete pillars with hazard paint
    const pillar = std({ map: concreteTex([1, 7]) });
    const haz = std({ map: hazardTex([2, 1]) });
    for (const [x, z] of [[-12, -10], [-2, -10], [8, -10], [-12, 8.5], [-2, 8.5], [8, 8.5], [16, -1]] as [number, number][]) {
      this.mesh(new THREE.BoxGeometry(0.6, H, 0.6), pillar, x, H / 2, z);
      this.mesh(new THREE.BoxGeometry(0.64, 0.8, 0.64), haz, x, 0.4, z);
      this.solid(x, z, 0.64, 0.64, H, true, 'pillar');
    }

    // Pipes and ducts under the roof
    const duct = std({ map: ductTex([24, 1]), metalness: 0.3 });
    for (const z of [-9.5, 9.5]) {
      const d = this.mesh(new THREE.CylinderGeometry(0.32, 0.32, 48, 10), duct, 0, 6.1, z);
      d.rotation.z = Math.PI / 2;
    }
    const red = std({ color: '#7d2318' });
    const green = std({ color: '#2f5a37' });
    const p1 = this.mesh(new THREE.CylinderGeometry(0.07, 0.07, 48, 6), red, 0, 5.5, -1.1);
    p1.rotation.z = Math.PI / 2;
    const p2 = this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 36, 6), green, 22.5, 5.8, 0);
    p2.rotation.x = Math.PI / 2;
    // The dripping valve
    this.mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 8), std({ color: '#5a1a12', metalness: 0.5 }), 2.5, 5.5, -1.1).rotation.z = Math.PI / 2;
    this.mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 10), std({ color: '#b03020' }), 2.5, 5.72, -1.1);
    this.drop = this.mesh(new THREE.SphereGeometry(0.03, 6, 4), std({ color: '#8fb0c0', roughness: 0.1 }), 2.5, 5.4, -1.1);
    const bucket = std({ color: '#7d8b8f', metalness: 0.4 });
    this.mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.34, 10, 1, true), bucket, 2.5, 0.17, -1.1);
    const water = this.mesh(new THREE.CircleGeometry(0.19, 10), std({ color: '#3a4a52', roughness: 0.1 }), 2.5, 0.3, -1.1);
    water.rotation.x = -Math.PI / 2;
    this.ripple = this.mesh(new THREE.RingGeometry(0.03, 0.05, 12), new THREE.MeshBasicMaterial({ color: '#9fc3d6', transparent: true, opacity: 0.6 }), 2.5, 0.31, -1.1);
    this.ripple.rotation.x = -Math.PI / 2;
    const wetMat = new THREE.MeshBasicMaterial({ color: '#2c3438', transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    this.mesh(blobGeometry(0.7), wetMat, 2.6, 0.007, -1.0);
    this.solid(2.5, -1.1, 0.4, 0.4, 0.35, false, 'decor');
    this.sign(['BUCKET', 'full since 2066'], 0.5, 0.2, 2.5, 0.2, -0.89, 0, { bg: '#ffffff', fg: '#333333' }, 'A bucket under a dripping pipe. Facilities was notified in 2066. Facilities is a robot that only drips back.');
  }

  // ------------------------------------------------------------------ the security office

  private office(): void {
    const O = OFFICE;
    const lino = this.mesh(new THREE.PlaneGeometry(9, 7, 9, 7), std({ map: linoTex([5, 4]) }), -19.5, 0.006, -14.5);
    lino.rotation.x = -Math.PI / 2;
    const wall = std({ map: panelTex([6, 1]) });
    const wallS = std({ map: panelTex([4, 1]) });
    const WH = 3.0;
    // Office ceiling with one tube light
    this.mesh(new THREE.BoxGeometry(9.2, 0.12, 7.2), std({ map: ceilingTex([6, 5]) }), -19.5, WH + 0.06, -14.5);
    this.mesh(new THREE.BoxGeometry(0.25, 0.06, 1.6), glow('#e8f0ff', 1.6), -19.5, WH - 0.03, -13.8);
    const tube = this.point('#cfe0ff', 9, 9, -19.5, 2.7, -13.8);
    this.flicker.push(tube);
    tube.userData.dying = true;
    // Inner paneling on the hall walls
    this.box(9, WH, 0.04, wall, -19.5, WH / 2, -17.97);
    this.box(0.04, WH, 7, wallS, -23.97, WH / 2, -14.5);
    // East wall with a doorway at z -13.6..-12.2
    this.box(0.18, WH, 4.4, wallS, O.maxX, WH / 2, -15.8);
    this.box(0.18, WH, 1.2, wallS, O.maxX, WH / 2, -11.6);
    this.box(0.18, WH - 2.25, 1.4, wallS, O.maxX, 2.25 + (WH - 2.25) / 2, -12.9);
    this.solid(O.maxX, -15.8, 0.18, 4.4, WH, true, 'office');
    this.solid(O.maxX, -11.6, 0.18, 1.2, WH, true, 'office');
    // The door, swung open against the wall, with a sign
    this.box(0.06, 2.2, 1.3, std({ color: '#5a6a72', metalness: 0.4 }), -14.86, 1.1, -14.28);
    this.pxSign(['SECURITY', 'knock. we will not hear it'], 1.0, 0.4, -14.89, 2.45, -12.9, Math.PI / 2, { bg: '#1b2a3a', fg: '#e8d27a' });
    // South wall: low wall, window with blinds, top band
    this.box(7.4, 1.0, 0.18, wall, -19.5, 0.5, O.maxZ);
    this.box(0.8, WH, 0.18, wall, -23.6, WH / 2, O.maxZ);
    this.box(0.8, WH, 0.18, wall, -15.4, WH / 2, O.maxZ);
    this.box(7.4, WH - 2.4, 0.18, wall, -19.5, 2.4 + (WH - 2.4) / 2, O.maxZ);
    this.box(7.4, 0.06, 0.3, std({ color: '#4a3a28' }), -19.5, 1.03, O.maxZ);
    const glass = new THREE.MeshStandardMaterial({ color: '#9fc0d8', transparent: true, opacity: 0.12, roughness: 0.1, depthWrite: false });
    this.box(7.4, 1.4, 0.02, glass, -19.5, 1.7, O.maxZ);
    const slat = std({ color: '#c9c2a8' });
    for (let y = 2.36; y > 1.75; y -= 0.07) {
      const s = this.box(3.4, 0.012, 0.09, slat, -21.4, y, O.maxZ - 0.12);
      s.rotation.x = 0.5;
    }
    const bent = this.box(0.9, 0.012, 0.09, slat, -20.3, 1.8, O.maxZ - 0.12);
    bent.rotation.z = -0.3;
    this.solid(-19.5, O.maxZ, 9, 0.18, WH, false, 'officeWindow');
    // Signage outside
    this.pxSign(['SECURITY OFFICE', 'ROBOTICA PLANT 9'], 2.6, 0.6, -19.5, 2.7, O.maxZ + 0.1, 0, { bg: '#1d2a36', fg: '#f0b43c', border: '#f0b43c' });

    this.monitorWall();
    this.desk();
    this.officeFurniture();
  }

  private monitorWall(): void {
    // A steel rack with 12 CRTs, 4 columns x 3 rows
    const beige = std({ color: '#b5ab92', roughness: 0.6 });
    const dark = std({ color: '#2a2a2c', roughness: 0.5 });
    const rack = std({ color: '#3b3f44', metalness: 0.6 });
    const z = -17.6;
    for (const x of [-21.0, -18.0]) this.mesh(new THREE.BoxGeometry(0.06, 2.6, 0.5), rack, x, 1.3, z);
    for (const y of [0.97, 1.49, 2.01, 2.53]) this.mesh(new THREE.BoxGeometry(3.0, 0.04, 0.52), rack, -19.5, y - 0.02, z);
    const labels: string[] = [];
    for (let i = 0; i < 12; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = -20.52 + col * 0.68;
      const y = 2.25 - row * 0.52;
      // housing
      this.mesh(new THREE.BoxGeometry(0.64, 0.48, 0.44), [beige, beige, beige, beige, dark, beige], x, y, z);
      this.mesh(new THREE.BoxGeometry(0.46, 0.36, 0.1), beige, x, y, z - 0.25);
      const scr = this.mesh(new THREE.PlaneGeometry(0.52, 0.38), new THREE.MeshBasicMaterial({ color: '#0a1a10' }), x, y + 0.01, z + 0.223, this.screenGroup);
      scr.userData.interact = { kind: 'guardMonitor', index: i };
      this.interactables.push(scr);
      this.screens.push(scr);
      // a little LED and a label strip
      this.mesh(new THREE.BoxGeometry(0.025, 0.025, 0.01), glow('#3bff6a', 1.2), x + 0.27, y - 0.21, z + 0.225);
      labels.push(String(i + 1).padStart(2, '0'));
    }
    for (let i = 0; i < 12; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = -20.52 + col * 0.68;
      const y = 2.25 - row * 0.52;
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshBasicMaterial({ map: textTexture([`CAM ${labels[i]}`], { w: 128, h: 32, bg: '#d9d0b0', fg: '#1a1a1a', font: PX }) }));
      lab.position.set(x - 0.18, y - 0.215, z + 0.226);
      this.scene.add(lab);
    }
    this.scene.add(this.screenGroup);
    this.solid(-19.5, z, 3.1, 0.5, 2.6, true, 'monitors');
    // The monitor glow lights up the office a little
    this.point('#7fb8ff', 5, 5, -19.5, 1.6, -16.6);
    // Cable spaghetti
    const cable = std({ color: '#111111' });
    for (let i = 0; i < 9; i++) {
      const c = this.mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.2 + (i % 3) * 0.4, 4), cable, -21.0 + i * 0.36, 0.5, -17.9);
      c.rotation.z = ((i % 5) - 2) * 0.15;
    }
    this.pxSign(['CCTV', 'all cameras live', '(except 13 and 14)'], 1.2, 0.36, -19.5, 2.8, -17.9, 0, { bg: '#1a1a1a', fg: '#7cff9a' });
  }

  private desk(): void {
    const wood = std({ color: '#6e5236' });
    const top = std({ color: '#8a6a45', roughness: 0.5 });
    const steel = std({ color: '#5d6166', metalness: 0.5 });
    const T = 0.78;
    this.box(3.6, 0.04, 0.9, top, -19.5, T - 0.02, -16.65);
    this.box(0.5, T - 0.04, 0.84, wood, -21.0, (T - 0.04) / 2, -16.65);
    this.box(0.5, T - 0.04, 0.84, wood, -18.0, (T - 0.04) / 2, -16.65);
    this.box(2.5, 0.5, 0.04, wood, -19.5, 0.5, -17.05);
    for (const x of [-21.0, -18.0]) for (const y of [0.18, 0.42, 0.64]) this.box(0.44, 0.18, 0.02, std({ color: '#5a4230' }), x, y, -16.2);
    for (const x of [-21.0, -18.0]) for (const y of [0.18, 0.42, 0.64]) this.box(0.1, 0.02, 0.03, steel, x, y + 0.03, -16.18);
    this.solid(-19.5, -16.65, 3.6, 0.9, T, true, 'desk');

    // Two small CRTs on the desk (13: dead, 14: screensaver)
    const beige = std({ color: '#c4b99c' });
    for (const [i, x] of [[12, -21.0], [13, -18.0]] as [number, number][]) {
      const g = new THREE.Group();
      g.position.set(x, T, -16.85);
      g.rotation.y = x < -19.5 ? 0.35 : -0.35;
      this.mesh(new THREE.BoxGeometry(0.42, 0.34, 0.36), beige, 0, 0.19, 0, g);
      this.mesh(new THREE.BoxGeometry(0.3, 0.24, 0.12), beige, 0, 0.19, -0.22, g);
      const scr = this.mesh(new THREE.PlaneGeometry(0.34, 0.26), new THREE.MeshBasicMaterial({ color: '#111' }), 0, 0.2, 0.181, g);
      scr.userData.interact = { kind: 'guardMonitor', index: i };
      this.interactables.push(scr);
      this.screens.push(scr);
      this.mesh(new THREE.BoxGeometry(0.2, 0.02, 0.2), beige, 0, 0.01, 0, g);
      this.screenGroup.add(g);
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.04), new THREE.MeshBasicMaterial({ map: textTexture([`CAM ${i + 1}`], { w: 128, h: 32, bg: '#d9d0b0', fg: '#1a1a1a', font: PX }) }));
      lab.position.set(0, 0.045, 0.182);
      g.add(lab);
    }

    // Keyboard, phone, radio, lamp, sticky notes
    if (!this.model('guardKeyboard', -19.5, T, -16.55)) this.box(0.45, 0.03, 0.16, std({ color: '#d8d0b8' }), -19.5, T + 0.015, -16.55);
    const phone = new THREE.Group();
    phone.position.set(-18.4, T, -16.45);
    phone.rotation.y = -0.3;
    this.mesh(new THREE.BoxGeometry(0.2, 0.06, 0.18), std({ color: '#8b1e1e', roughness: 0.4 }), 0, 0.03, 0, phone);
    this.mesh(new THREE.BoxGeometry(0.22, 0.05, 0.06), std({ color: '#8b1e1e', roughness: 0.4 }), 0, 0.085, -0.03, phone);
    this.mesh(new THREE.BoxGeometry(0.1, 0.01, 0.07), std({ color: '#ddd' }), 0, 0.062, 0.04, phone);
    phone.userData.interact = { kind: 'guardPhone' };
    this.interactables.push(phone);
    this.scene.add(phone);

    this.radioMesh.position.set(-20.55, T, -16.5);
    this.radioMesh.rotation.y = 0.25;
    if (!this.model('guardRadio', 0, 0, 0, 0, undefined, this.radioMesh)) {
      this.mesh(new THREE.BoxGeometry(0.32, 0.2, 0.12), std({ color: '#3a2a1c' }), 0, 0.1, 0, this.radioMesh);
    }
    const ant = this.mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.4, 4), steel, 0.12, 0.35, 0, this.radioMesh);
    ant.rotation.z = -0.4;
    this.radioMesh.userData.interact = { kind: 'guardRadio' };
    this.interactables.push(this.radioMesh);
    this.scene.add(this.radioMesh);

    const lampG = new THREE.Group();
    lampG.position.set(-21.1, T, -16.35);
    this.mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.03, 10), std({ color: '#2a4a2a', metalness: 0.4 }), 0, 0.015, 0, lampG);
    const arm = this.mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 5), std({ color: '#b8a040', metalness: 0.6 }), 0, 0.18, 0, lampG);
    arm.rotation.x = 0.2;
    const shade = this.mesh(new THREE.CylinderGeometry(0.05, 0.12, 0.1, 10, 1, true), std({ color: '#2a5a32', side: THREE.DoubleSide }), 0, 0.36, 0.05, lampG);
    shade.rotation.x = 0.4;
    this.mesh(new THREE.SphereGeometry(0.035, 6, 4), glow('#ffd890', 2), 0, 0.33, 0.07, lampG);
    this.scene.add(lampG);
    this.point('#ffcf80', 7, 4.5, -21.0, 1.25, -16.1);

    const note = (x: number, z: number, c: string, rot: number) => {
      const n = this.mesh(new THREE.PlaneGeometry(0.08, 0.08), std({ color: c }), x, T + 0.002, z);
      n.rotation.x = -Math.PI / 2;
      n.rotation.z = rot;
    };
    note(-19.0, -16.25, '#f4eaa0', 0.2);
    note(-18.8, -16.3, '#f7c6d0', -0.4);
    note(-20.25, -16.25, '#bfe3f0', 0.1);
    // A donut box (the donut is an item)
    const dbox = std({ color: '#f2e4c4' });
    this.box(0.34, 0.06, 0.3, dbox, -17.95, T + 0.03, -16.45);
    const lid = this.box(0.34, 0.01, 0.3, std({ map: textTexture(['DONUTS', 'for display'], { w: 128, h: 96, bg: '#f2e4c4', fg: '#c0392b' }) }), -17.95, T + 0.2, -16.62);
    lid.rotation.x = -1.2;
    // Paper stacks
    for (let i = 0; i < 4; i++) this.box(0.22, 0.012, 0.3, std({ color: i % 2 ? '#e8e2d0' : '#d9d2bd' }), -20.3 + i * 0.01, T + 0.006 + i * 0.012, -16.9);

    // The swivel chair
    const c = this.chair;
    c.position.copy(SEAT).setY(0);
    const black = std({ color: '#1f1f22', roughness: 0.5 });
    const fabric = std({ color: '#2c3e63', roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leg = this.mesh(new THREE.BoxGeometry(0.05, 0.04, 0.34), black, Math.sin(a) * 0.17, 0.06, Math.cos(a) * 0.17, c);
      leg.rotation.y = a;
      this.mesh(new THREE.SphereGeometry(0.03, 6, 4), black, Math.sin(a) * 0.33, 0.03, Math.cos(a) * 0.33, c);
    }
    this.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), steel, 0, 0.28, 0, c);
    this.mesh(new THREE.BoxGeometry(0.5, 0.09, 0.48), fabric, 0, 0.5, 0, c);
    const back = this.mesh(new THREE.BoxGeometry(0.46, 0.56, 0.07), fabric, 0, 0.86, 0.24, c);
    back.rotation.x = -0.12;
    for (const s of [-1, 1]) {
      this.mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), black, s * 0.26, 0.62, 0.02, c);
      this.mesh(new THREE.BoxGeometry(0.06, 0.03, 0.3), black, s * 0.26, 0.73, 0.02, c);
    }
    // duct tape on the seat
    this.mesh(new THREE.BoxGeometry(0.06, 0.005, 0.3), std({ color: '#9a9a9a' }), 0.1, 0.548, 0.02, c);
    c.userData.interact = { kind: 'guardChair' };
    this.interactables.push(c);
    this.scene.add(c);
  }

  private officeFurniture(): void {
    const steel = std({ color: '#5a6470', metalness: 0.5 });
    // Lockers on the west wall
    const lockerFront = std({ color: '#4c5a6a', metalness: 0.4 });
    for (let i = 0; i < 4; i++) {
      const z = -17.4 + i * 0.52;
      this.box(0.5, 1.9, 0.5, lockerFront, -23.7, 0.95, z);
      for (let k = 0; k < 4; k++) this.box(0.01, 0.02, 0.3, std({ color: '#222' }), -23.44, 1.6 + k * 0.05, z);
      this.box(0.01, 0.08, 0.03, steel, -23.44, 1.0, z + 0.17);
    }
    this.pxSign(['GUARD', 'LOCKERS'], 0.8, 0.3, -23.43, 2.15, -16.6, Math.PI / 2, { bg: '#d9d0b0', fg: '#333' });
    this.solid(-23.7, -16.6, 0.5, 2.1, 1.9, true, 'lockers');
    // A bookcase of empty incident binders
    if (this.model('guardBookcase', -22.4, 0, -17.7)) this.solid(-22.4, -17.7, 0.9, 0.5, 1.9, true, 'decor');
    const binders = ['#c0392b', '#2471a3', '#27ae60', '#f39c12', '#8e44ad'];
    for (let i = 0; i < 10; i++) this.box(0.06, 0.3, 0.24, std({ color: binders[i % 5] }), -22.75 + i * 0.07, 2.17, -17.82);
    this.box(0.9, 0.03, 0.3, std({ color: '#5a4230' }), -22.4, 2.0, -17.82);
    this.pxSign(['INCIDENTS', '2060-2071', '(all empty)'], 0.7, 0.3, -22.4, 2.55, -17.93, 0, { bg: '#f2ead2', fg: '#7a1f14' });
    // Small fridge and water cooler on the east side
    if (this.model('guardFridge', -16.0, 0, -17.6)) this.solid(-16.0, -17.6, 0.7, 0.5, 0.9, true, 'decor');
    this.pxSign(['MY LUNCH', 'not yours', 'not brads'], 0.4, 0.25, -16.0, 0.6, -17.27, 0, { bg: '#ffffff', fg: '#c0392b' });
    const cooler = new THREE.Group();
    cooler.position.set(-15.55, 0, -16.4);
    this.mesh(new THREE.BoxGeometry(0.34, 0.95, 0.34), std({ color: '#d8d8d0' }), 0, 0.475, 0, cooler);
    this.mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 10), new THREE.MeshStandardMaterial({ color: '#6fb0e0', transparent: true, opacity: 0.6, roughness: 0.1 }), 0, 1.16, 0, cooler);
    this.scene.add(cooler);
    this.solid(-15.55, -16.4, 0.4, 0.4, 1.4, false, 'decor');
    // Coat rack with the guard hat
    if (this.model('guardCoatRack', -23.4, 0, -12.6)) {
      const hat = new THREE.Group();
      hat.position.set(-23.38, 1.83, -12.55);
      this.mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.09, 12), std({ color: '#1b2540' }), 0, 0, 0, hat);
      this.mesh(new THREE.BoxGeometry(0.2, 0.012, 0.12), std({ color: '#111' }), 0, -0.04, 0.1, hat);
      this.mesh(new THREE.BoxGeometry(0.06, 0.05, 0.01), std({ color: '#d4a62a', metalness: 0.8 }), 0, 0.01, 0.125, hat);
      this.scene.add(hat);
      this.solid(-23.4, -12.6, 0.4, 0.4, 1.8, false, 'decor');
    }
    // Cork board, calendar, clock
    this.mesh(new THREE.PlaneGeometry(1.2, 0.9), std({ map: corkTex() }), -23.94, 1.7, -14.6).rotation.y = Math.PI / 2;
    this.pxSign(['GUARD TOUR', '6 checkpoints', 'every round', 'scan with E', 'use the flashlight (F)'], 0.7, 0.55, -23.92, 1.6, -13.4, Math.PI / 2, { bg: '#fdf6e3', fg: '#2c3e50', border: '#c0392b' }, 'Guard tour schedule. Six checkpoints spread through the plant. Find them in the dark and scan them. Flashlight on F.');
    this.pxSign(['MARCH 2069', 'nobody changed it'], 0.5, 0.55, -16.0, 1.8, -17.94, 0, { bg: '#ffffff', fg: '#333333', border: '#c0392b' });
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 48;
    const g = c.getContext('2d')!;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    let last = '';
    const draw = (s: string) => {
      if (s === last) return;
      last = s;
      g.fillStyle = '#100604';
      g.fillRect(0, 0, 128, 48);
      g.fillStyle = '#ff3a20';
      g.font = `20px ${PX}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(s, 64, 26);
      tex.needsUpdate = true;
    };
    draw('22:00');
    this.wallClock = { tex, draw };
    this.box(0.6, 0.24, 0.06, std({ color: '#222' }), -19.5, 2.85, -17.4);
    const clk = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.2), new THREE.MeshBasicMaterial({ map: tex }));
    clk.position.set(-19.5, 2.85, -17.36);
    this.scene.add(clk);
    // The keyring board by the door
    this.box(0.04, 0.9, 0.7, std({ color: '#6e5236' }), -15.12, 1.45, -14.65);
    this.pxSign(['KEYS', 'all 300 of them'], 0.6, 0.2, -15.15, 2.05, -14.65, -Math.PI / 2, { bg: '#f2ead2', fg: '#7a1f14' });
    for (let i = 0; i < 6; i++) this.box(0.03, 0.03, 0.03, std({ color: '#c9a441', metalness: 0.7 }), -15.16, 1.2 + (i % 2) * 0.25, -14.9 + Math.floor(i / 2) * 0.22);
    // Bin with paper
    if (this.model('guardTrash', -17.3, 0, -16.0)) this.solid(-17.3, -16.0, 0.4, 0.4, 0.5, false, 'decor');
    for (let i = 0; i < 3; i++) this.mesh(new THREE.IcosahedronGeometry(0.05, 0), std({ color: '#e8e2d0' }), -17.0 + i * 0.12, 0.05, -15.7 + (i % 2) * 0.1);
    // A desk fan and a TV on the lockers... no, a space heater
    const heater = new THREE.Group();
    heater.position.set(-22.6, 0, -15.6);
    this.mesh(new THREE.BoxGeometry(0.5, 0.4, 0.2), std({ color: '#7a7a72', metalness: 0.4 }), 0, 0.25, 0, heater);
    for (let i = 0; i < 4; i++) this.mesh(new THREE.BoxGeometry(0.4, 0.02, 0.01), glow('#ff5a20', 1.4), 0, 0.15 + i * 0.07, 0.105, heater);
    this.scene.add(heater);
    this.solid(-22.6, -15.6, 0.5, 0.3, 0.45, false, 'decor');
    this.pxSign(['IF YOU CAN READ THIS', 'you are not', 'at your monitors'], 1.6, 0.5, -19.5, 2.68, -11.12, Math.PI, { bg: '#fdf6e3', fg: '#2c3e50', border: '#c0392b' });
    // Brad's charging dock just outside
    this.box(0.9, 0.12, 0.9, std({ color: '#2c3036', metalness: 0.5 }), -13.6, 0.06, -16.6);
    this.mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 20), glow('#3a9bff', 1.5), -13.6, 0.13, -16.6).rotation.x = Math.PI / 2;
    this.pxSign(['BRAD CHARGING DOCK', 'power saving mode', 'do not sit'], 1.3, 0.5, -13.6, 1.7, -17.95, 0, { bg: '#1b2a3a', fg: '#7cc4ff' }, 'Brad\'s charging dock. It is empty. Brad is "in power saving mode" somewhere else. Watching.');
  }

  // ------------------------------------------------------------------ assembly lines

  private conveyor(x0: number, x1: number, z: number): void {
    const len = x1 - x0;
    const cx = (x0 + x1) / 2;
    const frame = std({ color: '#3a3f45', metalness: 0.5 });
    const yellow = std({ color: '#b8901e' });
    const belt = std({ color: '#222226', roughness: 0.9 });
    this.mesh(new THREE.BoxGeometry(len, 0.08, 1.0), belt, cx, 0.78, z);
    for (const s of [-1, 1]) {
      this.mesh(new THREE.BoxGeometry(len, 0.18, 0.08), yellow, cx, 0.78, z + s * 0.54);
      for (let x = x0 + 0.3; x < x1; x += 1.6) this.mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), frame, x, 0.35, z + s * 0.46);
    }
    for (let x = x0 + 0.2; x < x1; x += 0.5) {
      const r = this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.98, 6), frame, x, 0.7, z);
      r.rotation.x = Math.PI / 2;
    }
    this.solid(cx, z, len, 1.16, 0.84, false, 'conveyor');
  }

  /** A half-finished robot frozen on the belt. */
  private torso(x: number, z: number, variant: number): void {
    const grey = std({ color: ['#8a9299', '#a0937c', '#6f7a84'][variant % 3], metalness: 0.5, roughness: 0.45 });
    const dark = std({ color: '#1d2024' });
    this.mesh(new THREE.BoxGeometry(0.45, 0.5, 0.32), grey, x, 1.07, z);
    this.mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.12, 8), dark, x, 0.88, z);
    if (variant % 2 === 0) {
      this.mesh(new THREE.BoxGeometry(0.34, 0.26, 0.26), grey, x, 1.48, z);
      this.mesh(new THREE.PlaneGeometry(0.26, 0.16), dark, x, 1.48, z + 0.131);
    } else {
      this.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 5), std({ color: '#c0392b' }), x, 1.4, z);
      for (let i = 0; i < 3; i++) this.mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.25, 3), std({ color: ['#c0392b', '#2471a3', '#f1c40f'][i] }), x - 0.05 + i * 0.05, 1.42, z + 0.02).rotation.z = (i - 1) * 0.5;
    }
    if (variant % 3 !== 1) {
      const arm = this.mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), grey, x + 0.3, 1.05, z);
      arm.rotation.z = variant % 3 === 0 ? 0.9 : -0.2;
    }
  }

  private robotArm(key: string, x: number, z: number, rotY: number): void {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    this.mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.12, 12), std({ map: hazardTex([4, 1]) }), 0, 0.06, 0, g);
    if (!this.model(key, 0, 0.1, 0, rotY, '#e8d8b8', g)) {
      const orange = std({ color: '#c46a1d', metalness: 0.3 });
      this.mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.5, 10), orange, 0, 0.35, 0, g);
      const a1 = this.mesh(new THREE.BoxGeometry(0.2, 1.4, 0.2), orange, 0.2, 1.2, 0, g);
      a1.rotation.z = -0.3;
      const a2 = this.mesh(new THREE.BoxGeometry(0.16, 1.0, 0.16), orange, 0.7, 2.0, 0, g);
      a2.rotation.z = -1.2;
    }
    this.scene.add(g);
    this.arms.push(g);
    this.solid(x, z, 0.9, 0.9, 2.4, false, 'arm');
  }

  private assemblyLines(): void {
    this.conveyor(-10, 12, -5);
    this.conveyor(-10, 12, 3);
    let k = 0;
    for (let x = -8.5; x < 11.5; x += 2.2) this.torso(x, -5, k++);
    for (let x = -7.4; x < 11.5; x += 2.6) this.torso(x, 3, k++);
    // Arms frozen mid-move (indices 0..3 line A, 4..6 line B)
    this.robotArm('guardArmA', -7, -6.5, 0.6);
    this.robotArm('guardArmB', -2, -6.5, -1.2);
    this.robotArm('guardArmA', 3, -6.5, 2.2);
    this.robotArm('guardArmB', 8, -6.5, 0.2);
    this.robotArm('guardArmB', -6, 4.5, 2.6);
    this.robotArm('guardArmA', -1, 4.5, -0.6);
    this.robotArm('guardArmA', 4, 4.5, 1.4);
    this.robotArm('guardArmB', 9, 4.5, -2.2);
    // Machines at the ends of the lines
    for (const z of [-5, 3]) {
      if (this.model('guardMachine', -11.4, 0, z, Math.PI / 2, '#d8c8a8')) this.solid(-11.4, z, 1.6, 1.3, 1.6, true, 'machine');
      else {
        this.box(1.4, 1.6, 1.3, std({ color: '#4a5560', metalness: 0.4 }), -11.4, 0.8, z);
        this.solid(-11.4, z, 1.4, 1.3, 1.6, true, 'machine');
      }
      if (this.model('guardMachineWin', 13.4, 0, z, -Math.PI / 2, '#d8c8a8')) this.solid(13.4, z, 1.6, 1.3, 1.6, true, 'machine');
      else {
        this.box(1.4, 1.6, 1.3, std({ color: '#4a5560', metalness: 0.4 }), 13.4, 0.8, z);
        this.solid(13.4, z, 1.4, 1.3, 1.6, true, 'machine');
      }
      this.model('guardHopper', -12.9, 0, z, 0, '#d8c8a8');
      this.solid(-12.9, z, 1.1, 1.1, 2.2, true, 'machine');
      // Status panel glowing on each machine
      this.glowSign(['LINE PAUSED', 'since 21:59'], 0.7, 0.24, -10.55, 1.25, z + 0.67, 0, { bg: '#08140a', fg: '#7cff9a' });
    }
    this.pxSign(['ASSEMBLY LINE A', 'robots building robots'], 3, 0.6, 1, 3.2, -5, 0, { bg: '#1d2a36', fg: '#f0b43c', border: '#f0b43c' });
    this.pxSign(['ASSEMBLY LINE B', 'quality control: vibes'], 3, 0.6, 1, 3.2, 3, Math.PI, { bg: '#1d2a36', fg: '#f0b43c', border: '#f0b43c' });
    // Sign chains
    const chain = std({ color: '#2a2a2a', metalness: 0.6 });
    for (const z of [-5, 3]) for (const x of [-0.4, 2.4]) this.mesh(new THREE.CylinderGeometry(0.01, 0.01, H - 3.5, 4), chain, x, 3.5 + (H - 3.5) / 2, z);
    // A gantry crane over line B
    if (this.model('guardCrane', 6.5, 0, 6.8, Math.PI, '#e0d0b0')) this.solid(6.5, 6.8, 1.9, 1.2, 3.5, false, 'crane');
    // Cogs on a work bench
    const bench = std({ color: '#6b5a44' });
    this.box(2.2, 0.06, 0.8, bench, -6, 0.9, -9);
    for (const x of [-7, -5]) this.box(0.06, 0.88, 0.7, std({ color: '#3a3f45' }), x, 0.44, -9);
    this.solid(-6, -9, 2.2, 0.8, 0.93, true, 'bench');
    for (let i = 0; i < 3; i++) {
      this.model('guardCog', -6.6 + i * 0.5, 0.93, -9.1, i);
    }
    this.box(0.5, 0.3, 0.3, std({ color: '#b03a2e' }), -5.2, 1.08, -9.15);
    this.pxSign(['TOOLS', 'return them. robots count.'], 0.9, 0.3, -6, 1.5, -9.38, 0, { bg: '#f2ead2', fg: '#333' });
  }

  // ------------------------------------------------------------------ storage and vault

  private storage(): void {
    const rack = std({ map: rackTex([1, 4]) });
    const beam = std({ map: rackTex([8, 1]) });
    const r = rng(91);
    const x = 22.9;
    const z0 = -9.5;
    const z1 = 7;
    for (let z = z0; z <= z1 + 0.01; z += (z1 - z0) / 5) {
      this.mesh(new THREE.BoxGeometry(0.08, 3.4, 0.08), rack, x - 0.5, 1.7, z);
      this.mesh(new THREE.BoxGeometry(0.08, 3.4, 0.08), rack, x + 0.5, 1.7, z);
    }
    for (const y of [0.15, 1.2, 2.25, 3.3]) {
      for (const dx of [-0.5, 0.5]) this.mesh(new THREE.BoxGeometry(0.06, 0.1, z1 - z0), beam, x + dx, y, (z0 + z1) / 2);
      this.mesh(new THREE.BoxGeometry(1.0, 0.02, z1 - z0), std({ color: '#4a4540' }), x, y + 0.06, (z0 + z1) / 2);
      if (y > 3) continue;
      let z = z0 + 0.3;
      while (z < z1 - 0.4) {
        const bw = 0.45 + r() * 0.4;
        const bh = 0.35 + r() * 0.4;
        if (r() > 0.15) {
          const b = this.mesh(new THREE.BoxGeometry(0.8, bh, bw), boxMaterials(Math.floor(r() * 7)), x, y + 0.07 + bh / 2, z + bw / 2);
          b.rotation.y = (r() - 0.5) * 0.1;
        } else if (r() > 0.5) {
          // a bin of robot heads
          this.mesh(new THREE.BoxGeometry(0.8, 0.3, 0.6), std({ color: '#3d5a7a' }), x, y + 0.22, z + 0.3);
          for (let i = 0; i < 3; i++) this.mesh(new THREE.BoxGeometry(0.2, 0.16, 0.16), std({ color: '#9aa3ab', metalness: 0.5 }), x - 0.2 + i * 0.2, y + 0.42, z + 0.3);
        }
        z += bw + 0.08;
      }
    }
    this.solid(x, (z0 + z1) / 2, 1.1, z1 - z0 + 0.2, 3.4, true, 'rack');
    this.pxSign(['PARTS STORAGE', 'take a number. not a part.'], 2.4, 0.5, 23.97, 4.0, -1, -Math.PI / 2, { bg: '#1d2a36', fg: '#f0b43c', border: '#f0b43c' });
    // Pallets of boxes in front
    this.pile(19.6, -7.2, 1.2, 1.2, 3, 41);
    this.pile(19.4, 4.6, 1.2, 1.6, 2, 42);
  }

  private vault(): void {
    const fence = new THREE.MeshStandardMaterial({ map: fenceTex([10, 4]), transparent: true, side: THREE.DoubleSide, roughness: 0.6, depthWrite: false });
    const fenceS = new THREE.MeshStandardMaterial({ map: fenceTex([5, 4]), transparent: true, side: THREE.DoubleSide, roughness: 0.6, depthWrite: false });
    const post = std({ color: '#7d8287', metalness: 0.6 });
    // west fence x = 16, z -18..-11
    this.mesh(new THREE.PlaneGeometry(7, 3), fence, 16, 1.5, -14.5).rotation.y = Math.PI / 2;
    this.solid(16, -14.5, 0.1, 7, 3, false, 'fence');
    // south fence z = -11 with an open gate at x 19..20.4
    this.mesh(new THREE.PlaneGeometry(3, 3), fenceS, 17.5, 1.5, -11);
    this.mesh(new THREE.PlaneGeometry(3.6, 3), fenceS, 22.2, 1.5, -11);
    this.solid(17.5, -11, 3, 0.1, 3, false, 'fence');
    this.solid(22.2, -11, 3.6, 0.1, 3, false, 'fence');
    for (const [x, z] of [[16, -11], [16, -14.5], [19, -11], [20.4, -11], [24, -11]] as [number, number][]) this.mesh(new THREE.BoxGeometry(0.08, 3, 0.08), post, x, 1.5, z);
    this.mesh(new THREE.BoxGeometry(8, 0.06, 0.06), post, 20, 3, -11);
    const gate = this.mesh(new THREE.PlaneGeometry(1.4, 2.4), fenceS, 19.1, 1.2, -10.4);
    gate.rotation.y = 1.2;
    this.pxSign(['SERVO VAULT', 'authorized robots only', 'door open since 2063'], 2.2, 0.7, 21.5, 2.5, -10.95, 0, { bg: '#7a1f14', fg: '#ffe2b8', border: '#ffe2b8' }, 'SERVO VAULT. Authorized robots only. The door has been open since 2063. The key is inside the vault.');
    // Inside: crates of gold servos and a shelf
    const gold = std({ color: '#b8901e', metalness: 0.7, roughness: 0.3 });
    const r = rng(77);
    for (let i = 0; i < 4; i++) {
      const cx = 17.2 + i * 1.6;
      this.box(1.2, 0.8, 0.9, boxMaterials(Math.floor(r() * 7)), cx, 0.4, -17.2);
      this.pxSign(['GOLD SERVOS', 'x 500'], 0.8, 0.3, cx, 0.55, -16.74, 0, { bg: '#f2ead2', fg: '#7a4a10' });
      for (let k = 0; k < 3; k++) this.box(0.15, 0.1, 0.08, gold, cx - 0.3 + k * 0.3, 0.85, -17.2);
    }
    this.solid(20, -17.2, 6.4, 0.9, 0.9, true, 'crates');
    const shelf = std({ color: '#3b3f44', metalness: 0.5 });
    this.box(0.5, 1.6, 3, shelf, 23.6, 0.8, -14.2);
    for (const y of [0.5, 1.0, 1.5]) this.box(0.52, 0.04, 3.0, std({ color: '#5d6166' }), 23.6, y, -14.2);
    this.solid(23.6, -14.2, 0.6, 3, 1.6, true, 'vaultShelf');
    // A pallet of robot heads
    this.box(1.2, 0.14, 1.0, std({ color: '#8a6a43' }), 18.3, 0.07, -13.6);
    for (let i = 0; i < 6; i++) {
      const hx = 17.9 + (i % 3) * 0.38;
      const hz = -13.85 + Math.floor(i / 3) * 0.45;
      this.box(0.32, 0.26, 0.3, std({ color: '#9aa3ab', metalness: 0.5 }), hx, 0.27, hz);
      this.mesh(new THREE.PlaneGeometry(0.24, 0.12), std({ color: '#0a1a20' }), hx, 0.29, hz + 0.152);
    }
    this.solid(18.3, -13.6, 1.2, 1.0, 0.4, false, 'heads');
  }

  /** A pile of cardboard boxes with a collider. */
  private pile(cx: number, cz: number, w: number, d: number, maxLevels: number, seed: number): void {
    const pr = rng(seed);
    const cols = Math.max(1, Math.round(w / 0.62));
    const rows = Math.max(1, Math.round(d / 0.62));
    let top = 0;
    this.box(w + 0.1, 0.14, d + 0.1, std({ color: '#7a5c3a' }), cx, 0.07, cz);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const levels = 1 + Math.floor(pr() * maxLevels);
        let y = 0.14;
        for (let k = 0; k < levels; k++) {
          const bw = 0.45 + pr() * 0.15;
          const bh = 0.32 + pr() * 0.22;
          const bd = 0.45 + pr() * 0.15;
          const b = this.mesh(new THREE.BoxGeometry(bw, bh, bd), boxMaterials(Math.floor(pr() * 7)), cx - w / 2 + (i + 0.5) * (w / cols), y + bh / 2, cz - d / 2 + (j + 0.5) * (d / rows));
          b.rotation.y = (pr() - 0.5) * 0.35;
          y += bh;
        }
        top = Math.max(top, y);
      }
    }
    this.solid(cx, cz, w + 0.1, d + 0.1, top, true, 'boxes');
  }

  // ------------------------------------------------------------------ loading dock

  private rollerDoor(cx: number, name: 'dock' | null): void {
    const corr = std({ map: corrugatedTex([4, 4]), color: '#c8c0a8' });
    const g = new THREE.Group();
    g.position.set(cx, 0, 17.92);
    const panel = this.mesh(new THREE.BoxGeometry(4, 4.5, 0.08), corr, 0, 2.25, 0, g);
    g.userData.dynamic = true;
    this.scene.add(g);
    // Frame posts with hazard stripes and a roll housing
    const haz = std({ map: hazardTex([1, 6]) });
    for (const s of [-1, 1]) this.mesh(new THREE.BoxGeometry(0.25, 4.6, 0.3), haz, cx + s * 2.1, 2.3, 17.85);
    this.mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.4, 10), std({ color: '#4a4f55', metalness: 0.5 }), cx, 4.75, 17.8).rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) this.box(0.4, 0.5, 0.25, std({ color: '#141414' }), cx + s * 1.6, 1.1, 17.75);
    // Outside: the night
    const out = this.mesh(new THREE.PlaneGeometry(4.6, 5), new THREE.MeshBasicMaterial({ map: nightTex() }), cx, 2.5, 19.8);
    out.rotation.y = Math.PI;
    const ground = this.mesh(new THREE.PlaneGeometry(4.4, 2), std({ color: '#1a1a1e' }), cx, 0.0, 19.0);
    ground.rotation.x = -Math.PI / 2;
    // floor stripes in front
    const stripe = this.mesh(new THREE.PlaneGeometry(4, 0.4), std({ map: hazardTex([8, 1]) }), cx, 0.008, 17.4);
    stripe.rotation.x = -Math.PI / 2;
    if (name) {
      panel.userData.interact = { kind: 'guardDoor', door: name };
      this.interactables.push(panel);
      const door: IncidentDoor = {
        name,
        open: 0,
        target: 0,
        mesh: panel,
        apply: (o) => {
          panel.position.y = 2.25 + o * 3.2;
          panel.scale.y = 1 - o * 0.7;
        },
      };
      this.doors.push(door);
    }
  }

  private dock(): void {
    this.rollerDoor(0, null);
    this.rollerDoor(7, 'dock');
    this.pxSign(['LOADING DOCK B', 'there is no dock A'], 3, 0.6, 3.5, 5.6, 17.98, Math.PI, { bg: '#1d2a36', fg: '#f0b43c', border: '#f0b43c' });
    this.glowSign(['EXIT'], 0.6, 0.25, 3.5, 4.9, 17.97, Math.PI, { bg: '#0d3a16', fg: '#6bff8a' });
    // A rotating orange beacon over the dock
    this.beacon.position.set(3.5, 4.5, 17.85);
    this.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.18, 8), new THREE.MeshStandardMaterial({ color: '#ff8a1a', emissive: '#ff6a00', emissiveIntensity: 1.6 }), 0, 0, 0, this.beacon);
    const flap = this.mesh(new THREE.BoxGeometry(0.02, 0.14, 0.12), std({ color: '#222' }), 0.08, 0, 0, this.beacon);
    flap.name = 'flap';
    this.scene.add(this.beacon);
    // Pallets, a pallet jack and boxes
    this.pile(-1.0, 13.8, 1.2, 1.2, 3, 51);
    this.pile(1.6, 12.4, 1.2, 1.2, 2, 52);
    this.pile(10.6, 15.6, 1.2, 1.8, 3, 53);
    for (let i = 0; i < 5; i++) this.box(1.2, 0.14, 1.0, std({ color: i % 2 ? '#8a6a43' : '#7a5c3a' }), -4.2, 0.07 + i * 0.15, 16.6).rotation.y = (i % 3) * 0.05;
    this.solid(-4.2, 16.6, 1.3, 1.1, 0.8, true, 'pallets');
    const jack = new THREE.Group();
    jack.position.set(4.8, 0, 14.6);
    jack.rotation.y = 0.5;
    const red = std({ color: '#b02a1e' });
    for (const s of [-1, 1]) this.mesh(new THREE.BoxGeometry(0.16, 0.08, 1.2), red, s * 0.25, 0.08, 0, jack);
    this.mesh(new THREE.BoxGeometry(0.6, 0.35, 0.2), red, 0, 0.25, -0.65, jack);
    const handle = this.mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 5), std({ color: '#222' }), 0, 0.8, -0.85, jack);
    handle.rotation.x = -0.4;
    this.scene.add(jack);
    this.solid(4.8, 14.6, 0.9, 1.3, 0.5, false, 'jack');
    // A forklift robot, off duty
    const fl = new THREE.Group();
    fl.position.set(-6.5, 0, 13.6);
    fl.rotation.y = 0.9;
    const yel = std({ color: '#c99a1e', metalness: 0.3 });
    this.mesh(new THREE.BoxGeometry(1.1, 0.9, 1.6), yel, 0, 0.6, 0, fl);
    this.mesh(new THREE.BoxGeometry(0.9, 0.6, 0.6), yel, 0, 1.35, -0.2, fl);
    this.mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshBasicMaterial({ map: textTexture(['zZ'], { w: 64, h: 32, bg: '#06141c', fg: '#4dd2ff', font: PX }) }), 0, 1.4, 0.101, fl);
    for (const s of [-1, 1]) this.mesh(new THREE.BoxGeometry(0.08, 2.4, 0.08), std({ color: '#333' }), s * 0.4, 1.2, 0.85, fl);
    for (const s of [-1, 1]) this.mesh(new THREE.BoxGeometry(0.12, 0.05, 1.0), std({ color: '#555' }), s * 0.25, 0.15, 1.35, fl);
    for (const [x, z] of [[-0.55, -0.5], [0.55, -0.5], [-0.55, 0.5], [0.55, 0.5]]) this.mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10), std({ color: '#151515' }), x, 0.22, z, fl).rotation.z = Math.PI / 2;
    fl.userData.interact = { kind: 'sign', text: 'FORK-E, the forklift robot. Off duty. Its screen says zZ. Forklifts do not sleep. This one has a union.' };
    this.interactables.push(fl);
    this.scene.add(fl);
    this.solid(-6.5, 13.6, 1.9, 1.9, 2.4, true, 'forklift');
    // Traffic posts
    for (const [x, z] of [[-2.6, 12.2], [9.6, 12.2], [12.4, 12.8]] as [number, number][]) {
      if (this.model('guardTraffic', x, 0, z)) this.solid(x, z, 0.4, 0.4, 1.4, false, 'decor');
    }
  }

  // ------------------------------------------------------------------ break corner and fire exit

  private breakArea(): void {
    // Vending machine against the west wall, facing the hall
    const vm = new THREE.Group();
    vm.position.set(-23.45, 0, 11);
    vm.rotation.y = Math.PI / 2;
    this.mesh(new THREE.BoxGeometry(1.1, 1.95, 0.85), std({ color: '#8b1e1e', roughness: 0.4 }), 0, 0.975, 0, vm);
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 96;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0c1620';
    g.fillRect(0, 0, 64, 96);
    const cans = ['#c0392b', '#2471a3', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22'];
    for (let row = 0; row < 5; row++) {
      g.fillStyle = '#2a3a48';
      g.fillRect(2, 8 + row * 17 + 12, 60, 2);
      for (let col = 0; col < 6; col++) {
        g.fillStyle = cans[(row + col) % cans.length];
        g.fillRect(4 + col * 10, 8 + row * 17, 6, 11);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(5 + col * 10, 9 + row * 17, 1, 9);
      }
    }
    g.fillStyle = '#d8f0ff';
    g.font = 'bold 7px monospace';
    g.fillText('SNAX-O-TRON', 10, 6);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    this.mesh(new THREE.PlaneGeometry(0.75, 1.45), new THREE.MeshBasicMaterial({ map: tex }), -0.12, 1.15, 0.43, vm);
    this.mesh(new THREE.BoxGeometry(0.22, 0.6, 0.02), std({ color: '#222' }), 0.38, 1.2, 0.43, vm);
    this.mesh(new THREE.BoxGeometry(0.7, 0.18, 0.04), std({ color: '#111' }), -0.12, 0.28, 0.43, vm);
    this.mesh(new THREE.PlaneGeometry(0.18, 0.08), new THREE.MeshBasicMaterial({ map: textTexture(['€2.00'], { w: 64, h: 32, bg: '#001a00', fg: '#55ff55', font: PX }) }), 0.38, 1.6, 0.442, vm);
    vm.userData.interact = { kind: 'guardVending' };
    this.interactables.push(vm);
    this.scene.add(vm);
    this.solid(-23.45, 11, 0.9, 1.15, 1.95, true, 'vending');
    this.point('#9ad0ff', 6, 6, -22.4, 1.4, 11);
    // A tired tube over the break table
    this.mesh(new THREE.BoxGeometry(0.25, 0.06, 1.6), glow('#e8f0ff', 1.4), -19.5, 3.4, 13.5);
    this.mesh(new THREE.CylinderGeometry(0.01, 0.01, H - 3.4, 4), std({ color: '#2b2e31' }), -19.5, (H + 3.4) / 2, 13.5);
    const tube = this.point('#d8e8ff', 10, 9, -19.5, 3.2, 13.5);
    tube.userData.dying = true;
    this.flicker.push(tube);
    this.pxSign(['COFFEE-ADJACENT', 'BEVERAGES'], 1.1, 0.3, -23.97, 2.3, 11, Math.PI / 2, { bg: '#111', fg: '#ff6a5a' });

    // Table, chairs, water cooler, lockers, notice board
    const table = std({ color: '#b8b2a0' });
    const leg = std({ color: '#5d6166', metalness: 0.5 });
    this.box(1.6, 0.05, 0.9, table, -19.5, 0.75, 13.5);
    for (const [x, z] of [[-20.2, 13.1], [-18.8, 13.1], [-20.2, 13.9], [-18.8, 13.9]]) this.box(0.05, 0.74, 0.05, leg, x, 0.37, z);
    this.solid(-19.5, 13.5, 1.6, 0.9, 0.78, true, 'table');
    for (const [x, z, r] of [[-20.0, 12.6, 0.2], [-18.9, 14.4, Math.PI + 0.4], [-20.6, 14.5, Math.PI - 0.3]] as [number, number, number][]) {
      const ch = new THREE.Group();
      ch.position.set(x, 0, z);
      ch.rotation.y = r;
      this.mesh(new THREE.BoxGeometry(0.42, 0.04, 0.42), std({ color: '#c46a1d' }), 0, 0.45, 0, ch);
      this.mesh(new THREE.BoxGeometry(0.42, 0.4, 0.04), std({ color: '#c46a1d' }), 0, 0.68, -0.2, ch);
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) this.mesh(new THREE.BoxGeometry(0.03, 0.45, 0.03), leg, lx, 0.22, lz, ch);
      this.scene.add(ch);
    }
    // A mug ring, a newspaper and a sad cake on the table
    this.box(0.3, 0.01, 0.4, std({ color: '#d8d2c0' }), -19.9, 0.78, 13.4).rotation.y = 0.3;
    const cake = this.mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 10, 1, false, 0, Math.PI * 1.6), std({ color: '#e8c8a0' }), -19.0, 0.83, 13.6);
    cake.rotation.y = 1;
    this.pxSign(['HAPPY RETIREMENT', 'UNIT 7'], 0.5, 0.15, -19.0, 0.95, 13.75, Math.PI, { bg: '#fff', fg: '#c0392b' });
    const lockers = std({ color: '#3d5a4a', metalness: 0.4 });
    for (let i = 0; i < 5; i++) {
      this.box(0.5, 1.9, 0.5, lockers, -22 + i * 0.52, 0.95, 17.7);
      for (let k = 0; k < 4; k++) this.box(0.3, 0.02, 0.01, std({ color: '#222' }), -22 + i * 0.52, 1.6 + k * 0.05, 17.44);
    }
    this.solid(-20.96, 17.7, 2.6, 0.5, 1.9, true, 'lockers');
    this.mesh(new THREE.PlaneGeometry(1.4, 1.0), std({ map: corkTex() }), -23.95, 1.7, 15.2).rotation.y = Math.PI / 2;
    this.pxSign(['BREAK AREA', 'breaks are decorative'], 2.4, 0.5, -19.5, 3.2, 17.97, Math.PI, { bg: '#1d2a36', fg: '#f0b43c', border: '#f0b43c' });
    // Microwave on a cart
    this.box(0.7, 0.8, 0.5, std({ color: '#5d6166', metalness: 0.4 }), -15.6, 0.4, 17.4);
    this.box(0.5, 0.3, 0.36, std({ color: '#d8d8d0' }), -15.6, 0.95, 17.4);
    this.mesh(new THREE.PlaneGeometry(0.3, 0.2), std({ color: '#1a1a1a' }), -15.66, 0.95, 17.219).rotation.y = Math.PI;
    this.solid(-15.6, 17.4, 0.75, 0.55, 1.1, true, 'decor');
  }

  private fireExit(): void {
    const door = new THREE.Group();
    door.position.set(-24.0, 0, -1.0);
    door.userData.dynamic = true;
    const panel = this.mesh(new THREE.BoxGeometry(0.08, 2.3, 2.0), std({ color: '#6a2a22', metalness: 0.3 }), 0, 1.15, 1.0, door);
    this.mesh(new THREE.BoxGeometry(0.1, 0.06, 1.4), std({ color: '#c0c4c8', metalness: 0.7 }), 0.08, 1.05, 1.0, door);
    this.scene.add(door);
    panel.userData.interact = { kind: 'guardDoor', door: 'fire' };
    this.interactables.push(panel);
    this.doors.push({
      name: 'fire',
      open: 0,
      target: 0,
      mesh: panel,
      apply: (o) => {
        door.rotation.y = o * 1.35;
      },
    });
    const out = this.mesh(new THREE.PlaneGeometry(2.4, 3), new THREE.MeshBasicMaterial({ map: nightTex() }), -25.6, 1.5, 0);
    out.rotation.y = Math.PI / 2;
    this.glowSign(['EXIT'], 0.8, 0.3, -23.97, 2.6, 0, Math.PI / 2, { bg: '#0d3a16', fg: '#6bff8a' });
    this.point('#3bff6a', 4, 5, -23.2, 2.5, 0);
    this.pxSign(['FIRE EXIT', 'alarm will sound', '(it will not)'], 1.0, 0.45, -23.95, 1.6, -1.7, Math.PI / 2, { bg: '#c0392b', fg: '#ffffff' });
    // Extinguishers and a hose reel
    const red = std({ color: '#b3160c' });
    for (const z of [-2.4, 2.2]) {
      this.mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8), red, -23.85, 0.8, z);
      this.mesh(new THREE.BoxGeometry(0.06, 0.08, 0.04), std({ color: '#1a1a1a' }), -23.85, 1.08, z);
    }
    const reel = this.mesh(new THREE.TorusGeometry(0.3, 0.08, 6, 14), red, -23.85, 1.5, 3.4);
    reel.rotation.y = Math.PI / 2;
  }

  // ------------------------------------------------------------------ catwalk and the north side

  private catwalk(): void {
    const grate = new THREE.MeshStandardMaterial({ map: gratingTex([36, 2]), transparent: true, side: THREE.DoubleSide, roughness: 0.6, depthWrite: false });
    const steel = std({ color: '#4a4f55', metalness: 0.5 });
    const yel = std({ color: '#b8901e' });
    const y = 3.6;
    const x0 = -14;
    const x1 = 22;
    const cx = (x0 + x1) / 2;
    const floor = this.mesh(new THREE.PlaneGeometry(x1 - x0, 1.4), grate, cx, y, -17.3);
    floor.rotation.x = -Math.PI / 2;
    this.mesh(new THREE.BoxGeometry(x1 - x0, 0.1, 0.08), steel, cx, y - 0.05, -16.6);
    this.mesh(new THREE.BoxGeometry(x1 - x0, 0.05, 0.05), yel, cx, y + 1.05, -16.6);
    this.mesh(new THREE.BoxGeometry(x1 - x0, 0.04, 0.04), yel, cx, y + 0.55, -16.6);
    for (let x = x0; x <= x1; x += 2) {
      this.mesh(new THREE.BoxGeometry(0.05, 1.05, 0.05), yel, x, y + 0.52, -16.6);
      const br = this.mesh(new THREE.BoxGeometry(0.06, 0.06, 1.2), steel, x, y - 0.4, -17.4);
      br.rotation.x = -0.5;
    }
    // Stairs down at x = 11
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const sy = y - (i + 1) * (y / steps);
      this.box(1.1, 0.05, 0.42, steel, 11.2, sy + 0.025, -16.4 + i * 0.42);
    }
    for (const s of [-1, 1]) {
      const rail = this.mesh(new THREE.BoxGeometry(0.05, 0.05, Math.hypot(steps * 0.42, y)), yel, 11.2 + s * 0.55, y / 2 + 0.9, -16.4 + (steps * 0.42) / 2);
      rail.rotation.x = Math.atan2(y, steps * 0.42);
      const string = this.mesh(new THREE.BoxGeometry(0.06, 0.25, Math.hypot(steps * 0.42, y)), steel, 11.2 + s * 0.57, y / 2, -16.4 + (steps * 0.42) / 2);
      string.rotation.x = Math.atan2(y, steps * 0.42);
    }
    this.solid(11.2, -13.5, 1.3, 6, 1.5, false, 'stairs');
    this.pxSign(['CATWALK CLOSED', 'gravity is not covered', 'by your contract'], 1.2, 0.5, 11.2, 1.2, -10.4, 0, { bg: '#f1c40f', fg: '#1a1a1a' });

    // Electrical cabinets under the catwalk
    const cab = std({ color: '#6a7280', metalness: 0.4 });
    for (let i = 0; i < 5; i++) {
      const x = 0.5 + i * 1.1;
      this.box(1.0, 2.1, 0.6, cab, x, 1.05, -17.6);
      this.box(0.02, 1.9, 0.01, std({ color: '#333' }), x, 1.05, -17.29);
      for (let k = 0; k < 3; k++) {
        const m = glow(['#ff3030', '#3bff6a', '#f1c40f'][(i + k) % 3], 1.5);
        this.officeLedMats.push(m);
        this.mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), m, x + 0.3, 1.7 - k * 0.08, -17.29);
      }
    }
    this.solid(2.7, -17.6, 5.6, 0.6, 2.1, true, 'cabinets');
    this.pxSign(['DANGER', '40,000 VOLT', 'robots only'], 1.0, 0.6, 4.95, 2.5, -17.95, 0, { bg: '#f1c40f', fg: '#1a1a1a', border: '#1a1a1a' });
    // Cable trays from the cabinets up to the catwalk
    for (const x of [0.5, 2.7, 4.9]) this.mesh(new THREE.BoxGeometry(0.3, 1.5, 0.06), std({ color: '#3a3a3a' }), x, 2.85, -17.92);
  }

  // ------------------------------------------------------------------ toilet

  private toilet(): void {
    this.toiletBooth(19, 14, ['KEY: SECURITY OFFICE', 'on the big keyring', 'it is one of 300']);
    const booth = this.point('#e0f0d0', 4, 4.5, 21.5, 2.3, 16, 1.8);
    booth.userData.dying = true;
    this.flicker.push(booth);
    this.lamp(15, 12.5, true, '#ffc070');
    this.pxSign(['STAFF TOILET', 'the only room', 'without a camera'], 1.6, 0.6, 18.92, 3.1, 16.1, -Math.PI / 2, { bg: '#2e86c1', fg: '#ffffff' }, 'The staff toilet. The only room in the plant without a camera. Probably.');
    this.pxSign(['TOILET THIS WAY', '-->', 'it is a walk'], 1.4, 0.6, -14.9, 2.4, -9.8, -Math.PI / 2, { bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' });
  }

  // ------------------------------------------------------------------ checkpoints

  private checkpointPlates(): void {
    const spots: [string, number, number, number][] = [
      ['LOADING DOCK', 3.2, 17.9, Math.PI],
      ['PARTS STORAGE', 23.9, 10.5, -Math.PI / 2],
      ['SERVO VAULT', 23.9, -12.4, -Math.PI / 2],
      ['ELECTRICAL', -1.6, -17.9, 0],
      ['FIRE EXIT', -23.9, -4.5, Math.PI / 2],
      ['BREAK AREA', -13.2, 17.9, Math.PI],
    ];
    spots.forEach(([name, x, z, rot], i) => {
      const g = new THREE.Group();
      g.position.set(x, 1.3, z);
      g.rotation.y = rot;
      this.mesh(new THREE.BoxGeometry(0.34, 0.46, 0.04), std({ color: '#2b2f35', metalness: 0.5 }), 0, 0, 0.02, g);
      this.mesh(new THREE.BoxGeometry(0.2, 0.26, 0.08), std({ color: '#444a52', metalness: 0.4 }), 0, -0.04, 0.06, g);
      this.mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14), glow('#f0b43c', 1.4), 0, -0.04, 0.105, g);
      const led = glow('#ff3030', 2.0);
      this.mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), led, 0, 0.14, 0.05, g);
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.22), new THREE.MeshBasicMaterial({ map: textTexture([`CHECKPOINT ${i + 1}`, name], { w: 256, h: 96, bg: '#1a1408', fg: '#f0b43c', font: PX }) }));
      lab.position.set(0, 0.42, 0.03);
      g.add(lab);
      g.userData.interact = { kind: 'guardCheckpoint', index: i };
      this.interactables.push(g);
      this.scene.add(g);
      this.checkpoints.push({ index: i, name, group: g, led, pos: new THREE.Vector3(x, 1.3, z), done: false });
    });
  }

  // ------------------------------------------------------------------ cameras on the walls

  private cameraHousings(): void {
    const body = std({ color: '#d8d8d2' });
    const dark = std({ color: '#1a1a1a' });
    for (const c of CAMS) {
      const g = new THREE.Group();
      g.position.copy(c.pos);
      g.lookAt(c.look);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.42), body);
      g.add(b);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 8), dark);
      lens.rotation.x = Math.PI / 2;
      lens.position.z = 0.22;
      g.add(lens);
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.5), body);
      hood.position.set(0, 0.11, 0.03);
      g.add(hood);
      const led = glow('#ff2020', 2);
      this.camLeds.push(led);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), led);
      l.position.set(0.07, 0.07, 0.2);
      g.add(l);
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.06), new THREE.MeshBasicMaterial({ map: textTexture([String(c.id).padStart(2, '0')], { w: 64, h: 24, bg: '#d8d8d2', fg: '#111', font: PX }) }));
      lab.position.set(0.101, 0, 0);
      lab.rotation.y = Math.PI / 2;
      g.add(lab);
      this.camGroup.add(g);
      // a mounting arm up to the wall or roof
      this.mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 5), dark, c.pos.x, c.pos.y + 0.3, c.pos.z, this.camGroup);
    }
    this.scene.add(this.camGroup);
  }

  // ------------------------------------------------------------------ clutter

  private clutter(): void {
    const r = rng(1234);
    // Barrels
    const barrelMats = [std({ color: '#2f5a8a', metalness: 0.3 }), std({ color: '#8a3a1e', metalness: 0.3 }), std({ color: '#3a6a3a', metalness: 0.3 })];
    const barrel = (x: number, z: number, i: number) => {
      this.mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12), barrelMats[i % 3], x, 0.45, z);
      for (const y of [0.2, 0.7]) this.mesh(new THREE.TorusGeometry(0.3, 0.015, 4, 14), std({ color: '#222' }), x, y, z).rotation.x = Math.PI / 2;
      this.mesh(new THREE.PlaneGeometry(0.26, 0.26), std({ map: hazardTex([1, 1]) }), x, 0.5, z + 0.301);
      this.solid(x, z, 0.62, 0.62, 0.9, false, 'barrel');
    };
    let i = 0;
    for (const [x, z] of [[-13.4, -16.6], [-12.7, -16.8], [-13.1, -16.0], [13.6, -16.9], [14.3, -16.5], [-23.2, 6.4], [-23.3, 7.1], [-22.6, 6.8], [15.2, 16.9], [12.6, 17.2]] as [number, number][]) barrel(x, z, i++);
    // Box piles along the walls
    this.pile(-22.6, 3.6, 1.2, 1.8, 3, 61);
    this.pile(-22.8, -7.8, 1.4, 2.4, 3, 62);
    this.pile(7.6, -16.9, 1.8, 1.0, 2, 63);
    this.pile(-9.6, -16.8, 2.4, 1.2, 3, 64);
    this.pile(14.6, -3.6, 1.2, 1.2, 2, 65);
    // Large factory crates
    for (const [x, z, rot] of [[-8.8, 10.6, 0.1], [-9.6, 12.2, -0.2], [13.6, 7.0, 0.3]] as [number, number, number][]) {
      if (this.model('guardBoxL', x, 0, z, rot, '#e8d8b8')) this.solid(x, z, 1.2, 1.1, 0.6, false, 'crate');
      else {
        this.box(1.1, 0.55, 1.0, std({ color: '#8a6a43' }), x, 0.275, z);
        this.solid(x, z, 1.2, 1.1, 0.6, false, 'crate');
      }
    }
    // Cable spools
    for (const [x, z] of [[-10.6, -12.8], [6.4, 10.4]] as [number, number][]) {
      const g = new THREE.Group();
      g.position.set(x, 0.5, z);
      g.rotation.x = Math.PI / 2;
      for (const s of [-0.25, 0.25]) this.mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 12), std({ color: '#8a6a43' }), 0, s, 0, g);
      this.mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 12), std({ color: '#2a2a2a' }), 0, 0, 0, g);
      this.scene.add(g);
      this.solid(x, z, 1.0, 0.6, 1.0, false, 'spool');
    }
    // Pistons on stands (frozen)
    for (const [x, z] of [[-9.2, 0.2], [11.4, -9.0]] as [number, number][]) {
      if (this.model('guardPiston', x, 0, z, 0, '#d8c8a8')) this.solid(x, z, 0.9, 0.9, 1.0, false, 'decor');
    }
    // Floor junk: bolts, rags, a lone robot shoe
    const junk = [std({ color: '#7f8c8d', metalness: 0.7 }), std({ color: '#c8b890' }), std({ color: '#3a3a3a' })];
    for (let k = 0; k < 40; k++) {
      const x = -13 + r() * 34;
      const z = -9 + r() * 22;
      if (Math.abs(z + 5) < 1.1 || Math.abs(z - 3) < 1.1) continue;
      const m = this.mesh(new THREE.BoxGeometry(0.04 + r() * 0.08, 0.02, 0.03 + r() * 0.05), junk[k % 3], x, 0.01, z);
      m.rotation.y = r() * Math.PI;
    }
    // Oil and water stains
    const stain = new THREE.MeshBasicMaterial({ color: '#1a1612', transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    for (const [x, z, s] of [[-5, -2, 0.8], [6, 0.5, 0.6], [12, -8, 0.7], [-10, 6, 0.9], [3, 9, 0.5], [18, 2, 0.7], [-17, 4, 0.6], [9, 14, 0.8], [-3, -12, 0.6]] as [number, number, number][]) {
      this.mesh(blobGeometry(s), stain, x, 0.006, z).rotation.y = r() * 6;
    }
    // A hand cart with parts bins
    const cart = new THREE.Group();
    cart.position.set(-4.5, 0, -0.8);
    cart.rotation.y = 0.4;
    this.mesh(new THREE.BoxGeometry(1.0, 0.05, 0.6), std({ color: '#3d5a7a' }), 0, 0.5, 0, cart);
    this.mesh(new THREE.BoxGeometry(1.0, 0.05, 0.6), std({ color: '#3d5a7a' }), 0, 0.15, 0, cart);
    for (const [x, z] of [[-0.45, -0.25], [0.45, -0.25], [-0.45, 0.25], [0.45, 0.25]]) this.mesh(new THREE.BoxGeometry(0.04, 0.55, 0.04), std({ color: '#222' }), x, 0.3, z, cart);
    for (let k = 0; k < 3; k++) this.mesh(new THREE.BoxGeometry(0.28, 0.14, 0.4), std({ color: ['#c0392b', '#2471a3', '#f1c40f'][k] }), -0.32 + k * 0.32, 0.6, 0, cart);
    this.scene.add(cart);
    this.solid(-4.5, -0.8, 1.1, 0.9, 0.6, false, 'cart');
    // A red tool chest by the pillar
    const chest = std({ color: '#9e2a1e', metalness: 0.4 });
    this.box(1.0, 1.1, 0.55, chest, -2.9, 0.55, -10.6);
    for (let k = 0; k < 5; k++) this.box(0.9, 0.01, 0.01, std({ color: '#d8d8d0', metalness: 0.7 }), -2.9, 0.25 + k * 0.18, -10.32);
    this.box(0.8, 0.5, 0.5, chest, -2.9, 1.35, -10.6);
    this.solid(-2.9, -10.6, 1.0, 0.6, 1.6, false, 'decor');
    // Wet floor signs and cones around the drip
    const yellowSign = std({ color: '#e8c21a', side: THREE.DoubleSide });
    for (const [x, z, r] of [[3.4, -0.3, 0.4], [1.6, -1.8, -0.7]] as [number, number, number][]) {
      const w = new THREE.Group();
      w.position.set(x, 0, z);
      w.rotation.y = r;
      for (const s2 of [-1, 1]) {
        const p = this.mesh(new THREE.PlaneGeometry(0.32, 0.6), yellowSign, 0, 0.29, s2 * 0.09, w);
        p.rotation.x = s2 * 0.3;
      }
      this.mesh(new THREE.PlaneGeometry(0.26, 0.12), std({ map: textTexture(['WET', 'since 2066'], { w: 64, h: 32, bg: '#e8c21a', fg: '#1a1a1a' }) }), 0, 0.38, 0.105, w).rotation.x = 0.3;
      this.scene.add(w);
    }
    const cone = std({ color: '#e0601a' });
    for (const [x, z] of [[-0.8, -2.2], [10.6, -2.4], [-9.6, 1.9], [12.8, 1.8]] as [number, number][]) {
      this.mesh(new THREE.ConeGeometry(0.16, 0.5, 8), cone, x, 0.25, z);
      this.mesh(new THREE.BoxGeometry(0.34, 0.03, 0.34), std({ color: '#1a1a1a' }), x, 0.015, z);
      this.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.06, 8), std({ color: '#f0f0e8' }), x, 0.28, z);
    }
    // QC rejects: a cage cart full of robot heads
    const cage = new THREE.MeshStandardMaterial({ map: fenceTex([2, 1]), transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const cartG = new THREE.Group();
    cartG.position.set(-9.6, 0, 6.6);
    cartG.rotation.y = 0.3;
    this.mesh(new THREE.BoxGeometry(1.3, 0.06, 0.9), std({ color: '#4a4f55', metalness: 0.5 }), 0, 0.2, 0, cartG);
    for (const [w, d, x, z] of [[1.3, 0.02, 0, 0.45], [1.3, 0.02, 0, -0.45], [0.02, 0.9, 0.65, 0], [0.02, 0.9, -0.65, 0]] as [number, number, number, number][]) this.mesh(new THREE.BoxGeometry(w, 0.8, d), cage, x, 0.62, z, cartG);
    for (let k = 0; k < 9; k++) {
      const h = this.mesh(new THREE.BoxGeometry(0.3, 0.24, 0.26), std({ color: k % 3 ? '#8a9299' : '#a0937c', metalness: 0.5 }), -0.4 + (k % 3) * 0.4, 0.36 + Math.floor(k / 3) * 0.18, -0.25 + Math.floor(k / 3) * 0.25, cartG);
      h.rotation.set(k * 0.4, k * 0.9, 0);
    }
    this.scene.add(cartG);
    this.pxSign(['QC REJECTS', 'too many feelings'], 0.9, 0.3, -9.6, 1.35, 7.08, 0.3, { bg: '#f2ead2', fg: '#7a1f14' });
    this.solid(-9.6, 6.6, 1.4, 1.0, 1.0, false, 'decor');
    // Box piles next to pillars
    this.pile(-2.9, 9.6, 1.2, 1.2, 3, 71);
    this.pile(9.0, 9.4, 1.2, 1.2, 2, 72);
    this.pile(-12.9, 9.6, 1.2, 1.2, 3, 73);
    // Stenciled floor text
    const stencil = (lines: string[], x: number, z: number, rot: number) => {
      const m = this.mesh(new THREE.PlaneGeometry(2.4, 0.8), new THREE.MeshStandardMaterial({ map: textTexture(lines, { w: 256, h: 86, bg: 'transparent', fg: '#c9a227', font: PX }), transparent: true, depthWrite: false }), x, 0.01, z);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rot;
    };
    stencil(['DO NOT STAND', 'robots crossing'], -6, -1, 0);
    stencil(['KEEP CLEAR', 'loading dock'], 4, 11, 0);
    stencil(['SECURITY', '<-- this way'], -13.2, -6, Math.PI / 2);
    // Hanging cables from the roof
    const cable = std({ color: '#141414' });
    for (const [x, z] of [[-5, -6.6], [2, 4.6], [7, -6.6], [-1, 4.6]] as [number, number][]) this.mesh(new THREE.CylinderGeometry(0.015, 0.015, 3.2, 4), cable, x, H - 1.6, z);
    // Plants (players will pee in them)
    this.plant(-23.2, -11.8);
    this.plant(-14.7, 16.9);
    this.plant(18.2, 13.2);
    // Speaker for the radio announcements
    for (const [x, z, rot] of [[-23.8, -6, Math.PI / 2], [23.8, 4, -Math.PI / 2]] as [number, number, number][]) this.model('guardSpeaker', x, 3.6, z, rot);
  }

  private posters(): void {
    const style: TextTexOpts = { bg: '#fdf6e3', fg: '#2c3e50', border: '#c0392b', font: PX };
    const spots: [number, number, number, number][] = [
      [-8, 3.1, -17.97, 0],
      [16, 3.1, -17.97, 0],
      [23.97, 3.0, -15, -Math.PI / 2],
      [-23.97, 3.0, -5, Math.PI / 2],
      [-10, 3.1, 17.97, Math.PI],
      [14, 3.1, 17.97, Math.PI],
    ];
    GT.POSTERS.forEach((lines, i) => {
      const s = spots[i % spots.length];
      this.sign(lines, 2.0, 1.1, s[0], s[1], s[2], s[3], style, 'A motivational poster. It was printed by a robot that has never been tired.');
    });
  }

  // ------------------------------------------------------------------ loose items

  private place(def: typeof MUG_DEF, x: number, y: number, z: number, rotY = 0, fixed = false): Item {
    const it = new Item(def);
    it.state = fixed ? 'fixed' : 'world';
    it.sleeping = !fixed;
    it.mesh.position.set(x, y + it.baseOffset, z);
    it.mesh.rotation.y = rotY;
    this.scene.add(it.mesh);
    this.initialItems.push(it);
    return it;
  }

  private items(): void {
    // The keyring hangs on its board by the office door
    const keys = new Item(KEYRING_DEF);
    keys.state = 'fixed';
    keys.mesh.position.set(-15.32, 1.05, -14.65);
    keys.mesh.rotation.y = 0;
    this.scene.add(keys.mesh);
    this.initialItems.push(keys);
    this.place(MUG_DEF, -18.85, 0.78, -16.4, 0.4);
    this.place(LOGBOOK_DEF, -20.05, 0.78, -16.45, 0.15);
    this.place(DONUT_DEF, -17.95, 0.84, -16.42);
    const [servo, eye, hand, cog, screws] = PART_DEFS;
    this.place(servo, 17.6, 0.9, -17.2, 0.3, true);
    this.place(servo, 23.6, 1.04, -14.6, 1.2, true);
    this.place(eye, 23.6, 0.54, -13.4, 0, true);
    this.place(hand, -6.0, 0.93, -8.95, 0.5);
    this.place(cog, -4.6, 0.93, -9.0, 0.2);
    this.place(screws, 3.2, 0.84, -5.1, 0.1);
    this.place(eye, 7.9, 0.84, 3.1, 2.0);
    this.place(hand, -19.4, 0.78, 13.6, 1.0);
  }

  // ------------------------------------------------------------------ animation

  private animate(t: number): void {
    // Dying fluorescent tubes and humming sodium lamps
    for (const l of this.flicker) {
      const base = (l.userData.base as number | undefined) ?? (l.userData.base = l.intensity);
      if (l.userData.dying) {
        const phase = (t + l.position.x) % 6.1;
        const off = phase > 5.4 && Math.sin(t * 47) > -0.1;
        l.intensity = off ? base * 0.15 : base;
      } else {
        l.intensity = base * (0.94 + 0.06 * Math.sin(t * 2.1 + l.position.x));
      }
    }
    const on = Math.sin(t * 3) > 0;
    for (const m of this.camLeds) m.emissiveIntensity = on ? 2 : 0.1;
    this.officeLedMats.forEach((m, i) => (m.emissiveIntensity = Math.sin(t * (1.3 + i * 0.37)) > 0 ? 1.6 : 0.2));
    // The drip
    const period = 1.6;
    const p = (t % period) / period;
    if (p < 0.4) {
      this.drop.visible = true;
      this.drop.position.y = 5.4 - 0.05;
      this.drop.scale.setScalar(0.4 + p * 1.5);
    } else {
      const f = (p - 0.4) / 0.6;
      this.drop.position.y = 5.4 - f * f * 5.1;
      this.drop.visible = f < 0.98;
    }
    const rp = ((t + period * 0.02) % period) / period;
    this.ripple.scale.setScalar(1 + rp * 3);
    (this.ripple.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - rp);
    // Beacon
    this.beacon.rotation.y = t * 3;
    for (const d of this.doors) {
      d.open += (d.target - d.open) * 0.04;
      d.apply(d.open);
    }
  }
}
