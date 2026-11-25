import * as THREE from 'three';
import type { ModelSpec } from '../../assets';
import { instantiate } from '../../assets';
import { ItemDef, ITEM_DEFS } from '../../items';
import { textTexture } from '../../util';

/**
 * Groceries that roll over the belt, the produce codes, and the job's special items
 * (the toilet key on a full shopping cart, till money, candy from the rack).
 */

const M = `${import.meta.env.BASE_URL}models/checkout`;

/** Extra models for this job. Keys start with "co" so they never clash with the shared manifest. */
export const CHECKOUT_MODELS: Record<string, ModelSpec> = {
  coCandy: { url: `${M}/food/candy-bar.glb`, width: 0.18 },
  coChoc: { url: `${M}/food/chocolate.glb`, width: 0.17 },
  coSoda: { url: `${M}/food/soda-can.glb`, height: 0.13 },
  coSodaBottle: { url: `${M}/food/soda-bottle.glb`, height: 0.3 },
  coOil: { url: `${M}/food/bottle-oil.glb`, height: 0.28 },
  coCarton: { url: `${M}/food/carton.glb`, height: 0.24 },
  coCheese: { url: `${M}/food/cheese.glb`, width: 0.18 },
  coLoaf: { url: `${M}/food/loaf.glb`, width: 0.3 },
  coCarrot: { url: `${M}/food/carrot.glb`, width: 0.22 },
  coBroccoli: { url: `${M}/food/broccoli.glb`, height: 0.2 },
  coLemon: { url: `${M}/food/lemon.glb`, height: 0.08 },
  coPear: { url: `${M}/food/pear.glb`, height: 0.12 },
  coOnion: { url: `${M}/food/onion.glb`, height: 0.09 },
  coTomato: { url: `${M}/food/tomato.glb`, height: 0.08 },
  coCabbage: { url: `${M}/food/cabbage.glb`, height: 0.2 },
  coMelon: { url: `${M}/food/watermelon.glb`, width: 0.36 },
  coEggplant: { url: `${M}/food/eggplant.glb`, width: 0.22 },
  coPineapple: { url: `${M}/food/pineapple.glb`, height: 0.32 },
  coDonut: { url: `${M}/food/donut-sprinkles.glb`, width: 0.12 },
  coKetchup: { url: `${M}/food/bottle-ketchup.glb`, height: 0.2 },
  // Shop furniture
  coBasket: { url: `${M}/shop/shopping-basket.glb`, width: 0.5 },
  coDisplaySmall: { url: `${M}/shop/display-small.glb`, height: 1.3 },
  coDisplayCans: { url: `${M}/shop/display-cans.glb`, height: 0.9 },
  coDisplayBread: { url: `${M}/shop/display-bread.glb`, height: 1.0 },
  coShelfBags: { url: `${M}/shop/shelf-bags.glb`, height: 1.9 },
  coShelfBoxes: { url: `${M}/shop/shelf-boxes.glb`, height: 1.9 },
  coBottleReturn: { url: `${M}/shop/bottle-return.glb`, height: 1.7 },
  coGacha: { url: `${M}/shop/gacha-machine.glb`, height: 1.3 },
  coHandTruck: { url: `${M}/shop/hand-truck.glb`, height: 1.2 },
  coFreezer: { url: `${M}/shop/freezer.glb`, height: 0.9 },
};

const base = (id: string) => ITEM_DEFS.find((d) => d.id === id)!;

/** What a grocery means at the till. */
export interface Ware {
  def: ItemDef;
  price: number;
  /** Produce has no barcode. It needs a code from the sheet. */
  code?: string;
  /** Robot oil needs an age check. */
  adult?: boolean;
}

const g = (id: string, name: string, model: string, color: string): ItemDef => ({
  id,
  name,
  category: null,
  shape: 'box',
  color,
  label: [],
  weight: 0,
  pocketable: true,
  model,
});

export const OIL_DEF: ItemDef = { ...g('coOil', 'Robot Oil 10W-40 (18+)', 'coOil', '#d4ac0d'), pocketLine: 'You pocket the robot oil. You are 18 or older. Probably.' };

