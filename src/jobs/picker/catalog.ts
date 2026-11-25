import * as THREE from 'three';
import type { ItemDef } from '../../items';
import { textTexture } from '../../util';
import { boxMaterials } from '../../details';

/**
 * The EVERYTHING DEPOT catalog. Every product is a job item with its own little mesh.
 * `size` decides which box it fits in (1 = L, 2 = XL, 3 = XXL).
 */

export interface Product {
  def: ItemDef;
  size: 1 | 2 | 3;
  /** Color of the stock shown in the bins. Null for products you cannot see. */
  stock: string | null;
  /** How the scanner writes it. */
  scan: string;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();
function m(color: string, roughness = 0.7, metalness = 0): THREE.MeshStandardMaterial {
  const k = `${color}/${roughness}/${metalness}`;
  let v = cache.get(k);
  if (!v) {
    v = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    cache.set(k, v);
  }
  return v;
}
function mesh(g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  g.add(o);
  return o;
}
function labelMat(lines: string[], bg: string, fg: string, w = 128, h = 96): THREE.MeshStandardMaterial {
  const k = `label:${lines.join('|')}`;
  let v = cache.get(k);
  if (!v) {
    const t = textTexture(lines, { w, h, bg, fg, border: fg });
    t.magFilter = THREE.NearestFilter;
    v = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
    cache.set(k, v);
  }
  return v;
}

function duck(): THREE.Group {
  const g = new THREE.Group();
  const y = m('#f2c418', 0.4);
  const body = mesh(g, new THREE.SphereGeometry(0.08, 10, 8), y, 0, 0.065, 0);
  body.scale.set(1.25, 0.8, 1);
  mesh(g, new THREE.SphereGeometry(0.05, 10, 8), y, 0.06, 0.14, 0);
  const beak = mesh(g, new THREE.BoxGeometry(0.05, 0.02, 0.04), m('#e8661c'), 0.115, 0.135, 0);
  beak.rotation.z = -0.1;
  for (const z of [-0.03, 0.03]) mesh(g, new THREE.SphereGeometry(0.008, 6, 4), m('#111111'), 0.095, 0.155, z);
  return g;
}

function sock(): THREE.Group {
  const g = new THREE.Group();
  const leg = mesh(g, new THREE.BoxGeometry(0.08, 0.2, 0.06), m('#c0392b', 0.95), 0, 0.14, 0);
  leg.rotation.z = 0.05;
  mesh(g, new THREE.BoxGeometry(0.082, 0.025, 0.062), m('#f4f4f4', 0.95), 0, 0.17, 0);
  mesh(g, new THREE.BoxGeometry(0.16, 0.07, 0.065), m('#c0392b', 0.95), 0.05, 0.035, 0);
  mesh(g, new THREE.BoxGeometry(0.04, 0.07, 0.067), m('#f4f4f4', 0.95), 0.12, 0.035, 0);
  mesh(g, new THREE.BoxGeometry(0.084, 0.03, 0.064), m('#f4f4f4', 0.95), 0, 0.235, 0);
  return g;
}

function nothing(): THREE.Group {
  const g = new THREE.Group();
  mesh(g, new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), 0, 0.11, 0);
  return g;
}

function emptyBox(): THREE.Group {
  const g = new THREE.Group();
  mesh(g, new THREE.BoxGeometry(0.2, 0.15, 0.16), boxMaterials(2), 0, 0.075, 0);
  // open flaps
  for (const s of [-1, 1]) {
    const f = mesh(g, new THREE.BoxGeometry(0.2, 0.005, 0.08), m('#b5864f'), 0, 0.17, s * 0.1);
    f.rotation.x = s * 0.9;
  }
  return g;
}

function anvil(): THREE.Group {
  const g = new THREE.Group();
  const iron = m('#3b3d40', 0.45, 0.6);
  mesh(g, new THREE.BoxGeometry(0.3, 0.08, 0.2), iron, 0, 0.04, 0);
  mesh(g, new THREE.BoxGeometry(0.16, 0.14, 0.12), iron, 0, 0.15, 0);
  mesh(g, new THREE.BoxGeometry(0.42, 0.1, 0.16), iron, 0.02, 0.27, 0);
  const horn = mesh(g, new THREE.ConeGeometry(0.06, 0.22, 8), iron, -0.27, 0.28, 0);
  horn.rotation.z = Math.PI / 2;
  const tag = mesh(g, new THREE.PlaneGeometry(0.14, 0.08), labelMat(['40 KG', 'lift with', 'your legs'], '#f0b43c', '#111111'), 0.02, 0.27, 0.081);
  tag.rotation.y = 0;
  return g;
}

