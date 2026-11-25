import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * How a model file is used in the game.
 * The model is scaled so that its largest matching dimension fits, stands on y = 0
 * and is centered on x and z.
 */
export interface ModelSpec {
  url: string;
  /** Target height in metres. */
  height?: number;
  /** Target size of the largest horizontal side in metres. */
  width?: number;
  /** Extra rotation around Y after loading, to make the model face +Z. */
  rotY?: number;
  /** Extra rotation around X, for models that lie on their back. */
  rotX?: number;
  /** Lift above the floor after fitting. */
  lift?: number;
}

interface Loaded {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

const loaded = new Map<string, Loaded>();
const specs = new Map<string, ModelSpec>();

export async function preloadModels(manifest: Record<string, ModelSpec>, onProgress?: (done: number, total: number) => void): Promise<string[]> {
  const loader = new GLTFLoader();
  const keys = Object.keys(manifest);
  const failed: string[] = [];
  let done = 0;
  await Promise.all(
    keys.map(async (key) => {
      const spec = manifest[key];
      specs.set(key, spec);
      try {
        const gltf = await loader.loadAsync(spec.url);
        gltf.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          // Some Kenney kits are exported unlit. Light them like everything else.
          const fix = (mat: THREE.Material): THREE.Material => {
            if (!(mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) return mat;
            const b = mat as THREE.MeshBasicMaterial;
            return new THREE.MeshStandardMaterial({ color: b.color, map: b.map, roughness: 0.8, transparent: b.transparent, opacity: b.opacity, side: b.side });
          };
          m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material);
          // Skinned bounds are bind pose bounds. Do not let animated robots vanish at screen edges.
          if ((m as THREE.SkinnedMesh).isSkinnedMesh) m.frustumCulled = false;
        });
        loaded.set(key, { scene: gltf.scene, animations: gltf.animations });
      } catch (e) {
        console.warn(`Model ${key} (${spec.url}) failed to load, using the fallback shape.`, e);
        failed.push(key);
      }
      done++;
      onProgress?.(done, keys.length);
    }),
  );
  return failed;
}

export function hasModel(key: string): boolean {
  return loaded.has(key);
}

export interface ModelInstance {
  object: THREE.Group;
  /** The scaled model inside object. Animate this one. */
  inner: THREE.Object3D;
  /** Scale applied to the model, for sizing attachments in model units. */
  scale: number;
  animations: THREE.AnimationClip[];
}

const M = `${import.meta.env.BASE_URL}models`;
/** Every model the game uses. Missing files fall back to the old primitive shapes. */
export const MANIFEST: Record<string, ModelSpec> = {
  // Groceries
  can: { url: `${M}/kenney-food/can.glb`, height: 0.17 },
  canSmall: { url: `${M}/kenney-food/can-small.glb`, height: 0.1 },
  bag: { url: `${M}/kenney-food/bag.glb`, height: 0.46 },
  banana: { url: `${M}/kenney-food/banana.glb`, width: 0.26 },
  apple: { url: `${M}/kenney-food/apple.glb`, height: 0.09 },
  toiletPaper: { url: `${M}/quaternius/quaternius-toilet-paper-stack.glb`, height: 0.3 },
  tire: { url: `${M}/kenney-car/wheel-dark.glb`, height: 0.7, rotY: Math.PI / 2 },
  // Props
  plant: { url: `${M}/kenney-furniture/pottedPlant.glb`, height: 1.35 },
  toilet: { url: `${M}/kenney-furniture/toilet.glb`, height: 0.8, rotY: -Math.PI / 2 },
  coffee: { url: `${M}/kenney-furniture/kitchenCoffeeMachine.glb`, height: 0.45, rotY: Math.PI },
  boxClosed: { url: `${M}/kenney-furniture/cardboardBoxClosed.glb`, height: 0.5 },
  boxOpen: { url: `${M}/kenney-furniture/cardboardBoxOpen.glb`, height: 0.45 },
  pallet: { url: `${M}/kenney-retro-urban/pallet.glb`, width: 1.4 },
  register: { url: `${M}/kenney-mini-shop/cash-register.glb`, width: 0.9, rotY: Math.PI },
  selfCheckout: { url: `${M}/kenney-mini-shop/cash-register-self.glb`, height: 1.4, rotY: Math.PI },
  freezer: { url: `${M}/kenney-mini-shop/freezers-standing.glb`, height: 2.0 },
  cart: { url: `${M}/kenney-mini-shop/shopping-cart.glb`, height: 1.0 },
  fruitDisplay: { url: `${M}/kenney-mini-shop/display-fruit.glb`, height: 1.0 },
  // Robots
  robotKenney: { url: `${M}/kenney-mini-characters/character-robot.glb`, height: 1.45 },
  robotExpressive: { url: `${M}/robot-expressive/RobotExpressive.glb`, height: 1.6 },
  robotSmall: { url: `${M}/quaternius/quaternius-robot-enemy-2legs.glb`, height: 0.85 },
  robotLarge: { url: `${M}/quaternius/quaternius-robot-enemy-large.glb`, height: 1.25 },
  robotFlying: { url: `${M}/quaternius/quaternius-robot-enemy-flying.glb`, height: 1.1, lift: 0.35 },
  mech: { url: `${M}/quaternius/quaternius-mech.glb`, height: 1.9 },
};

/** A fitted copy of a loaded model, or null if it is not available. */
export function instantiate(key: string): ModelInstance | null {
  const l = loaded.get(key);
  const spec = specs.get(key);
  if (!l || !spec) return null;
  const inner = l.animations.length ? skeletonClone(l.scene) : l.scene.clone(true);
  inner.rotation.set(spec.rotX ?? 0, spec.rotY ?? 0, 0);
  const holder = new THREE.Group();
  holder.add(inner);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  let s = 1;
  if (spec.height && size.y > 0) s = spec.height / size.y;
  else if (spec.width) s = spec.width / Math.max(size.x, size.z, 1e-6);
  inner.scale.setScalar(s);
  holder.updateMatrixWorld(true);
  box.setFromObject(inner);
  const center = box.getCenter(new THREE.Vector3());
  inner.position.x -= center.x;
  inner.position.z -= center.z;
  inner.position.y -= box.min.y - (spec.lift ?? 0);
  return { object: holder, inner, scale: s, animations: l.animations };
}