export const BARCODE_WARES: Ware[] = [
  { def: base('cruncho'), price: 3.49 },
  { def: base('sadflakes'), price: 2.19 },
  { def: base('beans'), price: 1.29 },
  { def: base('soup'), price: 1.99 },
  { def: base('wuffles'), price: 6.49 },
  { def: base('catpaste'), price: 0.89 },
  { def: base('softy'), price: 7.99 },
  { def: base('sandpaper'), price: 4.49 },
  { def: g('coMilk', 'Milk (Synthetic, Udder-Free)', 'coCarton', '#ecf0f1'), price: 1.39 },
  { def: g('coCheese', 'Cheese-Like Product', 'coCheese', '#f4d03f'), price: 3.29 },
  { def: g('coLoaf', 'Bread (Sliced Ambition)', 'coLoaf', '#c68642'), price: 2.49 },
  { def: g('coCola', 'Fizz Cola Zero Joy', 'coSoda', '#c0392b'), price: 0.99 },
  { def: g('coFizz', 'Sparkling Coolant (Lemon)', 'coSodaBottle', '#2ecc71'), price: 1.79 },
  { def: g('coKetchup', 'Ketchup (Contains Tomato)', 'coKetchup', '#c0392b'), price: 2.29 },
  { def: g('coDonut', 'Donut (Decorative)', 'coDonut', '#ff6fb5'), price: 1.19 },
  { def: g('coChoc', 'Dark Matter Chocolate', 'coChoc', '#5d4037'), price: 2.99 },
];

export const OIL_WARE: Ware = { def: OIL_DEF, price: 12.99, adult: true };
export const NOTHING_WARE: Ware = { def: base('nothing'), price: 0.0 };

export const PRODUCE: Ware[] = [
  { def: base('bananas'), price: 1.89, code: '4112' },
  { def: base('apple'), price: 0.59, code: '3283' },
  { def: g('coLemon', 'Lemon (Sour Attitude)', 'coLemon', '#f4d03f'), price: 0.49, code: '4958' },
  { def: g('coCarrot', 'Carrot (Loose)', 'coCarrot', '#e67e22'), price: 0.35, code: '4562' },
  { def: g('coBroccoli', 'Broccoli (Tiny Tree)', 'coBroccoli', '#27ae60'), price: 1.29, code: '3166' },
  { def: g('coOnion', 'Onion (Makes Robots Cry)', 'coOnion', '#a0522d'), price: 0.39, code: '4665' },
  { def: g('coTomato', 'Tomato (Technically Fruit)', 'coTomato', '#c0392b'), price: 0.45, code: '4799' },
  { def: g('coPear', 'Pear', 'coPear', '#a9cc54'), price: 0.69, code: '3419' },
  { def: g('coCabbage', 'Cabbage', 'coCabbage', '#7dcea0'), price: 1.09, code: '4554' },
  { def: g('coMelon', 'Watermelon (Heavy)', 'coMelon', '#1e8449'), price: 3.99, code: '4321' },
  { def: g('coEggplant', 'Eggplant (No Eggs)', 'coEggplant', '#6c3483'), price: 0.99, code: '4598' },
  { def: g('coPineapple', 'Pineapple (Spiky)', 'coPineapple', '#d4ac0d'), price: 2.49, code: '4436' },
];

/** Codes on the sheet that are one finger slip away from a real one. */
export const DECOYS: { name: string; code: string; price: number }[] = [
  { name: 'DIAMOND RING 18K', code: '4113', price: 4999.0 },
  { name: 'USED BATTERY', code: '3284', price: 0.05 },
  { name: 'LIVE LOBSTER', code: '4563', price: 38.5 },
  { name: 'GOLD BAR (1 KG)', code: '4322', price: 61200.0 },
  { name: 'A SINGLE GRAPE', code: '4959', price: 0.02 },
  { name: 'EMOTIONAL SUPPORT ROCK', code: '3167', price: 14.99 },
  { name: 'MYSTERY MEAT', code: '4666', price: 6.66 },
  { name: 'GARDEN GNOME (ARMED)', code: '4555', price: 89.0 },
];

