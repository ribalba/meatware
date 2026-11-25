import * as THREE from 'three';
import type { ModelSpec } from '../../assets';
import { instantiate } from '../../assets';
import type { ItemDef } from '../../items';
import { textTexture } from '../../util';

/**
 * Dishes, pots, the rack, the stock pot with the toilet key and the things worth stealing.
 * Model keys start with "dw" so they never clash with the shared manifest.
 */

const M = `${import.meta.env.BASE_URL}models/dishes`;
const F = `${M}/food`;
const U = `${M}/furniture`;

export const DISHES_MODELS: Record<string, ModelSpec> = {
  // the dishes
  dwPlate: { url: `${F}/plate.glb`, width: 0.32 },
  dwBowl: { url: `${F}/bowl.glb`, width: 0.23 },
  dwGlass: { url: `${F}/glass-wine.glb`, height: 0.24 },
  dwTumbler: { url: `${F}/glass.glb`, height: 0.12 },
  dwFork: { url: `${F}/utensil-fork.glb`, width: 0.22 },
  dwKnife: { url: `${F}/utensil-knife.glb`, width: 0.24 },
  dwSpoon: { url: `${F}/utensil-spoon.glb`, width: 0.21 },
  dwPot: { url: `${F}/pot.glb`, width: 0.42 },
  dwStockPot: { url: `${F}/pot-stew.glb`, width: 0.95 },
  dwPotLid: { url: `${F}/pot-lid.glb`, width: 0.76 },
  dwPan: { url: `${F}/frying-pan.glb`, width: 0.5 },
  dwSaucepan: { url: `${F}/pan.glb`, width: 0.42 },
  dwPanStew: { url: `${F}/pan-stew.glb`, width: 0.42 },
  dwShards: { url: `${F}/plate-broken.glb`, width: 0.22 },
  // leftovers nobody ate
  dwFoodMeat: { url: `${F}/meat-cooked.glb`, width: 0.18 },
  dwFoodFish: { url: `${F}/fish.glb`, width: 0.23 },
  dwFoodSalad: { url: `${F}/salad.glb`, width: 0.16 },
  dwFoodSushi: { url: `${F}/sushi-salmon.glb`, width: 0.1 },
  dwFoodPancakes: { url: `${F}/pancakes.glb`, width: 0.17 },
  dwFoodRibs: { url: `${F}/meat-ribs.glb`, width: 0.2 },
  dwFoodMussel: { url: `${F}/mussel-open.glb`, width: 0.09 },
  dwFoodDimsum: { url: `${F}/dim-sum.glb`, width: 0.09 },
  dwFoodCroissant: { url: `${F}/croissant.glb`, width: 0.15 },
  // display food, produce and tools
  dwTurkey: { url: `${F}/turkey.glb`, width: 0.5 },
  dwHam: { url: `${F}/whole-ham.glb`, width: 0.34 },
  dwCake: { url: `${F}/cake.glb`, width: 0.34 },
  dwPie: { url: `${F}/pie.glb`, width: 0.32 },
  dwLoaf: { url: `${F}/loaf-round.glb`, width: 0.3 },
  dwRoll: { url: `${F}/loaf-round.glb`, width: 0.11 },
  dwCabbage: { url: `${F}/cabbage.glb`, height: 0.18 },
  dwCarrot: { url: `${F}/carrot.glb`, height: 0.2 },
  dwTomato: { url: `${F}/tomato.glb`, height: 0.07 },
  dwOnion: { url: `${F}/onion.glb`, height: 0.08 },
  dwEggplant: { url: `${F}/eggplant.glb`, height: 0.2 },
  dwBroccoli: { url: `${F}/broccoli.glb`, height: 0.18 },
  dwLeek: { url: `${F}/leek.glb`, height: 0.4 },
  dwPumpkin: { url: `${F}/pumpkin.glb`, width: 0.36 },
  dwMelon: { url: `${F}/watermelon.glb`, height: 0.3 },
  dwLemon: { url: `${F}/lemon.glb`, height: 0.07 },
  dwPineapple: { url: `${F}/pineapple.glb`, height: 0.3 },
  dwBoard: { url: `${F}/cutting-board.glb`, width: 0.45 },
  dwKnifeBlock: { url: `${F}/knife-block.glb`, height: 0.25 },
  dwChopKnife: { url: `${F}/cooking-knife-chopping.glb`, width: 0.3 },
  dwWhisk: { url: `${F}/whisk.glb`, width: 0.3 },
  dwRollingPin: { url: `${F}/rollingPin.glb`, width: 0.4 },
  dwPepperMill: { url: `${F}/pepper-mill.glb`, height: 0.22 },
  dwOil: { url: `${F}/bottle-oil.glb`, height: 0.28 },
  dwWineRed: { url: `${F}/wine-red.glb`, height: 0.3 },
  dwWineWhite: { url: `${F}/wine-white.glb`, height: 0.3 },
  dwSteamer: { url: `${F}/steamer.glb`, width: 0.3 },
  dwLadle: { url: `${F}/cooking-spoon.glb`, width: 0.32 },
  dwSpatula: { url: `${F}/cooking-spatula.glb`, width: 0.32 },
  dwBarrel: { url: `${F}/barrel.glb`, height: 0.7 },
  dwMortar: { url: `${F}/mortar-pestle.glb`, height: 0.14 },
  dwTajine: { url: `${F}/tajine.glb`, width: 0.35 },
  dwCheese: { url: `${F}/cheese.glb`, width: 0.28 },
  // furniture
  dwStove: { url: `${U}/kitchenStove.glb`, height: 0.92 },
  dwHood: { url: `${U}/hoodLarge.glb`, width: 1.1 },
  dwFridge: { url: `${U}/kitchenFridgeLarge.glb`, height: 2.1 },
  dwFan: { url: `${U}/ceilingFan.glb`, width: 1.2 },
  dwTrash: { url: `${U}/trashcan.glb`, height: 0.8 },
  dwTableCloth: { url: `${U}/tableCloth.glb`, height: 0.78 },
  dwChair: { url: `${U}/chair.glb`, height: 0.95 },
  dwSinkCab: { url: `${U}/kitchenSink.glb`, height: 0.92 },
  dwCabinet: { url: `${U}/kitchenCabinet.glb`, height: 0.92 },
  // mischief props (mischief.ts)
  dwCoffee: { url: `${U}/kitchenCoffeeMachine.glb`, height: 0.42 },
  dwRadio: { url: `${U}/radio.glb`, width: 0.36 },
  dwStool: { url: `${U}/stoolBar.glb`, height: 0.75 },
  dwToaster: { url: `${U}/toaster.glb`, width: 0.3 },
};

