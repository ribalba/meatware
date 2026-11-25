import * as THREE from 'three';
import { aabb, TextTexOpts, textTexture } from './util';
import { CAT_COLORS, CATEGORIES, Category, FRAME_DEF, Item, ITEM_DEFS, TIRE_DEF } from './items';
import * as T from './texts';
import type { Customer } from './customers';
import { hasModel } from './assets';
import { Interact as BaseInteract, LevelKit } from './level';
import { addDetails, Details } from './details';
import { ceilingTex, floorTex, priceStripTex, shelfMetalTex, wallTex } from './textures';

export interface Slot {
  section: ShelfSection;
  pos: THREE.Vector3;
  item: Item | null;
}
export interface ShelfSection {
  category: Category;
  z: number;
  slots: Slot[];
  group: THREE.Group;
}
export type { Plant } from './level';
/** What the player looks at in the store. */
export interface Interact extends BaseInteract {
  section?: ShelfSection;
  customer?: Customer;
}

export const ROOM = { minX: -20, maxX: 20, minZ: -15, maxZ: 15 };
export const BOOTH = { minX: 15, maxX: 20, minZ: -15, maxZ: -11 };
export const CORRIDOR_X = 0;
/** Walkway west of the shelves. */
export const WEST_X = -11.2;
export const SHELF_X0 = -10;
export const SHELF_LEN = 8;
export const SHELF_ZS = [-9, -4.5, 0, 4.5, 9];
export const LEVELS = [0.42, 1.22];

function mat(color: string, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
}

export function putInSlot(scene: THREE.Scene, item: Item, slot: Slot): void {
  slot.item = item;
  item.slot = slot;
  item.state = 'shelf';
  item.sleeping = false;
  item.vel.set(0, 0, 0);
  scene.add(item.mesh);
  item.mesh.position.set(slot.pos.x, slot.pos.y + item.baseOffset, slot.pos.z);
  item.mesh.rotation.set(0, 0, 0);
}

/** The SHOPOTRON 9000 hypermarket, workplace of the shelf stacker. */
export class World extends LevelKit {
  shelves: ShelfSection[] = [];
  details!: Details;

  constructor(scene: THREE.Scene) {
    super(scene);
    this.bounds = ROOM;
    this.spawn = { pos: new THREE.Vector3(-13.5, 0, -10.5), yaw: -2.4 };
    for (const z of SHELF_ZS) this.bossWaypoints.push(new THREE.Vector3(-8, 0, z + 2.2), new THREE.Vector3(-3, 0, z + 2.2));
    this.bossWaypoints.push(
      new THREE.Vector3(CORRIDOR_X, 0, -12),
      new THREE.Vector3(CORRIDOR_X, 0, 12),
      new THREE.Vector3(-15, 0, -10),
      new THREE.Vector3(-14, 0, 9),
      new THREE.Vector3(10, 0, -9),
      new THREE.Vector3(10, 0, 5),
      new THREE.Vector3(-16, 0, 0),
    );
    this.lights();
    this.room();
    this.buildShelves();
    this.pallet();
    this.desk();
    this.toilet();
    this.buildPlants();
    this.decor();
    this.posters();
    this.details = addDetails(this);
    this.onTick((t) => this.details.tick(t));
  }

  private lights(): void {
    this.scene.background = new THREE.Color('#20252b');
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6b6b60', 2.2));
    const d = new THREE.DirectionalLight('#fff8e8', 1.0);
    d.position.set(6, 12, 4);
    this.scene.add(d);
  }

