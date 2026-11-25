import * as THREE from 'three';
import { instantiate } from './assets';
import type { BeerSpot } from './beer';
import type { BreakableOpts, HideSpot } from './fun';
import { Item, ItemDef } from './items';
import { AABB, aabb, Rect, TextTexOpts, textTexture } from './util';

/**
 * Shared building blocks for job levels: the parts every workplace has
 * (walls and colliders, signs, models, plants, a staff toilet with a locked door).
 */

/** What the player looks at. Jobs add their own kinds and fields. */
export interface Interact {
  kind: string;
  item?: Item;
  text?: string;
  [key: string]: unknown;
}

export interface Plant {
  group: THREE.Group;
  pos: THREE.Vector3;
}

/** Everything the shift engine needs to know about a job's building. */
export interface Level {
  colliders: AABB[];
  interactables: THREE.Object3D[];
  plants: Plant[];
  initialItems: Item[];
  /** The walkable room. */
  bounds: Rect;
  /** Items bounce off this height. */
  ceiling: number;
  spawn: { pos: THREE.Vector3; yaw: number };
  /** Inside of the staff toilet. */
  booth: Rect;
  /** Where Brad waits while you are in the toilet. */
  doorFront: THREE.Vector3;
  bossWaypoints: THREE.Vector3[];
  /** Where the beer crate goes. Without it the engine finds a spot against a wall. */
  beerSpot?: BeerSpot;
  /** Places where Brad cannot see the player. */
  hideSpots: HideSpot[];
  updateDoor(dt: number, open: boolean): void;
  /** Animations of the building (lamps, machines). */
  tick(t: number): void;
}

export function mat(color: string, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
}

