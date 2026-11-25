import * as THREE from 'three';
import { instantiate } from '../../assets';
import type { Item, ItemDef } from '../../items';
import { textTexture } from '../../util';
import { linerTex } from './textures';

/**
 * Burger ingredients, sides, trays and the odd tools of MEGABYTE BURGER.
 * Every piece is built from a few primitives so it reads well at the low retro resolution.
 */

export type Ing = 'BUN' | 'PATTY' | 'CHEESE' | 'LETTUCE' | 'TOMATO' | 'ONION';
export const INGS: Ing[] = ['BUN', 'PATTY', 'CHEESE', 'LETTUCE', 'TOMATO', 'ONION'];
export type PattyQ = 'raw' | 'perfect' | 'burnt' | 'charcoal';
export type FryQ = 'soggy' | 'golden' | 'burnt';

/** One layer of a burger on a tray. */
export interface Piece {
  ing: Ing;
  q?: PattyQ;
  floor?: boolean;
}

/** What lies on a tray. */
export interface TrayData {
  stack: Piece[];
  fries: { q: FryQ; floor: boolean }[];
  nuggets: number;
  floor: boolean;
}

const mats = new Map<string, THREE.MeshStandardMaterial>();
export function m(color: string, roughness = 0.7, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const key = `${color}/${roughness}/${JSON.stringify(extra)}`;
  let mm = mats.get(key);
  if (!mm) {
    mm = new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    mats.set(key, mm);
  }
  return mm;
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D): THREE.Mesh {
  const me = new THREE.Mesh(geo, mat);
  me.position.set(x, y, z);
  parent?.add(me);
  return me;
}

export const PATTY_COLORS: Record<PattyQ, string> = { raw: '#c9757b', perfect: '#6e4024', burnt: '#2f1e15', charcoal: '#131010' };
export const FRY_COLORS: Record<FryQ, string> = { soggy: '#efe2a2', golden: '#e8b23a', burnt: '#5a3514' };

/** Height of a layer in the stack. */
export function pieceHeight(ing: Ing, top: boolean): number {
  switch (ing) {
    case 'BUN':
      return top ? 0.065 : 0.036;
    case 'PATTY':
      return 0.034;
    case 'CHEESE':
      return 0.01;
    case 'LETTUCE':
      return 0.016;
    case 'TOMATO':
      return 0.016;
    case 'ONION':
      return 0.014;
  }
}

/** Builds one burger layer, base at y = 0. `top` makes a bun a domed top bun. */
export function pieceMesh(p: Piece, top = false): THREE.Group {
  const g = new THREE.Group();
  const floorTint = p.floor ? 0.75 : 1;
  const tint = (c: string) => '#' + new THREE.Color(c).multiplyScalar(floorTint).getHexString();
  switch (p.ing) {
    case 'BUN': {
      const bun = m(tint('#d99a4e'), 0.8);
      if (top) {
        const dome = mesh(new THREE.SphereGeometry(0.115, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), bun, 0, 0.012, 0, g);
        dome.scale.y = 0.48;
        mesh(new THREE.CylinderGeometry(0.115, 0.11, 0.014, 12), m(tint('#f0d9a8'), 0.9), 0, 0.007, 0, g);
        const seed = m('#fbf3d6', 0.6);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + i;
          const d = 0.03 + (i % 3) * 0.022;
          const s = mesh(new THREE.BoxGeometry(0.012, 0.006, 0.007), seed, Math.cos(a) * d, 0.012 + Math.sqrt(Math.max(0, 0.0132 - d * d)) * 0.48 * 4.2, Math.sin(a) * d, g);
          s.rotation.y = a;
        }
      } else {
        mesh(new THREE.CylinderGeometry(0.11, 0.105, 0.036, 12), bun, 0, 0.018, 0, g);
        mesh(new THREE.CylinderGeometry(0.106, 0.106, 0.004, 12), m(tint('#f0d9a8'), 0.9), 0, 0.037, 0, g);
      }
      break;
    }
    case 'PATTY': {
      const q = p.q ?? 'perfect';
      mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.034, 12), m(tint(PATTY_COLORS[q]), 0.9), 0, 0.017, 0, g);
      if (q === 'perfect') {
        const sear = m('#3e2212', 0.9);
        for (const dz of [-0.04, 0, 0.04]) mesh(new THREE.BoxGeometry(0.17, 0.003, 0.008), sear, 0, 0.035, dz, g);
      }
      if (q === 'raw') {
        const frost = m('#f4e6ea', 0.5);
        for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(0.02, 0.003, 0.015), frost, Math.cos(i * 2.1) * 0.06, 0.035, Math.sin(i * 2.1) * 0.05, g);
      }
      break;
    }
    case 'CHEESE': {
      const c = mesh(new THREE.BoxGeometry(0.17, 0.01, 0.17), m(tint('#f2b52c'), 0.5), 0, 0.005, 0, g);
      c.rotation.y = Math.PI / 4;
      for (const s of [-1, 1]) {
        const drip = mesh(new THREE.BoxGeometry(0.03, 0.03, 0.006), m(tint('#f2b52c'), 0.5), s * 0.085, -0.008, s * 0.085, g);
        drip.rotation.y = Math.PI / 4;
      }
      break;
    }
    case 'LETTUCE': {
      const shape = new THREE.Shape();
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = 0.12 + (i % 2 ? 0.018 : -0.006);
        if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      mesh(geo, m(tint('#58a83a'), 0.8), 0, 0, 0, g);
      mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.004, 8), m(tint('#9fd46a'), 0.8), 0.02, 0.013, 0, g);
      break;
    }
    case 'TOMATO': {
      const red = m(tint('#d9372a'), 0.5);
      const inner = m(tint('#f06a50'), 0.5);
      for (const [x, z] of [[-0.045, -0.02], [0.045, 0.02]]) {
        mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.016, 10), red, x, 0.008, z, g);
        mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.003, 10), inner, x, 0.017, z, g);
      }
      break;
    }
    case 'ONION': {
      const onion = m(tint('#e9dcef'), 0.5);
      for (const [x, z, r] of [[-0.03, 0, 0.055], [0.04, 0.02, 0.045], [0, -0.04, 0.035]]) {
        const ring = mesh(new THREE.TorusGeometry(r, 0.007, 4, 12), onion, x, 0.007, z, g);
        ring.rotation.x = Math.PI / 2;
      }
      break;
    }
  }
  return g;
}

