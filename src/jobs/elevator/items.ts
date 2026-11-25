import * as THREE from 'three';
import { instantiate } from '../../assets';
import type { ItemDef } from '../../items';
import { textTexture } from '../../util';

/** Items of the elevator job: the toilet key on its manual and what passengers leave behind. */

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
const label = (lines: string[], bg: string, fg: string, w = 256, h = 256) =>
  new THREE.MeshStandardMaterial({ map: textTexture(lines, { w, h, bg, fg, border: fg }), roughness: 0.7 });

function box(g: THREE.Group, w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number): THREE.Mesh {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  g.add(b);
  return b;
}

/** A model from the job manifest, fitted into a group, or null. */
function model(key: string): THREE.Group | null {
  const inst = instantiate(key);
  if (!inst) return null;
  const g = new THREE.Group();
  g.add(inst.object);
  return g;
}

export const MANUAL_DEF: ItemDef = {
  id: 'evManual',
  name: 'Toilet Key (clipped to the 30 kg Elevator Safety Manual)',
  category: null,
  shape: 'box',
  color: '#8e1f16',
  label: [],
  weight: 0,
  pocketable: false,
  toiletKey: true,
  heavy: 0.45,
  fixture: true,
  holdPos: [0.45, -0.52, -1.05],
  holdRotY: -0.5,
  carryAchievement: 'evManual',
  pickupLine: 'You lift the Elevator Safety Manual. All twelve volumes, one binder, 30 kg. The toilet key is clipped to the spine.',
  build: () => {
    const g = new THREE.Group();
    const red = std('#8e1f16', { roughness: 0.6 });
    const pages = std('#efe6cf', { roughness: 0.9 });
    const front = label(['ELEVATOR', 'SAFETY MANUAL', 'VOL. 1-12', 'DO NOT READ'], '#8e1f16', '#f2d31b', 256, 320);
    // pages, then the cover wrapped around three sides
    box(g, 0.44, 0.56, 0.24, pages, 0.01, 0.28, 0);
    box(g, 0.46, 0.58, 0.02, [red, red, red, red, front, red], 0, 0.29, 0.13);
    box(g, 0.46, 0.58, 0.02, red, 0, 0.29, -0.13);
    box(g, 0.04, 0.58, 0.28, red, -0.23, 0.29, 0);
    // ring mechanism and the key on a chain
    const metal = std('#c8ccd0', { metalness: 0.8, roughness: 0.3 });
    for (const y of [0.12, 0.29, 0.46]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12), metal);
      ring.position.set(-0.26, y, 0);
      ring.rotation.y = Math.PI / 2;
      g.add(ring);
    }
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16), metal);
    chain.position.set(-0.27, 0.06, 0.05);
    g.add(chain);
    box(g, 0.012, 0.1, 0.045, std('#f1c40f', { metalness: 0.8, roughness: 0.3 }), -0.27, -0.04, 0.05);
    return g;
  },
};

export const UMBRELLA_DEF: ItemDef = {
  id: 'evUmbrella', name: 'Umbrella (Robot Sized)', category: null, shape: 'box', color: '#2c3e50', label: [], weight: 0, pocketable: true,
  holdPos: [0.3, -0.35, -0.6],
  pocketLine: 'You fold the umbrella into your pocket. It is raining in the tower forecast. Not your problem.',
  pickupLine: 'Someone left an umbrella. It has never rained in here. It is a status symbol.',
  build: () => {
    const g = new THREE.Group();
    const cloth = std('#2c3e50');
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 0.62, 8), cloth);
    cone.position.y = 0.4;
    g.add(cone);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 6), std('#888888', { metalness: 0.6 }));
    shaft.position.y = 0.8;
    g.add(shaft);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 10, Math.PI), std('#6e4b2a'));
    handle.position.set(0.05, 0.08, 0);
    handle.rotation.z = Math.PI;
    g.add(handle);
    box(g, 0.012, 0.1, 0.012, std('#6e4b2a'), 0, 0.12, 0);
    g.rotation.z = Math.PI / 2;
    const outer = new THREE.Group();
    outer.add(g);
    g.position.set(0.42, 0.06, 0);
    return outer;
  },
};

export const MUG_DEF: ItemDef = {
  id: 'evMug', name: "Mug (WORLD'S OKAYEST ROBOT)", category: null, shape: 'box', color: '#f4f1e8', label: [], weight: 0, pocketable: true,
  pocketLine: 'You pocket the mug. It is still warm. Robots drink hot oil. Your pocket is now also warm.',
  build: () => {
    const m = model('evMug');
    if (m) return m;
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 12), std('#f4f1e8'));
    c.position.y = 0.05;
    g.add(c);
    return g;
  },
};