export class LevelKit implements Level {
  colliders: AABB[] = [];
  interactables: THREE.Object3D[] = [];
  plants: Plant[] = [];
  initialItems: Item[] = [];
  bounds: Rect = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  ceiling = 4.7;
  spawn = { pos: new THREE.Vector3(), yaw: 0 };
  booth: Rect = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  doorFront = new THREE.Vector3();
  bossWaypoints: THREE.Vector3[] = [];
  beerSpot?: BeerSpot;
  hideSpots: HideSpot[] = [];
  doorPivot = new THREE.Group();
  doorCollider: AABB = aabb(0, 0, 0, 0, 0);
  doorAngle = 0;
  scene: THREE.Scene;
  private tickers: ((t: number) => void)[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  updateDoor(dt: number, open: boolean): void {
    const target = open ? Math.PI / 2 : 0;
    this.doorAngle += (target - this.doorAngle) * Math.min(1, dt * 6);
    this.doorPivot.rotation.y = this.doorAngle;
    this.doorCollider.disabled = this.doorAngle > 0.25;
  }

  tick(t: number): void {
    for (const f of this.tickers) f(t);
  }

  /** Registers an animation that runs every frame with the time in seconds. */
  onTick(f: (t: number) => void): void {
    this.tickers.push(f);
  }

  box(w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number, parent: THREE.Object3D = this.scene): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  /**
   * A flat sign with text. With `text` it becomes readable with E.
   * With `glow` it is unlit and shines (screens, neon, exit signs).
   */
  sign(lines: string[], w: number, h: number, x: number, y: number, z: number, rotY: number, opts: TextTexOpts = {}, text?: string, glow = false): THREE.Mesh {
    const tw = 512;
    const th = Math.max(64, Math.round((tw * h) / w));
    const map = textTexture(lines, { w: tw, h: th, ...opts });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glow ? new THREE.MeshBasicMaterial({ map }) : new THREE.MeshStandardMaterial({ map, roughness: 0.8 }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    this.scene.add(m);
    if (text) {
      m.userData.interact = { kind: 'sign', text } satisfies Interact;
      this.interactables.push(m);
    }
    return m;
  }

  /** Places a model from the manifest. Returns null if it did not load. */
  prop(key: string, x: number, y: number, z: number, rotY = 0, parent: THREE.Object3D = this.scene): THREE.Object3D | null {
    const inst = instantiate(key);
    if (!inst) return null;
    inst.object.position.set(x, y, z);
    inst.object.rotation.y = rotY;
    parent.add(inst.object);
    return inst.object;
  }

  /** Adds a solid box to the collision map. */
  solid(cx: number, cz: number, w: number, d: number, h: number, occludes = true, tag?: string): AABB {
    const c = aabb(cx, cz, w, d, h, occludes, tag);
    this.colliders.push(c);
    return c;
  }

  /**
   * Makes an object breakable: the player can kick it (K or right mouse) or hit it with a
   * thrown item. It vanishes in a burst of debris and costs money on the payslip.
   */
  breakable<T extends THREE.Object3D>(obj: T, opts: BreakableOpts): T {
    obj.userData.breakable = { ...opts, hp: opts.hp ?? 1 };
    if (!obj.userData.interact) obj.userData.interact = { kind: 'breakable', name: opts.name } satisfies Interact;
    if (!this.interactables.includes(obj)) this.interactables.push(obj);
    return obj;
  }

  /** A place where Brad cannot see the player (inside a locker, behind a curtain, under a desk). */
  hideSpot(minX: number, minZ: number, maxX: number, maxZ: number, name: string): void {
    this.hideSpots.push({ rect: { minX, minZ, maxX, maxZ }, name });
  }

  /**
   * Turns a decorative object into an item the player can pick up, carry, throw, kick
   * and push around. Its base should be at the object's origin. Do not add a collider for it.
   */
  movable(obj: THREE.Object3D, name: string, opts: Partial<ItemDef> = {}): Item {
    obj.updateWorldMatrix(true, false);
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    obj.matrixWorld.decompose(pos, quat, new THREE.Vector3());
    obj.parent?.remove(obj);
    obj.position.set(0, 0, 0);
    obj.quaternion.identity();
    const def: ItemDef = {
      id: `prop-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      category: null,
      shape: 'box',
      color: '#888888',
      label: [],
      weight: 0,
      pocketable: false,
      fixture: true,
      ...opts,
      build: () => {
        const g = new THREE.Group();
        g.add(obj);
        return g;
      },
    };
    const it = new Item(def);
    it.mesh.position.copy(pos);
    it.mesh.position.y = Math.max(pos.y, it.baseOffset);
    it.mesh.quaternion.copy(quat);
    it.sleeping = true;
    this.scene.add(it.mesh);
    this.initialItems.push(it);
    return it;
  }

  /** A potted plant. Plants are a valid (but frowned upon) toilet. */
  plant(x: number, z: number): Plant {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    if (!this.prop('plant', 0, 0, 0, Math.random() * Math.PI * 2, g)) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.5, 16), mat('#c0603a'));
      p.position.y = 0.25;
      g.add(p);
      const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), mat('#2e8b57', { roughness: 0.9 }));
      l.position.y = 0.9;
      g.add(l);
    }
    g.userData.interact = { kind: 'plant' } satisfies Interact;
    this.scene.add(g);
    this.interactables.push(g);
    const plant = { group: g, pos: new THREE.Vector3(x, 0, z) };
    this.plants.push(plant);
    this.solid(x, z, 0.6, 0.6, 0.6, false, 'plant');
    return plant;
  }

  /**
   * The staff toilet: a 5 x 4 m booth whose inside spans x0..x0+5 and z0..z0+4.
   * The locked door is in the middle of the west wall (x = x0), so place the booth
   * with its west side facing the room. `keyLines` go on the sign next to the door.
   */
  toiletBooth(x0: number, z0: number, keyLines: string[]): void {
    const tile = mat('#dfe8ec');
    const H = 2.6;
    const walls = [
      this.box(5, H, 0.15, tile, x0 + 2.5, H / 2, z0 + 4),
      this.box(5, H, 0.15, tile, x0 + 2.5, H / 2, z0),
      this.box(0.15, H, 4, tile, x0 + 5, H / 2, z0 + 2),
      this.box(0.15, H, 1.6, tile, x0, H / 2, z0 + 0.8),
      this.box(0.15, H, 1.4, tile, x0, H / 2, z0 + 3.3),
      this.box(0.15, 0.4, 1.0, tile, x0, 2.4, z0 + 2.1),
      this.box(5, 0.1, 4, tile, x0 + 2.5, H, z0 + 2),
    ];
    for (const w of walls) {
      w.userData.interact = { kind: 'wall' } satisfies Interact;
      this.interactables.push(w);
    }
    this.solid(x0 + 2.5, z0 + 4, 5, 0.15, H, true, 'booth');
    this.solid(x0 + 2.5, z0, 5, 0.15, H, true, 'booth');
    this.solid(x0 + 5, z0 + 2, 0.15, 4, H, true, 'booth');
    this.solid(x0, z0 + 0.8, 0.15, 1.6, H, true, 'booth');
    this.solid(x0, z0 + 3.3, 0.15, 1.4, H, true, 'booth');

    this.doorPivot.position.set(x0, 0, z0 + 2.6);
    const door = this.box(0.08, 2.2, 1.0, mat('#8e6e53'), 0, 1.1, -0.5, this.doorPivot);
    door.userData.interact = { kind: 'door' } satisfies Interact;
    this.interactables.push(door);
    const doorSign = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.6),
      new THREE.MeshStandardMaterial({ map: textTexture(['WC', 'APPROVED HUMAN', 'RELIEF STATION'], { w: 320, h: 240, bg: '#2e86c1', fg: '#ffffff' }) }),
    );
    doorSign.position.set(-0.045, 1.55, -0.5);
    doorSign.rotation.y = -Math.PI / 2;
    this.doorPivot.add(doorSign);
    this.scene.add(this.doorPivot);
    this.doorCollider = aabb(x0, z0 + 2.1, 0.15, 1.0, 2.2, true, 'door');
    this.colliders.push(this.doorCollider);

    this.sign(keyLines, 1.4, 0.9, x0 - 0.09, 1.6, z0 + 0.8, -Math.PI / 2, { bg: '#ffffff', fg: '#c0392b', border: '#c0392b' });
    this.sign(['BREAK TIMER ACTIVE', 'Brad is counting'], 1.2, 0.5, x0 + 4.9, 1.9, z0 + 2, -Math.PI / 2, { bg: '#111111', fg: '#ff4d4d' });

    const loo = new THREE.Group();
    loo.position.set(x0 + 4.3, 0, z0 + 2);
    if (!this.prop('toilet', 0, 0, 0, 0, loo)) {
      const white = mat('#fbfcfc', { roughness: 0.2 });
      this.box(0.18, 0.5, 0.45, white, 0.42, 0.65, 0, loo);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.42, 16), white);
      bowl.position.y = 0.21;
      loo.add(bowl);
    }
    loo.userData.interact = { kind: 'toilet' } satisfies Interact;
    this.scene.add(loo);
    this.interactables.push(loo);

    this.booth = { minX: x0, maxX: x0 + 5, minZ: z0, maxZ: z0 + 4 };
    this.doorFront = new THREE.Vector3(x0 - 1.4, 0, z0 + 2.1);
  }
}