/** A fries carton, fries colored by quality. */
export function friesMesh(q: FryQ, floor = false): THREE.Group {
  const g = new THREE.Group();
  const carton = mesh(new THREE.CylinderGeometry(0.06, 0.042, 0.11, 4, 1, true), m(floor ? '#8a2a20' : '#c8302a', 0.6, { side: THREE.DoubleSide }), 0, 0.055, 0, g);
  carton.rotation.y = Math.PI / 4;
  mesh(new THREE.BoxGeometry(0.05, 0.03, 0.002), m('#f2c230', 0.6), 0, 0.06, 0.043, g);
  const fry = m(floor ? '#8a7a40' : FRY_COLORS[q], 0.7);
  for (let i = 0; i < 11; i++) {
    const f = mesh(new THREE.BoxGeometry(0.012, 0.1, 0.012), fry, ((i % 4) - 1.5) * 0.017, 0.1 + (i % 3) * 0.012, (Math.floor(i / 4) - 1) * 0.018, g);
    f.rotation.z = ((i * 37) % 7 - 3) * 0.05;
    f.rotation.x = ((i * 13) % 5 - 2) * 0.06;
  }
  return g;
}

/** A small nugget box with four nuggets peeking out. */
export function nuggetMesh(): THREE.Group {
  const g = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.13, 0.055, 0.09), m('#e8c23a', 0.7), 0, 0.0275, 0, g);
  mesh(new THREE.BoxGeometry(0.132, 0.012, 0.092), m('#c0392b', 0.7), 0, 0.03, 0, g);
  const lid = mesh(new THREE.BoxGeometry(0.13, 0.004, 0.09), m('#e8c23a', 0.7), 0, 0.085, -0.075, g);
  lid.rotation.x = -1.2;
  const nug = m('#b8792c', 0.9);
  for (let i = 0; i < 4; i++) {
    const n = mesh(new THREE.SphereGeometry(0.022, 6, 4), nug, -0.042 + i * 0.028, 0.06, (i % 2) * 0.02 - 0.01, g);
    n.scale.set(1.2, 0.7, 1);
  }
  return g;
}

function labelPlane(lines: string[], w: number, h: number, bg: string, fg: string): THREE.Mesh {
  const tex = textTexture(lines, { w: 128, h: Math.round((128 * h) / w), bg, fg, border: fg, font: '"Press Start 2P", monospace' });
  tex.magFilter = THREE.NearestFilter;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
}

// ------------------------------------------------------------------ item definitions

