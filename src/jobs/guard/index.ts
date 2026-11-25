import type { ModelSpec } from '../../assets';
import type { JobEntry } from '../types';
import { GuardJob } from './job';

const M = `${import.meta.env.BASE_URL}models/guard`;

/** Models of the night shift: Kenney factory kit and a few furniture pieces (CC0). */
const MODELS: Record<string, ModelSpec> = {
  guardArmA: { url: `${M}/factory/robot-arm-a.glb`, height: 2.7 },
  guardArmB: { url: `${M}/factory/robot-arm-b.glb`, height: 2.5 },
  guardMachine: { url: `${M}/factory/machine.glb`, height: 1.6 },
  guardMachineWin: { url: `${M}/factory/machine-window.glb`, height: 1.6 },
  guardCrane: { url: `${M}/factory/crane.glb`, height: 4.2 },
  guardHopper: { url: `${M}/factory/hopper-high-round.glb`, height: 2.2 },
  guardBoxL: { url: `${M}/factory/box-large.glb`, width: 1.1 },
  guardCog: { url: `${M}/factory/cog-a.glb`, width: 0.24 },
  guardTraffic: { url: `${M}/factory/warning-traffic.glb`, height: 1.3 },
  guardPiston: { url: `${M}/factory/piston-round.glb`, height: 1.0 },
  guardToaster: { url: `${M}/furniture/toaster.glb`, height: 0.2 },
  guardRadio: { url: `${M}/furniture/radio.glb`, width: 0.32 },
  guardKeyboard: { url: `${M}/furniture/computerKeyboard.glb`, width: 0.45 },
  guardTrash: { url: `${M}/furniture/trashcan.glb`, height: 0.5 },
  guardCoatRack: { url: `${M}/furniture/coatRackStanding.glb`, height: 1.85 },
  guardSpeaker: { url: `${M}/furniture/speaker.glb`, height: 0.6 },
  guardBookcase: { url: `${M}/furniture/bookcaseClosedDoors.glb`, height: 1.9 },
  guardFridge: { url: `${M}/furniture/kitchenFridgeSmall.glb`, height: 0.9 },
};

/** Night Security Guard at ROBOTICA Plant 9. */
export const GUARD_ENTRY: JobEntry | null = {
  id: 'guard',
  title: 'Night Security Guard',
  place: 'ROBOTICA Plant 9 (night shift)',
  teaser: 'Nothing will happen. Watch it happen.',
  models: MODELS,
  create: (scene) => new GuardJob(scene),
};
