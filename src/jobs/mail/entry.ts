import type { ModelSpec } from '../../assets';
import type { JobEntry } from '../types';
import { MailJob } from './job';

const M = `${import.meta.env.BASE_URL}models/mail`;

/** Kenney furniture, factory and mini shop models (CC0), copied into public/models/mail. */
const MODELS: Record<string, ModelSpec> = {
  mail_toaster: { url: `${M}/furniture/toaster.glb`, height: 0.2 },
  mail_micro: { url: `${M}/furniture/kitchenMicrowave.glb`, height: 0.32 },
  mail_fridge: { url: `${M}/furniture/kitchenFridgeSmall.glb`, height: 0.95 },
  mail_chair: { url: `${M}/furniture/chairDesk.glb`, height: 1.0 },
  mail_desk: { url: `${M}/furniture/desk.glb`, height: 0.78 },
  mail_screen: { url: `${M}/furniture/computerScreen.glb`, height: 0.42 },
  mail_radio: { url: `${M}/furniture/radio.glb`, height: 0.22 },
  mail_trash: { url: `${M}/furniture/trashcan.glb`, height: 0.6 },
  mail_coatrack: { url: `${M}/furniture/coatRackStanding.glb`, height: 1.8 },
  mail_tv: { url: `${M}/furniture/televisionVintage.glb`, height: 0.45 },
  mail_fan: { url: `${M}/furniture/ceilingFan.glb`, width: 1.4 },
  mail_coffee: { url: `${M}/furniture/kitchenCoffeeMachine.glb`, height: 0.4 },
  mail_bookcase: { url: `${M}/furniture/bookcaseClosedDoors.glb`, height: 2.0 },
  mail_arm: { url: `${M}/factory/robot-arm-a.glb`, height: 1.0 },
  mail_hopper: { url: `${M}/factory/hopper-square.glb`, height: 0.7 },
  mail_lever: { url: `${M}/factory/lever-single.glb`, height: 0.35 },
  mail_handtruck: { url: `${M}/shop/hand-truck.glb`, height: 1.2 },
  mail_sidetable: { url: `${M}/furniture/sideTableDrawers.glb`, height: 0.62 },
};

export const MAIL_JOB_ENTRY: JobEntry = {
  id: 'mail',
  title: 'Mail Sorter',
  place: 'POSTAL UNIT 7 Sorting Office',
  teaser: 'Every letter is urgent. None of them are.',
  models: MODELS,
  create: (scene) => new MailJob(scene),
};