const ING_INFO: Record<Exclude<Ing, 'PATTY'>, { name: string; pocket: string }> = {
  BUN: { name: 'Bun', pocket: 'You pocket a bun. It is soft. It is evidence.' },
  CHEESE: { name: 'Cheese Slice', pocket: 'You pocket a cheese slice. It sticks to your leg. Forever.' },
  LETTUCE: { name: 'Lettuce', pocket: 'You pocket the lettuce. The healthiest thing you did all year.' },
  TOMATO: { name: 'Tomato Slices', pocket: 'You pocket the tomato. Your trousers turn slightly red.' },
  ONION: { name: 'Onion Rings (raw)', pocket: 'You pocket the onion. Your pocket starts crying.' },
};

function ingDef(ing: Exclude<Ing, 'PATTY'>): ItemDef {
  const info = ING_INFO[ing];
  return {
    id: `bg-ing-${ing.toLowerCase()}`,
    name: info.name,
    category: null,
    shape: 'box',
    color: '#000000',
    label: [],
    weight: 0,
    pocketable: true,
    holdPos: [0.26, -0.26, -0.55],
    holdRotY: 0,
    pocketLine: info.pocket,
    tags: ['food', 'ing', ing],
    build: () => {
      const g = new THREE.Group();
      g.add(pieceMesh({ ing }, ing === 'BUN'));
      g.scale.setScalar(1.15);
      return g;
    },
  };
}

export const ING_DEFS: Record<Exclude<Ing, 'PATTY'>, ItemDef> = {
  BUN: ingDef('BUN'),
  CHEESE: ingDef('CHEESE'),
  LETTUCE: ingDef('LETTUCE'),
  TOMATO: ingDef('TOMATO'),
  ONION: ingDef('ONION'),
};

const PATTY_NAMES: Record<PattyQ, string> = { raw: 'Raw Patty (frozen since 2069)', perfect: 'Patty (perfect)', burnt: 'Patty (well done, very)', charcoal: 'Patty (charcoal)' };
function pattyDef(q: PattyQ): ItemDef {
  return {
    id: `bg-patty-${q}`,
    name: PATTY_NAMES[q],
    category: null,
    shape: 'box',
    color: '#000000',
    label: [],
    weight: 0,
    pocketable: true,
    holdPos: [0.26, -0.26, -0.55],
    holdRotY: 0,
    pocketLine: q === 'raw' ? 'You pocket a frozen raw patty. Your leg is now refrigerated.' : 'You pocket a hot patty. It is like a hand warmer. Made of beef. Probably.',
    tags: ['food', 'patty', q],
    build: () => {
      const g = new THREE.Group();
      g.add(pieceMesh({ ing: 'PATTY', q }));
      g.scale.setScalar(1.15);
      return g;
    },
  };
}
export const PATTY_DEFS: Record<PattyQ, ItemDef> = { raw: pattyDef('raw'), perfect: pattyDef('perfect'), burnt: pattyDef('burnt'), charcoal: pattyDef('charcoal') };

const FRY_NAMES: Record<FryQ, string> = { soggy: 'Fries (soggy)', golden: 'Fries (golden)', burnt: 'Fries (extra crispy, very)' };
function fryDef(q: FryQ): ItemDef {
  return {
    id: `bg-fries-${q}`,
    name: FRY_NAMES[q],
    category: null,
    shape: 'box',
    color: '#000000',
    label: [],
    weight: 0,
    pocketable: true,
    holdPos: [0.27, -0.3, -0.55],
    holdRotY: -0.3,
    pocketLine: 'You pocket a handful of fries. Your leg is warm. Your hands are shiny.',
    tags: ['food', 'fries', q],
    build: () => friesMesh(q),
  };
}
export const FRY_DEFS: Record<FryQ, ItemDef> = { soggy: fryDef('soggy'), golden: fryDef('golden'), burnt: fryDef('burnt') };

export const FROZEN_FRIES_DEF: ItemDef = {
  id: 'bg-frozenfries',
  name: 'Bag of Frozen Fries',
  category: null,
  shape: 'box',
  color: '#000000',
  label: [],
  weight: 0,
  pocketable: true,
  holdPos: [0.3, -0.32, -0.6],
  holdRotY: -0.4,
  pocketLine: 'You pocket a whole bag of frozen fries. Your thigh goes numb. Worth it.',
  tags: ['food', 'frozenFries'],
  build: () => {
    const g = new THREE.Group();
    mesh(new THREE.BoxGeometry(0.2, 0.28, 0.07), m('#e9eef2', 0.6), 0, 0.14, 0, g);
    const lab = labelPlane(['FROZEN', 'FRIES', '3% potato'], 0.17, 0.2, '#2c64b4', '#f2d24b');
    lab.position.set(0, 0.14, 0.036);
    g.add(lab);
    return g;
  },
};

