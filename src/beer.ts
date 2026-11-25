import * as THREE from 'three';
import type { Interact, Level } from './level';
import { NavGrid } from './nav';
import { AABB, aabb, textTexture } from './util';

/**
 * A crate of beer hidden somewhere in every workplace. The engine places it, the player
 * drinks from it, and the screen gets blurrier with every bottle.
 */

export interface BeerSpot {
  pos: THREE.Vector3;
  /** The crate's front (with the note) faces this direction. */
  rotY: number;
  /** Adds a collider. Levels that rebuild their collider list (the elevator) set false. */
  solid?: boolean;
}

export const BEERS_PER_CRATE = 12;

const brown = new THREE.MeshStandardMaterial({ color: '#5a2e0c', roughness: 0.35 });
const cap = new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.4, metalness: 0.4 });
const label = new THREE.MeshStandardMaterial({ color: '#e8d8a8', roughness: 0.8 });

/** One bottle, standing on y = 0. */
export function bottleMesh(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.15, 10), brown);
  body.position.y = 0.075;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.08, 10), brown);
  neck.position.y = 0.19;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 10), cap);
  top.position.y = 0.235;
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.0335, 0.0335, 0.06, 10, 1, true), label);
  lab.position.y = 0.075;
  g.add(body, neck, top, lab);
  return g;
}

export class BeerCrate {
  readonly group = new THREE.Group();
  private bottles: THREE.Object3D[] = [];

  /** The collider, if the crate has one. */
  collider: AABB | null = null;

  constructor(scene: THREE.Scene, level: Level, seed: string) {
    const spot = level.beerSpot ?? findBeerSpot(level, seed);
    const g = this.group;
    g.position.copy(spot.pos);
    g.rotation.y = spot.rotY;

    const W = 0.42;
    const D = 0.3;
    const H = 0.27;
    const plastic = new THREE.MeshStandardMaterial({ color: '#b8401c', roughness: 0.6 });
    const side = new THREE.MeshStandardMaterial({
      map: textTexture(['BREWBOT', 'LAGER'], { w: 256, h: 160, bg: '#b8401c', fg: '#ffe9b0', font: '"Press Start 2P", monospace' }),
      roughness: 0.6,
    });
    // Box faces: +x, -x, +y, -y, +z, -z. The front (+z) and back carry the brand.
    const crate = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [plastic, plastic, plastic, plastic, side, side]);
    crate.position.y = H / 2;
    g.add(crate);

    for (let i = 0; i < BEERS_PER_CRATE; i++) {
      const b = bottleMesh();
      const cx = (i % 4) - 1.5;
      const cz = Math.floor(i / 4) - 1;
      b.position.set(cx * 0.092, H - 0.12, cz * 0.085);
      b.rotation.y = i * 1.3;
      g.add(b);
      this.bottles.push(b);
    }

    const note = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.16),
      new THREE.MeshStandardMaterial({ map: textTexture(['TEAM SPIRIT', 'Property of Brad.', 'Do not drink.'], { w: 256, h: 160, bg: '#f4eecb', fg: '#2a2a2a' }), roughness: 0.9 }),
    );
    note.position.set(0.04, H * 0.45, D / 2 + 0.004);
    note.rotation.z = -0.08;
    g.add(note);

    g.userData.interact = { kind: 'beer' } satisfies Interact;
    level.interactables.push(g);
    scene.add(g);
    if (spot.solid !== false) {
      const s = Math.abs(Math.sin(spot.rotY)) > 0.7;
      this.collider = aabb(spot.pos.x, spot.pos.z, s ? D : W, s ? W : D, H, false, 'beer');
      level.colliders.push(this.collider);
    }
  }

  get left(): number {
    return this.bottles.length;
  }

  /** Takes one bottle out of the crate. */
  take(): boolean {
    const b = this.bottles.pop();
    if (!b) return false;
    b.parent?.remove(b);
    return true;
  }
}

/** A cheap deterministic random number from a string. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/**
 * Finds a reachable place against a wall or a piece of furniture, a short walk away
 * from the spawn point, and not in front of the toilet.
 */
export function findBeerSpot(level: Level, seed: string): BeerSpot {
  const nav = new NavGrid(level.colliders, level.bounds, [level.booth], 0.45);
  const B = level.bounds;
  const cell = 0.5;
  const w = Math.round((B.maxX - B.minX) / cell);
  const h = Math.round((B.maxZ - B.minZ) / cell);
  const cx = (ix: number) => B.minX + (ix + 0.5) * cell;
  const cz = (iz: number) => B.minZ + (iz + 0.5) * cell;
  const free = (ix: number, iz: number) => ix >= 0 && iz >= 0 && ix < w && iz < h && nav.isFree(cx(ix), cz(iz));

  const start = nav.snap(level.spawn.pos);
  const sx = Math.min(w - 1, Math.max(0, Math.floor((start.x - B.minX) / cell)));
  const sz = Math.min(h - 1, Math.max(0, Math.floor((start.z - B.minZ) / cell)));
  const dist = new Int32Array(w * h).fill(-1);
  const queue = [sz * w + sx];
  dist[queue[0]] = 0;
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const near: BeerSpot[] = [];
  const far: BeerSpot[] = [];
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi];
    const ix = i % w;
    const iz = Math.floor(i / w);
    const d = dist[i];
    for (const [dx, dz] of dirs) {
      const nx = ix + dx;
      const nz = iz + dz;
      if (!free(nx, nz)) continue;
      const ni = nz * w + nx;
      if (dist[ni] >= 0) continue;
      dist[ni] = d + 1;
      queue.push(ni);
    }
    if (d < 6) continue;
    const x = cx(ix);
    const z = cz(iz);
    if (Math.hypot(x - level.doorFront.x, z - level.doorFront.z) < 2.5) continue;
    // Against something: the next cell in one direction is blocked. The crate's front faces away from it.
    for (const [dx, dz] of dirs) {
      if (free(ix + dx, iz + dz)) continue;
      const spot = { pos: new THREE.Vector3(x + dx * 0.15, 0, z + dz * 0.15), rotY: Math.atan2(-dx, -dz) };
      (d <= 30 ? near : far).push(spot);
      break;
    }
  }
  const list = near.length ? near : far;
  if (!list.length) return { pos: start.clone().add(new THREE.Vector3(1, 0, 0)), rotY: 0 };
  return list[Math.floor(hash(seed) * list.length)];
}
