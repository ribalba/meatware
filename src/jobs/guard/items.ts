import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { instantiate } from '../../assets';
import type { ItemDef } from '../../items';
import { textTexture } from '../../util';
import { logbookTex } from './textures';

/** Items of the night shift. Everything is pocketable except the keyring. */

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });

function mesh(g: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  g.add(o);
  return o;
}

/** A big steel ring with 300 keys. Built once as two merged meshes. */
function buildKeyring(): THREE.Group {
  const g = new THREE.Group();
  const steel = std('#d8dce0', { metalness: 0.5, roughness: 0.3 });
  const ring = mesh(g, new THREE.TorusGeometry(0.16, 0.012, 6, 28), steel, 0, 0.3, 0);
  ring.rotation.y = Math.PI / 2;
  const brass: THREE.BufferGeometry[] = [];
  const silver: THREE.BufferGeometry[] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 300; i++) {
    const a = (i / 300) * Math.PI * 2 * 3 + rnd() * 0.3;
    const len = 0.06 + rnd() * 0.04;
    const k = new THREE.BoxGeometry(0.012, len, 0.004);
    const head = new THREE.BoxGeometry(0.024, 0.02, 0.005);
    head.translate(0, len / 2, 0);
    const key = mergeGeometries([k, head])!;
    key.translate(0, -len / 2 - 0.01, 0);
    const m = new THREE.Matrix4().makeRotationX(a + Math.PI + (rnd() - 0.5) * 0.6);
    m.premultiply(new THREE.Matrix4().makeRotationY((rnd() - 0.5) * 0.8));
    m.premultiply(new THREE.Matrix4().makeTranslation(0, 0.3 + Math.sin(a) * 0.16, Math.cos(a) * 0.16));
    key.applyMatrix4(m);
    (i % 3 === 0 ? silver : brass).push(key);
  }
  mesh(g, mergeGeometries(brass)!, std('#e8c050', { metalness: 0.5, roughness: 0.35 }));
  mesh(g, mergeGeometries(silver)!, steel);
  const tag = mesh(g, new THREE.BoxGeometry(0.01, 0.08, 0.12), std('#c0392b'), 0, 0.08, 0);
  tag.rotation.x = 0.3;
  return g;
}

function buildMug(): THREE.Group {
  const g = new THREE.Group();
  const white = std('#e9e4d6', { roughness: 0.35 });
  mesh(g, new THREE.CylinderGeometry(0.045, 0.04, 0.1, 12, 1, true), white, 0, 0.05, 0);
  mesh(g, new THREE.CylinderGeometry(0.04, 0.04, 0.005, 12), white, 0, 0.003, 0);
  const coffee = mesh(g, new THREE.CircleGeometry(0.042, 12), std('#2a1a0e', { roughness: 0.2 }), 0, 0.085, 0);
  coffee.rotation.x = -Math.PI / 2;
  coffee.name = 'coffee';
  const handle = mesh(g, new THREE.TorusGeometry(0.025, 0.008, 6, 10, Math.PI), white, 0.045, 0.05, 0);
  handle.rotation.z = -Math.PI / 2;
  const print = mesh(g, new THREE.PlaneGeometry(0.05, 0.04), new THREE.MeshStandardMaterial({ map: textTexture(['#1', 'GUARD'], { w: 64, h: 48, bg: '#e9e4d6', fg: '#c0392b' }) }), 0, 0.05, 0.046);
  print.rotation.y = 0;
  return g;
}

function buildLogbook(): THREE.Group {
  const g = new THREE.Group();
  mesh(g, new THREE.BoxGeometry(0.42, 0.025, 0.3), std('#2b3a5a'), 0, 0.0125, 0);
  const pages = mesh(g, new THREE.PlaneGeometry(0.4, 0.28), new THREE.MeshStandardMaterial({ map: logbookTex(), roughness: 0.9 }), 0, 0.027, 0);
  pages.rotation.x = -Math.PI / 2;
  const pen = mesh(g, new THREE.CylinderGeometry(0.005, 0.005, 0.14, 6), std('#1a1a1a'), 0.08, 0.035, 0.02);
  pen.rotation.z = Math.PI / 2;
  pen.rotation.y = 0.5;
  return g;
}

