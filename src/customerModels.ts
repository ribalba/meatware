import * as THREE from 'three';
import { instantiate, ModelInstance } from './assets';
import { textTexture } from './util';

export type CustomerKind = 'shopper' | 'karen' | 'toddler' | 'roomba' | 'gran' | 'bulk' | 'influencer';

/** What a customer looks like. The behaviour code only talks to this. */
export interface CustomerVisual {
  root: THREE.Object3D;
  /** Height of the head, used for the speech bubble and hit tests. */
  height: number;
  setFace(mood: 'normal' | 'dead'): void;
  /** Phone flash of the influencer. */
  setFlash?(on: boolean): void;
  /** Animated models only. */
  play?(anim: Anim): void;
  update?(dt: number): void;
  /** The model has its own fall animation, so the body is not tipped over. */
  hasDeath?: boolean;
}

export type Anim = 'idle' | 'walk' | 'run' | 'talk' | 'dead' | 'act';

function face(text: string, fg: string): THREE.CanvasTexture {
  return textTexture([text], { w: 128, h: 96, bg: '#0b1a2a', fg, font: 'monospace' });
}

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.4, ...extra });

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** Robot head with a screen face. Returns the face material. */
function screenHead(parent: THREE.Object3D, y: number, size: number, normal: string, fg = '#55ffff'): (mood: 'normal' | 'dead') => void {
  const grey = std('#bdc3c7');
  add(parent, new THREE.BoxGeometry(0.42 * size, 0.32 * size, 0.3 * size), grey, 0, y, 0);
  const happy = face(normal, fg);
  const dead = face('x_x', '#ff5555');
  const mat = new THREE.MeshBasicMaterial({ map: happy });
  add(parent, new THREE.PlaneGeometry(0.36 * size, 0.26 * size), mat, 0, y, 0.151 * size + 0.001);
  for (const s of [-1, 1]) {
    const ear = add(parent, new THREE.CylinderGeometry(0.05 * size, 0.05 * size, 0.06 * size, 10), grey, s * 0.24 * size, y, 0);
    ear.rotation.z = Math.PI / 2;
  }
  return (mood) => {
    mat.map = mood === 'dead' ? dead : happy;
  };
}

function wheelBase(parent: THREE.Object3D, r = 0.24): void {
  add(parent, new THREE.CylinderGeometry(r * 0.9, r, 0.1, 16), std('#2c3e50'), 0, 0.05, 0);
}