export const NUGGET_DEF: ItemDef = {
  id: 'bg-nuggets',
  name: 'Nugget Box (10 nuggets)',
  category: null,
  shape: 'box',
  color: '#000000',
  label: [],
  weight: 0,
  pocketable: true,
  holdPos: [0.26, -0.28, -0.55],
  holdRotY: -0.2,
  pocketLine: 'You pocket ten nuggets. They have been under the heat lamp since Tuesday. They are still warm.',
  tags: ['food', 'nuggets'],
  build: nuggetMesh,
};

export const TRAY_DEF: ItemDef = {
  id: 'bg-tray',
  name: 'Tray',
  category: null,
  shape: 'box',
  color: '#000000',
  label: [],
  weight: 0,
  pocketable: false,
  holdPos: [0.05, -0.45, -0.62],
  holdRotY: 0,
  tags: ['food', 'tray'],
  build: () => {
    const g = new THREE.Group();
    const plastic = m('#7a2a1c', 0.5);
    mesh(new THREE.BoxGeometry(0.46, 0.014, 0.34), plastic, 0, 0.007, 0, g);
    for (const s of [-1, 1]) {
      mesh(new THREE.BoxGeometry(0.46, 0.03, 0.012), plastic, 0, 0.015, s * 0.17, g);
      mesh(new THREE.BoxGeometry(0.012, 0.03, 0.34), plastic, s * 0.23, 0.015, 0, g);
    }
    const liner = mesh(new THREE.PlaneGeometry(0.42, 0.3), new THREE.MeshStandardMaterial({ map: linerTex(), roughness: 0.9 }), 0, 0.0145, 0, g);
    liner.rotation.x = -Math.PI / 2;
    const stack = new THREE.Group();
    stack.name = 'stack';
    stack.position.y = 0.015;
    g.add(stack);
    return g;
  },
};

export const EXTINGUISHER_DEF: ItemDef = {
  id: 'bg-extinguisher',
  name: 'Fire Extinguisher',
  category: null,
  shape: 'box',
  color: '#000000',
  label: [],
  weight: 0,
  pocketable: false,
  fixture: true,
  holdPos: [0.32, -0.42, -0.62],
  holdRotY: 0.2,
  pickupLine: 'You take the fire extinguisher. Using it costs a refill. The refill costs you.',
  tags: ['extinguisher'],
  build: () => {
    const g = new THREE.Group();
    const red = m('#c0201a', 0.4, { metalness: 0.3 });
    mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 10), red, 0, 0.21, 0, g);
    const cap = mesh(new THREE.SphereGeometry(0.075, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), red, 0, 0.42, 0, g);
    cap.scale.y = 0.6;
    const black = m('#1a1a1a', 0.6);
    mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 6), black, 0, 0.48, 0, g);
    const handle = mesh(new THREE.BoxGeometry(0.12, 0.015, 0.03), black, 0.03, 0.52, 0, g);
    handle.rotation.z = -0.2;
    const hose = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 5), black, 0.09, 0.36, 0.02, g);
    hose.rotation.z = 0.25;
    mesh(new THREE.CylinderGeometry(0.02, 0.012, 0.07, 6), black, 0.12, 0.2, 0.03, g);
    const lab = labelPlane(['FIRE', 'not billable'], 0.11, 0.12, '#f2f2e8', '#b3160c');
    lab.position.set(0, 0.2, 0.076);
    g.add(lab);
    return g;
  },
};