export type DishType = 'plate' | 'bowl' | 'glass' | 'cutlery' | 'pot';
export const SHELF_TYPES: Exclude<DishType, 'pot'>[] = ['plate', 'bowl', 'glass', 'cutlery'];
export const TYPE_NAMES: Record<DishType, string> = { plate: 'plates', bowl: 'bowls', glass: 'glasses', cutlery: 'cutlery', pot: 'pots' };
export const TYPE_LABEL: Record<DishType, string> = { plate: 'PLATES', bowl: 'BOWLS', glass: 'GLASSES', cutlery: 'CUTLERY', pot: 'POTS' };

/** Everything the job knows about one dish, wherever it is (pile, hands, rack, shelf). */
export interface Dish {
  type: DishType;
  /** Model key of the leftover food, null when scraped. */
  food: string | null;
  rinsed: boolean;
  washed: boolean;
  /** Pots only: how burnt it is, 0 = clean, 1 = charcoal. */
  burnt: number;
  /** Set when it comes out of the machine. */
  quality: 'clean' | 'spotty' | 'baked' | null;
}

const PLATE_FOODS = ['dwFoodMeat', 'dwFoodFish', 'dwFoodSushi', 'dwFoodPancakes', 'dwFoodRibs', 'dwFoodMussel', 'dwFoodDimsum', 'dwFoodCroissant'];