function buildPrimitiveVisual(kind: CustomerKind, color: string): CustomerVisual {
  const root = new THREE.Group();
  switch (kind) {
    case 'shopper': {
      add(root, new THREE.CapsuleGeometry(0.26, 0.6, 4, 12), std(color), 0, 0.62, 0);
      const setFace = screenHead(root, 1.3, 1, ':)');
      add(root, new THREE.BoxGeometry(0.3, 0.15, 0.22), std('#d35400', { metalness: 0 }), 0.36, 0.72, 0.08);
      wheelBase(root);
      return { root, height: 1.5, setFace };
    }
    case 'karen': {
      add(root, new THREE.CapsuleGeometry(0.27, 0.62, 4, 12), std('#8e44ad'), 0, 0.64, 0);
      const setFace = screenHead(root, 1.32, 1, '>:(', '#ff9f43');
      const hair = std('#f4d03f', { metalness: 0, roughness: 0.8 });
      const bob = add(root, new THREE.SphereGeometry(0.3, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), hair, 0, 1.42, -0.04);
      bob.scale.set(1.25, 0.9, 1.15);
      add(root, new THREE.BoxGeometry(0.12, 0.34, 0.3), hair, -0.27, 1.28, -0.02);
      add(root, new THREE.BoxGeometry(0.12, 0.34, 0.3), hair, 0.27, 1.28, -0.02);
      add(root, new THREE.BoxGeometry(0.34, 0.06, 0.08), std('#111111'), 0, 1.53, 0.1);
      add(root, new THREE.BoxGeometry(0.22, 0.18, 0.08), std('#c0392b', { metalness: 0.1 }), 0.34, 0.85, 0.02);
      wheelBase(root);
      return { root, height: 1.6, setFace };
    }
    case 'toddler': {
      const s = 0.6;
      add(root, new THREE.CapsuleGeometry(0.2, 0.3, 4, 12), std(color), 0, 0.38, 0);
      const setFace = screenHead(root, 0.86, 1.15, 'o_o', '#a3ff55');
      const cap = add(root, new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#e74c3c', { metalness: 0 }), 0, 1.04, 0);
      cap.scale.set(1.2, 0.6, 1.1);
      add(root, new THREE.CylinderGeometry(0.01, 0.01, 0.1), std('#333333'), 0, 1.14, 0);
      const prop = add(root, new THREE.BoxGeometry(0.36, 0.01, 0.05), std('#3498db', { metalness: 0 }), 0, 1.2, 0);
      prop.name = 'spin';
      wheelBase(root, 0.18 * s + 0.08);
      return { root, height: 1.15, setFace };
    }
    case 'roomba': {
      add(root, new THREE.CylinderGeometry(0.3, 0.3, 0.1, 24), std('#34495e'), 0, 0.07, 0);
      add(root, new THREE.CylinderGeometry(0.31, 0.31, 0.04, 24), std('#7f8c8d'), 0, 0.05, 0);
      add(root, new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), new THREE.MeshStandardMaterial({ color: '#2ecc71', emissive: '#2ecc71', emissiveIntensity: 1.5 }), 0, 0.13, 0.12);
      const top = new THREE.MeshBasicMaterial({ map: face('^^', '#55ffff') });
      const dead = face('x_x', '#ff5555');
      const happy = top.map;
      const screen = add(root, new THREE.PlaneGeometry(0.22, 0.16), top, 0, 0.125, -0.06);
      screen.rotation.x = -Math.PI / 2;
      return { root, height: 0.2, setFace: (m) => { top.map = m === 'dead' ? dead : happy; } };
    }
    case 'gran': {
      const body = add(root, new THREE.CapsuleGeometry(0.25, 0.5, 4, 12), std('#b39ddb', { metalness: 0.2 }), 0, 0.58, 0);
      body.rotation.x = 0.15;
      const shawl = add(root, new THREE.CylinderGeometry(0.2, 0.32, 0.25, 16), std('#d35400', { metalness: 0, roughness: 0.9 }), 0, 0.92, 0.02);
      shawl.rotation.x = 0.15;
      const setFace = screenHead(root, 1.18, 0.95, '^_^', '#ffd1dc');
      add(root, new THREE.SphereGeometry(0.11, 12, 8), std('#ecf0f1', { metalness: 0, roughness: 0.9 }), 0, 1.4, -0.08);
      const glasses = std('#111111');
      for (const sx of [-0.08, 0.08]) {
        const g = add(root, new THREE.TorusGeometry(0.05, 0.012, 6, 16), glasses, sx, 1.2, 0.16);
        g.rotation.y = 0;
      }
      const cane = add(root, new THREE.CylinderGeometry(0.02, 0.02, 0.95), std('#6e4b2a', { metalness: 0 }), 0.33, 0.48, 0.15);
      cane.rotation.z = -0.08;
      wheelBase(root);
      return { root, height: 1.45, setFace };
    }
    case 'bulk': {
      add(root, new THREE.BoxGeometry(0.75, 0.95, 0.6), std('#16a085'), 0, 0.62, 0);
      const setFace = screenHead(root, 1.32, 1.2, '$_$', '#2ecc71');
      // A shopping cart in front
      const wire = std('#bdc3c7', { metalness: 0.8, wireframe: true });
      const cart = add(root, new THREE.BoxGeometry(0.7, 0.45, 0.6), wire, 0, 0.6, 0.72);
      cart.name = 'cart';
      add(root, new THREE.BoxGeometry(0.72, 0.03, 0.03), std('#c0392b'), 0, 0.88, 0.42);
      for (const [x, z] of [[-0.3, 0.48], [0.3, 0.48], [-0.3, 0.96], [0.3, 0.96]]) add(root, new THREE.SphereGeometry(0.05, 8, 6), std('#222222'), x, 0.05, z);
      for (let i = 0; i < 5; i++) add(root, new THREE.BoxGeometry(0.18, 0.22, 0.12), std(['#f28c28', '#c0392b', '#2471a3', '#8e5a2b', '#f4f6f7'][i], { metalness: 0 }), -0.24 + i * 0.12, 0.72, 0.72 + (i % 2) * 0.1);
      wheelBase(root, 0.34);
      return { root, height: 1.6, setFace };
    }
    case 'influencer': {
      add(root, new THREE.CapsuleGeometry(0.22, 0.65, 4, 12), std('#ff6fb5'), 0, 0.62, 0);
      const setFace = screenHead(root, 1.3, 0.95, '*_*', '#ff6fb5');
      add(root, new THREE.CylinderGeometry(0.015, 0.015, 1.9), std('#333333'), -0.05, 0.95, -0.35);
      const ring = add(root, new THREE.TorusGeometry(0.28, 0.03, 8, 32), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.2 }), -0.05, 1.35, -0.36);
      ring.rotation.y = 0;
      const arm = add(root, new THREE.BoxGeometry(0.06, 0.06, 0.45), std(color), 0.22, 1.05, 0.22);
      arm.rotation.x = -0.3;
      add(root, new THREE.BoxGeometry(0.1, 0.18, 0.02), std('#111111'), 0.22, 1.16, 0.46);
      const flashMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0 });
      add(root, new THREE.SphereGeometry(0.025, 8, 6), flashMat, 0.22, 1.22, 0.475);
      wheelBase(root);
      return { root, height: 1.5, setFace, setFlash: (on) => { flashMat.emissiveIntensity = on ? 4 : 0; } };
    }
  }
}

