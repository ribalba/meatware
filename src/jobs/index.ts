import { foundSecrets, secretTotal } from '../fun';
import * as T from '../texts';
import { BURGER_ENTRY } from './burger';
import { DISHES_ENTRY } from './dishes';
import { ELEVATOR_ENTRY } from './elevator';
import { GUARD_ENTRY } from './guard';
import { MAIL_ENTRY } from './mail';
import { TOLL_ENTRY } from './toll';
import { CHECKOUT_ENTRY } from './checkout';
import { LAUNDRY_ENTRY } from './laundry';
import { PICKER_ENTRY } from './picker';
import { SHELVES_ENTRY } from './shelves';
import type { JobEntry } from './types';

/**
 * All jobs on the selection screen, in order.
 * Jobs that are not built yet appear as locked cards.
 */
export const JOBS: JobEntry[] = [SHELVES_ENTRY, LAUNDRY_ENTRY, BURGER_ENTRY, CHECKOUT_ENTRY, PICKER_ENTRY, GUARD_ENTRY, ELEVATOR_ENTRY, TOLL_ENTRY, DISHES_ENTRY, MAIL_ENTRY].filter((j): j is JobEntry => !!j);

const COMING_SOON: { title: string; teaser: string }[] = [
  { title: 'Laundry Folder', teaser: 'Coming soon. The fitted sheet is still in testing.' },
  { title: 'Burger Flipper', teaser: 'Coming soon. The ice cream machine is broken.' },
  { title: 'Checkout Human', teaser: 'Coming soon. Unexpected item in bagging area.' },
  { title: 'Warehouse Picker', teaser: 'Coming soon. Your steps are already being counted.' },
  { title: 'Night Security Guard', teaser: 'Coming soon. Nothing will happen. Watch it happen.' },
  { title: 'Elevator Operator', teaser: 'Coming soon. Going up. Emotionally down.' },
  { title: 'Toll Booth Operator', teaser: 'Coming soon. The cars do not stop.' },
  { title: 'Dishwasher', teaser: 'Coming soon. Robots do not eat. The plates are for the vibe.' },
  { title: 'Mail Sorter', teaser: 'Coming soon. Every letter is urgent.' },
].filter((c) => !JOBS.some((j) => j.title === c.title));

export function findJob(id: string | null): JobEntry {
  return JOBS.find((j) => j.id === id) ?? JOBS[0];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** The title screen with the job selection. Clicking another job reloads into it. */
/** "SECRETS 3/14" once a job was played. */
function secretsLine(id: string): string {
  const total = secretTotal(id);
  if (!total) return '';
  return `<i class="sec">SECRETS ${Math.min(foundSecrets(id).length, total)}/${total}</i>`;
}

export function titleHtml(selected: string): string {
  const cards = [
    ...JOBS.map(
      (j) =>
        `<div class="job${j.id === selected ? ' active' : ' pick'}" data-job="${j.id}"><b>${esc(j.title)}</b><span>${esc(j.place)}</span><em>${esc(j.teaser)}</em>${secretsLine(j.id)}</div>`,
    ),
    ...COMING_SOON.map((c) => `<div class="job locked"><b>${esc(c.title)}</b><span>${esc(c.teaser)}</span></div>`),
  ].join('\n    ');
  return T.TITLE_HTML.replace(/<div class="jobs">[\s\S]*?<\/div>\s*<div class="actions">/, `<div class="jobs">\n    ${cards}\n  </div>\n  <div class="actions">`);
}