function boxOfBoxes(): THREE.Group {
  const g = new THREE.Group();
  mesh(g, new THREE.BoxGeometry(0.34, 0.24, 0.26), boxMaterials(4), 0, 0.12, 0);
  mesh(g, new THREE.BoxGeometry(0.22, 0.12, 0.18), boxMaterials(1), 0.02, 0.3, 0);
  mesh(g, new THREE.BoxGeometry(0.12, 0.08, 0.1), boxMaterials(6), 0.03, 0.4, 0);
  const l = mesh(g, new THREE.PlaneGeometry(0.2, 0.12), labelMat(['BOXES', 'contains boxes'], '#f2ead2', '#7a1f14'), 0, 0.12, 0.131);
  l.rotation.y = 0;
  return g;
}

function book(): THREE.Group {
  const g = new THREE.Group();
  const cover = labelMat(['BOXES', 'a love story', 'hardcover'], '#2c4f7c', '#f3e6c8', 96, 128);
  const pages = m('#efe6cf', 0.9);
  const blue = m('#2c4f7c');
  mesh(g, new THREE.BoxGeometry(0.16, 0.22, 0.04), [pages, blue, pages, pages, cover, blue], 0, 0.11, 0);
  return g;
}

function mug(): THREE.Group {
  const g = new THREE.Group();
  const white = m('#f2efe6', 0.3);
  const side = labelMat(["WORLD'S", 'OKAYEST', 'PICKER'], '#f2efe6', '#7a1f14', 128, 64);
  mesh(g, new THREE.CylinderGeometry(0.055, 0.05, 0.12, 12), [side, white, m('#3b2a1a')], 0, 0.06, 0).rotation.y = -Math.PI / 2;
  const h = mesh(g, new THREE.TorusGeometry(0.035, 0.012, 6, 10), white, 0.065, 0.065, 0);
  h.rotation.y = 0;
  return g;
}

function ink(): THREE.Group {
  const g = new THREE.Group();
  const front = labelMat(['INK', '3 ml', 'gold price'], '#111111', '#f0b43c', 64, 96);
  const black = m('#1a1a1a', 0.4);
  mesh(g, new THREE.BoxGeometry(0.06, 0.1, 0.04), [black, black, black, black, front, black], 0, 0.05, 0);
  return g;
}

function gnome(): THREE.Group {
  const g = new THREE.Group();
  mesh(g, new THREE.CylinderGeometry(0.07, 0.09, 0.16, 8), m('#2e6f9e'), 0, 0.08, 0);
  mesh(g, new THREE.SphereGeometry(0.06, 8, 6), m('#e8b796'), 0, 0.2, 0);
  const beard = mesh(g, new THREE.ConeGeometry(0.06, 0.1, 8), m('#eeeeee'), 0, 0.15, 0.03);
  beard.rotation.x = Math.PI;
  mesh(g, new THREE.ConeGeometry(0.065, 0.16, 8), m('#b3160c'), 0, 0.31, 0);
  // the sad eyebrows
  for (const s of [-1, 1]) {
    const b = mesh(g, new THREE.BoxGeometry(0.025, 0.006, 0.006), m('#222222'), s * 0.022, 0.225, 0.057);
    b.rotation.z = s * 0.5;
  }
  return g;
}

function bubbleWrap(): THREE.Group {
  const g = new THREE.Group();
  const wrap = new THREE.MeshStandardMaterial({ color: '#d7e6ea', roughness: 0.2, transparent: true, opacity: 0.85 });
  const r = mesh(g, new THREE.CylinderGeometry(0.1, 0.1, 0.3, 12), wrap, 0, 0.1, 0);
  r.rotation.z = Math.PI / 2;
  mesh(g, new THREE.PlaneGeometry(0.12, 0.08), labelMat(['PRE-', 'POPPED'], '#ffffff', '#c0392b', 96, 64), 0, 0.1, 0.101);
  return g;
}

function cable(): THREE.Group {
  const g = new THREE.Group();
  const black = m('#222222', 0.6);
  for (let i = 0; i < 3; i++) {
    const t = mesh(g, new THREE.TorusGeometry(0.06 + i * 0.005, 0.008, 5, 14), black, 0, 0.05, 0);
    t.rotation.x = Math.PI / 2 + i * 0.15;
  }
  mesh(g, new THREE.BoxGeometry(0.03, 0.012, 0.045), m('#aaaaaa', 0.3, 0.7), 0.08, 0.05, 0);
  return g;
}