export function newDish(type: DishType): Dish {
  const food =
    type === 'plate' ? PLATE_FOODS[Math.floor(Math.random() * PLATE_FOODS.length)]
    : type === 'bowl' ? (Math.random() < 0.5 ? 'dwFoodSalad' : 'soup')
    : type === 'glass' ? 'wine'
    : type === 'cutlery' ? 'sauce'
    : null;
  return { type, food, rinsed: false, washed: false, burnt: type === 'pot' ? 1 : 0, quality: null };
}

export function randomDirtyType(): DishType {
  const r = Math.random();
  return r < 0.4 ? 'plate' : r < 0.62 ? 'bowl' : r < 0.82 ? 'glass' : 'cutlery';
}

/** A short status for the HUD. */
export function dishStatus(d: Dish): string {
  if (d.type === 'pot') return d.burnt > 0.02 ? (d.burnt < 1 ? `burnt, ${Math.round((1 - d.burnt) * 100)}% scrubbed` : 'burnt') : 'clean';
  if (d.washed) return d.quality === 'clean' ? 'clean' : d.quality === 'spotty' ? 'clean-ish, water spots' : 'washed, food baked on';
  if (d.food) return 'dirty, food on it';
  return d.rinsed ? 'scraped and rinsed' : 'scraped';
}

// ------------------------------------------------------------------ meshes

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });
const mats = {
  porcelain: std('#f3f0e6', { roughness: 0.3 }),
  steel: std('#c3c8cc', { metalness: 0.7, roughness: 0.3 }),
  glass: std('#cfe6ee', { transparent: true, opacity: 0.55, roughness: 0.1 }),
  burnt: std('#17110c', { roughness: 1 }),
  sauce: std('#6a3a1a', { roughness: 0.8 }),
  soup: std('#c98a2c', { roughness: 0.4 }),
  wine: std('#6d0f1e', { roughness: 0.2 }),
  baked: std('#4e2d14', { roughness: 0.9 }),
  spots: std('#e8e4d0', { roughness: 1 }),
  silver: std('#e9eef2', { metalness: 0.9, roughness: 0.2 }),
  gold: std('#f1c40f', { metalness: 0.8, roughness: 0.3 }),
  rope: std('#c8b27a', { roughness: 1 }),
  wood: std('#8a6b45', { roughness: 0.9 }),
  mopHead: std('#b9b3a2', { roughness: 1 }),
  wire: std('#cdd3d6', { metalness: 0.6, roughness: 0.4 }),
  rackBase: std('#2f6d8c', { roughness: 0.7 }),
};

function cyl(rt: number, rb: number, h: number, m: THREE.Material, seg = 14): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
}

/** A model, or a fallback shape when it did not load. */
function modelOr(key: string, fallback: () => THREE.Object3D): THREE.Object3D {
  return instantiate(key)?.object ?? fallback();
}

function tinted(key: string, color: string, fallback: () => THREE.Object3D): THREE.Object3D {
  const inst = instantiate(key);
  if (!inst) return fallback();
  const c = new THREE.Color(color);
  inst.object.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const fix = (mat: THREE.Material) => {
      const n = mat.clone() as THREE.MeshStandardMaterial;
      n.color?.multiply(c);
      if ('metalness' in n) {
        n.metalness = 0.8;
        n.roughness = 0.25;
      }
      return n;
    };
    m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material);
  });
  return inst.object;
}

/** Gives a glass model a light, see-through look (the model's own colours read as black in the dark). */
function glassy(o: THREE.Object3D): THREE.Object3D {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) m.material = mats.glass;
  });
  return o;
}

