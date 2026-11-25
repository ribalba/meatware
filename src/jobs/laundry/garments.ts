import * as THREE from 'three';
import type { Item, ItemDef } from '../../items';
import { textTexture } from '../../util';
import { clothTex, PATTERNS } from './textures';

/**
 * Laundry as game data: garments with a ticket number, their stages (dry, folded, crumpled,
 * socks and pairs) and the meshes for each stage.
 */

export type GarmentKind = 'shirt' | 'tee' | 'trousers' | 'towel' | 'hoodie' | 'overalls' | 'cozy' | 'sock' | 'sheet';
/** dry: straight from the dryer. neat / crumpled: folded. single, pair, creative: socks. */
export type Stage = 'dry' | 'neat' | 'crumpled' | 'single' | 'pair' | 'creative';

interface KindSpec {
  name: string;
  /** Number of folds. */
  steps: number;
  colors: [string, string][];
  patterns: number[];
}

export const KINDS: Record<GarmentKind, KindSpec> = {
  shirt: { name: 'Work Shirt', steps: 5, colors: [['#e8ecf2', '#6f8fc0'], ['#bcd3ea', '#e8ecf2'], ['#f2e6c4', '#b04a3a']], patterns: [0, 5, 7] },
  tee: { name: 'T-Shirt', steps: 4, colors: [['#c0392b', '#f2e6c4'], ['#2e7d4f', '#e8e0c8'], ['#f1c40f', '#3a3a3a']], patterns: [5, 0, 4] },
  trousers: { name: 'Trousers', steps: 4, colors: [['#2c3e63', '#3d5480'], ['#b8a27a', '#9c8762'], ['#4a4a4f', '#5c5c62']], patterns: [5, 3] },
  towel: { name: 'Bath Towel', steps: 3, colors: [['#e67e22', '#f6e7c8'], ['#2e86c1', '#f2f2f2'], ['#d35486', '#f8d6e5']], patterns: [0, 7] },
  hoodie: { name: 'Heat Sink Hoodie', steps: 5, colors: [['#5d4a7a', '#8c78ad'], ['#3c5a3c', '#5f8a5f'], ['#7a2a2a', '#a04545']], patterns: [5, 3] },
  overalls: { name: 'Robot Overalls', steps: 6, colors: [['#e0782a', '#3b3b3b'], ['#3b6aa8', '#e6c34a']], patterns: [5, 3] },
  cozy: { name: 'Antenna Cozy', steps: 3, colors: [['#c0392b', '#f2e6c4'], ['#8e44ad', '#f1c40f'], ['#27ae60', '#f2f2f2']], patterns: [6, 2, 4] },
  sock: { name: 'Sock', steps: 0, colors: [['#c0392b', '#f2e6c4'], ['#2e86c1', '#f1c40f'], ['#27ae60', '#f2f2f2'], ['#8e44ad', '#e8e0c8'], ['#3a3a3a', '#e67e22'], ['#e8e0c8', '#6f8fc0'], ['#d35486', '#2c3e63'], ['#f1c40f', '#c0392b']], patterns: [0, 1, 2, 3, 4, 5, 6, 7] },
  sheet: { name: 'Fitted Sheet', steps: 8, colors: [['#f2f0ea', '#d8e4ef']], patterns: [5] },
};

export const CLOTHES: GarmentKind[] = ['shirt', 'shirt', 'tee', 'tee', 'trousers', 'towel', 'hoodie', 'overalls', 'cozy'];

export interface Garment {
  id: number;
  kind: GarmentKind;
  /** Ticket number = cubby number. 0 = no ticket (ancient lost sock). */
  ticket: number;
  shrunk: boolean;
  stage: Stage;
  pattern: number;
  colors: [string, string];
  /** The second sock of a pair. */
  pattern2?: number;
  colors2?: [string, string];
  /** The item that currently represents this garment, null while it is still in a dryer. */
  item: Item | null;
  /** Cubby it is filed in. */
  cubby: number | null;
  /** Counted for the quota (in the right cubby or handed over). */
  counted: boolean;
  sniffed: boolean;
}

