import * as THREE from 'three';

/**
 * Floor plan of EVERYTHING DEPOT Fulfillment Center 4 (60 x 40 m).
 *
 *   north (z = -20)
 *   +-----------------------------------------------------------+
 *   | racks: aisles A..H, bays 1..24, bins 1..3   | bulk  | WC  |
 *   |  (cross aisle at z = -9.3)                  | stock |     |
 *   +---------- main corridor (z = 0.6 .. 4.2) ----------------+
 *   | break room   | spawn / time clock | packing | conveyor | docks
 *   +-----------------------------------------------------------+
 *   south (z = 20)
 */
export const ROOM = { minX: -30, maxX: 30, minZ: -20, maxZ: 20 };
export const ROOF_Y = 9;

export const LETTERS = 'ABCDEFGH'.split('');
/** Aisle walkway centers. */
export const AISLE_X = LETTERS.map((_, i) => -25 + 4 * i);
/** Rack centers. Rack i is west of aisle i, rack i + 1 east of it. */
export const RACK_X = Array.from({ length: LETTERS.length + 1 }, (_, i) => -27 + 4 * i);
export const RACK_DEPTH = 1.2;
export const BAY_W = 1.4;
export const BAYS_PER_SEG = 6;
/** Rack segments, south (z0) and north (z1) ends. Bays count from the main corridor. */
export const SEGS = [
  { z0: 0.4, z1: -8.0 },
  { z0: -10.6, z1: -19.0 },
];
export const CROSS_Z = -9.3;
/** Tote decks of bin 1, 2, 3. */
export const BIN_Y = [0.1, 0.7, 1.3];
export const TOTE_H = 0.38;
/** The top beam of the bins. Above it, up to 3.4 m, is the drone lane for Brad. */
export const CAP_Y = 1.86;
export const OVER_Y = [3.5, 4.6, 5.7];
export const RACK_H = 6.6;

export const CORRIDOR_Z = 2.4;

/** Packing station 1. The player stands north of the bench. */
export const BENCH = { x: 0, z: 9.5, w: 7, d: 1.0, h: 0.95 };
export const BOX_SLOT = new THREE.Vector3(-0.3, BENCH.h, BENCH.z);
export const CONVEYOR = { x0: 3.5, x1: 16, z: BENCH.z, h: 0.95 };
export const PILES_X = -5.2;
export const PILE_Z = [8.1, 9.5, 10.9];
export const HOPPER = new THREE.Vector3(8.6, 0, 5.9);

export const BOOTH_X0 = 25;
export const BOOTH_Z0 = -20;
export const JACK_POS = new THREE.Vector3(-26.2, 0, 15.6);
export const SPAWN = new THREE.Vector3(-12.5, 0, 15.2);

/** Center z of bay j (0..11) of any rack. */
export function bayZ(j: number): number {
  return j < BAYS_PER_SEG ? SEGS[0].z0 - BAY_W / 2 - BAY_W * j : SEGS[1].z0 - BAY_W / 2 - BAY_W * (j - BAYS_PER_SEG);
}

/** Bay index along the aisle from a z position, or -1 outside of the racks. */
export function bayIndex(z: number): number {
  for (let s = 0; s < SEGS.length; s++) {
    const seg = SEGS[s];
    if (z <= seg.z0 && z >= seg.z1) return s * BAYS_PER_SEG + Math.min(BAYS_PER_SEG - 1, Math.floor((seg.z0 - z) / BAY_W));
  }
  return -1;
}

/** Bay number printed on the rack. West face: odd, east face: even. */
export const bayNumber = (j: number, side: 'W' | 'E') => (side === 'W' ? 2 * j + 1 : 2 * j + 2);

/** Bin 1..3 from the height of a hit point. */
export function binFromY(y: number): number {
  if (y < BIN_Y[1]) return 1;
  if (y < BIN_Y[2]) return 2;
  return 3;
}

/** The aisle the player stands in (walkway between the racks), or -1. */
export function aisleAt(x: number, z: number): number {
  if (z > SEGS[0].z0 || z < SEGS[1].z1) return -1;
  if (z < SEGS[0].z1 && z > SEGS[1].z0) return -1;
  for (let i = 0; i < AISLE_X.length; i++) if (Math.abs(x - AISLE_X[i]) < 1.4) return i;
  return -1;
}

/** Seeded random, so the warehouse is the same every shift. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
