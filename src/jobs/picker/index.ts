import type { JobEntry } from '../types';
import { PickerJob } from './job';
import { PLACE } from './lines';

const M = `${import.meta.env.BASE_URL}models/picker`;

/** Warehouse Picker at EVERYTHING DEPOT Fulfillment Center 4. */
export const PICKER_ENTRY: JobEntry | null = {
  id: 'picker',
  title: 'Warehouse Picker',
  place: PLACE,
  teaser: 'Your steps are already being counted.',
  models: {
    pkCone: { url: `${M}/car/cone.glb`, height: 0.7 },
    pkHandTruck: { url: `${M}/mini-shop/hand-truck.glb`, height: 1.25 },
    pkHopper: { url: `${M}/factory/hopper-high-square.glb`, height: 2.2 },
    pkRobotArm: { url: `${M}/factory/robot-arm-a.glb`, height: 2.2 },
    pkTraffic: { url: `${M}/factory/warning-traffic.glb`, height: 2.2 },
    pkScreen: { url: `${M}/factory/screen-hanging-wide.glb`, width: 1.6 },
    pkScaffold: { url: `${M}/urban/scaffolding-structure.glb`, height: 3.0 },
    pkBarrier: { url: `${M}/urban/detail-barrier-type-a.glb`, width: 1.8 },
    pkPlanks: { url: `${M}/urban/planks.glb`, width: 2.2 },
    pkScreenPc: { url: `${M}/furniture/computerScreen.glb`, height: 0.42 },
    pkRadio: { url: `${M}/furniture/radio.glb`, width: 0.36 },
    pkChair: { url: `${M}/furniture/chairDesk.glb`, height: 1.0 },
    pkTrash: { url: `${M}/furniture/trashcan.glb`, height: 0.55 },
    pkLamp: { url: `${M}/furniture/lampRoundFloor.glb`, height: 1.6 },
  },
  create: (scene) => new PickerJob(scene),
};