let nextId = 1;
export function newGarment(kind: GarmentKind, ticket: number, shrunk = false, pattern?: number, colors?: [string, string]): Garment {
  const spec = KINDS[kind];
  const ci = Math.floor(Math.random() * spec.colors.length);
  return {
    id: nextId++,
    kind,
    ticket,
    shrunk,
    stage: kind === 'sock' ? 'single' : 'dry',
    pattern: pattern ?? spec.patterns[Math.floor(Math.random() * spec.patterns.length)],
    colors: colors ?? spec.colors[ci],
    item: null,
    cubby: null,
    counted: false,
    sniffed: false,
  };
}

export const patternName = (p: number) => PATTERNS[p % PATTERNS.length];
const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** Ready for a cubby: folded clothes and sock pairs. */
export const isFolded = (g: Garment) => g.stage === 'neat' || g.stage === 'crumpled' || g.stage === 'pair' || g.stage === 'creative';
/** Folded badly or otherwise embarrassing. */
export const isBad = (g: Garment) => g.stage === 'crumpled' || g.stage === 'creative' || g.shrunk;

export function garmentName(g: Garment): string {
  const tiny = g.shrunk ? 'Tiny ' : '';
  const base = KINDS[g.kind].name;
  switch (g.stage) {
    case 'dry':
      return `${tiny}${base}`;
    case 'neat':
      return `Folded ${tiny}${base}`;
    case 'crumpled':
      return g.kind === 'sheet' ? 'Fitted Sheet (balled up)' : `Crumpled ${tiny}${base}`;
    case 'single':
      return g.ticket === 0 ? 'Vintage Lost Sock (2049)' : `${tiny}${title(patternName(g.pattern))} Sock`;
    case 'pair':
      return `${tiny}Pair of ${title(patternName(g.pattern))} Socks`;
    case 'creative':
      return `${tiny}Creative Sock Pair`;
  }
}

// ---------------------------------------------------------------- materials

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function clothMat(pattern: number, c: [string, string], dark = false): THREE.MeshStandardMaterial {
  const key = `${pattern}/${c[0]}/${c[1]}/${dark}`;
  let m = matCache.get(key);
  if (!m) {
    const tex = clothTex(pattern, c[0], c[1]);
    m = new THREE.MeshStandardMaterial({ map: tex, color: dark ? '#9c958c' : '#ffffff', roughness: 0.95 });
    matCache.set(key, m);
  }
  return m;
}
function plain(color: string): THREE.MeshStandardMaterial {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    matCache.set(color, m);
  }
  return m;
}
const tagMats = new Map<number, THREE.MeshStandardMaterial>();
export function tagMat(n: number): THREE.MeshStandardMaterial {
  let m = tagMats.get(n);
  if (!m) {
    const t = textTexture([n ? `#${n}` : '?'], { w: 64, h: 48, bg: '#f7f1dc', fg: '#b3160c', border: '#b3160c', font: '"Press Start 2P", monospace' });
    t.magFilter = THREE.NearestFilter;
    m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
    tagMats.set(n, m);
  }
  return m;
}

/** A lumpy blob. Vertices that share a position get the same offset, so it stays closed. */
export function lumpGeo(r: number, amt: number, seed: number, detail = 1): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(r, detail);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const h = Math.sin(Math.round(x * 1000) * 0.1271 + Math.round(y * 1000) * 0.3117 + Math.round(z * 1000) * 0.0747 + seed * 13.3) * 43758.5453;
    const k = 1 + (h - Math.floor(h) - 0.5) * amt;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function add(g: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  g.add(mesh);
  return mesh;
}

function tag(g: THREE.Object3D, n: number, x: number, y: number, z: number, flat: boolean): void {
  const t = add(g, new THREE.BoxGeometry(0.075, flat ? 0.004 : 0.055, flat ? 0.055 : 0.004), [plain('#f7f1dc'), plain('#f7f1dc'), flat ? tagMat(n) : plain('#f7f1dc'), plain('#f7f1dc'), flat ? plain('#f7f1dc') : tagMat(n), plain('#f7f1dc')], x, y, z);
  t.rotation.y = flat ? 0.25 : 0;
}

// ---------------------------------------------------------------- meshes per stage