/** The bare dish, base on y = 0. */
export function buildDish(type: DishType): THREE.Group {
  const g = new THREE.Group();
  switch (type) {
    case 'plate':
      g.add(modelOr('dwPlate', () => {
        const p = cyl(0.135, 0.1, 0.025, mats.porcelain, 18);
        p.position.y = 0.0125;
        return p;
      }));
      break;
    case 'bowl':
      g.add(modelOr('dwBowl', () => {
        const b = cyl(0.095, 0.055, 0.07, mats.porcelain, 16);
        b.position.y = 0.035;
        return b;
      }));
      break;
    case 'glass':
      g.add(glassy(modelOr('dwGlass', () => {
        const s = new THREE.Group();
        const foot = cyl(0.04, 0.04, 0.01, mats.glass);
        foot.position.y = 0.005;
        const stem = cyl(0.007, 0.007, 0.09, mats.glass, 6);
        stem.position.y = 0.05;
        const cup = cyl(0.045, 0.025, 0.1, mats.glass);
        cup.position.y = 0.145;
        s.add(foot, stem, cup);
        return s;
      })));
      break;
    case 'cutlery': {
      const keys: [string, number][] = [['dwFork', -0.035], ['dwKnife', 0], ['dwSpoon', 0.035]];
      for (const [k, z] of keys) {
        const u = modelOr(k, () => {
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.01, 0.02), mats.steel);
          b.position.y = 0.005;
          return b;
        });
        u.position.z = z;
        u.rotation.y = (Math.random() - 0.5) * 0.15;
        g.add(u);
      }
      // a paper napkin band
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.12), std('#f6efe0'));
      band.position.y = 0.012;
      g.add(band);
      break;
    }
    case 'pot':
      g.add(modelOr('dwPot', () => {
        const p = new THREE.Group();
        const body = cyl(0.16, 0.15, 0.17, mats.steel, 16);
        body.position.y = 0.085;
        p.add(body);
        for (const s of [-1, 1]) {
          const h = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.03), mats.steel);
          h.position.set(s * 0.19, 0.15, 0);
          p.add(h);
        }
        return p;
      }));
      break;
  }
  return g;
}

const heightCache = new Map<DishType, number>();
/** Height of a bare dish (for stacking). */
export function dishHeight(type: DishType): number {
  let h = heightCache.get(type);
  if (h === undefined) {
    h = new THREE.Box3().setFromObject(buildDish(type)).getSize(new THREE.Vector3()).y;
    heightCache.set(type, h);
  }
  return h;
}

const DECOR = ['dwFood', 'dwGrime', 'dwBurnt'];

/** Puts the leftovers, the baked-on food, the water spots or the burn marks on a dish mesh. */
export function applyLook(g: THREE.Object3D, d: Dish): void {
  for (const n of DECOR) {
    const old = g.getObjectByName(n);
    if (old) old.parent?.remove(old);
  }
  const h = dishHeight(d.type);
  if (d.food) {
    let f: THREE.Object3D;
    if (d.food === 'soup') {
      f = cyl(0.07, 0.07, 0.01, mats.soup, 14);
      f.position.y = h * 0.75;
    } else if (d.food === 'wine') {
      f = cyl(0.032, 0.024, 0.03, mats.wine, 10);
      f.position.y = h * 0.62;
    } else if (d.food === 'sauce') {
      f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 5), mats.sauce);
      f.scale.set(1.4, 0.25, 1);
      f.position.y = 0.018;
    } else {
      f = modelOr(d.food, () => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mats.sauce);
        b.scale.y = 0.5;
        b.position.y = 0.03;
        return b;
      });
      f.position.y = d.type === 'bowl' ? h * 0.4 : h * 0.55;
      f.rotation.y = Math.random() * Math.PI * 2;
    }
    f.name = 'dwFood';
    g.add(f);
  }
  if (d.washed && d.quality === 'baked') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 5), mats.baked);
    b.scale.set(1.3, 0.2, 1.1);
    b.position.set(0.02, d.type === 'glass' ? h * 0.6 : h * 0.6 + 0.004, 0.01);
    b.name = 'dwGrime';
    g.add(b);
  } else if (d.washed && d.quality === 'spotty') {
    const s = new THREE.Group();
    s.name = 'dwGrime';
    for (let i = 0; i < 6; i++) {
      const dot = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.006, 0.018), mats.spots);
      const a = Math.random() * Math.PI * 2;
      const r = d.type === 'glass' ? 0.04 : 0.03 + Math.random() * 0.06;
      dot.position.set(Math.cos(a) * r, d.type === 'glass' ? h * (0.6 + Math.random() * 0.3) : h * 0.7, Math.sin(a) * r);
      s.add(dot);
    }
    g.add(s);
  }
  if (d.type === 'pot' && d.burnt > 0.02) {
    const b = cyl(0.14, 0.14, 0.012, mats.burnt.clone(), 16);
    (b.material as THREE.MeshStandardMaterial).transparent = true;
    (b.material as THREE.MeshStandardMaterial).opacity = 0.25 + d.burnt * 0.75;
    b.position.y = h * 0.2;
    b.name = 'dwBurnt';
    // a crust on the rim, the part that never comes off
    const crust = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 4, 14), b.material);
    crust.rotation.x = Math.PI / 2;
    crust.position.y = h * 0.42;
    b.add(crust);
    g.add(b);
  }
}

