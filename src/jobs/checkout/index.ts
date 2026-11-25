import type { JobEntry } from '../types';
import { CHECKOUT_FUN_MODELS } from './fun';
import { CHECKOUT_MODELS } from './items';
import { CheckoutJob } from './job';
import { PLACE } from './texts';

/** Checkout Human at SHOPOTRON EXPRESS, lane 7. The only lane staffed by a human. */
export const CHECKOUT_ENTRY: JobEntry | null = {
  id: 'checkout',
  title: 'Checkout Human',
  place: PLACE,
  teaser: 'Unexpected item in bagging area.',
  models: { ...CHECKOUT_MODELS, ...CHECKOUT_FUN_MODELS },
  create: (scene) => new CheckoutJob(scene),
};