function sockMesh(g: THREE.Group, pattern: number, c: [string, string], x: number, rot: number): void {
  const s = new THREE.Group();
  const m = clothMat(pattern, c);
  add(s, new THREE.BoxGeometry(0.075, 0.035, 0.2), m, 0, 0.018, -0.05);
  add(s, new THREE.BoxGeometry(0.075, 0.035, 0.11), m, 0.03, 0.018, 0.08).rotation.y = -0.5;
  add(s, new THREE.BoxGeometry(0.08, 0.04, 0.03), plain(c[1]), 0, 0.02, -0.15);
  s.position.x = x;
  s.rotation.y = rot;
  g.add(s);
}

function bundle(g: THREE.Group, gm: Garment, tight: boolean): void {
  const m = clothMat(gm.pattern, gm.colors, tight);
  const seed = gm.id;
  const k = gm.kind;
  if (k === 'sheet') {
    const blob = add(g, lumpGeo(tight ? 0.2 : 0.26, 0.5, seed), m, 0, tight ? 0.17 : 0.2, 0);
    blob.scale.set(1.3, 0.75, 1.1);
    const elastic = plain('#e6e2d6');
    for (let i = 0; i < 4; i++) {
      const t = add(g, new THREE.TorusGeometry(0.08, 0.018, 5, 10, Math.PI), elastic, Math.cos(i * 1.7) * 0.25, 0.25 + (i % 2) * 0.06, Math.sin(i * 1.7) * 0.18);
      t.rotation.set(i, i * 0.7, 0);
    }
    return;
  }
  const r = tight ? 0.11 : 0.15;
  const blob = add(g, lumpGeo(r, tight ? 0.6 : 0.35, seed), m, 0, r * 0.7, 0);
  blob.scale.set(tight ? 1.0 : 1.4, tight ? 0.85 : 0.6, tight ? 0.95 : 1.1);
  if (k === 'towel') {
    add(g, new THREE.BoxGeometry(0.26, 0.02, 0.22), m, 0.05, 0.03, 0.1).rotation.y = 0.4;
  } else if (k === 'trousers' || k === 'overalls') {
    for (const s of [-1, 1]) {
      const leg = add(g, new THREE.BoxGeometry(0.09, 0.03, 0.3), m, s * 0.07, 0.03, 0.17);
      leg.rotation.y = s * (tight ? 1.2 : 0.2);
    }
    if (k === 'overalls') add(g, new THREE.BoxGeometry(0.03, 0.12, 0.02), plain('#d9d0b8'), 0.06, r * 1.1, -0.02).rotation.z = 0.6;
  } else if (k === 'hoodie') {
    const hood = add(g, new THREE.SphereGeometry(0.08, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), m, -0.06, r * 0.9, -0.06);
    hood.rotation.x = -0.5;
  } else if (k === 'cozy') {
    blob.scale.multiplyScalar(0.6);
    add(g, new THREE.ConeGeometry(0.05, 0.14, 8), m, 0.04, 0.12, 0).rotation.z = -0.8;
    add(g, new THREE.SphereGeometry(0.03, 6, 4), plain(gm.colors[1]), 0.1, 0.17, 0);
  }
  if (k === 'shirt' || k === 'tee' || k === 'hoodie') {
    const sleeve = add(g, new THREE.BoxGeometry(0.07, 0.03, 0.24), m, 0.15, 0.03, 0.08);
    sleeve.rotation.y = tight ? 2.2 : -0.7;
    if (tight) sleeve.rotation.x = -0.9;
  }
}

function neatStack(g: THREE.Group, gm: Garment): void {
  const m = clothMat(gm.pattern, gm.colors);
  const h = gm.kind === 'sheet' ? 0.09 : gm.kind === 'towel' || gm.kind === 'hoodie' || gm.kind === 'overalls' ? 0.08 : 0.06;
  add(g, new THREE.BoxGeometry(0.3, h, 0.3), m, 0, h / 2, 0);
  // fold lines
  add(g, new THREE.BoxGeometry(0.302, 0.006, 0.01), clothMat(gm.pattern, gm.colors, true), 0, h * 0.33, 0.146);
  add(g, new THREE.BoxGeometry(0.302, 0.006, 0.01), clothMat(gm.pattern, gm.colors, true), 0, h * 0.66, 0.146);
  if (gm.kind === 'shirt') add(g, new THREE.BoxGeometry(0.1, 0.012, 0.05), plain(gm.colors[0]), 0, h + 0.006, -0.1);
}

