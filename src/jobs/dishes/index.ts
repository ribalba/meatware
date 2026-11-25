import type { JobEntry } from '../types';
import { DISHES_MODELS } from './items';
import { DishesJob } from './job';
import { RESTAURANT } from './texts';

/** Dishwasher at Le Robot Gourmand. Robots do not eat. The plates are for the vibe. */
export const DISHES_ENTRY: JobEntry | null = {
  id: 'dishes',
  title: 'Dishwasher',
  place: `${RESTAURANT} (kitchen, back)`,
  teaser: 'Robots do not eat. The plates are for the vibe.',
  models: DISHES_MODELS,
  create: (scene) => new DishesJob(scene),
};
