import type * as THREE from 'three';
import type { ModelSpec } from '../assets';
import type { Sfx } from '../audio';
import type { Boss } from '../boss';
import type { Hud } from '../hud';
import type { Item, ItemDef } from '../items';
import type { Interact, Level } from '../level';
import type { NavGrid } from '../nav';
import type { Player } from '../player';

/**
 * The contract between the shift engine (game.ts) and a job.
 *
 * The engine owns everything every job has: the player, Brad, the bladder and the
 * staff toilet, picking up, throwing, pocketing and inspecting items, puddles,
 * write-ups, the robot live chat, the clock, overtime and the payslip.
 * A job owns its building (a Level), its stations and NPCs, its quota and its jokes.
 */

export interface Look {
  info: Interact;
  point: THREE.Vector3;
  object: THREE.Object3D;
}

export interface Puddle {
  mesh: THREE.Object3D;
  x: number;
  z: number;
  r: number;
}

/** What a job may use from the engine. */
export interface Shift {
  /** The WebGL renderer (for render targets like live camera monitors). */
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly hud: Hud;
  readonly sfx: Sfx;
  readonly boss: Boss;
  readonly player: Player;
  readonly nav: NavGrid;
  /** All loose items (world, shelf, fixed and held). */
  readonly items: Item[];
  readonly puddles: Puddle[];
  readonly held: Item | null;
  /** Brad can see the player right now. */
  readonly seen: boolean;
  /** Seconds since the shift started. */
  readonly t: number;
  /** Excitement of the robot audience, 0..100. Raising it is good for the show. */
  hype: number;
  /** Brad's mood bar, 0..100. At 100 the player gets a write-up. */
  annoyance: number;
  /**
   * Set to true while the player works at a station that needs no walking
   * (sitting at monitors, operating a lever). The player cannot move and does not count as idle.
   */
  movementLocked: boolean;
  /** Free counters for the job, e.g. count('folded'). Returns the new value. */
  count(key: string, n?: number): number;
  counter(key: string): number;
  /** Creates an item lying in the world (or fixed in place with `fixed`). */
  addItem(def: ItemDef, pos: THREE.Vector3, fixed?: boolean): Item;
  removeItem(it: Item): void;
  /** Puts an item into the player's hands. */
  pickUp(it: Item): void;
  /** Takes the held item out of the hands without deleting it (it is not in the scene afterwards). */
  detachHeld(): Item | null;
  /** Deletes the held item. */
  removeHeld(): void;
  writeUp(reason: string): void;
  fire(reason: string): void;
  achieve(id: string): void;
  /** The player found a secret (an id from `Job.secrets`). Shows a toast once per shift, remembered forever. */
  secret(id: string): void;
  /** Breaks a `kit.breakable` object at once, with debris and payslip cost. */
  breakObject(obj: THREE.Object3D): void;
  /** Brad says a random line from his line table (engine and job lines are merged). */
  bossSay(key: string, force?: boolean): void;
  /** Robot chat reacts with lines from the chat table. */
  chat(key: string, vars?: Record<string, string>, n?: number): void;
  /** Short narration text in the subtitle box. */
  say(text: string, seconds?: number): void;
  /** A puddle on the floor. Default is the classic yellow. Pass a color for water, wine, coffee. */
  makePuddle(x: number, z: number, color?: string): void;
  removePuddle(index: number): void;
}

export interface JobInfo {
  id: string;
  /** Shown in the HUD, like "SHELF STACKER". */
  title: string;
  /** Workplace name, like "SHOPOTRON 9000 Hypermarket". */
  place: string;
  /** Short funny line on the job card. */
  teaser: string;
  /** Label of the quota bar. */
  quotaLabel: string;
  /** Message at the locked toilet door when you do not hold the key. */
  lockedDoor: string;
  /** Message when the bladder gets urgent. */
  bladderWarning: string;
  /** Hour the 8 hour shift starts (default 9, a night shift could use 22). */
  startHour?: number;
}

export interface Job {
  info: JobInfo;
  level: Level;
  /** Called once when the engine is ready (spawn NPCs, register things). */
  start(shift: Shift): void;
  /** Every frame while playing. */
  update(dt: number): void;
  /** Circles the player bumps into (NPCs). */
  obstacles(): { x: number; z: number; r: number }[];
  /** Extra objects the player can look at and use (NPC groups). */
  lookTargets(): THREE.Object3D[];
  /** E pressed. Return true if the job handled it. */
  interact(look: Look | null): boolean;
  /** Hint under the crosshair, or null for the engine's default. */
  hint(look: Look | null): string | null;
  quota(): { done: number; target: number };
  /** A thrown item is flying fast. Return true if it hit something of the job. */
  thrownHit?(item: Item): boolean;
  /**
   * The player kicked (K or right mouse). `look` is what the crosshair is on, maybe far away.
   * Return true if the job handled it (a robot, a machine). Breakables and items work without it.
   */
  onKick?(look: Look | null): boolean;
  /** Secret ids and their titles, shown when found and counted on the title screen. */
  secrets?: Record<string, string>;
  /** Gains in hype are multiplied by this (an influencer filming doubles them). */
  hypeMultiplier?(): number;
  /** Text for the ON CAMERA banner, empty when nobody films. */
  cameraLabel?(): string;
  /** Line under "Holding:" for the held item. */
  heldLabel?(it: Item): string;
  /** Rows of the performance review, shown before the general ones. */
  reviewRows(): [string, string | number][];
  /** Payslip lines specific to the job. `fired` is true when the shift ended with getting fired. */
  payRows(fired?: boolean): [string, number][];
  /** The shift is over (review screen). Clean up DOM panels and key listeners here. */
  onEnd?(fired: boolean): void;
  /** Extra keys for the help bar at the bottom, e.g. [['F', 'loyalty card'], ['R', 'bagging line']]. */
  helpKeys?: [string, string][];
  /** Did the player do the job well enough to count as productive? */
  productive(): boolean;
  employeeOfTheMonth?(pocket: ItemDef[], fired: boolean): string;
  /** Lines merged into Brad's table. `shiftStart` replaces the default greeting. */
  bossLines?: Record<string, string[]>;
  chatLines?: Record<string, string[]>;
  achievements?: Record<string, { title: string; text: string }>;
}

/** An entry on the job selection screen. */
export interface JobEntry {
  id: string;
  title: string;
  place: string;
  teaser: string;
  /** Extra 3D models this job needs, loaded before it starts (files in public/models/). */
  models?: Record<string, ModelSpec>;
  create(scene: THREE.Scene): Job;
}