/** The mesh of a garment in its current stage. */
export function buildGarmentMesh(gm: Garment): THREE.Group {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  switch (gm.stage) {
    case 'dry':
      bundle(inner, gm, false);
      tag(inner, gm.ticket, 0.12, 0.08, 0.13, false);
      break;
    case 'crumpled':
      bundle(inner, gm, true);
      tag(inner, gm.ticket, 0.0, 0.2, 0.08, false);
      break;
    case 'neat':
      neatStack(inner, gm);
      tag(inner, gm.ticket, 0.08, gm.kind === 'sheet' ? 0.093 : 0.083, 0.08, true);
      break;
    case 'single':
      sockMesh(inner, gm.pattern, gm.colors, 0, 0.3);
      tag(inner, gm.ticket, 0.0, 0.04, -0.13, true);
      break;
    case 'pair':
    case 'creative': {
      const a = add(inner, lumpGeo(0.065, 0.25, gm.id), clothMat(gm.pattern, gm.colors), -0.06, 0.06, 0);
      a.scale.set(1, 0.9, 1.2);
      const b = add(inner, lumpGeo(0.065, 0.25, gm.id + 7), clothMat(gm.pattern2 ?? gm.pattern, gm.colors2 ?? gm.colors), 0.06, 0.06, 0);
      b.scale.set(1, 0.9, 1.2);
      tag(inner, gm.ticket, 0, 0.125, 0.02, true);
      break;
    }
  }
  if (gm.shrunk) inner.scale.setScalar(0.42);
  return g;
}

/** A fresh item definition for the garment's current stage. */
export function garmentDef(gm: Garment): ItemDef {
  const sock = gm.kind === 'sock';
  const sheet = gm.kind === 'sheet';
  return {
    id: `ld-${gm.kind}-${gm.stage}`,
    name: garmentName(gm),
    category: null,
    shape: 'box',
    color: gm.colors[0],
    label: [],
    weight: 0,
    pocketable: sock || gm.shrunk,
    holdPos: sheet && !isFolded(gm) ? [0.3, -0.42, -0.85] : [0.28, -0.3, -0.62],
    holdRotY: -0.4,
    pocketLine: sock ? 'You pocket the sock. Now you know where socks go. You always knew.' : `You pocket the ${garmentName(gm).toLowerCase()}. It fits. Because it shrank.`,
    pocketAchievement: sock ? 'sockThief' : undefined,
    build: () => buildGarmentMesh(gm),
    tags: ['laundry'],
  };
}

// ---------------------------------------------------------------- flat garments on the folding table

export interface Spread {
  group: THREE.Group;
  /** Size of the spread garment, before folding. */
  w: number;
  d: number;
}

