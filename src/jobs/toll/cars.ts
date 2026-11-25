import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { instantiate } from '../../assets';
import { textTexture } from '../../util';
import { CAR_KINDS } from './models';

/**
 * Self-driving robot cars. Each one is a Kenney car model with a robot head (or three)
 * poking out of the sunroof, a status beacon on the roof and glowing lights.
 */

export type CarRole = 'robot' | 'paid' | 'unpaid' | 'gran' | 'receipt' | 'police' | 'directions' | 'ceo';

export interface Car {
  group: THREE.Group;
  /** Rotates with the car body (the wrong-way gag turns only this). */
  body: THREE.Group;
  lane: number;
  role: CarRole;
  name: string;
  x: number;
  z: number;
  speed: number;
  cruise: number;
  len: number;
  width: number;
  height: number;
  /** Paid the toll (transponder or coins). */
  paid: boolean;
  /** The special driver is done talking and wants to leave. */
  served: boolean;
  /** Passed the barrier line of booth 3. */
  passed: boolean;
  /** Has been at the window (stopped there at least once). */
  atWindow: boolean;
  /** Seconds standing still. */
  wait: number;
  nextHonk: number;
  /** Already threw its tip or payment. */
  threw: boolean;
  /** Robot head that talks, for speech bubbles. */
  head: THREE.Object3D;
  beacon: THREE.MeshBasicMaterial;
  wheels: THREE.Object3D[];
  /** Special states for gags. */
  turned: number;
  offroad: boolean;
  /** Free per-car data for the job. */
  data: Record<string, number>;
  dead: boolean;
}

const ROBOT_NAMES = ['Unit-77', 'AutoPilot Kevin', 'Sedan-9', 'CommuterBot', 'DriveOS 4.1', 'Taxi-Unit 12', 'MegaVan', 'Mr. Cruise Control', 'L5-Larry', 'ParkAssist Pam', 'Lane-Keeping Lou', 'FleetBot 3000'];
let nameIdx = 0;

const geos = new Map<string, THREE.BufferGeometry>();
/** Shared geometry, so hundreds of cars do not each build their own. */
function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geos.get(key);
  if (!g) {
    g = make();
    geos.set(key, g);
  }
  return g;
}

const headMats = new Map<string, THREE.MeshStandardMaterial>();
const metal = (c: string) => {
  let m = headMats.get(c);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.4 });
    headMats.set(c, m);
  }
  return m;
};
const faceCache = new Map<string, THREE.MeshBasicMaterial>();
function faceMat(text: string, fg: string): THREE.MeshBasicMaterial {
  const k = `${text}/${fg}`;
  let m = faceCache.get(k);
  if (!m) {
    const t = textTexture([text], { w: 64, h: 48, bg: '#0b1a2a', fg, font: 'monospace' });
    t.magFilter = THREE.NearestFilter;
    m = new THREE.MeshBasicMaterial({ map: t });
    faceCache.set(k, m);
  }
  return m;
}

export type HeadStyle = 'plain' | 'gran' | 'police' | 'business' | 'kid';