// ------------------------------------------------------------------ animated models

/** Wires up an AnimationMixer with clip names mapped to our animation names. */
function rig(inst: ModelInstance, map: Partial<Record<Anim, string>>): Pick<CustomerVisual, 'play' | 'update' | 'hasDeath'> {
  const mixer = new THREE.AnimationMixer(inst.inner);
  const actions = new Map<Anim, THREE.AnimationAction>();
  for (const [k, name] of Object.entries(map) as [Anim, string][]) {
    const clip = inst.animations.find((c) => c.name === name);
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    if (k === 'dead' || k === 'act' || k === 'talk') {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    actions.set(k, a);
  }
  let current: THREE.AnimationAction | null = null;
  let currentKey: Anim | null = null;
  const play = (k: Anim) => {
    if (k === currentKey) return;
    const a = actions.get(k) ?? actions.get('idle');
    if (!a) return;
    currentKey = k;
    a.reset().setEffectiveWeight(1).fadeIn(0.2).play();
    if (current && current !== a) current.fadeOut(0.2);
    current = a;
  };
  play('idle');
  // Desync identical robots.
  mixer.update(Math.random() * 2);
  return { play, update: (dt) => mixer.update(dt), hasDeath: actions.has('dead') };
}

/** Gives this instance its own copies of the materials and recolors the named ones. */
function tint(inst: ModelInstance, colors: Record<string, string>): void {
  inst.object.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const fix = (mat: THREE.Material) => {
      const c = mat.clone() as THREE.MeshStandardMaterial;
      const col = colors[mat.name];
      if (col) c.color.set(col);
      return c;
    };
    m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material);
  });
}

/**
 * Attaches a prop to a bone so it moves with the animation.
 * The position is given in metres in the customer's own space, the prop keeps world size and stays upright.
 */
function attachToBone(inst: ModelInstance, boneName: string, prop: THREE.Object3D, at: THREE.Vector3): boolean {
  const bone = inst.inner.getObjectByName(boneName);
  if (!bone) return false;
  inst.object.updateMatrixWorld(true);
  const ws = bone.getWorldScale(new THREE.Vector3());
  const wq = bone.getWorldQuaternion(new THREE.Quaternion());
  prop.position.copy(bone.worldToLocal(at.clone()));
  prop.quaternion.copy(wq.invert());
  prop.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
  bone.add(prop);
  return true;
}

const Q = (n: string) => `CharacterArmature|${n}`;
const R = (n: string) => `RobotArmature|${n}`;