function stressBall(): THREE.Group {
  const g = new THREE.Group();
  const b = mesh(g, new THREE.SphereGeometry(0.06, 10, 8), m('#d94f8a', 0.6), 0, 0.06, 0);
  b.scale.set(1.15, 0.85, 1);
  for (const s of [-1, 1]) mesh(g, new THREE.BoxGeometry(0.012, 0.022, 0.004), m('#111111'), s * 0.02, 0.07, 0.058);
  mesh(g, new THREE.BoxGeometry(0.03, 0.005, 0.004), m('#111111'), 0, 0.045, 0.059);
  return g;
}

function cannedAir(): THREE.Group {
  const g = new THREE.Group();
  const side = labelMat(['CANNED', 'AIR', 'mountain fresh'], '#4f8fbf', '#ffffff', 128, 96);
  const metal = m('#b8bec4', 0.3, 0.7);
  mesh(g, new THREE.CylinderGeometry(0.04, 0.04, 0.15, 12), [side, metal, metal], 0, 0.075, 0).rotation.y = -Math.PI / 2;
  mesh(g, new THREE.CylinderGeometry(0.015, 0.02, 0.03, 8), m('#e8e8e8'), 0, 0.165, 0);
  return g;
}

const def = (id: string, name: string, build: () => THREE.Group, extra: Partial<ItemDef> = {}): ItemDef => ({
  id: `pk-${id}`,
  name,
  category: null,
  shape: 'box',
  color: '#888888',
  label: [],
  weight: 0,
  pocketable: true,
  build,
  tags: ['product'],
  ...extra,
});

export const PRODUCTS: Product[] = [
  { def: def('duck', 'Rubber Duck (Left-Handed)', duck), size: 1, stock: '#f2c418', scan: 'RUBBER DUCK (LEFT-HANDED)' },
  { def: def('sock', 'Single Sock (Left)', sock), size: 1, stock: '#c0392b', scan: 'SINGLE SOCK, LEFT ONLY' },
  {
    def: def('nothing', 'Box of Nothing (SKU 0000)', nothing, { shape: 'nothing' }),
    size: 1,
    stock: null,
    scan: 'BOX OF NOTHING',
  },
  { def: def('emptybox', 'Empty Box (Small)', emptyBox), size: 1, stock: '#b5864f', scan: 'EMPTY BOX (SMALL)' },
  {
    def: def('anvil', '40 kg Anvil', anvil, {
      pocketable: false,
      heavy: 0.5,
      holdPos: [0.2, -0.62, -0.85],
      holdRotY: -0.4,
      pickupLine: 'You lift the 40 kg anvil. Your spine files a complaint with HR.',
    }),
    size: 3,
    stock: '#3b3d40',
    scan: 'ANVIL, 40 KG',
  },
  {
    def: def('boxes', 'Box of Boxes', boxOfBoxes, { pocketable: false, holdPos: [0.25, -0.4, -0.75] }),
    size: 2,
    stock: '#a87a46',
    scan: 'BOX OF BOXES (12 PACK)',
  },
  { def: def('book', 'Boxes: A Love Story (Hardcover)', book), size: 1, stock: '#2c4f7c', scan: 'BOOK: BOXES, A LOVE STORY' },
  { def: def('mug', "World's Okayest Mug", mug), size: 1, stock: '#f2efe6', scan: "MUG, WORLD'S OKAYEST" },
  { def: def('ink', 'Printer Ink (3 ml)', ink), size: 1, stock: '#1a1a1a', scan: 'PRINTER INK, 3 ML' },
  { def: def('gnome', 'Garden Gnome (Disappointed)', gnome, { pocketable: false }), size: 2, stock: '#2e6f9e', scan: 'GARDEN GNOME, DISAPPOINTED' },
  { def: def('wrap', 'Bubble Wrap (Pre-Popped)', bubbleWrap), size: 2, stock: '#d7e6ea', scan: 'BUBBLE WRAP, PRE-POPPED' },
  { def: def('cable', 'USB Cable (Wrong Way Up)', cable), size: 1, stock: '#222222', scan: 'USB CABLE, WRONG WAY UP' },
  { def: def('stress', 'Stress Ball (Stressed)', stressBall), size: 1, stock: '#d94f8a', scan: 'STRESS BALL, STRESSED' },
  { def: def('air', 'Canned Air (Mountain Fresh)', cannedAir), size: 1, stock: '#4f8fbf', scan: 'CANNED AIR, MOUNTAIN FRESH' },
];

export const productOf = (d: ItemDef): Product | undefined => PRODUCTS.find((p) => p.def === d);
export const byId = (id: string): Product => PRODUCTS.find((p) => p.def.id === `pk-${id}`)!;

// ------------------------------------------------------------------ special items

