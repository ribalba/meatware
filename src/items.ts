import * as THREE from 'three';
import { instantiate } from './assets';
import { textTexture } from './util';
import type { Slot } from './world';

export type Category = 'CEREAL' | 'CANS' | 'PET FOOD' | 'PAPER' | 'FRUIT';
export const CATEGORIES: Category[] = ['CEREAL', 'CANS', 'PET FOOD', 'PAPER', 'FRUIT'];
export const CAT_COLORS: Record<Category, string> = {
  CEREAL: '#e67e22',
  CANS: '#c0392b',
  'PET FOOD': '#8e5a2b',
  PAPER: '#2e86c1',
  FRUIT: '#27ae60',
};

export type Shape = 'box' | 'can' | 'bag' | 'paper' | 'banana' | 'apple' | 'nothing' | 'tire' | 'frame';

export interface ItemDef {
  id: string;
  name: string;
  category: Category | null;
  shape: Shape;
  color: string;
  fg?: string;
  label: string[];
  /** Weight for random pallet picks. 0 means never from the pallet. */
  weight: number;
  pocketable: boolean;
  /** Key in the model manifest. Without a loaded model the primitive shape is used. */
  model?: string;
  /** Color multiplied onto the model, to tell variants apart. */
  tint?: string;
  /** Opens the staff toilet when held at its door. */
  toiletKey?: boolean;
  /** Walking speed factor while holding it (1 = normal). */
  heavy?: number;
  /** Where it sits in the hands, in camera space, and its turn. */
  holdPos?: [number, number, number];
  holdRotY?: number;
  /** Shown when the player picks it up. */
  pickupLine?: string;
  /** Shown when the player pockets it (default: generic line). */
  pocketLine?: string;
  /** Achievement id unlocked when pocketed. */
  pocketAchievement?: string;
  /** Achievement id unlocked when carried far and used (toilet keys). */
  carryAchievement?: string;
  /** Not refused by customers and robots, and ignored by floor checks. */
  fixture?: boolean;
  /** Custom mesh for job specific items. Should be roughly centered with its base near y = 0. */
  build?: () => THREE.Group;
  /** Free tags for job logic (for example 'shirt', 'patty'). */
  tags?: string[];
}

export const ITEM_DEFS: ItemDef[] = [
  { id: 'cruncho', name: "Cruncho-O's", category: 'CEREAL', shape: 'box', color: '#f28c28', label: ["CRUNCHO-O'S", 'now 12% crunchier'], weight: 10, pocketable: true },
  { id: 'sadflakes', name: 'Sad Flakes', category: 'CEREAL', shape: 'box', color: '#7f8c8d', label: ['SAD FLAKES', 'a joyless breakfast'], weight: 8, pocketable: true },
  { id: 'dogcereal', name: 'Dog Food for Humans', category: 'CEREAL', shape: 'box', color: '#6b8e23', label: ['DOG FOOD', 'for humans.', 'it is cereal.'], weight: 4, pocketable: true },
  { model: 'can', id: 'beans', name: 'Beans of Destiny', category: 'CANS', shape: 'can', color: '#c0392b', label: ['BEANS', 'of destiny'], weight: 10, pocketable: true },
  { model: 'can', tint: '#9ec5ff', id: 'soup', name: 'Soup (Probably)', category: 'CANS', shape: 'can', color: '#2471a3', label: ['SOUP', '(probably)'], weight: 8, pocketable: true },
  { model: 'bag', id: 'wuffles', name: 'Wuffles Dog Chow', category: 'PET FOOD', shape: 'bag', color: '#8e5a2b', label: ['WUFFLES', 'dog chow'], weight: 9, pocketable: true },
  { model: 'canSmall', tint: '#e0b3ff', id: 'catpaste', name: 'Cat Paste', category: 'PET FOOD', shape: 'can', color: '#8e44ad', label: ['CAT PASTE', 'cats love it (unverified)'], weight: 7, pocketable: true },
  { model: 'toiletPaper', id: 'softy', name: 'Softy 48-Roll', category: 'PAPER', shape: 'paper', color: '#f4f6f7', fg: '#2e86c1', label: ['SOFTY', '48 rolls', '1-ply'], weight: 9, pocketable: true },
  { model: 'toiletPaper', tint: '#c9a46b', id: 'sandpaper', name: 'Sandpaper Deluxe 2-Ply', category: 'PAPER', shape: 'paper', color: '#d4b483', fg: '#5d4037', label: ['SANDPAPER', 'deluxe 2-ply', 'toilet tissue'], weight: 5, pocketable: true },
  { model: 'banana', id: 'bananas', name: 'Bananas', category: 'FRUIT', shape: 'banana', color: '#f7dc6f', label: [], weight: 9, pocketable: true },
  { model: 'apple', id: 'apple', name: 'Apple (Waxed Twice)', category: 'FRUIT', shape: 'apple', color: '#c0392b', label: [], weight: 7, pocketable: true },
  { id: 'nothing', name: '1 x Nothing (SKU 0000)', category: null, shape: 'nothing', color: '#000000', label: [], weight: 1.5, pocketable: true },
];