/** The toilet key. It is attached to a whole frozen chicken. It drips. */
export const CHICKEN_DEF: ItemDef = {
  id: 'bg-chicken',
  name: 'Toilet Key (attached to a frozen chicken)',
  category: null,
  shape: 'box',
  color: '#000000',
  label: [],
  weight: 0,
  pocketable: false,
  toiletKey: true,
  heavy: 0.6,
  fixture: true,
  holdPos: [0.24, -0.36, -0.85],
  holdRotY: -0.9,
  carryAchievement: 'bgChicken',
  pickupLine: 'You take the toilet key. It is tied to a whole frozen chicken. It is very cold. It is dripping.',
  tags: ['chicken'],
  build: () => {
    const g = new THREE.Group();
    const ice = (o: THREE.Object3D) =>
      o.traverse((c) => {
        const me = c as THREE.Mesh;
        if (!me.isMesh) return;
        const fix = (mat: THREE.Material) => {
          const cl = mat.clone() as THREE.MeshStandardMaterial;
          // A raw, frozen bird: pale skin with a blue frost tint instead of the roast texture.
          cl.map = null;
          cl.color = new THREE.Color('#efe0cf');
          cl.emissive = new THREE.Color('#1a2a3a');
          cl.roughness = 0.35;
          return cl;
        };
        me.material = Array.isArray(me.material) ? me.material.map(fix) : fix(me.material);
      });
    const inst = instantiate('bg_turkey');
    let top = 0.3;
    if (inst) {
      ice(inst.object);
      g.add(inst.object);
      const box = new THREE.Box3().setFromObject(inst.object);
      inst.object.position.y -= box.min.y;
      top = box.max.y - box.min.y;
    } else {
      const skin = m('#e8dcc8', 0.5);
      const body = mesh(new THREE.SphereGeometry(0.2, 10, 8), skin, 0, 0.16, 0, g);
      body.scale.set(1.2, 0.8, 1);
      for (const s of [-1, 1]) {
        const leg = mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.2, 6), skin, s * 0.12, 0.26, 0.12, g);
        leg.rotation.x = -0.9;
      }
    }
    const frost = m('#f4fbff', 0.3, { transparent: true, opacity: 0.85 });
    for (let i = 0; i < 6; i++) {
      const ic = mesh(new THREE.ConeGeometry(0.012, 0.06, 4), frost, -0.15 + i * 0.06, 0.0, ((i * 7) % 5 - 2) * 0.03, g);
      ic.rotation.x = Math.PI;
    }
    const string = m('#d8cfb8', 0.9);
    mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 4), string, 0, top + 0.08, 0, g);
    const key = mesh(new THREE.BoxGeometry(0.05, 0.11, 0.012), new THREE.MeshStandardMaterial({ color: '#f1c40f', metalness: 0.8, roughness: 0.3 }), 0.05, top + 0.12, 0, g);
    key.rotation.z = 0.5;
    const tag = labelPlane(['WC'], 0.08, 0.05, '#ffffff', '#b3160c');
    tag.position.set(-0.05, top + 0.13, 0.008);
    g.add(tag);
    return g;
  },
};

// ------------------------------------------------------------------ tray handling

const trays = new WeakMap<Item, TrayData>();

export function trayData(it: Item): TrayData {
  let d = trays.get(it);
  if (!d) {
    d = { stack: [], fries: [], nuggets: 0, floor: false };
    trays.set(it, d);
  }
  return d;
}

export function isTray(it: Item | null | undefined): boolean {
  return !!it && it.def.id === TRAY_DEF.id;
}

/** Rebuilds the visible contents of a tray. */
export function renderTray(it: Item): void {
  const d = trayData(it);
  const stack = it.mesh.getObjectByName('stack');
  if (!stack) return;
  for (const c of [...stack.children]) stack.remove(c);
  let y = 0;
  d.stack.forEach((p, i) => {
    const top = p.ing === 'BUN' && i === d.stack.length - 1 && i > 0;
    const pm = pieceMesh(p, top);
    pm.position.set(-0.08, y, 0);
    pm.rotation.y = (i % 3) * 0.3;
    stack.add(pm);
    y += pieceHeight(p.ing, top) * (p.ing === 'CHEESE' ? 1 : 0.92);
  });
  d.fries.forEach((f, i) => {
    const fm = friesMesh(f.q, f.floor);
    fm.position.set(0.14, 0, -0.08 + (i % 3) * 0.06);
    stack.add(fm);
  });
  for (let i = 0; i < d.nuggets; i++) {
    const nm = nuggetMesh();
    nm.position.set(0.14 + (i % 2) * 0.01, i * 0.056, 0.1);
    nm.rotation.y = (i % 2) * 0.2;
    stack.add(nm);
  }
}

/** Short text of what is on a tray, bottom first. */
export function trayText(d: TrayData): string {
  const parts = d.stack.map((p) => (p.ing === 'PATTY' && p.q && p.q !== 'perfect' ? `PATTY(${p.q})` : p.ing));
  const sides: string[] = [];
  if (d.fries.length) sides.push(`${d.fries.length}x FRIES`);
  if (d.nuggets) sides.push(`${d.nuggets * 10} NUGGETS`);
  const s = parts.length ? parts.join(' > ') : 'empty';
  return sides.length ? `${s} + ${sides.join(' + ')}` : s;
}