  private room(): void {
    // Floor tiles, 1 m each
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30, 40, 30), new THREE.MeshStandardMaterial({ map: floorTex([20, 15]), roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(40, 30, 20, 15), new THREE.MeshStandardMaterial({ map: ceilingTex([20, 15]), roughness: 0.9 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 5;
    this.scene.add(ceiling);
    const panel = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1 });
    for (const x of [-15, -7.5, 0, 7.5, 15]) for (const z of [-10, 0, 10]) this.box(1.2, 0.05, 2.4, panel, x, 4.95, z);

    const wallLong = new THREE.MeshStandardMaterial({ map: wallTex([16, 2]), roughness: 0.9 });
    const wallShort = new THREE.MeshStandardMaterial({ map: wallTex([12, 2]), roughness: 0.9 });
    const stripe = mat('#8e2a1f');
    this.box(40.4, 5, 0.4, wallLong, 0, 2.5, -15.2);
    this.box(40.4, 5, 0.4, wallLong, 0, 2.5, 15.2);
    this.box(0.4, 5, 30, wallShort, -20.2, 2.5, 0);
    this.box(0.4, 5, 30, wallShort, 20.2, 2.5, 0);
    // Dark skirting along the bottom of the walls
    const skirt = mat('#3d3a33');
    this.box(40, 0.18, 0.04, skirt, 0, 0.09, -14.98);
    this.box(40, 0.18, 0.04, skirt, 0, 0.09, 14.98);
    this.box(0.04, 0.18, 30, skirt, -19.98, 0.09, 0);
    this.box(0.04, 0.18, 30, skirt, 19.98, 0.09, 0);
    this.box(40, 0.25, 0.05, stripe, 0, 1.1, -14.98);
    this.box(40, 0.25, 0.05, stripe, 0, 1.1, 14.98);
    this.box(0.05, 0.25, 30, stripe, -19.98, 1.1, 0);
    this.box(0.05, 0.25, 30, stripe, 19.98, 1.1, 0);
    this.colliders.push(
      aabb(0, -15.2, 40.4, 0.4, 5, false),
      aabb(0, 15.2, 40.4, 0.4, 5, false),
      aabb(-20.2, 0, 0.4, 30, 5, false),
      aabb(20.2, 0, 0.4, 30, 5, false),
    );

    this.sign([T.STORE_NAME, 'HYPERMARKET', 'now staffed by real humans*'], 9, 1.8, 0, 3.6, 14.95, Math.PI, { bg: '#c0392b', fg: '#ffffff', border: '#ffffff' });
    this.sign(['*for entertainment purposes only'], 4, 0.3, 0, 2.5, 14.95, Math.PI, { bg: '#ffffff', fg: '#555555' });

    // Staff exit with a scanner arch
    const exitDoor = this.box(2, 2.4, 0.06, mat('#7f8c8d', { metalness: 0.5 }), 8, 1.2, 14.95);
    exitDoor.userData.interact = { kind: 'sign', text: 'The exit opens when your shift ends. Or when you are fired. Whichever comes first.' } satisfies Interact;
    this.interactables.push(exitDoor);
    this.sign(['STAFF EXIT', 'smile for the exit scanner'], 2.4, 0.6, 8, 2.75, 14.9, Math.PI, { bg: '#27ae60', fg: '#ffffff' });
    const post = mat('#95a5a6', { metalness: 0.6 });
    this.box(0.2, 2.5, 0.3, post, 6.7, 1.25, 14.5);
    this.box(0.2, 2.5, 0.3, post, 9.3, 1.25, 14.5);
    this.box(2.8, 0.2, 0.3, new THREE.MeshStandardMaterial({ color: '#e74c3c', emissive: '#e74c3c', emissiveIntensity: 0.8 }), 8, 2.55, 14.5);
    this.colliders.push(aabb(6.7, 14.5, 0.2, 0.3, 2.5, false), aabb(9.3, 14.5, 0.2, 0.3, 2.5, false));
  }

  private buildShelves(): void {
    const frameM = new THREE.MeshStandardMaterial({ map: shelfMetalTex([8, 2]), roughness: 0.6 });
    const boardM = mat('#e8ecef');
    CATEGORIES.forEach((cat, i) => {
      const z = SHELF_ZS[i];
      const g = new THREE.Group();
      g.position.set(SHELF_X0 + SHELF_LEN / 2, 0, z);
      const section: ShelfSection = { category: cat, z, slots: [], group: g };
      this.box(SHELF_LEN, 2.1, 0.06, frameM, 0, 1.05, -0.32, g);
      this.box(0.06, 2.1, 0.7, frameM, -SHELF_LEN / 2, 1.05, 0, g);
      this.box(0.06, 2.1, 0.7, frameM, SHELF_LEN / 2, 1.05, 0, g);
      this.box(SHELF_LEN, 0.3, 0.7, frameM, 0, 0.15, 0, g);
      for (const y of LEVELS) {
        this.box(SHELF_LEN, 0.04, 0.66, boardM, 0, y - 0.02, 0, g);
        this.box(SHELF_LEN, 0.06, 0.01, new THREE.MeshStandardMaterial({ map: priceStripTex(CAT_COLORS[cat], [8, 1]) }), 0, y - 0.05, 0.335, g);
      }
      this.box(SHELF_LEN, 0.04, 0.66, boardM, 0, 2.02, 0, g);

      const signTex = textTexture([cat, `AISLE ${i + 1}`], { w: 512, h: 128, bg: CAT_COLORS[cat], fg: '#ffffff', border: '#ffffff' });
      const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.8 });
      const front = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), signMat);
      front.position.set(0, 2.5, 0.01);
      g.add(front);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), signMat);
      back.position.set(0, 2.5, -0.01);
      back.rotation.y = Math.PI;
      g.add(back);
      const cap = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.4), signMat);
      cap.position.set(SHELF_LEN / 2 + 0.04, 1.75, 0);
      cap.rotation.y = Math.PI / 2;
      g.add(cap);

      g.userData.interact = { kind: 'shelf', section } satisfies Interact;
      this.scene.add(g);
      this.interactables.push(g);
      this.colliders.push(aabb(SHELF_X0 + SHELF_LEN / 2, z, SHELF_LEN + 0.06, 0.7, 2.1, true, 'shelf'));

      for (const y of LEVELS) {
        for (let j = 0; j < SHELF_LEN; j++) {
          section.slots.push({ section, pos: new THREE.Vector3(SHELF_X0 + 0.5 + j, y, z + 0.05), item: null });
        }
      }
      const defs = ITEM_DEFS.filter((d) => d.category === cat);
      for (const slot of section.slots) {
        if (Math.random() < 0.45) {
          const it = new Item(defs[Math.floor(Math.random() * defs.length)]);
          putInSlot(this.scene, it, slot);
          this.initialItems.push(it);
        }
      }
      this.shelves.push(section);
    });

    // The previous human left a little surprise.
    const free = this.shelves[3].slots.filter((s) => !s.item);
    if (free.length) {
      const it = new Item(ITEM_DEFS.find((d) => d.id === 'beans')!);
      putInSlot(this.scene, it, free[0]);
      this.initialItems.push(it);
    }
  }

  private pallet(): void {
    const g = new THREE.Group();
    g.position.set(-15.5, 0, -12.5);
    if (hasModel('pallet') && hasModel('boxClosed')) {
      this.prop('pallet', 0, 0, 0, 0, g);
      let i = 0;
      for (const x of [-0.33, 0.33]) {
        for (const z of [-0.28, 0.28]) {
          for (let y = 0; y < 2; y++) this.prop('boxClosed', x, 0.15 + y * 0.5, z, (i++ % 3) * 0.08 - 0.08, g);
        }
      }
      this.prop('boxOpen', 0.1, 1.15, 0, 0.4, g);
    } else {
      this.box(1.4, 0.15, 1.2, mat('#a47148'), 0, 0.075, 0, g);
      const cardboard = mat('#c8a165');
      const tape = mat('#8d6e3f');
      for (const x of [-0.35, 0.35]) {
        for (const z of [-0.28, 0.28]) {
          for (let y = 0; y < 2; y++) {
            this.box(0.62, 0.5, 0.5, cardboard, x, 0.4 + y * 0.52, z, g);
            this.box(0.08, 0.505, 0.505, tape, x, 0.4 + y * 0.52, z, g);
          }
        }
      }
      const top = this.box(0.5, 0.4, 0.45, cardboard, 0.1, 1.38, 0, g);
      top.rotation.y = 0.4;
    }
    g.userData.interact = { kind: 'pallet' } satisfies Interact;
    this.scene.add(g);
    this.interactables.push(g);
    this.colliders.push(aabb(-15.5, -12.5, 1.4, 1.2, 1.55, true, 'pallet'));
    this.sign(['DELIVERY PALLET', 'Infinite. Like your shift.'], 3, 1, -15.5, 2.8, -14.97, 0, { bg: '#f1c40f', fg: '#2c3e50', border: '#2c3e50' });
  }

  private desk(): void {
    this.box(4, 0.95, 1.2, mat('#b03a2e'), -15, 0.475, 11.5);
    this.box(4.1, 0.05, 1.3, mat('#f4f4f4'), -15, 0.975, 11.5);
    this.colliders.push(aabb(-15, 11.5, 4.1, 1.3, 1.0, true, 'desk'));
    this.sign(['SERVICE DESK', 'here to help (ourselves)'], 3, 0.8, -15, 3, 11.5, Math.PI, { bg: '#2c3e50', fg: '#ffffff' });

    const tire = new Item(TIRE_DEF);
    tire.state = 'fixed';
    tire.mesh.position.set(-16.3, 0, 11.5);
    tire.mesh.rotation.x = Math.PI / 2;
    tire.mesh.updateMatrixWorld(true);
    tire.mesh.position.y = 1.0 - new THREE.Box3().setFromObject(tire.mesh).min.y;
    this.scene.add(tire.mesh);
    this.initialItems.push(tire);
    this.sign(['TOILET KEY', 'please return the tire'], 0.8, 0.35, -16.3, 1.3, 10.83, Math.PI, { bg: '#ffffff', fg: '#c0392b', border: '#c0392b' });

    this.prop('register', -15.2, 1.0, 11.55);

    const coffee = new THREE.Group();
    coffee.position.set(-13.8, 1.0, 11.6);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.3),
      new THREE.MeshStandardMaterial({ map: textTexture(['COFFEE', 'subscription required'], { w: 256, h: 180, bg: '#111111', fg: '#ff4d4d' }), emissive: '#ffffff', emissiveIntensity: 0.15 }),
    );
    panel.rotation.y = Math.PI;
    coffee.add(panel);
    if (this.prop('coffee', 0, 0, 0, 0, coffee)) {
      panel.position.set(0, 0.66, 0);
    } else {
      this.box(0.5, 0.75, 0.45, mat('#2c3e50', { metalness: 0.5 }), 0, 0.375, 0, coffee);
      this.box(0.12, 0.04, 0.12, mat('#7f8c8d'), 0, 0.12, -0.2, coffee);
      panel.position.set(0, 0.5, -0.231);
    }
    coffee.userData.interact = { kind: 'coffee' } satisfies Interact;
    this.scene.add(coffee);
    this.interactables.push(coffee);

    const frame = new Item(FRAME_DEF);
    frame.state = 'fixed';
    frame.mesh.position.set(-11.5, 2.2, 14.96);
    frame.mesh.rotation.y = Math.PI;
    this.scene.add(frame.mesh);
    this.initialItems.push(frame);
  }

  private toilet(): void {
    this.toiletBooth(15, -15, ['KEY: SERVICE DESK', 'It is on a tire.', 'Max break: 4 seconds']);
    this.sign(['EMPLOYEE TOILET', 'is in the OTHER corner.', 'Walking is exercise.', 'Exercise is a benefit.'], 2.4, 1.4, -19.97, 2.6, -8, Math.PI / 2, { bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' });
  }

  private buildPlants(): void {
    for (const [x, z] of [[-8, 13.6], [4, 13.6], [13, -6], [-19.2, 6]] as [number, number][]) this.plant(x, z);
  }

  /** Furniture that is only there to look like a shop. */
  private decor(): void {
    // Freezers along the back wall
    for (const x of [3, 5.3, 7.6, 9.9]) {
      if (this.prop('freezer', x, 0, -14.45)) this.colliders.push(aabb(x, -14.45, 2.25, 1.1, 2.0, false, 'decor'));
    }
    // Self-checkouts that do not work
    for (const x of [-3.2, -1.2]) {
      const o = this.prop('selfCheckout', x, 0, 14.0);
      if (!o) continue;
      // The job reacts to it (E reads it, a kick wakes it up for a moment).
      o.userData.interact = { kind: 'shFun', id: 'selfCheckout', text: 'SELF CHECKOUT. Out of order since 2069. Please use a human.' } satisfies Interact;
      this.interactables.push(o);
      this.colliders.push(aabb(x, 14.0, 1.0, 0.8, 1.4, false, 'decor'));
    }
    if (hasModel('selfCheckout')) {
      this.sign(['SELF CHECKOUT', 'out of order. use a human.'], 2.4, 0.5, -2.2, 2.0, 14.95, Math.PI, { bg: '#111111', fg: '#ff4d4d' });
    }
    // A row of carts by the staff exit
    let carts = 0;
    for (const x of [11.4, 12.1, 12.8]) if (this.prop('cart', x, 0, 13.8, -Math.PI / 2)) carts++;
    if (carts) this.colliders.push(aabb(12.1, 13.8, 2.4, 1.0, 1.0, false, 'decor'));
    // Fruit display next to the fruit aisle
    if (this.prop('fruitDisplay', 3.6, 0, 10.6)) this.colliders.push(aabb(3.6, 10.6, 1.2, 1.2, 1.0, false, 'decor'));
  }

  private posters(): void {
    const style: TextTexOpts = { bg: '#fdf6e3', fg: '#2c3e50', border: '#c0392b' };
    const spots: [number, number, number, number][] = [
      [-5, 2.8, -14.97, 0],
      [5, 2.8, -14.97, 0],
      [-19.97, 2.8, 2, Math.PI / 2],
      [19.97, 2.8, 0, -Math.PI / 2],
      [19.97, 2.8, 8, -Math.PI / 2],
      [13, 2.8, 14.97, Math.PI],
    ];
    T.POSTERS.forEach((lines, i) => {
      const s = spots[i % spots.length];
      this.sign(lines, 2.4, 1.4, s[0], s[1], s[2], s[3], style, 'A motivational poster. You feel slightly less motivated.');
    });
  }
}
