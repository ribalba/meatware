import type { ModelSpec } from '../../assets';

/** 3D models of the toll job (Kenney car kit and retro urban kit, CC0). */
const M = `${import.meta.env.BASE_URL}models/toll`;
const car = (f: string, height: number): ModelSpec => ({ url: `${M}/car/${f}.glb`, height });
const urban = (f: string, spec: Omit<ModelSpec, 'url'>): ModelSpec => ({ url: `${M}/urban/${f}.glb`, ...spec });

export const TOLL_MODELS: Record<string, ModelSpec> = {
  toll_sedan: car('sedan', 1.75),
  toll_sedanSports: car('sedan-sports', 1.6),
  toll_hatch: car('hatchback-sports', 1.65),
  toll_suv: car('suv', 1.95),
  toll_suvLux: car('suv-luxury', 1.95),
  toll_van: car('van', 2.1),
  toll_truck: car('truck', 2.2),
  toll_truckFlat: car('truck-flat', 2.0),
  toll_delivery: car('delivery', 2.6),
  toll_taxi: car('taxi', 1.9),
  toll_police: car('police', 1.8),
  toll_ambulance: car('ambulance', 2.6),
  toll_garbage: car('garbage-truck', 2.9),
  toll_tractor: car('tractor', 2.3),
  toll_race: car('race-future', 1.15),
  toll_cone: car('cone', 0.7),
  toll_coneFlat: car('cone-flat', 0.12),
  toll_crate: car('box', 0.5),
  toll_debrisTire: car('debris-tire', 0.45),
  toll_debrisBumper: car('debris-bumper', 0.35),
  toll_treeLarge: urban('tree-large', { height: 7.5 }),
  toll_pineLarge: urban('tree-pine-large', { height: 9 }),
  toll_pineSmall: urban('tree-pine-small', { height: 3.2 }),
  toll_shrub: urban('tree-shrub', { height: 1.0 }),
  toll_treeSmall: urban('tree-small', { height: 1.2 }),
  toll_treePark: urban('tree-park-large', { height: 6 }),
  toll_lightSingle: urban('detail-light-single', { height: 7.2 }),
  toll_lightDouble: urban('detail-light-double', { height: 8 }),
  toll_jersey: urban('detail-barrier-strong-type-a', { width: 2.4 }),
  toll_jerseyDamaged: urban('detail-barrier-strong-damaged', { width: 2.4 }),
  toll_roadBarrier: urban('detail-barrier-type-a', { width: 1.6 }),
  toll_dumpster: urban('detail-dumpster-closed', { width: 2.0 }),
  toll_bench: urban('detail-bench', { width: 1.6 }),
  toll_truckGrey: urban('truck-grey', { width: 7.5 }),
  toll_truckGreen: urban('truck-green-cargo', { width: 5.5 }),
  toll_pallet: urban('pallet', { width: 1.2 }),
  toll_palletSmall: urban('pallet-small', { width: 0.7 }),
  toll_fence: urban('wall-fence', { width: 3 }),
  tlChair: { url: `${M}/furniture/chairDesk.glb`, height: 1.0 },
  tlLounge: { url: `${M}/furniture/loungeChairRelax.glb`, width: 0.9 },
  tlLamp: { url: `${M}/furniture/lampRoundFloor.glb`, height: 1.6 },
  tlTrash: { url: `${M}/furniture/trashcan.glb`, height: 0.55 },
};

/** Car models with how often they show up. */
export const CAR_KINDS: { key: string; weight: number }[] = [
  { key: 'toll_sedan', weight: 10 },
  { key: 'toll_sedanSports', weight: 5 },
  { key: 'toll_hatch', weight: 6 },
  { key: 'toll_suv', weight: 7 },
  { key: 'toll_suvLux', weight: 4 },
  { key: 'toll_van', weight: 5 },
  { key: 'toll_truck', weight: 4 },
  { key: 'toll_truckFlat', weight: 2 },
  { key: 'toll_delivery', weight: 3 },
  { key: 'toll_taxi', weight: 4 },
  { key: 'toll_ambulance', weight: 1 },
  { key: 'toll_garbage', weight: 1.5 },
  { key: 'toll_tractor', weight: 0.6 },
  { key: 'toll_race', weight: 1.2 },
];
