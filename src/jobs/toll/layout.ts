/**
 * Floor plan of the AUTOBAHN 2071 toll plaza.
 * The road runs along z. Cars come from -z (far away in the fog) and drive towards +z.
 * Six lanes, each with a toll island (booth + barrier) on its west side.
 */

export const LANE_W = 3.6;
export const ISLAND_W = 2.0;
export const LANES = 6;
/** Total width of lanes and islands. */
export const ROAD_W = LANES * LANE_W + (LANES + 1) * ISLAND_W;
export const ROAD_X0 = -ROAD_W / 2;
export const ROAD_X1 = ROAD_W / 2;

/** Centre x of island k (0..6). Island k serves lane k+1 to its east. */
export const islandX = (k: number): number => ROAD_X0 + ISLAND_W / 2 + k * (LANE_W + ISLAND_W);
/** Centre x of lane 1..6. */
export const laneX = (lane: number): number => islandX(lane - 1) + (ISLAND_W + LANE_W) / 2;

/** The lane the human operates (booth 3). */
export const MY_LANE = 3;
export const MY_ISLAND = MY_LANE - 1;
export const MY_ISLAND_X = islandX(MY_ISLAND);
export const MY_LANE_X = laneX(MY_LANE);

/** Islands run from ISLAND_Z0 to ISLAND_Z1. */
export const ISLAND_Z0 = -8.5;
export const ISLAND_Z1 = 7.5;
/** Booth cabins are centered on z = 0. */
export const CABIN_W = 1.7;
export const CABIN_D = 2.8;
export const CABIN_H = 2.6;
/** The barrier arms are a little downstream of the booth. */
export const BARRIER_Z = 2.3;
export const ARM_LEN = 3.35;

/** Where the player sits at the window of booth 3. */
export const SEAT = { x: MY_ISLAND_X + 0.25, z: -0.15 };
/** Window wall of booth 3, facing lane 3. */
export const WINDOW_X = MY_ISLAND_X + CABIN_W / 2;

/** Walkable area of the plaza. */
export const BOUNDS = { minX: -25.5, maxX: 29.5, minZ: -23, maxZ: 19 };

/** Staff building with the toilet, far east. Toilet booth inside spans x0..x0+5, z0..z0+4. */
export const TOILET = { x0: 23.5, z0: 3 };
/** Spare parts yard with the key arm, far west. */
export const YARD = { x: -22.5, z: -6 };

/** Traffic: cars spawn far away in the fog and vanish behind the overpass. */
export const SPAWN_Z = -95;
export const DESPAWN_Z = 72;