/** A dish mesh for piles, racks and shelves (not an item). */
export function dishVisual(d: Dish): THREE.Group {
  const g = buildDish(d.type);
  applyLook(g, d);
  return g;
}

function defFor(type: DishType, name: string, holdPos: [number, number, number], pocketLine: string): ItemDef {
  return {
    id: `dw-${type}`,
    name,
    category: null,
    shape: 'box',
    color: '#ffffff',
    label: [],
    weight: 0,
    pocketable: type !== 'pot',
    holdPos,
    holdRotY: -0.2,
    pocketLine,
    build: () => buildDish(type),
    tags: ['dish', type],
  };
}

export const DISH_DEFS: Record<DishType, ItemDef> = {
  plate: defFor('plate', 'Plate', [0.26, -0.3, -0.6], 'You slide a dinner plate into your trousers. It clinks when you walk.'),
  bowl: defFor('bowl', 'Bowl', [0.26, -0.3, -0.58], 'You pocket a bowl. Your pocket is now also a bowl.'),
  glass: defFor('glass', 'Wine Glass', [0.24, -0.36, -0.55], 'You pocket a wine glass. Walking is now a skill.'),
  cutlery: defFor('cutlery', 'Cutlery', [0.24, -0.28, -0.55], 'You pocket the cutlery. Your trousers are now a drawer.'),
  pot: defFor('pot', 'Saucepan', [0.2, -0.42, -0.7], ''),
};

// ------------------------------------------------------------------ the dish rack

export const RACK_SLOTS = 9;

export function buildRack(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.5), mats.rackBase);
  base.position.y = 0.01;
  g.add(base);
  for (let i = -2; i <= 2; i++) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.012), mats.wire);
    a.position.set(0, 0.025, i * 0.1);
    g.add(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.5), mats.wire);
    b.position.set(i * 0.1, 0.025, 0);
    g.add(b);
  }
  const sideMat = std('#2f6d8c', { roughness: 0.7, transparent: true, opacity: 0.85 });
  for (const s of [-1, 1]) {
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.012), sideMat);
    w1.position.set(0, 0.06, s * 0.245);
    g.add(w1);
    const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.5), sideMat);
    w2.position.set(s * 0.245, 0.06, 0);
    g.add(w2);
  }
  return g;
}

/** Where slot i of the rack is, in rack space. */
export function rackSlotPos(i: number): THREE.Vector3 {
  const col = i % 3;
  const row = Math.floor(i / 3);
  return new THREE.Vector3((col - 1) * 0.155, 0.025, (row - 1) * 0.155);
}