/** Lines of the code sheet taped to the register, sorted like a real sheet (not helpful). */
export function codeSheetLines(): [string, string][] {
  const rows: [string, string][] = [
    ...PRODUCE.map((p) => [p.def.name.replace(/ \(.*\)/, '').toUpperCase(), p.code!] as [string, string]),
    ...DECOYS.map((d) => [d.name, d.code] as [string, string]),
  ];
  return rows.sort((a, b) => a[1].localeCompare(b[1]));
}

export function findCode(code: string): { name: string; price: number; ware?: Ware } | null {
  const p = PRODUCE.find((w) => w.code === code);
  if (p) return { name: p.def.name, price: p.price, ware: p };
  const d = DECOYS.find((x) => x.code === code);
  if (d) return { name: d.name, price: d.price };
  return null;
}

// ---------------------------------------------------------------- special items

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });

function addBox(parent: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number): THREE.Mesh {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  parent.add(b);
  return b;
}

/** A shopping cart full of other people's shopping. Base at y = 0, handle at -z. */
export function buildFullCart(withKey: boolean): THREE.Group {
  const grp = new THREE.Group();
  const inst = instantiate('cart');
  if (inst) {
    grp.add(inst.object);
  } else {
    const wire = std('#9aa3ab', { metalness: 0.6, roughness: 0.4 });
    addBox(grp, 0.55, 0.45, 0.85, wire, 0, 0.7, 0);
    addBox(grp, 0.5, 0.04, 0.1, wire, 0, 0.95, -0.5);
    for (const [x, z] of [[-0.22, -0.35], [0.22, -0.35], [-0.22, 0.35], [0.22, 0.35]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8), std('#222222'));
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.06, z);
      grp.add(w);
    }
  }
  // The load: boxes, a watermelon, toilet paper, bottles. Nobody knows whose.
  const box = (w: number, h: number, d: number, c: string, x: number, y: number, z: number, ry = 0) => {
    const b = addBox(grp, w, h, d, std(c), x, y, z);
    b.rotation.y = ry;
    return b;
  };
  box(0.32, 0.3, 0.22, '#e67e22', -0.1, 0.72, 0.15, 0.2);
  box(0.28, 0.36, 0.12, '#2e86c1', 0.12, 0.75, -0.1, -0.3);
  box(0.4, 0.22, 0.28, '#f4f6f7', 0.05, 0.98, 0.1, 0.1);
  box(0.22, 0.4, 0.16, '#7f8c8d', -0.14, 0.95, -0.18, 0.5);
  box(0.18, 0.18, 0.18, '#c0392b', 0.15, 1.12, 0.22, 0.7);
  const melon = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), std('#1e8449'));
  melon.scale.set(1.25, 1, 1);
  melon.position.set(0.0, 1.2, -0.05);
  grp.add(melon);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 8), std(['#27ae60', '#d4ac0d', '#8e44ad'][i]));
    b.position.set(-0.2 + i * 0.07, 1.15, 0.3);
    b.rotation.z = 0.2 - i * 0.15;
    grp.add(b);
  }
  if (withKey) {
    // A heavy chain from the handle to a key with a big tag.
    const chainMat = std('#b8bcc0', { metalness: 0.8, roughness: 0.3 });
    for (let i = 0; i < 7; i++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 4, 8), chainMat);
      link.position.set(0.22, 0.95 - i * 0.045, -0.45);
      link.rotation.y = (i % 2) * (Math.PI / 2);
      grp.add(link);
    }
    addBox(grp, 0.05, 0.11, 0.012, std('#f1c40f', { metalness: 0.8, roughness: 0.3 }), 0.22, 0.58, -0.45);
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.14),
      new THREE.MeshStandardMaterial({ map: textTexture(['WC KEY', 'do not remove', 'from cart'], { w: 128, h: 80, bg: '#ffffff', fg: '#c0392b', border: '#c0392b' }), side: THREE.DoubleSide }),
    );
    tag.position.set(0.22, 0.45, -0.46);
    tag.rotation.y = Math.PI;
    grp.add(tag);
  }
  return grp;
}

