import type { ModelSpec } from '../../assets';
import type { JobEntry } from '../types';
import { LaundryJob } from './job';
import { PLACE } from './texts';

const M = `${import.meta.env.BASE_URL}models/laundry`;

/** Models only this job uses. Missing files fall back to primitive shapes. */
const MODELS: Record<string, ModelSpec> = {
  ldWasher: { url: `${M}/furniture/washer.glb`, height: 1.0 },
  ldDryer: { url: `${M}/furniture/dryer.glb`, height: 1.0 },
  ldStack: { url: `${M}/furniture/washerDryerStacked.glb`, height: 1.9 },
  ldChair: { url: `${M}/furniture/chair.glb`, height: 0.9 },
  ldTrash: { url: `${M}/furniture/trashcan.glb`, height: 0.75 },
  ldTableCoffee: { url: `${M}/furniture/tableCoffee.glb`, height: 0.4 },
  ldBench: { url: `${M}/furniture/benchCushionLow.glb`, height: 0.5 },
  ldRack: { url: `${M}/mini-shop/clothing-rack.glb`, height: 1.7 },
  ldClothTable: { url: `${M}/mini-shop/clothing-table.glb`, height: 0.9 },
  ldHandTruck: { url: `${M}/mini-shop/hand-truck.glb`, height: 1.2 },
  ldMannequin: { url: `${M}/mini-shop/mannequin.glb`, height: 1.75 },
  ldGacha: { url: `${M}/mini-shop/gacha-machine.glb`, height: 1.4 },
  ldMachine: { url: `${M}/factory/machine.glb`, height: 1.8 },
};

/** Laundry Folder. */
export const LAUNDRY_ENTRY: JobEntry | null = {
  id: 'laundry',
  title: 'Laundry Folder',
  place: PLACE,
  teaser: 'The fitted sheet is waiting.',
  models: MODELS,
  create: (scene) => new LaundryJob(scene),
};