export const TIRE_DEF: ItemDef = {
  model: 'tire', id: 'tire', name: 'Toilet Key (attached to a car tire)', category: null, shape: 'tire', color: '#222222', label: [], weight: 0, pocketable: false,
  toiletKey: true, heavy: 0.55, holdPos: [0.7, -0.7, -1.3], holdRotY: -1.1, fixture: true, carryAchievement: 'tire',
  pickupLine: 'You pick up the toilet key. It is attached to a car tire. Of course it is.',
};
export const FRAME_DEF: ItemDef = {
  id: 'frame', name: 'Employee of the Month Frame', category: null, shape: 'frame', color: '#6e4b2a', label: [], weight: 0, pocketable: true,
  holdPos: [0.28, -0.3, -0.8], fixture: true, pocketAchievement: 'employee',
  pickupLine: 'Employee of the Month: The Coffee Machine. Again.',
  pocketLine: 'You fold the frame into your pocket. Somehow it fits.',
};

export function randomPalletDef(): ItemDef {
  const total = ITEM_DEFS.reduce((s, d) => s + d.weight, 0);
  let r = Math.random() * total;
  for (const d of ITEM_DEFS) {
    r -= d.weight;
    if (r <= 0) return d;
  }
  return ITEM_DEFS[0];
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function colorMat(c: string, roughness = 0.7): THREE.MeshStandardMaterial {
  const key = `${c}/${roughness}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: c, roughness });
    matCache.set(key, m);
  }
  return m;
}
const labelCache = new Map<string, THREE.MeshStandardMaterial>();
function labelMat(def: ItemDef, w: number, h: number, key = def.id): THREE.MeshStandardMaterial {
  let m = labelCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: textTexture(def.label, { w, h, bg: def.color, fg: def.fg ?? '#ffffff', border: def.fg ?? '#ffffff' }),
      roughness: 0.6,
    });
    labelCache.set(key, m);
  }
  return m;
}

/** The model version of an item, centered on the origin, with the label as a sticker on the front. */
function buildModelItem(def: ItemDef): THREE.Group | null {
  if (!def.model) return null;
  const inst = instantiate(def.model);
  if (!inst) return null;
  const g = new THREE.Group();
  const obj = inst.object;
  if (def.tint) {
    const tint = new THREE.Color(def.tint);
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((mat) => {
        const c = mat.clone() as THREE.MeshStandardMaterial;
        c.color?.multiply(tint);
        return c;
      });
      m.material = Array.isArray(m.material) ? mats : mats[0];
    });
  }
  g.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  obj.position.sub(center);
  const size = box.getSize(new THREE.Vector3());
  if (def.label.length) {
    const w = size.x * 0.9;
    const h = Math.min(size.y * 0.55, w * 0.8);
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(w, h), labelMat(def, 256, Math.round((256 * h) / w), `sticker:${def.id}`));
    sticker.position.set(0, 0, size.z / 2 + 0.004);
    g.add(sticker);
  }
  if (def.shape === 'tire') {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12), colorMat('#bdc3c7', 0.3));
    chain.position.set(0, -size.y / 2 - 0.06, 0);
    g.add(chain);
    const key = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.012), new THREE.MeshStandardMaterial({ color: '#f1c40f', metalness: 0.8, roughness: 0.3 }));
    key.position.set(0, -size.y / 2 - 0.16, 0);
    g.add(key);
  }
  return g;
}

export function buildItemMesh(def: ItemDef): THREE.Group {
  if (def.build) return def.build();
  const model = buildModelItem(def);
  if (model) return model;
  const g = new THREE.Group();
  switch (def.shape) {
    case 'box':
    case 'bag':
    case 'paper': {
      const [w, h, d] = def.shape === 'box' ? [0.3, 0.42, 0.1] : def.shape === 'bag' ? [0.34, 0.46, 0.14] : [0.42, 0.3, 0.28];
      const side = colorMat(def.color);
      const front = labelMat(def, 256, Math.round((256 * h) / w));
      g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, front, front]));
      break;
    }
    case 'can': {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.17, 20), [labelMat(def, 512, 200), colorMat('#bbbbbb', 0.3), colorMat('#bbbbbb', 0.3)]);
      m.rotation.y = Math.PI; // texture center faces the front
      g.add(m);
      break;
    }
    case 'banana': {
      const yellow = colorMat(def.color, 0.5);
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 8, 16, Math.PI * 0.65), yellow);
        b.rotation.z = Math.PI * 1.15;
        b.rotation.y = (i - 1) * 0.35;
        b.position.set((i - 1) * 0.03, 0.14, 0);
        g.add(b);
      }
      break;
    }
    case 'apple': {
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), colorMat(def.color, 0.25)));
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05), colorMat('#5d4037'));
      stem.position.y = 0.1;
      g.add(stem);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), colorMat('#27ae60'));
      leaf.scale.set(1.6, 0.4, 0.8);
      leaf.position.set(0.025, 0.11, 0);
      g.add(leaf);
      break;
    }
    case 'nothing': {
      // Invisible, but still clickable.
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
      break;
    }
    case 'tire': {
      g.add(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.11, 12, 24), colorMat('#1c1c1c', 0.9)));
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 20), colorMat('#95a5a6', 0.3));
      rim.rotation.x = Math.PI / 2;
      g.add(rim);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12), colorMat('#bdc3c7', 0.3));
      chain.position.set(0, -0.44, 0);
      g.add(chain);
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.012), new THREE.MeshStandardMaterial({ color: '#f1c40f', metalness: 0.8, roughness: 0.3 }));
      key.position.set(0, -0.54, 0);
      g.add(key);
      break;
    }
    case 'frame': {
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.46, 0.04), colorMat(def.color)));
      const pic = new THREE.Mesh(
        new THREE.PlaneGeometry(0.54, 0.38),
        new THREE.MeshStandardMaterial({ map: textTexture(['EMPLOYEE', 'OF THE MONTH', 'The Coffee Machine', '(again)'], { w: 384, h: 270, bg: '#fdf6e3', fg: '#2c3e50' }) }),
      );
      pic.position.z = 0.021;
      g.add(pic);
      break;
    }
  }
  return g;
}

export type ItemState = 'held' | 'shelf' | 'world' | 'fixed' | 'gone';

export class Item {
  mesh: THREE.Group;
  baseOffset: number;
  state: ItemState = 'world';
  vel = new THREE.Vector3();
  slot: Slot | null = null;
  thrown = false;
  inspected = false;
  sleeping = false;
  /** Thrown on the floor by the toddler. */
  knockedOff = false;
  def: ItemDef;

  constructor(def: ItemDef) {
    this.def = def;
    this.mesh = buildItemMesh(def);
    const box = new THREE.Box3().setFromObject(this.mesh);
    this.baseOffset = def.shape === 'nothing' ? 0.11 : -box.min.y;
    this.mesh.userData.interact = { kind: 'item', item: this };
  }
}