export const BRIEFCASE_DEF: ItemDef = {
  id: 'evBriefcase', name: 'Briefcase (Locked, Ticking)', category: null, shape: 'box', color: '#4a2e1a', label: [], weight: 0, pocketable: false,
  holdPos: [0.3, -0.45, -0.65],
  pickupLine: 'A briefcase. It is ticking softly. It is probably a clock. Probably.',
  build: () => {
    const g = new THREE.Group();
    const leather = std('#4a2e1a', { roughness: 0.5 });
    box(g, 0.46, 0.34, 0.12, leather, 0, 0.17, 0);
    const gold = std('#c9a227', { metalness: 0.8, roughness: 0.3 });
    box(g, 0.16, 0.03, 0.03, gold, 0, 0.37, 0);
    box(g, 0.03, 0.05, 0.03, gold, -0.08, 0.35, 0);
    box(g, 0.03, 0.05, 0.03, gold, 0.08, 0.35, 0);
    box(g, 0.05, 0.03, 0.13, gold, -0.15, 0.3, 0);
    box(g, 0.05, 0.03, 0.13, gold, 0.15, 0.3, 0);
    return g;
  },
};

export const PEN_DEF: ItemDef = {
  id: 'evPen', name: 'Golden Pen (Signs Layoffs)', category: null, shape: 'box', color: '#c9a227', label: [], weight: 0, pocketable: true,
  pocketLine: 'You pocket the golden pen. It has signed 40,000 layoffs. Now it will sign your crossword.',
  pickupLine: 'The executive dropped a golden pen. It is heavier than your salary.',
  build: () => {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.16, 8), std('#e0b21b', { metalness: 0.9, roughness: 0.25 }));
    p.rotation.z = Math.PI / 2;
    p.position.y = 0.015;
    g.add(p);
    return g;
  },
};

export const DUCK_DEF: ItemDef = {
  id: 'evDuck', name: 'Rubber Robo-Duck', category: null, shape: 'box', color: '#f2d31b', label: [], weight: 0, pocketable: true,
  pickupLine: 'The toddler left its rubber duck. It squeaks in binary.',
  build: () => {
    const g = new THREE.Group();
    const y = std('#f2d31b', { roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), y);
    body.scale.set(1.3, 0.8, 1);
    body.position.y = 0.055;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), y);
    head.position.set(0.05, 0.13, 0);
    g.add(head);
    box(g, 0.04, 0.015, 0.03, std('#e8862a'), 0.1, 0.13, 0);
    box(g, 0.02, 0.02, 0.05, std('#3aa0ff', { emissive: '#3aa0ff', emissiveIntensity: 1 }), 0.075, 0.15, 0);
    return g;
  },
};

export const USB_DEF: ItemDef = {
  id: 'evUsb', name: 'USB Stick (Q3_layoffs_FINAL_v7.zip)', category: null, shape: 'box', color: '#1e1e1e', label: [], weight: 0, pocketable: true,
  pocketLine: 'You pocket the USB stick. You now own a list of names. One of them is yours.',
  build: () => {
    const g = new THREE.Group();
    box(g, 0.08, 0.015, 0.03, std('#1e1e1e'), 0, 0.008, 0);
    box(g, 0.025, 0.01, 0.022, std('#c8ccd0', { metalness: 0.8 }), 0.05, 0.008, 0);
    return g;
  },
};

export const PARCEL_DEF: ItemDef = {
  id: 'evParcel', name: 'Giant Parcel (Fragile, Signed For)', category: null, shape: 'box', color: '#a87a46', label: [], weight: 0, pocketable: false,
  heavy: 0.5, holdPos: [0.1, -0.75, -1.1],
  pickupLine: 'The parcel weighs as much as a small fridge. It says FRAGILE on six sides.',
  build: () => {
    const g = new THREE.Group();
    const card = std('#a87a46', { roughness: 0.9 });
    const tag = label(['FRAGILE', 'THIS WAY UP', 'FLOOR 4'], '#a87a46', '#7a1f14');
    box(g, 0.9, 0.8, 0.7, [card, card, card, card, tag, tag], 0, 0.4, 0);
    box(g, 0.92, 0.1, 0.72, std('#c9a36a'), 0, 0.4, 0);
    return g;
  },
};

/** What each kind of passenger may forget in the cabin. */
export const LEFT_BEHIND: Record<string, ItemDef[]> = {
  commuter: [UMBRELLA_DEF, MUG_DEF, BRIEFCASE_DEF, USB_DEF],
  chatty: [MUG_DEF, UMBRELLA_DEF],
  exec: [PEN_DEF, BRIEFCASE_DEF],
  toddler: [DUCK_DEF],
  delivery: [],
  influencer: [MUG_DEF],
};

/** Weight on the cabin scale for things in the hands. */
export function heldWeight(def: ItemDef | undefined): number {
  if (!def) return 0;
  if (def.id === 'evManual') return 30;
  if (def.id === 'evParcel') return 140;
  if (def.id === 'evBriefcase') return 6;
  return 1;
}