export const CART_KEY_DEF: ItemDef = {
  id: 'coCartKey',
  name: 'Toilet Key (chained to a full shopping cart)',
  category: null,
  shape: 'box',
  color: '#9aa3ab',
  label: [],
  weight: 0,
  pocketable: false,
  toiletKey: true,
  heavy: 0.42,
  holdPos: [0.05, -1.75, -1.6],
  holdRotY: 0,
  fixture: true,
  carryAchievement: 'coCartKey',
  pickupLine: 'The toilet key is chained to a full shopping cart. Nobody knows whose. You push.',
  build: () => buildFullCart(true),
};

function buildWad(): THREE.Group {
  const grp = new THREE.Group();
  const note = new THREE.MeshStandardMaterial({ map: textTexture(['€20', 'SHOPOTRON'], { w: 128, h: 64, bg: '#7fb069', fg: '#1d3b12' }), roughness: 0.9 });
  const edge = std('#7fb069');
  addBox(grp, 0.16, 0.05, 0.08, [edge, edge, note, edge, edge, edge], 0, 0.025, 0);
  addBox(grp, 0.03, 0.052, 0.082, std('#c0392b'), 0, 0.025, 0);
  return grp;
}

export const WAD_DEF: ItemDef = {
  id: 'coWad',
  name: 'Till Money (€20, technically)',
  category: null,
  shape: 'box',
  color: '#7fb069',
  label: [],
  weight: 0,
  pocketable: true,
  holdPos: [0.25, -0.25, -0.55],
  pocketLine: 'You slide €20 of till money into your sock. The till will notice. Eventually.',
  pocketAchievement: 'coTill',
  build: buildWad,
};

export const CANDY_DEF: ItemDef = {
  ...g('coCandy', 'Choco Bolt Bar', 'coCandy', '#c0392b'),
  pocketLine: 'You pocket a Choco Bolt. It starts melting at once. Like your career.',
};
export const CANDY_WARE: Ware = { def: CANDY_DEF, price: 1.49 };

/** Things robots put into the bagging area that are not theirs to bag. */
export const UNEXPECTED: { name: string; build: () => THREE.Group }[] = [
  {
    name: 'a handbag',
    build: () => {
      const grp = new THREE.Group();
      addBox(grp, 0.32, 0.24, 0.14, std('#8e44ad'), 0, 0.12, 0);
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 4, 10, Math.PI), std('#4a235a'));
      h.position.y = 0.24;
      grp.add(h);
      return grp;
    },
  },
  {
    name: 'an emotional support toaster',
    build: () => {
      const grp = new THREE.Group();
      addBox(grp, 0.3, 0.2, 0.18, std('#bdc3c7', { metalness: 0.6, roughness: 0.3 }), 0, 0.1, 0);
      addBox(grp, 0.2, 0.02, 0.03, std('#222222'), 0, 0.205, -0.04);
      addBox(grp, 0.2, 0.02, 0.03, std('#222222'), 0, 0.205, 0.04);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshBasicMaterial({ map: textTexture([':)'], { w: 64, h: 32, bg: '#0b1a2a', fg: '#55ffff', font: 'monospace' }) }));
      face.position.set(0, 0.11, 0.091);
      grp.add(face);
      return grp;
    },
  },
  {
    name: 'its own left arm',
    build: () => {
      const grp = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 8), std('#bdc3c7', { metalness: 0.5, roughness: 0.4 }));
      arm.rotation.z = Math.PI / 2;
      arm.position.y = 0.06;
      grp.add(arm);
      addBox(grp, 0.1, 0.06, 0.12, std('#7f8c8d'), 0.28, 0.06, 0);
      return grp;
    },
  },
  {
    name: 'a robot cat',
    build: () => {
      const grp = new THREE.Group();
      addBox(grp, 0.3, 0.16, 0.14, std('#e67e22'), 0, 0.12, 0);
      addBox(grp, 0.13, 0.12, 0.12, std('#e67e22'), 0.18, 0.22, 0);
      for (const z of [-0.04, 0.04]) addBox(grp, 0.03, 0.05, 0.03, std('#d35400'), 0.2, 0.3, z);
      const tail = addBox(grp, 0.2, 0.025, 0.025, std('#d35400'), -0.2, 0.22, 0);
      tail.rotation.z = 0.7;
      return grp;
    },
  },
];