function buildServo(): THREE.Group {
  const g = new THREE.Group();
  const gold = std('#d4a62a', { metalness: 0.9, roughness: 0.25 });
  mesh(g, new THREE.BoxGeometry(0.16, 0.1, 0.09), gold, 0, 0.05, 0);
  mesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), std('#ece5d0', { metalness: 0.6 }), 0.04, 0.115, 0);
  mesh(g, new THREE.BoxGeometry(0.22, 0.01, 0.04), gold, 0, 0.015, 0);
  return g;
}

function buildEye(): THREE.Group {
  const g = new THREE.Group();
  mesh(g, new THREE.SphereGeometry(0.06, 12, 8), std('#ecf0f1', { roughness: 0.2 }), 0, 0.06, 0);
  mesh(g, new THREE.SphereGeometry(0.03, 10, 6), new THREE.MeshStandardMaterial({ color: '#ff3030', emissive: '#ff2020', emissiveIntensity: 1.2 }), 0, 0.07, 0.04);
  mesh(g, new THREE.CylinderGeometry(0.004, 0.004, 0.12, 4), std('#c0392b'), 0, 0.02, -0.08).rotation.x = 1.2;
  return g;
}

function buildHand(): THREE.Group {
  const g = new THREE.Group();
  const metal = std('#9aa3ab', { metalness: 0.7, roughness: 0.35 });
  mesh(g, new THREE.BoxGeometry(0.1, 0.03, 0.1), metal, 0, 0.015, 0);
  for (let i = 0; i < 4; i++) mesh(g, new THREE.BoxGeometry(0.018, 0.02, 0.08), metal, -0.036 + i * 0.024, 0.012, 0.085);
  mesh(g, new THREE.BoxGeometry(0.02, 0.02, 0.06), metal, 0.06, 0.012, 0.02).rotation.y = -0.6;
  mesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), std('#2c3e50'), 0, 0.02, -0.07).rotation.x = Math.PI / 2;
  return g;
}

function buildCog(): THREE.Group {
  const g = new THREE.Group();
  const inst = instantiate('guardCog');
  if (inst) {
    g.add(inst.object);
    return g;
  }
  const m = std('#7f8c8d', { metalness: 0.7 });
  mesh(g, new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12), m, 0, 0.02, 0);
  for (let i = 0; i < 8; i++) {
    const t = mesh(g, new THREE.BoxGeometry(0.04, 0.04, 0.04), m, Math.cos((i / 8) * Math.PI * 2) * 0.11, 0.02, Math.sin((i / 8) * Math.PI * 2) * 0.11);
    t.rotation.y = -(i / 8) * Math.PI * 2;
  }
  return g;
}

function buildScrews(): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.MeshStandardMaterial({ map: textTexture(['SCREWS', 'x 37,000', 'M3 assorted'], { w: 128, h: 96, bg: '#e2b04a', fg: '#3a2a10', border: '#3a2a10' }) });
  const side = std('#e2b04a');
  mesh(g, new THREE.BoxGeometry(0.2, 0.12, 0.14), [side, side, side, side, box, box], 0, 0.06, 0);
  return g;
}

function buildToaster(): THREE.Group {
  const g = new THREE.Group();
  const inst = instantiate('guardToaster');
  if (inst) g.add(inst.object);
  else {
    mesh(g, new THREE.BoxGeometry(0.26, 0.18, 0.15), std('#c9ced2', { metalness: 0.7, roughness: 0.25 }), 0, 0.09, 0);
    mesh(g, new THREE.BoxGeometry(0.03, 0.05, 0.02), std('#222'), 0.15, 0.1, 0);
  }
  const glow = new THREE.MeshStandardMaterial({ color: '#ff5a1a', emissive: '#ff3a0a', emissiveIntensity: 1.6 });
  for (const x of [-0.04, 0.04]) mesh(g, new THREE.BoxGeometry(0.03, 0.012, 0.09), glow, x, 0.2, 0);
  return g;
}

