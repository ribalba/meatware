import type { Ing, TrayData } from './items';

/**
 * The menu of MEGABYTE BURGER and how a tray is checked against a ticket.
 * Stacks are listed from the bottom up, the way you build them.
 */

export type Special = 'existence' | 'icecream' | null;

export interface MenuItem {
  name: string;
  stack: Ing[];
  fries: number;
  nuggets: number;
  special: Special;
  weight: number;
  /** Can get a side of fries added. */
  side?: boolean;
}

const B: Ing = 'BUN';
const P: Ing = 'PATTY';
const C: Ing = 'CHEESE';
const L: Ing = 'LETTUCE';
const T: Ing = 'TOMATO';
const O: Ing = 'ONION';

export const MENU: MenuItem[] = [
  { name: 'CLASSIC BYTE', stack: [B, P, L, T, B], fries: 0, nuggets: 0, special: null, weight: 10, side: true },
  { name: 'CHEESE BYTE', stack: [B, P, C, B], fries: 0, nuggets: 0, special: null, weight: 10, side: true },
  { name: 'THE ANALOG', stack: [B, P, C, L, T, B], fries: 0, nuggets: 0, special: null, weight: 5, side: true },
  { name: 'DOUBLE DOWNLOAD', stack: [B, P, C, P, C, B], fries: 0, nuggets: 0, special: null, weight: 4 },
  { name: 'THE RECURSION', stack: [B, P, B, P, B], fries: 0, nuggets: 0, special: null, weight: 3 },
  { name: 'THE ONION ROUTER', stack: [B, P, O, O, O, B], fries: 0, nuggets: 0, special: null, weight: 3 },
  { name: 'UPSIDE DOWN UPDATE', stack: [B, T, L, P, B], fries: 0, nuggets: 0, special: null, weight: 2 },
  { name: 'NO BUN, NO PATTY, EXTRA BUN', stack: [B], fries: 0, nuggets: 0, special: null, weight: 2 },
  { name: '1x BURGER, HOLD EXISTENCE', stack: [], fries: 0, nuggets: 0, special: 'existence', weight: 2 },
  { name: 'SALAD (IRONIC)', stack: [L, T, O], fries: 0, nuggets: 0, special: null, weight: 2 },
  { name: 'JUST THE FRIES, HUMAN', stack: [], fries: 1, nuggets: 0, special: null, weight: 3 },
  { name: '1x SOFT SERVE', stack: [], fries: 0, nuggets: 0, special: 'icecream', weight: 2 },
];

export const KID_ORDER: MenuItem = { name: '40 NUGGETS', stack: [], fries: 0, nuggets: 4, special: null, weight: 0 };
export const CRITIC_ORDER: MenuItem = { name: 'THE ANALOG + FRIES', stack: [B, P, C, L, T, B], fries: 1, nuggets: 0, special: null, weight: 0 };
export const FIRST_ORDER: MenuItem = MENU[1];

export type Source = 'COUNTER' | 'DRIVE-THRU' | 'TABLE 3' | 'KID';

export interface Ticket {
  no: number;
  item: MenuItem;
  name: string;
  stack: Ing[];
  fries: number;
  nuggets: number;
  special: Special;
  src: Source;
  /** Lines the drive-thru speaker still hides. */
  garbled: boolean[];
  patience: number;
  maxPatience: number;
}

let ticketNo = 100;

export function pickMenu(exclude: Special[] = []): MenuItem {
  const list = MENU.filter((mi) => !exclude.includes(mi.special));
  const total = list.reduce((s, mi) => s + mi.weight, 0);
  let r = Math.random() * total;
  for (const mi of list) {
    r -= mi.weight;
    if (r <= 0) return mi;
  }
  return list[0];
}

export function makeTicket(item: MenuItem, src: Source, patience: number, garble = false, plain = false): Ticket {
  const fries = item.fries + (item.side && !plain && Math.random() < 0.3 ? 1 : 0);
  const name = fries > item.fries ? `${item.name} + FRIES` : item.name;
  const n = item.stack.length + (fries ? 1 : 0) + (item.nuggets ? 1 : 0) + 1;
  const garbled = Array.from({ length: n }, (_, i) => garble && (i === 0 || Math.random() < 0.6));
  return { no: ++ticketNo, item, name, stack: [...item.stack], fries, nuggets: item.nuggets, special: item.special, src, garbled, patience, maxPatience: patience };
}

/** Display lines of a ticket: the name first, then the stack bottom up, then the sides. */
export function ticketLines(t: Ticket): string[] {
  const lines = [t.name];
  if (t.special === 'existence') lines.push('(nothing. at all.)');
  if (t.special === 'icecream') lines.push('SOFT SERVE x1', 'machine: ???');
  t.stack.forEach((ing, i) => lines.push(`${i + 1} ${ing}`));
  if (t.fries) lines.push(`+ ${t.fries}x FRIES`);
  if (t.nuggets) lines.push(`+ ${t.nuggets * 10} NUGGETS`);
  return lines;
}

const NOISE = ['KRZZT', 'KSSHT', 'PFFRT', 'BZZRT', '#&%!', 'KRRK'];
export function garble(s: string, i: number): string {
  return `${NOISE[(i * 7 + s.length) % NOISE.length]}${'?'.repeat(1 + (i % 3))}`;
}

/** Shown lines with the drive-thru noise applied. */
export function shownLines(t: Ticket): string[] {
  return ticketLines(t).map((l, i) => (t.garbled[i] ? garble(l, i) : l));
}

export interface Verdict {
  correct: boolean;
  burnt: boolean;
  floor: boolean;
  soggy: boolean;
  /** How many stack layers match from the bottom. */
  prefix: number;
}

export function judge(t: Ticket, d: TrayData): Verdict {
  let prefix = 0;
  while (prefix < d.stack.length && prefix < t.stack.length && d.stack[prefix].ing === t.stack[prefix]) prefix++;
  const stackOk = d.stack.length === t.stack.length && prefix === t.stack.length;
  const correct = t.special !== 'icecream' && stackOk && d.fries.length === t.fries && d.nuggets === t.nuggets;
  const burnt = d.stack.some((p) => p.ing === 'PATTY' && (p.q === 'burnt' || p.q === 'charcoal')) || d.fries.some((f) => f.q === 'burnt');
  const soggy = d.fries.some((f) => f.q === 'soggy');
  const floor = d.floor || d.stack.some((p) => p.floor) || d.fries.some((f) => f.floor);
  return { correct, burnt, floor, soggy, prefix };
}