function palletJack(): THREE.Group {
  const g = new THREE.Group();
  const red = m('#b3261c', 0.5, 0.3);
  const steel = m('#4a4d50', 0.4, 0.6);
  const black = m('#151515', 0.8);
  // forks pointing away from the player (-z)
  for (const x of [-0.2, 0.2]) {
    mesh(g, new THREE.BoxGeometry(0.16, 0.07, 1.05), red, x, 0.07, -0.38);
    const w = mesh(g, new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8), black, x, 0.035, -0.86);
    w.rotation.z = Math.PI / 2;
  }
  // the pump body and steering wheel
  mesh(g, new THREE.BoxGeometry(0.56, 0.18, 0.22), red, 0, 0.14, 0.22);
  const wheel = mesh(g, new THREE.CylinderGeometry(0.09, 0.09, 0.1, 10), black, 0, 0.09, 0.3);
  wheel.rotation.z = Math.PI / 2;
  mesh(g, new THREE.CylinderGeometry(0.05, 0.05, 0.25, 8), steel, 0, 0.35, 0.26);
  // the long handle, leaning towards the player
  const handle = mesh(g, new THREE.CylinderGeometry(0.022, 0.022, 1.0, 6), steel, 0, 0.82, 0.42);
  handle.rotation.x = 0.35;
  mesh(g, new THREE.BoxGeometry(0.3, 0.05, 0.05), black, 0, 1.28, 0.58);
  // the key on a chain with a huge tag
  const chain = mesh(g, new THREE.CylinderGeometry(0.006, 0.006, 0.22, 4), m('#c9cdd1', 0.3, 0.8), 0.12, 1.15, 0.56);
  chain.rotation.z = 0.1;
  mesh(g, new THREE.BoxGeometry(0.03, 0.07, 0.008), new THREE.MeshStandardMaterial({ color: '#f1c40f', metalness: 0.8, roughness: 0.3 }), 0.13, 1.0, 0.56);
  const tag = mesh(g, new THREE.PlaneGeometry(0.2, 0.14), labelMat(['WC KEY', 'return jack'], '#ffffff', '#c0392b', 128, 96), 0.13, 0.9, 0.565);
  tag.rotation.y = Math.PI;
  const tag2 = mesh(g, new THREE.PlaneGeometry(0.2, 0.14), labelMat(['WC KEY', 'return jack'], '#ffffff', '#c0392b', 128, 96), 0.13, 0.9, 0.555);
  tag2.rotation.y = 0;
  // an invisible grab box, so the jack is easy to aim at
  mesh(g, new THREE.BoxGeometry(0.8, 1.3, 1.6), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), 0, 0.65, -0.15);
  return g;
}

export const JACK_DEF: ItemDef = {
  id: 'pk-jack',
  name: 'Toilet Key (chained to a pallet jack)',
  category: null,
  shape: 'box',
  color: '#b3261c',
  label: [],
  weight: 0,
  pocketable: false,
  toiletKey: true,
  heavy: 0.5,
  fixture: true,
  holdPos: [0.3, -1.3, -1.9],
  holdRotY: 0,
  carryAchievement: 'tire',
  pickupLine: 'You take the toilet key. It is chained to a pallet jack. The pallet jack comes along. Of course it does.',
  build: palletJack,
  tags: ['jack'],
};

function bottle(): THREE.Group {
  const g = new THREE.Group();
  const plastic = new THREE.MeshStandardMaterial({ color: '#dfe8ea', roughness: 0.15, transparent: true, opacity: 0.8 });
  mesh(g, new THREE.CylinderGeometry(0.05, 0.05, 0.2, 10), plastic, 0, 0.1, 0);
  mesh(g, new THREE.CylinderGeometry(0.025, 0.045, 0.05, 10), plastic, 0, 0.225, 0);
  mesh(g, new THREE.CylinderGeometry(0.027, 0.027, 0.025, 10), m('#e0b21b'), 0, 0.26, 0);
  mesh(g, new THREE.PlaneGeometry(0.08, 0.08), labelMat(['APPROVED', 'decorative'], '#e0b21b', '#111111', 96, 96), 0, 0.1, 0.051);
  return g;
}

export const BOTTLE_DEF: ItemDef = {
  id: 'pk-bottle',
  name: 'Approved Relief Bottle (decorative)',
  category: null,
  shape: 'box',
  color: '#dfe8ea',
  label: [],
  weight: 0,
  pocketable: true,
  pickupLine: 'Approved Relief Bottle. The fine print says: decorative use only.',
  pocketLine: 'You pocket the relief bottle. It is the most expensive thing you own.',
  build: bottle,
  tags: ['bottle'],
};