/** A dish mesh posed in the rack: plates stand up, glasses hang upside down. */
export function rackPose(d: Dish): THREE.Object3D {
  const v = dishVisual(d);
  v.scale.setScalar(0.7);
  const holder = new THREE.Group();
  holder.add(v);
  if (d.type === 'plate') {
    v.rotation.x = Math.PI / 2;
    v.position.y = 0.11;
  } else if (d.type === 'glass') {
    v.rotation.x = Math.PI;
    v.position.y = dishHeight('glass') * 0.7;
  } else if (d.type === 'bowl') {
    v.rotation.x = 0.6;
    v.position.y = 0.03;
  } else {
    v.rotation.z = 1.2;
    v.position.y = 0.05;
  }
  return holder;
}

export const RACK_DEF: ItemDef = {
  id: 'dw-rack',
  name: 'Dish Rack',
  category: null,
  shape: 'box',
  color: '#2f6d8c',
  label: [],
  weight: 0,
  pocketable: false,
  heavy: 0.8,
  holdPos: [0.25, -0.5, -0.85],
  holdRotY: -0.25,
  fixture: true,
  build: buildRack,
  tags: ['rack'],
};

// ------------------------------------------------------------------ toilet key, shards, mop, loot

function keyTag(): THREE.Mesh {
  const tag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, 0.12),
    new THREE.MeshStandardMaterial({ map: textTexture(['WC KEY', 'do not cook'], { w: 128, h: 80, bg: '#fdf6e3', fg: '#c0392b', border: '#c0392b' }), side: THREE.DoubleSide }),
  );
  return tag;
}

export const STOCKPOT_DEF: ItemDef = {
  id: 'dw-stockpot',
  name: 'Toilet Key (tied to a 40 litre stock pot)',
  category: null,
  shape: 'box',
  color: '#999999',
  label: [],
  weight: 0,
  pocketable: false,
  toiletKey: true,
  heavy: 0.45,
  holdPos: [0.2, -0.42, -1.05],
  holdRotY: -0.4,
  fixture: true,
  carryAchievement: 'stockpot',
  pickupLine: 'You lift the toilet key. It is tied to a 40 litre stock pot. The stock is still in it. It sloshes.',
  build: () => {
    const g = new THREE.Group();
    g.add(modelOr('dwStockPot', () => {
      const p = new THREE.Group();
      const body = cyl(0.4, 0.38, 0.5, mats.steel, 18);
      body.position.y = 0.25;
      p.add(body);
      return p;
    }));
    const h = new THREE.Box3().setFromObject(g).max.y;
    const lid = modelOr('dwPotLid', () => {
      const l = cyl(0.41, 0.41, 0.03, mats.steel, 18);
      return l;
    });
    lid.position.y = h - 0.03;
    lid.rotation.z = 0.06;
    g.add(lid);
    // the rope from the handle to the key
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 5), mats.rope);
    rope.position.set(0.5, h - 0.25, 0.05);
    rope.rotation.z = 0.25;
    g.add(rope);
    const knot = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.012, 5, 8), mats.rope);
    knot.position.set(0.46, h - 0.06, 0.05);
    g.add(knot);
    const key = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.014), mats.gold);
    key.position.set(0.56, h - 0.5, 0.05);
    g.add(key);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 5, 10), mats.gold);
    ring.position.set(0.56, h - 0.42, 0.05);
    g.add(ring);
    const tag = keyTag();
    tag.position.set(0.0, h * 0.55, 0.47);
    g.add(tag);
    return g;
  },
};

export const SHARDS_DEF: ItemDef = {
  id: 'dw-shards',
  name: 'Shards (formerly a dish)',
  category: null,
  shape: 'box',
  color: '#ffffff',
  label: [],
  weight: 0,
  pocketable: true,
  pocketLine: 'You pocket the shards. Ouch. Evidence destroyed.',
  holdPos: [0.26, -0.32, -0.6],
  build: () => {
    const g = new THREE.Group();
    g.add(modelOr('dwShards', () => new THREE.Group()));
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.035 + Math.random() * 0.03, 0), mats.porcelain);
      s.scale.y = 0.3;
      s.position.set((Math.random() - 0.5) * 0.3, 0.01, (Math.random() - 0.5) * 0.3);
      s.rotation.y = Math.random() * 6;
      g.add(s);
    }
    return g;
  },
  tags: ['shards'],
};

