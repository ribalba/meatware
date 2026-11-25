import * as THREE from 'three';

/**
 * Where everything is in SHOPOTRON EXPRESS. The front of the store (with the entrance and
 * the weather) is at +z, the aisles are at -z. Robots shop at -z and leave at +z.
 */
export const ROOM = { minX: -18, maxX: 18, minZ: -14, maxZ: 14 };

/** Lanes 4 to 8 from west to east. Only lane 7 is open. */
export const LANES: { n: number; x: number }[] = [
  { n: 4, x: -12 },
  { n: 5, x: -8 },
  { n: 6, x: -4 },
  { n: 7, x: 0 },
  { n: 8, x: 4 },
];

/** The counter of a lane runs along z. The cashier side is +x, the customer side is -x. */
export const COUNTER = { z0: -2.3, z1: 3.2, halfW: 0.45, h: 0.9 };
export const CASHIER_WALL_X = 1.9;
export const BELT = { z0: -2.1, z1: 0.38, y: 0.93 };
/** Items stop here (front of the belt, next to the scanner). */
export const BELT_STOP = 0.24;
export const SCAN = { z0: 0.5, z1: 1.2 };
export const BAG = { z0: 1.35, z1: 3.1, y: 0.8 };
export const UNEXPECTED_SPOT = new THREE.Vector3(0, BAG.y, 2.75);

/** The customer aisle of lane 7. */
export const QUEUE_X = -1.1;
/** The front customer unloads here, next to the start of the belt. */
export const UNLOAD_Z = -1.4;
/** And pays here, next to the bagging area. */
export const PAY_Z = 2.2;
/** Waiting spots behind the unloading customer. */
export const QUEUE_ZS = [-3.5, -5.3, -7.1, -8.9];
/** Robots leave the lane here and then walk to the doors. */
export const LANE_EXIT = new THREE.Vector3(QUEUE_X, 0, 4.6);
export const DOORS = { x0: -8.2, x1: -5.0, z: 13.9 };
export const DOOR_POINT = new THREE.Vector3(-6.6, 0, 13.3);

/** Where the cashier stands. */
export const CASHIER = new THREE.Vector3(1.25, 0, 0.75);
/** The register pedestal next to the end of the belt. */
export const REGISTER = { x: 0.78, z: -0.45, w: 0.56, d: 0.6, h: 0.95 };

/** The staff toilet in the far back corner, door on its west side. */
export const BOOTH_X0 = 13;
export const BOOTH_Z0 = -14;
/** The full cart with the toilet key, at customer service by the entrance. */
export const CART_KEY_POS = new THREE.Vector3(-13.2, 0, 10.4);

/** The self checkouts and their happy robot users. */
export const SELF_CHECKOUTS: { x: number; z: number; rot: number }[] = [
  { x: 7.4, z: -0.6, rot: -Math.PI / 2 },
  { x: 7.4, z: 2.0, rot: -Math.PI / 2 },
  { x: 11.2, z: -0.6, rot: Math.PI / 2 },
  { x: 11.2, z: 2.0, rot: Math.PI / 2 },
];

/** Where new customers come from: the back aisles. */
export const SPAWNS: THREE.Vector3[] = [
  new THREE.Vector3(-12, 0, -10.2),
  new THREE.Vector3(-7, 0, -13),
  new THREE.Vector3(5, 0, -10.2),
  new THREE.Vector3(7, 0, -13),
  new THREE.Vector3(-14, 0, -6.6),
  new THREE.Vector3(9, 0, -6.6),
];
