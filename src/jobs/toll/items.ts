import * as THREE from 'three';
import type { ItemDef } from '../../items';
import { textTexture } from '../../util';
import { armTex } from './textures';

/** Items of the toll booth job. */

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });

/** An invisible box that makes small things easier to aim at. Its bottom sits at y = 0. */
function hitBox(g: THREE.Group, w: number, h: number, d: number): void {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  m.position.y = h / 2 - 0.004;
  g.add(m);
}

const coinMat = std('#e2b33c', { metalness: 0.7, roughness: 0.3 });
const coinEdge = std('#a87a1c', { metalness: 0.7, roughness: 0.4 });

export const COIN_DEF: ItemDef = {
  id: 'tollCoin',
  name: 'Toll Coin (1 credit)',
  category: null,
  shape: 'box',
  color: '#e2b33c',
  label: [],
  weight: 0,
  pocketable: true,
  tags: ['coin'],
  holdPos: [0.22, -0.2, -0.45],
  pocketLine: 'You pocket the coin. It is warm from the asphalt. Finders keepers.',
  build: () => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.016, 12), [coinEdge, coinMat, coinMat]);
    c.position.y = 0.008;
    g.add(c);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 4, 12), coinEdge);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.017;
    g.add(rim);
    hitBox(g, 0.34, 0.34, 0.34);
    return g;
  },
};

/** RoboGran's tiny coins. Only used as a flying prop. */
export function tinyCoinMesh(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.006, 8), coinMat);
  return m;
}

export const CASHBOX_DEF: ItemDef = {
  id: 'cashBox',
  name: 'Cash Box (Booth 3)',
  category: null,
  shape: 'box',
  color: '#5d6d7e',
  label: [],
  weight: 0,
  pocketable: true,
  fixture: true,
  heavy: 0.8,
  holdPos: [0.3, -0.38, -0.7],
  pickupLine: 'You lift the cash box. It jingles. It sounds like a pay rise you will never get.',
  pocketLine: 'You fold the cash box into your trousers. It jingles with every step.',
  pocketAchievement: 'cashBox',
  build: () => {
    const g = new THREE.Group();
    const body = std('#56606b', { metalness: 0.6, roughness: 0.35 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.3), body);
    b.position.y = 0.08;
    g.add(b);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.03, 0.31), std('#6c7884', { metalness: 0.6, roughness: 0.3 }));
    lid.position.y = 0.175;
    g.add(lid);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.005, 0.02), std('#111111'));
    slot.position.y = 0.192;
    g.add(slot);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 4, 10, Math.PI), std('#2c2c2c'));
    handle.position.set(0, 0.19, 0);
    g.add(handle);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.09), new THREE.MeshStandardMaterial({ map: textTexture(['CASH', 'BOOTH 3'], { w: 128, h: 40, bg: '#f2d31b', fg: '#222222' }) }));
    label.position.set(0, 0.08, 0.151);
    g.add(label);
    return g;
  },
};

/** A barrier arm mesh along x, centered. */
function armMesh(len: number): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.BoxGeometry(len, 0.11, 0.11), new THREE.MeshStandardMaterial({ map: armTex([Math.max(1, Math.round(len * 1.5)), 1]), roughness: 0.6 }));
  pole.position.y = 0.06;
  g.add(pole);
  // reflectors
  const refl = std('#ff3b2f', { emissive: '#ff2010', emissiveIntensity: 0.5 });
  for (let i = -1; i <= 1; i++) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.115), refl);
    r.position.set(i * len * 0.3, 0.06, 0);
    g.add(r);
  }
  return g;
}

export const KEY_ARM_DEF: ItemDef = {
  id: 'keyArm',
  name: 'Toilet Key (attached to the spare barrier arm)',
  category: null,
  shape: 'box',
  color: '#c8231b',
  label: [],
  weight: 0,
  pocketable: false,
  fixture: true,
  toiletKey: true,
  heavy: 0.5,
  holdPos: [0.42, -0.42, -0.55],
  holdRotY: 1.38,
  carryAchievement: 'armKey',
  pickupLine: 'You lift the toilet key. It is attached to a 3.4 metre barrier arm. Of course it is.',
  build: () => {
    const g = armMesh(3.3);
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.22),
      new THREE.MeshStandardMaterial({ map: textTexture(['TOILET KEY', 'spare arm. do not use.'], { w: 192, h: 70, bg: '#ffffff', fg: '#c0392b', border: '#c0392b' }), side: THREE.DoubleSide }),
    );
    tag.position.set(0.9, 0.06, 0.06);
    g.add(tag);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16), std('#bdc3c7', { metalness: 0.8, roughness: 0.3 }));
    chain.position.set(1.5, -0.06, 0);
    g.add(chain);
    const key = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.012), std('#f1c40f', { metalness: 0.8, roughness: 0.3 }));
    key.position.set(1.5, -0.19, 0);
    g.add(key);
    return g;
  },
};

export const BROKEN_ARM_DEF: ItemDef = {
  id: 'brokenArm',
  name: 'Barrier Arm (snapped off by a customer)',
  category: null,
  shape: 'box',
  color: '#c8231b',
  label: [],
  weight: 0,
  pocketable: false,
  heavy: 0.75,
  holdPos: [0.4, -0.4, -0.6],
  holdRotY: 1.3,
  pickupLine: 'The snapped barrier arm. Still warm from the bumper. Duct tape could fix this.',
  build: () => armMesh(2.2),
};

export const RECEIPT_DEF: ItemDef = {
  id: 'receipt',
  name: 'Receipt (legally important)',
  category: null,
  shape: 'box',
  color: '#ffffff',
  label: [],
  weight: 0,
  pocketable: true,
  tags: ['receipt'],
  holdPos: [0.2, -0.18, -0.45],
  pickupLine: 'You caught the receipt. It says: TOLL 2.00 CR. THANK YOU FOR CHOOSING A HUMAN.',
  pocketLine: 'You pocket the receipt. Somewhere a robot is waiting for it. Forever.',
  build: () => {
    const g = new THREE.Group();
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.26),
      new THREE.MeshStandardMaterial({ map: textTexture(['RECEIPT', 'TOLL 2.00', 'THANK YOU', 'NO REFUNDS'], { w: 64, h: 140, bg: '#f7f3e8', fg: '#333333' }), side: THREE.DoubleSide }),
    );
    p.rotation.x = -Math.PI / 2;
    p.position.y = 0.01;
    g.add(p);
    hitBox(g, 0.36, 0.3, 0.4);
    return g;
  },
};