function buildDonut(): THREE.Group {
  const g = new THREE.Group();
  const d = mesh(g, new THREE.TorusGeometry(0.045, 0.022, 8, 14), std('#c8894a'), 0, 0.022, 0);
  d.rotation.x = Math.PI / 2;
  const icing = mesh(g, new THREE.TorusGeometry(0.045, 0.019, 8, 14, Math.PI * 2), std('#f19cc0', { roughness: 0.3 }), 0, 0.03, 0);
  icing.rotation.x = Math.PI / 2;
  icing.scale.z = 0.6;
  return g;
}

const job = (d: Omit<ItemDef, 'category' | 'label' | 'weight' | 'shape' | 'color'> & Partial<ItemDef>): ItemDef => ({
  category: null,
  label: [],
  weight: 0,
  shape: 'box',
  color: '#888888',
  ...d,
});

export const KEYRING_DEF = job({
  id: 'guardKeyring',
  name: 'Keyring (300 keys)',
  pocketable: false,
  toiletKey: true,
  heavy: 0.62,
  fixture: true,
  holdPos: [0.18, -0.48, -0.7],
  holdRotY: -0.4,
  carryAchievement: 'guardKeys',
  pickupLine: 'You lift the keyring. 300 keys. One of them opens the toilet. It jangles like a tambourine at a funeral.',
  build: buildKeyring,
  tags: ['keys'],
});

export const MUG_DEF = job({
  id: 'guardMug',
  name: 'Cold Coffee (Day 3)',
  pocketable: true,
  holdPos: [0.16, -0.2, -0.55],
  pickupLine: 'Cold coffee. Your loyal companion. R to sip.',
  pocketLine: 'You pocket the mug, coffee and all. Your trousers are now also cold.',
  build: buildMug,
  tags: ['mug'],
});

export const LOGBOOK_DEF = job({
  id: 'guardLogbook',
  name: 'Security Logbook',
  pocketable: true,
  holdPos: [0.16, -0.22, -0.6],
  pickupLine: 'The security logbook. 11 years of "nothing happened". Some pages are just drawings of the toaster.',
  pocketLine: 'You pocket the logbook. No log, no incidents. Technically.',
  build: buildLogbook,
  tags: ['logbook'],
});

export const PART_DEFS: ItemDef[] = [
  job({ id: 'guardServo', name: 'Gold-Plated Servo', pocketable: true, build: buildServo, pickupLine: 'A gold-plated servo. The robots get the good stuff.', pocketLine: 'You pocket the servo. It whirs a little. In shame.' }),
  job({ id: 'guardEye', name: 'Robot Eye (Left)', pocketable: true, build: buildEye, pickupLine: 'A robot eye. It is still recording.' }),
  job({ id: 'guardHand', name: 'Prototype Robot Hand', pocketable: true, build: buildHand, pickupLine: 'A robot hand. It gives you a thumbs up. Then a different finger.' }),
  job({ id: 'guardCogItem', name: 'Spare Cog', pocketable: true, build: buildCog }),
  job({ id: 'guardScrews', name: 'Box of 37,000 Screws', pocketable: true, build: buildScrews, pickupLine: '37,000 screws. Nobody will miss one box.', pocketLine: 'You pocket 37,000 screws. You rattle now.' }),
];

export const TOASTER_DEF = job({
  id: 'guardToasterItem',
  name: 'Suspicious Toaster',
  pocketable: true,
  build: buildToaster,
  pickupLine: 'The toaster is warm. It was never plugged in.',
  pocketLine: 'You pocket the suspicious toaster. Now you are the suspicious one.',
});

export const DONUT_DEF = job({
  id: 'guardDonut',
  name: 'Decorative Donut (Display Only)',
  pocketable: true,
  build: buildDonut,
  pickupLine: 'A donut. The sign said display only. The sign is not your manager.',
});