function buildModelVisual(kind: CustomerKind): CustomerVisual | null {
  const noFace = () => undefined;
  switch (kind) {
    case 'shopper': {
      const inst = instantiate('robotKenney');
      if (!inst) return null;
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.22), std('#d35400', { metalness: 0 }));
      attachToBone(inst, 'torso', basket, new THREE.Vector3(0.38, 0.62, 0.1));
      return {
        root: inst.object,
        height: 1.45,
        setFace: noFace,
        ...rig(inst, { idle: 'idle', walk: 'walk', run: 'sprint', talk: 'emote-yes', dead: 'die', act: 'pick-up' }),
      };
    }
    case 'karen': {
      const inst = instantiate('robotExpressive');
      if (!inst) return null;
      tint(inst, { Main: '#8e44ad' });
      const hair = new THREE.Group();
      const hairMat = std('#f4d03f', { metalness: 0, roughness: 0.8 });
      const bob = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
      bob.scale.set(1.1, 0.75, 1.05);
      hair.add(bob);
      for (const s of [-1, 1]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.42), hairMat);
        side.position.set(s * 0.29, -0.1, -0.06);
        hair.add(side);
      }
      const shades = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.1), std('#111111'));
      shades.position.set(0, 0.16, 0.14);
      hair.add(shades);
      attachToBone(inst, 'Head', hair, new THREE.Vector3(0, 1.36, -0.02));
      const handbag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.08), std('#c0392b', { metalness: 0.1 }));
      attachToBone(inst, 'Hand.L', handbag, new THREE.Vector3(0.36, 0.62, 0));
      return {
        root: inst.object,
        height: 1.6,
        setFace: noFace,
        ...rig(inst, { idle: 'Idle', walk: 'Walking', run: 'Running', talk: 'No', dead: 'Death', act: 'Punch' }),
      };
    }
    case 'toddler': {
      const inst = instantiate('robotSmall');
      if (!inst) return null;
      tint(inst, { Main: '#f39c12', Main2: '#e67e22' });
      const cap = new THREE.Group();
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#e74c3c', { metalness: 0 }));
      dome.scale.set(1.2, 0.6, 1.1);
      cap.add(dome);
      const prop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.04), std('#3498db', { metalness: 0 }));
      prop.position.y = 0.1;
      prop.name = 'spin';
      cap.add(prop);
      attachToBone(inst, 'Head', cap, new THREE.Vector3(0, 0.82, 0));
      return {
        root: inst.object,
        height: 0.95,
        setFace: noFace,
        ...rig(inst, { idle: Q('Idle'), walk: Q('Run'), run: Q('Run'), talk: Q('Jump'), dead: Q('Death'), act: Q('Attack') }),
      };
    }
    case 'gran': {
      const inst = instantiate('robotLarge');
      if (!inst) return null;
      tint(inst, { Main: '#b39ddb', Main2: '#9575cd' });
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), std('#ecf0f1', { metalness: 0, roughness: 0.9 }));
      attachToBone(inst, 'Head', bun, new THREE.Vector3(0, 1.28, -0.12));
      const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9), std('#6e4b2a', { metalness: 0 }));
      cane.position.set(0.45, 0.45, 0.25);
      inst.object.add(cane);
      return {
        root: inst.object,
        height: 1.3,
        setFace: noFace,
        ...rig(inst, { idle: Q('Idle'), walk: Q('Walk'), run: Q('Walk'), talk: Q('Jump'), dead: Q('Death') }),
      };
    }
    case 'bulk': {
      const inst = instantiate('mech');
      if (!inst) return null;
      const cart = instantiate('cart');
      if (cart) {
        cart.object.position.set(0, 0, 0.95);
        inst.object.add(cart.object);
      }
      return {
        root: inst.object,
        height: 1.9,
        setFace: noFace,
        ...rig(inst, { idle: R('Idle'), walk: R('Walk'), run: R('Run'), talk: R('Yes'), dead: R('Death'), act: R('Pickup') }),
      };
    }
    case 'influencer': {
      const inst = instantiate('robotFlying');
      if (!inst) return null;
      tint(inst, { Main: '#ff6fb5', Main2: '#ff9fd0' });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 32), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.2 }));
      ring.position.set(0, 1.25, -0.4);
      inst.object.add(ring);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.25), std('#333333'));
      pole.position.set(0, 0.62, -0.4);
      inst.object.add(pole);
      const phone = new THREE.Group();
      phone.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.02), std('#111111')));
      const flashMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0 });
      const flash = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), flashMat);
      flash.position.set(0, 0.06, 0.015);
      phone.add(flash);
      if (!attachToBone(inst, 'Hand.R', phone, new THREE.Vector3(-0.45, 0.9, 0.3))) {
        phone.position.set(-0.45, 0.9, 0.3);
        inst.object.add(phone);
      }
      return {
        root: inst.object,
        height: 1.45,
        setFace: noFace,
        setFlash: (on) => {
          flashMat.emissiveIntensity = on ? 4 : 0;
        },
        ...rig(inst, { idle: Q('Idle'), walk: Q('Walk'), run: Q('Run'), talk: Q('Shoot'), dead: Q('Dead'), act: Q('Shoot') }),
      };
    }
    default:
      return null;
  }
}

export function buildCustomerVisual(kind: CustomerKind, color: string): CustomerVisual {
  return buildModelVisual(kind) ?? buildPrimitiveVisual(kind, color);
}