export const MOP_DEF: ItemDef = {
  id: 'dw-mop',
  name: 'Mop (damp since 2061)',
  category: null,
  shape: 'box',
  color: '#8a6b45',
  label: [],
  weight: 0,
  pocketable: false,
  holdPos: [0.42, -1.05, -0.85],
  holdRotY: 0,
  fixture: true,
  pickupLine: 'You take the mop. It is damp. It has always been damp.',
  build: () => {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.35, 6), mats.wood);
    stick.position.y = 0.78;
    g.add(stick);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), mats.mopHead);
      s.position.set(Math.cos(a) * 0.05, 0.1, Math.sin(a) * 0.05);
      s.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      g.add(s);
    }
    return g;
  },
  tags: ['mop'],
};

export const SILVER_DEF: ItemDef = {
  id: 'dw-silver',
  name: 'Silver Cutlery (monogrammed LRG)',
  category: null,
  shape: 'box',
  color: '#e9eef2',
  label: [],
  weight: 0,
  pocketable: true,
  fixture: true,
  holdPos: [0.24, -0.28, -0.55],
  pickupLine: 'Real silver. Engraved LRG. For guests who will never pick it up.',
  pocketLine: 'The silver slides into your sock. Your sock has never been this fancy.',
  build: () => {
    const g = new THREE.Group();
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.015, 0.16), std('#5a1420', { roughness: 0.9 }));
    tray.position.y = 0.008;
    g.add(tray);
    ([['dwFork', -0.045], ['dwKnife', 0], ['dwSpoon', 0.045]] as [string, number][]).forEach(([k, z]) => {
      const u = tinted(k, '#ffffff', () => new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.01, 0.02), mats.silver));
      u.position.set(0, 0.016, z);
      g.add(u);
    });
    return g;
  },
};

const crystalMat = std('#e8f8ff', { transparent: true, opacity: 0.7, roughness: 0.05, metalness: 0.3, emissive: '#3a5560' });

export const CRYSTAL_DEF: ItemDef = {
  id: 'dw-crystal',
  name: 'Crystal Glass (hand blown by robot lungs)',
  category: null,
  shape: 'box',
  color: '#cfe6ee',
  label: [],
  weight: 0,
  pocketable: true,
  fixture: true,
  holdPos: [0.24, -0.36, -0.55],
  pickupLine: 'A crystal glass. It rings like a tiny bell when you breathe on it.',
  pocketLine: 'You pocket the crystal glass very, very carefully. Do not sit down.',
  build: () => {
    const g = new THREE.Group();
    const v = glassy(tinted('dwGlass', '#bfe8ff', () => buildDish('glass')));
    v.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) m.material = crystalMat;
    });
    v.scale.setScalar(1.15);
    g.add(v);
    return g;
  },
};

export const BREAD_DEF: ItemDef = {
  id: 'dw-bread',
  name: 'Bread Roll (decorative, since 2068)',
  category: null,
  shape: 'box',
  color: '#c98a3c',
  label: [],
  weight: 0,
  pocketable: true,
  fixture: true,
  holdPos: [0.24, -0.3, -0.55],
  pocketAchievement: 'breadwinner',
  pickupLine: 'A bread roll. It has been served 4000 times. Nobody has ever eaten it.',
  pocketLine: 'You pocket the bread roll. It is hard as a brick. Lunch is solved until 2075.',
  build: () => {
    const g = new THREE.Group();
    g.add(modelOr('dwRoll', () => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), std('#c98a3c'));
      b.scale.y = 0.7;
      b.position.y = 0.04;
      return b;
    }));
    return g;
  },
};