/** The garment lying flat on the folding table, ready to be folded. */
export function buildSpread(gm: Garment): Spread {
  const g = new THREE.Group();
  const m = clothMat(gm.pattern, gm.colors);
  const t = 0.016;
  let w = 0.6;
  let d = 0.6;
  switch (gm.kind) {
    case 'shirt':
    case 'tee':
    case 'hoodie': {
      add(g, new THREE.BoxGeometry(0.5, t, 0.62), m, 0, t / 2, 0);
      for (const s of [-1, 1]) {
        const sl = add(g, new THREE.BoxGeometry(gm.kind === 'tee' ? 0.2 : 0.42, t, 0.15), m, s * (gm.kind === 'tee' ? 0.32 : 0.42), t / 2 + 0.001, -0.2);
        sl.rotation.y = s * -0.45;
      }
      add(g, new THREE.BoxGeometry(0.16, t + 0.004, 0.05), plain(gm.colors[1]), 0, t / 2 + 0.003, -0.3);
      if (gm.kind === 'hoodie') add(g, new THREE.BoxGeometry(0.24, t, 0.18), m, 0, t / 2, -0.4);
      w = gm.kind === 'tee' ? 1.0 : 1.3;
      d = 0.7;
      break;
    }
    case 'trousers':
    case 'overalls': {
      for (const s of [-1, 1]) {
        const leg = add(g, new THREE.BoxGeometry(0.2, t, 0.8), m, s * 0.12, t / 2, 0.1);
        leg.rotation.y = s * 0.08;
      }
      add(g, new THREE.BoxGeometry(0.46, t + 0.002, 0.14), m, 0, t / 2 + 0.001, -0.32);
      if (gm.kind === 'overalls') {
        add(g, new THREE.BoxGeometry(0.36, t, 0.3), m, 0, t / 2, -0.5);
        for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.04, t + 0.004, 0.25), plain(gm.colors[1]), s * 0.13, t / 2 + 0.003, -0.72);
      }
      w = 0.5;
      d = gm.kind === 'overalls' ? 1.3 : 0.95;
      break;
    }
    case 'towel':
      add(g, new THREE.BoxGeometry(0.9, t, 0.55), m, 0, t / 2, 0);
      w = 0.9;
      d = 0.55;
      break;
    case 'cozy':
      add(g, new THREE.BoxGeometry(0.22, t * 2, 0.34), m, 0, t, 0);
      add(g, new THREE.SphereGeometry(0.04, 6, 4), plain(gm.colors[1]), 0, 0.03, -0.18);
      w = 0.25;
      d = 0.4;
      break;
    case 'sheet': {
      add(g, new THREE.BoxGeometry(1.5, t, 1.0), m, 0, t / 2, 0);
      const elastic = plain('#dcd6c6');
      for (const [x, z, a] of [[-0.75, -0.5, 0], [0.75, -0.5, 1], [0.75, 0.5, 2], [-0.75, 0.5, 3]] as [number, number, number][]) {
        const c = add(g, new THREE.TorusGeometry(0.16, 0.025, 5, 10, Math.PI / 2), elastic, x * 0.85, 0.06, z * 0.8);
        c.rotation.set(Math.PI / 2, 0, a * (Math.PI / 2));
      }
      w = 1.5;
      d = 1.0;
      break;
    }
    case 'sock':
      sockMesh(g, gm.pattern, gm.colors, 0, 0);
      w = 0.1;
      d = 0.3;
      break;
  }
  if (gm.shrunk) {
    g.scale.setScalar(0.42);
    w *= 0.42;
    d *= 0.42;
  }
  return { group: g, w, d };
}

// ---------------------------------------------------------------- the toilet key

/** The toilet key, tied to an enormous novelty sock full of lost buttons. */
export const KEY_SOCK_DEF: ItemDef = {
  id: 'ld-keysock',
  name: 'Toilet Key (in a giant sock)',
  category: null,
  shape: 'box',
  color: '#c0392b',
  label: [],
  weight: 0,
  pocketable: false,
  toiletKey: true,
  heavy: 0.5,
  fixture: true,
  holdPos: [0.5, -0.78, -1.15],
  holdRotY: -0.5,
  carryAchievement: 'sockKey',
  pickupLine: 'You pick up the toilet key. It is tied to an enormous novelty sock. The sock is full of something heavy. It jingles like buttons.',
  build: () => {
    const g = new THREE.Group();
    const m = clothMat(0, ['#c0392b', '#f2e6c4']);
    // leg, hanging down from the top, then the foot pointing forward
    const leg = add(g, lumpGeo(0.2, 0.18, 99), m, 0, 0.55, 0);
    leg.scale.set(1, 2.6, 1);
    const foot = add(g, lumpGeo(0.21, 0.2, 98), m, 0, 0.18, 0.18);
    foot.scale.set(1, 0.9, 1.6);
    add(g, new THREE.BoxGeometry(0.46, 0.12, 0.44), plain('#f2e6c4'), 0, 1.06, 0);
    add(g, new THREE.SphereGeometry(0.09, 8, 6), plain('#f2e6c4'), 0, 0.2, 0.47);
    // the key on a short chain
    add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.16), plain('#bdc3c7'), 0.2, 1.0, 0.2);
    add(g, new THREE.BoxGeometry(0.06, 0.13, 0.014), new THREE.MeshStandardMaterial({ color: '#f1c40f', metalness: 0.8, roughness: 0.3 }), 0.2, 0.87, 0.2);
    // a label
    const lbl = textTexture(['TOILET', 'KEY'], { w: 96, h: 64, bg: '#ffffff', fg: '#c0392b', border: '#c0392b', font: '"Press Start 2P", monospace' });
    lbl.magFilter = THREE.NearestFilter;
    add(g, new THREE.PlaneGeometry(0.22, 0.15), new THREE.MeshStandardMaterial({ map: lbl }), 0, 0.62, 0.205);
    return g;
  },
};