/** A little robot head and shoulders, about 0.5 m tall, facing +z. */
export function robotHead(color: string, face: string, fg: string, style: HeadStyle = 'plain', lite = false): THREE.Group {
  const g = new THREE.Group();
  if (lite) {
    // far away robot lanes: head, face and antenna only
    const h = new THREE.Mesh(geo('head', () => new THREE.BoxGeometry(0.36, 0.28, 0.28)), metal(color));
    h.position.y = 0.3;
    g.add(h);
    const f = new THREE.Mesh(geo('face', () => new THREE.PlaneGeometry(0.3, 0.2)), faceMat(face, fg));
    f.position.set(0, 0.3, 0.141);
    g.add(f);
    const a = new THREE.Mesh(geo('ant', () => new THREE.CylinderGeometry(0.008, 0.008, 0.16, 4)), metal('#333333'));
    a.position.y = 0.52;
    g.add(a);
    return g;
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.16, 6), metal('#555b60'));
  neck.position.y = 0.08;
  g.add(neck);
  const sh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.26), metal(color));
  sh.position.y = 0.02;
  g.add(sh);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.28), metal(style === 'gran' ? '#b39ddb' : color));
  head.position.y = 0.3;
  g.add(head);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), faceMat(face, fg));
  scr.position.set(0, 0.3, 0.141);
  g.add(scr);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), faceMat(face, fg));
  back.position.set(0, 0.3, -0.141);
  back.rotation.y = Math.PI;
  g.add(back);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 8), metal('#bdc3c7'));
    ear.rotation.z = Math.PI / 2;
    ear.position.set(s * 0.2, 0.3, 0);
    g.add(ear);
  }
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 4), metal('#333333'));
  ant.position.y = 0.52;
  g.add(ant);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff5050' }));
  tip.position.y = 0.61;
  g.add(tip);
  if (style === 'gran') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: '#ecf0f1', roughness: 0.9 }));
    bun.position.set(0, 0.5, -0.06);
    g.add(bun);
    for (const sx of [-0.07, 0.07]) {
      const gl = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 4, 10), metal('#111111'));
      gl.position.set(sx, 0.32, 0.15);
      g.add(gl);
    }
  } else if (style === 'police') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.1, 10), new THREE.MeshStandardMaterial({ color: '#1b2a55' }));
    cap.position.y = 0.49;
    g.add(cap);
    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.12), new THREE.MeshStandardMaterial({ color: '#111111' }));
    peak.position.set(0, 0.45, 0.17);
    g.add(peak);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.01), new THREE.MeshStandardMaterial({ color: '#f1c40f', metalness: 0.8 }));
    badge.position.set(0, 0.5, 0.196);
    g.add(badge);
  } else if (style === 'business') {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.01), new THREE.MeshStandardMaterial({ color: '#b3160c' }));
    tie.position.set(0, 0.02, 0.135);
    g.add(tie);
  } else if (style === 'kid') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e74c3c' }));
    cap.position.y = 0.43;
    g.add(cap);
  }
  return g;
}

function pickKind(): string {
  const total = CAR_KINDS.reduce((s, k) => s + k.weight, 0);
  let r = Math.random() * total;
  for (const k of CAR_KINDS) {
    r -= k.weight;
    if (r <= 0) return k.key;
  }
  return CAR_KINDS[0].key;
}

const COLORS = ['#c0c7cf', '#e8e2cf', '#7fb3d5', '#f5b041', '#a9dfbf', '#d7bde2', '#f1948a', '#aab7b8'];
const FACES: [string, string][] = [[':)', '#55ffff'], ['^_^', '#a3ff55'], ['-_-', '#ffd24f'], ['o_o', '#55ffff'], ['>_>', '#ff9f43'], ['$_$', '#2ecc71'], [':|', '#c8c8ff']];

const headLight = new THREE.MeshBasicMaterial({ color: '#fff3c4' });
const tailLight = new THREE.MeshBasicMaterial({ color: '#ff2a1a' });

