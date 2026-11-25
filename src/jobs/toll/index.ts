import type { JobEntry } from '../types';
import { TollJob } from './job';
import { TOLL_MODELS } from './models';
import { PLAZA_NAME } from './texts';

/** Toll Booth Operator at the AUTOBAHN 2071 toll plaza. */
export const TOLL_ENTRY: JobEntry | null = {
  id: 'toll',
  title: 'Toll Booth Operator',
  place: PLAZA_NAME,
  teaser: 'The cars do not stop. They never stop.',
  models: TOLL_MODELS,
  create: (scene) => new TollJob(scene),
};