/** Builds a car. The group stands on y = 0 and faces +z. */
export function buildCar(role: CarRole, lane: number, x: number, z: number): Car {
  let key = pickKind();
  if (role === 'police') key = 'toll_police';
  if (role === 'gran') key = Math.random() < 0.5 ? 'toll_hatch' : 'toll_sedan';
  if (role === 'receipt') key = 'toll_suvLux';
  if (role === 'directions') key = 'toll_van';
  if (role === 'ceo') key = 'toll_race';
  if (role === 'paid' || role === 'unpaid') if (key === 'toll_race' || key === 'toll_tractor') key = 'toll_sedan';
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const inst = instantiate(key);
  let len = 4;
  let width = 1.8;
  let height = 1.6;
  const wheels: THREE.Object3D[] = [];
  if (inst) {
    body.add(inst.object);
    const box = new THREE.Box3().setFromObject(inst.object);
    const size = box.getSize(new THREE.Vector3());
    len = size.z;
    width = size.x;
    height = size.y;
    inst.object.traverse((o) => {
      if (o.name.startsWith('wheel')) wheels.push(o);
      // the CEO drives a gold car
      const m = o as THREE.Mesh;
      if (role === 'ceo' && m.isMesh && !o.name.startsWith('wheel')) {
        const gold = (mat: THREE.Material) => {
          const c = (mat as THREE.MeshStandardMaterial).clone();
          c.color.set('#ffc93a');
          c.map = null;
          c.metalness = 0.8;
          c.roughness = 0.3;
          return c;
        };
        m.material = Array.isArray(m.material) ? m.material.map(gold) : gold(m.material);
      }
    });
  } else {
    const paint = new THREE.MeshStandardMaterial({ color: COLORS[Math.floor(Math.random() * COLORS.length)], roughness: 0.5 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 4), paint);
    b.position.y = 0.6;
    body.add(b);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2), paint);
    cab.position.set(0, 1.25, -0.2);
    body.add(cab);
    len = 4;
    height = 1.55;
  }
  // robot passengers poking out of the sunroof
  const cabZ = ['toll_truck', 'toll_truckFlat', 'toll_delivery', 'toll_garbage', 'toll_ambulance'].includes(key) ? len * 0.28 : key === 'toll_tractor' ? -len * 0.12 : -len * 0.04;
  const style: HeadStyle = role === 'gran' ? 'gran' : role === 'police' ? 'police' : role === 'receipt' || role === 'ceo' ? 'business' : 'plain';
  const [face, fg] = role === 'gran' ? ['^_^', '#ffd1dc'] : role === 'police' ? ['o_o', '#5fa8ff'] : role === 'receipt' ? ['._.', '#ffffff'] : role === 'directions' ? ['?_?', '#ffd24f'] : role === 'ceo' ? ['$_$', '#ffd24f'] : FACES[Math.floor(Math.random() * FACES.length)];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const head = robotHead(color, face, fg, style, role === 'robot');
  head.position.set(-0.25, height - 0.28, cabZ);
  if (role === 'ceo') {
    // a tiny crown, because of course
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.1, 6, 1, true), new THREE.MeshStandardMaterial({ color: '#ffd24f', metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide }));
    crown.position.y = 0.5;
    crown.userData.own = true;
    head.add(crown);
  }
  head.userData.base = head.position.clone();
  head.userData.lean = new THREE.Vector3(-width / 2 - 0.22, height * 0.62, cabZ + 0.1);
  body.add(head);
  if (role === 'robot' && Math.random() < 0.3) {
    const kid = robotHead(COLORS[Math.floor(Math.random() * COLORS.length)], 'o_o', '#a3ff55', 'kid');
    kid.scale.setScalar(0.7);
    kid.position.set(0.3, height - 0.26, cabZ - 0.6);
    body.add(kid);
  }
  // roof beacon: green = transponder paid, red = must pay, violet = wants a human
  const beacon = new THREE.MeshBasicMaterial({ color: '#30ff60' });
  const bm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.22), beacon);
  bm.position.set(0.4, height - 0.02, cabZ + 0.25);
  body.add(bm);
  // lights, merged into one mesh each
  const fronts: THREE.BufferGeometry[] = [];
  const backs: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const h = new THREE.PlaneGeometry(0.28, 0.14);
    h.translate(s * width * 0.3, height * 0.35, len / 2 + 0.02);
    fronts.push(h);
    const t = new THREE.PlaneGeometry(0.24, 0.12);
    t.rotateY(Math.PI);
    t.translate(s * width * 0.32, height * 0.4, -len / 2 - 0.02);
    backs.push(t);
  }
  const fl = new THREE.Mesh(mergeGeometries(fronts), headLight);
  const bl = new THREE.Mesh(mergeGeometries(backs), tailLight);
  fl.userData.own = bl.userData.own = true;
  body.add(fl, bl);
  group.position.set(x, 0, z);
  const name = role === 'gran' ? 'RoboGran' : role === 'police' ? 'Officer Unit-0' : role === 'receipt' ? 'Executive Unit 5' : role === 'directions' ? 'Lost Van' : role === 'ceo' ? 'CEO-1' : ROBOT_NAMES[nameIdx++ % ROBOT_NAMES.length];
  const car: Car = {
    group,
    body,
    lane,
    role,
    name,
    x,
    z,
    speed: 0,
    cruise: 10,
    len,
    width,
    height,
    paid: role === 'paid' || role === 'robot',
    served: false,
    passed: false,
    atWindow: false,
    wait: 0,
    nextHonk: 1 + Math.random() * 2,
    threw: false,
    head,
    beacon,
    wheels,
    turned: 0,
    offroad: false,
    data: {},
    dead: false,
  };
  setBeacon(car);
  group.userData.interact = { kind: 'car', car };
  return car;
}

/** Frees the GPU buffers that belong to this car only (models and heads share theirs). */
export function disposeCar(car: Car): void {
  car.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.userData.own) m.geometry.dispose();
  });
}

export function setBeacon(car: Car): void {
  const c = car.role === 'robot' || car.role === 'paid' ? '#30ff60' : car.role === 'unpaid' ? (car.paid ? '#ffd24f' : '#ff3030') : car.role === 'police' ? '#4f8cff' : car.role === 'ceo' ? '#ffd24f' : '#c45cff';
  car.beacon.color.set(c);
}
